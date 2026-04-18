import React, { useMemo, useState } from "react";
import {
  Modal,
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  useWindowDimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, {
  Path,
  Defs,
  LinearGradient as SvgLinearGradient,
  Stop,
  Line,
  G,
  Text as SvgText,
  Rect,
  Circle,
} from "react-native-svg";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { PlanCompareModal } from "@/components/plan-compare-modal";
import { useRouter } from "expo-router";

// ─── Types ─────────────────────────────────────────────────────────────
export type KpiTab = "revenue" | "appointments" | "clients" | "topservice";
export type KpiDateRange = "week" | "month" | "all";
export type KpiSlideFilter =
  | "today" | "week" | "month" | "year" | "alltime"
  | "topclients" | "recentlyadded" | "birthdays"
  | "top3week" | "top5month"
  | null;

interface RevenueData {
  weekRevenue: number;
  prevWeekRevenue: number;
  totalRevenue: number;
  monthlyData: { label: string; value: number; color: string }[];
  weeklyDailyData: { label: string; value: number; color: string; apptCount: number }[];
  serviceBreakdown: { label: string; value: number; color: string }[];
}

interface AppointmentsData {
  totalAppointments: number;
  statusCounts: { pending: number; confirmed: number; completed: number; cancelled: number };
  weeklyDailyData: { label: string; value: number; color: string; apptCount: number }[];
  serviceBreakdown: { label: string; value: number; color: string }[];
}

interface ClientsData {
  totalClients: number;
  clientsData: { id: string; name: string; phone?: string; email?: string; apptCount: number; totalSpent: number }[];
}

interface TopServiceData {
  topService: { name: string; color: string } | undefined;
  topCount: number;
  serviceRanking: { id: string; name: string; color: string; bookings: number; price: number }[];
}

interface KpiDetailSheetProps {
  visible: boolean;
  tab: KpiTab | null;
  onClose: () => void;
  revenueData: RevenueData;
  appointmentsData: AppointmentsData;
  clientsData: ClientsData;
  topServiceData: TopServiceData;
  onExport?: (tab: KpiTab) => Promise<void>;
  isFreeplan?: boolean;
  onDateRangeChange?: (range: KpiDateRange) => void;
  slideFilter?: KpiSlideFilter;
  slideExtraData?: {
    label?: string;
    value?: string | number;
    sublabel?: string;
    clients?: { id: string; name: string; phone?: string; email?: string; apptCount: number; totalSpent: number; birthday?: string }[];
    services?: { id: string; name: string; color: string; bookings: number; price: number }[];
    appointmentCount?: number;
    appointments?: { id: string; clientName: string; serviceName: string; time: string; date: string; status: string; price: number }[];
    completedAppointments?: { id: string; clientName: string; serviceName: string; date: string; price: number }[];
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────
function fmt(v: number): string {
  if (v >= 10000) return `$${(v / 1000).toFixed(0)}k`;
  if (v >= 1000) return `$${(v / 1000).toFixed(1)}k`;
  return `$${v}`;
}

function niceMax(v: number): number {
  if (v <= 0) return 100;
  const mag = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / mag;
  const nice = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return nice * mag;
}

// ─── Mini Sparkline (line) ───────────────────────────────────────────────
function SparkLine({
  data,
  w,
  h,
  color,
}: {
  data: number[];
  w: number;
  h: number;
  color: string;
}) {
  if (data.length < 2) return null;
  const max = Math.max(...data, 1);
  const stepX = w / (data.length - 1);
  const pts = data.map((v, i) => ({
    x: i * stepX,
    y: h - (v / max) * h * 0.85 - h * 0.05,
  }));
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i - 1];
    const c = pts[i];
    const cpx1 = p.x + stepX * 0.4;
    const cpx2 = c.x - stepX * 0.4;
    d += ` C ${cpx1} ${p.y}, ${cpx2} ${c.y}, ${c.x} ${c.y}`;
  }
  const area =
    d +
    ` L ${pts[pts.length - 1].x} ${h} L ${pts[0].x} ${h} Z`;
  return (
    <Svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <Defs>
        <SvgLinearGradient id="spkGrad" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={color} stopOpacity="0.35" />
          <Stop offset="1" stopColor={color} stopOpacity="0.02" />
        </SvgLinearGradient>
      </Defs>
      <Path d={area} fill="url(#spkGrad)" />
      <Path d={d} stroke={color} strokeWidth={2} fill="none" strokeLinecap="round" />
      {pts.map((p, i) => (
        <Circle key={i} cx={p.x} cy={p.y} r={2.5} fill={color} />
      ))}
    </Svg>
  );
}

// ─── Full Line Chart ─────────────────────────────────────────────────────
function FullLineChart({
  data,
  w,
  h,
  color,
}: {
  data: { label: string; value: number }[];
  w: number;
  h: number;
  color: string;
}) {
  if (data.length < 2) return null;
  const leftPad = 44;
  const bottomPad = 28;
  const topPad = 16;
  const chartH = h - bottomPad - topPad;
  const rawMax = Math.max(...data.map((d) => d.value), 1);
  const gridMax = niceMax(rawMax);
  const usableW = w - leftPad - 14;
  const stepX = usableW / (data.length - 1);

  const pts = data.map((d, i) => ({
    x: leftPad + 7 + i * stepX,
    y: topPad + chartH - (d.value / gridMax) * chartH,
  }));

  let pathD = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i - 1];
    const c = pts[i];
    const cpx1 = p.x + stepX * 0.4;
    const cpx2 = c.x - stepX * 0.4;
    pathD += ` C ${cpx1} ${p.y}, ${cpx2} ${c.y}, ${c.x} ${c.y}`;
  }
  const areaD =
    pathD +
    ` L ${pts[pts.length - 1].x} ${topPad + chartH} L ${pts[0].x} ${topPad + chartH} Z`;

  return (
    <Svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <Defs>
        <SvgLinearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={color} stopOpacity="0.25" />
          <Stop offset="1" stopColor={color} stopOpacity="0.02" />
        </SvgLinearGradient>
      </Defs>
      {[0, 0.5, 1].map((pct) => {
        const y = topPad + chartH * (1 - pct);
        const val = Math.round(gridMax * pct);
        return (
          <G key={pct}>
            <Line x1={leftPad} y1={y} x2={w} y2={y} stroke="#33333320" strokeWidth={0.5} strokeDasharray="4,4" />
            <SvgText x={leftPad - 6} y={y + 4} fontSize={10} fill="#888" textAnchor="end">{fmt(val)}</SvgText>
          </G>
        );
      })}
      <Path d={areaD} fill="url(#lineGrad)" />
      <Path d={pathD} stroke={color} strokeWidth={2.5} fill="none" strokeLinecap="round" />
      {pts.map((p, i) => (
        <G key={i}>
          <Circle cx={p.x} cy={p.y} r={3.5} fill={color} />
          <Circle cx={p.x} cy={p.y} r={1.5} fill="#fff" />
        </G>
      ))}
      {data.map((d, i) => (
        <SvgText key={i} x={pts[i].x} y={h - 6} fontSize={10} fill="#888" textAnchor="middle">{d.label}</SvgText>
      ))}
    </Svg>
  );
}

// ─── Full Bar Chart ──────────────────────────────────────────────────────
function FullBarChart({
  data,
  w,
  h,
  formatValue,
}: {
  data: { label: string; value: number; color?: string }[];
  w: number;
  h: number;
  formatValue?: (v: number) => string;
}) {
  if (data.length === 0) return null;
  const leftPad = 44;
  const bottomPad = 28;
  const topPad = 24;
  const chartH = h - bottomPad - topPad;
  const rawMax = Math.max(...data.map((d) => d.value), 1);
  const gridMax = niceMax(rawMax);
  const usableW = w - leftPad - 8;
  const barW = Math.min(28, usableW / data.length - 6);
  const gap = (usableW - data.length * barW) / (data.length + 1);

  return (
    <Svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <Defs>
        {data.map((d, i) => (
          <SvgLinearGradient key={i} id={`bg${i}`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={d.color || "#4A7C59"} stopOpacity="1" />
            <Stop offset="1" stopColor={d.color || "#4A7C59"} stopOpacity="0.6" />
          </SvgLinearGradient>
        ))}
      </Defs>
      {[0, 0.5, 1].map((pct) => {
        const y = topPad + chartH * (1 - pct);
        const val = Math.round(gridMax * pct);
        const fmtFn = formatValue ?? fmt;
        return (
          <G key={pct}>
            <Line x1={leftPad} y1={y} x2={w} y2={y} stroke="#33333320" strokeWidth={0.5} strokeDasharray="4,4" />
            <SvgText x={leftPad - 6} y={y + 4} fontSize={10} fill="#888" textAnchor="end">{fmtFn(val)}</SvgText>
          </G>
        );
      })}
      {data.map((d, i) => {
        const barH = gridMax > 0 ? Math.max(2, (d.value / gridMax) * chartH) : 2;
        const x = leftPad + gap + i * (barW + gap);
        const y = topPad + chartH - barH;
        const fmtFn = formatValue ?? fmt;
        return (
          <G key={i}>
            <Rect x={x} y={y} width={barW} height={barH} rx={barW > 16 ? 5 : 3} fill={`url(#bg${i})`} />
            <SvgText x={x + barW / 2} y={h - 6} fontSize={10} fill="#888" textAnchor="middle">{d.label}</SvgText>
            {d.value > 0 && (
              <SvgText x={x + barW / 2} y={y - 5} fontSize={10} fill="#555" textAnchor="middle" fontWeight="700">{fmtFn(d.value)}</SvgText>
            )}
          </G>
        );
      })}
    </Svg>
  );
}

// ─── Horizontal Bar Row ──────────────────────────────────────────────────
function HBar({
  label,
  value,
  max,
  color,
  suffix,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
  suffix?: string;
}) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <View style={{ marginBottom: 10 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
        <Text style={{ fontSize: 13, fontWeight: "600", color: "#333", flex: 1 }} numberOfLines={1}>{label}</Text>
        <Text style={{ fontSize: 13, fontWeight: "700", color }}>{suffix ?? String(value)}</Text>
      </View>
      <View style={{ height: 8, borderRadius: 4, backgroundColor: color + "20", overflow: "hidden" }}>
        <View style={{ height: "100%", width: `${pct}%`, backgroundColor: color, borderRadius: 4 }} />
      </View>
    </View>
  );
}

// ─── Sheet Header ────────────────────────────────────────────────────────
function SheetHeader({
  title,
  subtitle,
  gradientColors,
  onClose,
}: {
  title: string;
  subtitle: string;
  gradientColors: [string, string];
  onClose: () => void;
}) {
  return (
    <LinearGradient
      colors={gradientColors}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ paddingTop: 20, paddingBottom: 24, paddingHorizontal: 20, borderTopLeftRadius: 24, borderTopRightRadius: 24 }}
    >
      {/* Handle */}
      <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.5)", alignSelf: "center", marginBottom: 16 }} />
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 22, fontWeight: "800", color: "#FFF", letterSpacing: -0.5 }}>{title}</Text>
          <Text style={{ fontSize: 13, color: "rgba(255,255,255,0.75)", marginTop: 3 }}>{subtitle}</Text>
        </View>
        <Pressable
          onPress={onClose}
          style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1, padding: 4 }]}
        >
          <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" }}>
            <IconSymbol name="xmark" size={16} color="#FFF" />
          </View>
        </Pressable>
      </View>
    </LinearGradient>
  );
}

// ─── Stat Pill Row ───────────────────────────────────────────────────────
function StatPills({ items }: { items: { label: string; value: string; color: string }[] }) {
  return (
    <View style={{ flexDirection: "row", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
      {items.map((item, i) => (
        <View key={i} style={{ flex: 1, minWidth: 80, backgroundColor: item.color + "12", borderRadius: 12, padding: 12, alignItems: "center", borderWidth: 1, borderColor: item.color + "25" }}>
          <Text style={{ fontSize: 18, fontWeight: "800", color: item.color }}>{item.value}</Text>
          <Text style={{ fontSize: 11, color: "#666", marginTop: 2, textAlign: "center" }}>{item.label}</Text>
        </View>
      ))}
    </View>
  );
}

// ─── Section Title ───────────────────────────────────────────────────────
function SectionLabel({ title }: { title: string }) {
  return (
    <Text style={{ fontSize: 15, fontWeight: "700", color: "#333", marginBottom: 12, marginTop: 4 }}>{title}</Text>
  );
}

// ─── Main Sheet ──────────────────────────────────────────────────────────
export function KpiDetailSheet({
  visible,
  tab,
  onClose,
  revenueData,
  appointmentsData,
  clientsData,
  topServiceData,
  onExport,
  isFreeplan,
  onDateRangeChange,
  slideFilter,
  slideExtraData,
}: KpiDetailSheetProps) {
  const [exporting, setExporting] = useState(false);
  const [showCompare, setShowCompare] = useState(false);
  const [dateRange, setDateRange] = useState<KpiDateRange>("week");
  const router = useRouter();

  const handleRangeChange = (range: KpiDateRange) => {
    setDateRange(range);
    onDateRangeChange?.(range);
  };

  const handleExport = async () => {
    if (!tab || !onExport || exporting) return;
    setExporting(true);
    try {
      await onExport(tab);
    } finally {
      setExporting(false);
    }
  };
  const { width, height } = useWindowDimensions();
  const colors = useColors();
  const isTablet = width >= 768;
  const sheetW = isTablet ? Math.min(width, 640) : width;
  const chartW = sheetW - 40;
  const maxH = height * 0.92;

  const revenueChange =
    revenueData.prevWeekRevenue > 0
      ? Math.round(((revenueData.weekRevenue - revenueData.prevWeekRevenue) / revenueData.prevWeekRevenue) * 100)
      : revenueData.weekRevenue > 0 ? 100 : 0;

  // Service revenue map from serviceBreakdown (bookings) + monthly data
  const serviceRevenueItems = useMemo(() => {
    return revenueData.serviceBreakdown.slice(0, 6).map((s) => ({
      label: s.label,
      value: s.value,
      color: s.color,
    }));
  }, [revenueData.serviceBreakdown]);

  const maxBookings = Math.max(...(topServiceData.serviceRanking.map((s) => s.bookings)), 1);

  const tabConfig: Record<KpiTab, { title: string; subtitle: string; gradient: [string, string] }> = {
    revenue: { title: "Revenue", subtitle: "Financial overview & trends", gradient: ["#E65100", "#FF9800"] },
    appointments: { title: "Appointments", subtitle: "Booking activity & status", gradient: ["#1565C0", "#2196F3"] },
    clients: { title: "Clients", subtitle: "Client rankings & activity", gradient: ["#2E7D32", "#4CAF50"] },
    topservice: { title: "Services", subtitle: "Performance by service", gradient: ["#6A1B9A", "#9C27B0"] },
  };

  const slideFilterTitles: Partial<Record<NonNullable<KpiSlideFilter>, { title: string; subtitle: string }>> = {
    today: { title: "Today's Revenue", subtitle: "Earnings so far today" },
    week: { title: "This Week", subtitle: "Revenue & appointments this week" },
    month: { title: "This Month", subtitle: "Revenue & appointments this month" },
    year: { title: "This Year", subtitle: "Annual performance" },
    alltime: { title: "All Time", subtitle: "Lifetime earnings" },
    topclients: { title: "Top Clients", subtitle: "Ranked by visits & spend" },
    recentlyadded: { title: "Recently Added", subtitle: "Newest clients" },
    birthdays: { title: "Birthdays Next Month", subtitle: "Clients with upcoming birthdays" },
    top3week: { title: "Top 3 This Week", subtitle: "Most booked services this week" },
    top5month: { title: "Top 5 This Month", subtitle: "Most booked services this month" },
  };

  if (!tab) return null;
  const cfg = tabConfig[tab];
  const slideTitle = slideFilter ? slideFilterTitles[slideFilter] : undefined;
  const displayTitle = slideTitle?.title ?? cfg.title;
  const displaySubtitle = slideTitle?.subtitle ?? cfg.subtitle;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable
        style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end", alignItems: "center" }}
        onPress={onClose}
      >
        <Pressable
          style={{
            width: sheetW,
            maxHeight: maxH,
            flex: 1,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            backgroundColor: colors.background,
            overflow: "hidden",
            shadowColor: "#000",
            shadowOffset: { width: 0, height: -4 },
            shadowOpacity: 0.15,
            shadowRadius: 20,
            elevation: 20,
          }}
          onPress={() => {}} // prevent dismiss on inner tap
        >
          <SheetHeader
            title={displayTitle}
            subtitle={displaySubtitle}
            gradientColors={cfg.gradient}
            onClose={onClose}
          />

          {/* ─── Date Range Filter ─────────────────────────────────── */}
          <View style={{ flexDirection: "row", gap: 8, paddingHorizontal: 20, paddingTop: 14, paddingBottom: 4 }}>
            {(["week", "month", "all"] as KpiDateRange[]).map((r) => {
              const labels: Record<KpiDateRange, string> = { week: "This Week", month: "This Month", all: "All Time" };
              const active = dateRange === r;
              return (
                <Pressable
                  key={r}
                  onPress={() => handleRangeChange(r)}
                  style={({ pressed }) => ({
                    flex: 1,
                    paddingVertical: 8,
                    borderRadius: 10,
                    alignItems: "center",
                    backgroundColor: active ? cfg.gradient[0] : colors.surface,
                    borderWidth: 1,
                    borderColor: active ? cfg.gradient[0] : colors.border,
                    opacity: pressed ? 0.75 : 1,
                  })}
                >
                  <Text style={{ fontSize: 12, fontWeight: active ? "700" : "500", color: active ? "#FFF" : colors.muted }}>
                    {labels[r]}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <ScrollView
            contentContainerStyle={{ padding: 20, paddingBottom: 48 }}
            showsVerticalScrollIndicator={false}
            style={{ flex: 1 }}
          >
            {/* ─── REVENUE ─────────────────────────────────────────── */}
            {tab === "revenue" && (() => {
              const isFiltered = slideFilter === "today" || slideFilter === "week" || slideFilter === "month" || slideFilter === "year" || slideFilter === "alltime";
              return (
                <View>
                  {/* Hero stat when opened from a specific slide */}
                  {isFiltered && slideExtraData && (
                    <View style={{ backgroundColor: "#E6510010", borderRadius: 16, padding: 20, marginBottom: 16, borderWidth: 1.5, borderColor: "#E65100" + "30", alignItems: "center" }}>
                      <Text style={{ fontSize: 13, fontWeight: "600", color: "#E65100", marginBottom: 6, letterSpacing: 0.5, textTransform: "uppercase" }}>
                        {slideExtraData.label ?? displayTitle}
                      </Text>
                      <Text style={{ fontSize: 36, fontWeight: "800", color: "#E65100", letterSpacing: -1 }}>
                        {typeof slideExtraData.value === "number" ? `$${slideExtraData.value.toLocaleString()}` : (slideExtraData.value ?? "—")}
                      </Text>
                      {slideExtraData.sublabel ? (
                        <Text style={{ fontSize: 12, color: "#888", marginTop: 4 }}>{slideExtraData.sublabel}</Text>
                      ) : null}
                    </View>
                  )}

                  {/* Filtered view: show completed appointments for the period */}
                  {isFiltered ? (
                    <>
                      <StatPills items={[
                        { label: "This Week", value: `$${revenueData.weekRevenue.toLocaleString()}`, color: "#E65100" },
                        { label: "Total Revenue", value: `$${revenueData.totalRevenue.toLocaleString()}`, color: "#FF9800" },
                        { label: "vs Last Week", value: `${revenueChange >= 0 ? "+" : ""}${revenueChange}%`, color: revenueChange >= 0 ? "#4CAF50" : "#EF4444" },
                      ]} />
                      <SectionLabel title="Completed Appointments" />
                      {(slideExtraData?.completedAppointments ?? []).length === 0 ? (
                        <Text style={{ color: "#888", fontSize: 13, textAlign: "center", paddingVertical: 20 }}>No completed appointments for this period</Text>
                      ) : (
                        (slideExtraData?.completedAppointments ?? []).map((a) => (
                          <Pressable
                            key={a.id}
                            onPress={() => { onClose(); setTimeout(() => router.push({ pathname: "/appointment-detail", params: { id: a.id } } as any), 300); }}
                            style={({ pressed }) => ({
                              flexDirection: "row",
                              alignItems: "center",
                              paddingVertical: 12,
                              paddingHorizontal: 14,
                              backgroundColor: colors.surface,
                              borderRadius: 12,
                              marginBottom: 8,
                              borderWidth: 1,
                              borderColor: colors.border,
                              opacity: pressed ? 0.75 : 1,
                            })}
                          >
                            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: "#E6510018", alignItems: "center", justifyContent: "center", marginRight: 12 }}>
                              <Text style={{ fontSize: 15, fontWeight: "700", color: "#E65100" }}>{a.clientName.charAt(0).toUpperCase()}</Text>
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={{ fontSize: 14, fontWeight: "600", color: colors.foreground }} numberOfLines={1}>{a.clientName}</Text>
                              <Text style={{ fontSize: 12, color: colors.muted }} numberOfLines={1}>{a.serviceName} · {a.date}</Text>
                            </View>
                            <View style={{ alignItems: "flex-end" }}>
                              <Text style={{ fontSize: 14, fontWeight: "700", color: "#E65100" }}>${a.price}</Text>
                              <IconSymbol name="chevron.right" size={14} color={colors.muted} />
                            </View>
                          </Pressable>
                        ))
                      )}
                    </>
                  ) : (
                    /* Full chart view when no filter */
                    <>
                      <StatPills items={[
                        { label: "This Week", value: `$${revenueData.weekRevenue.toLocaleString()}`, color: "#E65100" },
                        { label: "Total Revenue", value: `$${revenueData.totalRevenue.toLocaleString()}`, color: "#FF9800" },
                        { label: "vs Last Week", value: `${revenueChange >= 0 ? "+" : ""}${revenueChange}%`, color: revenueChange >= 0 ? "#4CAF50" : "#EF4444" },
                      ]} />

                      <SectionLabel title="Monthly Revenue (6 months)" />
                      <FullBarChart data={revenueData.monthlyData} w={chartW} h={200} />

                      <View style={{ height: 16 }} />
                      <SectionLabel title="Daily Revenue (this week)" />
                      <FullLineChart
                        data={revenueData.weeklyDailyData.map((d) => ({ label: d.label, value: d.value }))}
                        w={chartW}
                        h={180}
                        color="#E65100"
                      />

                      {serviceRevenueItems.length > 0 && (
                        <>
                          <View style={{ height: 16 }} />
                          <SectionLabel title="Bookings by Service" />
                          {serviceRevenueItems.map((s, i) => (
                            <HBar
                              key={i}
                              label={s.label}
                              value={s.value}
                              max={Math.max(...serviceRevenueItems.map((x) => x.value), 1)}
                              color={s.color || "#4A7C59"}
                              suffix={`${s.value} bookings`}
                            />
                          ))}
                        </>
                      )}
                    </>
                  )}
                </View>
              );
            })()}

            {/* ─── APPOINTMENTS ────────────────────────────────────── */}
            {tab === "appointments" && (() => {
              const isApptFiltered = slideFilter === "today" || slideFilter === "week" || slideFilter === "month" || slideFilter === "year";
              return (
                <View>
                  {/* Hero stat when opened from a specific slide */}
                  {isApptFiltered && slideExtraData && (
                    <View style={{ backgroundColor: "#1565C010", borderRadius: 16, padding: 20, marginBottom: 16, borderWidth: 1.5, borderColor: "#1565C030", alignItems: "center" }}>
                      <Text style={{ fontSize: 13, fontWeight: "600", color: "#1565C0", marginBottom: 6, letterSpacing: 0.5, textTransform: "uppercase" }}>
                        {slideExtraData.label ?? displayTitle}
                      </Text>
                      <Text style={{ fontSize: 36, fontWeight: "800", color: "#1565C0", letterSpacing: -1 }}>
                        {slideExtraData.appointmentCount ?? slideExtraData.value ?? "—"}
                      </Text>
                      {slideExtraData.sublabel ? (
                        <Text style={{ fontSize: 12, color: "#888", marginTop: 4 }}>{slideExtraData.sublabel}</Text>
                      ) : null}
                    </View>
                  )}

                  {isApptFiltered ? (
                    <>
                      <StatPills items={[
                        { label: "Total", value: String(appointmentsData.totalAppointments), color: "#1565C0" },
                        { label: "Completed", value: String(appointmentsData.statusCounts.completed), color: "#4CAF50" },
                        { label: "Pending", value: String(appointmentsData.statusCounts.pending), color: "#FF9800" },
                      ]} />
                      <SectionLabel title="Appointments" />
                      {(slideExtraData?.appointments ?? []).length === 0 ? (
                        <Text style={{ color: "#888", fontSize: 13, textAlign: "center", paddingVertical: 20 }}>No appointments for this period</Text>
                      ) : (
                        (slideExtraData?.appointments ?? []).map((a) => (
                          <Pressable
                            key={a.id}
                            onPress={() => { onClose(); setTimeout(() => router.push({ pathname: "/appointment-detail", params: { id: a.id } } as any), 300); }}
                            style={({ pressed }) => ({
                              flexDirection: "row",
                              alignItems: "center",
                              paddingVertical: 12,
                              paddingHorizontal: 14,
                              backgroundColor: colors.surface,
                              borderRadius: 12,
                              marginBottom: 8,
                              borderWidth: 1,
                              borderColor: colors.border,
                              opacity: pressed ? 0.75 : 1,
                            })}
                          >
                            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: "#1565C018", alignItems: "center", justifyContent: "center", marginRight: 12 }}>
                              <Text style={{ fontSize: 15, fontWeight: "700", color: "#1565C0" }}>{a.clientName.charAt(0).toUpperCase()}</Text>
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={{ fontSize: 14, fontWeight: "600", color: colors.foreground }} numberOfLines={1}>{a.clientName}</Text>
                              <Text style={{ fontSize: 12, color: colors.muted }} numberOfLines={1}>{a.serviceName} · {a.time}</Text>
                            </View>
                            <View style={{ alignItems: "flex-end" }}>
                              <View style={{ backgroundColor: a.status === "completed" ? "#4CAF5015" : a.status === "confirmed" ? "#2196F315" : "#FF980015", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 }}>
                                <Text style={{ fontSize: 11, fontWeight: "700", color: a.status === "completed" ? "#4CAF50" : a.status === "confirmed" ? "#2196F3" : "#FF9800", textTransform: "capitalize" }}>{a.status}</Text>
                              </View>
                              <IconSymbol name="chevron.right" size={14} color={colors.muted} />
                            </View>
                          </Pressable>
                        ))
                      )}
                    </>
                  ) : (
                    <>
                      <StatPills items={[
                        { label: "Total", value: String(appointmentsData.totalAppointments), color: "#1565C0" },
                        { label: "Completed", value: String(appointmentsData.statusCounts.completed), color: "#4CAF50" },
                        { label: "Pending", value: String(appointmentsData.statusCounts.pending), color: "#FF9800" },
                        { label: "Cancelled", value: String(appointmentsData.statusCounts.cancelled), color: "#EF4444" },
                      ]} />

                      <SectionLabel title="Daily Appointments (this week)" />
                      <FullBarChart
                        data={appointmentsData.weeklyDailyData.map((d) => ({ label: d.label, value: d.apptCount, color: d.color }))}
                        w={chartW}
                        h={180}
                        formatValue={(v) => String(v)}
                      />

                      <View style={{ height: 16 }} />
                      <SectionLabel title="Status Breakdown" />
                      {[
                        { label: "Completed", value: appointmentsData.statusCounts.completed, color: "#4CAF50" },
                        { label: "Confirmed", value: appointmentsData.statusCounts.confirmed, color: "#2196F3" },
                        { label: "Pending", value: appointmentsData.statusCounts.pending, color: "#FF9800" },
                        { label: "Cancelled", value: appointmentsData.statusCounts.cancelled, color: "#EF4444" },
                      ].map((item, i) => (
                        <HBar
                          key={i}
                          label={item.label}
                          value={item.value}
                          max={Math.max(appointmentsData.totalAppointments + appointmentsData.statusCounts.cancelled, 1)}
                          color={item.color}
                          suffix={String(item.value)}
                        />
                      ))}

                      {appointmentsData.serviceBreakdown.length > 0 && (
                        <>
                          <View style={{ height: 8 }} />
                          <SectionLabel title="By Service" />
                          {appointmentsData.serviceBreakdown.slice(0, 6).map((s, i) => (
                            <HBar
                              key={i}
                              label={s.label}
                              value={s.value}
                              max={Math.max(...appointmentsData.serviceBreakdown.map((x) => x.value), 1)}
                              color={s.color || "#2196F3"}
                              suffix={`${s.value} bookings`}
                            />
                          ))}
                        </>
                      )}
                    </>
                  )}
                </View>
              );
            })()}

            {/* ─── CLIENTS ────────────────────────────────────────── */}
            {tab === "clients" && (() => {
              // Determine which client list to show
              const filteredClients: { id: string; name: string; phone?: string; email?: string; apptCount: number; totalSpent: number; birthday?: string }[] =
                (slideFilter === "topclients" || slideFilter === "recentlyadded" || slideFilter === "birthdays")
                ? (slideExtraData?.clients ?? [])
                : clientsData.clientsData.slice(0, 10).map((c) => ({ ...c, birthday: undefined }));
              const isBirthday = slideFilter === "birthdays";
              const isRecent = slideFilter === "recentlyadded";
              const isTop = slideFilter === "topclients";
              const sectionTitle = isBirthday ? "Birthdays Next Month" : isRecent ? "Recently Added Clients" : "Top Clients by Visits";
              return (
                <View>
                  <StatPills items={[
                    { label: "Total Clients", value: String(clientsData.totalClients), color: "#2E7D32" },
                    { label: "Active", value: String(clientsData.clientsData.filter((c) => c.apptCount > 0).length), color: "#4CAF50" },
                    { label: "Total Spent", value: `$${clientsData.clientsData.reduce((s, c) => s + c.totalSpent, 0).toLocaleString()}`, color: "#FF9800" },
                  ]} />

                  <SectionLabel title={sectionTitle} />
                  {filteredClients.length === 0 ? (
                    <Text style={{ color: "#888", fontSize: 13, textAlign: "center", paddingVertical: 20 }}>No client data yet</Text>
                  ) : (
                    filteredClients.map((c, i) => (
                      <Pressable
                        key={c.id}
                        onPress={() => { onClose(); setTimeout(() => router.push({ pathname: "/client-detail", params: { id: c.id } } as any), 300); }}
                        style={({ pressed }) => ({
                          flexDirection: "row",
                          alignItems: "center",
                          paddingVertical: 12,
                          paddingHorizontal: 14,
                          backgroundColor: colors.surface,
                          borderRadius: 12,
                          marginBottom: 8,
                          borderWidth: 1,
                          borderColor: colors.border,
                          opacity: pressed ? 0.75 : 1,
                        })}
                      >
                        {(isTop) && (
                          <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: i < 3 ? "#FF980018" : "#E0E0E020", alignItems: "center", justifyContent: "center", marginRight: 8 }}>
                            <Text style={{ fontSize: 12, fontWeight: "800", color: i === 0 ? "#FF9800" : i === 1 ? "#9E9E9E" : i === 2 ? "#795548" : "#999" }}>#{i + 1}</Text>
                          </View>
                        )}
                        <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: isBirthday ? "#E91E6318" : "#4CAF5018", alignItems: "center", justifyContent: "center", marginRight: 12 }}>
                          <Text style={{ fontSize: 14, fontWeight: "700", color: isBirthday ? "#E91E63" : "#4CAF50" }}>{c.name.charAt(0).toUpperCase()}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 14, fontWeight: "600", color: colors.foreground }} numberOfLines={1}>{c.name}</Text>
                          {isBirthday && c.birthday ? (
                            <Text style={{ fontSize: 11, color: "#E91E63", fontWeight: "600" }} numberOfLines={1}>🎂 {c.birthday}</Text>
                          ) : (
                            <Text style={{ fontSize: 11, color: colors.muted }} numberOfLines={1}>{c.phone || c.email || "No contact"}</Text>
                          )}
                        </View>
                        <View style={{ alignItems: "flex-end" }}>
                          {!isBirthday && (
                            <View style={{ backgroundColor: "#4CAF5015", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 }}>
                              <Text style={{ fontSize: 12, fontWeight: "700", color: "#4CAF50" }}>{c.apptCount} visits</Text>
                            </View>
                          )}
                          {c.totalSpent > 0 && !isBirthday && (
                            <Text style={{ fontSize: 11, color: "#FF9800", fontWeight: "600", marginTop: 3 }}>${c.totalSpent}</Text>
                          )}
                          <IconSymbol name="chevron.right" size={14} color={colors.muted} style={{ marginTop: 2 }} />
                        </View>
                      </Pressable>
                    ))
                  )}
                </View>
              );
            })()}

            {/* ─── TOP SERVICE ─────────────────────────────────────── */}
            {tab === "topservice" && (() => {
              const isFiltered = slideFilter === "top3week" || slideFilter === "top5month";
              const serviceList = isFiltered
                ? (slideExtraData?.services ?? [])
                : topServiceData.serviceRanking;
              const localMax = Math.max(...serviceList.map((s) => s.bookings), 1);
              const sectionTitle = slideFilter === "top3week" ? "Top 3 Services This Week" : slideFilter === "top5month" ? "Top 5 Services This Month" : "Service Rankings";
              return (
                <View>
                  <StatPills items={[
                    { label: "Services", value: String(topServiceData.serviceRanking.length), color: "#6A1B9A" },
                    { label: "Top Bookings", value: String(topServiceData.topCount), color: "#9C27B0" },
                    { label: "Top Service", value: topServiceData.topService?.name?.split(" ")[0] ?? "N/A", color: "#E91E63" },
                  ]} />

                  <SectionLabel title={sectionTitle} />
                  {serviceList.length === 0 ? (
                    <Text style={{ color: "#888", fontSize: 13, textAlign: "center", paddingVertical: 20 }}>No booking data yet</Text>
                  ) : (
                    serviceList.map((s, i) => (
                      <View
                        key={s.id}
                        style={{
                          paddingVertical: 12,
                          paddingHorizontal: 14,
                          backgroundColor: colors.surface,
                          borderRadius: 12,
                          marginBottom: 8,
                          borderWidth: 1,
                          borderColor: colors.border,
                        }}
                      >
                        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
                            {isFiltered && (
                              <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: i < 3 ? (s.color || "#9C27B0") + "20" : "#E0E0E020", alignItems: "center", justifyContent: "center" }}>
                                <Text style={{ fontSize: 11, fontWeight: "800", color: i === 0 ? (s.color || "#9C27B0") : i === 1 ? "#9E9E9E" : i === 2 ? "#795548" : "#999" }}>#{i + 1}</Text>
                              </View>
                            )}
                            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: s.color || "#9C27B0" }} />
                            <Text style={{ fontSize: 14, fontWeight: "600", color: colors.foreground, flex: 1 }} numberOfLines={1}>{s.name}</Text>
                          </View>
                          <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
                            <Text style={{ fontSize: 12, color: colors.muted }}>${s.price}</Text>
                            <View style={{ backgroundColor: (s.color || "#9C27B0") + "15", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 }}>
                              <Text style={{ fontSize: 12, fontWeight: "700", color: s.color || "#9C27B0" }}>{s.bookings} bookings</Text>
                            </View>
                          </View>
                        </View>
                        <View style={{ height: 7, borderRadius: 4, backgroundColor: (s.color || "#9C27B0") + "20", overflow: "hidden" }}>
                          <View style={{ height: "100%", width: `${(s.bookings / localMax) * 100}%`, backgroundColor: s.color || "#9C27B0", borderRadius: 4 }} />
                        </View>
                      </View>
                    ))
                  )}
                </View>
              );
            })()}
            {/* ─── Download Report Button ───────────────────────── */}
            {onExport && (
              isFreeplan ? (
                // Free plan: show upgrade prompt instead of download
                <React.Fragment>
                  <Pressable
                    onPress={handleExport}
                    style={({ pressed }) => ({
                      marginTop: 24,
                      borderRadius: 14,
                      overflow: "hidden",
                      opacity: pressed ? 0.85 : 1,
                      transform: [{ scale: pressed ? 0.98 : 1 }],
                    })}
                  >
                    <LinearGradient
                      colors={["#6B7280", "#9CA3AF"]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "center",
                        paddingVertical: 15,
                        paddingHorizontal: 24,
                        gap: 10,
                      }}
                    >
                      <IconSymbol name="lock.fill" size={18} color="#FFF" />
                      <View style={{ alignItems: "center" }}>
                        <Text style={{ fontSize: 15, fontWeight: "700", color: "#FFF", letterSpacing: -0.2 }}>Upgrade to Download Reports</Text>
                        <Text style={{ fontSize: 11, color: "rgba(255,255,255,0.8)", marginTop: 2 }}>Available on Growth &amp; Pro plans</Text>
                      </View>
                    </LinearGradient>
                  </Pressable>
                  {/* Compare all plans link */}
                  <Pressable
                    onPress={() => setShowCompare(true)}
                    style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, alignSelf: "center", marginTop: 10, padding: 6 })}
                  >
                    <Text style={{ fontSize: 13, color: "#2563EB", fontWeight: "600", textDecorationLine: "underline" }}>
                      Compare all plans
                    </Text>
                  </Pressable>
                  <PlanCompareModal visible={showCompare} onClose={() => setShowCompare(false)} />
                </React.Fragment>
              ) : (
                <Pressable
                  onPress={handleExport}
                  disabled={exporting}
                  style={({ pressed }) => ({
                    marginTop: 24,
                    borderRadius: 14,
                    overflow: "hidden",
                    opacity: pressed || exporting ? 0.7 : 1,
                    transform: [{ scale: pressed ? 0.98 : 1 }],
                  })}
                >
                  <LinearGradient
                    colors={cfg.gradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                      paddingVertical: 15,
                      paddingHorizontal: 24,
                      gap: 10,
                    }}
                  >
                    <IconSymbol name="arrow.down.circle.fill" size={20} color="#FFF" />
                    <Text style={{ fontSize: 15, fontWeight: "700", color: "#FFF", letterSpacing: -0.2 }}>
                      {exporting ? "Generating Report…" : "Download Report"}
                    </Text>
                  </LinearGradient>
                </Pressable>
              )
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── Micro Sparkline (for embedding inside KPI cards) ────────────────────
export function MicroSparkLine({
  data,
  w,
  h,
  color,
}: {
  data: number[];
  w: number;
  h: number;
  color: string;
}) {
  return <SparkLine data={data} w={w} h={h} color={color} />;
}

// ─── Micro Bar Sparkline ─────────────────────────────────────────────────
export function MicroBarSpark({
  data,
  w,
  h,
  color,
}: {
  data: number[];
  w: number;
  h: number;
  color: string;
}) {
  if (data.length === 0) return null;
  const max = Math.max(...data, 1);
  const barW = (w / data.length) * 0.6;
  const gap = (w - barW * data.length) / (data.length + 1);
  return (
    <Svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <Defs>
        <SvgLinearGradient id="mbGrad" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={color} stopOpacity="0.9" />
          <Stop offset="1" stopColor={color} stopOpacity="0.4" />
        </SvgLinearGradient>
      </Defs>
      {data.map((v, i) => {
        const bh = Math.max(2, (v / max) * (h - 4));
        const x = gap + i * (barW + gap);
        const y = h - bh;
        return <Rect key={i} x={x} y={y} width={barW} height={bh} rx={2} fill="url(#mbGrad)" />;
      })}
    </Svg>
  );
}

const styles = StyleSheet.create({});
