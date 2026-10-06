import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Switch } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { X, ChevronLeft, Play, Pause, RotateCcw, Star, PartyPopper } from '../../../src/components/ui/lucide';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useCookingStore } from '../../../src/store/useCookingStore';
import { useRecipeStore } from '../../../src/store/useRecipeStore';
import { useFridgeStore } from '../../../src/store/useFridgeStore';
import { useUserStore } from '../../../src/store/useUserStore';
import { useTheme, fs, font } from '../../../src/theme';
import { Screen, IconButton, Button, EmptyState } from '../../../src/components/ui';
import { ProgressRing } from '../../../src/components/ui/ProgressRing';
import { fridgeItemsUsedBy, plural } from '../../../src/lib/matching';

const KEEP_AWAKE_TAG = 'fridgr-cooking';

const formatTimer = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;

export default function CookingModeScreen() {
  const router = useRouter();
  const t = useTheme();
  const { id, adapted } = useLocalSearchParams<{ id: string; adapted?: string }>();
  const recipe = useRecipeStore((s) => s.recipes.find((r) => r.id === id));
  const markMade = useRecipeStore((s) => s.markMade);
  const fridge = useFridgeStore((s) => s.items);
  const removeItems = useFridgeStore((s) => s.removeItems);
  const { incrementStreak, addNotification } = useUserStore();

  const cooking = useCookingStore();
  const {
    recipeId, recipeTitle, steps, currentStepIndex, nextStep, prevStep,
    isTimerRunning, timerSecondsRemaining, initialTimerSeconds, timerFinished,
    startTimer, pauseTimer, tickTimer, setTimer,
    isKeepAwake, toggleKeepAwake, isCompleted, rating, setRating, startCooking,
  } = cooking;

  const [removeUsed, setRemoveUsed] = useState(false);

  // Deep links (or a stale store) land here without startCooking having run.
  useEffect(() => {
    if (recipe && recipeId !== recipe.id && !adapted) startCooking(recipe);
  }, [recipe, recipeId, adapted, startCooking]);

  // Countdown: one interval for as long as the timer runs.
  useEffect(() => {
    if (!isTimerRunning) return;
    const interval = setInterval(tickTimer, 1000);
    return () => clearInterval(interval);
  }, [isTimerRunning, tickTimer]);

  // Honour the "Keep awake" toggle with the real screen lock API.
  useEffect(() => {
    if (isKeepAwake) activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => undefined);
    else deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => undefined);
    return () => {
      deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => undefined);
    };
  }, [isKeepAwake]);

  const usedItems = useMemo(() => (recipe ? fridgeItemsUsedBy(recipe, fridge) : []), [recipe, fridge]);
  const expiringUsed = usedItems.filter((i) => i.daysToExpiry <= 2).length;

  // The store is reset by the next startCooking, not here: resetting while
  // this screen is still mounted would re-trigger the deep-link effect.
  const close = () => {
    if (router.canDismiss()) router.dismissAll();
    else router.replace('/(tabs)');
  };

  const finish = () => {
    if (recipe) {
      markMade(recipe.id, rating || undefined);
      incrementStreak();
      if (removeUsed && usedItems.length > 0) removeItems(usedItems.map((i) => i.id));
      addNotification({
        avatarLetter: 'C',
        kind: 'cooked',
        title: `You cooked ${recipe.title}`,
        message: expiringUsed > 0 ? `${plural(expiringUsed, 'expiring item')} used up. Nothing wasted.` : 'Streak extended. Nice one.',
        link: `/recipe/${recipe.id}`,
      });
    }
    close();
  };

  // Until the deep-link effect has run, fall back to the recipe's own steps
  // so the first frame isn't an empty state.
  const activeSteps = recipe && recipeId === recipe.id && steps.length > 0 ? steps : recipe?.steps ?? [];

  if (!recipe || activeSteps.length === 0) {
    return (
      <Screen dark edges={["top", "bottom"]} style={styles.container}>
        <View style={styles.header}>
          <IconButton dark onPress={close}>
            <X size={20} color="#FFFFFF" />
          </IconButton>
        </View>
        <EmptyState dark emoji="🍳" title="Nothing to cook here" message="This recipe has no steps yet." action={<Button label="Back" onPress={close} />} />
      </Screen>
    );
  }

  const step = activeSteps[Math.min(currentStepIndex, activeSteps.length - 1)];
  const isLast = currentStepIndex === activeSteps.length - 1;
  const timerProgress = initialTimerSeconds > 0 ? timerSecondsRemaining / initialTimerSeconds : 0;

  return (
    <Screen dark edges={["top", "bottom"]} style={styles.container}>
      <View style={styles.header}>
        <IconButton dark onPress={close}>
          <X size={20} color="#FFFFFF" />
        </IconButton>
        <View style={{ flex: 1 }}>
          <Text style={styles.title} numberOfLines={1}>{recipeTitle || recipe.title}</Text>
          <Text style={[styles.counter, { color: t.textMuted }]}>
            {isCompleted ? 'DONE' : `STEP ${currentStepIndex + 1} OF ${activeSteps.length}`}{adapted ? ' • ADAPTED' : ''}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.awake, isKeepAwake ? { backgroundColor: 'rgba(200,242,74,0.15)', borderColor: t.lime } : { backgroundColor: 'rgba(255,255,255,0.1)', borderColor: 'transparent' }]}
          onPress={toggleKeepAwake}
        >
          <Text style={[styles.awakeText, { color: isKeepAwake ? t.lime : t.textMuted }]}>Keep awake</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.progress}>
        {activeSteps.map((_, i) => (
          <View key={i} style={[styles.segment, { backgroundColor: isCompleted || i <= currentStepIndex ? t.lime : 'rgba(255,255,255,0.2)' }]} />
        ))}
      </View>

      {!isCompleted ? (
        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          <View>
            <Text style={[styles.phase, { color: t.lime }]}>{step.phase}</Text>
            <Text style={styles.instruction}>{step.instruction}</Text>

            {step.ingredients.length > 0 && (
              <View style={styles.chips}>
                {step.ingredients.map((ing) => (
                  <View key={ing} style={styles.chip}>
                    <Text style={styles.chipText}>{ing}</Text>
                  </View>
                ))}
              </View>
            )}

            {step.timerSec ? (
              <View style={[styles.timerCard, { backgroundColor: t.dark, borderColor: timerFinished ? t.lime : 'rgba(255,255,255,0.1)' }]}>
                <ProgressRing progress={timerFinished ? 1 : timerProgress} size={92} strokeWidth={5} color={t.lime} trackColor="rgba(255,255,255,0.12)">
                  <Text numberOfLines={1} adjustsFontSizeToFit allowFontScaling={false} style={[styles.timerVal, timerFinished && { color: t.lime }]}>{timerFinished ? 'Done' : formatTimer(timerSecondsRemaining)}</Text>
                </ProgressRing>
                <View style={{ flex: 1 }}>
                  <Text style={styles.timerTitle}>
                    {timerFinished ? 'Time\'s up' : `Step timer • ${Math.round(step.timerSec / 60)} min`}
                  </Text>
                  <Text style={[styles.timerSub, { color: t.textMuted }]}>
                    {timerFinished ? 'Move on when you are ready.' : 'We\'ll buzz you and read out the next step.'}
                  </Text>
                  <View style={styles.timerControls}>
                    {timerFinished ? (
                      <TouchableOpacity style={[styles.timerBtn, { backgroundColor: t.lime }]} onPress={nextStep}>
                        <Text style={[styles.timerBtnText, { color: t.onLime }]}>{isLast ? 'Finish' : 'Next step'}</Text>
                      </TouchableOpacity>
                    ) : !isTimerRunning ? (
                      <TouchableOpacity style={[styles.timerBtn, { backgroundColor: t.lime }]} onPress={startTimer}>
                        <Play size={12} color={t.onLime} fill={t.onLime} />
                        <Text style={[styles.timerBtnText, { color: t.onLime }]}>{timerSecondsRemaining < initialTimerSeconds ? 'Resume' : 'Start timer'}</Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity style={[styles.timerBtn, { backgroundColor: t.orange }]} onPress={pauseTimer}>
                        <Pause size={12} color="#FFFFFF" fill="#FFFFFF" />
                        <Text style={[styles.timerBtnText, { color: '#FFFFFF' }]}>Pause</Text>
                      </TouchableOpacity>
                    )}
                    {(timerSecondsRemaining < initialTimerSeconds || timerFinished) && (
                      <TouchableOpacity style={[styles.timerBtn, { backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 10 }]} onPress={() => setTimer(step.timerSec!)}>
                        <RotateCcw size={12} color="#FFFFFF" />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </View>
            ) : null}
          </View>

          <View style={styles.actions}>
            <IconButton dark size={52} onPress={prevStep} style={{ opacity: currentStepIndex === 0 ? 0.4 : 1 }}>
              <ChevronLeft size={22} color="#FFFFFF" />
            </IconButton>
            <Button label={isLast ? 'Finish & rate' : 'Next step'} onPress={nextStep} style={{ flex: 1 }} />
          </View>
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={styles.completed} showsVerticalScrollIndicator={false}>
          <View style={[styles.party, { backgroundColor: t.lime }]}>
            <PartyPopper size={36} color={t.onLime} strokeWidth={1.8} />
          </View>
          <Text style={styles.completedTitle}>Dish complete!</Text>
          <Text style={[styles.completedSub, { color: t.textMuted }]}>
            {usedItems.length > 0
              ? `You used ${plural(usedItems.length, 'fridge item')}${expiringUsed > 0 ? `, ${expiringUsed} of them about to expire` : ''}. Nothing wasted.`
              : 'Another one for the streak.'}
          </Text>

          <View style={styles.stars}>
            {[1, 2, 3, 4, 5].map((n) => (
              <TouchableOpacity key={n} onPress={() => setRating(n)} hitSlop={6}>
                <Star size={30} color={t.lime} fill={n <= rating ? t.lime : 'none'} />
              </TouchableOpacity>
            ))}
          </View>
          <Text style={[styles.ratingHint, { color: t.textMuted }]}>{rating ? `${rating}/5 — saved to your notes` : 'How did it turn out?'}</Text>

          {usedItems.length > 0 && (
            <View style={[styles.removeRow, { backgroundColor: t.dark, borderColor: 'rgba(255,255,255,0.1)' }]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.removeTitle}>Remove used items from my fridge</Text>
                <Text style={[styles.removeSub, { color: t.textMuted }]} numberOfLines={2}>{usedItems.map((i) => i.name).join(', ')}</Text>
              </View>
              <Switch value={removeUsed} onValueChange={setRemoveUsed} trackColor={{ false: 'rgba(255,255,255,0.2)', true: t.lime }} thumbColor="#FFFFFF" />
            </View>
          )}

          <Button label="Done & return home" onPress={finish} style={{ alignSelf: 'stretch', marginTop: 8 }} />
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 20, paddingBottom: 20 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  title: { fontFamily: font.display, fontWeight: '400', fontSize: fs(17), color: '#FFFFFF'  },
  counter: { fontSize: fs(11), fontWeight: '700', marginTop: 2, fontFamily: 'monospace' },
  awake: { borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1 },
  awakeText: { fontSize: fs(11), fontWeight: '700' },
  progress: { flexDirection: 'row', gap: 6, marginBottom: 24 },
  segment: { flex: 1, height: 4, borderRadius: 2 },
  body: { flexGrow: 1, justifyContent: 'space-between', paddingBottom: 8 },
  phase: { fontSize: fs(12), fontWeight: '800', letterSpacing: 1.2, marginBottom: 12 },
  instruction: { fontFamily: font.display, fontSize: fs(26), fontWeight: '400', color: '#FFFFFF', lineHeight: fs(33), marginBottom: 22, letterSpacing: -0.4  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  chip: { backgroundColor: 'rgba(255,255,255,0.12)', paddingHorizontal: 16, paddingVertical: 7, borderRadius: 16 },
  chipText: { fontSize: fs(13), fontWeight: '600', color: '#FFFFFF' },
  timerCard: { borderRadius: 24, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 16, borderWidth: 1, marginBottom: 20 },
  timerVal: { fontFamily: font.display, fontWeight: '400', fontSize: fs(20), color: '#FFFFFF' },
  timerTitle: { fontWeight: '800', fontSize: fs(15), color: '#FFFFFF' },
  timerSub: { fontSize: fs(12), marginTop: 2 },
  timerControls: { flexDirection: 'row', gap: 8, marginTop: 10 },
  timerBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 16 },
  timerBtnText: { fontWeight: '800', fontSize: fs(12) },
  actions: { flexDirection: 'row', gap: 12, paddingTop: 16, alignItems: 'center' },
  completed: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10, gap: 8 },
  party: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  completedTitle: { fontFamily: font.display, fontSize: fs(30), fontWeight: '400', color: '#FFFFFF'  },
  completedSub: { fontSize: fs(14), textAlign: 'center', lineHeight: fs(20), marginBottom: 12 },
  stars: { flexDirection: 'row', gap: 10 },
  ratingHint: { fontSize: fs(12), marginBottom: 16 },
  removeRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 20, padding: 16, borderWidth: 1, alignSelf: 'stretch' },
  removeTitle: { color: '#FFFFFF', fontWeight: '800', fontSize: fs(14) },
  removeSub: { fontSize: fs(12), marginTop: 2 },
});
