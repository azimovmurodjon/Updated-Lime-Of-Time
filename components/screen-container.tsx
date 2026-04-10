import { View, useWindowDimensions, type ViewProps } from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";

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
   * Max width for content on tablets. Set to 0 to disable.
   * Default: 680 (good for forms and detail screens)
   */
  tabletMaxWidth?: number;
}

/**
 * A container component that properly handles SafeArea and background colors.
 * On tablets (width >= 768), content is centered with a max-width for readability.
 */
export function ScreenContainer({
  children,
  edges = ["top", "left", "right"],
  className,
  containerClassName,
  safeAreaClassName,
  tabletMaxWidth = 680,
  style,
  ...props
}: ScreenContainerProps) {
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const shouldConstrain = isTablet && tabletMaxWidth > 0;

  return (
    <View
      className={cn(
        "flex-1",
        "bg-background",
        containerClassName
      )}
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
              style={{ maxWidth: tabletMaxWidth }}
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
