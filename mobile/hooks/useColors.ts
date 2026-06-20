import { colors, darkColors, gradientColors, darkGradientColors } from '../constants/theme';
import type { ColorPalette } from '../constants/theme';
import { useThemeStore } from '../store/themeStore';

export function useColors(): ColorPalette {
  const isDark = useThemeStore((s) => s.isDark);
  return isDark ? darkColors : colors;
}

export function useGradientColors(): [string, string] {
  const isDark = useThemeStore((s) => s.isDark);
  return isDark ? darkGradientColors : gradientColors;
}
