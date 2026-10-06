import React from 'react';
import { View, Text, StyleSheet, ScrollView, Linking } from 'react-native';
import { useTheme, fs, font } from '../../src/theme';
import { Screen, Header, Card, Button } from '../../src/components/ui';
import { LEGAL } from '../../src/config/legal';

const SECTIONS: Array<{ title: string; body: string[] }> = [
  {
    title: 'The agreement',
    body: [
      `These Terms of Use are an agreement between you and ${LEGAL.company} ("FRIDGR", "we"). By creating an account or using the app you accept them. Where they are silent, Apple's standard End User License Agreement applies to the iOS version and is linked below.`,
      'You must be at least 13 years old (16 in some EU countries) to use FRIDGR.',
    ],
  },
  {
    title: 'What FRIDGR is',
    body: [
      'FRIDGR suggests recipes from the food you tell us you have, recognises food in photos, imports recipes from links or pasted text, and keeps shopping lists and a Food Profile for personalisation.',
      'Recipes, nutrition values, expiry estimates and swaps are generated or estimated by software and can be wrong. They are not medical, dietary or allergy advice. Always check ingredients and packaging yourself, especially with allergies.',
    ],
  },
  {
    title: 'Your account',
    body: [
      'Keep your login private and tell us if you think it has been misused. You are responsible for what happens under your account.',
      'You can delete your account at any time from Profile → Delete account. Deletion is immediate and permanent.',
    ],
  },
  {
    title: 'FRIDGR Premium',
    body: [
      `Premium is an auto-renewable subscription bought through the App Store or Google Play: ${LEGAL.priceMonthly} per month or ${LEGAL.priceYearly} per year, with a ${LEGAL.trialDays}-day free trial for new subscribers.`,
      'Payment is charged to your store account at confirmation of purchase. The subscription renews automatically unless you cancel at least 24 hours before the end of the current period, and your account is charged for renewal within 24 hours before the period ends. Any unused part of a free trial is forfeited when you buy a subscription.',
      'Manage or cancel in your device Settings → Subscriptions (iOS) or Play Store → Subscriptions (Android). Refunds are handled by Apple or Google under their policies. Use "Restore purchases" on the Premium page to recover a subscription on a new device.',
    ],
  },
  {
    title: 'Your content',
    body: [
      'Recipes, photos, comments and imports you add stay yours. You give FRIDGR a licence to store, display and process them so the app works, and, for recipes you choose to publish, to show them to other users with your name.',
      'Do not upload content you have no right to share, and do not use imports to copy someone else\'s protected work. Imported recipes are private to you unless you publish your own adaptation with attribution.',
      'We may remove content that is illegal, abusive, misleading, or that breaks these terms, and suspend accounts that repeatedly do so. You can report content from any recipe page or through Support.',
    ],
  },
  {
    title: 'Acceptable use',
    body: ['No scraping, reverse engineering, automated access, or attempts to bypass limits or security. No harassment or impersonation. No use of FRIDGR for anything illegal.'],
  },
  {
    title: 'Liability',
    body: [
      'FRIDGR is provided "as is". To the extent the law allows, we are not liable for indirect losses, or for outcomes of cooking or eating based on suggestions in the app. Nothing in these terms limits rights you have as a consumer under the law of your country.',
    ],
  },
  {
    title: 'Changes and contact',
    body: [`We may update these terms; material changes are announced in the app before they take effect. Questions: ${LEGAL.supportEmail}.`, `Governing law: ${LEGAL.jurisdiction}.`],
  },
];

export default function TermsScreen() {
  const t = useTheme();
  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Header title="Terms of Use" />
        <Text style={[styles.updated, { color: t.textMuted }]}>Last updated {LEGAL.updated}</Text>
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
        <Button label="Apple standard EULA" variant="outline" onPress={() => Linking.openURL(LEGAL.appleEulaUrl)} />
        <Button label="Read online" variant="outline" onPress={() => Linking.openURL(LEGAL.termsUrl)} />
        <View style={{ height: 30 }} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 20, gap: 12 },
  updated: { fontSize: fs(12), fontWeight: '600' },
  h: { fontSize: fs(16), fontWeight: '800' },
  p: { fontSize: fs(14), lineHeight: fs(21) },
});
