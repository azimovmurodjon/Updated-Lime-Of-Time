import { useMemo, useEffect, useCallback, useState } from "react";
import {
  Text,
  View,
  Pressable,
  StyleSheet,
  Share,
  useWindowDimensions,
  ScrollView,
  Image,
  Alert,
  Platform,
  Modal,
  Animated,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { ScreenContainer } from "@/components/screen-container";
import { useStore, formatTime, formatDateStr } from "@/lib/store";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useRouter } from "expo-router";
import { minutesToTime, timeToMinutes, PUBLIC_BOOKING_URL, formatFullAddress } from "@/lib/types";
import { useActiveLocation } from "@/hooks/use-active-location";
import * as ImagePicker from "expo-image-picker";
import { MiniBarChart, MiniDonutChart } from "@/components/mini-chart";
import AsyncStorage from "@react-native-async-storage/async-storage";

// ─── Gradient KPI Card ───────────────────────────────────────────────
function GradientKpiCard({
  gradientColors,
  iconBg,
  icon,
  value,
  label,
  sublabel,
  badge,
  miniStats,
  onPress,
  width: cardWidth,
}: {
  gradientColors: [string, string];
  iconBg: string;
  icon: React.ReactNode;
  value: string;
  label: string;
  sublabel?: string;
  badge?: React.ReactNode;
  miniStats?: React.ReactNode;
  onPress?: () => void;
  width: number;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [{ opacity: pressed ? 0.88 : 1, width: cardWidth, marginBottom: 0 }]}
    >
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          borderRadius: 18,
          padding: 14,
          minHeight: 120,
          shadowColor: gradientColors[0],
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.25,
          shadowRadius: 12,
          elevation: 4,
        }}
      >
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
          <View style={{ width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: iconBg }}>
            {icon}
          </View>
          {badge}
        </View>
        <Text style={{ fontSize: 24, fontWeight: "800", color: "#FFFFFF", lineHeight: 30, letterSpacing: -0.5 }} numberOfLines={1}>
          {value}
        </Text>
        <Text style={{ fontSize: 12, fontWeight: "600", color: "rgba(255,255,255,0.8)", marginTop: 2 }}>{label}</Text>
        {sublabel ? <Text style={{ fontSize: 10, color: "rgba(255,255,255,0.65)", marginTop: 3 }}>{sublabel}</Text> : null}
        {miniStats}
      </LinearGradient>
    </Pressable>
  );
}

// ─── Progress Bar (inline, lightweight) ────────────────────────────
function ProgressBar({
  value,
  max,
  color,
  bgColor,
}: {
  value: number;
  max: number;
  color: string;
  bgColor: string;
}) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <View style={{ height: 8, borderRadius: 4, backgroundColor: bgColor, overflow: "hidden", width: "100%" }}>
      <View style={{ height: "100%", width: `${pct}%`, backgroundColor: color, borderRadius: 4 }} />
    </View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────

export default function HomeScreen() {
  const { state, dispatch, getServiceById, getClientById, getAppointmentsForDate, syncToDb, filterAppointmentsByLocation, clientsForActiveLocation } =
    useStore();
  const colors = useColors();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const isLargeTablet = width >= 1024;
  const hp = isLargeTablet ? 48 : isTablet ? 32 : Math.round(Math.max(16, width * 0.045));
  const maxContentWidth = isLargeTablet ? 1280 : isTablet ? Math.min(width, 960) : width;
  const contentWidth = maxContentWidth - hp * 2;
  const cardGap = isTablet ? 16 : 12;
  // On tablet: 4 columns for KPI cards; on phone: 2 columns
  const kpiCols = isLargeTablet ? 4 : isTablet ? 4 : 2;
  const cardW = Math.floor((contentWidth - cardGap * (kpiCols - 1)) / kpiCols);
  const fs = isTablet ? 1.1 : 1;

  useEffect(() => {
    if (state.loaded && !state.settings.onboardingComplete) {
      router.replace("/onboarding");
    }
  }, [state.loaded, state.settings.onboardingComplete]);

  // ─── Location Share Picker ──────────────────────────────────
  const [showSharePicker, setShowSharePicker] = useState(false);

  // ─── Tutorial Walkthrough ──────────────────────────────────────
  const [showTutorial, setShowTutorial] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);
  const tutorialFade = useState(() => new Animated.Value(0))[0];

  const TUTORIAL_STEPS = [
    { title: "Welcome to Lime Of Time!", desc: "Your all-in-one appointment scheduling app. Let's take a quick tour of the key features.", icon: "🍋" },
    { title: "Dashboard Overview", desc: "The home screen shows your KPIs, today's schedule, analytics charts, and quick actions at a glance.", icon: "📊" },
    { title: "Book Appointments", desc: "Tap the + button to create new bookings. You can also share your booking link with clients.", icon: "📅" },
    { title: "Manage Your Calendar", desc: "Use the Calendar tab to view and manage all appointments. Filter by status and navigate by date.", icon: "🗓️" },
    { title: "Services & Clients", desc: "Set up your services with pricing, categories, and duration. Track client history and notes.", icon: "💼" },
    { title: "Settings & Customization", desc: "Configure working hours, buffer time, custom booking URL, notifications, and more in Settings.", icon: "⚙️" },
    { title: "You're All Set!", desc: "Start by adding your first service and booking an appointment. Happy scheduling!", icon: "🎉" },
  ];

  useEffect(() => {
    if (state.loaded && state.settings.onboardingComplete) {
      AsyncStorage.getItem("@lime_tutorial_seen").then((val) => {
        if (!val) setShowTutorial(true);
      });
    }
  }, [state.loaded, state.settings.onboardingComplete]);

  useEffect(() => {
    if (showTutorial) {
      Animated.timing(tutorialFade, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    }
  }, [showTutorial, tutorialStep]);

  const dismissTutorial = useCallback(async () => {
    Animated.timing(tutorialFade, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
      setShowTutorial(false);
    });
    await AsyncStorage.setItem("@lime_tutorial_seen", "1");
  }, [tutorialFade]);

  const nextTutorialStep = useCallback(() => {
    if (tutorialStep < TUTORIAL_STEPS.length - 1) {
      tutorialFade.setValue(0);
      setTutorialStep((s) => s + 1);
    } else {
      dismissTutorial();
    }
  }, [tutorialStep, TUTORIAL_STEPS.length, dismissTutorial, tutorialFade]);

  // ─── Location Filter (global) ──────────────────────────────
  const { activeLocation, activeLocations, hasMultipleLocations, setActiveLocation } = useActiveLocation();
  const selectedLocationFilter = activeLocation?.id ?? null;

  // Use the store's location-aware filter (single source of truth)
  const filterByLocation = filterAppointmentsByLocation;

  const now = new Date();
  const todayStr = formatDateStr(now);
  const greeting =
    now.getHours() < 12
      ? "Good Morning"
      : now.getHours() < 17
      ? "Good Afternoon"
      : "Good Evening";
  const dateLabel = now.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const todayAppts = useMemo(() => filterByLocation(getAppointmentsForDate(todayStr)), [todayStr, selectedLocationFilter, filterByLocation, getAppointmentsForDate]);

  // ─── Analytics ──────────────────────────────────────────────────
  const analytics = useMemo(() => {
    const totalClients = clientsForActiveLocation.length;
    const filteredAppts = filterByLocation(state.appointments);
    const activeAppts = filteredAppts.filter((a) => a.status !== "cancelled");
    const totalAppointments = activeAppts.length;
    const completedAppts = filteredAppts.filter((a) => a.status === "completed");
    const totalRevenue = completedAppts.reduce((sum, a) => {
      if (a.totalPrice != null) return sum + a.totalPrice;
      const svc = state.services.find((s) => s.id === a.serviceId);
      return sum + (svc?.price ?? 0);
    }, 0);

    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    const weekStr = formatDateStr(startOfWeek);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    const endWeekStr = formatDateStr(endOfWeek);
    const weekAppts = completedAppts.filter(
      (a) => a.date >= weekStr && a.date <= endWeekStr
    );
    const weekRevenue = weekAppts.reduce((sum, a) => {
      if (a.totalPrice != null) return sum + a.totalPrice;
      const svc = state.services.find((s) => s.id === a.serviceId);
      return sum + (svc?.price ?? 0);
    }, 0);

    const prevWeekStart = new Date(startOfWeek);
    prevWeekStart.setDate(prevWeekStart.getDate() - 7);
    const prevWeekEnd = new Date(startOfWeek);
    prevWeekEnd.setDate(prevWeekEnd.getDate() - 1);
    const prevWeekAppts = completedAppts.filter(
      (a) =>
        a.date >= formatDateStr(prevWeekStart) && a.date <= formatDateStr(prevWeekEnd)
    );
    const prevWeekRevenue = prevWeekAppts.reduce((sum, a) => {
      if (a.totalPrice != null) return sum + a.totalPrice;
      const svc = state.services.find((s) => s.id === a.serviceId);
      return sum + (svc?.price ?? 0);
    }, 0);

    const monthlyData: { label: string; value: number; color: string }[] = [];
    const monthColors = [
      "#4CAF50",
      "#2196F3",
      "#FF9800",
      "#9C27B0",
      "#E91E63",
      "#00BCD4",
    ];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mStr = d.toLocaleDateString("en-US", { month: "short" });
      const mStart = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
      const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      const mEnd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
      const mRev = completedAppts
        .filter((a) => a.date >= mStart && a.date <= mEnd)
        .reduce((sum, a) => {
          if (a.totalPrice != null) return sum + a.totalPrice;
          const svc = state.services.find((s) => s.id === a.serviceId);
          return sum + (svc?.price ?? 0);
        }, 0);
      monthlyData.push({
        label: mStr,
        value: Math.round(mRev),
        color: monthColors[5 - i],
      });
    }

    const svcCounts: Record<string, number> = {};
    activeAppts.forEach((a) => {
      svcCounts[a.serviceId] = (svcCounts[a.serviceId] || 0) + 1;
    });
    const serviceBreakdown = state.services
      .map((s) => ({
        label: s.name,
        value: svcCounts[s.id] || 0,
        color: s.color,
      }))
      .filter((s) => s.value > 0)
      .sort((a, b) => b.value - a.value);

    const statusCounts = {
      pending: filteredAppts.filter((a) => a.status === "pending").length,
      confirmed: filteredAppts.filter((a) => a.status === "confirmed").length,
      completed: completedAppts.length,
      cancelled: filteredAppts.filter((a) => a.status === "cancelled").length,
    };

    let topServiceId = "";
    let topCount = 0;
    Object.entries(svcCounts).forEach(([id, count]) => {
      if (count > topCount) {
        topServiceId = id;
        topCount = count;
      }
    });
    const topService = state.services.find((s) => s.id === topServiceId);

    return {
      totalClients,
      totalAppointments,
      totalRevenue,
      weekRevenue,
      prevWeekRevenue,
      monthlyData,
      serviceBreakdown,
      statusCounts,
      topService,
      topCount,
    };
  }, [state.clients, state.appointments, state.services, filterByLocation, clientsForActiveLocation]);

  const pendingCount = analytics.statusCounts.pending;
  const revenueChange =
    analytics.prevWeekRevenue > 0
      ? Math.round(
          ((analytics.weekRevenue - analytics.prevWeekRevenue) /
            analytics.prevWeekRevenue) *
            100
        )
      : analytics.weekRevenue > 0
      ? 100
      : 0;

  const doShareForLocation = useCallback(async (loc: typeof activeLocation) => {
    const slug = state.settings.customSlug || state.settings.businessName.replace(/\s+/g, "-").toLowerCase();
    const locationParam = loc ? `?location=${encodeURIComponent(loc.id)}` : "";
    const url = `${PUBLIC_BOOKING_URL}/book/${slug}${locationParam}`;
    const profile = state.settings.profile;
    const displayAddress = loc
      ? formatFullAddress(loc.address, loc.city, loc.state, loc.zipCode)
      : profile.address;
    const addressLine = displayAddress ? `\n📍 ${displayAddress}` : "";
    const phoneLine = (loc?.phone || profile.phone) ? `\n📞 ${loc?.phone || profile.phone}` : "";
    const websiteLine = profile.website ? `\n🌐 ${profile.website}` : "";
    try {
      await Share.share({
        message: `Book an appointment with ${state.settings.businessName}!${addressLine}${phoneLine}${websiteLine}\n\nSchedule online: ${url}\n\nPowered by Lime Of Time`,
        title: "Book an Appointment",
      });
    } catch {}
  }, [state.settings, activeLocation]);

  const handleShareBookingLink = useCallback(() => {
    const allLocations = state.locations.filter((l) => l.active);
    if (allLocations.length > 1) {
      // Multiple locations — show picker
      setShowSharePicker(true);
    } else {
      // Single or no location — share directly
      doShareForLocation(activeLocation);
    }
  }, [state.locations, activeLocation, doShareForLocation]);

  const handlePickLogo = useCallback(async () => {
    if (Platform.OS === "web") {
      Alert.alert("Not Available", "Image upload is available on mobile devices.");
      return;
    }
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0]) {
        const action = {
          type: "UPDATE_SETTINGS" as const,
          payload: { businessLogoUri: result.assets[0].uri },
        };
        dispatch(action);
        syncToDb(action);
      }
    } catch {
      Alert.alert("Error", "Failed to pick image. Please try again.");
    }
  }, [dispatch, syncToDb]);

  const getEndTime = (time: string, duration: number) => {
    return formatTime(minutesToTime(timeToMinutes(time) + duration));
  };

  const logoSource = state.settings.businessLogoUri
    ? { uri: state.settings.businessLogoUri }
    : require("@/assets/images/icon.png");

  return (
    <ScreenContainer tabletMaxWidth={0}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: hp,
          paddingTop: 8,
          paddingBottom: 100,
          maxWidth: maxContentWidth,
          alignSelf: "center",
          width: "100%",
        }}
      >
        {/* ─── Business Header ──────────────────────────────────── */}
        <LinearGradient
          colors={[colors.primary + "18", colors.primary + "05"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.headerGradientBanner, { borderColor: colors.primary + "20" }]}
        >
          <View style={styles.businessHeader}>
            <Pressable
              onPress={handlePickLogo}
              style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
            >
              <Image source={logoSource} style={styles.businessLogo} resizeMode="cover" />
              <View style={[styles.cameraOverlay, { backgroundColor: colors.primary }]}>
                <IconSymbol name="photo" size={10} color="#FFF" />
              </View>
            </Pressable>
            <View style={styles.headerTextWrap}>
              <Text
                style={[styles.businessName, { color: colors.foreground }]}
                numberOfLines={1}
              >
                {state.settings.businessName}
              </Text>
              <Text style={[styles.greetingText, { color: colors.muted }]}>{greeting} 🍋</Text>
            </View>
            {state.settings.temporaryClosed && (
              <View style={[styles.closedBadge, { backgroundColor: colors.error + "15" }]}>
                <Text style={{ fontSize: 10, fontWeight: "700", color: colors.error }}>
                  CLOSED
                </Text>
              </View>
            )}
          </View>
          <Text style={[styles.dateLabel, { color: colors.muted }]}>{dateLabel}</Text>
        </LinearGradient>

        {/* Location Filter */}
        {hasMultipleLocations && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8, marginBottom: 4 }}>
            <View style={{ flexDirection: "row", gap: 6 }}>
              <Pressable
                onPress={() => setActiveLocation(null)}
                style={({ pressed }) => [{
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 16,
                  borderWidth: 1,
                  backgroundColor: !selectedLocationFilter ? colors.primary + "15" : colors.surface,
                  borderColor: !selectedLocationFilter ? colors.primary : colors.border,
                  opacity: pressed ? 0.7 : 1,
                }]}
              >
                <Text style={{ fontSize: 12, fontWeight: "600", color: !selectedLocationFilter ? colors.primary : colors.muted }}>All Locations</Text>
              </Pressable>
              {activeLocations.map((loc) => (
                <Pressable
                  key={loc.id}
                  onPress={() => setActiveLocation(loc.id)}
                  style={({ pressed }) => [{
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 16,
                    borderWidth: 1,
                    backgroundColor: selectedLocationFilter === loc.id ? colors.primary + "15" : colors.surface,
                    borderColor: selectedLocationFilter === loc.id ? colors.primary : colors.border,
                    opacity: pressed ? 0.7 : 1,
                  }]}
                >
                  <Text style={{ fontSize: 12, fontWeight: "600", color: selectedLocationFilter === loc.id ? colors.primary : colors.muted }}>{loc.name}</Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
        )}

        {/* Pending badge */}
        {pendingCount > 0 && (
          <Pressable
            onPress={() =>
              router.push({
                pathname: "/(tabs)/calendar",
                params: { filter: "requests" },
              })
            }
            style={({ pressed }) => [
              styles.pendingBanner,
              {
                backgroundColor: "#FFF3E0",
                borderColor: "#FF9800",
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            <IconSymbol name="questionmark.circle.fill" size={20} color="#FF9800" />
            <Text style={styles.pendingText}>
              {pendingCount} appointment request{pendingCount > 1 ? "s" : ""} pending
            </Text>
            <IconSymbol name="chevron.right" size={16} color="#FF9800" />
          </Pressable>
        )}

        {/* Temporary Closed Banner — per active location */}
        {activeLocation?.temporarilyClosed && (
          <View
            style={[
              styles.closedBanner,
              {
                backgroundColor: colors.error + "15",
                borderColor: colors.error + "50",
                borderWidth: 1,
                borderRadius: 10,
                flexDirection: "row",
                alignItems: "flex-start",
                gap: 10,
              },
            ]}
          >
            <IconSymbol name="exclamationmark.triangle.fill" size={18} color={colors.error} style={{ marginTop: 1 }} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, color: colors.error, fontWeight: "700", marginBottom: 2 }}>
                {activeLocation.name} — Temporarily Closed
              </Text>
              <Text style={{ fontSize: 12, color: colors.muted, lineHeight: 17 }}>
                {activeLocation.reopenOn
                  ? `This location is temporarily closed and will reopen on ${new Date(activeLocation.reopenOn + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}. No new bookings are being accepted until then.`
                  : `This location is temporarily closed for an indefinite period. No new bookings are being accepted at this time. Please check back later.`}
              </Text>
            </View>
          </View>
        )}

        {/* ─── KPI Cards (2x2 gradient grid) ─────────────────── */}
        <Text style={[styles.sectionTitle, { color: colors.foreground, marginTop: 20 }]}>
          Overview
        </Text>
        <View style={[styles.kpiGrid, { gap: cardGap }]}>
          <GradientKpiCard
            width={cardW}
            gradientColors={["#E65100", "#FF9800"]}
            iconBg="rgba(255,255,255,0.25)"
            icon={<IconSymbol name="dollarsign.circle.fill" size={20} color="#FFF" />}
            value={`$${analytics.weekRevenue.toLocaleString()}`}
            label="This Week"
            sublabel={`$${analytics.totalRevenue.toLocaleString()} total`}
            badge={
              revenueChange !== 0 ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 2, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.25)" }}>
                  <IconSymbol name={revenueChange > 0 ? "arrow.up.right" : "arrow.down.right"} size={10} color="#FFF" />
                  <Text style={{ fontSize: 10, fontWeight: "700", color: "#FFF" }}>{Math.abs(revenueChange)}%</Text>
                </View>
              ) : undefined
            }
            onPress={() => router.push({ pathname: "/analytics-detail", params: { tab: "revenue" } })}
          />
          <GradientKpiCard
            width={cardW}
            gradientColors={["#1565C0", "#2196F3"]}
            iconBg="rgba(255,255,255,0.25)"
            icon={<IconSymbol name="calendar" size={20} color="#FFF" />}
            value={String(analytics.totalAppointments)}
            label="Appointments"
            miniStats={
              <View style={{ flexDirection: "row", gap: 6, marginTop: 6 }}>
                <View style={{ backgroundColor: "rgba(255,255,255,0.2)", paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6, alignItems: "center" }}>
                  <Text style={{ fontSize: 10, fontWeight: "700", color: "#FFF" }}>{analytics.statusCounts.pending}</Text>
                  <Text style={{ fontSize: 9, color: "rgba(255,255,255,0.75)" }}>Pending</Text>
                </View>
                <View style={{ backgroundColor: "rgba(255,255,255,0.2)", paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6, alignItems: "center" }}>
                  <Text style={{ fontSize: 10, fontWeight: "700", color: "#FFF" }}>{analytics.statusCounts.confirmed}</Text>
                  <Text style={{ fontSize: 9, color: "rgba(255,255,255,0.75)" }}>Active</Text>
                </View>
              </View>
            }
            onPress={() => router.push({ pathname: "/analytics-detail", params: { tab: "appointments" } })}
          />
          <GradientKpiCard
            width={cardW}
            gradientColors={["#2E7D32", "#4CAF50"]}
            iconBg="rgba(255,255,255,0.25)"
            icon={<IconSymbol name="person.2.fill" size={20} color="#FFF" />}
            value={String(analytics.totalClients)}
            label="Total Clients"
            onPress={() => router.push({ pathname: "/analytics-detail", params: { tab: "clients" } })}
          />
          <GradientKpiCard
            width={cardW}
            gradientColors={["#6A1B9A", "#9C27B0"]}
            iconBg="rgba(255,255,255,0.25)"
            icon={<IconSymbol name="crown.fill" size={20} color="#FFF" />}
            value={analytics.topService?.name ?? "N/A"}
            label="Top Service"
            sublabel={analytics.topCount > 0 ? `${analytics.topCount} bookings` : undefined}
            onPress={() => router.push({ pathname: "/analytics-detail", params: { tab: "topservice" } })}
          />
        </View>

        {/* ─── Revenue Chart ─────────────────────────────────────── */}
        <View
          style={[
            styles.chartCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              marginTop: 16,
            },
          ]}
        >
          <View style={styles.chartHeader}>
            <Text style={[styles.chartTitle, { color: colors.foreground }]}>
              Revenue Trend
            </Text>
            <Text style={[styles.chartSubtitle, { color: colors.muted }]}>
              Last 6 months
            </Text>
          </View>
          <MiniBarChart data={analytics.monthlyData} height={200} width={contentWidth - 32} />
        </View>

        {/* ─── Service Breakdown + Status (side by side) ──────── */}
        <View style={[styles.sideBySideRow, { gap: cardGap, marginTop: 16 }]}>
          {/* Service Breakdown */}
          <View
            style={[
              styles.chartCard,
              {
                flex: 1,
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            <Text
              style={[
                styles.chartTitle,
                { color: colors.foreground, marginBottom: 12 },
              ]}
            >
              By Service
            </Text>
            {analytics.serviceBreakdown.length > 0 ? (
              <MiniDonutChart
                data={analytics.serviceBreakdown.slice(0, 4)}
                size={70}
                compact
                centerValue={String(analytics.serviceBreakdown.reduce((s, d) => s + d.value, 0))}
              />
            ) : (
              <Text
                style={{
                  fontSize: 12,
                  color: colors.muted,
                  textAlign: "center",
                  paddingVertical: 20,
                }}
              >
                No data yet
              </Text>
            )}
          </View>

          {/* Status Breakdown */}
          <View
            style={[
              styles.chartCard,
              {
                flex: 1,
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            <Text
              style={[
                styles.chartTitle,
                { color: colors.foreground, marginBottom: 12 },
              ]}
            >
              Status
            </Text>
            <View style={styles.statusList}>
              {[
                {
                  label: "Completed",
                  value: analytics.statusCounts.completed,
                  color: colors.primary,
                },
                {
                  label: "Confirmed",
                  value: analytics.statusCounts.confirmed,
                  color: colors.success,
                },
                {
                  label: "Pending",
                  value: analytics.statusCounts.pending,
                  color: "#FF9800",
                },
                {
                  label: "Cancelled",
                  value: analytics.statusCounts.cancelled,
                  color: colors.error,
                },
              ].map((item) => (
                <View key={item.label} style={styles.statusItem}>
                  <View style={styles.statusLabelRow}>
                    <Text style={[styles.statusLabel, { color: colors.muted }]}>
                      {item.label}
                    </Text>
                    <Text
                      style={[styles.statusValue, { color: item.color }]}
                    >
                      {item.value}
                    </Text>
                  </View>
                  <ProgressBar
                    value={item.value}
                    max={Math.max(
                      analytics.totalAppointments + analytics.statusCounts.cancelled,
                      1
                    )}
                    color={item.color}
                    bgColor={colors.border + "60"}
                  />
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* ─── Quick Actions ──────────────────────────────────────── */}
        <Text style={[styles.sectionTitle, { color: colors.foreground, marginTop: 24 }]}>
          Quick Actions
        </Text>
        <View style={styles.quickActionsRow}>
          <Pressable
            onPress={() => router.push("/discounts")}
            style={({ pressed }) => [
              styles.quickAction,
              {
                backgroundColor: "#FF980010",
                borderColor: "#FF980030",
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            <IconSymbol name="tag.fill" size={22} color="#FF9800" />
            <Text style={[styles.quickActionLabel, { color: "#FF9800" }]}>
              Discounts
            </Text>
            <Text style={[styles.quickActionCount, { color: "#FF9800" }]}>
              {state.discounts.filter((d) => d.active).length}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => router.push("/gift-cards")}
            style={({ pressed }) => [
              styles.quickAction,
              {
                backgroundColor: "#E91E6310",
                borderColor: "#E91E6330",
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            <IconSymbol name="gift.fill" size={22} color="#E91E63" />
            <Text style={[styles.quickActionLabel, { color: "#E91E63" }]}>
              Gift Cards
            </Text>
            <Text style={[styles.quickActionCount, { color: "#E91E63" }]}>
              {state.giftCards.filter((g) => !g.redeemed).length}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => router.push("/staff" as any)}
            style={({ pressed }) => [
              styles.quickAction,
              {
                backgroundColor: "#3B82F610",
                borderColor: "#3B82F630",
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            <IconSymbol name="person.3.fill" size={22} color="#3B82F6" />
            <Text style={[styles.quickActionLabel, { color: "#3B82F6" }]}>
              Staff
            </Text>
            <Text style={[styles.quickActionCount, { color: "#3B82F6" }]}>
              {state.staff.filter((s) => s.active).length}
            </Text>
          </Pressable>
          <Pressable
            onPress={handleShareBookingLink}
            style={({ pressed }) => [
              styles.quickAction,
              {
                backgroundColor: colors.primary + "10",
                borderColor: colors.primary + "30",
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            <IconSymbol name="paperplane.fill" size={22} color={colors.primary} />
            <Text style={[styles.quickActionLabel, { color: colors.primary }]}>
              Share Link
            </Text>
          </Pressable>
        </View>

        {/* ─── Today's Schedule ────────────────────────────────────── */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 24, marginBottom: 12 }}>
          <Text style={[styles.sectionTitle, { color: colors.foreground, marginBottom: 0 }]}>Today's Schedule</Text>
          <View style={{ backgroundColor: colors.primary + "15", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 }}>
            <Text style={{ fontSize: 12, fontWeight: "700", color: colors.primary }}>{todayAppts.length} appts</Text>
          </View>
        </View>
        {todayAppts.length === 0 ? (
          <View
            style={[
              styles.emptyCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: colors.primary + "12", alignItems: "center", justifyContent: "center", marginBottom: 4 }}>
              <IconSymbol name="calendar" size={32} color={colors.primary + "80"} />
            </View>
            <Text style={{ color: colors.foreground, fontSize: 15, fontWeight: "600", marginTop: 4 }}>No appointments today</Text>
            <Text style={{ color: colors.muted, fontSize: 13, marginTop: 4, textAlign: "center" }}>Your schedule is clear — enjoy your day!</Text>
            <Pressable
              onPress={() => router.push("/new-booking")}
              style={({ pressed }) => [
                styles.bookBtn,
                { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <Text style={styles.bookBtnText}>Book an Appointment</Text>
            </Pressable>
          </View>
        ) : (
          <View style={isTablet ? { flexDirection: "row", flexWrap: "wrap", gap: cardGap } : undefined}>
            {todayAppts.map((appt) => {
              const svc = getServiceById(appt.serviceId);
              const client = getClientById(appt.clientId);
              const statusColor =
                appt.status === "confirmed"
                  ? colors.success
                  : appt.status === "pending"
                  ? "#FF9800"
                  : appt.status === "completed"
                  ? colors.primary
                  : colors.error;
              return (
                <Pressable
                  key={appt.id}
                  onPress={() =>
                    router.push({
                      pathname: "/appointment-detail",
                      params: { id: appt.id },
                    })
                  }
                  style={({ pressed }) => [
                    styles.apptCard,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                      borderLeftColor: svc?.color ?? colors.primary,
                      opacity: pressed ? 0.8 : 1,
                      // 2-column on tablet
                      ...(isTablet ? { width: Math.floor((contentWidth - cardGap) / 2) } : {}),
                    },
                  ]}
                >
                  <View style={styles.apptRow}>
                    <View style={[styles.apptTimeBlock, { backgroundColor: statusColor + "18" }]}>
                      <Text style={{ fontSize: 11, fontWeight: "700", color: statusColor }}>{formatTime(appt.time)}</Text>
                      <Text style={{ fontSize: 10, color: statusColor + "CC" }}>–{getEndTime(appt.time, appt.duration)}</Text>
                    </View>
                    <View style={styles.apptInfo}>
                      <Text style={[styles.apptService, { color: colors.foreground }]}>
                        {svc?.name ?? "Service"}
                      </Text>
                      <Text style={{ fontSize: 13, color: colors.muted }}>
                        {client?.name ?? "Client"}
                      </Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: statusColor + "18" }]}>
                      <Text
                        style={{
                          fontSize: 11,
                          fontWeight: "600",
                          color: statusColor,
                          textTransform: "capitalize",
                        }}
                      >
                        {appt.status}
                      </Text>
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* FAB */}
      <Pressable
        onPress={() => router.push("/new-booking")}
        style={({ pressed }) => [
          styles.fab,
          { right: hp, transform: [{ scale: pressed ? 0.93 : 1 }] },
        ]}
      >
        <LinearGradient
          colors={[colors.primary, colors.primary + "CC"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center" }}
        >
          <IconSymbol name="plus" size={28} color="#FFF" />
        </LinearGradient>
      </Pressable>

      {/* Tutorial Walkthrough Overlay */}
      <Modal visible={showTutorial} transparent animationType="none">
        <Animated.View style={[styles.tutorialOverlay, { opacity: tutorialFade }]}>
          <View style={[styles.tutorialCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={{ fontSize: 48, textAlign: "center", marginBottom: 16 }}>
              {TUTORIAL_STEPS[tutorialStep]?.icon}
            </Text>
            <Text style={[styles.tutorialTitle, { color: colors.foreground }]}>
              {TUTORIAL_STEPS[tutorialStep]?.title}
            </Text>
            <Text style={[styles.tutorialDesc, { color: colors.muted }]}>
              {TUTORIAL_STEPS[tutorialStep]?.desc}
            </Text>
            {/* Step indicators */}
            <View style={styles.tutorialDots}>
              {TUTORIAL_STEPS.map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.tutorialDot,
                    { backgroundColor: i === tutorialStep ? colors.primary : colors.border },
                  ]}
                />
              ))}
            </View>
            <View style={styles.tutorialActions}>
              <Pressable
                onPress={dismissTutorial}
                style={({ pressed }) => [styles.tutorialSkipBtn, { opacity: pressed ? 0.7 : 1 }]}
              >
                <Text style={{ fontSize: 14, color: colors.muted }}>Skip</Text>
              </Pressable>
              <Pressable
                onPress={nextTutorialStep}
                style={({ pressed }) => [
                  styles.tutorialNextBtn,
                  { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <Text style={{ fontSize: 14, fontWeight: "600", color: "#FFF" }}>
                  {tutorialStep === TUTORIAL_STEPS.length - 1 ? "Get Started" : "Next"}
                </Text>
              </Pressable>
            </View>
          </View>
        </Animated.View>
      </Modal>

      {/* ─── Location Share Picker Sheet ─────────────────────────────── */}
      <Modal visible={showSharePicker} transparent animationType="slide" onRequestClose={() => setShowSharePicker(false)}>
        <Pressable
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" }}
          onPress={() => setShowSharePicker(false)}
        >
          <Pressable
            style={[
              styles.shareSheet,
              { backgroundColor: colors.surface, borderTopColor: colors.border },
            ]}
            onPress={() => {}} // prevent dismiss on inner tap
          >
            <View style={styles.shareSheetHandle} />
            <Text style={{ fontSize: 17, fontWeight: "700", color: colors.foreground, marginBottom: 4 }}>
              Share Booking Link
            </Text>
            <Text style={{ fontSize: 13, color: colors.muted, marginBottom: 16 }}>
              Choose a location to share
            </Text>
            {state.locations.filter((l) => l.active).map((loc) => {
              const addr = formatFullAddress(loc.address, loc.city, loc.state, loc.zipCode);
              return (
                <Pressable
                  key={loc.id}
                  onPress={() => {
                    setShowSharePicker(false);
                    doShareForLocation(loc);
                  }}
                  style={({ pressed }) => [
                    styles.shareLocRow,
                    { borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
                  ]}
                >
                  <View style={[styles.shareLocDot, { backgroundColor: colors.primary }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: "600", color: colors.foreground }}>{loc.name}</Text>
                    {!!addr && (
                      <Text style={{ fontSize: 12, color: colors.muted, marginTop: 2 }} numberOfLines={1}>{addr}</Text>
                    )}
                  </View>
                  <IconSymbol name="paperplane.fill" size={16} color={colors.primary} />
                </Pressable>
              );
            })}
            <Pressable
              onPress={() => setShowSharePicker(false)}
              style={({ pressed }) => [
                styles.shareCancelBtn,
                { backgroundColor: colors.border, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Text style={{ fontSize: 15, fontWeight: "600", color: colors.foreground }}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  // ─── Header ──────────────────────────────────────────────
  headerGradientBanner: {
    borderRadius: 18,
    padding: 14,
    marginTop: 4,
    marginBottom: 4,
    borderWidth: 1,
  },
  businessHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  businessLogo: {
    width: 52,
    height: 52,
    borderRadius: 14,
  },
  cameraOverlay: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTextWrap: {
    flex: 1,
    marginLeft: 14,
  },
  businessName: {
    fontSize: 20,
    fontWeight: "700",
  },
  greetingText: {
    fontSize: 13,
    marginTop: 2,
  },
  closedBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  dateLabel: {
    fontSize: 14,
    marginTop: 2,
    marginBottom: 4,
  },
  pendingBanner: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 14,
  },
  pendingText: {
    color: "#E65100",
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 8,
    flex: 1,
  },
  closedBanner: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 10,
  },

  // ─── Section ─────────────────────────────────────────────
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 12,
  },

  // ─── KPI Grid ────────────────────────────────────────────
  kpiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  kpiCard: {
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    marginBottom: 0,
  },
  kpiHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  kpiIconBg: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  changeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 8,
  },
  kpiValue: {
    fontSize: 22,
    fontWeight: "800",
    lineHeight: 28,
  },
  kpiLabel: {
    fontSize: 12,
    fontWeight: "500",
    marginTop: 2,
  },
  kpiTotal: {
    fontSize: 11,
    marginTop: 4,
  },
  miniStatRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 6,
  },
  miniStat: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignItems: "center",
  },

  // ─── Charts ──────────────────────────────────────────────
  chartCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
  },
  chartHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  chartTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  chartSubtitle: {
    fontSize: 12,
  },
  sideBySideRow: {
    flexDirection: "row",
  },

  statusList: {
    gap: 10,
  },
  statusItem: {
    width: "100%",
  },
  statusLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  statusLabel: {
    fontSize: 11,
  },
  statusValue: {
    fontSize: 11,
    fontWeight: "700",
  },

  // ─── Quick Actions ───────────────────────────────────────
  quickActionsRow: {
    flexDirection: "row",
    gap: 10,
  },
  quickAction: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderRadius: 14,
    borderWidth: 1,
    minHeight: 90,
  },
  quickActionLabel: {
    fontSize: 12,
    fontWeight: "600",
    marginTop: 6,
    textAlign: "center",
  },
  quickActionCount: {
    fontSize: 18,
    fontWeight: "800",
    marginTop: 2,
  },

  // ─── Today's Schedule ────────────────────────────────────
  emptyCard: {
    alignItems: "center",
    paddingVertical: 32,
    borderRadius: 16,
    borderWidth: 1,
  },
  bookBtn: {
    marginTop: 14,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  bookBtnText: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "600",
  },
  apptCard: {
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderLeftWidth: 4,
  },
  apptRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  apptTimeBlock: {
    width: 56,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  apptInfo: {
    flex: 1,
  },
  apptTime: {
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 20,
  },
  apptService: {
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 19,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },

  // ─── FAB ─────────────────────────────────────────────────────
  fab: {
    position: "absolute",
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    elevation: 8,
    shadowColor: "#4A7C59",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
  },

  // ─── Tutorial Walkthrough ─────────────────────────────────
  tutorialOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  tutorialCard: {
    width: "100%",
    maxWidth: 340,
    borderRadius: 24,
    padding: 32,
    borderWidth: 1,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 8,
  },
  tutorialTitle: {
    fontSize: 22,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 8,
  },
  tutorialDesc: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    marginBottom: 24,
  },
  tutorialDots: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 24,
  },
  tutorialDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  tutorialActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    width: "100%",
  },
  tutorialSkipBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
  },
  tutorialNextBtn: {
    flex: 2,
    alignItems: "center",
    paddingVertical: 14,
    borderRadius: 14,
  },
  // ─── Share Picker Sheet ──────────────────────────────────────────────
  shareSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 36,
  },
  shareSheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#C0C0C0",
    alignSelf: "center",
    marginBottom: 16,
  },
  shareLocRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
  },
  shareLocDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  shareCancelBtn: {
    alignItems: "center",
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 4,
  },
});
