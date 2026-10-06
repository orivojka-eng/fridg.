import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Leaf, MessageCircle, CalendarDays, ChefHat, Flame, Sparkles, CookingPot, Bell, LucideIcon } from '../src/components/ui/lucide';
import { NotificationKind } from '../src/types';
import { useUserStore } from '../src/store/useUserStore';
import { useTheme, fs, font } from '../src/theme';
import { Screen, Header, EmptyState, page } from '../src/components/ui';

const KIND_ICONS: Record<NotificationKind, LucideIcon> = { expiry: Leaf, reply: MessageCircle, plan: CalendarDays, creator: ChefHat, streak: Flame, premium: Sparkles, cooked: CookingPot, published: ChefHat };

export default function NotificationsScreen() {
  const router = useRouter();
  const t = useTheme();
  const { notifications, markNotificationRead, markAllNotificationsRead } = useUserStore();
  const unread = notifications.filter((n) => !n.isRead).length;

  const open = (id: string, link?: string) => {
    markNotificationRead(id);
    if (link) router.push(link as any);
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={[page, styles.scroll]} showsVerticalScrollIndicator={false}>
        <Header
          title="Notifications"
          subtitle={unread > 0 ? `${unread} unread` : 'You are all caught up'}
          right={
            unread > 0 ? (
              <TouchableOpacity onPress={markAllNotificationsRead} hitSlop={8}>
                <Text style={[styles.markAll, { color: t.green }]}>Mark all read</Text>
              </TouchableOpacity>
            ) : undefined
          }
        />

        {notifications.length === 0 ? (
          <EmptyState emoji="🔔" title="No notifications yet" message="Expiry alerts, replies and meal plans will land here." />
        ) : (
          <View style={styles.list}>
            {notifications.map((n) => {
              const highlighted = n.isHighlighted && !n.isRead;
              return (
                <TouchableOpacity
                  key={n.id}
                  activeOpacity={0.85}
                  onPress={() => open(n.id, n.link)}
                  style={[
                    styles.card,
                    highlighted
                      ? { backgroundColor: t.sage, borderColor: t.lime }
                      : { backgroundColor: t.card, borderColor: t.border },
                    n.isRead && { opacity: 0.75 },
                  ]}
                >
                  <View style={[styles.iconTile, { backgroundColor: highlighted ? t.lime : t.cardAlt }]}>
                    {React.createElement(n.kind ? KIND_ICONS[n.kind] : Bell, { size: 20, color: t.textStrong, strokeWidth: 1.9 })}
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.titleRow}>
                      <Text style={[styles.title, { color: t.textStrong }]}>{n.title}</Text>
                      <View style={styles.timeWrap}>
                        {!n.isRead && <View style={[styles.dot, { backgroundColor: t.green }]} />}
                        <Text style={[styles.time, { color: t.textMuted }]}>{n.timeAgo}</Text>
                      </View>
                    </View>
                    <Text style={[styles.message, { color: t.textSoft }]}>{n.message}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: 40, gap: 12 },
  markAll: { fontSize: fs(13), fontWeight: '700' },
  list: { gap: 12 },
  iconTile: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  card: { borderRadius: 24, padding: 16, flexDirection: 'row', gap: 14, borderWidth: 1 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  title: { fontFamily: font.display, fontWeight: '400', fontSize: fs(17), flex: 1  },
  timeWrap: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  time: { fontSize: fs(12) },
  message: { fontSize: fs(13), marginTop: 4, lineHeight: fs(18) },
});
