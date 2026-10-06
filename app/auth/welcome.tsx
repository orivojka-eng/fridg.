import React from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { font, fs, s, colors } from '../../src/theme';
import { Screen, Button } from '../../src/components/ui';
import { Mascot } from '../../src/components/Mascot';

/** Landing screen: shapes, pitch, Sign up / Log in, mascot sitting on a lime blob. */
export default function WelcomeScreen() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const mascot = Math.min(width * 0.5, 210, height * 0.26);

  return (
    <Screen style={{ backgroundColor: colors.bgLight }} edges={['top']}>
      {/* Decorative shapes from the template, in our palette */}
      <View pointerEvents="none" style={[styles.blob, { backgroundColor: colors.primaryLime, width: s(230), height: s(230), borderRadius: s(115), top: -s(90), left: -s(70) }]} />
      <View pointerEvents="none" style={[styles.blob, { backgroundColor: colors.primaryDark, width: s(46), height: s(46), borderRadius: s(23), top: s(58), left: s(150) }]} />
      <View pointerEvents="none" style={[styles.blob, { backgroundColor: colors.primaryLime, width: s(120), height: s(120), borderRadius: s(60), top: -s(20), right: -s(50) }]} />

      <View style={styles.content}>
        <Text style={[styles.brand, { color: colors.primaryDark }]}>FRIDGR</Text>
        <Text style={[styles.title, { color: colors.primaryDark }]}>Let's cook{'\n'}something good.</Text>
        <Text style={[styles.sub, { color: colors.mutedGray }]}>Say goodbye to wasted food.{'\n'}Recipes built from what's already in your fridge.</Text>

        <View style={styles.actions}>
          <Button label="Sign up" variant="dark" onPress={() => router.push('/auth/signup')} />
          <Button
            label="Log in"
            variant="outline"
            onPress={() => router.push('/auth/login')}
            style={{ borderColor: colors.primaryLime, borderWidth: 2, backgroundColor: 'transparent' }}
          />
        </View>
      </View>

      {/* Mascot leans in from the bottom-right corner on a lime blob, leaving the left clear */}
      <View pointerEvents="none" style={styles.bottom}>
        <View style={[styles.blob, { backgroundColor: colors.primaryLime, width: s(320), height: s(320), borderRadius: s(160), bottom: -s(200), right: -s(110) }]} />
        {/* Rotation lives on a wrapper so it doesn't override the mascot's own float transform */}
        <View style={{ marginBottom: s(18), marginRight: s(22), transform: [{ rotate: '-8deg' }] }}>
          <Mascot size={mascot} float />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  blob: { position: 'absolute' },
  content: { paddingHorizontal: 28, paddingTop: s(150), gap: 12 },
  brand: { fontFamily: font.display, fontSize: fs(18), letterSpacing: 2 },
  title: { fontFamily: font.display, fontSize: fs(38), lineHeight: fs(44) },
  sub: { fontSize: fs(14), lineHeight: fs(20) },
  actions: { gap: 12, marginTop: 18 },
  bottom: { flex: 1, justifyContent: "flex-end", alignItems: "flex-end", overflow: "hidden" },
});
