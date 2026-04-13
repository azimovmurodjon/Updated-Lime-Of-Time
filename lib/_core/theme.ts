import { Platform } from "react-native";

import themeConfig from "@/theme.config";

export type ColorScheme = "light" | "dark";

export const ThemeColors = themeConfig.themeColors;

type ThemeColorTokens = typeof ThemeColors;
type ThemeColorName = keyof ThemeColorTokens;
type SchemePalette = Record<ColorScheme, Record<ThemeColorName, string>>;
type SchemePaletteItem = SchemePalette[ColorScheme];

function buildSchemePalette(colors: ThemeColorTokens): SchemePalette {
  const palette: SchemePalette = {
    light: {} as SchemePalette["light"],
    dark: {} as SchemePalette["dark"],
  };

  (Object.keys(colors) as ThemeColorName[]).forEach((name) => {
    const swatch = colors[name];
    palette.light[name] = swatch.light;
    palette.dark[name] = swatch.dark;
  });

  return palette;
}

export const SchemeColors = buildSchemePalette(ThemeColors);

type RuntimePalette = SchemePaletteItem & {
  text: string;
  background: string;
  tint: string;
  icon: string;
  tabIconDefault: string;
  tabIconSelected: string;
  border: string;
};

function buildRuntimePalette(scheme: ColorScheme): RuntimePalette {
  const base = SchemeColors[scheme];
  const tintColor = (base as any).tint ?? base.primary;
  return {
    ...base,
    text: base.foreground,
    background: base.background,
    tint: tintColor,
    icon: base.muted,
    tabIconDefault: base.muted,
    tabIconSelected: tintColor,
    border: base.border,
  };
}

export const Colors = {
  light: buildRuntimePalette("light"),
  dark: buildRuntimePalette("dark"),
} satisfies Record<ColorScheme, RuntimePalette>;

export type ThemeColorPalette = (typeof Colors)[ColorScheme];

export const Fonts = Platform.select({
  ios: {
    sans: "Inter_400Regular",
    sansLight: "Inter_300Light",
    sansMedium: "Inter_500Medium",
    sansSemiBold: "Inter_600SemiBold",
    sansBold: "Inter_700Bold",
    serif: "ui-serif",
    rounded: "ui-rounded",
    mono: "ui-monospace",
  },
  android: {
    sans: "Inter_400Regular",
    sansLight: "Inter_300Light",
    sansMedium: "Inter_500Medium",
    sansSemiBold: "Inter_600SemiBold",
    sansBold: "Inter_700Bold",
    serif: "serif",
    rounded: "Inter_400Regular",
    mono: "monospace",
  },
  default: {
    sans: "Inter_400Regular",
    sansLight: "Inter_300Light",
    sansMedium: "Inter_500Medium",
    sansSemiBold: "Inter_600SemiBold",
    sansBold: "Inter_700Bold",
    serif: "serif",
    rounded: "Inter_400Regular",
    mono: "monospace",
  },
  web: {
    sans: "'Inter', system-ui, -apple-system, sans-serif",
    sansLight: "'Inter', system-ui, sans-serif",
    sansMedium: "'Inter', system-ui, sans-serif",
    sansSemiBold: "'Inter', system-ui, sans-serif",
    sansBold: "'Inter', system-ui, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'Inter', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Courier New', monospace",
  },
});
