import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Plus, Trash2, Camera } from '../../src/components/ui/lucide';
import { useFridgeStore } from '../../src/store/useFridgeStore';
import { useRecipeStore } from '../../src/store/useRecipeStore';
import { useTheme, fs } from '../../src/theme';
import { Screen, Header, Pill, StatTile, FoodTile, EmptyState, Button, Notice, page } from '../../src/components/ui';
import { computeMatch, expiryStatus, plural, timeAgo } from '../../src/lib/matching';
import { FridgeCategory } from '../../src/types';

const CATEGORIES: Array<'All' | FridgeCategory> = ['All', 'Protein', 'Veg', 'Dairy', 'Pantry', 'Produce'];

export default function FridgeScreen() {
  const router = useRouter();
  const t = useTheme();
  const { added, merged } = useLocalSearchParams<{ added?: string; merged?: string }>();
  const { items, selectedCategory, setSelectedCategory, removeItem, lastScannedAt } = useFridgeStore();
  const recipes = useRecipeStore((s) => s.recipes);
  const [notice, setNotice] = useState<string | null>(null);

  // Show a one-off confirmation after the scanner or manual add lands here.
  useEffect(() => {
    const a = Number(added ?? 0);
    const m = Number(merged ?? 0);
    if (a + m > 0) {
      const parts = [];
      if (a) parts.push(`${plural(a, 'item')} added`);
      if (m) parts.push(`${m} topped up`);
      setNotice(parts.join(' • '));
      const timer = setTimeout(() => setNotice(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [added, merged]);

  const filtered = useMemo(() => {
    const list = selectedCategory === 'All' ? items : items.filter((i) => i.category === selectedCategory);
    // Expiring first so the things that need using are at the top.
    return [...list].sort((a, b) => a.daysToExpiry - b.daysToExpiry);
  }, [items, selectedCategory]);

  const expiring = items.filter((i) => i.daysToExpiry <= 2).length;
  const fresh = items.length - expiring;
  const ready = recipes.filter((r) => computeMatch(r, items).matchPercent >= 80).length;

  const counts = useMemo(() => {
    const map: Record<string, number> = { All: items.length };
    items.forEach((i) => (map[i.category] = (map[i.category] ?? 0) + 1));
    return map;
  }, [items]);

  return (
    <Screen>
      <ScrollView contentContainerStyle={[page, styles.scroll]} showsVerticalScrollIndicator={false}>
        <Header
          title="My Fridge"
          subtitle={`${plural(items.length, 'item')} • last scanned ${timeAgo(lastScannedAt)}`}
          right={
            <TouchableOpacity style={[styles.addBtn, { backgroundColor: t.dark, borderColor: t.border, borderWidth: t.isDark ? 1 : 0 }]} onPress={() => router.push('/fridge/add-manual')}>
              <Text style={[styles.addBtnText, { color: t.onDark }]}>Add</Text>
              <Plus size={16} color={t.lime} />
            </TouchableOpacity>
          }
        />

        {notice && <Notice text={notice} tone="lime" />}

        <View style={styles.stats}>
          <StatTile value={fresh} label="Fresh" />
          <StatTile value={expiring} label="Expiring" variant="peach" />
          <TouchableOpacity style={{ flex: 1 }} onPress={() => router.push('/recipe/results')} activeOpacity={0.85}>
            <StatTile value={ready} label="Recipes" variant="dark" />
          </TouchableOpacity>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {CATEGORIES.map((cat) => (
            <Pill key={cat} label={counts[cat] ? `${cat} ${counts[cat]}` : cat} selected={selectedCategory === cat} onPress={() => setSelectedCategory(cat)} />
          ))}
        </ScrollView>

        {filtered.length === 0 ? (
          <EmptyState
            emoji="🧊"
            title={items.length === 0 ? 'Your fridge is empty' : `No ${selectedCategory.toLowerCase()} in your fridge`}
            message={items.length === 0 ? 'Scan your shelves or add items by hand to get recipe matches.' : 'Add some, or pick another category.'}
            action={
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Button label="Scan" variant="dark" onPress={() => router.push('/scan')} left={<Camera size={16} color={t.isDark ? t.onLime : t.onDark} />} style={{ flex: 1 }} />
                <Button label="Add manually" variant="outline" onPress={() => router.push('/fridge/add-manual')} style={{ flex: 1 }} />
              </View>
            }
          />
        ) : (
          <View style={styles.list}>
            {filtered.map((item) => {
              const status = expiryStatus(item.daysToExpiry);
              const statusColor = status === 'Fresh' ? t.green : status === 'Expiring' ? t.orange : t.red;
              const statusText =
                status === 'Fresh' ? 'Fresh' : status === 'Expired' ? 'Expired' : item.daysToExpiry === 0 ? 'Today' : plural(item.daysToExpiry, 'day');
              return (
                <View key={item.id} style={[styles.card, { backgroundColor: t.card, borderColor: status === 'Expired' ? t.peachBorder : t.border }]}>
                  <TouchableOpacity style={styles.left} activeOpacity={0.7} onPress={() => router.push(`/recipe/results?use=${encodeURIComponent(item.name)}`)}>
                    <FoodTile name={item.name} category={item.category} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.name, { color: t.textStrong }]}>{item.name}</Text>
                      <Text style={[styles.meta, { color: t.textMuted }]}>{item.category} • {item.quantity}</Text>
                    </View>
                  </TouchableOpacity>
                  <View style={styles.right}>
                    <Text style={[styles.status, { color: statusColor }]}>{statusText}</Text>
                    <TouchableOpacity style={styles.remove} onPress={() => removeItem(item.id)} hitSlop={8}>
                      <Trash2 size={12} color={t.textMuted} />
                      <Text style={[styles.removeText, { color: t.textMuted }]}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                </View>
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
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20 },
  addBtnText: { fontSize: fs(14), fontWeight: '800' },
  stats: { flexDirection: 'row', gap: 10 },
  list: { gap: 10 },
  card: { borderRadius: 18, padding: 14, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  left: { flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 },
  name: { fontWeight: '800', fontSize: fs(15) },
  meta: { fontSize: fs(12), marginTop: 2 },
  right: { alignItems: 'flex-end' },
  status: { fontSize: fs(12), fontWeight: '700' },
  remove: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 4 },
  removeText: { fontSize: fs(12) },
});
