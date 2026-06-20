export type ColorPalette = {
  primary: string;
  primaryDark: string;
  background: string;
  surface: string;
  text: string;
  textSecondary: string;
  border: string;
  success: string;
  error: string;
  warning: string;
  surfaceSuccess: string;
  surfaceError: string;
};

export const colors: ColorPalette = {
  primary: '#4F8EF7',
  primaryDark: '#2563EB',
  background: '#F8FAFC',
  surface: '#FFFFFF',
  text: '#1E293B',
  textSecondary: '#64748B',
  border: '#E2E8F0',
  success: '#22C55E',
  error: '#EF4444',
  warning: '#F59E0B',
  surfaceSuccess: '#F0FDF4',
  surfaceError: '#FEF2F2',
};

export const darkColors: ColorPalette = {
  primary: '#4F8EF7',
  primaryDark: '#2563EB',
  background: '#0F172A',
  surface: '#1E293B',
  text: '#F1F5F9',
  textSecondary: '#94A3B8',
  border: '#334155',
  success: '#22C55E',
  error: '#EF4444',
  warning: '#F59E0B',
  surfaceSuccess: '#052E16',
  surfaceError: '#450A0A',
};

export const gradientColors: [string, string] = ['#FFFFFF', '#EEF4FF'];
export const darkGradientColors: [string, string] = ['#0F172A', '#162032'];

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const fontSizes = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 22,
  xxl: 28,
} as const;

export const borderRadius = {
  sm: 6,
  md: 12,
  lg: 20,
  full: 9999,
} as const;
