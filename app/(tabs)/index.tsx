import { useMemo, useEffect, useCallback, useState, useRef } from "react";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { LinearGradient } from "expo-linear-gradient";
import {
  Text,
  View,
  Pressable,
  StyleSheet,
  Share,
  ScrollView,
  Image,
  ImageBackground,
  Alert,
  Platform,
  Modal,
  Animated,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useStore, formatTime, formatDateStr } from "@/lib/store";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useRouter } from "expo-router";
import { minutesToTime, timeToMinutes, PUBLIC_BOOKING_URL, formatFullAddress, formatPhoneNumber } from "@/lib/types";
import { formatPhone } from "@/lib/utils";
import { useActiveLocation } from "@/hooks/use-active-location";
import { useResponsive } from "@/hooks/use-responsive";
import { FuturisticBackground } from "@/components/futuristic-background";
import * as ImagePicker from "expo-image-picker";
import { MiniBarChart, MiniDonutChart } from "@/components/mini-chart";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { KpiDetailSheet, MicroSparkLine, MicroBarSpark, type KpiTab } from "@/components/kpi-detail-sheet";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import QRCode from "react-native-qrcode-svg";
import Svg, { Path as SvgPath } from "react-native-svg";
import { TourOverlay } from "@/components/tour-overlay";

// App logo URL (same as app.config.ts logoUrl)
const APP_LOGO_URL = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663347678319/jHoNjHdLsUGgpFhz.png";
// ─── Count-up hook ──────────────────────────────────────────────────────
function useCountUp(target: number, duration = 900): number {
  const [display, setDisplay] = useState(0);
  const ref = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (target === 0) { setDisplay(0); return; }
    const steps = 40;
    const stepTime = Math.max(16, Math.floor(duration / steps));
    let current = 0;
    ref.current = setInterval(() => {
      current += 1;
      setDisplay(Math.round((current / steps) * target));
      if (current >= steps) {
        setDisplay(target);
        if (ref.current) clearInterval(ref.current);
      }
    }, stepTime);
    return () => { if (ref.current) clearInterval(ref.current); };
  }, [target, duration]);
  return display;
}

// ─── Gradient KPI Card (redesigned with sparkline) ────────────────────
function GradientKpiCard({
  gradientColors,
  iconBg,
  icon,
  value,
  numericValue,
  valuePrefix,
  valueSuffix,
  label,
  sublabel,
  badge,
  miniStats,
  sparkData,
  sparkType,
  onPress,
  width: cardWidth,
}: {
  gradientColors: [string, string];
  iconBg: string;
  icon: React.ReactNode;
  value: string;
  numericValue?: number;
  valuePrefix?: string;
  valueSuffix?: string;
  label: string;
  sublabel?: string;
  badge?: React.ReactNode;
  miniStats?: React.ReactNode;
  sparkData?: number[];
  sparkType?: "line" | "bar";
  onPress?: () => void;
  width: number;
}) {
  const sparkW = cardWidth - 28;
  const animatedNum = useCountUp(numericValue ?? 0);
  const displayValue = numericValue != null
    ? `${valuePrefix ?? ""}${animatedNum.toLocaleString()}${valueSuffix ?? ""}`
    : value;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [{
        opacity: pressed ? 0.88 : 1,
        transform: [{ scale: pressed ? 0.97 : 1 }],
        width: cardWidth,
        marginBottom: 0,
        alignSelf: "stretch",
      }]}
    >
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          borderRadius: 20,
          padding: 14,
          flex: 1,
          minHeight: 155,
          shadowColor: gradientColors[0],
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.35,
          shadowRadius: 14,
          elevation: 6,
          overflow: "hidden",
        }}
      >
        {/* Decorative circle */}
        <View style={{
          position: "absolute",
          top: -20,
          right: -20,
          width: 90,
          height: 90,
          borderRadius: 45,
          backgroundColor: "rgba(255,255,255,0.08)",
        }} />
        <View style={{
          position: "absolute",
          bottom: 20,
          right: -30,
          width: 70,
          height: 70,
          borderRadius: 35,
          backgroundColor: "rgba(255,255,255,0.05)",
        }} />

        {/* Top row: icon + badge */}
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
          <View style={{
            width: 38,
            height: 38,
            borderRadius: 12,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: iconBg,
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.15)",
          }}>
            {icon}
          </View>
          {badge}
        </View>

        {/* Value */}
        <Text style={{ fontSize: 26, fontWeight: "800", color: "#FFFFFF", lineHeight: 32, letterSpacing: -0.8 }} numberOfLines={1}>
          {displayValue}
        </Text>
        <Text style={{ fontSize: 12, fontWeight: "600", color: "rgba(255,255,255,0.82)", marginTop: 1 }}>{label}</Text>
        {sublabel ? <Text style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", marginTop: 2 }}>{sublabel}</Text> : null}
        {miniStats}

        {/* Sparkline at bottom */}
        {sparkData && sparkData.length > 1 && (
          <View style={{ marginTop: 8, opacity: 0.75 }}>
            {sparkType === "bar" ? (
              <MicroBarSpark data={sparkData} w={sparkW} h={28} color="#FFFFFF" />
            ) : (
              <MicroSparkLine data={sparkData} w={sparkW} h={28} color="#FFFFFF" />
            )}
          </View>
        )}

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
  const { width, height, isTablet, isLargeTablet, hp, maxContentWidth, cardGap, kpiCols, fontScale: fs } = useResponsive();
  const contentWidth = maxContentWidth - hp * 2;
  const cardW = Math.floor((contentWidth - cardGap * (kpiCols - 1)) / kpiCols);

  useEffect(() => {
    if (state.loaded && !state.settings.onboardingComplete) {
      router.replace("/onboarding");
    }
  }, [state.loaded, state.settings.onboardingComplete]);

  // ─── Location Share Picker ──────────────────────────────
  const [showSharePicker, setShowSharePicker] = useState(false);

  // ─── QR Booking Card ──────────────────────────────────
  const [showQrModal, setShowQrModal] = useState(false);
  // Which location is selected inside the QR modal (null = all/base URL)
  const [qrSelectedLocationId, setQrSelectedLocationId] = useState<string | null>(null);

  // ─── KPI Detail Sheet ─────────────────────────────────────────
  const [kpiDetailTab, setKpiDetailTab] = useState<KpiTab | null>(null);

  // ─── Tutorial Walkthrough ──────────────────────────────────────
  const [showTutorial, setShowTutorial] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);
  const tutorialFade = useState(() => new Animated.Value(0))[0];

  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  // Tutorial card colors that follow system light/dark mode
  const tutorialCardBg = isDark ? "#0F1F18" : "#FFFFFF";
  const tutorialCardBorder = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)";
  const tutorialTitleColor = isDark ? "#FFFFFF" : "#11181C";
  const tutorialSubtitleColor = isDark ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.45)";
  const tutorialDescColor = isDark ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.65)";
  const tutorialBulletTextColor = isDark ? "rgba(255,255,255,0.8)" : "rgba(0,0,0,0.75)";
  const tutorialActionBg = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)";
  const tutorialActionBorder = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)";
  const tutorialActionTextColor = isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.45)";
  const tutorialStepCountColor = isDark ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.3)";
  const tutorialProgressTrackBg = isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)";
  const tutorialPrevBorderColor = isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.15)";
  const tutorialPrevTextColor = isDark ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.5)";
  const tutorialSkipTextColor = isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.35)";
  const tutorialSkipMidColor = isDark ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.25)";
  // Tutorial tab spotlight positions (index = tab index, 0-based left to right)
  // Each entry maps to one of the 5 bottom tabs: Home, Calendar, Clients, Services, Settings
  const TOUR_TAB_STEPS: Array<{
    tabIndex: number;
    title: string;
    message: string;
    emoji: string;
    isLastStep?: boolean;
  }> = [
    {
      tabIndex: 0,
      title: "Home",
      message: "This is your Home dashboard — see all your KPIs, today's appointments, revenue charts, and quick-action buttons at a glance.",
      emoji: "🏠",
    },
    {
      tabIndex: 1,
      title: "Calendar",
      message: "The Calendar tab shows your full schedule. Switch between day, week, and month views, and manage all your bookings here.",
      emoji: "📅",
    },
    {
      tabIndex: 2,
      title: "Clients",
      message: "The Clients tab is your client database. View booking history, add notes, and manage all your client relationships.",
      emoji: "👥",
    },
    {
      tabIndex: 3,
      title: "Services",
      message: "The Services tab lets you define your offerings — set prices, durations, and categories for everything you provide.",
      emoji: "💼",
    },
    {
      tabIndex: 4,
      title: "Settings",
      message: "Settings is your control center — manage locations, staff, schedule, notifications, subscription, and more.",
      emoji: "⚙️",
    },
    {
      tabIndex: 4,
      title: "Add Your First Location",
      message: "Before you start using the app, you must add your business address. Tap 'Set Up Location' below — it only takes a moment!",
      emoji: "📍",
      isLastStep: true,
    },
  ];
  useEffect(() => {
    if (state.loaded) {
      AsyncStorage.getItem("@lime_tutorial_seen").then((val) => {
        if (!val) setShowTutorial(true);
      });
    }
  }, [state.loaded]);
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
    if (tutorialStep < TOUR_TAB_STEPS.length - 1) {
      tutorialFade.setValue(0);
      setTutorialStep((s) => s + 1);
    } else {
      dismissTutorial();
    }
  }, [tutorialStep, TOUR_TAB_STEPS.length, dismissTutorial, tutorialFade]);
  const prevTutorialStep = useCallback(() => {
    if (tutorialStep > 0) {
      tutorialFade.setValue(0);
      setTutorialStep((s) => s - 1);
    }
  }, [tutorialStep, tutorialFade]);

  // ─── Location Filter (global) ──────────────────────────────
  const { activeLocation, activeLocations, hasMultipleLocations, setActiveLocation } = useActiveLocation();
  const selectedLocationFilter = activeLocation?.id ?? null;
  // openQrModal: default to active location (or first if only one) — declared after activeLocation
  const openQrModal = useCallback(() => {
    const locs = state.locations.filter((l) => l.active);
    if (locs.length === 1) {
      setQrSelectedLocationId(locs[0].id);
    } else {
      setQrSelectedLocationId(activeLocation?.id ?? null);
    }
    setShowQrModal(true);
  }, [state.locations, activeLocation]);

  // ─── Primary booking URL (for QR card) ──────────────────────────────────
  // Base URL (no location param) used for the home card QR preview
  const primaryBookingUrl = useMemo(() => {
    const slug = state.settings.customSlug || state.settings.businessName.replace(/\s+/g, "-").toLowerCase();
    return `${PUBLIC_BOOKING_URL}/book/${slug}`;
  }, [state.settings]);
  // URL used inside the QR modal — includes location param when a specific location is selected
  const qrBookingUrl = useMemo(() => {
    const slug = state.settings.customSlug || state.settings.businessName.replace(/\s+/g, "-").toLowerCase();
    const base = `${PUBLIC_BOOKING_URL}/book/${slug}`;
    if (qrSelectedLocationId) return `${base}?location=${encodeURIComponent(qrSelectedLocationId)}`;
    return base;
  }, [state.settings, qrSelectedLocationId]);
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

  const todayAppts = useMemo(() => {
    const all = filterByLocation(getAppointmentsForDate(todayStr));
    return all
      .filter((a) => a.status === "confirmed" || a.status === "pending")
      .sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));
  }, [todayStr, selectedLocationFilter, filterByLocation, getAppointmentsForDate]);

  // ─── Birthday Clients ─────────────────────────────────────────────
  const birthdayClients = useMemo(() => {
    const todayMD = todayStr.slice(5); // "MM-DD"
    return state.clients.filter((c) => {
      if (!c.birthday) return false;
      const parts = c.birthday.replace(/-/g, "/").split("/");
      if (parts.length < 2) return false;
      const mm = parts[0].padStart(2, "0");
      const dd = parts[1].padStart(2, "0");
      return `${mm}-${dd}` === todayMD;
    });
  }, [state.clients, todayStr]);

  // ─── Analytics ──────────────────────────────────────────────
  const analytics = useMemo(() => {
    const totalClients = clientsForActiveLocation.length;
    const filteredAppts = filterByLocation(state.appointments);
    const activeAppts = filteredAppts.filter((a) => a.status !== "cancelled");
    const totalAppointments = activeAppts.length;
    const completedAppts = filteredAppts.filter((a) => a.status === "completed");
    const todayCompletedAppts = completedAppts.filter((a) => a.date === todayStr);
    const todayRevenue = todayCompletedAppts.reduce((sum, a) => {
      if (a.totalPrice != null) return sum + a.totalPrice;
      const svc = state.services.find((s) => s.id === a.serviceId);
      return sum + (svc?.price ?? 0);
    }, 0);
    const todayCompletedCount = todayCompletedAppts.length;
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

    // ─── 7-day daily chart data ─────────────────────────────
    const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const weeklyDailyData: { label: string; value: number; color: string; apptCount: number }[] = [];
    const weeklyColors = ["#FF9800", "#4CAF50", "#2196F3", "#9C27B0", "#E91E63", "#00BCD4", "#FF5722"];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const dStr = formatDateStr(d);
      const dayAppts = completedAppts.filter((a) => a.date === dStr);
      const dayRev = dayAppts.reduce((sum, a) => {
        if (a.totalPrice != null) return sum + a.totalPrice;
        const svc = state.services.find((s) => s.id === a.serviceId);
        return sum + (svc?.price ?? 0);
      }, 0);
      const allDayAppts = filterByLocation(state.appointments).filter((a) => a.date === dStr && a.status !== "cancelled");
      weeklyDailyData.push({
        label: dayLabels[d.getDay()],
        value: Math.round(dayRev),
        color: weeklyColors[d.getDay()],
        apptCount: allDayAppts.length,
      });
    }

    // ─── Payment stats ─────────────────────────────────────────────────────
    const getApptPrice = (a: (typeof filteredAppts)[0]) => {
      if (a.totalPrice != null) return a.totalPrice;
      const svc = state.services.find((s) => s.id === a.serviceId);
      return svc?.price ?? 0;
    };
    const nonCancelledAppts = filteredAppts.filter((a) => a.status !== 'cancelled');
    const paidAppts = nonCancelledAppts.filter((a) => (a as any).paymentStatus === 'paid');
    const unpaidAppts = nonCancelledAppts.filter((a) => (a as any).paymentStatus !== 'paid');
    const paidRevenue = paidAppts.reduce((sum, a) => sum + getApptPrice(a), 0);
    const unpaidRevenue = unpaidAppts.reduce((sum, a) => sum + getApptPrice(a), 0);
    const paidCount = paidAppts.length;
    const unpaidCount = unpaidAppts.length;
    // Payment method breakdown — keyed by canonical method, value is { count, revenue }
    const METHOD_LABELS: Record<string, string> = {
      cash: 'Cash',
      zelle: 'Zelle',
      venmo: 'Venmo',
      cashapp: 'Card',
      unpaid: 'Unpaid',
    };
    const methodBreakdown: Record<string, { count: number; revenue: number; label: string }> = {};
    paidAppts.forEach((a) => {
      const rawMethod = (a as any).paymentMethod;
      // Treat missing / 'unpaid' as 'cash' (legacy appointments without a stored method)
      const method = (rawMethod && rawMethod !== 'unpaid') ? rawMethod : 'cash';
      const label = METHOD_LABELS[method] ?? method.charAt(0).toUpperCase() + method.slice(1);
      if (!methodBreakdown[method]) methodBreakdown[method] = { count: 0, revenue: 0, label };
      methodBreakdown[method].count += 1;
      methodBreakdown[method].revenue += getApptPrice(a);
    });

    // ─── Upcoming this week (today through end of week) ──────────────────
    const upcomingThisWeekAppts = filteredAppts.filter(
      (a) => a.date >= todayStr && a.date <= endWeekStr && a.status !== 'cancelled' && a.status !== 'completed'
    );
    const weekConfirmed = upcomingThisWeekAppts.filter((a) => a.status === 'confirmed').length;
    const weekPending = upcomingThisWeekAppts.filter((a) => a.status === 'pending').length;
    const upcomingThisWeek = upcomingThisWeekAppts.length;

    // ─── Next-7-days daily upcoming counts (for spark) ────────────────────
    const upcomingDailyData: number[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(now);
      d.setDate(now.getDate() + i);
      const dStr = formatDateStr(d);
      upcomingDailyData.push(
        filteredAppts.filter((a) => a.date === dStr && a.status !== 'cancelled' && a.status !== 'completed').length
      );
    }

    // ─── Total Yearly Earnings (completed appts this calendar year) ─────────
    const yearStart = `${now.getFullYear()}-01-01`;
    const yearEnd = `${now.getFullYear()}-12-31`;
    const yearlyRevenue = completedAppts
      .filter((a) => a.date >= yearStart && a.date <= yearEnd)
      .reduce((sum, a) => {
        if (a.totalPrice != null) return sum + a.totalPrice;
        const svc = state.services.find((s) => s.id === a.serviceId);
        return sum + (svc?.price ?? 0);
      }, 0);

    return {
      totalClients,
      totalAppointments,
      totalRevenue,
      weekRevenue,
      prevWeekRevenue,
      monthlyData,
      weeklyDailyData,
      serviceBreakdown,
      statusCounts,
      topService,
      topCount,
      paidRevenue,
      unpaidRevenue,
      paidCount,
      unpaidCount,
      methodBreakdown,
      upcomingThisWeek,
      weekConfirmed,
      weekPending,
      upcomingDailyData,
      yearlyRevenue,
      todayRevenue,
      todayCompletedCount,
    };
  }, [state.clients, state.appointments, state.services, filterByLocation, clientsForActiveLocation, todayStr]);

  // ─── Upcoming Appointments (next 10, future dates + today future times) ──────
  const tomorrowStr = useMemo(() => {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    return formatDateStr(d);
  }, [todayStr]);

  const upcomingAppointments = useMemo(() => {
    return filterByLocation(state.appointments)
      .filter((a) => {
        if (a.status === "cancelled" || a.status === "completed") return false;
        return a.date >= tomorrowStr;
      })
      .sort((a, b) => {
        if (a.date !== b.date) return a.date < b.date ? -1 : 1;
        return timeToMinutes(a.time) - timeToMinutes(b.time);
      })
      .slice(0, 10);
  }, [state.appointments, filterByLocation, tomorrowStr]);

  // ─── KPI Sheet Data ─────────────────────────────────────────────────────
  const kpiClientsData = useMemo(() => {
    const filteredAppts = filterByLocation(state.appointments);
    const completedAppts = filteredAppts.filter((a) => a.status === "completed");
    const clientsData = clientsForActiveLocation.map((c) => {
      const cAppts = completedAppts.filter((a) => a.clientId === c.id);
      const totalSpent = cAppts.reduce((sum, a) => {
        if (a.totalPrice != null) return sum + a.totalPrice;
        const svc = state.services.find((s) => s.id === a.serviceId);
        return sum + (svc?.price ?? 0);
      }, 0);
      return { id: c.id, name: c.name, phone: c.phone, email: c.email, apptCount: cAppts.length, totalSpent };
    }).filter((c) => c.apptCount > 0).sort((a, b) => b.apptCount - a.apptCount);
    return { totalClients: clientsForActiveLocation.length, clientsData };
  }, [state.clients, state.appointments, state.services, filterByLocation, clientsForActiveLocation]);

  const kpiServiceRanking = useMemo(() => {
    const filteredAppts = filterByLocation(state.appointments).filter((a) => a.status !== "cancelled");
    return state.services.map((s) => ({
      id: s.id,
      name: s.name,
      color: s.color,
      price: s.price,
      bookings: filteredAppts.filter((a) => a.serviceId === s.id).length,
    })).filter((s) => s.bookings > 0).sort((a, b) => b.bookings - a.bookings);
  }, [state.services, state.appointments, filterByLocation]);

  // ─── Revenue Forecast (current month) ────────────────────────────────────
  const revenueForecast = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const dayOfMonth = now.getDate();
    const mStart = `${year}-${String(month + 1).padStart(2, "0")}-01`;
    const mEnd = `${year}-${String(month + 1).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`;
    const todayStr2 = formatDateStr(now);
    // Revenue earned so far this month (completed)
    const completedThisMonth = filterByLocation(state.appointments).filter(
      (a) => a.status === "completed" && a.date >= mStart && a.date <= mEnd
    );
    const earnedSoFar = completedThisMonth.reduce((sum, a) => {
      if (a.totalPrice != null) return sum + a.totalPrice;
      const svc = state.services.find((s) => s.id === a.serviceId);
      return sum + (svc?.price ?? 0);
    }, 0);
    // Revenue from upcoming confirmed/pending appointments this month
    const scheduledThisMonth = filterByLocation(state.appointments).filter(
      (a) => (a.status === "confirmed" || a.status === "pending") && a.date > todayStr2 && a.date <= mEnd
    );
    const scheduledRevenue = scheduledThisMonth.reduce((sum, a) => {
      if (a.totalPrice != null) return sum + a.totalPrice;
      const svc = state.services.find((s) => s.id === a.serviceId);
      return sum + (svc?.price ?? 0);
    }, 0);
    // Projected end-of-month based on daily run-rate
    const dailyRate = dayOfMonth > 0 ? earnedSoFar / dayOfMonth : 0;
    const remainingDays = daysInMonth - dayOfMonth;
    const projected = Math.round(earnedSoFar + dailyRate * remainingDays);
    const goal = state.settings.monthlyRevenueGoal ?? 0;
    const progressPct = goal > 0 ? Math.min(100, Math.round((earnedSoFar / goal) * 100)) : 0;
    const projectedPct = goal > 0 ? Math.min(100, Math.round((projected / goal) * 100)) : 0;
    const monthName = now.toLocaleDateString("en-US", { month: "long" });
    return { earnedSoFar, scheduledRevenue, projected, goal, progressPct, projectedPct, monthName, daysInMonth, dayOfMonth, remainingDays };
  }, [state.appointments, state.services, state.settings.monthlyRevenueGoal, filterByLocation]);

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
    // Use full address (street + city + state + zip) for the share message
    const displayAddress = loc
      ? formatFullAddress(loc.address, loc.city, loc.state, loc.zipCode)
      : formatFullAddress(profile.address, profile.city, profile.state, profile.zipCode);
    const addressLine = displayAddress ? `\n📍 ${displayAddress}` : "";
    const rawPhone = loc?.phone || profile.phone;
    const phoneLine = rawPhone ? `\n📞 ${formatPhoneNumber(rawPhone)}` : "";
    const websiteLine = profile.website ? `\n🌐 ${profile.website}` : "";
    try {
      if (Platform.OS === "web") {
        // Web: use navigator.share if available, otherwise copy to clipboard
        const shareData = {
          title: "Book an Appointment",
          text: `Book an appointment with ${state.settings.businessName}!${addressLine}${phoneLine}${websiteLine}\n\nSchedule online: ${url}\n\nPowered by Lime Of Time`,
        };
        if (typeof navigator !== "undefined" && navigator.share) {
          await navigator.share(shareData);
        } else {
          const { default: Clipboard } = await import("expo-clipboard");
          await Clipboard.setStringAsync(url);
          Alert.alert("Link Copied!", "Booking link copied to clipboard.");
        }
      } else {
        await Share.share({
          message: `Book an appointment with ${state.settings.businessName}!${addressLine}${phoneLine}${websiteLine}\n\nSchedule online: ${url}\n\nPowered by Lime Of Time`,
          title: "Book an Appointment",
        });
      }
    } catch {}
  }, [state.settings, activeLocation]);

  const handleShareBookingLink = useCallback(() => {
    const allLocations = state.locations.filter((l) => l.active);
    if (allLocations.length > 1) {
      // Multiple locations — show picker
      setShowSharePicker(true);
    } else if (allLocations.length === 1) {
      // Single location — always share with that location's ID so the booking page pre-selects it
      doShareForLocation(allLocations[0]);
    } else {
      // No locations configured — share business link without location param
      doShareForLocation(null);
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

  const handleKpiExport = useCallback(async (tab: KpiTab) => {
    if (Platform.OS === "web") {
      Alert.alert("Not Available", "PDF export is available on mobile devices.");
      return;
    }
    try {
      const { generateRevenuePdf, generateAppointmentsPdf, generateClientsPdf, generateServicesPdf, exportPdf } = await import("@/lib/pdf-export");
      const businessName = state.settings.businessName || "Business";
      const locationName = activeLocation?.name;
      const locationAddress = activeLocation?.address;
      const filteredAppts = filterByLocation(state.appointments);
      const filteredClients = clientsForActiveLocation;
      const accent = "#4A7C59";
      let html = "";
      let filename = "";
      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10);
      if (tab === "revenue") {
        html = generateRevenuePdf(businessName, filteredAppts, state.services, accent, locationName, locationAddress);
        filename = `Revenue_Report_${dateStr}.pdf`;
      } else if (tab === "appointments") {
        html = generateAppointmentsPdf(businessName, filteredAppts, state.services, state.clients, accent, locationName, locationAddress);
        filename = `Appointments_Report_${dateStr}.pdf`;
      } else if (tab === "clients") {
        html = generateClientsPdf(businessName, filteredClients, accent, locationName, locationAddress);
        filename = `Clients_Report_${dateStr}.pdf`;
      } else if (tab === "topservice") {
        html = generateServicesPdf(businessName, state.services, filteredAppts, accent, locationName, locationAddress);
        filename = `Services_Report_${dateStr}.pdf`;
      }
      if (html) await exportPdf(html, filename);
    } catch (e) {
      Alert.alert("Export Failed", "Could not generate the report. Please try again.");
    }
  }, [state, activeLocation, filterByLocation, clientsForActiveLocation]);

  const logoSource = state.settings.businessLogoUri
    ? { uri: state.settings.businessLogoUri }
    : require("@/assets/images/icon.png");

  return (
    <ScreenContainer tabletMaxWidth={0}>
      {/* ─── Animated gradient orbs background ──────────────────────── */}
      <FuturisticBackground />
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
              <Text style={[styles.greetingText, { color: colors.muted }]}>{greeting}</Text>
            </View>
            {state.settings.temporaryClosed && (
              <View style={[styles.closedBadge, { backgroundColor: colors.error + "15" }]}>
                <Text style={{ fontSize: 10, fontWeight: "700", color: colors.error }}>
                  CLOSED
                </Text>
              </View>
            )}
          </View>
          <View style={{ marginTop: 4 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text style={[styles.dateLabel, { color: colors.muted }]}>{dateLabel}</Text>
              {analytics.todayRevenue > 0 && (
                <Pressable
                  onPress={() => router.push({ pathname: "/analytics-detail", params: { tab: "overview" } } as any)}
                  style={({ pressed }) => ({
                    flexDirection: "row",
                    alignItems: "center",
                    backgroundColor: colors.success + "20",
                    borderRadius: 12,
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    borderWidth: 1,
                    borderColor: colors.success + "40",
                    gap: 4,
                    opacity: pressed ? 0.7 : 1,
                  })}>
                  <Text style={{ fontSize: 10, color: colors.success + "CC" }}>
                    {analytics.todayCompletedCount} appt{analytics.todayCompletedCount !== 1 ? "s" : ""}
                  </Text>
                  <Text style={{ fontSize: 10, color: colors.success + "80" }}>·</Text>
                  <Text style={{ fontSize: 11, fontWeight: "700", color: colors.success }}>
                    ${analytics.todayRevenue.toFixed(0)} today
                  </Text>
                </Pressable>
              )}
            </View>
            {/* 7-day revenue sparkline */}
            {analytics.weeklyDailyData.some((d) => d.value > 0) && (
              <Pressable
                onPress={() => router.push({ pathname: "/analytics-detail", params: { tab: "overview" } } as any)}
                style={{ marginTop: 6, opacity: 0.72 }}
              >
                <MicroBarSpark
                  data={analytics.weeklyDailyData.map((d) => d.value)}
                  w={contentWidth - 32}
                  h={22}
                  color={colors.success}
                />
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 1 }}>
                  {analytics.weeklyDailyData.map((d, i) => (
                    <Text key={i} style={{ fontSize: 8, color: colors.muted + "99", flex: 1, textAlign: "center" }}>{d.label}</Text>
                  ))}
                </View>
              </Pressable>
            )}
          </View>
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
            <IconSymbol name="clock.badge.fill" size={20} color="#FF9800" />
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
          {/* Revenue Card */}
          <GradientKpiCard
            width={cardW}
            gradientColors={["#E65100", "#FF9800"]}
            iconBg="rgba(255,255,255,0.22)"
            icon={<IconSymbol name="dollarsign.circle.fill" size={22} color="#FFF" />}
            value={`$${analytics.weekRevenue.toLocaleString()}`}
            numericValue={Math.round(analytics.weekRevenue)}
            valuePrefix="$"
            label="This Week Revenue"
            sublabel={`$${analytics.totalRevenue.toLocaleString()} all-time`}
            badge={
              revenueChange !== 0 ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 2, paddingHorizontal: 7, paddingVertical: 4, borderRadius: 10, backgroundColor: revenueChange > 0 ? "rgba(255,255,255,0.28)" : "rgba(0,0,0,0.18)" }}>
                  <IconSymbol name={revenueChange > 0 ? "arrow.up.right" : "arrow.down.right"} size={10} color="#FFF" />
                  <Text style={{ fontSize: 11, fontWeight: "800", color: "#FFF" }}>{Math.abs(revenueChange)}%</Text>
                </View>
              ) : undefined
            }
            sparkData={analytics.weeklyDailyData.map((d) => d.value)}
            sparkType="line"
            onPress={() => setKpiDetailTab("revenue")}
          />
          {/* Total Yearly Earnings Card */}
          <GradientKpiCard
            width={cardW}
            gradientColors={["#7B1FA2", "#CE93D8"]}
            iconBg="rgba(255,255,255,0.22)"
            icon={<IconSymbol name="dollarsign.circle.fill" size={22} color="#FFF" />}
            value={`$${analytics.yearlyRevenue.toLocaleString()}`}
            numericValue={Math.round(analytics.yearlyRevenue)}
            valuePrefix="$"
            label={`${new Date().getFullYear()} Earnings`}
            sublabel={`$${analytics.totalRevenue.toLocaleString()} all-time`}
            sparkData={analytics.monthlyData.map((d) => d.value)}
            sparkType="bar"
            onPress={() => setKpiDetailTab("revenue")}
          />
          {/* Clients Card */}
          <GradientKpiCard
            width={cardW}
            gradientColors={["#1B5E20", "#66BB6A"]}
            iconBg="rgba(255,255,255,0.22)"
            icon={<IconSymbol name="person.2.fill" size={22} color="#FFF" />}
            value={String(analytics.totalClients)}
            numericValue={analytics.totalClients}
            label="Total Clients"
            sublabel={`${kpiClientsData.clientsData.length} active`}
            sparkData={analytics.monthlyData.map((d) => d.value)}
            sparkType="bar"
            onPress={() => setKpiDetailTab("clients")}
          />
          {/* Total Appointments Card */}
          <GradientKpiCard
            width={cardW}
            gradientColors={["#1565C0", "#42A5F5"]}
            iconBg="rgba(255,255,255,0.22)"
            icon={<IconSymbol name="calendar" size={22} color="#FFF" />}
            value={String(analytics.totalAppointments)}
            numericValue={analytics.totalAppointments}
            label="Total Appointments"
            sublabel={`${analytics.statusCounts.completed} completed`}
            badge={
              analytics.statusCounts.pending > 0 ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 2, paddingHorizontal: 7, paddingVertical: 4, borderRadius: 10, backgroundColor: "rgba(255,152,0,0.55)" }}>
                  <Text style={{ fontSize: 11, fontWeight: "800", color: "#FFF" }}>{analytics.statusCounts.pending} pending</Text>
                </View>
              ) : undefined
            }
            sparkData={analytics.weeklyDailyData.map((d) => d.apptCount)}
            sparkType="bar"
            onPress={() => setKpiDetailTab("appointments")}
          />
        </View>

        {/* ─── Monthly Goal Progress Bar ──────────────────────────────────── */}
        {state.settings.monthlyRevenueGoal > 0 && (
          <Pressable
            onPress={() => router.push("/settings" as any)}
            style={({ pressed }) => [styles.chartCard, { backgroundColor: colors.surface, borderColor: colors.border, padding: 14, marginTop: 12, opacity: pressed ? 0.85 : 1 }]}
          >
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: colors.primary + "20", alignItems: "center", justifyContent: "center" }}>
                  <IconSymbol name="target" size={16} color={colors.primary} />
                </View>
                <Text style={{ fontSize: 14, fontWeight: "700", color: colors.foreground }}>Monthly Goal</Text>
              </View>
              <Text style={{ fontSize: 13, fontWeight: "700", color: revenueForecast.progressPct >= 100 ? colors.success : colors.primary }}>
                {revenueForecast.progressPct}%
              </Text>
            </View>
            {/* Progress bar */}
            <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.border, overflow: "hidden", marginBottom: 6 }}>
              <View
                style={{
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: revenueForecast.progressPct >= 100 ? colors.success : colors.primary,
                  width: `${Math.min(100, revenueForecast.progressPct)}%` as any,
                }}
              />
            </View>
            {/* Projected fill bar (lighter) */}
            {revenueForecast.projectedPct > revenueForecast.progressPct && revenueForecast.progressPct < 100 && (
              <View style={{ height: 4, borderRadius: 2, backgroundColor: colors.border, overflow: "hidden", marginBottom: 6 }}>
                <View
                  style={{
                    height: 4,
                    borderRadius: 2,
                    backgroundColor: colors.primary + "50",
                    width: `${Math.min(100, revenueForecast.projectedPct)}%` as any,
                  }}
                />
              </View>
            )}
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ fontSize: 12, color: colors.muted }}>
                ${revenueForecast.earnedSoFar.toLocaleString()} earned · {revenueForecast.remainingDays}d left
              </Text>
              <Text style={{ fontSize: 12, color: colors.muted }}>
                Goal: ${state.settings.monthlyRevenueGoal.toLocaleString()}
              </Text>
            </View>
            {revenueForecast.projectedPct > revenueForecast.progressPct && revenueForecast.progressPct < 100 && (
              <Text style={{ fontSize: 11, color: colors.primary, marginTop: 4 }}>
                On track to reach ${revenueForecast.projected.toLocaleString()} by month-end
              </Text>
            )}
            {revenueForecast.progressPct >= 100 && (
              <Text style={{ fontSize: 12, color: colors.success, fontWeight: "700", marginTop: 2 }}>🎉 Goal reached this month!</Text>
            )}
          </Pressable>
        )}

        {/* ─── Payment Summary Card ──────────────────────────────────────── */}
        <View style={[styles.chartCard, { backgroundColor: colors.surface, borderColor: colors.border, padding: 16, marginTop: 12 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: colors.success + '22', alignItems: 'center', justifyContent: 'center' }}>
                  <IconSymbol name="dollarsign.circle.fill" size={18} color={colors.success} />
                </View>
                <Text style={{ fontSize: 15, fontWeight: '700', color: colors.foreground }}>Payment Summary</Text>
              </View>
              <Pressable
                onPress={() => router.push({ pathname: '/(tabs)/calendar', params: { filter: 'unpaid' } } as any)}
                style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.error + '15', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 })}
              >
                <Text style={{ fontSize: 12, fontWeight: '700', color: colors.error }}>View Unpaid</Text>
                <IconSymbol name="chevron.right" size={12} color={colors.error} />
              </Pressable>
            </View>

            {/* Paid / Unpaid row */}
            <View style={{ flexDirection: 'row', gap: 12 }}>
              {/* Paid — taps into paid filter */}
              <Pressable
                onPress={() => router.push({ pathname: '/(tabs)/calendar', params: { filter: 'paid' } } as any)}
                style={({ pressed }) => ({ flex: 1, backgroundColor: colors.success + '15', borderRadius: 12, padding: 12, opacity: pressed ? 0.75 : 1 })}
              >
                <Text style={{ fontSize: 11, fontWeight: '600', color: colors.success, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Paid</Text>
                <Text style={{ fontSize: 20, fontWeight: '800', color: colors.success }}>${analytics.paidRevenue.toLocaleString()}</Text>
                <Text style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>{analytics.paidCount} appointment{analytics.paidCount !== 1 ? 's' : ''}</Text>
              </Pressable>
              {/* Unpaid — taps into unpaid filter */}
              <Pressable
                onPress={() => router.push({ pathname: '/(tabs)/calendar', params: { filter: 'unpaid' } } as any)}
                style={({ pressed }) => ({ flex: 1, backgroundColor: colors.error + '15', borderRadius: 12, padding: 12, opacity: pressed ? 0.75 : 1 })}
              >
                <Text style={{ fontSize: 11, fontWeight: '600', color: colors.error, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Outstanding</Text>
                <Text style={{ fontSize: 20, fontWeight: '800', color: colors.error }}>${analytics.unpaidRevenue.toLocaleString()}</Text>
                <Text style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>{analytics.unpaidCount} appointment{analytics.unpaidCount !== 1 ? 's' : ''}</Text>
              </Pressable>
            </View>

            {/* Payment method breakdown */}
            {Object.keys(analytics.methodBreakdown).length > 0 && (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                {Object.entries(analytics.methodBreakdown).map(([method, entry]) => (
                  <View key={method} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.border + '80', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 }}>
                    <Text style={{ fontSize: 12, color: colors.foreground, fontWeight: '600' }}>{entry.label}</Text>
                    <Text style={{ fontSize: 11, color: colors.muted }}>×{entry.count}</Text>
                    <Text style={{ fontSize: 11, color: colors.success, fontWeight: '600' }}>${entry.revenue.toFixed(0)}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Progress bar: paid vs total */}
            {(analytics.paidRevenue + analytics.unpaidRevenue) > 0 && (
              <View style={{ marginTop: 10 }}>
                <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.border, overflow: 'hidden' }}>
                  <View style={{
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: colors.success,
                    width: `${Math.round((analytics.paidRevenue / (analytics.paidRevenue + analytics.unpaidRevenue)) * 100)}%` as any,
                  }} />
                </View>
                <Text style={{ fontSize: 11, color: colors.muted, marginTop: 4 }}>
                  {Math.round((analytics.paidRevenue / (analytics.paidRevenue + analytics.unpaidRevenue)) * 100)}% collected
                </Text>
              </View>
            )}
        </View>

        {/* ─── Weekly Overview Chart ───────────────────────────────────── */}
        <Pressable
          onPress={() => router.push({ pathname: "/analytics-detail", params: { tab: "revenue" } } as any)}
          style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
        >
        <View style={[styles.chartCard, { backgroundColor: colors.surface, borderColor: colors.border, marginTop: 16 }]}>
          <View style={styles.chartHeader}>
            <View>
              <Text style={[styles.chartTitle, { color: colors.foreground }]}>This Week</Text>
              <Text style={[styles.chartSubtitle, { color: colors.muted }]}>Daily revenue · last 7 days</Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={{ fontSize: 18, fontWeight: "800", color: colors.foreground }}>
                ${analytics.weekRevenue.toLocaleString()}
              </Text>
              {revenueChange !== 0 && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 3, marginTop: 2 }}>
                  <IconSymbol
                    name={revenueChange > 0 ? "arrow.up.right" : "arrow.down.right"}
                    size={11}
                    color={revenueChange > 0 ? colors.success : colors.error}
                  />
                  <Text style={{ fontSize: 12, fontWeight: "700", color: revenueChange > 0 ? colors.success : colors.error }}>
                    {Math.abs(revenueChange)}% vs last week
                  </Text>
                </View>
              )}
            </View>
          </View>
          <MiniBarChart
            data={analytics.weeklyDailyData}
            height={isTablet ? 220 : 180}
            width={contentWidth - 32}
          />
          {/* Appointment count row below bars */}
          <View style={{ flexDirection: "row", marginTop: 8, paddingHorizontal: 4 }}>
            {analytics.weeklyDailyData.map((d, i) => (
              <View key={i} style={{ flex: 1, alignItems: "center" }}>
                <View style={[
                  { paddingHorizontal: 4, paddingVertical: 2, borderRadius: 6, minWidth: 22, alignItems: "center" },
                  d.apptCount > 0 ? { backgroundColor: d.color + "20" } : {},
                ]}>
                  <Text style={{ fontSize: 10, fontWeight: "700", color: d.apptCount > 0 ? d.color : colors.border }}>
                    {d.apptCount > 0 ? `${d.apptCount}` : "–"}
                  </Text>
                </View>
                <Text style={{ fontSize: 9, color: colors.muted, marginTop: 1 }}>appts</Text>
              </View>
            ))}
          </View>
        </View>
        </Pressable>

        {/* ─── Revenue Trend (6-month) ────────────────────────────── */}
        <Pressable
          onPress={() => router.push({ pathname: "/analytics-detail", params: { tab: "revenue" } } as any)}
          style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
        >
        <View style={[styles.chartCard, { backgroundColor: colors.surface, borderColor: colors.border, marginTop: 12 }]}>
          <View style={styles.chartHeader}>
            <View>
              <Text style={[styles.chartTitle, { color: colors.foreground }]}>Revenue Trend</Text>
              <Text style={[styles.chartSubtitle, { color: colors.muted }]}>Last 6 months</Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={{ fontSize: 18, fontWeight: "800", color: colors.foreground }}>
                ${analytics.monthlyData.reduce((s, d) => s + d.value, 0).toLocaleString()}
              </Text>
              {(() => {
                const months = analytics.monthlyData;
                const prev = months[months.length - 2]?.value ?? 0;
                const curr = months[months.length - 1]?.value ?? 0;
                const pct = prev > 0 ? Math.round(((curr - prev) / prev) * 100) : curr > 0 ? 100 : 0;
                if (pct === 0) return null;
                return (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 3, marginTop: 2 }}>
                    <IconSymbol name={pct > 0 ? "arrow.up.right" : "arrow.down.right"} size={11} color={pct > 0 ? colors.success : colors.error} />
                    <Text style={{ fontSize: 12, fontWeight: "700", color: pct > 0 ? colors.success : colors.error }}>
                      {Math.abs(pct)}% vs last month
                    </Text>
                  </View>
                );
              })()}
            </View>
          </View>
          <MiniBarChart data={analytics.monthlyData} height={isTablet ? 220 : 190} width={contentWidth - 32} />
        </View>
        </Pressable>

        {/* ─── Service Breakdown + Status (side by side) ────────── */}
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
        {/* ─── Birthday Banner ──────────────────────────────────────── */}
        {birthdayClients.length > 0 && (
          <View style={{ marginTop: 20, borderRadius: 16, overflow: "hidden" }}>
            <LinearGradient
              colors={["#FF6B9D", "#FF8E53"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{ padding: 14, borderRadius: 16 }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
                <Text style={{ fontSize: 22, marginRight: 8 }}>🎂</Text>
                <Text style={{ fontSize: 15, fontWeight: "700", color: "#FFF" }}>
                  {birthdayClients.length === 1
                    ? `Today is ${birthdayClients[0].name}'s Birthday!`
                    : `${birthdayClients.length} Clients Have Birthdays Today!`}
                </Text>
              </View>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {birthdayClients.map((c) => (
                  <Pressable
                    key={c.id}
                    onPress={() => router.push({ pathname: "/client-detail", params: { id: c.id } })}
                    style={({ pressed }) => [{
                      backgroundColor: "rgba(255,255,255,0.25)",
                      borderRadius: 20,
                      paddingHorizontal: 12,
                      paddingVertical: 5,
                      opacity: pressed ? 0.7 : 1,
                    }]}
                  >
                    <Text style={{ fontSize: 13, fontWeight: "600", color: "#FFF" }}>{c.name}</Text>
                  </Pressable>
                ))}
              </View>
            </LinearGradient>
          </View>
        )}

        {/* ─── Revenue Forecast Widget ────────────────────────────────── */}
        <View style={[styles.chartCard, { backgroundColor: colors.surface, borderColor: colors.border, marginTop: 24 }]}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <View>
              <Text style={[styles.chartTitle, { color: colors.foreground }]}>{revenueForecast.monthName} Forecast</Text>
              <Text style={[styles.chartSubtitle, { color: colors.muted }]}>Day {revenueForecast.dayOfMonth} of {revenueForecast.daysInMonth}</Text>
            </View>
            <Pressable
              onPress={() => router.push("/(tabs)/settings" as any)}
              style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
            >
              {revenueForecast.goal > 0 ? (
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={{ fontSize: 11, color: colors.muted }}>Goal</Text>
                  <Text style={{ fontSize: 15, fontWeight: "800", color: colors.foreground }}>${revenueForecast.goal.toLocaleString()}</Text>
                </View>
              ) : (
                <View style={{ backgroundColor: colors.primary + "15", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 }}>
                  <Text style={{ fontSize: 12, color: colors.primary, fontWeight: "600" }}>Set Goal</Text>
                </View>
              )}
            </Pressable>
          </View>

          {/* Three stat columns */}
          <View style={{ flexDirection: "row", gap: 8, marginBottom: 14 }}>
            <View style={{ flex: 1, backgroundColor: colors.background, borderRadius: 10, padding: 10, alignItems: "center" }}>
              <Text style={{ fontSize: 11, color: colors.muted, marginBottom: 2 }}>Earned</Text>
              <Text style={{ fontSize: 16, fontWeight: "800", color: colors.foreground }}>${Math.round(revenueForecast.earnedSoFar).toLocaleString()}</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: colors.background, borderRadius: 10, padding: 10, alignItems: "center" }}>
              <Text style={{ fontSize: 11, color: colors.muted, marginBottom: 2 }}>Scheduled</Text>
              <Text style={{ fontSize: 16, fontWeight: "800", color: "#3B82F6" }}>${Math.round(revenueForecast.scheduledRevenue).toLocaleString()}</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: colors.background, borderRadius: 10, padding: 10, alignItems: "center" }}>
              <Text style={{ fontSize: 11, color: colors.muted, marginBottom: 2 }}>Projected</Text>
              <Text style={{ fontSize: 16, fontWeight: "800", color: revenueForecast.goal > 0 && revenueForecast.projected >= revenueForecast.goal ? "#22C55E" : colors.primary }}>
                ${revenueForecast.projected.toLocaleString()}
              </Text>
            </View>
          </View>

          {/* Progress bar — only shown when goal is set */}
          {revenueForecast.goal > 0 && (
            <View>
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
                <Text style={{ fontSize: 11, color: colors.muted }}>Progress toward goal</Text>
                <Text style={{ fontSize: 11, fontWeight: "700", color: revenueForecast.progressPct >= 100 ? "#22C55E" : colors.primary }}>
                  {revenueForecast.progressPct}%
                </Text>
              </View>
              <View style={{ height: 8, backgroundColor: colors.border, borderRadius: 4, overflow: "hidden" }}>
                {/* Projected bar (lighter) */}
                <View style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${revenueForecast.projectedPct}%`, backgroundColor: colors.primary + "40", borderRadius: 4 }} />
                {/* Earned bar (solid) */}
                <View style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${revenueForecast.progressPct}%`, backgroundColor: revenueForecast.progressPct >= 100 ? "#22C55E" : colors.primary, borderRadius: 4 }} />
              </View>
              {revenueForecast.progressPct >= 100 && (
                <Text style={{ fontSize: 12, color: "#22C55E", fontWeight: "700", marginTop: 6, textAlign: "center" }}>🎉 Goal reached!</Text>
              )}
            </View>
          )}
        </View>

        {/* ─── Share Booking Link QR Card ──────────────────────────────────── */}
        <Pressable
          onPress={openQrModal}
          style={({ pressed }) => ({
            marginTop: 20,
            borderRadius: 18,
            overflow: "hidden",
            opacity: pressed ? 0.88 : 1,
            transform: [{ scale: pressed ? 0.99 : 1 }],
          })}
        >
          <LinearGradient
            colors={["#0a7ea4", "#0369a1"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              flexDirection: "row",
              alignItems: "center",
              padding: 16,
              gap: 14,
            }}
          >
            {/* QR preview */}
            <View style={{
              width: 72,
              height: 72,
              borderRadius: 12,
              backgroundColor: "#fff",
              alignItems: "center",
              justifyContent: "center",
              padding: 4,
              flexShrink: 0,
            }}>
              <QRCode
                value={primaryBookingUrl}
                size={60}
                color="#000"
                backgroundColor="#fff"
              />
            </View>
            {/* Text */}
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, fontWeight: "800", color: "#fff", marginBottom: 2 }}>
                Share Booking Link
              </Text>
              <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.75)", lineHeight: 17 }}>
                Tap to view full QR code, copy link, or share with clients
              </Text>
              <View style={{
                flexDirection: "row",
                gap: 6,
                marginTop: 8,
              }}>
                {["Copy Link", "Share", "Full QR"].map((label) => (
                  <View key={label} style={{
                    backgroundColor: "rgba(255,255,255,0.2)",
                    borderRadius: 6,
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                  }}>
                    <Text style={{ fontSize: 10, fontWeight: "700", color: "#fff" }}>{label}</Text>
                  </View>
                ))}
              </View>
            </View>
            <IconSymbol name="chevron.right" size={18} color="rgba(255,255,255,0.6)" />
          </LinearGradient>
        </Pressable>

        {/* ─── Quick Actions ──────────────────────────────────────────────────────── */}
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
              const staffMember = appt.staffId ? state.staff.find((s) => s.id === appt.staffId) : null;
              const apptLocation = appt.locationId ? state.locations.find((l) => l.id === appt.locationId) : null;
              const accentColor = svc?.color ?? colors.primary;
              const statusColor =
                appt.status === "confirmed" ? colors.success
                : appt.status === "pending" ? "#FF9800"
                : appt.status === "completed" ? colors.primary
                : colors.error;
              const timeLabel = `${formatTime(appt.time)} – ${getEndTime(appt.time, appt.duration)}`;
              const clientPhone = client?.phone ? formatPhone(client.phone) : null;
              return (
                <Pressable
                  key={appt.id}
                  onPress={() => router.push({ pathname: "/appointment-detail", params: { id: appt.id } })}
                  style={({ pressed }) => ([
                    {
                      backgroundColor: colors.surface,
                      borderRadius: 14,
                      borderWidth: 1,
                      borderColor: colors.border,
                      borderLeftWidth: 4,
                      borderLeftColor: accentColor,
                      overflow: "hidden",
                      marginBottom: 10,
                      opacity: pressed ? 0.85 : 1,
                      ...(isTablet ? { width: Math.floor((contentWidth - cardGap) / 2) } : {}),
                    },
                  ])}
                >
                  <View style={{ padding: 14, gap: 5 }}>
                    {/* Row 1: time range (left) + status badge (right) */}
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                      <Text style={{ fontSize: 14, fontWeight: "700", color: colors.foreground, flex: 1, marginRight: 8 }} numberOfLines={1}>
                        {timeLabel}
                      </Text>
                      <View style={{ backgroundColor: statusColor + "22", paddingHorizontal: 9, paddingVertical: 3, borderRadius: 8, flexShrink: 0 }}>
                        <Text style={{ fontSize: 11, fontWeight: "700", color: statusColor }}>
                          {appt.status.charAt(0).toUpperCase() + appt.status.slice(1)}
                        </Text>
                      </View>
                    </View>
                    {/* Row 2: service name + duration */}
                    <Text style={{ fontSize: 14, fontWeight: "600", color: colors.foreground }} numberOfLines={1}>
                      {svc ? `${svc.name} (${appt.duration ?? svc.duration} min)` : "Service"}
                    </Text>
                    {/* Row 3: client name · phone + staff */}
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                      <Text style={{ fontSize: 13, color: colors.muted, flex: 1, marginRight: 8 }} numberOfLines={1}>
                        {client?.name ?? "Client"}{clientPhone ? ` · ${clientPhone}` : ""}
                      </Text>
                      {staffMember ? (
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 5, flexShrink: 0 }}>
                          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: accentColor }} />
                          <Text style={{ fontSize: 13, color: accentColor, fontWeight: "600" }} numberOfLines={1}>
                            {staffMember.name}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                    {/* Row 4: location badge — shown only in All Locations mode */}
                    {!selectedLocationFilter && apptLocation && (
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
                        <IconSymbol name="mappin.circle.fill" size={12} color={colors.muted} />
                        <Text style={{ fontSize: 12, color: colors.muted }} numberOfLines={1}>{apptLocation.name}</Text>
                      </View>
                    )}
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
        {/* ─── Upcoming Appointments ──────────────────────────────── */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 28, marginBottom: 12 }}>
          <Text style={[styles.sectionTitle, { color: colors.foreground, marginBottom: 0 }]}>Upcoming</Text>
          <View style={{ backgroundColor: colors.primary + "20", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 }}>
            <Text style={{ fontSize: 12, fontWeight: "700", color: colors.primary }}>{upcomingAppointments.length} scheduled</Text>
          </View>
        </View>
        {upcomingAppointments.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border, paddingVertical: 24 }]}>
            <IconSymbol name="calendar.badge.checkmark" size={32} color={colors.primary + "60"} />
            <Text style={{ color: colors.foreground, fontSize: 15, fontWeight: "600", marginTop: 10 }}>No upcoming appointments</Text>
            <Text style={{ color: colors.muted, fontSize: 13, marginTop: 4, textAlign: "center" }}>All clear — add a booking to see it here.</Text>
          </View>
        ) : (
          <View style={isTablet ? { flexDirection: "row", flexWrap: "wrap", gap: cardGap } : { gap: 10 }}>
            {upcomingAppointments.map((appt) => {
              const svc = getServiceById(appt.serviceId);
              const client = getClientById(appt.clientId);
              const staffMember = appt.staffId ? state.staff.find((s) => s.id === appt.staffId) : null;
              const apptLocation = appt.locationId ? state.locations.find((l) => l.id === appt.locationId) : null;
              const isToday = appt.date === todayStr;
              const apptDate = new Date(appt.date + "T00:00:00");
              const dayLabel = isToday
                ? "TODAY"
                : apptDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }).toUpperCase();
              const accentColor = svc?.color ?? colors.primary;
              const statusColor =
                appt.status === "confirmed" ? colors.success
                : appt.status === "pending" ? "#FF9800"
                : appt.status === "completed" ? colors.primary
                : colors.error;
              const price = appt.totalPrice ?? svc?.price ?? null;
              // Format date · time range line: "Mon, Apr 13 · 2:30 PM – 3:30 PM"
              const dateTimeLabel = `${apptDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} · ${formatTime(appt.time)} – ${getEndTime(appt.time, appt.duration)}`;
              const clientPhone = client?.phone ? formatPhone(client.phone) : null;
              return (
                <Pressable
                  key={appt.id}
                  onPress={() => router.push({ pathname: "/appointment-detail", params: { id: appt.id } })}
                  style={({ pressed }) => ([
                    {
                      backgroundColor: colors.surface,
                      borderRadius: 14,
                      borderWidth: 1,
                      borderColor: colors.border,
                      borderLeftWidth: 4,
                      borderLeftColor: accentColor,
                      overflow: "hidden",
                      opacity: pressed ? 0.85 : 1,
                      ...(isTablet ? { width: Math.floor((contentWidth - cardGap) / 2) } : {}),
                    },
                  ])}
                >
                  <View style={{ padding: 14, gap: 5 }}>
                    {/* Row 1: date·time range (left) + status badge (right) */}
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                      <Text style={{ fontSize: 14, fontWeight: "700", color: colors.foreground, flex: 1, marginRight: 8 }} numberOfLines={1}>
                        {dateTimeLabel}
                      </Text>
                      <View style={{
                        backgroundColor: statusColor + "22",
                        paddingHorizontal: 9,
                        paddingVertical: 3,
                        borderRadius: 8,
                        flexShrink: 0,
                      }}>
                        <Text style={{ fontSize: 11, fontWeight: "700", color: statusColor }}>
                          {appt.status.charAt(0).toUpperCase() + appt.status.slice(1)}
                        </Text>
                      </View>
                    </View>
                    {/* Row 2: service name + duration */}
                    <Text style={{ fontSize: 14, fontWeight: "600", color: colors.foreground }} numberOfLines={1}>
                      {svc ? `${svc.name} (${appt.duration ?? svc.duration} min)` : "Service"}
                    </Text>
                    {/* Row 3: client name · phone + staff dot */}
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                      <Text style={{ fontSize: 13, color: colors.muted, flex: 1, marginRight: 8 }} numberOfLines={1}>
                        {client?.name ?? "Client"}{clientPhone ? ` · ${clientPhone}` : ""}
                      </Text>
                      {staffMember ? (
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 5, flexShrink: 0 }}>
                          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: accentColor }} />
                          <Text style={{ fontSize: 13, color: accentColor, fontWeight: "600" }} numberOfLines={1}>
                            {staffMember.name}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                    {/* Row 4: location badge — shown only in All Locations mode */}
                    {!selectedLocationFilter && apptLocation && (
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
                        <IconSymbol name="mappin.circle.fill" size={12} color={colors.muted} />
                        <Text style={{ fontSize: 12, color: colors.muted }} numberOfLines={1}>{apptLocation.name}</Text>
                      </View>
                    )}
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
      {showTutorial && (
        <TourOverlay
          step={tutorialStep}
          steps={TOUR_TAB_STEPS}
          fadeAnim={tutorialFade}
          colors={colors}
          isDark={isDark}
          tutorialCardBg={tutorialCardBg}
          tutorialCardBorder={tutorialCardBorder}
          tutorialTitleColor={tutorialTitleColor}
          tutorialDescColor={tutorialDescColor}
          tutorialPrevBorderColor={tutorialPrevBorderColor}
          tutorialPrevTextColor={tutorialPrevTextColor}
          tutorialSkipTextColor={tutorialSkipTextColor}
          tutorialProgressTrackBg={tutorialProgressTrackBg}
          onNext={nextTutorialStep}
          onPrev={prevTutorialStep}
          onSkip={dismissTutorial}
          onSetupLocation={() => {
            dismissTutorial();
            router.push("/location-form" as any);
          }}
        />
      )}

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

      {/* ─── QR Booking Link Modal ───────────────────────────────────────── */}
      <Modal visible={showQrModal} transparent animationType="fade" onRequestClose={() => setShowQrModal(false)}>
        <Pressable
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center", padding: 24 }}
          onPress={() => setShowQrModal(false)}
        >
          <View
            style={[{
              borderRadius: 24,
              padding: 24,
              alignItems: "center",
              width: "100%",
              maxWidth: 340,
              gap: 16,
            }, { backgroundColor: colors.surface }]}
            onStartShouldSetResponder={() => true}
            onTouchEnd={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <View style={{ flexDirection: "row", alignItems: "center", width: "100%", marginBottom: 4 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 18, fontWeight: "800", color: colors.foreground }}>Booking QR Code</Text>
                <Text style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>{state.settings.businessName}</Text>
              </View>
              <Pressable
                onPress={() => setShowQrModal(false)}
                style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.border, alignItems: "center", justifyContent: "center" }}
              >
                <IconSymbol name="xmark.circle.fill" size={18} color={colors.muted} />
              </Pressable>
            </View>

            {/* Per-location picker — only shown when multiple locations exist */}
            {state.locations.filter((l) => l.active).length > 1 && (
              <View style={{ width: "100%" }}>
                <Text style={{ fontSize: 12, fontWeight: "600", color: colors.muted, marginBottom: 6 }}>Select location for QR code</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={{ flexDirection: "row", gap: 6 }}>
                    <Pressable
                      onPress={() => setQrSelectedLocationId(null)}
                      style={({ pressed }) => ({
                        paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, borderWidth: 1.5,
                        backgroundColor: qrSelectedLocationId === null ? colors.primary + "18" : colors.background,
                        borderColor: qrSelectedLocationId === null ? colors.primary : colors.border,
                        opacity: pressed ? 0.7 : 1,
                      })}
                    >
                      <Text style={{ fontSize: 12, fontWeight: "700", color: qrSelectedLocationId === null ? colors.primary : colors.muted }}>All Locations</Text>
                    </Pressable>
                    {state.locations.filter((l) => l.active).map((loc) => (
                      <Pressable
                        key={loc.id}
                        onPress={() => setQrSelectedLocationId(loc.id)}
                        style={({ pressed }) => ({
                          paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, borderWidth: 1.5,
                          backgroundColor: qrSelectedLocationId === loc.id ? colors.primary + "18" : colors.background,
                          borderColor: qrSelectedLocationId === loc.id ? colors.primary : colors.border,
                          opacity: pressed ? 0.7 : 1,
                        })}
                      >
                        <Text style={{ fontSize: 12, fontWeight: "700", color: qrSelectedLocationId === loc.id ? colors.primary : colors.muted }}>{loc.name}</Text>
                      </Pressable>
                    ))}
                  </View>
                </ScrollView>
                {qrSelectedLocationId && (() => {
                  const selLoc = state.locations.find((l) => l.id === qrSelectedLocationId);
                  const addr = selLoc ? formatFullAddress(selLoc.address, selLoc.city, selLoc.state, selLoc.zipCode) : null;
                  return addr ? <Text style={{ fontSize: 11, color: colors.muted, marginTop: 4 }} numberOfLines={1}>📍 {addr}</Text> : null;
                })()}
              </View>
            )}

            {/* Large QR Code — unique per selected location */}
            <View style={{
              width: 220, height: 220, backgroundColor: "#fff", borderRadius: 16,
              alignItems: "center", justifyContent: "center", padding: 12,
              shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1, shadowRadius: 8, elevation: 4,
            }}>
              <QRCode value={qrBookingUrl} size={196} color="#000" backgroundColor="#fff" />
            </View>

            {/* URL pill */}
            <View style={[{ borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, width: "100%" }, { backgroundColor: colors.background }]}>
              <Text style={{ fontSize: 11, color: colors.muted, textAlign: "center" }} numberOfLines={2}>
                {qrBookingUrl}
              </Text>
            </View>

            {/* Action buttons */}
            <View style={{ flexDirection: "row", gap: 10, width: "100%" }}>
              <Pressable
                onPress={async () => {
                  const { default: Clipboard } = await import("expo-clipboard");
                  await Clipboard.setStringAsync(qrBookingUrl);
                  Alert.alert("Copied!", "Booking link copied to clipboard.");
                }}
                style={({ pressed }) => [{
                  flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
                  gap: 6, paddingVertical: 12, borderRadius: 12, opacity: pressed ? 0.8 : 1,
                }, { backgroundColor: colors.border }]}
              >
                <IconSymbol name="doc.on.doc.fill" size={16} color={colors.foreground} />
                <Text style={{ fontSize: 13, fontWeight: "700", color: colors.foreground }}>Copy Link</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  const selectedLoc = qrSelectedLocationId
                    ? state.locations.find((l) => l.id === qrSelectedLocationId) ?? null
                    : null;
                  setShowQrModal(false);
                  setTimeout(() => doShareForLocation(selectedLoc), 300);
                }}
                style={({ pressed }) => [{
                  flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
                  gap: 6, paddingVertical: 12, borderRadius: 12, opacity: pressed ? 0.8 : 1,
                }, { backgroundColor: colors.primary }]}
              >
                <IconSymbol name="paperplane.fill" size={16} color="#fff" />
                <Text style={{ fontSize: 13, fontWeight: "700", color: "#fff" }}>Share</Text>
              </Pressable>
            </View>

            <Text style={{ fontSize: 11, color: colors.muted, textAlign: "center" }}>
              Display at your counter or print for clients to scan
            </Text>
          </View>
        </Pressable>
      </Modal>

      {/* ─── KPI Detail Sheet ──────────────────────────────────────────── */}
      <KpiDetailSheet
        visible={kpiDetailTab !== null}
        tab={kpiDetailTab}
        onClose={() => setKpiDetailTab(null)}
        onExport={handleKpiExport}
        revenueData={{
          weekRevenue: analytics.weekRevenue,
          prevWeekRevenue: analytics.prevWeekRevenue,
          totalRevenue: analytics.totalRevenue,
          monthlyData: analytics.monthlyData,
          weeklyDailyData: analytics.weeklyDailyData,
          serviceBreakdown: analytics.serviceBreakdown,
        }}
        appointmentsData={{
          totalAppointments: analytics.totalAppointments,
          statusCounts: analytics.statusCounts,
          weeklyDailyData: analytics.weeklyDailyData,
          serviceBreakdown: analytics.serviceBreakdown,
        }}
        clientsData={kpiClientsData}
        topServiceData={{
          topService: analytics.topService,
          topCount: analytics.topCount,
          serviceRanking: kpiServiceRanking,
        }}
      />
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
    alignItems: "stretch",
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

  // ─── Tutorial Walkthrough (kept for legacy ref) ───────────────
  tutorialOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  tutorialCard: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 24,
    borderWidth: 1,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.4,
    shadowRadius: 32,
    elevation: 12,
  },
  tutorialProgressTrack: {
    height: 3,
    width: "100%",
  },
  tutorialProgressBar: {
    height: 3,
    borderRadius: 2,
  },
  tutorialTitle: {
    fontSize: 20,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 8,
    paddingHorizontal: 20,
    letterSpacing: -0.3,
  },
  tutorialDesc: {
    fontSize: 14,
    lineHeight: 22,
    textAlign: "center",
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  tutorialActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  tutorialSkipBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
  },
  tutorialPrevBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
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
