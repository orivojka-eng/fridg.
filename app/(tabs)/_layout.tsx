import React, { useCallback } from 'react';
import { View, StyleSheet, Platform, ColorValue } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import { Home, Compass, Focus, Bookmark, User } from '../../src/components/ui/lucide';
import { useTheme, s, fs } from "../../src/theme";
import { tabBarStyleFor, TAB_BAR_HEIGHT } from "../../src/theme/tabBar";
import { GlassSurface, PressableScale } from '../../src/components/ui';
import { NativeGlass, useLiquidGlass } from '../../src/components/ui/LiquidGlass';

/** Centre scan FAB. A real component (with hooks) rendered as an element. */
function ScanFab({ onPress }: { onPress: () => void }) {
  const t = useTheme();
  const size = s(56);
  return (
    <View style={styles.fabWrap}>
      <PressableScale onPress={onPress} scaleTo={0.92} accessibilityLabel="Scan your fridge" hitSlop={6} highlight radius={size / 2}>
        <GlassSurface tone="dark" radius={size / 2} glow active style={{ width: size, height: size, marginTop: -s(22) }}>
          <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
            <Focus size={s(24)} color={t.lime} strokeWidth={2.5} />
          </View>
        </GlassSurface>
      </PressableScale>
    </View>
  );
}

function makeIcon(Icon: typeof Home) {
  return function TabIcon({ color, focused }: { color: ColorValue; focused: boolean }) {
    return <Icon size={s(22)} color={String(color)} strokeWidth={focused ? 2.5 : 1.8} />;
  };
}

const HomeIcon = makeIcon(Home);
const DiscoverIcon = makeIcon(Compass);
const SavedIcon = makeIcon(Bookmark);
const ProfileIcon = makeIcon(User);

export default function TabLayout() {
  const t = useTheme();
  const router = useRouter();
  const barHeight = TAB_BAR_HEIGHT;

  // Stable identity so the tab bar doesn't remount the FAB on every render
  // (a remount mid-press was what made it feel glitchy). react-navigation
  // invokes tabBarButton as a plain function, so it must not use hooks
  // itself — it just returns the <ScanFab /> element.
  const renderScanButton = useCallback(() => <ScanFab onPress={() => router.push('/scan')} />, [router]);

  // iOS 26: the floating capsule is real Liquid Glass; content scrolls and refracts behind it.
  const liquid = useLiquidGlass();
  const renderGlassBackground = useCallback(
    () => <NativeGlass glassEffectStyle="regular" isInteractive={false} pointerEvents="none" colorScheme={t.isDark ? 'dark' : 'light'} style={[StyleSheet.absoluteFill, { borderRadius: TAB_BAR_HEIGHT / 2, overflow: 'hidden' }]} />,
    [t.isDark],
  );

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarStyle: tabBarStyleFor(t),
        ...(liquid ? { tabBarBackground: renderGlassBackground } : {}),
        tabBarItemStyle: { height: barHeight - 8 },
        tabBarActiveTintColor: t.isDark ? t.lime : t.dark,
        tabBarInactiveTintColor: t.textMuted,
        tabBarLabelStyle: { fontSize: fs(11), fontWeight: '600' },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: HomeIcon }} />
      <Tabs.Screen name="discover" options={{ title: 'Discover', tabBarIcon: DiscoverIcon }} />
      <Tabs.Screen name="scanner" options={{ title: '', tabBarButton: renderScanButton }} />
      <Tabs.Screen name="saved" options={{ title: 'Saved', tabBarIcon: SavedIcon }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: ProfileIcon }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  fabWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
