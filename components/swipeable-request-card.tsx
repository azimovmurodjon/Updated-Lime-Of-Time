/**
 * SwipeableRequestCard
 *
 * Wraps a pending appointment card with swipe-to-approve (right) and
 * swipe-to-decline (left) gestures using react-native-gesture-handler's
 * Swipeable component. Visible action panels appear as the user swipes.
 *
 * Usage:
 *   <SwipeableRequestCard onAccept={() => ...} onReject={() => ...}>
 *     {card content}
 *   </SwipeableRequestCard>
 */
import { useRef } from "react";
import { View, Text, StyleSheet, Platform } from "react-native";
import Swipeable from "react-native-gesture-handler/Swipeable";
import { IconSymbol } from "@/components/ui/icon-symbol";

interface Props {
  children: React.ReactNode;
  onAccept: () => void;
  onReject: () => void;
  /** Set to false to disable swipe (e.g., non-pending cards) */
  enabled?: boolean;
}

export function SwipeableRequestCard({ children, onAccept, onReject, enabled = true }: Props) {
  const swipeRef = useRef<Swipeable>(null);

  const renderLeftActions = () => (
    <View style={styles.leftAction}>
      <IconSymbol name="checkmark" size={22} color="#FFFFFF" />
      <Text style={styles.actionLabel}>Accept</Text>
    </View>
  );

  const renderRightActions = () => (
    <View style={styles.rightAction}>
      <IconSymbol name="xmark" size={22} color="#FFFFFF" />
      <Text style={styles.actionLabel}>Decline</Text>
    </View>
  );

  if (!enabled || Platform.OS === "web") {
    return <>{children}</>;
  }

  return (
    <Swipeable
      ref={swipeRef}
      friction={2}
      leftThreshold={60}
      rightThreshold={60}
      renderLeftActions={renderLeftActions}
      renderRightActions={renderRightActions}
      onSwipeableOpen={(direction) => {
        swipeRef.current?.close();
        if (direction === "left") {
          onAccept();
        } else {
          onReject();
        }
      }}
    >
      {children}
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  leftAction: {
    backgroundColor: "#1B5E20",
    justifyContent: "center",
    alignItems: "center",
    width: 80,
    borderRadius: 16,
    marginBottom: 10,
    gap: 4,
  },
  rightAction: {
    backgroundColor: "#C62828",
    justifyContent: "center",
    alignItems: "center",
    width: 80,
    borderRadius: 16,
    marginBottom: 10,
    gap: 4,
  },
  actionLabel: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
  },
});
