import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { RefreshCw } from '../../src/components/ui/lucide';
import { useRecipeStore } from '../../src/store/useRecipeStore';
import { useFridgeStore } from '../../src/store/useFridgeStore';
import { useUserStore } from '../../src/store/useUserStore';
import { useTheme, fs } from '../../src/theme';
import { Screen, Header, EmptyState, Button, Tag } from '../../src/components/ui';
import { RecipeCard } from '../../src/components/RecipeCard';
import { ingredientInFridge, namesMatch, plural, sortByMatch } from '../../src/lib/matching';

export default function ResultsScreen() {
  const router = useRouter();
  const t = useTheme();
  const { use } = useLocalSearchParams<{ use?: string }>();
  const recipes = useRecipeStore((s) => s.recipes);
  const lastGeneration = useRecipeStore((s) => s.lastGeneration);
  const fridge = useFridgeStore((s) => s.items);
  const profile = useUserStore((s) => s.profile);

  const { list, title, subtitle, mode } = useMemo(() => {
    if (use) {
      const matching = sortByMatch(
        recipes.filter((r) => r.ingredients.some((i) => namesMatch(i.name, use))),
        fridge,
      );
      return {
        mode: 'use' as const,
        list: matching,
        title: `Use up your ${use.toLowerCase()}`,
        subtitle: matching.length ? `${plural(matching.length, 'recipe')} use it${ingredientInFridge(use, fridge) ? '' : ' — not in your fridge right now'}` : 'No recipes use it yet',
      };
    }
    if (lastGeneration) {
      const generated = lastGeneration.recipeIds.map((id) => recipes.find((r) => r.id === id)).filter((r): r is NonNullable<typeof r> => !!r);
      const prefs = [
        ...profile.diet.filter((d) => d !== 'No restrictions'),
        `under ${profile.cookingTimeMin} min`,
        ...profile.allergies.map((a) => `no ${a.toLowerCase()}`),
      ];
      return { mode: 'generated' as const, list: generated, title: `${plural(generated.length, 'recipe')} for you`, subtitle: prefs.join(' • ') };
    }
    const all = sortByMatch(recipes, fridge);
    return { mode: 'all' as const, list: all, title: 'Ready to cook', subtitle: 'Sorted by what\'s already in your fridge' };
  }, [use, recipes, lastGeneration, fridge, profile]);

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Header
          title={title}
          subtitle={subtitle}
          right={
            mode === 'generated' ? (
              <TouchableOpacity style={[styles.regen, { backgroundColor: t.card, borderColor: t.border }]} onPress={() => router.back()} hitSlop={6}>
                <RefreshCw size={14} color={t.textStrong} />
                <Text style={[styles.regenText, { color: t.textStrong }]}>Tweak</Text>
              </TouchableOpacity>
            ) : undefined
          }
        />

        {mode === 'generated' && lastGeneration && (
          <View style={styles.context}>
            {lastGeneration.prompt ? <Tag label={`“${lastGeneration.prompt}”`} tone="lime" /> : null}
            <Tag label={`${lastGeneration.servings} serving${lastGeneration.servings === 1 ? '' : 's'}`} />
            <Tag label={lastGeneration.effort} />
            <Tag label={lastGeneration.style} />
            <Tag label={`${lastGeneration.ingredientNames.length} ingredients`} />
          </View>
        )}

        {list.length === 0 ? (
          <EmptyState
            emoji="🥣"
            title="No recipes to show"
            message={mode === 'use' ? 'Try generating something around it instead.' : 'Add a few items to your fridge and try again.'}
            action={<Button label="Open the generator" variant="dark" onPress={() => router.push('/recipe/generate')} />}
          />
        ) : (
          <View style={styles.list}>
            {list.map((r) => (
              <RecipeCard key={r.id} recipe={r} layout="row" />
            ))}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40, gap: 12 },
  regen: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 7 },
  regenText: { fontSize: fs(12), fontWeight: '700' },
  context: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  list: { gap: 14 },
});
