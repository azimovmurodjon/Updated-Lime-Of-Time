import { Platform, StyleSheet, View, type ViewProps, type ViewStyle } from "react-native";
import { useSafeAreaInsets, type Edge } from "react-native-safe-area-context";
import { useResponsive } from "@/hooks/use-responsive";
import { cn } from "@/lib/utils";

export interface ScreenContainerProps extends ViewProps {
  /**
   * SafeArea edges to apply. Defaults to ["top", "left", "right"].
   * Bottom is typically handled by Tab Bar.
   */
  edges?: Edge[];
  /**
   * Tailwind className for the content area.
   */
  className?: string;
  /**
   * Additional className for the outer container (background layer).
   */
  containerClassName?: string;
  /**
   * Additional className for the SafeAreaView (content layer).
   */
  safeAreaClassName?: string;
  /**
   * Override max width for content on tablets.
   * Pass 0 to disable centering (full-width, e.g. for list screens).
   * Defaults to formMaxWidth from useResponsive (720 on large tablet, 640 on tablet, 0 on phone).
   */
  tabletMaxWidth?: number;
  /**
   * When true, content fills full width even on tablets (for list/grid screens).
   */
  fullWidth?: boolean;
}

/**
 * A container component that properly handles SafeArea and background colors.
 *
 * Uses useSafeAreaInsets() directly (instead of SafeAreaView) so that the
 * correct status-bar / notch padding is applied on BOTH iOS and Android,
 * including inside fullScreenModal and card presentations where SafeAreaView
 * context inheritance can be unreliable on Android.
 *
 * Padding merging strategy:
 * - Caller's `style` is flattened first to extract any explicit padding values.
 * - Inset-based padding is only applied for edges where the caller has NOT
 *   provided explicit padding. This avoids the React Native quirk where
 *   explicit longhand padding (paddingLeft: 0) overrides shorthand
 *   (paddingHorizontal: 18) regardless of array order.
 *
 * Usage:
 * ```tsx
 * <ScreenContainer style={{ paddingHorizontal: 16 }}>
 *   <Text>Content</Text>
 * </ScreenContainer>
 * ```
 */
export function ScreenContainer({
  children,
  edges = ["top", "left", "right"],
  className,
  containerClassName,
  safeAreaClassName,
  tabletMaxWidth,
  fullWidth = false,
  style,
  ...props
}: ScreenContainerProps) {
  const { isTablet, formMaxWidth } = useResponsive();
  const insets = useSafeAreaInsets();

  // Flatten caller's style to a plain object so we can inspect individual padding keys.
  const flatStyle = StyleSheet.flatten(style) as ViewStyle | undefined;

  // Check if caller provided any horizontal padding (shorthand or longhand).
  const callerHasPaddingLeft =
    flatStyle?.paddingLeft != null ||
    flatStyle?.paddingHorizontal != null ||
    flatStyle?.padding != null;
  const callerHasPaddingRight =
    flatStyle?.paddingRight != null ||
    flatStyle?.paddingHorizontal != null ||
    flatStyle?.padding != null;
  const callerHasPaddingTop =
    flatStyle?.paddingTop != null ||
    flatStyle?.paddingVertical != null ||
    flatStyle?.padding != null;
  const callerHasPaddingBottom =
    flatStyle?.paddingBottom != null ||
    flatStyle?.paddingVertical != null ||
    flatStyle?.padding != null;

  // Build inset padding only for edges where the caller hasn't provided their own.
  const edgeSet = new Set(edges);
  const paddingTop = callerHasPaddingTop
    ? undefined
    : edgeSet.has("top")
    ? Math.max(insets.top, Platform.OS === "android" ? 24 : 0)
    : 0;
  const paddingBottom = callerHasPaddingBottom
    ? undefined
    : edgeSet.has("bottom")
    ? insets.bottom
    : 0;
  const paddingLeft = callerHasPaddingLeft
    ? undefined
    : edgeSet.has("left")
    ? insets.left
    : 0;
  const paddingRight = callerHasPaddingRight
    ? undefined
    : edgeSet.has("right")
    ? insets.right
    : 0;

  // Determine effective max width:
  // - fullWidth=true → no constraint
  // - tabletMaxWidth provided → use it (0 = no constraint)
  // - default → use formMaxWidth from hook (0 on phone = no constraint)
  const effectiveMax = fullWidth
    ? 0
    : tabletMaxWidth !== undefined
    ? tabletMaxWidth
    : formMaxWidth;

  const shouldConstrain = isTablet && effectiveMax > 0;

  // Merge: inset padding first (as base), then caller's style on top.
  // Since we skip inset padding when caller provides their own, there's no conflict.
  const innerStyle = [
    {
      ...(paddingTop !== undefined && { paddingTop }),
      ...(paddingBottom !== undefined && { paddingBottom }),
      ...(paddingLeft !== undefined && { paddingLeft }),
      ...(paddingRight !== undefined && { paddingRight }),
    },
    style,
  ];

  return (
    <View
      className={cn("flex-1", "bg-background", containerClassName)}
      {...props}
    >
      {shouldConstrain ? (
        <View className={cn("flex-1", safeAreaClassName)} style={innerStyle}>
          <View className="flex-1 items-center">
            <View
              className={cn("flex-1 w-full", className)}
              style={{ maxWidth: effectiveMax }}
            >
              {children}
            </View>
          </View>
        </View>
      ) : (
        <View className={cn("flex-1", safeAreaClassName)} style={innerStyle}>
          <View className={cn("flex-1", className)}>{children}</View>
        </View>
      )}
    </View>
  );
}
