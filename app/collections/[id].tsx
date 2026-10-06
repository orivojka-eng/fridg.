import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Plus, Check } from '../../src/components/ui/lucide';
import { useRecipeStore } from '../../src/store/useRecipeStore';
import { useTheme, fs } from '../../src/theme';
import { Screen, Header, EmptyState, Button, Card, SectionTag } from '../../src/components/ui';
import { RecipeCard } from '../../src/components/RecipeCard';
import { plural } from '../../src/lib/matching';
import { Recipe } from '../../src/types';

export default function CollectionDetailScreen() {
  const router = useRouter();
  const t = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { collections, recipes, savedRecipeIds, addRecipeToCollection } = useRecipeStore();
  const [picking, setPicking] = useState(false);

  const collection = collections.find((c) => c.id === id);
  if (!collection) {
    return (
      <Screen>
        <View style={{ padding: 20 }}>
          <Header title="Collection" />
        </View>
        <EmptyState emoji="📁" title="Collection not found" action={<Button label="Back to collections" variant="dark" onPress={() => router.replace('/collections')} />} />
      </Screen>
    );
  }

  const inside = collection.recipeIds.map((rid) => recipes.find((r) => r.id === rid)).filter((r): r is Recipe => !!r);
  const candidates = recipes.filter((r) => savedRecipeIds.includes(r.id) && !collection.recipeIds.includes(r.id));

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Header
          title={collection.title}
          subtitle={`${plural(inside.length, 'recipe')} • ${collection.tagline}`}
          right={
            candidates.length > 0 ? (
              <TouchableOpacity style={[styles.addBtn, { backgroundColor: t.dark }]} onPress={() => setPicking((v) => !v)}>
                <Text style={[styles.addText, { color: t.onDark }]}>{picking ? 'Done' : 'Add'}</Text>
                {!picking && <Plus size={16} color={t.lime} />}
              </TouchableOpacity>
            ) : undefined
          }
        />

        {picking && (
          <Card style={{ gap: 10 }}>
            <SectionTag>From your saved recipes</SectionTag>
            {candidates.map((r) => (
              <TouchableOpacity key={r.id} style={styles.pickRow} onPress={() => addRecipeToCollection(collection.id, r.id)}>
                <Text style={[styles.pickTitle, { color: t.textStrong }]} numberOfLines={1}>{r.title}</Text>
                <View style={[styles.pickIcon, { backgroundColor: t.lime }]}>
                  <Plus size={14} color={t.onLime} />
                </View>
              </TouchableOpacity>
            ))}
            {candidates.length === 0 && (
              <View style={styles.pickRow}>
                <Check size={16} color={t.green} />
                <Text style={{ color: t.textMuted, fontSize: fs(13) }}>Everything you've saved is already here.</Text>
              </View>
            )}
          </Card>
        )}

        {inside.length === 0 ? (
          <EmptyState emoji="📂" title="This collection is empty" message="Add recipes from your saved list to fill it." action={candidates.length > 0 ? <Button label="Add recipes" variant="dark" onPress={() => setPicking(true)} /> : undefined} />
        ) : (
          <View style={styles.grid}>
            {inside.map((r) => (
              <RecipeCard key={r.id} recipe={r} layout="grid" showBookmark />
            ))}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40, gap: 12 },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20 },
  addText: { fontSize: fs(14), fontWeight: '800' },
  pickRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingVertical: 6 },
  pickTitle: { fontWeight: '700', fontSize: fs(14), flex: 1 },
  pickIcon: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, justifyContent: 'space-between' },
});
