import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, Linking, Platform, Alert, KeyboardAvoidingView } from 'react-native';
import Constants from 'expo-constants';
import { Mail, Bug, MessageCircle, HelpCircle, ChevronRight } from '../src/components/ui/lucide';
import { useTheme, fs, font, colors } from '../src/theme';
import { Screen, Header, Card, Button, Pill, PressableScale } from '../src/components/ui';
import { useUserStore } from '../src/store/useUserStore';
import { LEGAL } from '../src/config/legal';
import { env } from '../src/config/env';
import { api, errorMessage } from '../src/api/client';

type Topic = 'bug' | 'question' | 'feedback' | 'account' | 'billing';
const TOPICS: Array<{ id: Topic; label: string }> = [
  { id: 'bug', label: 'Report a bug' },
  { id: 'question', label: 'Question' },
  { id: 'feedback', label: 'Feedback' },
  { id: 'account', label: 'Account' },
  { id: 'billing', label: 'Billing' },
];

const FAQ: Array<{ q: string; a: string }> = [
  { q: 'The scan did not recognise something', a: 'Tap the item chip to deselect it, or add it by hand. Every scan is a suggestion until you confirm it.' },
  { q: 'I have an allergy — is it safe?', a: 'Allergies from your Food Profile are hard rules for generated recipes, but always check packaging yourself. Imported recipes show a warning when they contain one of your allergens.' },
  { q: 'How do I cancel Premium?', a: 'Settings → Subscriptions on iPhone, or Play Store → Subscriptions on Android. Premium stays active until the end of the paid period.' },
  { q: 'How do I delete my account?', a: 'Profile → Delete account. It removes everything immediately, including Sign in with Apple access.' },
];

/**
 * Support & contact (App Store guideline: a visible way to reach you).
 * Sends a ticket to the API when connected; otherwise opens the mail app
 * with the message pre-filled so nobody is ever stuck.
 */
export default function SupportScreen() {
  const t = useTheme();
  const { profile } = useUserStore();
  const [topic, setTopic] = useState<Topic>('question');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState(profile.email ?? '');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [open, setOpen] = useState<number | null>(null);

  const version = Constants.expoConfig?.version ?? '1.0.0';
  const meta = `${LEGAL.appName} ${version} · ${Platform.OS} ${Platform.Version}`;

  const mailFallback = () => {
    const subject = encodeURIComponent(`[${topic}] FRIDGR support`);
    const body = encodeURIComponent(`${message}\n\n—\n${meta}\nAccount: ${email}`);
    Linking.openURL(`mailto:${LEGAL.supportEmail}?subject=${subject}&body=${body}`).catch(() => Alert.alert('Email', `Write to ${LEGAL.supportEmail}`));
  };

  const send = async () => {
    if (message.trim().length < 10) return Alert.alert('A bit more detail', 'Tell us what happened in a sentence or two.');
    if (!env.USE_BACKEND) return mailFallback();
    setBusy(true);
    try {
      await api.post('/support/tickets', { topic, message: message.trim(), email: email.trim() || undefined, appVersion: version, platform: Platform.OS, osVersion: String(Platform.Version) });
      setSent(true);
    } catch (e) {
      Alert.alert('Could not send', `${errorMessage(e)} You can also email ${LEGAL.supportEmail}.`, [{ text: 'Open email', onPress: mailFallback }, { text: 'OK' }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Header title="Support" />

          <Card style={{ gap: 12, padding: 18 }}>
            <View style={styles.row}>
              <MessageCircle size={20} color={t.textStrong} />
              <Text style={[styles.h, { color: t.textStrong }]}>Contact us</Text>
            </View>
            {sent ? (
              <Text style={[styles.p, { color: t.text }]}>Thanks — your message is in. We reply to {email || 'your account email'} within two working days.</Text>
            ) : (
              <>
                <View style={styles.topics}>
                  {TOPICS.map((o) => (
                    <Pill key={o.id} small label={o.label} selected={topic === o.id} variant="lime" onPress={() => setTopic(o.id)} />
                  ))}
                </View>
                <TextInput
                  value={message}
                  onChangeText={setMessage}
                  placeholder={topic === 'bug' ? 'What did you do, what happened, what did you expect?' : 'How can we help?'}
                  placeholderTextColor={t.textMuted}
                  multiline
                  style={[styles.textarea, { color: t.textStrong, backgroundColor: t.cardAlt }]}
                />
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="Email for our reply"
                  placeholderTextColor={t.textMuted}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  style={[styles.input, { color: t.textStrong, backgroundColor: t.cardAlt }]}
                />
                <Text style={[styles.meta, { color: t.textMuted }]}>Included automatically: {meta}</Text>
                <Button label={busy ? 'Sending…' : 'Send message'} onPress={send} loading={busy} left={<Mail size={16} color={t.onLime} />} />
              </>
            )}
          </Card>

          <Card style={{ gap: 4, padding: 18 }}>
            <View style={[styles.row, { marginBottom: 6 }]}>
              <HelpCircle size={20} color={t.textStrong} />
              <Text style={[styles.h, { color: t.textStrong }]}>Quick answers</Text>
            </View>
            {FAQ.map((f, i) => (
              <PressableScale key={f.q} onPress={() => setOpen(open === i ? null : i)} scaleTo={0.99}>
                <View style={[styles.faqRow, i < FAQ.length - 1 && { borderBottomWidth: 1, borderBottomColor: t.border }]}>
                  <View style={styles.faqHead}>
                    <Text style={[styles.faqQ, { color: t.textStrong }]}>{f.q}</Text>
                    <ChevronRight size={16} color={t.textMuted} style={{ transform: [{ rotate: open === i ? '90deg' : '0deg' }] }} />
                  </View>
                  {open === i && <Text style={[styles.p, { color: t.text, marginTop: 6 }]}>{f.a}</Text>}
                </View>
              </PressableScale>
            ))}
          </Card>

          <Card style={{ gap: 10, padding: 18 }}>
            <View style={styles.row}>
              <Bug size={20} color={t.textStrong} />
              <Text style={[styles.h, { color: t.textStrong }]}>Other ways</Text>
            </View>
            <Button label={LEGAL.supportEmail} variant="outline" onPress={() => Linking.openURL(`mailto:${LEGAL.supportEmail}`)} />
            <Button label="Help centre online" variant="outline" onPress={() => Linking.openURL(LEGAL.supportUrl)} />
          </Card>
          <View style={{ height: 30 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 20, gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  h: { fontFamily: font.display, fontSize: fs(20) },
  p: { fontSize: fs(14), lineHeight: fs(21) },
  topics: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  textarea: { borderRadius: 16, minHeight: 110, padding: 14, fontSize: fs(14), fontWeight: '500', textAlignVertical: 'top' },
  input: { borderRadius: 14, height: 48, paddingHorizontal: 14, fontSize: fs(14), fontWeight: '600' },
  meta: { fontSize: fs(11) },
  faqRow: { paddingVertical: 12 },
  faqHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  faqQ: { fontSize: fs(14), fontWeight: '700', flex: 1 },
  error: { color: colors.alertOrange },
});
