import { useMemo } from "react";
import {
  Text,
  View,
  Pressable,
  StyleSheet,
  FlatList,
  useWindowDimensions,
  ScrollView,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useStore, formatDateDisplay, formatTime } from "@/lib/store";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useLocalSearchParams, useRouter } from "expo-router";

export default function AnalyticsDetailScreen() {
  const { tab } = useLocalSearchParams<{ tab: string }>();
  const { state, getServiceById, getClientById } = useStore();
  const colors = useColors();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const hp = Math.round(Math.max(16, width * 0.045));

  const titles: Record<string, string> = {
    clients: "Total Clients",
    appointments: "Appointments",
    revenue: "Revenue",
    topservice: "Top Service",
  };

  // Clients analytics
  const clientsData = useMemo(() => {
    return state.clients.map((c) => {
      const apptCount = state.appointments.filter((a) => a.clientId === c.id && a.status !== "cancelled").length;
      return { ...c, apptCount };
    }).sort((a, b) => b.apptCount - a.apptCount);
  }, [state.clients, state.appointments]);

  // Appointments analytics - by month
  const appointmentsData = useMemo(() => {
    const months: Record<string, { confirmed: number; completed: number; cancelled: number; pending: number }> = {};
    state.appointments.forEach((a) => {
      const monthKey = a.date.substring(0, 7); // YYYY-MM
      if (!months[monthKey]) months[monthKey] = { confirmed: 0, completed: 0, cancelled: 0, pending: 0 };
      if (a.status === "confirmed") months[monthKey].confirmed++;
      else if (a.status === "completed") months[monthKey].completed++;
      else if (a.status === "cancelled") months[monthKey].cancelled++;
      else if (a.status === "pending") months[monthKey].pending++;
    });
    return Object.entries(months)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([month, counts]) => ({ month, ...counts }));
  }, [state.appointments]);

  // Revenue analytics - by service
  const revenueData = useMemo(() => {
    const byService: Record<string, { name: string; revenue: number; count: number; color: string }> = {};
    state.appointments
      .filter((a) => a.status === "completed")
      .forEach((a) => {
        const svc = getServiceById(a.serviceId);
        if (svc) {
          if (!byService[svc.id]) byService[svc.id] = { name: svc.name, revenue: 0, count: 0, color: svc.color };
          byService[svc.id].revenue += svc.price;
          byService[svc.id].count++;
        }
      });
    return Object.values(byService).sort((a, b) => b.revenue - a.revenue);
  }, [state.appointments, state.services]);

  const totalRevenue = revenueData.reduce((s, r) => s + r.revenue, 0);

  // Top service analytics
  const serviceRanking = useMemo(() => {
    const counts: Record<string, number> = {};
    state.appointments.filter((a) => a.status !== "cancelled").forEach((a) => {
      counts[a.serviceId] = (counts[a.serviceId] || 0) + 1;
    });
    return state.services
      .map((s) => ({ ...s, bookings: counts[s.id] || 0 }))
      .sort((a, b) => b.bookings - a.bookings);
  }, [state.services, state.appointments]);

  const maxBar = Math.max(...serviceRanking.map((s) => s.bookings), 1);

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]}>
      <View style={[styles.header, { paddingHorizontal: hp, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}>
          <IconSymbol name="arrow.left" size={24} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>{titles[tab ?? ""] ?? "Analytics"}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: hp, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {/* Clients Tab */}
        {tab === "clients" && (
          <View>
            <View style={[styles.summaryCard, { backgroundColor: "#E8F5E9", borderColor: "#4CAF5030" }]}>
              <Text style={{ fontSize: 36, fontWeight: "800", color: "#4CAF50" }}>{state.clients.length}</Text>
              <Text style={{ fontSize: 14, color: "#4CAF50CC", marginTop: 4 }}>Total Clients</Text>
            </View>
            {clientsData.map((c) => (
              <Pressable
                key={c.id}
                onPress={() => router.push({ pathname: "/client-detail", params: { id: c.id } })}
                style={({ pressed }) => [styles.listItem, { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.8 : 1 }]}
              >
                <View style={[styles.avatar, { backgroundColor: colors.primary + "18" }]}>
                  <Text style={{ fontSize: 16, fontWeight: "700", color: colors.primary }}>{c.name.charAt(0).toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={{ fontSize: 15, fontWeight: "600", color: colors.foreground }}>{c.name}</Text>
                  <Text style={{ fontSize: 12, color: colors.muted }}>{c.phone || c.email || "No contact info"}</Text>
                </View>
                <View style={[styles.countBadge, { backgroundColor: colors.primary + "15" }]}>
                  <Text style={{ fontSize: 12, fontWeight: "600", color: colors.primary }}>{c.apptCount} appts</Text>
                </View>
              </Pressable>
            ))}
          </View>
        )}

        {/* Appointments Tab */}
        {tab === "appointments" && (
          <View>
            <View style={[styles.summaryCard, { backgroundColor: "#E3F2FD", borderColor: "#2196F330" }]}>
              <Text style={{ fontSize: 36, fontWeight: "800", color: "#2196F3" }}>
                {state.appointments.filter((a) => a.status !== "cancelled").length}
              </Text>
              <Text style={{ fontSize: 14, color: "#2196F3CC", marginTop: 4 }}>Total Appointments</Text>
            </View>
            <View style={styles.barChart}>
              {appointmentsData.map((m) => {
                const total = m.confirmed + m.completed + m.pending;
                const monthLabel = new Date(m.month + "-01").toLocaleDateString("en-US", { month: "short", year: "2-digit" });
                return (
                  <View key={m.month} style={styles.barRow}>
                    <Text style={{ width: 60, fontSize: 12, color: colors.muted }}>{monthLabel}</Text>
                    <View style={styles.barTrack}>
                      <View style={[styles.barFill, { width: `${Math.max(((m.completed) / Math.max(total + m.cancelled, 1)) * 100, 0)}%`, backgroundColor: "#4CAF50" }]} />
                      <View style={[styles.barFill, { width: `${Math.max(((m.confirmed) / Math.max(total + m.cancelled, 1)) * 100, 0)}%`, backgroundColor: "#2196F3" }]} />
                      <View style={[styles.barFill, { width: `${Math.max(((m.pending) / Math.max(total + m.cancelled, 1)) * 100, 0)}%`, backgroundColor: "#FF9800" }]} />
                    </View>
                    <Text style={{ width: 30, fontSize: 12, color: colors.foreground, textAlign: "right", fontWeight: "600" }}>{total}</Text>
                  </View>
                );
              })}
            </View>
            <View style={styles.legend}>
              <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: "#4CAF50" }]} /><Text style={{ fontSize: 11, color: colors.muted }}>Completed</Text></View>
              <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: "#2196F3" }]} /><Text style={{ fontSize: 11, color: colors.muted }}>Confirmed</Text></View>
              <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: "#FF9800" }]} /><Text style={{ fontSize: 11, color: colors.muted }}>Pending</Text></View>
            </View>
            {appointmentsData.length === 0 && (
              <Text style={{ textAlign: "center", color: colors.muted, marginTop: 20 }}>No appointment data yet</Text>
            )}
          </View>
        )}

        {/* Revenue Tab */}
        {tab === "revenue" && (
          <View>
            <View style={[styles.summaryCard, { backgroundColor: "#FFF3E0", borderColor: "#FF980030" }]}>
              <Text style={{ fontSize: 36, fontWeight: "800", color: "#FF9800" }}>${totalRevenue.toLocaleString()}</Text>
              <Text style={{ fontSize: 14, color: "#FF9800CC", marginTop: 4 }}>Total Revenue</Text>
            </View>
            {revenueData.map((r) => (
              <View key={r.name} style={[styles.listItem, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={[styles.avatar, { backgroundColor: r.color + "18" }]}>
                  <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: r.color }} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={{ fontSize: 15, fontWeight: "600", color: colors.foreground }}>{r.name}</Text>
                  <Text style={{ fontSize: 12, color: colors.muted }}>{r.count} completed</Text>
                </View>
                <Text style={{ fontSize: 16, fontWeight: "700", color: "#FF9800" }}>${r.revenue.toLocaleString()}</Text>
              </View>
            ))}
            {revenueData.length === 0 && (
              <Text style={{ textAlign: "center", color: colors.muted, marginTop: 20 }}>No revenue data yet. Complete appointments to track revenue.</Text>
            )}
          </View>
        )}

        {/* Top Service Tab */}
        {tab === "topservice" && (
          <View>
            <View style={[styles.summaryCard, { backgroundColor: "#F3E5F5", borderColor: "#9C27B030" }]}>
              {serviceRanking.length > 0 ? (
                <>
                  <IconSymbol name="crown.fill" size={28} color="#9C27B0" />
                  <Text style={{ fontSize: 24, fontWeight: "800", color: "#9C27B0", marginTop: 8 }}>{serviceRanking[0].name}</Text>
                  <Text style={{ fontSize: 14, color: "#9C27B0CC", marginTop: 4 }}>{serviceRanking[0].bookings} bookings</Text>
                </>
              ) : (
                <Text style={{ fontSize: 14, color: "#9C27B0CC" }}>No services yet</Text>
              )}
            </View>
            {serviceRanking.map((s, idx) => (
              <View key={s.id} style={[styles.listItem, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={[styles.rankBadge, { backgroundColor: idx === 0 ? "#FFD700" : idx === 1 ? "#C0C0C0" : idx === 2 ? "#CD7F32" : colors.muted + "30" }]}>
                  <Text style={{ fontSize: 12, fontWeight: "700", color: idx < 3 ? "#FFF" : colors.muted }}>#{idx + 1}</Text>
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={{ fontSize: 15, fontWeight: "600", color: colors.foreground }}>{s.name}</Text>
                  <Text style={{ fontSize: 12, color: colors.muted }}>${s.price} · {s.duration} min</Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={{ fontSize: 16, fontWeight: "700", color: "#9C27B0" }}>{s.bookings}</Text>
                  <Text style={{ fontSize: 10, color: colors.muted }}>bookings</Text>
                </View>
                <View style={[styles.barSmall, { width: `${(s.bookings / maxBar) * 100}%`, backgroundColor: s.color + "30" }]} />
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  summaryCard: {
    alignItems: "center",
    paddingVertical: 28,
    borderRadius: 20,
    borderWidth: 1,
    marginVertical: 16,
  },
  listItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 8,
    overflow: "hidden",
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  countBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  rankBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  barChart: {
    marginTop: 12,
  },
  barRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  barTrack: {
    flex: 1,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#E0E0E0",
    flexDirection: "row",
    overflow: "hidden",
    marginHorizontal: 8,
  },
  barFill: {
    height: 16,
  },
  barSmall: {
    position: "absolute",
    bottom: 0,
    left: 0,
    height: 3,
    borderRadius: 2,
  },
  legend: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 16,
    marginTop: 8,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
