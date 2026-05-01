import React from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";
import { formatPrice as _formatPrice } from "@/lib/utils";

/** Format price as $X.XX/mo or Free */
function formatPrice(n: number): string {
  return n === 0 ? "Free" : `${_formatPrice(n)}/mo`;
}

// ─── Comparison Data ──────────────────────────────────────────────────────────

const COMPARE_PLANS = [
  {
    planKey: "solo", displayName: "Solo", monthlyPrice: 0, color: "#6B7280",
    features: [
      { label: "Clients", value: "Up to 20" },
      { label: "Services", value: "Up to 5" },
      { label: "Staff Members", value: "1 (you)" },
      { label: "Products", value: "Up to 5" },
      { label: "Locations", value: "1" },
      { label: "Monthly Appointments", value: "Up to 50" },
      { label: "SMS Automation", value: "Not included", dim: true },
      { label: "Email Notifications", value: "Not included", dim: true },
      { label: "Payment Methods", value: "Cash & P2P" },
      { label: "Online Booking", value: "Included" },
      { label: "Analytics", value: "Basic" },
    ],
  },
  {
    planKey: "growth", displayName: "Growth", monthlyPrice: 19, color: "#3B82F6",
    features: [
      { label: "Clients", value: "Up to 100" },
      { label: "Services", value: "Up to 20" },
      { label: "Staff Members", value: "Up to 2" },
      { label: "Products", value: "Up to 20" },
      { label: "Locations", value: "1" },
      { label: "Monthly Appointments", value: "Unlimited" },
      { label: "SMS Automation", value: "Confirmations only" },
      { label: "Email Notifications", value: "Full" },
      { label: "Payment Methods", value: "Cash & P2P" },
      { label: "Online Booking", value: "Included" },
      { label: "Analytics", value: "Full" },
    ],
  },
  {
    planKey: "studio", displayName: "Studio", monthlyPrice: 39, color: "#8B5CF6",
    features: [
      { label: "Clients", value: "Unlimited" },
      { label: "Services", value: "Unlimited" },
      { label: "Staff Members", value: "Up to 10" },
      { label: "Products", value: "Unlimited" },
      { label: "Locations", value: "Up to 3" },
      { label: "Monthly Appointments", value: "Unlimited" },
      { label: "SMS Automation", value: "Full" },
      { label: "Email Notifications", value: "Full" },
      { label: "Payment Methods", value: "All + Stripe" },
      { label: "Online Booking", value: "Included" },
      { label: "Analytics", value: "Full + Staff" },
    ],
  },
  {
    planKey: "enterprise", displayName: "Enterprise", monthlyPrice: 69, color: "#F59E0B",
    features: [
      { label: "Clients", value: "Unlimited" },
      { label: "Services", value: "Unlimited" },
      { label: "Staff Members", value: "Up to 100" },
      { label: "Products", value: "Unlimited" },
      { label: "Locations", value: "Up to 10" },
      { label: "Monthly Appointments", value: "Unlimited" },
      { label: "SMS Automation", value: "Full" },
      { label: "Email Notifications", value: "Full" },
      { label: "Payment Methods", value: "All + Stripe" },
      { label: "Online Booking", value: "Included" },
      { label: "Analytics", value: "Full + Multi-loc" },
    ],
  },
];

const COMPARE_FEATURE_ROWS = [
  "Clients", "Services", "Staff Members", "Products", "Locations",
  "Monthly Appointments", "SMS Automation", "Email Notifications", "Payment Methods", "Online Booking", "Analytics",
];

// ─── Component ────────────────────────────────────────────────────────────────

interface PlanCompareModalProps {
  visible: boolean;
  onClose: () => void;
}

export function PlanCompareModal({ visible, onClose }: PlanCompareModalProps) {
  const colors = useColors();
  // Fetch live plan prices from server (admin-controlled)
  const { data: livePlans } = trpc.subscription.getPublicPlans.useQuery(undefined, { staleTime: 5 * 60 * 1000 });

  // Merge live prices into COMPARE_PLANS (keep feature rows from static data)
  const mergedPlans = COMPARE_PLANS.map((p) => {
    const live = livePlans?.find((lp) => lp.planKey === p.planKey);
    return {
      ...p,
      monthlyPrice: live?.effectiveMonthlyPrice ?? live?.monthlyPrice ?? p.monthlyPrice,
      discountLabel: live?.discountLabel ?? null,
      discountPercent: live?.discountPercent ?? 0,
    };
  });

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Text style={{ fontSize: 18, fontWeight: "700", color: colors.foreground }}>Compare Plans</Text>
          <Pressable
            onPress={onClose}
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, padding: 6 })}
          >
            <Text style={{ fontSize: 15, fontWeight: "600", color: "#2563EB" }}>Done</Text>
          </Pressable>
        </View>

        {/* Scrollable matrix */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
        >
          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Plan header row */}
            <View style={{ flexDirection: "row" }}>
              <View style={[styles.cell, styles.labelCol, { backgroundColor: colors.background }]}>
                <Text style={{ fontSize: 12, fontWeight: "700", color: colors.muted }}>FEATURE</Text>
              </View>
              {mergedPlans.map((p) => (
                <View key={p.planKey} style={[styles.cell, styles.planCol, { backgroundColor: p.color + "18" }]}>
                  <View style={[styles.dot, { backgroundColor: p.color }]} />
                  <Text style={{ fontSize: 13, fontWeight: "700", color: p.color }} numberOfLines={1}>{p.displayName}</Text>
                  <Text style={{ fontSize: 11, color: colors.muted, marginTop: 1 }}>
                    {formatPrice(p.monthlyPrice)}
                  </Text>
                  {p.discountPercent > 0 && (
                    <Text style={{ fontSize: 10, color: p.color, marginTop: 1 }} numberOfLines={1}>
                      {p.discountLabel ?? `${p.discountPercent}% off`}
                    </Text>
                  )}
                </View>
              ))}
            </View>

            {/* Feature rows */}
            {COMPARE_FEATURE_ROWS.map((row, ri) => (
              <View key={row} style={{ flexDirection: "row", backgroundColor: ri % 2 === 0 ? colors.surface : colors.background }}>
                <View style={[styles.cell, styles.labelCol]}>
                  <Text style={{ fontSize: 12, color: colors.foreground, fontWeight: "500" }}>{row}</Text>
                </View>
                {mergedPlans.map((p) => {
                  const feat = p.features.find((f) => f.label === row);
                  const isDim = (feat as any)?.dim;
                  return (
                    <View key={p.planKey} style={[styles.cell, styles.planCol, { backgroundColor: ri % 2 === 0 ? p.color + "08" : "transparent" }]}>
                      <Text style={{ fontSize: 12, color: isDim ? colors.muted : colors.foreground, textAlign: "center" }} numberOfLines={2}>
                        {feat?.value ?? "—"}
                      </Text>
                    </View>
                  );
                })}
              </View>
            ))}
          </ScrollView>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  cell: {
    padding: 10,
    justifyContent: "center",
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(0,0,0,0.06)",
  },
  labelCol: {
    width: 140,
    alignItems: "flex-start",
  },
  planCol: {
    width: 100,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginBottom: 3,
  },
});
