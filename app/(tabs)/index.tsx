import { FlatList, Text, View, Pressable, StyleSheet, Share, Platform, useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useStore, formatTime, formatDateStr } from "@/lib/store";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useMemo, useCallback } from "react";
import Constants from "expo-constants";

export default function HomeScreen() {
  const { state, getServiceById, getClientById, getAppointmentsForDate, getTodayStats } = useStore();
  const colors = useColors();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const hp = Math.max(16, width * 0.05);

  const todayStr = formatDateStr(new Date());
  const todayAppointments = useMemo(() => getAppointmentsForDate(todayStr), [getAppointmentsForDate, todayStr]);
  const stats = useMemo(() => getTodayStats(), [getTodayStats]);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 17) return "Good Afternoon";
    return "Good Evening";
  }, []);

  const todayDisplay = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const handleShareBookingLink = useCallback(async () => {
    const scheme = Constants.expoConfig?.scheme ?? "limeoftime";
    const businessName = state.settings.businessName || "our business";
    // Build a deep link to the public booking page
    const bookingUrl = `${scheme}://booking`;
    const message = `Book an appointment with ${businessName}!\n\nOpen the Lime Of Time app and visit:\n${bookingUrl}`;

    if (Platform.OS === "web") {
      try {
        await navigator.clipboard.writeText(message);
        alert("Booking link copied to clipboard!");
      } catch {
        alert(`Share this link with clients:\n\n${bookingUrl}`);
      }
    } else {
      try {
        await Share.share({
          message,
          title: `Book with ${businessName}`,
        });
      } catch {
        // user cancelled
      }
    }
  }, [state.settings.businessName]);

  return (
    <ScreenContainer className="pt-2" style={{ paddingHorizontal: hp }}>
      <FlatList
        data={todayAppointments}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={{ marginBottom: 16 }}>
            {/* Greeting */}
            <View style={{ marginBottom: 20 }}>
              <Text className="text-2xl font-bold text-foreground">{greeting}</Text>
              <Text className="text-sm text-muted" style={{ marginTop: 4 }}>{todayDisplay}</Text>
            </View>

            {/* Stats Cards */}
            <View style={styles.statsRow}>
              <View style={[styles.statCard, { backgroundColor: colors.primary + "15" }]}>
                <Text style={[styles.statNumber, { color: colors.primary }]}>{stats.todayCount}</Text>
                <Text className="text-xs text-muted">Today</Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: colors.success + "15" }]}>
                <Text style={[styles.statNumber, { color: colors.success }]}>{stats.weekCount}</Text>
                <Text className="text-xs text-muted">This Week</Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: colors.warning + "15" }]}>
                <Text style={[styles.statNumber, { color: colors.warning }]}>${stats.weekRevenue}</Text>
                <Text className="text-xs text-muted">Revenue</Text>
              </View>
            </View>

            {/* Share Booking Link Button */}
            <Pressable
              onPress={handleShareBookingLink}
              style={({ pressed }) => [
                styles.shareButton,
                { backgroundColor: colors.primary + "12", borderColor: colors.primary, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <IconSymbol name="paperplane.fill" size={18} color={colors.primary} />
              <Text style={[styles.shareText, { color: colors.primary }]}>Send Booking Link to Client</Text>
            </Pressable>

            {/* Section Header */}
            <Text className="text-lg font-semibold text-foreground" style={{ marginBottom: 12 }}>
              Today's Schedule
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const service = getServiceById(item.serviceId);
          const client = getClientById(item.clientId);
          return (
            <Pressable
              onPress={() =>
                router.push({
                  pathname: "/appointment-detail",
                  params: { id: item.id },
                })
              }
              style={({ pressed }) => [
                styles.appointmentCard,
                { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <View style={[styles.colorBar, { backgroundColor: service?.color ?? colors.primary }]} />
              <View style={styles.cardContent}>
                <View style={styles.cardRow}>
                  <Text className="text-base font-semibold text-foreground" numberOfLines={1} style={{ flex: 1 }}>
                    {service?.name ?? "Service"}
                  </Text>
                  <View
                    style={[
                      styles.statusBadge,
                      {
                        backgroundColor:
                          item.status === "completed" ? colors.success + "20" :
                          item.status === "cancelled" ? colors.error + "20" :
                          colors.primary + "20",
                      },
                    ]}
                  >
                    <Text
                      className="text-xs font-medium capitalize"
                      style={{
                        color:
                          item.status === "completed" ? colors.success :
                          item.status === "cancelled" ? colors.error :
                          colors.primary,
                      }}
                    >
                      {item.status}
                    </Text>
                  </View>
                </View>
                <Text className="text-sm text-muted" style={{ marginTop: 4 }}>
                  {client?.name ?? "Client"} · {formatTime(item.time)} · {item.duration} min
                </Text>
              </View>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <IconSymbol name="calendar" size={48} color={colors.muted} />
            <Text className="text-base text-muted" style={{ marginTop: 12 }}>No appointments today</Text>
            <Pressable
              onPress={() => router.push("/new-booking")}
              style={({ pressed }) => [
                styles.emptyButton,
                { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <Text className="text-white font-semibold text-sm">Book an Appointment</Text>
            </Pressable>
          </View>
        }
        contentContainerStyle={{ paddingBottom: 100 }}
      />

      {/* FAB */}
      <Pressable
        onPress={() => router.push("/new-booking")}
        style={({ pressed }) => [
          styles.fab,
          { backgroundColor: colors.primary, transform: [{ scale: pressed ? 0.95 : 1 }] },
        ]}
      >
        <IconSymbol name="plus" size={28} color="#FFFFFF" />
      </Pressable>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  statsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 12,
    alignItems: "flex-start",
  },
  statNumber: {
    fontSize: 24,
    fontWeight: "700",
    lineHeight: 30,
  },
  shareButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    marginBottom: 20,
    gap: 8,
  },
  shareText: {
    fontSize: 14,
    fontWeight: "600",
  },
  appointmentCard: {
    flexDirection: "row",
    borderRadius: 16,
    marginBottom: 10,
    borderWidth: 1,
    overflow: "hidden",
  },
  colorBar: {
    width: 4,
  },
  cardContent: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  cardRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  statusBadge: {
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: 8,
  },
  fab: {
    position: "absolute",
    bottom: 24,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  emptyContainer: {
    alignItems: "center",
    paddingVertical: 48,
  },
  emptyButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
});
