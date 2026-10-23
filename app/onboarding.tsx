import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Animated, Easing, Switch, useWindowDimensions } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Svg, { Path, Circle } from 'react-native-svg';
import {
  ChevronLeft, ArrowRight, Dumbbell, ChefHat, Zap, Salad, PiggyBank, CalendarDays, Refrigerator, Leaf, Flame, Sparkles, WandSparkles, Check,
  Soup, Drumstick, Egg, Pizza, Users, User, Sprout, CookingPot, Microwave, Fan, Blend, Wind, Utensils, Timer, ShoppingCart, ShoppingBasket,
  Video, Instagram, Youtube, BookOpen, Smile, Globe, Scale, Ban, WheatOff, Wheat, Coffee, Cake, Sun, Sunrise, Moon, Apple, CupSoda, Calendar,
  Rocket, Home, BarChart3, Activity, Shell, Pencil, Info, UsersRound, Cloud, Fish, Milk, Nut, Beef, Bean, Package, Heart, LucideIcon,
} from '../src/components/ui/lucide';
import { ProcessingOverlay } from '../src/components/ProcessingOverlay';
import { useUserStore } from '../src/store/useUserStore';
import { useFridgeStore } from '../src/store/useFridgeStore';
import { useRecipeStore } from '../src/store/useRecipeStore';
import { useTheme, fs, font, s, colors, motion } from '../src/theme';
import { Screen, Button, IconButton, Avatar, AVATARS, PressableScale, page } from '../src/components/ui';
import { ProgressRing } from '../src/components/ui/ProgressRing';
import { AgeDial } from '../src/components/AgeDial';
import { Paywall, PLANS, PlanKey } from '../src/components/Paywall';
import { Mascot, MascotBubble } from '../src/components/Mascot';
import { computeMatch } from '../src/lib/matching';
import { FoodProfile } from '../src/types';

const AnimatedPath = Animated.createAnimatedComponent(Path);

/* ----------------------------------------------------------------------------
 * The food questionnaire. Each question is rendered by one generic step:
 * single-choice rows, multi-choice tiles (with an optional cap) and an
 * inline "Other" text field where the question allows it.
 * ------------------------------------------------------------------------- */
interface Option {
  id: string;
  label: string;
  icon: LucideIcon;
  desc?: string;
  /** Selecting this clears the others (e.g. "None", "I'm not picky"). */
  exclusive?: boolean;
  /** Reveals a free-text field. */
  other?: boolean;
}
interface Question {
  key: keyof FoodProfile;
  title: string;
  sub: string;
  type: 'single' | 'multi';
  max?: number;
  /** Rows show a description; tiles are compact. */
  layout: 'rows' | 'tiles';
  options: Option[];
}

const QUESTIONS: Question[] = [
  {
    key: 'mainGoal', title: "What's your main\ngoal with food?", sub: 'Choose one. It sets the tone for everything we suggest.', type: 'single', layout: 'rows',
    options: [
      { id: 'healthier', label: 'Eat healthier', icon: Salad, desc: 'More whole foods, better balance' },
      { id: 'muscle', label: 'Build muscle', icon: Dumbbell, desc: 'Protein-forward, training-friendly' },
      { id: 'lose', label: 'Lose weight', icon: Scale, desc: 'Lighter meals that still satisfy' },
      { id: 'energy', label: 'Have more energy', icon: Zap, desc: 'Steady fuel through the day' },
      { id: 'cook', label: 'Cook more at home', icon: CookingPot, desc: 'Fewer takeaways, more confidence' },
      { id: 'money', label: 'Save money', icon: PiggyBank, desc: 'Use what you have, waste nothing' },
      { id: 'enjoy', label: 'Enjoy better food', icon: Smile, desc: 'Taste first, always' },
    ],
  },
  {
    key: 'eatingStyle', title: 'How would you describe\nyour eating style?', sub: 'Choose one.', type: 'single', layout: 'tiles',
    options: [
      { id: 'everything', label: 'I eat everything', icon: Globe },
      { id: 'vegetarian', label: 'Vegetarian', icon: Leaf },
      { id: 'vegan', label: 'Vegan', icon: Sprout },
      { id: 'pescatarian', label: 'Pescatarian', icon: Fish },
      { id: 'highprotein', label: 'High-protein', icon: Dumbbell },
      { id: 'lowcarb', label: 'Low-carb', icon: WheatOff },
      { id: 'other', label: 'Other', icon: Pencil, other: true },
    ],
  },
  {
    key: 'allergies', title: 'Anything you need\nto avoid?', sub: 'Select all that apply. Allergens are hard filters.', type: 'multi', layout: 'tiles',
    options: [
      { id: 'none', label: 'None', icon: Ban, exclusive: true },
      { id: 'dairy', label: 'Dairy', icon: Milk },
      { id: 'eggs', label: 'Eggs', icon: Egg },
      { id: 'gluten', label: 'Gluten', icon: Wheat },
      { id: 'peanuts', label: 'Peanuts', icon: Nut },
      { id: 'treenuts', label: 'Tree nuts', icon: Nut },
      { id: 'shellfish', label: 'Shellfish', icon: Shell },
      { id: 'fish', label: 'Fish', icon: Fish },
      { id: 'soy', label: 'Soy', icon: Bean },
      { id: 'other', label: 'Other', icon: Pencil, other: true },
    ],
  },
  {
    key: 'dislikes', title: 'What foods do\nyou dislike?', sub: 'Select all that apply. We keep them out of your recipes.', type: 'multi', layout: 'tiles',
    options: [
      { id: 'fish', label: 'Fish', icon: Fish },
      { id: 'vegetables', label: 'Vegetables', icon: Salad },
      { id: 'dairy', label: 'Dairy', icon: Milk },
      { id: 'meat', label: 'Meat', icon: Beef },
      { id: 'spicy', label: 'Spicy food', icon: Flame },
      { id: 'onions', label: 'Onions', icon: Sprout },
      { id: 'garlic', label: 'Garlic', icon: Bean },
      { id: 'mushrooms', label: 'Mushrooms', icon: Cloud },
      { id: 'tomatoes', label: 'Tomatoes', icon: Apple },
      { id: 'notpicky', label: "I'm not picky", icon: Heart, exclusive: true },
      { id: 'other', label: 'Add your own', icon: Pencil, other: true },
    ],
  },
  {
    key: 'cuisines', title: 'Which cuisines\ndo you love?', sub: 'Select up to 5.', type: 'multi', max: 5, layout: 'tiles',
    options: [
      { id: 'Greek', label: 'Greek', icon: Salad },
      { id: 'Italian', label: 'Italian', icon: Pizza },
      { id: 'Mediterranean', label: 'Mediterranean', icon: Sun },
      { id: 'Japanese', label: 'Japanese', icon: Fish },
      { id: 'Chinese', label: 'Chinese', icon: Soup },
      { id: 'Mexican', label: 'Mexican', icon: Flame },
      { id: 'Indian', label: 'Indian', icon: Sparkles },
      { id: 'Turkish', label: 'Turkish', icon: CookingPot },
      { id: 'Albanian', label: 'Albanian', icon: Wheat },
      { id: 'American', label: 'American', icon: Beef },
      { id: 'Levantine', label: 'Middle Eastern', icon: Utensils },
      { id: 'other', label: 'Other', icon: Globe, other: true },
    ],
  },
  {
    key: 'skill', title: 'How confident are\nyou in the kitchen?', sub: 'Choose one. We match the level of detail in every recipe.', type: 'single', layout: 'rows',
    options: [
      { id: 'beginner', label: 'Beginner', icon: Egg, desc: "I'm just starting" },
      { id: 'basic', label: 'Basic', icon: CookingPot, desc: 'I can make simple meals' },
      { id: 'comfortable', label: 'Comfortable', icon: ChefHat, desc: 'I can follow most recipes' },
      { id: 'advanced', label: 'Advanced', icon: Flame, desc: 'I love challenging recipes' },
    ],
  },
  {
    key: 'cookTime', title: 'How much time do you\nusually have to cook?', sub: 'Choose one.', type: 'single', layout: 'rows',
    options: [
      { id: 'under15', label: 'Under 15 minutes', icon: Zap, desc: 'Fast and forgiving' },
      { id: '15to30', label: '15–30 minutes', icon: Timer, desc: 'A proper weeknight dinner' },
      { id: '30to60', label: '30–60 minutes', icon: CookingPot, desc: 'Room to do it well' },
      { id: 'over60', label: '60+ minutes', icon: ChefHat, desc: 'I enjoy cooking' },
    ],
  },
  {
    key: 'household', title: 'Who do you\nusually cook for?', sub: 'Choose one. Sets your default servings.', type: 'single', layout: 'tiles',
    options: [
      { id: 'solo', label: 'Just me', icon: User },
      { id: 'pair', label: 'Me + 1', icon: Users },
      { id: 'family', label: '3–4 people', icon: UsersRound },
      { id: 'large', label: '5+ people', icon: Home },
    ],
  },
  {
    key: 'priorities', title: 'What matters most when\nchoosing a recipe?', sub: 'Choose up to 3.', type: 'multi', max: 3, layout: 'tiles',
    options: [
      { id: 'taste', label: 'Taste', icon: Smile },
      { id: 'healthy', label: 'Healthy', icon: Salad },
      { id: 'protein', label: 'High protein', icon: Dumbbell },
      { id: 'lowcal', label: 'Low calories', icon: Flame },
      { id: 'quick', label: 'Quick', icon: Zap },
      { id: 'affordable', label: 'Affordable', icon: PiggyBank },
      { id: 'easy', label: 'Easy to cook', icon: ChefHat },
      { id: 'havein', label: 'Uses what I have', icon: Refrigerator },
    ],
  },
  {
    key: 'cravings', title: 'What kind of food do\nyou usually crave?', sub: 'Select all that apply.', type: 'multi', layout: 'tiles',
    options: [
      { id: 'comfort', label: 'Comfort food', icon: Soup },
      { id: 'fresh', label: 'Fresh & healthy', icon: Salad },
      { id: 'protein', label: 'High-protein', icon: Dumbbell },
      { id: 'indulgent', label: 'Indulgent', icon: Pizza },
      { id: 'sweet', label: 'Something sweet', icon: Cake },
      { id: 'spicy', label: 'Spicy', icon: Flame },
      { id: 'homecooked', label: 'Home-cooked', icon: CookingPot },
      { id: 'new', label: 'Something new', icon: Globe },
    ],
  },
  {
    key: 'adventurous', title: 'How adventurous\nare you with food?', sub: 'Choose one.', type: 'single', layout: 'rows',
    options: [
      { id: 'familiar', label: 'Keep it familiar', icon: Home, desc: 'The dishes I know and love' },
      { id: 'some', label: 'I like some variety', icon: Smile, desc: 'A twist now and then' },
      { id: 'new', label: 'I enjoy trying new cuisines', icon: Globe, desc: 'Show me something different' },
      { id: 'surprise', label: 'Surprise me', icon: Rocket, desc: 'Anything goes' },
    ],
  },
  {
    key: 'meals', title: 'What should FRIDGR\nhelp you with?', sub: 'Select all that apply.', type: 'multi', layout: 'tiles',
    options: [
      { id: 'breakfast', label: 'Breakfast', icon: Sunrise },
      { id: 'lunch', label: 'Lunch', icon: Sun },
      { id: 'dinner', label: 'Dinner', icon: Moon },
      { id: 'snacks', label: 'Snacks', icon: Apple },
      { id: 'desserts', label: 'Desserts', icon: Cake },
      { id: 'mealprep', label: 'Meal prep', icon: Package },
      { id: 'drinks', label: 'Drinks', icon: CupSoda },
    ],
  },
  {
    key: 'frequency', title: 'How often\ndo you cook?', sub: 'Choose one.', type: 'single', layout: 'rows',
    options: [
      { id: 'daily', label: 'Every day', icon: Flame, desc: 'The kitchen is home' },
      { id: '4to6', label: '4–6 times a week', icon: CookingPot, desc: 'Most nights' },
      { id: '2to3', label: '2–3 times a week', icon: Soup, desc: 'A few proper meals' },
      { id: 'weekly', label: 'Once a week', icon: Calendar, desc: 'The occasional cook' },
      { id: 'rarely', label: 'Rarely', icon: Coffee, desc: "Let's change that" },
    ],
  },
  {
    key: 'nutrition', title: 'How important are\ncalories & nutrition?', sub: 'Choose one.', type: 'single', layout: 'rows',
    options: [
      { id: 'no', label: 'Not really', icon: Smile, desc: "I just want good food" },
      { id: 'basic', label: 'Basic info is nice', icon: Info, desc: 'Calories and protein at a glance' },
      { id: 'very', label: 'Very important', icon: BarChart3, desc: 'Full macros on every recipe' },
      { id: 'track', label: 'Track it for me', icon: Activity, desc: 'FRIDGR actively tracks calories & macros' },
    ],
  },
  {
    key: 'become', title: 'What kind of cook do\nyou want to become?', sub: 'Choose one. This is what we work towards together.', type: 'single', layout: 'rows',
    options: [
      { id: 'healthier', label: 'A healthier cook', icon: Salad, desc: 'Better balance, every day' },
      { id: 'fitness', label: 'A fitness-focused cook', icon: Dumbbell, desc: 'Meals that serve your training' },
      { id: 'faster', label: 'A faster cook', icon: Zap, desc: 'Great food in less time' },
      { id: 'budget', label: 'A budget-smart cook', icon: PiggyBank, desc: 'Eat well for less' },
      { id: 'better', label: 'A better cook', icon: ChefHat, desc: 'Technique, confidence, range' },
      { id: 'adventurous', label: 'A more adventurous cook', icon: Globe, desc: 'New cuisines, new ideas' },
      { id: 'amazing', label: 'Someone who makes amazing food', icon: Sparkles, desc: 'That is the whole point' },
    ],
  },
];

const KIT: Array<{ id: string; label: string; icon: LucideIcon }> = [
  { id: 'Oven', label: 'Oven', icon: Flame },
  { id: 'Hob', label: 'Hob', icon: CookingPot },
  { id: 'Air fryer', label: 'Air fryer', icon: Wind },
  { id: 'Microwave', label: 'Microwave', icon: Microwave },
  { id: 'Blender', label: 'Blender', icon: Blend },
  { id: 'Slow cooker', label: 'Slow cooker', icon: Timer },
  { id: 'Grill', label: 'Grill / BBQ', icon: Utensils },
  { id: 'Extractor', label: 'Just the basics', icon: Fan },
];

type ShoppingHabit = 'weekly' | 'often' | 'asneeded';
const SHOPPING: Array<{ id: ShoppingHabit; label: string; desc: string; icon: LucideIcon }> = [
  { id: 'weekly', label: 'One big weekly shop', desc: 'We plan the week around what you bring home', icon: ShoppingCart },
  { id: 'often', label: 'Little and often', desc: 'Short lists, fresh stuff, fewer leftovers', icon: ShoppingBasket },
  { id: 'asneeded', label: 'Whenever it runs out', desc: 'We lean on what is already in the fridge', icon: Refrigerator },
];

const SOURCES: Array<{ id: string; label: string; icon: LucideIcon }> = [
  { id: 'TikTok', label: 'TikTok', icon: Video },
  { id: 'Instagram', label: 'Instagram', icon: Instagram },
  { id: 'YouTube', label: 'YouTube', icon: Youtube },
  { id: 'Cookbooks', label: 'Cookbooks', icon: BookOpen },
  { id: 'Friends', label: 'Friends & family', icon: Users },
  { id: 'Improvise', label: 'I improvise', icon: Sparkles },
];

const MOODS: Array<{ id: string; label: string; icon: LucideIcon; hint: string }> = [
  { id: 'quick', label: 'Quick bite', icon: Zap, hint: 'Something fast, minimal washing up' },
  { id: 'comfort', label: 'Comfort', icon: Soup, hint: 'Warm, hearty, forgiving' },
  { id: 'fresh', label: 'Fresh', icon: Salad, hint: 'Light, crunchy, lots of veg' },
  { id: 'protein', label: 'Protein', icon: Drumstick, hint: 'Big on protein, built for training' },
  { id: 'feast', label: 'Feast', icon: ChefHat, hint: 'Ambitious. Worth the effort' },
];

const SETUP_ICONS = [Dumbbell, Salad, Refrigerator, ChefHat, Leaf, CalendarDays, Flame, Sparkles];

const COMMUNITY = [
  { name: 'Nadia', avatar: 0, x: 0.08, y: 0.06, tag: 'lime' as const },
  { name: 'Sam', avatar: 1, x: 0.62, y: 0.02, tag: 'dark' as const },
  { name: 'Eleni', avatar: 2, x: 0.34, y: 0.3, tag: 'peach' as const },
  { name: 'Marta', avatar: 4, x: 0.74, y: 0.42, tag: 'lime' as const },
  { name: 'Amir', avatar: 5, x: 0.12, y: 0.6, tag: 'dark' as const },
  { name: 'Yuki', avatar: 3, x: 0.48, y: 0.7, tag: 'peach' as const },
];
const FLOATING_ICONS: Array<{ icon: LucideIcon; x: number; y: number; tone: 'lime' | 'peach' | 'sage' }> = [
  { icon: Flame, x: 0.26, y: 0.14, tone: 'peach' },
  { icon: Leaf, x: 0.9, y: 0.22, tone: 'sage' },
  { icon: Egg, x: 0.58, y: 0.5, tone: 'lime' },
  { icon: Pizza, x: 0.3, y: 0.82, tone: 'peach' },
];

/** Ordered steps. Question keys map to QUESTIONS; the rest are bespoke screens. */
type StepKey = 'welcome' | 'about' | 'age' | keyof FoodProfile | 'kit' | 'shopping' | 'sources' | 'mood' | 'notifications' | 'premium';
const SIGNUP_STEPS: StepKey[] = [
  'welcome', 'about', 'age',
  'mainGoal', 'eatingStyle', 'allergies', 'dislikes', 'cuisines', 'skill', 'cookTime', 'household', 'kit',
  'priorities', 'cravings', 'adventurous', 'meals', 'frequency', 'nutrition', 'become',
  'shopping', 'sources', 'mood', 'notifications', 'premium',
];
const EDIT_STEPS: StepKey[] = SIGNUP_STEPS.filter((k) => !['welcome', 'about', 'age', 'premium'].includes(k));

/* ----------------------------------------------------------------------------
 * Mappings from questionnaire answers to the legacy profile fields the rest
 * of the app already reads (goals, diet, allergies, cuisines, time, skill…).
 * ------------------------------------------------------------------------- */
const GOAL_LABEL: Record<string, string> = { healthier: 'Healthy', muscle: 'Fitness', lose: 'Healthy', energy: 'Healthy', cook: 'Foodie', money: 'Budget', enjoy: 'Foodie' };
const DIET_LABEL: Record<string, string> = { everything: 'No restrictions', vegetarian: 'Vegetarian', vegan: 'Vegan', pescatarian: 'Pescatarian', highprotein: 'High protein', lowcarb: 'Low carb' };
const ALLERGY_LABEL: Record<string, string> = { dairy: 'Dairy', eggs: 'Eggs', gluten: 'Gluten', peanuts: 'Peanuts', treenuts: 'Tree nuts', shellfish: 'Shellfish', fish: 'Fish', soy: 'Soy' };
const TIME_MIN: Record<string, number> = { under15: 15, '15to30': 30, '30to60': 60, over60: 90 };
const SKILL_LEVEL: Record<string, 'beginner' | 'home' | 'confident' | 'chef'> = { beginner: 'beginner', basic: 'home', comfortable: 'confident', advanced: 'chef' };
const SERVINGS: Record<string, number> = { solo: 1, pair: 2, family: 4, large: 4 };

/* ----------------------------------------------------------------------------
 * Small animated pieces
 * ------------------------------------------------------------------------- */
const Floaty: React.FC<{ delay?: number; amplitude?: number; children: React.ReactNode; style?: any }> = ({ delay = 0, amplitude = 8, children, style }) => {
  const v = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.sequence([Animated.delay(delay), Animated.spring(pop, { toValue: 1, useNativeDriver: true, speed: 10, bounciness: 10 })]).start();
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(v, { toValue: 1, duration: 1500 + delay, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration: 1500 + delay, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [v, pop, delay]);
  return (
    <Animated.View style={[style, { opacity: pop, transform: [{ scale: pop }, { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -amplitude] }) }] }]}>
      {children}
    </Animated.View>
  );
};

const Wave: React.FC<{ width: number; height: number }> = ({ width, height }) => {
  const draw = useRef(new Animated.Value(0)).current;
  const len = width * 1.6;
  useEffect(() => {
    Animated.timing(draw, { toValue: 1, duration: 1400, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [draw]);
  const d = `M -10 ${height * 0.55} C ${width * 0.25} ${height * 0.15}, ${width * 0.4} ${height * 0.95}, ${width * 0.62} ${height * 0.5} S ${width * 0.9} ${height * 0.1}, ${width + 10} ${height * 0.35}`;
  return (
    <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
      <AnimatedPath d={d} stroke={colors.primaryLime} strokeWidth={4} fill="none" strokeLinecap="round" strokeDasharray={`${len} ${len}`} strokeDashoffset={draw.interpolate({ inputRange: [0, 1], outputRange: [len, 0] }) as any} />
    </Svg>
  );
};

const NextRing: React.FC<{ progress: number; onPress: () => void; disabled?: boolean }> = ({ progress, onPress, disabled }) => {
  const t = useTheme();
  return (
    <PressableScale onPress={onPress} disabled={disabled} scaleTo={0.92} style={[styles.nextWrap, disabled && { opacity: 0.4 }]}>
      <ProgressRing animated progress={progress} size={s(76)} strokeWidth={4} color={t.lime} trackColor={t.isDark ? 'rgba(255,255,255,0.1)' : '#E6E6E2'}>
        <View style={[styles.nextInner, { backgroundColor: t.dark }]}>
          <ArrowRight size={s(22)} color="#FFFFFF" strokeWidth={2.4} />
        </View>
      </ProgressRing>
    </PressableScale>
  );
};

const ArcOption: React.FC<{ icon: LucideIcon; selected: boolean; onPress: () => void; x: number; y: number; size: number }> = ({ icon: Icon, selected, onPress, x, y, size }) => {
  const t = useTheme();
  const a = useRef(new Animated.Value(selected ? 1 : 0)).current;
  useEffect(() => {
    Animated.spring(a, { toValue: selected ? 1 : 0, useNativeDriver: true, speed: 16, bounciness: 10 }).start();
  }, [selected, a]);
  return (
    <PressableScale onPress={onPress} scaleTo={0.9} style={{ position: 'absolute', left: x - size / 2, top: y - size / 2 }}>
      <Animated.View
        style={[
          styles.arcOption,
          { width: size, height: size, borderRadius: size / 2, backgroundColor: selected ? t.lime : t.card, borderColor: selected ? t.lime : t.border },
          { transform: [{ scale: a.interpolate({ inputRange: [0, 1], outputRange: [1, 1.45] }) }, { translateY: a.interpolate({ inputRange: [0, 1], outputRange: [0, -10] }) }] },
        ]}
      >
        <Icon size={size * 0.48} color={selected ? t.onLime : t.textMuted} strokeWidth={selected ? 2.2 : 1.8} />
      </Animated.View>
    </PressableScale>
  );
};

/** Full-width single-choice row with an icon; border and tint spring on select. */
const OptionRow: React.FC<{ icon: LucideIcon; label: string; desc?: string; selected: boolean; onPress: () => void }> = ({ icon: Icon, label, desc, selected, onPress }) => {
  const t = useTheme();
  const a = useRef(new Animated.Value(selected ? 1 : 0)).current;
  useEffect(() => {
    Animated.spring(a, { toValue: selected ? 1 : 0, useNativeDriver: true, speed: 18, bounciness: 6 }).start();
  }, [selected, a]);
  return (
    <PressableScale onPress={onPress} scaleTo={0.98} highlight radius={18} highlightColor="#14180F">
      <View style={[styles.optionRow, { backgroundColor: selected ? (t.isDark ? t.sage : '#F7FCEB') : t.card, borderColor: selected ? t.lime : t.border, borderWidth: selected ? 2 : 1 }]}>
        <Animated.View style={[styles.optionIcon, { backgroundColor: selected ? t.lime : t.cardAlt, transform: [{ scale: a.interpolate({ inputRange: [0, 1], outputRange: [1, 1.1] }) }] }]}>
          <Icon size={20} color={t.textStrong} strokeWidth={2} />
        </Animated.View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.optionLabel, { color: t.textStrong }]}>{label}</Text>
          {desc ? <Text style={[styles.optionDesc, { color: t.textMuted }]}>{desc}</Text> : null}
        </View>
        <View style={[styles.radio, { borderColor: selected ? t.lime : t.border, backgroundColor: selected ? t.lime : 'transparent' }]}>
          {selected && <Check size={12} color={t.onLime} strokeWidth={3} />}
        </View>
      </View>
    </PressableScale>
  );
};

/** Compact square tile with an icon; pops on select. */
const IconTile: React.FC<{ icon: LucideIcon; label: string; selected: boolean; onPress: () => void; dim?: boolean }> = ({ icon: Icon, label, selected, onPress, dim }) => {
  const t = useTheme();
  const a = useRef(new Animated.Value(selected ? 1 : 0)).current;
  useEffect(() => {
    Animated.spring(a, { toValue: selected ? 1 : 0, useNativeDriver: true, speed: 20, bounciness: 8 }).start();
  }, [selected, a]);
  return (
    <PressableScale onPress={onPress} scaleTo={0.94} style={[styles.tileWrap, dim && { opacity: 0.45 }]}>
      <View style={[styles.tile, { backgroundColor: selected ? t.lime : t.card, borderColor: selected ? t.lime : t.border }]}>
        <Animated.View style={{ transform: [{ scale: a.interpolate({ inputRange: [0, 1], outputRange: [1, 1.15] }) }] }}>
          <Icon size={22} color={selected ? t.onLime : t.textStrong} strokeWidth={selected ? 2.2 : 1.8} />
        </Animated.View>
        <Text style={[styles.tileLabel, { color: selected ? t.onLime : t.textStrong }]} numberOfLines={1}>{label}</Text>
        {selected && (
          <View style={[styles.tileCheck, { backgroundColor: t.dark }]}>
            <Check size={10} color={t.lime} strokeWidth={3} />
          </View>
        )}
      </View>
    </PressableScale>
  );
};

/** Step title + optional subtitle. Module-level so it never remounts mid-transition. */
/** Question header: Fridgy asks it, the hint sits in his speech bubble. */
const Title: React.FC<{ children: string; sub?: string }> = ({ children, sub }) => {
  const t = useTheme();
  return (
    <>
      <Text style={[styles.h1Center, { color: t.text }]}>{children}</Text>
      {sub ? (
        <View style={styles.askRow}>
          <Mascot size={s(52)} float />
          <MascotBubble tone={t.isDark ? 'dark' : 'light'} style={{ flex: 1 }}>
            <Text style={{ color: t.isDark ? '#FFFFFF' : t.textStrong, fontSize: fs(13), lineHeight: fs(18), fontWeight: '600' }}>{sub}</Text>
          </MascotBubble>
        </View>
      ) : null}
    </>
  );
};

/* ----------------------------------------------------------------------------
 * Generic questionnaire step
 * ------------------------------------------------------------------------- */
const QuestionStep: React.FC<{
  q: Question;
  value: string[];
  other: string;
  onChange: (ids: string[]) => void;
  onOther: (text: string) => void;
  progress: number;
  onNext: () => void;
}> = ({ q, value, other, onChange, onOther, progress, onNext }) => {
  const t = useTheme();
  const otherOn = value.includes('other');
  const atMax = q.type === 'multi' && !!q.max && value.length >= q.max;

  const pick = (opt: Option) => {
    if (q.type === 'single') return onChange([opt.id]);
    if (opt.exclusive) return onChange(value.includes(opt.id) ? [] : [opt.id]);
    const withoutExclusive = value.filter((id) => !q.options.find((o) => o.id === id)?.exclusive);
    if (withoutExclusive.includes(opt.id)) return onChange(withoutExclusive.filter((id) => id !== opt.id));
    if (q.max && withoutExclusive.length >= q.max) return;
    onChange([...withoutExclusive, opt.id]);
  };

  const count = q.type === 'multi' && q.max ? ` (${value.filter((v) => v !== 'other').length}/${q.max})` : '';
  const canContinue = value.length > 0 && (!otherOn || other.trim().length > 0 || value.length > 1);

  return (
    <View style={styles.step}>
      <Title sub={q.sub + count}>{q.title}</Title>
      {q.layout === 'rows' ? (
        <View style={{ gap: 10 }}>
          {q.options.map((o) => (
            <OptionRow key={o.id} icon={o.icon} label={o.label} desc={o.desc} selected={value.includes(o.id)} onPress={() => pick(o)} />
          ))}
        </View>
      ) : (
        <View style={styles.tiles}>
          {q.options.map((o) => (
            <IconTile key={o.id} icon={o.icon} label={o.label} selected={value.includes(o.id)} onPress={() => pick(o)} dim={atMax && !value.includes(o.id)} />
          ))}
        </View>
      )}
      {otherOn && (
        <TextInput
          value={other}
          onChangeText={onOther}
          placeholder="Tell us more…"
          placeholderTextColor={t.textMuted}
          style={[styles.input, { backgroundColor: t.cardAlt, color: t.textStrong }]}
          autoFocus
        />
      )}
      <NextRing progress={progress} onPress={onNext} disabled={!canContinue} />
    </View>
  );
};

/* ----------------------------------------------------------------------------
 * Screen
 * ------------------------------------------------------------------------- */
export default function OnboardingScreen() {
  const router = useRouter();
  const t = useTheme();
  const { width } = useWindowDimensions();
  const { from } = useLocalSearchParams<{ from?: string }>();
  const editing = from === 'profile';
  const { profile, hasOnboarded, completeOnboarding, updatePreferences, updateAccount, avatarIndex, setAvatarIndex, setPremium, addNotification } = useUserStore();
  const fridge = useFridgeStore((u) => u.items);
  const recipes = useRecipeStore((u) => u.recipes);
  const setGeneratorServings = useRecipeStore((u) => u.setGeneratorServings);
  const setGeneratorEffort = useRecipeStore((u) => u.setGeneratorEffort);

  const STEPS = editing ? EDIT_STEPS : SIGNUP_STEPS;
  const [pos, setPos] = useState(0);
  const step = STEPS[pos];
  const total = STEPS.length;
  const progress = (pos + 1) / total;
  const scrollRef = useRef<ScrollView>(null);

  /* --- transition: current content eases out, next eases in ------------ */
  const slide = useRef(new Animated.Value(1)).current;
  const dir = useRef(1);
  const busy = useRef(false);
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; slide.stopAnimation(); }, [slide]);
  const goTo = (nextPos: number) => {
    if (busy.current || nextPos === pos || nextPos < 0 || nextPos >= total) return;
    busy.current = true;
    dir.current = nextPos > pos ? 1 : -1;
    slide.stopAnimation();
    Animated.timing(slide, { toValue: 0, duration: 130, easing: Easing.in(Easing.quad), useNativeDriver: true }).start(() => {
      if (!mounted.current) return;
      setPos(nextPos);
      scrollRef.current?.scrollTo({ y: 0, animated: false });
      requestAnimationFrame(() => {
        Animated.timing(slide, { toValue: 1, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start(() => {
          busy.current = false;
        });
      });
    });
    setTimeout(() => { busy.current = false; }, 700);
  };
  const next = () => goTo(Math.min(pos + 1, total - 1));
  const back = () => (pos > 0 ? goTo(pos - 1) : editing ? cancelEdit() : undefined);

  /* --- answers ---------------------------------------------------------- */
  const fp0 = profile.foodProfile ?? {};
  const [firstName, setFirstName] = useState(profile.firstName);
  const [lastName, setLastName] = useState(profile.lastName);
  const [age, setAge] = useState<number | null>(profile.age ?? 28);
  const [answers, setAnswers] = useState<Record<string, string[]>>(() => {
    const init: Record<string, string[]> = {};
    QUESTIONS.forEach((q) => {
      const v = (fp0 as any)[q.key];
      init[q.key] = Array.isArray(v) ? v : v ? [v] : [];
    });
    return init;
  });
  const [others, setOthers] = useState<Record<string, string>>(fp0.other ?? {});
  const [kit, setKit] = useState<string[]>(profile.equipment ?? ['Oven', 'Hob']);
  const [shopping, setShopping] = useState<ShoppingHabit | null>(profile.shoppingHabit ?? null);
  const [sources, setSources] = useState<string[]>(profile.recipeSources ?? []);
  const [mood, setMood] = useState<string>(profile.mood ?? 'fresh');
  const [notifs, setNotifs] = useState(profile.notifPrefs ?? { expiry: true, plan: true, creators: false });
  const [plan, setPlan] = useState<PlanKey>('yearly');
  const [aboutError, setAboutError] = useState<string | null>(null);

  const toggleIn = (setter: React.Dispatch<React.SetStateAction<string[]>>, item: string) =>
    setter((prev) => (prev.includes(item) ? prev.filter((i) => i !== item) : [...prev, item]));

  const single = (k: keyof FoodProfile) => answers[k]?.[0];
  const multi = (k: keyof FoodProfile) => answers[k] ?? [];

  /** Build the Food Profile plus the legacy fields the rest of the app reads. */
  const buildAnswers = () => {
    const foodProfile: FoodProfile = {
      mainGoal: single('mainGoal'),
      eatingStyle: single('eatingStyle'),
      allergies: multi('allergies').filter((a) => a !== 'none' && a !== 'other'),
      dislikes: multi('dislikes').filter((a) => a !== 'notpicky' && a !== 'other'),
      cuisines: multi('cuisines').filter((c) => c !== 'other'),
      skill: single('skill'),
      cookTime: single('cookTime'),
      household: single('household'),
      priorities: multi('priorities'),
      cravings: multi('cravings'),
      adventurous: single('adventurous'),
      meals: multi('meals'),
      frequency: single('frequency'),
      nutrition: single('nutrition'),
      become: single('become'),
      other: others,
      signals: fp0.signals ?? {},
    };
    const household = (single('household') ?? profile.household ?? 'solo') as 'solo' | 'pair' | 'family' | 'large';
    const goalLabel = GOAL_LABEL[single('mainGoal') ?? ''] ?? profile.goals[0];
    const dietLabel = DIET_LABEL[single('eatingStyle') ?? ''] ?? profile.diet[0];
    return {
      goals: [goalLabel, single('become') === 'fitness' ? 'Fitness' : null].filter((g): g is string => !!g && g !== undefined),
      diet: dietLabel ? [dietLabel] : [],
      allergies: foodProfile.allergies!.map((a) => ALLERGY_LABEL[a] ?? a),
      cuisines: foodProfile.cuisines!,
      cookingTimeMin: TIME_MIN[single('cookTime') ?? ''] ?? profile.cookingTimeMin,
      household,
      mood,
      skillLevel: SKILL_LEVEL[single('skill') ?? ''] ?? profile.skillLevel,
      equipment: kit,
      shoppingHabit: shopping ?? undefined,
      recipeSources: sources,
      notifPrefs: notifs,
      foodProfile,
    };
  };

  /* --- leaving ---------------------------------------------------------- */
  const [leaving, setLeaving] = useState(false);
  const profileReadyPending = useUserStore((u) => u.profileReadyPending);
  useEffect(() => {
    if (leaving && hasOnboarded) router.replace(profileReadyPending ? '/auth/profile-ready' : '/(tabs)');
  }, [leaving, hasOnboarded, profileReadyPending, router]);
  const leave = () => {
    if (editing && router.canGoBack()) router.back();
    else setLeaving(true);
  };
  const cancelEdit = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/profile');
  };

  const [processing, setProcessing] = useState(false);
  const setupMs = editing ? 1500 : 2600;
  const finish = (withPremium = false, chosen: PlanKey = plan) => {
    setProcessing(true);
    setTimeout(() => {
      const a = buildAnswers();
      if (!editing) updateAccount({ firstName: firstName.trim(), lastName: lastName.trim(), age: age ?? undefined });
      if (withPremium) {
        setPremium(true);
        addNotification({ avatarLetter: '★', kind: 'premium', title: 'Welcome to FRIDGR Premium', message: `Your ${PLANS[chosen].label.toLowerCase()} plan is active.`, link: '/(tabs)/profile' });
      }
      setGeneratorServings(SERVINGS[a.household] ?? 2);
      setGeneratorEffort(a.skillLevel === 'confident' || a.skillLevel === 'chef' ? 'Cheffy' : 'Easy');
      if (hasOnboarded) updatePreferences(a);
      else completeOnboarding(a);
      leave();
    }, setupMs);
  };

  const nextFromAbout = () => {
    if (firstName.trim().length < 2) return setAboutError('We need your first name.');
    if (lastName.trim().length < 2) return setAboutError('And your surname.');
    setAboutError(null);
    next();
  };

  /* --- derived ---------------------------------------------------------- */
  const readyCount = recipes.filter((r) => computeMatch(r, fridge).matchPercent >= 80).length;
  const displayName = firstName.trim();
  const allergyNames = multi('allergies').filter((a) => ALLERGY_LABEL[a]).map((a) => ALLERGY_LABEL[a].toLowerCase());

  const arcW = Math.min(width - 48, 360);
  const arcR = arcW / 2 - 24;
  const arcCX = arcW / 2;
  const arcCY = arcR + 36;
  const moodIndex = MOODS.findIndex((m) => m.id === mood);
  const optionSize = s(44);
  const canvasH = s(300);

  const question = QUESTIONS.find((q) => q.key === step);

  /* --- render ----------------------------------------------------------- */
  const overlay = (
    <ProcessingOverlay
      visible={processing}
      title={editing ? 'Updating your food profile' : 'Building your food profile'}
      icons={SETUP_ICONS}
      centerIcon={WandSparkles}
      durationMs={setupMs}
      lines={[
        editing ? 'Saving your answers' : `Creating a profile for ${displayName || 'you'}`,
        allergyNames.length ? `Filtering out ${allergyNames.join(', ')}` : 'Checking your eating style',
        multi('cuisines').length ? `Tuning for ${multi('cuisines').slice(0, 2).join(' & ')} cooking` : `Reading ${fridge.length} items in your fridge`,
        `Matching ${readyCount} recipes for tonight`,
      ]}
    />
  );

  if (step === 'premium') {
    return (
      <>
        {overlay}
        <Paywall
          isPremium={profile.isPremium}
          skipLabel="Continue on the free plan"
          onClose={() => finish(false)}
          onSubscribe={async (p) => {
            // Demo mode: the plan activates locally.
            setPlan(p);
            setPremium(true);
            addNotification({ avatarLetter: '★', kind: 'premium', title: 'Welcome to FRIDGR Premium', message: `Your ${PLANS[p].label.toLowerCase()} plan is active.`, link: '/(tabs)/profile' });
            return true;
          }}
          onRestore={async () => profile.isPremium}
          onDone={() => finish(false)}
        />
      </>
    );
  }

  return (
    <Screen style={{ backgroundColor: t.card }}>
      {overlay}
      <ScrollView ref={scrollRef} contentContainerStyle={[page, styles.scroll]} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {step !== 'welcome' && (
          <View style={styles.header}>
            <IconButton size={40} onPress={back}>
              <ChevronLeft size={20} color={t.textStrong} />
            </IconButton>
            <Text style={[styles.counter, { color: t.textMuted }]}>{pos + 1} of {total}</Text>
            {editing ? (
              <TouchableOpacity onPress={cancelEdit} hitSlop={8} style={[styles.skipPill, { backgroundColor: t.cardAlt }]}>
                <Text style={[styles.skip, { color: t.textStrong }]}>Cancel</Text>
              </TouchableOpacity>
            ) : (
              <View style={{ width: 40 }} />
            )}
          </View>
        )}

        <Animated.View
          style={{
            opacity: slide,
            transform: [
              { translateX: slide.interpolate({ inputRange: [0, 1], outputRange: [26 * dir.current, 0] }) },
              { scale: slide.interpolate({ inputRange: [0, 1], outputRange: [0.985, 1] }) },
            ],
          }}
        >
          {step === 'welcome' && (
            <View style={styles.step}>
              <View style={[styles.canvas, { height: canvasH }]}>
                <Wave width={width - 40} height={canvasH} />
                {FLOATING_ICONS.map((f, i) => (
                  <Floaty key={i} delay={200 + i * 180} amplitude={6} style={[styles.floatIcon, { left: f.x * (width - 40) - 16, top: f.y * canvasH, backgroundColor: f.tone === 'lime' ? t.lime : f.tone === 'peach' ? t.peach : t.sage }]}>
                    <f.icon size={16} color={f.tone === 'peach' ? t.orange : t.textStrong} strokeWidth={2} />
                  </Floaty>
                ))}
                {COMMUNITY.map((c, i) => (
                  <Floaty key={c.name} delay={i * 140} style={[styles.member, { left: c.x * (width - 40), top: c.y * canvasH }]}>
                    <Avatar index={c.avatar} size={s(52)} />
                    <View style={[styles.tag, { backgroundColor: c.tag === 'lime' ? t.lime : c.tag === 'dark' ? t.dark : t.peach }]}>
                      <Text style={[styles.tagText, { color: c.tag === 'dark' ? '#FFFFFF' : c.tag === 'peach' ? t.orange : t.onLime }]}>{c.name}</Text>
                    </View>
                  </Floaty>
                ))}
              </View>
              <Text style={[styles.welcomeTitle, { color: t.text }]}>Welcome to{'\n'}FRIDGR, {displayName || 'chef'}.</Text>
              <Text style={[styles.pCenter, { color: t.textMuted }]}>A few quick questions build your Food Profile: the thing every recipe, swap and meal plan is tuned to.</Text>
              <View style={{ alignItems: 'center', marginTop: 10 }}>
                <Button label="Get started" onPress={next} style={{ paddingHorizontal: 28 }} right={<View style={[styles.limeDot, { backgroundColor: t.dark }]}><ArrowRight size={14} color={t.lime} /></View>} />
              </View>
            </View>
          )}

          {step === 'about' && (
            <View style={styles.step}>
              <Title sub="Pick a face and check your details.">{`Nice to meet you${displayName ? `, ${displayName}` : ''}.`}</Title>
              <View style={styles.avatarRow}>
                {AVATARS.map((_, i) => (
                  <PressableScale key={i} onPress={() => setAvatarIndex(i)} scaleTo={0.9}>
                    <Avatar index={i} size={s(50)} selected={i === avatarIndex} />
                  </PressableScale>
                ))}
              </View>
              <View style={styles.row}>
                <TextInput value={firstName} onChangeText={(v) => { setFirstName(v); setAboutError(null); }} placeholder="First name" placeholderTextColor={t.textMuted} style={[styles.input, { flex: 1, backgroundColor: t.cardAlt, color: t.textStrong }]} autoCapitalize="words" />
                <TextInput value={lastName} onChangeText={(v) => { setLastName(v); setAboutError(null); }} placeholder="Surname" placeholderTextColor={t.textMuted} style={[styles.input, { flex: 1, backgroundColor: t.cardAlt, color: t.textStrong }]} autoCapitalize="words" />
              </View>
              <Text style={[styles.emailNote, { color: t.textMuted }]}>Signed up as {profile.email}</Text>
              {aboutError && <Text style={[styles.error, { color: t.orange }]}>{aboutError}</Text>}
              <NextRing progress={progress} onPress={nextFromAbout} />
            </View>
          )}

          {step === 'age' && (
            <View style={styles.step}>
              <Title sub="Your age only tunes portions and nutrition. It stays private.">One more thing.</Title>
              <AgeDial value={age} onChange={setAge} />
              <NextRing progress={progress} onPress={next} />
            </View>
          )}

          {question && (
            <QuestionStep
              q={question}
              value={answers[question.key] ?? []}
              other={others[question.key] ?? ''}
              onChange={(ids) => setAnswers((prev) => ({ ...prev, [question.key]: ids }))}
              onOther={(text) => setOthers((prev) => ({ ...prev, [question.key]: text }))}
              progress={progress}
              onNext={next}
            />
          )}

          {step === 'kit' && (
            <View style={styles.step}>
              <Title sub="We only suggest recipes you can actually make.">{'What do you\ncook with?'}</Title>
              <View style={styles.tiles}>
                {KIT.map((k) => (
                  <IconTile key={k.id} icon={k.icon} label={k.label} selected={kit.includes(k.id)} onPress={() => toggleIn(setKit, k.id)} />
                ))}
              </View>
              <NextRing progress={progress} onPress={next} disabled={kit.length === 0} />
            </View>
          )}

          {step === 'shopping' && (
            <View style={styles.step}>
              <Title sub="It changes how we build your shopping list and meal plan.">{'How do you\nusually shop?'}</Title>
              <View style={{ gap: 10 }}>
                {SHOPPING.map((o) => (
                  <OptionRow key={o.id} icon={o.icon} label={o.label} desc={o.desc} selected={shopping === o.id} onPress={() => setShopping(o.id)} />
                ))}
              </View>
              <NextRing progress={progress} onPress={next} disabled={!shopping} />
            </View>
          )}

          {step === 'sources' && (
            <View style={styles.step}>
              <Title sub="Paste a link from any of these and we turn it into a recipe.">{'Where do your\nrecipes come from?'}</Title>
              <View style={styles.tiles}>
                {SOURCES.map((o) => (
                  <IconTile key={o.id} icon={o.icon} label={o.label} selected={sources.includes(o.id)} onPress={() => toggleIn(setSources, o.id)} />
                ))}
              </View>
              <NextRing progress={progress} onPress={next} />
            </View>
          )}

          {step === 'mood' && (
            <View style={styles.step}>
              <Title sub="This tunes the first recipes we suggest. Change it any time.">{"What's your\nfood mood tonight?"}</Title>
              <View style={{ alignSelf: 'center', width: arcW, height: arcCY + 40 }}>
                <Svg width={arcW} height={arcCY + 40} style={StyleSheet.absoluteFill}>
                  {Array.from({ length: 25 }).map((_, i) => {
                    const a = Math.PI - (i / 24) * Math.PI;
                    const r = arcR + 34;
                    const on = i / 24 <= (moodIndex < 0 ? 0 : moodIndex / (MOODS.length - 1)) + 0.02;
                    return <Circle key={i} cx={arcCX + Math.cos(a) * r} cy={arcCY - Math.sin(a) * r} r={i % 6 === 0 ? 3 : 1.6} fill={on ? colors.primaryLime : t.isDark ? 'rgba(255,255,255,0.15)' : '#DADAD6'} />;
                  })}
                </Svg>
                {MOODS.map((m, i) => {
                  const a = Math.PI - (i / (MOODS.length - 1)) * Math.PI;
                  return <ArcOption key={m.id} icon={m.icon} selected={mood === m.id} onPress={() => setMood(m.id)} x={arcCX + Math.cos(a) * arcR} y={arcCY - Math.sin(a) * arcR} size={optionSize} />;
                })}
                <View style={[styles.moodPill, { backgroundColor: t.dark, top: arcCY - 30, left: arcCX - 60 }]}>
                  <Text style={[styles.moodLabel, { color: t.lime }]} numberOfLines={1}>{MOODS[moodIndex]?.label ?? 'Pick one'}</Text>
                </View>
              </View>
              <Text style={[styles.pCenter, { color: t.textMuted, marginTop: -8 }]}>{MOODS[moodIndex]?.hint ?? ''}</Text>
              <NextRing progress={progress} onPress={next} />
            </View>
          )}

          {step === 'notifications' && (
            <View style={styles.step}>
              <Title sub="Only the useful ones. Change them any time in Profile.">{'What should we\nnudge you about?'}</Title>
              <View style={[styles.toggles, { backgroundColor: t.card, borderColor: t.border }]}>
                {[
                  { key: 'expiry' as const, icon: Leaf, label: 'Use it before it turns', desc: 'A heads-up 2 days before something expires' },
                  { key: 'plan' as const, icon: CalendarDays, label: 'Weekly meal plan', desc: 'Sunday: a week of dinners from your fridge' },
                  { key: 'creators' as const, icon: ChefHat, label: 'New from creators you follow', desc: 'When they post something you can make' },
                ].map((row, i, arr) => (
                  <View key={row.key} style={[styles.toggleRow, i < arr.length - 1 && { borderBottomWidth: 1, borderBottomColor: t.isDark ? t.border : t.cardAlt }]}>
                    <View style={[styles.optionIcon, { backgroundColor: notifs[row.key] ? t.lime : t.cardAlt }]}>
                      <row.icon size={18} color={t.textStrong} strokeWidth={2} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.optionLabel, { color: t.textStrong }]}>{row.label}</Text>
                      <Text style={[styles.optionDesc, { color: t.textMuted }]}>{row.desc}</Text>
                    </View>
                    <Switch value={notifs[row.key]} onValueChange={(v) => setNotifs((p) => ({ ...p, [row.key]: v }))} trackColor={{ false: t.border, true: t.lime }} thumbColor="#FFFFFF" ios_backgroundColor={t.border} />
                  </View>
                ))}
              </View>
              <NextRing progress={progress} onPress={() => (editing ? finish(false) : next())} />
            </View>
          )}
        </Animated.View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  counter: { fontSize: fs(13), fontWeight: '700', letterSpacing: 0.3 },
  skipPill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 14 },
  skip: { fontSize: fs(13), fontWeight: '700' },
  step: { gap: 14 },
  canvas: { position: 'relative', marginTop: 8, marginBottom: 6 },
  askRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 4, marginTop: 2 },
  member: { position: 'absolute', alignItems: 'center' },
  tag: { position: 'absolute', top: -10, left: s(36), paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  tagText: { fontSize: fs(10), fontWeight: '800' },
  floatIcon: { position: 'absolute', width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  welcomeTitle: { fontFamily: font.display, fontSize: fs(32), lineHeight: fs(38), textAlign: 'center' },
  pCenter: { fontSize: fs(14), lineHeight: fs(20), textAlign: 'center', paddingHorizontal: 8 },
  h1Center: { fontFamily: font.display, fontSize: fs(30), lineHeight: fs(36), letterSpacing: -0.3, textAlign: 'center' },
  avatarRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center', marginVertical: 4 },
  row: { flexDirection: 'row', gap: 10 },
  input: { borderRadius: 16, height: s(50), paddingHorizontal: 16, fontSize: fs(15), fontWeight: '600' },
  emailNote: { fontSize: fs(12), paddingHorizontal: 4, textAlign: 'center' },
  error: { fontSize: fs(13), fontWeight: '700', paddingHorizontal: 4, textAlign: 'center' },
  nextWrap: { alignSelf: 'center', marginTop: 14 },
  nextInner: { width: s(58), height: s(58), borderRadius: s(29), alignItems: 'center', justifyContent: 'center' },
  limeDot: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  arcOption: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  moodPill: { position: 'absolute', width: 120, paddingVertical: 8, borderRadius: 14, alignItems: 'center' },
  moodLabel: { fontFamily: font.display, fontSize: fs(16) },
  optionRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 18, padding: 14 },
  optionIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  optionLabel: { fontWeight: '800', fontSize: fs(15) },
  optionDesc: { fontSize: fs(12), marginTop: 2, lineHeight: fs(16) },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between' },
  tileWrap: { width: '31%' },
  tile: { borderRadius: 18, borderWidth: 1, paddingVertical: 14, paddingHorizontal: 6, alignItems: 'center', gap: 8, minHeight: s(84), justifyContent: 'center' },
  tileLabel: { fontSize: fs(12), fontWeight: '700' },
  tileCheck: { position: 'absolute', top: 6, right: 6, width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  toggles: { borderRadius: 20, borderWidth: 1, paddingHorizontal: 14 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
});
