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
  /** true when width > height (landscape) */
  isLandscape: boolean;
  /** true when width <= height (portrait) */
  isPortrait: boolean;
  /**
   * Horizontal padding for screen edges.
   * Phone: 16–20px, Tablet: 32px, Large tablet: 48px
   */
  hp: number;
  /** Vertical padding for headers/sections */
  vp: number;
  /** Font scale: 1 on phone, 1.05 on tablet, 1.1 on large tablet */
  fontScale: number;
  /** Number of columns for KPI/stat grid: 2 on phone, 4 on tablet */
  kpiCols: number;
  /** Number of columns for list/card grid: 1 on phone, 2 on tablet, 3 on large */
  listCols: number;
  /** Max width for centered content on tablets */
  maxContentWidth: number;
  /** Max width for form/detail screens (centered on tablet) */
  formMaxWidth: number;
  /** Gap between cards */
  cardGap: number;
  /** Whether to use side-by-side layout (tablet landscape) */
  useSideBySide: boolean;
  /** Icon size for tab bar and headers */
  iconSize: number;
  /** Tab bar height (excluding safe area) */
  tabBarBaseHeight: number;
}

export function useResponsive(): ResponsiveLayout {
  const { width, height } = useWindowDimensions();

  return useMemo(() => {
    const isTablet = width >= 768;
    const isLargeTablet = width >= 1024;
    const isLandscape = width > height;
    const isPortrait = !isLandscape;

    // On phones in landscape the width jumps but it's still a phone
    const isPhysicalTablet = isTablet && (
      // Heuristic: tablets have a minimum dimension >= 600
      Math.min(width, height) >= 600
    );

    const hp = isLargeTablet
      ? 48
      : isPhysicalTablet
      ? 32
      : isLandscape && !isPhysicalTablet
      ? Math.round(Math.max(20, width * 0.06)) // phone landscape — wider padding
      : Math.round(Math.max(16, width * 0.045));

    const maxContentWidth = isLargeTablet
      ? Math.min(width, 1280)
      : isPhysicalTablet
      ? Math.min(width, 960)
      : width;

    const formMaxWidth = isLargeTablet ? 720 : isPhysicalTablet ? 640 : 0;

    return {
      isPhone: !isPhysicalTablet,
      isTablet: isPhysicalTablet,
      isLargeTablet,
      isWeb: Platform.OS === "web",
      width,
      height,
      isLandscape,
      isPortrait,
      hp,
      vp: isPhysicalTablet ? 20 : 14,
      fontScale: isLargeTablet ? 1.1 : isPhysicalTablet ? 1.05 : 1,
      kpiCols: isLargeTablet ? 4 : isPhysicalTablet ? 4 : 2,
      listCols: isLargeTablet ? 3 : isPhysicalTablet ? 2 : 1,
      maxContentWidth,
      formMaxWidth,
      cardGap: isPhysicalTablet ? 16 : 12,
      useSideBySide: isPhysicalTablet && isLandscape,
      iconSize: isLargeTablet ? 28 : isPhysicalTablet ? 26 : 22,
      tabBarBaseHeight: isLargeTablet ? 76 : isPhysicalTablet ? 68 : 60,
    };
  }, [width, height]);
}
