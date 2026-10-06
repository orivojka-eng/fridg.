import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Plus, Check, X } from '../../src/components/ui/lucide';
import { useShoppingStore, guessShoppingCategory } from '../../src/store/useShoppingStore';
import { useUserStore } from '../../src/store/useUserStore';
import { useRecipeStore } from '../../src/store/useRecipeStore';
import { useFridgeStore } from '../../src/store/useFridgeStore';
import { useTheme, fs, font } from '../../src/theme';
import { Screen, Header, SectionTag, Card, Pill, Button, IconButton, EmptyState, Divider, FoodIcon } from '../../src/components/ui';
import { ShoppingCategory, ShoppingItem } from '../../src/types';
import { computeMatch, plural, sortByMatch } from '../../src/lib/matching';

const CATEGORIES: ShoppingCategory[] = ['PRODUCE', 'PANTRY & SPICE'];

export default function ShoppingListScreen() {
  const router = useRouter();
  const t = useTheme();
  const { items, toggleItemCheck, addItem, removeItem, clearChecked, addMissingIngredients } = useShoppingStore();
  const profile = useUserStore((s) => s.profile);
  const recipes = useRecipeStore((s) => s.recipes);
  const fridge = useFridgeStore((s) => s.items);

  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<ShoppingCategory>('PRODUCE');

  const remaining = items.filter((i) => !i.isChecked);
  const checkedCount = items.length - remaining.length;
  const estimate = remaining.reduce((sum, i) => sum + (i.estPrice ?? 0), 0);
  const grouped = useMemo(() => CATEGORIES.map((c) => ({ category: c, items: items.filter((i) => i.category === c) })).filter((g) => g.items.length > 0), [items]);

  const submit = () => {
    const clean = name.trim();
    if (!clean) return;
    addItem({ name: clean, category, amount: amount.trim() || '1 pc', source: 'Added by you' });
    setName('');
    setAmount('');
    setAdding(false);
  };

  const onNameChange = (v: string) => {
    setName(v);
    setCategory(guessShoppingCategory(v));
  };

  const autoBuild = () => {
    if (!profile.isPremium) {
      router.push('/premium');
      return;
    }
    // Premium: pull the missing ingredients for the three best-matching recipes.
    const top = sortByMatch(recipes, fridge).slice(0, 3);
    const added = top.reduce((n, r) => n + addMissingIngredients(computeMatch(r, fridge).missing, `Meal plan • ${r.title}`), 0);
    Alert.alert(added > 0 ? `${plural(added, 'item')} added` : 'Nothing to add', added > 0 ? 'Built from the recipes that best match your fridge.' : 'Your list already covers this week\'s plan.');
  };

  const confirmRemove = (item: ShoppingItem) =>
    Alert.alert(`Remove ${item.name}?`, undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => removeItem(item.id) },
    ]);

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Header
          title="Shopping list"
          subtitle={items.length === 0 ? 'Nothing to buy' : `${plural(remaining.length, 'item')} left • est. €${estimate.toFixed(2)}`}
          right={
            <IconButton dark onPress={() => setAdding((v) => !v)}>
              {adding ? <X size={18} color={t.lime} /> : <Plus size={20} color={t.lime} />}
            </IconButton>
          }
        />

        {adding && (
          <Card style={{ gap: 10 }}>
            <View style={styles.addRow}>
              <TextInput autoFocus value={name} onChangeText={onNameChange} placeholder="What do you need?" placeholderTextColor={t.textMuted} style={[styles.addInput, { color: t.textStrong, backgroundColor: t.cardAlt, flex: 2 }]} returnKeyType="next" onSubmitEditing={submit} />
              <TextInput value={amount} onChangeText={setAmount} placeholder="Amount" placeholderTextColor={t.textMuted} style={[styles.addInput, { color: t.textStrong, backgroundColor: t.cardAlt, flex: 1 }]} returnKeyType="done" onSubmitEditing={submit} />
            </View>
            <View style={styles.addFooter}>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {CATEGORIES.map((c) => (
                  <Pill key={c} small label={c === 'PRODUCE' ? 'Produce' : 'Pantry & spice'} selected={category === c} onPress={() => setCategory(c)} />
                ))}
              </View>
              <Button label="Add" size="sm" onPress={submit} disabled={!name.trim()} />
            </View>
          </Card>
        )}

        {items.length === 0 && !adding && (
          <EmptyState emoji="🛒" title="Your list is empty" message="Missing ingredients from any recipe land here with one tap." action={<Button label="Add an item" variant="dark" onPress={() => setAdding(true)} />} />
        )}

        {grouped.map((group) => (
          <View key={group.category} style={styles.section}>
            <SectionTag>{group.category}</SectionTag>
            <Card style={{ paddingVertical: 4 }}>
              {group.items.map((item, idx) => (
                <View key={item.id}>
                  <TouchableOpacity activeOpacity={0.7} style={styles.row} onPress={() => toggleItemCheck(item.id)} onLongPress={() => confirmRemove(item)}>
                    <View style={styles.rowLeft}>
                      <View style={[styles.check, item.isChecked ? { backgroundColor: t.dark, borderColor: t.dark } : { borderColor: t.border }]}>
                        {item.isChecked && <Check size={14} color={t.lime} strokeWidth={3} />}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.name, { color: item.isChecked ? t.textMuted : t.textStrong }, item.isChecked && styles.strike]}>{item.name}</Text>
                        <Text style={[styles.source, { color: t.textMuted }]}>{item.source}</Text>
                      </View>
                    </View>
                    <View style={styles.rowRight}>
                      <Text style={[styles.amount, { color: t.textMuted }]}>{item.amount}</Text>
                      <FoodIcon name={item.name} size={16} color={t.textMuted} />
                    </View>
                  </TouchableOpacity>
                  {idx < group.items.length - 1 && <Divider />}
                </View>
              ))}
            </Card>
          </View>
        ))}

        {checkedCount > 0 && (
          <Button label={`Clear ${plural(checkedCount, 'bought item')}`} variant="outline" onPress={clearChecked} />
        )}

        <Card variant="sage" style={styles.promo}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.promoTitle, { color: t.textStrong }]}>Auto-build from my meal plan</Text>
            <Text style={[styles.promoSub, { color: t.textSoft }]}>{profile.isPremium ? 'Fills the week from your best matches' : 'Premium • fills the week in one tap'}</Text>
          </View>
          <Button label={profile.isPremium ? 'Build' : 'Try'} variant="dark" size="sm" onPress={autoBuild} />
        </Card>
        {items.length > 0 && <Text style={[styles.hint, { color: t.textMuted }]}>Tap to tick off • hold to remove</Text>}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40, gap: 12 },
  addRow: { flexDirection: 'row', gap: 8 },
  addInput: { borderRadius: 14, paddingHorizontal: 12, height: 42, fontSize: fs(14), fontWeight: '600' },
  addFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  section: { gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, gap: 10 },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  check: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  name: { fontWeight: '800', fontSize: fs(15) },
  strike: { textDecorationLine: 'line-through' },
  source: { fontSize: fs(12), marginTop: 1 },
  amount: { fontSize: fs(13), fontWeight: '700' },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 0 },
  promo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: 18 },
  promoTitle: { fontFamily: font.display, fontWeight: '400', fontSize: fs(17)  },
  promoSub: { fontSize: fs(12), marginTop: 2 },
  hint: { fontSize: fs(11), textAlign: 'center' },
});
