import { useWindowDimensions, Platform } from "react-native";
import { useMemo } from "react";

export interface ResponsiveLayout {
  /** true if width < 768 */
  isPhone: boolean;
  /** true if width >= 768 (iPad / tablet) */
  isTablet: boolean;
  /** true if width >= 1024 (large tablet / landscape iPad Pro) */
  isLargeTablet: boolean;
  /** true when running on web platform */
  isWeb: boolean;
  /** Screen width */
  width: number;
  /** Screen height */
  height: number;
  /** Horizontal padding: 16 on phone, 32 on tablet, 48 on large tablet */
  hp: number;
  /** Vertical padding for headers/sections */
  vp: number;
  /** Font scale: 1 on phone, 1.05 on tablet, 1.15 on large tablet */
  fontScale: number;
  /** Number of columns for KPI/stat grid: 2 on phone, 2 on tablet, 4 on large */
  kpiCols: number;
  /** Number of columns for list grid: 1 on phone, 2 on tablet, 3 on large */
  listCols: number;
  /** Number of columns for grid layouts: 1 on phone, 2 on tablet, 3 on large */
  gridCols: number;
  /** Card max width for centered content on tablets */
  cardMaxWidth: number;
  /** Max width for form/detail screens (centered on tablet/web) */
  formMaxWidth: number;
  /** Gap between cards */
  cardGap: number;
  /** Whether to use side-by-side layout (tablet landscape) */
  useSideBySide: boolean;
  /** Icon size multiplier */
  iconScale: number;
  /** Spacing multiplier */
  spacingScale: number;
}

export function useResponsive(): ResponsiveLayout {
  const { width, height } = useWindowDimensions();

  return useMemo(() => {
    const isTablet = width >= 768;
    const isLargeTablet = width >= 1024;

    const hp = isLargeTablet ? 48 : isTablet ? 32 : Math.max(16, Math.round(width * 0.045));
    return {
      isPhone: !isTablet,
      isTablet,
      isLargeTablet,
      isWeb: Platform.OS === "web",
      width,
      height,
      hp,
      vp: isTablet || isLargeTablet ? 20 : 14,
      fontScale: isLargeTablet ? 1.15 : isTablet ? 1.05 : 1,
      kpiCols: isLargeTablet ? 4 : 2,
      listCols: isLargeTablet ? 3 : isTablet ? 2 : 1,
      gridCols: isLargeTablet ? 3 : isTablet ? 2 : 1,
      cardMaxWidth: isTablet ? 600 : width,
      formMaxWidth: isLargeTablet ? 720 : isTablet ? 640 : 0,
      cardGap: isTablet || isLargeTablet ? 16 : 12,
      useSideBySide: isTablet && width > height,
      iconScale: isTablet ? 1.2 : 1,
      spacingScale: isTablet ? 1.3 : 1,
    };
  }, [width, height]);
}
