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

// ─── Types ─────────────────────────────────────────────────────────────
export type KpiTab = "revenue" | "appointments" | "clients" | "topservice";

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
}: {
  data: { label: string; value: number; color?: string }[];
  w: number;
  h: number;
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
        return (
          <G key={pct}>
            <Line x1={leftPad} y1={y} x2={w} y2={y} stroke="#33333320" strokeWidth={0.5} strokeDasharray="4,4" />
            <SvgText x={leftPad - 6} y={y + 4} fontSize={10} fill="#888" textAnchor="end">{fmt(val)}</SvgText>
          </G>
        );
      })}
      {data.map((d, i) => {
        const barH = gridMax > 0 ? Math.max(2, (d.value / gridMax) * chartH) : 2;
        const x = leftPad + gap + i * (barW + gap);
        const y = topPad + chartH - barH;
        return (
          <G key={i}>
            <Rect x={x} y={y} width={barW} height={barH} rx={barW > 16 ? 5 : 3} fill={`url(#bg${i})`} />
            <SvgText x={x + barW / 2} y={h - 6} fontSize={10} fill="#888" textAnchor="middle">{d.label}</SvgText>
            {d.value > 0 && (
              <SvgText x={x + barW / 2} y={y - 5} fontSize={10} fill="#555" textAnchor="middle" fontWeight="700">{fmt(d.value)}</SvgText>
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
}: KpiDetailSheetProps) {
  const [exporting, setExporting] = useState(false);

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
  const maxH = height * 0.88;

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

  if (!tab) return null;
  const cfg = tabConfig[tab];

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
            title={cfg.title}
            subtitle={cfg.subtitle}
            gradientColors={cfg.gradient}
            onClose={onClose}
          />

          <ScrollView
            contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
            showsVerticalScrollIndicator={false}
          >
            {/* ─── REVENUE ─────────────────────────────────────────── */}
            {tab === "revenue" && (
              <View>
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
              </View>
            )}

            {/* ─── APPOINTMENTS ────────────────────────────────────── */}
            {tab === "appointments" && (
              <View>
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
              </View>
            )}

            {/* ─── CLIENTS ─────────────────────────────────────────── */}
            {tab === "clients" && (
              <View>
                <StatPills items={[
                  { label: "Total Clients", value: String(clientsData.totalClients), color: "#2E7D32" },
                  { label: "Active", value: String(clientsData.clientsData.filter((c) => c.apptCount > 0).length), color: "#4CAF50" },
                  { label: "Total Spent", value: `$${clientsData.clientsData.reduce((s, c) => s + c.totalSpent, 0).toLocaleString()}`, color: "#FF9800" },
                ]} />

                <SectionLabel title="Top Clients by Visits" />
                {clientsData.clientsData.length === 0 ? (
                  <Text style={{ color: "#888", fontSize: 13, textAlign: "center", paddingVertical: 20 }}>No client data yet</Text>
                ) : (
                  clientsData.clientsData.slice(0, 10).map((c, i) => (
                    <View
                      key={c.id}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        paddingVertical: 12,
                        paddingHorizontal: 14,
                        backgroundColor: colors.surface,
                        borderRadius: 12,
                        marginBottom: 8,
                        borderWidth: 1,
                        borderColor: colors.border,
                      }}
                    >
                      <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: "#4CAF5018", alignItems: "center", justifyContent: "center", marginRight: 12 }}>
                        <Text style={{ fontSize: 14, fontWeight: "700", color: "#4CAF50" }}>{c.name.charAt(0).toUpperCase()}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 14, fontWeight: "600", color: colors.foreground }} numberOfLines={1}>{c.name}</Text>
                        <Text style={{ fontSize: 11, color: colors.muted }} numberOfLines={1}>{c.phone || c.email || "No contact"}</Text>
                      </View>
                      <View style={{ alignItems: "flex-end" }}>
                        <View style={{ backgroundColor: "#4CAF5015", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 }}>
                          <Text style={{ fontSize: 12, fontWeight: "700", color: "#4CAF50" }}>{c.apptCount} visits</Text>
                        </View>
                        {c.totalSpent > 0 && (
                          <Text style={{ fontSize: 11, color: "#FF9800", fontWeight: "600", marginTop: 3 }}>${c.totalSpent}</Text>
                        )}
                      </View>
                    </View>
                  ))
                )}
              </View>
            )}

            {/* ─── TOP SERVICE ─────────────────────────────────────── */}
            {tab === "topservice" && (
              <View>
                <StatPills items={[
                  { label: "Services", value: String(topServiceData.serviceRanking.length), color: "#6A1B9A" },
                  { label: "Top Bookings", value: String(topServiceData.topCount), color: "#9C27B0" },
                  { label: "Top Service", value: topServiceData.topService?.name?.split(" ")[0] ?? "N/A", color: "#E91E63" },
                ]} />

                <SectionLabel title="Service Rankings" />
                {topServiceData.serviceRanking.length === 0 ? (
                  <Text style={{ color: "#888", fontSize: 13, textAlign: "center", paddingVertical: 20 }}>No booking data yet</Text>
                ) : (
                  topServiceData.serviceRanking.map((s, i) => (
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
                        <View style={{ height: "100%", width: `${(s.bookings / maxBookings) * 100}%`, backgroundColor: s.color || "#9C27B0", borderRadius: 4 }} />
                      </View>
                    </View>
                  ))
                )}
              </View>
            )}
            {/* ─── Download Report Button ───────────────────────── */}
            {onExport && (
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
