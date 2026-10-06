import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Switch } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useRecipeStore, findSubstitution } from '../../src/store/useRecipeStore';
import { useFridgeStore } from '../../src/store/useFridgeStore';
import { useUserStore } from '../../src/store/useUserStore';
import { useCookingStore } from '../../src/store/useCookingStore';
import { useTheme, fs, font } from '../../src/theme';
import { Screen, Header, SectionTag, Card, Tag, Button, EmptyState } from '../../src/components/ui';
import { ProcessingOverlay } from '../../src/components/ProcessingOverlay';
import { ArrowLeftRight } from '../../src/components/ui/lucide';

const ADAPT_MS = 1600;
import { computeMatch, namesMatch, plural } from '../../src/lib/matching';
import { Recipe } from '../../src/types';

interface Change {
  key: string;
  kind: 'SWAP' | 'BOOST' | 'DROP';
  from: string;
  to: string;
  why: string;
  delta: { kcal: number; protein: number; carbs: number; fat: number };
  apply: (r: Recipe) => Recipe;
}

const replaceName = (recipe: Recipe, from: string, to: string): Recipe => ({
  ...recipe,
  ingredients: recipe.ingredients.map((i) => (namesMatch(i.name, from) ? { ...i, name: to } : i)),
  steps: recipe.steps.map((s) => ({
    ...s,
    ingredients: s.ingredients.map((n) => (namesMatch(n, from) ? to : n)),
    instruction: s.instruction.replace(new RegExp(from.split(' ')[0], 'ig'), to.split(' +')[0]),
  })),
});

export default function AdaptRecipeScreen() {
  const router = useRouter();
  const t = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const recipe = useRecipeStore((s) => s.recipes.find((r) => r.id === id));
  const fridge = useFridgeStore((s) => s.items);
  const profile = useUserStore((s) => s.profile);
  const startCooking = useCookingStore((s) => s.startCooking);

  const changes = useMemo<Change[]>(() => {
    if (!recipe) return [];
    const match = computeMatch(recipe, fridge);
    const list: Change[] = match.missing.map((ing) => {
      const sub = findSubstitution(ing.name);
      if (sub) {
        return {
          key: ing.id,
          kind: 'SWAP',
          from: ing.name,
          to: sub.swap,
          why: fridge.some((f) => namesMatch(f.name, sub.swap.split(' + ')[0])) ? `You have it; ${sub.why.charAt(0).toLowerCase()}${sub.why.slice(1)}` : sub.why,
          delta: { kcal: 0, protein: 0, carbs: 0, fat: 0 },
          apply: (r) => replaceName(r, ing.name, sub.swap),
        };
      }
      return {
        key: ing.id,
        kind: 'DROP',
        from: ing.name,
        to: 'leave it out',
        why: 'Nothing in your fridge stands in for it, but the dish still works without.',
        delta: { kcal: -20, protein: 0, carbs: -2, fat: -1 },
        apply: (r) => ({ ...r, ingredients: r.ingredients.filter((i) => i.id !== ing.id) }),
      };
    });

    const wantsProtein = profile.diet.includes('High protein') || profile.goals.includes('Fitness');
    if (wantsProtein && recipe.proteinG < 45) {
      const main = recipe.ingredients.find((i) => /chicken|salmon|egg|beef|tofu|chickpea|bean|feta|yoghurt/i.test(i.name));
      if (main) {
        const amountNum = parseInt(main.amount, 10);
        const boosted = Number.isFinite(amountNum) ? main.amount.replace(String(amountNum), String(Math.round(amountNum * 1.4))) : main.amount;
        const extra = /egg|chickpea|bean|yoghurt/i.test(main.name) ? 'edamame' : 'a handful of edamame';
        list.push({
          key: 'boost',
          kind: 'BOOST',
          from: `${main.amount} ${main.name.toLowerCase()}`,
          to: `${boosted} ${main.name.toLowerCase()} + ${extra}`,
          why: `Hits your 45g protein target for dinner.`,
          delta: { kcal: 72, protein: 14, carbs: -6, fat: 2 },
          apply: (r) => ({
            ...r,
            ingredients: [...r.ingredients.map((i) => (i.id === main.id ? { ...i, amount: boosted } : i)), { id: 'boost-edamame', name: 'Edamame', amount: '80 g' }],
          }),
        });
      }
    }
    return list;
  }, [recipe, fridge, profile]);

  const [applying, setApplying] = useState(false);
  const [enabled, setEnabled] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(changes.map((c) => [c.key, c.kind !== 'BOOST'])),
  );

  if (!recipe) {
    return (
      <Screen>
        <View style={{ padding: 20 }}>
          <Header title="Adapt recipe" />
        </View>
        <EmptyState emoji="🤷" title="Recipe not found" />
      </Screen>
    );
  }

  const active = changes.filter((c) => enabled[c.key] ?? c.kind !== 'BOOST');
  const totals = active.reduce(
    (acc, c) => ({ kcal: acc.kcal + c.delta.kcal, protein: acc.protein + c.delta.protein, carbs: acc.carbs + c.delta.carbs, fat: acc.fat + c.delta.fat }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  );
  const swaps = active.filter((c) => c.kind === 'SWAP').length;
  const drops = active.filter((c) => c.kind === 'DROP').length;
  const boost = active.some((c) => c.kind === 'BOOST');

  const summary =
    changes.length === 0
      ? `Nothing to change — you have everything for this one and it already fits your goals.`
      : `I rebuilt this around your fridge${boost ? ' and your high-protein goal' : ''}. ${[
          swaps > 0 ? plural(swaps, 'swap') : '',
          drops > 0 ? `${drops} left out` : '',
          boost ? 'one addition' : '',
        ]
          .filter(Boolean)
          .join(', ')}${totals.protein !== 0 ? `, ${totals.protein > 0 ? '+' : ''}${totals.protein}g protein` : ''}, still ${recipe.prepTimeMin} minutes.`;

  const apply = () => {
    const adapted = active.reduce((r, c) => c.apply(r), { ...recipe, proteinG: recipe.proteinG + totals.protein, calories: recipe.calories + totals.kcal });
    setApplying(true);
    setTimeout(() => {
      startCooking(adapted);
      setApplying(false);
      router.push(`/recipe/cooking/${recipe.id}?adapted=1`);
    }, ADAPT_MS);
  };

  const fmtDelta = (n: number, unit = '') => (n === 0 ? '—' : `${n > 0 ? '+' : ''}${n}${unit}`);

  return (
    <Screen>
      <ProcessingOverlay
        visible={applying}
        title="Rewriting the recipe"
        ingredients={recipe.ingredients.map((i) => i.name)}
        centerIcon={ArrowLeftRight}
        durationMs={ADAPT_MS}
        lines={['Swapping ingredients', 'Rebalancing the macros', 'Updating the steps']}
      />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Header title="Adapt recipe" subtitle={recipe.title} />

        <Card variant="dark" style={{ gap: 8, padding: 18 }}>
          <SectionTag light>Fridgr AI</SectionTag>
          <Text style={[styles.aiText, { color: t.onDark }]}>{summary}</Text>
        </Card>

        {changes.length > 0 && <SectionTag>Suggested changes</SectionTag>}

        {changes.map((c) => {
          const on = enabled[c.key] ?? c.kind !== 'BOOST';
          return (
            <Card key={c.key} style={{ gap: 10, opacity: on ? 1 : 0.7 }}>
              <View style={styles.cardTop}>
                <Tag label={c.kind} tone={c.kind === 'BOOST' ? 'sage' : 'peach'} />
                <Switch
                  value={on}
                  onValueChange={(v) => setEnabled((prev) => ({ ...prev, [c.key]: v }))}
                  trackColor={{ false: t.border, true: t.lime }}
                  thumbColor="#FFFFFF"
                  ios_backgroundColor={t.border}
                />
              </View>
              <View style={styles.swapRow}>
                <Text style={[styles.from, { color: t.textMuted }]}>{c.from}</Text>
                <Text style={[styles.arrow, { color: t.textStrong }]}>→</Text>
                <Text style={[styles.to, { color: t.textStrong }]}>{c.to}</Text>
              </View>
              <Text style={[styles.why, { color: t.textMuted }]}>{c.why}</Text>
            </Card>
          );
        })}

        <Card style={{ gap: 12 }}>
          <Text style={[styles.nutritionTitle, { color: t.textStrong }]}>Nutrition after adaptation</Text>
          <View style={styles.grid}>
            {[
              { val: recipe.calories + totals.kcal, unit: 'kcal', delta: fmtDelta(totals.kcal) },
              { val: `${recipe.proteinG + totals.protein}g`, unit: 'protein', delta: fmtDelta(totals.protein) },
              { val: `${recipe.carbsG + totals.carbs}g`, unit: 'carbs', delta: fmtDelta(totals.carbs) },
              { val: `${recipe.fatG + totals.fat}g`, unit: 'fat', delta: fmtDelta(totals.fat) },
            ].map((m) => (
              <View key={m.unit} style={styles.macroCol}>
                <Text style={[styles.macroVal, { color: t.textStrong }]}>{m.val}</Text>
                <Text style={[styles.macroUnit, { color: t.textMuted }]}>{m.unit}</Text>
                <Text style={[styles.delta, { color: m.delta === '—' ? t.textMuted : m.delta.startsWith('+') ? t.green : t.orange }]}>{m.delta}</Text>
              </View>
            ))}
          </View>
        </Card>

        <Button label={active.length === 0 ? 'Start cooking as written' : 'Apply & start cooking'} onPress={apply} disabled={recipe.steps.length === 0} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40, gap: 12 },
  aiText: { fontFamily: font.display, fontSize: fs(17), fontWeight: '400', lineHeight: fs(24)  },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  swapRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  from: { fontSize: fs(15), textDecorationLine: 'line-through' },
  arrow: { fontSize: fs(15) },
  to: { fontSize: fs(15), fontWeight: '800', flexShrink: 1 },
  why: { fontSize: fs(12), lineHeight: fs(17) },
  nutritionTitle: { fontFamily: font.display, fontWeight: '400', fontSize: fs(16)  },
  grid: { flexDirection: 'row' },
  macroCol: { flex: 1, alignItems: 'flex-start' },
  macroVal: { fontFamily: font.display, fontWeight: '400', fontSize: fs(18)  },
  macroUnit: { fontSize: fs(11) },
  delta: { fontSize: fs(10), fontWeight: '700', marginTop: 2 },
});
