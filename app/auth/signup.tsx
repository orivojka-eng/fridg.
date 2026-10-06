import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, ScrollView, KeyboardAvoidingView, Platform, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft, Eye, EyeOff } from '../../src/components/ui/lucide';
import { useUserStore } from '../../src/store/useUserStore';
import { font, fs, s, colors } from '../../src/theme';
import { Screen, Button, IconButton, PressableScale } from '../../src/components/ui';
import { Mascot } from "../../src/components/Mascot";
import { startFreshAccount } from "../../src/lib/session";
import { errorMessage } from '../../src/api/client';
import { isCancelled, socialSignIn } from '../../src/lib/socialAuth';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default function SignUpScreen() {
  const router = useRouter();
  const signUp = useUserStore((u) => u.signUp);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validate = () => {
    if (firstName.trim().length < 2) return 'Tell us your first name.';
    if (lastName.trim().length < 2) return 'And your surname.';
    if (!EMAIL_RE.test(email.trim())) return 'That email doesn\'t look right.';
    if (password.length < 6) return 'Password needs at least 6 characters.';
    return null;
  };

  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    if (busy) return;
    setBusy(true);
    try {
      // Signing up flips the auth guard; the router then lands on the email check.
      startFreshAccount();
      await signUp({ firstName, lastName, email, password });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const social = (provider: 'Google' | 'Apple') => {
    if (busy) return;
    setBusy(true);
    startFreshAccount();
    socialSignIn(provider)
      .catch((e) => {
        if (!isCancelled(e)) setError(errorMessage(e, `${provider} sign-in did not complete.`));
      })
      .finally(() => setBusy(false));
  };

  const field = (value: string, set: (v: string) => void, placeholder: string, extra: object = {}) => (
    <TextInput
      value={value}
      onChangeText={(v) => { set(v); setError(null); }}
      placeholder={placeholder}
      placeholderTextColor="rgba(20,24,15,0.45)"
      style={styles.input}
      {...extra}
    />
  );

  return (
    <Screen style={{ backgroundColor: colors.primaryLime }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.topBar}>
            <IconButton onPress={() => (router.canGoBack() ? router.back() : router.replace('/auth/welcome'))}>
              <ChevronLeft size={20} color={colors.primaryDark} />
            </IconButton>
          </View>

          <View style={styles.hero}>
            <Mascot size={s(120)} float />
          </View>

          <Text style={styles.title}>Ready to cook?</Text>

          <View style={styles.form}>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>{field(firstName, setFirstName, 'First name', { autoCapitalize: 'words', textContentType: 'givenName' })}</View>
              <View style={{ flex: 1 }}>{field(lastName, setLastName, 'Surname', { autoCapitalize: 'words', textContentType: 'familyName' })}</View>
            </View>
            {field(email, setEmail, 'Email', { autoCapitalize: 'none', keyboardType: 'email-address', textContentType: 'emailAddress', autoCorrect: false })}
            <View>
              {/*
               * Android: keep the password manager / autofill overlays out of
               * this field (they fight the keyboard on Samsung keyboards) and
               * switch to the visible-password keyboard when revealed so
               * toggling doesn't reset or duplicate what was typed.
               */}
              {field(password, setPassword, 'Password', {
                secureTextEntry: !showPw,
                autoCapitalize: 'none',
                autoCorrect: false,
                spellCheck: false,
                autoComplete: 'off',
                importantForAutofill: 'no',
                textContentType: Platform.OS === 'ios' ? 'oneTimeCode' : undefined,
                keyboardType: showPw && Platform.OS === 'android' ? 'visible-password' : 'default',
                onSubmitEditing: submit,
                returnKeyType: 'go',
                blurOnSubmit: true,
              })}
              <TouchableOpacity style={styles.eye} onPress={() => setShowPw((v) => !v)} hitSlop={8}>
                {showPw ? <EyeOff size={18} color="rgba(20,24,15,0.55)" /> : <Eye size={18} color="rgba(20,24,15,0.55)" />}
              </TouchableOpacity>
            </View>
            {error && <Text style={styles.error}>{error}</Text>}

            <View style={styles.socialRow}>
              <PressableScale style={{ flex: 1 }} onPress={() => social('Google')}>
                <View style={styles.social}>
                  <Text style={styles.socialG}>G</Text>
                  <Text style={styles.socialText}>Google</Text>
                </View>
              </PressableScale>
              <PressableScale style={{ flex: 1 }} onPress={() => social('Apple')}>
                <View style={styles.social}>
                  <Text style={styles.socialG}></Text>
                  <Text style={styles.socialText}>Apple</Text>
                </View>
              </PressableScale>
            </View>

            <Button label={busy ? 'Creating your account…' : "Let's cook!"} variant="dark" onPress={submit} loading={busy} />
            <TouchableOpacity style={styles.footer} onPress={() => router.replace('/auth/login')} hitSlop={8}>
              <Text style={styles.footerText}>
                Already have an account? <Text style={styles.footerLink}>Sign in</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 24, paddingBottom: 30 },
  topBar: { paddingTop: 8 },
  hero: { alignItems: 'center', marginTop: 6 },
  title: { fontFamily: font.display, fontSize: fs(32), color: colors.primaryDark, textAlign: 'center', marginTop: 14, marginBottom: 18 },
  form: { gap: 10 },
  row: { flexDirection: 'row', gap: 10 },
  input: { backgroundColor: 'rgba(20,24,15,0.10)', borderRadius: 16, height: s(50), paddingHorizontal: 16, fontSize: fs(15), color: colors.primaryDark, fontWeight: '600' },
  eye: { position: 'absolute', right: 14, top: 0, height: s(50), justifyContent: 'center' },
  error: { color: '#7C2D12', fontSize: fs(13), fontWeight: '700', paddingHorizontal: 4 },
  socialRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  social: { height: s(46), borderRadius: 14, backgroundColor: colors.primaryDark, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  socialG: { color: '#FFFFFF', fontWeight: '800', fontSize: fs(15) },
  socialText: { color: '#FFFFFF', fontWeight: '700', fontSize: fs(14) },
  footer: { alignItems: 'center', marginTop: 6 },
  footerText: { color: 'rgba(20,24,15,0.7)', fontSize: fs(13) },
  footerLink: { color: colors.primaryDark, fontWeight: '800' },
});
