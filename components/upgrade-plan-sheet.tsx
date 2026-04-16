/**
 * UpgradePlanSheet
 * ─────────────────────────────────────────────────────────────────────────────
 * A bottom sheet shown when a user tries to add a resource beyond their plan limit.
 * Displays the current plan, the next tier, and a single-tap CTA to start checkout.
 */
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Linking,
} from "react-native";
import { useState } from "react";
import { useRouter } from "expo-router";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";

// ─── Plan upgrade path ────────────────────────────────────────────────────────

const NEXT_TIER: Record<string, { planKey: string; displayName: string; monthlyPrice: number; color: string }> = {
  solo: { planKey: "growth", displayName: "Growth", monthlyPrice: 19, color: "#3B82F6" },
  growth: { planKey: "studio", displayName: "Studio", monthlyPrice: 39, color: "#8B5CF6" },
  studio: { planKey: "enterprise", displayName: "Enterprise", monthlyPrice: 69, color: "#F59E0B" },
};

const PLAN_COLORS: Record<string, string> = {
  solo: "#6B7280",
  growth: "#3B82F6",
  studio: "#8B5CF6",
  enterprise: "#F59E0B",
};

// ─── What each tier unlocks for each resource ─────────────────────────────────

const RESOURCE_UPGRADE_BENEFIT: Record<string, Record<string, string>> = {
  clients: {
    growth: "Up to 100 clients",
    studio: "Unlimited clients",
    enterprise: "Unlimited clients",
  },
  services: {
    growth: "Up to 20 services",
    studio: "Unlimited services",
    enterprise: "Unlimited services",
  },
  staff: {
    growth: "Up to 2 staff members",
    studio: "Up to 10 staff members",
    enterprise: "Up to 100 staff members",
  },
  products: {
    growth: "Up to 20 products",
    studio: "Unlimited products",
    enterprise: "Unlimited products",
  },
  locations: {
    growth: "1 location",
    studio: "Up to 3 locations",
    enterprise: "Up to 10 locations",
  },
};

// ─── Props ────────────────────────────────────────────────────────────────────

interface UpgradePlanSheetProps {
  visible: boolean;
  onClose: () => void;
  currentPlanKey: string;
  currentPlanName: string;
  resource: "clients" | "services" | "staff" | "products" | "locations";
  currentLimit: number;
  businessOwnerId: number;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function UpgradePlanSheet({
  visible,
  onClose,
  currentPlanKey,
  currentPlanName,
  resource,
  currentLimit,
  businessOwnerId,
}: UpgradePlanSheetProps) {
  const colors = useColors();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const nextTier = NEXT_TIER[currentPlanKey];
  const resourceLabel = resource === "staff" ? "staff members" : resource;
  const benefit = nextTier ? RESOURCE_UPGRADE_BENEFIT[resource]?.[nextTier.planKey] : null;

  const handleUpgrade = async () => {
    if (!nextTier) {
      // Already on enterprise — go to choose-plan
      onClose();
      router.push("/choose-plan" as any);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("http://127.0.0.1:3000/api/stripe/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessOwnerId,
          planKey: nextTier.planKey,
          period: "monthly",
        }),
      });
      const data = await res.json() as { url?: string; activated?: boolean; free?: boolean; error?: string };
      if (data.url) {
        onClose();
        await Linking.openURL(data.url);
      } else if (data.activated || data.free) {
        onClose();
        Alert.alert("Plan Upgraded!", `You're now on the ${nextTier.displayName} plan.`);
      } else {
        Alert.alert("Upgrade Failed", data.error ?? "Could not start checkout. Please try again.");
      }
    } catch {
      Alert.alert("Upgrade Failed", "Could not connect to server. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  const handleViewAllPlans = () => {
    onClose();
    router.push("/choose-plan" as any);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <View style={{ flex: 1 }} />
        <Pressable
          style={[styles.sheet, { backgroundColor: colors.surface }]}
          onPress={(e) => e.stopPropagation()}
        >
          {/* Handle */}
          <View style={[styles.handle, { backgroundColor: colors.border }]} />

          {/* Icon */}
          <View style={[styles.iconCircle, { backgroundColor: (PLAN_COLORS[currentPlanKey] ?? "#6B7280") + "20" }]}>
            <IconSymbol name="lock.fill" size={28} color={PLAN_COLORS[currentPlanKey] ?? "#6B7280"} />
          </View>

          {/* Title */}
          <Text style={[styles.title, { color: colors.foreground }]}>
            {currentPlanName} Limit Reached
          </Text>
          <Text style={[styles.subtitle, { color: colors.muted }]}>
            Your {currentPlanName} plan allows up to {currentLimit === -1 ? "unlimited" : currentLimit} {resourceLabel}.
            {"\n"}Upgrade to add more.
          </Text>

          {/* Next tier highlight */}
          {nextTier && (
            <View style={[styles.tierCard, { backgroundColor: nextTier.color + "10", borderColor: nextTier.color + "40" }]}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <IconSymbol name="crown.fill" size={16} color={nextTier.color} />
                <Text style={{ fontSize: 15, fontWeight: "700", color: nextTier.color }}>
                  {nextTier.displayName} Plan · ${nextTier.monthlyPrice}/mo
                </Text>
              </View>
              {benefit && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <IconSymbol name="checkmark.circle.fill" size={14} color={nextTier.color} />
                  <Text style={{ fontSize: 13, color: colors.foreground }}>{benefit}</Text>
                </View>
              )}
            </View>
          )}

          {/* CTA */}
          <Pressable
            onPress={handleUpgrade}
            disabled={loading}
            style={({ pressed }) => [
              styles.primaryBtn,
              { backgroundColor: nextTier?.color ?? colors.primary, opacity: pressed || loading ? 0.8 : 1 },
            ]}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <IconSymbol name="arrow.up.right" size={16} color="#fff" />
                <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15, marginLeft: 6 }}>
                  {nextTier ? `Upgrade to ${nextTier.displayName}` : "View Plans"}
                </Text>
              </>
            )}
          </Pressable>

          {/* View all plans */}
          <Pressable
            onPress={handleViewAllPlans}
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, marginTop: 12, alignItems: "center" })}
          >
            <Text style={{ fontSize: 14, color: colors.muted, fontWeight: "500" }}>
              View all plans
            </Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    alignItems: "center",
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    marginBottom: 20,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 20,
  },
  tierCard: {
    width: "100%",
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 20,
  },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 12,
    width: "100%",
  },
});
