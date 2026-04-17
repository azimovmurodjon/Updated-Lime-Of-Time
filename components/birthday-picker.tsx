/**
 * BirthdayPicker
 *
 * A cross-platform birthday input:
 * - iOS / Android: tapping the field opens a modal with a native DateTimePicker wheel.
 * - Web: falls back to a plain text input (MM/DD/YYYY) since the native picker
 *   isn't available in the browser.
 *
 * The value is stored as "MM/DD/YYYY" string (or "" when empty).
 */

import { useState } from "react";
import {
  View,
  Text,
  Pressable,
  Modal,
  Platform,
  TextInput,
  StyleSheet,
} from "react-native";
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";

// ─── helpers ──────────────────────────────────────────────────────────────────

/** Parse "MM/DD/YYYY" or "MM/DD" → Date (year defaults to 2000 if absent) */
function parseStoredDate(value: string): Date {
  if (!value) return new Date(2000, 0, 1);
  const parts = value.split("/");
  const month = parseInt(parts[0] ?? "1", 10) - 1;
  const day = parseInt(parts[1] ?? "1", 10);
  const year = parseInt(parts[2] ?? "2000", 10);
  const d = new Date(year, month, day);
  return isNaN(d.getTime()) ? new Date(2000, 0, 1) : d;
}

/** Format Date → "MM/DD/YYYY" */
function formatDate(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${mm}/${dd}/${yyyy}`;
}

/** Display string shown on the tappable row */
function displayValue(value: string): string {
  if (!value) return "";
  const d = parseStoredDate(value);
  if (isNaN(d.getTime())) return value;
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

// ─── component ────────────────────────────────────────────────────────────────

interface BirthdayPickerProps {
  value: string;           // "MM/DD/YYYY" or ""
  onChange: (v: string) => void;
  placeholder?: string;
  style?: object;
}

export function BirthdayPicker({
  value,
  onChange,
  placeholder = "Birthday (optional)",
  style,
}: BirthdayPickerProps) {
  const colors = useColors();
  const [modalVisible, setModalVisible] = useState(false);
  const [tempDate, setTempDate] = useState<Date>(parseStoredDate(value));

  // ── Web fallback ─────────────────────────────────────────────────────────
  if (Platform.OS === "web") {
    return (
      <TextInput
        style={[
          styles.input,
          { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground },
          style,
        ]}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        value={value}
        onChangeText={(t) => onChange(t.replace(/[^0-9/]/g, ""))}
        keyboardType="numbers-and-punctuation"
        returnKeyType="done"
        maxLength={10}
      />
    );
  }

  // ── Native (iOS / Android) ────────────────────────────────────────────────
  const handleOpen = () => {
    setTempDate(parseStoredDate(value));
    setModalVisible(true);
  };

  const handleChange = (_event: DateTimePickerEvent, date?: Date) => {
    if (date) setTempDate(date);
    // On Android the picker closes automatically on selection
    if (Platform.OS === "android") {
      setModalVisible(false);
      if (date) onChange(formatDate(date));
    }
  };

  const handleConfirm = () => {
    onChange(formatDate(tempDate));
    setModalVisible(false);
  };

  const handleClear = () => {
    onChange("");
    setModalVisible(false);
  };

  const maxDate = new Date(); // can't be born in the future

  return (
    <>
      {/* Tappable row */}
      <Pressable
        onPress={handleOpen}
        style={({ pressed }) => [
          styles.input,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            opacity: pressed ? 0.7 : 1,
          },
          style,
        ]}
      >
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Text
            style={{
              fontSize: 15,
              color: value ? colors.foreground : colors.muted,
            }}
          >
            {value ? displayValue(value) : placeholder}
          </Text>
        </View>
        {value ? (
          <Pressable
            onPress={(e) => { e.stopPropagation(); onChange(""); }}
            style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1, padding: 4 })}
            hitSlop={8}
          >
            <IconSymbol name="xmark.circle.fill" size={16} color={colors.muted} />
          </Pressable>
        ) : (
          <IconSymbol name="chevron.right" size={14} color={colors.muted} />
        )}
      </Pressable>

      {/* Modal with picker wheel (iOS) */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <Pressable
          style={styles.overlay}
          onPress={() => setModalVisible(false)}
        />
        <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
          {/* Sheet header */}
          <View style={[styles.sheetHeader, { borderBottomColor: colors.border }]}>
            <Pressable
              onPress={handleClear}
              style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
            >
              <Text style={{ fontSize: 16, color: colors.error }}>Clear</Text>
            </Pressable>
            <Text style={{ fontSize: 16, fontWeight: "600", color: colors.foreground }}>
              Expire Date
            </Text>
            <Pressable
              onPress={handleConfirm}
              style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
            >
              <Text style={{ fontSize: 16, fontWeight: "600", color: colors.primary }}>Done</Text>
            </Pressable>
          </View>

          {/* Date wheel — centered */}
          <View style={{ alignItems: "center", width: "100%" }}>
            <DateTimePicker
              value={tempDate}
              mode="date"
              display="spinner"
              maximumDate={maxDate}
              onChange={handleChange}
              style={{ width: "100%", alignSelf: "center" }}
              textColor={colors.foreground}
            />
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  input: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    borderWidth: 1,
    marginBottom: 10,
    minHeight: 46,
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 32,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 10,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
