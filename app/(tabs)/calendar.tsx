import { useState, useMemo, useCallback } from "react";
import {
  Text,
  View,
  Pressable,
  StyleSheet,
  Alert,
  Linking,
  Platform,
  useWindowDimensions,
  ScrollView,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useStore, formatTime, formatDateStr, formatDateDisplay } from "@/lib/store";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useRouter } from "expo-router";
import { Appointment } from "@/lib/types";

const FILTERS = [
  { key: "upcoming", label: "Upcoming" },
  { key: "requests", label: "Requests" },
  { key: "cancelled", label: "Cancelled" },
  { key: "completed", label: "Completed" },
] as const;

type FilterKey = (typeof FILTERS)[number]["key"];

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAY_HEADERS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

export default function CalendarScreen() {
  const { state, dispatch, getServiceById, getClientById } = useStore();
  const colors = useColors();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const hp = Math.round(Math.max(16, width * 0.045));

  const now = new Date();
  const [currentMonth, setCurrentMonth] = useState(now.getMonth());
  const [currentYear, setCurrentYear] = useState(now.getFullYear());
  const [selectedDate, setSelectedDate] = useState(formatDateStr(now));
  const [activeFilter, setActiveFilter] = useState<FilterKey>("upcoming");

  const cellSize = Math.floor((width - hp * 2) / 7);

  // Calendar grid
  const calendarDays = useMemo(() => {
    const firstDay = new Date(currentYear, currentMonth, 1).getDay();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const days: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(i);
    return days;
  }, [currentMonth, currentYear]);

  // Status dots for each day
  const dayStatuses = useMemo(() => {
    const statuses: Record<string, Set<string>> = {};
    state.appointments.forEach((a) => {
      if (!statuses[a.date]) statuses[a.date] = new Set();
      statuses[a.date].add(a.status);
    });
    return statuses;
  }, [state.appointments]);

  const prevMonth = () => {
    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(currentYear - 1); }
    else setCurrentMonth(currentMonth - 1);
  };

  const nextMonth = () => {
    if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(currentYear + 1); }
    else setCurrentMonth(currentMonth + 1);
  };

  const todayStr = formatDateStr(now);

  // Filter appointments
  const filteredAppointments = useMemo(() => {
    switch (activeFilter) {
      case "upcoming":
        return state.appointments
          .filter((a) => a.status === "confirmed" && a.date >= todayStr)
          .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
      case "requests":
        return state.appointments
          .filter((a) => a.status === "pending")
          .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
      case "cancelled":
        return state.appointments
          .filter((a) => a.status === "cancelled")
          .sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time));
      case "completed":
        return state.appointments
          .filter((a) => a.status === "completed")
          .sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time));
      default:
        return [];
    }
  }, [state.appointments, activeFilter, todayStr]);

  // Selected date appointments
  const selectedDateAppts = useMemo(() => {
    return state.appointments
      .filter((a) => a.date === selectedDate)
      .sort((a, b) => a.time.localeCompare(b.time));
  }, [state.appointments, selectedDate]);

  const openSmsWithMessage = (phone: string, message: string) => {
    if (Platform.OS === "web") {
      Alert.alert("SMS Message", message);
      return;
    }
    const separator = Platform.OS === "ios" ? "&" : "?";
    const url = `sms:${phone}${separator}body=${encodeURIComponent(message)}`;
    Linking.openURL(url).catch(() => Alert.alert("SMS", message));
  };

  const handleAccept = (appt: Appointment) => {
    const client = getClientById(appt.clientId);
    const svc = getServiceById(appt.serviceId);
    dispatch({ type: "UPDATE_APPOINTMENT_STATUS", payload: { id: appt.id, status: "confirmed" } });

    const message = `Hi ${client?.name ?? "there"}! Your appointment for ${svc?.name ?? "service"} on ${formatDateDisplay(appt.date)} at ${formatTime(appt.time)} has been confirmed. We look forward to seeing you! - ${state.settings.businessName}`;

    if (client?.phone) {
      openSmsWithMessage(client.phone, message);
    } else {
      Alert.alert("Appointment Confirmed", message);
    }
  };

  const handleReject = (appt: Appointment) => {
    const client = getClientById(appt.clientId);
    const svc = getServiceById(appt.serviceId);

    Alert.alert("Reject Appointment", "Are you sure you want to reject this appointment request?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Reject",
        style: "destructive",
        onPress: () => {
          dispatch({ type: "UPDATE_APPOINTMENT_STATUS", payload: { id: appt.id, status: "cancelled" } });
          const message = `Hi ${client?.name ?? "there"}, unfortunately we are unable to accommodate your appointment for ${svc?.name ?? "service"} on ${formatDateDisplay(appt.date)} at ${formatTime(appt.time)}. Please feel free to book another time. - ${state.settings.businessName}`;
          if (client?.phone) {
            openSmsWithMessage(client.phone, message);
          } else {
            Alert.alert("Appointment Rejected", message);
          }
        },
      },
    ]);
  };

  const filterColors: Record<FilterKey, string> = {
    upcoming: colors.success,
    requests: "#FF9800",
    cancelled: colors.error,
    completed: colors.primary,
  };

  return (
    <ScreenContainer>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Header */}
        <View style={{ paddingHorizontal: hp, paddingTop: 4 }}>
          <Text style={{ fontSize: 24, fontWeight: "700", color: colors.foreground, marginBottom: 12 }}>Calendar</Text>
        </View>

        {/* Month Header */}
        <View style={[styles.monthHeader, { paddingHorizontal: hp }]}>
          <Pressable onPress={prevMonth} style={({ pressed }) => [styles.navBtn, { opacity: pressed ? 0.5 : 1 }]}>
            <IconSymbol name="chevron.left" size={22} color={colors.foreground} />
          </Pressable>
          <Text style={[styles.monthTitle, { color: colors.foreground }]}>
            {MONTH_NAMES[currentMonth]} {currentYear}
          </Text>
          <Pressable onPress={nextMonth} style={({ pressed }) => [styles.navBtn, { opacity: pressed ? 0.5 : 1 }]}>
            <IconSymbol name="chevron.right" size={22} color={colors.foreground} />
          </Pressable>
        </View>

        {/* Day Headers */}
        <View style={[styles.dayHeaderRow, { paddingHorizontal: hp }]}>
          {DAY_HEADERS.map((d) => (
            <View key={d} style={{ width: cellSize, alignItems: "center" }}>
              <Text style={{ fontSize: 12, fontWeight: "600", color: colors.muted }}>{d}</Text>
            </View>
          ))}
        </View>

        {/* Calendar Grid */}
        <View style={[styles.calendarGrid, { paddingHorizontal: hp }]}>
          {calendarDays.map((day, idx) => {
            if (day === null) return <View key={`e-${idx}`} style={{ width: cellSize, height: cellSize }} />;
            const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const isSelected = dateStr === selectedDate;
            const isToday = dateStr === todayStr;
            const statuses = dayStatuses[dateStr];

            return (
              <Pressable
                key={dateStr}
                onPress={() => setSelectedDate(dateStr)}
                style={({ pressed }) => [
                  styles.dayCell,
                  {
                    width: cellSize,
                    height: cellSize,
                    backgroundColor: isSelected ? colors.primary : "transparent",
                    borderRadius: cellSize / 2,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <Text
                  style={{
                    fontSize: 15,
                    fontWeight: isToday || isSelected ? "700" : "400",
                    color: isSelected ? "#FFF" : isToday ? colors.primary : colors.foreground,
                  }}
                >
                  {day}
                </Text>
                {/* Status dots */}
                <View style={styles.dotsRow}>
                  {statuses?.has("confirmed") && <View style={[styles.dot, { backgroundColor: "#1B5E20" }]} />}
                  {statuses?.has("pending") && <View style={[styles.dot, { backgroundColor: "#2196F3" }]} />}
                  {statuses?.has("cancelled") && <View style={[styles.dot, { backgroundColor: "#F44336" }]} />}
                </View>
              </Pressable>
            );
          })}
        </View>

        {/* Dot Legend */}
        <View style={[styles.dotLegend, { paddingHorizontal: hp }]}>
          <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: "#1B5E20" }]} /><Text style={{ fontSize: 10, color: colors.muted }}>Accepted</Text></View>
          <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: "#2196F3" }]} /><Text style={{ fontSize: 10, color: colors.muted }}>Pending</Text></View>
          <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: "#F44336" }]} /><Text style={{ fontSize: 10, color: colors.muted }}>Cancelled</Text></View>
        </View>

        {/* Selected Date Appointments */}
        <View style={{ paddingHorizontal: hp, marginTop: 8 }}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            {formatDateDisplay(selectedDate)}
          </Text>
          {selectedDateAppts.length === 0 ? (
            <Text style={{ color: colors.muted, fontSize: 13, marginTop: 4, marginBottom: 12 }}>No appointments on this date</Text>
          ) : (
            selectedDateAppts.map((appt) => {
              const svc = getServiceById(appt.serviceId);
              const client = getClientById(appt.clientId);
              const statusColor =
                appt.status === "confirmed" ? "#1B5E20"
                : appt.status === "pending" ? "#FF9800"
                : appt.status === "completed" ? colors.primary
                : "#F44336";
              return (
                <Pressable
                  key={appt.id}
                  onPress={() => router.push({ pathname: "/appointment-detail", params: { id: appt.id } })}
                  style={({ pressed }) => [styles.apptCard, { backgroundColor: colors.surface, borderColor: colors.border, borderLeftColor: svc?.color ?? colors.primary, opacity: pressed ? 0.8 : 1 }]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: "700", color: colors.foreground }}>{formatTime(appt.time)}</Text>
                    <Text style={{ fontSize: 13, fontWeight: "500", color: colors.foreground, marginTop: 2 }}>{svc?.name}</Text>
                    <Text style={{ fontSize: 12, color: colors.muted }}>{client?.name}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: statusColor + "18" }]}>
                    <Text style={{ fontSize: 11, fontWeight: "600", color: statusColor, textTransform: "capitalize" }}>{appt.status}</Text>
                  </View>
                </Pressable>
              );
            })
          )}
        </View>

        {/* Filter Tabs */}
        <View style={{ paddingHorizontal: hp, marginTop: 20 }}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Appointments</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
            {FILTERS.map((f) => {
              const isActive = activeFilter === f.key;
              const count = f.key === "upcoming"
                ? state.appointments.filter((a) => a.status === "confirmed" && a.date >= todayStr).length
                : f.key === "requests"
                ? state.appointments.filter((a) => a.status === "pending").length
                : f.key === "cancelled"
                ? state.appointments.filter((a) => a.status === "cancelled").length
                : state.appointments.filter((a) => a.status === "completed").length;

              return (
                <Pressable
                  key={f.key}
                  onPress={() => setActiveFilter(f.key)}
                  style={({ pressed }) => [
                    styles.filterChip,
                    {
                      backgroundColor: isActive ? filterColors[f.key] : colors.surface,
                      borderColor: isActive ? filterColors[f.key] : colors.border,
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}
                >
                  <Text style={{ fontSize: 13, fontWeight: "600", color: isActive ? "#FFF" : colors.foreground }}>
                    {f.label} ({count})
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Filtered List */}
          {filteredAppointments.length === 0 ? (
            <View style={[styles.emptyState, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={{ color: colors.muted, fontSize: 13 }}>No {activeFilter} appointments</Text>
            </View>
          ) : (
            filteredAppointments.map((appt) => {
              const svc = getServiceById(appt.serviceId);
              const client = getClientById(appt.clientId);
              const isRequest = appt.status === "pending";
              return (
                <View
                  key={appt.id}
                  style={[styles.filterCard, { backgroundColor: colors.surface, borderColor: colors.border, borderLeftColor: svc?.color ?? colors.primary }]}
                >
                  <Pressable
                    onPress={() => router.push({ pathname: "/appointment-detail", params: { id: appt.id } })}
                    style={{ flex: 1 }}
                  >
                    <View style={styles.filterCardRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 14, fontWeight: "700", color: colors.foreground }}>{formatDateDisplay(appt.date)} · {formatTime(appt.time)}</Text>
                        <Text style={{ fontSize: 13, color: colors.foreground, marginTop: 2 }}>{svc?.name}</Text>
                        <Text style={{ fontSize: 12, color: colors.muted }}>{client?.name} {client?.phone ? `· ${client.phone}` : ""}</Text>
                      </View>
                    </View>
                  </Pressable>
                  {isRequest && (
                    <View style={[styles.actionRow, { borderTopColor: colors.border }]}>
                      <Pressable
                        onPress={() => handleAccept(appt)}
                        style={({ pressed }) => [styles.acceptBtn, { backgroundColor: "#1B5E20", opacity: pressed ? 0.8 : 1 }]}
                      >
                        <IconSymbol name="checkmark" size={16} color="#FFF" />
                        <Text style={{ color: "#FFF", fontSize: 13, fontWeight: "600", marginLeft: 4 }}>Accept</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => handleReject(appt)}
                        style={({ pressed }) => [styles.rejectBtn, { borderColor: "#F44336", opacity: pressed ? 0.8 : 1 }]}
                      >
                        <IconSymbol name="xmark" size={16} color="#F44336" />
                        <Text style={{ color: "#F44336", fontSize: 13, fontWeight: "600", marginLeft: 4 }}>Reject</Text>
                      </Pressable>
                    </View>
                  )}
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  monthHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
  },
  monthTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  navBtn: {
    padding: 8,
  },
  dayHeaderRow: {
    flexDirection: "row",
    marginBottom: 4,
  },
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  dayCell: {
    alignItems: "center",
    justifyContent: "center",
  },
  dotsRow: {
    flexDirection: "row",
    gap: 2,
    position: "absolute",
    bottom: 4,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  dotLegend: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 14,
    marginTop: 6,
    marginBottom: 8,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  legendDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 8,
  },
  apptCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderLeftWidth: 4,
    marginBottom: 8,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 24,
    borderRadius: 14,
    borderWidth: 1,
  },
  filterCard: {
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderLeftWidth: 4,
    marginBottom: 10,
  },
  filterCardRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  acceptBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    flex: 1,
    justifyContent: "center",
  },
  rejectBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1.5,
    flex: 1,
    justifyContent: "center",
  },
});
