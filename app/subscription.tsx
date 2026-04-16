/**
 * My Subscription Screen
 * ─────────────────────────────────────────────────────────────────────────────
 * Shows the business owner's current plan, usage meters for each resource,
 * trial countdown (if applicable), and a button to view/change plans.
 */
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { useCallback } from "react";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useStore } from "@/lib/store";
import { trpc } from "@/lib/trpc";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function UsageMeter({
  label,
  current,
  max,
  color,
}: {
  label: string;
  current: number;
  max: number;
  color: string;
}) {
  const colors = useColors();
  const isUnlimited = max === -1;
  const pct = isUnlimited ? 0 : Math.min(1, current / Math.max(max, 1));
  const barColor = pct >= 0.9 ? "#EF4444" : pct >= 0.7 ? "#F59E0B" : color;

  return (
    <View style={{ marginBottom: 14 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
        <Text style={{ fontSize: 13, fontWeight: "600", color: colors.foreground }}>{label}</Text>
        <Text style={{ fontSize: 12, color: isUnlimited ? colors.primary : colors.muted }}>
          {isUnlimited ? "Unlimited" : `${current} / ${max}`}
        </Text>
      </View>
      {!isUnlimited && (
        <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.border, overflow: "hidden" }}>
          <View
            style={{
              height: 6,
              borderRadius: 3,
              backgroundColor: barColor,
              width: `${Math.round(pct * 100)}%`,
            }}
          />
        </View>
      )}
    </View>
  );
}

// ─── Plan Badge ───────────────────────────────────────────────────────────────

const PLAN_COLORS: Record<string, string> = {
  solo: "#6B7280",
  growth: "#3B82F6",
  studio: "#8B5CF6",
  enterprise: "#F59E0B",
};

function PlanBadge({ planKey, displayName, isAdminOverride }: { planKey: string; displayName: string; isAdminOverride: boolean }) {
  const badgeColor = isAdminOverride ? "#F59E0B" : (PLAN_COLORS[planKey] ?? "#6B7280");
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <View style={{ backgroundColor: badgeColor + "20", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, flexDirection: "row", alignItems: "center", gap: 4 }}>
        <IconSymbol name="crown.fill" size={13} color={badgeColor} />
        <Text style={{ fontSize: 13, fontWeight: "700", color: badgeColor }}>
          {isAdminOverride ? "Complimentary" : displayName}
        </Text>
      </View>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function SubscriptionScreen() {
  const colors = useColors();
  const router = useRouter();
  const { state } = useStore();
  const businessOwnerId = state.businessOwnerId;

  const { data: planInfo, isLoading, refetch } = trpc.subscription.getMyPlan.useQuery(
    { businessOwnerId: businessOwnerId! },
    { enabled: !!businessOwnerId, staleTime: 30_000 }
  );

  // Refetch when screen comes into focus (e.g. after returning from Stripe checkout)
  useFocusEffect(
    useCallback(() => {
      if (businessOwnerId) {
        refetch();
      }
    }, [businessOwnerId, refetch])
  );

  if (!businessOwnerId || isLoading) {
    return (
      <ScreenContainer>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      </ScreenContainer>
    );
  }

  if (!planInfo) {
    return (
      <ScreenContainer className="p-5">
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 12 }}>
          <IconSymbol name="exclamationmark.triangle.fill" size={40} color={colors.warning} />
          <Text style={{ fontSize: 16, color: colors.muted, textAlign: "center" }}>
            Could not load subscription info.{"\n"}Please check your connection.
          </Text>
          <Pressable
            onPress={() => refetch()}
            style={({ pressed }) => [styles.primaryBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 }]}
          >
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>Retry</Text>
          </Pressable>
        </View>
      </ScreenContainer>
    );
  }

  const { planKey, displayName, subscriptionStatus, trialDaysRemaining, isAdminOverride, limits, usage } = planInfo;

  const statusLabel: Record<string, string> = {
    trial: "Trial",
    active: "Active",
    expired: "Expired",
    free: "Free",
  };

  const statusColor: Record<string, string> = {
    trial: colors.warning,
    active: colors.success,
    expired: colors.error,
    free: colors.muted,
  };

  return (
    <ScreenContainer>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
        {/* Header */}
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 20 }}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, marginRight: 12 })}
          >
            <IconSymbol name="arrow.left" size={24} color={colors.foreground} />
          </Pressable>
          <Text style={{ fontSize: 22, fontWeight: "700", color: colors.foreground, flex: 1 }}>My Subscription</Text>
        </View>

        {/* Plan Card */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <PlanBadge planKey={planKey} displayName={displayName} isAdminOverride={isAdminOverride} />
            <View style={{ backgroundColor: (statusColor[subscriptionStatus] ?? colors.muted) + "20", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 }}>
              <Text style={{ fontSize: 12, fontWeight: "700", color: statusColor[subscriptionStatus] ?? colors.muted }}>
                {statusLabel[subscriptionStatus] ?? subscriptionStatus}
              </Text>
            </View>
          </View>

          {/* Trial countdown */}
          {subscriptionStatus === "trial" && trialDaysRemaining !== null && (
            <View style={{ backgroundColor: colors.warning + "15", borderRadius: 10, padding: 12, marginBottom: 12, flexDirection: "row", alignItems: "center", gap: 10 }}>
              <IconSymbol name="clock.fill" size={18} color={colors.warning} />
              <Text style={{ fontSize: 13, fontWeight: "600", color: colors.warning, flex: 1 }}>
                {trialDaysRemaining > 0
                  ? `${trialDaysRemaining} day${trialDaysRemaining !== 1 ? "s" : ""} remaining in your trial`
                  : "Your trial has ended"}
              </Text>
            </View>
          )}

          {/* Expired warning */}
          {subscriptionStatus === "expired" && (
            <View style={{ backgroundColor: colors.error + "15", borderRadius: 10, padding: 12, marginBottom: 12, flexDirection: "row", alignItems: "center", gap: 10 }}>
              <IconSymbol name="exclamationmark.triangle.fill" size={18} color={colors.error} />
              <Text style={{ fontSize: 13, fontWeight: "600", color: colors.error, flex: 1 }}>
                Your subscription has expired. Upgrade to restore full access.
              </Text>
            </View>
          )}

          {/* Pricing */}
          {!isAdminOverride && planInfo.monthlyPrice > 0 && (
            <Text style={{ fontSize: 13, color: colors.muted, marginBottom: 12 }}>
              ${planInfo.monthlyPrice}/mo · ${planInfo.yearlyPrice}/yr
            </Text>
          )}
          {isAdminOverride && (
            <Text style={{ fontSize: 13, color: colors.muted, marginBottom: 12 }}>
              Complimentary access — no charge
            </Text>
          )}

          {/* Upgrade button */}
          {!isAdminOverride && (
            <Pressable
              onPress={() => router.push("/choose-plan" as any)}
              style={({ pressed }) => [styles.primaryBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 }]}
            >
              <IconSymbol name="arrow.up.right" size={16} color="#fff" />
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15, marginLeft: 6 }}>
                {subscriptionStatus === "expired" || planKey === "solo" ? "Upgrade Plan" : "Change Plan"}
              </Text>
            </Pressable>
          )}
        </View>

        {/* Usage Meters */}
        <Text style={styles.sectionLabel}>Usage</Text>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <UsageMeter label="Clients" current={usage.clients} max={limits.maxClients} color={colors.primary} />
          <UsageMeter label="Services" current={usage.services} max={limits.maxServices} color="#8B5CF6" />
          <UsageMeter label="Products" current={usage.products} max={limits.maxProducts} color="#3B82F6" />
          <UsageMeter label="Staff Members" current={usage.staff} max={limits.maxStaff} color="#F59E0B" />
          <UsageMeter label="Locations" current={usage.locations} max={limits.maxLocations} color="#EC4899" />
        </View>

        {/* Feature Summary */}
        <Text style={styles.sectionLabel}>Features</Text>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <FeatureRow
            label="SMS Automation"
            value={
              limits.smsLevel === "full"
                ? "Full (reminders, rebooking, birthday)"
                : limits.smsLevel === "confirmations"
                ? "Confirmations only"
                : "Not included"
            }
            included={limits.smsLevel !== "none"}
            colors={colors}
          />
          <FeatureRow
            label="Payment Methods"
            value={limits.paymentLevel === "full" ? "All payment methods" : "Basic (cash + P2P)"}
            included={true}
            colors={colors}
          />
          <FeatureRow
            label="Monthly Appointments"
            value={limits.maxAppointments === -1 ? "Unlimited" : `Up to ${limits.maxAppointments}`}
            included={true}
            colors={colors}
          />
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

function FeatureRow({
  label,
  value,
  included,
  colors,
}: {
  label: string;
  value: string;
  included: boolean;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }}>
      <IconSymbol
        name={included ? "checkmark.circle.fill" : "xmark.circle.fill"}
        size={18}
        color={included ? colors.success : colors.error}
      />
      <View style={{ flex: 1, marginLeft: 10 }}>
        <Text style={{ fontSize: 14, fontWeight: "600", color: colors.foreground }}>{label}</Text>
        <Text style={{ fontSize: 12, color: colors.muted, marginTop: 1 }}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 4,
    color: "#6B7280",
  },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 4,
  },
});
