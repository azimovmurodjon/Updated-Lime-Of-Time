import { View, Text, Pressable, StyleSheet, Platform } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";

interface LockScreenProps {
  biometricType: "face" | "fingerprint" | "none";
  onUnlock: () => void;
}

export function LockScreen({ biometricType, onUnlock }: LockScreenProps) {
  const colors = useColors();

  if (Platform.OS === "web") return null;

  const iconName = "lock.fill" as any;
  const unlockText =
    biometricType === "face"
      ? "Tap to unlock with Face ID"
      : biometricType === "fingerprint"
      ? "Tap to unlock with Fingerprint"
      : "Tap to unlock";

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        <View
          style={[
            styles.iconContainer,
            { backgroundColor: colors.primary + "15" },
          ]}
        >
          <IconSymbol name={iconName} size={48} color={colors.primary} />
        </View>
        <Text style={[styles.title, { color: colors.foreground }]}>
          App Locked
        </Text>
        <Text style={[styles.subtitle, { color: colors.muted }]}>
          {unlockText}
        </Text>
        <Pressable
          onPress={onUnlock}
          style={({ pressed }) => [
            styles.unlockButton,
            { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 },
          ]}
        >
          <Text style={[styles.unlockButtonText, { color: "#FFFFFF" }]}>
            Unlock
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    alignItems: "center",
    gap: 16,
    paddingHorizontal: 40,
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
  },
  subtitle: {
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
  },
  unlockButton: {
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 16,
  },
  unlockButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
});
