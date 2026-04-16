/**
 * PlanCarousel
 * ─────────────────────────────────────────────────────────────────────────────
 * A fully animated horizontal swipeable carousel that shows one plan per slide.
 * Features:
 *  - Native FlatList paging (swipe left/right)
 *  - Animated pagination dots (active dot expands)
 *  - Gradient header per plan with icon + price
 *  - Full feature list with check/x icons — no clipped text
 *  - Monthly/Yearly billing toggle
 *  - CTA button per slide
 *  - Pre-selects Growth plan (index 1) on mount
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
  Platform,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
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
  solo:       "Perfect for solo practitioners",
  growth:     "For growing businesses",
  studio:     "For established studios",
  enterprise: "For multi-location brands",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** -1 means unlimited in the DB */
const fmt = (n: number) => (n === -1 || n >= 9999 ? "Unlimited" : String(n));
/** A feature is "included" if it's not 0 and not "none" */
const isIncluded = (n: number) => n !== 0;

// ─── Feature Row ─────────────────────────────────────────────────────────────

function FeatureRow({
  label,
  value,
  included,
  accentColor,
}: {
  label: string;
  value: string;
  included: boolean;
  accentColor: string;
}) {
  const colors = useColors();
  return (
    <View style={styles.featureRow}>
      {/* Icon */}
      <View style={[
        styles.featureIcon,
        { backgroundColor: included ? accentColor + "22" : colors.border + "55" },
      ]}>
        <IconSymbol
          name={included ? "checkmark.circle.fill" : "xmark.circle.fill"}
          size={15}
          color={included ? accentColor : colors.muted}
        />
      </View>
      {/* Label — takes remaining space */}
      <Text
        style={[styles.featureLabel, { color: colors.foreground }]}
        numberOfLines={1}
      >
        {label}
      </Text>
      {/* Value — fixed right column, never clips */}
      {value ? (
        <Text
          style={[styles.featureValue, { color: included ? accentColor : colors.muted }]}
          numberOfLines={1}
        >
          {value}
        </Text>
      ) : null}
    </View>
  );
}

// ─── Pagination Dot ───────────────────────────────────────────────────────────

function PaginationDot({
  index,
  scrollX,
  cardWidth,
  color,
}: {
  index: number;
  scrollX: SharedValue<number>;
  cardWidth: number;
  color: string;
}) {
  const animStyle = useAnimatedStyle(() => {
    const inputRange = [(index - 1) * cardWidth, index * cardWidth, (index + 1) * cardWidth];
    const width = interpolate(scrollX.value, inputRange, [6, 22, 6], Extrapolation.CLAMP);
    const opacity = interpolate(scrollX.value, inputRange, [0.35, 1, 0.35], Extrapolation.CLAMP);
    return { width, opacity };
  });

  return (
    <Animated.View style={[styles.dot, { backgroundColor: color }, animStyle]} />
  );
}

// ─── Plan Slide ───────────────────────────────────────────────────────────────

function PlanSlide({
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
  const gradientColors = PLAN_GRADIENTS[plan.planKey] ?? ["#4B5563", "#374151", "#1F2937"];
  const planIcon = PLAN_ICONS[plan.planKey] ?? "person.fill";
  const tagline = PLAN_TAGLINES[plan.planKey] ?? "";
  const isPopular = plan.planKey === "growth";
  const isFree = plan.monthlyPrice === 0;
  const price = isYearly ? plan.yearlyPrice / 12 : plan.monthlyPrice;
  const savings = isYearly && !isFree && plan.monthlyPrice > 0
    ? Math.round(((plan.monthlyPrice * 12 - plan.yearlyPrice) / (plan.monthlyPrice * 12)) * 100)
    : 0;
  const accentColor = gradientColors[0];

  // Feature rows — value "" means no right-side label (e.g., unlimited appointments)
  const features: { label: string; value: string; included: boolean }[] = [
    {
      label: "Clients",
      value: fmt(plan.maxClients),
      included: isIncluded(plan.maxClients),
    },
    {
      label: "Services",
      value: fmt(plan.maxServices),
      included: isIncluded(plan.maxServices),
    },
    {
      label: "Staff members",
      value: fmt(plan.maxStaff),
      included: isIncluded(plan.maxStaff),
    },
    {
      label: "Locations",
      value: fmt(plan.maxLocations),
      included: isIncluded(plan.maxLocations),
    },
    {
      label: "Products",
      value: fmt(plan.maxProducts),
      included: isIncluded(plan.maxProducts),
    },
    {
      label: "SMS automation",
      value: plan.smsLevel === "full"
        ? "Full"
        : plan.smsLevel === "confirmations"
        ? "Confirmations"
        : "No",
      included: plan.smsLevel !== "none" && plan.smsLevel !== "",
    },
    {
      label: "Appointments",
      value: fmt(plan.maxAppointments),
      included: isIncluded(plan.maxAppointments),
    },
    {
      label: "Online payments",
      value: plan.paymentLevel === "full"
        ? "Full"
        : plan.paymentLevel === "basic"
        ? "Basic"
        : "No",
      included: plan.paymentLevel !== "none" && plan.paymentLevel !== "",
    },
  ];

  return (
    <View style={[styles.slide, { width: cardWidth }]}>
      <View style={[styles.card, { backgroundColor: colors.surface }]}>

        {/* ── Gradient Header ── */}
        <LinearGradient
          colors={gradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.cardHeader}
        >
          {/* Badge row */}
          <View style={styles.badgeRow}>
            {isPopular && (
              <View style={styles.popularBadge}>
                <IconSymbol name="star.fill" size={10} color="#FCD34D" />
                <Text style={styles.popularText}>MOST POPULAR</Text>
              </View>
            )}
            {isCurrentPlan && (
              <View style={[styles.popularBadge, { backgroundColor: "rgba(255,255,255,0.25)" }]}>
                <IconSymbol name="checkmark.circle.fill" size={10} color="#fff" />
                <Text style={styles.popularText}>CURRENT PLAN</Text>
              </View>
            )}
          </View>

          {/* Icon */}
          <View style={styles.planIconWrap}>
            <IconSymbol name={planIcon} size={30} color="#fff" />
          </View>

          {/* Plan name + tagline */}
          <Text style={styles.planName}>{plan.displayName}</Text>
          <Text style={styles.planTagline}>{tagline}</Text>

          {/* Price */}
          <View style={styles.priceRow}>
            {isFree ? (
              <Text style={styles.priceMain}>Free</Text>
            ) : (
              <>
                <Text style={styles.priceCurrency}>$</Text>
                <Text style={styles.priceMain}>{Math.round(price)}</Text>
                <Text style={styles.pricePer}>/mo</Text>
              </>
            )}
          </View>

          {/* Sub-label */}
          {isFree ? (
            <Text style={styles.billedNote}>Free forever · No credit card</Text>
          ) : isYearly && savings > 0 ? (
            <View style={styles.savingsBadge}>
              <Text style={styles.savingsText}>Save {savings}% · billed ${plan.yearlyPrice}/yr</Text>
            </View>
          ) : (
            <Text style={styles.billedNote}>billed monthly</Text>
          )}
        </LinearGradient>

        {/* ── Feature List ── */}
        <View style={styles.featureList}>
          {features.map((f) => (
            <FeatureRow
              key={f.label}
              label={f.label}
              value={f.value}
              included={f.included}
              accentColor={accentColor}
            />
          ))}
        </View>

        {/* ── CTA ── */}
        <Pressable
          onPress={onSelect}
          disabled={isLoading || isCurrentPlan}
          style={({ pressed }) => [
            styles.ctaBtn,
            {
              backgroundColor: isCurrentPlan
                ? colors.border
                : isFree
                ? "#E5E7EB"
                : accentColor,
              opacity: pressed || isLoading ? 0.8 : 1,
              transform: [{ scale: pressed ? 0.98 : 1 }],
            },
          ]}
        >
          {isLoading ? (
            <ActivityIndicator color={isFree ? "#374151" : "#fff"} size="small" />
          ) : (
            <Text style={[
              styles.ctaText,
              { color: isCurrentPlan ? colors.muted : isFree ? "#374151" : "#fff" },
            ]}>
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

  // Card takes full width minus side padding so it fills the screen cleanly
  const SIDE_PADDING = 20;
  const cardWidth = screenWidth - SIDE_PADDING * 2;

  const scrollX = useSharedValue(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  // Pre-select Growth plan (index 1) once plans are loaded
  useEffect(() => {
    if (plans && plans.length > 1) {
      const growthIdx = plans.findIndex((p) => p.planKey === "growth");
      const targetIdx = growthIdx >= 0 ? growthIdx : 1;
      // Small delay to let FlatList finish layout
      const timer = setTimeout(() => {
        flatListRef.current?.scrollToIndex({ index: targetIdx, animated: false });
        setActiveIndex(targetIdx);
        scrollX.value = targetIdx * cardWidth;
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [plans.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      scrollX.value = e.nativeEvent.contentOffset.x;
      const idx = Math.round(e.nativeEvent.contentOffset.x / cardWidth);
      setActiveIndex(Math.max(0, Math.min(idx, plans.length - 1)));
    },
    [cardWidth, plans.length, scrollX]
  );

  const goTo = useCallback((idx: number) => {
    flatListRef.current?.scrollToIndex({ index: idx, animated: true });
    setActiveIndex(idx);
  }, []);

  const activePlan = plans[activeIndex];
  const activeColor = activePlan
    ? (PLAN_GRADIENTS[activePlan.planKey]?.[0] ?? "#4A7C59")
    : "#4A7C59";

  if (isLoading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator color="#4A7C59" size="large" />
        <Text style={[styles.loadingText, { color: colors.muted }]}>Loading plans…</Text>
      </View>
    );
  }

  if (!plans || plans.length === 0) {
    return (
      <View style={styles.loadingWrap}>
        <Text style={[styles.loadingText, { color: colors.muted }]}>No plans available.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>

      {/* ── Billing Toggle ── */}
      <View style={[styles.billingToggle, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Pressable
          onPress={() => onToggleBilling(false)}
          style={[styles.toggleOption, !isYearly && { backgroundColor: activeColor }]}
        >
          <Text style={[styles.toggleText, { color: isYearly ? colors.muted : "#fff" }]}>Monthly</Text>
        </Pressable>
        <Pressable
          onPress={() => onToggleBilling(true)}
          style={[styles.toggleOption, isYearly && { backgroundColor: activeColor }]}
        >
          <Text style={[styles.toggleText, { color: !isYearly ? colors.muted : "#fff" }]}>Yearly</Text>
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
        pagingEnabled={false}
        showsHorizontalScrollIndicator={false}
        snapToInterval={cardWidth}
        snapToAlignment="start"
        decelerationRate="fast"
        contentContainerStyle={{ paddingHorizontal: SIDE_PADDING }}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        getItemLayout={(_, index) => ({
          length: cardWidth,
          offset: cardWidth * index,
          index,
        })}
        renderItem={({ item }) => (
          <PlanSlide
            plan={item}
            isYearly={isYearly}
            cardWidth={cardWidth}
            onSelect={() => onSelectPlan(item.planKey, isYearly ? "yearly" : "monthly")}
            isLoading={loadingPlanKey === item.planKey}
            isCurrentPlan={currentPlanKey === item.planKey}
          />
        )}
      />

      {/* ── Pagination Dots ── */}
      <View style={styles.pagination}>
        {plans.map((_, i) => (
          <Pressable key={i} onPress={() => goTo(i)} hitSlop={8}>
            <PaginationDot
              index={i}
              scrollX={scrollX}
              cardWidth={cardWidth}
              color={activeColor}
            />
          </Pressable>
        ))}
      </View>

      {/* ── Swipe Hint ── */}
      <Text style={[styles.swipeHint, { color: colors.muted }]}>
        Swipe to compare · {activeIndex + 1} of {plans.length}
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
  loadingWrap: {
    alignItems: "center",
    paddingVertical: 40,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
  },

  // Billing toggle
  billingToggle: {
    flexDirection: "row",
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 3,
    marginBottom: 14,
    marginHorizontal: 20,
    alignSelf: "center",
  },
  toggleOption: {
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

  // Slide + card
  slide: {
    paddingVertical: 2,
  },
  card: {
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 14,
    elevation: 7,
  },

  // Header
  cardHeader: {
    paddingTop: 14,
    paddingBottom: 18,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  badgeRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    width: "100%",
    marginBottom: 6,
    minHeight: 22,
  },
  popularBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.28)",
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
    gap: 4,
  },
  popularText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#FCD34D",
    letterSpacing: 0.8,
  },
  planIconWrap: {
    width: 58,
    height: 58,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.28)",
  },
  planName: {
    fontSize: 22,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: -0.3,
  },
  planTagline: {
    fontSize: 12,
    color: "rgba(255,255,255,0.72)",
    marginTop: 2,
    marginBottom: 10,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 1,
  },
  priceCurrency: {
    fontSize: 18,
    fontWeight: "700",
    color: "rgba(255,255,255,0.88)",
    marginBottom: 5,
  },
  priceMain: {
    fontSize: 44,
    fontWeight: "800",
    color: "#fff",
    lineHeight: 50,
  },
  pricePer: {
    fontSize: 16,
    color: "rgba(255,255,255,0.72)",
    marginBottom: 6,
  },
  savingsBadge: {
    backgroundColor: "rgba(34,197,94,0.28)",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginTop: 6,
    borderWidth: 1,
    borderColor: "rgba(34,197,94,0.45)",
  },
  savingsText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#86EFAC",
  },
  billedNote: {
    fontSize: 11,
    color: "rgba(255,255,255,0.6)",
    marginTop: 4,
  },

  // Feature list
  featureList: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 4,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    gap: 8,
  },
  featureIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  featureLabel: {
    fontSize: 13,
    flex: 1,
    flexShrink: 1,
  },
  featureValue: {
    fontSize: 12,
    fontWeight: "700",
    flexShrink: 0,
    minWidth: 70,
    textAlign: "right",
  },

  // CTA
  ctaBtn: {
    marginHorizontal: 14,
    marginTop: 8,
    marginBottom: 14,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  ctaText: {
    fontSize: 15,
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
  swipeHint: {
    fontSize: 11,
    textAlign: "center",
    marginTop: 6,
    marginBottom: 2,
  },
});
