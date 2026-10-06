import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Image, StyleProp, View, ViewStyle } from 'react-native';

/** The FRIDGR logo mark (fridge on its green tile, transparent corners). */
const MARK = require('../../assets/logo-mark-transparent.png');

/** Kept so existing call sites compile; the logo mark has a single look. */
export type MascotPose = 'wave' | 'cheer' | 'point' | 'idea' | 'think' | 'plain';

interface Props {
  size?: number;
  /** Gentle up/down float. */
  float?: boolean;
  pose?: MascotPose;
  bodyOnly?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** The FRIDGR logo mark, used as the app mascot across auth, tour, intro and onboarding. */
export const Mascot: React.FC<Props> = ({ size = 160, float = false, style }) => {
  const y = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!float) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(y, { toValue: 1, duration: 1700, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(y, { toValue: 0, duration: 1700, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [float, y]);

  return (
    <Animated.View style={[{ width: size, height: size, transform: [{ translateY: y.interpolate({ inputRange: [0, 1], outputRange: [0, -8] }) }] }, style]}>
      <Image source={MARK} style={{ width: size, height: size }} resizeMode="contain" />
    </Animated.View>
  );
};

/** Speech bubble that sits beside the mascot. */
export const MascotBubble: React.FC<{ children: React.ReactNode; tone?: 'light' | 'dark'; style?: StyleProp<ViewStyle>; tail?: 'left' | 'bottom' }> = ({ children, tone = 'light', style, tail = 'left' }) => {
  const bg = tone === 'dark' ? '#14180F' : '#FFFFFF';
  return (
    <View style={[{ backgroundColor: bg, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 3 }, style]}>
      {children}
      <View
        style={[
          { position: 'absolute', width: 14, height: 14, backgroundColor: bg, transform: [{ rotate: '45deg' }], borderRadius: 3 },
          tail === 'left' ? { left: -5, top: 18 } : { bottom: -5, left: 28 },
        ]}
      />
    </View>
  );
};
