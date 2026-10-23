import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter, useNavigation } from "expo-router";
import { ShoppingCart, Bell, Camera, ChevronRight, Link2, Sparkles, LucideIcon } from '../../src/components/ui/lucide';
import { useFridgeStore } from '../../src/store/useFridgeStore';
import { useRecipeStore } from '../../src/store/useRecipeStore';
import { FREE_GENERATIONS_PER_DAY, useUserStore } from '../../src/store/useUserStore';
import { useTheme, spacing, fs, font, s } from '../../src/theme';
import { Screen, IconButton, Avatar, Button, page, PressableScale, GlassSurface } from '../../src/components/ui';
import { MediaPlaceholder } from '../../src/components/ui/MediaPlaceholder';
import { useShoppingStore } from '../../src/store/useShoppingStore';
import { ProgressRing } from '../../src/components/ui/ProgressRing';
import { Mascot } from '../../src/components/Mascot';
import { FirstRunGuide, GuideStep, TargetRect } from "../../src/components/FirstRunGuide";
import { PermissionPrimer } from '../../src/components/PermissionPrimer';
import { pushPermissionUndetermined, registerForPush } from '../../src/lib/push';
import { tabBarStyleFor } from "../../src/theme/tabBar";
import { computeMatch, fridgeUsagePercent, greeting, plural, sortByMatch } from '../../src/lib/matching';

const TOUR: GuideStep[] = [
  { key: 'intro', title: "Let's start together", body: 'Your kitchen is empty for now. Four quick things and you will have your first recipe.' },
  { key: 'fridge', target: 'hero', title: 'Your fridge at a glance', body: 'This card shows what you have and how many recipes are ready. Tap it any time to manage items.' },
  { key: 'scan', target: 'scan', title: 'Scan your shelves', body: 'Point the camera at your fridge. We recognise the food and add it for you in one go.' },
  { key: 'ai', target: 'generate', title: 'Ask the AI', body: 'Pick ingredients, set effort and style, and get six recipes built from what you actually have.' },
  { key: 'import', target: 'import', title: 'Paste a video link', body: 'TikTok, Reels or Shorts become a full recipe with the ingredients and steps pulled out.' },
  { key: 'go', title: 'Your first recipe', body: 'Scan your fridge now and we will cook up something from it, or add a few items by hand.', cta: 'Scan my fridge' },
];

/** Big glass button: sticker icon, a title and one line. */
function HomeTile({ icon: Icon, title, sub, onPress, dark }: { icon: LucideIcon; title: string; sub: string; onPress: () => void; dark?: boolean }) {
  const t = useTheme();
  return (
    <PressableScale onPress={onPress} scaleTo={0.96} highlight radius={24} highlightColor={dark ? '#FFFFFF' : '#14180F'}>
      <GlassSurface tone={dark ? 'dark' : 'light'} radius={24}>
        <View style={styles.tile}>
          <View style={[styles.tileIcon, { backgroundColor: dark ? 'rgba(255,255,255,0.12)' : t.cardAlt }]}>
            <Icon size={s(24)} color={dark ? '#FFFFFF' : t.textStrong} />
          </View>
          <Text style={[styles.tileTitle, { color: dark ? t.onDark : t.textStrong }]} numberOfLines={1}>{title}</Text>
          <Text style={[styles.tileSub, { color: dark ? t.lime : t.textMuted }]} numberOfLines={1}>{sub}</Text>
        </View>
      </GlassSurface>
    </PressableScale>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const t = useTheme();
  const items = useFridgeStore((u) => u.items);
  const recipes = useRecipeStore((u) => u.recipes);
  const profile = useUserStore((u) => u.profile);
  const notifications = useUserStore((u) => u.notifications);
  const freeLeft = useUserStore((u) => u.freeGenerationsLeft);
  const avatarIndex = useUserStore((u) => u.avatarIndex);
  const tourDone = useUserStore((u) => u.tourDone);
  const setTourDone = useUserStore((u) => u.setTourDone);
  const bootDone = useUserStore((u) => u.bootDone);

  const expiringCount = items.filter((i) => i.daysToExpiry <= 2).length;
  const hasUnread = notifications.some((n) => !n.isRead);
  const isEmpty = items.length === 0;

  const { ready, usage, tonight } = useMemo(() => {
    const sorted = sortByMatch(recipes, items);
    return {
      ready: recipes.filter((r) => computeMatch(r, items).matchPercent >= 80).length,
      usage: fridgeUsagePercent(items, recipes),
      // Empty fridge: nothing matches yet, so show the most-loved recipes as a first taste.
      tonight: isEmpty ? [...recipes].sort((a, b) => (b.likes ?? 0) - (a.likes ?? 0)).slice(0, 4) : sorted.slice(0, 4),
    };
  }, [recipes, items, isEmpty]);
  const pick = tonight[0];
  const shoppingLeft = useShoppingStore((st) => st.items.filter((i) => !i.isChecked).length);

  const firstName = profile.name.split(' ')[0];
  const generatorSubtext = profile.isPremium
    ? 'Unlimited with Premium'
    : freeLeft > 0
      ? `${freeLeft} of ${FREE_GENERATIONS_PER_DAY} free left`
      : 'No free left today';

  /* --- first-run tour: measure targets on demand ------------------------ */
  const scrollRef = useRef<ScrollView>(null);
  const heroRef = useRef<View>(null);
  const scanRef = useRef<View>(null);
  const genRef = useRef<View>(null);
  const importRef = useRef<View>(null);
  const [tourVisible, setTourVisible] = useState(false);
  const [pushPrimer, setPushPrimer] = useState(false);
  const pushPrimerSeen = useUserStore((u) => u.pushPrimerSeen);
  const setPushPrimerSeen = useUserStore((u) => u.setPushPrimerSeen);
  // Ask about reminders only after the tour, only once, and only if the OS has never been asked.
  useEffect(() => {
    if (pushPrimerSeen || tourVisible || !tourDone || profile.notifPrefs?.expiry === false) return;
    let alive = true;
    pushPermissionUndetermined().then((ask) => {
      if (alive && ask) setTimeout(() => setPushPrimer(true), 900);
    });
    return () => {
      alive = false;
    };
  }, [pushPrimerSeen, tourVisible, tourDone, profile.notifPrefs?.expiry]);
  const closePushPrimer = (allow: boolean) => {
    setPushPrimer(false);
    setPushPrimerSeen();
    if (allow) void registerForPush({ prompt: true });
  };

  useEffect(() => {
    if (!tourDone && bootDone) {
      const timer = setTimeout(() => setTourVisible(true), 700);
      return () => clearTimeout(timer);
    }
  }, [tourDone, bootDone]);

  useEffect(() => {
    navigation.setOptions({ tabBarStyle: tourVisible ? { ...tabBarStyleFor(t), display: "none" } : tabBarStyleFor(t) });
  }, [tourVisible, navigation, t]);

  const measure = (ref: React.RefObject<View | null>, radius: number) =>
    new Promise<TargetRect | null>((resolve) => {
      const node = ref.current;
      if (!node) return resolve(null);
      node.measureInWindow((x, y, w, h) => resolve(w && h ? { x, y, width: w, height: h, radius } : null));
    });

  const getTarget = useCallback(
    async (key: string): Promise<TargetRect | null> => {
      // Jump (no animation) so the layout is final, then let two frames settle before measuring.
      const settle = () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 40))));
      switch (key) {
        case "hero":
        case "scan":
        case "generate":
          scrollRef.current?.scrollTo({ y: 0, animated: false });
          await settle();
          return measure(key === "hero" ? heroRef : key === "scan" ? scanRef : genRef, key === "hero" ? 28 : 20);
        case "import":
          scrollRef.current?.scrollToEnd({ animated: false });
          await settle();
          return measure(importRef, 20);
        default:
          return null;
      }
    },
    [],
  );

  const finishTour = (action: 'cta' | 'skip' | 'done') => {
    setTourVisible(false);
    setTourDone();
    scrollRef.current?.scrollTo({ y: 0, animated: true });
    if (action === 'cta') setTimeout(() => router.push('/scan'), 250);
  };

  return (
    <View style={{ flex: 1 }}>
    <Screen animated={false} fadeOnFocus>

      <ScrollView ref={scrollRef} contentContainerStyle={[page, styles.scroll]} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.userInfo} onPress={() => router.push('/(tabs)/profile')} activeOpacity={0.8}>
            <Avatar index={avatarIndex} size={44} />
            <View>
              <Text style={[styles.greeting, { color: t.textMuted }]}>{greeting()}</Text>
              <Text style={[styles.userName, { color: t.text }]}>{profile.name}</Text>
            </View>
          </TouchableOpacity>

          <View style={styles.headerIcons}>
            <IconButton onPress={() => router.push('/shopping')}>
              <ShoppingCart size={18} color={t.text} />
            </IconButton>
            <IconButton onPress={() => router.push('/notifications')} badge={hasUnread}>
              <Bell size={18} color={t.text} />
            </IconButton>
          </View>
        </View>

        {/* Hero — or the first-run "let's start" card when the fridge is empty */}
        <View ref={heroRef} collapsable={false}>
          {isEmpty ? (
            <View style={[styles.hero, styles.heroEmpty, { backgroundColor: t.lime }]}>
              <View style={{ flex: 1, gap: 6 }}>
                <View style={styles.badgeRow}>
                  <Sparkles size={14} color={t.onLime} />
                  <Text style={[styles.badgeLabel, { color: t.onLime }]}>New kitchen</Text>
                </View>
                <Text style={[styles.heroTitle, { color: t.onLime }]}>Let's start{'\n'}together, {firstName}.</Text>
                <Text style={[styles.heroSub, { color: t.onLime }]}>Your fridge is empty. Add a few things and we'll cook up your first recipe.</Text>
                <View style={styles.heroActions}>
                  <Button label="Scan fridge" variant="dark" size="sm" onPress={() => router.push('/scan')} left={<Camera size={16} color={t.isDark ? t.onLime : t.onDark} />} />
                  <Button label="Add by hand" variant="outline" size="sm" onPress={() => router.push('/fridge/add-manual')} />
                </View>
              </View>
              <Mascot size={s(92)} float />
            </View>
          ) : (
            <TouchableOpacity activeOpacity={0.9} style={[styles.hero, { backgroundColor: t.lime }]} onPress={() => router.push('/fridge')}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <View style={styles.badgeRow}>
                  <View style={[styles.heroSquare, { backgroundColor: t.dark }]} />
                  <Text style={[styles.badgeLabel, { color: t.onLime }]}>Your fridge today</Text>
                </View>
                <Text style={[styles.heroTitle, { color: t.onLime }]}>
                  {plural(items.length, 'ingredient')},{'\n'}
                  {plural(ready, 'recipe')} ready
                </Text>
                <Text style={[styles.heroSub, { color: t.onLime }]}>
                  {expiringCount > 0
                    ? `${plural(expiringCount, 'item')} expire${expiringCount === 1 ? 's' : ''} in 2 days →`
                    : 'Nothing expiring in the next 2 days ✓'}
                </Text>
              </View>
              <ProgressRing progress={usage / 100} size={84} strokeWidth={6} color={t.dark} trackColor="rgba(20,24,15,0.15)" backgroundColor="#FFFFFF" label={`${usage}%`} sublabel="USED" />
            </TouchableOpacity>
          )}
        </View>

        {/* Four big buttons: everything the app does, one tap away */}
        <View style={styles.tileGrid}>
          <View style={styles.tileRow}>
            <View ref={scanRef} collapsable={false} style={{ flex: 1 }}>
              <HomeTile icon={Camera} title="Scan fridge" sub="Snap it, confirm, done" onPress={() => router.push('/scan')} />
            </View>
            <View ref={genRef} collapsable={false} style={{ flex: 1 }}>
              <HomeTile dark icon={Sparkles} title="AI recipes" sub={generatorSubtext} onPress={() => router.push('/recipe/generate')} />
            </View>
          </View>
          <View style={styles.tileRow}>
            <View ref={importRef} collapsable={false} style={{ flex: 1 }}>
              <HomeTile icon={Link2} title="Import video" sub="TikTok, Reels, Shorts" onPress={() => router.push('/social/import')} />
            </View>
            <View style={{ flex: 1 }}>
              <HomeTile icon={ShoppingCart} title="Shopping" sub={shoppingLeft === 0 ? 'List is clear' : `${plural(shoppingLeft, 'item')} to buy`} onPress={() => router.push('/shopping')} />
            </View>
          </View>
        </View>

        {/* One pick instead of a feed */}
        {pick && (
          <PressableScale onPress={() => router.push(`/recipe/${pick.id}`)} scaleTo={0.98} highlight radius={24} highlightColor="#14180F">
            <GlassSurface tone="light" radius={24}>
              <View style={styles.pick}>
                <MediaPlaceholder label={pick.imageKey} uri={pick.imageUrl} tone={pick.tone} height={s(64)} radius={16} style={{ width: s(64) }} padding={4} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.pickKicker, { color: t.green }]}>{isEmpty ? 'TRY THIS FIRST' : 'MAKE IT TONIGHT'}</Text>
                  <Text style={[styles.pickTitle, { color: t.textStrong }]} numberOfLines={2}>{pick.title}</Text>
                  <Text style={[styles.pickMeta, { color: t.textMuted }]}>{pick.prepTimeMin} min • {pick.calories} kcal</Text>
                </View>
                <View style={[styles.arrowCircle, { backgroundColor: t.lime }]}>
                  <ChevronRight size={18} color={t.onLime} />
                </View>
              </View>
            </GlassSurface>
          </PressableScale>
        )}
        <Button label={isEmpty ? 'Browse recipes' : 'See all matches'} variant="outline" size="sm" onPress={() => router.push(isEmpty ? '/(tabs)/discover' : '/recipe/results')} />
      </ScrollView>
    </Screen>
      <FirstRunGuide visible={tourVisible} steps={TOUR} getTarget={getTarget} onFinish={finishTour} />
      <PermissionPrimer kind="notifications" visible={pushPrimer} onAllow={() => closePushPrimer(true)} onNotNow={() => closePushPrimer(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.tabBarClearance, gap: 14 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  userInfo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  greeting: { fontSize: fs(12) },
  userName: { fontFamily: font.display, fontSize: fs(19), fontWeight: '400' },
  headerIcons: { flexDirection: 'row', gap: 8 },
  hero: { borderRadius: 28, padding: 18, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heroEmpty: { alignItems: 'flex-end' },
  heroActions: { flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  heroSquare: { width: 14, height: 14, borderRadius: 4 },
  badgeLabel: { fontSize: fs(13), fontWeight: '700' },
  heroTitle: { fontFamily: font.display, fontSize: fs(22), fontWeight: '400', lineHeight: fs(27), marginBottom: 6, letterSpacing: -0.4 },
  heroSub: { fontSize: fs(13), fontWeight: '600', opacity: 0.85 },
  tileGrid: { gap: 12 },
  tileRow: { flexDirection: 'row', gap: 12 },
  tile: { alignSelf: 'stretch', padding: 16, gap: 4, minHeight: s(116), justifyContent: 'flex-end' },
  tileIcon: { width: s(46), height: s(46), borderRadius: s(16), alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  tileTitle: { fontFamily: font.display, fontSize: fs(18) },
  tileSub: { fontSize: fs(12), fontWeight: '600' },
  pick: { alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  pickKicker: { fontSize: fs(10), fontWeight: '800', letterSpacing: 1 },
  pickTitle: { fontFamily: font.display, fontSize: fs(16), lineHeight: fs(20), marginVertical: 2 },
  pickMeta: { fontSize: fs(12), fontWeight: '600' },
  actionGrid: { flexDirection: 'row', gap: 12 },
  actionCard: { flex: 1, padding: 16, borderRadius: 20, justifyContent: 'space-between', minHeight: 108 },
  actionTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  actionTitle: { fontWeight: '800', fontSize: fs(15), lineHeight: fs(19) },
  actionSub: { fontSize: fs(12), fontWeight: '600' },
  actionIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  seeAll: { fontSize: fs(13), fontWeight: '600' },
  expiring: { borderRadius: 18, borderWidth: 1, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  expiringTitle: { fontSize: fs(13), fontWeight: '800' },
  expiringSub: { fontSize: fs(12), marginTop: 2, opacity: 0.85 },
  banner: { borderWidth: 1, borderRadius: 20, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  bannerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  linkIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  bannerTitle: { fontWeight: '800', fontSize: fs(14) },
  bannerSub: { fontSize: fs(12) },
  arrowCircle: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
});
