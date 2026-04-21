/**
 * Client Portal — Sign In Screen
 *
 * Full redesign — matches business app visual quality:
 * FuturisticBackground, Reanimated entrance animations, LinearGradient,
 * spring press feedback, and haptic confirmation.
 */

import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { setProfileMode } from "@/lib/client-store";
import { startOAuthLogin } from "@/constants/oauth";
import { IconSymbol } from "@/components/ui/icon-symbol";
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

const CLIENT_PURPLE = "#8B5CF6";

// ─── Animated OAuth Button ────────────────────────────────────────────────────
function OAuthButton({
  label,
  icon,
  iconColor,
  bgColor,
  textColor,
  borderColor,
  loading,
  disabled,
  delay,
  onPress,
}: {
  label: string;
  icon: React.ReactNode;
  iconColor?: string;
  bgColor: string;
  textColor: string;
  borderColor?: string;
  loading: boolean;
  disabled: boolean;
  delay: number;
  onPress: () => void;
}) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(20);

  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(1, { duration: 400, easing: Easing.out(Easing.cubic) }));
    translateY.value = withDelay(delay, withSpring(0, { damping: 18, stiffness: 120 }));
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }, { scale: scale.value }],
  }));

  const tap = Gesture.Tap()
    .onBegin(() => { scale.value = withSpring(0.96, { damping: 20, stiffness: 300 }); })
    .onFinalize((_, success) => {
      scale.value = withSpring(1, { damping: 18, stiffness: 200 });
      if (success && !disabled) {
        if (Platform.OS !== "web") runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Light);
        runOnJS(onPress)();
      }
    });

  return (
    <GestureDetector gesture={tap}>
      <Animated.View style={[styles.oauthWrap, animStyle]}>
        <View style={[
          styles.oauthBtn,
          { backgroundColor: bgColor },
          borderColor ? { borderWidth: 1, borderColor } : {},
        ]}>
          {loading ? (
            <ActivityIndicator color={textColor} size="small" />
          ) : icon}
          <Text style={[styles.oauthBtnText, { color: textColor }]}>{label}</Text>
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function ClientSignInScreen() {
  const colors = useColors();
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  const handleOAuth = async (provider: "apple" | "google" | "microsoft") => {
    setLoading(provider);
    await setProfileMode("client");
    await startOAuthLogin(provider);
    setLoading(null);
  };

  // Header entrance
  const headerOpacity = useSharedValue(0);
  const headerY = useSharedValue(-24);
  const logoScale = useSharedValue(0.5);
  const logoOpacity = useSharedValue(0);

  useEffect(() => {
    logoOpacity.value = withTiming(1, { duration: 600, easing: Easing.out(Easing.cubic) });
    logoScale.value = withSpring(1, { damping: 14, stiffness: 120 });
    headerOpacity.value = withDelay(150, withTiming(1, { duration: 450 }));
    headerY.value = withDelay(150, withSpring(0, { damping: 18, stiffness: 100 }));
  }, []);

  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));
  const headerStyle = useAnimatedStyle(() => ({
    opacity: headerOpacity.value,
    transform: [{ translateY: headerY.value }],
  }));

  // Back button
  const backScale = useSharedValue(1);
  const backTap = Gesture.Tap()
    .onBegin(() => { backScale.value = withSpring(0.93, { damping: 20, stiffness: 300 }); })
    .onFinalize((_, success) => {
      backScale.value = withSpring(1, { damping: 18, stiffness: 200 });
      if (success) runOnJS(router.back)();
    });
  const backStyle = useAnimatedStyle(() => ({ transform: [{ scale: backScale.value }] }));

  // Skip button
  const skipOpacity = useSharedValue(0);
  useEffect(() => {
    skipOpacity.value = withDelay(700, withTiming(1, { duration: 400 }));
  }, []);
  const skipStyle = useAnimatedStyle(() => ({ opacity: skipOpacity.value }));

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]}>
      <FuturisticBackground />

      <View style={styles.container}>
        {/* Back button */}
        <GestureDetector gesture={backTap}>
          <Animated.View style={[styles.backBtn, backStyle]}>
            <IconSymbol name="chevron.left" size={20} color={colors.foreground} />
            <Text style={[styles.backText, { color: colors.foreground }]}>Back</Text>
          </Animated.View>
        </GestureDetector>

        {/* Logo */}
        <Animated.View style={[styles.logoWrap, logoStyle]}>
          <LinearGradient
            colors={[CLIENT_PURPLE + "30", CLIENT_PURPLE + "10"]}
            style={styles.logoCircle}
          >
            <IconSymbol name="person.crop.circle.fill" size={44} color={CLIENT_PURPLE} />
          </LinearGradient>
          <View style={[styles.logoRing, { borderColor: CLIENT_PURPLE + "40" }]} />
        </Animated.View>

        {/* Header text */}
        <Animated.View style={[styles.headerBlock, headerStyle]}>
          <Text style={[styles.appLabel, { color: CLIENT_PURPLE }]}>Client Portal</Text>
          <Text style={[styles.title, { color: colors.foreground }]}>Welcome Back</Text>
          <Text style={[styles.subtitle, { color: colors.muted }]}>
            Sign in to book appointments, manage your schedule, and discover new services.
          </Text>
        </Animated.View>

        {/* OAuth Buttons */}
        <View style={styles.buttons}>
          {Platform.OS !== "android" && (
            <OAuthButton
              label="Continue with Apple"
              icon={<IconSymbol name="apple.logo" size={20} color={colors.background} />}
              bgColor={colors.foreground}
              textColor={colors.background}
              loading={loading === "apple"}
              disabled={loading !== null}
              delay={350}
              onPress={() => handleOAuth("apple")}
            />
          )}
          <OAuthButton
            label="Continue with Google"
            icon={<Text style={{ fontSize: 18, fontWeight: "700", color: "#4285F4" }}>G</Text>}
            bgColor={colors.surface}
            textColor={colors.foreground}
            borderColor={colors.border}
            loading={loading === "google"}
            disabled={loading !== null}
            delay={Platform.OS === "android" ? 350 : 450}
            onPress={() => handleOAuth("google")}
          />
          <OAuthButton
            label="Continue with Microsoft"
            icon={<Text style={{ fontSize: 16, fontWeight: "700", color: "#0078D4" }}>M</Text>}
            bgColor={colors.surface}
            textColor={colors.foreground}
            borderColor={colors.border}
            loading={loading === "microsoft"}
            disabled={loading !== null}
            delay={Platform.OS === "android" ? 450 : 550}
            onPress={() => handleOAuth("microsoft")}
          />
        </View>

        {/* Browse without account */}
        <Animated.View style={skipStyle}>
          <GestureDetector gesture={Gesture.Tap().onFinalize((_, s) => {
            if (s) runOnJS(router.replace)("/(client-tabs)" as any);
          })}>
            <Animated.View style={styles.skipBtn}>
              <Text style={[styles.skipText, { color: colors.muted }]}>Browse without signing in</Text>
            </Animated.View>
          </GestureDetector>

          <Text style={[styles.terms, { color: colors.muted }]}>
            By continuing you agree to our Terms of Service and Privacy Policy.
          </Text>
        </Animated.View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 24,
    justifyContent: "center",
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 20,
    alignSelf: "flex-start",
  },
  backText: {
    fontSize: 16,
  },
  logoWrap: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
    alignSelf: "center",
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
  appLabel: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  title: {
    fontSize: 32,
    fontWeight: "800",
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
    maxWidth: 300,
  },
  buttons: {
    gap: 12,
    marginBottom: 8,
  },
  oauthWrap: {
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  oauthBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingVertical: 16,
    borderRadius: 16,
  },
  oauthBtnText: {
    fontSize: 16,
    fontWeight: "600",
  },
  skipBtn: {
    alignItems: "center",
    paddingVertical: 14,
    marginTop: 8,
  },
  skipText: {
    fontSize: 14,
  },
  terms: {
    fontSize: 11,
    textAlign: "center",
    lineHeight: 16,
    marginTop: 8,
  },
});
