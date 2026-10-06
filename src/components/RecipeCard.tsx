import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StyleProp, ViewStyle } from 'react-native';
import { useRouter } from 'expo-router';
import { Bookmark } from './ui/lucide';
import { Recipe } from '../types';
import { useTheme, radius, fs, font } from '../theme';
import { useFridgeStore } from '../store/useFridgeStore';
import { useRecipeStore } from '../store/useRecipeStore';
import { computeMatch, plural } from '../lib/matching';
import { MediaPlaceholder } from './ui/MediaPlaceholder';
import { MatchBadge, Tag } from './ui';

interface Props {
  recipe: Recipe;
  /** 'carousel' = fixed width tile, 'grid' = half width, 'row' = horizontal list row */
  layout?: 'carousel' | 'grid' | 'row';
  style?: StyleProp<ViewStyle>;
  showBookmark?: boolean;
}

export const RecipeCard: React.FC<Props> = ({ recipe, layout = 'grid', style, showBookmark }) => {
  const t = useTheme();
  const router = useRouter();
  const fridge = useFridgeStore((s) => s.items);
  const savedIds = useRecipeStore((s) => s.savedRecipeIds);
  const toggleSave = useRecipeStore((s) => s.toggleSaveRecipe);
  const match = computeMatch(recipe, fridge);
  const isSaved = savedIds.includes(recipe.id);

  const open = () => router.push(`/recipe/${recipe.id}`);

  if (layout === 'row') {
    return (
      <TouchableOpacity activeOpacity={0.85} onPress={open} style={[styles.row, { backgroundColor: t.card, borderColor: t.border }, style]}>
        <MediaPlaceholder label={recipe.imageKey} uri={recipe.imageUrl} tone={recipe.tone} height={100} radius={16} style={{ width: 100 }} padding={6} />
        <View style={{ flex: 1, justifyContent: 'center', gap: 6 }}>
          <View style={styles.badgeRow}>
            <MatchBadge percent={match.matchPercent} />
            <Text style={[styles.meta, { color: t.textMuted }]}>
              {match.missingCount === 0 ? 'nothing missing' : `${plural(match.missingCount, 'item')} missing`}
            </Text>
          </View>
          <Text style={[styles.rowTitle, { color: t.textStrong }]} numberOfLines={2}>
            {recipe.title}
          </Text>
          <Text style={[styles.meta, { color: t.textMuted }]}>
            {recipe.prepTimeMin} min • {recipe.calories} kcal • {recipe.proteinG}g protein
          </Text>
        </View>
      </TouchableOpacity>
    );
  }

  const isCarousel = layout === 'carousel';
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={open}
      style={[styles.tile, isCarousel ? styles.tileCarousel : styles.tileGrid, { backgroundColor: t.card, borderColor: t.border }, style]}
    >
      <MediaPlaceholder label={recipe.imageKey} uri={recipe.imageUrl} tone={recipe.tone} height={isCarousel ? 120 : 110}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          {isCarousel ? <MatchBadge percent={match.matchPercent} onImage={false} /> : recipe.importedFrom ? <Tag label="↓ imported" tone="white" /> : <View />}
          {showBookmark && (
            <TouchableOpacity
              hitSlop={8}
              onPress={() => toggleSave(recipe.id)}
              style={[styles.bookmark, { backgroundColor: t.card }]}
            >
              <Bookmark size={14} color={t.textStrong} fill={isSaved ? t.textStrong : 'none'} />
            </TouchableOpacity>
          )}
        </View>
      </MediaPlaceholder>
      <View style={{ marginTop: 10, gap: 4 }}>
        <Text style={[styles.tileTitle, { color: t.textStrong }]} numberOfLines={2}>
          {recipe.title}
        </Text>
        <Text style={[styles.meta, { color: t.textMuted }]}>
          {isCarousel
            ? `${recipe.prepTimeMin} min • ${recipe.calories} kcal • ${recipe.proteinG}g P`
            : `${recipe.prepTimeMin} min • ${recipe.proteinG}g protein`}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  tile: { borderRadius: 20, padding: 12, borderWidth: 1 },
  tileCarousel: { width: 210, marginRight: 14 },
  tileGrid: { width: '47.5%' },
  tileTitle: { fontFamily: font.display, fontWeight: '400', fontSize: fs(16), lineHeight: fs(21)  },
  meta: { fontSize: fs(12) },
  bookmark: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  row: { borderRadius: radius.card, padding: 14, borderWidth: 1, flexDirection: 'row', gap: 14 },
  rowTitle: { fontFamily: font.display, fontWeight: '400', fontSize: fs(17), lineHeight: fs(22)  },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
