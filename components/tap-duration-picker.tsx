/**
 * TapDurationPicker
 *
 * A tap-based duration picker with two columns:
 *   - Hours: 0 – 12
 *   - Minutes: 00, 05, 10 … 55
 *
 * Props:
 *   value    – current duration in minutes (e.g. 90)
 *   onChange – called with new duration in minutes
 */

import React, { useCallback } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { useColors } from "@/hooks/use-colors";

// ─── Data ────────────────────────────────────────────────────────────────────

const HOURS = Array.from({ length: 13 }, (_, i) => i); // 0 – 12
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5); // 0, 5, 10 … 55

// ─── Helper ──────────────────────────────────────────────────────────────────

/** Convert total minutes → { hours, mins } */
function splitDuration(totalMinutes: number): { hours: number; mins: number } {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  // Round minutes to nearest 5
  const roundedM = Math.round(m / 5) * 5;
  return { hours: Math.min(h, 12), mins: roundedM >= 60 ? 55 : roundedM };
}

/** Convert { hours, mins } → total minutes */
function joinDuration(hours: number, mins: number): number {
  return hours * 60 + mins;
}

// ─── Column ──────────────────────────────────────────────────────────────────

interface ColumnProps {
  items: number[];
  selected: number;
  label: string;
  format: (v: number) => string;
  onSelect: (v: number) => void;
}

function PickerColumn({ items, selected, label, format, onSelect }: ColumnProps) {
  const colors = useColors();

  return (
    <View style={{ flex: 1, alignItems: "center" }}>
      {/* Column label */}
      <Text
        style={{
          fontSize: 11,
          fontWeight: "700",
          color: colors.muted,
          letterSpacing: 0.8,
          marginBottom: 8,
          textTransform: "uppercase",
        }}
      >
        {label}
      </Text>

      {/* Scrollable list of tappable items */}
      <ScrollView
        style={{ maxHeight: 220, width: "100%" }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingVertical: 4 }}
      >
        {items.map((v) => {
          const isSelected = v === selected;
          return (
            <Pressable
              key={v}
              onPress={() => onSelect(v)}
              style={({ pressed }) => ({
                paddingVertical: 10,
                paddingHorizontal: 12,
                marginVertical: 2,
                borderRadius: 10,
                alignItems: "center",
                backgroundColor: isSelected
                  ? colors.primary
                  : pressed
                  ? colors.primary + "18"
                  : "transparent",
              })}
            >
              <Text
                style={{
                  fontSize: isSelected ? 20 : 17,
                  fontWeight: isSelected ? "700" : "400",
                  color: isSelected ? "#fff" : colors.foreground,
                }}
              >
                {format(v)}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

interface TapDurationPickerProps {
  /** Current duration in minutes */
  value: number;
  /** Called with new duration in minutes whenever hours or minutes changes */
  onChange: (minutes: number) => void;
}

export function TapDurationPicker({ value, onChange }: TapDurationPickerProps) {
  const colors = useColors();
  const { hours, mins } = splitDuration(value);

  const handleHourSelect = useCallback(
    (h: number) => {
      const newTotal = joinDuration(h, mins);
      // Prevent 0h 0m
      onChange(newTotal === 0 ? 5 : newTotal);
    },
    [mins, onChange]
  );

  const handleMinuteSelect = useCallback(
    (m: number) => {
      const newTotal = joinDuration(hours, m);
      // Prevent 0h 0m
      onChange(newTotal === 0 ? 5 : newTotal);
    },
    [hours, onChange]
  );

  return (
    <View
      style={{
        flexDirection: "row",
        borderRadius: 14,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        padding: 12,
        gap: 8,
      }}
    >
      <PickerColumn
        items={HOURS}
        selected={hours}
        label="Hours"
        format={(v) => String(v)}
        onSelect={handleHourSelect}
      />

      {/* Divider */}
      <View style={{ width: 1, backgroundColor: colors.border, marginVertical: 28 }} />

      <PickerColumn
        items={MINUTES}
        selected={mins}
        label="Minutes"
        format={(v) => String(v).padStart(2, "0")}
        onSelect={handleMinuteSelect}
      />
    </View>
  );
}

/** Format total minutes as "1h 30m", "45m", "2h" etc. */
export function formatDuration(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}
