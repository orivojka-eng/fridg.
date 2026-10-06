import React from 'react';
import { View } from 'react-native';
import {
  Apple, Banana, Bean, Beef, Candy, Carrot, Cherry, Citrus, Coffee, Croissant, Droplet, Drumstick, Egg, Fish, Flame,
  Grape, Ham, Leaf, Milk, Nut, Package, Sprout, Vegan, Wheat, Wine, LucideIcon,
} from './lucide';
import { useTheme, s } from '../../theme';
import { FridgeCategory } from '../../types';
import { normalize } from '../../lib/matching';

/**
 * Line icons for ingredients (matches the outline food icon sheet in the
 * design folder). Name keywords win, then the fridge category, then a box.
 */
const KEYWORDS: Array<[RegExp, LucideIcon]> = [
  [/chicken|turkey|drumstick|poultry/, Drumstick],
  [/ham|bacon|prosciutto/, Ham],
  [/beef|steak|mince|pork|lamb|sausage/, Beef],
  [/salmon|fish|tuna|cod|prawn|shrimp|seafood/, Fish],
  [/egg/, Egg],
  [/yoghurt|yogurt|milk|cream|cheese|feta|halloumi|parmesan|mozzarella|butter/, Milk],
  [/spinach|kale|lettuce|rocket|herb|coriander|parsley|basil|mint|cabbage|leaf/, Leaf],
  [/avocado|broccoli|courgette|zucchini|cucumber|edamame|pea\b|peas/, Vegan],
  [/tomato|cherr|berry|strawberr/, Cherry],
  [/onion|garlic|leek|shallot|chive|sprout/, Sprout],
  [/lemon|lime|orange|citrus/, Citrus],
  [/apple|pear/, Apple],
  [/banana/, Banana],
  [/grape/, Grape],
  [/chickpea|bean|lentil/, Bean],
  [/sourdough|bread|loaf|bun|croissant|toast|wrap|tortilla/, Croissant],
  [/rice|pasta|orzo|noodle|grain|oat|flour|quinoa|couscous/, Wheat],
  [/pepper|carrot|aubergine|eggplant|squash|potato|beetroot|radish|veg/, Carrot],
  [/chilli|chili|paprika|harissa|gochujang|spice|cumin|curry|hot/, Flame],
  [/oil|vinegar|sauce|mirin|soy|miso|tahini|paste|stock|dressing|honey|syrup/, Droplet],
  [/nut|almond|sesame|seed|peanut|cashew/, Nut],
  [/coffee|tea/, Coffee],
  [/wine|beer/, Wine],
  [/sugar|chocolate|sweet/, Candy],
];

const CATEGORY_FALLBACK: Record<FridgeCategory, LucideIcon> = {
  Protein: Drumstick,
  Veg: Carrot,
  Dairy: Milk,
  Pantry: Package,
  Produce: Leaf,
};

export const iconFor = (name: string, category?: FridgeCategory): LucideIcon => {
  const n = normalize(name);
  const hit = KEYWORDS.find(([re]) => re.test(n));
  if (hit) return hit[1];
  return category ? CATEGORY_FALLBACK[category] : Package;
};

interface FoodIconProps {
  name: string;
  category?: FridgeCategory;
  size?: number;
  color?: string;
  strokeWidth?: number;
}

export const FoodIcon: React.FC<FoodIconProps> = ({ name, category, size = 18, color, strokeWidth = 1.9 }) => {
  const t = useTheme();
  const Icon = iconFor(name, category);
  return <Icon size={size} color={color ?? t.textStrong} strokeWidth={strokeWidth} />;
};

/** Rounded tinted tile with the food icon — replaces the old letter tiles. */
export const FoodTile: React.FC<{ name: string; category?: FridgeCategory; size?: number; tone?: 'auto' | 'flat' }> = ({ name, category, size = 42, tone = 'auto' }) => {
  const t = useTheme();
  const px = s(size);
  const tint =
    tone === 'flat'
      ? t.cardAlt
      : category === 'Protein'
        ? t.blush
        : category === 'Dairy'
          ? t.cream
          : category === 'Pantry'
            ? t.cardAlt
            : t.sage;
  return (
    <View style={{ width: px, height: px, borderRadius: Math.round(px / 3), backgroundColor: tint, alignItems: 'center', justifyContent: 'center' }}>
      <FoodIcon name={name} category={category} size={Math.round(px * 0.5)} />
    </View>
  );
};
