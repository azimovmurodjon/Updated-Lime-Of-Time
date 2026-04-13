import { View, type ViewProps } from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";
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
 * - On phones: full-width content with safe area insets
 * - On tablets: content is centered with a max-width for readability
 * - On tablets in landscape: wider max-width is applied automatically
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

  return (
    <View
      className={cn("flex-1", "bg-background", containerClassName)}
      {...props}
    >
      <SafeAreaView
        edges={edges}
        className={cn("flex-1", safeAreaClassName)}
        style={style}
      >
        {shouldConstrain ? (
          <View className="flex-1 items-center">
            <View
              className={cn("flex-1 w-full", className)}
              style={{ maxWidth: effectiveMax }}
            >
              {children}
            </View>
          </View>
        ) : (
          <View className={cn("flex-1", className)}>{children}</View>
        )}
      </SafeAreaView>
    </View>
  );
}
