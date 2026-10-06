import { Dimensions, PixelRatio, useWindowDimensions } from 'react-native';

/**
 * Responsive sizing.
 *
 * The mockups were drawn at 390pt (iPhone 14/15). Phones range from ~360pt
 * (compact Androids) to ~430pt (Plus / Ultra models), so we scale type and
 * key dimensions with the shortest screen edge instead of hard-coding points.
 */
const DESIGN_WIDTH = 390;

/** Never let the OS accessibility font setting blow layouts past this. */
const MAX_FONT_SCALE = 1.15;

const shortest = () => {
  const { width, height } = Dimensions.get('window');
  return Math.min(width, height);
};

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

/** Raw ratio of this device to the design width, clamped so tablets don't explode. */
export const scaleFactor = () => clamp(shortest() / DESIGN_WIDTH, 0.88, 1.18);

/** Linear scale for widths, heights, radii. */
export const s = (size: number) => Math.round(size * scaleFactor());

/** Moderate scale: only applies `factor` of the difference (good for padding). */
export const ms = (size: number, factor = 0.5) => Math.round(size + (s(size) - size) * factor);

/**
 * Font scale. React Native multiplies every fontSize by the OS font scale
 * (Samsung "Large" is 1.3+). We fold a cap into the value so the effective
 * multiplier never exceeds MAX_FONT_SCALE, and scale gently with screen width.
 */
export const fs = (size: number) => {
  const os = PixelRatio.getFontScale() || 1;
  const cap = Math.min(os, MAX_FONT_SCALE) / os;
  return Math.round(size * cap * (1 + (scaleFactor() - 1) * 0.6));
};

/** Line height that keeps the same ratio as the design after scaling. */
export const lh = (fontSize: number, ratio = 1.25) => Math.round(fs(fontSize) * ratio);

export const isSmallPhone = () => shortest() < 370;
export const isLargePhone = () => shortest() >= 410;

/** Hook variant for components that should respond to rotation / foldables. */
export function useScale() {
  const { width, height } = useWindowDimensions();
  const factor = clamp(Math.min(width, height) / DESIGN_WIDTH, 0.88, 1.18);
  const os = PixelRatio.getFontScale() || 1;
  const cap = Math.min(os, MAX_FONT_SCALE) / os;
  return {
    width,
    height,
    factor,
    s: (size: number) => Math.round(size * factor),
    fs: (size: number) => Math.round(size * cap * (1 + (factor - 1) * 0.6)),
    fontScale: os,
  };
}
