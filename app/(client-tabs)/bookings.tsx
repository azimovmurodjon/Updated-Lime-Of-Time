/**
 * Client Portal — My Bookings Tab
 *
 * Lists all client appointments grouped by status with filter tabs.
 */

import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useClientStore, ClientAppointment } from "@/lib/client-store";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { FuturisticBackground } from "@/components/futuristic-background";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  Easing,
  runOnJS,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import * as Haptics from "expo-haptics";

type FilterTab = "upcoming" | "past" | "all";

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

function statusColor(status: ClientAppointment["status"], colors: ReturnType<typeof useColors>) {
  switch (status) {
    case "confirmed": return colors.success;
    case "pending": return colors.warning;
    case "completed": return colors.muted;
    case "cancelled":
    case "no_show": return colors.error;
    default: return colors.muted;
  }
}

function statusLabel(status: ClientAppointment["status"]): string {
  switch (status) {
    case "confirmed": return "Confirmed";
    case "pending": return "Pending";
    case "completed": return "Completed";
    case "cancelled": return "Cancelled";
    case "no_show": return "No Show";
    default: return status;
  }
}

function isUpcoming(appt: ClientAppointment): boolean {
  return appt.status === "confirmed" || appt.status === "pending";
}

export default function BookingsScreen() {
  const colors = useColors();
  const router = useRouter();
  const { state, dispatch, apiCall } = useClientStore();
  const [activeTab, setActiveTab] = useState<FilterTab>("upcoming");
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadAppointments = useCallback(async (silent = false) => {
    if (!state.account) return;
    if (!silent) setLoading(true);
    try {
      const appts = await apiCall<ClientAppointment[]>("/api/client/appointments");
      dispatch({ type: "SET_APPOINTMENTS", payload: appts });
    } catch (err) {
      console.warn("[Bookings] load error:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [state.account, apiCall, dispatch]);

  useFocusEffect(useCallback(() => { loadAppointments(true); }, [loadAppointments]));

  const onRefresh = () => { setRefreshing(true); loadAppointments(); };

  const filteredAppts = state.appointments.filter((a) => {
    if (activeTab === "upcoming") return isUpcoming(a);
    if (activeTab === "past") return !isUpcoming(a);
    return true;
  }).sort((a, b) => {
    if (activeTab === "upcoming") return a.date.localeCompare(b.date);
    return b.date.localeCompare(a.date);
  });

  // Entrance animation
  const headerOpacity = useSharedValue(0);
  const headerY = useSharedValue(-16);
  React.useEffect(() => {
    headerOpacity.value = withTiming(1, { duration: 400, easing: Easing.out(Easing.cubic) });
    headerY.value = withSpring(0, { damping: 18, stiffness: 120 });
  }, []);
  const headerStyle = useAnimatedStyle(() => ({
    opacity: headerOpacity.value,
    transform: [{ translateY: headerY.value }],
  }));

  const s = styles(colors);

  if (!state.account) {
    return (
      <ScreenContainer className="px-6">
        <FuturisticBackground />
        <View style={s.guestContainer}>
          <IconSymbol name="calendar" size={40} color={colors.muted} />
          <Text style={[s.guestTitle, { color: colors.foreground }]}>Sign in to see your bookings</Text>
          <Pressable
            style={({ pressed }) => [s.signInBtn, pressed && { opacity: 0.85 }]}
            onPress={() => router.push("/client-signin" as any)}
          >
            <Text style={s.signInBtnText}>Sign In</Text>
          </Pressable>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <FuturisticBackground />
      {/* Header */}
      <Animated.View style={[s.header, headerStyle]}>
        <Text style={s.title}>My Bookings</Text>
      </Animated.View>

      {/* Filter Tabs */}
      <View style={[s.tabRow, { borderBottomColor: colors.border }]}>
        {(["upcoming", "past", "all"] as FilterTab[]).map((tab) => (
          <Pressable
            key={tab}
            style={[s.tab, activeTab === tab && { borderBottomColor: "#8B5CF6", borderBottomWidth: 2 }]}
            onPress={() => {
              if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setActiveTab(tab);
            }}
          >
            <Text style={[s.tabText, { color: activeTab === tab ? "#8B5CF6" : colors.muted }]}>
              {tab === "upcoming" ? "Upcoming" : tab === "past" ? "Past" : "All"}
            </Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <View style={s.loadingContainer}>
          <ActivityIndicator color="#8B5CF6" />
        </View>
      ) : (
        <FlatList
          data={filteredAppts}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32, paddingTop: 12 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#8B5CF6" />}
          ListEmptyComponent={
            <View style={s.emptyContainer}>
              <IconSymbol name="calendar" size={36} color={colors.muted} />
              <Text style={[s.emptyTitle, { color: colors.foreground }]}>
                {activeTab === "upcoming" ? "No upcoming appointments" : "No appointments yet"}
              </Text>
              {activeTab === "upcoming" && (
                <Pressable
                  style={({ pressed }) => [s.bookNowBtn, pressed && { opacity: 0.85 }]}
                  onPress={() => router.push("/(client-tabs)/discover" as any)}
                >
                  <Text style={s.bookNowBtnText}>Book Now</Text>
                </Pressable>
              )}
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [
                s.apptCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
                pressed && { opacity: 0.85 },
              ]}
              onPress={() => {
                if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push({ pathname: "/client-appointment-detail", params: { id: String(item.id) } } as any);
              }}
            >
              <View style={s.apptTop}>
                <View style={s.apptInfo}>
                  <Text style={[s.apptService, { color: colors.foreground }]}>{item.serviceName}</Text>
                  <Text style={[s.apptBusiness, { color: "#8B5CF6" }]}>{item.businessName}</Text>
                </View>
                <View style={[s.statusBadge, { backgroundColor: statusColor(item.status, colors) + "20" }]}>
                  <Text style={[s.statusText, { color: statusColor(item.status, colors) }]}>
                    {statusLabel(item.status)}
                  </Text>
                </View>
              </View>
              <View style={[s.apptDivider, { backgroundColor: colors.border }]} />
              <View style={s.apptMeta}>
                <View style={s.metaItem}>
                  <IconSymbol name="calendar" size={13} color={colors.muted} />
                  <Text style={[s.metaText, { color: colors.muted }]}>{formatDate(item.date)}</Text>
                </View>
                <View style={s.metaItem}>
                  <IconSymbol name="clock" size={13} color={colors.muted} />
                  <Text style={[s.metaText, { color: colors.muted }]}>{item.time}</Text>
                </View>
                {item.staffName && (
                  <View style={s.metaItem}>
                    <IconSymbol name="person.fill" size={13} color={colors.muted} />
                    <Text style={[s.metaText, { color: colors.muted }]}>{item.staffName}</Text>
                  </View>
                )}
              </View>
              {/* Cancel/Reschedule request badge */}
              {(item.cancelRequest?.status === "pending" || item.rescheduleRequest?.status === "pending") && (
                <View style={[s.requestBadge, { backgroundColor: colors.warning + "20" }]}>
                  <IconSymbol name="clock" size={12} color={colors.warning} />
                  <Text style={[s.requestBadgeText, { color: colors.warning }]}>
                    {item.cancelRequest?.status === "pending" ? "Cancel request pending" : "Reschedule request pending"}
                  </Text>
                </View>
              )}
            </Pressable>
          )}
        />
      )}
    </ScreenContainer>
  );
}

const styles = (colors: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    header: {
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 8,
    },
    title: {
      fontSize: 24,
      fontWeight: "700",
      color: colors.foreground,
    },
    tabRow: {
      flexDirection: "row",
      borderBottomWidth: 1,
      marginHorizontal: 16,
    },
    tab: {
      flex: 1,
      alignItems: "center",
      paddingVertical: 10,
      borderBottomWidth: 2,
      borderBottomColor: "transparent",
    },
    tabText: {
      fontSize: 14,
      fontWeight: "600",
    },
    loadingContainer: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    emptyContainer: {
      alignItems: "center",
      paddingTop: 60,
      gap: 12,
    },
    emptyTitle: {
      fontSize: 16,
      fontWeight: "600",
    },
    bookNowBtn: {
      backgroundColor: "#8B5CF6",
      paddingHorizontal: 28,
      paddingVertical: 12,
      borderRadius: 24,
      marginTop: 4,
    },
    bookNowBtnText: {
      color: "#FFFFFF",
      fontSize: 15,
      fontWeight: "700",
    },
    apptCard: {
      borderRadius: 16,
      borderWidth: 1,
      padding: 14,
      marginBottom: 12,
      gap: 10,
    },
    apptTop: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
    },
    apptInfo: {
      flex: 1,
      gap: 3,
    },
    apptService: {
      fontSize: 15,
      fontWeight: "700",
    },
    apptBusiness: {
      fontSize: 13,
      fontWeight: "600",
    },
    statusBadge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 20,
      marginLeft: 10,
    },
    statusText: {
      fontSize: 11,
      fontWeight: "700",
    },
    apptDivider: {
      height: 1,
    },
    apptMeta: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 12,
    },
    metaItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    metaText: {
      fontSize: 12,
    },
    requestBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
    },
    requestBadgeText: {
      fontSize: 12,
      fontWeight: "600",
    },
    guestContainer: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: 16,
    },
    guestTitle: {
      fontSize: 16,
      fontWeight: "600",
      textAlign: "center",
    },
    signInBtn: {
      backgroundColor: "#8B5CF6",
      paddingHorizontal: 32,
      paddingVertical: 12,
      borderRadius: 24,
    },
    signInBtnText: {
      color: "#FFFFFF",
      fontSize: 15,
      fontWeight: "700",
    },
  });
