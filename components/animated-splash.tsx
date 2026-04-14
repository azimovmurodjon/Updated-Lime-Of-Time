/**
 * AnimatedSplash — ultra-modern branded splash for Lime Of Time.
 *
 * Design:
 *  - Deep forest-green radial gradient background (simulated with layered views)
 *  - Geometric mesh lines that fade in subtly
 *  - Logo container with a glass-morphism circle + glow
 *  - Logo scales in with a spring bounce
 *  - Animated progress bar beneath the logo
 *  - App name slides up with a stagger
 *  - Tagline fades in last
 *  - Full screen fades out when onFinish is called
 */

import { useEffect, useRef } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  Image,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";

const { width, height } = Dimensions.get("window");
const LOGO_SIZE = Math.min(width * 0.34, 130);
const CIRCLE_SIZE = LOGO_SIZE + 48;

interface AnimatedSplashProps {
  onFinish: () => void;
}

export function AnimatedSplash({ onFinish }: AnimatedSplashProps) {
  // ─── Animated values ─────────────────────────────────────────────
  const screenOpacity = useRef(new Animated.Value(1)).current;

  // Background
  const bgScale = useRef(new Animated.Value(1.08)).current;
  const bgOpacity = useRef(new Animated.Value(0)).current;

  // Logo
  const logoScale = useRef(new Animated.Value(0.3)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const glowOpacity = useRef(new Animated.Value(0)).current;
  const glowScale = useRef(new Animated.Value(0.6)).current;

  // Ring pulse
  const ring1Scale = useRef(new Animated.Value(1)).current;
  const ring1Opacity = useRef(new Animated.Value(0)).current;
  const ring2Scale = useRef(new Animated.Value(1)).current;
  const ring2Opacity = useRef(new Animated.Value(0)).current;

  // Progress bar — use scaleX so we can keep useNativeDriver: true
  const progressScaleX = useRef(new Animated.Value(0)).current;

  // Text
  const titleTranslateY = useRef(new Animated.Value(24)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;
  const taglineTranslateY = useRef(new Animated.Value(14)).current;

  // Exit: whole content slides up
  const contentTranslateY = useRef(new Animated.Value(0)).current;

  // Floating orbs
  const orb1Y = useRef(new Animated.Value(0)).current;
  const orb2Y = useRef(new Animated.Value(0)).current;
  const orb1Opacity = useRef(new Animated.Value(0)).current;
  const orb2Opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Background fade + subtle zoom out
    Animated.parallel([
      Animated.timing(bgOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(bgScale, {
        toValue: 1,
        duration: 1200,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();

    // Floating orbs
    setTimeout(() => {
      Animated.timing(orb1Opacity, { toValue: 0.18, duration: 800, useNativeDriver: true }).start();
      Animated.timing(orb2Opacity, { toValue: 0.12, duration: 800, useNativeDriver: true }).start();
      Animated.loop(
        Animated.sequence([
          Animated.timing(orb1Y, { toValue: -20, duration: 2800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(orb1Y, { toValue: 0, duration: 2800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ])
      ).start();
      Animated.loop(
        Animated.sequence([
          Animated.timing(orb2Y, { toValue: 16, duration: 3200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(orb2Y, { toValue: 0, duration: 3200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ])
      ).start();
    }, 200);

    // Glow appears first
    Animated.sequence([
      Animated.delay(150),
      Animated.parallel([
        Animated.timing(glowOpacity, { toValue: 0.6, duration: 600, useNativeDriver: true }),
        Animated.spring(glowScale, { toValue: 1, tension: 50, friction: 8, useNativeDriver: true }),
      ]),
    ]).start();

    // Logo springs in
    Animated.sequence([
      Animated.delay(250),
      Animated.parallel([
        Animated.spring(logoScale, { toValue: 1, tension: 70, friction: 7, useNativeDriver: true }),
        Animated.timing(logoOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]),
    ]).start();

    // Ring pulses
    const ringPulse = (scale: Animated.Value, opacity: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.parallel([
            Animated.timing(scale, { toValue: 2.4, duration: 1600, easing: Easing.out(Easing.quad), useNativeDriver: true }),
            Animated.sequence([
              Animated.timing(opacity, { toValue: 0.3, duration: 100, useNativeDriver: true }),
              Animated.timing(opacity, { toValue: 0, duration: 1500, easing: Easing.out(Easing.quad), useNativeDriver: true }),
            ]),
          ]),
          Animated.parallel([
            Animated.timing(scale, { toValue: 1, duration: 0, useNativeDriver: true }),
            Animated.timing(opacity, { toValue: 0, duration: 0, useNativeDriver: true }),
          ]),
        ])
      );

    setTimeout(() => {
      ringPulse(ring1Scale, ring1Opacity, 0).start();
      ringPulse(ring2Scale, ring2Opacity, 700).start();
    }, 500);

    // Progress bar fills over 1.8s (scaleX 0→1 with native driver)
    Animated.sequence([
      Animated.delay(400),
      Animated.timing(progressScaleX, {
        toValue: 1,
        duration: 1800,
        easing: Easing.bezier(0.25, 0.46, 0.45, 0.94),
        useNativeDriver: true,
      }),
    ]).start();

    // Title slides up
    Animated.sequence([
      Animated.delay(550),
      Animated.parallel([
        Animated.timing(titleOpacity, { toValue: 1, duration: 500, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(titleTranslateY, { toValue: 0, duration: 500, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
    ]).start();

    // Tagline
    Animated.sequence([
      Animated.delay(800),
      Animated.parallel([
        Animated.timing(taglineOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(taglineTranslateY, { toValue: 0, duration: 500, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
    ]).start();

    // Exit: logo pulse-scale → content slides up + screen fades out → app content revealed
    const timer = setTimeout(() => {
      Animated.sequence([
        // 1. Logo pulses up slightly (feels like it's launching the app)
        Animated.timing(logoScale, {
          toValue: 1.12,
          duration: 160,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        // 2. Simultaneously slide content up and fade the whole splash out
        Animated.parallel([
          Animated.timing(contentTranslateY, {
            toValue: -height * 0.10,
            duration: 400,
            easing: Easing.in(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(screenOpacity, {
            toValue: 0,
            duration: 400,
            easing: Easing.in(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
      ]).start(() => onFinish());
    }, 2600);

    return () => clearTimeout(timer);
  }, []);

  const RING_SIZE = CIRCLE_SIZE * 1.2;

  return (
    <Animated.View style={[styles.container, { opacity: screenOpacity }]}>
      {/* Background layers */}
      <Animated.View style={[styles.bg, { opacity: bgOpacity, transform: [{ scale: bgScale }] }]} />

      {/* Radial center glow */}
      <View style={styles.radialGlow} />

      {/* Floating orbs */}
      <Animated.View style={[styles.orb1, { opacity: orb1Opacity, transform: [{ translateY: orb1Y }] }]} />
      <Animated.View style={[styles.orb2, { opacity: orb2Opacity, transform: [{ translateY: orb2Y }] }]} />

      {/* All animated content wrapped for slide-up exit */}
      {/* Note: wrapping View below replaces the inline content placement */}

      {/* Subtle grid lines */}
      <View style={styles.gridContainer} pointerEvents="none">
        {[0.2, 0.4, 0.6, 0.8].map((ratio, i) => (
          <View key={`h${i}`} style={[styles.gridLineH, { top: height * ratio }]} />
        ))}
        {[0.15, 0.35, 0.65, 0.85].map((ratio, i) => (
          <View key={`v${i}`} style={[styles.gridLineV, { left: width * ratio }]} />
        ))}
      </View>

      {/* Animated content wrapper — slides up on exit */}
      <Animated.View style={[styles.contentWrapper, { transform: [{ translateY: contentTranslateY }] }]}>
        {/* Ring pulses */}
        <View style={[styles.ringContainer, { width: RING_SIZE, height: RING_SIZE }]} pointerEvents="none">
          {[
            { scale: ring1Scale, opacity: ring1Opacity },
            { scale: ring2Scale, opacity: ring2Opacity },
          ].map((ring, i) => (
            <Animated.View
              key={i}
              style={[
                styles.ring,
                {
                  width: RING_SIZE,
                  height: RING_SIZE,
                  borderRadius: RING_SIZE / 2,
                  transform: [{ scale: ring.scale }],
                  opacity: ring.opacity,
                },
              ]}
            />
          ))}
        </View>

        {/* Logo glow */}
        <Animated.View
          style={[
            styles.logoGlow,
            {
              width: CIRCLE_SIZE * 2.0,
              height: CIRCLE_SIZE * 2.0,
              borderRadius: CIRCLE_SIZE * 1.0,
              opacity: glowOpacity,
              transform: [{ scale: glowScale }],
            },
          ]}
        />

        {/* Logo */}
        <Animated.View
          style={[
            styles.logoWrapper,
            {
              opacity: logoOpacity,
              transform: [{ scale: logoScale }],
            },
          ]}
        >
          {/* Glass circle */}
          <View style={[styles.glassCircle, { width: CIRCLE_SIZE, height: CIRCLE_SIZE, borderRadius: CIRCLE_SIZE / 2 }]}>
            <Image
              source={require("@/assets/images/icon.png")}
              style={{ width: LOGO_SIZE, height: LOGO_SIZE, borderRadius: LOGO_SIZE * 0.22 }}
              resizeMode="contain"
            />
          </View>
        </Animated.View>

        {/* Progress bar — scaleX grows from left via translateX offset trick */}
        <View style={styles.progressTrack}>
          <Animated.View
            style={[
              styles.progressFill,
              {
                width: width * 0.55,
                transform: [
                  // Shift left by half the track width * (1 - scale) so it appears to grow from the left
                  { translateX: progressScaleX.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-(width * 0.55) / 2, 0],
                  }) },
                  { scaleX: progressScaleX },
                ],
              },
            ]}
          />
        </View>

        {/* App name */}
        <Animated.Text
          style={[
            styles.appName,
            {
              opacity: titleOpacity,
              transform: [{ translateY: titleTranslateY }],
            },
          ]}
        >
          Lime Of Time
        </Animated.Text>

        {/* Tagline */}
        <Animated.Text
          style={[
            styles.tagline,
            {
              opacity: taglineOpacity,
              transform: [{ translateY: taglineTranslateY }],
            },
          ]}
        >
          Smart scheduling for your business
        </Animated.Text>
      </Animated.View>

      {/* Bottom pill */}
      <View style={styles.bottomPill} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999,
    backgroundColor: "#0D2318",
  },
  bg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#0D2318",
  },
  radialGlow: {
    position: "absolute",
    width: width * 1.4,
    height: width * 1.4,
    borderRadius: width * 0.7,
    backgroundColor: "#1A4030",
    top: height * 0.5 - width * 0.7,
    left: width * 0.5 - width * 0.7,
  },
  orb1: {
    position: "absolute",
    width: width * 0.7,
    height: width * 0.7,
    borderRadius: width * 0.35,
    backgroundColor: "#2D6B45",
    top: height * 0.05,
    left: -width * 0.2,
  },
  orb2: {
    position: "absolute",
    width: width * 0.55,
    height: width * 0.55,
    borderRadius: width * 0.275,
    backgroundColor: "#1E5535",
    bottom: height * 0.08,
    right: -width * 0.15,
  },
  gridContainer: {
    ...StyleSheet.absoluteFillObject,
  },
  gridLineH: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 0.5,
    backgroundColor: "rgba(143,191,106,0.06)",
  },
  gridLineV: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 0.5,
    backgroundColor: "rgba(143,191,106,0.06)",
  },
  ringContainer: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  ring: {
    position: "absolute",
    borderWidth: 1,
    borderColor: "#8FBF6A",
  },
  logoGlow: {
    position: "absolute",
    backgroundColor: "#3D8C5A",
  },
  contentWrapper: {
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    paddingHorizontal: 24,
  },
  logoWrapper: {
    marginBottom: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  glassCircle: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1.5,
    borderColor: "rgba(143,191,106,0.35)",
    shadowColor: "#8FBF6A",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 28,
    elevation: 16,
    // Backdrop blur simulated with a lighter inner color
  },
  progressTrack: {
    width: width * 0.55,
    height: 3,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.1)",
    marginBottom: 28,
    overflow: "hidden",
  },
  progressFill: {
    height: 3,
    borderRadius: 2,
    backgroundColor: "#8FBF6A",
  },
  appName: {
    fontSize: Platform.OS === "ios" ? 36 : 32,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: -0.5,
    textAlign: "center",
    marginBottom: 8,
  },
  tagline: {
    fontSize: 14,
    color: "rgba(255,255,255,0.55)",
    letterSpacing: 0.5,
    textAlign: "center",
  },
  bottomPill: {
    position: "absolute",
    bottom: Platform.OS === "ios" ? 44 : 32,
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(143,191,106,0.35)",
  },
});
