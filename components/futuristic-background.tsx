import { useRef, useEffect } from "react";
import { View, StyleSheet, Animated } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useResponsive } from "@/hooks/use-responsive";

const PARTICLES = Array.from({ length: 18 }, (_, i) => ({
  id: i,
  x: (i * 37 + 11) % 100,
  y: (i * 53 + 7) % 100,
  size: 2 + (i % 3),
  dur: 6000 + (i * 800) % 8000,
  range: 18 + (i * 7) % 22,
}));

/**
 * Full-screen futuristic animated background.
 * Drop this as the FIRST child inside any ScreenContainer (or absolute-fill wrapper).
 * It is pointer-events: none so it never blocks touches.
 */
export function FuturisticBackground() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const { width: screenWidth, height: screenHeight } = useResponsive();

  const blob1X = useRef(new Animated.Value(0)).current;
  const blob1Y = useRef(new Animated.Value(0)).current;
  const blob2X = useRef(new Animated.Value(0)).current;
  const blob2Y = useRef(new Animated.Value(0)).current;
  const blob3X = useRef(new Animated.Value(0)).current;
  const blob3Y = useRef(new Animated.Value(0)).current;
  const scanY  = useRef(new Animated.Value(-80)).current;
  const particleAnims  = useRef(PARTICLES.map(() => new Animated.Value(0.3))).current;
  const particleMoveX  = useRef(PARTICLES.map(() => new Animated.Value(0))).current;
  const particleMoveY  = useRef(PARTICLES.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    const drift = (val: Animated.Value, range: number, dur: number) =>
      Animated.loop(Animated.sequence([
        Animated.timing(val, { toValue: range,  duration: dur,       useNativeDriver: true }),
        Animated.timing(val, { toValue: -range, duration: dur * 1.1, useNativeDriver: true }),
      ]));

    const anims = [
      drift(blob1X, screenWidth * 0.13, 9000),
      drift(blob1Y, screenHeight * 0.09, 11000),
      drift(blob2X, screenWidth * 0.16, 13000),
      drift(blob2Y, screenHeight * 0.11, 10000),
      drift(blob3X, screenWidth * 0.1,  15000),
      drift(blob3Y, screenHeight * 0.13, 12000),
    ];

    const scan = Animated.loop(
      Animated.sequence([
        Animated.timing(scanY, { toValue: screenHeight + 80, duration: 4500, useNativeDriver: true }),
        Animated.timing(scanY, { toValue: -80,               duration: 0,    useNativeDriver: true }),
      ])
    );

    const particleAnimList = PARTICLES.map((p, i) => {
      const pulse = Animated.loop(Animated.sequence([
        Animated.timing(particleAnims[i], { toValue: 0.9, duration: p.dur * 0.4, useNativeDriver: true }),
        Animated.timing(particleAnims[i], { toValue: 0.2, duration: p.dur * 0.6, useNativeDriver: true }),
      ]));
      const mx = drift(particleMoveX[i], p.range, p.dur);
      const my = drift(particleMoveY[i], p.range * 0.7, p.dur * 1.2);
      return [pulse, mx, my];
    }).flat();

    anims.forEach(a => a.start());
    scan.start();
    particleAnimList.forEach(a => a.start());
    return () => {
      anims.forEach(a => a.stop());
      scan.stop();
      particleAnimList.forEach(a => a.stop());
    };
  }, [screenWidth, screenHeight]);

  const blobSize = screenWidth * 0.85;
  const baseBg1   = isDark ? "#0D1B2A" : "#F8FAF7";
  const baseBg2   = isDark ? "#0a1520" : "#EEF5E8";
  const baseBg3   = isDark ? "#0f1e2e" : "#f4f8f2";
  const aurora1   = isDark ? "rgba(106,175,128,0.13)" : "rgba(74,124,89,0.12)";
  const aurora2   = isDark ? "rgba(36,53,71,0.7)"     : "rgba(143,191,106,0.14)";
  const aurora3   = isDark ? "rgba(22,32,48,0.8)"     : "rgba(238,245,232,0.6)";
  const scanColor = isDark ? "rgba(106,175,128,0.04)" : "rgba(74,124,89,0.04)";
  const dotColor  = isDark ? "rgba(106,175,128,0.65)" : "rgba(74,124,89,0.45)";

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      {/* Base gradient */}
      <LinearGradient
        colors={[baseBg1, baseBg2, baseBg3, baseBg1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Aurora blob 1 — top-left glow */}
      <Animated.View style={[styles.blob, {
        width: blobSize, height: blobSize, borderRadius: blobSize / 2,
        backgroundColor: aurora1,
        top: -blobSize * 0.35, left: -blobSize * 0.3,
        transform: [{ translateX: blob1X }, { translateY: blob1Y }],
        shadowColor: isDark ? "#6AAF80" : "#4A7C59",
        shadowOpacity: isDark ? 0.25 : 0.1,
        shadowRadius: 60,
        shadowOffset: { width: 0, height: 0 },
      }]} />

      {/* Aurora blob 2 — bottom-right glow */}
      <Animated.View style={[styles.blob, {
        width: blobSize * 0.9, height: blobSize * 0.9, borderRadius: (blobSize * 0.9) / 2,
        backgroundColor: aurora2,
        bottom: -blobSize * 0.25, right: -blobSize * 0.25,
        transform: [{ translateX: blob2X }, { translateY: blob2Y }],
        shadowColor: isDark ? "#4A7C59" : "#8FBF6A",
        shadowOpacity: isDark ? 0.2 : 0.08,
        shadowRadius: 50,
        shadowOffset: { width: 0, height: 0 },
      }]} />

      {/* Aurora blob 3 — center accent */}
      <Animated.View style={[styles.blob, {
        width: blobSize * 0.55, height: blobSize * 0.55, borderRadius: (blobSize * 0.55) / 2,
        backgroundColor: aurora3,
        top: screenHeight * 0.38, left: screenWidth * 0.2,
        transform: [{ translateX: blob3X }, { translateY: blob3Y }],
      }]} />

      {/* Floating glow particles */}
      {PARTICLES.map((p, i) => (
        <Animated.View
          key={p.id}
          style={[
            styles.particle,
            {
              width: p.size,
              height: p.size,
              borderRadius: p.size / 2,
              backgroundColor: dotColor,
              left: (p.x / 100) * screenWidth,
              top:  (p.y / 100) * screenHeight,
              opacity: particleAnims[i],
              transform: [{ translateX: particleMoveX[i] }, { translateY: particleMoveY[i] }],
              shadowColor: dotColor,
              shadowOpacity: 0.8,
              shadowRadius: p.size * 2,
              shadowOffset: { width: 0, height: 0 },
            },
          ]}
        />
      ))}

      {/* Scan-line sweep */}
      <Animated.View
        style={[
          styles.scanLine,
          {
            width: screenWidth,
            backgroundColor: scanColor,
            transform: [{ translateY: scanY }],
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  blob: {
    position: "absolute",
  },
  particle: {
    position: "absolute",
  },
  scanLine: {
    position: "absolute",
    height: 2,
    left: 0,
  },
});
