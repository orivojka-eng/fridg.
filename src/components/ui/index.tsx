import React, { useCallback, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
  StyleProp,
  ActivityIndicator,
  Animated,
  Easing,
} from 'react-native';
import { useSafeAreaInsets, Edge } from 'react-native-safe-area-context';
import { ChevronLeft, X, Leaf, SearchX, Bookmark, Refrigerator, UtensilsCrossed, CookingPot, Soup, ShoppingBasket, Folder, FolderOpen, BellRing, LucideIcon } from './lucide';
import { useRouter, useFocusEffect } from "expo-router";
import { useTheme, radius, spacing, fs, s, ms, font, motion } from "../../theme";
import { useUserStore } from "../../store/useUserStore";
import { PressableScale, GlassSurface } from './Glass';

export { PressableScale, GlassSurface } from './Glass';
export { Avatar, AVATARS, avatarIndexFor } from './Avatar';
export { FoodIcon, FoodTile, iconFor } from './FoodIcon';

/* ----------------------------------------------------------------------------
 * Screen — safe area + themed background + a soft fade/slide on mount so
 * pushes feel continuous with the stack transition.
 * ------------------------------------------------------------------------- */
interface ScreenProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Force the dark surface (cooking mode, scanner, premium). */
  dark?: boolean;
  edges?: Edge[];
  animated?: boolean;
  /** Tab screens: soft fade each time the tab gains focus (the navigator itself does a hard switch). */
  fadeOnFocus?: boolean;
}

export const Screen: React.FC<ScreenProps> = ({ children, style, dark, edges = ["top"], animated = true, fadeOnFocus = false }) => {
  const t = useTheme();
  const bootDone = useUserStore((u) => u.bootDone);
  const progress = useRef(new Animated.Value(animated ? 0 : 1)).current;
  useEffect(() => {
    if (!animated || !bootDone) return;
    // The first screen rises in as the splash dissolves; later screens use the stack transition plus this short settle.
    Animated.timing(progress, { toValue: 1, duration: bootDone ? motion.slow * 2 : motion.base, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [animated, bootDone, progress]);

  useFocusEffect(
    useCallback(() => {
      if (!fadeOnFocus || !bootDone) return;
      progress.setValue(0.7);
      Animated.timing(progress, { toValue: 1, duration: 220, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
    }, [fadeOnFocus, bootDone, progress]),
  );

  // Insets are applied as padding from the hook rather than through
  // SafeAreaView: inside fullScreenModal routes on iOS the view-based
  // variant can measure 0 on first layout and leave the header under the
  // status bar. The hook always reflects the provider's real insets.
  const insets = useSafeAreaInsets();
  const pad = {
    paddingTop: edges.includes('top') ? Math.max(insets.top, 12) : 0,
    paddingBottom: edges.includes('bottom') ? Math.max(insets.bottom, 12) : 0,
    paddingLeft: edges.includes('left') ? insets.left : 0,
    paddingRight: edges.includes('right') ? insets.right : 0,
  };
  return (
    <View style={[{ flex: 1, backgroundColor: dark ? t.black : t.bg }, pad, style]}>
      <Animated.View style={{ flex: 1, opacity: progress, transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }] }}>
        {children}
      </Animated.View>
    </View>
  );
};

/* ----------------------------------------------------------------------------
 * Typography helpers
 * ------------------------------------------------------------------------- */
export const DisplayText: React.FC<{ children: React.ReactNode; style?: StyleProp<TextStyle>; numberOfLines?: number }> = ({ children, style, numberOfLines }) => (
  <Text numberOfLines={numberOfLines} style={[styles.display, style]}>
    {children}
  </Text>
);

/* ----------------------------------------------------------------------------
 * Header
 * ------------------------------------------------------------------------- */
interface HeaderProps {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  /** 'back' shows a chevron, 'close' an X, 'none' hides the button. */
  leading?: 'back' | 'close' | 'none';
  onLeadingPress?: () => void;
  dark?: boolean;
  large?: boolean;
}

export const Header: React.FC<HeaderProps> = ({ title, subtitle, right, leading = 'back', onLeadingPress, dark, large }) => {
  const t = useTheme();
  const router = useRouter();
  const fg = dark ? t.onDark : t.textStrong;
  const handle = onLeadingPress ?? (() => (router.canGoBack() ? router.back() : router.replace('/(tabs)')));

  return (
    <View style={styles.headerRow}>
      {leading !== 'none' && (
        <IconButton onPress={handle} dark={dark}>
          {leading === 'back' ? <ChevronLeft size={s(20)} color={fg} /> : <X size={s(20)} color={fg} />}
        </IconButton>
      )}
      <View style={{ flex: 1 }}>
        <Text style={[styles.display, large ? styles.headerTitleLarge : styles.headerTitle, { color: fg }]} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? <Text style={[styles.headerSubtitle, { color: t.textMuted }]}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
};

/* ----------------------------------------------------------------------------
 * Icon button (40px circle). `dark` renders as a glass pill (button system).
 * ------------------------------------------------------------------------- */
interface IconButtonProps {
  onPress?: () => void;
  children: React.ReactNode;
  dark?: boolean;
  filled?: boolean;
  size?: number;
  style?: StyleProp<ViewStyle>;
  badge?: boolean;
  glass?: boolean;
  active?: boolean;
}

export const IconButton: React.FC<IconButtonProps> = ({ onPress, children, dark, filled, size = 40, style, badge, glass, active }) => {
  const t = useTheme();
  const px = s(size);
  void glass;
  {
    return (
      <PressableScale onPress={onPress} hitSlop={8} disabled={!onPress} style={style} highlight radius={px / 2} highlightColor={filled || dark ? '#FFFFFF' : '#14180F'}>
        <GlassSurface lite tone={filled ? 'lime' : dark ? 'dark' : 'light'} radius={px / 2} active={active} glow={active} style={{ width: px, height: px }}>
          <View style={{ width: px, height: px, alignItems: 'center', justifyContent: 'center' }}>{children}</View>
          {badge && <View style={[styles.badgeDot, { backgroundColor: t.red, borderColor: dark ? t.dark : t.card }]} />}
        </GlassSurface>
      </PressableScale>
    );
  }
};

/* ----------------------------------------------------------------------------
 * Section tag: small uppercase letter-spaced label
 * ------------------------------------------------------------------------- */
export const SectionTag: React.FC<{ children: string; style?: StyleProp<TextStyle>; light?: boolean }> = ({ children, style, light }) => {
  const t = useTheme();
  return <Text style={[styles.sectionTag, { color: light ? t.lime : t.textMuted }, style]}>{children}</Text>;
};

export const SectionTitle: React.FC<{ children: string; right?: React.ReactNode; dark?: boolean }> = ({ children, right, dark }) => {
  const t = useTheme();
  return (
    <View style={styles.sectionTitleRow}>
      <Text style={[styles.display, styles.sectionTitle, { color: dark ? t.onDark : t.textStrong }]}>{children}</Text>
      {right}
    </View>
  );
};

/* ----------------------------------------------------------------------------
 * Pill (filter chip) — dark when selected
 * ------------------------------------------------------------------------- */
interface PillProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  /** 'dark' = selected is dark (filters), 'lime' = selected is lime (multi-select choices). */
  variant?: 'dark' | 'lime';
  small?: boolean;
  disabled?: boolean;
  left?: React.ReactNode;
  right?: React.ReactNode;
}

export const Pill: React.FC<PillProps> = ({ label, selected, onPress, variant = 'dark', small, disabled, left, right }) => {
  const t = useTheme();
  const selFg = variant === 'lime' ? t.onLime : t.pillActiveText;
  // Chips are glass too: lime / dark glass when selected, light glass otherwise.
  const tone = selected ? (variant === 'lime' || t.isDark ? 'lime' : 'dark') : 'light';
  const fg = selected ? (tone === 'lime' ? t.onLime : selFg) : t.textStrong;
  return (
    <PressableScale onPress={onPress} disabled={disabled || !onPress} scaleTo={0.94} highlight radius={radius.pill} highlightColor={selected ? '#FFFFFF' : '#14180F'} style={disabled && { opacity: 0.5 }}>
      <GlassSurface lite tone={tone} radius={radius.pill}>
        <View style={[styles.pillContent, styles.pillPad, small && styles.pillSmall]}>
          {left}
          <Text style={[styles.pillText, small && { fontSize: fs(12) }, { color: fg }]}>{label}</Text>
          {right}
        </View>
      </GlassSurface>
    </PressableScale>
  );
};

/* ----------------------------------------------------------------------------
 * Buttons — lime/dark are glass gradients from the button system sheet.
 * ------------------------------------------------------------------------- */
interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: 'lime' | 'dark' | 'outline' | 'ghost' | 'orange';
  disabled?: boolean;
  loading?: boolean;
  right?: React.ReactNode;
  left?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  size?: 'md' | 'sm';
  /** When rendered on a dark surface, outline/ghost adapt their colours. */
  onDark?: boolean;
}

export const Button: React.FC<ButtonProps> = ({ label, onPress, variant = 'lime', disabled, loading, right, left, style, size = 'md', onDark }) => {
  const t = useTheme();
  const height = size === "sm" ? s(42) : s(50);
  const r = height / 2;
  const inactive = disabled || loading;

  const glassTone: 'lime' | 'dark' | 'orange' | 'clear' | 'light' =
    variant === 'lime' ? 'lime'
      : variant === 'dark' ? (t.isDark ? 'lime' : 'dark')
        : variant === 'orange' ? 'orange'
          : onDark ? 'clear' : 'light';
  const fg =
    variant === 'lime' || (variant === 'dark' && t.isDark) ? t.onLime
      : variant === 'dark' ? t.onDark
        : variant === 'orange' ? '#FFFFFF'
          : onDark ? t.onDark : t.textStrong;

  const content = loading ? (
    <ActivityIndicator color={fg} />
  ) : (
    <>
      {left}
      <Text style={[styles.display, styles.buttonText, size === 'sm' && { fontSize: fs(14) }, { color: fg }]}>{label}</Text>
      {right}
    </>
  );

  {
    const solid = variant === 'lime' || variant === 'dark' || variant === 'orange' || onDark;
    return (
      <PressableScale onPress={onPress} disabled={inactive} style={[style, inactive && { opacity: 0.45 }]} highlight radius={r} highlightColor={solid ? '#FFFFFF' : '#14180F'}>
        <GlassSurface tone={glassTone} radius={r} glow={variant === 'lime' && !inactive} style={{ height }}>
          <View style={[styles.buttonInner, { height, paddingHorizontal: size === 'sm' ? ms(16) : ms(22) }]}>{content}</View>
        </GlassSurface>
      </PressableScale>
    );
  }

};

/* ----------------------------------------------------------------------------
 * Card surfaces
 * ------------------------------------------------------------------------- */
interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  variant?: 'white' | 'dark' | 'lime' | 'peach' | 'sage' | 'flat';
  onPress?: () => void;
  padded?: boolean;
}

export const Card: React.FC<CardProps> = ({ children, style, variant = 'white', onPress, padded = true }) => {
  const t = useTheme();
  const surface: ViewStyle =
    variant === 'dark'
      ? { backgroundColor: t.dark, borderWidth: t.isDark ? 1 : 0, borderColor: t.border }
      : variant === 'lime'
        ? { backgroundColor: t.lime }
        : variant === 'peach'
          ? { backgroundColor: t.peach, borderWidth: 1, borderColor: t.peachBorder }
          : variant === 'sage'
            ? { backgroundColor: t.sage }
            : variant === 'flat'
              ? { backgroundColor: t.cardAlt }
              : { backgroundColor: t.card, borderWidth: 1, borderColor: t.border };
  const content = <View style={[styles.card, padded && styles.cardPadded, surface, style]}>{children}</View>;
  if (!onPress) return content;
  return (
    <PressableScale onPress={onPress} scaleTo={0.985} highlight radius={radius.card} highlightColor={variant === "dark" || variant === "lime" ? "#FFFFFF" : "#14180F"}>
      {content}
    </PressableScale>
  );
};

export const Divider: React.FC<{ inset?: number }> = ({ inset = 0 }) => {
  const t = useTheme();
  return <View style={{ height: 1, backgroundColor: t.isDark ? t.border : t.cardAlt, marginLeft: inset }} />;
};

/* ----------------------------------------------------------------------------
 * Initial avatar (letter tile) — used for ingredients, not people.
 * ------------------------------------------------------------------------- */
interface InitialAvatarProps {
  label: string;
  size?: number;
  tone?: 'cream' | 'sage' | 'blush' | 'lime' | 'flat';
  round?: boolean;
}

export const InitialAvatar: React.FC<InitialAvatarProps> = ({ label, size = 42, tone, round }) => {
  const t = useTheme();
  const px = s(size);
  const tones = { cream: t.cream, sage: t.sage, blush: t.blush, lime: t.lime, flat: t.cardAlt };
  const auto = (['cream', 'sage', 'blush'] as const)[label.charCodeAt(0) % 3];
  const bg = tones[tone ?? auto];
  return (
    <View
      style={{
        width: px,
        height: px,
        borderRadius: round ? px / 2 : Math.round(px / 3),
        backgroundColor: bg,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={[styles.display, { fontSize: Math.round(px * 0.42), color: tone === 'lime' ? t.onLime : t.textStrong }]}>{label.slice(0, 2)}</Text>
    </View>
  );
};

/* ----------------------------------------------------------------------------
 * Match badge: "92% match"
 * ------------------------------------------------------------------------- */
export const MatchBadge: React.FC<{ percent: number; suffix?: string; onImage?: boolean }> = ({ percent, suffix = 'match', onImage }) => {
  const t = useTheme();
  const strong = percent >= 90;
  if (onImage) {
    return (
      <View style={[styles.badge, { backgroundColor: 'rgba(20,24,15,0.85)' }]}>
        <Text style={[styles.badgeText, { color: t.lime }]}>{percent}% {suffix}</Text>
      </View>
    );
  }
  return (
    <View style={[styles.badge, { backgroundColor: strong ? t.lime : t.card }]}>
      <Text style={[styles.badgeText, { color: strong ? t.onLime : t.textSoft }]}>{percent}% {suffix}</Text>
    </View>
  );
};

export const Tag: React.FC<{ label: string; tone?: 'gray' | 'lime' | 'peach' | 'sage' | 'white' }> = ({ label, tone = 'gray' }) => {
  const t = useTheme();
  const map = {
    gray: { bg: t.cardAlt, fg: t.textSoft },
    lime: { bg: t.lime, fg: t.onLime },
    peach: { bg: t.peach, fg: t.orange },
    sage: { bg: t.sage, fg: t.green },
    white: { bg: t.card, fg: t.textStrong },
  } as const;
  return (
    <View style={[styles.badge, { backgroundColor: map[tone].bg }]}>
      <Text style={[styles.badgeText, { color: map[tone].fg }]}>{label}</Text>
    </View>
  );
};

/* ----------------------------------------------------------------------------
 * Empty state
 * ------------------------------------------------------------------------- */
const EMPTY_ICONS: Record<string, LucideIcon> = { "🥬": Leaf, "🔍": SearchX, "🔖": Bookmark, "🧊": Refrigerator, "🍽️": UtensilsCrossed, "🤷": UtensilsCrossed, "🍳": CookingPot, "🥣": Soup, "🛒": ShoppingBasket, "📁": Folder, "📂": FolderOpen, "🔔": BellRing };

export const EmptyState: React.FC<{ emoji?: string; icon?: LucideIcon; title: string; message?: string; action?: React.ReactNode; dark?: boolean }> = ({ emoji = "🥬", icon, title, message, action, dark }) => {
  const t = useTheme();
  const Icon = icon ?? EMPTY_ICONS[emoji] ?? Leaf;
  return (
    <View style={styles.empty}>
      <View style={[styles.emptyIcon, { backgroundColor: dark ? "rgba(255,255,255,0.08)" : t.cardAlt }]}>
        <Icon size={s(26)} color={dark ? t.lime : t.textStrong} strokeWidth={1.8} />
      </View>
      <Text style={[styles.display, styles.emptyTitle, { color: dark ? t.onDark : t.textStrong }]}>{title}</Text>
      {message ? <Text style={[styles.emptyMessage, { color: t.textMuted }]}>{message}</Text> : null}
      {action ? <View style={{ marginTop: 16, alignSelf: 'stretch' }}>{action}</View> : null}
    </View>
  );
};

/* ----------------------------------------------------------------------------
 * Stat tile
 * ------------------------------------------------------------------------- */
export const StatTile: React.FC<{ value: string | number; label: string; variant?: 'white' | 'peach' | 'dark'; align?: 'left' | 'center' }> = ({ value, label, variant = 'white', align = 'left' }) => {
  const t = useTheme();
  const bg = variant === 'peach' ? t.peach : variant === 'dark' ? t.dark : t.card;
  const valueColor = variant === 'peach' ? t.orange : variant === 'dark' ? t.onDark : t.textStrong;
  const labelColor = variant === 'peach' ? t.orange : variant === 'dark' ? t.lime : t.textMuted;
  const border = variant === 'peach' ? t.peachBorder : variant === 'dark' ? (t.isDark ? t.border : bg) : t.border;
  return (
    <View style={[styles.stat, { backgroundColor: bg, borderColor: border, alignItems: align === 'center' ? 'center' : 'flex-start' }]}>
      <Text style={[styles.display, styles.statValue, { color: valueColor }]}>{value}</Text>
      <Text numberOfLines={1} style={[styles.statLabel, { color: labelColor }]}>{label}</Text>
    </View>
  );
};

/* ----------------------------------------------------------------------------
 * Toast-like inline notice
 * ------------------------------------------------------------------------- */
export const Notice: React.FC<{ text: string; tone?: 'lime' | 'peach' | 'sage' }> = ({ text, tone = 'sage' }) => {
  const t = useTheme();
  const bg = tone === 'lime' ? t.lime : tone === 'peach' ? t.peach : t.sage;
  const fg = tone === 'lime' ? t.onLime : tone === 'peach' ? t.orange : t.isDark ? t.lime : t.green;
  return (
    <View style={[styles.notice, { backgroundColor: bg }]}>
      <Text style={[styles.noticeText, { color: fg }]}>{text}</Text>
    </View>
  );
};

export const page = {
  paddingHorizontal: spacing.page,
  paddingTop: ms(12),
};

const styles = StyleSheet.create({
  display: { fontFamily: font.display, fontWeight: '400', letterSpacing: 0.1 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: ms(12) },
  headerTitle: { fontSize: fs(23), lineHeight: fs(27) },
  headerTitleLarge: { fontSize: fs(27), lineHeight: fs(31) },
  headerSubtitle: { fontSize: fs(13), marginTop: 1 },
  badgeDot: { position: 'absolute', top: 8, right: 9, width: 9, height: 9, borderRadius: 5, borderWidth: 1.5 },
  sectionTag: { fontSize: fs(11), fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase' },
  sectionTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontSize: fs(19), lineHeight: fs(23) },
  pill: {
    paddingHorizontal: ms(16),
    paddingVertical: ms(9),
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  pillContent: { flexDirection: "row", alignItems: "center", gap: 6 },
  pillPad: { paddingHorizontal: ms(16), paddingVertical: ms(9) },
  pillSmall: { paddingHorizontal: ms(12), paddingVertical: ms(6) },
  pillText: { fontSize: fs(13), fontWeight: '700' },
  buttonInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, alignSelf: 'stretch' },
  buttonText: { fontSize: fs(16), lineHeight: fs(20) },
  card: { borderRadius: radius.card },
  cardPadded: { padding: ms(16) },
  badge: { paddingHorizontal: ms(10), paddingVertical: 4, borderRadius: radius.pill, alignSelf: 'flex-start' },
  badgeText: { fontSize: fs(11), fontWeight: '800' },
  empty: { alignItems: "center", paddingVertical: 32, paddingHorizontal: 24 },
  emptyIcon: { width: s(56), height: s(56), borderRadius: s(18), alignItems: "center", justifyContent: "center", marginBottom: 12 },
  emptyTitle: { fontSize: fs(18), textAlign: "center" },
  emptyMessage: { fontSize: fs(13), textAlign: 'center', marginTop: 6, lineHeight: fs(18) },
  stat: { flex: 1, padding: ms(14), borderRadius: radius.cardSm, borderWidth: 1 },
  statValue: { fontSize: fs(22), lineHeight: fs(26) },
  statLabel: { fontSize: fs(11), fontWeight: "600", marginTop: 2 },
  notice: { borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10 },
  noticeText: { fontSize: fs(13), fontWeight: '700' },
});
