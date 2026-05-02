/**
 * Usage Guide
 * ─────────────────────────────────────────────────────────────────────────────
 * Comprehensive how-to guide for the Manus Scheduler app.
 * Sections are shown/hidden based on the user's subscription plan.
 * Each section has a deep-link "Go There" button that navigates directly.
 *
 * Solo plan:   Core features only
 * Growth plan: + SMS, Analytics, Promo Codes, Staff
 * Studio plan: + Multi-location, Products, Advanced Analytics
 * Enterprise:  + All features
 */
import React, { useState, useMemo, useEffect, useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useRouter } from "expo-router";
import { usePlanLimitCheck } from "@/hooks/use-plan-limit-check";

// ─── Types ────────────────────────────────────────────────────────────────────

type GuideStep = {
  step: string;
  description: string;
};

type GuideSection = {
  id: string;
  title: string;
  emoji: string;
  color: string;
  /** Minimum plan required: solo | growth | studio | enterprise */
  minPlan?: "solo" | "growth" | "studio" | "enterprise";
  steps: GuideStep[];
  /** Deep-link route to navigate to when "Go There" is tapped */
  actionRoute?: string;
  /** Label for the deep-link button */
  actionLabel?: string;
};

// ─── Plan order for comparison ────────────────────────────────────────────────

const PLAN_ORDER: Record<string, number> = {
  solo: 0,
  growth: 1,
  studio: 2,
  enterprise: 3,
};

function planAllows(currentPlan: string, minPlan: string): boolean {
  const current = PLAN_ORDER[currentPlan] ?? 0;
  const required = PLAN_ORDER[minPlan] ?? 0;
  return current >= required;
}

// ─── Guide Content ────────────────────────────────────────────────────────────

const GUIDE_SECTIONS: GuideSection[] = [
  {
    id: "getting-started",
    title: "Getting Started",
    emoji: "🚀",
    color: "#2563EB",
    actionRoute: "/location-form",
    actionLabel: "Add Location",
    steps: [
      { step: "Add your business location", description: "Go to Settings → Business → Locations and tap '+' to add your first location with address, phone, and hours." },
      { step: "Set your working hours", description: "In Settings → Business → Schedule & Hours, set your daily availability and buffer time between appointments." },
      { step: "Add your services", description: "Tap the Services tab and press '+' to create your first service — set name, duration, price, and category." },
      { step: "Share your booking link", description: "From the Home tab, tap the QR card to get your unique booking link. Share it with clients or add it to your bio." },
    ],
  },
  {
    id: "appointments",
    title: "Managing Appointments",
    emoji: "📅",
    color: "#10B981",
    actionRoute: "/(tabs)/bookings",
    actionLabel: "Open Bookings",
    steps: [
      { step: "Book an appointment", description: "Tap '+' on the Home screen or Calendar tab. Select a client, service, date, and time, then confirm." },
      { step: "View your schedule", description: "The Bookings tab shows all appointments with filter tabs. Use the Calendar tab for Day, Week, and Month views." },
      { step: "Confirm or cancel", description: "Tap any appointment card to open its detail page. Use the action buttons to confirm, complete, or cancel." },
      { step: "Reschedule an appointment", description: "Open the appointment detail, tap 'Reschedule', pick a new date and time, then confirm. The client will receive an SMS with the new details." },
      { step: "Add appointment notes", description: "In the appointment detail, scroll to the Notes section and type any relevant notes about the service or client." },
    ],
  },
  {
    id: "clients",
    title: "Client Management",
    emoji: "👥",
    color: "#8B5CF6",
    actionRoute: "/(tabs)/clients",
    actionLabel: "Open Clients",
    steps: [
      { step: "Add a new client", description: "Tap the Clients tab and press '+'. Fill in name, phone, email, and optional birthday or notes." },
      { step: "View client history", description: "Tap any client card to see their full booking history, total spend, and notes." },
      { step: "Send a message", description: "From the client detail page, tap the phone or message icon to call or text them directly." },
      { step: "Birthday reminders", description: "Add a client's birthday in their profile. The Home screen will highlight clients with birthdays today." },
      { step: "Search clients", description: "Use the search bar at the top of the Clients tab to quickly find any client by name, phone, or email." },
    ],
  },
  {
    id: "services",
    title: "Services & Pricing",
    emoji: "💼",
    color: "#F59E0B",
    actionRoute: "/(tabs)/services",
    actionLabel: "Open Services",
    steps: [
      { step: "Create a service", description: "Tap the Services tab → '+'. Set the service name, duration (in minutes), price, and category." },
      { step: "Assign categories", description: "Use Settings → Tools → Category Management to create categories, then assign services to them for better organization." },
      { step: "Edit or delete services", description: "Tap any service card and use the edit (pencil) or delete (trash) icons to modify or remove it." },
      { step: "Service add-ons", description: "When booking, you can combine multiple services into one appointment by selecting them during the booking flow." },
    ],
  },
  {
    id: "payments",
    title: "Payment Methods",
    emoji: "💳",
    color: "#0EA5E9",
    actionRoute: "/payment-methods",
    actionLabel: "Payment Settings",
    steps: [
      { step: "Set up payment methods", description: "Go to Settings → Business → Payment Methods. Add your Zelle, Cash App, or Venmo handles so clients know how to pay." },
      { step: "Record a payment", description: "When completing an appointment, you can record the payment method used directly on the appointment detail screen." },
      { step: "Track revenue", description: "The Home screen KPI cards show today's revenue and total revenue. Tap them for a detailed breakdown." },
    ],
  },
  {
    id: "sms",
    title: "SMS Automation",
    emoji: "📱",
    color: "#EC4899",
    minPlan: "growth",
    actionRoute: "/sms-automation",
    actionLabel: "SMS Settings",
    steps: [
      { step: "Enable Twilio SMS", description: "Go to Settings → Notifications → SMS Settings. Enter your Twilio Account SID, Auth Token, and phone number." },
      { step: "Automatic confirmations", description: "When SMS is enabled, clients automatically receive a confirmation SMS when their appointment is booked." },
      { step: "Reschedule notifications", description: "When you reschedule an appointment, the client receives an SMS with the new date, time, and a manage link." },
      { step: "Reminders", description: "Configure reminder timing in Settings → Notifications. Clients receive automated reminders before their appointment." },
      { step: "Manual SMS", description: "From any client detail page or appointment, tap the message icon to send a custom SMS directly." },
    ],
  },
  {
    id: "analytics",
    title: "Analytics & Reports",
    emoji: "📊",
    color: "#6366F1",
    minPlan: "growth",
    actionRoute: "/analytics",
    actionLabel: "View Analytics",
    steps: [
      { step: "View KPI dashboard", description: "The Home screen shows key metrics: today's revenue, total clients, appointments, and completion rate." },
      { step: "Detailed analytics", description: "Go to Settings → Tools → Analytics for full revenue trends, top services, client retention, and staff performance charts." },
      { step: "Export data", description: "In Settings → Tools → Export Data, generate PDF reports for clients, appointments, or revenue for any date range." },
      { step: "Revenue goal", description: "Set a monthly revenue goal in Settings → Business. The Home screen shows your progress toward it." },
    ],
  },
  {
    id: "promo-codes",
    title: "Promo Codes",
    emoji: "🎟️",
    color: "#0EA5E9",
    minPlan: "growth",
    actionRoute: "/promo-codes",
    actionLabel: "Manage Promo Codes",
    steps: [
      { step: "Create a promo code", description: "Go to Settings → Tools → Promo Codes and tap '+'. Set a code name, discount type (% or flat), and optional expiry or max uses." },
      { step: "Apply during booking", description: "During the booking flow, clients or staff can enter a promo code to apply the discount automatically." },
      { step: "Auto-deactivation", description: "Promo codes automatically become inactive when they reach their max uses or expiry date. A 'Limit Reached' badge appears on expired codes." },
      { step: "Manage codes", description: "Toggle any code active/inactive from the Promo Codes screen. Tap a code to edit its details." },
    ],
  },
  {
    id: "staff",
    title: "Staff Management",
    emoji: "👤",
    color: "#10B981",
    minPlan: "growth",
    actionRoute: "/staff",
    actionLabel: "Manage Staff",
    steps: [
      { step: "Add staff members", description: "Go to the Services tab → Staff section (or Settings → Business → Staff) and tap '+' to add a team member." },
      { step: "Assign services", description: "Each staff member can be assigned specific services they perform. This filters availability during booking." },
      { step: "Staff schedule", description: "Set individual working hours for each staff member in their profile to manage availability independently." },
      { step: "Staff performance", description: "View staff-specific revenue and appointment counts in the Analytics section (Growth plan and above)." },
    ],
  },
  {
    id: "locations",
    title: "Multiple Locations",
    emoji: "📍",
    color: "#3B82F6",
    minPlan: "studio",
    actionRoute: "/location-form",
    actionLabel: "Add Location",
    steps: [
      { step: "Add a second location", description: "Go to Settings → Business → Locations and tap '+'. Each location can have its own address, hours, and staff." },
      { step: "Switch active location", description: "Use the location switcher in the Settings header or Home screen to filter data by location." },
      { step: "Location-specific booking", description: "Your booking link can include a location parameter so clients book at the right place automatically." },
      { step: "Per-location schedule", description: "Set unique working hours for each location in Settings → Business → Schedule & Hours." },
    ],
  },
  {
    id: "products",
    title: "Products & Inventory",
    emoji: "📦",
    color: "#F97316",
    minPlan: "studio",
    actionRoute: "/products",
    actionLabel: "Manage Products",
    steps: [
      { step: "Add products", description: "Tap the Services tab → Products section and press '+'. Set product name, price, and stock quantity." },
      { step: "Sell during appointments", description: "When completing an appointment, add products to the sale to track inventory and revenue together." },
      { step: "Track inventory", description: "Product stock levels update automatically when sold. Low-stock alerts appear on the Home screen." },
    ],
  },
  {
    id: "booking-policies",
    title: "Booking Policies",
    emoji: "📋",
    color: "#EF4444",
    actionRoute: "/booking-policies",
    actionLabel: "Booking Policies",
    steps: [
      { step: "Set cancellation policy", description: "Go to Settings → Business → Booking Policies to define cancellation fees and notice requirements." },
      { step: "Custom booking URL", description: "Set a custom slug for your booking page (e.g., /book/your-name) in Booking Policies." },
      { step: "Temporary closure", description: "Toggle 'Temporarily Closed' in Booking Policies to pause all new bookings while keeping existing ones." },
      { step: "Advance booking limit", description: "Set how far in advance clients can book (e.g., up to 60 days) to control your calendar." },
    ],
  },
  {
    id: "notifications",
    title: "Notifications & Alerts",
    emoji: "🔔",
    color: "#F59E0B",
    actionRoute: "/notification-settings",
    actionLabel: "Notification Settings",
    steps: [
      { step: "Enable push notifications", description: "Go to Settings → Alerts and enable the notification types you want: new bookings, cancellations, reviews, etc." },
      { step: "Staff alerts", description: "Set a staff utilization threshold in Settings → Business. You'll be alerted when staff are near capacity." },
      { step: "Birthday alerts", description: "Enable birthday notifications to get reminded when a client's birthday is today." },
      { step: "Review notifications", description: "Get notified when a client leaves a review so you can respond promptly." },
    ],
  },
  {
    id: "security",
    title: "Security & Account",
    emoji: "🔒",
    color: "#6B7280",
    actionRoute: "/(tabs)/settings",
    actionLabel: "Open Settings",
    steps: [
      { step: "Enable biometric lock", description: "Go to Settings → Account → App Lock and enable Face ID or Touch ID to protect your business data." },
      { step: "Change theme", description: "In Settings → Account → Appearance, switch between Light, Dark, or Auto (follows system) mode." },
      { step: "Log out", description: "Scroll to the bottom of Settings → Account and tap 'Log Out' to sign out of your account." },
      { step: "Delete account", description: "To permanently delete all data, tap 'Delete Business' in Settings → Account. This action cannot be undone and removes all data from our servers and your device." },
    ],
  },
];

// ─── Tour Analytics type ─────────────────────────────────────────────────────
type TourAnalytics = {
  completions: number;
  skips: number;
  lastEvent?: "completed" | "skipped";
  lastStepReached?: number;
  lastUpdated?: string;
  stepReachedHistory?: Array<{ event: string; stepReached: number; timestamp: string }>;
};

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function UsageGuideScreen() {
  const colors = useColors();
  const router = useRouter();
  const { planInfo } = usePlanLimitCheck();
  const currentPlanKey = planInfo?.planKey ?? "solo";

  const [expandedId, setExpandedId] = useState<string | null>("getting-started");
  const [tourAnalytics, setTourAnalytics] = useState<TourAnalytics | null>(null);

  // Load tour analytics
  const loadAnalytics = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem("@lime_tour_analytics");
      if (raw) setTourAnalytics(JSON.parse(raw));
    } catch (_) {}
  }, []);

  useEffect(() => { loadAnalytics(); }, [loadAnalytics]);

  // Replay tour: clear the seen flag then navigate to Home tab (push always triggers focus)
  const replayTour = useCallback(async () => {
    try { await AsyncStorage.removeItem("@lime_tutorial_seen"); } catch {}
    router.push("/(tabs)/" as any);
  }, [router]);

  // Filter sections by current plan
  const visibleSections = useMemo(() => {
    return GUIDE_SECTIONS.filter((s) => {
      if (!s.minPlan) return true;
      return planAllows(currentPlanKey, s.minPlan);
    });
  }, [currentPlanKey]);

  // Locked sections (show as locked cards for upgrade motivation)
  const lockedSections = useMemo(() => {
    return GUIDE_SECTIONS.filter((s) => {
      if (!s.minPlan) return false;
      return !planAllows(currentPlanKey, s.minPlan);
    });
  }, [currentPlanKey]);

  const planDisplayName = planInfo?.displayName ?? "Solo";
  const planColor = currentPlanKey === "growth" ? "#2563EB"
    : currentPlanKey === "studio" ? "#7C3AED"
    : currentPlanKey === "enterprise" ? "#D97706"
    : "#6B7280";

  return (
    <ScreenContainer>
      {/* Header */}
      <View style={[s.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [s.backBtn, { opacity: pressed ? 0.6 : 1 }]}
        >
          <IconSymbol name="arrow.left" size={22} color={colors.foreground} />
        </Pressable>
        <View style={s.headerTitle}>
          <Text style={[s.headerTitleText, { color: colors.foreground }]}>Usage Guide</Text>
          <Text style={[s.headerSubtitle, { color: colors.muted }]}>How to use every feature</Text>
        </View>
        <View style={[s.planBadge, { backgroundColor: planColor + "20", borderColor: planColor + "40" }]}>
          <Text style={[s.planBadgeText, { color: planColor }]}>{planDisplayName}</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[s.scrollContent, { paddingBottom: 40 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Intro */}
        <View style={[s.introCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[s.introText, { color: colors.muted }]}>
            This guide covers every feature in Manus Scheduler. Sections marked with a plan badge require an upgrade.
            Tap any section to expand it, then tap <Text style={{ fontWeight: "700" }}>Go There</Text> to navigate directly.
          </Text>
        </View>

        {/* Replay Tour card */}
        <View style={[s.tourCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={{ flex: 1 }}>
            <Text style={[s.tourCardTitle, { color: colors.foreground }]}>🎯 App Tour</Text>
            <Text style={[s.tourCardSubtitle, { color: colors.muted }]}>
              {tourAnalytics
                ? `Completed ${tourAnalytics.completions}×  ·  Skipped ${tourAnalytics.skips}×${
                    tourAnalytics.lastStepReached != null
                      ? `  ·  Last reached step ${tourAnalytics.lastStepReached + 1}`
                      : ""
                  }`
                : "Never watched"}
            </Text>
          </View>
          <Pressable
            onPress={replayTour}
            style={({ pressed }) => [s.replayBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}
          >
            <Text style={s.replayBtnText}>▶ Replay Tour</Text>
          </Pressable>
        </View>

        {/* Available sections */}
        {visibleSections.map((section) => {
          const isExpanded = expandedId === section.id;
          return (
            <View
              key={section.id}
              style={[s.sectionCard, { backgroundColor: colors.surface, borderColor: isExpanded ? section.color + "66" : colors.border }]}
            >
              <Pressable
                onPress={() => setExpandedId(isExpanded ? null : section.id)}
                style={({ pressed }) => [s.sectionHeader, { opacity: pressed ? 0.8 : 1 }]}
              >
                <View style={[s.sectionIconWrap, { backgroundColor: section.color + "18" }]}>
                  <Text style={s.sectionEmoji}>{section.emoji}</Text>
                </View>
                <Text style={[s.sectionTitle, { color: colors.foreground }]}>{section.title}</Text>
                <View style={[s.stepCountBadge, { backgroundColor: section.color + "18" }]}>
                  <Text style={[s.stepCountText, { color: section.color }]}>{section.steps.length}</Text>
                </View>
                <IconSymbol
                  name={isExpanded ? "chevron.down" : "chevron.right"}
                  size={16}
                  color={colors.muted}
                />
              </Pressable>

              {isExpanded && (
                <View style={[s.stepsContainer, { borderTopColor: colors.border }]}>
                  {section.steps.map((item, idx) => (
                    <View key={idx} style={s.stepRow}>
                      <View style={[s.stepNumber, { backgroundColor: section.color }]}>
                        <Text style={s.stepNumberText}>{idx + 1}</Text>
                      </View>
                      <View style={s.stepContent}>
                        <Text style={[s.stepTitle, { color: colors.foreground }]}>{item.step}</Text>
                        <Text style={[s.stepDesc, { color: colors.muted }]}>{item.description}</Text>
                      </View>
                    </View>
                  ))}

                  {/* Deep-link action button */}
                  {section.actionRoute && (
                    <Pressable
                      onPress={() => router.push(section.actionRoute as any)}
                      style={({ pressed }) => [
                        s.actionBtn,
                        { backgroundColor: section.color, opacity: pressed ? 0.85 : 1 },
                      ]}
                    >
                      <IconSymbol name="arrow.up.right.square" size={15} color="#FFFFFF" />
                      <Text style={s.actionBtnText}>{section.actionLabel ?? "Go There"}</Text>
                    </Pressable>
                  )}
                </View>
              )}
            </View>
          );
        })}

        {/* Locked sections */}
        {lockedSections.length > 0 && (
          <>
            <View style={s.lockedHeader}>
              <Text style={[s.lockedHeaderText, { color: colors.muted }]}>🔒 Requires Upgrade</Text>
            </View>
            {lockedSections.map((section) => (
              <Pressable
                key={section.id}
                onPress={() => router.push("/subscription" as any)}
                style={({ pressed }) => [
                  s.lockedCard,
                  { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
                ]}
              >
                <View style={[s.sectionIconWrap, { backgroundColor: section.color + "18" }]}>
                  <Text style={s.sectionEmoji}>{section.emoji}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.sectionTitle, { color: colors.muted }]}>{section.title}</Text>
                  <Text style={[s.lockedPlanLabel, { color: section.color }]}>
                    {section.minPlan ? `${section.minPlan.charAt(0).toUpperCase()}${section.minPlan.slice(1)} plan` : ""} required
                  </Text>
                </View>
                <View style={[s.lockIcon, { backgroundColor: colors.border }]}>
                  <IconSymbol name="lock.fill" size={14} color={colors.muted} />
                </View>
              </Pressable>
            ))}
          </>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    gap: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
  },
  headerTitleText: {
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 1,
  },
  planBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
  },
  planBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 10,
  },
  introCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 4,
  },
  introText: {
    fontSize: 13,
    lineHeight: 20,
  },
  sectionCard: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    gap: 10,
  },
  sectionIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionEmoji: {
    fontSize: 20,
  },
  sectionTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
  },
  stepCountBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  stepCountText: {
    fontSize: 11,
    fontWeight: "700",
  },
  stepsContainer: {
    borderTopWidth: 0.5,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 16,
    gap: 14,
  },
  stepRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
  },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
    flexShrink: 0,
  },
  stepNumberText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  stepContent: {
    flex: 1,
    gap: 3,
  },
  stepTitle: {
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 20,
  },
  stepDesc: {
    fontSize: 13,
    lineHeight: 19,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginTop: 4,
    alignSelf: "flex-start",
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: 0.2,
  },
  lockedHeader: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  lockedHeaderText: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.3,
  },
  lockedCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 10,
  },
  lockedPlanLabel: {
    fontSize: 11,
    fontWeight: "600",
    marginTop: 2,
  },
  lockIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  tourCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 12,
  },
  tourCardTitle: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 3,
  },
  tourCardSubtitle: {
    fontSize: 12,
    lineHeight: 17,
  },
  replayBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  replayBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});
