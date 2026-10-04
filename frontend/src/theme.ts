// Design tokens for HIBI NOMI — fresh aqua/blue light theme.
//
// Colors match the "color" block of /app/design_guidelines.json. Build sheets
// with makeStyles((colors) => ...) and read useTheme().colors for color props.
// spacing / radius / fonts are static tokens shared across the app.

import { createContext, useContext, useMemo } from "react";
import { StyleSheet } from "react-native";

export type ColorScheme = "light" | "dark";
export type ThemePreference = "system" | ColorScheme;

const light = {
  surface: "#F2FBFC",
  onSurface: "#0F172A",
  surfaceSecondary: "#FFFFFF",
  onSurfaceSecondary: "#0F172A",
  surfaceTertiary: "#E2F6F8",
  onSurfaceTertiary: "#0F172A",
  surfaceInverse: "#082F49",
  onSurfaceInverse: "#FFFFFF",
  muted: "#64748B",

  brand: "#06B6D4",
  onBrand: "#FFFFFF",
  brandPrimary: "#06B6D4",
  onBrandPrimary: "#FFFFFF",
  brandSecondary: "#38BDF8",
  onBrandSecondary: "#FFFFFF",
  brandTertiary: "#CFFAFE",
  onBrandTertiary: "#0891B2",

  success: "#10B981",
  onSuccess: "#FFFFFF",
  warning: "#F59E0B",
  onWarning: "#FFFFFF",
  error: "#EF4444",
  onError: "#FFFFFF",
  info: "#0EA5E9",
  onInfo: "#FFFFFF",

  border: "#E2E8F0",
  borderStrong: "#CBD5E1",
  divider: "#F1F5F9",
};

const dark: typeof light = {
  surface: "#0B1220",
  onSurface: "#E6F1F5",
  surfaceSecondary: "#121D31",
  onSurfaceSecondary: "#E6F1F5",
  surfaceTertiary: "#1B2A44",
  onSurfaceTertiary: "#E6F1F5",
  surfaceInverse: "#F2FBFC",
  onSurfaceInverse: "#0F172A",
  muted: "#94A3B8",

  brand: "#06B6D4",
  onBrand: "#FFFFFF",
  brandPrimary: "#22D3EE",
  onBrandPrimary: "#062A33",
  brandSecondary: "#38BDF8",
  onBrandSecondary: "#062A33",
  brandTertiary: "#164E63",
  onBrandTertiary: "#A5F3FC",

  success: "#34D399",
  onSuccess: "#062A33",
  warning: "#FBBF24",
  onWarning: "#062A33",
  error: "#F87171",
  onError: "#FFFFFF",
  info: "#38BDF8",
  onInfo: "#062A33",

  border: "#243352",
  borderStrong: "#334A6B",
  divider: "#1C2A44",
};

export type ThemeColors = typeof light;

export const defaultScheme = "light" satisfies ColorScheme;
export const themes: { light: ThemeColors; dark: ThemeColors } = { light, dark };

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  "2xl": 32,
  "3xl": 48,
} as const;

export const radius = {
  sm: 6,
  md: 12,
  lg: 20,
  pill: 999,
} as const;

export const fonts = {
  regular: "Nunito-Regular",
  medium: "Nunito-SemiBold",
  semibold: "Nunito-SemiBold",
  bold: "Nunito-Bold",
  extrabold: "Nunito-ExtraBold",
} as const;

export const fontSize = {
  sm: 12,
  base: 14,
  lg: 16,
  xl: 20,
  "2xl": 24,
  "3xl": 30,
  "4xl": 40,
} as const;

export type ThemeContextValue = {
  scheme: ColorScheme;
  colors: ThemeColors;
  preference: ThemePreference;
  setPreference: (p: ThemePreference) => Promise<void>;
};

// Provided by src/context/theme.tsx. Falls back to light outside the provider
// (e.g. the root error boundary).
export const ThemeContext = createContext<ThemeContextValue | null>(null);

const fallback: ThemeContextValue = {
  scheme: defaultScheme,
  colors: themes[defaultScheme],
  preference: "system",
  setPreference: async () => {},
};

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext) ?? fallback;
}

export function makeStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  factory: (colors: ThemeColors) => T & StyleSheet.NamedStyles<any>,
): () => T {
  return function useStyles(): T {
    const { colors } = useTheme();
    return useMemo(() => StyleSheet.create(factory(colors)), [colors]);
  };
}
