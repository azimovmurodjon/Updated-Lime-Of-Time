/**
 * Profile Selection Screen
 * Exactly matches the business onboarding green gradient background:
 * - Same LinearGradient colors: #1A3A28 → #2D5A3D → #4A7C59 → #3D6B4A
 * - Same floating particles
 * - Same wave decorations
 * - Same logo/appName/tagline/byInnovancio header
 * - White cards below (same as business onboarding white card)
 */

import React, { useEffect } from "react";
import {
  Text,
  View,
  StyleSheet,
  Image,
  Dimensions,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  Easing,
  runOnJS,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { setProfileMode } from "@/lib/client-store";

const { width, height } = Dimensions.get("window");

// ─── Floating Particle (identical to business onboarding) ─────────────
function FloatingParticle({
  x, y, size, delay, duration, opacity: baseOpacity,
}: { x: number; y: number; size: number; delay: number; duration: number; opacity: number }) {
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(baseOpacity, { duration: 800 }));
    translateY.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(-18, { duration, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        false,
      ),
    );
  }, []);

  const style = useAnimatedStyle(() => ({
    position: "absolute",
    left: x,
    top: y,
    width: size,
    height: size,
    borderRadius: size / 2,
    backgroundColor: "rgba(255,255,255,0.6)",
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return <Animated.View style={style} />;
}

const PARTICLES = [
  { x: width * 0.08, y: height * 0.12, size: 5, delay: 200, duration: 2800, opacity: 0.35 },
  { x: width * 0.85, y: height * 0.09, size: 4, delay: 600, duration: 3200, opacity: 0.28 },
  { x: width * 0.15, y: height * 0.35, size: 3, delay: 400, duration: 2600, opacity: 0.22 },
  { x: width * 0.78, y: height * 0.28, size: 6, delay: 800, duration: 3600, opacity: 0.3 },
  { x: width * 0.5,  y: height * 0.08, size: 4, delay: 300, duration: 3000, opacity: 0.25 },
  { x: width * 0.92, y: height * 0.45, size: 3, delay: 700, duration: 2900, opacity: 0.2 },
  { x: width * 0.05, y: height * 0.55, size: 5, delay: 500, duration: 3400, opacity: 0.28 },
  { x: width * 0.65, y: height * 0.15, size: 3, delay: 900, duration: 2700, opacity: 0.22 },
];

// ─── Portal Card (white card, same style as business onboarding white card) ──
function PortalCard({
  icon,
  title,
  subtitle,
  accentColor,
  badgeLabel,
  onPress,
  delay,
}: {
  icon: string;
  title: string;
  subtitle: string;
  accentColor: string;
  badgeLabel: string;
  onPress: () => void;
  delay: number;
}) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(24);

  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(1, { duration: 400 }));
    translateY.value = withDelay(delay, withTiming(0, { duration: 400, easing: Easing.out(Easing.quad) }));
  }, []);

  const tap = Gesture.Tap()
    .onBegin(() => { scale.value = withSpring(0.97, { damping: 18, stiffness: 300 }); })
    .onFinalize((_, success) => {
      scale.value = withSpring(1, { damping: 18, stiffness: 200 });
      if (success) {
        if (Platform.OS !== "web") runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Medium);
        runOnJS(onPress)();
      }
    });

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }, { scale: scale.value }],
  }));

  return (
    <GestureDetector gesture={tap}>
      <Animated.View style={[styles.card, animStyle]}>
        {/* Accent blob top-right */}
        <View style={[styles.cardBlob, { backgroundColor: accentColor + "20" }]} />

        {/* Icon */}
        <View style={[styles.cardIconWrap, { backgroundColor: accentColor + "18" }]}>
          <Text style={styles.cardIcon}>{icon}</Text>
        </View>

        {/* Badge */}
        <View style={[styles.cardBadge, { backgroundColor: accentColor }]}>
          <Text style={styles.cardBadgeText}>{badgeLabel}</Text>
        </View>

        {/* Text */}
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.cardSubtitle}>{subtitle}</Text>

        {/* CTA */}
        <View style={styles.cardCta}>
          <Text style={[styles.cardCtaText, { color: accentColor }]}>Get started</Text>
          <Text style={[styles.cardCtaArrow, { color: accentColor }]}> ›</Text>
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function ProfileSelectScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Entrance animations (same timing as business onboarding)
  const logoOpacity = useSharedValue(0);
  const logoScale = useSharedValue(0.8);
  const appNameOpacity = useSharedValue(0);
  const appNameTranslateY = useSharedValue(16);
  const taglineOpacity = useSharedValue(0);
  const taglineTranslateY = useSharedValue(12);
  const byLineOpacity = useSharedValue(0);
  const footerOpacity = useSharedValue(0);

  useEffect(() => {
    logoOpacity.value = withTiming(1, { duration: 500 });
    logoScale.value = withSpring(1, { damping: 14, stiffness: 120 });
    appNameOpacity.value = withDelay(220, withTiming(1, { duration: 380 }));
    appNameTranslateY.value = withDelay(220, withTiming(0, { duration: 360, easing: Easing.out(Easing.quad) }));
    taglineOpacity.value = withDelay(380, withTiming(1, { duration: 400 }));
    taglineTranslateY.value = withDelay(380, withTiming(0, { duration: 400, easing: Easing.out(Easing.quad) }));
    byLineOpacity.value = withDelay(520, withTiming(1, { duration: 400 }));
    footerOpacity.value = withDelay(900, withTiming(1, { duration: 400 }));
  }, []);

  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));
  const appNameStyle = useAnimatedStyle(() => ({
    opacity: appNameOpacity.value,
    transform: [{ translateY: appNameTranslateY.value }],
  }));
  const taglineStyle = useAnimatedStyle(() => ({
    opacity: taglineOpacity.value,
    transform: [{ translateY: taglineTranslateY.value }],
  }));
  const byLineStyle = useAnimatedStyle(() => ({ opacity: byLineOpacity.value }));
  const footerStyle = useAnimatedStyle(() => ({ opacity: footerOpacity.value }));

  const handleSelect = async (mode: "business" | "client") => {
    await setProfileMode(mode);
    if (mode === "business") {
      router.replace("/onboarding");
    } else {
      router.replace("/client-signin" as any);
    }
  };

  return (
    <View style={styles.container}>
      {/* ─── Exact same gradient as business onboarding ─── */}
      <LinearGradient
        colors={["#1A3A28", "#2D5A3D", "#4A7C59", "#3D6B4A"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />

      {/* ─── Floating Particles (identical to business onboarding) ─── */}
      {PARTICLES.map((p, i) => <FloatingParticle key={i} {...p} />)}

      {/* ─── Bottom Wave Decorations (identical to business onboarding) ─── */}
      <View style={styles.wave1} />
      <View style={styles.wave2} />

      {/* ─── Content ─── */}
      <View style={[styles.content, { paddingTop: insets.top + 14, paddingBottom: insets.bottom + 14 }]}>

        {/* ─── Logo + App Name (identical to business onboarding) ─── */}
        <View style={styles.logoContainer}>
          <Animated.View style={logoStyle}>
            <View style={styles.logoRing}>
              <Image
                source={require("@/assets/images/icon.png")}
                style={styles.logo}
                resizeMode="contain"
              />
            </View>
          </Animated.View>
          <Animated.Text style={[styles.appName, appNameStyle]}>Lime Of Time</Animated.Text>
          <Animated.Text style={[styles.appTagline, taglineStyle]}>Book Appointments Near You</Animated.Text>
          <Animated.View style={[{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 }, byLineStyle]}>
            <View style={{ width: 24, height: 1, backgroundColor: "rgba(255,255,255,0.3)" }} />
            <Text style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", letterSpacing: 1.5, textTransform: "uppercase" }}>by Innovancio</Text>
            <View style={{ width: 24, height: 1, backgroundColor: "rgba(255,255,255,0.3)" }} />
          </Animated.View>
        </View>

        {/* ─── Portal Cards ─── */}
        <View style={styles.cardsContainer}>
          <PortalCard
            icon="💼"
            title="Business Portal"
            subtitle="Manage appointments, clients, staff, services, and grow your business."
            accentColor="#4A7C59"
            badgeLabel="For Businesses"
            onPress={() => handleSelect("business")}
            delay={600}
          />
          <PortalCard
            icon="👤"
            title="Client Portal"
            subtitle="Discover services, book appointments, and manage your schedule."
            accentColor="#8B5CF6"
            badgeLabel="For Customers"
            onPress={() => handleSelect("client")}
            delay={750}
          />
        </View>

        {/* ─── Footer Note ─── */}
        <Animated.Text style={[styles.footerNote, footerStyle]}>
          You can switch between portals at any time from Settings
        </Animated.Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  content: {
    flex: 1,
    paddingHorizontal: 22,
    alignItems: "center",
    justifyContent: "center",
    gap: 18,
  },
  logoContainer: {
    alignItems: "center",
    marginBottom: 0,
  },
  logoRing: {
    width: 100,
    height: 100,
    borderRadius: 28,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.2)",
    marginBottom: 10,
  },
  logo: {
    width: 76,
    height: 76,
    borderRadius: 20,
  },
  appName: {
    fontSize: 28,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 0.2,
    marginTop: 2,
  },
  appTagline: {
    fontSize: 13,
    color: "rgba(255,255,255,0.65)",
    marginTop: 3,
    letterSpacing: 0.2,
  },
  cardsContainer: {
    width: "100%",
    gap: 12,
    marginTop: 4,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 18,
    overflow: "hidden",
    shadowColor: "#0A2518",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 20,
    elevation: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.95)",
  },
  cardBlob: {
    position: "absolute",
    top: -20,
    right: -20,
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  cardIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  cardIcon: {
    fontSize: 26,
  },
  cardBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    marginBottom: 8,
  },
  cardBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: 0.3,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 6,
  },
  cardSubtitle: {
    fontSize: 13,
    color: "#6B7280",
    lineHeight: 19,
    marginBottom: 12,
  },
  cardCta: {
    flexDirection: "row",
    alignItems: "center",
  },
  cardCtaText: {
    fontSize: 14,
    fontWeight: "700",
  },
  cardCtaArrow: {
    fontSize: 18,
    fontWeight: "700",
    marginTop: -1,
  },
  footerNote: {
    fontSize: 12,
    color: "rgba(255,255,255,0.45)",
    textAlign: "center",
  },
});
