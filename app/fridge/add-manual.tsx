import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { Search, Plus, Minus, X } from '../../src/components/ui/lucide';
import { useFridgeStore } from '../../src/store/useFridgeStore';
import { useTheme, fs } from '../../src/theme';
import { Screen, Header, SectionTag, Card, Button, FoodIcon, FoodTile, Divider, page } from '../../src/components/ui';
import { FridgeCategory } from '../../src/types';
import { namesMatch, normalize, plural } from '../../src/lib/matching';

interface DraftItem {
  name: string;
  category: FridgeCategory;
  qty: number;
  unit: string;
}

const UNITS = ['pcs', 'g', 'ml', 'bunch', 'pack'];

const SUGGESTED: Array<{ name: string; category: FridgeCategory }> = [
  { name: 'Avocado', category: 'Produce' },
  { name: 'Sourdough', category: 'Pantry' },
  { name: 'Salmon fillets', category: 'Protein' },
  { name: 'Halloumi', category: 'Dairy' },
  { name: 'Courgette', category: 'Veg' },
  { name: 'Tahini', category: 'Pantry' },
  { name: 'Miso', category: 'Pantry' },
  { name: 'Coriander', category: 'Produce' },
  { name: 'Lemon', category: 'Produce' },
  { name: 'Chickpeas', category: 'Pantry' },
  { name: 'Butter', category: 'Dairy' },
  { name: 'Gochujang', category: 'Pantry' },
];

const CATEGORY_KEYWORDS: Array<[FridgeCategory, string[]]> = [
  ['Protein', ['chicken', 'beef', 'pork', 'salmon', 'fish', 'tofu', 'egg', 'prawn', 'turkey', 'mince']],
  ['Dairy', ['milk', 'cheese', 'yoghurt', 'yogurt', 'butter', 'cream', 'feta', 'halloumi']],
  ['Veg', ['pepper', 'spinach', 'courgette', 'broccoli', 'carrot', 'kale', 'cabbage', 'leek', 'aubergine']],
  ['Produce', ['lemon', 'lime', 'avocado', 'onion', 'garlic', 'tomato', 'herb', 'coriander', 'apple', 'banana', 'berry']],
];

const guessCategory = (name: string): FridgeCategory => {
  const n = normalize(name);
  const hit = CATEGORY_KEYWORDS.find(([, words]) => words.some((w) => n.includes(w)));
  return hit ? hit[0] : 'Pantry';
};

export default function ManualAddModal() {
  const router = useRouter();
  const t = useTheme();
  const fridge = useFridgeStore((s) => s.items);
  const addMultipleItems = useFridgeStore((s) => s.addMultipleItems);
  const [query, setQuery] = useState('');
  const [drafts, setDrafts] = useState<DraftItem[]>([]);

  const suggestions = useMemo(() => {
    const q = normalize(query);
    return SUGGESTED.filter((s) => !drafts.some((d) => d.name === s.name)).filter((s) => !q || normalize(s.name).includes(q));
  }, [query, drafts]);

  const canAddCustom = query.trim().length > 1 && !suggestions.some((s) => normalize(s.name) === normalize(query)) && !drafts.some((d) => normalize(d.name) === normalize(query));

  const addDraft = (name: string, category: FridgeCategory) => {
    if (drafts.some((d) => namesMatch(d.name, name))) return;
    setDrafts((prev) => [...prev, { name, category, qty: 1, unit: category === 'Protein' || category === 'Dairy' ? 'g' : 'pcs' }]);
    setQuery('');
  };

  const bump = (name: string, delta: number) =>
    setDrafts((prev) =>
      prev
        .map((d) => {
          if (d.name !== name) return d;
          const step = d.unit === 'g' || d.unit === 'ml' ? 50 : 1;
          return { ...d, qty: d.qty + delta * step };
        })
        // Stepping below the minimum removes the row instead of clamping at 1.
        .filter((d) => d.qty > 0),
    );

  const cycleUnit = (name: string) =>
    setDrafts((prev) =>
      prev.map((d) => {
        if (d.name !== name) return d;
        const next = UNITS[(UNITS.indexOf(d.unit) + 1) % UNITS.length];
        const qty = next === 'g' || next === 'ml' ? Math.max(50, d.qty) : Math.max(1, Math.min(d.qty, 12));
        return { ...d, unit: next, qty };
      }),
    );

  const handleSave = () => {
    const { added, merged } = addMultipleItems(
      drafts.map((d) => ({
        name: d.name,
        category: d.category,
        quantity: `${d.qty} ${d.unit}`,
        daysToExpiry: d.category === 'Pantry' ? 60 : d.category === 'Dairy' ? 7 : d.category === 'Protein' ? 3 : 5,
      })),
    );
    if (router.canGoBack()) router.dismissTo(`/fridge?added=${added}&merged=${merged}`);
    else router.replace(`/fridge?added=${added}&merged=${merged}`);
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={[page, styles.scroll]} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Header title="Add food manually" leading="close" />

        <View style={[styles.search, { backgroundColor: t.card, borderColor: t.border }]}>
          <Search size={18} color={t.textMuted} />
          <TextInput
            placeholder="Search 4,000+ ingredients"
            placeholderTextColor={t.textMuted}
            value={query}
            onChangeText={setQuery}
            style={[styles.input, { color: t.text }]}
            returnKeyType="done"
            onSubmitEditing={() => canAddCustom && addDraft(query.trim(), guessCategory(query))}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')} hitSlop={8}>
              <X size={16} color={t.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.section}>
          <SectionTag>{query ? 'Matches' : 'Suggested for you'}</SectionTag>
          <View style={styles.chips}>
            {canAddCustom && (
              <TouchableOpacity onPress={() => addDraft(query.trim(), guessCategory(query))} style={[styles.chip, { backgroundColor: t.lime, borderColor: t.lime }]}>
                <Plus size={14} color={t.onLime} />
                <Text style={[styles.chipName, { color: t.onLime }]}>Add “{query.trim()}”</Text>
              </TouchableOpacity>
            )}
            {suggestions.map((s) => {
              const inFridge = fridge.some((f) => namesMatch(f.name, s.name));
              return (
                <TouchableOpacity key={s.name} onPress={() => addDraft(s.name, s.category)} style={[styles.chip, { backgroundColor: t.card, borderColor: t.border }]}>
                  <FoodIcon name={s.name} category={s.category} size={16} color={t.textMuted} />
                  <Text style={[styles.chipName, { color: t.textStrong }]}>{s.name}</Text>
                  {inFridge ? <Text style={[styles.chipHint, { color: t.textMuted }]}>top up</Text> : <Plus size={14} color={t.textMuted} />}
                </TouchableOpacity>
              );
            })}
            {suggestions.length === 0 && !canAddCustom && <Text style={{ color: t.textMuted, fontSize: fs(13) }}>Type at least two letters to add something new.</Text>}
          </View>
        </View>

        <View style={styles.section}>
          <SectionTag>Adding now</SectionTag>
          <Card style={{ gap: 0, paddingVertical: 4 }}>
            {drafts.length === 0 && (
              <Text style={[styles.emptyDraft, { color: t.textMuted }]}>Tap a suggestion or search to start a list.</Text>
            )}
            {drafts.map((d, idx) => {
              const inFridge = fridge.some((f) => namesMatch(f.name, d.name));
              return (
                <View key={d.name}>
                  <View style={styles.row}>
                    <View style={styles.rowLeft}>
                      <FoodTile name={d.name} category={d.category} size={38} />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.rowName, { color: t.textStrong }]}>{d.name}</Text>
                        <Text style={[styles.rowMeta, { color: t.textMuted }]}>
                          {d.category}{inFridge ? ' • already in fridge, will top up' : ''}
                        </Text>
                      </View>
                    </View>
                    <View style={[styles.stepper, { backgroundColor: t.cardAlt }]}>
                      <TouchableOpacity onPress={() => bump(d.name, -1)} hitSlop={8}>
                        {d.qty <= (d.unit === 'g' || d.unit === 'ml' ? 50 : 1) ? <X size={14} color={t.textMuted} /> : <Minus size={14} color={t.textMuted} />}
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => cycleUnit(d.name)} hitSlop={6}>
                        <Text style={[styles.stepperVal, { color: t.textStrong }]}>
                          {d.qty} {d.unit}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => bump(d.name, 1)} hitSlop={8}>
                        <Plus size={14} color={t.textMuted} />
                      </TouchableOpacity>
                    </View>
                  </View>
                  {idx < drafts.length - 1 && <Divider />}
                </View>
              );
            })}
          </Card>
          {drafts.length > 0 && <Text style={[styles.hint, { color: t.textMuted }]}>Tap the amount to change the unit.</Text>}
        </View>

        <Button label={drafts.length === 0 ? 'Save to fridge' : `Save ${plural(drafts.length, 'item')} to fridge`} variant="dark" onPress={handleSave} disabled={drafts.length === 0} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: 40, gap: 12 },
  search: { borderRadius: 24, paddingHorizontal: 16, height: 48, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1 },
  input: { fontSize: fs(14), flex: 1, paddingVertical: 0 },
  section: { gap: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 8 },
  chipName: { fontSize: fs(13), fontWeight: '600' },
  chipHint: { fontSize: fs(11), fontWeight: '600' },
  emptyDraft: { fontSize: fs(13), paddingVertical: 14, textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, gap: 10 },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  rowName: { fontWeight: '800', fontSize: fs(15) },
  rowMeta: { fontSize: fs(12), marginTop: 1 },
  stepper: { borderRadius: 16, paddingHorizontal: 12, paddingVertical: 7, flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepperVal: { fontSize: fs(13), fontWeight: '800', minWidth: 44, textAlign: 'center' },
  hint: { fontSize: fs(11), textAlign: 'center' },
});
