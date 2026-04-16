/**
 * PlanCarousel
 * ─────────────────────────────────────────────────────────────────────────────
 * A fully animated horizontal swipeable carousel that shows one plan per slide.
 * Features:
 *  - Native FlatList paging (swipe left/right)
 *  - Animated pagination dots (active dot expands)
 *  - Gradient header per plan with icon + price
 *  - Full feature list with check/x icons
 *  - Monthly/Yearly billing toggle
 *  - CTA button per slide
 */
import React, { useRef, useState, useCallback } from "react";
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

const PLAN_POPULAR: Record<string, boolean> = {
  solo:       false,
  growth:     true,
  studio:     false,
  enterprise: false,
};

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
      <View style={[styles.featureIcon, { backgroundColor: included ? accentColor + "20" : colors.border + "40" }]}>
        <IconSymbol
          name={included ? "checkmark.circle.fill" : "xmark.circle.fill"}
          size={14}
          color={included ? accentColor : colors.muted}
        />
      </View>
      <Text style={[styles.featureLabel, { color: colors.foreground }]}>{label}</Text>
      <Text style={[styles.featureValue, { color: included ? accentColor : colors.muted }]}>{value}</Text>
    </View>
  );
}

// ─── Pagination Dot ───────────────────────────────────────────────────────────

function PaginationDot({
  index,
  scrollX,
  total,
  cardWidth,
  color,
}: {
  index: number;
  scrollX: SharedValue<number>;
  total: number;
  cardWidth: number;
  color: string;
}) {
  const animStyle = useAnimatedStyle(() => {
    const inputRange = [(index - 1) * cardWidth, index * cardWidth, (index + 1) * cardWidth];
    const width = interpolate(scrollX.value, inputRange, [6, 22, 6], Extrapolation.CLAMP);
    const opacity = interpolate(scrollX.value, inputRange, [0.4, 1, 0.4], Extrapolation.CLAMP);
    return { width, opacity };
  });

  return (
    <Animated.View
      style={[
        styles.dot,
        { backgroundColor: color },
        animStyle,
      ]}
    />
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
  const isPopular = PLAN_POPULAR[plan.planKey] ?? false;
  const isFree = plan.monthlyPrice === 0;
  const price = isYearly ? plan.yearlyPrice / 12 : plan.monthlyPrice;
  const savings = isYearly && !isFree
    ? Math.round(((plan.monthlyPrice * 12 - plan.yearlyPrice) / (plan.monthlyPrice * 12)) * 100)
    : 0;
  const formatLimit = (n: number) => (n === -1 ? "Unlimited" : String(n));
  const accentColor = gradientColors[0];

  return (
    <View style={[styles.slide, { width: cardWidth }]}>
      <View style={[styles.card, { backgroundColor: colors.surface }]}>
        {/* Gradient Header */}
        <LinearGradient
          colors={gradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.cardHeader}
        >
          {/* Popular badge */}
          {isPopular && (
            <View style={styles.popularBadge}>
              <IconSymbol name="star.fill" size={10} color="#FCD34D" />
              <Text style={styles.popularText}>MOST POPULAR</Text>
            </View>
          )}
          {/* Current plan badge */}
          {isCurrentPlan && (
            <View style={[styles.popularBadge, { backgroundColor: "rgba(255,255,255,0.25)" }]}>
              <IconSymbol name="checkmark.circle.fill" size={10} color="#fff" />
              <Text style={styles.popularText}>CURRENT PLAN</Text>
            </View>
          )}

          {/* Icon */}
          <View style={styles.planIconWrap}>
            <IconSymbol name={planIcon} size={28} color="#fff" />
          </View>

          {/* Plan name */}
          <Text style={styles.planName}>{plan.displayName}</Text>
          <Text style={styles.planTagline}>{tagline}</Text>

          {/* Price */}
          <View style={styles.priceRow}>
            {isFree ? (
              <Text style={styles.priceMain}>Free</Text>
            ) : (
              <>
                <Text style={styles.priceCurrency}>$</Text>
                <Text style={styles.priceMain}>{price.toFixed(0)}</Text>
                <Text style={styles.pricePer}>/mo</Text>
              </>
            )}
          </View>
          {isYearly && !isFree && savings > 0 && (
            <View style={styles.savingsBadge}>
              <Text style={styles.savingsText}>Save {savings}% yearly</Text>
            </View>
          )}
          {isFree && (
            <Text style={styles.freeForever}>Free forever · No credit card</Text>
          )}
          {!isFree && !isYearly && (
            <Text style={styles.billedNote}>billed monthly</Text>
          )}
          {!isFree && isYearly && (
            <Text style={styles.billedNote}>billed as ${plan.yearlyPrice}/year</Text>
          )}
        </LinearGradient>

        {/* Feature List */}
        <View style={styles.featureList}>
          <FeatureRow label="Clients" value={formatLimit(plan.maxClients)} included={true} accentColor={accentColor} />
          <FeatureRow label="Services" value={formatLimit(plan.maxServices)} included={true} accentColor={accentColor} />
          <FeatureRow label="Staff members" value={formatLimit(plan.maxStaff)} included={plan.maxStaff !== 1} accentColor={accentColor} />
          <FeatureRow label="Locations" value={formatLimit(plan.maxLocations)} included={plan.maxLocations !== 1} accentColor={accentColor} />
          <FeatureRow label="Products" value={formatLimit(plan.maxProducts)} included={plan.maxProducts > 0} accentColor={accentColor} />
          <FeatureRow
            label="SMS automation"
            value={plan.smsLevel === "full" ? "Full" : plan.smsLevel === "confirmations" ? "Confirmations" : "None"}
            included={plan.smsLevel !== "none"}
            accentColor={accentColor}
          />
          <FeatureRow
            label="Monthly appointments"
            value={formatLimit(plan.maxAppointments)}
            included={true}
            accentColor={accentColor}
          />
          <FeatureRow
            label="Online payments"
            value={plan.paymentLevel === "full" ? "Full" : plan.paymentLevel === "basic" ? "Basic" : "None"}
            included={plan.paymentLevel !== "none"}
            accentColor={accentColor}
          />
        </View>

        {/* CTA */}
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
            <Text style={[styles.ctaText, { color: isCurrentPlan ? colors.muted : isFree ? "#374151" : "#fff" }]}>
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
  const CARD_PADDING = 24;
  const cardWidth = screenWidth - CARD_PADDING * 2;
  const scrollX = useSharedValue(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      scrollX.value = e.nativeEvent.contentOffset.x;
      const idx = Math.round(e.nativeEvent.contentOffset.x / cardWidth);
      setActiveIndex(Math.max(0, Math.min(idx, plans.length - 1)));
    },
    [cardWidth, plans.length, scrollX]
  );

  const goTo = useCallback(
    (idx: number) => {
      flatListRef.current?.scrollToIndex({ index: idx, animated: true });
      setActiveIndex(idx);
    },
    []
  );

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
      {/* Billing Toggle */}
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

      {/* Carousel */}
      <FlatList
        ref={flatListRef}
        data={plans}
        keyExtractor={(item) => item.planKey}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        snapToInterval={cardWidth}
        snapToAlignment="center"
        decelerationRate="fast"
        contentContainerStyle={{ paddingHorizontal: CARD_PADDING }}
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

      {/* Pagination Dots */}
      <View style={styles.pagination}>
        {plans.map((_, i) => (
          <Pressable key={i} onPress={() => goTo(i)}>
            <PaginationDot
              index={i}
              scrollX={scrollX}
              total={plans.length}
              cardWidth={cardWidth}
              color={activeColor}
            />
          </Pressable>
        ))}
      </View>

      {/* Swipe hint */}
      <View style={styles.swipeHint}>
        <IconSymbol name="chevron.right" size={12} color={colors.muted} />
        <Text style={[styles.swipeHintText, { color: colors.muted }]}>
          Swipe to compare plans ({activeIndex + 1}/{plans.length})
        </Text>
        <IconSymbol name="chevron.right" size={12} color={colors.muted} />
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
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
  billingToggle: {
    flexDirection: "row",
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 3,
    marginBottom: 16,
    alignSelf: "center",
  },
  toggleOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
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
  slide: {
    paddingVertical: 4,
  },
  card: {
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
  },
  cardHeader: {
    padding: 20,
    paddingBottom: 22,
    alignItems: "center",
    position: "relative",
  },
  popularBadge: {
    position: "absolute",
    top: 12,
    right: 12,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.3)",
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
    width: 60,
    height: 60,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.3)",
  },
  planName: {
    fontSize: 22,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: -0.3,
  },
  planTagline: {
    fontSize: 12,
    color: "rgba(255,255,255,0.75)",
    marginTop: 2,
    marginBottom: 12,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 1,
  },
  priceCurrency: {
    fontSize: 18,
    fontWeight: "700",
    color: "rgba(255,255,255,0.9)",
    marginBottom: 4,
  },
  priceMain: {
    fontSize: 42,
    fontWeight: "800",
    color: "#fff",
    lineHeight: 48,
  },
  pricePer: {
    fontSize: 16,
    color: "rgba(255,255,255,0.75)",
    marginBottom: 6,
  },
  savingsBadge: {
    backgroundColor: "rgba(34,197,94,0.3)",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginTop: 6,
    borderWidth: 1,
    borderColor: "rgba(34,197,94,0.5)",
  },
  savingsText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#86EFAC",
  },
  freeForever: {
    fontSize: 11,
    color: "rgba(255,255,255,0.65)",
    marginTop: 4,
  },
  billedNote: {
    fontSize: 11,
    color: "rgba(255,255,255,0.6)",
    marginTop: 4,
  },
  featureList: {
    padding: 16,
    gap: 2,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 5,
    gap: 8,
  },
  featureIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  featureLabel: {
    fontSize: 13,
    flex: 1,
  },
  featureValue: {
    fontSize: 12,
    fontWeight: "700",
  },
  ctaBtn: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  ctaText: {
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    marginTop: 6,
    marginBottom: 2,
  },
  swipeHintText: {
    fontSize: 11,
  },
});
