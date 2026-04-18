import React, { useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from "react-native";
import Svg, { Path, Defs, LinearGradient as SvgGradient, Stop } from "react-native-svg";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";

const ACCENT = "#00C896";

const SLIDES = ["Payment", "By Service", "Status"] as const;
type Slide = typeof SLIDES[number];

export interface ServiceBreakdownItem {
  label: string;
  value: number;
  color: string;
}

export interface StatusCounts {
  completed: number;
  confirmed: number;
  pending: number;
  cancelled: number;
}

export interface MethodBreakdownEntry {
  label: string;
  count: number;
  revenue: number;
}

export interface PaymentSummaryCardProps {
  paidRevenue: number;
  unpaidRevenue: number;
  paidCount: number;
  unpaidCount: number;
  methodBreakdown: Record<string, MethodBreakdownEntry>;
  serviceBreakdown: ServiceBreakdownItem[];
  statusCounts: StatusCounts;
  totalAppointments: number;
  width: number;
  onPressPaid?: () => void;
  onPressUnpaid?: () => void;
  onPressFullSummary?: () => void;
  onPressStatus?: (status: string) => void;
}

// ─── Modern Horizontal Bar Chart for By Service ──────────────────────────────
function ServiceBarChart({ data, width }: { data: ServiceBreakdownItem[]; width: number }) {
  const colors = useColors();
  const maxVal = Math.max(...data.map((d) => d.value), 1);

  return (
    <View style={{ gap: 10, marginTop: 4 }}>
      {data.slice(0, 5).map((item, i) => {
        const pct = item.value / maxVal;
        return (
          <View key={i} style={{ gap: 4 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flex: 1 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: item.color }} />
                <Text style={{ fontSize: 12, color: colors.foreground, fontWeight: "600", flex: 1 }} numberOfLines={1}>
                  {item.label}
                </Text>
              </View>
              <Text style={{ fontSize: 12, fontWeight: "700", color: item.color, marginLeft: 8 }}>
                {item.value}
              </Text>
            </View>
            {/* Animated bar */}
            <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.border, overflow: "hidden" }}>
              <View
                style={{
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: item.color,
                  width: `${Math.round(pct * 100)}%` as any,
                  opacity: 0.85,
                }}
              />
            </View>
          </View>
        );
      })}
    </View>
  );
}

// ─── Status Ring Chart ────────────────────────────────────────────────────────
function StatusRingChart({ statusCounts, total, onPressStatus }: {
  statusCounts: StatusCounts;
  total: number;
  onPressStatus?: (status: string) => void;
}) {
  const colors = useColors();

  const statuses = [
    { key: "completed", label: "Completed", value: statusCounts.completed, color: ACCENT },
    { key: "confirmed", label: "Confirmed", value: statusCounts.confirmed, color: colors.primary },
    { key: "pending", label: "Pending", value: statusCounts.pending, color: "#FF9800" },
    { key: "cancelled", label: "Cancelled", value: statusCounts.cancelled, color: colors.error },
  ];

  return (
    <View style={{ gap: 8, marginTop: 4 }}>
      {statuses.map((item) => {
        const pct = total > 0 ? item.value / total : 0;
        return (
          <Pressable
            key={item.key}
            onPress={() => onPressStatus?.(item.key)}
            style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}
          >
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 3 }}>
              <Text style={{ fontSize: 12, color: colors.muted, fontWeight: "500" }}>{item.label}</Text>
              <Text style={{ fontSize: 13, fontWeight: "700", color: item.color }}>{item.value}</Text>
            </View>
            <View style={{ height: 5, borderRadius: 3, backgroundColor: colors.border, overflow: "hidden" }}>
              <View
                style={{
                  height: 5,
                  borderRadius: 3,
                  backgroundColor: item.color,
                  width: `${Math.round(pct * 100)}%` as any,
                }}
              />
            </View>
          </Pressable>
        );
      })}
      <Pressable
        onPress={() => onPressStatus?.("all")}
        style={({ pressed }) => ({
          marginTop: 6,
          alignItems: "center",
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <Text style={{ fontSize: 11, color: colors.primary, fontWeight: "600" }}>View All →</Text>
      </Pressable>
    </View>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────
export function PaymentSummaryCard({
  paidRevenue,
  unpaidRevenue,
  paidCount,
  unpaidCount,
  methodBreakdown,
  serviceBreakdown,
  statusCounts,
  totalAppointments,
  width,
  onPressPaid,
  onPressUnpaid,
  onPressFullSummary,
  onPressStatus,
}: PaymentSummaryCardProps) {
  const colors = useColors();
  const [activeIdx, setActiveIdx] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  const handleMomentumScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const x = e.nativeEvent.contentOffset.x;
      const idx = Math.round(x / width);
      const clamped = Math.max(0, Math.min(idx, SLIDES.length - 1));
      if (clamped !== activeIdx) setActiveIdx(clamped);
    },
    [activeIdx, width]
  );

  const totalRevenue = paidRevenue + unpaidRevenue;
  const collectedPct = totalRevenue > 0 ? Math.round((paidRevenue / totalRevenue) * 100) : 0;
  const totalAppts = totalAppointments + statusCounts.cancelled;

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {/* Header row */}
      <View style={styles.headerRow}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: ACCENT + "22", alignItems: "center", justifyContent: "center" }}>
            <IconSymbol name="dollarsign.circle.fill" size={18} color={ACCENT} />
          </View>
          <Text style={{ fontSize: 15, fontWeight: "700", color: colors.foreground }}>
            {SLIDES[activeIdx] === "Payment" ? "Payment Summary" : SLIDES[activeIdx] === "By Service" ? "By Service" : "Status"}
          </Text>
        </View>
        {SLIDES[activeIdx] === "Payment" && (
          <Pressable
            onPress={onPressFullSummary}
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1, flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.primary + "15", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 })}
          >
            <Text style={{ fontSize: 12, fontWeight: "700", color: colors.primary }}>Full Summary</Text>
            <IconSymbol name="chevron.right" size={12} color={colors.primary} />
          </Pressable>
        )}
        {SLIDES[activeIdx] === "Status" && (
          <Pressable
            onPress={() => onPressStatus?.("all")}
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1, flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.primary + "15", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 })}
          >
            <Text style={{ fontSize: 12, fontWeight: "700", color: colors.primary }}>View All</Text>
            <IconSymbol name="chevron.right" size={12} color={colors.primary} />
          </Pressable>
        )}
      </View>

      {/* Swipeable slides */}
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleMomentumScrollEnd}
        scrollEventThrottle={16}
        decelerationRate="fast"
        snapToInterval={width}
        snapToAlignment="start"
        style={{ width }}
      >
        {/* Slide 1: Payment */}
        <View style={{ width, paddingHorizontal: 16, paddingBottom: 12 }}>
          <View style={{ flexDirection: "row", gap: 12 }}>
            <Pressable
              onPress={onPressPaid}
              style={({ pressed }) => ({ flex: 1, backgroundColor: ACCENT + "18", borderRadius: 12, padding: 12, opacity: pressed ? 0.75 : 1 })}
            >
              <Text style={{ fontSize: 11, fontWeight: "600", color: ACCENT, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Paid</Text>
              <Text style={{ fontSize: 20, fontWeight: "800", color: ACCENT }}>${paidRevenue.toLocaleString()}</Text>
              <Text style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>{paidCount} appointment{paidCount !== 1 ? "s" : ""}</Text>
            </Pressable>
            <Pressable
              onPress={onPressUnpaid}
              style={({ pressed }) => ({ flex: 1, backgroundColor: colors.error + "15", borderRadius: 12, padding: 12, opacity: pressed ? 0.75 : 1 })}
            >
              <Text style={{ fontSize: 11, fontWeight: "600", color: colors.error, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Outstanding</Text>
              <Text style={{ fontSize: 20, fontWeight: "800", color: colors.error }}>${unpaidRevenue.toLocaleString()}</Text>
              <Text style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>{unpaidCount} appointment{unpaidCount !== 1 ? "s" : ""}</Text>
            </Pressable>
          </View>

          {/* Payment method breakdown */}
          {Object.keys(methodBreakdown).length > 0 && (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
              {Object.entries(methodBreakdown).map(([method, entry]) => (
                <View key={method} style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.border + "80", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 }}>
                  <Text style={{ fontSize: 12, color: colors.foreground, fontWeight: "600" }}>{entry.label}</Text>
                  <Text style={{ fontSize: 11, color: colors.muted }}>×{entry.count}</Text>
                  <Text style={{ fontSize: 11, color: ACCENT, fontWeight: "600" }}>${entry.revenue.toFixed(0)}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Progress bar */}
          {totalRevenue > 0 && (
            <View style={{ marginTop: 10 }}>
              <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.border, overflow: "hidden" }}>
                <View style={{ height: 6, borderRadius: 3, backgroundColor: ACCENT, width: `${collectedPct}%` as any }} />
              </View>
              <Text style={{ fontSize: 11, color: colors.muted, marginTop: 4 }}>{collectedPct}% collected</Text>
            </View>
          )}
        </View>

        {/* Slide 2: By Service */}
        <View style={{ width, paddingHorizontal: 16, paddingBottom: 12 }}>
          {serviceBreakdown.length > 0 ? (
            <ServiceBarChart data={serviceBreakdown} width={width - 32} />
          ) : (
            <View style={{ height: 120, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontSize: 13, color: colors.muted }}>No service data yet</Text>
            </View>
          )}
        </View>

        {/* Slide 3: Status */}
        <View style={{ width, paddingHorizontal: 16, paddingBottom: 12 }}>
          <StatusRingChart
            statusCounts={statusCounts}
            total={totalAppts}
            onPressStatus={onPressStatus}
          />
        </View>
      </ScrollView>

      {/* Page dots */}
      <View style={styles.footer}>
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                {
                  backgroundColor: i === activeIdx ? ACCENT : colors.border,
                  width: i === activeIdx ? 16 : 5,
                },
              ]}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
    marginTop: 12,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 12,
    paddingTop: 4,
  },
  dots: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  dot: {
    height: 5,
    borderRadius: 3,
  },
});
