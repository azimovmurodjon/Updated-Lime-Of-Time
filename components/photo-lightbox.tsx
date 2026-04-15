/**
 * PhotoLightbox — full-screen photo viewer with pinch-to-zoom and swipe navigation.
 *
 * Usage:
 *   <PhotoLightbox
 *     photos={photos}          // ClientPhoto[]
 *     initialIndex={0}
 *     visible={true}
 *     onClose={() => {}}
 *   />
 *
 * Gestures:
 *   - Pinch: zoom in/out (1x – 4x)
 *   - Pan: pan while zoomed; swipe left/right when at 1x to navigate photos
 *   - Double-tap: toggle between 1x and 2.5x zoom
 *   - Tap outside (close button) or swipe down at 1x: close
 */
import { useCallback, useEffect } from "react";
import {
  Modal,
  View,
  Text,
  Pressable,
  Dimensions,
  StyleSheet,
  StatusBar,
  Platform,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  runOnJS,
  clamp,
  type SharedValue,
} from "react-native-reanimated";
import {
  Gesture,
  GestureDetector,
} from "react-native-gesture-handler";
import { Image } from "expo-image";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { ClientPhoto } from "@/lib/types";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");
const MIN_SCALE = 1;
const MAX_SCALE = 4;
const SWIPE_THRESHOLD = SCREEN_W * 0.3; // 30% of screen width triggers navigation
const SWIPE_DOWN_THRESHOLD = 80; // px swipe-down at 1x to close

interface PhotoLightboxProps {
  photos: ClientPhoto[];
  initialIndex: number;
  visible: boolean;
  onClose: () => void;
}

/** Single photo slide with pinch-to-zoom and pan */
function PhotoSlide({
  photo,
  onSwipeLeft,
  onSwipeRight,
  onClose,
}: {
  photo: ClientPhoto;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  onClose: () => void;
}) {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  // Reset transforms when photo changes
  useEffect(() => {
    scale.value = withTiming(1, { duration: 200 });
    translateX.value = withTiming(0, { duration: 200 });
    translateY.value = withTiming(0, { duration: 200 });
    savedScale.value = 1;
    savedTranslateX.value = 0;
    savedTranslateY.value = 0;
  }, [photo.id]);

  const resetZoom = useCallback(() => {
    scale.value = withSpring(1, { damping: 20, stiffness: 200 });
    translateX.value = withSpring(0, { damping: 20, stiffness: 200 });
    translateY.value = withSpring(0, { damping: 20, stiffness: 200 });
    savedScale.value = 1;
    savedTranslateX.value = 0;
    savedTranslateY.value = 0;
  }, []);

  // Pinch gesture — zoom in/out
  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      const newScale = clamp(savedScale.value * e.scale, MIN_SCALE, MAX_SCALE);
      scale.value = newScale;
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      // Snap back to 1x if below threshold
      if (scale.value < 1.05) {
        scale.value = withSpring(1, { damping: 20, stiffness: 200 });
        translateX.value = withSpring(0, { damping: 20, stiffness: 200 });
        translateY.value = withSpring(0, { damping: 20, stiffness: 200 });
        savedScale.value = 1;
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
      }
    });

  // Pan gesture — pan when zoomed, swipe to navigate when at 1x
  const panGesture = Gesture.Pan()
    .minDistance(5)
    .onUpdate((e) => {
      if (savedScale.value > 1.05) {
        // Panning while zoomed — constrain to image bounds
        const maxX = (SCREEN_W * (savedScale.value - 1)) / 2;
        const maxY = (SCREEN_H * (savedScale.value - 1)) / 2;
        translateX.value = clamp(savedTranslateX.value + e.translationX, -maxX, maxX);
        translateY.value = clamp(savedTranslateY.value + e.translationY, -maxY, maxY);
      } else {
        // At 1x — allow horizontal swipe preview
        translateX.value = savedTranslateX.value + e.translationX;
        translateY.value = savedTranslateY.value + e.translationY;
      }
    })
    .onEnd((e) => {
      if (savedScale.value > 1.05) {
        // Save pan offset while zoomed
        const maxX = (SCREEN_W * (savedScale.value - 1)) / 2;
        const maxY = (SCREEN_H * (savedScale.value - 1)) / 2;
        savedTranslateX.value = clamp(translateX.value, -maxX, maxX);
        savedTranslateY.value = clamp(translateY.value, -maxY, maxY);
      } else {
        // Navigation swipe at 1x
        const dx = e.translationX;
        const dy = e.translationY;
        if (Math.abs(dx) > Math.abs(dy)) {
          // Horizontal swipe
          if (dx < -SWIPE_THRESHOLD) {
            translateX.value = withTiming(-SCREEN_W, { duration: 200 }, () => {
              runOnJS(onSwipeLeft)();
            });
          } else if (dx > SWIPE_THRESHOLD) {
            translateX.value = withTiming(SCREEN_W, { duration: 200 }, () => {
              runOnJS(onSwipeRight)();
            });
          } else {
            translateX.value = withSpring(0, { damping: 20, stiffness: 200 });
          }
        } else if (dy > SWIPE_DOWN_THRESHOLD) {
          // Swipe down to close
          runOnJS(onClose)();
        } else {
          translateX.value = withSpring(0, { damping: 20, stiffness: 200 });
          translateY.value = withSpring(0, { damping: 20, stiffness: 200 });
        }
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
      }
    });

  // Double-tap to toggle zoom 1x ↔ 2.5x
  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd((e) => {
      if (savedScale.value > 1.05) {
        // Reset to 1x
        scale.value = withSpring(1, { damping: 20, stiffness: 200 });
        translateX.value = withSpring(0, { damping: 20, stiffness: 200 });
        translateY.value = withSpring(0, { damping: 20, stiffness: 200 });
        savedScale.value = 1;
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
      } else {
        // Zoom to 2.5x centered on tap point
        const newScale = 2.5;
        const focusX = (e.x - SCREEN_W / 2) * (1 - newScale);
        const focusY = (e.y - SCREEN_H / 2) * (1 - newScale);
        const maxX = (SCREEN_W * (newScale - 1)) / 2;
        const maxY = (SCREEN_H * (newScale - 1)) / 2;
        scale.value = withSpring(newScale, { damping: 20, stiffness: 200 });
        translateX.value = withSpring(clamp(focusX, -maxX, maxX), { damping: 20, stiffness: 200 });
        translateY.value = withSpring(clamp(focusY, -maxY, maxY), { damping: 20, stiffness: 200 });
        savedScale.value = newScale;
        savedTranslateX.value = clamp(focusX, -maxX, maxX);
        savedTranslateY.value = clamp(focusY, -maxY, maxY);
      }
    });

  const composed = Gesture.Simultaneous(
    Gesture.Race(doubleTapGesture, panGesture),
    pinchGesture
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <GestureDetector gesture={composed}>
      <Animated.View style={[styles.slide, animatedStyle]}>
        <Image
          source={{ uri: photo.uri }}
          style={styles.fullImage}
          contentFit="contain"
          transition={100}
        />
      </Animated.View>
    </GestureDetector>
  );
}

export function PhotoLightbox({ photos, initialIndex, visible, onClose }: PhotoLightboxProps) {
  const currentIndex = useSharedValue(initialIndex);
  const displayIndex = useSharedValue(initialIndex);

  // Sync when initialIndex changes (e.g. user taps a different photo)
  useEffect(() => {
    currentIndex.value = initialIndex;
    displayIndex.value = initialIndex;
  }, [initialIndex, visible]);

  const goNext = useCallback(() => {
    if (currentIndex.value < photos.length - 1) {
      currentIndex.value += 1;
      displayIndex.value = currentIndex.value;
    }
  }, [photos.length]);

  const goPrev = useCallback(() => {
    if (currentIndex.value > 0) {
      currentIndex.value -= 1;
      displayIndex.value = currentIndex.value;
    }
  }, []);

  // We use a simple JS-driven index for rendering (no Reanimated derived value needed for render)
  // We track it via a state that gets updated from worklet callbacks
  const [idx, setIdx] = useStateFromSharedValue(displayIndex, initialIndex);

  const handleSwipeLeft = useCallback(() => {
    if (currentIndex.value < photos.length - 1) {
      const next = currentIndex.value + 1;
      currentIndex.value = next;
      setIdx(next);
    }
  }, [photos.length]);

  const handleSwipeRight = useCallback(() => {
    if (currentIndex.value > 0) {
      const prev = currentIndex.value - 1;
      currentIndex.value = prev;
      setIdx(prev);
    }
  }, []);

  const photo = photos[idx];

  if (!visible || !photo) return null;

  const labelColor =
    photo.label === "before" ? "#3B82F6" : photo.label === "after" ? "#10B981" : "#9BA1A6";

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        {/* Close button */}
        <Pressable
          onPress={onClose}
          style={({ pressed }) => [styles.closeBtn, { opacity: pressed ? 0.6 : 1 }]}
          hitSlop={16}
        >
          <IconSymbol name="xmark" size={20} color="#fff" />
        </Pressable>

        {/* Counter + label */}
        <View style={styles.topInfo}>
          <View style={[styles.labelPill, { backgroundColor: labelColor + "CC" }]}>
            <Text style={styles.labelText}>{photo.label.toUpperCase()}</Text>
          </View>
          <Text style={styles.counter}>{idx + 1} / {photos.length}</Text>
        </View>

        {/* Photo with gestures */}
        <PhotoSlide
          photo={photo}
          onSwipeLeft={handleSwipeLeft}
          onSwipeRight={handleSwipeRight}
          onClose={onClose}
        />

        {/* Bottom caption */}
        <View style={styles.bottomInfo}>
          {photo.note ? (
            <Text style={styles.caption} numberOfLines={2}>{photo.note}</Text>
          ) : null}
          <Text style={styles.dateText}>
            {new Date(photo.takenAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
          </Text>
        </View>

        {/* Left / right arrow hints (only when multiple photos) */}
        {photos.length > 1 && (
          <>
            {idx > 0 && (
              <Pressable
                onPress={handleSwipeRight}
                style={({ pressed }) => [styles.arrowBtn, styles.arrowLeft, { opacity: pressed ? 0.5 : 0.7 }]}
                hitSlop={12}
              >
                <IconSymbol name="chevron.left" size={22} color="#fff" />
              </Pressable>
            )}
            {idx < photos.length - 1 && (
              <Pressable
                onPress={handleSwipeLeft}
                style={({ pressed }) => [styles.arrowBtn, styles.arrowRight, { opacity: pressed ? 0.5 : 0.7 }]}
                hitSlop={12}
              >
                <IconSymbol name="chevron.right" size={22} color="#fff" />
              </Pressable>
            )}
          </>
        )}

        {/* Dot indicators */}
        {photos.length > 1 && (
          <View style={styles.dots}>
            {photos.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  { backgroundColor: i === idx ? "#fff" : "rgba(255,255,255,0.4)", width: i === idx ? 20 : 6 },
                ]}
              />
            ))}
          </View>
        )}
      </View>
    </Modal>
  );
}

/** Simple hook to sync a JS state from a Reanimated shared value via runOnJS callbacks */
function useStateFromSharedValue(sv: SharedValue<number>, initial: number): [number, (v: number) => void] {
  const [val, setVal] = require("react").useState(initial);
  require("react").useEffect(() => {
    setVal(initial);
  }, [initial]);
  return [val, setVal];
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.96)",
    justifyContent: "center",
    alignItems: "center",
  },
  slide: {
    width: SCREEN_W,
    height: SCREEN_H,
    justifyContent: "center",
    alignItems: "center",
  },
  fullImage: {
    width: SCREEN_W,
    height: SCREEN_H,
  },
  closeBtn: {
    position: "absolute",
    top: Platform.OS === "ios" ? 56 : 40,
    right: 20,
    zIndex: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  topInfo: {
    position: "absolute",
    top: Platform.OS === "ios" ? 56 : 40,
    left: 20,
    zIndex: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  labelPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  labelText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#fff",
    letterSpacing: 0.5,
  },
  counter: {
    fontSize: 13,
    color: "rgba(255,255,255,0.7)",
    fontWeight: "500",
  },
  bottomInfo: {
    position: "absolute",
    bottom: Platform.OS === "ios" ? 60 : 40,
    left: 24,
    right: 24,
    zIndex: 10,
    alignItems: "center",
  },
  caption: {
    fontSize: 14,
    color: "#fff",
    textAlign: "center",
    marginBottom: 4,
    lineHeight: 20,
  },
  dateText: {
    fontSize: 12,
    color: "rgba(255,255,255,0.5)",
  },
  arrowBtn: {
    position: "absolute",
    top: "50%",
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
    marginTop: -20,
  },
  arrowLeft: { left: 12 },
  arrowRight: { right: 12 },
  dots: {
    position: "absolute",
    bottom: Platform.OS === "ios" ? 36 : 16,
    flexDirection: "row",
    gap: 4,
    alignItems: "center",
    zIndex: 10,
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
});
