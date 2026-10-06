import React, { useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View, StyleProp, ViewStyle, PressableProps } from 'react-native';
import { useTheme, motion } from '../../theme';
import { NativeGlass, useLiquidGlass } from './LiquidGlass';


/* ----------------------------------------------------------------------------
 * PressableScale — press feedback shared by every tappable surface.
 *
 * On press-in the content scales down slightly and a soft light wash fades
 * in over it (the mobile equivalent of a hover state); on release both ease
 * back. Everything runs on the native thread and any in-flight animation is
 * stopped before a new one starts, so a tap that immediately navigates never
 * leaves a half-finished state behind.
 * ------------------------------------------------------------------------- */
interface PressableScaleProps extends PressableProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Layout for the inner (scaled) wrapper, e.g. a row with a gap. */
  contentStyle?: StyleProp<ViewStyle>;
  scaleTo?: number;
  /** Show the light wash on press. Pass `radius` so it matches the button shape. */
  highlight?: boolean;
  radius?: number;
  /** Wash colour; defaults to white on dark/lime surfaces. */
  highlightColor?: string;
}

export function PressableScale({ children, style, contentStyle, scaleTo = motion.pressScale, highlight = false, radius = 999, highlightColor = '#FFFFFF', disabled, onPressIn, onPressOut, ...rest }: PressableScaleProps) {
  const press = useRef(new Animated.Value(0)).current;

  const to = (v: number, duration: number, easing: (n: number) => number) => {
    press.stopAnimation();
    Animated.timing(press, { toValue: v, duration, easing, useNativeDriver: true }).start();
  };

  return (
    <Pressable
      {...rest}
      disabled={disabled}
      style={style}
      onPressIn={(e) => { to(1, 110, Easing.out(Easing.quad)); onPressIn?.(e); }}
      onPressOut={(e) => { to(0, 220, Easing.out(Easing.cubic)); onPressOut?.(e); }}
    >
      <Animated.View style={[contentStyle, { transform: [{ scale: press.interpolate({ inputRange: [0, 1], outputRange: [1, scaleTo] }) }] }]}>
        {children}
        {highlight && (
          <Animated.View
            pointerEvents="none"
            style={[StyleSheet.absoluteFill, { borderRadius: radius, backgroundColor: highlightColor, opacity: press.interpolate({ inputRange: [0, 1], outputRange: [0, 0.16] }) }]}
          />
        )}
      </Animated.View>
    </Pressable>
  );
}

/* ----------------------------------------------------------------------------
 * GlassSurface — iOS-style frosted glass. One continuous surface: solid
 * fill (so Android draws elevation correctly), a smooth light falloff from
 * the top, a hairline inner highlight and a faint shade at the bottom.
 * Built from stacked Views instead of SVG so rounded clipping is reliable.
 * ------------------------------------------------------------------------- */
interface GlassSurfaceProps {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  radius?: number;
  /** 'clear' is translucent white for buttons sitting on dark or photo backgrounds. */
  tone?: 'dark' | 'light' | 'lime' | 'orange' | 'clear';
  glow?: boolean;
  active?: boolean;
  /** Fewer gradient bands: for small surfaces (icon buttons, chips) and long lists. */
  lite?: boolean;
}

const BANDS = 10;

export function GlassSurface({ children, style, radius = 24, tone = 'dark', glow, active, lite }: GlassSurfaceProps) {
  const t = useTheme();
  const darkish = tone === 'dark' || tone === 'clear' || (tone === 'light' && t.isDark);
  const fill = tone === 'lime' ? t.lime : tone === 'orange' ? t.orange : tone === 'dark' ? t.dark : tone === 'clear' ? 'rgba(255,255,255,0.12)' : t.card;
  const lightPeak = tone === 'lime' ? 0.34 : tone === 'orange' ? 0.3 : tone === 'clear' ? 0.16 : darkish ? 0.14 : 0.7;
  const shadePeak = tone === 'lime' ? 0.08 : tone === 'orange' ? 0.12 : tone === 'clear' ? 0.1 : darkish ? 0.28 : 0.05;
  const border = active ? t.lime : tone === 'lime' || tone === 'orange' ? 'rgba(255,255,255,0.45)' : tone === 'clear' ? 'rgba(255,255,255,0.28)' : darkish ? 'rgba(255,255,255,0.16)' : t.border;
  const innerLine = darkish ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.85)';
  const bands = lite ? 5 : BANDS;
  const shades = lite ? 3 : 6;

  const shadow = glow
    ? { shadowColor: t.lime, shadowOpacity: active ? 0.45 : 0.25, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 4 }
    : tone === 'clear'
      ? {}
      : tone === 'dark'
      ? { shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 2 }
      : { shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 2 };

  // iOS 26: the real thing. Liquid Glass refracts whatever is behind it, so
  // coloured tones become a tint over the glass rather than a solid fill.
  // Only translucent tones use the native material: a coloured button (lime,
  // dark, orange) must stay a solid, readable fill on every background, and
  // native tints proved too faint on a black screen.
  const liquid = useLiquidGlass();
  if (liquid && (tone === 'light' || tone === 'clear')) {
    const tint = tone === 'clear' ? undefined : t.isDark ? 'rgba(30,34,26,0.35)' : 'rgba(255,255,255,0.35)';
    return (
      <NativeGlass
        glassEffectStyle={tone === 'clear' ? 'clear' : 'regular'}
        tintColor={tint}
        // Not interactive: the native material would take the first touch
        // for its own highlight and the button underneath only saw the second.
        // Press feedback comes from PressableScale, and touches pass through.
        isInteractive={false}
        pointerEvents="box-none"
        colorScheme={darkish ? 'dark' : 'light'}
        style={[styles.surface, { borderRadius: radius, borderWidth: active ? 1 : 0, borderColor: border, overflow: 'hidden' }, glow ? shadow : null, style]}
      >
        <View style={styles.content}>{children}</View>
      </NativeGlass>
    );
  }

  return (
    <View style={[styles.surface, { borderRadius: radius, borderColor: border, backgroundColor: fill }, shadow, style]}>
      <View style={[StyleSheet.absoluteFill, { borderRadius: radius, overflow: 'hidden' }]} pointerEvents="none">
        {/* light falloff: top → middle, eased so it reads as one gradient */}
        {Array.from({ length: bands }).map((_, i) => {
          const f = i / bands;
          const eased = (1 - f) * (1 - f);
          return (
            <View
              key={`l${i}`}
              style={{ position: 'absolute', left: 0, right: 0, top: `${f * 58}%`, height: `${58 / bands + 0.5}%`, backgroundColor: '#FFFFFF', opacity: lightPeak * eased }}
            />
          );
        })}
        {/* soft shade rising from the bottom */}
        {Array.from({ length: shades }).map((_, i) => {
          const f = i / shades;
          return (
            <View
              key={`s${i}`}
              style={{ position: 'absolute', left: 0, right: 0, bottom: `${f * 34}%`, height: `${34 / shades + 0.5}%`, backgroundColor: '#000000', opacity: shadePeak * (1 - f) * (1 - f) }}
            />
          );
        })}
        {/* hairline inner highlight along the top edge */}
        <View style={{ position: 'absolute', top: 1, left: radius * 0.6, right: radius * 0.6, height: 1, backgroundColor: innerLine, borderRadius: 1 }} />
      </View>
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  surface: { borderWidth: 1, overflow: 'visible' },
  content: { alignItems: 'center', justifyContent: 'center' },
});
