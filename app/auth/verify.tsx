import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TextInput, Animated, Easing, Keyboard, Pressable } from 'react-native';
import { Check, MailCheck } from '../../src/components/ui/lucide';
import { useRouter } from "expo-router";
import { useUserStore } from "../../src/store/useUserStore";
import { font, fs, s, colors } from '../../src/theme';
import { Screen, Button, PressableScale } from '../../src/components/ui';
import { Mascot } from '../../src/components/Mascot';
import { errorMessage } from '../../src/lib/errors';

const CODE_LENGTH = 6;
const RESEND_SECONDS = 30;

/**
 * Registration confirmation: a 6-digit code "sent" to the sign-up email.
 * Demo mode: any 6 digits pass.
 */
export default function VerifyScreen() {
  const router = useRouter();
  const { profile, verifyEmail, resendCode, logOut, emailVerified } = useUserStore();
  const [code, setCode] = useState('');
  const [checking, setChecking] = useState(false);
  const [done, setDone] = useState(false);
  const [resendIn, setResendIn] = useState(RESEND_SECONDS);
  const inputRef = useRef<TextInput>(null);
  const shake = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 400);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const [error, setError] = useState<string | null>(null);

  const shakeNow = () =>
    Animated.sequence([
      Animated.timing(shake, { toValue: 1, duration: 60, easing: Easing.linear, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -1, duration: 60, easing: Easing.linear, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 0, duration: 60, easing: Easing.linear, useNativeDriver: true }),
    ]).start();

  // Demo mode: any six digits pass. Kept out of an effect so its
  // own state changes can never cancel the timer it just started.
  const submitting = useRef(false);
  const submit = async (value: string) => {
    if (value.length !== CODE_LENGTH || submitting.current) return;
    submitting.current = true;
    setChecking(true);
    setError(null);
    Keyboard.dismiss();
    const started = Date.now();
    try {
      await new Promise((r) => setTimeout(r, 700));
      // Keep the "checking" beat visible for at least 600 ms so it never flickers.
      await new Promise((r) => setTimeout(r, Math.max(0, 600 - (Date.now() - started))));
      setChecking(false);
      setDone(true);
      Animated.spring(pop, { toValue: 1, useNativeDriver: true, speed: 12, bounciness: 12 }).start();
      setTimeout(() => verifyEmail(), 1200);
    } catch (e) {
      setChecking(false);
      submitting.current = false;
      setCode('');
      setError(errorMessage(e, 'That code is not right.'));
      shakeNow();
      setTimeout(() => inputRef.current?.focus(), 250);
    }
  };

  const onChangeCode = (v: string) => {
    const clean = v.replace(/[^0-9]/g, "").slice(0, CODE_LENGTH);
    setCode(clean);
    if (clean.length === CODE_LENGTH) submit(clean);
  };

  // Once verified, go to onboarding explicitly (the guard also drops this route).
  useEffect(() => {
    if (!emailVerified) return;
    router.replace("/onboarding");
  }, [emailVerified, router]);

  const resend = () => {
    if (resendIn > 0) return;
    setResendIn(RESEND_SECONDS);
    setCode('');
    setError(null);
    resendCode().catch((e) => setError(errorMessage(e, 'Could not resend the code.')));
    shakeNow();
    inputRef.current?.focus();
  };

  const boxes = Array.from({ length: CODE_LENGTH }, (_, i) => code[i] ?? '');
  const activeIndex = Math.min(code.length, CODE_LENGTH - 1);

  return (
    <Screen style={{ backgroundColor: colors.bgLight }}>
      <View pointerEvents="none" style={[styles.blob, { backgroundColor: colors.primaryLime, width: s(220), height: s(220), borderRadius: s(110), top: -s(90), right: -s(80) }]} />

      <View style={styles.content}>
        <Mascot size={s(110)} float />

        {done ? (
          <Animated.View style={[styles.doneWrap, { opacity: pop, transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) }] }]}>
            <View style={[styles.doneCheck, { backgroundColor: colors.primaryLime }]}>
              <Check size={s(34)} color={colors.primaryDark} strokeWidth={3} />
            </View>
            <Text style={styles.title}>You're in, {profile.firstName}.</Text>
            <Text style={styles.sub}>Account confirmed. Setting up your kitchen…</Text>
          </Animated.View>
        ) : (
          <>
            <View style={[styles.mailBadge, { backgroundColor: colors.primaryDark }]}>
              <MailCheck size={16} color={colors.primaryLime} />
              <Text style={styles.mailText}>Code sent</Text>
            </View>
            <Text style={styles.title}>Check your inbox</Text>
            <Text style={styles.sub}>
              We sent a {CODE_LENGTH}-digit code to{'\n'}
              <Text style={styles.email}>{profile.email}</Text>
            </Text>

            {/* Hidden input drives the six boxes */}
            <Pressable onPress={() => inputRef.current?.focus()} style={{ alignSelf: 'stretch' }}>
              <Animated.View style={[styles.boxes, { transform: [{ translateX: shake.interpolate({ inputRange: [-1, 1], outputRange: [-8, 8] }) }] }]}>
                {boxes.map((d, i) => {
                  const active = i === activeIndex && !checking;
                  return (
                    <View key={i} style={[styles.box, { borderColor: d ? colors.primaryLime : active ? colors.primaryDark : colors.borderGray, backgroundColor: d ? '#F5FBDF' : '#FFFFFF' }]}>
                      <Text style={styles.digit}>{d}</Text>
                      {active && !d && <View style={[styles.caret, { backgroundColor: colors.primaryDark }]} />}
                    </View>
                  );
                })}
              </Animated.View>
            </Pressable>
            <TextInput
              ref={inputRef}
              value={code}
              onChangeText={onChangeCode}
              keyboardType="number-pad"
              textContentType="oneTimeCode"
              autoComplete="one-time-code"
              maxLength={CODE_LENGTH}
              style={styles.hidden}
              caretHidden
            />

            {error && <Text style={styles.error}>{error}</Text>}

            <Button label={checking ? "Checking…" : "Confirm"} onPress={() => submit(code)} loading={checking} disabled={code.length !== CODE_LENGTH} style={{ alignSelf: 'stretch' }} />

            <PressableScale onPress={resend} disabled={resendIn > 0} hitSlop={8}>
              <Text style={[styles.resend, { color: resendIn > 0 ? colors.mutedGray : colors.greenFresh }]}>
                {resendIn > 0 ? `Resend code in ${resendIn}s` : 'Resend code'}
              </Text>
            </PressableScale>
            <PressableScale onPress={logOut} hitSlop={8}>
              <Text style={[styles.resend, { color: colors.mutedGray }]}>Wrong email? Start over</Text>
            </PressableScale>
          </>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  blob: { position: 'absolute' },
  content: { flex: 1, alignItems: 'center', paddingHorizontal: 28, paddingTop: s(40), gap: 12 },
  mailBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, marginTop: 6 },
  mailText: { color: '#FFFFFF', fontSize: fs(12), fontWeight: '700' },
  title: { fontFamily: font.display, fontSize: fs(32), color: colors.primaryDark, textAlign: 'center', marginTop: 4 },
  sub: { color: colors.mutedGray, fontSize: fs(14), lineHeight: fs(20), textAlign: 'center' },
  email: { color: colors.primaryDark, fontWeight: '800' },
  boxes: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 14, marginBottom: 6 },
  box: { width: s(46), height: s(56), borderRadius: 14, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  digit: { fontFamily: font.display, fontSize: fs(26), color: colors.primaryDark },
  caret: { width: 2, height: s(22), borderRadius: 1, opacity: 0.6 },
  hidden: { position: 'absolute', opacity: 0, height: 1, width: 1 },
  resend: { fontSize: fs(13), fontWeight: '700', marginTop: 4 },
  error: { color: colors.alertOrange, fontSize: fs(13), fontWeight: '700', textAlign: 'center' },
  doneWrap: { alignItems: 'center', gap: 10, marginTop: 10 },
  doneCheck: { width: s(84), height: s(84), borderRadius: s(42), alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
});
