/**
 * ScrollWheelTimePicker
 *
 * A native-feeling scroll-wheel time picker in 12-hour AM/PM format.
 * - Items are bounded to [minTime, maxTime] when provided
 * - Smooth snap scrolling with no lag
 * - Calls onChange with a reliable 24-hour "HH:MM" string
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
  width: number;
  label?: string;
}

function WheelColumn({ items, selectedIndex, onSelect, width, label }: WheelColumnProps) {
  const colors = useColors();
  const scrollRef = useRef<ScrollView>(null);
  const pendingIndex = useRef<number>(selectedIndex);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  // Scroll to the selected index whenever it changes externally
  useEffect(() => {
    const target = Math.max(0, Math.min(selectedIndex, items.length - 1));
    if (pendingIndex.current !== target) {
      pendingIndex.current = target;
    }
    // Small delay to let layout settle before scrolling
    const t = setTimeout(() => {
      if (isMounted.current) {
        scrollRef.current?.scrollTo({ y: target * ITEM_HEIGHT, animated: false });
      }
    }, 10);
    return () => clearTimeout(t);
  }, [selectedIndex, items.length]);

  const snapToIndex = useCallback(
    (y: number) => {
      const raw = y / ITEM_HEIGHT;
      const index = Math.round(raw);
      const clamped = Math.max(0, Math.min(index, items.length - 1));
      pendingIndex.current = clamped;
      // Snap scroll to exact position
      scrollRef.current?.scrollTo({ y: clamped * ITEM_HEIGHT, animated: true });
      onSelect(clamped);
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
    <View style={{ width, alignItems: "center" }}>
      {label && (
        <Text style={{ fontSize: 11, fontWeight: "600", color: colors.muted, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 }}>
          {label}
        </Text>
      )}
      <View style={{ width, height: PICKER_HEIGHT, overflow: "hidden" }}>
        {/* Selection highlight bar */}
        <View
          pointerEvents="none"
          style={[
            styles.selectionBar,
            {
              top: ITEM_HEIGHT * Math.floor(VISIBLE_ITEMS / 2),
              borderColor: colors.primary + "50",
              backgroundColor: colors.primary + "14",
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
            const opacity = distance === 0 ? 1 : distance === 1 ? 0.65 : distance === 2 ? 0.35 : 0.15;
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
                >
                  {item}
                </Text>
              </View>
            );
          })}
        </ScrollView>
        {/* Top fade */}
        <View
          pointerEvents="none"
          style={[styles.fadeTop, { backgroundColor: colors.surface }]}
        />
        {/* Bottom fade */}
        <View
          pointerEvents="none"
          style={[styles.fadeBottom, { backgroundColor: colors.surface }]}
        />
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
   * Items before this time will not appear in the wheel.
   */
  minTime?: string;
  /**
   * Maximum allowed time in HH:MM 24-hour format.
   * Items after this time will not appear in the wheel.
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

  // Build the full list of time slots within [minTime, maxTime]
  const timeSlots = useMemo(() => {
    const minMin = minTime ? timeToMinutes(minTime) : 0;
    const maxMin = maxTime ? timeToMinutes(maxTime) : 23 * 60 + 59;
    const slots: string[] = [];
    for (let m = minMin; m <= maxMin; m += stepMinutes) {
      slots.push(minutesToTime(m));
    }
    return slots;
  }, [minTime, maxTime, stepMinutes]);

  // Find the closest slot to the current value
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

  // Build display items for each wheel
  // Hours wheel: unique 12-hour values in the range
  const hourItems = useMemo(() => {
    const seen = new Set<number>();
    const items: { display: string; hour12: number; ampm: "AM" | "PM" }[] = [];
    for (const slot of timeSlots) {
      const [h24] = slot.split(":").map(Number);
      const { hour, ampm } = to12Hour(h24);
      const key = to24Hour(hour, ampm); // unique 24h hour
      if (!seen.has(key)) {
        seen.add(key);
        items.push({ display: String(hour).padStart(2, "0"), hour12: hour, ampm });
      }
    }
    return items;
  }, [timeSlots]);

  // Minutes wheel: unique minute values
  const minuteItems = useMemo(() => {
    const seen = new Set<number>();
    const items: number[] = [];
    for (const slot of timeSlots) {
      const [, m] = slot.split(":").map(Number);
      if (!seen.has(m)) { seen.add(m); items.push(m); }
    }
    return items.sort((a, b) => a - b);
  }, [timeSlots]);

  // AM/PM items: only show what's in range
  const ampmItems = useMemo(() => {
    const has = { AM: false, PM: false };
    for (const slot of timeSlots) {
      const [h24] = slot.split(":").map(Number);
      if (h24 < 12) has.AM = true;
      else has.PM = true;
    }
    const result: ("AM" | "PM")[] = [];
    if (has.AM) result.push("AM");
    if (has.PM) result.push("PM");
    return result;
  }, [timeSlots]);

  // Parse current clamped value
  const [curH24, curM] = clampedValue.split(":").map(Number);
  const { hour: curH12, ampm: curAmPm } = to12Hour(curH24);

  // Find indices
  const hourIndex = Math.max(0, hourItems.findIndex((item) => item.hour12 === curH12 && item.ampm === curAmPm));
  const minuteIndex = Math.max(0, minuteItems.indexOf(curM));
  const ampmIndex = Math.max(0, ampmItems.indexOf(curAmPm));

  // Resolve a new time from wheel selections
  const resolveTime = useCallback(
    (h12: number, ampm: "AM" | "PM", minute: number): string => {
      const h24 = to24Hour(h12, ampm);
      const candidate = minutesToTime(h24 * 60 + minute);
      // Clamp to range
      if (minTime && timeToMinutes(candidate) < timeToMinutes(minTime)) return minTime;
      if (maxTime && timeToMinutes(candidate) > timeToMinutes(maxTime)) return maxTime;
      return candidate;
    },
    [minTime, maxTime]
  );

  const handleHourChange = useCallback(
    (idx: number) => {
      const item = hourItems[idx];
      if (!item) return;
      onChange(resolveTime(item.hour12, item.ampm, curM));
    },
    [hourItems, curM, resolveTime, onChange]
  );

  const handleMinuteChange = useCallback(
    (idx: number) => {
      const minute = minuteItems[idx];
      if (minute === undefined) return;
      onChange(resolveTime(curH12, curAmPm, minute));
    },
    [minuteItems, curH12, curAmPm, resolveTime, onChange]
  );

  const handleAmPmChange = useCallback(
    (idx: number) => {
      const newAmPm = ampmItems[idx];
      if (!newAmPm) return;
      onChange(resolveTime(curH12, newAmPm, curM));
    },
    [ampmItems, curH12, curM, resolveTime, onChange]
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.wheelsRow}>
        <WheelColumn
          items={hourItems.map((i) => i.display)}
          selectedIndex={hourIndex}
          onSelect={handleHourChange}
          width={64}
        />
        <Text style={[styles.colon, { color: colors.foreground }]}>:</Text>
        <WheelColumn
          items={minuteItems.map((m) => String(m).padStart(2, "0"))}
          selectedIndex={minuteIndex}
          onSelect={handleMinuteChange}
          width={64}
        />
        <View style={{ width: 10 }} />
        <WheelColumn
          items={ampmItems}
          selectedIndex={ampmIndex}
          onSelect={handleAmPmChange}
          width={52}
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
  },
  wheelsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
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
  },
  selectionBar: {
    position: "absolute",
    left: 4,
    right: 4,
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
    height: ITEM_HEIGHT * 1.8,
    opacity: 0.72,
    zIndex: 2,
    // Gradient-like effect using multiple layers
  },
  fadeBottom: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: ITEM_HEIGHT * 1.8,
    opacity: 0.72,
    zIndex: 2,
  },
});
