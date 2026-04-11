/**
 * TapTimePicker
 *
 * A reliable, scroll-free time picker that works on iOS, Android, and Web.
 * Design: Three columns (Hour | Minute | AM/PM), each item is a tappable row.
 * The selected item is highlighted. User taps to select — no scrolling required.
 *
 * Props:
 *   value      — current time in "HH:MM" 24-hour format
 *   onChange   — called with new "HH:MM" 24-hour string on any tap
 *   stepMinutes — minute step (default 15)
 *   label      — optional label shown above the picker (e.g. "Start Time")
 */
import React, { useMemo } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import { useColors } from "@/hooks/use-colors";

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

// ─── Column ───────────────────────────────────────────────────────────────────

interface ColumnProps {
  items: string[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  width: number;
}

function PickerColumn({ items, selectedIndex, onSelect, width }: ColumnProps) {
  const colors = useColors();
  return (
    <ScrollView
      style={{ width, maxHeight: 280 }}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingVertical: 4 }}
    >
      {items.map((item, idx) => {
        const isSelected = idx === selectedIndex;
        return (
          <Pressable
            key={idx}
            onPress={() => onSelect(idx)}
            style={({ pressed }) => [
              styles.cell,
              { width },
              isSelected && { backgroundColor: colors.primary + "22", borderRadius: 10 },
              pressed && !isSelected && { opacity: 0.6 },
            ]}
          >
            <Text
              style={{
                fontSize: isSelected ? 22 : 18,
                fontWeight: isSelected ? "700" : "400",
                color: isSelected ? colors.primary : colors.foreground,
                textAlign: "center",
              }}
            >
              {item}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export interface TapTimePickerProps {
  /** Current value in HH:MM 24-hour format */
  value: string;
  /** Called with new value in HH:MM 24-hour format */
  onChange: (value: string) => void;
  /** Minute step, default 15 */
  stepMinutes?: number;
  /** Optional label above the picker */
  label?: string;
}

export function TapTimePicker({
  value,
  onChange,
  stepMinutes = 15,
  label,
}: TapTimePickerProps) {
  const colors = useColors();

  // Build hour list 1–12
  const hourItems = useMemo(
    () => Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0")),
    []
  );

  // Build minute list based on step
  const minuteItems = useMemo(() => {
    const items: string[] = [];
    for (let m = 0; m < 60; m += stepMinutes) {
      items.push(String(m).padStart(2, "0"));
    }
    return items;
  }, [stepMinutes]);

  const ampmItems: ("AM" | "PM")[] = ["AM", "PM"];

  // Parse current value
  const [curH24, curM] = value.split(":").map(Number);
  const { hour: curH12, ampm: curAmPm } = to12Hour(curH24 || 0);

  // Find selected indices
  const hourIndex = hourItems.indexOf(String(curH12).padStart(2, "0"));
  const minuteIndex = minuteItems.indexOf(String(curM || 0).padStart(2, "0"));
  const ampmIndex = ampmItems.indexOf(curAmPm);

  const handleHour = (idx: number) => {
    const h12 = parseInt(hourItems[idx]);
    const newH24 = to24Hour(h12, curAmPm);
    onChange(minutesToTime(newH24 * 60 + (curM || 0)));
  };

  const handleMinute = (idx: number) => {
    const min = parseInt(minuteItems[idx]);
    onChange(minutesToTime((curH24 || 0) * 60 + min));
  };

  const handleAmPm = (idx: number) => {
    const newAmPm = ampmItems[idx];
    const newH24 = to24Hour(curH12, newAmPm);
    onChange(minutesToTime(newH24 * 60 + (curM || 0)));
  };

  const COL_H = 64;
  const COL_M = 64;
  const COL_AP = 72;

  return (
    <View style={[styles.container, { borderColor: colors.border, backgroundColor: colors.surface }]}>
      {label ? (
        <Text style={{ fontSize: 12, fontWeight: "700", color: colors.muted, letterSpacing: 0.8, marginBottom: 8, textAlign: "center" }}>
          {label}
        </Text>
      ) : null}

      {/* Column headers */}
      <View style={[styles.row, { marginBottom: 4 }]}>
        <Text style={[styles.colHeader, { width: COL_H, color: colors.muted }]}>HR</Text>
        <Text style={[styles.colHeader, { width: 16, color: colors.muted }]}> </Text>
        <Text style={[styles.colHeader, { width: COL_M, color: colors.muted }]}>MIN</Text>
        <Text style={[styles.colHeader, { width: 12 }]}> </Text>
        <Text style={[styles.colHeader, { width: COL_AP, color: colors.muted }]}>AM/PM</Text>
      </View>

      {/* Divider */}
      <View style={{ height: 1, backgroundColor: colors.border, marginBottom: 4 }} />

      {/* Columns */}
      <View style={styles.row}>
        <PickerColumn
          items={hourItems}
          selectedIndex={Math.max(0, hourIndex)}
          onSelect={handleHour}
          width={COL_H}
        />
        <View style={{ width: 16, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontSize: 20, fontWeight: "700", color: colors.foreground }}>:</Text>
        </View>
        <PickerColumn
          items={minuteItems}
          selectedIndex={Math.max(0, minuteIndex)}
          onSelect={handleMinute}
          width={COL_M}
        />
        <View style={{ width: 12 }} />
        <PickerColumn
          items={ampmItems}
          selectedIndex={Math.max(0, ampmIndex)}
          onSelect={handleAmPm}
          width={COL_AP}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  colHeader: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
    textAlign: "center",
  },
  cell: {
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 1,
  },
});
