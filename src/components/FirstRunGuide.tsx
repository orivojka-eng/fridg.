import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Easing, Pressable, useWindowDimensions } from 'react-native';
import { ArrowRight, Camera } from './ui/lucide';
import { colors, font, fs, s } from '../theme';
import { Button, PressableScale } from './ui';
import { Mascot } from './Mascot';

export interface TargetRect {
  x: number;
  y: number;
  width: number;
  height: number;
  /** Corner radius of the element, so the spotlight hugs its shape. */
  radius?: number;
}

export interface GuideStep {
  key: string;
  title: string;
  body: string;
  /** Element to spotlight; omit for a centred card. */
  target?: string;
  /** Primary label on the last step. */
  cta?: string;
}

interface Props {
  visible: boolean;
  steps: GuideStep[];
  /** Resolve a target key to its window rect (may scroll first). */
  getTarget: (key: string) => Promise<TargetRect | null>;
  onFinish: (action: 'cta' | 'skip' | 'done') => void;
}

const PAD = 8;
const CARD_H_ESTIMATE = 240;

/**
 * FIFA-Mobile-style feature tour rendered INSIDE the screen's own view tree
 * (not a Modal), so it shares the exact coordinate space the targets are
 * measured in. It still subtracts its own window origin, so it is correct
 * whatever inset the parent has. Everything dims except a lime-ringed
 * spotlight that springs from element to element; the mascot explains each.
 */
export const FirstRunGuide: React.FC<Props> = ({ visible, steps, getTarget, onFinish }) => {
  const { width, height } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<TargetRect | null>(null);
  const [origin, setOrigin] = useState<{ x: number; y: number } | null>(null);
  const rootRef = useRef<View>(null);
  const hole = useRef({ x: new Animated.Value(0), y: new Animated.Value(0), w: new Animated.Value(0), h: new Animated.Value(0), r: new Animated.Value(24) }).current;
  const ring = useRef(new Animated.Value(0)).current;
  const card = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(0)).current;
  const step = steps[index];

  const springTo = useCallback(
    (r: TargetRect | null) => {
      const target = r
        ? { x: r.x - PAD, y: r.y - PAD, w: r.width + PAD * 2, h: r.height + PAD * 2, r: (r.radius ?? 20) + PAD }
        : { x: width / 2, y: height / 2, w: 0, h: 0, r: 24 };
      const cfg = { useNativeDriver: false, speed: 16, bounciness: 2 } as const;
      Animated.parallel([
        Animated.spring(hole.x, { toValue: target.x, ...cfg }),
        Animated.spring(hole.y, { toValue: target.y, ...cfg }),
        Animated.spring(hole.w, { toValue: target.w, ...cfg }),
        Animated.spring(hole.h, { toValue: target.h, ...cfg }),
        Animated.timing(hole.r, { toValue: target.r, duration: 260, useNativeDriver: false }),
      ]).start();
      Animated.timing(ring, { toValue: r ? 1 : 0, duration: 240, delay: r ? 180 : 0, useNativeDriver: false }).start();
    },
    [hole, ring, width, height],
  );

  // Reset + fade the dim in when the tour starts.
  useEffect(() => {
    if (!visible) return;
    setIndex(0);
    setRect(null);
    hole.x.setValue(width / 2);
    hole.y.setValue(height / 2);
    hole.w.setValue(0);
    hole.h.setValue(0);
    Animated.timing(fade, { toValue: 1, duration: 320, useNativeDriver: true }).start();
  }, [visible, fade, hole, width, height]);

  // Where does this overlay's (0,0) sit in window coordinates?
  const calibrate = useCallback(() => {
    rootRef.current?.measureInWindow((x, y) => setOrigin({ x: x || 0, y: y || 0 }));
  }, []);

  useEffect(() => {
    if (!visible || !step || !origin) return;
    let cancelled = false;
    Animated.timing(card, { toValue: 0, duration: 110, useNativeDriver: true }).start();
    (async () => {
      const r = step.target ? await getTarget(step.target) : null;
      if (cancelled) return;
      const adjusted = r ? { ...r, x: r.x - origin.x, y: r.y - origin.y } : null;
      setRect(adjusted);
      springTo(adjusted);
      Animated.timing(card, { toValue: 1, duration: 280, delay: 160, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    })();
    return () => {
      cancelled = true;
    };
  }, [visible, index, step, origin, getTarget, springTo, card]);

  if (!visible || !step) return null;

  const isLast = index === steps.length - 1;
  const next = () => (isLast ? onFinish('done') : setIndex((i) => Math.min(i + 1, steps.length - 1)));

  // Card under the target when there's room, otherwise above; centred when no target.
  const below = rect ? rect.y + rect.height + PAD + 14 : height / 2;
  const fitsBelow = rect ? below + CARD_H_ESTIMATE < height - 24 : true;
  const cardTop = !rect ? undefined : fitsBelow ? below : Math.max(40, rect.y - PAD - 14 - CARD_H_ESTIMATE);

  const dim = 'rgba(11,13,10,0.8)';
  const right = Animated.add(hole.x, hole.w);
  const bottom = Animated.add(hole.y, hole.h);

  return (
    <Animated.View ref={rootRef} collapsable={false} onLayout={calibrate} style={[StyleSheet.absoluteFill, { zIndex: 100, elevation: 100, opacity: fade }]}>
      {/* Four dark panels around the spotlight so the target stays bright */}
      <Animated.View pointerEvents="none" style={[styles.panel, { top: 0, left: 0, right: 0, height: hole.y, backgroundColor: dim }]} />
      <Animated.View pointerEvents="none" style={[styles.panel, { top: bottom, left: 0, right: 0, bottom: 0, backgroundColor: dim }]} />
      <Animated.View pointerEvents="none" style={[styles.panel, { top: hole.y, left: 0, width: hole.x, height: hole.h, backgroundColor: dim }]} />
      <Animated.View pointerEvents="none" style={[styles.panel, { top: hole.y, left: right, right: 0, height: hole.h, backgroundColor: dim }]} />
      {/* lime ring hugging the element */}
      <Animated.View pointerEvents="none" style={[styles.ring, { left: hole.x, top: hole.y, width: hole.w, height: hole.h, borderRadius: hole.r, opacity: ring, borderColor: colors.primaryLime }]} />

      {/* tap anywhere to advance */}
      <Pressable onPress={next} style={StyleSheet.absoluteFill} />

      <Animated.View
        style={[
          styles.card,
          cardTop === undefined ? styles.cardCentered : { top: cardTop },
          { opacity: card, transform: [{ translateY: card.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] },
        ]}
      >
        <View style={styles.cardHead}>
          <Mascot size={s(54)} float />
          <View style={{ flex: 1 }}>
            <Text style={styles.kicker}>{index === 0 ? 'FRIDGR GUIDE' : `${index} of ${steps.length - 1}`}</Text>
            <Text style={styles.title}>{step.title}</Text>
          </View>
        </View>
        <Text style={styles.body}>{step.body}</Text>

        <View style={styles.dots}>
          {steps.map((sItem, i) => (
            <View key={sItem.key} style={[styles.dot, { backgroundColor: i === index ? colors.primaryLime : 'rgba(255,255,255,0.18)', width: i === index ? 18 : 6 }]} />
          ))}
        </View>

        {isLast ? (
          <View style={{ gap: 8 }}>
            <Button label={step.cta ?? 'Start'} onPress={() => onFinish('cta')} left={<Camera size={16} color={colors.primaryDark} />} />
            <Button label="Later" variant="outline" onDark onPress={() => onFinish('done')} />
          </View>
        ) : (
          <View style={{ gap: 8 }}>
            <Button label={index === 0 ? "Let's go" : 'Next'} onPress={next} right={<ArrowRight size={16} color={colors.primaryDark} />} />
            <PressableScale onPress={() => onFinish('skip')} hitSlop={8} style={{ alignSelf: 'center', paddingVertical: 4 }}>
              <Text style={styles.skip}>Skip the tour</Text>
            </PressableScale>
          </View>
        )}
      </Animated.View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  panel: { position: 'absolute' },
  ring: { position: 'absolute', borderWidth: 2.5 },
  card: { position: 'absolute', left: 16, right: 16, backgroundColor: colors.primaryDark, borderRadius: 24, padding: 18, gap: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  cardCentered: { top: '30%' },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  kicker: { color: colors.primaryLime, fontSize: fs(11), fontWeight: '800', letterSpacing: 1.2 },
  title: { fontFamily: font.display, fontSize: fs(22), color: '#FFFFFF', marginTop: 2 },
  body: { color: 'rgba(255,255,255,0.8)', fontSize: fs(14), lineHeight: fs(20) },
  dots: { flexDirection: 'row', gap: 5, alignItems: 'center' },
  dot: { height: 6, borderRadius: 3 },
  skip: { color: colors.mutedGray, fontSize: fs(13), fontWeight: '700' },
});
