import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert } from 'react-native';
import { env } from '../../src/config/env';
import { recipesApi, type ImportFoundVia } from '../../src/api/recipes';
import * as ImagePicker from 'expo-image-picker';
import { PermissionPrimer } from '../../src/components/PermissionPrimer';
import { errorMessage } from '../../src/api/client';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Link2, X, Check } from '../../src/components/ui/lucide';
import { useShoppingStore } from '../../src/store/useShoppingStore';
import { useRecipeStore, findSubstitution } from '../../src/store/useRecipeStore';
import { useFridgeStore } from '../../src/store/useFridgeStore';
import { useTheme, fs, font } from '../../src/theme';
import { Screen, Header, SectionTag, Card, Pill, Button, Tag, Divider } from '../../src/components/ui';
import { ProcessingOverlay } from '../../src/components/ProcessingOverlay';
import { Video, Mic, Captions, Eye, ListChecks, NotebookPen, Utensils, ScanSearch } from '../../src/components/ui/lucide';

import { MediaPlaceholder } from '../../src/components/ui/MediaPlaceholder';
import { computeMatch, joinNatural, plural } from '../../src/lib/matching';
import { ImportSource, Recipe } from '../../src/types';

const IMPORT_ICONS = [Link2, Video, Mic, Captions, Eye, ListChecks, NotebookPen, Utensils];

interface MediaItem {
  uri: string;
  kind: 'video' | 'image';
  mimeType: string;
  size: number;
}

let mediaPrimerSeen = false;

const FOUND_VIA_LABEL: Record<ImportFoundVia, string> = {
  page_data: 'FULL RECIPE FROM THE PAGE',
  linked_page: "FROM THE CREATOR'S RECIPE PAGE",
  video: 'WATCHED THE VIDEO',
  user_video: 'WATCHED YOUR SAVED VIDEO',
  screenshots: 'READ YOUR SCREENSHOTS',
  caption: 'FROM THE CAPTION',
  pasted_text: 'FROM YOUR TEXT',
};
const EXTRACT_MS = 2600;

const PLATFORMS: Array<{ name: ImportSource; hosts: string[]; example: string }> = [
  { name: 'TikTok', hosts: ['tiktok.com'], example: 'https://tiktok.com/@kitchenbysam/video/7421' },
  { name: 'Instagram', hosts: ['instagram.com'], example: 'https://instagram.com/reel/CxZ2k1' },
  { name: 'YouTube', hosts: ['youtube.com', 'youtu.be'], example: 'https://youtube.com/shorts/dQw4w9' },
  { name: 'Facebook', hosts: ['facebook.com', 'fb.watch'], example: 'https://fb.watch/xyz123' },
];

const URL_RE = /^(https?:\/\/)?([\w-]+\.)+[a-z]{2,}(\/\S*)?$/i;
const detectPlatform = (url: string): ImportSource | null => PLATFORMS.find((p) => p.hosts.some((h) => url.toLowerCase().includes(h)))?.name ?? null;

type Phase = 'idle' | 'extracting' | 'done';

export default function SocialImportScreen() {
  const router = useRouter();
  const t = useTheme();
  const params = useLocalSearchParams<{ url?: string }>();
  const { recipes, addRecipe, toggleSaveRecipe, savedRecipeIds, ensureCollection, addRecipeToCollection, upsertServerRecipes } = useRecipeStore();
  const addMissingIngredients = useShoppingStore((s) => s.addMissingIngredients);
  const fridge = useFridgeStore((s) => s.items);

  const [url, setUrl] = useState(params.url ?? '');
  const [phase, setPhase] = useState<Phase>('idle');
  const [resultId, setResultId] = useState<string | null>(null);
  const [addedMissing, setAddedMissing] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const platform = detectPlatform(url);
  const isValidUrl = URL_RE.test(url.trim());
  const result = useMemo(() => recipes.find((r) => r.id === resultId), [recipes, resultId]);
  const match = useMemo(() => (result ? computeMatch(result, fridge) : null), [result, fridge]);
  const isSaved = !!result && savedRecipeIds.includes(result.id);

  useEffect(() => {
    if (phase !== 'extracting') return;
    const started = Date.now();
    const tick = setInterval(() => setElapsed(Math.round((Date.now() - started) / 100) / 10), 100);
    return () => clearInterval(tick);
  }, [phase]);

  const [pastedText, setPastedText] = useState('');
  const [showPaste, setShowPaste] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  // Saved video / screenshots the user adds (TikTok, Reels and other posts that hide their recipe text).
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [mediaPrimer, setMediaPrimer] = useState(false);
  const [foundVia, setFoundVia] = useState<ImportFoundVia | null>(null);
  const [stageLine, setStageLine] = useState<string | null>(null);
  const canExtract = isValidUrl || pastedText.trim().length > 20 || media.length > 0;
  const slowImport = media.length > 0 || platform === 'YouTube';

  const pickMedia = async () => {
    if (!mediaPrimerSeen) {
      setMediaPrimer(true);
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['videos', 'images'], allowsMultipleSelection: true, selectionLimit: 6, quality: 0.6, videoMaxDuration: 900 });
    if (res.canceled) return;
    const items: MediaItem[] = res.assets.map((a) => ({
      uri: a.uri,
      kind: a.type === 'video' ? 'video' : 'image',
      mimeType: a.mimeType ?? (a.type === 'video' ? 'video/mp4' : 'image/jpeg'),
      size: a.fileSize ?? 0,
    }));
    const videos = items.filter((i) => i.kind === 'video');
    if (videos.length > 1) return Alert.alert('One video at a time', 'Pick one video, plus screenshots if you like.');
    if (videos.some((v) => v.size > 80 * 1024 * 1024)) return Alert.alert('Video too large', 'Trim it under 80 MB, or add screenshots of the caption instead.');
    setMedia(items);
    setImportError(null);
    if (phase === 'done') { setPhase('idle'); setResultId(null); }
  };

  /**
   * Backend: the API reads the post's public metadata (oEmbed / Open Graph /
   * schema.org) and normalises it with the model. When a platform does not
   * expose the recipe text, the user pastes the caption instead. Nothing is
   * scraped from behind a login.
   */
  const extract = async () => {
    const clean = url.trim();
    if (!canExtract) return;
    setPhase('extracting');
    setAddedMissing(false);
    setImportError(null);

    if (env.USE_BACKEND) {
      try {
        const uploadIds: string[] = [];
        for (const [i, m] of media.entries()) {
          setStageLine(m.kind === 'video' ? 'Uploading the video' : `Uploading screenshot ${i + 1} of ${media.length}`);
          uploadIds.push(await recipesApi.uploadImportMedia(m.uri, m.mimeType));
        }
        setStageLine(null);
        const [res] = await Promise.all([
          recipesApi.importRecipe({ url: isValidUrl ? (clean.startsWith('http') ? clean : `https://${clean}`) : undefined, text: pastedText.trim() || undefined, uploadIds: uploadIds.length ? uploadIds : undefined }),
          new Promise((r) => setTimeout(r, EXTRACT_MS)),
        ]);
        setFoundVia(res.foundVia ?? null);
        if (!res.found || !res.recipe) {
          setShowPaste(true);
          setImportError(res.reason ?? 'Could not find a full recipe in that post. Paste the caption and try again.');
          setPhase('idle');
          return;
        }
        upsertServerRecipes([res.recipe]);
        setMedia([]);
        setResultId(res.recipe.id);
        setPhase('done');
        if (res.allergenHits?.length) Alert.alert('Heads up', `This recipe contains ${joinNatural(res.allergenHits)}, which is on your allergy list. Adapt it before cooking.`);
      } catch (e) {
        setStageLine(null);
        setImportError(errorMessage(e));
        setPhase('idle');
      }
      return;
    }
    if (media.length && !isValidUrl) {
      setPhase('idle');
      Alert.alert('Needs the FRIDGR service', 'Reading videos and screenshots works once the app is connected to the FRIDGR server.');
      return;
    }

    await new Promise((r) => setTimeout(r, EXTRACT_MS));

    const existing = recipes.find((r) => r.sourceUrl && clean.includes(r.sourceUrl.replace(/^https?:\/\//, '')));
    if (existing) {
      setResultId(existing.id);
    } else {
      const template = recipes.find((r) => r.id === 'r7')!;
      const source: ImportSource = platform ?? 'TikTok';
      const created: Recipe = addRecipe({
        ...template,
        importedFrom: source,
        sourceUrl: clean,
        authorTag: `Imported from ${source} • ${template.viewsCount}`,
        likes: 0,
        comments: 0,
      });
      setResultId(created.id);
    }
    setPhase('done');
  };

  const reset = () => {
    setPhase('idle');
    setResultId(null);
    setUrl('');
  };

  const addMissing = () => {
    if (!result || !match) return;
    addMissingIngredients(match.missing, 'From imported recipe');
    setAddedMissing(true);
  };

  const save = async () => {
    if (!result) return;
    if (!isSaved) toggleSaveRecipe(result.id);
    const source = result.importedFrom ?? 'TikTok';
    const title = `Imported from ${source}`;
    try {
      const col = await ensureCollection(title, 'auto-extracted');
      addRecipeToCollection(col.id, result.id);
    } catch {
      /* the recipe is saved even if the collection call fails */
    }
    router.dismissAll();
    router.navigate('/(tabs)/saved');
  };

  const swapsText = match && match.missing.length > 0
    ? joinNatural(match.missing.map((m) => findSubstitution(m.name)?.swap.toLowerCase()).filter((s): s is string => !!s))
    : '';

  return (
    <Screen>
      <PermissionPrimer kind="media" visible={mediaPrimer} onAllow={() => { mediaPrimerSeen = true; setMediaPrimer(false); setTimeout(() => void pickMedia(), 250); }} onNotNow={() => setMediaPrimer(false)} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Header title="Import from a video" />

        <Card style={{ gap: 12, padding: 18 }}>
          <SectionTag>Paste link</SectionTag>
          <View style={[styles.inputBox, { backgroundColor: t.cardAlt, borderColor: url && !isValidUrl ? t.peachBorder : 'transparent' }]}>
            <Link2 size={16} color={t.textMuted} />
            <TextInput
              value={url}
              onChangeText={(v) => { setUrl(v); if (phase === 'done') { setPhase('idle'); setResultId(null); } }}
              placeholder={PLATFORMS[0].example}
              placeholderTextColor={t.textMuted}
              style={[styles.input, { color: t.textStrong }]}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              returnKeyType="go"
              onSubmitEditing={extract}
            />
            {url.length > 0 && (
              <TouchableOpacity onPress={reset} hitSlop={8}>
                <X size={16} color={t.textMuted} />
              </TouchableOpacity>
            )}
          </View>
          {url.length > 0 && !isValidUrl && <Text style={[styles.hint, { color: t.orange }]}>That doesn't look like a link yet.</Text>}

          <View style={styles.platforms}>
            {PLATFORMS.map((p) => (
              <Pill key={p.name} small label={p.name} selected={platform === p.name} onPress={() => setUrl(p.example)} />
            ))}
          </View>

          {(showPaste || pastedText.length > 0) && (
            <TextInput
              value={pastedText}
              onChangeText={(v) => { setPastedText(v); setImportError(null); }}
              placeholder="Paste the caption, ingredient list or method here"
              placeholderTextColor={t.textMuted}
              multiline
              style={[styles.paste, { color: t.textStrong, backgroundColor: t.cardAlt }]}
            />
          )}
          {importError && <Text style={[styles.hint, { color: t.orange, marginTop: 0 }]}>{importError}</Text>}
          {!showPaste && pastedText.length === 0 && (
            <TouchableOpacity onPress={() => setShowPaste(true)} hitSlop={8}>
              <Text style={[styles.hint, { color: t.green, marginTop: 0 }]}>No link? Paste the caption instead</Text>
            </TouchableOpacity>
          )}

          {/* TikTok / Instagram rarely share the recipe text publicly: let the AI watch the saved clip. */}
          <View style={styles.mediaRow}>
            <Button label={media.length ? 'Change video / screenshots' : 'Add saved video or screenshots'} variant="outline" size="sm" onPress={pickMedia} left={<Video size={14} color={t.textStrong} />} style={{ flexShrink: 1 }} />
            {media.length > 0 && (
              <Pill small label={`${media.some((m) => m.kind === 'video') ? '1 video' : ''}${media.some((m) => m.kind === 'video') && media.some((m) => m.kind === 'image') ? ' + ' : ''}${media.filter((m) => m.kind === 'image').length ? plural(media.filter((m) => m.kind === 'image').length, 'screenshot') : ''}`} selected variant="lime" onPress={() => setMedia([])} right={<X size={12} color={t.onLime} />} />
            )}
          </View>
          <Text style={[styles.hint, { color: t.textMuted, marginTop: -4 }]}>Saved a TikTok or Reel? Add the clip and FRIDGR watches it for the full recipe.</Text>

          <Button
            label={phase === 'extracting' ? `Extracting… ${elapsed.toFixed(1)}s` : phase === 'done' ? 'Extracted ✓' : 'Extract recipe'}
            variant="dark"
            onPress={extract}
            disabled={!canExtract || phase !== 'idle'}
            loading={phase === 'extracting'}
          />
        </Card>

        <ProcessingOverlay
          visible={phase === 'extracting'}
          title="Reading the video"
          icons={IMPORT_ICONS}
          centerIcon={ScanSearch}
          durationMs={slowImport ? 24000 : EXTRACT_MS}
          lines={stageLine ? [stageLine, 'Watching the clip', 'Listening to the audio', 'Writing out every step'] : [`Opening the ${platform ?? 'video'} link`, slowImport ? 'Watching the whole video' : 'Following links to the full recipe', 'Reading captions and on-screen text', 'Writing out the steps']}
        />

        {phase === 'done' && result && match && (
          <View style={{ gap: 14 }}>
            <SectionTag>{`${foundVia ? FOUND_VIA_LABEL[foundVia] + ' • ' : ''}${Math.max(elapsed, 1.6).toFixed(0)}s`}</SectionTag>

            <Card style={{ gap: 14, padding: 18 }}>
              <View style={styles.recipeHeader}>
                <MediaPlaceholder label={result.imageKey} uri={result.imageUrl} tone={result.tone} height={72} radius={14} style={{ width: 72 }} padding={4} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.creator, { color: t.textMuted }]}>{result.authorHandle} • {result.viewsCount}</Text>
                  <Text style={[styles.recipeTitle, { color: t.textStrong }]}>{result.title}</Text>
                  <View style={styles.tags}>
                    <Tag label={plural(result.ingredients.length, 'ingredient')} tone="lime" />
                    <Tag label={plural(result.steps.length, 'step')} />
                  </View>
                </View>
              </View>
              <Divider />
              <View style={{ gap: 10 }}>
                {result.ingredients.map((ing) => {
                  const have = !match.missing.some((m) => m.id === ing.id);
                  return (
                    <View key={ing.id} style={styles.ingRow}>
                      <View style={styles.ingLeft}>
                        <View style={[styles.dot, { backgroundColor: have ? t.green : t.orange }]} />
                        <Text style={[styles.ingName, { color: t.textStrong }]}>{ing.name}</Text>
                      </View>
                      <View style={styles.ingRight}>
                        <Text style={[styles.ingAmount, { color: t.textMuted }]}>{ing.amount}</Text>
                        <Text style={[styles.status, { color: have ? t.green : t.orange }]}>{have ? 'IN FRIDGE' : 'MISSING'}</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </Card>

            <Card variant="lime" style={{ gap: 12, padding: 18 }}>
              <Text style={[styles.overlapTitle, { color: t.onLime }]}>
                {match.have.length} of {match.total} already in your fridge
              </Text>
              <Text style={[styles.overlapSub, { color: t.onLime }]}>
                {match.missing.length === 0
                  ? 'You have everything. Straight to cooking mode.'
                  : `Missing ${joinNatural(match.missing.map((m) => m.name.toLowerCase()))}.${swapsText ? ` Fridgr can swap in ${swapsText}.` : ''}`}
              </Text>
              <View style={styles.overlapButtons}>
                <Button label="Adapt it" variant="dark" size="sm" style={{ flex: 1 }} onPress={() => router.push(`/recipe/adapt?id=${result.id}`)} />
                {match.missing.length > 0 && (
                  <Button
                    label={addedMissing ? 'Added' : 'Add missing'}
                    variant="outline"
                    size="sm"
                    style={{ flex: 1 }}
                    onPress={addedMissing ? () => router.push('/shopping') : addMissing}
                    left={addedMissing ? <Check size={14} color={t.green} /> : undefined}
                  />
                )}
              </View>
            </Card>

            <Button label={isSaved ? 'Saved • open my recipes' : 'Save to my recipes'} variant="outline" onPress={save} />
            <TouchableOpacity onPress={() => router.push(`/recipe/${result.id}`)} style={{ alignItems: 'center' }} hitSlop={8}>
              <Text style={[styles.link, { color: t.green }]}>View full recipe</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40, gap: 12 },
  inputBox: { borderRadius: 16, paddingHorizontal: 14, height: 48, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1 },
  input: { fontSize: fs(13), fontWeight: '600', flex: 1, paddingVertical: 0 },
  hint: { fontSize: fs(12), marginTop: -4 },
  platforms: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  mediaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  paste: { borderRadius: 16, minHeight: 96, maxHeight: 180, padding: 14, fontSize: fs(13), fontWeight: '500', textAlignVertical: 'top' },
  recipeHeader: { flexDirection: 'row', gap: 14 },
  creator: { fontSize: fs(12) },
  recipeTitle: { fontFamily: font.display, fontWeight: '400', fontSize: fs(17), lineHeight: fs(22), marginVertical: 4  },
  tags: { flexDirection: 'row', gap: 6 },
  ingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  ingLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  ingName: { fontWeight: '700', fontSize: fs(13) },
  ingRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ingAmount: { fontSize: fs(12) },
  status: { fontSize: fs(10), fontWeight: '800', minWidth: 62, textAlign: 'right' },
  overlapTitle: { fontFamily: font.display, fontWeight: '400', fontSize: fs(18)  },
  overlapSub: { fontSize: fs(13), lineHeight: fs(18), opacity: 0.9 },
  overlapButtons: { flexDirection: 'row', gap: 10 },
  link: { fontSize: fs(13), fontWeight: '700' },
});
