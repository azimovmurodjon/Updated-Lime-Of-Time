import React, { useRef, useEffect, useCallback } from "react";
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

const ITEM_HEIGHT = 44;
const VISIBLE_ITEMS = 5;
const PICKER_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS;

interface ScrollWheelTimePickerProps {
  /** Current value in HH:MM 24-hour format (e.g. "14:30") */
  value: string;
  /** Called with new value in HH:MM 24-hour format */
  onChange: (value: string) => void;
  /** Step in minutes (default 15) */
  stepMinutes?: number;
  /** Minimum time in HH:MM 24-hour format */
  minTime?: string;
  /** Maximum time in HH:MM 24-hour format */
  maxTime?: string;
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function minutesToTime(m: number): string {
  const h = Math.floor(m / 60) % 24;
  const min = m % 60;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

function to12Hour(hour24: number): { hour: number; ampm: "AM" | "PM" } {
  const ampm = hour24 < 12 ? "AM" : "PM";
  const hour = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
  return { hour, ampm };
}

function to24Hour(hour12: number, ampm: "AM" | "PM"): number {
  if (ampm === "AM") {
    return hour12 === 12 ? 0 : hour12;
  } else {
    return hour12 === 12 ? 12 : hour12 + 12;
  }
}

interface WheelColumnProps {
  items: string[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  width: number;
}

function WheelColumn({ items, selectedIndex, onSelect, width }: WheelColumnProps) {
  const colors = useColors();
  const scrollRef = useRef<ScrollView>(null);
  const isScrolling = useRef(false);

  useEffect(() => {
    if (scrollRef.current && !isScrolling.current) {
      scrollRef.current.scrollTo({ y: selectedIndex * ITEM_HEIGHT, animated: false });
    }
  }, [selectedIndex]);

  const handleScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      isScrolling.current = false;
      const y = e.nativeEvent.contentOffset.y;
      const index = Math.round(y / ITEM_HEIGHT);
      const clamped = Math.max(0, Math.min(index, items.length - 1));
      onSelect(clamped);
      scrollRef.current?.scrollTo({ y: clamped * ITEM_HEIGHT, animated: true });
    },
    [items.length, onSelect]
  );

  return (
    <View style={{ width, height: PICKER_HEIGHT, overflow: "hidden" }}>
      {/* Selection highlight */}
      <View
        pointerEvents="none"
        style={[
          styles.selectionHighlight,
          {
            top: ITEM_HEIGHT * 2,
            borderColor: colors.primary + "40",
            backgroundColor: colors.primary + "12",
          },
        ]}
      />
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate={Platform.OS === "ios" ? "fast" : 0.9}
        contentContainerStyle={{ paddingVertical: ITEM_HEIGHT * 2 }}
        onScrollBeginDrag={() => { isScrolling.current = true; }}
        onMomentumScrollEnd={handleScrollEnd}
        onScrollEndDrag={handleScrollEnd}
        scrollEventThrottle={16}
      >
        {items.map((item, idx) => {
          const isSelected = idx === selectedIndex;
          return (
            <View key={idx} style={[styles.item, { height: ITEM_HEIGHT }]}>
              <Text
                style={{
                  fontSize: isSelected ? 20 : 16,
                  fontWeight: isSelected ? "700" : "400",
                  color: isSelected ? colors.primary : colors.muted,
                  opacity: Math.abs(idx - selectedIndex) > 2 ? 0.3 : 1,
                }}
              >
                {item}
              </Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

export function ScrollWheelTimePicker({
  value,
  onChange,
  stepMinutes = 15,
  minTime,
  maxTime,
}: ScrollWheelTimePickerProps) {
  const colors = useColors();

  // Parse current value
  const [h24, m] = value.split(":").map(Number);
  const { hour: h12, ampm } = to12Hour(h24);

  // Build hour items (1–12)
  const hourItems = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0"));
  // Build minute items based on step
  const minuteItems: string[] = [];
  for (let min = 0; min < 60; min += stepMinutes) {
    minuteItems.push(String(min).padStart(2, "0"));
  }
  const ampmItems = ["AM", "PM"];

  const hourIndex = h12 - 1; // 1-based → 0-based
  const minuteIndex = minuteItems.findIndex((item) => parseInt(item) === Math.round(m / stepMinutes) * stepMinutes % 60);
  const ampmIndex = ampm === "AM" ? 0 : 1;

  const handleHourChange = useCallback(
    (idx: number) => {
      const newHour12 = idx + 1;
      const newHour24 = to24Hour(newHour12, ampm);
      const newMin = minuteItems[minuteIndex] ? parseInt(minuteItems[minuteIndex]) : 0;
      let newTime = minutesToTime(newHour24 * 60 + newMin);
      if (minTime && timeToMinutes(newTime) < timeToMinutes(minTime)) newTime = minTime;
      if (maxTime && timeToMinutes(newTime) > timeToMinutes(maxTime)) newTime = maxTime;
      onChange(newTime);
    },
    [ampm, minuteIndex, minuteItems, minTime, maxTime, onChange]
  );

  const handleMinuteChange = useCallback(
    (idx: number) => {
      const newMin = parseInt(minuteItems[idx] ?? "0");
      const newHour24 = to24Hour(h12, ampm);
      let newTime = minutesToTime(newHour24 * 60 + newMin);
      if (minTime && timeToMinutes(newTime) < timeToMinutes(minTime)) newTime = minTime;
      if (maxTime && timeToMinutes(newTime) > timeToMinutes(maxTime)) newTime = maxTime;
      onChange(newTime);
    },
    [h12, ampm, minuteItems, minTime, maxTime, onChange]
  );

  const handleAmPmChange = useCallback(
    (idx: number) => {
      const newAmPm = idx === 0 ? "AM" : "PM";
      const newHour24 = to24Hour(h12, newAmPm);
      const newMin = minuteItems[minuteIndex] ? parseInt(minuteItems[minuteIndex]) : 0;
      let newTime = minutesToTime(newHour24 * 60 + newMin);
      if (minTime && timeToMinutes(newTime) < timeToMinutes(minTime)) newTime = minTime;
      if (maxTime && timeToMinutes(newTime) > timeToMinutes(maxTime)) newTime = maxTime;
      onChange(newTime);
    },
    [h12, minuteIndex, minuteItems, minTime, maxTime, onChange]
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {/* Gradient fade top */}
      <View pointerEvents="none" style={[styles.fadeTop, { backgroundColor: colors.surface }]} />

      <View style={styles.wheelsRow}>
        {/* Hour wheel */}
        <WheelColumn
          items={hourItems}
          selectedIndex={Math.max(0, hourIndex)}
          onSelect={handleHourChange}
          width={60}
        />
        <Text style={[styles.colon, { color: colors.foreground }]}>:</Text>
        {/* Minute wheel */}
        <WheelColumn
          items={minuteItems}
          selectedIndex={Math.max(0, minuteIndex)}
          onSelect={handleMinuteChange}
          width={60}
        />
        <View style={{ width: 12 }} />
        {/* AM/PM wheel */}
        <WheelColumn
          items={ampmItems}
          selectedIndex={ampmIndex}
          onSelect={handleAmPmChange}
          width={56}
        />
      </View>

      {/* Gradient fade bottom */}
      <View pointerEvents="none" style={[styles.fadeBottom, { backgroundColor: colors.surface }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
    position: "relative",
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
    fontSize: 22,
    fontWeight: "700",
    marginHorizontal: 4,
    marginBottom: 2,
  },
  selectionHighlight: {
    position: "absolute",
    left: 4,
    right: 4,
    height: ITEM_HEIGHT,
    borderRadius: 10,
    borderWidth: 1,
    zIndex: 1,
  },
  fadeTop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: ITEM_HEIGHT * 1.5,
    opacity: 0.7,
    zIndex: 2,
  },
  fadeBottom: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: ITEM_HEIGHT * 1.5,
    opacity: 0.7,
    zIndex: 2,
  },
});
