/**
 * ScrollDurationPicker
 *
 * A modal bottom-sheet duration picker with two scroll-wheel columns:
 *   - Hours  : 0 – 12
 *   - Minutes: 00, 05, 10 … 55
 *
 * The value is stored as total minutes (number).
 * Tapping the tappable row opens the sheet; Done confirms, Clear resets.
 *
 * Uses the same WheelColumn pattern as ScrollWheelTimePicker.
 */

import React, {
  useRef,
  useEffect,
  useCallback,
  useState,
} from "react";
import {
  View,
  Text,
  Pressable,
  Modal,
  FlatList,
  StyleSheet,
  Platform,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ListRenderItemInfo,
} from "react-native";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";

// ─── Constants ────────────────────────────────────────────────────────────────

const ITEM_H = 40;
const VISIBLE = 5;
const PICKER_H = ITEM_H * VISIBLE; // 200px
const PAD = ITEM_H * Math.floor(VISIBLE / 2); // 80px

// ─── Data ─────────────────────────────────────────────────────────────────────

const HOURS = Array.from({ length: 13 }, (_, i) => String(i));           // "0" – "12"
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, "0")); // "00","05"…"55"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function splitDuration(totalMinutes: number): { h: number; m: number } {
  const h = Math.min(Math.floor(totalMinutes / 60), 12);
  const m = Math.round((totalMinutes % 60) / 5) * 5;
  return { h, m: m >= 60 ? 55 : m };
}

export function formatDuration(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

// ─── WheelColumn ─────────────────────────────────────────────────────────────

interface WheelColumnProps {
  items: string[];
  selectedIndex: number;
  onSettle: (index: number) => void;
  colWidth: number;
  label: string;
}

function WheelColumn({ items, selectedIndex, onSettle, colWidth, label }: WheelColumnProps) {
  const colors = useColors();
  const listRef = useRef<FlatList<string>>(null);
  const didMount = useRef(false);

  // Scroll to selectedIndex whenever it changes from outside
  useEffect(() => {
    const target = Math.max(0, Math.min(selectedIndex, items.length - 1));
    const delay = didMount.current ? 0 : 100;
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
        <View style={{ height: ITEM_H, width: colWidth, alignItems: "center", justifyContent: "center" }}>
          <Text
            style={{
              fontSize: isSelected ? 22 : distance === 1 ? 17 : 14,
              fontWeight: isSelected ? "700" : "400",
              color: isSelected ? colors.primary : colors.foreground,
              opacity: distance === 0 ? 1 : distance === 1 ? 0.55 : distance === 2 ? 0.25 : 0.1,
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
    <View style={{ alignItems: "center" }}>
      {/* Column label */}
      <Text
        style={{
          fontSize: 11,
          fontWeight: "700",
          color: colors.muted,
          letterSpacing: 0.8,
          textTransform: "uppercase",
          marginBottom: 6,
        }}
      >
        {label}
      </Text>
      <View style={{ width: colWidth, height: PICKER_H, overflow: "hidden" }}>
        {/* Selection highlight bar */}
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
        {/* Top/bottom fade masks */}
        <View pointerEvents="none" style={[styles.fadeTop, { backgroundColor: colors.surface }]} />
        <View pointerEvents="none" style={[styles.fadeBottom, { backgroundColor: colors.surface }]} />
      </View>
    </View>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface ScrollDurationPickerProps {
  /** Current duration in total minutes */
  value: number;
  /** Called with new total minutes */
  onChange: (minutes: number) => void;
}

export function ScrollDurationPicker({ value, onChange }: ScrollDurationPickerProps) {
  const colors = useColors();
  const [modalVisible, setModalVisible] = useState(false);

  // Temp state inside the modal (confirmed on Done)
  const { h: initH, m: initM } = splitDuration(value);
  const [tempH, setTempH] = useState(initH);
  const [tempM, setTempM] = useState(initM);

  // Live refs to avoid stale closures in settle handlers
  const liveHRef = useRef(initH);
  const liveMRef = useRef(initM);

  // Sync temp state when modal opens
  const handleOpen = () => {
    const { h, m } = splitDuration(value);
    setTempH(h);
    setTempM(m);
    liveHRef.current = h;
    liveMRef.current = m;
    setModalVisible(true);
  };

  const handleHourSettle = useCallback((idx: number) => {
    liveHRef.current = idx;
    setTempH(idx);
  }, []);

  const handleMinuteSettle = useCallback((idx: number) => {
    const mins = idx * 5;
    liveMRef.current = mins;
    setTempM(mins);
  }, []);

  const handleDone = () => {
    const total = liveHRef.current * 60 + liveMRef.current;
    onChange(total === 0 ? 5 : total);
    setModalVisible(false);
  };

  const handleClear = () => {
    onChange(60); // reset to 1h default
    setModalVisible(false);
  };

  const hourIndex = tempH;
  const minuteIndex = Math.round(tempM / 5);

  return (
    <>
      {/* Tappable row */}
      <Pressable
        onPress={handleOpen}
        style={({ pressed }) => [
          styles.row,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            opacity: pressed ? 0.7 : 1,
          },
        ]}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <IconSymbol name="clock.fill" size={16} color={value ? colors.primary : colors.muted} />
          <Text style={{ fontSize: 15, color: value ? colors.foreground : colors.muted }}>
            {formatDuration(value)}
          </Text>
        </View>
        <IconSymbol name="chevron.right" size={14} color={colors.muted} />
      </Pressable>

      {/* Bottom-sheet modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <Pressable style={styles.overlay} onPress={() => setModalVisible(false)} />
        <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
          {/* Header */}
          <View style={[styles.sheetHeader, { borderBottomColor: colors.border }]}>
            <Pressable
              onPress={handleClear}
              style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
            >
              <Text style={{ fontSize: 16, color: colors.error }}>Reset</Text>
            </Pressable>
            <Text style={{ fontSize: 16, fontWeight: "600", color: colors.foreground }}>
              Duration
            </Text>
            <Pressable
              onPress={handleDone}
              style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
            >
              <Text style={{ fontSize: 16, fontWeight: "600", color: colors.primary }}>Done</Text>
            </Pressable>
          </View>

          {/* Wheel columns */}
          <View style={styles.wheelsRow}>
            <WheelColumn
              items={HOURS}
              selectedIndex={hourIndex}
              onSettle={handleHourSettle}
              colWidth={120}
              label="Hours"
            />
            {/* Colon separator */}
            <View style={{ justifyContent: "center", paddingBottom: 24 }}>
              <Text style={{ fontSize: 28, fontWeight: "700", color: colors.foreground, opacity: 0.4 }}>:</Text>
            </View>
            <WheelColumn
              items={MINUTES}
              selectedIndex={minuteIndex}
              onSettle={handleMinuteSettle}
              colWidth={120}
              label="Minutes"
            />
          </View>

          {/* Live preview */}
          <Text style={{ textAlign: "center", fontSize: 14, color: colors.muted, marginBottom: 24 }}>
            {formatDuration(tempH * 60 + tempM) || "Select duration"}
          </Text>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
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
  wheelsRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "flex-start",
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  selectionBar: {
    position: "absolute",
    left: 4,
    right: 4,
    height: ITEM_H,
    borderRadius: 10,
    borderWidth: 1,
    zIndex: 1,
  },
  fadeTop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: PAD,
    opacity: 0.85,
    zIndex: 2,
  },
  fadeBottom: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: PAD,
    opacity: 0.85,
    zIndex: 2,
  },
});
