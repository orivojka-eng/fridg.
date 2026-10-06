import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, ScrollView, NativeSyntheticEvent, NativeScrollEvent, LayoutChangeEvent } from 'react-native';
import { colors, font, fs, s } from '../theme';
import { Mascot } from './Mascot';
import { PressableScale } from './ui/Glass';

const MIN_AGE = 13;
const MAX_AGE = 90;
const TICK_W = 14;
const AGES = Array.from({ length: MAX_AGE - MIN_AGE + 1 }, (_, i) => MIN_AGE + i);

const BRACKETS: Array<{ label: string; age: number; word: string }> = [
  { label: '18–24', age: 21, word: 'Student years' },
  { label: '25–34', age: 29, word: 'Weeknight pro' },
  { label: '35–44', age: 39, word: 'Family table' },
  { label: '45–54', age: 49, word: 'Seasoned cook' },
  { label: '55+', age: 60, word: 'Kitchen legend' },
];

const wordFor = (age: number | null) => {
  if (age == null) return 'Skipped';
  if (age < 18) return 'Rising cook';
  const b = [...BRACKETS].reverse().find((x) => age >= parseInt(x.label, 10));
  return b?.word ?? 'Kitchen legend';
};

interface Props {
  value: number | null;
  onChange: (age: number | null) => void;
}

/**
 * Age picker in the "select your mood" template style: illustration on top,
 * dark panel with a tick ruler that snaps to whole years, and bracket chips.
 */
export const AgeDial: React.FC<Props> = ({ value, onChange }) => {
  const scrollRef = useRef<ScrollView>(null);
  const scrollX = useRef(new Animated.Value(((value ?? 28) - MIN_AGE) * TICK_W)).current;
  const [rulerW, setRulerW] = useState(0);
  const [live, setLive] = useState<number>(value ?? 28);
  const skipped = value == null;
  const sidePad = Math.max(0, (rulerW - TICK_W) / 2);

  // Position the ruler on the current value once we know its width.
  useEffect(() => {
    if (!rulerW) return;
    const x = ((value ?? 28) - MIN_AGE) * TICK_W;
    scrollRef.current?.scrollTo({ x, animated: false });
  }, [rulerW]); // eslint-disable-line react-hooks/exhaustive-deps

  const ageFromX = (x: number) => Math.min(MAX_AGE, Math.max(MIN_AGE, MIN_AGE + Math.round(x / TICK_W)));

  const onScroll = Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
    useNativeDriver: true,
    listener: (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const a = ageFromX(e.nativeEvent.contentOffset.x);
      setLive((prev) => (prev === a ? prev : a));
    },
  });

  const settle = (e: NativeSyntheticEvent<NativeScrollEvent>) => onChange(ageFromX(e.nativeEvent.contentOffset.x));

  const jumpTo = (age: number) => {
    scrollRef.current?.scrollTo({ x: (age - MIN_AGE) * TICK_W, animated: true });
    onChange(age);
  };

  const ticks = useMemo(
    () =>
      AGES.map((age, i) => {
        const center = i * TICK_W;
        const scaleY = scrollX.interpolate({ inputRange: [center - TICK_W * 9, center, center + TICK_W * 9], outputRange: [0.3, 1, 0.3], extrapolate: 'clamp' });
        const opacity = scrollX.interpolate({ inputRange: [center - TICK_W * 12, center, center + TICK_W * 12], outputRange: [0.25, 1, 0.25], extrapolate: 'clamp' });
        const major = age % 10 === 0;
        return (
          <View key={age} style={{ width: TICK_W, alignItems: 'center', justifyContent: 'flex-end', height: s(64) }}>
            <Animated.View style={{ width: major ? 3 : 2, height: major ? s(52) : s(36), borderRadius: 2, backgroundColor: '#FFFFFF', opacity, transform: [{ scaleY }] }} />
          </View>
        );
      }),
    [scrollX],
  );

  return (
    <View style={styles.wrap}>
      {/* Illustration */}
      <View style={styles.hero}>
        <View style={[styles.blob, { backgroundColor: '#F2C94C', width: s(220), height: s(220), borderRadius: s(110), left: -s(80), bottom: -s(90) }]} />
        <View style={[styles.blob, { backgroundColor: colors.primaryLime, width: s(260), height: s(260), borderRadius: s(130), right: -s(70), bottom: -s(120) }]} />
        <Mascot size={s(104)} float style={{ marginBottom: -s(8) }} />
      </View>

      {/* Dark panel */}
      <View style={styles.panel}>
        <Text style={styles.title}>How old are you?</Text>
        <View style={styles.readout}>
          <Text style={styles.number}>{skipped ? '—' : live}</Text>
          <Text style={styles.word}>{wordFor(skipped ? null : live)}</Text>
        </View>

        <View style={styles.rulerWrap} onLayout={(e: LayoutChangeEvent) => setRulerW(e.nativeEvent.layout.width)}>
          {rulerW > 0 && (
            <Animated.ScrollView
              ref={scrollRef as any}
              horizontal
              showsHorizontalScrollIndicator={false}
              snapToInterval={TICK_W}
              decelerationRate="fast"
              scrollEventThrottle={16}
              onScroll={onScroll}
              onMomentumScrollEnd={settle}
              onScrollEndDrag={settle}
              contentContainerStyle={{ paddingHorizontal: sidePad }}
            >
              {ticks}
            </Animated.ScrollView>
          )}
          <View pointerEvents="none" style={[styles.marker, { backgroundColor: colors.primaryLime }]} />
        </View>

        <View style={styles.chips}>
          {BRACKETS.map((b) => {
            const on = !skipped && live >= parseInt(b.label, 10) && (b.label.endsWith('+') || live <= parseInt(b.label.split('–')[1], 10));
            return (
              <PressableScale key={b.label} onPress={() => jumpTo(b.age)} scaleTo={0.94}>
                <View style={[styles.chip, { borderColor: on ? colors.primaryLime : 'rgba(255,255,255,0.18)', backgroundColor: on ? 'rgba(200,242,74,0.14)' : 'transparent' }]}>
                  <Text style={[styles.chipText, { color: on ? colors.primaryLime : '#FFFFFF' }]}>{b.label}</Text>
                </View>
              </PressableScale>
            );
          })}
          <PressableScale onPress={() => onChange(null)} scaleTo={0.94}>
            <View style={[styles.chip, { borderColor: skipped ? colors.primaryLime : 'rgba(255,255,255,0.18)', backgroundColor: skipped ? 'rgba(200,242,74,0.14)' : 'transparent' }]}>
              <Text style={[styles.chipText, { color: skipped ? colors.primaryLime : 'rgba(255,255,255,0.7)' }]}>Skip</Text>
            </View>
          </PressableScale>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { borderRadius: 26, overflow: 'hidden', backgroundColor: colors.black },
  hero: { height: s(150), backgroundColor: '#F1F4D6', alignItems: 'center', justifyContent: 'flex-end', overflow: 'hidden' },
  blob: { position: 'absolute' },
  panel: { paddingTop: 18, paddingBottom: 16, gap: 10 },
  title: { fontFamily: font.display, fontSize: fs(24), color: '#FFFFFF', textAlign: 'center' },
  readout: { alignItems: 'center' },
  number: { fontFamily: font.display, fontSize: fs(44), lineHeight: fs(50), color: colors.primaryLime },
  word: { color: colors.mutedGray, fontSize: fs(12), fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase' },
  rulerWrap: { height: s(70), justifyContent: 'flex-end' },
  marker: { position: 'absolute', left: '50%', marginLeft: -2, bottom: 0, width: 4, height: s(66), borderRadius: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, paddingHorizontal: 12, marginTop: 6 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, borderWidth: 1 },
  chipText: { fontSize: fs(12), fontWeight: '700' },
});
