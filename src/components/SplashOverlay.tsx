import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Animated, Easing, Image, View, useWindowDimensions } from 'react-native';
import { colors, font, fs, s } from '../theme';

const MARK = require('../../assets/logo-mark-transparent.png');
const MIN_VISIBLE_MS = 3800;

interface Props {
  /** Flip to true once fonts/data are ready; the overlay finishes its minimum time, then fades out. */
  ready: boolean;
  /** Called when the exit animation begins — the app underneath starts its entrance now. */
  onExitStart?: () => void;
  onDone?: () => void;
}

/**
 * Boot screen: the logo mark eases in and floats, the wordmark fades up,
 * three dots pulse, then everything lifts away as the app rises underneath.
 * The mark has transparent corners, so there is no black box around it.
 */
export const SplashOverlay: React.FC<Props> = ({ ready, onExitStart, onDone }) => {
  const { width } = useWindowDimensions();
  const pop = useRef(new Animated.Value(0)).current;
  const word = useRef(new Animated.Value(0)).current;
  const float = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(1)).current;
  const exit = useRef(new Animated.Value(0)).current;
  const dots = useRef([0, 1, 2].map(() => new Animated.Value(0.3))).current;
  const [gone, setGone] = useState(false);
  const mountedAt = useRef(Date.now());
  const size = Math.min(s(170), width * 0.46);

  useEffect(() => {
    Animated.sequence([
      Animated.spring(pop, { toValue: 1, useNativeDriver: true, speed: 8, bounciness: 9 }),
      Animated.timing(word, { toValue: 1, duration: 600, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
    const floatLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(float, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(float, { toValue: 0, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    floatLoop.start();
    const loops = dots.map((d, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 160),
          Animated.timing(d, { toValue: 1, duration: 480, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(d, { toValue: 0.3, duration: 560, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.delay(320 - i * 160),
        ]),
      ),
    );
    loops.forEach((l) => l.start());
    return () => {
      floatLoop.stop();
      loops.forEach((l) => l.stop());
    };
  }, [pop, word, float, dots]);

  useEffect(() => {
    if (!ready) return;
    const wait = Math.max(0, MIN_VISIBLE_MS - (Date.now() - mountedAt.current));
    const timer = setTimeout(() => {
      onExitStart?.();
      Animated.parallel([
        Animated.timing(exit, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
        Animated.timing(fade, { toValue: 0, duration: 1100, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
      ]).start(() => {
        setGone(true);
        onDone?.();
      });
    }, wait);
    return () => clearTimeout(timer);
  }, [ready, fade, exit, onExitStart, onDone]);

  if (gone) return null;

  const out = exit.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });

  return (
    <Animated.View pointerEvents={ready ? 'none' : 'auto'} style={[StyleSheet.absoluteFill, styles.wrap, { opacity: fade }]}>
      <Animated.View style={{ alignItems: 'center', opacity: out, transform: [{ translateY: exit.interpolate({ inputRange: [0, 1], outputRange: [0, -30] }) }] }}>
        <Animated.View style={{ opacity: pop, transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) }, { translateY: float.interpolate({ inputRange: [0, 1], outputRange: [0, -8] }) }] }}>
          <Image source={MARK} style={{ width: size, height: size }} resizeMode="contain" />
        </Animated.View>
        <Animated.Text style={[styles.word, { opacity: word, transform: [{ translateY: word.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] }]}>Fridgr</Animated.Text>
        <Animated.View style={[styles.dots, { opacity: word }]}>
          {dots.map((d, i) => (
            <Animated.View key={i} style={[styles.dot, { opacity: d, transform: [{ scale: d.interpolate({ inputRange: [0.3, 1], outputRange: [0.8, 1.15] }) }] }]} />
          ))}
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  wrap: { backgroundColor: colors.black, alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  word: { fontFamily: font.display, fontSize: fs(44), color: '#F4F6EC', marginTop: s(14), letterSpacing: 0.5 },
  dots: { flexDirection: 'row', gap: 10, marginTop: s(22) },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.primaryLime },
});
