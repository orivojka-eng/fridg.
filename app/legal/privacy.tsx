import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useTheme, fs, font } from '../../src/theme';
import { Screen, Header, Card } from '../../src/components/ui';

const UPDATED = '15 September 2026';

const SECTIONS: Array<{ title: string; body: string[] }> = [
  {
    title: 'What FRIDGR collects',
    body: [
      'Account: your email, first and last name, and a password hash (or your Apple / Google account identifier if you sign in that way). Optional: age, an avatar choice and a short bio.',
      'Food Profile: the answers you give about goals, eating style, allergies, dislikes, cuisines and cooking habits. These are used only to personalise recipes and are never used for advertising.',
      'Your kitchen: fridge items, shopping lists, saved and cooked recipes, ratings and the links you import.',
      'Photos: a picture of your fridge is uploaded only when you tap Scan, is processed to recognise food, and is automatically deleted within 24 hours. Photos are never used to train AI models.',
      'Behaviour signals: which recipes you view, save, cook or skip, so recommendations improve over time. Signals older than 180 days are deleted.',
      'Purchases: your subscription status from the App Store or Google Play via RevenueCat. FRIDGR never sees your card details.',
    ],
  },
  {
    title: 'How it is used',
    body: [
      'To run the app: log you in, keep your fridge and lists in sync between devices, send the expiry reminders you turn on.',
      'To personalise: recipe generation, adaptation and the Discover feed are shaped by your Food Profile. Allergies are treated as hard rules.',
      'To improve FRIDGR: aggregate, anonymous usage counts. No food or health-related data is included in analytics or crash reports.',
      'We do not sell personal data, and we do not use dietary or health-related information for advertising or any unrelated profiling.',
    ],
  },
  {
    title: 'Who processes it',
    body: [
      'Neon (database hosting, EU region), Anthropic (AI recipe generation and food recognition; requests contain your fridge items and dietary rules but not your name or email), Cloudflare (temporary photo storage), Resend (email codes), Expo (push notifications), RevenueCat and Apple / Google (subscriptions).',
      'Each processor only receives the data needed for its task and is bound by a data processing agreement.',
    ],
  },
  {
    title: 'Your choices',
    body: [
      'Edit your Food Profile any time from Profile → Preferences.',
      'Export everything we hold about you: Profile → Privacy & data → Export my data.',
      'Delete your account from inside the app: Profile → Delete account. Deletion is immediate and permanent, includes revoking Sign in with Apple, and removes every record tied to you.',
      'Turn notifications off in Preferences or your phone settings.',
    ],
  },
  {
    title: 'Retention and security',
    body: [
      'Data is kept for as long as your account exists. Scan photos: 24 hours. Behaviour signals: 180 days. Diagnostic logs: 90 days.',
      'All traffic is encrypted in transit; passwords are hashed with Argon2; tokens live in your device keychain; secrets never ship inside the app.',
      'FRIDGR is not intended for children under 13.',
    ],
  },
  {
    title: 'Contact',
    body: ['privacy@fridgr.app — we answer data requests within 30 days.', 'FRIDGR is operated from the European Union; you have the rights set out in the GDPR, including access, correction, erasure, portability and the right to complain to your supervisory authority.'],
  },
];

export default function PrivacyScreen() {
  const t = useTheme();
  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Header title="Privacy" />
        <Text style={[styles.updated, { color: t.textMuted }]}>Last updated {UPDATED}</Text>
        <Text style={[styles.lead, { color: t.textStrong }]}>FRIDGR stores what it needs to cook with you, and nothing it does not. Here is the whole list.</Text>
        {SECTIONS.map((s) => (
          <Card key={s.title} style={{ gap: 8, padding: 18 }}>
            <Text style={[styles.h, { color: t.textStrong }]}>{s.title}</Text>
            {s.body.map((p, i) => (
              <Text key={i} style={[styles.p, { color: t.text }]}>
                {p}
              </Text>
            ))}
          </Card>
        ))}
        <View style={{ height: 30 }} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 20, gap: 12 },
  updated: { fontSize: fs(12), fontWeight: '600' },
  lead: { fontFamily: font.display, fontSize: fs(22), lineHeight: fs(28), marginBottom: 4 },
  h: { fontSize: fs(16), fontWeight: '800' },
  p: { fontSize: fs(14), lineHeight: fs(21) },
});
