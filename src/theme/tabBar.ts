import { Platform, ViewStyle } from 'react-native';
import { Theme } from './index';
import { s } from './responsive';
import { liquidGlassAvailable } from '../components/ui/LiquidGlass';

export const TAB_BAR_HEIGHT = s(66);

/**
 * Floating glass capsule from the navbar reference. Shared so screens can
 * hide/restore it. On iOS 26 the capsule is native Liquid Glass (see the tab
 * layout's `tabBarBackground`), so the style paints no fill of its own there.
 */
export const tabBarStyleFor = (t: Theme): ViewStyle =>
  liquidGlassAvailable()
    ? { ...solidTabBarStyle(t), backgroundColor: 'transparent', borderWidth: 0, elevation: 0, shadowOpacity: 0 }
    : solidTabBarStyle(t);

const solidTabBarStyle = (t: Theme): ViewStyle => ({
  position: 'absolute',
  bottom: s(24),
  left: s(20),
  right: s(20),
  height: TAB_BAR_HEIGHT,
  borderRadius: TAB_BAR_HEIGHT / 2,
  backgroundColor: t.isDark ? 'rgba(20, 24, 15, 0.94)' : 'rgba(255, 255, 255, 0.96)',
  borderTopWidth: 0,
  borderWidth: 1,
  borderColor: t.isDark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.9)',
  elevation: 8,
  shadowColor: '#000000',
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: t.isDark ? 0.4 : 0.14,
  shadowRadius: 16,
  paddingHorizontal: 8,
  paddingTop: Platform.OS === 'ios' ? 8 : 4,
  paddingBottom: Platform.OS === 'ios' ? 8 : 4,
});
