/**
 * Client Portal — Sign In Screen
 *
 * Matches the business onboarding visual style exactly:
 * - Same dark green LinearGradient background (#1A3A28 → #4A7C59)
 * - App logo (icon.png) at top, same ring treatment
 * - White card at bottom with OAuth buttons
 * - No OTP — social login only
 * - Back button to profile-select
 */

import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Platform,
  ActivityIndicator,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { setProfileMode } from "@/lib/client-store";
import { startOAuthLogin } from "@/constants/oauth";
import { IconSymbol } from "@/components/ui/icon-symbol";
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

const { width, height } = Dimensions.get("window");

// ─── Animated OAuth Button ────────────────────────────────────────────────────
function OAuthButton({
  label,
  icon,
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

  // Logo entrance
  const logoScale = useSharedValue(0.5);
  const logoOpacity = useSharedValue(0);
  const appNameOpacity = useSharedValue(0);
  const appNameY = useSharedValue(10);
  const cardOpacity = useSharedValue(0);
  const cardY = useSharedValue(40);

  useEffect(() => {
    logoOpacity.value = withTiming(1, { duration: 600, easing: Easing.out(Easing.cubic) });
    logoScale.value = withSpring(1, { damping: 14, stiffness: 120 });
    appNameOpacity.value = withDelay(300, withTiming(1, { duration: 500 }));
    appNameY.value = withDelay(300, withSpring(0, { damping: 18, stiffness: 100 }));
    cardOpacity.value = withDelay(500, withTiming(1, { duration: 500, easing: Easing.out(Easing.cubic) }));
    cardY.value = withDelay(500, withSpring(0, { damping: 20, stiffness: 120 }));
  }, []);

  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));
  const appNameStyle = useAnimatedStyle(() => ({
    opacity: appNameOpacity.value,
    transform: [{ translateY: appNameY.value }],
  }));
  const cardStyle = useAnimatedStyle(() => ({
    opacity: cardOpacity.value,
    transform: [{ translateY: cardY.value }],
  }));

  // Back button
  const backScale = useSharedValue(1);
  const goToProfileSelect = () => router.replace("/profile-select" as any);
  const backTap = Gesture.Tap()
    .onBegin(() => { backScale.value = withSpring(0.93, { damping: 20, stiffness: 300 }); })
    .onFinalize((_, success) => {
      backScale.value = withSpring(1, { damping: 18, stiffness: 200 });
      if (success) {
        if (Platform.OS !== "web") runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Light);
        runOnJS(goToProfileSelect)();
      }
    });
  const backStyle = useAnimatedStyle(() => ({ transform: [{ scale: backScale.value }] }));

  // Skip opacity
  const skipOpacity = useSharedValue(0);
  useEffect(() => {
    skipOpacity.value = withDelay(800, withTiming(1, { duration: 400 }));
  }, []);
  const skipStyle = useAnimatedStyle(() => ({ opacity: skipOpacity.value }));

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]}>
      {/* ─── Green gradient background (matches business onboarding) ── */}
      <LinearGradient
        colors={["#1A3A28", "#2D5A3D", "#4A7C59", "#3D6B4A"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />

      {/* ─── Bottom wave decorations ────────────────────────────── */}
      <View style={[styles.wave1]} />
      <View style={[styles.wave2]} />

      <KeyboardAvoidingView
        behavior="padding"
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 24}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ─── Back button ─────────────────────────────────────── */}
          <GestureDetector gesture={backTap}>
            <Animated.View style={[styles.backBtn, backStyle]}>
              <IconSymbol name="chevron.left" size={20} color="rgba(255,255,255,0.8)" />
              <Text style={styles.backText}>Back</Text>
            </Animated.View>
          </GestureDetector>

          {/* ─── Logo + App Name ─────────────────────────────────── */}
          <Animated.View style={[styles.logoWrap, logoStyle]}>
            <View style={styles.logoRing}>
              <Image
                source={require("@/assets/images/icon.png")}
                style={styles.logo}
                resizeMode="contain"
              />
            </View>
            <Animated.Text style={[styles.appName, appNameStyle]}>Lime Of Time</Animated.Text>
            <Animated.Text style={[styles.appTagline, appNameStyle]}>Book appointments with ease</Animated.Text>
            <Animated.View style={[styles.byLine, appNameStyle]}>
              <View style={styles.byLineDash} />
              <Text style={styles.byLineText}>CLIENT PORTAL</Text>
              <View style={styles.byLineDash} />
            </Animated.View>
          </Animated.View>

          {/* ─── White Card ──────────────────────────────────────── */}
          <Animated.View style={[styles.card, cardStyle]}>
            <Text style={styles.cardTitle}>Welcome!</Text>
            <Text style={styles.cardSubtitle}>
              Sign in to book appointments, manage your schedule, and discover new services.
            </Text>

            {/* OAuth Buttons */}
            <View style={styles.buttons}>
              {Platform.OS !== "android" && (
                <OAuthButton
                  label="Continue with Apple"
                  icon={<IconSymbol name="apple.logo" size={20} color="#FFFFFF" />}
                  bgColor="#000000"
                  textColor="#FFFFFF"
                  loading={loading === "apple"}
                  disabled={loading !== null}
                  delay={600}
                  onPress={() => handleOAuth("apple")}
                />
              )}
              <OAuthButton
                label="Continue with Google"
                icon={<Text style={{ fontSize: 18, fontWeight: "700", color: "#4285F4" }}>G</Text>}
                bgColor="#FFFFFF"
                textColor="#111827"
                borderColor="#E5E7EB"
                loading={loading === "google"}
                disabled={loading !== null}
                delay={Platform.OS === "android" ? 600 : 700}
                onPress={() => handleOAuth("google")}
              />
              <OAuthButton
                label="Continue with Microsoft"
                icon={<Text style={{ fontSize: 16, fontWeight: "700", color: "#0078D4" }}>M</Text>}
                bgColor="#FFFFFF"
                textColor="#111827"
                borderColor="#E5E7EB"
                loading={loading === "microsoft"}
                disabled={loading !== null}
                delay={Platform.OS === "android" ? 700 : 800}
                onPress={() => handleOAuth("microsoft")}
              />
            </View>

            {/* Divider */}
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Browse without account */}
            <Animated.View style={skipStyle}>
              <GestureDetector gesture={Gesture.Tap().onFinalize((_, s) => {
                if (s) runOnJS(router.replace)("/(client-tabs)" as any);
              })}>
                <Animated.View style={styles.skipBtn}>
                  <Text style={styles.skipText}>Browse without signing in</Text>
                </Animated.View>
              </GestureDetector>
            </Animated.View>

            <Text style={styles.terms}>
              By continuing you agree to our Terms of Service and Privacy Policy.
            </Text>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scroll: {
    minHeight: height,
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 48,
  },
  wave1: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: height * 0.38,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderTopLeftRadius: width * 0.5,
    borderTopRightRadius: width * 0.5,
  },
  wave2: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: height * 0.28,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderTopLeftRadius: width * 0.6,
    borderTopRightRadius: width * 0.6,
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 16,
    alignSelf: "flex-start",
  },
  backText: {
    fontSize: 16,
    color: "rgba(255,255,255,0.8)",
    fontWeight: "500",
  },
  logoWrap: {
    alignItems: "center",
    marginBottom: 32,
    marginTop: 8,
  },
  logoRing: {
    width: 96,
    height: 96,
    borderRadius: 28,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.25)",
  },
  logo: {
    width: 72,
    height: 72,
    borderRadius: 20,
  },
  appName: {
    fontSize: 28,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  appTagline: {
    fontSize: 14,
    color: "rgba(255,255,255,0.65)",
    letterSpacing: 0.2,
    marginBottom: 10,
  },
  byLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
  },
  byLineDash: {
    width: 24,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.3)",
  },
  byLineText: {
    fontSize: 11,
    color: "rgba(255,255,255,0.45)",
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 10,
  },
  cardTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  cardSubtitle: {
    fontSize: 14,
    color: "#6B7280",
    lineHeight: 20,
    marginBottom: 24,
  },
  buttons: {
    gap: 12,
  },
  oauthWrap: {
    borderRadius: 14,
    overflow: "hidden",
  },
  oauthBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 14,
  },
  oauthBtnText: {
    fontSize: 15,
    fontWeight: "600",
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#E5E7EB",
  },
  dividerText: {
    fontSize: 13,
    color: "#9CA3AF",
    fontWeight: "500",
  },
  skipBtn: {
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "#F3F4F6",
    marginBottom: 16,
  },
  skipText: {
    fontSize: 14,
    color: "#4A7C59",
    fontWeight: "600",
  },
  terms: {
    fontSize: 11,
    color: "#9CA3AF",
    textAlign: "center",
    lineHeight: 16,
    marginTop: 4,
  },
});
