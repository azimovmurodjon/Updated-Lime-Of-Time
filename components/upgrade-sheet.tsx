/**
 * UpgradeSheet
 * ─────────────────────────────────────────────────────────────────────────────
 * A bottom-sheet modal that appears when a user taps a locked feature.
 * Shows a compact plan comparison table and a CTA to the Subscription screen.
 *
 * Usage:
 *   <UpgradeSheet
 *     visible={showUpgrade}
 *     onClose={() => setShowUpgrade(false)}
 *     featureName="Email Notifications"
 *     requiredPlan="growth"
 *   />
 */

import React from "react";
import {
  View,
  Text,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";

// ─── Types ────────────────────────────────────────────────────────────────────

export type UpgradeSheetProps = {
  visible: boolean;
  onClose: () => void;
  /** Human-readable name of the locked feature, e.g. "Email Notifications" */
  featureName: string;
  /** Minimum plan key required, e.g. "growth" | "studio" | "enterprise" */
  requiredPlan?: "growth" | "studio" | "enterprise";
};

// ─── Static plan comparison data ─────────────────────────────────────────────

const PLANS = [
  {
    key: "solo",
    name: "Solo",
    emoji: "🌱",
    accent: "#6B7280",
    price: "Free",
    features: {
      emailNotifications: false,
      smsConfirmations: false,
      smsAutomation: false,
      multiLocation: false,
      multiStaff: false,
      payments: "Basic",
    },
  },
  {
    key: "growth",
    name: "Growth",
    emoji: "🚀",
    accent: "#2563EB",
    price: "$29/mo",
    features: {
      emailNotifications: true,
      smsConfirmations: true,
      smsAutomation: false,
      multiLocation: false,
      multiStaff: true,
      payments: "Full",
    },
  },
  {
    key: "studio",
    name: "Studio",
    emoji: "💎",
    accent: "#7C3AED",
    price: "$79/mo",
    features: {
      emailNotifications: true,
      smsConfirmations: true,
      smsAutomation: true,
      multiLocation: true,
      multiStaff: true,
      payments: "Full",
    },
  },
  {
    key: "enterprise",
    name: "Enterprise",
    emoji: "🏢",
    accent: "#D97706",
    price: "$149/mo",
    features: {
      emailNotifications: true,
      smsConfirmations: true,
      smsAutomation: true,
      multiLocation: true,
      multiStaff: true,
      payments: "Full",
    },
  },
];

const FEATURE_ROWS: { key: keyof typeof PLANS[0]["features"]; label: string }[] = [
  { key: "emailNotifications", label: "Email Notifications" },
  { key: "smsConfirmations",   label: "SMS Confirmations" },
  { key: "smsAutomation",      label: "SMS Automation" },
  { key: "multiLocation",      label: "Multi-Location" },
  { key: "multiStaff",         label: "Multi-Staff" },
  { key: "payments",           label: "Payments" },
];

const PLAN_ORDER: Record<string, number> = {
  solo: 0,
  growth: 1,
  studio: 2,
  enterprise: 3,
};

// ─── Cell renderer ────────────────────────────────────────────────────────────

function Cell({ value, accent }: { value: boolean | string; accent: string }) {
  const colors = useColors();
  if (typeof value === "boolean") {
    return value ? (
      <IconSymbol name="checkmark.circle.fill" size={18} color={accent} />
    ) : (
      <IconSymbol name="xmark.circle" size={18} color={colors.border} />
    );
  }
  return (
    <Text style={{ fontSize: 11, fontWeight: "600", color: accent }}>{value}</Text>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function UpgradeSheet({
  visible,
  onClose,
  featureName,
  requiredPlan = "growth",
}: UpgradeSheetProps) {
  const colors = useColors();
  const router = useRouter();

  const requiredIdx = PLAN_ORDER[requiredPlan] ?? 1;
  const requiredPlanData = PLANS.find((p) => p.key === requiredPlan) ?? PLANS[1];

  const handleUpgrade = () => {
    onClose();
    router.push("/subscription");
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      {/* Backdrop */}
      <Pressable style={styles.backdrop} onPress={onClose} />

      {/* Sheet */}
      <View style={[styles.sheet, { backgroundColor: colors.background }]}>
        {/* Handle */}
        <View style={[styles.handle, { backgroundColor: colors.border }]} />

        {/* Header */}
        <View style={styles.header}>
          <View style={[styles.lockBadge, { backgroundColor: requiredPlanData.accent + "18" }]}>
            <IconSymbol name="lock.fill" size={20} color={requiredPlanData.accent} />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={[styles.title, { color: colors.foreground }]}>
              Upgrade to unlock
            </Text>
            <Text style={[styles.subtitle, { color: colors.muted }]}>
              <Text style={{ fontWeight: "700", color: requiredPlanData.accent }}>
                {featureName}
              </Text>
              {" "}requires the{" "}
              <Text style={{ fontWeight: "700", color: requiredPlanData.accent }}>
                {requiredPlanData.name}
              </Text>
              {" "}plan or above.
            </Text>
          </View>
          <Pressable
            onPress={onClose}
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, padding: 4 })}
          >
            <IconSymbol name="xmark.circle.fill" size={24} color={colors.muted} />
          </Pressable>
        </View>

        {/* Plan comparison table */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16 }}
          style={{ maxHeight: 260 }}
        >
          <View>
            {/* Column headers */}
            <View style={styles.tableRow}>
              <View style={styles.featureLabelCell} />
              {PLANS.map((plan) => {
                const isRequired = PLAN_ORDER[plan.key] >= requiredIdx;
                return (
                  <View
                    key={plan.key}
                    style={[
                      styles.planHeaderCell,
                      isRequired && { borderBottomWidth: 2, borderBottomColor: plan.accent },
                    ]}
                  >
                    <Text style={{ fontSize: 14 }}>{plan.emoji}</Text>
                    <Text
                      style={[
                        styles.planHeaderName,
                        { color: isRequired ? plan.accent : colors.muted },
                      ]}
                    >
                      {plan.name}
                    </Text>
                    <Text
                      style={[
                        styles.planHeaderPrice,
                        { color: isRequired ? colors.foreground : colors.muted },
                      ]}
                    >
                      {plan.price}
                    </Text>
                  </View>
                );
              })}
            </View>

            {/* Feature rows */}
            {FEATURE_ROWS.map((row, rowIdx) => (
              <View
                key={row.key}
                style={[
                  styles.tableRow,
                  { backgroundColor: rowIdx % 2 === 0 ? colors.surface + "80" : "transparent" },
                ]}
              >
                <View style={styles.featureLabelCell}>
                  <Text style={[styles.featureLabel, { color: colors.muted }]}>{row.label}</Text>
                </View>
                {PLANS.map((plan) => {
                  const isRequired = PLAN_ORDER[plan.key] >= requiredIdx;
                  return (
                    <View key={plan.key} style={styles.featureValueCell}>
                      <Cell
                        value={plan.features[row.key]}
                        accent={isRequired ? plan.accent : colors.border}
                      />
                    </View>
                  );
                })}
              </View>
            ))}
          </View>
        </ScrollView>

        {/* CTA */}
        <View style={styles.ctaArea}>
          <Pressable
            onPress={handleUpgrade}
            style={({ pressed }) => [
              styles.ctaButton,
              { backgroundColor: requiredPlanData.accent, opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <IconSymbol name="arrow.up.circle.fill" size={20} color="#fff" />
            <Text style={styles.ctaText}>View Plans & Upgrade</Text>
          </Pressable>
          <Pressable onPress={onClose} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, marginTop: 10 })}>
            <Text style={[styles.cancelText, { color: colors.muted }]}>Maybe later</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 32,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 20,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  lockBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 17,
    fontWeight: "700",
  },
  subtitle: {
    fontSize: 13,
    marginTop: 3,
    lineHeight: 18,
  },
  // Table
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 7,
    borderRadius: 6,
  },
  featureLabelCell: {
    width: 130,
    paddingRight: 8,
  },
  featureLabel: {
    fontSize: 12,
    fontWeight: "500",
  },
  planHeaderCell: {
    width: 72,
    alignItems: "center",
    paddingBottom: 6,
    marginBottom: 4,
  },
  planHeaderName: {
    fontSize: 12,
    fontWeight: "700",
    marginTop: 2,
  },
  planHeaderPrice: {
    fontSize: 10,
    marginTop: 1,
  },
  featureValueCell: {
    width: 72,
    alignItems: "center",
  },
  // CTA
  ctaArea: {
    paddingHorizontal: 16,
    paddingTop: 16,
    alignItems: "center",
  },
  ctaButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 14,
    width: "100%",
    justifyContent: "center",
  },
  ctaText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  cancelText: {
    fontSize: 14,
  },
});
