import { FlatList, Text, View, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useStore, formatTime, formatDateStr } from "@/lib/store";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useMemo } from "react";

export default function HomeScreen() {
  const { state, getServiceById, getClientById, getAppointmentsForDate, getTodayStats } = useStore();
  const colors = useColors();
  const router = useRouter();

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

  return (
    <ScreenContainer className="px-5 pt-2">
      <FlatList
        data={todayAppointments}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View className="mb-4">
            {/* Greeting */}
            <View className="mb-5">
              <Text className="text-2xl font-bold text-foreground">
                {greeting}
              </Text>
              <Text className="text-sm text-muted mt-1">{todayDisplay}</Text>
            </View>

            {/* Stats Cards */}
            <View className="flex-row gap-3 mb-6">
              <View
                className="flex-1 rounded-2xl p-4"
                style={{ backgroundColor: colors.primary + "12" }}
              >
                <Text className="text-3xl font-bold" style={{ color: colors.primary }}>
                  {stats.todayCount}
                </Text>
                <Text className="text-xs text-muted mt-1">Today</Text>
              </View>
              <View
                className="flex-1 rounded-2xl p-4"
                style={{ backgroundColor: colors.success + "12" }}
              >
                <Text className="text-3xl font-bold" style={{ color: colors.success }}>
                  {stats.weekCount}
                </Text>
                <Text className="text-xs text-muted mt-1">This Week</Text>
              </View>
              <View
                className="flex-1 rounded-2xl p-4"
                style={{ backgroundColor: colors.warning + "12" }}
              >
                <Text className="text-3xl font-bold" style={{ color: colors.warning }}>
                  ${stats.weekRevenue}
                </Text>
                <Text className="text-xs text-muted mt-1">Revenue</Text>
              </View>
            </View>

            {/* Section Header */}
            <Text className="text-lg font-semibold text-foreground mb-3">
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
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <View
                style={[
                  styles.colorBar,
                  { backgroundColor: service?.color ?? colors.primary },
                ]}
              />
              <View style={styles.cardContent}>
                <View style={styles.cardRow}>
                  <Text
                    className="text-base font-semibold text-foreground"
                    numberOfLines={1}
                  >
                    {service?.name ?? "Service"}
                  </Text>
                  <View
                    className="rounded-full px-2 py-0.5"
                    style={{
                      backgroundColor:
                        item.status === "completed"
                          ? colors.success + "20"
                          : item.status === "cancelled"
                          ? colors.error + "20"
                          : colors.primary + "20",
                    }}
                  >
                    <Text
                      className="text-xs font-medium capitalize"
                      style={{
                        color:
                          item.status === "completed"
                            ? colors.success
                            : item.status === "cancelled"
                            ? colors.error
                            : colors.primary,
                      }}
                    >
                      {item.status}
                    </Text>
                  </View>
                </View>
                <Text className="text-sm text-muted mt-1">
                  {client?.name ?? "Client"} · {formatTime(item.time)} ·{" "}
                  {item.duration} min
                </Text>
              </View>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <View className="items-center py-12">
            <IconSymbol name="calendar" size={48} color={colors.muted} />
            <Text className="text-base text-muted mt-3">
              No appointments today
            </Text>
            <Pressable
              onPress={() => router.push("/new-booking")}
              style={({ pressed }) => [
                styles.emptyButton,
                {
                  backgroundColor: colors.primary,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <Text className="text-white font-semibold text-sm">
                Book an Appointment
              </Text>
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
          {
            backgroundColor: colors.primary,
            transform: [{ scale: pressed ? 0.95 : 1 }],
          },
        ]}
      >
        <IconSymbol name="plus" size={28} color="#FFFFFF" />
      </Pressable>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  appointmentCard: {
    flexDirection: "row",
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    overflow: "hidden",
  },
  colorBar: {
    width: 4,
  },
  cardContent: {
    flex: 1,
    padding: 14,
  },
  cardRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
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
  emptyButton: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
});
