/**
 * AnimatedSplash — creative branded splash screen for Lime Of Time.
 *
 * Design concept:
 *  - Deep forest-green gradient background
 *  - Central lime-circle logo that scales up with a spring bounce
 *  - Concentric ring pulses radiating outward (like a clock tick)
 *  - App name fades + slides up after the logo settles
 *  - Tagline fades in last
 *  - Entire screen fades out when onFinish is called
 *
 * Usage: render this as the first screen; call `onFinish` after your data loads.
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
const LOGO_SIZE = Math.min(width * 0.28, 120);

interface AnimatedSplashProps {
  onFinish: () => void;
}

export function AnimatedSplash({ onFinish }: AnimatedSplashProps) {
  // ─── Animated values ────────────────────────────────────────────
  const logoScale = useRef(new Animated.Value(0)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const ring1Scale = useRef(new Animated.Value(0.4)).current;
  const ring1Opacity = useRef(new Animated.Value(0)).current;
  const ring2Scale = useRef(new Animated.Value(0.4)).current;
  const ring2Opacity = useRef(new Animated.Value(0)).current;
  const ring3Scale = useRef(new Animated.Value(0.4)).current;
  const ring3Opacity = useRef(new Animated.Value(0)).current;
  const titleTranslateY = useRef(new Animated.Value(24)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;
  const screenOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const ringPulse = (scale: Animated.Value, opacity: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.parallel([
            Animated.timing(scale, {
              toValue: 2.2,
              duration: 1400,
              easing: Easing.out(Easing.quad),
              useNativeDriver: true,
            }),
            Animated.timing(opacity, {
              toValue: 0,
              duration: 1400,
              easing: Easing.out(Easing.quad),
              useNativeDriver: true,
            }),
          ]),
          Animated.parallel([
            Animated.timing(scale, { toValue: 0.4, duration: 0, useNativeDriver: true }),
            Animated.timing(opacity, { toValue: 0.35, duration: 0, useNativeDriver: true }),
          ]),
        ])
      );

    // 1. Logo springs in
    Animated.spring(logoScale, {
      toValue: 1,
      tension: 60,
      friction: 7,
      useNativeDriver: true,
    }).start();

    Animated.timing(logoOpacity, {
      toValue: 1,
      duration: 350,
      useNativeDriver: true,
    }).start();

    // 2. Ring pulses start after logo appears
    setTimeout(() => {
      ring1Opacity.setValue(0.35);
      ring2Opacity.setValue(0.35);
      ring3Opacity.setValue(0.35);
      ringPulse(ring1Scale, ring1Opacity, 0).start();
      ringPulse(ring2Scale, ring2Opacity, 420).start();
      ringPulse(ring3Scale, ring3Opacity, 840).start();
    }, 300);

    // 3. Title slides up
    Animated.sequence([
      Animated.delay(500),
      Animated.parallel([
        Animated.timing(titleOpacity, {
          toValue: 1,
          duration: 500,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(titleTranslateY, {
          toValue: 0,
          duration: 500,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
    ]).start();

    // 4. Tagline fades in
    Animated.sequence([
      Animated.delay(900),
      Animated.timing(taglineOpacity, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start();

    // 5. After 2.4s, fade out and call onFinish
    const timer = setTimeout(() => {
      Animated.timing(screenOpacity, {
        toValue: 0,
        duration: 400,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }).start(() => {
        onFinish();
      });
    }, 2400);

    return () => clearTimeout(timer);
  }, []);

  return (
    <Animated.View style={[styles.container, { opacity: screenOpacity }]}>
      {/* Background gradient layers (simulated with nested views) */}
      <View style={styles.bgLayer1} />
      <View style={styles.bgLayer2} />

      {/* Decorative dots */}
      {DOT_POSITIONS.map((dot, i) => (
        <View
          key={i}
          style={[
            styles.dot,
            {
              width: dot.size,
              height: dot.size,
              borderRadius: dot.size / 2,
              top: dot.top,
              left: dot.left,
              opacity: dot.opacity,
            },
          ]}
        />
      ))}

      {/* Pulsing rings */}
      <View style={styles.ringContainer} pointerEvents="none">
        {[
          { scale: ring1Scale, opacity: ring1Opacity },
          { scale: ring2Scale, opacity: ring2Opacity },
          { scale: ring3Scale, opacity: ring3Opacity },
        ].map((ring, i) => (
          <Animated.View
            key={i}
            style={[
              styles.ring,
              {
                transform: [{ scale: ring.scale }],
                opacity: ring.opacity,
              },
            ]}
          />
        ))}
      </View>

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
        <View style={styles.logoCircle}>
          <Image
            source={require("@/assets/images/icon.png")}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>
      </Animated.View>

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
      <Animated.Text style={[styles.tagline, { opacity: taglineOpacity }]}>
        Smart scheduling for your business
      </Animated.Text>

      {/* Bottom accent bar */}
      <View style={styles.bottomBar} />
    </Animated.View>
  );
}

// ─── Decorative dot positions ─────────────────────────────────────────────────
const DOT_POSITIONS = [
  { size: 8, top: height * 0.12, left: width * 0.08, opacity: 0.25 },
  { size: 5, top: height * 0.18, left: width * 0.82, opacity: 0.2 },
  { size: 12, top: height * 0.25, left: width * 0.91, opacity: 0.15 },
  { size: 6, top: height * 0.72, left: width * 0.07, opacity: 0.2 },
  { size: 10, top: height * 0.78, left: width * 0.88, opacity: 0.18 },
  { size: 4, top: height * 0.85, left: width * 0.15, opacity: 0.25 },
  { size: 7, top: height * 0.35, left: width * 0.04, opacity: 0.15 },
  { size: 9, top: height * 0.62, left: width * 0.93, opacity: 0.2 },
];

const RING_SIZE = LOGO_SIZE * 2.2;

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#1A3A2A",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999,
  },
  bgLayer1: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#1A3A2A",
  },
  bgLayer2: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: height * 0.45,
    backgroundColor: "#142D20",
    borderTopLeftRadius: width * 0.7,
    borderTopRightRadius: width * 0.7,
  },
  dot: {
    position: "absolute",
    backgroundColor: "#8FBF6A",
  },
  ringContainer: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  ring: {
    position: "absolute",
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    borderWidth: 1.5,
    borderColor: "#8FBF6A",
  },
  logoWrapper: {
    marginBottom: 28,
  },
  logoCircle: {
    width: LOGO_SIZE + 24,
    height: LOGO_SIZE + 24,
    borderRadius: (LOGO_SIZE + 24) / 2,
    backgroundColor: "#2D5A3D",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#8FBF6A",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 12,
  },
  logo: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
    borderRadius: LOGO_SIZE / 2,
  },
  appName: {
    fontSize: Platform.OS === "ios" ? 34 : 30,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: 0.5,
    marginBottom: 8,
    textAlign: "center",
  },
  tagline: {
    fontSize: 14,
    color: "rgba(255,255,255,0.6)",
    letterSpacing: 0.3,
    textAlign: "center",
  },
  bottomBar: {
    position: "absolute",
    bottom: 40,
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(143, 191, 106, 0.4)",
  },
});
