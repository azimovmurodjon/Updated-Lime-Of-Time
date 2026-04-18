/**
 * ChartDrillDownSheet
 * Bottom sheet that shows appointments for a specific chart data point
 * (day/hour/month) when the user taps a point on the revenue chart.
 */
import React, { useCallback, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  Modal,
  Animated,
  Dimensions,
} from "react-native";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";

const SCREEN_H = Dimensions.get("window").height;
const SHEET_H = SCREEN_H * 0.55;

export interface DrillDownAppointment {
  id: string;
  clientName: string;
  serviceName: string;
  time: string;
  date: string;
  amount: number;
  status: string;
}

export interface ChartDrillDownSheetProps {
  visible: boolean;
  onClose: () => void;
  label: string;
  subtitle: string;
  totalRevenue: number;
  appointments: DrillDownAppointment[];
  onPressAppointment?: (id: string) => void;
}

function formatTime(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${m.toString().padStart(2, "0")} ${period}`;
}

const STATUS_COLORS: Record<string, string> = {
  completed: "#00C896",
  confirmed: "#0a7ea4",
  pending: "#FF9800",
  cancelled: "#EF4444",
};

export function ChartDrillDownSheet({
  visible,
  onClose,
  label,
  subtitle,
  totalRevenue,
  appointments,
  onPressAppointment,
}: ChartDrillDownSheetProps) {
  const colors = useColors();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {/* Handle */}
        <View style={[styles.handle, { backgroundColor: colors.border }]} />

        {/* Header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 18, fontWeight: "800", color: colors.foreground }}>{label}</Text>
            <Text style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>{subtitle}</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={{ fontSize: 20, fontWeight: "800", color: "#00C896" }}>
              ${totalRevenue.toLocaleString()}
            </Text>
            <Text style={{ fontSize: 11, color: colors.muted }}>{appointments.length} appt{appointments.length !== 1 ? "s" : ""}</Text>
          </View>
          <Pressable
            onPress={onClose}
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, padding: 6, marginLeft: 8 })}
          >
            <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: colors.border, alignItems: "center", justifyContent: "center" }}>
              <IconSymbol name="xmark.circle.fill" size={18} color={colors.muted} />
            </View>
          </Pressable>
        </View>

        {/* List */}
        {appointments.length === 0 ? (
          <View style={styles.empty}>
            <Text style={{ fontSize: 14, color: colors.muted, textAlign: "center" }}>
              No appointments for this period
            </Text>
          </View>
        ) : (
          <FlatList
            data={appointments}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24, gap: 8 }}
            renderItem={({ item }) => {
              const statusColor = STATUS_COLORS[item.status] ?? colors.muted;
              return (
                <Pressable
                  onPress={() => onPressAppointment?.(item.id)}
                  style={({ pressed }) => [
                    styles.row,
                    { backgroundColor: colors.background, borderColor: colors.border, opacity: pressed ? 0.75 : 1 },
                  ]}
                >
                  <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                      <Text style={{ fontSize: 14, fontWeight: "700", color: colors.foreground }} numberOfLines={1}>
                        {item.clientName}
                      </Text>
                      <Text style={{ fontSize: 13, fontWeight: "700", color: statusColor }}>
                        ${item.amount.toLocaleString()}
                      </Text>
                    </View>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 2 }}>
                      <Text style={{ fontSize: 12, color: colors.muted }} numberOfLines={1}>
                        {item.serviceName} · {formatTime(item.time)}
                      </Text>
                      <View style={{ backgroundColor: statusColor + "20", borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 }}>
                        <Text style={{ fontSize: 10, fontWeight: "600", color: statusColor, textTransform: "capitalize" }}>
                          {item.status}
                        </Text>
                      </View>
                    </View>
                  </View>
                  <IconSymbol name="chevron.right" size={12} color={colors.muted} style={{ marginLeft: 8 }} />
                </Pressable>
              );
            }}
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: SHEET_H,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderBottomWidth: 0,
    overflow: "hidden",
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 4,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 40,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    gap: 10,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    flexShrink: 0,
  },
});
