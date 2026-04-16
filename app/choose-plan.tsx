/**
 * Choose a Plan Screen
 * ─────────────────────────────────────────────────────────────────────────────
 * Shows all publicly-visible subscription plans so the business owner can
 * compare and select a plan. Actual payment is handled externally (Stripe
 * integration is a future phase); this screen shows plans and contact info.
 */
import { useState } from "react";
import { useRouter } from "expo-router";
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  Pressable,
  ActivityIndicator,
  Linking,
  Alert,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";

// ─── Plan Colors ──────────────────────────────────────────────────────────────

const PLAN_COLORS: Record<string, string> = {
  solo: "#6B7280",
  growth: "#3B82F6",
  studio: "#8B5CF6",
  enterprise: "#F59E0B",
};

const PLAN_ICONS: Record<string, "person.fill" | "person.2.fill" | "person.3.fill" | "building.2.fill"> = {
  solo: "person.fill",
  growth: "person.2.fill",
  studio: "person.3.fill",
  enterprise: "building.2.fill",
};

// ─── Feature Row ─────────────────────────────────────────────────────────────

function FeatureItem({ label, value, included, color }: { label: string; value: string; included: boolean; color: string }) {
  const colors = useColors();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", paddingVertical: 6 }}>
      <IconSymbol
        name={included ? "checkmark.circle.fill" : "xmark.circle.fill"}
        size={16}
        color={included ? colors.success : colors.border}
      />
      <Text style={{ fontSize: 13, color: colors.foreground, marginLeft: 8, flex: 1 }}>{label}</Text>
      <Text style={{ fontSize: 12, color: included ? color : colors.muted, fontWeight: "600" }}>{value}</Text>
    </View>
  );
}

// ─── Plan Card ────────────────────────────────────────────────────────────────

function PlanCard({
  plan,
  isYearly,
  isCurrentPlan,
  onSelect,
}: {
  plan: {
    planKey: string;
    displayName: string;
    monthlyPrice: number;
    yearlyPrice: number;
    maxClients: number;
    maxAppointments: number;
    maxLocations: number;
    maxStaff: number;
    maxServices: number;
    maxProducts: number;
    smsLevel: string;
    paymentLevel: string;
    sortOrder: number;
  };
  isYearly: boolean;
  isCurrentPlan: boolean;
  onSelect: () => void;
}) {
  const colors = useColors();
  const planColor = PLAN_COLORS[plan.planKey] ?? "#6B7280";
  const planIcon = PLAN_ICONS[plan.planKey] ?? "person.fill";
  const price = isYearly ? plan.yearlyPrice / 12 : plan.monthlyPrice;
  const isFree = plan.monthlyPrice === 0;
  const savings = isYearly && !isFree ? Math.round(((plan.monthlyPrice * 12 - plan.yearlyPrice) / (plan.monthlyPrice * 12)) * 100) : 0;

  const formatLimit = (n: number) => (n === -1 ? "Unlimited" : String(n));

  return (
    <View
      style={[
        styles.planCard,
        {
          backgroundColor: colors.surface,
          borderColor: isCurrentPlan ? planColor : colors.border,
          borderWidth: isCurrentPlan ? 2 : StyleSheet.hairlineWidth,
        },
      ]}
    >
      {/* Card Header */}
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
        <View style={{ backgroundColor: planColor + "20", borderRadius: 10, padding: 8, marginRight: 10 }}>
          <IconSymbol name={planIcon} size={20} color={planColor} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 17, fontWeight: "700", color: colors.foreground }}>{plan.displayName}</Text>
          {isFree ? (
            <Text style={{ fontSize: 13, color: colors.muted }}>Free forever</Text>
          ) : (
            <Text style={{ fontSize: 13, color: colors.muted }}>
              ${price.toFixed(0)}/mo{isYearly ? " (billed yearly)" : ""}
              {savings > 0 ? ` · Save ${savings}%` : ""}
            </Text>
          )}
        </View>
        {isCurrentPlan && (
          <View style={{ backgroundColor: planColor + "20", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 }}>
            <Text style={{ fontSize: 11, fontWeight: "700", color: planColor }}>Current</Text>
          </View>
        )}
      </View>

      {/* Features */}
      <View style={{ borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: 10 }}>
        <FeatureItem label="Clients" value={formatLimit(plan.maxClients)} included={true} color={planColor} />
        <FeatureItem label="Services" value={formatLimit(plan.maxServices)} included={true} color={planColor} />
        <FeatureItem label="Staff members" value={formatLimit(plan.maxStaff)} included={true} color={planColor} />
        <FeatureItem label="Locations" value={formatLimit(plan.maxLocations)} included={true} color={planColor} />
        <FeatureItem
          label="SMS automation"
          value={plan.smsLevel === "full" ? "Full" : plan.smsLevel === "confirmations" ? "Confirmations" : "None"}
          included={plan.smsLevel !== "none"}
          color={planColor}
        />
        <FeatureItem
          label="Monthly appointments"
          value={formatLimit(plan.maxAppointments)}
          included={true}
          color={planColor}
        />
      </View>

      {/* CTA */}
      {!isCurrentPlan && (
        <Pressable
          onPress={onSelect}
          style={({ pressed }) => [
            styles.selectBtn,
            { backgroundColor: planColor, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>
            {isFree ? "Downgrade to Free" : "Select Plan"}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ChoosePlanScreen() {
  const colors = useColors();
  const router = useRouter();
  const [isYearly, setIsYearly] = useState(false);

  const { data: plans, isLoading } = trpc.subscription.getPublicPlans.useQuery(undefined, {
    staleTime: 60_000,
  });

  const handleSelectPlan = (planKey: string, planName: string) => {
    Alert.alert(
      `Select ${planName}`,
      "To upgrade or change your plan, please contact us at support@lime-of-time.com or visit lime-of-time.com/pricing. Our team will activate your plan within 24 hours.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Email Us",
          onPress: () => Linking.openURL(`mailto:support@lime-of-time.com?subject=Plan Upgrade Request: ${planName}`),
        },
        {
          text: "Visit Website",
          onPress: () => Linking.openURL("https://lime-of-time.com/pricing"),
        },
      ]
    );
  };

  return (
    <ScreenContainer>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
        {/* Header */}
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, marginRight: 12 })}
          >
            <IconSymbol name="arrow.left" size={24} color={colors.foreground} />
          </Pressable>
          <Text style={{ fontSize: 22, fontWeight: "700", color: colors.foreground, flex: 1 }}>Choose a Plan</Text>
        </View>
        <Text style={{ fontSize: 14, color: colors.muted, marginBottom: 20 }}>
          Select the plan that fits your business. All plans include the core scheduling features.
        </Text>

        {/* Billing Toggle */}
        <View style={{ flexDirection: "row", backgroundColor: colors.surface, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, padding: 3, marginBottom: 20, alignSelf: "center" }}>
          <Pressable
            onPress={() => setIsYearly(false)}
            style={[styles.toggleBtn, !isYearly && { backgroundColor: colors.primary }]}
          >
            <Text style={{ fontSize: 13, fontWeight: "600", color: isYearly ? colors.muted : "#fff" }}>Monthly</Text>
          </Pressable>
          <Pressable
            onPress={() => setIsYearly(true)}
            style={[styles.toggleBtn, isYearly && { backgroundColor: colors.primary }]}
          >
            <Text style={{ fontSize: 13, fontWeight: "600", color: !isYearly ? colors.muted : "#fff" }}>Yearly</Text>
            <View style={{ backgroundColor: colors.success, borderRadius: 8, paddingHorizontal: 5, paddingVertical: 1, marginLeft: 4 }}>
              <Text style={{ fontSize: 10, fontWeight: "700", color: "#fff" }}>SAVE</Text>
            </View>
          </Pressable>
        </View>

        {/* Plans */}
        {isLoading ? (
          <View style={{ alignItems: "center", paddingVertical: 40 }}>
            <ActivityIndicator color={colors.primary} size="large" />
          </View>
        ) : !plans || plans.length === 0 ? (
          <View style={{ alignItems: "center", paddingVertical: 40 }}>
            <Text style={{ fontSize: 15, color: colors.muted, textAlign: "center" }}>
              No plans available at this time.{"\n"}Please check back later.
            </Text>
          </View>
        ) : (
          plans.map((plan) => (
            <PlanCard
              key={plan.planKey}
              plan={plan}
              isYearly={isYearly}
              isCurrentPlan={false}
              onSelect={() => handleSelectPlan(plan.planKey, plan.displayName)}
            />
          ))
        )}

        {/* Footer note */}
        <Text style={{ fontSize: 12, color: colors.muted, textAlign: "center", marginTop: 8 }}>
          Need a custom plan? Contact us at{" "}
          <Text
            style={{ color: colors.primary }}
            onPress={() => Linking.openURL("mailto:support@lime-of-time.com")}
          >
            support@lime-of-time.com
          </Text>
        </Text>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  planCard: {
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
  },
  selectBtn: {
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 14,
  },
  toggleBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 8,
  },
});
