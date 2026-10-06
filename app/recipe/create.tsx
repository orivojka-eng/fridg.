import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Camera, Plus, X } from '../../src/components/ui/lucide';
import { useRecipeStore } from '../../src/store/useRecipeStore';
import { useFridgeStore } from '../../src/store/useFridgeStore';
import { useUserStore } from '../../src/store/useUserStore';
import { useTheme, fs, font } from '../../src/theme';
import { Screen, Header, SectionTag, Card, Pill, Button, Notice } from '../../src/components/ui';
import { MediaPlaceholder } from '../../src/components/ui/MediaPlaceholder';
import { pickImageFromLibrary } from '../../src/services/imagePickerService';
import { RecipeEffort } from '../../src/types';
import { errorMessage } from '../../src/api/client';
import { PermissionPrimer } from '../../src/components/PermissionPrimer';

let photoPrimerSeen = false;

const LEVELS: RecipeEffort[] = ['Easy', 'Medium', 'Cheffy'];

export default function CreateRecipeScreen() {
  const router = useRouter();
  const t = useTheme();
  const createRecipeAsync = useRecipeStore((s) => s.createRecipeAsync);
  const toggleSave = useRecipeStore((s) => s.toggleSaveRecipe);
  const fridge = useFridgeStore((s) => s.items);
  const { profile, addNotification } = useUserStore();

  const [title, setTitle] = useState('');
  const [time, setTime] = useState('25');
  const [serves, setServes] = useState('2');
  const [level, setLevel] = useState<RecipeEffort>('Easy');
  const [ingredients, setIngredients] = useState<string[]>([]);
  const [ingredientDraft, setIngredientDraft] = useState('');
  const [steps, setSteps] = useState<string[]>([]);
  const [stepDraft, setStepDraft] = useState('');
  const [imageUrl, setImageUrl] = useState<string | undefined>();
  const [showFridge, setShowFridge] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addIngredient = (name: string) => {
    const clean = name.trim();
    if (!clean || ingredients.some((i) => i.toLowerCase() === clean.toLowerCase())) return;
    setIngredients((prev) => [...prev, clean]);
    setIngredientDraft('');
  };

  const addStep = () => {
    const clean = stepDraft.trim();
    if (!clean) return;
    setSteps((prev) => [...prev, clean]);
    setStepDraft('');
  };

  // Explain the photo-library access once before the system prompt appears.
  const [photoPrimer, setPhotoPrimer] = useState(false);
  const pickCover = async () => {
    if (!photoPrimerSeen) {
      setPhotoPrimer(true);
      return;
    }
    try {
      const uri = await pickImageFromLibrary();
      if (uri) setImageUrl(uri);
    } catch {
      Alert.alert('Could not open your photos', 'Check photo permissions and try again.');
    }
  };

  const validate = () => {
    if (title.trim().length < 3) return 'Give the recipe a title.';
    if (ingredients.length === 0) return 'Add at least one ingredient.';
    if (steps.length === 0) return 'Add at least one step.';
    if (!Number(time) || Number(time) <= 0) return 'Cooking time must be a number of minutes.';
    return null;
  };

  const [publishing, setPublishing] = useState(false);

  const publish = async () => {
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    if (publishing) return;
    const minutes = Number(time);
    setPublishing(true);
    let created;
    try {
      created = await createRecipeAsync({
      title: title.trim(),
      imageUrl,
      tone: 'sage',
      prepTimeMin: minutes,
      // Rough estimates until the nutrition service is connected.
      calories: 380 + ingredients.length * 25,
      proteinG: 18 + ingredients.length * 2,
      carbsG: 30 + ingredients.length * 3,
      fatG: 12 + ingredients.length,
      servings: Number(serves) || 2,
      authorName: profile.name,
      authorHandle: profile.handle,
      authorTag: profile.bio,
      effort: level,
      style: 'Bowl',
      ingredients: ingredients.map((name, i) => ({ id: `new-${i}`, name, amount: 'to taste' })),
      steps: steps.map((instruction, i) => ({ stepNumber: i + 1, phase: i === 0 ? 'PREP' : i === steps.length - 1 ? 'PLATE' : 'COOK', instruction, ingredients: [] })),
      likes: 0,
      comments: 0,
    });
    } catch (e) {
      setPublishing(false);
      setError(errorMessage(e, 'Could not publish. Try again.'));
      return;
    }
    setPublishing(false);
    toggleSave(created.id);
    addNotification({ avatarLetter: 'C', kind: 'published', title: 'Recipe published', message: `${created.title} is live on your profile.`, link: `/recipe/${created.id}` });
    router.replace(`/recipe/${created.id}`);
  };

  const canPublish = validate() === null;

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Header title="New recipe" leading="close" right={<Button label="Publish" size="sm" onPress={publish} disabled={!canPublish} />} />

        {error && <Notice text={error} tone="peach" />}

        <TouchableOpacity activeOpacity={0.85} onPress={pickCover}>
          {imageUrl ? (
            <MediaPlaceholder uri={imageUrl} height={180} radius={24} padding={10}>
              <TouchableOpacity style={[styles.removePhoto, { backgroundColor: t.card }]} onPress={() => setImageUrl(undefined)} hitSlop={8}>
                <X size={14} color={t.textStrong} />
              </TouchableOpacity>
            </MediaPlaceholder>
          ) : (
            <View style={[styles.cover, { borderColor: t.border, backgroundColor: t.card }]}>
              <View style={[styles.coverIcon, { backgroundColor: t.cardAlt }]}>
                <Camera size={18} color={t.textStrong} />
              </View>
              <Text style={[styles.coverTitle, { color: t.textStrong }]}>Add cover photo</Text>
              <Text style={[styles.coverSub, { color: t.textMuted }]}>Or shoot the dish — AI writes the recipe</Text>
            </View>
          )}
        </TouchableOpacity>

        <Card style={{ gap: 6 }}>
          <SectionTag>Title</SectionTag>
          <TextInput value={title} onChangeText={(v) => { setTitle(v); setError(null); }} placeholder="Charred pepper & feta orzo" placeholderTextColor={t.textMuted} style={[styles.titleInput, { color: t.textStrong }]} />
        </Card>

        <View style={styles.metaRow}>
          <Card style={styles.metaCard}>
            <SectionTag>Time</SectionTag>
            <View style={styles.metaInputRow}>
              <TextInput value={time} onChangeText={setTime} keyboardType="number-pad" style={[styles.metaInput, { color: t.textStrong }]} maxLength={3} />
              <Text style={[styles.metaUnit, { color: t.textStrong }]}>min</Text>
            </View>
          </Card>
          <Card style={styles.metaCard}>
            <SectionTag>Serves</SectionTag>
            <TextInput value={serves} onChangeText={setServes} keyboardType="number-pad" style={[styles.metaInput, { color: t.textStrong }]} maxLength={2} />
          </Card>
          <Card style={styles.metaCard} onPress={() => setLevel(LEVELS[(LEVELS.indexOf(level) + 1) % LEVELS.length])}>
            <SectionTag>Level</SectionTag>
            <Text style={[styles.metaValue, { color: t.textStrong }]}>{level}</Text>
          </Card>
        </View>

        <Card style={{ gap: 12 }}>
          <View style={styles.sectionRow}>
            <SectionTag>Ingredients</SectionTag>
            <TouchableOpacity onPress={() => setShowFridge((v) => !v)} hitSlop={8}>
              <Text style={[styles.link, { color: t.green }]}>{showFridge ? 'Hide fridge' : 'Pull from fridge'}</Text>
            </TouchableOpacity>
          </View>
          {showFridge && (
            <View style={[styles.fridgeBox, { backgroundColor: t.cardAlt }]}>
              <View style={styles.chips}>
                {fridge.map((f) => (
                  <Pill key={f.id} small label={f.name} variant="lime" selected={ingredients.includes(f.name)} onPress={() => (ingredients.includes(f.name) ? setIngredients((p) => p.filter((n) => n !== f.name)) : addIngredient(f.name))} />
                ))}
              </View>
            </View>
          )}
          <View style={styles.chips}>
            {ingredients.map((name) => (
              <Pill key={name} label={name} selected={false} onPress={() => setIngredients((p) => p.filter((n) => n !== name))} right={<X size={12} color={t.textMuted} />} />
            ))}
            <View style={[styles.addChip, { borderColor: t.border }]}>
              <Plus size={12} color={t.textMuted} />
              <TextInput
                value={ingredientDraft}
                onChangeText={setIngredientDraft}
                placeholder="Add"
                placeholderTextColor={t.textMuted}
                style={[styles.addChipInput, { color: t.textStrong }]}
                onSubmitEditing={() => addIngredient(ingredientDraft)}
                blurOnSubmit={false}
                returnKeyType="done"
              />
            </View>
          </View>
        </Card>

        <Card style={{ gap: 12 }}>
          <SectionTag>Steps</SectionTag>
          {steps.map((s, i) => (
            <View key={`${i}-${s.slice(0, 8)}`} style={styles.stepRow}>
              <View style={[styles.stepNum, { backgroundColor: t.cardAlt }]}>
                <Text style={[styles.stepNumText, { color: t.textStrong }]}>{i + 1}</Text>
              </View>
              <Text style={[styles.stepText, { color: t.textStrong }]}>{s}</Text>
              <TouchableOpacity onPress={() => setSteps((p) => p.filter((_, idx) => idx !== i))} hitSlop={8}>
                <X size={14} color={t.textMuted} />
              </TouchableOpacity>
            </View>
          ))}
          <View style={[styles.stepInputRow, { backgroundColor: t.cardAlt }]}>
            <TextInput
              value={stepDraft}
              onChangeText={setStepDraft}
              placeholder={steps.length === 0 ? 'Char the peppers whole under a hot grill…' : 'Next step'}
              placeholderTextColor={t.textMuted}
              style={[styles.stepInput, { color: t.textStrong }]}
              multiline
            />
            <TouchableOpacity onPress={addStep} disabled={!stepDraft.trim()} style={[styles.stepAdd, { backgroundColor: stepDraft.trim() ? t.lime : t.border }]}>
              <Plus size={16} color={t.onLime} />
            </TouchableOpacity>
          </View>
        </Card>

        <Button label="Publish recipe" variant="dark" onPress={publish} disabled={!canPublish} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40, gap: 14 },
  cover: { borderRadius: 24, borderWidth: 2, borderStyle: 'dashed', padding: 28, alignItems: 'center', gap: 8 },
  coverIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  coverTitle: { fontFamily: font.display, fontWeight: '400', fontSize: fs(17)  },
  coverSub: { fontSize: fs(12) },
  removePhoto: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-end' },
  titleInput: { fontSize: fs(18), fontWeight: '800', paddingVertical: 4 },
  metaRow: { flexDirection: 'row', gap: 10 },
  metaCard: { flex: 1, gap: 6, padding: 14 },
  metaInputRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  metaInput: { fontSize: fs(17), fontWeight: '800', paddingVertical: 0, minWidth: 28 },
  metaUnit: { fontSize: fs(15), fontWeight: '800' },
  metaValue: { fontSize: fs(17), fontWeight: '800' },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  link: { fontSize: fs(12), fontWeight: '700' },
  fridgeBox: { borderRadius: 16, padding: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  addChip: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderStyle: 'dashed', borderRadius: 20, paddingHorizontal: 12, height: 38, minWidth: 80 },
  addChipInput: { fontSize: fs(13), fontWeight: '600', paddingVertical: 0, minWidth: 50 },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  stepNum: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  stepNumText: { fontWeight: '800', fontSize: fs(12) },
  stepText: { flex: 1, fontSize: fs(14), lineHeight: fs(20) },
  stepInputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, borderRadius: 16, padding: 10 },
  stepInput: { flex: 1, fontSize: fs(14), minHeight: 40, maxHeight: 100, paddingVertical: 6 },
  stepAdd: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
});
