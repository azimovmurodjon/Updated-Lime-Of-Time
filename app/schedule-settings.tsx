import { useState, useCallback, useMemo, useRef } from "react";
import { Text, View, Pressable, StyleSheet, Switch, Modal, ScrollView } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useStore } from "@/lib/store";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useRouter } from "expo-router";
import type { CustomScheduleDay } from "@/lib/types";
import { TapTimePicker, timeToMinutes as tapTimeToMinutes } from "@/components/tap-time-picker";
import { useActiveLocation } from "@/hooks/use-active-location";
import { useResponsive } from "@/hooks/use-responsive";
import { LocationSwitcher } from "@/components/location-switcher";

const DAYS_OF_WEEK = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const DAY_LABELS: Record<string, string> = { monday: "Mon", tuesday: "Tue", wednesday: "Wed", thursday: "Thu", friday: "Fri", saturday: "Sat", sunday: "Sun" };
const DAY_FULL: Record<string, string> = { monday: "Monday", tuesday: "Tuesday", wednesday: "Wednesday", thursday: "Thursday", friday: "Friday", saturday: "Saturday", sunday: "Sunday" };

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
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

function formatDateLabel(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

// ─── Mini Calendar for Active Until date picker ───────────────────────────────
function MiniCalendar({
  selectedDate,
  minDate,
  onSelect,
  colors,
}: {
  selectedDate: string | null;
  minDate: string;
  onSelect: (date: string) => void;
  colors: ReturnType<typeof useColors>;
}) {
  const today = new Date();
  const [calMonth, setCalMonth] = useState(() => {
    if (selectedDate) {
      const d = new Date(selectedDate + "T12:00:00");
      return { year: d.getFullYear(), month: d.getMonth() };
    }
    return { year: today.getFullYear(), month: today.getMonth() };
  });

  const calLabel = useMemo(() => {
    const d = new Date(calMonth.year, calMonth.month, 1);
    return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  }, [calMonth]);

  const calDays = useMemo(() => {
    const { year, month } = calMonth;
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let d = 1; d <= daysInMonth; d++) days.push(d);
    return days;
  }, [calMonth]);

  const navigateMonth = (dir: number) => {
    setCalMonth((prev) => {
      let m = prev.month + dir;
      let y = prev.year;
      if (m < 0) { m = 11; y--; }
      if (m > 11) { m = 0; y++; }
      return { year: y, month: m };
    });
  };

  const getDateStr = (day: number) => {
    const { year, month } = calMonth;
    return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  };

  return (
    <View style={{ marginTop: 12 }}>
      {/* Month navigation */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <Pressable onPress={() => navigateMonth(-1)} style={({ pressed }) => [{ padding: 6, opacity: pressed ? 0.6 : 1 }]}>
          <IconSymbol name="chevron.left" size={18} color={colors.foreground} />
        </Pressable>
        <Text style={{ fontSize: 15, fontWeight: "600", color: colors.foreground }}>{calLabel}</Text>
        <Pressable onPress={() => navigateMonth(1)} style={({ pressed }) => [{ padding: 6, opacity: pressed ? 0.6 : 1 }]}>
          <IconSymbol name="chevron.right" size={18} color={colors.foreground} />
        </Pressable>
      </View>

      {/* Day headers */}
      <View style={{ flexDirection: "row", marginBottom: 4 }}>
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <Text key={i} style={{ width: "14.28%", textAlign: "center", fontSize: 11, fontWeight: "600", color: colors.muted }}>{d}</Text>
        ))}
      </View>

      {/* Calendar grid */}
      <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
        {calDays.map((day, i) => {
          if (day === null) return <View key={`e${i}`} style={{ width: "14.28%", aspectRatio: 1 }} />;
          const dateStr = getDateStr(day);
          const isPast = dateStr < minDate;
          const isSelected = dateStr === selectedDate;
          const isToday = dateStr === formatDateStr(today);

          return (
            <Pressable
              key={day}
              onPress={() => !isPast && onSelect(dateStr)}
              style={({ pressed }) => [{
                width: "14.28%",
                aspectRatio: 1,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 8,
                backgroundColor: isSelected ? colors.primary : "transparent",
                borderWidth: isToday && !isSelected ? 1.5 : 0,
                borderColor: colors.primary,
                opacity: isPast ? 0.3 : pressed ? 0.7 : 1,
              }]}
            >
              <Text style={{
                fontSize: 13,
                fontWeight: isToday || isSelected ? "700" : "400",
                color: isSelected ? "#fff" : colors.foreground,
              }}>{day}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function ScheduleSettingsScreen() {
  const { state, dispatch, syncToDb } = useStore();
  const colors = useColors();
  const router = useRouter();
  const { isTablet, hp } = useResponsive();
  const settings = state.settings;
  const { activeLocation, hasMultipleLocations } = useActiveLocation();

  // Use the active location's working hours when a location is selected;
  // fall back to global settings.workingHours for single-location businesses.
  const effectiveWorkingHours = (
    activeLocation?.workingHours && Object.keys(activeLocation.workingHours).length > 0
  ) ? activeLocation.workingHours : settings.workingHours;

  // Save working hours to the active location or global settings
  const saveWorkingHours = useCallback((wh: typeof settings.workingHours) => {
    if (activeLocation) {
      const action = { type: "UPDATE_LOCATION" as const, payload: { ...activeLocation, workingHours: wh } };
      dispatch(action);
      syncToDb(action);
    } else {
      const action = { type: "UPDATE_SETTINGS" as const, payload: { workingHours: wh } };
      dispatch(action);
      syncToDb(action);
    }
  }, [activeLocation, dispatch, syncToDb]);

  const scheduleTab = settings.scheduleMode ?? "weekly";
  const setScheduleTab = useCallback((mode: "weekly" | "custom") => {
    const action = { type: "UPDATE_SETTINGS" as const, payload: { scheduleMode: mode } };
    dispatch(action);
    syncToDb(action);
  }, [dispatch, syncToDb]);

  // ── Weekly time picker modal ───────────────────────────────────────────────
  const [timePickerDay, setTimePickerDay] = useState<string | null>(null);
  const [draftStart, setDraftStart] = useState("09:00");
  const [draftEnd, setDraftEnd] = useState("17:00");
  const [weekTimeError, setWeekTimeError] = useState<string | null>(null);
  // which sub-picker is open: null | "start" | "end"
  const [weekSubPicker, setWeekSubPicker] = useState<"start" | "end" | null>(null);

  const openTimePicker = useCallback((day: string) => {
    const wh = effectiveWorkingHours[day];
    setDraftStart(wh?.start ?? "09:00");
    setDraftEnd(wh?.end ?? "17:00");
    setWeekTimeError(null);
    setWeekSubPicker(null);
    setTimePickerDay(day);
  }, [effectiveWorkingHours]);

  const saveTimePicker = useCallback(() => {
    if (!timePickerDay) return;
    if (tapTimeToMinutes(draftEnd) <= tapTimeToMinutes(draftStart)) {
      setWeekTimeError("End time must be after start time.");
      return;
    }
    setWeekTimeError(null);
    const wh = { ...effectiveWorkingHours };
    wh[timePickerDay] = { ...wh[timePickerDay], start: draftStart, end: draftEnd };
    saveWorkingHours(wh);
    setTimePickerDay(null);
    setWeekSubPicker(null);
  }, [timePickerDay, draftStart, draftEnd, effectiveWorkingHours, saveWorkingHours]);

  const toggleDay = useCallback((day: string) => {
    const wh = { ...effectiveWorkingHours };
    wh[day] = { ...wh[day], enabled: !wh[day].enabled };
    saveWorkingHours(wh);
  }, [effectiveWorkingHours, saveWorkingHours]);

  // ── Active Until ───────────────────────────────────────────────────────────
  const activeUntilEnabled = !!settings.businessHoursEndDate;
  const todayStr = formatDateStr(new Date());

  const toggleActiveUntil = useCallback(() => {
    const newVal = activeUntilEnabled ? null : null; // toggle off = null, toggle on = show calendar (no date yet)
    if (activeUntilEnabled) {
      const action = { type: "UPDATE_SETTINGS" as const, payload: { businessHoursEndDate: null } };
      dispatch(action);
      syncToDb(action);
    }
    // If turning on, just show the calendar — user picks the date
    setShowActiveUntilCal(!activeUntilEnabled);
  }, [activeUntilEnabled, dispatch, syncToDb]);

  const [showActiveUntilCal, setShowActiveUntilCal] = useState(false);

  const selectActiveUntilDate = useCallback((dateStr: string) => {
    const action = { type: "UPDATE_SETTINGS" as const, payload: { businessHoursEndDate: dateStr } };
    dispatch(action);
    syncToDb(action);
    setShowActiveUntilCal(false);
  }, [dispatch, syncToDb]);

  // ── Custom schedule ────────────────────────────────────────────────────────
  const [customCalMonth, setCustomCalMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [selectedCustomDate, setSelectedCustomDate] = useState<string | null>(null);
  const [customTimePicker, setCustomTimePicker] = useState<{ date: string } | null>(null);
  const [customDraftStart, setCustomDraftStart] = useState("09:00");
  const [customDraftEnd, setCustomDraftEnd] = useState("17:00");
  const [customTimeError, setCustomTimeError] = useState<string | null>(null);
  const [customSubPicker, setCustomSubPicker] = useState<"start" | "end" | null>(null);

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

  // Use per-location custom schedule when a location is active, fall back to global
  const activeCustomSchedule = useMemo(() => {
    if (activeLocation) {
      return state.locationCustomSchedule[activeLocation.id] ?? [];
    }
    return state.customSchedule;
  }, [activeLocation, state.locationCustomSchedule, state.customSchedule]);

  const getCustomDayForDate = useCallback((dateStr: string): CustomScheduleDay | undefined => {
    return activeCustomSchedule.find((cs) => cs.date === dateStr);
  }, [activeCustomSchedule]);

  const toggleCustomDayOpen = useCallback((dateStr: string) => {
    const existing = activeCustomSchedule.find((cs) => cs.date === dateStr);
    if (activeLocation) {
      // Per-location override
      if (existing) {
        if (existing.isOpen) {
          const cs: CustomScheduleDay = { date: dateStr, isOpen: false, locationId: activeLocation.id };
          dispatch({ type: "SET_LOCATION_CUSTOM_SCHEDULE", payload: { locationId: activeLocation.id, day: cs } });
          syncToDb({ type: "SET_LOCATION_CUSTOM_SCHEDULE", payload: { locationId: activeLocation.id, day: cs } });
        } else {
          dispatch({ type: "DELETE_LOCATION_CUSTOM_SCHEDULE", payload: { locationId: activeLocation.id, date: dateStr } });
          syncToDb({ type: "DELETE_LOCATION_CUSTOM_SCHEDULE", payload: { locationId: activeLocation.id, date: dateStr } });
        }
      } else {
        const cs: CustomScheduleDay = { date: dateStr, isOpen: false, locationId: activeLocation.id };
        dispatch({ type: "SET_LOCATION_CUSTOM_SCHEDULE", payload: { locationId: activeLocation.id, day: cs } });
        syncToDb({ type: "SET_LOCATION_CUSTOM_SCHEDULE", payload: { locationId: activeLocation.id, day: cs } });
      }
    } else {
      // Global override (no active location)
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
    }
  }, [activeCustomSchedule, activeLocation, dispatch, syncToDb]);

  const setCustomDayOpen = useCallback((dateStr: string) => {
    if (activeLocation) {
      const cs: CustomScheduleDay = { date: dateStr, isOpen: true, startTime: "09:00", endTime: "17:00", locationId: activeLocation.id };
      dispatch({ type: "SET_LOCATION_CUSTOM_SCHEDULE", payload: { locationId: activeLocation.id, day: cs } });
      syncToDb({ type: "SET_LOCATION_CUSTOM_SCHEDULE", payload: { locationId: activeLocation.id, day: cs } });
    } else {
      const cs: CustomScheduleDay = { date: dateStr, isOpen: true, startTime: "09:00", endTime: "17:00" };
      dispatch({ type: "SET_CUSTOM_SCHEDULE", payload: cs });
      syncToDb({ type: "SET_CUSTOM_SCHEDULE", payload: cs });
    }
  }, [activeLocation, dispatch, syncToDb]);

  const removeCustomOverride = useCallback((dateStr: string) => {
    if (activeLocation) {
      dispatch({ type: "DELETE_LOCATION_CUSTOM_SCHEDULE", payload: { locationId: activeLocation.id, date: dateStr } });
      syncToDb({ type: "DELETE_LOCATION_CUSTOM_SCHEDULE", payload: { locationId: activeLocation.id, date: dateStr } });
    } else {
      dispatch({ type: "DELETE_CUSTOM_SCHEDULE", payload: dateStr });
      syncToDb({ type: "DELETE_CUSTOM_SCHEDULE", payload: dateStr });
    }
    setSelectedCustomDate(null);
  }, [activeLocation, dispatch, syncToDb]);

  const openCustomTimePicker = useCallback((dateStr: string) => {
    const existing = activeCustomSchedule.find((cs) => cs.date === dateStr);
    setCustomDraftStart(existing?.startTime ?? "09:00");
    setCustomDraftEnd(existing?.endTime ?? "17:00");
    setCustomTimeError(null);
    setCustomSubPicker(null);
    setCustomTimePicker({ date: dateStr });
  }, [activeCustomSchedule]);

  const saveCustomTimePicker = useCallback(() => {
    if (!customTimePicker) return;
    const startMin = tapTimeToMinutes(customDraftStart);
    const endMin = tapTimeToMinutes(customDraftEnd);
    if (endMin <= startMin) {
      setCustomTimeError("End time must be after start time.");
      return;
    }
    setCustomTimeError(null);
    if (activeLocation) {
      const cs: CustomScheduleDay = {
        date: customTimePicker.date,
        isOpen: true,
        startTime: customDraftStart,
        endTime: customDraftEnd,
        locationId: activeLocation.id,
      };
      dispatch({ type: "SET_LOCATION_CUSTOM_SCHEDULE", payload: { locationId: activeLocation.id, day: cs } });
      syncToDb({ type: "SET_LOCATION_CUSTOM_SCHEDULE", payload: { locationId: activeLocation.id, day: cs } });
    } else {
      const cs: CustomScheduleDay = {
        date: customTimePicker.date,
        isOpen: true,
        startTime: customDraftStart,
        endTime: customDraftEnd,
      };
      dispatch({ type: "SET_CUSTOM_SCHEDULE", payload: cs });
      syncToDb({ type: "SET_CUSTOM_SCHEDULE", payload: cs });
    }
    setCustomTimePicker(null);
  }, [customTimePicker, customDraftStart, customDraftEnd, activeLocation, dispatch, syncToDb]);

  // ── Buffer time ────────────────────────────────────────────────────────────
  const setBufferTime = useCallback((mins: number) => {
    const action = { type: "UPDATE_SETTINGS" as const, payload: { bufferTime: mins } };
    dispatch(action);
    syncToDb(action);
  }, [dispatch, syncToDb]);

  // ── Time picker day info ───────────────────────────────────────────────────
  const pickerDayWH = timePickerDay ? effectiveWorkingHours[timePickerDay] : null;

  return (
    <ScreenContainer edges={["top", "left", "right"]} tabletMaxWidth={720}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border, paddingHorizontal: hp }]}>
        <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.backBtn, { opacity: pressed ? 0.6 : 1 }]}>
          <IconSymbol name="arrow.left" size={22} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Schedule & Hours</Text>
        {hasMultipleLocations ? <LocationSwitcher compact /> : <View style={{ width: 36 }} />}
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: hp, paddingVertical: 16, paddingBottom: 60 }}>

        {/* ── Buffer Time ──────────────────────────────────────────────────── */}
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

        {/* ── Schedule Mode ────────────────────────────────────────────────── */}
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
                Business Hours
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
              <Text style={{ fontSize: 12, fontWeight: "500", color: colors.muted, marginBottom: 10 }}>Business Hours</Text>
              {DAYS_OF_WEEK.map((day, idx) => {
                const wh = effectiveWorkingHours[day];
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
                      <Pressable
                        onPress={() => openTimePicker(day)}
                        style={({ pressed }) => [
                          styles.timeButton,
                          { backgroundColor: colors.background, borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
                        ]}
                      >
                        <Text style={{ fontSize: 12, color: colors.foreground }}>
                          {formatTimeLabel(wh.start)} – {formatTimeLabel(wh.end)}
                        </Text>
                      </Pressable>
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
                  const todayDateStr = formatDateStr(new Date());
                  const isToday = dateStr === todayDateStr;
                  const isPast = dateStr < todayDateStr;
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
                            onPress={() => openCustomTimePicker(selectedCustomDate)}
                            style={({ pressed }) => [styles.timeButton, { backgroundColor: colors.background, borderColor: colors.border, opacity: pressed ? 0.7 : 1 }]}
                          >
                            <Text style={{ fontSize: 13, color: colors.foreground }}>
                              {formatTimeLabel(customDay.startTime ?? "09:00")} – {formatTimeLabel(customDay.endTime ?? "17:00")}
                            </Text>
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
                              {formatTimeLabel(cs.startTime ?? "09:00")} – {formatTimeLabel(cs.endTime ?? "17:00")}
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

        {/* ── Active Until ─────────────────────────────────────────────────── */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View style={{ flex: 1, marginRight: 12 }}>
              <View style={styles.cardRow}>
                <IconSymbol name="calendar.badge.clock" size={20} color="#9C27B0" />
                <Text style={{ fontSize: 15, fontWeight: "500", color: colors.foreground, marginLeft: 12 }}>Active Until</Text>
              </View>
              <Text style={{ fontSize: 12, color: colors.muted, marginTop: 4, lineHeight: 18 }}>
                {activeUntilEnabled && settings.businessHoursEndDate
                  ? `Business Hours active until ${formatDateLabel(settings.businessHoursEndDate)}. After this date, no days are available for booking.`
                  : "Set an end date for your Business Hours. After this date, no days will be available for booking."}
              </Text>
            </View>
            <Switch
              value={activeUntilEnabled || showActiveUntilCal}
              onValueChange={toggleActiveUntil}
              trackColor={{ false: colors.border, true: "#9C27B0" + "60" }}
              thumbColor={activeUntilEnabled || showActiveUntilCal ? "#9C27B0" : colors.muted}
            />
          </View>

          {/* Selected date display */}
          {activeUntilEnabled && settings.businessHoursEndDate && !showActiveUntilCal && (
            <View style={{ marginTop: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <View style={[styles.dateChip, { backgroundColor: "#9C27B0" + "15", borderColor: "#9C27B0" + "40" }]}>
                <IconSymbol name="calendar" size={14} color="#9C27B0" />
                <Text style={{ fontSize: 13, fontWeight: "600", color: "#9C27B0", marginLeft: 6 }}>
                  {formatDateLabel(settings.businessHoursEndDate)}
                </Text>
              </View>
              <Pressable
                onPress={() => setShowActiveUntilCal(true)}
                style={({ pressed }) => [styles.changeBtn, { borderColor: colors.border, opacity: pressed ? 0.7 : 1 }]}
              >
                <Text style={{ fontSize: 12, color: colors.foreground }}>Change</Text>
              </Pressable>
            </View>
          )}

          {/* Calendar picker */}
          {showActiveUntilCal && (
            <MiniCalendar
              selectedDate={settings.businessHoursEndDate ?? null}
              minDate={todayStr}
              onSelect={selectActiveUntilDate}
              colors={colors}
            />
          )}
        </View>

      </ScrollView>

      {/* Weekly Time Picker Modal */}
      <Modal visible={!!timePickerDay} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={() => { setTimePickerDay(null); setWeekSubPicker(null); }}>
          <Pressable style={[styles.modalContent, { backgroundColor: colors.background }]} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <Text style={{ fontSize: 17, fontWeight: "700", color: colors.foreground }}>
                {timePickerDay ? DAY_FULL[timePickerDay] : ""} Hours
              </Text>
              <Pressable onPress={() => { setTimePickerDay(null); setWeekSubPicker(null); }} style={({ pressed }) => [{ opacity: pressed ? 0.5 : 1 }]}>
                <IconSymbol name="xmark" size={22} color={colors.foreground} />
              </Pressable>
            </View>

            {/* Start row */}
            <Pressable
              onPress={() => setWeekSubPicker(weekSubPicker === "start" ? null : "start")}
              style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 14, paddingHorizontal: 4, borderRadius: 12, backgroundColor: weekSubPicker === "start" ? colors.primary + "18" : "transparent", marginBottom: 4 }}
            >
              <Text style={{ fontSize: 15, fontWeight: "600", color: colors.foreground }}>Start Time</Text>
              <Text style={{ fontSize: 17, fontWeight: "700", color: colors.primary }}>{formatTimeLabel(draftStart)}</Text>
            </Pressable>
            {weekSubPicker === "start" && (
              <TapTimePicker value={draftStart} onChange={(v) => { setDraftStart(v); setWeekTimeError(null); }} stepMinutes={15} />
            )}

            {/* End row */}
            <Pressable
              onPress={() => setWeekSubPicker(weekSubPicker === "end" ? null : "end")}
              style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 14, paddingHorizontal: 4, borderRadius: 12, backgroundColor: weekSubPicker === "end" ? colors.primary + "18" : "transparent", marginBottom: 4 }}
            >
              <Text style={{ fontSize: 15, fontWeight: "600", color: colors.foreground }}>End Time</Text>
              <Text style={{ fontSize: 17, fontWeight: "700", color: colors.primary }}>{formatTimeLabel(draftEnd)}</Text>
            </Pressable>
            {weekSubPicker === "end" && (
              <TapTimePicker value={draftEnd} onChange={(v) => { setDraftEnd(v); setWeekTimeError(null); }} stepMinutes={15} />
            )}

            {weekTimeError ? (
              <Text style={{ color: colors.error, fontSize: 13, textAlign: "center", marginVertical: 8 }}>{weekTimeError}</Text>
            ) : null}
            <Pressable
              onPress={saveTimePicker}
              style={({ pressed }) => [styles.saveBtn, { backgroundColor: weekTimeError ? colors.border : colors.primary, opacity: pressed ? 0.8 : 1, marginTop: 12 }]}
            >
              <Text style={{ color: weekTimeError ? colors.muted : "#fff", fontWeight: "700", fontSize: 16 }}>Save Hours</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Custom Schedule Time Picker Modal */}
      <Modal visible={!!customTimePicker} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={() => { setCustomTimePicker(null); setCustomSubPicker(null); }}>
          <Pressable style={[styles.modalContent, { backgroundColor: colors.background }]} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <Text style={{ fontSize: 17, fontWeight: "700", color: colors.foreground }}>
                {customTimePicker ? (() => {
                  const d = new Date(customTimePicker.date + "T12:00:00");
                  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
                })() : ""} Hours
              </Text>
              <Pressable onPress={() => { setCustomTimePicker(null); setCustomSubPicker(null); }} style={({ pressed }) => [{ opacity: pressed ? 0.5 : 1 }]}>
                <IconSymbol name="xmark" size={22} color={colors.foreground} />
              </Pressable>
            </View>

            {/* Start row */}
            <Pressable
              onPress={() => setCustomSubPicker(customSubPicker === "start" ? null : "start")}
              style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 14, paddingHorizontal: 4, borderRadius: 12, backgroundColor: customSubPicker === "start" ? colors.primary + "18" : "transparent", marginBottom: 4 }}
            >
              <Text style={{ fontSize: 15, fontWeight: "600", color: colors.foreground }}>Start Time</Text>
              <Text style={{ fontSize: 17, fontWeight: "700", color: colors.primary }}>{formatTimeLabel(customDraftStart)}</Text>
            </Pressable>
            {customSubPicker === "start" && (
              <TapTimePicker value={customDraftStart} onChange={(v) => { setCustomDraftStart(v); setCustomTimeError(null); }} stepMinutes={15} />
            )}

            {/* End row */}
            <Pressable
              onPress={() => setCustomSubPicker(customSubPicker === "end" ? null : "end")}
              style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 14, paddingHorizontal: 4, borderRadius: 12, backgroundColor: customSubPicker === "end" ? colors.primary + "18" : "transparent", marginBottom: 4 }}
            >
              <Text style={{ fontSize: 15, fontWeight: "600", color: colors.foreground }}>End Time</Text>
              <Text style={{ fontSize: 17, fontWeight: "700", color: colors.primary }}>{formatTimeLabel(customDraftEnd)}</Text>
            </Pressable>
            {customSubPicker === "end" && (
              <TapTimePicker value={customDraftEnd} onChange={(v) => { setCustomDraftEnd(v); setCustomTimeError(null); }} stepMinutes={15} />
            )}

            {customTimeError ? (
              <Text style={{ color: colors.error, fontSize: 13, textAlign: "center", marginVertical: 8 }}>{customTimeError}</Text>
            ) : null}
            <Pressable
              onPress={saveCustomTimePicker}
              style={({ pressed }) => [styles.saveBtn, { backgroundColor: customTimeError ? colors.border : colors.primary, opacity: pressed ? 0.8 : 1, marginTop: 12 }]}
            >
              <Text style={{ color: customTimeError ? colors.muted : "#fff", fontWeight: "700", fontSize: 16 }}>Save Hours</Text>
            </Pressable>
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
  timeButton: { flex: 1, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8, borderWidth: 1, alignItems: "center", justifyContent: "center", minHeight: 36, marginLeft: 4 },
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
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  saveBtn: { paddingVertical: 16, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  dateChip: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1 },
  changeBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1 },
});
