import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronRight, Plus, X } from '../../src/components/ui/lucide';
import { useRecipeStore } from '../../src/store/useRecipeStore';
import { useTheme, fs, font } from '../../src/theme';
import { Screen, Header, Button } from '../../src/components/ui';
import { plural } from '../../src/lib/matching';
import { Recipe } from '../../src/types';

/** 3-thumb collage that borrows the tones of the recipes inside. */
const Collage: React.FC<{ recipes: Recipe[] }> = ({ recipes }) => {
  const t = useTheme();
  const tone = (i: number) => {
    const r = recipes[i];
    const key = r?.tone ?? (['cream', 'sage', 'blush'] as const)[i % 3];
    return key === 'sage' ? t.sage : key === 'blush' ? t.blush : t.cream;
  };
  return (
    <View style={styles.collage}>
      <View style={[styles.thumbBig, { backgroundColor: tone(0) }]} />
      <View style={{ gap: 2 }}>
        <View style={[styles.thumbSmall, { backgroundColor: tone(1), borderTopRightRadius: 8 }]} />
        <View style={[styles.thumbSmall, { backgroundColor: tone(2), borderBottomRightRadius: 8 }]} />
      </View>
    </View>
  );
};

export default function CollectionsScreen() {
  const router = useRouter();
  const t = useTheme();
  const { collections, recipes, addCollection } = useRecipeStore();
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');

  const create = () => {
    const clean = title.trim();
    if (clean.length < 2) return;
    const created = addCollection(clean);
    setTitle('');
    setCreating(false);
    router.push(`/collections/${created.id}`);
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Header title="Collections" subtitle={plural(collections.length, 'collection')} />

        <View style={styles.list}>
          {collections.map((col) => {
            const inside = col.recipeIds.map((id) => recipes.find((r) => r.id === id)).filter((r): r is Recipe => !!r);
            return (
              <TouchableOpacity key={col.id} activeOpacity={0.85} style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]} onPress={() => router.push(`/collections/${col.id}`)}>
                <View style={styles.cardLeft}>
                  <Collage recipes={inside} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.title, { color: t.textStrong }]}>{col.title}</Text>
                    <Text style={[styles.sub, { color: t.textMuted }]}>
                      {plural(inside.length, 'recipe')} • {col.tagline}
                    </Text>
                  </View>
                </View>
                <ChevronRight size={18} color={t.textMuted} />
              </TouchableOpacity>
            );
          })}

          {creating ? (
            <View style={[styles.card, { backgroundColor: t.card, borderColor: t.lime, borderWidth: 2, gap: 10, flexDirection: 'column', alignItems: 'stretch' }]}>
              <View style={styles.inputRow}>
                <TextInput autoFocus value={title} onChangeText={setTitle} placeholder="Collection name" placeholderTextColor={t.textMuted} style={[styles.input, { color: t.textStrong, backgroundColor: t.cardAlt }]} onSubmitEditing={create} returnKeyType="done" />
                <TouchableOpacity onPress={() => { setCreating(false); setTitle(''); }} hitSlop={8}>
                  <X size={18} color={t.textMuted} />
                </TouchableOpacity>
              </View>
              <Button label="Create collection" variant="dark" size="sm" onPress={create} disabled={title.trim().length < 2} />
            </View>
          ) : (
            <TouchableOpacity style={[styles.newBtn, { borderColor: t.border }]} onPress={() => setCreating(true)}>
              <Plus size={16} color={t.textMuted} />
              <Text style={[styles.newText, { color: t.textMuted }]}>New collection</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40, gap: 12 },
  list: { gap: 14 },
  card: { borderRadius: 24, padding: 16, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardLeft: { flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 },
  collage: { width: 64, height: 64, flexDirection: 'row', gap: 2 },
  thumbBig: { flex: 1, borderTopLeftRadius: 8, borderBottomLeftRadius: 8 },
  thumbSmall: { width: 28, height: 31 },
  title: { fontFamily: font.display, fontWeight: '400', fontSize: fs(18)  },
  sub: { fontSize: fs(12), marginTop: 2 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  input: { flex: 1, borderRadius: 14, paddingHorizontal: 12, height: 42, fontSize: fs(15), fontWeight: '700' },
  newBtn: { borderWidth: 2, borderStyle: 'dashed', borderRadius: 24, padding: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  newText: { fontWeight: '700', fontSize: fs(14) },
});
