import { useState, useMemo, useCallback } from "react";
import { Text, View, Pressable, StyleSheet, Switch, Modal, FlatList, ScrollView } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useStore } from "@/lib/store";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useRouter } from "expo-router";
import type { CustomScheduleDay } from "@/lib/store";

const DAYS_OF_WEEK = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const DAY_LABELS: Record<string, string> = { monday: "Mon", tuesday: "Tue", wednesday: "Wed", thursday: "Thu", friday: "Fri", saturday: "Sat", sunday: "Sun" };

const TIME_OPTIONS: string[] = [];
for (let h = 0; h < 24; h++) {
  for (let m = 0; m < 60; m += 15) {
    TIME_OPTIONS.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
  }
}

function formatTimeLabel(t: string) {
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hr = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hr}:${String(m).padStart(2, "0")} ${ampm}`;
}

function formatDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function ScheduleSettingsScreen() {
  const { state, dispatch, syncToDb } = useStore();
  const colors = useColors();
  const router = useRouter();
  const settings = state.settings;

  const scheduleTab = settings.scheduleMode ?? "weekly";
  const setScheduleTab = useCallback((mode: "weekly" | "custom") => {
    const action = { type: "UPDATE_SETTINGS" as const, payload: { scheduleMode: mode } };
    dispatch(action);
    syncToDb(action);
  }, [dispatch, syncToDb]);

  // Weekly time picker
  const [timePickerVisible, setTimePickerVisible] = useState(false);
  const [timePickerDay, setTimePickerDay] = useState("");
  const [timePickerField, setTimePickerField] = useState<"start" | "end">("start");

  const currentPickerValue = useMemo(() => {
    if (!timePickerDay) return "09:00";
    const wh = settings.workingHours[timePickerDay];
    return timePickerField === "start" ? wh?.start ?? "09:00" : wh?.end ?? "17:00";
  }, [timePickerDay, timePickerField, settings.workingHours]);

  const toggleDay = useCallback((day: string) => {
    const wh = { ...settings.workingHours };
    wh[day] = { ...wh[day], enabled: !wh[day].enabled };
    const action = { type: "UPDATE_SETTINGS" as const, payload: { workingHours: wh } };
    dispatch(action);
    syncToDb(action);
  }, [settings.workingHours, dispatch, syncToDb]);

  const openTimePicker = useCallback((day: string, field: "start" | "end") => {
    setTimePickerDay(day);
    setTimePickerField(field);
    setTimePickerVisible(true);
  }, []);

  const selectTime = useCallback((time: string) => {
    const wh = { ...settings.workingHours };
    wh[timePickerDay] = { ...wh[timePickerDay], [timePickerField]: time };
    const action = { type: "UPDATE_SETTINGS" as const, payload: { workingHours: wh } };
    dispatch(action);
    syncToDb(action);
    setTimePickerVisible(false);
  }, [timePickerDay, timePickerField, settings.workingHours, dispatch, syncToDb]);

  // Custom schedule
  const [customCalMonth, setCustomCalMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [selectedCustomDate, setSelectedCustomDate] = useState<string | null>(null);
  const [customTimePicker, setCustomTimePicker] = useState<{ date: string; field: "start" | "end" } | null>(null);

  const customCalDays = useMemo(() => {
    const { year, month } = customCalMonth;
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let d = 1; d <= daysInMonth; d++) days.push(d);
    return days;
  }, [customCalMonth]);

  const customCalLabel = useMemo(() => {
    const d = new Date(customCalMonth.year, customCalMonth.month, 1);
    return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  }, [customCalMonth]);

  const navigateMonth = useCallback((dir: number) => {
    setCustomCalMonth((prev) => {
      let m = prev.month + dir;
      let y = prev.year;
      if (m < 0) { m = 11; y--; }
      if (m > 11) { m = 0; y++; }
      return { year: y, month: m };
    });
  }, []);

  const getDateStr = useCallback((day: number) => {
    const { year, month } = customCalMonth;
    return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }, [customCalMonth]);

  const getCustomDayForDate = useCallback((dateStr: string): CustomScheduleDay | undefined => {
    return state.customSchedule.find((cs) => cs.date === dateStr);
  }, [state.customSchedule]);

  const toggleCustomDayOpen = useCallback((dateStr: string) => {
    const existing = state.customSchedule.find((cs) => cs.date === dateStr);
    if (existing) {
      if (existing.isOpen) {
        const cs: CustomScheduleDay = { date: dateStr, isOpen: false };
        dispatch({ type: "SET_CUSTOM_SCHEDULE", payload: cs });
        syncToDb({ type: "SET_CUSTOM_SCHEDULE", payload: cs });
      } else {
        dispatch({ type: "DELETE_CUSTOM_SCHEDULE", payload: dateStr });
        syncToDb({ type: "DELETE_CUSTOM_SCHEDULE", payload: dateStr });
      }
    } else {
      const cs: CustomScheduleDay = { date: dateStr, isOpen: false };
      dispatch({ type: "SET_CUSTOM_SCHEDULE", payload: cs });
      syncToDb({ type: "SET_CUSTOM_SCHEDULE", payload: cs });
    }
  }, [state.customSchedule, dispatch, syncToDb]);

  const setCustomDayHours = useCallback((dateStr: string, field: "start" | "end", time: string) => {
    const existing = state.customSchedule.find((cs) => cs.date === dateStr);
    const cs: CustomScheduleDay = {
      date: dateStr,
      isOpen: true,
      startTime: field === "start" ? time : (existing?.startTime ?? "09:00"),
      endTime: field === "end" ? time : (existing?.endTime ?? "17:00"),
    };
    dispatch({ type: "SET_CUSTOM_SCHEDULE", payload: cs });
    syncToDb({ type: "SET_CUSTOM_SCHEDULE", payload: cs });
    setCustomTimePicker(null);
  }, [state.customSchedule, dispatch, syncToDb]);

  const setCustomDayOpen = useCallback((dateStr: string) => {
    const cs: CustomScheduleDay = { date: dateStr, isOpen: true, startTime: "09:00", endTime: "17:00" };
    dispatch({ type: "SET_CUSTOM_SCHEDULE", payload: cs });
    syncToDb({ type: "SET_CUSTOM_SCHEDULE", payload: cs });
  }, [dispatch, syncToDb]);

  const removeCustomOverride = useCallback((dateStr: string) => {
    dispatch({ type: "DELETE_CUSTOM_SCHEDULE", payload: dateStr });
    syncToDb({ type: "DELETE_CUSTOM_SCHEDULE", payload: dateStr });
    setSelectedCustomDate(null);
  }, [dispatch, syncToDb]);

  // Buffer time
  const setBufferTime = useCallback((mins: number) => {
    const action = { type: "UPDATE_SETTINGS" as const, payload: { bufferTime: mins } };
    dispatch(action);
    syncToDb(action);
  }, [dispatch, syncToDb]);

  return (
    <ScreenContainer edges={["top", "left", "right"]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.backBtn, { opacity: pressed ? 0.6 : 1 }]}>
          <IconSymbol name="arrow.left" size={22} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Schedule & Hours</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
        {/* Buffer Time */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.cardRow}>
            <IconSymbol name="clock.fill" size={20} color="#FF9800" />
            <Text style={{ fontSize: 15, fontWeight: "500", color: colors.foreground, marginLeft: 12 }}>Buffer Time</Text>
          </View>
          <Text style={{ fontSize: 12, color: colors.muted, marginBottom: 10, marginTop: 4 }}>
            Break between appointments (applied to booking page)
          </Text>
          <View style={styles.chipRow}>
            {[0, 5, 10, 15, 30, 60].map((mins) => (
              <Pressable
                key={mins}
                onPress={() => setBufferTime(mins)}
                style={({ pressed }) => [
                  styles.chip,
                  {
                    backgroundColor: (settings.bufferTime ?? 0) === mins ? colors.primary : colors.background,
                    borderColor: (settings.bufferTime ?? 0) === mins ? colors.primary : colors.border,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <Text style={{ fontSize: 13, fontWeight: "500", color: (settings.bufferTime ?? 0) === mins ? "#FFFFFF" : colors.foreground }}>
                  {mins === 0 ? "None" : `${mins}m`}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Schedule Mode */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={{ fontSize: 12, fontWeight: "500", color: colors.muted, marginBottom: 4 }}>Schedule Mode</Text>
          <Text style={{ fontSize: 12, color: colors.muted, marginBottom: 12, lineHeight: 18 }}>
            {scheduleTab === "weekly"
              ? "Using recurring weekly hours. The same hours repeat every week."
              : "Using custom day-by-day schedule. Only days you explicitly add are available for booking."}
          </Text>
          <View style={styles.tabRow}>
            <Pressable
              onPress={() => setScheduleTab("weekly")}
              style={({ pressed }) => [
                styles.tab,
                {
                  backgroundColor: scheduleTab === "weekly" ? colors.primary : colors.background,
                  borderColor: scheduleTab === "weekly" ? colors.primary : colors.border,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <Text style={{ fontSize: 13, fontWeight: "600", color: scheduleTab === "weekly" ? "#fff" : colors.foreground }}>
                Weekly Hours
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setScheduleTab("custom")}
              style={({ pressed }) => [
                styles.tab,
                {
                  backgroundColor: scheduleTab === "custom" ? colors.primary : colors.background,
                  borderColor: scheduleTab === "custom" ? colors.primary : colors.border,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <Text style={{ fontSize: 13, fontWeight: "600", color: scheduleTab === "custom" ? "#fff" : colors.foreground }}>
                Custom Days
              </Text>
            </Pressable>
          </View>

          {scheduleTab === "weekly" ? (
            <View>
              <Text style={{ fontSize: 12, fontWeight: "500", color: colors.muted, marginBottom: 10 }}>Default Weekly Hours</Text>
              {DAYS_OF_WEEK.map((day, idx) => {
                const wh = settings.workingHours[day];
                const isLast = idx === DAYS_OF_WEEK.length - 1;
                return (
                  <View key={day} style={[styles.dayRow, !isLast && { borderBottomWidth: 1, borderBottomColor: colors.border + "40" }]}>
                    <Switch
                      value={wh.enabled}
                      onValueChange={() => toggleDay(day)}
                      trackColor={{ false: colors.border, true: colors.primary + "60" }}
                      thumbColor={wh.enabled ? colors.primary : colors.muted}
                      style={{ transform: [{ scale: 0.8 }] }}
                    />
                    <Text style={{ fontSize: 13, fontWeight: "500", width: 44, marginLeft: 8, color: wh.enabled ? colors.foreground : colors.muted }}>
                      {DAY_LABELS[day]}
                    </Text>
                    {wh.enabled && (
                      <View style={styles.timeInputs}>
                        <Pressable
                          onPress={() => openTimePicker(day, "start")}
                          style={({ pressed }) => [styles.timeButton, { backgroundColor: colors.background, borderColor: colors.border, opacity: pressed ? 0.7 : 1 }]}
                        >
                          <Text style={{ fontSize: 12, color: colors.foreground, textAlign: "center" }}>{formatTimeLabel(wh.start)}</Text>
                        </Pressable>
                        <Text style={{ fontSize: 12, color: colors.muted, marginHorizontal: 4 }}>to</Text>
                        <Pressable
                          onPress={() => openTimePicker(day, "end")}
                          style={({ pressed }) => [styles.timeButton, { backgroundColor: colors.background, borderColor: colors.border, opacity: pressed ? 0.7 : 1 }]}
                        >
                          <Text style={{ fontSize: 12, color: colors.foreground, textAlign: "center" }}>{formatTimeLabel(wh.end)}</Text>
                        </Pressable>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          ) : (
            <View>
              <Text style={{ fontSize: 12, fontWeight: "500", color: colors.muted, marginBottom: 12 }}>Custom Day Schedule</Text>
              <Text style={{ fontSize: 12, color: colors.muted, marginBottom: 12, lineHeight: 18 }}>
                Add dates with specific hours. Only dates you add here will be available for client booking.
              </Text>

              {/* Calendar Navigation */}
              <View style={styles.calNavRow}>
                <Pressable onPress={() => navigateMonth(-1)} style={({ pressed }) => [{ padding: 4, opacity: pressed ? 0.6 : 1 }]}>
                  <IconSymbol name="chevron.left" size={20} color={colors.foreground} />
                </Pressable>
                <Text style={{ fontSize: 16, fontWeight: "600", color: colors.foreground }}>{customCalLabel}</Text>
                <Pressable onPress={() => navigateMonth(1)} style={({ pressed }) => [{ padding: 4, opacity: pressed ? 0.6 : 1 }]}>
                  <IconSymbol name="chevron.right" size={20} color={colors.foreground} />
                </Pressable>
              </View>

              {/* Day Headers */}
              <View style={styles.calWeekRow}>
                {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                  <Text key={i} style={[styles.calDayHeader, { color: colors.muted }]}>{d}</Text>
                ))}
              </View>

              {/* Calendar Grid */}
              <View style={styles.calGrid}>
                {customCalDays.map((day, i) => {
                  if (day === null) return <View key={`e${i}`} style={styles.calCell} />;
                  const dateStr = getDateStr(day);
                  const customDay = getCustomDayForDate(dateStr);
                  const isSelected = selectedCustomDate === dateStr;
                  const todayStr = formatDateStr(new Date());
                  const isToday = dateStr === todayStr;
                  const isPast = dateStr < todayStr;
                  const isClosed = customDay?.isOpen === false;
                  const hasCustomHours = customDay?.isOpen === true && customDay.startTime;

                  let cellBg = "transparent";
                  let cellBorder = "transparent";
                  let textColor = colors.foreground;
                  if (isPast) textColor = colors.muted + "60";
                  if (isClosed) { cellBg = colors.error + "15"; textColor = colors.error; }
                  if (hasCustomHours) { cellBg = colors.primary + "15"; textColor = colors.primary; }
                  if (isSelected) { cellBorder = colors.primary; cellBg = colors.primary + "20"; }
                  if (isToday) { cellBorder = colors.primary; }

                  return (
                    <Pressable
                      key={day}
                      onPress={() => setSelectedCustomDate(isSelected ? null : dateStr)}
                      style={({ pressed }) => [
                        styles.calCell,
                        {
                          backgroundColor: cellBg,
                          borderColor: cellBorder,
                          borderWidth: isSelected || isToday ? 1.5 : 0,
                          borderRadius: 10,
                          opacity: pressed ? 0.7 : 1,
                        },
                      ]}
                    >
                      <Text style={{ fontSize: 14, fontWeight: isToday ? "700" : "400", color: textColor }}>{day}</Text>
                      {isClosed && <View style={[styles.calDot, { backgroundColor: colors.error }]} />}
                      {hasCustomHours && <View style={[styles.calDot, { backgroundColor: colors.primary }]} />}
                    </Pressable>
                  );
                })}
              </View>

              {/* Selected Date Detail */}
              {selectedCustomDate && (() => {
                const customDay = getCustomDayForDate(selectedCustomDate);
                const dateObj = new Date(selectedCustomDate + "T12:00:00");
                const dateLabel = dateObj.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
                return (
                  <View style={[styles.detailCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
                    <Text style={{ fontSize: 15, fontWeight: "600", color: colors.foreground, marginBottom: 10 }}>{dateLabel}</Text>
                    {!customDay ? (
                      <View>
                        <Text style={{ fontSize: 13, color: colors.muted, marginBottom: 10 }}>Using default weekly hours</Text>
                        <View style={{ flexDirection: "row", gap: 8 }}>
                          <Pressable
                            onPress={() => setCustomDayOpen(selectedCustomDate)}
                            style={({ pressed }) => [styles.actionBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 }]}
                          >
                            <Text style={{ color: "#fff", fontWeight: "600", fontSize: 13 }}>Set Custom Hours</Text>
                          </Pressable>
                          <Pressable
                            onPress={() => toggleCustomDayOpen(selectedCustomDate)}
                            style={({ pressed }) => [styles.actionBtn, { backgroundColor: colors.error, opacity: pressed ? 0.8 : 1 }]}
                          >
                            <Text style={{ color: "#fff", fontWeight: "600", fontSize: 13 }}>Mark Closed</Text>
                          </Pressable>
                        </View>
                      </View>
                    ) : customDay.isOpen === false ? (
                      <View>
                        <View style={[styles.closedTag, { backgroundColor: colors.error + "15" }]}>
                          <Text style={{ fontSize: 13, fontWeight: "600", color: colors.error }}>CLOSED</Text>
                        </View>
                        <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
                          <Pressable
                            onPress={() => setCustomDayOpen(selectedCustomDate)}
                            style={({ pressed }) => [styles.actionBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 }]}
                          >
                            <Text style={{ color: "#fff", fontWeight: "600", fontSize: 13 }}>Set Hours Instead</Text>
                          </Pressable>
                          <Pressable
                            onPress={() => removeCustomOverride(selectedCustomDate)}
                            style={({ pressed }) => [styles.actionBtn, { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, opacity: pressed ? 0.8 : 1 }]}
                          >
                            <Text style={{ color: colors.foreground, fontWeight: "600", fontSize: 13 }}>Remove Override</Text>
                          </Pressable>
                        </View>
                      </View>
                    ) : (
                      <View>
                        <Text style={{ fontSize: 13, color: colors.muted, marginBottom: 8 }}>Custom Hours</Text>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                          <Pressable
                            onPress={() => setCustomTimePicker({ date: selectedCustomDate, field: "start" })}
                            style={({ pressed }) => [styles.timeButton, { backgroundColor: colors.background, borderColor: colors.border, opacity: pressed ? 0.7 : 1 }]}
                          >
                            <Text style={{ fontSize: 13, color: colors.foreground }}>{formatTimeLabel(customDay.startTime ?? "09:00")}</Text>
                          </Pressable>
                          <Text style={{ color: colors.muted }}>to</Text>
                          <Pressable
                            onPress={() => setCustomTimePicker({ date: selectedCustomDate, field: "end" })}
                            style={({ pressed }) => [styles.timeButton, { backgroundColor: colors.background, borderColor: colors.border, opacity: pressed ? 0.7 : 1 }]}
                          >
                            <Text style={{ fontSize: 13, color: colors.foreground }}>{formatTimeLabel(customDay.endTime ?? "17:00")}</Text>
                          </Pressable>
                        </View>
                        <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
                          <Pressable
                            onPress={() => toggleCustomDayOpen(selectedCustomDate)}
                            style={({ pressed }) => [styles.actionBtn, { backgroundColor: colors.error + "15", opacity: pressed ? 0.8 : 1 }]}
                          >
                            <Text style={{ color: colors.error, fontWeight: "600", fontSize: 13 }}>Mark Closed</Text>
                          </Pressable>
                          <Pressable
                            onPress={() => removeCustomOverride(selectedCustomDate)}
                            style={({ pressed }) => [styles.actionBtn, { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, opacity: pressed ? 0.8 : 1 }]}
                          >
                            <Text style={{ color: colors.foreground, fontWeight: "600", fontSize: 13 }}>Remove Override</Text>
                          </Pressable>
                        </View>
                      </View>
                    )}
                  </View>
                );
              })()}

              {/* Existing Overrides */}
              {state.customSchedule.length > 0 && (
                <View style={{ marginTop: 14 }}>
                  <Text style={{ fontSize: 12, fontWeight: "500", color: colors.muted, marginBottom: 8 }}>Active Overrides</Text>
                  {state.customSchedule
                    .sort((a, b) => a.date.localeCompare(b.date))
                    .map((cs) => {
                      const d = new Date(cs.date + "T12:00:00");
                      const label = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
                      return (
                        <View key={cs.date} style={[styles.overrideRow, { borderColor: colors.border }]}>
                          <Text style={{ fontSize: 13, fontWeight: "500", color: colors.foreground, flex: 1 }}>{label}</Text>
                          {cs.isOpen ? (
                            <Text style={{ fontSize: 12, color: colors.primary }}>
                              {formatTimeLabel(cs.startTime ?? "09:00")} - {formatTimeLabel(cs.endTime ?? "17:00")}
                            </Text>
                          ) : (
                            <Text style={{ fontSize: 12, fontWeight: "600", color: colors.error }}>CLOSED</Text>
                          )}
                          <Pressable
                            onPress={() => removeCustomOverride(cs.date)}
                            style={({ pressed }) => [{ marginLeft: 10, opacity: pressed ? 0.5 : 1 }]}
                          >
                            <IconSymbol name="xmark" size={16} color={colors.muted} />
                          </Pressable>
                        </View>
                      );
                    })}
                </View>
              )}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Time Picker Modal */}
      <Modal visible={timePickerVisible} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={() => setTimePickerVisible(false)}>
          <Pressable style={[styles.modalContent, { backgroundColor: colors.background }]} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <Text style={{ fontSize: 17, fontWeight: "700", color: colors.foreground }}>
                Select {timePickerField === "start" ? "Start" : "End"} Time
              </Text>
              <Pressable onPress={() => setTimePickerVisible(false)} style={({ pressed }) => [{ opacity: pressed ? 0.5 : 1 }]}>
                <IconSymbol name="xmark" size={22} color={colors.foreground} />
              </Pressable>
            </View>
            <FlatList
              data={TIME_OPTIONS}
              keyExtractor={(item) => item}
              showsVerticalScrollIndicator={false}
              style={{ maxHeight: 360 }}
              initialScrollIndex={Math.max(0, TIME_OPTIONS.indexOf(currentPickerValue) - 2)}
              getItemLayout={(_, index) => ({ length: 48, offset: 48 * index, index })}
              renderItem={({ item }) => {
                const isSelected = item === currentPickerValue;
                return (
                  <Pressable
                    onPress={() => selectTime(item)}
                    style={({ pressed }) => [
                      styles.pickerItem,
                      {
                        backgroundColor: isSelected ? colors.primary + "15" : "transparent",
                        borderColor: isSelected ? colors.primary : "transparent",
                        opacity: pressed ? 0.7 : 1,
                      },
                    ]}
                  >
                    <Text style={{ fontSize: 16, fontWeight: isSelected ? "700" : "400", color: isSelected ? colors.primary : colors.foreground }}>
                      {formatTimeLabel(item)}
                    </Text>
                    {isSelected && <IconSymbol name="checkmark" size={18} color={colors.primary} />}
                  </Pressable>
                );
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>

      {/* Custom Schedule Time Picker Modal */}
      <Modal visible={!!customTimePicker} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={() => setCustomTimePicker(null)}>
          <Pressable style={[styles.modalContent, { backgroundColor: colors.background }]} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <Text style={{ fontSize: 17, fontWeight: "700", color: colors.foreground }}>
                Select {customTimePicker?.field === "start" ? "Start" : "End"} Time
              </Text>
              <Pressable onPress={() => setCustomTimePicker(null)} style={({ pressed }) => [{ opacity: pressed ? 0.5 : 1 }]}>
                <IconSymbol name="xmark" size={22} color={colors.foreground} />
              </Pressable>
            </View>
            <FlatList
              data={TIME_OPTIONS}
              keyExtractor={(item) => item}
              showsVerticalScrollIndicator={false}
              style={{ maxHeight: 360 }}
              renderItem={({ item }) => {
                const currentVal = customTimePicker
                  ? (customTimePicker.field === "start"
                    ? (getCustomDayForDate(customTimePicker.date)?.startTime ?? "09:00")
                    : (getCustomDayForDate(customTimePicker.date)?.endTime ?? "17:00"))
                  : "";
                const isSelected = item === currentVal;
                return (
                  <Pressable
                    onPress={() => customTimePicker && setCustomDayHours(customTimePicker.date, customTimePicker.field, item)}
                    style={({ pressed }) => [
                      styles.pickerItem,
                      {
                        backgroundColor: isSelected ? colors.primary + "15" : "transparent",
                        borderColor: isSelected ? colors.primary : "transparent",
                        opacity: pressed ? 0.7 : 1,
                      },
                    ]}
                  >
                    <Text style={{ fontSize: 16, fontWeight: isSelected ? "700" : "400", color: isSelected ? colors.primary : colors.foreground }}>
                      {formatTimeLabel(item)}
                    </Text>
                    {isSelected && <IconSymbol name="checkmark" size={18} color={colors.primary} />}
                  </Pressable>
                );
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 0.5 },
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 17, fontWeight: "700" },
  card: { borderRadius: 16, padding: 16, marginBottom: 14, borderWidth: 1 },
  cardRow: { flexDirection: "row", alignItems: "center" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1, alignItems: "center", justifyContent: "center", minHeight: 36 },
  tabRow: { flexDirection: "row", gap: 8, marginBottom: 14 },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1, alignItems: "center", justifyContent: "center", minHeight: 42 },
  dayRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10 },
  timeInputs: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 4 },
  timeButton: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, minWidth: 72, alignItems: "center", justifyContent: "center", minHeight: 34 },
  calNavRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  calWeekRow: { flexDirection: "row", marginBottom: 6 },
  calDayHeader: { width: "14.28%", textAlign: "center", fontSize: 12, fontWeight: "600", lineHeight: 18 },
  calGrid: { flexDirection: "row", flexWrap: "wrap" },
  calCell: { width: "14.28%", aspectRatio: 1, alignItems: "center", justifyContent: "center", padding: 2 },
  calDot: { width: 5, height: 5, borderRadius: 2.5, marginTop: 2 },
  detailCard: { marginTop: 14, padding: 14, borderRadius: 14, borderWidth: 1 },
  closedTag: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, alignSelf: "flex-start" },
  actionBtn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, alignItems: "center", justifyContent: "center", minHeight: 40 },
  overrideRow: { flexDirection: "row", alignItems: "center", paddingVertical: 8, borderBottomWidth: 0.5 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  modalContent: { borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 16, paddingBottom: 40, paddingHorizontal: 20 },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  pickerItem: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, borderWidth: 1, marginBottom: 4, height: 48 },
});
