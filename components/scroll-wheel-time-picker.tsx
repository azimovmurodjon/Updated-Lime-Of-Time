/**
 * ScrollWheelTimePicker
 *
 * A native-feeling scroll-wheel time picker in 12-hour AM/PM format.
 *
 * Design:
 * - Three columns: Hour | Minute | AM/PM
 * - Items are strictly bounded to [minTime, maxTime] when provided
 * - The wheel only shows hours/minutes/ampm values that exist in the valid range
 * - Smooth snap scrolling, no lag
 * - Calls onChange with a reliable 24-hour "HH:MM" string
 *
 * Layout:
 * - Each picker is self-contained and sized to fit inside any modal
 * - Total width: 56 (hour) + 8 (colon) + 56 (min) + 12 (gap) + 48 (ampm) = 180px
 */
import React, { useRef, useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Platform,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from "react-native";
import { useColors } from "@/hooks/use-colors";

const ITEM_HEIGHT = 48;
const VISIBLE_ITEMS = 5; // must be odd
const PICKER_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS;

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function minutesToTime(m: number): string {
  const h = Math.floor(m / 60) % 24;
  const min = m % 60;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

function to12Hour(hour24: number): { hour: number; ampm: "AM" | "PM" } {
  const ampm: "AM" | "PM" = hour24 < 12 ? "AM" : "PM";
  const hour = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
  return { hour, ampm };
}

function to24Hour(hour12: number, ampm: "AM" | "PM"): number {
  if (ampm === "AM") return hour12 === 12 ? 0 : hour12;
  return hour12 === 12 ? 12 : hour12 + 12;
}

// ─── Single Wheel Column ──────────────────────────────────────────────────────

interface WheelColumnProps {
  items: string[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  colWidth: number;
}

function WheelColumn({ items, selectedIndex, onSelect, colWidth }: WheelColumnProps) {
  const colors = useColors();
  const scrollRef = useRef<ScrollView>(null);
  const isMounted = useRef(true);
  const lastIndex = useRef(selectedIndex);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  // Scroll to selected index when it changes
  useEffect(() => {
    const target = Math.max(0, Math.min(selectedIndex, items.length - 1));
    lastIndex.current = target;
    const t = setTimeout(() => {
      if (isMounted.current) {
        scrollRef.current?.scrollTo({ y: target * ITEM_HEIGHT, animated: false });
      }
    }, 20);
    return () => clearTimeout(t);
  }, [selectedIndex, items.length]);

  const snapToIndex = useCallback(
    (y: number) => {
      const index = Math.round(y / ITEM_HEIGHT);
      const clamped = Math.max(0, Math.min(index, items.length - 1));
      if (lastIndex.current !== clamped) {
        lastIndex.current = clamped;
        scrollRef.current?.scrollTo({ y: clamped * ITEM_HEIGHT, animated: true });
        onSelect(clamped);
      }
    },
    [items.length, onSelect]
  );

  const handleMomentumEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      snapToIndex(e.nativeEvent.contentOffset.y);
    },
    [snapToIndex]
  );

  const handleScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      snapToIndex(e.nativeEvent.contentOffset.y);
    },
    [snapToIndex]
  );

  return (
    <View style={{ width: colWidth, alignItems: "center" }}>
      <View style={{ width: colWidth, height: PICKER_HEIGHT, overflow: "hidden" }}>
        {/* Selection highlight */}
        <View
          pointerEvents="none"
          style={[
            styles.selectionBar,
            {
              top: ITEM_HEIGHT * Math.floor(VISIBLE_ITEMS / 2),
              borderColor: colors.primary + "60",
              backgroundColor: colors.primary + "18",
            },
          ]}
        />
        <ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          snapToInterval={ITEM_HEIGHT}
          decelerationRate={Platform.OS === "ios" ? "fast" : 0.85}
          contentContainerStyle={{ paddingVertical: ITEM_HEIGHT * Math.floor(VISIBLE_ITEMS / 2) }}
          onMomentumScrollEnd={handleMomentumEnd}
          onScrollEndDrag={handleScrollEnd}
          scrollEventThrottle={16}
          bounces={false}
          overScrollMode="never"
        >
          {items.map((item, idx) => {
            const distance = Math.abs(idx - selectedIndex);
            const opacity = distance === 0 ? 1 : distance === 1 ? 0.6 : distance === 2 ? 0.3 : 0.12;
            const scale = distance === 0 ? 1 : distance === 1 ? 0.88 : 0.76;
            const isSelected = idx === selectedIndex;
            return (
              <View key={idx} style={[styles.item, { height: ITEM_HEIGHT }]}>
                <Text
                  style={{
                    fontSize: isSelected ? 22 : 18,
                    fontWeight: isSelected ? "700" : "400",
                    color: isSelected ? colors.primary : colors.foreground,
                    opacity,
                    transform: [{ scale }],
                  }}
                  numberOfLines={1}
                >
                  {item}
                </Text>
              </View>
            );
          })}
        </ScrollView>
        {/* Top fade overlay */}
        <View pointerEvents="none" style={[styles.fadeTop, { backgroundColor: colors.surface }]} />
        {/* Bottom fade overlay */}
        <View pointerEvents="none" style={[styles.fadeBottom, { backgroundColor: colors.surface }]} />
      </View>
    </View>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export interface ScrollWheelTimePickerProps {
  /** Current value in HH:MM 24-hour format (e.g. "14:30") */
  value: string;
  /** Called with new value in HH:MM 24-hour format */
  onChange: (value: string) => void;
  /** Step in minutes (default 15) */
  stepMinutes?: number;
  /**
   * Minimum allowed time in HH:MM 24-hour format.
   * Only time slots >= minTime will appear in the wheel.
   */
  minTime?: string;
  /**
   * Maximum allowed time in HH:MM 24-hour format.
   * Only time slots <= maxTime will appear in the wheel.
   */
  maxTime?: string;
}

export function ScrollWheelTimePicker({
  value,
  onChange,
  stepMinutes = 15,
  minTime,
  maxTime,
}: ScrollWheelTimePickerProps) {
  const colors = useColors();

  // ── Build the full list of valid time slots within [minTime, maxTime] ──────
  const timeSlots = useMemo(() => {
    const minMin = minTime ? timeToMinutes(minTime) : 0;
    const maxMin = maxTime ? timeToMinutes(maxTime) : 23 * 60 + 45;
    const slots: string[] = [];
    for (let m = minMin; m <= maxMin; m += stepMinutes) {
      slots.push(minutesToTime(m));
    }
    return slots;
  }, [minTime, maxTime, stepMinutes]);

  // ── Clamp current value to nearest valid slot ─────────────────────────────
  const clampedValue = useMemo(() => {
    if (timeSlots.length === 0) return value;
    const valMin = timeToMinutes(value);
    let closest = timeSlots[0];
    let closestDiff = Math.abs(timeToMinutes(timeSlots[0]) - valMin);
    for (const slot of timeSlots) {
      const diff = Math.abs(timeToMinutes(slot) - valMin);
      if (diff < closestDiff) { closest = slot; closestDiff = diff; }
    }
    return closest;
  }, [value, timeSlots]);

  // ── Parse current clamped value ───────────────────────────────────────────
  const [curH24, curM] = clampedValue.split(":").map(Number);
  const { hour: curH12, ampm: curAmPm } = to12Hour(curH24);

  // ── Build wheel items from valid slots ────────────────────────────────────
  // Hours: unique 24h hours present in valid slots, displayed as 12h
  const hourItems = useMemo(() => {
    const seen = new Set<number>();
    const items: { display: string; h24: number }[] = [];
    for (const slot of timeSlots) {
      const h24 = parseInt(slot.split(":")[0]);
      if (!seen.has(h24)) {
        seen.add(h24);
        const { hour } = to12Hour(h24);
        items.push({ display: String(hour).padStart(2, "0"), h24 });
      }
    }
    return items;
  }, [timeSlots]);

  // Minutes: unique minutes present in valid slots
  const minuteItems = useMemo(() => {
    const seen = new Set<number>();
    const items: number[] = [];
    for (const slot of timeSlots) {
      const m = parseInt(slot.split(":")[1]);
      if (!seen.has(m)) { seen.add(m); items.push(m); }
    }
    return items.sort((a, b) => a - b);
  }, [timeSlots]);

  // AM/PM: only show values present in valid slots
  const ampmItems = useMemo(() => {
    const has = { AM: false, PM: false };
    for (const slot of timeSlots) {
      const h24 = parseInt(slot.split(":")[0]);
      if (h24 < 12) has.AM = true;
      else has.PM = true;
    }
    const result: ("AM" | "PM")[] = [];
    if (has.AM) result.push("AM");
    if (has.PM) result.push("PM");
    return result;
  }, [timeSlots]);

  // ── Find selected indices ─────────────────────────────────────────────────
  const hourIndex = useMemo(() => {
    const idx = hourItems.findIndex((item) => item.h24 === curH24);
    return Math.max(0, idx);
  }, [hourItems, curH24]);

  const minuteIndex = useMemo(() => {
    const idx = minuteItems.indexOf(curM);
    return Math.max(0, idx);
  }, [minuteItems, curM]);

  const ampmIndex = useMemo(() => {
    const idx = ampmItems.indexOf(curAmPm);
    return Math.max(0, idx);
  }, [ampmItems, curAmPm]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const resolveAndEmit = useCallback(
    (h24: number, minute: number) => {
      const candidate = minutesToTime(h24 * 60 + minute);
      const minMin = minTime ? timeToMinutes(minTime) : 0;
      const maxMin = maxTime ? timeToMinutes(maxTime) : 23 * 60 + 59;
      const candMin = timeToMinutes(candidate);
      if (candMin < minMin) { onChange(minutesToTime(minMin)); return; }
      if (candMin > maxMin) { onChange(minutesToTime(maxMin)); return; }
      onChange(candidate);
    },
    [minTime, maxTime, onChange]
  );

  const handleHourChange = useCallback(
    (idx: number) => {
      const item = hourItems[idx];
      if (!item) return;
      resolveAndEmit(item.h24, curM);
    },
    [hourItems, curM, resolveAndEmit]
  );

  const handleMinuteChange = useCallback(
    (idx: number) => {
      const minute = minuteItems[idx];
      if (minute === undefined) return;
      resolveAndEmit(curH24, minute);
    },
    [minuteItems, curH24, resolveAndEmit]
  );

  const handleAmPmChange = useCallback(
    (idx: number) => {
      const newAmPm = ampmItems[idx];
      if (!newAmPm) return;
      const newH24 = to24Hour(curH12, newAmPm);
      resolveAndEmit(newH24, curM);
    },
    [ampmItems, curH12, curM, resolveAndEmit]
  );

  // Column widths — sized to always fit in a modal without clipping
  const COL_HOUR = 60;
  const COL_MIN = 60;
  const COL_AMPM = 56;

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.wheelsRow}>
        <WheelColumn
          items={hourItems.map((i) => i.display)}
          selectedIndex={hourIndex}
          onSelect={handleHourChange}
          colWidth={COL_HOUR}
        />
        <Text style={[styles.colon, { color: colors.foreground }]}>:</Text>
        <WheelColumn
          items={minuteItems.map((m) => String(m).padStart(2, "0"))}
          selectedIndex={minuteIndex}
          onSelect={handleMinuteChange}
          colWidth={COL_MIN}
        />
        <View style={{ width: 14 }} />
        <WheelColumn
          items={ampmItems}
          selectedIndex={ampmIndex}
          onSelect={handleAmPmChange}
          colWidth={COL_AMPM}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  wheelsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  item: {
    alignItems: "center",
    justifyContent: "center",
  },
  colon: {
    fontSize: 24,
    fontWeight: "700",
    marginHorizontal: 2,
    marginBottom: 2,
    minWidth: 12,
    textAlign: "center",
  },
  selectionBar: {
    position: "absolute",
    left: 2,
    right: 2,
    height: ITEM_HEIGHT,
    borderRadius: 10,
    borderWidth: 1.5,
    zIndex: 1,
  },
  fadeTop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: ITEM_HEIGHT * 1.6,
    opacity: 0.75,
    zIndex: 2,
  },
  fadeBottom: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: ITEM_HEIGHT * 1.6,
    opacity: 0.75,
    zIndex: 2,
  },
});
