import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, Animated, useWindowDimensions, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LEGAL } from '../config/legal';
import { X, Check, ChevronRight, ChevronLeft, ShieldCheck, Lock, CreditCard, Smartphone, Receipt, CalendarCheck, Sparkles, Zap } from './ui/lucide';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { useTheme, fs, font, s, colors } from '../theme';
import { IconButton, Button, PressableScale } from './ui';
import { MediaPlaceholder } from './ui/MediaPlaceholder';
import { ProcessingOverlay } from './ProcessingOverlay';

const HERO_URI = 'https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=1200&q=80';

const FEATURES = [
  'Unlimited AI recipe generations',
  'Smart scanning with expiry dates',
  'Weekly meal plans & shopping lists',
  'Early access to new features',
];

export const PLANS = {
  monthly: { label: 'Monthly', price: '€6.99', per: 'month', sub: 'Billed monthly', perYear: 6.99 * 12 },
  yearly: { label: 'Yearly', price: '€42.00', per: 'year', sub: 'Billed yearly', perYear: 42 },
} as const;
export type PlanKey = keyof typeof PLANS;

type Method = 'apple' | 'google' | 'card';
const METHODS: Array<{ id: Method; label: string; desc: string; glyph?: string; icon?: typeof CreditCard }> = [
  { id: 'apple', label: 'Apple Pay', desc: 'Face ID to confirm', glyph: '' },
  { id: 'google', label: 'Google Pay', desc: 'Saved in your Google account', glyph: 'G' },
  { id: 'card', label: 'Card', desc: 'Visa, Mastercard, Amex', icon: CreditCard },
];

const TRIAL_DAYS = 7;
const PAY_MS = 2400;
const PAY_ICONS = [ShieldCheck, Lock, CreditCard, Smartphone, Receipt, CalendarCheck, Sparkles, Zap];

const formatDate = (d: Date) => d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

interface Props {
  isPremium: boolean;
  /** Close / skip from the plans page. */
  onClose: () => void;
  skipLabel?: string;
  /**
   * Runs the purchase. Resolve `false` when the user cancelled the store
   * sheet (returns to the confirm page), throw to show an error. Should not navigate.
   */
  onSubscribe: (plan: PlanKey) => Promise<boolean | void> | boolean | void;
  /** Restore purchases; resolves whether Premium is now active. */
  onRestore?: () => Promise<boolean>;
  /** Called from the success page's Done button. */
  onDone: () => void;
  onCancelPlan?: () => void;
}

type Stage = 'plans' | 'confirm' | 'processing' | 'success';

/**
 * The paywall, shared by the /premium route and the last onboarding step.
 * Stages: pick a plan → confirm plan & payment method → processing → success.
 */
export const Paywall: React.FC<Props> = ({ isPremium, onClose, skipLabel, onSubscribe, onRestore, onDone, onCancelPlan }) => {
  const t = useTheme();
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [plan, setPlan] = useState<PlanKey>('monthly');
  const [method, setMethod] = useState<Method>('apple');
  const [stage, setStage] = useState<Stage>('plans');
  const pop = useRef(new Animated.Value(0)).current;

  const heroHeight = Math.round(height * 0.46);
  const save = Math.round(PLANS.monthly.perYear - PLANS.yearly.perYear);
  const trialEnds = new Date(Date.now() + TRIAL_DAYS * 86_400_000);
  const nextCharge = new Date(trialEnds.getTime() + (plan === 'monthly' ? 30 : 365) * 86_400_000);

  const restore = async () => {
    try {
      const active = onRestore ? await onRestore() : isPremium;
      Alert.alert('Restore purchases', active ? 'Your Premium plan is active.' : 'No previous purchase was found for this account.');
    } catch (e) {
      Alert.alert('Restore purchases', (e as Error)?.message || 'Could not reach the store. Try again.');
    }
  };

  const confirm = async () => {
    setStage('processing');
    try {
      // The store sheet (Apple/Google) and the overlay run together; the overlay keeps its minimum beat.
      const [ok] = await Promise.all([onSubscribe(plan), new Promise((r) => setTimeout(r, PAY_MS))]);
      if (ok === false) {
        setStage('confirm');
        return;
      }
      setStage('success');
    } catch (e) {
      setStage('confirm');
      Alert.alert('Payment did not complete', (e as Error)?.message || 'Nothing was charged. Try again.');
    }
  };

  useEffect(() => {
    if (stage !== 'success') return;
    pop.setValue(0);
    Animated.spring(pop, { toValue: 1, useNativeDriver: true, speed: 12, bounciness: 12 }).start();
  }, [stage, pop]);

  /* ---------------------------------------------------------------- success */
  if (stage === 'success') {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: colors.black }]}>
        <Animated.View style={[styles.center, { gap: 12, opacity: pop, transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.75, 1] }) }] }]}>
          <View style={[styles.bigCheck, { backgroundColor: t.lime }]}>
            <Check size={s(40)} color={t.dark} strokeWidth={3} />
          </View>
          <Text style={styles.successTitle}>You're Premium.</Text>
          <Text style={styles.successSub}>Unlimited generations, smart scanning and weekly plans are switched on.</Text>
        </Animated.View>

        <View style={[styles.receipt, { borderColor: 'rgba(255,255,255,0.12)' }]}>
          <View style={styles.receiptRow}>
            <Text style={styles.receiptKey}>Plan</Text>
            <Text style={styles.receiptVal}>FRIDGR Premium · {PLANS[plan].label}</Text>
          </View>
          <View style={styles.receiptRow}>
            <Text style={styles.receiptKey}>Free trial ends</Text>
            <Text style={styles.receiptVal}>{formatDate(trialEnds)}</Text>
          </View>
          <View style={styles.receiptRow}>
            <Text style={styles.receiptKey}>Then</Text>
            <Text style={styles.receiptVal}>{PLANS[plan].price} / {PLANS[plan].per}</Text>
          </View>
          <View style={styles.receiptRow}>
            <Text style={styles.receiptKey}>Paid with</Text>
            <Text style={styles.receiptVal}>{METHODS.find((m) => m.id === method)?.label}</Text>
          </View>
        </View>

        <Button label="Done" onPress={onDone} style={{ alignSelf: 'stretch', marginHorizontal: 20 }} right={<ChevronRight size={s(18)} color={t.onLime} strokeWidth={2.5} />} />
      </View>
    );
  }

  /* ---------------------------------------------------------------- confirm */
  if (stage === 'confirm' || stage === 'processing') {
    return (
      <View style={[styles.container, { backgroundColor: colors.black }]}>
        <ProcessingOverlay
          visible={stage === 'processing'}
          title="Securing your plan"
          icons={PAY_ICONS}
          centerIcon={ShieldCheck}
          durationMs={PAY_MS}
          lines={[`Talking to ${METHODS.find((m) => m.id === method)?.label}`, 'Starting your free trial', 'Activating Premium', 'Unlocking unlimited generations']}
        />
        <ScrollView contentContainerStyle={[styles.confirmScroll, { paddingTop: insets.top + 12 }]} showsVerticalScrollIndicator={false}>
          <View style={styles.confirmTop}>
            <IconButton dark onPress={() => setStage('plans')}>
              <ChevronLeft size={20} color="#FFFFFF" />
            </IconButton>
            <Text style={styles.stepText}>Step 2 of 3</Text>
            <View style={{ width: 40 }} />
          </View>

          <Text style={styles.confirmTitle}>Confirm your plan</Text>
          <Text style={styles.confirmSub}>Nothing is charged today. Cancel any time before the trial ends.</Text>

          <View style={[styles.summary, { borderColor: t.lime }]}>
            <View style={styles.summaryTop}>
              <View>
                <Text style={[styles.summaryLabel, { color: t.lime }]}>FRIDGR PREMIUM · {PLANS[plan].label.toUpperCase()}</Text>
                <Text style={styles.summaryPrice}>{TRIAL_DAYS}-day free trial</Text>
              </View>
              <PressableScale onPress={() => setStage('plans')} hitSlop={8}>
                <Text style={[styles.change, { color: t.lime }]}>Change</Text>
              </PressableScale>
            </View>
            <View style={styles.timeline}>
              {[
                { icon: Sparkles, title: 'Today', desc: 'Premium unlocks. €0.00 charged.' },
                { icon: CalendarCheck, title: `${formatDate(new Date(trialEnds.getTime() - 2 * 86_400_000))}`, desc: 'We remind you the trial is ending.' },
                { icon: Receipt, title: formatDate(trialEnds), desc: `First charge of ${PLANS[plan].price} / ${PLANS[plan].per}.` },
              ].map((row, i, arr) => (
                <View key={row.title} style={styles.timelineRow}>
                  <View style={styles.timelineLeft}>
                    <View style={[styles.timelineDot, { backgroundColor: i === 0 ? t.lime : 'rgba(255,255,255,0.14)' }]}>
                      <row.icon size={13} color={i === 0 ? t.dark : '#FFFFFF'} strokeWidth={2.2} />
                    </View>
                    {i < arr.length - 1 && <View style={styles.timelineLine} />}
                  </View>
                  <View style={{ flex: 1, paddingBottom: i < arr.length - 1 ? 14 : 0 }}>
                    <Text style={styles.timelineTitle}>{row.title}</Text>
                    <Text style={styles.timelineDesc}>{row.desc}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>

          <Text style={styles.sectionTag}>PAY WITH</Text>
          <View style={{ gap: 10 }}>
            {METHODS.map((m) => {
              const on = method === m.id;
              return (
                <PressableScale key={m.id} onPress={() => setMethod(m.id)} scaleTo={0.98} highlight radius={18}>
                  <View style={[styles.method, { borderColor: on ? t.lime : 'rgba(255,255,255,0.12)', backgroundColor: on ? 'rgba(200,242,74,0.08)' : colors.primaryDark }]}>
                    <View style={[styles.methodIcon, { backgroundColor: on ? t.lime : 'rgba(255,255,255,0.08)' }]}>
                      {m.icon ? <m.icon size={18} color={on ? t.dark : '#FFFFFF'} strokeWidth={2} /> : <Text style={[styles.glyph, { color: on ? t.dark : '#FFFFFF' }]}>{m.glyph}</Text>}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.methodLabel}>{m.label}</Text>
                      <Text style={styles.methodDesc}>{m.desc}</Text>
                    </View>
                    <View style={[styles.radio, { borderColor: on ? t.lime : 'rgba(255,255,255,0.25)', backgroundColor: on ? t.lime : 'transparent' }]}>
                      {on && <Check size={12} color={t.dark} strokeWidth={3} />}
                    </View>
                  </View>
                </PressableScale>
              );
            })}
          </View>

          <View style={styles.secureRow}>
            <Lock size={13} color={colors.mutedGray} />
            <Text style={styles.secureText}>Handled by the App Store / Google Play. We never see your card.</Text>
          </View>

          <Button label="Confirm & start free trial" onPress={confirm} right={<ChevronRight size={s(18)} color={t.onLime} strokeWidth={2.5} />} />
        </ScrollView>
      </View>
    );
  }

  /* ---------------------------------------------------------------- plans */
  return (
    <View style={[styles.container, { backgroundColor: colors.black }]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} bounces={false}>
        <MediaPlaceholder uri={HERO_URI} tone="sage" height={heroHeight} radius={0} padding={0}>
          <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
            <Defs>
              <LinearGradient id="heroFade" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={colors.black} stopOpacity="0.55" />
                <Stop offset="0.35" stopColor={colors.black} stopOpacity="0.05" />
                <Stop offset="0.7" stopColor={colors.black} stopOpacity="0.35" />
                <Stop offset="1" stopColor={colors.black} stopOpacity="1" />
              </LinearGradient>
            </Defs>
            <Rect width="100%" height="100%" fill="url(#heroFade)" />
          </Svg>

          <View style={[styles.topBar, { top: insets.top + 8 }]}>
            <IconButton dark onPress={onClose}>
              <X size={20} color="#FFFFFF" />
            </IconButton>
            <PressableScale onPress={restore} hitSlop={8}>
              <Text style={styles.restore}>Restore</Text>
            </PressableScale>
          </View>

          <View style={styles.brand}>
            <View style={styles.logoRow}>
              <View style={[styles.logo, { backgroundColor: t.lime }]}>
                <View style={[styles.logoDot, { backgroundColor: t.dark }]} />
              </View>
              <Text style={styles.logoText}>FRIDGR</Text>
            </View>
            <Text style={styles.tagline}>Unlock the most powerful{'\n'}kitchen assistant</Text>
          </View>
        </MediaPlaceholder>

        <View style={styles.features}>
          {FEATURES.map((f) => (
            <View key={f} style={styles.featureRow}>
              <Check size={s(18)} color={t.lime} strokeWidth={2.5} />
              <Text style={styles.featureText}>{f}</Text>
            </View>
          ))}
        </View>

        {isPremium ? (
          <View style={styles.bottom}>
            <View style={[styles.activeCard, { borderColor: t.lime }]}>
              <Check size={s(20)} color={t.lime} strokeWidth={2.5} />
              <Text style={[styles.activeText, { color: t.lime }]}>Premium is active on this account</Text>
            </View>
            {onCancelPlan && <Button label="Cancel plan" variant="outline" onDark onPress={onCancelPlan} />}
            {skipLabel && <Button label={skipLabel} onPress={onClose} />}
          </View>
        ) : (
          <View style={styles.bottom}>
            <View style={styles.plans}>
              {(Object.keys(PLANS) as PlanKey[]).map((key) => {
                const p = PLANS[key];
                const on = plan === key;
                return (
                  <PressableScale key={key} onPress={() => setPlan(key)} scaleTo={0.97} style={{ flex: 1 }} highlight radius={18}>
                    <View style={[styles.plan, { borderColor: on ? t.lime : 'rgba(255,255,255,0.14)', backgroundColor: on ? 'rgba(200,242,74,0.06)' : colors.primaryDark }]}>
                      {on && (
                        <View style={[styles.planCheck, { backgroundColor: t.lime }]}>
                          <Check size={12} color={t.dark} strokeWidth={3} />
                        </View>
                      )}
                      <Text style={[styles.planLabel, { color: on ? t.lime : '#FFFFFF' }]}>{p.label}</Text>
                      <Text style={[styles.planPrice, { color: on ? t.lime : '#FFFFFF' }]}>{p.price}</Text>
                      {key === 'yearly' ? (
                        <View style={styles.saveTag}>
                          <Text style={styles.saveText}>Save €{save}.00</Text>
                        </View>
                      ) : (
                        <View style={{ height: s(22) }} />
                      )}
                      <Text style={[styles.planSub, { color: on ? t.lime : 'rgba(255,255,255,0.75)' }]}>{p.sub}</Text>
                    </View>
                  </PressableScale>
                );
              })}
            </View>

            <Button label="Subscribe" onPress={() => setStage('confirm')} right={<ChevronRight size={s(18)} color={t.onLime} strokeWidth={2.5} />} />
            {skipLabel ? <Button label={skipLabel} variant="outline" onDark onPress={onClose} /> : null}
            <Text style={styles.legal}>{TRIAL_DAYS} days free, then {PLANS[plan].price} per {PLANS[plan].per}, auto-renewing until cancelled. Cancel anytime in Settings → Subscriptions.</Text>
            <View style={styles.legalLinks}>
              <PressableScale onPress={() => Linking.openURL(LEGAL.termsUrl)} hitSlop={8}><Text style={styles.legalLink}>Terms of Use</Text></PressableScale>
              <Text style={styles.legal}> · </Text>
              <PressableScale onPress={() => Linking.openURL(LEGAL.privacyUrl)} hitSlop={8}><Text style={styles.legalLink}>Privacy Policy</Text></PressableScale>
              <Text style={styles.legal}> · </Text>
              <PressableScale onPress={restore} hitSlop={8}><Text style={styles.legalLink}>Restore purchases</Text></PressableScale>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, gap: 24 },
  scroll: { paddingBottom: 28 },
  topBar: { position: 'absolute', left: 20, right: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  restore: { color: '#FFFFFF', fontSize: fs(14), fontWeight: '600' },
  brand: { position: 'absolute', top: 108, left: 0, right: 0, alignItems: 'center', gap: 6 },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logo: { width: s(28), height: s(28), borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  logoDot: { width: 10, height: 10, borderRadius: 3 },
  logoText: { fontFamily: font.display, fontSize: fs(30), color: '#FFFFFF', letterSpacing: 0.5 },
  tagline: { color: 'rgba(255,255,255,0.9)', fontSize: fs(14), textAlign: 'center', lineHeight: fs(19) },
  features: { paddingHorizontal: 24, marginTop: -8, gap: 12 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  featureText: { color: '#FFFFFF', fontSize: fs(14), fontWeight: '600', flex: 1 },
  bottom: { paddingHorizontal: 20, marginTop: 22, gap: 14 },
  plans: { flexDirection: 'row', gap: 12 },
  plan: { borderRadius: 18, borderWidth: 1.5, padding: 16, minHeight: s(120), justifyContent: 'space-between', gap: 6 },
  planCheck: { position: 'absolute', top: 10, right: 10, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  planLabel: { fontSize: fs(14), fontWeight: '600' },
  planPrice: { fontFamily: font.display, fontSize: fs(26) },
  saveTag: { alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.12)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  saveText: { color: '#FFFFFF', fontSize: fs(11), fontFamily: 'monospace', fontWeight: '700' },
  planSub: { fontSize: fs(12) },
  legal: { color: colors.mutedGray, fontSize: fs(11), textAlign: 'center', marginTop: -4 },
  legalLinks: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap' },
  legalLink: { color: '#FFFFFF', fontSize: fs(11), fontWeight: '700', textDecorationLine: 'underline' },
  activeCard: { borderRadius: 18, borderWidth: 1.5, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 12 },
  activeText: { fontSize: fs(15), fontWeight: '700', flex: 1 },
  // confirm
  confirmScroll: { paddingHorizontal: 20, paddingBottom: 30, gap: 14 },
  confirmTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stepText: { color: colors.mutedGray, fontSize: fs(12), fontWeight: '700', letterSpacing: 0.5 },
  confirmTitle: { fontFamily: font.display, fontSize: fs(30), color: '#FFFFFF', marginTop: 6 },
  confirmSub: { color: colors.mutedGray, fontSize: fs(14), lineHeight: fs(20), marginTop: -6 },
  summary: { borderRadius: 20, borderWidth: 1.5, padding: 16, gap: 16, backgroundColor: colors.primaryDark },
  summaryTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  summaryLabel: { fontSize: fs(11), fontWeight: '800', letterSpacing: 0.8 },
  summaryPrice: { fontFamily: font.display, fontSize: fs(24), color: '#FFFFFF', marginTop: 2 },
  change: { fontSize: fs(13), fontWeight: '700' },
  timeline: { gap: 0 },
  timelineRow: { flexDirection: 'row', gap: 12 },
  timelineLeft: { alignItems: 'center', width: 26 },
  timelineDot: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  timelineLine: { flex: 1, width: 2, backgroundColor: 'rgba(255,255,255,0.1)', marginVertical: 2 },
  timelineTitle: { color: '#FFFFFF', fontSize: fs(14), fontWeight: '800' },
  timelineDesc: { color: colors.mutedGray, fontSize: fs(12), marginTop: 2 },
  sectionTag: { color: colors.mutedGray, fontSize: fs(11), fontWeight: '700', letterSpacing: 1.2, marginTop: 6 },
  method: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 18, borderWidth: 1.5, padding: 14 },
  methodIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  glyph: { fontSize: fs(16), fontWeight: '800' },
  methodLabel: { color: '#FFFFFF', fontSize: fs(15), fontWeight: '800' },
  methodDesc: { color: colors.mutedGray, fontSize: fs(12), marginTop: 1 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  secureRow: { flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center' },
  secureText: { color: colors.mutedGray, fontSize: fs(11) },
  // success
  bigCheck: { width: s(96), height: s(96), borderRadius: s(48), alignItems: 'center', justifyContent: 'center', shadowColor: colors.primaryLime, shadowOpacity: 0.5, shadowRadius: 20, shadowOffset: { width: 0, height: 6 }, elevation: 8 },
  successTitle: { fontFamily: font.display, fontSize: fs(34), color: '#FFFFFF', textAlign: 'center' },
  successSub: { color: colors.mutedGray, fontSize: fs(14), lineHeight: fs(20), textAlign: 'center' },
  receipt: { alignSelf: 'stretch', borderRadius: 18, borderWidth: 1, padding: 16, gap: 10, backgroundColor: colors.primaryDark },
  receiptRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  receiptKey: { color: colors.mutedGray, fontSize: fs(13) },
  receiptVal: { color: '#FFFFFF', fontSize: fs(13), fontWeight: '700', flexShrink: 1, textAlign: 'right' },
});
