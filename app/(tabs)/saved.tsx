import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowRight } from '../../src/components/ui/lucide';
import { useRecipeStore } from '../../src/store/useRecipeStore';
import { useTheme, spacing, fs, font } from '../../src/theme';
import { Screen, Pill, EmptyState, Button, page } from '../../src/components/ui';
import { RecipeCard } from '../../src/components/RecipeCard';

const FILTERS = ['All', 'Imported', 'Made before', 'To try'] as const;
type Filter = (typeof FILTERS)[number];

export default function SavedScreen() {
  const router = useRouter();
  const t = useTheme();
  const recipes = useRecipeStore((s) => s.recipes);
  const savedIds = useRecipeStore((s) => s.savedRecipeIds);
  const madeIds = useRecipeStore((s) => s.madeRecipeIds);
  const [filter, setFilter] = useState<Filter>('All');

  const list = useMemo(() => {
    const saved = recipes.filter((r) => savedIds.includes(r.id));
    switch (filter) {
      case 'Imported':
        return saved.filter((r) => !!r.importedFrom);
      case 'Made before':
        return saved.filter((r) => madeIds.includes(r.id));
      case 'To try':
        return saved.filter((r) => !madeIds.includes(r.id));
      default:
        return saved;
    }
  }, [recipes, savedIds, madeIds, filter]);

  return (
    <Screen animated={false} fadeOnFocus>
      <ScrollView contentContainerStyle={[page, styles.scroll]} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: t.text }]}>Saved</Text>
          <TouchableOpacity style={styles.collectionsLink} onPress={() => router.push('/collections')} hitSlop={8}>
            <Text style={[styles.collectionsText, { color: t.green }]}>Collections</Text>
            <ArrowRight size={16} color={t.green} />
          </TouchableOpacity>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {FILTERS.map((f) => (
            <Pill key={f} label={f} selected={filter === f} onPress={() => setFilter(f)} />
          ))}
        </ScrollView>

        {list.length === 0 ? (
          <EmptyState
            emoji="🔖"
            title={filter === 'All' ? 'No saved recipes yet' : `Nothing under “${filter}”`}
            message={
              filter === 'Made before'
                ? 'Finish a recipe in cooking mode and it will show up here.'
                : filter === 'Imported'
                  ? 'Paste a TikTok, Reel or Short and save the extracted recipe.'
                  : 'Tap the bookmark on any recipe to keep it here.'
            }
            action={<Button label={filter === 'Imported' ? 'Import from a video' : 'Discover recipes'} variant="dark" onPress={() => router.push(filter === 'Imported' ? '/social/import' : '/(tabs)/discover')} />}
          />
        ) : (
          <View style={styles.grid}>
            {list.map((r) => (
              <RecipeCard key={r.id} recipe={r} layout="grid" showBookmark />
            ))}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.tabBarClearance, gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 40 },
  title: { fontFamily: font.display, fontSize: fs(30), fontWeight: '400', letterSpacing: -0.5  },
  collectionsLink: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  collectionsText: { fontSize: fs(14), fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, justifyContent: 'space-between' },
});
