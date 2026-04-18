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
import Svg, { Circle, G } from "react-native-svg";
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

// ─── Donut Chart for By Service ───────────────────────────────────────────────
function DonutChart({ data, size = 90 }: { data: ServiceBreakdownItem[]; size?: number }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return null;

  const radius = size / 2 - 8;
  const circumference = 2 * Math.PI * radius;
  const cx = size / 2;
  const cy = size / 2;
  const strokeWidth = 14;

  let offset = 0;
  const segments = data.map((item) => {
    const pct = item.value / total;
    const dash = pct * circumference;
    const gap = circumference - dash;
    const rotation = offset * 360 - 90;
    offset += pct;
    return { ...item, dash, gap, rotation };
  });

  return (
    <Svg width={size} height={size}>
      <G>
        {segments.map((seg, i) => (
          <Circle
            key={i}
            cx={cx}
            cy={cy}
            r={radius}
            fill="none"
            stroke={seg.color}
            strokeWidth={strokeWidth}
            strokeDasharray={`${seg.dash} ${seg.gap}`}
            strokeDashoffset={0}
            strokeLinecap="round"
            transform={`rotate(${seg.rotation} ${cx} ${cy})`}
            opacity={0.9}
          />
        ))}
      </G>
    </Svg>
  );
}

// ─── By Service Slide ─────────────────────────────────────────────────────────
function ServiceSlide({ data, width }: { data: ServiceBreakdownItem[]; width: number }) {
  const colors = useColors();
  const [expanded, setExpanded] = useState(false);
  const total = data.reduce((s, d) => s + d.value, 0);
  const displayData = expanded ? data : data.slice(0, 4);

  if (data.length === 0) {
    return (
      <View style={{ height: 120, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ fontSize: 13, color: colors.muted }}>No service data yet</Text>
      </View>
    );
  }

  return (
    <View>
      {/* Donut + legend row */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        {/* Donut chart */}
        <View style={{ alignItems: "center", justifyContent: "center" }}>
          <DonutChart data={data.slice(0, 5)} size={90} />
          {/* Center label */}
          <View style={{ position: "absolute", alignItems: "center" }}>
            <Text style={{ fontSize: 16, fontWeight: "800", color: colors.foreground }}>{total}</Text>
            <Text style={{ fontSize: 9, color: colors.muted, fontWeight: "600" }}>TOTAL</Text>
          </View>
        </View>

        {/* Legend */}
        <View style={{ flex: 1, gap: 6 }}>
          {displayData.map((item, i) => {
            const pct = total > 0 ? Math.round((item.value / total) * 100) : 0;
            return (
              <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: item.color, flexShrink: 0 }} />
                <Text style={{ fontSize: 12, color: colors.foreground, fontWeight: "600", flex: 1 }} numberOfLines={1}>
                  {item.label}
                </Text>
                <Text style={{ fontSize: 11, color: colors.muted, marginRight: 4 }}>{pct}%</Text>
                <Text style={{ fontSize: 12, fontWeight: "700", color: item.color }}>{item.value}</Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* View Data expand button */}
      {data.length > 4 && (
        <Pressable
          onPress={() => setExpanded((v) => !v)}
          style={({ pressed }) => ({
            marginTop: 10,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 4,
            paddingVertical: 7,
            borderRadius: 10,
            backgroundColor: colors.primary + "15",
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Text style={{ fontSize: 12, fontWeight: "700", color: colors.primary }}>
            {expanded ? "Show Less" : `View All ${data.length} Services`}
          </Text>
          <IconSymbol
            name={expanded ? "chevron.right" : "chevron.right"}
            size={12}
            color={colors.primary}
            style={{ transform: [{ rotate: expanded ? "-90deg" : "90deg" }] }}
          />
        </Pressable>
      )}

      {/* Expanded detail rows */}
      {expanded && (
        <View style={{ marginTop: 10, gap: 6 }}>
          {data.map((item, i) => {
            const pct = total > 0 ? Math.round((item.value / total) * 100) : 0;
            return (
              <View key={i} style={{ gap: 3 }}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flex: 1 }}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: item.color }} />
                    <Text style={{ fontSize: 12, color: colors.foreground, fontWeight: "600", flex: 1 }} numberOfLines={1}>
                      {item.label}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 12, fontWeight: "700", color: item.color }}>{item.value}</Text>
                </View>
                <View style={{ height: 4, borderRadius: 2, backgroundColor: colors.border, overflow: "hidden" }}>
                  <View style={{ height: 4, borderRadius: 2, backgroundColor: item.color, width: `${pct}%` as any, opacity: 0.8 }} />
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

// ─── Status Slide ─────────────────────────────────────────────────────────────
function StatusSlide({ statusCounts, total, onPressStatus }: {
  statusCounts: StatusCounts;
  total: number;
  onPressStatus?: (status: string) => void;
}) {
  const colors = useColors();

  const statuses = [
    { key: "completed", label: "Completed", value: statusCounts.completed, color: ACCENT, icon: "checkmark.circle.fill" as const },
    { key: "confirmed", label: "Confirmed", value: statusCounts.confirmed, color: colors.primary, icon: "paperplane.fill" as const },
    { key: "pending", label: "Pending", value: statusCounts.pending, color: "#FF9800", icon: "chevron.right" as const },
    { key: "cancelled", label: "Cancelled", value: statusCounts.cancelled, color: colors.error, icon: "xmark.circle.fill" as const },
  ];

  return (
    <View style={{ gap: 8 }}>
      {statuses.map((item) => {
        const pct = total > 0 ? item.value / total : 0;
        return (
          <Pressable
            key={item.key}
            onPress={() => onPressStatus?.(item.key)}
            style={({ pressed }) => ({
              opacity: pressed ? 0.75 : 1,
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              backgroundColor: item.color + "12",
              borderRadius: 10,
              padding: 10,
            })}
          >
            {/* Icon badge */}
            <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: item.color + "25", alignItems: "center", justifyContent: "center" }}>
              <IconSymbol name={item.icon} size={16} color={item.color} />
            </View>
            {/* Label + bar */}
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                <Text style={{ fontSize: 12, color: colors.foreground, fontWeight: "600" }}>{item.label}</Text>
                <Text style={{ fontSize: 14, fontWeight: "800", color: item.color }}>{item.value}</Text>
              </View>
              <View style={{ height: 4, borderRadius: 2, backgroundColor: colors.border, overflow: "hidden" }}>
                <View style={{ height: 4, borderRadius: 2, backgroundColor: item.color, width: `${Math.round(pct * 100)}%` as any }} />
              </View>
            </View>
            <IconSymbol name="chevron.right" size={12} color={colors.muted} />
          </Pressable>
        );
      })}
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

  // Slide-specific header config
  const slideConfig = [
    { title: "Payment Summary", icon: "dollarsign.circle.fill" as const, iconColor: ACCENT, action: onPressFullSummary, actionLabel: "Full Summary" },
    { title: "By Service", icon: "paperplane.fill" as const, iconColor: "#A78BFA", action: undefined, actionLabel: undefined },
    { title: "Status", icon: "checkmark.circle.fill" as const, iconColor: "#00C896", action: () => onPressStatus?.("all"), actionLabel: "View All" },
  ];
  const cfg = slideConfig[activeIdx];

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {/* Header row */}
      <View style={styles.headerRow}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: cfg.iconColor + "22", alignItems: "center", justifyContent: "center" }}>
            <IconSymbol name={cfg.icon} size={18} color={cfg.iconColor} />
          </View>
          <Text style={{ fontSize: 15, fontWeight: "700", color: colors.foreground }}>{cfg.title}</Text>
        </View>
        {cfg.action && cfg.actionLabel && (
          <Pressable
            onPress={cfg.action}
            style={({ pressed }) => ({
              opacity: pressed ? 0.7 : 1,
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
              backgroundColor: colors.primary + "15",
              borderRadius: 8,
              paddingHorizontal: 10,
              paddingVertical: 5,
            })}
          >
            <Text style={{ fontSize: 12, fontWeight: "700", color: colors.primary }}>{cfg.actionLabel}</Text>
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
          <ServiceSlide data={serviceBreakdown} width={width - 32} />
        </View>

        {/* Slide 3: Status */}
        <View style={{ width, paddingHorizontal: 16, paddingBottom: 12 }}>
          <StatusSlide
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
