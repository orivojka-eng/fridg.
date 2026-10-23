import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { Search, Heart, MessageSquare, Send, X } from '../../src/components/ui/lucide';
import { useRecipeStore } from '../../src/store/useRecipeStore';
import { useFridgeStore } from '../../src/store/useFridgeStore';
import { useTheme, spacing, fs, font } from '../../src/theme';
import { Screen, IconButton, Pill, MatchBadge, Tag, Avatar, EmptyState, page } from '../../src/components/ui';
import { useUserStore } from '../../src/store/useUserStore';
import { MediaPlaceholder } from '../../src/components/ui/MediaPlaceholder';
import { computeMatch, normalize } from '../../src/lib/matching';
import { Recipe } from '../../src/types';

const CATEGORIES = ['For you', 'Trending', 'Following', 'Quick', 'High protein'] as const;
type Category = (typeof CATEGORIES)[number];

const formatCount = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k` : `${n}`);

export default function DiscoverScreen() {
  const router = useRouter();
  const t = useTheme();
  const recipes = useRecipeStore((s) => s.recipes);
  const savedIds = useRecipeStore((s) => s.savedRecipeIds);
  const likedIds = useRecipeStore((s) => s.likedRecipeIds);
  const followed = useRecipeStore((s) => s.followedAuthors);
  const toggleSave = useRecipeStore((s) => s.toggleSaveRecipe);
  const toggleLike = useRecipeStore((s) => s.toggleLikeRecipe);
  const toggleFollow = useRecipeStore((s) => s.toggleFollowAuthor);
  const fridge = useFridgeStore((s) => s.items);
  const profile = useUserStore((s) => s.profile);
  const avatarIndex = useUserStore((s) => s.avatarIndex);

  const [category, setCategory] = useState<Category>('For you');
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');

  const feed = useMemo(() => {
    let list: Recipe[] = recipes.filter((r) => r.authorName);
    switch (category) {
      case 'Trending':
        list = [...list].sort((a, b) => (b.likes ?? 0) - (a.likes ?? 0));
        break;
      case 'Following':
        list = list.filter((r) => r.authorName && followed.includes(r.authorName));
        break;
      case 'Quick':
        list = list.filter((r) => r.prepTimeMin <= 15);
        break;
      case 'High protein':
        list = list.filter((r) => r.proteinG >= 30);
        break;
      default:
        // "For you" = best fridge match first, then popularity.
        // Fridge match first, then what the Food Profile has learned (cuisines cooked/saved), then popularity.
        const signals = profile.foodProfile?.signals ?? {};
        const affinity = (r: Recipe) => (r.cuisine ? (signals[`cooked:${r.cuisine}`] ?? 0) * 3 + (signals[`saved:${r.cuisine}`] ?? 0) * 2 + (signals[`liked:${r.cuisine}`] ?? 0) : 0) + (profile.foodProfile?.cuisines?.includes(r.cuisine ?? "") ? 4 : 0);
        list = [...list].sort((a, b) => {
          const d = computeMatch(b, fridge).matchPercent - computeMatch(a, fridge).matchPercent;
          if (d !== 0) return d;
          const s = affinity(b) - affinity(a);
          return s !== 0 ? s : (b.likes ?? 0) - (a.likes ?? 0);
        });
    }
    const q = normalize(query);
    if (q) {
      list = list.filter((r) => normalize(r.title).includes(q) || normalize(r.authorName ?? '').includes(q) || normalize(r.cuisine ?? '').includes(q));
    }
    return list;
  }, [recipes, category, followed, fridge, query, profile.foodProfile]);

  return (
    <Screen animated={false} fadeOnFocus>
      <ScrollView contentContainerStyle={[page, styles.scroll]} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          {searchOpen ? (
            <View style={[styles.searchBar, { backgroundColor: t.card, borderColor: t.border }]}>
              <Search size={16} color={t.textMuted} />
              <TextInput
                autoFocus
                placeholder="Search creators, dishes, cuisines"
                placeholderTextColor={t.textMuted}
                value={query}
                onChangeText={setQuery}
                style={[styles.searchInput, { color: t.text }]}
                returnKeyType="search"
              />
              <TouchableOpacity hitSlop={8} onPress={() => { setQuery(''); setSearchOpen(false); }}>
                <X size={16} color={t.textMuted} />
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <Text style={[styles.title, { color: t.text }]}>Discover</Text>
              <IconButton onPress={() => setSearchOpen(true)}>
                <Search size={18} color={t.textStrong} />
              </IconButton>
            </>
          )}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {CATEGORIES.map((cat) => (
            <Pill key={cat} label={cat} selected={category === cat} onPress={() => setCategory(cat)} />
          ))}
        </ScrollView>

        {feed.length === 0 && (
          <EmptyState
            emoji="🔍"
            title={category === 'Following' ? 'You are not following anyone yet' : 'Nothing here yet'}
            message={
              category === 'Following'
                ? 'Follow a creator from any recipe to build your feed.'
                : 'Try another filter or clear your search.'
            }
          />
        )}

        {feed.map((r) => {
          const match = computeMatch(r, fridge);
          const isFollowing = followed.includes(r.authorName!);
          const isSaved = savedIds.includes(r.id);
          const isLiked = likedIds.includes(r.id);
          const likeCount = (r.likes ?? 0) + (isLiked ? 1 : 0);
          return (
            <View key={r.id} style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
              <View style={styles.authorRow}>
                <View style={styles.authorInfo}>
                  <Avatar name={r.authorName!} index={r.authorHandle === profile.handle ? avatarIndex : undefined} size={38} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.authorName, { color: t.textStrong }]}>{r.authorName}</Text>
                    <Text style={[styles.authorSub, { color: t.textMuted }]} numberOfLines={1}>{r.authorTag}</Text>
                  </View>
                </View>
                <Pill small label={isFollowing ? 'Following' : 'Follow'} selected={!isFollowing} onPress={() => toggleFollow(r.authorName!)} />
              </View>

              <TouchableOpacity activeOpacity={0.9} onPress={() => router.push(`/recipe/${r.id}`)}>
                <MediaPlaceholder label={r.imageKey} uri={r.imageUrl} tone={r.tone} height={180} radius={16} padding={10}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    {r.importedFrom ? <Tag label="↓ imported" tone="white" /> : <View />}
                    <MatchBadge percent={match.matchPercent} suffix="you have" onImage />
                  </View>
                </MediaPlaceholder>
                <Text style={[styles.cardTitle, { color: t.textStrong }]}>{r.title}</Text>
                {r.description ? <Text style={[styles.cardDesc, { color: t.textSoft }]}>{r.description}</Text> : null}
              </TouchableOpacity>

              <View style={styles.footer}>
                <View style={styles.engagement}>
                  <TouchableOpacity style={styles.engageItem} onPress={() => toggleLike(r.id)} hitSlop={6}>
                    <Heart size={18} color={isLiked ? t.red : t.textMuted} fill={isLiked ? t.red : 'none'} />
                    <Text style={[styles.engageText, { color: t.textStrong }]}>{formatCount(likeCount)}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.engageItem} onPress={() => router.push(`/recipe/${r.id}`)} hitSlop={6}>
                    <MessageSquare size={18} color={t.textMuted} />
                    <Text style={[styles.engageText, { color: t.textStrong }]}>{r.comments ?? 0}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.engageItem} onPress={() => router.push(`/social/import?url=${encodeURIComponent(r.sourceUrl ?? '')}`)} hitSlop={6}>
                    <Send size={18} color={t.textMuted} />
                  </TouchableOpacity>
                </View>
                <Pill small variant="lime" label={isSaved ? 'Saved' : 'Save'} selected={isSaved} onPress={() => toggleSave(r.id)} />
              </View>
            </View>
          );
        })}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.tabBarClearance, gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 40 },
  title: { fontFamily: font.display, fontSize: fs(30), fontWeight: '400', letterSpacing: -0.5  },
  searchBar: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 20, borderWidth: 1, paddingHorizontal: 14, height: 40 },
  searchInput: { flex: 1, fontSize: fs(14), paddingVertical: 0 },
  card: { borderRadius: 24, padding: 16, borderWidth: 1, gap: 12 },
  authorRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  authorInfo: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  authorName: { fontWeight: '800', fontSize: fs(14) },
  authorSub: { fontSize: fs(12) },
  cardTitle: { fontFamily: font.display, fontSize: fs(18), fontWeight: '400', marginTop: 12  },
  cardDesc: { fontSize: fs(13), lineHeight: fs(18), marginTop: 4 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  engagement: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  engageItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  engageText: { fontSize: fs(13), fontWeight: '700' },
});
