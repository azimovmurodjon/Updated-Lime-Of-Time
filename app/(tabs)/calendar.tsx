import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import {
  Text,
  View,
  Pressable,
  StyleSheet,
  Alert,
  Linking,
  Platform,
  ScrollView,
  Switch,
  Modal,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useStore, formatTime, formatDateStr, formatDateDisplay } from "@/lib/store";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useActiveLocation } from "@/hooks/use-active-location";
import { useResponsive } from "@/hooks/use-responsive";
import {
  Appointment,
  isDateInPast,
  getServiceDisplayName,
  formatTimeDisplay,
  minutesToTime,
  timeToMinutes,
  generateAcceptMessage,
  generateRejectMessage,
  stripPhoneFormat,
  CustomScheduleDay,
} from "@/lib/types";
import { TapTimePicker, timeToMinutes as tapTimeToMinutes } from "@/components/tap-time-picker";
import { formatPhone } from "@/lib/utils";

type CalendarView = "month" | "day" | "week";

const FILTERS = [
  { key: "upcoming", label: "Upcoming" },
  { key: "requests", label: "Requests" },
  { key: "cancelled", label: "Cancelled" },
  { key: "completed", label: "Completed" },
] as const;

type FilterKey = (typeof FILTERS)[number]["key"];

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAY_HEADERS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const DAY_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_NAMES = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

// Timeline hours: 6am to 10pm
const TIMELINE_START = 6;
const TIMELINE_END = 22;
const HOUR_HEIGHT = 60;

// ─── TimelineView ───────────────────────────────────────────────────────────────────
// Proper React component for the timeline grid + appointment blocks.
// Using a component (not a render function) allows useState for container measurement.
type TimelineViewProps = {
  dateStr: string;
  appts: Appointment[];
  tintColor?: string;
  liveNow: Date;
  timelineHours: string[];
  effectiveHours: { start: string; end: string } | null;
  available: boolean;
  colors: {
    border: string;
    muted: string;
    surface: string;
    foreground: string;
    primary: string;
  };
  getServiceById: (id: string) => { color?: string; name?: string; duration?: number } | undefined;
  getClientById: (id: string) => { name?: string } | undefined;
  onApptPress: (id: string) => void;
};

function TimelineView({
  dateStr, appts, tintColor, liveNow, timelineHours, effectiveHours, available,
  colors, getServiceById, getClientById, onApptPress,
}: TimelineViewProps) {
  const [containerWidth, setContainerWidth] = React.useState(0);
  const LABEL_WIDTH = 56;
  const totalHours = TIMELINE_END - TIMELINE_START + 1;
  const gridHeight = totalHours * HOUR_HEIGHT;

  const isToday = dateStr === formatDateStr(liveNow);
  const nowMinutes = liveNow.getHours() * 60 + liveNow.getMinutes();
  const nowTop = (nowMinutes - TIMELINE_START * 60) * (HOUR_HEIGHT / 60);
  const showNowLine = isToday && nowTop >= 0 && nowTop <= gridHeight;
  const nowPillLabel = liveNow.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: true }).replace(" ", "\u202f");

  // Build column layout using a proper interval-graph algorithm:
  // 1. Sort by start time, assign each appointment to the first free column.
  // 2. Find connected overlap groups (union-find style) so every appointment
  //    in the same cluster gets the same totalCols value.
  type ApptLayout = { appt: Appointment; col: number; totalCols: number; top: number; height: number };

  // Step 1: compute top/height and filter out-of-range
  const items: { appt: Appointment; startMin: number; endMin: number; top: number; height: number }[] = [];
  for (const appt of appts) {
    const startMin = timeToMinutes(appt.time);
    const endMin = startMin + appt.duration;
    const top = (startMin - TIMELINE_START * 60) * (HOUR_HEIGHT / 60);
    const height = Math.max(appt.duration * (HOUR_HEIGHT / 60), 28);
    if (top < 0 || top > gridHeight) continue;
    items.push({ appt, startMin, endMin, top, height });
  }

  // Step 2: greedy column assignment — track the end time of the last appt in each column
  const colEnds: number[] = [];
  const layouts: ApptLayout[] = items.map(({ appt, startMin, endMin, top, height }) => {
    let col = colEnds.findIndex((end) => end <= startMin);
    if (col === -1) col = colEnds.length;
    colEnds[col] = endMin;
    return { appt, col, totalCols: 0, top, height };
  });

  // Step 3: find overlap groups via union-find so every appointment in a
  // cluster shares the same totalCols (= max col index in cluster + 1).
  // Two appointments overlap when their time intervals intersect.
  const parent = layouts.map((_, i) => i);
  function find(x: number): number {
    while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; }
    return x;
  }
  function union(a: number, b: number) { parent[find(a)] = find(b); }

  for (let i = 0; i < layouts.length; i++) {
    const si = items[i].startMin;
    const ei = items[i].endMin;
    for (let j = i + 1; j < layouts.length; j++) {
      const sj = items[j].startMin;
      const ej = items[j].endMin;
      if (si < ej && sj < ei) union(i, j); // intervals overlap
    }
  }

  // Compute max col per group
  const groupMaxCol = new Map<number, number>();
  for (let i = 0; i < layouts.length; i++) {
    const root = find(i);
    groupMaxCol.set(root, Math.max(groupMaxCol.get(root) ?? 0, layouts[i].col));
  }
  for (let i = 0; i < layouts.length; i++) {
    layouts[i].totalCols = (groupMaxCol.get(find(i)) ?? 0) + 1;
  }

  const GAP = 2;
  const PADDING_RIGHT = 4;
  const slotAreaWidth = containerWidth > 0 ? containerWidth - LABEL_WIDTH - 4 - PADDING_RIGHT : 0;

  return (
    <View
      style={[styles.timelineContainer, { borderColor: colors.border }]}
      onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
    >
      {/* Hour rows — background grid */}
      {timelineHours.map((hour) => {
        const isWorkingHour = available && effectiveHours
          ? timeToMinutes(hour) >= timeToMinutes(effectiveHours.start) &&
            timeToMinutes(hour) < timeToMinutes(effectiveHours.end)
          : available;
        return (
          <View key={hour} style={[styles.timelineRow, { borderBottomColor: colors.border, height: HOUR_HEIGHT }]}>
            <View style={[styles.timelineLabel, { opacity: isWorkingHour ? 1 : 0.4 }]}>
              <Text
                style={{ fontSize: 10, fontWeight: "500", color: colors.muted }}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
              >
                {formatTimeDisplay(hour)}
              </Text>
            </View>
            <View style={[styles.timelineSlot, {
              backgroundColor: isWorkingHour ? "transparent" : colors.surface + "80",
            }]} />
          </View>
        );
      })}

      {/* Appointment blocks — side-by-side columns */}
      {layouts.map(({ appt, col, totalCols, top, height }) => {
        const svc = getServiceById(appt.serviceId) as { color?: string; name?: string; duration?: number } | undefined;
        const client = getClientById(appt.clientId) as { name?: string } | undefined;
        const color = (svc as { color?: string } | undefined)?.color ?? tintColor ?? colors.primary;
        // Use svc.name directly (not getServiceDisplayName) to avoid showing duration twice
        const svcName = (svc as { name?: string } | undefined)?.name ?? "Appt";
        const colWidth = slotAreaWidth > 0 ? (slotAreaWidth - GAP * (totalCols - 1)) / totalCols : 0;
        const blockLeft = LABEL_WIDTH + 4 + col * (colWidth + GAP);
        const blockWidth = colWidth > 0 ? colWidth : undefined;
        return (
          <Pressable
            key={appt.id}
            onPress={() => onApptPress(appt.id)}
            style={({ pressed }) => ([
              styles.timelineApptAbs,
              {
                top,
                height,
                left: blockWidth ? blockLeft : LABEL_WIDTH + 4,
                width: blockWidth,
                right: blockWidth ? undefined : PADDING_RIGHT,
                backgroundColor: color + "22",
                borderLeftColor: color,
                opacity: pressed ? 0.7 : 1,
              },
            ])}
          >
            <Text style={{ fontSize: 11, fontWeight: "700", color: colors.foreground }} numberOfLines={1}>
              {formatTime(appt.time)} {svcName} ({appt.duration} min)
            </Text>
            {height > 36 && (
              <Text style={{ fontSize: 10, color: colors.muted }} numberOfLines={1}>{client?.name}</Text>
            )}
          </Pressable>
        );
      })}

      {/* iOS-style current-time indicator */}
      {showNowLine && (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: nowTop - 9,
            left: 0,
            right: 0,
            height: 18,
            zIndex: 20,
            flexDirection: "row",
            alignItems: "center",
          }}
        >
          <View style={{
            backgroundColor: "#EF4444",
            borderRadius: 9,
            paddingHorizontal: 5,
            paddingVertical: 2,
            minWidth: LABEL_WIDTH - 2,
            alignItems: "center",
            justifyContent: "center",
          }}>
            <Text style={{ fontSize: 9, fontWeight: "700", color: "#fff", letterSpacing: 0.2 }}>
              {nowPillLabel}
            </Text>
          </View>
          <View style={{ flex: 1, height: 1.5, backgroundColor: "#EF4444" }} />
        </View>
      )}
    </View>
  );
}

export default function CalendarScreen() {
  const { state, dispatch, getServiceById, getClientById, getStaffById, getLocationById, syncToDb, filterAppointmentsByLocation, getActiveCustomSchedule } = useStore();
  const colors = useColors();
  const router = useRouter();
  const params = useLocalSearchParams<{ filter?: string }>();
  const { width, isTablet, isLargeTablet, hp, maxContentWidth } = useResponsive();

  const now = new Date();
  // Live clock for the current-time indicator — updates every 30 seconds
  const [liveNow, setLiveNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setLiveNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  const [calendarView, setCalendarView] = useState<CalendarView>("month");
  const [currentMonth, setCurrentMonth] = useState(now.getMonth());
  const [currentYear, setCurrentYear] = useState(now.getFullYear());
  const [selectedDate, setSelectedDate] = useState(formatDateStr(now));
  const initialFilter = (params.filter as FilterKey) || "upcoming";
  const [activeFilter, setActiveFilter] = useState<FilterKey>(initialFilter);
  // Workday override modal state
  const [showTimePickerModal, setShowTimePickerModal] = useState(false);
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [draftStart, setDraftStart] = useState("09:00");
  const [draftEnd, setDraftEnd] = useState("17:00");
  const [timeError, setTimeError] = useState<string | null>(null);
  const [calSubPicker, setCalSubPicker] = useState<"start" | "end" | null>(null);
  // Refs to always read latest draft values in save handler (avoids stale closure)
  const draftStartRef = useRef("09:00");
  const draftEndRef = useRef("17:00");
  const editingDateRef = useRef<string | null>(null);

  // Week view: track the week start (Sunday)
  const [weekStart, setWeekStart] = useState<Date>(() => {
    const d = new Date(now);
    d.setDate(d.getDate() - d.getDay());
    return d;
  });

  useEffect(() => {
    if (params.filter && FILTERS.some((f) => f.key === params.filter)) {
      setActiveFilter(params.filter as FilterKey);
    }
  }, [params.filter]);

  const { activeLocation, activeLocations, hasMultipleLocations: hasMultiLoc, setActiveLocation } = useActiveLocation();
  const calLocationFilter = activeLocation?.id ?? null;

  // Do NOT auto-select a location — null means "All locations" which is a valid state

  // Use per-location workingHours if available, fall back to global settings (same logic as schedule-settings.tsx)
  const effectiveWorkingHours = useMemo(() => {
    if (activeLocation?.workingHours && Object.keys(activeLocation.workingHours).length > 0) {
      return activeLocation.workingHours;
    }
    return state.settings.workingHours;
  }, [activeLocation, state.settings.workingHours]);

  // When "All" is selected (no active location), aggregate working hours across all active locations
  // A day is open if ANY location has it open; effective hours = widest window across locations
  const allLocationsWorkingHours = useMemo(() => {
    if (calLocationFilter !== null || activeLocations.length === 0) return null;
    // Merge: for each day, find the earliest start and latest end across all locations
    const merged: Record<string, { enabled: boolean; start: string; end: string }> = {};
    for (const loc of activeLocations) {
      const wh = (loc.workingHours && Object.keys(loc.workingHours).length > 0)
        ? loc.workingHours
        : state.settings.workingHours;
      if (!wh) continue;
      for (const [day, hours] of Object.entries(wh)) {
        if (!hours || !(hours as any).enabled) continue;
        const h = hours as { enabled: boolean; start: string; end: string };
        if (!merged[day] || !merged[day].enabled) {
          merged[day] = { enabled: true, start: h.start, end: h.end };
        } else {
          // Widen the window
          if (h.start < merged[day].start) merged[day].start = h.start;
          if (h.end > merged[day].end) merged[day].end = h.end;
        }
      }
    }
    return merged;
  }, [calLocationFilter, activeLocations, state.settings.workingHours]);

  // Location-scoped appointments (single source of truth for this screen)
  const locationAppointments = useMemo(
    () => filterAppointmentsByLocation(state.appointments),
    [state.appointments, filterAppointmentsByLocation]
  );

  const cellSize = Math.floor((width - hp * 2) / 7);
  const todayStr = formatDateStr(now);

  // ─── Helpers ──────────────────────────────────────────────────────────

  // Use per-location custom schedule overrides
  const activeCustomSchedule = useMemo(() => getActiveCustomSchedule(), [getActiveCustomSchedule]);

  const getCustomDay = useCallback((dateStr: string): CustomScheduleDay | undefined => {
    return activeCustomSchedule.find((cs) => cs.date === dateStr);
  }, [activeCustomSchedule]);

  // A day is "available" if it has a Workday ON override, or if it's a Business Hours working day with no override
  // Also blocked if date is after businessHoursEndDate or location is temporarily closed
  const isDayAvailable = useCallback((dateStr: string): boolean => {
    // In "All" mode: available if any location has this day open
    if (calLocationFilter === null && allLocationsWorkingHours) {
      const endDate = state.settings.businessHoursEndDate;
      if (endDate && dateStr > endDate) return false;
      // Check any per-location custom schedule
      for (const loc of activeLocations) {
        const locCustom = state.locationCustomSchedule?.[loc.id]?.find((cs: CustomScheduleDay) => cs.date === dateStr);
        if (locCustom) { if (locCustom.isOpen) return true; continue; }
        const d = new Date(dateStr + "T12:00:00");
        const dayName = DAY_NAMES[d.getDay()];
        const wh = (loc.workingHours && Object.keys(loc.workingHours).length > 0)
          ? (loc.workingHours as any)[dayName]
          : state.settings.workingHours?.[dayName];
        if (wh && wh.enabled && !loc.temporarilyClosed) return true;
      }
      return false;
    }
    // Block all days when location is temporarily closed
    if (activeLocation?.temporarilyClosed) return false;
    // Check Active Until expiry
    const endDate = state.settings.businessHoursEndDate;
    if (endDate && dateStr > endDate) return false;
    const custom = getCustomDay(dateStr);
    if (custom) return custom.isOpen;
    // Fall back to Business Hours
    const d = new Date(dateStr + "T12:00:00");
    const dayName = DAY_NAMES[d.getDay()];
    const wh = effectiveWorkingHours?.[dayName];
    return !!(wh && wh.enabled);
  }, [calLocationFilter, allLocationsWorkingHours, activeLocations, state.locationCustomSchedule, getCustomDay, effectiveWorkingHours, state.settings.businessHoursEndDate, activeLocation?.temporarilyClosed]);

  // Get effective working hours for a date (custom override or business hours)
  const getEffectiveHours = useCallback((dateStr: string): { start: string; end: string } | null => {
    // In "All" mode: return the widest window across all locations for this day
    if (calLocationFilter === null && allLocationsWorkingHours) {
      let earliest: string | null = null;
      let latest: string | null = null;
      for (const loc of activeLocations) {
        const locCustom = state.locationCustomSchedule?.[loc.id]?.find((cs: CustomScheduleDay) => cs.date === dateStr);
        if (locCustom) {
          if (!locCustom.isOpen) continue;
          const s = locCustom.startTime ?? null;
          const e = locCustom.endTime ?? null;
          if (s && (!earliest || s < earliest)) earliest = s;
          if (e && (!latest || e > latest)) latest = e;
          continue;
        }
        const d = new Date(dateStr + "T12:00:00");
        const dayName = DAY_NAMES[d.getDay()];
        const wh = (loc.workingHours && Object.keys(loc.workingHours).length > 0)
          ? (loc.workingHours as any)[dayName]
          : state.settings.workingHours?.[dayName];
        if (wh && wh.enabled && !loc.temporarilyClosed) {
          if (!earliest || wh.start < earliest) earliest = wh.start;
          if (!latest || wh.end > latest) latest = wh.end;
        }
      }
      if (earliest && latest) return { start: earliest, end: latest };
      return null;
    }
    const custom = getCustomDay(dateStr);
    if (custom && custom.isOpen && custom.startTime && custom.endTime) {
      return { start: custom.startTime, end: custom.endTime };
    }
    const d = new Date(dateStr + "T12:00:00");
    const dayName = DAY_NAMES[d.getDay()];
    const wh = effectiveWorkingHours?.[dayName];
    if (wh && wh.enabled) return { start: wh.start, end: wh.end };
    return null;
  }, [calLocationFilter, allLocationsWorkingHours, activeLocations, state.locationCustomSchedule, getCustomDay, effectiveWorkingHours]);

  // Get business hours for a day (for picker min/max)
  const getBusinessHours = useCallback((dateStr: string): { start: string; end: string } | null => {
    const d = new Date(dateStr + "T12:00:00");
    const dayName = DAY_NAMES[d.getDay()];
    const wh = effectiveWorkingHours?.[dayName];
    if (wh && wh.enabled) return { start: wh.start, end: wh.end };
    return null;
  }, [effectiveWorkingHours]);

  // Calendar grid
  const calendarDays = useMemo(() => {
    const firstDay = new Date(currentYear, currentMonth, 1).getDay();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const days: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(i);
    return days;
  }, [currentMonth, currentYear]);

  // Status dots — scoped to active location
  const dayStatuses = useMemo(() => {
    const statuses: Record<string, Set<string>> = {};
    locationAppointments.forEach((a) => {
      if (!statuses[a.date]) statuses[a.date] = new Set();
      statuses[a.date].add(a.status);
    });
    return statuses;
  }, [locationAppointments]);

  // locFilter kept for backward-compat (already filtered by location above)
  const locFilter = useCallback((appts: Appointment[]) => appts, []);

  // Selected date appointments
  const selectedDateAppts = useMemo(() => {
    return locationAppointments
      .filter((a) => a.date === selectedDate)
      .sort((a, b) => a.time.localeCompare(b.time));
  }, [locationAppointments, selectedDate]);

  // Week days
  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      return formatDateStr(d);
    });
  }, [weekStart]);

  // Timeline hours array
  const timelineHours = useMemo(() => {
    const hours: string[] = [];
    for (let h = TIMELINE_START; h <= TIMELINE_END; h++) {
      hours.push(`${String(h).padStart(2, "0")}:00`);
    }
    return hours;
  }, []);

  // Filtered appointments list
  const filteredAppointments = useMemo(() => {
    const base = locationAppointments;
    switch (activeFilter) {
      case "upcoming":
        return base.filter((a) => a.status === "confirmed" && a.date > todayStr)
          .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
      case "requests":
        return base.filter((a) => a.status === "pending")
          .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
      case "cancelled":
        return base.filter((a) => a.status === "cancelled")
          .sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time));
      case "completed":
        return base.filter((a) => a.status === "completed")
          .sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time));
      default: return [];
    }
  }, [locationAppointments, activeFilter, todayStr]);

  // ─── Navigation ───────────────────────────────────────────────────────

  const prevMonth = () => {
    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(currentYear - 1); }
    else setCurrentMonth(currentMonth - 1);
  };
  const nextMonth = () => {
    if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(currentYear + 1); }
    else setCurrentMonth(currentMonth + 1);
  };
  const prevWeek = () => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() - 7);
    setWeekStart(d);
  };
  const nextWeek = () => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 7);
    setWeekStart(d);
  };
  const prevDay = () => {
    const d = new Date(selectedDate + "T12:00:00");
    d.setDate(d.getDate() - 1);
    setSelectedDate(formatDateStr(d));
  };
  const nextDay = () => {
    const d = new Date(selectedDate + "T12:00:00");
    d.setDate(d.getDate() + 1);
    setSelectedDate(formatDateStr(d));
  };
  const jumpToToday = () => {
    setSelectedDate(todayStr);
    const d = new Date(now);
    d.setDate(d.getDate() - d.getDay());
    setWeekStart(d);
    setCurrentMonth(now.getMonth());
    setCurrentYear(now.getFullYear());
  };

  // ─── Workday Override ─────────────────────────────────────────────────



  const handleWorkdayToggle = useCallback((dateStr: string, value: boolean) => {
    if (value) {
      // Turning ON: use business hours as default, or 09:00–17:00
      const bh = getBusinessHours(dateStr);
      const start = bh?.start ?? "09:00";
      const end = bh?.end ?? "17:00";
      setEditingDate(dateStr);
      editingDateRef.current = dateStr;
      draftStartRef.current = start;
      draftEndRef.current = end;
      setDraftStart(start);
      setDraftEnd(end);
      setShowTimePickerModal(true);
    } else {
      // Turning OFF: save as closed override (per-location if location is active)
      if (activeLocation) {
        const override: CustomScheduleDay = { date: dateStr, isOpen: false, locationId: activeLocation.id };
        dispatch({ type: "SET_LOCATION_CUSTOM_SCHEDULE", payload: { locationId: activeLocation.id, day: override } });
        syncToDb({ type: "SET_LOCATION_CUSTOM_SCHEDULE", payload: { locationId: activeLocation.id, day: override } });
      } else {
        const override: CustomScheduleDay = { date: dateStr, isOpen: false };
        dispatch({ type: "SET_CUSTOM_SCHEDULE", payload: override });
        syncToDb({ type: "SET_CUSTOM_SCHEDULE", payload: override });
      }
    }
  }, [dispatch, syncToDb, getBusinessHours, activeLocation]);

  const handleSaveTimeOverride = useCallback(() => {
    const dateToSave = editingDateRef.current ?? editingDate;
    if (!dateToSave) return;
    if (timeToMinutes(draftEnd) <= timeToMinutes(draftStart)) {
      setTimeError("End time must be after start time.");
      return;
    }
    setTimeError(null);
    if (activeLocation) {
      const override: CustomScheduleDay = {
        date: dateToSave,
        isOpen: true,
        startTime: draftStart,
        endTime: draftEnd,
        locationId: activeLocation.id,
      };
      dispatch({ type: "SET_LOCATION_CUSTOM_SCHEDULE", payload: { locationId: activeLocation.id, day: override } });
      syncToDb({ type: "SET_LOCATION_CUSTOM_SCHEDULE", payload: { locationId: activeLocation.id, day: override } });
    } else {
      const override: CustomScheduleDay = {
        date: dateToSave,
        isOpen: true,
        startTime: draftStart,
        endTime: draftEnd,
      };
      dispatch({ type: "SET_CUSTOM_SCHEDULE", payload: override });
      syncToDb({ type: "SET_CUSTOM_SCHEDULE", payload: override });
    }
    setShowTimePickerModal(false);
    setEditingDate(null);
    setCalSubPicker(null);
    editingDateRef.current = null;
  }, [dispatch, syncToDb, draftStart, draftEnd, editingDate, activeLocation]);

  const handleCancelTimeOverride = useCallback(() => {
    setShowTimePickerModal(false);
    setEditingDate(null);
    setCalSubPicker(null);
    setTimeError(null);
  }, []);

  // ─── SMS / Accept / Reject ────────────────────────────────────────────

  const openSmsWithMessage = useCallback((phone: string, message: string) => {
    if (Platform.OS === "web") { Alert.alert("SMS Message", message); return; }
    const rawPhone = stripPhoneFormat(phone);
    const separator = Platform.OS === "ios" ? "&" : "?";
    const url = `sms:${rawPhone}${separator}body=${encodeURIComponent(message)}`;
    Linking.openURL(url).catch(() => Alert.alert("SMS", message));
  }, []);

  const handleAccept = useCallback((appt: Appointment) => {
    const client = getClientById(appt.clientId);
    const svc = getServiceById(appt.serviceId);
    const apptLoc = appt.locationId ? getLocationById(appt.locationId) : null;
    dispatch({ type: "UPDATE_APPOINTMENT_STATUS", payload: { id: appt.id, status: "confirmed" } });
    syncToDb({ type: "UPDATE_APPOINTMENT_STATUS", payload: { id: appt.id, status: "confirmed" } });
    const message = generateAcceptMessage(
      state.settings.businessName,
      apptLoc?.address || state.settings.profile.address,
      client?.name ?? "Valued Client",
      svc ? getServiceDisplayName(svc) : "Service",
      appt.duration, appt.date, appt.time,
      apptLoc?.phone || state.settings.profile.phone,
      client?.phone, appt.id, apptLoc?.name, apptLoc?.id,
      state.settings.customSlug,
      apptLoc?.city, apptLoc?.state, apptLoc?.zipCode
    );
    if (client?.phone) openSmsWithMessage(client.phone, message);
    else Alert.alert("Appointment Confirmed", message);
  }, [getClientById, getServiceById, getLocationById, dispatch, state.settings, openSmsWithMessage, syncToDb]);

  const handleReject = useCallback((appt: Appointment) => {
    const client = getClientById(appt.clientId);
    const svc = getServiceById(appt.serviceId);
    Alert.alert("Reject Appointment", "Are you sure you want to reject this appointment request?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Reject", style: "destructive",
        onPress: () => {
          dispatch({ type: "UPDATE_APPOINTMENT_STATUS", payload: { id: appt.id, status: "cancelled" } });
          syncToDb({ type: "UPDATE_APPOINTMENT_STATUS", payload: { id: appt.id, status: "cancelled" } });
          const apptLoc = appt.locationId ? getLocationById(appt.locationId) : null;
          const message = generateRejectMessage(
            state.settings.businessName, client?.name ?? "Valued Client",
            svc ? getServiceDisplayName(svc) : "Service", appt.date, appt.time,
            apptLoc?.phone || state.settings.profile.phone,
            apptLoc?.name, apptLoc?.address, apptLoc?.city, apptLoc?.state, apptLoc?.zipCode
          );
          if (client?.phone) openSmsWithMessage(client.phone, message);
          else Alert.alert("Appointment Rejected", message);
        },
      },
    ]);
  }, [getClientById, getServiceById, getLocationById, dispatch, state.settings, openSmsWithMessage, syncToDb]);

  const getEndTime = (time: string, duration: number): string =>
    formatTimeDisplay(minutesToTime(timeToMinutes(time) + duration));

  const filterColors: Record<FilterKey, string> = {
    upcoming: colors.success,
    requests: "#FF9800",
    cancelled: colors.error,
    completed: colors.primary,
  };

  // ─── Appointment Card ─────────────────────────────────────────────────

  const renderApptCard = (appt: Appointment, showDate = false) => {
    const svc = getServiceById(appt.serviceId);
    const client = getClientById(appt.clientId);
    const staff = appt.staffId ? getStaffById(appt.staffId) : null;
    const statusColor =
      appt.status === "confirmed" ? "#1B5E20"
      : appt.status === "pending" ? "#FF9800"
      : appt.status === "completed" ? colors.primary
      : "#F44336";
    const isRequest = appt.status === "pending";
    return (
      <View key={appt.id} style={[styles.apptCard, { backgroundColor: colors.surface, borderColor: colors.border, borderLeftColor: svc?.color ?? colors.primary }]}>
        <Pressable
          onPress={() => router.push({ pathname: "/appointment-detail", params: { id: appt.id } })}
          style={{ alignSelf: "stretch" }}
        >
          <Text style={{ fontSize: 14, fontWeight: "700", color: colors.foreground }}>
            {showDate ? `${formatDateDisplay(appt.date)} · ` : ""}{formatTime(appt.time)} – {getEndTime(appt.time, appt.duration)}
          </Text>
          <Text style={{ fontSize: 13, fontWeight: "500", color: colors.foreground, marginTop: 2 }}>
            {svc ? getServiceDisplayName(svc) : "Service"}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 1 }}>
            <Text style={{ fontSize: 12, color: colors.muted }}>{client?.name}</Text>
            {staff && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 3, marginLeft: 4 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: staff.color || colors.primary }} />
                <Text style={{ fontSize: 11, color: staff.color || colors.primary, fontWeight: "500" }}>{staff.name}</Text>
              </View>
            )}
          </View>
        </Pressable>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <View style={[styles.statusBadge, { backgroundColor: statusColor + "18" }]}>
            <Text style={{ fontSize: 11, fontWeight: "600", color: statusColor, textTransform: "capitalize" }}>{appt.status}</Text>
          </View>
          {hasMultiLoc && appt.locationId && (() => {
            const loc = getLocationById(appt.locationId);
            if (!loc) return null;
            const locColor = (loc as any).color || colors.primary;
            return (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: locColor + "18", borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 }}>
                <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: locColor }} />
                <Text style={{ fontSize: 11, fontWeight: "600", color: locColor }} numberOfLines={1}>{loc.name}</Text>
              </View>
            );
          })()}
        </View>
        {isRequest && (
          <View style={[styles.actionRow, { borderTopColor: colors.border }]}>
            <Pressable onPress={() => handleAccept(appt)} style={({ pressed }) => [styles.acceptBtn, { backgroundColor: "#1B5E20", opacity: pressed ? 0.8 : 1 }]}>
              <IconSymbol name="checkmark" size={16} color="#FFF" />
              <Text style={{ color: "#FFF", fontSize: 13, fontWeight: "600", marginLeft: 4 }}>Accept</Text>
            </Pressable>
            <Pressable onPress={() => handleReject(appt)} style={({ pressed }) => [styles.rejectBtn, { borderColor: "#F44336", opacity: pressed ? 0.8 : 1 }]}>
              <IconSymbol name="xmark" size={16} color="#F44336" />
              <Text style={{ color: "#F44336", fontSize: 13, fontWeight: "600", marginLeft: 4 }}>Reject</Text>
            </Pressable>
          </View>
        )}
      </View>
    );
  };

  // ─── Workday Panel (shown below selected date in month view) ──────────

  const renderWorkdayPanel = (dateStr: string) => {
    const custom = getCustomDay(dateStr);
    const isPast = isDateInPast(dateStr);
    const bh = getBusinessHours(dateStr);
    const isAvailable = isDayAvailable(dateStr);
    const effectiveHours = getEffectiveHours(dateStr);
    const hasCustomOverride = !!custom;

    return (
      <View style={[styles.workdayPanel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, fontWeight: "700", color: colors.foreground }}>Workday</Text>
            <Text style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>
              {isAvailable
                ? effectiveHours
                  ? `${formatTimeDisplay(effectiveHours.start)} – ${formatTimeDisplay(effectiveHours.end)}`
                  : "Open (Business Hours)"
                : "Closed – clients cannot book"}
            </Text>
          </View>
          <Switch
            value={isAvailable}
            onValueChange={(val) => { if (!isPast) handleWorkdayToggle(dateStr, val); }}
            disabled={isPast}
            trackColor={{ false: colors.border, true: colors.primary + "80" }}
            thumbColor={isAvailable ? colors.primary : colors.muted}
          />
        </View>
        {isAvailable && !isPast && (
          <Pressable
            onPress={() => {
              const bh2 = getBusinessHours(dateStr);
              const startVal = effectiveHours?.start ?? bh2?.start ?? "09:00";
              const endVal = effectiveHours?.end ?? bh2?.end ?? "17:00";
              setEditingDate(dateStr);
              editingDateRef.current = dateStr;
              draftStartRef.current = startVal;
              draftEndRef.current = endVal;
              setDraftStart(startVal);
              setDraftEnd(endVal);
              setShowTimePickerModal(true);
            }}
            style={({ pressed }) => [styles.editHoursBtn, { borderColor: colors.primary + "40", backgroundColor: colors.primary + "10", opacity: pressed ? 0.7 : 1 }]}
          >
            <IconSymbol name="pencil" size={14} color={colors.primary} />
            <Text style={{ fontSize: 13, fontWeight: "600", color: colors.primary, marginLeft: 6 }}>
              {hasCustomOverride && custom?.startTime ? "Edit Hours" : "Set Custom Hours"}
            </Text>
          </Pressable>
        )}
        {hasCustomOverride && (
          <Pressable
            onPress={() => {
              if (activeLocation) {
                dispatch({ type: "DELETE_LOCATION_CUSTOM_SCHEDULE", payload: { locationId: activeLocation.id, date: dateStr } });
                syncToDb({ type: "DELETE_LOCATION_CUSTOM_SCHEDULE", payload: { locationId: activeLocation.id, date: dateStr } });
              } else {
                dispatch({ type: "DELETE_CUSTOM_SCHEDULE", payload: dateStr });
                syncToDb({ type: "DELETE_CUSTOM_SCHEDULE", payload: dateStr });
              }
            }}
            style={({ pressed }) => [styles.resetBtn, { opacity: pressed ? 0.7 : 1 }]}
          >
            <Text style={{ fontSize: 12, color: colors.muted }}>Reset to Business Hours</Text>
          </Pressable>
        )}
        {bh && (
          <Text style={{ fontSize: 11, color: colors.muted, marginTop: 6 }}>
            Business Hours: {formatTimeDisplay(bh.start)} – {formatTimeDisplay(bh.end)}
          </Text>
        )}
      </View>
    );
  };

  // ─── Timeline Render ──────────────────────────────────────────────────
  // Delegates to the TimelineView component defined above CalendarScreen.
  const renderTimeline = (dateStr: string, appts: Appointment[], tintColor?: string) => (
    <TimelineView
      dateStr={dateStr}
      appts={appts}
      tintColor={tintColor}
      liveNow={liveNow}
      timelineHours={timelineHours}
      effectiveHours={getEffectiveHours(dateStr)}
      available={isDayAvailable(dateStr)}
      colors={colors}
      getServiceById={getServiceById}
      getClientById={getClientById}
      onApptPress={(id) => router.push({ pathname: "/appointment-detail", params: { id } })}
    />
  );

  // ─── Month View ───────────────────────────────────────────────────────

  const renderMonthView = () => (
    <>
      {/* Month Navigation */}
      <View style={[styles.monthHeader, { paddingHorizontal: hp }]}>
        <Pressable onPress={prevMonth} style={({ pressed }) => [styles.navBtn, { opacity: pressed ? 0.5 : 1 }]}>
          <IconSymbol name="chevron.left" size={22} color={colors.foreground} />
        </Pressable>
        <Pressable onPress={jumpToToday}>
          <Text style={[styles.monthTitle, { color: colors.foreground }]}>
            {MONTH_NAMES[currentMonth]} {currentYear}
          </Text>
        </Pressable>
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
          const isPast = isDateInPast(dateStr);
          const isAvailable = isDayAvailable(dateStr);
          const custom = getCustomDay(dateStr);
          const hasCustomOverride = !!custom;
          const statuses = dayStatuses[dateStr];
          // Red tint for future days when location is temporarily closed
          const isTemporarilyClosed = !!activeLocation?.temporarilyClosed && !isPast;

          return (
            <Pressable
              key={dateStr}
              onPress={() => setSelectedDate(dateStr)}
              style={({ pressed }) => [
                styles.dayCell,
                {
                  width: cellSize,
                  height: cellSize,
                  backgroundColor: isSelected
                    ? (isTemporarilyClosed ? colors.error : colors.primary)
                    : isTemporarilyClosed && !isPast
                    ? colors.error + "18"
                    : "transparent",
                  borderRadius: cellSize / 2,
                  opacity: isPast ? 0.3 : pressed ? 0.7 : 1,
                },
              ]}
            >
              <Text
                style={{
                  fontSize: 15,
                  fontWeight: isToday || isSelected ? "700" : "400",
                  color: isSelected
                    ? "#FFF"
                    : isTemporarilyClosed
                    ? colors.error
                    : isToday
                    ? colors.primary
                    : !isAvailable
                    ? colors.muted
                    : colors.foreground,
                  textDecorationLine: (isTemporarilyClosed || (!isAvailable && !isPast)) ? "line-through" : "none",
                }}
              >
                {day}
              </Text>
              {/* Custom override indicator */}
              {hasCustomOverride && !isSelected && (
                <View style={[styles.overrideDot, { backgroundColor: custom?.isOpen ? colors.success : colors.error }]} />
              )}
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

      {/* Legend */}
      <View style={[styles.dotLegend, { paddingHorizontal: hp }]}>
        <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: colors.success }]} /><Text style={{ fontSize: 10, color: colors.muted }}>Open Override</Text></View>
        <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: colors.error }]} /><Text style={{ fontSize: 10, color: colors.muted }}>Closed Override</Text></View>
        <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: "#1B5E20" }]} /><Text style={{ fontSize: 10, color: colors.muted }}>Accepted</Text></View>
        <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: "#2196F3" }]} /><Text style={{ fontSize: 10, color: colors.muted }}>Pending</Text></View>
      </View>

      {/* Selected Date Panel */}
      <View style={{ paddingHorizontal: hp, marginTop: 8 }}>
        {/* Workday Panel */}
        {renderWorkdayPanel(selectedDate)}

        {/* Header + Book Button */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 12, marginBottom: 8 }}>
          <Text style={[styles.sectionTitle, { color: colors.foreground, marginBottom: 0 }]}>
            {formatDateDisplay(selectedDate)}
          </Text>
          {isDayAvailable(selectedDate) && !isDateInPast(selectedDate) && (calLocationFilter === null || !activeLocation?.temporarilyClosed) && (
            <Pressable
              onPress={() => router.push({ pathname: "/new-booking", params: { date: selectedDate } })}
              style={({ pressed }) => ({
                flexDirection: "row", alignItems: "center",
                backgroundColor: colors.primary, paddingHorizontal: 14, paddingVertical: 8,
                borderRadius: 20, gap: 6, opacity: pressed ? 0.8 : 1,
              })}
            >
              <IconSymbol name="plus" size={14} color="#FFF" />
              <Text style={{ color: "#FFF", fontSize: 13, fontWeight: "600" }}>Book Appointment</Text>
            </Pressable>
          )}
        </View>

        {selectedDateAppts.length === 0 ? (
          <Text style={{ color: colors.muted, fontSize: 13, marginBottom: 12 }}>
            {isDayAvailable(selectedDate) ? "No appointments on this day" : "Closed — not a working day"}
          </Text>
        ) : (
          selectedDateAppts.map((a) => renderApptCard(a))
        )}
      </View>

      {/* Filter Tabs */}
      <View style={{ paddingHorizontal: hp, marginTop: 20 }}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>All Appointments</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
          {FILTERS.map((f) => {
            const isActive = activeFilter === f.key;
            const count = f.key === "upcoming"
              ? locationAppointments.filter((a) => a.status === "confirmed" && a.date > todayStr).length
              : f.key === "requests" ? locationAppointments.filter((a) => a.status === "pending").length
              : f.key === "cancelled" ? locationAppointments.filter((a) => a.status === "cancelled").length
              : locationAppointments.filter((a) => a.status === "completed").length;
            return (
              <Pressable
                key={f.key}
                onPress={() => setActiveFilter(f.key)}
                style={({ pressed }) => [styles.filterChip, {
                  backgroundColor: isActive ? filterColors[f.key] : colors.surface,
                  borderColor: isActive ? filterColors[f.key] : colors.border,
                  opacity: pressed ? 0.7 : 1,
                }]}
              >
                <Text style={{ fontSize: 13, fontWeight: "600", color: isActive ? "#FFF" : colors.foreground }}>
                  {f.label} ({count})
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {filteredAppointments.length === 0 ? (
          <View style={[styles.emptyState, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={{ color: colors.muted, fontSize: 13 }}>No {activeFilter} appointments</Text>
          </View>
        ) : (
          filteredAppointments.map((appt) => {
            const svc = getServiceById(appt.serviceId);
            const client = getClientById(appt.clientId);
            const staffMember = appt.staffId ? getStaffById(appt.staffId) : null;
            const isRequest = appt.status === "pending";
            const statusColor = appt.status === "confirmed" ? "#1B5E20" : appt.status === "pending" ? "#FF9800" : appt.status === "completed" ? colors.primary : "#F44336";
            return (
              <View key={appt.id} style={[styles.filterCard, { backgroundColor: colors.surface, borderColor: colors.border, borderLeftColor: svc?.color ?? colors.primary }]}>
                <Pressable onPress={() => router.push({ pathname: "/appointment-detail", params: { id: appt.id } })} style={{ flex: 1 }}>
                  <View style={styles.filterCardRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontWeight: "700", color: colors.foreground }}>
                        {formatDateDisplay(appt.date)} · {formatTime(appt.time)} – {getEndTime(appt.time, appt.duration)}
                      </Text>
                      <Text style={{ fontSize: 13, color: colors.foreground, marginTop: 2 }}>{svc ? getServiceDisplayName(svc) : "Service"}</Text>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 1 }}>
                        <Text style={{ fontSize: 12, color: colors.muted }}>{client?.name} {client?.phone ? `· ${formatPhone(client.phone)}` : ""}</Text>
                        {staffMember && (
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 3, marginLeft: 4 }}>
                            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: staffMember.color || colors.primary }} />
                            <Text style={{ fontSize: 11, color: staffMember.color || colors.primary, fontWeight: "500" }}>{staffMember.name}</Text>
                          </View>
                        )}
                        {hasMultiLoc && appt.locationId && (() => {
                          const loc = state.locations.find((l) => l.id === appt.locationId);
                          return loc ? (
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 2, marginLeft: 4, backgroundColor: colors.primary + "12", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 }}>
                              <IconSymbol name="location.fill" size={9} color={colors.primary} />
                              <Text style={{ fontSize: 10, color: colors.primary, fontWeight: "500" }}>{loc.name}</Text>
                            </View>
                          ) : null;
                        })()}
                      </View>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: statusColor + "18" }]}>
                      <Text style={{ fontSize: 11, fontWeight: "600", color: statusColor, textTransform: "capitalize" }}>{appt.status}</Text>
                    </View>
                  </View>
                </Pressable>
                {isRequest && (
                  <View style={[styles.actionRow, { borderTopColor: colors.border }]}>
                    <Pressable onPress={() => handleAccept(appt)} style={({ pressed }) => [styles.acceptBtn, { backgroundColor: "#1B5E20", opacity: pressed ? 0.8 : 1 }]}>
                      <IconSymbol name="checkmark" size={16} color="#FFF" />
                      <Text style={{ color: "#FFF", fontSize: 13, fontWeight: "600", marginLeft: 4 }}>Accept</Text>
                    </Pressable>
                    <Pressable onPress={() => handleReject(appt)} style={({ pressed }) => [styles.rejectBtn, { borderColor: "#F44336", opacity: pressed ? 0.8 : 1 }]}>
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
    </>
  );

  // ─── Day View ─────────────────────────────────────────────────────────

  const renderDayView = () => {
    // Use locationAppointments which already respects the active location filter (null = all)
    const dayAppts = locationAppointments
      .filter((a) => a.date === selectedDate)
      .sort((a, b) => a.time.localeCompare(b.time));

    return (
      <>
        {/* Day Navigation */}
        <View style={[styles.monthHeader, { paddingHorizontal: hp }]}>
          <Pressable onPress={prevDay} style={({ pressed }) => [styles.navBtn, { opacity: pressed ? 0.5 : 1 }]}>
            <IconSymbol name="chevron.left" size={22} color={colors.foreground} />
          </Pressable>
          <Pressable onPress={jumpToToday}>
            <Text style={[styles.monthTitle, { color: colors.foreground }]}>
              {DAY_FULL[new Date(selectedDate + "T12:00:00").getDay()]}, {formatDateDisplay(selectedDate)}
            </Text>
          </Pressable>
          <Pressable onPress={nextDay} style={({ pressed }) => [styles.navBtn, { opacity: pressed ? 0.5 : 1 }]}>
            <IconSymbol name="chevron.right" size={22} color={colors.foreground} />
          </Pressable>
        </View>

        {/* Workday Panel */}
        <View style={{ paddingHorizontal: hp, marginBottom: 8 }}>
          {renderWorkdayPanel(selectedDate)}
        </View>

          {/* Book Button */}
          {isDayAvailable(selectedDate) && !isDateInPast(selectedDate) && (calLocationFilter === null || !activeLocation?.temporarilyClosed) && (
            <View style={{ paddingHorizontal: hp, marginBottom: 12 }}>
              <Pressable
                onPress={() => router.push({ pathname: "/new-booking", params: { date: selectedDate } })}
                style={({ pressed }) => [styles.bookBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 }]}
              >
                <IconSymbol name="plus" size={16} color="#FFF" />
                <Text style={{ color: "#FFF", fontSize: 14, fontWeight: "700", marginLeft: 6 }}>Book Appointment</Text>
              </Pressable>
            </View>
          )}

          {/* Timeline */}
          <View style={{ paddingHorizontal: hp }}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Timeline</Text>
            {renderTimeline(selectedDate, dayAppts)}
          </View>
      </>
    );
  };

  // ─── Week View ────────────────────────────────────────────────────────

  const renderWeekView = () => {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);

    return (
      <>
        {/* Week Navigation Header */}
        <View style={[styles.monthHeader, { paddingHorizontal: hp }]}>
          <Pressable onPress={prevWeek} style={({ pressed }) => [styles.navBtn, { opacity: pressed ? 0.5 : 1 }]}>
            <IconSymbol name="chevron.left" size={22} color={colors.foreground} />
          </Pressable>
          <Pressable onPress={jumpToToday}>
            <Text style={[styles.monthTitle, { color: colors.foreground }]}>
              {MONTH_NAMES[weekStart.getMonth()]} {weekStart.getDate()} – {weekEnd.getDate()}, {weekEnd.getFullYear()}
            </Text>
          </Pressable>
          <Pressable onPress={nextWeek} style={({ pressed }) => [styles.navBtn, { opacity: pressed ? 0.5 : 1 }]}>
            <IconSymbol name="chevron.right" size={22} color={colors.foreground} />
          </Pressable>
        </View>

        {/* Day strip: compact horizontal day selector */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: hp, gap: 8, paddingBottom: 8 }}
        >
          {weekDays.map((dateStr) => {
            const d = new Date(dateStr + "T12:00:00");
            const isToday = dateStr === todayStr;
            const isSelected = dateStr === selectedDate;
            const isPast = isDateInPast(dateStr);
            const available = isDayAvailable(dateStr);
            return (
              <Pressable
                key={dateStr}
                onPress={() => !isPast && setSelectedDate(dateStr)}
                style={({ pressed }) => ({
                  alignItems: "center",
                  paddingVertical: 8,
                  paddingHorizontal: 10,
                  borderRadius: 14,
                  borderWidth: 1.5,
                  borderColor: isSelected ? colors.primary : isToday ? colors.primary + "40" : colors.border,
                  backgroundColor: isSelected ? colors.primary + "12" : "transparent",
                  opacity: isPast ? 0.35 : pressed ? 0.7 : 1,
                  minWidth: 52,
                })}
              >
                <Text style={{ fontSize: 11, fontWeight: "600", color: isToday ? colors.primary : colors.muted }}>
                  {DAY_SHORT[d.getDay()]}
                </Text>
                <View style={{
                  width: 30, height: 30, borderRadius: 15, marginTop: 2,
                  backgroundColor: isSelected ? colors.primary : "transparent",
                  alignItems: "center", justifyContent: "center",
                }}>
                  <Text style={{ fontSize: 15, fontWeight: "700", color: isSelected ? "#FFF" : isToday ? colors.primary : colors.foreground }}>
                    {d.getDate()}
                  </Text>
                </View>
                {!available && !isPast && (
                  <Text style={{ fontSize: 8, color: colors.error, marginTop: 2 }}>Closed</Text>
                )}
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Selected Day Full Column: same design as Day view */}
        <View style={{ paddingHorizontal: hp }}>
          {/* Day Title */}
          <View style={[styles.monthHeader, { paddingHorizontal: 0 }]}>
            <Pressable onPress={() => {
              const d = new Date(selectedDate + "T12:00:00");
              d.setDate(d.getDate() - 1);
              setSelectedDate(formatDateStr(d));
            }} style={({ pressed }) => [styles.navBtn, { opacity: pressed ? 0.5 : 1 }]}>
              <IconSymbol name="chevron.left" size={20} color={colors.foreground} />
            </Pressable>
            <Text style={[styles.monthTitle, { color: colors.foreground, fontSize: 16 }]}>
              {DAY_FULL[new Date(selectedDate + "T12:00:00").getDay()]}, {formatDateDisplay(selectedDate)}
            </Text>
            <Pressable onPress={() => {
              const d = new Date(selectedDate + "T12:00:00");
              d.setDate(d.getDate() + 1);
              setSelectedDate(formatDateStr(d));
            }} style={({ pressed }) => [styles.navBtn, { opacity: pressed ? 0.5 : 1 }]}>
              <IconSymbol name="chevron.right" size={20} color={colors.foreground} />
            </Pressable>
          </View>

          {/* Workday Panel */}
          {!isDateInPast(selectedDate) && (
            <View style={{ marginBottom: 8 }}>
              {renderWorkdayPanel(selectedDate)}
            </View>
          )}

          {/* Book Button */}
          {isDayAvailable(selectedDate) && !isDateInPast(selectedDate) && (calLocationFilter === null || !activeLocation?.temporarilyClosed) && (
            <Pressable
              onPress={() => router.push({ pathname: "/new-booking", params: { date: selectedDate } })}
              style={({ pressed }) => [styles.bookBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1, marginBottom: 12 }]}
            >
              <IconSymbol name="plus" size={16} color="#FFF" />
              <Text style={{ color: "#FFF", fontSize: 14, fontWeight: "700", marginLeft: 6 }}>Book Appointment</Text>
            </Pressable>
          )}

          {/* Timeline */}
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Timeline</Text>
          {renderTimeline(
            selectedDate,
            locationAppointments
              .filter((a) => a.date === selectedDate)
              .sort((a, b) => a.time.localeCompare(b.time))
          )}
        </View>
      </>
    );
  };

  // ─── Time Picker Modal ────────────────────────────────────────────────

  const businessHoursForEdit = editingDate ? getBusinessHours(editingDate) : null;

  // ─── Main Render ──────────────────────────────────────────────────────

  return (
    <ScreenContainer tabletMaxWidth={0}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100, alignSelf: "center", width: "100%", maxWidth: maxContentWidth }}>
        {/* Header */}
        <View style={{ paddingHorizontal: hp, paddingTop: 4 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <Text style={{ fontSize: 24, fontWeight: "700", color: colors.foreground }}>Calendar</Text>
          </View>

          {/* Location Filter — shown when multiple locations exist, includes All chip */}
          {hasMultiLoc && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
              <View style={{ flexDirection: "row", gap: 6 }}>
                {/* All chip */}
                <Pressable
                  onPress={() => setActiveLocation(null)}
                  style={({ pressed }) => [{
                    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1,
                    backgroundColor: calLocationFilter === null ? colors.primary + "15" : colors.surface,
                    borderColor: calLocationFilter === null ? colors.primary : colors.border,
                    opacity: pressed ? 0.7 : 1,
                  }]}
                >
                  <Text style={{ fontSize: 12, fontWeight: "600", color: calLocationFilter === null ? colors.primary : colors.muted }}>All</Text>
                </Pressable>
                {activeLocations.map((loc) => (
                  <Pressable key={loc.id} onPress={() => setActiveLocation(loc.id)} style={({ pressed }) => [{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1, backgroundColor: calLocationFilter === loc.id ? colors.primary + "15" : colors.surface, borderColor: calLocationFilter === loc.id ? colors.primary : colors.border, opacity: pressed ? 0.7 : 1 }]}>
                    <Text style={{ fontSize: 12, fontWeight: "600", color: calLocationFilter === loc.id ? colors.primary : colors.muted }}>{loc.name}</Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          )}

          {/* View Switcher */}
          <View style={styles.viewSwitcher}>
            {(["month", "week", "day"] as CalendarView[]).map((v) => (
              <Pressable
                key={v}
                onPress={() => setCalendarView(v)}
                style={({ pressed }) => [
                  styles.viewTab,
                  {
                    backgroundColor: calendarView === v ? colors.primary : colors.surface,
                    borderColor: calendarView === v ? colors.primary : colors.border,
                    opacity: pressed ? 0.7 : 1,
                    flex: 1,
                  },
                ]}
              >
                <Text style={{ fontSize: 13, fontWeight: "600", color: calendarView === v ? "#FFF" : colors.foreground, textTransform: "capitalize" }}>
                  {v}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Temporarily Closed Banner — only shown when a specific location is selected */}
        {calLocationFilter !== null && activeLocation?.temporarilyClosed && (
          <View style={{
            marginHorizontal: hp, marginTop: 8, marginBottom: 4,
            backgroundColor: colors.error + "18",
            borderColor: colors.error + "60",
            borderWidth: 1,
            borderRadius: 10,
            paddingHorizontal: 14,
            paddingVertical: 10,
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
          }}>
            <IconSymbol name="exclamationmark.triangle.fill" size={16} color={colors.error} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, fontWeight: "700", color: colors.error }}>Location Temporarily Closed</Text>
              <Text style={{ fontSize: 11, color: colors.muted, marginTop: 2 }}>
                {activeLocation.reopenOn
                  ? `All dates are unavailable. Reopens ${new Date(activeLocation.reopenOn + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}.`
                  : "All dates are unavailable. Closed indefinitely — no new bookings."}
              </Text>
            </View>
          </View>
        )}

        {calendarView === "month" && renderMonthView()}
        {calendarView === "day" && renderDayView()}
        {calendarView === "week" && renderWeekView()}
      </ScrollView>

      {/* Time Picker Modal */}
      {/* Time Override Modal */}
      <Modal visible={showTimePickerModal} transparent animationType="slide">
        <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }} onPress={() => { setShowTimePickerModal(false); setCalSubPicker(null); }}>
          <Pressable style={{ borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 16, paddingBottom: 40, paddingHorizontal: 20, backgroundColor: colors.background }} onPress={() => {}}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <Text style={{ fontSize: 17, fontWeight: "700", color: colors.foreground }}>
                {editingDate ? (() => { const d = new Date(editingDate + "T12:00:00"); return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }); })() : ""} Hours
              </Text>
              <Pressable onPress={() => { setShowTimePickerModal(false); setCalSubPicker(null); }} style={({ pressed }) => [{ opacity: pressed ? 0.5 : 1 }]}>
                <IconSymbol name="xmark" size={22} color={colors.foreground} />
              </Pressable>
            </View>

            {/* Start row */}
            <Pressable
              onPress={() => setCalSubPicker(calSubPicker === "start" ? null : "start")}
              style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 14, paddingHorizontal: 4, borderRadius: 12, backgroundColor: calSubPicker === "start" ? colors.primary + "18" : "transparent", marginBottom: 4 }}
            >
              <Text style={{ fontSize: 15, fontWeight: "600", color: colors.foreground }}>Start Time</Text>
              <Text style={{ fontSize: 17, fontWeight: "700", color: colors.primary }}>{(() => { const [h, m] = draftStart.split(":").map(Number); const ap = h >= 12 ? "PM" : "AM"; const hr = h === 0 ? 12 : h > 12 ? h - 12 : h; return `${hr}:${String(m).padStart(2,"0")} ${ap}`; })()}</Text>
            </Pressable>
            {calSubPicker === "start" && (
              <TapTimePicker value={draftStart} onChange={(v) => { setDraftStart(v); setTimeError(null); }} stepMinutes={15} />
            )}

            {/* End row */}
            <Pressable
              onPress={() => setCalSubPicker(calSubPicker === "end" ? null : "end")}
              style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 14, paddingHorizontal: 4, borderRadius: 12, backgroundColor: calSubPicker === "end" ? colors.primary + "18" : "transparent", marginBottom: 4 }}
            >
              <Text style={{ fontSize: 15, fontWeight: "600", color: colors.foreground }}>End Time</Text>
              <Text style={{ fontSize: 17, fontWeight: "700", color: colors.primary }}>{(() => { const [h, m] = draftEnd.split(":").map(Number); const ap = h >= 12 ? "PM" : "AM"; const hr = h === 0 ? 12 : h > 12 ? h - 12 : h; return `${hr}:${String(m).padStart(2,"0")} ${ap}`; })()}</Text>
            </Pressable>
            {calSubPicker === "end" && (
              <TapTimePicker value={draftEnd} onChange={(v) => { setDraftEnd(v); setTimeError(null); }} stepMinutes={15} />
            )}

            {timeError ? (
              <Text style={{ color: colors.error, fontSize: 13, textAlign: "center", marginVertical: 8 }}>⚠ {timeError}</Text>
            ) : null}
            <Pressable
              onPress={handleSaveTimeOverride}
              style={({ pressed }) => [{ backgroundColor: timeError ? colors.border : colors.primary, paddingVertical: 16, borderRadius: 14, alignItems: "center", opacity: pressed ? 0.8 : 1, marginTop: 12 }]}
            >
              <Text style={{ color: timeError ? colors.muted : "#fff", fontWeight: "700", fontSize: 16 }}>Save Hours</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  monthHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 8 },
  monthTitle: { fontSize: 18, fontWeight: "700" },
  navBtn: { padding: 8 },
  dayHeaderRow: { flexDirection: "row", marginBottom: 4 },
  calendarGrid: { flexDirection: "row", flexWrap: "wrap", width: "100%" },
  dayCell: { alignItems: "center", justifyContent: "center" },
  dotsRow: { flexDirection: "row", gap: 2, position: "absolute", bottom: 3 },
  dot: { width: 4, height: 4, borderRadius: 2 },
  overrideDot: { width: 5, height: 5, borderRadius: 2.5, position: "absolute", top: 3, right: 6 },
  dotLegend: { flexDirection: "row", justifyContent: "center", gap: 12, marginTop: 6, marginBottom: 8, flexWrap: "wrap" },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  legendDot: { width: 7, height: 7, borderRadius: 3.5 },
  sectionTitle: { fontSize: 16, fontWeight: "700", marginBottom: 8 },
  apptCard: { flexDirection: "column", padding: 12, borderRadius: 12, borderWidth: 1, borderLeftWidth: 4, marginBottom: 8 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, alignSelf: "flex-start" },
  filterChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, marginRight: 8 },
  emptyState: { alignItems: "center", paddingVertical: 24, borderRadius: 14, borderWidth: 1 },
  filterCard: { borderRadius: 14, padding: 14, borderWidth: 1, borderLeftWidth: 4, marginBottom: 10 },
  filterCardRow: { flexDirection: "row", alignItems: "center" },
  actionRow: { flexDirection: "row", gap: 10, marginTop: 10, paddingTop: 10, borderTopWidth: 1, width: "100%" },
  acceptBtn: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10, flex: 1, justifyContent: "center", minHeight: 40 },
  rejectBtn: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10, borderWidth: 1.5, flex: 1, justifyContent: "center", minHeight: 40 },
  workdayPanel: { borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 4 },
  editHoursBtn: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, marginTop: 10, alignSelf: "flex-start" },
  resetBtn: { paddingVertical: 6, marginTop: 6 },
  bookBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 12, borderRadius: 14, gap: 8 },
  viewSwitcher: { flexDirection: "row", gap: 8, marginBottom: 12 },
  viewTab: { paddingVertical: 8, borderRadius: 12, borderWidth: 1, alignItems: "center" },
  todayBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 14, borderWidth: 1.5 },
  timelineContainer: { borderRadius: 14, borderWidth: 1, overflow: "hidden", marginBottom: 16, position: "relative" },
  timelineRow: { flexDirection: "row", borderBottomWidth: 0.5 },
  timelineLabel: { width: 68, paddingTop: 6, paddingLeft: 8, paddingRight: 4, justifyContent: "flex-start" },
  timelineSlot: { flex: 1 },
  timelineAppt: { borderLeftWidth: 3, borderRadius: 6, padding: 6, marginBottom: 2 },
  timelineApptAbs: { position: "absolute", borderLeftWidth: 3, borderRadius: 6, padding: 6, overflow: "hidden" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, borderWidth: 1, paddingBottom: 40 },
  modalBtn: { paddingVertical: 14, borderRadius: 14, borderWidth: 1, alignItems: "center" },
});
