import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, Alert, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { ShieldAlert, Download } from '../../src/components/ui/lucide';
import { useUserStore } from '../../src/store/useUserStore';
import { useTheme, fs, font, colors } from '../../src/theme';
import { Screen, Header, Card, Button } from '../../src/components/ui';
import { env } from '../../src/config/env';
import { api, errorMessage } from '../../src/api/client';
import { startFreshAccount } from '../../src/lib/session';

/**
 * In-app account deletion (App Store guideline 5.1.1(v)). The server revokes
 * Sign in with Apple, ends every session and hard-deletes all personal data.
 */
export default function DeleteAccountScreen() {
  const router = useRouter();
  const t = useTheme();
  const { profile, deleteAccount } = useUserStore();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ready = confirm.trim().toUpperCase() === 'DELETE';

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      await deleteAccount(password || undefined);
      startFreshAccount();
      Alert.alert('Account deleted', 'Everything tied to your account has been removed. Thanks for cooking with us.');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const ask = () =>
    Alert.alert('Delete your account?', 'This is permanent. Your fridge, recipes, saved items and subscription link will be removed immediately.', [
      { text: 'Keep my account', style: 'cancel' },
      { text: 'Delete forever', style: 'destructive', onPress: run },
    ]);

  const [exporting, setExporting] = useState(false);
  const exportData = async () => {
    if (!env.USE_BACKEND) {
      Alert.alert('Export my data', 'Data export is available once your account is connected to the FRIDGR service.');
      return;
    }
    if (exporting) return;
    setExporting(true);
    try {
      const { sentTo } = await api.post<{ ok: true; sentTo: string }>('/account/export/email');
      Alert.alert('Export sent', `A JSON file with everything we hold about you was emailed to ${sentTo}.`);
    } catch (e) {
      Alert.alert('Export not sent', errorMessage(e, 'We could not send the export. Try again in a minute.'));
    } finally {
      setExporting(false);
    }
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Header title="Delete account" />

        <Card style={{ gap: 10, padding: 18 }}>
          <View style={styles.row}>
            <ShieldAlert size={20} color={colors.alertOrange} />
            <Text style={[styles.h, { color: t.textStrong }]}>What happens</Text>
          </View>
          {[
            'Your profile, Food Profile, fridge, shopping lists, saved and created recipes, ratings and comments are deleted.',
            'Sign in with Apple access is revoked at Apple; email codes and sessions are invalidated on every device.',
            'An active subscription keeps running in the App Store until you cancel it there. We will unlink it from FRIDGR.',
            'This cannot be undone.',
          ].map((p) => (
            <Text key={p} style={[styles.p, { color: t.text }]}>
              • {p}
            </Text>
          ))}
        </Card>

        <Card style={{ gap: 10, padding: 18 }}>
          <Text style={[styles.h, { color: t.textStrong }]}>Take a copy first?</Text>
          <Text style={[styles.p, { color: t.textMuted }]}>Download everything we hold about you as a JSON file.</Text>
          <Button label="Export my data" variant="outline" onPress={exportData} left={<Download size={16} color={t.textStrong} />} />
        </Card>

        <Card style={{ gap: 10, padding: 18 }}>
          <Text style={[styles.h, { color: t.textStrong }]}>Confirm</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="Password (leave empty for Apple / Google accounts)"
            placeholderTextColor={t.textMuted}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            importantForAutofill="no"
            textContentType={Platform.OS === 'ios' ? 'password' : undefined}
            style={[styles.input, { color: t.textStrong, backgroundColor: t.cardAlt }]}
          />
          <TextInput
            value={confirm}
            onChangeText={setConfirm}
            placeholder='Type DELETE to confirm'
            placeholderTextColor={t.textMuted}
            autoCapitalize="characters"
            autoCorrect={false}
            style={[styles.input, { color: t.textStrong, backgroundColor: t.cardAlt }]}
          />
          {error && <Text style={styles.error}>{error}</Text>}
          <Button label={busy ? 'Deleting…' : 'Delete my account'} variant="dark" onPress={ask} disabled={!ready} loading={busy} />
          <Button label="Keep my account" variant="outline" onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/profile'))} />
        </Card>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 20, gap: 12, paddingBottom: 40 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  h: { fontFamily: font.display, fontSize: fs(20) },
  p: { fontSize: fs(14), lineHeight: fs(21) },
  input: { borderRadius: 14, height: 48, paddingHorizontal: 14, fontSize: fs(14), fontWeight: '600' },
  error: { color: colors.alertOrange, fontSize: fs(13), fontWeight: '700' },
});
