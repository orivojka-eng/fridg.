import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Sun, Moon, ChevronRight, Plus, Sparkles, ChefHat, Refrigerator, ShoppingBasket, Heart, BellRing, LogOut, ShieldCheck, LifeBuoy, FileText } from '../../src/components/ui/lucide';
import { useUserStore } from '../../src/store/useUserStore';
import { useFridgeStore } from '../../src/store/useFridgeStore';
import { useShoppingStore } from '../../src/store/useShoppingStore';
import { useRecipeStore } from '../../src/store/useRecipeStore';
import { useTheme, spacing, fs, font } from '../../src/theme';
import { Screen, IconButton, Card, Avatar, AVATARS, PressableScale, GlassSurface, Button, page } from "../../src/components/ui";
import { plural } from '../../src/lib/matching';

export default function ProfileScreen() {
  const router = useRouter();
  const t = useTheme();
  const { profile, theme, toggleTheme, notifications, avatarIndex, setAvatarIndex, logOut } = useUserStore();
  const [pickingAvatar, setPickingAvatar] = useState(false);
  const fridgeCount = useFridgeStore((s) => s.items.length);
  const shoppingLeft = useShoppingStore((s) => s.items.filter((i) => !i.isChecked).length);
  const savedCount = useRecipeStore((s) => s.savedRecipeIds.length);
  const publishedByMe = useRecipeStore((s) => s.recipes.filter((r) => r.authorHandle === profile.handle && r.createdAt).length);
  const isDark = theme === 'dark';

  const prefSummary = [profile.goals[0], profile.diet[0]?.toLowerCase()].filter(Boolean).join(' • ') || 'Not set';
  const unread = notifications.filter((n) => !n.isRead).length;

  const rows = [
    { label: 'Create a recipe', meta: `${profile.publishedCount + publishedByMe} published`, route: '/recipe/create', icon: ChefHat },
    { label: 'My fridge', meta: plural(fridgeCount, 'item'), route: '/fridge', icon: Refrigerator },
    { label: 'Shopping list', meta: shoppingLeft === 0 ? 'All bought' : plural(shoppingLeft, 'item'), route: '/shopping', icon: ShoppingBasket },
    { label: 'Preferences', meta: prefSummary, route: '/onboarding?from=profile', icon: Heart },
    { label: 'Notifications', meta: unread > 0 ? `${unread} unread` : 'All read', route: '/notifications', icon: BellRing },
    { label: 'Support', meta: 'Contact & help', route: '/support', icon: LifeBuoy },
    { label: 'Privacy & data', meta: 'What we keep', route: '/legal/privacy', icon: ShieldCheck },
    { label: 'Terms of Use', meta: 'EULA', route: '/legal/terms', icon: FileText },
  ];

  return (
    <Screen animated={false} fadeOnFocus>
      <ScrollView contentContainerStyle={[page, styles.scroll]} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: t.text }]}>Profile</Text>
          <IconButton onPress={toggleTheme}>
            {isDark ? <Moon size={18} color={t.lime} /> : <Sun size={18} color={t.textStrong} />}
          </IconButton>
        </View>

        <View style={styles.userRow}>
          <PressableScale onPress={() => setPickingAvatar((v) => !v)} scaleTo={0.94}>
            <Avatar index={avatarIndex} size={64} selected={pickingAvatar} />
          </PressableScale>
          <View style={{ flex: 1 }}>
            <Text style={[styles.userName, { color: t.textStrong }]}>{profile.name}</Text>
            <Text style={[styles.userHandle, { color: t.textMuted }]}>{profile.handle} • {profile.bio}</Text>
            <TouchableOpacity onPress={() => setPickingAvatar((v) => !v)} hitSlop={6}>
              <Text style={[styles.changeAvatar, { color: t.green }]}>{pickingAvatar ? 'Done' : 'Change avatar'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {pickingAvatar && (
          <Card style={styles.avatarPicker}>
            {AVATARS.map((_, i) => (
              <PressableScale key={i} onPress={() => { setAvatarIndex(i); setPickingAvatar(false); }} scaleTo={0.9}>
                <Avatar index={i} size={52} selected={i === avatarIndex} />
              </PressableScale>
            ))}
          </Card>
        )}

        <View style={styles.stats}>
          {[
            { val: savedCount, label: 'Saved' },
            { val: profile.publishedCount + publishedByMe, label: 'Published' },
            { val: profile.followersCount, label: 'Followers' },
            { val: profile.streakDays, label: 'Streak' },
          ].map((s) => (
            <View key={s.label} style={[styles.statBox, { backgroundColor: t.card, borderColor: t.border }]}>
              <Text style={[styles.statVal, { color: t.textStrong }]}>{s.val}</Text>
              <Text numberOfLines={1} style={[styles.statLabel, { color: t.textMuted }]}>{s.label}</Text>
            </View>
          ))}
        </View>

        {profile.isPremium ? (
          <Card variant="dark" style={{ gap: 10 }}>
            <View style={styles.premiumBadge}>
              <Sparkles size={14} color={t.lime} />
              <Text style={[styles.premiumBadgeText, { color: t.lime }]}>FRIDGR PREMIUM</Text>
            </View>
            <Text style={[styles.premiumTitle, { color: t.onDark }]}>You're on Premium. Unlimited AI, meal plans and smart scanning are on.</Text>
            <TouchableOpacity onPress={() => router.push('/premium')} hitSlop={8}>
              <Text style={{ color: t.lime, fontWeight: '700', fontSize: fs(13) }}>Manage subscription</Text>
            </TouchableOpacity>
          </Card>
        ) : (
          <Card variant="dark" onPress={() => router.push('/premium')} style={{ gap: 12 }}>
            <View style={styles.premiumBadge}>
              <Plus size={14} color={t.lime} />
              <Text style={[styles.premiumBadgeText, { color: t.lime }]}>FRIDGR PREMIUM</Text>
            </View>
            <Text style={[styles.premiumTitle, { color: t.onDark }]}>Unlimited AI, weekly meal plans, smarter scanning</Text>
            <View style={[styles.trialPill, { backgroundColor: t.lime }]}>
              <Text style={[styles.trialText, { color: t.onLime }]}>Start 7-day free trial</Text>
            </View>
          </Card>
        )}

        <View style={styles.grid}>
          {rows.map((item) => (
            <PressableScale key={item.label} onPress={() => router.push(item.route as any)} style={styles.gridCell} scaleTo={0.96} highlight radius={20} highlightColor="#14180F">
              <GlassSurface lite tone="light" radius={20}>
                <View style={styles.gridInner}>
                  <item.icon size={22} color={t.textStrong} />
                  <Text style={[styles.rowLabel, { color: t.textStrong }]} numberOfLines={1}>{item.label}</Text>
                  <Text style={[styles.rowMeta, { color: t.textMuted, maxWidth: undefined }]} numberOfLines={1}>{item.meta}</Text>
                </View>
              </GlassSurface>
            </PressableScale>
          ))}
        </View>

        <Button label="Log out" variant="outline" onPress={logOut} left={<LogOut size={16} color={t.textStrong} />} />
        <TouchableOpacity onPress={() => router.push('/account/delete')} hitSlop={8} style={{ alignItems: 'center' }}>
          <Text style={{ color: t.textMuted, fontSize: fs(12), textAlign: 'center' }}>{profile.email} • <Text style={{ color: t.orange, fontWeight: '700' }}>Delete account</Text></Text>
        </TouchableOpacity>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.tabBarClearance, gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  gridCell: { width: '48%', flexGrow: 1 },
  gridInner: { alignSelf: 'stretch', padding: 14, gap: 3 },
  title: { fontFamily: font.display, fontSize: fs(30), fontWeight: '400', letterSpacing: -0.5  },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontWeight: '800', fontSize: fs(22) },
  userName: { fontFamily: font.display, fontSize: fs(20), fontWeight: '400' },
  userHandle: { fontSize: fs(13), marginTop: 2 },
  changeAvatar: { fontSize: fs(12), fontWeight: '700', marginTop: 6 },
  avatarPicker: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center' },
  stats: { flexDirection: 'row', gap: 8 },
  statBox: { flex: 1, paddingVertical: 12, borderRadius: 18, borderWidth: 1, alignItems: 'center' },
  statVal: { fontFamily: font.display, fontWeight: '400', fontSize: fs(18)  },
  statLabel: { fontSize: fs(11), marginTop: 2, textAlign: 'center' },
  premiumBadge: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  premiumBadgeText: { fontSize: fs(11), fontWeight: '800', letterSpacing: 0.8 },
  premiumTitle: { fontFamily: font.display, fontSize: fs(20), fontWeight: '400', lineHeight: fs(26)  },
  trialPill: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, alignSelf: 'flex-start' },
  trialText: { fontSize: fs(14), fontWeight: '800' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14 },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 },
  rowIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  rowIconText: { fontWeight: '800', fontSize: fs(14) },
  rowLabel: { fontWeight: '700', fontSize: fs(15), flexShrink: 1 },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 0, maxWidth: '44%' },
  rowMeta: { fontSize: fs(12) },
});
