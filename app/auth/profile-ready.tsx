import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { Check } from '../../src/components/ui/lucide';
import { useUserStore } from '../../src/store/useUserStore';
import { font, fs, s, colors } from '../../src/theme';
import { Avatar } from '../../src/components/ui';

const SHOW_MS = 2600;

/**
 * One-page "your profile is set" reveal after onboarding: the avatar pops
 * in with a check, the name and a line of what we learned, then the whole
 * page fades away and the router lands on Home.
 */
export default function ProfileReadyScreen() {
  const { profile, avatarIndex, finishProfileReady } = useUserStore();
  const pop = useRef(new Animated.Value(0)).current;
  const rise = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.spring(pop, { toValue: 1, useNativeDriver: true, speed: 9, bounciness: 12 }),
      Animated.timing(rise, { toValue: 1, duration: 500, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
    const timer = setTimeout(() => {
      Animated.timing(fade, { toValue: 0, duration: 650, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }).start(() => finishProfileReady());
    }, SHOW_MS);
    return () => clearTimeout(timer);
  }, [pop, rise, fade, finishProfileReady]);

  const facts = [
    profile.goals[0],
    profile.household === 'shared' ? 'cooking for others' : profile.household === 'solo' ? 'cooking for one' : null,
    profile.cookingTimeMin ? `${profile.cookingTimeMin}-min weeknights` : null,
    profile.allergies.length ? `no ${profile.allergies.map((a) => a.toLowerCase()).join(', ')}` : null,
  ].filter(Boolean);

  return (
    <Animated.View style={[styles.container, { opacity: fade }]}>
      <View pointerEvents="none" style={[styles.blob, { backgroundColor: colors.primaryDark, opacity: 0.06, width: s(340), height: s(340), borderRadius: s(170), top: -s(140), right: -s(120) }]} />

      <Animated.View style={[styles.avatarWrap, { transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }], opacity: pop }]}>
        <Avatar index={avatarIndex} size={s(140)} />
        <View style={styles.badge}>
          <Check size={s(20)} color={colors.primaryLime} strokeWidth={3} />
        </View>
      </Animated.View>

      <Animated.View style={[styles.textWrap, { opacity: rise, transform: [{ translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }] }]}>
        <Text style={styles.kicker}>PROFILE SET</Text>
        <Text style={styles.name}>{profile.name}</Text>
        {facts.length > 0 && <Text style={styles.facts}>{facts.join(' · ')}</Text>}
        <Text style={styles.sub}>Your kitchen is ready. Let's start together.</Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.primaryLime, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 22 },
  blob: { position: 'absolute' },
  avatarWrap: { alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', bottom: 2, right: 2, width: s(38), height: s(38), borderRadius: s(19), backgroundColor: colors.primaryDark, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: colors.primaryLime },
  textWrap: { alignItems: 'center', gap: 6 },
  kicker: { color: colors.primaryDark, fontSize: fs(11), fontWeight: '800', letterSpacing: 1.6, opacity: 0.7 },
  name: { fontFamily: font.display, fontSize: fs(36), color: colors.primaryDark, textAlign: 'center' },
  facts: { color: colors.primaryDark, fontSize: fs(13), fontWeight: '700', textAlign: 'center', opacity: 0.8 },
  sub: { color: colors.primaryDark, fontSize: fs(14), textAlign: 'center', marginTop: 10, opacity: 0.85 },
});
