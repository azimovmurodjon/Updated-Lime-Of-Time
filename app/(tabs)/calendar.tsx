import { FlatList, Text, View, Pressable, StyleSheet, useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useStore, formatTime, formatDateStr } from "@/lib/store";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useState, useMemo, useCallback } from "react";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function CalendarScreen() {
  const { state, getServiceById, getClientById, getAppointmentsForDate } = useStore();
  const colors = useColors();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const hp = Math.max(16, width * 0.05);
  const dayCellSize = Math.floor((width - hp * 2) / 7);

  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [selectedDate, setSelectedDate] = useState(formatDateStr(new Date()));
  const todayStr = formatDateStr(new Date());

  const calendarDays = useMemo(() => {
    const { year, month } = currentMonth;
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(i);
    return days;
  }, [currentMonth]);

  const appointmentDates = useMemo(() => {
    const dates = new Set<string>();
    state.appointments.forEach((a) => {
      if (a.status !== "cancelled") dates.add(a.date);
    });
    return dates;
  }, [state.appointments]);

  const selectedAppointments = useMemo(
    () => getAppointmentsForDate(selectedDate),
    [getAppointmentsForDate, selectedDate]
  );

  const monthLabel = new Date(currentMonth.year, currentMonth.month).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const prevMonth = useCallback(() => {
    setCurrentMonth((prev) => {
      if (prev.month === 0) return { year: prev.year - 1, month: 11 };
      return { ...prev, month: prev.month - 1 };
    });
  }, []);

  const nextMonth = useCallback(() => {
    setCurrentMonth((prev) => {
      if (prev.month === 11) return { year: prev.year + 1, month: 0 };
      return { ...prev, month: prev.month + 1 };
    });
  }, []);

  const makeDateStr = (day: number) => {
    const y = currentMonth.year;
    const m = String(currentMonth.month + 1).padStart(2, "0");
    const d = String(day).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  return (
    <ScreenContainer className="pt-2" style={{ paddingHorizontal: hp }}>
      <View style={{ marginBottom: 16 }}>
        <Text className="text-2xl font-bold text-foreground">Calendar</Text>
      </View>

      {/* Month Navigation */}
      <View style={styles.monthNav}>
        <Pressable onPress={prevMonth} style={({ pressed }) => [{ opacity: pressed ? 0.5 : 1, padding: 8 }]}>
          <IconSymbol name="chevron.left" size={22} color={colors.foreground} />
        </Pressable>
        <Text className="text-lg font-semibold text-foreground">{monthLabel}</Text>
        <Pressable onPress={nextMonth} style={({ pressed }) => [{ opacity: pressed ? 0.5 : 1, padding: 8 }]}>
          <IconSymbol name="chevron.right" size={22} color={colors.foreground} />
        </Pressable>
      </View>

      {/* Weekday Headers */}
      <View style={styles.weekRow}>
        {WEEKDAY_LABELS.map((label) => (
          <View key={label} style={{ width: dayCellSize, alignItems: "center" }}>
            <Text className="text-xs text-muted font-medium">{label}</Text>
          </View>
        ))}
      </View>

      {/* Calendar Grid */}
      <View style={[styles.calendarGrid, { marginBottom: 16 }]}>
        {calendarDays.map((day, idx) => {
          if (day === null) {
            return <View key={`empty-${idx}`} style={{ width: dayCellSize, height: dayCellSize * 0.85 }} />;
          }
          const dateStr = makeDateStr(day);
          const isToday = dateStr === todayStr;
          const isSelected = dateStr === selectedDate;
          const hasAppts = appointmentDates.has(dateStr);

          return (
            <Pressable
              key={dateStr}
              onPress={() => setSelectedDate(dateStr)}
              style={({ pressed }) => [
                {
                  width: dayCellSize,
                  height: dayCellSize * 0.85,
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: dayCellSize * 0.4,
                  backgroundColor: isSelected ? colors.primary : isToday ? colors.primary + "15" : "transparent",
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: "500",
                  color: isSelected ? "#FFFFFF" : isToday ? colors.primary : colors.foreground,
                  lineHeight: 20,
                }}
              >
                {day}
              </Text>
              {hasAppts && (
                <View
                  style={{
                    width: 4,
                    height: 4,
                    borderRadius: 2,
                    marginTop: 2,
                    backgroundColor: isSelected ? "#FFFFFF" : colors.primary,
                  }}
                />
              )}
            </Pressable>
          );
        })}
      </View>

      {/* Selected Date Label */}
      <Text className="text-base font-semibold text-foreground" style={{ marginBottom: 12 }}>
        {selectedDate === todayStr
          ? "Today"
          : new Date(selectedDate + "T12:00:00").toLocaleDateString("en-US", {
              weekday: "short",
              month: "short",
              day: "numeric",
            })}
      </Text>

      <FlatList
        data={selectedAppointments}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => {
          const service = getServiceById(item.serviceId);
          const client = getClientById(item.clientId);
          return (
            <Pressable
              onPress={() =>
                router.push({ pathname: "/appointment-detail" as any, params: { id: item.id } })
              }
              style={({ pressed }) => [
                styles.appointmentRow,
                { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <View style={[styles.colorDot, { backgroundColor: service?.color ?? colors.primary }]} />
              <View style={{ flex: 1 }}>
                <Text className="text-sm font-semibold text-foreground" numberOfLines={1}>
                  {service?.name ?? "Service"}
                </Text>
                <Text className="text-xs text-muted">
                  {client?.name ?? "Client"} · {formatTime(item.time)}
                </Text>
              </View>
              <IconSymbol name="chevron.right" size={16} color={colors.muted} />
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <View style={{ alignItems: "center", paddingVertical: 32 }}>
            <Text className="text-sm text-muted">No appointments</Text>
          </View>
        }
        contentContainerStyle={{ paddingBottom: 100 }}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  monthNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  weekRow: {
    flexDirection: "row",
    marginBottom: 8,
  },
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  appointmentRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
  },
  colorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 12,
  },
});
