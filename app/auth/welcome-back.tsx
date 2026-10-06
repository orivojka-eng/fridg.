import React, { useEffect, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { useUserStore } from '../../src/store/useUserStore';
import { useFridgeStore } from '../../src/store/useFridgeStore';
import { useRecipeStore } from '../../src/store/useRecipeStore';
import { font, fs, s, colors } from '../../src/theme';
import { Avatar } from '../../src/components/ui';
import { Mascot } from '../../src/components/Mascot';
import { computeMatch, greeting, plural } from '../../src/lib/matching';

const SHOW_MS = 2800;

/**
 * Shown once right after login. When it finishes it clears the flag that
 * keeps this route alive, and the router lands on the tabs.
 */
export default function WelcomeBackScreen() {
  const { profile, avatarIndex, finishWelcomeBack } = useUserStore();
  const fridge = useFridgeStore((u) => u.items);
  const recipes = useRecipeStore((u) => u.recipes);
  const rise = useRef(new Animated.Value(0)).current;
  const bar = useRef(new Animated.Value(0)).current;

  const ready = useMemo(() => recipes.filter((r) => computeMatch(r, fridge).matchPercent >= 80).length, [recipes, fridge]);
  const expiring = fridge.filter((i) => i.daysToExpiry <= 2).length;

  useEffect(() => {
    Animated.timing(rise, { toValue: 1, duration: 800, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    Animated.timing(bar, { toValue: 1, duration: SHOW_MS, easing: Easing.inOut(Easing.cubic), useNativeDriver: false }).start();
    const timer = setTimeout(finishWelcomeBack, SHOW_MS);
    return () => clearTimeout(timer);
  }, [rise, bar, finishWelcomeBack]);

  return (
    <View style={styles.container}>
      <View pointerEvents="none" style={[styles.blob, { backgroundColor: colors.primaryLime, opacity: 0.12, width: s(320), height: s(320), borderRadius: s(160), top: -s(120), right: -s(120) }]} />
      <Animated.View style={[styles.content, { opacity: rise, transform: [{ translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }] }]}>
        <Mascot size={s(150)} float />
        <View style={styles.row}>
          <Avatar index={avatarIndex} size={s(34)} />
          <Text style={styles.greeting}>{greeting()}</Text>
        </View>
        <Text style={styles.title}>
          Welcome back,{'\n'}
          <Text style={{ color: colors.primaryLime }}>{profile.firstName}</Text>
        </Text>
        <Text style={styles.sub}>
          {plural(fridge.length, 'item')} in your fridge • {plural(ready, 'recipe')} ready
          {expiring > 0 ? `\n${plural(expiring, 'item')} to use up soon` : '\nNothing expiring — nice.'}
        </Text>
      </Animated.View>

      <View style={styles.track}>
        <Animated.View style={[styles.barFill, { width: bar.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.black, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  blob: { position: 'absolute' },
  content: { alignItems: 'center', gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  greeting: { color: colors.mutedGray, fontSize: fs(14), fontWeight: '600' },
  title: { fontFamily: font.display, fontSize: fs(38), lineHeight: fs(44), color: '#FFFFFF', textAlign: 'center' },
  sub: { color: colors.mutedGray, fontSize: fs(14), lineHeight: fs(20), textAlign: 'center' },
  track: { position: 'absolute', bottom: 60, left: 60, right: 60, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.1)', overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: colors.primaryLime },
});
