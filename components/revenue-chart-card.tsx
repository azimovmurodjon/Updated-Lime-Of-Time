import React, { useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from "react-native";
import Svg, { Path, Line, Circle, Defs, LinearGradient as SvgGradient, Stop, Text as SvgText } from "react-native-svg";
import { useColors } from "@/hooks/use-colors";

const ACCENT = "#00C896";

const PERIODS = ["Daily", "Weekly", "Monthly", "3 Months", "6 Months", "1 Year"] as const;
type Period = typeof PERIODS[number];

interface ChartPoint {
  label: string;
  value: number;
  apptCount: number;
}

export interface RevenueChartCardProps {
  hourlyData: ChartPoint[];
  weeklyData: ChartPoint[];
  currentMonthData: ChartPoint[];
  threeMonthData: ChartPoint[];
  sixMonthData: ChartPoint[];
  yearlyData: ChartPoint[];
  todayRevenue: number;
  weekRevenue: number;
  monthRevenue: number;
  threeMonthRevenue: number;
  sixMonthRevenue: number;
  yearRevenue: number;
  revenueChange: number;
  monthName: string;
  onPress?: (period: Period) => void;
  width: number;
}

// ─── Unified Area Line Chart (used for ALL periods) ──────────────────────────
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
  if (!data || data.length === 0) return null;

  const padL = 44;
  const padR = 12;
  const padT = 12;
  const padB = 32;
  const chartW = width - padL - padR;
  const chartH = height - padT - padB;

  const maxVal = Math.max(...data.map((d) => d.value), 1);

  // Nice round max
  const mag = Math.pow(10, Math.floor(Math.log10(maxVal)));
  const n = maxVal / mag;
  const niceMax = (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * mag;

  const pts = data.map((d, i) => ({
    x: padL + (i / Math.max(data.length - 1, 1)) * chartW,
    y: padT + chartH - (d.value / niceMax) * chartH,
    ...d,
  }));

  // Smooth cubic bezier path
  let linePath = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1];
    const curr = pts[i];
    const cpx = (prev.x + curr.x) / 2;
    linePath += ` C ${cpx.toFixed(1)} ${prev.y.toFixed(1)} ${cpx.toFixed(1)} ${curr.y.toFixed(1)} ${curr.x.toFixed(1)} ${curr.y.toFixed(1)}`;
  }
  const areaPath =
    linePath +
    ` L ${pts[pts.length - 1].x.toFixed(1)} ${(padT + chartH).toFixed(1)} L ${pts[0].x.toFixed(1)} ${(padT + chartH).toFixed(1)} Z`;

  // Y-axis grid lines
  const gridCount = 4;
  const gridLines = Array.from({ length: gridCount }, (_, i) => {
    const f = (i + 1) / gridCount;
    const val = niceMax * f;
    return {
      y: padT + chartH - f * chartH,
      label: val >= 10000 ? `$${(val / 1000).toFixed(0)}k` : val >= 1000 ? `$${(val / 1000).toFixed(1)}k` : `$${Math.round(val)}`,
    };
  });

  // X-axis label step to avoid crowding
  const step = data.length <= 7 ? 1 : data.length <= 12 ? 2 : data.length <= 18 ? 3 : data.length <= 24 ? 4 : Math.ceil(data.length / 6);

  return (
    <View style={{ width, height }}>
      <Svg width={width} height={height}>
        <Defs>
          <SvgGradient id={`areaGrad_${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={color} stopOpacity={0.32} />
            <Stop offset="1" stopColor={color} stopOpacity={0.0} />
          </SvgGradient>
        </Defs>

        {/* Horizontal grid lines + Y labels */}
        {gridLines.map((g, i) => (
          <React.Fragment key={i}>
            <Line
              x1={padL}
              y1={g.y}
              x2={padL + chartW}
              y2={g.y}
              stroke={colors.border}
              strokeWidth={0.5}
              strokeDasharray="3,4"
            />
            <SvgText
              x={padL - 4}
              y={g.y + 4}
              textAnchor="end"
              fontSize={9}
              fill={colors.muted}
            >
              {g.label}
            </SvgText>
          </React.Fragment>
        ))}

        {/* Area fill */}
        <Path d={areaPath} fill={`url(#areaGrad_${color.replace("#", "")})`} />

        {/* Line */}
        <Path
          d={linePath}
          stroke={color}
          strokeWidth={2.5}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Dots (only for small datasets) */}
        {data.length <= 14 &&
          pts.map((p, i) => (
            <Circle key={i} cx={p.x} cy={p.y} r={3.5} fill={color} />
          ))}

        {/* X-axis labels */}
        {pts.map((p, i) =>
          i % step === 0 ? (
            <SvgText
              key={i}
              x={p.x}
              y={padT + chartH + padB - 4}
              textAnchor="middle"
              fontSize={9}
              fill={colors.muted}
            >
              {p.label}
            </SvgText>
          ) : null
        )}
      </Svg>
    </View>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────
export function RevenueChartCard({
  hourlyData,
  weeklyData,
  currentMonthData,
  threeMonthData,
  sixMonthData,
  yearlyData,
  todayRevenue,
  weekRevenue,
  monthRevenue,
  threeMonthRevenue,
  sixMonthRevenue,
  yearRevenue,
  revenueChange,
  monthName,
  onPress,
  width,
}: RevenueChartCardProps) {
  const colors = useColors();
  const [activePeriodIdx, setActivePeriodIdx] = useState(1); // default: Weekly
  const scrollRef = useRef<ScrollView>(null);

  const handleMomentumScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const x = e.nativeEvent.contentOffset.x;
      const idx = Math.round(x / width);
      const clamped = Math.max(0, Math.min(idx, PERIODS.length - 1));
      if (clamped !== activePeriodIdx) setActivePeriodIdx(clamped);
    },
    [activePeriodIdx, width]
  );

  const activePeriod = PERIODS[activePeriodIdx];

  const periodConfig: Record<Period, {
    title: string;
    subtitle: string;
    revenue: number;
    data: ChartPoint[];
    change?: number;
    changeLabel?: string;
  }> = {
    "Daily": {
      title: "Today",
      subtitle: "Revenue by hour",
      revenue: todayRevenue,
      data: hourlyData,
    },
    "Weekly": {
      title: "This Week",
      subtitle: "Daily revenue · last 7 days",
      revenue: weekRevenue,
      data: weeklyData,
      change: revenueChange,
      changeLabel: "vs last week",
    },
    "Monthly": {
      title: monthName,
      subtitle: "Daily revenue this month",
      revenue: monthRevenue,
      data: currentMonthData,
    },
    "3 Months": {
      title: "Last 3 Months",
      subtitle: "Monthly revenue trend",
      revenue: threeMonthRevenue,
      data: threeMonthData,
    },
    "6 Months": {
      title: "Last 6 Months",
      subtitle: "Monthly revenue trend",
      revenue: sixMonthRevenue,
      data: sixMonthData,
    },
    "1 Year": {
      title: "This Year",
      subtitle: "Monthly revenue · 12 months",
      revenue: yearRevenue,
      data: yearlyData,
    },
  };

  const chartH = 190;

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {/* Swipeable chart pages — NO tab buttons */}
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
        contentOffset={{ x: activePeriodIdx * width, y: 0 }}
        style={{ width }}
      >
        {PERIODS.map((p) => {
          const pcfg = periodConfig[p];
          return (
            <View key={p} style={{ width, paddingHorizontal: 16, paddingBottom: 8 }}>
              {/* Header */}
              <View style={styles.header}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.title, { color: colors.foreground }]}>{pcfg.title}</Text>
                  <Text style={[styles.subtitle, { color: colors.muted }]}>{pcfg.subtitle}</Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={[styles.value, { color: colors.foreground }]}>
                    ${(pcfg.revenue ?? 0).toLocaleString()}
                  </Text>
                  {pcfg.change !== undefined && pcfg.change !== 0 && (
                    <Text style={[styles.changeText, { color: pcfg.change > 0 ? ACCENT : colors.error }]}>
                      {pcfg.change > 0 ? "↑" : "↓"} {Math.abs(pcfg.change)}% {pcfg.changeLabel}
                    </Text>
                  )}
                </View>
              </View>

              {/* Unified area line chart for all periods */}
              {pcfg.data && pcfg.data.length > 0 ? (
                <AreaLineChart
                  data={pcfg.data}
                  width={width - 32}
                  height={chartH}
                  color={ACCENT}
                />
              ) : (
                <View style={{ height: chartH, alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ color: colors.muted, fontSize: 13 }}>No data yet</Text>
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>

      {/* Period label + page dots */}
      <View style={styles.footer}>
        <Text style={[styles.periodLabel, { color: colors.muted }]}>{activePeriod}</Text>
        <View style={styles.dots}>
          {PERIODS.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                {
                  backgroundColor: i === activePeriodIdx ? ACCENT : colors.border,
                  width: i === activePeriodIdx ? 16 : 5,
                },
              ]}
            />
          ))}
        </View>
        <View style={{ width: 40 }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
    marginTop: 16,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingTop: 16,
    paddingBottom: 10,
  },
  title: {
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 11,
    marginTop: 2,
  },
  value: {
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  changeText: {
    fontSize: 11,
    fontWeight: "700",
    marginTop: 2,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 14,
    paddingTop: 4,
  },
  periodLabel: {
    fontSize: 11,
    fontWeight: "600",
    width: 40,
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
