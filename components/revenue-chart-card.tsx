import React, { useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Dimensions,
  StyleSheet,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from "react-native";
import Svg, { Path, Line, Rect, Circle, Defs, LinearGradient as SvgGradient, Stop } from "react-native-svg";
import { useColors } from "@/hooks/use-colors";

const ACCENT = "#00C896";
const ACCENT_DIM = "#00C89618";
const PERIODS = ["Daily", "Weekly", "Monthly", "6 Months", "1 Year"] as const;
type Period = typeof PERIODS[number];

interface ChartPoint {
  label: string;
  value: number;
  apptCount: number;
}

interface RevenueChartCardProps {
  hourlyData: ChartPoint[];
  weeklyData: ChartPoint[];
  currentMonthData: ChartPoint[];
  sixMonthData: ChartPoint[];
  yearlyData: ChartPoint[];
  todayRevenue: number;
  weekRevenue: number;
  monthRevenue: number;
  sixMonthRevenue: number;
  yearRevenue: number;
  revenueChange: number;
  monthName: string;
  onPress?: (period: Period) => void;
  width: number;
}

// ─── Modern Area Line Chart ──────────────────────────────────────────────────
function AreaLineChart({
  data,
  width,
  height,
  color = ACCENT,
}: {
  data: ChartPoint[];
  width: number;
  height: number;
  color?: string;
}) {
  const colors = useColors();
  if (!data.length) return null;
  const max = Math.max(...data.map((d) => d.value), 1);
  const padL = 8;
  const padR = 8;
  const padT = 12;
  const padB = 28;
  const chartW = width - padL - padR;
  const chartH = height - padT - padB;

  const pts = data.map((d, i) => ({
    x: padL + (i / Math.max(data.length - 1, 1)) * chartW,
    y: padT + chartH - (d.value / max) * chartH,
    ...d,
  }));

  // Build smooth path using cubic bezier
  let linePath = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1];
    const curr = pts[i];
    const cpx = (prev.x + curr.x) / 2;
    linePath += ` C ${cpx} ${prev.y} ${cpx} ${curr.y} ${curr.x} ${curr.y}`;
  }

  // Area path (close to bottom)
  const areaPath =
    linePath +
    ` L ${pts[pts.length - 1].x} ${padT + chartH} L ${pts[0].x} ${padT + chartH} Z`;

  // Y-axis grid lines (3 lines)
  const gridLines = [0.25, 0.5, 0.75, 1].map((f) => ({
    y: padT + chartH - f * chartH,
    label: max * f >= 1000 ? `$${Math.round(max * f / 1000)}k` : `$${Math.round(max * f)}`,
  }));

  // Show every Nth label to avoid crowding
  const step = data.length <= 8 ? 1 : data.length <= 14 ? 2 : data.length <= 24 ? 3 : 4;

  return (
    <Svg width={width} height={height}>
      <Defs>
        <SvgGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={color} stopOpacity={0.28} />
          <Stop offset="1" stopColor={color} stopOpacity={0.0} />
        </SvgGradient>
      </Defs>
      {/* Grid lines */}
      {gridLines.map((g, i) => (
        <React.Fragment key={i}>
          <Line
            x1={padL}
            y1={g.y}
            x2={padL + chartW}
            y2={g.y}
            stroke={colors.border}
            strokeWidth={0.5}
            strokeDasharray="3,3"
          />
          <Text
            style={{
              position: "absolute",
              top: g.y - 8,
              left: 0,
              fontSize: 9,
              color: colors.muted,
            }}
          />
        </React.Fragment>
      ))}
      {/* Area fill */}
      <Path d={areaPath} fill="url(#areaGrad)" />
      {/* Line */}
      <Path d={linePath} stroke={color} strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      {/* Dots for small datasets */}
      {data.length <= 12 && pts.map((p, i) => (
        <Circle key={i} cx={p.x} cy={p.y} r={3} fill={color} />
      ))}
      {/* X-axis labels */}
      {pts.map((p, i) =>
        i % step === 0 ? (
          <React.Fragment key={i}>
            <Text
              style={{
                position: "absolute",
                top: padT + chartH + 6,
                left: p.x - 16,
                width: 32,
                textAlign: "center",
                fontSize: 9,
                color: colors.muted,
              }}
            />
          </React.Fragment>
        ) : null
      )}
    </Svg>
  );
}

// ─── Modern Bar Chart ────────────────────────────────────────────────────────
function ModernBarChart({
  data,
  width,
  height,
  color = ACCENT,
  showLabels = true,
}: {
  data: ChartPoint[];
  width: number;
  height: number;
  color?: string;
  showLabels?: boolean;
}) {
  const colors = useColors();
  if (!data.length) return null;
  const max = Math.max(...data.map((d) => d.value), 1);
  const padT = 12;
  const padB = showLabels ? 28 : 8;
  const padL = 4;
  const padR = 4;
  const chartH = height - padT - padB;
  const barW = Math.max(2, (width - padL - padR) / data.length - 3);
  const gap = (width - padL - padR - barW * data.length) / Math.max(data.length - 1, 1);
  const step = data.length <= 8 ? 1 : data.length <= 14 ? 2 : data.length <= 24 ? 4 : 6;

  return (
    <Svg width={width} height={height}>
      <Defs>
        <SvgGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={color} stopOpacity={1} />
          <Stop offset="1" stopColor={color} stopOpacity={0.5} />
        </SvgGradient>
      </Defs>
      {data.map((d, i) => {
        const barH = Math.max(d.value > 0 ? 2 : 0, (d.value / max) * chartH);
        const x = padL + i * (barW + gap);
        const y = padT + chartH - barH;
        const isActive = d.apptCount > 0 || d.value > 0;
        return (
          <React.Fragment key={i}>
            {/* Background bar */}
            <Rect
              x={x}
              y={padT}
              width={barW}
              height={chartH}
              rx={barW / 2}
              fill={colors.border}
              opacity={0.3}
            />
            {/* Value bar */}
            {barH > 0 && (
              <Rect
                x={x}
                y={y}
                width={barW}
                height={barH}
                rx={barW / 2}
                fill={isActive ? "url(#barGrad)" : colors.border}
                opacity={isActive ? 1 : 0.4}
              />
            )}
          </React.Fragment>
        );
      })}
    </Svg>
  );
}

// ─── Chart with labels overlay ───────────────────────────────────────────────
function ChartWithLabels({
  data,
  width,
  height,
  color = ACCENT,
  chartType = "bar",
}: {
  data: ChartPoint[];
  width: number;
  height: number;
  color?: string;
  chartType?: "bar" | "line";
}) {
  const colors = useColors();
  if (!data.length) return null;
  const max = Math.max(...data.map((d) => d.value), 1);
  const padT = 12;
  const padB = 28;
  const padL = 4;
  const padR = 4;
  const chartH = height - padT - padB;
  const step = data.length <= 8 ? 1 : data.length <= 14 ? 2 : data.length <= 24 ? 4 : 6;

  const getX = (i: number) => {
    if (chartType === "line") {
      return padL + (i / Math.max(data.length - 1, 1)) * (width - padL - padR);
    }
    const barW = Math.max(2, (width - padL - padR) / data.length - 3);
    const gap = (width - padL - padR - barW * data.length) / Math.max(data.length - 1, 1);
    return padL + i * (barW + gap) + barW / 2;
  };

  return (
    <View style={{ width, height }}>
      {chartType === "bar" ? (
        <ModernBarChart data={data} width={width} height={height} color={color} />
      ) : (
        <AreaLineChart data={data} width={width} height={height} color={color} />
      )}
      {/* X-axis labels overlay */}
      <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: padB, flexDirection: "row" }}>
        {data.map((d, i) =>
          i % step === 0 ? (
            <View
              key={i}
              style={{
                position: "absolute",
                left: getX(i) - 16,
                width: 32,
                alignItems: "center",
              }}
            >
              <Text style={{ fontSize: 9, color: colors.muted }}>{d.label}</Text>
            </View>
          ) : null
        )}
      </View>
    </View>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────
export function RevenueChartCard({
  hourlyData,
  weeklyData,
  currentMonthData,
  sixMonthData,
  yearlyData,
  todayRevenue,
  weekRevenue,
  monthRevenue,
  sixMonthRevenue,
  yearRevenue,
  revenueChange,
  monthName,
  onPress,
  width,
}: RevenueChartCardProps) {
  const colors = useColors();
  const [activePeriod, setActivePeriod] = useState<Period>("Weekly");
  const scrollRef = useRef<ScrollView>(null);
  const periodIndex = PERIODS.indexOf(activePeriod);

  const handleScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    const idx = Math.round(x / width);
    const p = PERIODS[Math.max(0, Math.min(idx, PERIODS.length - 1))];
    if (p !== activePeriod) setActivePeriod(p);
  }, [activePeriod, width]);

  const scrollTo = (idx: number) => {
    scrollRef.current?.scrollTo({ x: idx * width, animated: true });
    setActivePeriod(PERIODS[idx]);
  };

  const periodConfig: Record<Period, {
    title: string;
    subtitle: string;
    revenue: number;
    data: ChartPoint[];
    chartType: "bar" | "line";
    change?: number;
  }> = {
    "Daily": {
      title: "Today",
      subtitle: "Revenue by hour",
      revenue: todayRevenue,
      data: hourlyData,
      chartType: "bar",
    },
    "Weekly": {
      title: "This Week",
      subtitle: "Daily revenue · last 7 days",
      revenue: weekRevenue,
      data: weeklyData,
      chartType: "bar",
      change: revenueChange,
    },
    "Monthly": {
      title: monthName,
      subtitle: "Daily revenue this month",
      revenue: monthRevenue,
      data: currentMonthData,
      chartType: "bar",
    },
    "6 Months": {
      title: "Last 6 Months",
      subtitle: "Monthly revenue trend",
      revenue: sixMonthRevenue,
      data: sixMonthData,
      chartType: "line",
    },
    "1 Year": {
      title: "This Year",
      subtitle: "Monthly revenue · 12 months",
      revenue: yearRevenue,
      data: yearlyData,
      chartType: "line",
    },
  };

  const cfg = periodConfig[activePeriod];
  const chartH = 170;

  return (
    <Pressable
      onPress={() => onPress?.(activePeriod)}
      style={({ pressed }) => ({ opacity: pressed ? 0.92 : 1 })}
    >
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {/* Period selector tabs */}
        <View style={styles.tabRow}>
          {PERIODS.map((p, i) => {
            const active = p === activePeriod;
            return (
              <Pressable
                key={p}
                onPress={() => scrollTo(i)}
                style={({ pressed }) => [
                  styles.tab,
                  active && { backgroundColor: ACCENT },
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Text style={[styles.tabText, { color: active ? "#FFF" : colors.muted }]}>{p}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* Swipeable chart pages */}
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={handleScroll}
          scrollEventThrottle={16}
          contentOffset={{ x: periodIndex * width, y: 0 }}
          style={{ width }}
        >
          {PERIODS.map((p) => {
            const pcfg = periodConfig[p];
            return (
              <View key={p} style={{ width, paddingHorizontal: 16, paddingBottom: 16 }}>
                {/* Header */}
                <View style={styles.header}>
                  <View>
                    <Text style={[styles.title, { color: colors.foreground }]}>{pcfg.title}</Text>
                    <Text style={[styles.subtitle, { color: colors.muted }]}>{pcfg.subtitle}</Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={[styles.value, { color: colors.foreground }]}>
                      ${pcfg.revenue.toLocaleString()}
                    </Text>
                    {pcfg.change !== undefined && pcfg.change !== 0 && (
                      <View style={styles.changeRow}>
                        <Text style={[styles.changeText, { color: pcfg.change > 0 ? "#00C896" : colors.error }]}>
                          {pcfg.change > 0 ? "↑" : "↓"} {Math.abs(pcfg.change)}% vs last week
                        </Text>
                      </View>
                    )}
                  </View>
                </View>

                {/* Chart */}
                {pcfg.data.length > 0 ? (
                  <ChartWithLabels
                    data={pcfg.data}
                    width={width - 32}
                    height={chartH}
                    color={ACCENT}
                    chartType={pcfg.chartType}
                  />
                ) : (
                  <View style={{ height: chartH, alignItems: "center", justifyContent: "center" }}>
                    <Text style={{ color: colors.muted, fontSize: 13 }}>No data yet</Text>
                  </View>
                )}

                {/* Appt count row for bar charts */}
                {pcfg.chartType === "bar" && pcfg.data.length > 0 && (
                  <View style={styles.apptRow}>
                    {pcfg.data.map((d, i) => {
                      const step = pcfg.data.length <= 8 ? 1 : pcfg.data.length <= 14 ? 2 : pcfg.data.length <= 24 ? 4 : 6;
                      if (i % step !== 0) return null;
                      return (
                        <View key={i} style={styles.apptCell}>
                          {d.apptCount > 0 ? (
                            <View style={[styles.apptBadge, { backgroundColor: ACCENT_DIM }]}>
                              <Text style={[styles.apptBadgeText, { color: ACCENT }]}>{d.apptCount}</Text>
                            </View>
                          ) : (
                            <Text style={[styles.apptBadgeText, { color: colors.border }]}>–</Text>
                          )}
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>

        {/* Page dots */}
        <View style={styles.dots}>
          {PERIODS.map((p, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                { backgroundColor: p === activePeriod ? ACCENT : colors.border },
              ]}
            />
          ))}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
    marginTop: 16,
  },
  tabRow: {
    flexDirection: "row",
    paddingHorizontal: 12,
    paddingTop: 14,
    paddingBottom: 10,
    gap: 6,
  },
  tab: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: "center",
  },
  tabText: {
    fontSize: 11,
    fontWeight: "700",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
    marginTop: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
  },
  subtitle: {
    fontSize: 11,
    marginTop: 2,
  },
  value: {
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  changeRow: {
    marginTop: 2,
  },
  changeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  apptRow: {
    flexDirection: "row",
    marginTop: 6,
    flexWrap: "wrap",
  },
  apptCell: {
    flex: 1,
    alignItems: "center",
    minWidth: 24,
  },
  apptBadge: {
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 6,
    minWidth: 20,
    alignItems: "center",
  },
  apptBadgeText: {
    fontSize: 10,
    fontWeight: "700",
  },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 5,
    paddingBottom: 12,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
});
