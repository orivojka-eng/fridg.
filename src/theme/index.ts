import { Platform } from 'react-native';
import { useUserStore } from '../store/useUserStore';
import { colors } from './colors';
import { s, ms } from './responsive';

/**
 * FRIDGR design tokens.
 *
 * `light` is the official palette from the design folder. `dark` re-maps the
 * same roles so every screen can honour the theme toggle in Profile without
 * hard-coding hex values.
 */
export interface Theme {
  isDark: boolean;
  bg: string;
  card: string;
  cardAlt: string;
  border: string;
  text: string;
  textStrong: string;
  textMuted: string;
  textSoft: string;
  lime: string;
  onLime: string;
  dark: string;
  onDark: string;
  darkCard: string;
  black: string;
  cream: string;
  sage: string;
  blush: string;
  peach: string;
  peachBorder: string;
  orange: string;
  green: string;
  red: string;
  pillActiveBg: string;
  pillActiveText: string;
  iconBtnBg: string;
  shadow: string;
  /** Glass surface tokens (button system). */
  glassBg: string;
  glassBorder: string;
  glassHighlight: string;
}

export const light: Theme = {
  isDark: false,
  bg: colors.bgLight,
  card: colors.cardLight,
  cardAlt: colors.bgLight,
  border: colors.borderGray,
  text: colors.textDark,
  textStrong: colors.primaryDark,
  textMuted: colors.mutedGray,
  textSoft: '#555555',
  lime: colors.primaryLime,
  onLime: colors.primaryDark,
  dark: colors.primaryDark,
  onDark: colors.textLight,
  darkCard: colors.cardDark,
  black: colors.black,
  cream: colors.warmCream,
  sage: colors.softSage,
  blush: colors.softBlush,
  peach: colors.alertPeach,
  peachBorder: '#FDBA74',
  orange: colors.alertOrange,
  green: colors.greenFresh,
  red: '#E11D48',
  pillActiveBg: colors.primaryDark,
  pillActiveText: colors.textLight,
  iconBtnBg: colors.cardLight,
  shadow: '#000000',
  glassBg: 'rgba(255,255,255,0.72)',
  glassBorder: 'rgba(255,255,255,0.9)',
  glassHighlight: 'rgba(255,255,255,0.55)',
};

export const dark: Theme = {
  isDark: true,
  bg: colors.black,
  card: colors.primaryDark,
  cardAlt: colors.cardDark,
  border: 'rgba(255,255,255,0.08)',
  text: colors.textLight,
  textStrong: colors.textLight,
  textMuted: colors.mutedGray,
  textSoft: '#B5B8B0',
  lime: colors.primaryLime,
  onLime: colors.primaryDark,
  dark: colors.primaryDark,
  onDark: colors.textLight,
  darkCard: colors.cardDark,
  black: colors.black,
  cream: '#2A2620',
  sage: '#20281B',
  blush: '#2A2222',
  peach: '#2E2416',
  peachBorder: '#7C4A12',
  orange: '#F59E0B',
  green: '#4ADE80',
  red: '#FB7185',
  pillActiveBg: colors.primaryLime,
  pillActiveText: colors.primaryDark,
  iconBtnBg: colors.primaryDark,
  shadow: '#000000',
  glassBg: 'rgba(37,40,32,0.72)',
  glassBorder: 'rgba(255,255,255,0.14)',
  glassHighlight: 'rgba(255,255,255,0.10)',
};

export const radius = {
  pill: 999,
  card: s(24),
  cardSm: s(18),
  input: s(16),
  chip: s(20),
};

export const spacing = {
  page: ms(20),
  gap: ms(16),
  gapSm: ms(10),
  tabBarClearance: s(110),
};

/**
 * Typography. Galdeano (design folder → "font of the letters") is loaded in
 * the root layout and used for display text: screen titles, hero copy, big
 * numbers, button labels. Body copy stays on the system font for legibility.
 */
export const font = {
  display: 'Galdeano',
  body: Platform.select({ ios: 'System', android: 'sans-serif', default: undefined }),
};

/** Motion tokens shared by screens, buttons and the stack navigator. */
export const motion = {
  fast: 140,
  base: 240,
  slow: 360,
  pressScale: 0.965,
};

/** Returns the active palette based on the user's theme preference. */
export function useTheme(): Theme {
  const theme = useUserStore((s) => s.theme);
  return theme === 'dark' ? dark : light;
}

export { colors };
export * from './responsive';
