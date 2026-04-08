import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Appearance, AppState, View, useColorScheme as useSystemColorScheme } from "react-native";
import { colorScheme as nativewindColorScheme, vars } from "nativewind";

import { SchemeColors, type ColorScheme } from "@/constants/theme";

type ThemeMode = "light" | "dark" | "system";

type ThemeContextValue = {
  colorScheme: ColorScheme;
  themeMode: ThemeMode;
  setColorScheme: (scheme: ColorScheme) => void;
  setThemeMode: (mode: ThemeMode) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useSystemColorScheme() ?? "light";
  const [themeMode, setThemeModeState] = useState<ThemeMode>("system");
  const themeModeRef = useRef<ThemeMode>("system");

  // Resolve the actual color scheme based on themeMode
  const resolvedScheme: ColorScheme = themeMode === "system" ? systemScheme : themeMode;
  const [colorScheme, setColorSchemeState] = useState<ColorScheme>(resolvedScheme);

  const applyScheme = useCallback((scheme: ColorScheme) => {
    nativewindColorScheme.set(scheme);
    // Don't call Appearance.setColorScheme when in system mode — let the OS drive it
    if (typeof document !== "undefined") {
      const root = document.documentElement;
      root.dataset.theme = scheme;
      root.classList.toggle("dark", scheme === "dark");
      const palette = SchemeColors[scheme];
      Object.entries(palette).forEach(([token, value]) => {
        root.style.setProperty(`--color-${token}`, value);
      });
    }
  }, []);

  // When system scheme changes and we're in "system" mode, follow it
  useEffect(() => {
    if (themeModeRef.current === "system") {
      setColorSchemeState(systemScheme);
      applyScheme(systemScheme);
    }
  }, [systemScheme, applyScheme]);

  // Also listen for Appearance changes (covers cases where useColorScheme hook doesn't fire)
  useEffect(() => {
    const subscription = Appearance.addChangeListener(({ colorScheme: newScheme }) => {
      if (themeModeRef.current === "system" && newScheme) {
        const scheme = newScheme as ColorScheme;
        setColorSchemeState(scheme);
        applyScheme(scheme);
      }
    });
    return () => subscription.remove();
  }, [applyScheme]);

  // Re-check system theme when app comes to foreground
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active" && themeModeRef.current === "system") {
        const current = Appearance.getColorScheme() ?? "light";
        setColorSchemeState(current as ColorScheme);
        applyScheme(current as ColorScheme);
      }
    });
    return () => subscription.remove();
  }, [applyScheme]);

  const setColorScheme = useCallback((scheme: ColorScheme) => {
    setColorSchemeState(scheme);
    applyScheme(scheme);
  }, [applyScheme]);

  const setThemeMode = useCallback((mode: ThemeMode) => {
    setThemeModeState(mode);
    themeModeRef.current = mode;
    if (mode === "system") {
      const current = Appearance.getColorScheme() ?? "light";
      setColorSchemeState(current as ColorScheme);
      applyScheme(current as ColorScheme);
      // Reset Appearance override so system can drive it
      Appearance.setColorScheme?.(null as any);
    } else {
      setColorSchemeState(mode);
      applyScheme(mode);
      Appearance.setColorScheme?.(mode);
    }
  }, [applyScheme]);

  useEffect(() => {
    applyScheme(colorScheme);
  }, [applyScheme, colorScheme]);

  const themeVariables = useMemo(
    () =>
      vars({
        "color-primary": SchemeColors[colorScheme].primary,
        "color-background": SchemeColors[colorScheme].background,
        "color-surface": SchemeColors[colorScheme].surface,
        "color-foreground": SchemeColors[colorScheme].foreground,
        "color-muted": SchemeColors[colorScheme].muted,
        "color-border": SchemeColors[colorScheme].border,
        "color-success": SchemeColors[colorScheme].success,
        "color-warning": SchemeColors[colorScheme].warning,
        "color-error": SchemeColors[colorScheme].error,
      }),
    [colorScheme],
  );

  const value = useMemo(
    () => ({
      colorScheme,
      themeMode,
      setColorScheme,
      setThemeMode,
    }),
    [colorScheme, themeMode, setColorScheme, setThemeMode],
  );
  return (
    <ThemeContext.Provider value={value}>
      <View style={[{ flex: 1 }, themeVariables]}>{children}</View>
    </ThemeContext.Provider>
  );
}

export function useThemeContext(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useThemeContext must be used within ThemeProvider");
  }
  return ctx;
}
