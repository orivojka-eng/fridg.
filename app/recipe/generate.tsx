import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Plus, Sparkles } from '../../src/components/ui/lucide';
import { useFridgeStore } from '../../src/store/useFridgeStore';
import { useRecipeStore } from '../../src/store/useRecipeStore';
import { FREE_GENERATIONS_PER_DAY, useUserStore } from '../../src/store/useUserStore';
import { useTheme, fs } from '../../src/theme';
import { Screen, Header, SectionTag, Pill, Card, Divider, Button } from '../../src/components/ui';
import { RecipeEffort, RecipeStyle } from "../../src/types";
import { ProcessingOverlay } from '../../src/components/ProcessingOverlay';
import { errorMessage, isApiError } from '../../src/api/client';

const QUICK_PROMPTS = ['What can I make tonight?', 'Make it higher protein', 'Use up my spinach', 'Under 20 minutes'];
const EFFORTS: RecipeEffort[] = ['Easy', 'Cheffy'];
const STYLES: RecipeStyle[] = ["Bowl", "Traybake", "Salad"];
const GENERATE_MS = 2400;
const MOOD_PROMPTS: Record<string, string> = {
  quick: "Under 20 minutes",
  comfort: "Something warm and comforting",
  fresh: "Light and fresh, lots of veg",
  protein: "Make it higher protein",
  feast: "Something impressive for tonight",
};

export default function GeneratorScreen() {
  const router = useRouter();
  const t = useTheme();
  const items = useFridgeStore((s) => s.items);
  const {
    generatorServings, setGeneratorServings,
    generatorEffort, setGeneratorEffort,
    generatorStyle, setGeneratorStyle,
    selectedGeneratorIngredients, toggleGeneratorIngredient, setGeneratorIngredients,
    generateRecipesAsync, recipes,
  } = useRecipeStore();
  const { profile, freeGenerationsLeft, consumeGeneration } = useUserStore();
  // The food mood picked at onboarding seeds the first prompt.
  const [prompt, setPrompt] = useState(() => MOOD_PROMPTS[profile.mood ?? ""] ?? "");
  const [busy, setBusy] = useState(false);

  // Default to everything in the fridge the first time the screen opens.
  // Guarded by a ref so "Clear" doesn't immediately re-select everything.
  const initialised = useRef(false);
  useEffect(() => {
    if (initialised.current) return;
    initialised.current = true;
    if (selectedGeneratorIngredients.length === 0 && items.length > 0) {
      setGeneratorIngredients(items.map((i) => i.name));
    }
  }, [items, selectedGeneratorIngredients.length, setGeneratorIngredients]);

  // Ignore selections for items that have since left the fridge.
  const selected = useMemo(() => selectedGeneratorIngredients.filter((n) => items.some((i) => i.name === n)), [selectedGeneratorIngredients, items]);
  const expiringFirst = useMemo(() => [...items].sort((a, b) => a.daysToExpiry - b.daysToExpiry), [items]);
  const expiringName = expiringFirst[0]?.daysToExpiry <= 2 ? expiringFirst[0].name.toLowerCase() : null;
  const quickPrompts = expiringName ? QUICK_PROMPTS.map((p) => (p.startsWith('Use up') ? `Use up my ${expiringName}` : p)) : QUICK_PROMPTS;

  const outOfCredits = !profile.isPremium && freeGenerationsLeft <= 0;
  const resultCount = Math.min(6, recipes.length);

  const generate = async () => {
    if (!consumeGeneration()) {
      Alert.alert('No free generations left', 'You get 5 free generations a day. Go unlimited with Premium.', [
        { text: 'Not now', style: 'cancel' },
        { text: 'See Premium', onPress: () => router.push('/premium') },
      ]);
      return;
    }
    setBusy(true);
    try {
      // Backend: the API job runs while the overlay plays; the overlay never drops before its own minimum.
      const request = { prompt, ingredientNames: selected, servings: generatorServings, effort: generatorEffort, style: generatorStyle };
      await Promise.all([generateRecipesAsync(request, items), new Promise((r) => setTimeout(r, GENERATE_MS))]);
      setBusy(false);
      router.push('/recipe/results');
    } catch (e) {
      setBusy(false);
      const premium = isApiError(e) && (e.code === 'PREMIUM_REQUIRED' || e.code === 'QUOTA_EXCEEDED');
      Alert.alert(premium ? 'Out of generations' : 'Could not generate', errorMessage(e), premium ? [{ text: 'Not now', style: 'cancel' }, { text: 'See Premium', onPress: () => router.push('/premium') }] : undefined);
    }
  };

  return (
    <Screen>
      <ProcessingOverlay
        visible={busy}
        title="Cooking up ideas"
        ingredients={selected}
        durationMs={GENERATE_MS}
        lines={[
          `Checking ${selected.length || 'your'} ingredients`,
          selected.length > 1 ? `Pairing ${selected[0].toLowerCase()} with ${selected[1].toLowerCase()}` : 'Finding flavour pairings',
          'Balancing protein and time',
          'Plating up your recipes',
        ]}
      />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Header title="AI Recipe Generator" />

        <Card variant="dark" style={{ gap: 14, padding: 18 }}>
          <View style={styles.aiTop}>
            <View style={[styles.aiBadge, { backgroundColor: t.lime }]}>
              <Plus size={14} color={t.onLime} />
              <Text style={[styles.aiBadgeText, { color: t.onLime }]}>Ask Fridgr AI</Text>
            </View>
            <Text style={[styles.free, { color: outOfCredits ? t.orange : t.textMuted }]}>
              {profile.isPremium ? 'UNLIMITED' : `${freeGenerationsLeft}/${FREE_GENERATIONS_PER_DAY} FREE`}
            </Text>
          </View>

          <View style={styles.inputBox}>
            <Sparkles size={16} color={t.lime} />
            <TextInput
              placeholder="What can I make with what I have?"
              placeholderTextColor={t.textMuted}
              value={prompt}
              onChangeText={setPrompt}
              style={styles.input}
              returnKeyType="go"
              onSubmitEditing={generate}
            />
          </View>

          <View style={styles.prompts}>
            {quickPrompts.map((p) => {
              const on = prompt === p;
              return (
                <TouchableOpacity key={p} onPress={() => setPrompt(on ? '' : p)} style={[styles.promptChip, { backgroundColor: on ? t.lime : 'rgba(200,242,74,0.12)' }]}>
                  <Text style={[styles.promptText, { color: on ? t.onLime : t.lime }]}>{p}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Card>

        <View style={styles.section}>
          <View style={styles.sectionRow}>
            <SectionTag>{`Using from your fridge • ${selected.length}/${items.length}`}</SectionTag>
            <TouchableOpacity onPress={() => setGeneratorIngredients(selected.length === items.length ? [] : items.map((i) => i.name))} hitSlop={8}>
              <Text style={[styles.link, { color: t.green }]}>{selected.length === items.length ? 'Clear' : 'Select all'}</Text>
            </TouchableOpacity>
          </View>
          {items.length === 0 ? (
            <Text style={{ color: t.textMuted, fontSize: fs(13) }}>Your fridge is empty. Scan or add items to generate around them.</Text>
          ) : (
            <View style={styles.chips}>
              {expiringFirst.map((item) => (
                <Pill
                  key={item.id}
                  label={item.daysToExpiry <= 2 ? `${item.name} · soon` : item.name}
                  variant="lime"
                  selected={selected.includes(item.name)}
                  onPress={() => toggleGeneratorIngredient(item.name)}
                />
              ))}
            </View>
          )}
        </View>

        <View style={styles.section}>
          <SectionTag>Fine tune</SectionTag>
          <Card style={{ padding: 18, gap: 0 }}>
            <View style={styles.row}>
              <Text style={[styles.rowLabel, { color: t.textStrong }]}>Servings</Text>
              <View style={styles.options}>
                {[1, 2, 4].map((s) => {
                  const on = generatorServings === s;
                  return (
                    <TouchableOpacity key={s} onPress={() => setGeneratorServings(s)} style={[styles.circle, { backgroundColor: on ? t.pillActiveBg : t.cardAlt }]}>
                      <Text style={[styles.optText, { color: on ? t.pillActiveText : t.textStrong }]}>{s}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
            <Divider />
            <View style={styles.row}>
              <Text style={[styles.rowLabel, { color: t.textStrong }]}>Effort</Text>
              <View style={styles.options}>
                {EFFORTS.map((e) => {
                  const on = generatorEffort === e;
                  return (
                    <TouchableOpacity key={e} onPress={() => setGeneratorEffort(e)} style={[styles.opt, { backgroundColor: on ? t.pillActiveBg : t.cardAlt }]}>
                      <Text style={[styles.optText, { color: on ? t.pillActiveText : t.textStrong }]}>{e}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
            <Divider />
            <View style={styles.row}>
              <Text style={[styles.rowLabel, { color: t.textStrong }]}>Style</Text>
              <View style={styles.options}>
                {STYLES.map((s) => {
                  const on = generatorStyle === s;
                  return (
                    <TouchableOpacity key={s} onPress={() => setGeneratorStyle(s)} style={[styles.opt, { backgroundColor: on ? t.pillActiveBg : t.cardAlt }]}>
                      <Text style={[styles.optText, { color: on ? t.pillActiveText : t.textStrong }]}>{s}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </Card>
        </View>

        <Button
          label={outOfCredits ? 'Out of free generations' : `Generate ${resultCount} recipes`}
          onPress={generate}
          loading={busy}
          disabled={selected.length === 0 && !prompt.trim()}
        />
        {!profile.isPremium && (
          <TouchableOpacity style={{ alignItems: 'center' }} onPress={() => router.push('/premium')}>
            <Text style={[styles.premiumText, { color: t.textMuted }]}>
              Unlimited generations with <Text style={{ fontWeight: '800', color: t.isDark ? t.lime : t.textStrong }}>Fridgr Premium</Text>
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40, gap: 12 },
  aiTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  aiBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 16 },
  aiBadgeText: { fontWeight: '800', fontSize: fs(12) },
  free: { fontSize: fs(11), fontWeight: '700', fontFamily: 'monospace' },
  inputBox: { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 16, paddingHorizontal: 14, height: 48, flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: { color: '#FFFFFF', fontSize: fs(14), flex: 1, paddingVertical: 0 },
  prompts: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  promptChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 16 },
  promptText: { fontSize: fs(12), fontWeight: '700' },
  section: { gap: 10 },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  link: { fontSize: fs(12), fontWeight: '700' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 },
  rowLabel: { fontWeight: '700', fontSize: fs(14) },
  options: { flexDirection: 'row', gap: 8 },
  circle: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  opt: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 16 },
  optText: { fontWeight: '700', fontSize: fs(13) },
  premiumText: { fontSize: fs(12) },
});
