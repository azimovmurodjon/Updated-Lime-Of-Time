import { useWindowDimensions } from "react-native";
import { useMemo } from "react";

export interface ResponsiveLayout {
  /** true if width >= 768 (iPad / tablet) */
  isTablet: boolean;
  /** true if width >= 1024 (large tablet / landscape iPad Pro) */
  isLargeTablet: boolean;
  /** Screen width */
  width: number;
  /** Screen height */
  height: number;
  /** Horizontal padding: 16 on phone, 32 on tablet, 48 on large tablet */
  hp: number;
  /** Font scale: 1 on phone, 1.1 on tablet, 1.2 on large tablet */
  fontScale: number;
  /** Number of columns for grid layouts: 1 on phone, 2 on tablet, 3 on large */
  gridCols: number;
  /** Card max width for centered content on tablets */
  cardMaxWidth: number;
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

    return {
      isTablet,
      isLargeTablet,
      width,
      height,
      hp: isLargeTablet ? 48 : isTablet ? 32 : Math.max(16, Math.round(width * 0.045)),
      fontScale: isLargeTablet ? 1.2 : isTablet ? 1.1 : 1,
      gridCols: isLargeTablet ? 3 : isTablet ? 2 : 1,
      cardMaxWidth: isTablet ? 600 : width,
      useSideBySide: isTablet && width > height,
      iconScale: isTablet ? 1.2 : 1,
      spacingScale: isTablet ? 1.3 : 1,
    };
  }, [width, height]);
}
