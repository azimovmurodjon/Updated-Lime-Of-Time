import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { HapticTab } from "@/components/haptic-tab";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Platform } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { useResponsive } from "@/hooks/use-responsive";

export default function TabLayout() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { isTablet, isLargeTablet, iconSize, tabBarBaseHeight } = useResponsive();

  const bottomPadding = Platform.OS === "web"
    ? (isTablet ? 16 : 12)
    : Math.max(insets.bottom, 8);

  const tabBarHeight = tabBarBaseHeight + bottomPadding;
  const labelSize = isLargeTablet ? 13 : isTablet ? 12 : 11;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: {
          paddingTop: isTablet ? 10 : 8,
          paddingBottom: bottomPadding,
          height: tabBarHeight,
          backgroundColor: colors.background,
          borderTopColor: colors.border,
          borderTopWidth: 0.5,
        },
        tabBarLabelStyle: {
          fontSize: labelSize,
          fontWeight: "600",
        },
        tabBarItemStyle: isTablet ? { paddingVertical: 4 } : undefined,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={iconSize} name="house.fill" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: "Calendar",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={iconSize} name="calendar" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="clients"
        options={{
          title: "Clients",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={iconSize} name="person.2.fill" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="services"
        options={{
          title: "Services",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={iconSize} name="list.bullet" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={iconSize} name="gearshape.fill" color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
