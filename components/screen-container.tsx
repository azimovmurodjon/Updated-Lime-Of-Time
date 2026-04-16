import { Platform, View, type ViewProps } from "react-native";
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
 * - On phones: full-width content with safe area insets
 * - On tablets: content is centered with a max-width for readability
 *
 * Usage:
 * ```tsx
 * <ScreenContainer className="p-4">
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

  // Build explicit padding from requested edges.
  // On Android we add a small extra buffer for the status bar when "top" is included.
  const edgeSet = new Set(edges);
  const paddingTop = edgeSet.has("top")
    ? Math.max(insets.top, Platform.OS === "android" ? 24 : 0)
    : 0;
  const paddingBottom = edgeSet.has("bottom") ? insets.bottom : 0;
  const paddingLeft = edgeSet.has("left") ? insets.left : 0;
  const paddingRight = edgeSet.has("right") ? insets.right : 0;

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

  const innerStyle = [
    { paddingTop, paddingBottom, paddingLeft, paddingRight },
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
