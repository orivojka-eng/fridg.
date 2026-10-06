import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Share, Linking } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, Bookmark, Send, Plus, Play, Check } from '../../src/components/ui/lucide';
import { useRecipeStore } from '../../src/store/useRecipeStore';
import { useFridgeStore } from '../../src/store/useFridgeStore';
import { useCookingStore } from '../../src/store/useCookingStore';
import { useShoppingStore } from '../../src/store/useShoppingStore';
import { useTheme, fs, font } from '../../src/theme';
import { Screen, IconButton, Tag, MatchBadge, Avatar, FoodIcon, EmptyState, Button, SectionTitle } from '../../src/components/ui';
import { useUserStore } from '../../src/store/useUserStore';
import { MediaPlaceholder } from '../../src/components/ui/MediaPlaceholder';
import { computeMatch, joinNatural, recipeTags } from '../../src/lib/matching';

export default function RecipeDetailScreen() {
  const router = useRouter();
  const t = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const recipe = useRecipeStore((s) => s.recipes.find((r) => r.id === id));
  const savedIds = useRecipeStore((s) => s.savedRecipeIds);
  const followed = useRecipeStore((s) => s.followedAuthors);
  const toggleSave = useRecipeStore((s) => s.toggleSaveRecipe);
  const toggleFollow = useRecipeStore((s) => s.toggleFollowAuthor);
  const fridge = useFridgeStore((s) => s.items);
  const startCooking = useCookingStore((s) => s.startCooking);
  const addMissingIngredients = useShoppingStore((s) => s.addMissingIngredients);
  const shoppingItems = useShoppingStore((s) => s.items);
  const profile = useUserStore((s) => s.profile);
  const avatarIndex = useUserStore((s) => s.avatarIndex);
  const [justAdded, setJustAdded] = useState(false);

  const match = useMemo(() => (recipe ? computeMatch(recipe, fridge) : null), [recipe, fridge]);

  const back = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)'));

  if (!recipe || !match) {
    return (
      <Screen>
        <View style={{ padding: 20 }}>
          <IconButton onPress={back}>
            <ChevronLeft size={20} color={t.textStrong} />
          </IconButton>
        </View>
        <EmptyState emoji="🍽️" title="Recipe not found" message="It may have been removed. Head back and pick another." action={<Button label="Back to recipes" variant="dark" onPress={back} />} />
      </Screen>
    );
  }

  const isSaved = savedIds.includes(recipe.id);
  const isFollowing = !!recipe.authorName && followed.includes(recipe.authorName);
  const tags = recipeTags(recipe);
  const missingNames = match.missing.map((m) => m.name.toLowerCase());
  const missingInList = match.missing.filter((m) => shoppingItems.some((s) => s.name.toLowerCase() === m.name.toLowerCase()));
  const allMissingListed = match.missing.length > 0 && missingInList.length === match.missing.length;

  const handleAddMissing = () => {
    addMissingIngredients(match.missing, `Missing • ${recipe.title}`);
    setJustAdded(true);
  };

  const handleStartCooking = () => {
    startCooking(recipe);
    router.push(`/recipe/cooking/${recipe.id}`);
  };

  const handleShare = () => {
    Share.share({
      title: recipe.title,
      message: `${recipe.title} — ${recipe.prepTimeMin} min, ${recipe.proteinG}g protein. ${recipe.sourceUrl ?? 'Cooked with FRIDGR.'}`,
    }).catch(() => undefined);
  };

  return (
    <Screen edges={[]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <MediaPlaceholder uri={recipe.imageUrl} tone={recipe.tone} height={320} radius={0} padding={0} scrim>
          <Screen edges={['top']} style={{ backgroundColor: 'transparent' }}>
            <View style={styles.heroBar}>
              <IconButton onPress={back}>
                <ChevronLeft size={20} color={t.textStrong} />
              </IconButton>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <IconButton filled={isSaved} onPress={() => toggleSave(recipe.id)}>
                  <Bookmark size={18} color={t.textStrong} fill={isSaved ? t.textStrong : 'none'} />
                </IconButton>
                <IconButton onPress={handleShare}>
                  <Send size={18} color={t.textStrong} />
                </IconButton>
              </View>
            </View>
          </Screen>
        </MediaPlaceholder>

        <View style={[styles.sheet, { backgroundColor: t.card }]}>
          <View style={styles.badges}>
            <MatchBadge percent={match.matchPercent} />
            {tags.slice(0, 2).map((tag) => (
              <Tag key={tag} label={tag} />
            ))}
            {recipe.importedFrom && <Tag label={`↓ ${recipe.importedFrom}`} tone="sage" />}
          </View>

          <Text style={[styles.title, { color: t.textStrong }]}>{recipe.title}</Text>
          {recipe.description ? <Text style={[styles.description, { color: t.textSoft }]}>{recipe.description}</Text> : null}

          {(recipe.videoUrl || recipe.sourceUrl) && (
            <View style={styles.sourceRow}>
              {recipe.videoUrl ? <Button label="Watch the video" variant="outline" size="sm" onPress={() => Linking.openURL(recipe.videoUrl!)} left={<Play size={12} color={t.textStrong} />} /> : null}
              {recipe.sourceUrl ? <Button label={recipe.importedFrom ? `Original on ${recipe.importedFrom}` : 'Original recipe'} variant="outline" size="sm" onPress={() => Linking.openURL(recipe.sourceUrl!)} /> : null}
            </View>
          )}

          {recipe.authorName && (
            <View style={styles.authorRow}>
              <View style={styles.authorInfo}>
                <Avatar name={recipe.authorName} index={recipe.authorHandle === profile.handle ? avatarIndex : undefined} size={30} />
                <Text style={[styles.authorText, { color: t.textMuted }]}>
                  <Text style={{ color: t.textStrong, fontWeight: '800' }}>{recipe.authorName}</Text>
                  {recipe.authorRating ? ` • ${recipe.authorRating}` : ''}
                </Text>
              </View>
              <TouchableOpacity onPress={() => toggleFollow(recipe.authorName!)} hitSlop={8}>
                <Text style={[styles.follow, { color: isFollowing ? t.textMuted : t.green }]}>{isFollowing ? 'Following' : 'Follow'}</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.macros}>
            {[
              { val: recipe.calories, label: 'kcal' },
              { val: `${recipe.proteinG}g`, label: 'protein' },
              { val: `${recipe.carbsG}g`, label: 'carbs' },
              { val: `${recipe.fatG}g`, label: 'fat' },
            ].map((m) => (
              <View key={m.label} style={[styles.macro, { backgroundColor: t.cardAlt }]}>
                <Text style={[styles.macroVal, { color: t.textStrong }]}>{m.val}</Text>
                <Text style={[styles.macroLabel, { color: t.textMuted }]}>{m.label}</Text>
              </View>
            ))}
          </View>

          <View style={styles.section}>
            <SectionTitle
              right={
                <Text style={[styles.inFridge, { color: t.textMuted }]}>
                  {match.total === 0 ? 'No ingredients listed' : `${match.have.length} of ${match.total} in your fridge`}
                </Text>
              }
            >
              Ingredients
            </SectionTitle>
            {recipe.ingredients.length === 0 ? (
              <Text style={{ color: t.textMuted, fontSize: fs(13) }}>This recipe has no ingredient list yet.</Text>
            ) : (
              <View style={[styles.ingredientsCard, { backgroundColor: t.cardAlt }]}>
                {recipe.ingredients.map((ing, idx) => {
                  const have = !missingNames.includes(ing.name.toLowerCase());
                  return (
                    <View key={ing.id} style={[styles.ingRow, idx < recipe.ingredients.length - 1 && { borderBottomWidth: 1, borderBottomColor: t.isDark ? t.border : t.card }]}>
                      <View style={styles.ingLeft}>
                        <View style={[styles.dotOuter, { backgroundColor: have ? t.sage : t.peach }]}>
                          <FoodIcon name={ing.name} size={15} color={have ? t.green : t.orange} strokeWidth={2} />
                        </View>
                        <Text style={[styles.ingName, { color: t.textStrong }]}>
                          {ing.name}
                          {ing.isOptional ? <Text style={{ color: t.textMuted, fontWeight: '500' }}> (optional)</Text> : null}
                        </Text>
                      </View>
                      <Text style={[styles.ingAmount, { color: t.textMuted }]}>{ing.amount}</Text>
                    </View>
                  );
                })}
              </View>
            )}
          </View>

          {match.missing.length > 0 && (
            <View style={[styles.missing, { backgroundColor: t.peach, borderColor: t.peachBorder }]}>
              <Text style={[styles.missingText, { color: t.orange }]}>
                Missing {joinNatural(match.missing.map((m) => m.name.toLowerCase()))} —{' '}
                {justAdded || allMissingListed ? 'on your shopping list' : `add ${match.missing.length === 1 ? 'it' : match.missing.length === 2 ? 'both' : 'all'} to your shopping list`}
              </Text>
              {justAdded || allMissingListed ? (
                <TouchableOpacity style={[styles.missingBtn, { backgroundColor: t.card }]} onPress={() => router.push('/shopping')}>
                  <Check size={14} color={t.green} />
                  <Text style={[styles.missingBtnText, { color: t.green }]}>View</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={[styles.missingBtn, { backgroundColor: t.orange }]} onPress={handleAddMissing}>
                  <Text style={[styles.missingBtnText, { color: '#FFFFFF' }]}>Add</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          <TouchableOpacity style={[styles.adapt, { backgroundColor: t.dark, borderColor: t.border, borderWidth: t.isDark ? 1 : 0 }]} onPress={() => router.push(`/recipe/adapt?id=${recipe.id}`)} activeOpacity={0.85}>
            <View style={[styles.plusCircle, { backgroundColor: t.lime }]}>
              <Plus size={20} color={t.onLime} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.adaptTitle, { color: t.onDark }]}>Adapt to my fridge</Text>
              <Text style={[styles.adaptSub, { color: t.textMuted }]}>
                {match.missing.length > 0 ? `Swap ${match.missing.length === 1 ? 'the missing item' : 'missing items'} • ` : ''}make it higher protein
              </Text>
            </View>
          </TouchableOpacity>

          <View style={styles.section}>
            <SectionTitle>Method</SectionTitle>
            {recipe.steps.length === 0 ? (
              <Text style={{ color: t.textMuted, fontSize: fs(13) }}>No steps yet — this recipe can't be cooked in cooking mode.</Text>
            ) : (
              <View style={styles.steps}>
                {recipe.steps.map((step) => (
                  <View key={step.stepNumber} style={styles.stepRow}>
                    <View style={[styles.stepNum, { backgroundColor: t.cardAlt }]}>
                      <Text style={[styles.stepNumText, { color: t.textStrong }]}>{step.stepNumber}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.stepText, { color: t.isDark ? t.textSoft : '#333333' }]}>{step.instruction}</Text>
                      {step.timerSec ? <Text style={[styles.stepTimer, { color: t.textMuted }]}>Timer · {Math.round(step.timerSec / 60)} min</Text> : null}
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      <View style={styles.sticky}>
        <Button
          label={recipe.steps.length === 0 ? 'No steps to cook' : 'Start cooking mode'}
          onPress={handleStartCooking}
          disabled={recipe.steps.length === 0}
          style={[styles.cta, { shadowColor: t.lime }]}
          right={
            <View style={[styles.playCircle, { backgroundColor: t.dark }]}>
              <Play size={12} color={t.lime} fill={t.lime} />
            </View>
          }
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  sourceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  scroll: { paddingBottom: 110 },
  heroBar: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 12 },
  sheet: { marginTop: -32, borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingHorizontal: 20, paddingTop: 24, gap: 18 },
  badges: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  title: { fontFamily: font.display, fontSize: fs(25), fontWeight: '400', lineHeight: fs(30), letterSpacing: -0.5  },
  description: { fontSize: fs(14), lineHeight: fs(20), marginTop: -8 },
  authorRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  authorInfo: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  authorText: { fontSize: fs(13), fontWeight: '600' },
  follow: { fontSize: fs(13), fontWeight: '700' },
  macros: { flexDirection: 'row', gap: 8 },
  macro: { flex: 1, borderRadius: 16, paddingVertical: 12, alignItems: 'center' },
  macroVal: { fontFamily: font.display, fontWeight: '400', fontSize: fs(18)  },
  macroLabel: { fontSize: fs(11), marginTop: 2 },
  section: { gap: 12 },
  inFridge: { fontSize: fs(12) },
  ingredientsCard: { borderRadius: 24, paddingHorizontal: 16, paddingVertical: 4 },
  ingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 11 },
  ingLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  dotOuter: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 7, height: 7, borderRadius: 4 },
  ingName: { fontWeight: '700', fontSize: fs(14) },
  ingAmount: { fontSize: fs(13), fontWeight: '600' },
  missing: { borderRadius: 20, padding: 16, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  missingText: { fontSize: fs(13), fontWeight: '600', flex: 1, lineHeight: fs(18) },
  missingBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, flexDirection: 'row', alignItems: 'center', gap: 4 },
  missingBtnText: { fontWeight: '800', fontSize: fs(13) },
  adapt: { borderRadius: 24, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14 },
  plusCircle: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  adaptTitle: { fontWeight: '800', fontSize: fs(15) },
  adaptSub: { fontSize: fs(12), marginTop: 2 },
  steps: { gap: 16 },
  stepRow: { flexDirection: 'row', gap: 14 },
  stepNum: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  stepNumText: { fontWeight: '800', fontSize: fs(13) },
  stepText: { fontSize: fs(14), lineHeight: fs(21) },
  stepTimer: { fontSize: fs(11), marginTop: 4, fontWeight: '600' },
  sticky: { position: 'absolute', bottom: 24, left: 20, right: 20 },
  cta: { shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.45, shadowRadius: 10, elevation: 8 },
  playCircle: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
