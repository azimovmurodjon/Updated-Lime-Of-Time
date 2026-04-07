import { useMemo, useEffect, useCallback } from "react";
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
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useStore, formatTime, formatDateStr } from "@/lib/store";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useRouter } from "expo-router";
import { minutesToTime, timeToMinutes, PUBLIC_BOOKING_URL } from "@/lib/types";
import * as ImagePicker from "expo-image-picker";
import { MiniBarChart, MiniDonutChart } from "@/components/mini-chart";

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
  const { state, dispatch, getServiceById, getClientById, getAppointmentsForDate, syncToDb } =
    useStore();
  const colors = useColors();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const hp = Math.round(Math.max(16, width * 0.045));
  const contentWidth = width - hp * 2;
  const cardGap = 12;
  const cardW = Math.floor((contentWidth - cardGap) / 2);

  useEffect(() => {
    if (state.loaded && !state.settings.onboardingComplete) {
      router.replace("/onboarding");
    }
  }, [state.loaded, state.settings.onboardingComplete]);

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

  const todayAppts = getAppointmentsForDate(todayStr);

  // ─── Analytics ──────────────────────────────────────────────────
  const analytics = useMemo(() => {
    const totalClients = state.clients.length;
    const activeAppts = state.appointments.filter((a) => a.status !== "cancelled");
    const totalAppointments = activeAppts.length;
    const completedAppts = state.appointments.filter((a) => a.status === "completed");
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
      pending: state.appointments.filter((a) => a.status === "pending").length,
      confirmed: state.appointments.filter((a) => a.status === "confirmed").length,
      completed: completedAppts.length,
      cancelled: state.appointments.filter((a) => a.status === "cancelled").length,
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
  }, [state.clients, state.appointments, state.services]);

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

  const handleShareBookingLink = useCallback(async () => {
    const slug = state.settings.businessName.replace(/\s+/g, "-").toLowerCase();
    const url = `${PUBLIC_BOOKING_URL}/book/${slug}`;
    const profile = state.settings.profile;
    const addressLine = profile.address ? `\n📍 ${profile.address}` : "";
    const phoneLine = profile.phone ? `\n📞 ${profile.phone}` : "";
    const websiteLine = profile.website ? `\n🌐 ${profile.website}` : "";
    try {
      await Share.share({
        message: `Book an appointment with ${state.settings.businessName}!${addressLine}${phoneLine}${websiteLine}\n\nSchedule online: ${url}\n\nPowered by Lime Of Time`,
        title: "Book an Appointment",
      });
    } catch {}
  }, [state.settings.businessName, state.settings.profile]);

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
    <ScreenContainer>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: hp,
          paddingTop: 8,
          paddingBottom: 100,
        }}
      >
        {/* ─── Business Header ──────────────────────────────────── */}
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

        <Text style={[styles.dateLabel, { color: colors.muted }]}>{dateLabel}</Text>

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

        {/* Temporary Closed Banner */}
        {state.settings.temporaryClosed && (
          <View
            style={[
              styles.closedBanner,
              {
                backgroundColor: colors.error + "10",
                borderColor: colors.error + "30",
              },
            ]}
          >
            <Text style={{ fontSize: 13, color: colors.error, fontWeight: "500" }}>
              Business is temporarily closed. New bookings are paused.
            </Text>
          </View>
        )}

        {/* ─── KPI Cards (2x2 grid) ────────────────────────────── */}
        <Text style={[styles.sectionTitle, { color: colors.foreground, marginTop: 20 }]}>
          Overview
        </Text>
        <View style={[styles.kpiGrid, { gap: cardGap }]}>
          {/* Revenue */}
          <Pressable
            onPress={() =>
              router.push({ pathname: "/analytics-detail", params: { tab: "revenue" } })
            }
            style={({ pressed }) => [
              styles.kpiCard,
              {
                width: cardW,
                backgroundColor: colors.surface,
                borderColor: colors.border,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <View style={styles.kpiHeader}>
              <View style={[styles.kpiIconBg, { backgroundColor: "#FF980020" }]}>
                <IconSymbol name="dollarsign.circle.fill" size={20} color="#FF9800" />
              </View>
              {revenueChange !== 0 && (
                <View
                  style={[
                    styles.changeBadge,
                    {
                      backgroundColor:
                        revenueChange > 0
                          ? colors.success + "15"
                          : colors.error + "15",
                    },
                  ]}
                >
                  <IconSymbol
                    name="arrow.up.right"
                    size={10}
                    color={revenueChange > 0 ? colors.success : colors.error}
                  />
                  <Text
                    style={{
                      fontSize: 10,
                      fontWeight: "700",
                      color: revenueChange > 0 ? colors.success : colors.error,
                    }}
                  >
                    {Math.abs(revenueChange)}%
                  </Text>
                </View>
              )}
            </View>
            <Text style={[styles.kpiValue, { color: colors.foreground }]}>
              ${analytics.weekRevenue.toLocaleString()}
            </Text>
            <Text style={[styles.kpiLabel, { color: colors.muted }]}>This Week</Text>
            <Text style={[styles.kpiTotal, { color: colors.muted }]}>
              ${analytics.totalRevenue.toLocaleString()} total
            </Text>
          </Pressable>

          {/* Appointments */}
          <Pressable
            onPress={() =>
              router.push({
                pathname: "/analytics-detail",
                params: { tab: "appointments" },
              })
            }
            style={({ pressed }) => [
              styles.kpiCard,
              {
                width: cardW,
                backgroundColor: colors.surface,
                borderColor: colors.border,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <View style={[styles.kpiIconBg, { backgroundColor: "#2196F320" }]}>
              <IconSymbol name="calendar" size={20} color="#2196F3" />
            </View>
            <Text style={[styles.kpiValue, { color: colors.foreground }]}>
              {analytics.totalAppointments}
            </Text>
            <Text style={[styles.kpiLabel, { color: colors.muted }]}>Appointments</Text>
            <View style={styles.miniStatRow}>
              <View style={[styles.miniStat, { backgroundColor: "#FF980015" }]}>
                <Text style={{ fontSize: 10, fontWeight: "700", color: "#FF9800" }}>
                  {analytics.statusCounts.pending}
                </Text>
                <Text style={{ fontSize: 9, color: "#FF9800" }}>Pending</Text>
              </View>
              <View style={[styles.miniStat, { backgroundColor: colors.success + "15" }]}>
                <Text style={{ fontSize: 10, fontWeight: "700", color: colors.success }}>
                  {analytics.statusCounts.confirmed}
                </Text>
                <Text style={{ fontSize: 9, color: colors.success }}>Active</Text>
              </View>
            </View>
          </Pressable>

          {/* Clients */}
          <Pressable
            onPress={() =>
              router.push({ pathname: "/analytics-detail", params: { tab: "clients" } })
            }
            style={({ pressed }) => [
              styles.kpiCard,
              {
                width: cardW,
                backgroundColor: colors.surface,
                borderColor: colors.border,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <View style={[styles.kpiIconBg, { backgroundColor: "#4CAF5020" }]}>
              <IconSymbol name="person.2.fill" size={20} color="#4CAF50" />
            </View>
            <Text style={[styles.kpiValue, { color: colors.foreground }]}>
              {analytics.totalClients}
            </Text>
            <Text style={[styles.kpiLabel, { color: colors.muted }]}>Total Clients</Text>
          </Pressable>

          {/* Top Service */}
          <Pressable
            onPress={() =>
              router.push({
                pathname: "/analytics-detail",
                params: { tab: "topservice" },
              })
            }
            style={({ pressed }) => [
              styles.kpiCard,
              {
                width: cardW,
                backgroundColor: colors.surface,
                borderColor: colors.border,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <View style={[styles.kpiIconBg, { backgroundColor: "#9C27B020" }]}>
              <IconSymbol name="crown.fill" size={20} color="#9C27B0" />
            </View>
            <Text
              style={[styles.kpiValue, { color: colors.foreground }]}
              numberOfLines={1}
            >
              {analytics.topService?.name ?? "N/A"}
            </Text>
            <Text style={[styles.kpiLabel, { color: colors.muted }]}>Top Service</Text>
            {analytics.topCount > 0 && (
              <Text style={{ fontSize: 11, color: colors.muted, marginTop: 2 }}>
                {analytics.topCount} bookings
              </Text>
            )}
          </Pressable>
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
        <Text style={[styles.sectionTitle, { color: colors.foreground, marginTop: 24 }]}>
          Today's Schedule
        </Text>
        {todayAppts.length === 0 ? (
          <View
            style={[
              styles.emptyCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <IconSymbol name="calendar" size={36} color={colors.muted + "60"} />
            <Text style={{ color: colors.muted, fontSize: 14, marginTop: 8 }}>
              No appointments today
            </Text>
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
          todayAppts.map((appt) => {
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
                  },
                ]}
              >
                <View style={styles.apptRow}>
                  <View style={styles.apptInfo}>
                    <Text style={[styles.apptTime, { color: colors.foreground }]}>
                      {formatTime(appt.time)} - {getEndTime(appt.time, appt.duration)}
                    </Text>
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
          })
        )}
      </ScrollView>

      {/* FAB */}
      <Pressable
        onPress={() => router.push("/new-booking")}
        style={({ pressed }) => [
          styles.fab,
          { backgroundColor: colors.primary, right: hp, opacity: pressed ? 0.85 : 1 },
        ]}
      >
        <IconSymbol name="plus" size={28} color="#FFF" />
      </Pressable>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  // ─── Header ──────────────────────────────────────────────
  businessHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
    paddingTop: 4,
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
    fontWeight: "500",
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },

  // ─── FAB ─────────────────────────────────────────────────
  fab: {
    position: "absolute",
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
});
