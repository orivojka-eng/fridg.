import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, StyleProp, ViewStyle } from 'react-native';
import Svg, { Defs, Pattern, Rect, Line } from 'react-native-svg';
import { useTheme, fs, motion } from '../../theme';

interface Props {
  /** Real image if we have one. */
  uri?: string;
  /** Designer-style file label shown on the striped placeholder. */
  label?: string;
  tone?: 'cream' | 'sage' | 'blush';
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
  /** Padding for overlaid children (badges). */
  padding?: number;
  /** Darken the bottom so white text stays readable on photos. */
  scrim?: boolean;
}

/**
 * Photo with a striped fallback that mirrors the design mockups. The photo
 * fades in once loaded; if it fails (offline, bad URL) the stripes stay.
 */
export const MediaPlaceholder: React.FC<Props> = ({ uri, label, tone = 'cream', height = 120, radius = 14, style, children, padding = 8, scrim }) => {
  const t = useTheme();
  const bg = tone === 'sage' ? t.sage : tone === 'blush' ? t.blush : t.cream;
  const stripe = t.isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.045)';
  const [failed, setFailed] = useState(false);
  const fade = useRef(new Animated.Value(0)).current;
  const showImage = !!uri && !failed;

  return (
    <View style={[{ height, borderRadius: radius, backgroundColor: bg, overflow: 'hidden' }, style]}>
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
        <Defs>
          <Pattern id="stripes" patternUnits="userSpaceOnUse" width="18" height="18" patternTransform="rotate(45)">
            <Line x1="0" y1="0" x2="0" y2="18" stroke={stripe} strokeWidth="9" />
          </Pattern>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#stripes)" />
      </Svg>
      {showImage && (
        <Animated.Image
          source={{ uri }}
          style={[StyleSheet.absoluteFill, { opacity: fade }]}
          resizeMode="cover"
          onLoad={() => Animated.timing(fade, { toValue: 1, duration: motion.slow, useNativeDriver: true }).start()}
          onError={() => setFailed(true)}
        />
      )}
      {showImage && scrim && <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(11,13,10,0.18)' }]} />}
      <View style={[StyleSheet.absoluteFill, { padding, justifyContent: 'space-between' }]}>
        {children}
        {!showImage && label ? (
          <Text style={[styles.label, { color: t.textMuted }]} numberOfLines={1}>
            {label}
          </Text>
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  label: { fontSize: fs(9), fontFamily: 'monospace', marginTop: 'auto', opacity: 0.9 },
});
