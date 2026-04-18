/**
 * PlanCarousel
 * ─────────────────────────────────────────────────────────────────────────────
 * Vertical scrollable list of plan cards — modern, compact, no white box.
 *
 * Design:
 *  - Full-width cards with gradient accent strip on left + header
 *  - No white background box — transparent card with subtle border
 *  - Compact feature grid (2 columns)
 *  - Billing toggle at top
 *  - Compare all plans modal preserved
 */
import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Modal,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";

// ─── Types ────────────────────────────────────────────────────────────────────

export type PlanData = {
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

type PlanCarouselProps = {
  plans: PlanData[];
  isLoading?: boolean;
  isYearly: boolean;
  onToggleBilling: (yearly: boolean) => void;
  onSelectPlan: (planKey: string, period: "monthly" | "yearly") => void;
  loadingPlanKey?: string | null;
  currentPlanKey?: string | null;
  containerWidth?: number;
  /** When true (onboarding), show in onboarding context — no auto-scroll or pre-selection */
  isOnboarding?: boolean;
};

// ─── Plan Config ──────────────────────────────────────────────────────────────

const PLAN_GRADIENTS: Record<string, [string, string, string]> = {
  solo:       ["#6B7280", "#4B5563", "#374151"],
  growth:     ["#2563EB", "#1D4ED8", "#1E40AF"],
  studio:     ["#7C3AED", "#6D28D9", "#5B21B6"],
  enterprise: ["#D97706", "#B45309", "#92400E"],
};

const PLAN_EMOJIS: Record<string, string> = {
  solo:       "🌱",
  growth:     "🚀",
  studio:     "💎",
  enterprise: "🏢",
};

const PLAN_TAGLINES: Record<string, string> = {
  solo:       "Solo practitioners",
  growth:     "Growing businesses",
  studio:     "Established studios",
  enterprise: "Multi-location brands",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number) => (n === -1 || n >= 9999 ? "∞" : String(n));
const isIncluded = (n: number) => n !== 0;

// ─── Plan Card ────────────────────────────────────────────────────────────────

function PlanCard({
  plan,
  isYearly,
  onSelect,
  isLoading,
  isCurrentPlan,
  isHighlighted = false,
}: {
  plan: PlanData;
  isYearly: boolean;
  onSelect: () => void;
  isLoading: boolean;
  isCurrentPlan: boolean;
  isHighlighted?: boolean;
}) {
  const colors = useColors();
  const gradients = (PLAN_GRADIENTS[plan.planKey] ?? PLAN_GRADIENTS.solo) as [string, string, string];
  const emoji = PLAN_EMOJIS[plan.planKey] ?? "✨";
  const tagline = PLAN_TAGLINES[plan.planKey] ?? "";
  const isPopular = plan.planKey === "growth";
  const isFree = plan.monthlyPrice === 0;
  const price = isYearly ? Math.round(plan.yearlyPrice / 12) : plan.monthlyPrice;
  const savings =
    isYearly && !isFree && plan.monthlyPrice > 0
      ? Math.round(((plan.monthlyPrice * 12 - plan.yearlyPrice) / (plan.monthlyPrice * 12)) * 100)
      : 0;
  const accent = gradients[0];

  const featureGrid: { label: string; value: string; included: boolean }[] = [
    { label: "Clients",      value: fmt(plan.maxClients),      included: isIncluded(plan.maxClients) },
    { label: "Services",     value: fmt(plan.maxServices),     included: isIncluded(plan.maxServices) },
    { label: "Staff",        value: fmt(plan.maxStaff),        included: isIncluded(plan.maxStaff) },
    { label: "Locations",    value: fmt(plan.maxLocations),    included: isIncluded(plan.maxLocations) },
    { label: "Products",     value: fmt(plan.maxProducts),     included: isIncluded(plan.maxProducts) },
    {
      label: "SMS",
      value: plan.smsLevel === "full" ? "Full" : plan.smsLevel === "confirmations" ? "Confirm" : "None",
      included: plan.smsLevel !== "none" && plan.smsLevel !== "",
    },
    { label: "Appts",        value: fmt(plan.maxAppointments), included: isIncluded(plan.maxAppointments) },
    {
      label: "Payments",
      value: plan.paymentLevel === "full" ? "Full" : plan.paymentLevel === "basic" ? "Basic" : "None",
      included: plan.paymentLevel !== "none" && plan.paymentLevel !== "",
    },
  ];

  return (
    <View style={[
      styles.card,
      { borderColor: accent, borderWidth: 2 },
    ]}>
      {/* ── Gradient accent strip on left ── */}
      <LinearGradient
        colors={gradients}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.accentStrip}
      />

      {/* ── Card content ── */}
      <View style={styles.cardContent}>
        {/* Header row: emoji + name/tagline + price */}
        <View style={styles.headerRow}>
          {/* Left: emoji + name */}
          <View style={styles.headerLeft}>
            <View style={styles.headerTopRow}>
              <Text style={styles.planEmoji}>{emoji}</Text>
              <Text style={[styles.planName, { color: accent }]}>{plan.displayName}</Text>
              {isPopular && (
                <View style={[styles.badge, { backgroundColor: accent, borderColor: accent }]}>
                  <Text style={[styles.badgeText, { color: "#fff" }]}>⭐ MOST POPULAR</Text>
                </View>
              )}
              {isCurrentPlan && (
                <View style={[styles.badge, { backgroundColor: "#22C55E22", borderColor: "#22C55E44" }]}>
                  <Text style={[styles.badgeText, { color: "#22C55E" }]}>✓ ACTIVE</Text>
                </View>
              )}
            </View>
            <Text style={[styles.planTagline, { color: colors.muted }]}>{tagline}</Text>
          </View>

          {/* Right: price */}
          <View style={styles.priceBlock}>
            {isFree ? (
              <Text style={[styles.priceMain, { color: accent }]}>Free</Text>
            ) : (
              <View style={styles.priceRow}>
                <Text style={[styles.priceCurrency, { color: accent }]}>$</Text>
                <Text style={[styles.priceMain, { color: accent }]}>{price}</Text>
              </View>
            )}
            {isFree ? (
              <Text style={[styles.priceNote, { color: colors.muted }]}>forever</Text>
            ) : isYearly && savings > 0 ? (
              <Text style={[styles.priceNote, { color: "#22C55E" }]}>−{savings}%/yr</Text>
            ) : (
              <Text style={[styles.priceNote, { color: colors.muted }]}>/mo</Text>
            )}
          </View>
        </View>

        {/* Divider */}
        <View style={[styles.divider, { backgroundColor: accent + "22" }]} />

        {/* Feature grid (2 columns) */}
        <View style={styles.featureGrid}>
          {featureGrid.map((f) => (
            <View key={f.label} style={styles.featureCell}>
              <Text style={[styles.featureCellValue, { color: f.included ? accent : colors.muted }]}>
                {f.value}
              </Text>
              <Text style={[styles.featureCellLabel, { color: colors.muted }]}>{f.label}</Text>
            </View>
          ))}
        </View>

        {/* CTA */}
        <Pressable
          onPress={onSelect}
          disabled={isLoading || isCurrentPlan}
          style={({ pressed }) => [
            styles.cta,
            {
              backgroundColor: isCurrentPlan ? colors.border : accent,
              opacity: pressed || isLoading ? 0.8 : 1,
              transform: [{ scale: pressed ? 0.98 : 1 }],
            },
          ]}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={[styles.ctaText, { color: isCurrentPlan ? colors.muted : "#fff" }]}>
              {isCurrentPlan ? "Current Plan" : isFree ? "Start Free" : "Select Plan"}
            </Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function PlanCarousel({
  plans,
  isLoading = false,
  isYearly,
  onToggleBilling,
  onSelectPlan,
  loadingPlanKey,
  currentPlanKey,
  isOnboarding = false,
}: PlanCarouselProps) {
  const colors = useColors();
  const [showCompare, setShowCompare] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  // When used in onboarding, always reset scroll to top so Solo plan is visible first
  useEffect(() => {
    if (isOnboarding && scrollRef.current) {
      scrollRef.current.scrollTo({ y: 0, animated: false });
    }
  }, [isOnboarding]);

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#2563EB" size="large" />
        <Text style={[styles.loadingText, { color: colors.muted }]}>Loading plans…</Text>
      </View>
    );
  }

  if (!plans || plans.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={[styles.loadingText, { color: colors.muted }]}>No plans available.</Text>
      </View>
    );
  }

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.container}
      showsVerticalScrollIndicator={false}
      nestedScrollEnabled
    >
      {/* ── Billing Toggle ── */}
      <View
        style={[
          styles.toggleWrap,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <Pressable
          onPress={() => onToggleBilling(false)}
          style={[styles.toggleBtn, !isYearly && { backgroundColor: "#2563EB" }]}
        >
          <Text style={[styles.toggleText, { color: isYearly ? colors.muted : "#fff" }]}>
            Monthly
          </Text>
        </Pressable>
        <Pressable
          onPress={() => onToggleBilling(true)}
          style={[styles.toggleBtn, isYearly && { backgroundColor: "#2563EB" }]}
        >
          <Text style={[styles.toggleText, { color: !isYearly ? colors.muted : "#fff" }]}>
            Yearly
          </Text>
          <View style={styles.savePill}>
            <Text style={styles.savePillText}>SAVE</Text>
          </View>
        </Pressable>
      </View>

      {/* ── Vertical plan list ── */}
      {plans.map((plan) => (
        <View key={plan.planKey} style={{ marginBottom: 14 }}>
          <PlanCard
            plan={plan}
            isYearly={isYearly}
            onSelect={() => onSelectPlan(plan.planKey, isYearly ? "yearly" : "monthly")}
            isLoading={loadingPlanKey === plan.planKey}
            isCurrentPlan={currentPlanKey === plan.planKey}
            isHighlighted={false}
          />
        </View>
      ))}

      {/* Compare all plans link */}
      <Pressable
        onPress={() => setShowCompare(true)}
        style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, alignSelf: "center", marginTop: 4, marginBottom: 8, padding: 6 })}
      >
        <Text style={{ fontSize: 13, color: "#2563EB", fontWeight: "600", textDecorationLine: "underline" }}>
          Compare all plans
        </Text>
      </Pressable>

      {/* ── Plan Comparison Modal ── */}
      <Modal
        visible={showCompare}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowCompare(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
          <View style={[styles.compareHeader, { borderBottomColor: colors.border }]}>
            <Text style={{ fontSize: 18, fontWeight: "700", color: colors.foreground }}>Compare Plans</Text>
            <Pressable
              onPress={() => setShowCompare(false)}
              style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, padding: 6 })}
            >
              <Text style={{ fontSize: 15, fontWeight: "600", color: "#2563EB" }}>Done</Text>
            </Pressable>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
          >
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={{ flexDirection: "row" }}>
                <View style={[styles.compareCell, styles.compareLabelCol, { backgroundColor: colors.background }]}>
                  <Text style={{ fontSize: 12, fontWeight: "700", color: colors.muted }}>FEATURE</Text>
                </View>
                {COMPARE_PLANS.map((p) => (
                  <View key={p.planKey} style={[styles.compareCell, styles.comparePlanCol, { backgroundColor: p.color + "18" }]}>
                    <View style={[styles.comparePlanDot, { backgroundColor: p.color }]} />
                    <Text style={{ fontSize: 13, fontWeight: "700", color: p.color }} numberOfLines={1}>{p.displayName}</Text>
                    <Text style={{ fontSize: 11, color: colors.muted, marginTop: 1 }}>
                      {p.monthlyPrice === 0 ? "Free" : `$${p.monthlyPrice}/mo`}
                    </Text>
                  </View>
                ))}
              </View>

              {COMPARE_FEATURE_ROWS.map((row, ri) => (
                <View key={row} style={{ flexDirection: "row", backgroundColor: ri % 2 === 0 ? colors.surface : colors.background }}>
                  <View style={[styles.compareCell, styles.compareLabelCol]}>
                    <Text style={{ fontSize: 12, color: colors.foreground, fontWeight: "500" }}>{row}</Text>
                  </View>
                  {COMPARE_PLANS.map((p) => {
                    const feat = p.features.find((f) => f.label === row);
                    const isDim = (feat as any)?.dim;
                    return (
                      <View key={p.planKey} style={[styles.compareCell, styles.comparePlanCol, { backgroundColor: ri % 2 === 0 ? p.color + "08" : "transparent" }]}>
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
    </ScrollView>
  );
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
      { label: "Payment Methods", value: "All + Stripe" },
      { label: "Online Booking", value: "Included" },
      { label: "Analytics", value: "Full + Multi-loc" },
    ],
  },
];

const COMPARE_FEATURE_ROWS = [
  "Clients", "Services", "Staff Members", "Products", "Locations",
  "Monthly Appointments", "SMS Automation", "Payment Methods", "Online Booking", "Analytics",
];

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    width: "100%",
    gap: 10,
  },
  center: {
    alignItems: "center",
    paddingVertical: 40,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
  },

  // Billing toggle
  toggleWrap: {
    flexDirection: "row",
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 3,
    marginBottom: 4,
    alignSelf: "center",
  },
  toggleBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 7,
    borderRadius: 10,
    gap: 5,
  },
  toggleText: {
    fontSize: 13,
    fontWeight: "600",
  },
  savePill: {
    backgroundColor: "#22C55E",
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  savePillText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: 0.5,
  },

  // Card — no background, just border + accent strip
  cardPopular: {
    borderWidth: 2,
    shadowColor: "#2563EB",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
  card: {
    flexDirection: "row",
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
  },
  accentStrip: {
    width: 4,
    flexShrink: 0,
  },
  cardContent: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },

  // Header row
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  headerLeft: {
    flex: 1,
    gap: 2,
  },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  planEmoji: {
    fontSize: 18,
  },
  planName: {
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  planTagline: {
    fontSize: 11,
    marginLeft: 24,
  },
  badge: {
    borderRadius: 20,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 0.5,
  },

  // Price block
  priceBlock: {
    alignItems: "flex-end",
    flexShrink: 0,
    marginLeft: 8,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 1,
  },
  priceCurrency: {
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 3,
  },
  priceMain: {
    fontSize: 28,
    fontWeight: "800",
    lineHeight: 32,
  },
  priceNote: {
    fontSize: 10,
    fontWeight: "600",
    marginTop: 1,
  },

  // Divider
  divider: {
    height: 1,
    marginBottom: 8,
  },

  // Feature grid (4 columns × 2 rows)
  featureGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 10,
    gap: 0,
  },
  featureCell: {
    width: "25%",
    alignItems: "center",
    paddingVertical: 5,
  },
  featureCellValue: {
    fontSize: 13,
    fontWeight: "700",
  },
  featureCellLabel: {
    fontSize: 9,
    fontWeight: "500",
    marginTop: 1,
    textAlign: "center",
  },

  // CTA
  cta: {
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  ctaText: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.2,
  },

  // Comparison modal
  compareHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  compareCell: {
    paddingVertical: 10,
    paddingHorizontal: 10,
    justifyContent: "center",
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(0,0,0,0.06)",
    minHeight: 44,
  },
  compareLabelCol: {
    width: 130,
    alignItems: "flex-start",
  },
  comparePlanCol: {
    width: 100,
  },
  comparePlanDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginBottom: 3,
  },
});
