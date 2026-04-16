/**
 * PlanCarousel
 * ─────────────────────────────────────────────────────────────────────────────
 * Horizontal swipeable carousel — one plan per card.
 *
 * Layout:
 *  - Cards are 82% of screen width so prev/next card peeks in
 *  - Gap between cards so they are visually separated
 *  - Snap-to-center: each swipe stops exactly on the next card
 *  - Pre-selects Growth plan (index 1) on mount
 *  - Billing toggle sits above the carousel
 */
import React, { useRef, useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  useWindowDimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  interpolate,
  Extrapolation,
} from "react-native-reanimated";
import type { SharedValue } from "react-native-reanimated";
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
};

// ─── Plan Config ──────────────────────────────────────────────────────────────

const PLAN_GRADIENTS: Record<string, [string, string, string]> = {
  solo:       ["#4B5563", "#374151", "#1F2937"],
  growth:     ["#2563EB", "#1D4ED8", "#1E40AF"],
  studio:     ["#7C3AED", "#6D28D9", "#5B21B6"],
  enterprise: ["#D97706", "#B45309", "#92400E"],
};

const PLAN_ICONS: Record<string, "person.fill" | "person.2.fill" | "person.3.fill" | "building.2.fill"> = {
  solo:       "person.fill",
  growth:     "person.2.fill",
  studio:     "person.3.fill",
  enterprise: "building.2.fill",
};

const PLAN_TAGLINES: Record<string, string> = {
  solo:       "Solo practitioners",
  growth:     "Growing businesses",
  studio:     "Established studios",
  enterprise: "Multi-location brands",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number) => (n === -1 || n >= 9999 ? "Unlimited" : String(n));
const isIncluded = (n: number) => n !== 0;

// ─── Pagination Dot ───────────────────────────────────────────────────────────

function PaginationDot({
  index,
  scrollX,
  itemWidth,
  color,
}: {
  index: number;
  scrollX: SharedValue<number>;
  itemWidth: number;
  color: string;
}) {
  const animStyle = useAnimatedStyle(() => {
    const inputRange = [(index - 1) * itemWidth, index * itemWidth, (index + 1) * itemWidth];
    const width = interpolate(scrollX.value, inputRange, [6, 20, 6], Extrapolation.CLAMP);
    const opacity = interpolate(scrollX.value, inputRange, [0.3, 1, 0.3], Extrapolation.CLAMP);
    return { width, opacity };
  });
  return <Animated.View style={[styles.dot, { backgroundColor: color }, animStyle]} />;
}

// ─── Plan Card ────────────────────────────────────────────────────────────────

function PlanCard({
  plan,
  isYearly,
  cardWidth,
  onSelect,
  isLoading,
  isCurrentPlan,
}: {
  plan: PlanData;
  isYearly: boolean;
  cardWidth: number;
  onSelect: () => void;
  isLoading: boolean;
  isCurrentPlan: boolean;
}) {
  const colors = useColors();
  const gradients = (PLAN_GRADIENTS[plan.planKey] ?? PLAN_GRADIENTS.solo) as [string, string, string];
  const icon = PLAN_ICONS[plan.planKey] ?? "person.fill";
  const tagline = PLAN_TAGLINES[plan.planKey] ?? "";
  const isPopular = plan.planKey === "growth";
  const isFree = plan.monthlyPrice === 0;
  const price = isYearly ? Math.round(plan.yearlyPrice / 12) : plan.monthlyPrice;
  const savings =
    isYearly && !isFree && plan.monthlyPrice > 0
      ? Math.round(((plan.monthlyPrice * 12 - plan.yearlyPrice) / (plan.monthlyPrice * 12)) * 100)
      : 0;
  const accent = gradients[0];

  const features: { label: string; value: string; included: boolean }[] = [
    { label: "Clients",         value: fmt(plan.maxClients),      included: isIncluded(plan.maxClients) },
    { label: "Services",        value: fmt(plan.maxServices),     included: isIncluded(plan.maxServices) },
    { label: "Staff members",   value: fmt(plan.maxStaff),        included: isIncluded(plan.maxStaff) },
    { label: "Locations",       value: fmt(plan.maxLocations),    included: isIncluded(plan.maxLocations) },
    { label: "Products",        value: fmt(plan.maxProducts),     included: isIncluded(plan.maxProducts) },
    {
      label: "SMS automation",
      value:
        plan.smsLevel === "full"
          ? "Full"
          : plan.smsLevel === "confirmations"
          ? "Confirmations"
          : "None",
      included: plan.smsLevel !== "none" && plan.smsLevel !== "",
    },
    { label: "Appointments",    value: fmt(plan.maxAppointments), included: isIncluded(plan.maxAppointments) },
    {
      label: "Online payments",
      value:
        plan.paymentLevel === "full"
          ? "Full"
          : plan.paymentLevel === "basic"
          ? "Basic"
          : "None",
      included: plan.paymentLevel !== "none" && plan.paymentLevel !== "",
    },
  ];

  return (
    // cardWidth is the visual card width; the outer View matches it exactly
    <View style={{ width: cardWidth }}>
      <View style={[styles.card, { backgroundColor: colors.surface }]}>

        {/* ── Gradient Header ── */}
        <LinearGradient
          colors={gradients}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          {/* Badge row */}
          <View style={styles.badgeRow}>
            {isPopular && (
              <View style={styles.badge}>
                <IconSymbol name="star.fill" size={9} color="#FCD34D" />
                <Text style={styles.badgeText}>MOST POPULAR</Text>
              </View>
            )}
            {isCurrentPlan && (
              <View style={[styles.badge, { backgroundColor: "rgba(255,255,255,0.22)" }]}>
                <IconSymbol name="checkmark.circle.fill" size={9} color="#fff" />
                <Text style={[styles.badgeText, { color: "#fff" }]}>CURRENT</Text>
              </View>
            )}
          </View>

          {/* Icon */}
          <View style={styles.iconWrap}>
            <IconSymbol name={icon} size={26} color="#fff" />
          </View>

          {/* Name + tagline */}
          <Text style={styles.planName}>{plan.displayName}</Text>
          <Text style={styles.planTagline}>{tagline}</Text>

          {/* Price */}
          <View style={styles.priceRow}>
            {isFree ? (
              <Text style={styles.priceMain}>Free</Text>
            ) : (
              <>
                <Text style={styles.priceCurrency}>$</Text>
                <Text style={styles.priceMain}>{price}</Text>
                <Text style={styles.pricePer}>/mo</Text>
              </>
            )}
          </View>

          {/* Sub-label */}
          {isFree ? (
            <Text style={styles.priceNote}>Free forever · No card needed</Text>
          ) : isYearly && savings > 0 ? (
            <View style={styles.savingsBadge}>
              <Text style={styles.savingsText}>
                Save {savings}% · ${plan.yearlyPrice}/yr
              </Text>
            </View>
          ) : (
            <Text style={styles.priceNote}>billed monthly</Text>
          )}
        </LinearGradient>

        {/* ── Feature Rows ── */}
        <View style={styles.featureList}>
          {features.map((f) => (
            <View key={f.label} style={styles.featureRow}>
              {/* Check/X icon */}
              <View
                style={[
                  styles.featureIconWrap,
                  { backgroundColor: f.included ? accent + "1A" : colors.border + "44" },
                ]}
              >
                <IconSymbol
                  name={f.included ? "checkmark.circle.fill" : "xmark.circle.fill"}
                  size={14}
                  color={f.included ? accent : colors.muted}
                />
              </View>
              {/* Label — left side, takes remaining space */}
              <Text
                style={[styles.featureLabel, { color: colors.foreground }]}
                numberOfLines={1}
              >
                {f.label}
              </Text>
              {/* Value — right side, fixed width */}
              <Text
                style={[styles.featureValue, { color: f.included ? accent : colors.muted }]}
                numberOfLines={1}
              >
                {f.value}
              </Text>
            </View>
          ))}
        </View>

        {/* ── CTA ── */}
        <Pressable
          onPress={onSelect}
          disabled={isLoading || isCurrentPlan}
          style={({ pressed }) => [
            styles.cta,
            {
              backgroundColor: isCurrentPlan
                ? colors.border
                : isFree
                ? "#E5E7EB"
                : accent,
              opacity: pressed || isLoading ? 0.8 : 1,
              transform: [{ scale: pressed ? 0.98 : 1 }],
            },
          ]}
        >
          {isLoading ? (
            <ActivityIndicator color={isFree ? "#374151" : "#fff"} size="small" />
          ) : (
            <Text
              style={[
                styles.ctaText,
                { color: isCurrentPlan ? colors.muted : isFree ? "#374151" : "#fff" },
              ]}
            >
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
}: PlanCarouselProps) {
  const colors = useColors();
  const { width: screenWidth } = useWindowDimensions();

  // Card is 82% of screen width — prev/next card peeks in on both sides
  const CARD_WIDTH = Math.round(screenWidth * 0.82);
  // Gap between cards (visual separation)
  const CARD_GAP = 12;
  // Each list item = card + gap
  const ITEM_STRIDE = CARD_WIDTH + CARD_GAP;
  // Inset so the first card is centered on screen
  const SIDE_INSET = Math.round((screenWidth - CARD_WIDTH) / 2);

  const scrollX = useSharedValue(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  // Pre-select Growth plan (index 1) after layout settles
  useEffect(() => {
    if (!plans || plans.length < 2) return;
    const growthIdx = plans.findIndex((p) => p.planKey === "growth");
    const targetIdx = growthIdx >= 0 ? growthIdx : 1;
    const timer = setTimeout(() => {
      flatListRef.current?.scrollToOffset({
        offset: targetIdx * ITEM_STRIDE,
        animated: false,
      });
      setActiveIndex(targetIdx);
      scrollX.value = targetIdx * ITEM_STRIDE;
    }, 120);
    return () => clearTimeout(timer);
  }, [plans.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      scrollX.value = e.nativeEvent.contentOffset.x;
      const idx = Math.round(e.nativeEvent.contentOffset.x / ITEM_STRIDE);
      setActiveIndex(Math.max(0, Math.min(idx, plans.length - 1)));
    },
    [ITEM_STRIDE, plans.length, scrollX]
  );

  const goTo = useCallback(
    (idx: number) => {
      flatListRef.current?.scrollToOffset({ offset: idx * ITEM_STRIDE, animated: true });
      setActiveIndex(idx);
    },
    [ITEM_STRIDE]
  );

  const activePlan = plans[activeIndex];
  const activeColor = activePlan
    ? (PLAN_GRADIENTS[activePlan.planKey]?.[0] ?? "#2563EB")
    : "#2563EB";

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
    <View style={styles.container}>

      {/* ── Billing Toggle ── */}
      <View
        style={[
          styles.toggleWrap,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <Pressable
          onPress={() => onToggleBilling(false)}
          style={[styles.toggleBtn, !isYearly && { backgroundColor: activeColor }]}
        >
          <Text style={[styles.toggleText, { color: isYearly ? colors.muted : "#fff" }]}>
            Monthly
          </Text>
        </Pressable>
        <Pressable
          onPress={() => onToggleBilling(true)}
          style={[styles.toggleBtn, isYearly && { backgroundColor: activeColor }]}
        >
          <Text style={[styles.toggleText, { color: !isYearly ? colors.muted : "#fff" }]}>
            Yearly
          </Text>
          <View style={styles.savePill}>
            <Text style={styles.savePillText}>SAVE</Text>
          </View>
        </Pressable>
      </View>

      {/* ── Carousel ── */}
      <FlatList
        ref={flatListRef}
        data={plans}
        keyExtractor={(item) => item.planKey}
        horizontal
        showsHorizontalScrollIndicator={false}
        // Snap every ITEM_STRIDE pixels so each swipe lands on the next card
        snapToInterval={ITEM_STRIDE}
        snapToAlignment="start"
        decelerationRate="fast"
        // Side insets center the active card
        contentInset={{ left: SIDE_INSET, right: SIDE_INSET }}
        contentOffset={{ x: -SIDE_INSET, y: 0 }}
        contentContainerStyle={{ paddingHorizontal: SIDE_INSET }}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        getItemLayout={(_, index) => ({
          length: ITEM_STRIDE,
          offset: ITEM_STRIDE * index,
          index,
        })}
        renderItem={({ item, index }) => (
          <View style={{ marginRight: index < plans.length - 1 ? CARD_GAP : 0 }}>
            <PlanCard
              plan={item}
              isYearly={isYearly}
              cardWidth={CARD_WIDTH}
              onSelect={() => onSelectPlan(item.planKey, isYearly ? "yearly" : "monthly")}
              isLoading={loadingPlanKey === item.planKey}
              isCurrentPlan={currentPlanKey === item.planKey}
            />
          </View>
        )}
      />

      {/* ── Pagination Dots ── */}
      <View style={styles.pagination}>
        {plans.map((_, i) => (
          <Pressable key={i} onPress={() => goTo(i)} hitSlop={10}>
            <PaginationDot
              index={i}
              scrollX={scrollX}
              itemWidth={ITEM_STRIDE}
              color={activeColor}
            />
          </Pressable>
        ))}
      </View>

      <Text style={[styles.hint, { color: colors.muted }]}>
        {activeIndex + 1} of {plans.length} · swipe to compare
      </Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: "100%",
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
    marginBottom: 16,
    alignSelf: "center",
  },
  toggleBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 8,
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

  // Card
  card: {
    borderRadius: 18,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 6,
  },

  // Header
  header: {
    paddingTop: 12,
    paddingBottom: 16,
    paddingHorizontal: 14,
    alignItems: "center",
  },
  badgeRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    width: "100%",
    minHeight: 20,
    marginBottom: 4,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.25)",
    borderRadius: 20,
    paddingHorizontal: 7,
    paddingVertical: 2,
    gap: 3,
  },
  badgeText: {
    fontSize: 8,
    fontWeight: "800",
    color: "#FCD34D",
    letterSpacing: 0.8,
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 7,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.25)",
  },
  planName: {
    fontSize: 20,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: -0.3,
  },
  planTagline: {
    fontSize: 11,
    color: "rgba(255,255,255,0.7)",
    marginTop: 1,
    marginBottom: 8,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 1,
  },
  priceCurrency: {
    fontSize: 16,
    fontWeight: "700",
    color: "rgba(255,255,255,0.88)",
    marginBottom: 4,
  },
  priceMain: {
    fontSize: 38,
    fontWeight: "800",
    color: "#fff",
    lineHeight: 44,
  },
  pricePer: {
    fontSize: 14,
    color: "rgba(255,255,255,0.7)",
    marginBottom: 5,
  },
  priceNote: {
    fontSize: 11,
    color: "rgba(255,255,255,0.58)",
    marginTop: 3,
  },
  savingsBadge: {
    backgroundColor: "rgba(34,197,94,0.25)",
    borderRadius: 20,
    paddingHorizontal: 9,
    paddingVertical: 3,
    marginTop: 5,
    borderWidth: 1,
    borderColor: "rgba(34,197,94,0.4)",
  },
  savingsText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#86EFAC",
  },

  // Feature list
  featureList: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 4,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 5,
    gap: 7,
  },
  featureIconWrap: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  featureLabel: {
    fontSize: 12,
    flex: 1,
    flexShrink: 1,
  },
  featureValue: {
    fontSize: 11,
    fontWeight: "700",
    flexShrink: 0,
    minWidth: 64,
    textAlign: "right",
  },

  // CTA
  cta: {
    marginHorizontal: 12,
    marginTop: 6,
    marginBottom: 12,
    borderRadius: 11,
    paddingVertical: 12,
    alignItems: "center",
  },
  ctaText: {
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.2,
  },

  // Pagination
  pagination: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 5,
    marginTop: 12,
    marginBottom: 4,
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
  hint: {
    fontSize: 11,
    textAlign: "center",
    marginTop: 5,
    marginBottom: 2,
  },
});
