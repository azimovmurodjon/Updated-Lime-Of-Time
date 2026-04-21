/**
 * Client Portal — Dashboard (Home Tab)
 *
 * Shows upcoming appointments, saved businesses, quick-book shortcuts,
 * and a welcome banner for signed-out users.
 */

import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
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
import * as Haptics from "expo-haptics";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
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

// ─── Component ────────────────────────────────────────────────────────────────

export default function ClientHomeScreen() {
  const colors = useColors();
  const router = useRouter();
  const { state, dispatch, apiCall } = useClientStore();
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const isSignedIn = !!state.account;

  const loadData = useCallback(async (silent = false) => {
    if (!isSignedIn) return;
    if (!silent) setLoading(true);
    try {
      const [appts, saved] = await Promise.all([
        apiCall<ClientAppointment[]>("/api/client/appointments"),
        apiCall<any[]>("/api/client/saved-businesses"),
      ]);
      dispatch({ type: "SET_APPOINTMENTS", payload: appts });
      dispatch({ type: "SET_SAVED_BUSINESSES", payload: saved });
      // Count unread messages
      const msgs = await apiCall<{ unreadCount: number }>("/api/client/messages/unread-count");
      dispatch({ type: "SET_UNREAD_COUNT", payload: msgs.unreadCount });
    } catch (err) {
      console.warn("[ClientHome] load error:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isSignedIn, apiCall, dispatch]);

  useFocusEffect(useCallback(() => { loadData(true); }, [loadData]));

  const onRefresh = () => { setRefreshing(true); loadData(); };

  const upcoming = state.appointments
    .filter((a) => a.status === "confirmed" || a.status === "pending")
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 5);

  const s = styles(colors);

  // ── Not signed in ──────────────────────────────────────────────────────────
  if (!isSignedIn) {
    return (
      <ScreenContainer className="px-6">
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }}>
          <View style={s.guestContainer}>
            <View style={s.guestIcon}>
              <IconSymbol name="calendar" size={48} color="#8B5CF6" />
            </View>
            <Text style={s.guestTitle}>Book Appointments{"\n"}Near You</Text>
            <Text style={s.guestSubtitle}>
              Discover local services, book instantly, and manage all your appointments in one place.
            </Text>
            <Pressable
              style={({ pressed }) => [s.primaryBtn, pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] }]}
              onPress={() => {
                if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push("/client-signin" as any);
              }}
            >
              <Text style={s.primaryBtnText}>Get Started</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [s.secondaryBtn, pressed && { opacity: 0.7 }]}
              onPress={() => router.push("/(client-tabs)/discover" as any)}
            >
              <Text style={[s.secondaryBtnText, { color: "#8B5CF6" }]}>Browse Without Account</Text>
            </Pressable>
          </View>
        </ScrollView>
      </ScreenContainer>
    );
  }

  // ── Signed in ──────────────────────────────────────────────────────────────
  return (
    <ScreenContainer>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {/* Header */}
        <View style={s.header}>
          <View>
            <Text style={s.greeting}>Hello, {state.account?.name?.split(" ")[0] ?? "there"} 👋</Text>
            <Text style={[s.greetingSub, { color: colors.muted }]}>What are you booking today?</Text>
          </View>
          <Pressable
            style={({ pressed }) => [s.avatarBtn, { backgroundColor: "#8B5CF620" }, pressed && { opacity: 0.7 }]}
            onPress={() => router.push("/(client-tabs)/profile" as any)}
          >
            <IconSymbol name="person.crop.circle.fill" size={32} color="#8B5CF6" />
          </Pressable>
        </View>

        {/* Quick Actions */}
        <View style={s.quickActions}>
          <Pressable
            style={({ pressed }) => [s.quickBtn, { backgroundColor: "#8B5CF6" }, pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] }]}
            onPress={() => router.push("/(client-tabs)/discover" as any)}
          >
            <IconSymbol name="safari.fill" size={20} color="#FFFFFF" />
            <Text style={[s.quickBtnText, { color: "#FFFFFF" }]}>Discover</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [s.quickBtn, { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }, pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] }]}
            onPress={() => router.push("/(client-tabs)/bookings" as any)}
          >
            <IconSymbol name="calendar" size={20} color={colors.foreground} />
            <Text style={[s.quickBtnText, { color: colors.foreground }]}>My Bookings</Text>
          </Pressable>
        </View>

        {/* Upcoming Appointments */}
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>Upcoming</Text>
            {state.appointments.length > 0 && (
              <Pressable onPress={() => router.push("/(client-tabs)/bookings" as any)}>
                <Text style={[s.seeAll, { color: "#8B5CF6" }]}>See all</Text>
              </Pressable>
            )}
          </View>

          {loading ? (
            <ActivityIndicator color="#8B5CF6" style={{ marginTop: 24 }} />
          ) : upcoming.length === 0 ? (
            <View style={[s.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <IconSymbol name="calendar" size={28} color={colors.muted} />
              <Text style={[s.emptyText, { color: colors.muted }]}>No upcoming appointments</Text>
              <Pressable
                style={({ pressed }) => [s.emptyBtn, { borderColor: "#8B5CF6" }, pressed && { opacity: 0.7 }]}
                onPress={() => router.push("/(client-tabs)/discover" as any)}
              >
                <Text style={{ color: "#8B5CF6", fontWeight: "600", fontSize: 14 }}>Book Now</Text>
              </Pressable>
            </View>
          ) : (
            upcoming.map((appt) => (
              <Pressable
                key={appt.id}
                style={({ pressed }) => [
                  s.apptCard,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                  pressed && { opacity: 0.85 },
                ]}
                onPress={() => router.push({ pathname: "/client-appointment-detail", params: { id: String(appt.id) } } as any)}
              >
                <View style={s.apptLeft}>
                  <Text style={[s.apptService, { color: colors.foreground }]}>{appt.serviceName}</Text>
                  <Text style={[s.apptBusiness, { color: colors.muted }]}>{appt.businessName}</Text>
                  <Text style={[s.apptDate, { color: colors.muted }]}>
                    {formatDate(appt.date)} · {appt.time}
                    {appt.staffName ? ` · ${appt.staffName}` : ""}
                  </Text>
                </View>
                <View style={[s.statusBadge, { backgroundColor: statusColor(appt.status, colors) + "20" }]}>
                  <Text style={[s.statusText, { color: statusColor(appt.status, colors) }]}>
                    {statusLabel(appt.status)}
                  </Text>
                </View>
              </Pressable>
            ))
          )}
        </View>

        {/* Saved Businesses */}
        {state.savedBusinesses.length > 0 && (
          <View style={s.section}>
            <View style={s.sectionHeader}>
              <Text style={s.sectionTitle}>Saved</Text>
              <Pressable onPress={() => router.push("/client-saved-businesses" as any)}>
                <Text style={[s.seeAll, { color: "#8B5CF6" }]}>See all</Text>
              </Pressable>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingHorizontal: 2 }}>
              {state.savedBusinesses.slice(0, 6).map((biz) => (
                <Pressable
                  key={biz.id}
                  style={({ pressed }) => [
                    s.savedCard,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                    pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] },
                  ]}
                  onPress={() => router.push({ pathname: "/client-business-detail", params: { slug: biz.businessSlug } } as any)}
                >
                  <View style={[s.savedIcon, { backgroundColor: "#8B5CF620" }]}>
                    <IconSymbol name="scissors" size={20} color="#8B5CF6" />
                  </View>
                  <Text style={[s.savedName, { color: colors.foreground }]} numberOfLines={2}>{biz.businessName}</Text>
                  {biz.businessCategory && (
                    <Text style={[s.savedCat, { color: colors.muted }]} numberOfLines={1}>{biz.businessCategory}</Text>
                  )}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = (colors: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 8,
    },
    greeting: {
      fontSize: 22,
      fontWeight: "700",
      color: colors.foreground,
    },
    greetingSub: {
      fontSize: 14,
      marginTop: 2,
    },
    avatarBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: "center",
      justifyContent: "center",
    },
    quickActions: {
      flexDirection: "row",
      gap: 12,
      paddingHorizontal: 20,
      marginTop: 12,
      marginBottom: 8,
    },
    quickBtn: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: 12,
      borderRadius: 14,
    },
    quickBtnText: {
      fontSize: 15,
      fontWeight: "600",
    },
    section: {
      marginTop: 24,
      paddingHorizontal: 20,
    },
    sectionHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 12,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: colors.foreground,
    },
    seeAll: {
      fontSize: 14,
      fontWeight: "600",
    },
    apptCard: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      borderRadius: 14,
      borderWidth: 1,
      padding: 14,
      marginBottom: 10,
    },
    apptLeft: {
      flex: 1,
      gap: 3,
    },
    apptService: {
      fontSize: 15,
      fontWeight: "600",
    },
    apptBusiness: {
      fontSize: 13,
    },
    apptDate: {
      fontSize: 12,
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
    emptyCard: {
      borderRadius: 16,
      borderWidth: 1,
      padding: 28,
      alignItems: "center",
      gap: 10,
    },
    emptyText: {
      fontSize: 14,
    },
    emptyBtn: {
      borderWidth: 1.5,
      borderRadius: 20,
      paddingHorizontal: 20,
      paddingVertical: 8,
      marginTop: 4,
    },
    savedCard: {
      width: 130,
      borderRadius: 14,
      borderWidth: 1,
      padding: 14,
      gap: 8,
    },
    savedIcon: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
    },
    savedName: {
      fontSize: 13,
      fontWeight: "600",
      lineHeight: 18,
    },
    savedCat: {
      fontSize: 11,
    },
    // Guest styles
    guestContainer: {
      alignItems: "center",
      paddingVertical: 40,
      gap: 16,
    },
    guestIcon: {
      width: 96,
      height: 96,
      borderRadius: 48,
      backgroundColor: "#8B5CF615",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 8,
    },
    guestTitle: {
      fontSize: 28,
      fontWeight: "700",
      color: colors.foreground,
      textAlign: "center",
      lineHeight: 36,
    },
    guestSubtitle: {
      fontSize: 15,
      color: colors.muted,
      textAlign: "center",
      lineHeight: 22,
      maxWidth: 300,
    },
    primaryBtn: {
      backgroundColor: "#8B5CF6",
      paddingHorizontal: 40,
      paddingVertical: 14,
      borderRadius: 28,
      marginTop: 8,
    },
    primaryBtnText: {
      color: "#FFFFFF",
      fontSize: 16,
      fontWeight: "700",
    },
    secondaryBtn: {
      paddingVertical: 10,
    },
    secondaryBtnText: {
      fontSize: 15,
      fontWeight: "600",
    },
  });
