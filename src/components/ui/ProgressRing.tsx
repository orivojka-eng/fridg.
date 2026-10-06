import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { font } from '../../theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface Props {
  /** 0..1 */
  progress: number;
  size?: number;
  strokeWidth?: number;
  color: string;
  trackColor: string;
  backgroundColor?: string;
  label?: string;
  sublabel?: string;
  labelColor?: string;
  sublabelColor?: string;
  children?: React.ReactNode;
  /** Ease between progress values instead of jumping. */
  animated?: boolean;
}

export const ProgressRing: React.FC<Props> = ({
  progress,
  size = 72,
  strokeWidth = 6,
  color,
  trackColor,
  backgroundColor = 'transparent',
  label,
  sublabel,
  labelColor = '#14180F',
  sublabelColor = '#8D9187',
  children,
  animated = false,
}) => {
  const clamped = Math.max(0, Math.min(1, progress));
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  const inner = size - strokeWidth * 2 - 6;

  const anim = useRef(new Animated.Value(clamped)).current;
  useEffect(() => {
    if (!animated) {
      anim.setValue(clamped);
      return;
    }
    Animated.timing(anim, { toValue: clamped, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [clamped, animated, anim]);
  const offset = anim.interpolate({ inputRange: [0, 1], outputRange: [c, 0] });

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={trackColor} strokeWidth={strokeWidth} fill={backgroundColor} />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${c} ${c}`}
          strokeDashoffset={offset as any}
          rotation={-90}
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      {/* Fixed-width inner box so the label auto-shrinks instead of wrapping. */}
      <View style={{ width: inner, alignItems: 'center' }}>
        {children ?? (
          <>
            {label ? (
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} allowFontScaling={false} style={{ fontSize: size * 0.24, fontFamily: font.display, color: labelColor, textAlign: 'center' }}>
                {label}
              </Text>
            ) : null}
            {sublabel ? (
              <Text numberOfLines={1} allowFontScaling={false} style={{ fontSize: size * 0.11, fontWeight: '700', color: sublabelColor, letterSpacing: 0.5 }}>
                {sublabel}
              </Text>
            ) : null}
          </>
        )}
      </View>
    </View>
  );
};
