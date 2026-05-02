/**
 * OverviewDayWeekCard
 *
 * A swipeable card shown on the Home screen when the user switches from the
 * 4-KPI grid to the Day/Week overview mode.
 *
 * • Day tab  – hour-by-hour timeline for a selected day, swipeable ← → to
 *              navigate to previous/next days. Shows total booked income and
 *              appointment count at the top.
 * • Week tab – one card per week (Sun–Sat), showing per-day rows with
 *              appointment count + booked value, plus a weekly total at the
 *              bottom. Swipeable ← → to navigate to previous/next weeks.
 *
 * Both views respect the active location filter passed in from the parent.
 * Navigation uses a smooth directional slide animation (like iOS page transitions).
 */

import React, { useState, useCallback, useMemo, useRef } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  Animated,
  PanResponder,
} from "react-native";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useRouter } from "expo-router";
import { formatTime } from "@/lib/store";
import { timeToMinutes } from "@/lib/types";

// ─── Types ──────────────────────────────────────────────────────────────────

interface Appointment {
  id: string;
  date: string;       // "YYYY-MM-DD"
  time: string;       // "HH:MM"
  status: string;
  serviceId: string;
  clientId?: string;
  locationId?: string;
  totalPrice?: number;
  duration?: number;
}

interface Service {
  id: string;
  name: string;
  price: number;
  duration?: number;
  color?: string;
}

interface Client {
  id: string;
  name: string;
}

export interface OverviewDayWeekCardProps {
  appointments: Appointment[];
  services: Service[];
  clients: Client[];
  /** null = All Locations */
  selectedLocationFilter: string | null;
  width: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function dateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

/** Sunday of the week containing `d` */
function weekSunday(d: Date): Date {
  const r = new Date(d);
  r.setDate(r.getDate() - r.getDay());
  return r;
}

function formatDayHeader(d: Date): string {
  const today = new Date();
  const todayStr = dateStr(today);
  const dStr = dateStr(d);
  if (dStr === todayStr) return "Today";
  if (dStr === dateStr(addDays(today, 1))) return "Tomorrow";
  if (dStr === dateStr(addDays(today, -1))) return "Yesterday";
  return d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
}

function formatWeekRange(sun: Date): string {
  const sat = addDays(sun, 6);
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  return `${sun.toLocaleDateString("en-US", opts)} – ${sat.toLocaleDateString("en-US", opts)}`;
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKEND_DAYS = [0, 6]; // Sunday, Saturday

function formatHour(h: number): string {
  if (h === 0) return "12 AM";
  if (h < 12) return `${h} AM`;
  if (h === 12) return "12 PM";
  return `${h - 12} PM`;
}

function getApptPrice(a: Appointment, services: Service[]): number {
  if (a.totalPrice != null) return a.totalPrice;
  const svc = services.find((s) => s.id === a.serviceId);
  return svc?.price ?? 0;
}

function getApptDuration(a: Appointment, services: Service[]): number {
  if (a.duration != null) return a.duration;
  const svc = services.find((s) => s.id === a.serviceId);
  return svc?.duration ?? 30;
}

function getEndTime(a: Appointment, services: Service[]): string {
  const mins = timeToMinutes(a.time) + getApptDuration(a, services);
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// ─── Column layout algorithm ─────────────────────────────────────────────────

function assignColumns(
  blocks: Array<{ a: Appointment; top: number; height: number; svc: Service | undefined; client: Client | undefined }>
): Array<{ a: Appointment; top: number; height: number; svc: Service | undefined; client: Client | undefined; col: number; totalCols: number }> {
  if (blocks.length === 0) return [];
  const sorted = [...blocks].sort((a, b) => a.top - b.top);
  const colEndTimes: number[] = [];
  const assigned = sorted.map((block) => {
    const blockEnd = block.top + block.height;
    let col = colEndTimes.findIndex((end) => end <= block.top + 1);
    if (col === -1) {
      col = colEndTimes.length;
      colEndTimes.push(blockEnd);
    } else {
      colEndTimes[col] = blockEnd;
    }
    return { ...block, col, totalCols: 0 };
  });
  assigned.forEach((block) => {
    const blockEnd = block.top + block.height;
    const overlapping = assigned.filter(
      (other) => other.top < blockEnd && other.top + other.height > block.top
    );
    const maxCol = Math.max(...overlapping.map((o) => o.col)) + 1;
    block.totalCols = maxCol;
  });
  return assigned;
}

// ─── Sub-component: Timeline for a single day ────────────────────────────────

interface DayTimelineProps {
  dayDate: Date;
  dayAppts: Appointment[];
  services: Service[];
  clients: Client[];
  colors: ReturnType<typeof useColors>;
  onApptPress: (id: string) => void;
}

function DayTimeline({ dayDate, dayAppts, services, clients, colors, onApptPress }: DayTimelineProps) {
  const HOUR_HEIGHT = 56;
  const LABEL_WIDTH = 48;
  const [gridWidth, setGridWidth] = useState(0);

  const rawBlocks = useMemo(() => {
    return dayAppts
      .filter((a) => a.status !== "cancelled")
      .map((a) => {
        const startMin = timeToMinutes(a.time);
        const dur = getApptDuration(a, services);
        const svc = services.find((s) => s.id === a.serviceId);
        const client = clients.find((c) => c.id === a.clientId);
        return {
          a,
          top: (startMin / 60) * HOUR_HEIGHT,
          height: Math.max((dur / 60) * HOUR_HEIGHT, 28),
          svc,
          client,
        };
      });
  }, [dayAppts, services, clients]);

  const blocks = useMemo(() => assignColumns(rawBlocks), [rawBlocks]);

  // Determine visible hour range (show 6 AM – 10 PM by default, or expand to fit appts)
  const startHour = useMemo(() => {
    if (blocks.length === 0) return 8;
    const minTop = Math.min(...blocks.map((b) => b.top));
    return Math.max(0, Math.floor(minTop / HOUR_HEIGHT) - 1);
  }, [blocks]);
  const endHour = useMemo(() => {
    if (blocks.length === 0) return 20;
    const maxBottom = Math.max(...blocks.map((b) => b.top + b.height));
    return Math.min(24, Math.ceil(maxBottom / HOUR_HEIGHT) + 1);
  }, [blocks]);

  const visibleHours = useMemo(
    () => Array.from({ length: endHour - startHour }, (_, i) => startHour + i),
    [startHour, endHour]
  );

  const totalHeight = (endHour - startHour) * HOUR_HEIGHT;
  const offsetTop = startHour * HOUR_HEIGHT;

  // Current time indicator
  const now = new Date();
  const isToday = dateStr(dayDate) === dateStr(now);
  const nowTop = isToday
    ? ((now.getHours() * 60 + now.getMinutes()) / 60) * HOUR_HEIGHT - offsetTop
    : -1;

  return (
    <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
      <View style={{ flexDirection: "row", minHeight: totalHeight + 24 }}>
        {/* Hour labels */}
        <View style={{ width: LABEL_WIDTH }}>
          {visibleHours.map((h) => (
            <View key={h} style={{ height: HOUR_HEIGHT, justifyContent: "flex-start", paddingTop: 4 }}>
              <Text style={{ fontSize: 10, color: colors.muted, textAlign: "right", paddingRight: 8 }}>
                {formatHour(h)}
              </Text>
            </View>
          ))}
        </View>

        {/* Grid + appointment blocks */}
        <View
          style={{ flex: 1, position: "relative" }}
          onLayout={(e) => setGridWidth(e.nativeEvent.layout.width)}
        >
          {/* Hour lines */}
          {visibleHours.map((h) => (
            <View
              key={h}
              style={{
                position: "absolute",
                top: (h - startHour) * HOUR_HEIGHT,
                left: 0,
                right: 0,
                height: StyleSheet.hairlineWidth,
                backgroundColor: colors.border,
              }}
            />
          ))}

          {/* Current time indicator */}
          {isToday && nowTop >= 0 && nowTop <= totalHeight && (
            <View
              style={{
                position: "absolute",
                top: nowTop,
                left: 0,
                right: 0,
                height: 2,
                backgroundColor: "#E53935",
                zIndex: 10,
              }}
            >
              <View
                style={{
                  position: "absolute",
                  left: -4,
                  top: -4,
                  width: 10,
                  height: 10,
                  borderRadius: 5,
                  backgroundColor: "#E53935",
                }}
              />
            </View>
          )}

          {/* Appointment blocks */}
          {gridWidth > 0 && blocks.map(({ a, top, height, svc, client, col, totalCols }) => {
            const colW = gridWidth / totalCols;
            const blockLeft = col * colW + (col === 0 ? 2 : 1);
            const blockWidth = colW - (col === 0 ? 3 : 2);
            const adjustedTop = top - offsetTop;
            if (adjustedTop + height < 0 || adjustedTop > totalHeight) return null;
            return (
              <Pressable
                key={a.id}
                onPress={() => onApptPress(a.id)}
                style={({ pressed }) => ({
                  position: "absolute",
                  top: adjustedTop + 1,
                  left: blockLeft,
                  width: blockWidth,
                  height: height - 2,
                  backgroundColor: (svc?.color ?? colors.primary) + "CC",
                  borderRadius: 6,
                  borderLeftWidth: 3,
                  borderLeftColor: svc?.color ?? colors.primary,
                  paddingHorizontal: 5,
                  paddingVertical: 3,
                  overflow: "hidden",
                  opacity: pressed ? 0.75 : 1,
                  zIndex: 5,
                })}
              >
                <Text style={{ fontSize: 11, fontWeight: "700", color: "#FFF" }} numberOfLines={1}>
                  {svc?.name ?? "Appointment"}
                </Text>
                {height > 40 && (
                  <Text style={{ fontSize: 10, color: "rgba(255,255,255,0.85)" }} numberOfLines={1}>
                    {client?.name ?? ""} · {formatTime(a.time)}–{getEndTime(a, services)}
                  </Text>
                )}
              </Pressable>
            );
          })}
        </View>
      </View>
    </ScrollView>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function OverviewDayWeekCard({
  appointments,
  services,
  clients,
  selectedLocationFilter,
  width,
}: OverviewDayWeekCardProps) {
  const colors = useColors();
  const router = useRouter();

  // ── Mode: "day" | "week" ──
  const [mode, setMode] = useState<"day" | "week">("week");

  // ── Day navigation ──
  const [dayOffset, setDayOffset] = useState(0);
  const selectedDay = useMemo(() => addDays(new Date(), dayOffset), [dayOffset]);

  // ── Week navigation ──
  const [weekOffset, setWeekOffset] = useState(0);
  const weekSun = useMemo(() => {
    const base = weekSunday(new Date());
    return addDays(base, weekOffset * 7);
  }, [weekOffset]);

  // ── Location filter ──
  const filteredAppts = useMemo(() => {
    if (!selectedLocationFilter) return appointments;
    return appointments.filter((a) => a.locationId === selectedLocationFilter);
  }, [appointments, selectedLocationFilter]);

  // ── Day view data ──
  const dayStr = useMemo(() => dateStr(selectedDay), [selectedDay]);
  const dayAppts = useMemo(
    () => filteredAppts.filter((a) => a.date === dayStr && a.status !== "cancelled"),
    [filteredAppts, dayStr]
  );
  const dayIncome = useMemo(
    () => dayAppts.reduce((sum, a) => sum + getApptPrice(a, services), 0),
    [dayAppts, services]
  );

  // ── Week view data ──
  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = addDays(weekSun, i);
      const dStr = dateStr(d);
      const appts = filteredAppts.filter((a) => a.date === dStr && a.status !== "cancelled");
      const income = appts.reduce((sum, a) => sum + getApptPrice(a, services), 0);
      return { date: d, dateStr: dStr, appts, income, dayIndex: i };
    });
  }, [weekSun, filteredAppts, services]);

  const weekTotalIncome = useMemo(
    () => weekDays.reduce((sum, d) => sum + d.income, 0),
    [weekDays]
  );
  const weekTotalAppts = useMemo(
    () => weekDays.reduce((sum, d) => sum + d.appts.length, 0),
    [weekDays]
  );

  // ── Navigation ──
  const handleApptPress = useCallback(
    (id: string) => {
      router.push({ pathname: "/appointment-detail", params: { id } } as any);
    },
    [router]
  );

  // ── Smooth slide animation ──
  // slideX animates the content: 0 = in place, negative = slide left, positive = slide right
  const slideX = useRef(new Animated.Value(0)).current;
  const contentOpacity = useRef(new Animated.Value(1)).current;
  const isAnimating = useRef(false);

  /**
   * Slide the current content out in `direction`, update state, then slide new content in.
   * direction: "left" = going forward (next), "right" = going back (prev)
   */
  const animateNavigate = useCallback(
    (direction: "left" | "right", updateFn: () => void) => {
      if (isAnimating.current) return;
      isAnimating.current = true;

      const outX = direction === "left" ? -width * 0.35 : width * 0.35;
      const inX = direction === "left" ? width * 0.35 : -width * 0.35;

      // Phase 1: slide out + fade out
      Animated.parallel([
        Animated.timing(slideX, {
          toValue: outX,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(contentOpacity, {
          toValue: 0,
          duration: 160,
          useNativeDriver: true,
        }),
      ]).start(() => {
        // Update state
        updateFn();
        // Reset to incoming position instantly (no animation)
        slideX.setValue(inX);
        // Phase 2: slide in + fade in
        Animated.parallel([
          Animated.timing(slideX, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(contentOpacity, {
            toValue: 1,
            duration: 180,
            useNativeDriver: true,
          }),
        ]).start(() => {
          isAnimating.current = false;
        });
      });
    },
    [slideX, contentOpacity, width]
  );

  const goNext = useCallback(() => {
    animateNavigate("left", () => {
      if (mode === "day") setDayOffset((o) => o + 1);
      else setWeekOffset((o) => o + 1);
    });
  }, [animateNavigate, mode]);

  const goPrev = useCallback(() => {
    animateNavigate("right", () => {
      if (mode === "day") setDayOffset((o) => o - 1);
      else setWeekOffset((o) => o - 1);
    });
  }, [animateNavigate, mode]);

  const goToday = useCallback(() => {
    const isAlreadyCurrent = mode === "day" ? dayOffset === 0 : weekOffset === 0;
    if (isAlreadyCurrent) return;
    const direction = (mode === "day" ? dayOffset : weekOffset) > 0 ? "left" : "right";
    animateNavigate(direction, () => {
      if (mode === "day") setDayOffset(0);
      else setWeekOffset(0);
    });
  }, [animateNavigate, mode, dayOffset, weekOffset]);

  // ── Mode ref for PanResponder (avoids stale closure) ──
  const modeRef = useRef(mode);
  modeRef.current = mode;

  // ── Mode switch animation ──
  const modeAnim = useRef(new Animated.Value(mode === "week" ? 1 : 0)).current;
  const switchMode = useCallback(
    (next: "day" | "week") => {
      if (next === mode) return;
      setMode(next);
      Animated.spring(modeAnim, {
        toValue: next === "week" ? 1 : 0,
        useNativeDriver: false,
        speed: 20,
        bounciness: 4,
      }).start();
    },
    [mode, modeAnim]
  );

  const todayStr = dateStr(new Date());
  const isWeekCurrent = dateStr(weekSunday(new Date())) === dateStr(weekSun);

  // ── Horizontal swipe gesture ──
  const swipePan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gs) =>
        Math.abs(gs.dx) > 14 && Math.abs(gs.dx) > Math.abs(gs.dy) * 1.8,
      onPanResponderRelease: (_, gs) => {
        if (Math.abs(gs.dx) < 50) return;
        if (gs.dx < 0) {
          // swipe left → next
          if (modeRef.current === "day") {
            animateNavigate("left", () => setDayOffset((o) => o + 1));
          } else {
            animateNavigate("left", () => setWeekOffset((o) => o + 1));
          }
        } else {
          // swipe right → prev
          if (modeRef.current === "day") {
            animateNavigate("right", () => setDayOffset((o) => o - 1));
          } else {
            animateNavigate("right", () => setWeekOffset((o) => o - 1));
          }
        }
      },
    })
  ).current;

  return (
    <View
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, width }]}
      {...swipePan.panHandlers}
    >
      {/* ── Header: Day / Week toggle + navigation ── */}
      <View style={styles.header}>
        <View style={[styles.toggleRow, { backgroundColor: colors.background, borderColor: colors.border }]}>
          <Pressable
            onPress={() => switchMode("day")}
            style={[styles.toggleBtn, mode === "day" && { backgroundColor: colors.primary }]}
          >
            <IconSymbol name="calendar.day.timeline.left" size={14} color={mode === "day" ? "#FFF" : colors.muted} />
            <Text style={[styles.toggleLabel, { color: mode === "day" ? "#FFF" : colors.muted }]}>Day</Text>
          </Pressable>
          <Pressable
            onPress={() => switchMode("week")}
            style={[styles.toggleBtn, mode === "week" && { backgroundColor: colors.primary }]}
          >
            <IconSymbol name="calendar" size={14} color={mode === "week" ? "#FFF" : colors.muted} />
            <Text style={[styles.toggleLabel, { color: mode === "week" ? "#FFF" : colors.muted }]}>Week</Text>
          </Pressable>
        </View>

        <View style={styles.navRow}>
          <Pressable
            onPress={goPrev}
            style={({ pressed }) => [styles.navBtn, { borderColor: colors.border, opacity: pressed ? 0.6 : 1 }]}
          >
            <IconSymbol name="chevron.left" size={14} color={colors.foreground} />
          </Pressable>
          <Pressable
            onPress={goToday}
            style={({ pressed }) => [
              styles.todayBtn,
              {
                backgroundColor: (mode === "day" ? dayStr === todayStr : isWeekCurrent)
                  ? colors.primary + "20"
                  : colors.background,
                borderColor: colors.border,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <Text style={{ fontSize: 11, fontWeight: "700", color: (mode === "day" ? dayStr === todayStr : isWeekCurrent) ? colors.primary : colors.muted }}>
              {mode === "day" ? "Today" : "This Week"}
            </Text>
          </Pressable>
          <Pressable
            onPress={goNext}
            style={({ pressed }) => [styles.navBtn, { borderColor: colors.border, opacity: pressed ? 0.6 : 1 }]}
          >
            <IconSymbol name="chevron.right" size={14} color={colors.foreground} />
          </Pressable>
        </View>
      </View>

      {/* ── Animated content wrapper ── */}
      <Animated.View
        style={{
          transform: [{ translateX: slideX }],
          opacity: contentOpacity,
          overflow: "hidden",
        }}
      >
        {/* ── Day View ── */}
        {mode === "day" && (
          <View>
            {/* Day header with stats */}
            <View style={[styles.dayStatRow, { borderBottomColor: colors.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: "700", color: colors.foreground }}>
                  {formatDayHeader(selectedDay)}
                </Text>
                <Text style={{ fontSize: 12, color: colors.muted, marginTop: 1 }}>
                  {selectedDay.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
                </Text>
              </View>
              <View style={styles.statPill}>
                <View style={[styles.statBadge, { backgroundColor: colors.primary + "18" }]}>
                  <Text style={{ fontSize: 13, fontWeight: "800", color: colors.primary }}>{dayAppts.length}</Text>
                  <Text style={{ fontSize: 10, color: colors.muted, marginTop: 1 }}>appts</Text>
                </View>
                <View style={[styles.statBadge, { backgroundColor: colors.success + "18" }]}>
                  <Text style={{ fontSize: 13, fontWeight: "800", color: colors.success }}>${dayIncome.toFixed(2)}</Text>
                  <Text style={{ fontSize: 10, color: colors.muted, marginTop: 1 }}>booked</Text>
                </View>
              </View>
            </View>

            {/* Timeline — fixed height so card doesn't grow unbounded */}
            <View style={{ height: 340 }}>
              <DayTimeline
                dayDate={selectedDay}
                dayAppts={dayAppts}
                services={services}
                clients={clients}
                colors={colors}
                onApptPress={handleApptPress}
              />
            </View>
          </View>
        )}

        {/* ── Week View ── */}
        {mode === "week" && (
          <View>
            {/* Week range header */}
            <View style={[styles.dayStatRow, { borderBottomColor: colors.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: "700", color: colors.foreground }}>
                  {formatWeekRange(weekSun)}
                </Text>
                <Text style={{ fontSize: 12, color: colors.muted, marginTop: 1 }}>
                  {weekTotalAppts} appointment{weekTotalAppts !== 1 ? "s" : ""} this week
                </Text>
              </View>
              <View style={[styles.statBadge, { backgroundColor: colors.success + "18" }]}>
                <Text style={{ fontSize: 13, fontWeight: "800", color: colors.success }}>${weekTotalIncome.toFixed(2)}</Text>
                <Text style={{ fontSize: 10, color: colors.muted, marginTop: 1 }}>total</Text>
              </View>
            </View>

            {/* Per-day rows — no ScrollView, render all 7 rows at natural height */}
            {weekDays.map(({ date, dateStr: dStr, appts, income, dayIndex }) => {
              const isWeekend = WEEKEND_DAYS.includes(dayIndex);
              const isToday = dStr === todayStr;
              const dayName = DAY_NAMES[dayIndex];
              const dayNum = date.getDate();
              const monthShort = date.toLocaleDateString("en-US", { month: "short" });

              return (
                <Pressable
                  key={dStr}
                  onPress={() => {
                    const today = new Date();
                    const diff = Math.round((date.getTime() - new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) / 86400000);
                    setDayOffset(diff);
                    switchMode("day");
                  }}
                  style={({ pressed }) => [
                    styles.weekDayRow,
                    {
                      borderBottomColor: colors.border,
                      backgroundColor: isToday
                        ? colors.primary + "0A"
                        : pressed
                        ? colors.border + "40"
                        : "transparent",
                    },
                  ]}
                >
                  {/* Day label */}
                  <View style={styles.weekDayLabel}>
                    <Text style={{ fontSize: 12, fontWeight: "700", color: isToday ? colors.primary : isWeekend ? "#E53935" : colors.muted }}>
                      {dayName}
                    </Text>
                    <View style={[styles.dayNumCircle, isToday && { backgroundColor: colors.primary }]}>
                      <Text style={{ fontSize: 13, fontWeight: "800", color: isToday ? "#FFF" : isWeekend ? "#E53935" : colors.foreground }}>
                        {dayNum}
                      </Text>
                    </View>
                    <Text style={{ fontSize: 10, color: colors.muted }}>{monthShort}</Text>
                  </View>

                  {/* Appointment time chips */}
                  <View style={styles.weekDayMid}>
                    {appts.length === 0 ? (
                      <Text style={{ fontSize: 11, color: colors.muted }}>—</Text>
                    ) : (
                      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4 }}>
                        {appts.slice(0, 4).map((a) => {
                          const svc = services.find((s) => s.id === a.serviceId);
                          return (
                            <View
                              key={a.id}
                              style={{
                                flexDirection: "row",
                                alignItems: "center",
                                backgroundColor: (svc?.color ?? colors.primary) + "20",
                                borderRadius: 6,
                                paddingHorizontal: 5,
                                paddingVertical: 2,
                                gap: 3,
                              }}
                            >
                              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: svc?.color ?? colors.primary }} />
                              <Text style={{ fontSize: 10, color: colors.foreground, fontWeight: "600" }}>
                                {formatTime(a.time)}
                              </Text>
                            </View>
                          );
                        })}
                        {appts.length > 4 && (
                          <Text style={{ fontSize: 10, color: colors.muted, alignSelf: "center" }}>
                            +{appts.length - 4}
                          </Text>
                        )}
                      </View>
                    )}
                  </View>

                  {/* Income + count */}
                  <View style={styles.weekDayRight}>
                    <Text style={{ fontSize: 13, fontWeight: "800", color: appts.length > 0 ? colors.success : colors.muted }}>
                      ${income.toFixed(2)}
                    </Text>
                    <Text style={{ fontSize: 10, color: colors.muted }}>
                      {appts.length} appt{appts.length !== 1 ? "s" : ""}
                    </Text>
                  </View>

                  <IconSymbol name="chevron.right" size={12} color={colors.muted} />
                </Pressable>
              );
            })}

            {/* Weekly total footer */}
            <View style={[styles.weekTotalRow, { borderTopColor: colors.border, backgroundColor: colors.background }]}>
              <Text style={{ fontSize: 13, fontWeight: "700", color: colors.foreground }}>Week Total</Text>
              <View style={{ flexDirection: "row", gap: 16, alignItems: "center" }}>
                <Text style={{ fontSize: 12, color: colors.muted }}>{weekTotalAppts} appts</Text>
                <Text style={{ fontSize: 15, fontWeight: "800", color: colors.success }}>
                  ${weekTotalIncome.toFixed(2)}
                </Text>
              </View>
            </View>
          </View>
        )}
      </Animated.View>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
    marginTop: 8,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
  },
  toggleRow: {
    flexDirection: "row",
    borderRadius: 10,
    borderWidth: 1,
    overflow: "hidden",
    padding: 2,
    gap: 2,
  },
  toggleBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  toggleLabel: {
    fontSize: 12,
    fontWeight: "700",
  },
  navRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  navBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  todayBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  dayStatRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    gap: 8,
  },
  statPill: {
    flexDirection: "row",
    gap: 8,
  },
  statBadge: {
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  weekDayRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  weekDayLabel: {
    width: 44,
    alignItems: "center",
    gap: 2,
  },
  dayNumCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  weekDayMid: {
    flex: 1,
  },
  weekDayRight: {
    alignItems: "flex-end",
    minWidth: 64,
  },
  weekTotalRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderTopWidth: 1,
  },
});
