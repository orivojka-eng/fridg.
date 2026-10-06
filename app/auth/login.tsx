import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, ScrollView, KeyboardAvoidingView, Platform, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft, Eye, EyeOff } from '../../src/components/ui/lucide';
import { useUserStore } from '../../src/store/useUserStore';
import { font, fs, s, colors } from '../../src/theme';
import { Screen, Button, IconButton, PressableScale } from '../../src/components/ui';
import { Mascot } from '../../src/components/Mascot';
import { errorMessage } from '../../src/api/client';
import { authApi } from '../../src/api/auth';
import { env } from '../../src/config/env';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default function LogInScreen() {
  const router = useRouter();
  const logIn = useUserStore((u) => u.logIn);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!EMAIL_RE.test(email.trim())) return setError('Enter the email you signed up with.');
    if (password.length < 6) return setError('Password needs at least 6 characters.');
    if (busy) return;
    setBusy(true);
    try {
      // With the backend off any valid pair logs in and shows the welcome-back screen.
      await logIn(email, password);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const forgot = async () => {
    const address = email.trim();
    if (!EMAIL_RE.test(address)) return setError('Enter your email first, then tap "Forgot password".');
    if (!env.USE_BACKEND) return Alert.alert('Reset password', `We'll email a reset link to ${address} once accounts are connected.`);
    try {
      await authApi.forgotPassword(address);
      Alert.alert('Check your inbox', `If ${address} has an account, a reset link is on its way.`);
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  return (
    <Screen style={{ backgroundColor: colors.bgLight }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View pointerEvents="none" style={[styles.blob, { backgroundColor: colors.primaryLime, width: s(200), height: s(200), borderRadius: s(100), top: -s(80), right: -s(70) }]} />
          <View style={styles.topBar}>
            <IconButton onPress={() => (router.canGoBack() ? router.back() : router.replace('/auth/welcome'))}>
              <ChevronLeft size={20} color={colors.primaryDark} />
            </IconButton>
          </View>

          <View style={styles.hero}>
            <Mascot size={s(110)} float />
          </View>
          <Text style={styles.title}>Good to see you</Text>
          <Text style={styles.sub}>Log in to pick up where you left off.</Text>

          <View style={styles.form}>
            <TextInput
              value={email}
              onChangeText={(v) => { setEmail(v); setError(null); }}
              placeholder="Email"
              placeholderTextColor={colors.mutedGray}
              style={styles.input}
              autoCapitalize="none"
              keyboardType="email-address"
              textContentType="emailAddress"
              autoCorrect={false}
            />
            <View>
              <TextInput
                value={password}
                onChangeText={(v) => { setPassword(v); setError(null); }}
                placeholder="Password"
                placeholderTextColor={colors.mutedGray}
                style={styles.input}
                secureTextEntry={!showPw}
                autoCapitalize="none"
                autoCorrect={false}
                spellCheck={false}
                autoComplete="off"
                importantForAutofill="no"
                textContentType={Platform.OS === 'ios' ? 'password' : undefined}
                keyboardType={showPw && Platform.OS === 'android' ? 'visible-password' : 'default'}
                returnKeyType="go"
                blurOnSubmit
                onSubmitEditing={submit}
              />
              <TouchableOpacity style={styles.eye} onPress={() => setShowPw((v) => !v)} hitSlop={8}>
                {showPw ? <EyeOff size={18} color={colors.mutedGray} /> : <Eye size={18} color={colors.mutedGray} />}
              </TouchableOpacity>
            </View>
            {error && <Text style={styles.error}>{error}</Text>}

            <TouchableOpacity onPress={forgot} hitSlop={8} style={{ alignSelf: 'flex-end' }}>
              <Text style={styles.forgot}>Forgot password?</Text>
            </TouchableOpacity>

            <Button label={busy ? 'Signing in…' : 'Log in'} onPress={submit} loading={busy} />

            <PressableScale onPress={() => router.replace('/auth/signup')} style={styles.footer} hitSlop={8}>
              <Text style={styles.footerText}>
                New here? <Text style={styles.footerLink}>Create an account</Text>
              </Text>
            </PressableScale>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 24, paddingBottom: 30 },
  blob: { position: 'absolute' },
  topBar: { paddingTop: 8 },
  hero: { alignItems: 'center', marginTop: 10 },
  title: { fontFamily: font.display, fontSize: fs(32), color: colors.primaryDark, textAlign: 'center', marginTop: 14 },
  sub: { color: colors.mutedGray, fontSize: fs(14), textAlign: 'center', marginTop: 4, marginBottom: 20 },
  form: { gap: 10 },
  input: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.borderGray, borderRadius: 16, height: s(50), paddingHorizontal: 16, fontSize: fs(15), color: colors.primaryDark, fontWeight: '600' },
  eye: { position: 'absolute', right: 14, top: 0, height: s(50), justifyContent: 'center' },
  error: { color: colors.alertOrange, fontSize: fs(13), fontWeight: '700', paddingHorizontal: 4 },
  forgot: { color: colors.greenFresh, fontSize: fs(13), fontWeight: '700' },
  footer: { alignItems: 'center', marginTop: 8 },
  footerText: { color: colors.mutedGray, fontSize: fs(13) },
  footerLink: { color: colors.primaryDark, fontWeight: '800' },
});
