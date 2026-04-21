/**
 * Profile Selection Screen
 *
 * Full redesign — matches business app visual quality:
 * FuturisticBackground, Reanimated entrance animations, LinearGradient cards,
 * spring press feedback, and haptic confirmation.
 */

import React, { useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { setProfileMode } from "@/lib/client-store";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Image } from "react-native";
import { FuturisticBackground } from "@/components/futuristic-background";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSpring,
  Easing,
  runOnJS,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import * as Haptics from "expo-haptics";

const { width } = Dimensions.get("window");

// ─── Animated Card ────────────────────────────────────────────────────────────
function PortalCard({
  icon,
  title,
  description,
  badge,
  badgeColor,
  iconBg,
  iconColor,
  gradientColors,
  borderColor,
  delay,
  onSelect,
  disabled,
}: {
  icon: string;
  title: string;
  description: string;
  badge: string;
  badgeColor: string;
  iconBg: string;
  iconColor: string;
  gradientColors: [string, string, string];
  borderColor: string;
  delay: number;
  onSelect: () => void;
  disabled: boolean;
}) {
  const colors = useColors();
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(40);

  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(1, { duration: 500, easing: Easing.out(Easing.cubic) }));
    translateY.value = withDelay(delay, withSpring(0, { damping: 18, stiffness: 120 }));
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }, { scale: scale.value }],
  }));

  const tap = Gesture.Tap()
    .onBegin(() => {
      scale.value = withSpring(0.96, { damping: 20, stiffness: 300 });
    })
    .onFinalize((e, success) => {
      scale.value = withSpring(1, { damping: 18, stiffness: 200 });
      if (success && !disabled) {
        if (Platform.OS !== "web") {
          runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Medium);
        }
        runOnJS(onSelect)();
      }
    });

  return (
    <GestureDetector gesture={tap}>
      <Animated.View style={[styles.cardWrapper, animStyle]}>
        <LinearGradient
          colors={gradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.card, { borderColor }]}
        >
          {/* Glow accent top-right */}
          <View style={[styles.cardGlow, { backgroundColor: badgeColor + "18" }]} />

          {/* Icon */}
          <View style={[styles.iconCircle, { backgroundColor: iconBg }]}>
            <IconSymbol name={icon as any} size={34} color={iconColor} />
          </View>

          {/* Badge */}
          <View style={[styles.badge, { backgroundColor: badgeColor }]}>
            <Text style={styles.badgeText}>{badge}</Text>
          </View>

          {/* Text */}
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>{title}</Text>
          <Text style={[styles.cardDesc, { color: colors.muted }]}>{description}</Text>

          {/* Arrow */}
          <View style={styles.arrowRow}>
            <Text style={[styles.arrowLabel, { color: badgeColor }]}>Get started</Text>
            <IconSymbol name="chevron.right" size={16} color={badgeColor} />
          </View>
        </LinearGradient>
      </Animated.View>
    </GestureDetector>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function ProfileSelectScreen() {
  const colors = useColors();
  const router = useRouter();

  // Header entrance
  const headerOpacity = useSharedValue(0);
  const headerY = useSharedValue(-30);
  const logoScale = useSharedValue(0.5);
  const logoOpacity = useSharedValue(0);

  useEffect(() => {
    logoOpacity.value = withTiming(1, { duration: 600, easing: Easing.out(Easing.cubic) });
    logoScale.value = withSpring(1, { damping: 14, stiffness: 120 });
    headerOpacity.value = withDelay(200, withTiming(1, { duration: 500 }));
    headerY.value = withDelay(200, withSpring(0, { damping: 18, stiffness: 100 }));
  }, []);

  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));

  const headerStyle = useAnimatedStyle(() => ({
    opacity: headerOpacity.value,
    transform: [{ translateY: headerY.value }],
  }));

  // Footer entrance
  const footerOpacity = useSharedValue(0);
  useEffect(() => {
    footerOpacity.value = withDelay(700, withTiming(1, { duration: 500 }));
  }, []);
  const footerStyle = useAnimatedStyle(() => ({ opacity: footerOpacity.value }));

  const handleSelect = async (mode: "business" | "client") => {
    await setProfileMode(mode);
    if (mode === "business") {
      router.replace("/onboarding");
    } else {
      router.replace("/(client-tabs)" as any);
    }
  };

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]}>
      <FuturisticBackground />

      <View style={styles.container}>
        {/* Logo */}
        <Animated.View style={[styles.logoWrap, logoStyle]}>
          <LinearGradient
            colors={[colors.primary + "30", colors.primary + "10"]}
            style={styles.logoCircle}
          >
            <Image
              source={require("../assets/images/icon.png")}
              style={{ width: 64, height: 64, borderRadius: 16 }}
              resizeMode="contain"
            />
          </LinearGradient>
          {/* Outer ring */}
          <View style={[styles.logoRing, { borderColor: colors.primary + "40" }]} />
        </Animated.View>

        {/* Header text */}
        <Animated.View style={[styles.headerBlock, headerStyle]}>
          <Text style={[styles.appName, { color: colors.primary }]}>Lime Of Time</Text>
          <Text style={[styles.title, { color: colors.foreground }]}>Welcome</Text>
          <Text style={[styles.subtitle, { color: colors.muted }]}>
            Choose how you'd like to use the app
          </Text>
        </Animated.View>

        {/* Cards */}
        <View style={styles.cards}>
          <PortalCard
            icon="briefcase.fill"
            title="Business Portal"
            description="Manage appointments, clients, staff, services, and grow your business."
            badge="For Businesses"
            badgeColor={colors.primary}
            iconBg={colors.primary + "20"}
            iconColor={colors.primary}
            gradientColors={[colors.surface, colors.surface, colors.background]}
            borderColor={colors.primary + "60"}
            delay={350}
            onSelect={() => handleSelect("business")}
            disabled={false}
          />

          <PortalCard
            icon="person.crop.circle.fill"
            title="Client Portal"
            description="Discover services, book appointments, and manage your schedule."
            badge="For Customers"
            badgeColor="#8B5CF6"
            iconBg="#8B5CF620"
            iconColor="#8B5CF6"
            gradientColors={[colors.surface, colors.surface, colors.background]}
            borderColor="#8B5CF640"
            delay={500}
            onSelect={() => handleSelect("client")}
            disabled={false}
          />
        </View>

        {/* Footer */}
        <Animated.Text style={[styles.footer, { color: colors.muted }, footerStyle]}>
          You can switch between portals at any time from Settings
        </Animated.Text>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  logoWrap: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 28,
  },
  logoCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  logoRing: {
    position: "absolute",
    width: 108,
    height: 108,
    borderRadius: 54,
    borderWidth: 1.5,
  },
  headerBlock: {
    alignItems: "center",
    marginBottom: 36,
  },
  appName: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  title: {
    fontSize: 34,
    fontWeight: "800",
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
  },
  cards: {
    width: "100%",
    gap: 16,
  },
  cardWrapper: {
    width: "100%",
    borderRadius: 22,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
  },
  card: {
    borderRadius: 22,
    borderWidth: 1.5,
    padding: 22,
    gap: 6,
    overflow: "hidden",
  },
  cardGlow: {
    position: "absolute",
    top: -40,
    right: -40,
    width: 140,
    height: 140,
    borderRadius: 70,
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  badge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    marginBottom: 4,
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  cardTitle: {
    fontSize: 21,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  cardDesc: {
    fontSize: 14,
    lineHeight: 20,
  },
  arrowRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 6,
  },
  arrowLabel: {
    fontSize: 13,
    fontWeight: "700",
  },
  footer: {
    fontSize: 13,
    textAlign: "center",
    marginTop: 28,
    lineHeight: 18,
  },
});
