import React, { useEffect, useState } from 'react';
import { AccessibilityInfo, Platform, View, ViewProps, ColorValue } from 'react-native';

/**
 * Native iOS 26 Liquid Glass via `expo-glass-effect`, loaded lazily so the
 * app still runs where the module is absent (web, Android, older Expo Go).
 *
 * `useLiquidGlass()` is true only when the native views exist AND the user
 * has not turned on Reduce Transparency; every glass surface falls back to
 * the drawn glass in that case, so nothing ever renders empty.
 */
type GlassStyle = 'clear' | 'regular' | 'none';
interface NativeGlassViewProps extends ViewProps {
  glassEffectStyle?: GlassStyle;
  tintColor?: ColorValue;
  isInteractive?: boolean;
  colorScheme?: 'auto' | 'light' | 'dark';
}
interface NativeGlassContainerProps extends ViewProps {
  spacing?: number;
}

type Mod = {
  GlassView: React.ComponentType<NativeGlassViewProps>;
  GlassContainer: React.ComponentType<NativeGlassContainerProps>;
  isLiquidGlassAvailable: () => boolean;
};

let mod: Mod | null = null;
let available = false;
if (Platform.OS === 'ios') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    mod = require('expo-glass-effect') as Mod;
    available = !!mod && typeof mod.isLiquidGlassAvailable === 'function' && mod.isLiquidGlassAvailable();
  } catch {
    mod = null;
    available = false;
  }
}

let reduceTransparency = false;
if (available) {
  AccessibilityInfo.isReduceTransparencyEnabled?.()
    .then((v) => {
      reduceTransparency = !!v;
    })
    .catch(() => undefined);
}

/** Synchronous check used by the surfaces; reflects the last known accessibility state. */
export const liquidGlassAvailable = () => available && !reduceTransparency;

/** Hook version that re-renders when the user toggles Reduce Transparency. */
export function useLiquidGlass() {
  const [on, setOn] = useState(liquidGlassAvailable());
  useEffect(() => {
    if (!available) return;
    const sub = AccessibilityInfo.addEventListener('reduceTransparencyChanged', (v) => {
      reduceTransparency = !!v;
      setOn(liquidGlassAvailable());
    });
    return () => sub.remove();
  }, []);
  return on;
}

/** Native Liquid Glass view; renders a plain View when unavailable. */
export const NativeGlass: React.FC<NativeGlassViewProps> = (props) => {
  if (!mod || !liquidGlassAvailable()) {
    const { glassEffectStyle: _g, tintColor: _t, isInteractive: _i, colorScheme: _c, ...rest } = props;
    return <View {...rest} />;
  }
  const { GlassView } = mod;
  return <GlassView {...props} />;
};

/** Groups glass elements so they visually merge when close together. */
export const GlassGroup: React.FC<NativeGlassContainerProps> = (props) => {
  if (!mod || !liquidGlassAvailable()) {
    const { spacing: _s, ...rest } = props;
    return <View {...rest} />;
  }
  const { GlassContainer } = mod;
  return <GlassContainer {...props} />;
};
