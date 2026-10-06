import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Easing, Modal } from 'react-native';
import { CookingPot, LucideIcon } from './ui/lucide';
import { colors, font, fs, s } from '../theme';
import { iconFor } from './ui/FoodIcon';

interface Props {
  visible: boolean;
  title: string;
  /** Status lines walked through over the duration. */
  lines: string[];
  /** Icons orbiting the centre. Falls back to food icons for `ingredients`. */
  icons?: LucideIcon[];
  ingredients?: string[];
  centerIcon?: LucideIcon;
  /** Total ms the overlay stays up (progress bar is timed to it). */
  durationMs?: number;
}

const ORBIT = 8;
const DEFAULT_FOODS = ['Egg', 'Spinach', 'Chicken', 'Rice', 'Lemon', 'Garlic', 'Tomato', 'Feta'];

/**
 * Full-screen "working" state shared by every AI feature: icons orbit a
 * glowing lime centre while the status line walks through what's happening.
 */
export const ProcessingOverlay: React.FC<Props> = ({ visible, title, lines, icons, ingredients, centerIcon: Center = CookingPot, durationMs = 2400 }) => {
  const spin = useRef(new Animated.Value(0)).current;
  const bob = useRef(new Animated.Value(0)).current;
  const progress = useRef(new Animated.Value(0)).current;
  const lineFade = useRef(new Animated.Value(1)).current;
  const [line, setLine] = useState(0);

  const orbitIcons = useMemo<LucideIcon[]>(() => {
    if (icons && icons.length) return Array.from({ length: ORBIT }, (_, i) => icons[i % icons.length]);
    const names = ingredients && ingredients.length ? ingredients : DEFAULT_FOODS;
    return Array.from({ length: ORBIT }, (_, i) => iconFor(names[i % names.length]));
  }, [icons, ingredients]);

  useEffect(() => {
    if (!visible) return;
    progress.setValue(0);
    setLine(0);
    const spinLoop = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 7000, easing: Easing.linear, useNativeDriver: true }));
    const bobLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, { toValue: 1, duration: 800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(bob, { toValue: 0, duration: 800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    spinLoop.start();
    bobLoop.start();
    Animated.timing(progress, { toValue: 1, duration: durationMs, easing: Easing.inOut(Easing.cubic), useNativeDriver: false }).start();

    const stepMs = durationMs / lines.length;
    const timers = lines.map((_, i) =>
      setTimeout(() => {
        if (i === 0) return;
        Animated.sequence([
          Animated.timing(lineFade, { toValue: 0, duration: 140, useNativeDriver: true }),
          Animated.timing(lineFade, { toValue: 1, duration: 220, useNativeDriver: true }),
        ]).start();
        setTimeout(() => setLine(i), 140);
      }, i * stepMs),
    );
    return () => {
      spinLoop.stop();
      bobLoop.stop();
      timers.forEach(clearTimeout);
    };
  }, [visible, durationMs, lines, spin, bob, progress, lineFade]);

  const radius = s(92);
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const counterRotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-360deg'] });

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={styles.backdrop}>
        <View style={styles.stage}>
          <Animated.View style={[styles.orbit, { width: radius * 2, height: radius * 2, transform: [{ rotate }] }]}>
            {orbitIcons.map((Icon, i) => {
              const angle = (i / ORBIT) * Math.PI * 2;
              return (
                <Animated.View
                  key={i}
                  style={[
                    styles.satellite,
                    { left: radius + Math.cos(angle) * radius - s(18), top: radius + Math.sin(angle) * radius - s(18), transform: [{ rotate: counterRotate }] },
                  ]}
                >
                  <Icon size={s(18)} color={i % 2 === 0 ? colors.primaryLime : '#FFFFFF'} strokeWidth={1.9} />
                </Animated.View>
              );
            })}
          </Animated.View>
          <Animated.View style={[styles.center, { transform: [{ translateY: bob.interpolate({ inputRange: [0, 1], outputRange: [0, -6] }) }] }]}>
            <Center size={s(36)} color={colors.primaryDark} strokeWidth={1.9} />
          </Animated.View>
        </View>

        <Text style={styles.title}>{title}</Text>
        <Animated.Text style={[styles.line, { opacity: lineFade }]}>{lines[Math.min(line, lines.length - 1)]}…</Animated.Text>

        <View style={styles.track}>
          <Animated.View style={[styles.bar, { width: progress.interpolate({ inputRange: [0, 1], outputRange: ['4%', '100%'] }) }]} />
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(11,13,10,0.97)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  stage: { width: s(220), height: s(220), alignItems: 'center', justifyContent: 'center', marginBottom: s(28) },
  orbit: { position: 'absolute', borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  satellite: { position: 'absolute', width: s(36), height: s(36), borderRadius: s(18), backgroundColor: colors.primaryDark, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  center: { width: s(76), height: s(76), borderRadius: s(38), backgroundColor: colors.primaryLime, alignItems: 'center', justifyContent: 'center', shadowColor: colors.primaryLime, shadowOpacity: 0.5, shadowRadius: 18, shadowOffset: { width: 0, height: 6 }, elevation: 10 },
  title: { fontFamily: font.display, fontSize: fs(26), color: '#FFFFFF' },
  line: { color: colors.mutedGray, fontSize: fs(14), marginTop: 6, textAlign: 'center', minHeight: fs(20) },
  track: { width: '100%', height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.1)', marginTop: s(26), overflow: 'hidden' },
  bar: { height: '100%', backgroundColor: colors.primaryLime, borderRadius: 2 },
});
