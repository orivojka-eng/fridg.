/**
 * Legal and support constants shown in-app.
 * The public website (privacy, terms, support pages) comes from
 * EXPO_PUBLIC_WEBSITE_URL; the contact address from EXPO_PUBLIC_SUPPORT_EMAIL.
 * Fill the owner details before submission.
 */
const site = (process.env.EXPO_PUBLIC_WEBSITE_URL || 'https://fridgr.app').replace(/\/+$/, '');
const supportEmail = process.env.EXPO_PUBLIC_SUPPORT_EMAIL || 'support@fridgr.app';

export const LEGAL = {
  appName: 'FRIDGR',
  company: process.env.EXPO_PUBLIC_LEGAL_OWNER || 'FRIDGR (owner name to be filled)',
  jurisdiction: 'the courts of your country of residence within the EU',
  updated: '6 October 2026',
  supportEmail,
  privacyEmail: supportEmail,
  website: site,
  privacyUrl: `${site}/legal/privacy`,
  termsUrl: `${site}/legal/terms`,
  supportUrl: `${site}/legal/support`,
  appleEulaUrl: 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/',
  priceMonthly: '€6.99',
  priceYearly: '€42.00',
  trialDays: 7,
} as const;
