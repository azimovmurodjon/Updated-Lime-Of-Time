/**
 * TourOverlay
 * ─────────────────────────────────────────────────────────────────────────────
 * Full-screen interactive onboarding tour overlay.
 * Shows a dark backdrop with a spotlight cutout pointing at each bottom tab,
 * a message bubble with an arrow, and navigation controls.
 *
 * Steps 0–4: point to Home, Calendar, Clients, Services, Settings tabs.
 * Step 5 (isLastStep): point to the "+" FAB area with mandatory location setup.
 */
import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Animated,
  Dimensions,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useResponsive } from "@/hooks/use-responsive";

// ─── Types ────────────────────────────────────────────────────────────────────
export type TourTabStep = {
  tabIndex: number;
  title: string;
  message: string;
  emoji: string;
  isLastStep?: boolean;
};

type TourOverlayProps = {
  step: number;
  steps: TourTabStep[];
  fadeAnim: Animated.Value;
  colors: {
    primary: string;
    background: string;
    foreground: string;
    muted: string;
    surface: string;
    border: string;
    error: string;
  };
  isDark: boolean;
  tutorialCardBg: string;
  tutorialCardBorder: string;
  tutorialTitleColor: string;
  tutorialDescColor: string;
  tutorialPrevBorderColor: string;
  tutorialPrevTextColor: string;
  tutorialSkipTextColor: string;
  tutorialProgressTrackBg: string;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
  onSetupLocation: () => void;
};

// ─── Constants ────────────────────────────────────────────────────────────────
const TAB_COUNT = 5;
const SPOTLIGHT_RADIUS = 38;
const ARROW_SIZE = 12;

// ─── Component ────────────────────────────────────────────────────────────────
export function TourOverlay({
  step,
  steps,
  fadeAnim,
  colors,
  isDark,
  tutorialCardBg,
  tutorialCardBorder,
  tutorialTitleColor,
  tutorialDescColor,
  tutorialPrevBorderColor,
  tutorialPrevTextColor,
  tutorialSkipTextColor,
  tutorialProgressTrackBg,
  onNext,
  onPrev,
  onSkip,
  onSetupLocation,
}: TourOverlayProps) {
  const insets = useSafeAreaInsets();
  const { width, height, tabBarBaseHeight } = useResponsive();
  const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

  const currentStep = steps[step];
  const isLastStep = !!currentStep?.isLastStep;
  const totalSteps = steps.length;

  // Tab bar height (same formula as _layout.tsx)
  const bottomPadding = Platform.OS === "web" ? 12 : Math.max(insets.bottom, 8);
  const tabBarHeight = tabBarBaseHeight + bottomPadding;

  // Spotlight X center for the current tab
  const tabWidth = screenWidth / TAB_COUNT;
  const spotlightX = tabWidth * currentStep.tabIndex + tabWidth / 2;
  // Spotlight Y center: center of the tab bar icon area (top of tab bar + icon area)
  const tabBarTop = screenHeight - tabBarHeight;
  const spotlightY = tabBarTop + tabBarBaseHeight / 2 - 4;

  // For the last step (location setup), point to the Settings tab
  const effectiveTabIndex = isLastStep ? 4 : currentStep.tabIndex;
  const effectiveSpotlightX = tabWidth * effectiveTabIndex + tabWidth / 2;

  // Card position: above the tab bar
  const cardBottom = tabBarHeight + 16;

  // Arrow position: pointing down from card to spotlight
  const arrowLeft = effectiveSpotlightX - ARROW_SIZE;

  // Animated spotlight pulse
  const pulseAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.18, duration: 700, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [step]);

  // Progress
  const progressPercent = totalSteps > 1 ? (step / (totalSteps - 1)) * 100 : 100;

  return (
    <Animated.View
      style={[styles.overlay, { opacity: fadeAnim }]}
      pointerEvents="box-none"
    >
      {/* ── Dark backdrop ── */}
      <View style={[styles.backdrop, { width: screenWidth, height: screenHeight }]}>
        {/* Spotlight ring (pulsing) */}
        <Animated.View
          style={[
            styles.spotlightRing,
            {
              left: effectiveSpotlightX - SPOTLIGHT_RADIUS,
              top: spotlightY - SPOTLIGHT_RADIUS,
              width: SPOTLIGHT_RADIUS * 2,
              height: SPOTLIGHT_RADIUS * 2,
              borderRadius: SPOTLIGHT_RADIUS,
              transform: [{ scale: pulseAnim }],
              borderColor: colors.primary,
            },
          ]}
        />
        {/* Spotlight clear circle */}
        <View
          style={[
            styles.spotlightClear,
            {
              left: effectiveSpotlightX - SPOTLIGHT_RADIUS + 6,
              top: spotlightY - SPOTLIGHT_RADIUS + 6,
              width: (SPOTLIGHT_RADIUS - 6) * 2,
              height: (SPOTLIGHT_RADIUS - 6) * 2,
              borderRadius: SPOTLIGHT_RADIUS - 6,
            },
          ]}
        />
      </View>

      {/* ── Arrow pointing down to spotlight ── */}
      <View
        style={[
          styles.arrow,
          {
            left: arrowLeft,
            bottom: cardBottom - ARROW_SIZE,
          },
        ]}
      />

      {/* ── Message card ── */}
      <View
        style={[
          styles.card,
          {
            bottom: cardBottom,
            marginHorizontal: 16,
            backgroundColor: tutorialCardBg,
            borderColor: tutorialCardBorder,
            shadowColor: isDark ? "#000" : "#000",
          },
        ]}
      >
        {/* Progress bar */}
        <View style={[styles.progressTrack, { backgroundColor: tutorialProgressTrackBg }]}>
          <View
            style={[
              styles.progressBar,
              {
                width: `${progressPercent}%` as any,
                backgroundColor: colors.primary,
              },
            ]}
          />
        </View>

        {/* Content */}
        <View style={styles.cardContent}>
          {/* Emoji + step count */}
          <View style={styles.headerRow}>
            <Text style={styles.emoji}>{currentStep.emoji}</Text>
            <Text style={[styles.stepCount, { color: tutorialSkipTextColor }]}>
              {step + 1} / {totalSteps}
            </Text>
          </View>

          {/* Title */}
          <Text style={[styles.title, { color: tutorialTitleColor }]}>
            {currentStep.title}
          </Text>

          {/* Message */}
          <Text style={[styles.message, { color: tutorialDescColor }]}>
            {currentStep.message}
          </Text>

          {/* Actions */}
          <View style={styles.actions}>
            {/* Skip / Back */}
            {step === 0 ? (
              <Pressable
                onPress={onSkip}
                style={({ pressed }) => [styles.skipBtn, { opacity: pressed ? 0.6 : 1 }]}
              >
                <Text style={[styles.skipText, { color: tutorialSkipTextColor }]}>
                  Skip Tour
                </Text>
              </Pressable>
            ) : (
              <Pressable
                onPress={onPrev}
                style={({ pressed }) => [
                  styles.prevBtn,
                  {
                    borderColor: tutorialPrevBorderColor,
                    opacity: pressed ? 0.6 : 1,
                  },
                ]}
              >
                <Text style={[styles.prevText, { color: tutorialPrevTextColor }]}>
                  ← Back
                </Text>
              </Pressable>
            )}

            {/* Next / Set Up Location */}
            {isLastStep ? (
              <Pressable
                onPress={onSetupLocation}
                style={({ pressed }) => [
                  styles.nextBtn,
                  {
                    backgroundColor: colors.primary,
                    opacity: pressed ? 0.85 : 1,
                    flex: 2,
                  },
                ]}
              >
                <Text style={styles.nextText}>📍 Set Up Location</Text>
              </Pressable>
            ) : (
              <Pressable
                onPress={onNext}
                style={({ pressed }) => [
                  styles.nextBtn,
                  {
                    backgroundColor: colors.primary,
                    opacity: pressed ? 0.85 : 1,
                    flex: 2,
                  },
                ]}
              >
                <Text style={styles.nextText}>
                  {step === totalSteps - 2 ? "Last Step →" : "Next →"}
                </Text>
              </Pressable>
            )}
          </View>
        </View>
      </View>
    </Animated.View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.72)",
  },
  spotlightRing: {
    position: "absolute",
    borderWidth: 2.5,
    opacity: 0.9,
  },
  spotlightClear: {
    position: "absolute",
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  arrow: {
    position: "absolute",
    width: 0,
    height: 0,
    borderLeftWidth: ARROW_SIZE,
    borderRightWidth: ARROW_SIZE,
    borderTopWidth: ARROW_SIZE,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderTopColor: "rgba(255,255,255,0.13)",
    zIndex: 10000,
  },
  card: {
    position: "absolute",
    left: 16,
    right: 16,
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 10,
    zIndex: 10000,
  },
  progressTrack: {
    height: 3,
    width: "100%",
  },
  progressBar: {
    height: 3,
    borderRadius: 2,
  },
  cardContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  emoji: {
    fontSize: 28,
  },
  stepCount: {
    fontSize: 12,
    fontWeight: "600",
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  message: {
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 18,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  skipBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
  },
  skipText: {
    fontSize: 13,
    fontWeight: "600",
  },
  prevBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  prevText: {
    fontSize: 13,
    fontWeight: "600",
  },
  nextBtn: {
    alignItems: "center",
    paddingVertical: 14,
    borderRadius: 14,
  },
  nextText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});
