import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Easing, useWindowDimensions, NativeSyntheticEvent, NativeScrollEvent, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowRight, Camera, Plus, Sparkles, Link2, Leaf, Flame, Check, Egg, Fish, Milk, Carrot, Video, ChefHat, Play, Heart, Users, ArrowLeftRight, Timer, LucideIcon } from '../../src/components/ui/lucide';
import { ProgressRing } from '../../src/components/ui/ProgressRing';
import { useUserStore } from '../../src/store/useUserStore';
import { font, fs, s, colors } from '../../src/theme';
import { Screen, Button, PressableScale, Avatar } from '../../src/components/ui';
import { Mascot } from '../../src/components/Mascot';

/* ----------------------------------------------------------------------------
 * Slide content
 * ------------------------------------------------------------------------- */
interface Slide {
  key: string;
  /** Headline with one `*word*` highlighted. */
  headline: string;
  sub: string;
  icon: LucideIcon;
  tone: string;
}

const SLIDES: Slide[] = [
  { key: 'home', headline: 'Cook smarter with what is *already* in your fridge', sub: 'Every recipe starts from the food you actually have. No waste, no extra shop.', icon: Sparkles, tone: colors.primaryLime },
  { key: 'scan', headline: '*Scan* your shelves in seconds', sub: 'Point the camera at your fridge. FRIDGR recognises the food and tracks what is about to turn.', icon: Camera, tone: colors.primaryLime },
  { key: 'ai', headline: 'Recipes *built for you* by AI', sub: 'Your goals, your diet, your time. Six ideas from your ingredients in one tap.', icon: ChefHat, tone: colors.alertPeach },
  { key: 'import', headline: 'Turn any *food video* into a recipe', sub: 'Paste a TikTok, Reel or Short and get the ingredients, steps and a shopping list.', icon: Video, tone: colors.softSage },
  { key: 'adapt', headline: '*Adapt* any recipe to your fridge', sub: 'Missing something? FRIDGR swaps it for what you have and rebalances the macros.', icon: ArrowLeftRight, tone: colors.alertPeach },
  { key: 'cook', headline: 'Cook along, *hands-free*', sub: 'One step at a time, big type, built-in timers and the screen stays awake.', icon: Timer, tone: colors.primaryLime },
  { key: 'discover', headline: 'Learn from *real cooks*', sub: 'Follow creators, see how much of each dish you already have, save the ones you love.', icon: Users, tone: colors.softSage },
  { key: 'waste', headline: '*Waste less*, save more', sub: 'Expiry nudges, streaks and money saved. Nothing forgotten at the back of the shelf.', icon: Leaf, tone: colors.softBlush },
];

/* ----------------------------------------------------------------------------
 * Phone frame + miniature screens (pure visuals, sized for the frame)
 * ------------------------------------------------------------------------- */
const PhoneFrame: React.FC<{ width: number; children: React.ReactNode; dark?: boolean }> = ({ width, children, dark }) => {
  const h = width * 2.05;
  return (
    <View style={[styles.phone, { width, height: h, borderRadius: width * 0.16 }]}>
      <View style={[styles.phoneScreen, { borderRadius: width * 0.13, backgroundColor: dark ? colors.black : colors.bgLight }]}>
        <View style={styles.statusRow}>
          <Text style={[styles.statusText, { color: dark ? '#FFFFFF' : colors.primaryDark }]}>9:41</Text>
          <View style={[styles.notch, { backgroundColor: colors.black }]} />
          <Text style={[styles.statusText, { color: dark ? '#FFFFFF' : colors.primaryDark }]}>●●●</Text>
        </View>
        {children}
      </View>
    </View>
  );
};

const Mini = {
  title: (text: string, color = colors.primaryDark) => <Text style={[styles.mTitle, { color }]}>{text}</Text>,
  line: (w: number | `${number}%`, color = '#DADAD6', h = 6) => <View style={{ width: w, height: h, borderRadius: h / 2, backgroundColor: color }} />,
};

const MiniHome = () => (
  <View style={styles.mBody}>
    <View style={styles.mRow}>
      <Avatar index={3} size={22} />
      <View style={{ gap: 3 }}>
        {Mini.line(46, '#C9CBC4', 4)}
        {Mini.line(64, colors.primaryDark, 5)}
      </View>
    </View>
    <View style={[styles.mHero, { backgroundColor: colors.primaryLime }]}>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={styles.mKicker}>Your fridge today</Text>
        <Text style={styles.mHeroTitle}>12 ingredients,{'\n'}4 recipes ready</Text>
        <Text style={styles.mHeroSub}>2 items expire in 2 days →</Text>
      </View>
      <View style={styles.mRing}>
        <Text style={styles.mRingText}>86%</Text>
      </View>
    </View>
    <View style={styles.mRow}>
      <View style={[styles.mCard, { backgroundColor: '#FFFFFF', borderColor: '#DADAD6', borderWidth: 1 }]}>
        <Camera size={11} color={colors.primaryDark} />
        <Text style={styles.mCardText}>Scan fridge</Text>
      </View>
      <View style={[styles.mCard, { backgroundColor: colors.primaryDark }]}>
        <Plus size={11} color={colors.primaryLime} />
        <Text style={[styles.mCardText, { color: '#FFFFFF' }]}>AI generator</Text>
      </View>
    </View>
    {Mini.title('Make it tonight')}
    <View style={styles.mRow}>
      {[colors.warmCream, colors.softSage].map((c, i) => (
        <View key={i} style={[styles.mRecipe, { borderColor: '#DADAD6' }]}>
          <View style={[styles.mRecipeImg, { backgroundColor: c }]} />
          {Mini.line('90%', colors.primaryDark, 4)}
          {Mini.line('60%', '#C9CBC4', 3)}
        </View>
      ))}
    </View>
  </View>
);

const MiniScan = () => (
  <View style={[styles.mBody, { flex: 1 }]}>
    <View style={[styles.mCamera, { backgroundColor: '#1B2318' }]}>
      {[{ t: '18%', l: '10%', w: 46, h: 28, n: 'Peppers' }, { t: '30%', l: '58%', w: 40, h: 26, n: 'Eggs' }, { t: '58%', l: '22%', w: 48, h: 28, n: 'Spinach' }].map((b) => (
        <View key={b.n} style={{ position: 'absolute', top: b.t as any, left: b.l as any, width: b.w, height: b.h, borderRadius: 6, borderWidth: 1.5, borderColor: colors.primaryLime }}>
          <View style={[styles.mTag, { backgroundColor: colors.primaryLime }]}>
            <Text style={styles.mTagText}>{b.n}</Text>
          </View>
        </View>
      ))}
    </View>
    <View style={[styles.mSheet, { backgroundColor: colors.primaryDark }]}>
      <Text style={[styles.mSheetTitle]}>3 items found</Text>
      <View style={[styles.mRow, { flexWrap: 'wrap', gap: 4 }]}>
        {[Carrot, Egg, Leaf].map((I, i) => (
          <View key={i} style={[styles.mChip, { backgroundColor: colors.primaryLime }]}>
            <I size={8} color={colors.primaryDark} />
          </View>
        ))}
      </View>
      <View style={[styles.mBtn, { backgroundColor: colors.primaryLime }]}>
        <Text style={styles.mBtnText}>Add 3 to fridge</Text>
      </View>
    </View>
  </View>
);

const MiniAI = () => (
  <View style={styles.mBody}>
    <View style={[styles.mHero, { backgroundColor: colors.primaryDark, alignItems: 'flex-start', gap: 6 }]}>
      <View style={{ flex: 1, gap: 6 }}>
        <View style={[styles.mChip, { backgroundColor: colors.primaryLime, alignSelf: 'flex-start', paddingHorizontal: 6 }]}>
          <Text style={styles.mTagText}>Ask Fridgr AI</Text>
        </View>
        <View style={{ height: 18, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', paddingHorizontal: 6 }}>
          <Text style={{ color: '#8D9187', fontSize: 6 }}>Make it higher protein…</Text>
        </View>
      </View>
    </View>
    {Mini.title('6 recipes for you')}
    {[
      { name: 'Harissa chicken bowl', m: '92% match', c: colors.warmCream },
      { name: 'Yoghurt chilli eggs', m: '100% match', c: colors.softSage },
      { name: 'Spinach & feta rice', m: '88% match', c: colors.softBlush },
    ].map((r) => (
      <View key={r.name} style={[styles.mListRow, { borderColor: '#DADAD6' }]}>
        <View style={[styles.mThumb, { backgroundColor: r.c }]} />
        <View style={{ flex: 1, gap: 3 }}>
          <View style={[styles.mChip, { backgroundColor: colors.primaryLime, alignSelf: 'flex-start', paddingHorizontal: 5 }]}>
            <Text style={styles.mTagText}>{r.m}</Text>
          </View>
          <Text style={styles.mListTitle}>{r.name}</Text>
          {Mini.line('70%', '#C9CBC4', 3)}
        </View>
      </View>
    ))}
  </View>
);

/**
 * Video → recipe, staged like a call connecting: the video card "rings" with
 * expanding pulses, then flies down into the recipe card while the
 * ingredient lines type in one by one. Loops while the slide is on screen.
 */
const MiniImport = () => {
  const ring1 = useRef(new Animated.Value(0)).current;
  const ring2 = useRef(new Animated.Value(0)).current;
  const fly = useRef(new Animated.Value(0)).current;
  const lines = useRef([0, 1, 2].map(() => new Animated.Value(0))).current;

  useEffect(() => {
    const pulse = (v: Animated.Value, delay: number) =>
      Animated.sequence([Animated.delay(delay), Animated.timing(v, { toValue: 1, duration: 900, easing: Easing.out(Easing.quad), useNativeDriver: true }), Animated.timing(v, { toValue: 0, duration: 0, useNativeDriver: true })]);
    const cycle = Animated.sequence([
      // ringing
      Animated.parallel([Animated.loop(pulse(ring1, 0), { iterations: 2 }), Animated.loop(pulse(ring2, 450), { iterations: 2 })]),
      // connect: the video shrinks into the recipe row
      Animated.timing(fly, { toValue: 1, duration: 650, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
      // ingredients arrive
      Animated.stagger(180, lines.map((l) => Animated.timing(l, { toValue: 1, duration: 260, easing: Easing.out(Easing.quad), useNativeDriver: true }))),
      Animated.delay(1400),
      // reset
      Animated.parallel([Animated.timing(fly, { toValue: 0, duration: 400, useNativeDriver: true }), ...lines.map((l) => Animated.timing(l, { toValue: 0, duration: 200, useNativeDriver: true }))]),
      Animated.delay(300),
    ]);
    const loop = Animated.loop(cycle);
    loop.start();
    return () => loop.stop();
  }, [ring1, ring2, fly, lines]);

  const ringStyle = (v: Animated.Value) => ({
    opacity: v.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 0.6, 0] }),
    transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 2.4] }) }],
  });

  return (
    <View style={[styles.mBody, { flex: 1 }]}>
      {Mini.title('Import from a video')}
      <View style={[styles.mInput, { backgroundColor: '#FFFFFF', borderColor: '#DADAD6' }]}>
        <Link2 size={8} color="#8D9187" />
        <Text style={{ fontSize: 6, color: colors.primaryDark }}>tiktok.com/@kitchenbysam/video/7421</Text>
      </View>

      {/* stage: ringing video card that flies into the recipe */}
      <View style={{ height: 78, alignItems: 'center', justifyContent: 'center' }}>
        <Animated.View style={[styles.mPulse, ringStyle(ring1)]} />
        <Animated.View style={[styles.mPulse, ringStyle(ring2)]} />
        <Animated.View
          style={[
            styles.mVideo,
            {
              backgroundColor: colors.primaryDark,
              transform: [
                { translateY: fly.interpolate({ inputRange: [0, 1], outputRange: [0, 62] }) },
                { translateX: fly.interpolate({ inputRange: [0, 1], outputRange: [0, -44] }) },
                { scale: fly.interpolate({ inputRange: [0, 1], outputRange: [1, 0.42] }) },
              ],
            },
          ]}
        >
          <Play size={14} color={colors.primaryLime} fill={colors.primaryLime} />
          <Text style={{ fontSize: 5, color: '#FFFFFF', fontWeight: '800', marginTop: 2 }}>@kitchenbysam</Text>
        </Animated.View>
      </View>

      <View style={[styles.mListRow, { borderColor: '#DADAD6', alignItems: 'flex-start' }]}>
        <View style={[styles.mThumb, { backgroundColor: colors.warmCream }]} />
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={styles.mListTitle}>Crispy gochujang salmon bowl</Text>
          {[['Salmon', true], ['Rice', true], ['Gochujang', false]].map(([n, ok], i) => (
            <Animated.View key={String(n)} style={[styles.mRow, { justifyContent: 'space-between', opacity: lines[i], transform: [{ translateX: lines[i].interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }]}>
              <Text style={{ fontSize: 6, color: colors.primaryDark }}>{String(n)}</Text>
              <Text style={{ fontSize: 5, fontWeight: '800', color: ok ? colors.greenFresh : colors.alertOrange }}>{ok ? 'IN FRIDGE' : 'MISSING'}</Text>
            </Animated.View>
          ))}
        </View>
      </View>
      <Animated.View style={[styles.mHero, { backgroundColor: colors.primaryLime, paddingVertical: 8, opacity: lines[2] }]}>
        <Text style={[styles.mHeroSub, { fontWeight: '800' }]}>7 of 9 already in your fridge</Text>
      </Animated.View>
    </View>
  );
};

const MiniAdapt = () => (
  <View style={styles.mBody}>
    {Mini.title('Adapt recipe')}
    <View style={[styles.mHero, { backgroundColor: colors.primaryDark, paddingVertical: 8 }]}>
      <Text style={{ fontSize: 6, color: '#FFFFFF', fontWeight: '700', flex: 1 }}>I rebuilt this around your fridge. Two swaps, +14g protein, still 25 min.</Text>
    </View>
    {[
      { tag: 'SWAP', from: 'Gochujang', to: 'Sriracha + honey', peach: true },
      { tag: 'SWAP', from: 'Mirin', to: 'Rice vinegar + sugar', peach: true },
      { tag: 'BOOST', from: '280 g salmon', to: '400 g + edamame', peach: false },
    ].map((r) => (
      <View key={r.from} style={[styles.mListRow, { borderColor: '#DADAD6', flexDirection: 'column', alignItems: 'stretch', gap: 4 }]}>
        <View style={[styles.mRow, { justifyContent: 'space-between' }]}>
          <View style={[styles.mChip, { backgroundColor: r.peach ? colors.alertPeach : colors.softSage, width: undefined, height: undefined, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4 }]}>
            <Text style={{ fontSize: 4.5, fontWeight: '800', color: r.peach ? colors.alertOrange : colors.greenFresh }}>{r.tag}</Text>
          </View>
          <View style={{ width: 16, height: 9, borderRadius: 5, backgroundColor: colors.primaryLime, alignItems: 'flex-end', justifyContent: 'center', paddingHorizontal: 1 }}>
            <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: '#FFFFFF' }} />
          </View>
        </View>
        <View style={styles.mRow}>
          <Text style={{ fontSize: 6, color: '#8D9187', textDecorationLine: 'line-through' }}>{r.from}</Text>
          <ArrowLeftRight size={7} color={colors.primaryDark} />
          <Text style={{ fontSize: 6, fontWeight: '800', color: colors.primaryDark }}>{r.to}</Text>
        </View>
      </View>
    ))}
    <View style={[styles.mBtn, { backgroundColor: colors.primaryLime }]}>
      <Text style={styles.mBtnText}>Apply & start cooking</Text>
    </View>
  </View>
);

/** Cooking mode with a timer that actually counts down and loops. */
const MiniCook = () => {
  const [progress, setProgress] = useState(1);
  useEffect(() => {
    let p = 1;
    const id = setInterval(() => {
      p = p <= 0.05 ? 1 : p - 0.05;
      setProgress(p);
    }, 400);
    return () => clearInterval(id);
  }, []);
  const secs = Math.round(240 * progress);
  return (
    <View style={[styles.mBody, { flex: 1, gap: 8 }]}>
      <View style={styles.mRow}>
        {[1, 2, 3, 4, 5, 6].map((n) => (
          <View key={n} style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: n <= 2 ? colors.primaryLime : 'rgba(255,255,255,0.2)' }} />
        ))}
      </View>
      <Text style={{ color: colors.primaryLime, fontSize: 5.5, fontWeight: '800', letterSpacing: 1 }}>SEAR</Text>
      <Text style={{ fontFamily: font.display, fontSize: 11, lineHeight: 14, color: '#FFFFFF' }}>Sear the chicken 4 minutes a side in a hot dry pan until deeply coloured.</Text>
      <View style={[styles.mChip, { backgroundColor: 'rgba(255,255,255,0.12)', width: undefined, height: undefined, paddingHorizontal: 6, paddingVertical: 3, alignSelf: 'flex-start', borderRadius: 8 }]}>
        <Text style={{ fontSize: 5.5, color: '#FFFFFF', fontWeight: '700' }}>Chicken breast</Text>
      </View>
      <View style={[styles.mHero, { backgroundColor: colors.primaryDark, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', gap: 8 }]}>
        <ProgressRing animated progress={progress} size={34} strokeWidth={3} color={colors.primaryLime} trackColor="rgba(255,255,255,0.12)">
          <Text style={{ fontSize: 6.5, color: '#FFFFFF', fontWeight: '800' }}>{`${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`}</Text>
        </ProgressRing>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={{ fontSize: 6.5, color: '#FFFFFF', fontWeight: '800' }}>Step timer · 4 min</Text>
          <View style={[styles.mBtn, { backgroundColor: colors.primaryLime, alignSelf: 'flex-start', paddingHorizontal: 8, height: 13 }]}>
            <Text style={[styles.mBtnText, { fontSize: 5 }]}>Pause</Text>
          </View>
        </View>
      </View>
      <View style={{ flex: 1 }} />
      <View style={[styles.mBtn, { backgroundColor: colors.primaryLime }]}>
        <Text style={styles.mBtnText}>Next step</Text>
      </View>
    </View>
  );
};

const MiniDiscover = () => (
  <View style={styles.mBody}>
    {Mini.title('Discover')}
    <View style={styles.mRow}>
      {['For you', 'Trending', 'Quick'].map((c, i) => (
        <View key={c} style={{ paddingHorizontal: 6, paddingVertical: 3, borderRadius: 8, backgroundColor: i === 0 ? colors.primaryDark : '#FFFFFF', borderWidth: 1, borderColor: '#DADAD6' }}>
          <Text style={{ fontSize: 5.5, fontWeight: '700', color: i === 0 ? '#FFFFFF' : colors.primaryDark }}>{c}</Text>
        </View>
      ))}
    </View>
    {[
      { a: 0, n: 'Nadia Benali', t: 'Harissa chicken bowl', m: '92% you have', c: colors.warmCream },
      { a: 1, n: 'Sam Okafor', t: 'Gochujang salmon', m: '78% you have', c: colors.softSage },
    ].map((p) => (
      <View key={p.n} style={[styles.mListRow, { borderColor: '#DADAD6', flexDirection: 'column', alignItems: 'stretch', gap: 4 }]}>
        <View style={[styles.mRow, { justifyContent: 'space-between' }]}>
          <View style={styles.mRow}>
            <Avatar index={p.a} size={14} />
            <Text style={{ fontSize: 6, fontWeight: '800', color: colors.primaryDark }}>{p.n}</Text>
          </View>
          <Text style={{ fontSize: 5, color: '#8D9187', fontWeight: '700' }}>Following</Text>
        </View>
        <View style={{ height: 34, borderRadius: 6, backgroundColor: p.c, alignItems: 'flex-end', padding: 3 }}>
          <View style={{ backgroundColor: 'rgba(20,24,15,0.85)', paddingHorizontal: 4, paddingVertical: 1, borderRadius: 5 }}>
            <Text style={{ fontSize: 4.5, color: colors.primaryLime, fontWeight: '800' }}>{p.m}</Text>
          </View>
        </View>
        <View style={[styles.mRow, { justifyContent: 'space-between' }]}>
          <Text style={styles.mListTitle}>{p.t}</Text>
          <View style={styles.mRow}>
            <Heart size={7} color="#E11D48" fill="#E11D48" />
            <Text style={{ fontSize: 5, color: colors.primaryDark, fontWeight: '700' }}>1.2k</Text>
          </View>
        </View>
      </View>
    ))}
  </View>
);

const MiniWaste = () => (
  <View style={styles.mBody}>
    {Mini.title('My Fridge')}
    <View style={styles.mRow}>
      {[['12', 'Fresh', '#FFFFFF', colors.primaryDark], ['2', 'Expiring', colors.alertPeach, colors.alertOrange], ['7', 'Recipes', colors.primaryDark, colors.primaryLime]].map(([v, l, bg, fg]) => (
        <View key={String(l)} style={[styles.mStat, { backgroundColor: String(bg) }]}>
          <Text style={{ fontFamily: font.display, fontSize: 11, color: String(fg) }}>{v}</Text>
          <Text style={{ fontSize: 5, color: String(fg), fontWeight: '700' }}>{l}</Text>
        </View>
      ))}
    </View>
    {[
      { n: 'Greek yoghurt', I: Milk, st: '2 days', c: colors.alertOrange },
      { n: 'Spinach', I: Leaf, st: '2 days', c: colors.alertOrange },
      { n: 'Salmon', I: Fish, st: 'Fresh', c: colors.greenFresh },
    ].map((r) => (
      <View key={r.n} style={[styles.mListRow, { borderColor: '#DADAD6', paddingVertical: 5 }]}>
        <View style={[styles.mChip, { backgroundColor: colors.softSage, width: 16, height: 16, borderRadius: 5 }]}>
          <r.I size={8} color={colors.primaryDark} />
        </View>
        <Text style={[styles.mListTitle, { flex: 1 }]}>{r.n}</Text>
        <Text style={{ fontSize: 6, fontWeight: '800', color: r.c }}>{r.st}</Text>
      </View>
    ))}
    <View style={[styles.mHero, { backgroundColor: colors.softSage, paddingVertical: 8, gap: 6 }]}>
      <Flame size={10} color={colors.alertOrange} />
      <Text style={[styles.mHeroSub, { fontWeight: '800' }]}>12-day streak · €38 saved</Text>
    </View>
  </View>
);

const MINI: Record<string, { node: React.ReactNode; dark?: boolean }> = {
  home: { node: <MiniHome /> },
  scan: { node: <MiniScan />, dark: true },
  ai: { node: <MiniAI /> },
  import: { node: <MiniImport /> },
  adapt: { node: <MiniAdapt /> },
  cook: { node: <MiniCook />, dark: true },
  discover: { node: <MiniDiscover /> },
  waste: { node: <MiniWaste /> },
};

/** "Cook smarter with what is *already* in your fridge" → highlighted word in a lime pill. */
const Headline: React.FC<{ text: string; icon: LucideIcon }> = ({ text, icon: Icon }) => {
  const parts = text.split('*');
  return (
    <Text style={styles.headline}>
      {parts.map((p, i) =>
        i % 2 === 1 ? (
          <Text key={i} style={styles.headlineHi}>
            {' '}{p}{' '}
          </Text>
        ) : (
          <Text key={i}>{p}</Text>
        ),
      )}
      {'  '}
      <Icon size={fs(20)} color={colors.primaryDark} strokeWidth={2.2} />
    </Text>
  );
};

/* ----------------------------------------------------------------------------
 * Screen
 * ------------------------------------------------------------------------- */
export default function IntroScreen() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const setIntroSeen = useUserStore((u) => u.setIntroSeen);
  const introSeen = useUserStore((u) => u.introSeen);
  const scrollRef = useRef<ScrollView>(null);
  const scrollX = useRef(new Animated.Value(0)).current;
  const [page, setPage] = useState(0);

  const phoneW = Math.min(width * 0.52, 210, (height * 0.42) / 2.05);
  const isLast = page === SLIDES.length - 1;

  const finish = () => setIntroSeen();
  useEffect(() => {
    if (introSeen) router.replace('/auth/welcome');
  }, [introSeen, router]);

  const goTo = (i: number) => scrollRef.current?.scrollTo({ x: i * width, animated: true });
  const onScroll = Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], { useNativeDriver: true });
  const onEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => setPage(Math.round(e.nativeEvent.contentOffset.x / width));

  return (
    <Screen style={{ backgroundColor: colors.bgLight }}>
      <View style={styles.top}>
        <View style={styles.brandRow}>
          <Mascot size={s(28)} />
          <Text style={styles.brand}>FRIDGR</Text>
        </View>
        <PressableScale onPress={finish} hitSlop={8}>
          <Text style={styles.skip}>Skip</Text>
        </PressableScale>
      </View>

      <Animated.ScrollView
        ref={scrollRef as any}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        onMomentumScrollEnd={onEnd}
        style={{ flex: 1 }}
      >
        {SLIDES.map((slide, i) => {
          const input = [(i - 1) * width, i * width, (i + 1) * width];
          const translateX = scrollX.interpolate({ inputRange: input, outputRange: [width * 0.18, 0, -width * 0.18], extrapolate: 'clamp' });
          const scale = scrollX.interpolate({ inputRange: input, outputRange: [0.86, 1, 0.86], extrapolate: 'clamp' });
          const rotate = scrollX.interpolate({ inputRange: input, outputRange: ['6deg', '0deg', '-6deg'], extrapolate: 'clamp' });
          const textOpacity = scrollX.interpolate({ inputRange: input, outputRange: [0, 1, 0], extrapolate: 'clamp' });
          const mini = MINI[slide.key];
          return (
            <View key={slide.key} style={{ width, paddingHorizontal: 24 }}>
              <Animated.View style={[styles.textBlock, { opacity: textOpacity, transform: [{ translateY: textOpacity.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] }]}>
                <Headline text={slide.headline} icon={slide.icon} />
                <Text style={styles.sub}>{slide.sub}</Text>
              </Animated.View>

              <View style={styles.stage}>
                <View pointerEvents="none" style={[styles.stageBlob, { backgroundColor: slide.tone, width: phoneW * 1.5, height: phoneW * 1.5, borderRadius: phoneW * 0.75 }]} />
                <Animated.View style={{ transform: [{ translateX }, { scale }, { rotate }] }}>
                  <PhoneFrame width={phoneW} dark={mini.dark}>
                    {mini.node}
                  </PhoneFrame>
                </Animated.View>
              </View>
            </View>
          );
        })}
      </Animated.ScrollView>

      <View style={styles.footer}>
        <View style={styles.dots}>
          {SLIDES.map((sl, i) => {
            // scrollX is native-driven, so stretch with a transform (width isn't animatable natively).
            const sx = scrollX.interpolate({ inputRange: [(i - 1) * width, i * width, (i + 1) * width], outputRange: [1, 3.2, 1], extrapolate: 'clamp' });
            const o = scrollX.interpolate({ inputRange: [(i - 1) * width, i * width, (i + 1) * width], outputRange: [0.35, 1, 0.35], extrapolate: 'clamp' });
            return <Animated.View key={sl.key} style={[styles.dot, { opacity: o, backgroundColor: colors.primaryDark, transform: [{ scaleX: sx }] }]} />;
          })}
        </View>
        <Button
          label={isLast ? 'Get started' : 'Next'}
          onPress={() => (isLast ? finish() : goTo(page + 1))}
          right={<ArrowRight size={18} color={colors.primaryDark} strokeWidth={2.5} />}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingTop: 8 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brand: { fontFamily: font.display, fontSize: fs(18), letterSpacing: 2, color: colors.primaryDark },
  skip: { color: colors.mutedGray, fontSize: fs(14), fontWeight: '700', padding: 6 },
  textBlock: { marginTop: 18, gap: 8, minHeight: s(120) },
  headline: { fontFamily: font.display, fontSize: fs(28), lineHeight: fs(36), color: colors.primaryDark },
  headlineHi: { backgroundColor: colors.primaryLime, color: colors.primaryDark, borderRadius: 8, overflow: 'hidden' },
  sub: { color: colors.mutedGray, fontSize: fs(14), lineHeight: fs(20) },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  stageBlob: { position: 'absolute', opacity: 0.9 },
  footer: { paddingHorizontal: 24, paddingBottom: 24, gap: 14 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 14, alignItems: 'center' },
  dot: { width: 6, height: 6, borderRadius: 3 },
  // phone
  phone: { backgroundColor: colors.primaryDark, padding: 5, shadowColor: '#000', shadowOpacity: 0.28, shadowRadius: 24, shadowOffset: { width: 0, height: 14 }, elevation: 10 },
  phoneScreen: { flex: 1, overflow: 'hidden', paddingTop: 6 },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, height: 14 },
  statusText: { fontSize: 6, fontWeight: '800' },
  notch: { width: 44, height: 10, borderRadius: 6 },
  // mini ui
  mBody: { padding: 8, gap: 6 },
  mRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  mTitle: { fontFamily: font.display, fontSize: 9, marginTop: 2 },
  mKicker: { fontSize: 5, fontWeight: '800', color: colors.primaryDark },
  mHero: { borderRadius: 12, padding: 9, flexDirection: 'row', alignItems: 'center', gap: 6 },
  mHeroTitle: { fontFamily: font.display, fontSize: 9, color: colors.primaryDark, lineHeight: 11 },
  mHeroSub: { fontSize: 5.5, fontWeight: '600', color: colors.primaryDark },
  mRing: { width: 26, height: 26, borderRadius: 13, borderWidth: 3, borderColor: colors.primaryDark, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  mRingText: { fontSize: 6, fontWeight: '800', color: colors.primaryDark },
  mCard: { flex: 1, borderRadius: 9, padding: 7, gap: 4, minHeight: 34 },
  mCardText: { fontSize: 6, fontWeight: '800', color: colors.primaryDark },
  mRecipe: { flex: 1, borderRadius: 8, borderWidth: 1, backgroundColor: '#FFFFFF', padding: 4, gap: 3 },
  mRecipeImg: { height: 26, borderRadius: 5 },
  mCamera: { flex: 1, borderRadius: 12, margin: 6, minHeight: 130, position: 'relative' },
  mTag: { position: 'absolute', top: -6, left: 3, paddingHorizontal: 3, paddingVertical: 1, borderRadius: 3 },
  mTagText: { fontSize: 4.5, fontWeight: '800', color: colors.primaryDark },
  mSheet: { borderTopLeftRadius: 12, borderTopRightRadius: 12, padding: 8, gap: 6, marginHorizontal: -8, marginBottom: -8 },
  mSheetTitle: { fontFamily: font.display, fontSize: 8, color: '#FFFFFF' },
  mChip: { width: 14, height: 14, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  mBtn: { height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  mBtnText: { fontSize: 6, fontWeight: '800', color: colors.primaryDark },
  mListRow: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 9, padding: 6, backgroundColor: '#FFFFFF' },
  mThumb: { width: 24, height: 24, borderRadius: 6 },
  mListTitle: { fontSize: 6.5, fontWeight: '800', color: colors.primaryDark },
  mInput: { height: 16, borderRadius: 7, borderWidth: 1, paddingHorizontal: 6, flexDirection: 'row', alignItems: 'center', gap: 4 },
  mPulse: { position: "absolute", width: 44, height: 44, borderRadius: 22, borderWidth: 1.5, borderColor: colors.primaryLime },
  mVideo: { width: 62, height: 46, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  mStat: { flex: 1, borderRadius: 8, padding: 6, borderWidth: 1, borderColor: '#DADAD6' },
});
