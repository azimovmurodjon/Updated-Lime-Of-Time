/**
 * ScrollWheelTimePicker — v4
 *
 * Key fix over v3: live column indices are stored in refs (not state) so settle
 * handlers always read the latest value without stale-closure issues.
 * State is still used for rendering the highlight, but refs are used for emit.
 *
 * - FlatList + getItemLayout + scrollToIndex for reliable snap
 * - ITEM_HEIGHT=32, 5 visible items = 160px tall
 * - Compact columns: Hour(38) + Minute(38) + AM/PM(40) = 116px wide
 */
import React, {
  useRef,
  useEffect,
  useCallback,
  useMemo,
  useState,
} from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Platform,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ListRenderItemInfo,
} from "react-native";
import { useColors } from "@/hooks/use-colors";

// ─── Constants ────────────────────────────────────────────────────────────────

const ITEM_H = 32;
const VISIBLE = 5;
const PICKER_H = ITEM_H * VISIBLE; // 160px
const PAD = ITEM_H * Math.floor(VISIBLE / 2); // 64px

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function minutesToTime(totalMin: number): string {
  const h = Math.floor(totalMin / 60) % 24;
  const m = totalMin % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function to12Hour(hour24: number): { hour: number; ampm: "AM" | "PM" } {
  return {
    ampm: hour24 < 12 ? "AM" : "PM",
    hour: hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24,
  };
}

function to24Hour(hour12: number, ampm: "AM" | "PM"): number {
  if (ampm === "AM") return hour12 === 12 ? 0 : hour12;
  return hour12 === 12 ? 12 : hour12 + 12;
}

// ─── Single Wheel Column ──────────────────────────────────────────────────────

interface WheelColumnProps {
  items: string[];
  selectedIndex: number;           // for rendering highlight only
  onSettle: (index: number) => void;
  colWidth: number;
}

function WheelColumn({ items, selectedIndex, onSettle, colWidth }: WheelColumnProps) {
  const colors = useColors();
  const listRef = useRef<FlatList<string>>(null);
  const didMount = useRef(false);

  // Scroll to selectedIndex whenever it changes from outside
  useEffect(() => {
    const target = Math.max(0, Math.min(selectedIndex, items.length - 1));
    const delay = didMount.current ? 0 : 80;
    const timer = setTimeout(() => {
      listRef.current?.scrollToIndex({
        index: target,
        animated: didMount.current,
        viewPosition: 0.5,
      });
      didMount.current = true;
    }, delay);
    return () => clearTimeout(timer);
  }, [selectedIndex, items.length]);

  const getItemLayout = useCallback(
    (_: ArrayLike<string> | null | undefined, index: number) => ({
      length: ITEM_H,
      offset: ITEM_H * index,
      index,
    }),
    []
  );

  const handleScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = e.nativeEvent.contentOffset.y;
      const index = Math.max(0, Math.min(Math.round(y / ITEM_H), items.length - 1));
      // Snap precisely to grid
      listRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.5 });
      onSettle(index);
    },
    [items.length, onSettle]
  );

  const renderItem = useCallback(
    ({ item, index }: ListRenderItemInfo<string>) => {
      const distance = Math.abs(index - selectedIndex);
      const isSelected = distance === 0;
      return (
        <View style={[styles.item, { height: ITEM_H, width: colWidth }]}>
          <Text
            style={{
              fontSize: isSelected ? 17 : distance === 1 ? 14 : 13,
              fontWeight: isSelected ? "700" : "400",
              color: isSelected ? colors.primary : colors.foreground,
              opacity: distance === 0 ? 1 : distance === 1 ? 0.55 : distance === 2 ? 0.25 : 0.08,
            }}
            numberOfLines={1}
          >
            {item}
          </Text>
        </View>
      );
    },
    [selectedIndex, colWidth, colors]
  );

  const keyExtractor = useCallback((_: string, i: number) => String(i), []);

  return (
    <View style={{ width: colWidth, alignItems: "center" }}>
      <View style={{ width: colWidth, height: PICKER_H, overflow: "hidden" }}>
        {/* Selection highlight */}
        <View
          pointerEvents="none"
          style={[
            styles.selectionBar,
            {
              top: ITEM_H * Math.floor(VISIBLE / 2),
              borderColor: colors.primary + "55",
              backgroundColor: colors.primary + "15",
            },
          ]}
        />
        <FlatList
          ref={listRef}
          data={items}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          getItemLayout={getItemLayout}
          showsVerticalScrollIndicator={false}
          snapToInterval={ITEM_H}
          snapToAlignment="center"
          decelerationRate={Platform.OS === "ios" ? "fast" : 0.9}
          contentContainerStyle={{ paddingVertical: PAD }}
          onMomentumScrollEnd={handleScrollEnd}
          onScrollEndDrag={handleScrollEnd}
          scrollEventThrottle={16}
          bounces={false}
          overScrollMode="never"
          initialNumToRender={VISIBLE + 4}
          windowSize={5}
          removeClippedSubviews={false}
        />
        {/* Fades */}
        <View pointerEvents="none" style={[styles.fadeTop, { backgroundColor: colors.surface }]} />
        <View pointerEvents="none" style={[styles.fadeBottom, { backgroundColor: colors.surface }]} />
      </View>
    </View>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export interface ScrollWheelTimePickerProps {
  value: string;
  onChange: (value: string) => void;
  stepMinutes?: number;
  minTime?: string;
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

  // ── Build valid time slots ────────────────────────────────────────────────
  const timeSlots = useMemo(() => {
    const minMin = minTime ? timeToMinutes(minTime) : 0;
    const maxMin = maxTime ? timeToMinutes(maxTime) : 23 * 60 + 45;
    const slots: string[] = [];
    for (let m = minMin; m <= maxMin; m += stepMinutes) {
      slots.push(minutesToTime(m));
    }
    if (slots.length === 0) slots.push(minutesToTime(minMin));
    return slots;
  }, [minTime, maxTime, stepMinutes]);

  // ── Clamp value to nearest valid slot ────────────────────────────────────
  const clampedValue = useMemo(() => {
    const valMin = timeToMinutes(value);
    let closest = timeSlots[0];
    let closestDiff = Math.abs(timeToMinutes(timeSlots[0]) - valMin);
    for (const slot of timeSlots) {
      const diff = Math.abs(timeToMinutes(slot) - valMin);
      if (diff < closestDiff) { closest = slot; closestDiff = diff; }
    }
    return closest;
  }, [value, timeSlots]);

  // ── Parse clamped value ───────────────────────────────────────────────────
  const [curH24, curM] = clampedValue.split(":").map(Number);
  const { hour: curH12, ampm: curAmPm } = to12Hour(curH24);

  // ── Build column item lists ───────────────────────────────────────────────
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

  const minuteItems = useMemo(() => {
    const seen = new Set<number>();
    const items: number[] = [];
    for (const slot of timeSlots) {
      const m = parseInt(slot.split(":")[1]);
      if (!seen.has(m)) { seen.add(m); items.push(m); }
    }
    return items.sort((a, b) => a - b);
  }, [timeSlots]);

  const ampmItems = useMemo((): ("AM" | "PM")[] => {
    const has = { AM: false, PM: false };
    for (const slot of timeSlots) {
      const h24 = parseInt(slot.split(":")[0]);
      if (h24 < 12) has.AM = true; else has.PM = true;
    }
    const result: ("AM" | "PM")[] = [];
    if (has.AM) result.push("AM");
    if (has.PM) result.push("PM");
    return result;
  }, [timeSlots]);

  // ── Compute indices from clamped value ────────────────────────────────────
  const hourIndex = useMemo(() => Math.max(0, hourItems.findIndex((i) => i.h24 === curH24)), [hourItems, curH24]);
  const minuteIndex = useMemo(() => Math.max(0, minuteItems.indexOf(curM)), [minuteItems, curM]);
  const ampmIndex = useMemo(() => Math.max(0, ampmItems.indexOf(curAmPm)), [ampmItems, curAmPm]);

  // ── REFS for live indices (avoid stale closures in settle handlers) ───────
  const liveHourRef = useRef(hourIndex);
  const liveMinRef = useRef(minuteIndex);
  const liveAmPmRef = useRef(ampmIndex);

  // ── STATE for rendering highlights (drives WheelColumn re-render) ─────────
  const [renderHourIdx, setRenderHourIdx] = useState(hourIndex);
  const [renderMinIdx, setRenderMinIdx] = useState(minuteIndex);
  const [renderAmPmIdx, setRenderAmPmIdx] = useState(ampmIndex);

  // Sync both ref and state when external value changes
  useEffect(() => {
    liveHourRef.current = hourIndex;
    setRenderHourIdx(hourIndex);
  }, [hourIndex]);
  useEffect(() => {
    liveMinRef.current = minuteIndex;
    setRenderMinIdx(minuteIndex);
  }, [minuteIndex]);
  useEffect(() => {
    liveAmPmRef.current = ampmIndex;
    setRenderAmPmIdx(ampmIndex);
  }, [ampmIndex]);

  // ── Emit resolved value ───────────────────────────────────────────────────
  const emitValue = useCallback(
    (h24: number, minute: number) => {
      const minMin = minTime ? timeToMinutes(minTime) : 0;
      const maxMin = maxTime ? timeToMinutes(maxTime) : 23 * 60 + 59;
      const candMin = h24 * 60 + minute;
      const clamped = Math.max(minMin, Math.min(maxMin, candMin));
      onChange(minutesToTime(clamped));
    },
    [minTime, maxTime, onChange]
  );

  // ── Settle handlers — read from refs, not state ───────────────────────────
  const handleHourSettle = useCallback(
    (idx: number) => {
      liveHourRef.current = idx;
      setRenderHourIdx(idx);
      const item = hourItems[idx];
      if (!item) return;
      const minute = minuteItems[liveMinRef.current] ?? curM;
      emitValue(item.h24, minute);
    },
    [hourItems, minuteItems, curM, emitValue]
  );

  const handleMinuteSettle = useCallback(
    (idx: number) => {
      liveMinRef.current = idx;
      setRenderMinIdx(idx);
      const minute = minuteItems[idx];
      if (minute === undefined) return;
      const h24 = hourItems[liveHourRef.current]?.h24 ?? curH24;
      emitValue(h24, minute);
    },
    [minuteItems, hourItems, curH24, emitValue]
  );

  const handleAmPmSettle = useCallback(
    (idx: number) => {
      liveAmPmRef.current = idx;
      setRenderAmPmIdx(idx);
      const newAmPm = ampmItems[idx];
      if (!newAmPm) return;
      const h12 = to12Hour(hourItems[liveHourRef.current]?.h24 ?? curH24).hour;
      const newH24 = to24Hour(h12, newAmPm);
      const minute = minuteItems[liveMinRef.current] ?? curM;
      emitValue(newH24, minute);
    },
    [ampmItems, hourItems, minuteItems, curH24, curM, emitValue]
  );

  const COL_HOUR = 38;
  const COL_MIN = 38;
  const COL_AMPM = 40;

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.wheelsRow}>
        <WheelColumn
          items={hourItems.map((i) => i.display)}
          selectedIndex={renderHourIdx}
          onSettle={handleHourSettle}
          colWidth={COL_HOUR}
        />
        <Text style={[styles.colon, { color: colors.foreground }]}>:</Text>
        <WheelColumn
          items={minuteItems.map((m) => String(m).padStart(2, "0"))}
          selectedIndex={renderMinIdx}
          onSettle={handleMinuteSettle}
          colWidth={COL_MIN}
        />
        <View style={{ width: 8 }} />
        <WheelColumn
          items={ampmItems}
          selectedIndex={renderAmPmIdx}
          onSettle={handleAmPmSettle}
          colWidth={COL_AMPM}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
    paddingVertical: 2,
    paddingHorizontal: 2,
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
    fontSize: 16,
    fontWeight: "700",
    marginHorizontal: 1,
    minWidth: 8,
    textAlign: "center",
  },
  selectionBar: {
    position: "absolute",
    left: 2,
    right: 2,
    height: ITEM_H,
    borderRadius: 8,
    borderWidth: 1.5,
    zIndex: 1,
  },
  fadeTop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: ITEM_H * 1.5,
    opacity: 0.8,
    zIndex: 2,
  },
  fadeBottom: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: ITEM_H * 1.5,
    opacity: 0.8,
    zIndex: 2,
  },
});
