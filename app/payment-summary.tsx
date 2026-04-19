/**
 * Payment Summary Page
 * Shows paid/unpaid breakdown filterable by day, week, month, year.
 * Download is gated behind paid subscription.
 */
import React, { useMemo, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  FlatList,
  Alert,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useStore } from "@/lib/store";
import { usePlanLimitCheck } from "@/hooks/use-plan-limit-check";
import { formatDateStr } from "@/lib/store";
import type { Appointment } from "@/lib/types";

// ─── Date Range Options ──────────────────────────────────────────────────────
type DateRangeKey = "today" | "week" | "month" | "year" | "all";

const DATE_RANGE_OPTIONS: { key: DateRangeKey; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "week", label: "This Week" },
  { key: "month", label: "This Month" },
  { key: "year", label: "This Year" },
  { key: "all", label: "All Time" },
];

// ─── Filter Tabs ─────────────────────────────────────────────────────────────
type FilterTab = "all" | "paid" | "unpaid";

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: "Cash",
  zelle: "Zelle",
  venmo: "Venmo",
  cashapp: "Cash App",
  card: "Card",
};

const METHOD_COLORS: Record<string, string> = {
  cash: "#22C55E",
  zelle: "#6366F1",
  venmo: "#3B82F6",
  cashapp: "#00C896",
  card: "#635BFF",
  free: "#9CA3AF",
  unpaid: "#EF4444",
};

function getDateRange(key: DateRangeKey): { start: string; end: string } {
  const now = new Date();
  const todayStr = formatDateStr(now);
  switch (key) {
    case "today":
      return { start: todayStr, end: todayStr };
    case "week": {
      const s = new Date(now);
      s.setDate(now.getDate() - now.getDay());
      const e = new Date(s);
      e.setDate(s.getDate() + 6);
      return { start: formatDateStr(s), end: formatDateStr(e) };
    }
    case "month": {
      const mStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const mEnd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
      return { start: mStart, end: mEnd };
    }
    case "year":
      return { start: `${now.getFullYear()}-01-01`, end: `${now.getFullYear()}-12-31` };
    case "all":
    default:
      return { start: "2000-01-01", end: "2099-12-31" };
  }
}

function fmtDate(d: string): string {
  try {
    return new Date(d + "T00:00:00").toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return d;
  }
}

// ─── Appointment Row ─────────────────────────────────────────────────────────
function ApptRow({
  appt,
  clientName,
  serviceName,
  price,
  colors,
}: {
  appt: Appointment;
  clientName: string;
  serviceName: string;
  price: number;
  colors: ReturnType<typeof useColors>;
}) {
  const isPaid = appt.paymentStatus === "paid";
  return (
    <View
      style={[
        styles.apptRow,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      <View style={styles.apptLeft}>
        <Text style={[styles.apptClient, { color: colors.foreground }]} numberOfLines={1}>
          {clientName}
        </Text>
        <Text style={[styles.apptService, { color: colors.muted }]} numberOfLines={1}>
          {serviceName}
        </Text>
        <Text style={[styles.apptDate, { color: colors.muted }]}>{fmtDate(appt.date)} · {appt.time}</Text>
      </View>
      <View style={styles.apptRight}>
        <Text
          style={[
            styles.apptPrice,
            { color: isPaid ? colors.success : colors.error },
          ]}
        >
          ${price.toFixed(2)}
        </Text>
        {isPaid ? (
          <View style={[styles.badge, {
            backgroundColor: appt.paymentMethod === "card" ? "#635BFF20" : colors.success + "20"
          }]}>
            <Text style={[styles.badgeText, {
              color: appt.paymentMethod === "card" ? "#635BFF" : colors.success
            }]}>
              {appt.paymentMethod === "card" ? "💳 Card" : (PAYMENT_METHOD_LABELS[appt.paymentMethod || ""] || "Paid")}
            </Text>
          </View>
        ) : (
          <View style={[styles.badge, { backgroundColor: colors.error + "20" }]}>
            <Text style={[styles.badgeText, { color: colors.error }]}>Unpaid</Text>
          </View>
        )}
      </View>
    </View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────
export default function PaymentSummaryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ method?: string; label?: string }>();
  const colors = useColors();
  const { state } = useStore();
  const { planInfo } = usePlanLimitCheck();
  const isFreeplan = !planInfo || planInfo.planKey === "solo";

  const [dateRange, setDateRange] = useState<DateRangeKey>("month");
  const [filterTab, setFilterTab] = useState<FilterTab>("all");
  const [methodFilter, setMethodFilter] = useState<string | null>(params.method ?? null);
  const [exporting, setExporting] = useState(false);

  // ─── Filter appointments by date range and active location ───────────────
  const filteredAppts = useMemo(() => {
    const { start, end } = getDateRange(dateRange);
    const activeLocationIds = state.locations
      .filter((l) => l.active)
      .map((l) => l.id);
    const hasLocations = activeLocationIds.length > 0;

    return state.appointments.filter((a) => {
      if (a.status === "cancelled") return false;
      if (a.date < start || a.date > end) return false;
      if (hasLocations && a.locationId && !activeLocationIds.includes(a.locationId)) return false;
      return true;
    });
  }, [state.appointments, state.locations, dateRange]);

  // ─── Summary stats ────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const getPrice = (a: Appointment) =>
      a.totalPrice ?? state.services.find((s) => s.id === a.serviceId)?.price ?? 0;

    const paid = filteredAppts.filter((a) => a.paymentStatus === "paid");
    const unpaid = filteredAppts.filter((a) => a.paymentStatus !== "paid");

    const paidTotal = paid.reduce((s, a) => s + getPrice(a), 0);
    const unpaidTotal = unpaid.reduce((s, a) => s + getPrice(a), 0);
    const total = paidTotal + unpaidTotal;
    const collectionRate = total > 0 ? Math.round((paidTotal / total) * 100) : 0;

    // Method breakdown
    const methodMap: Record<string, { label: string; count: number; total: number }> = {};
    paid.forEach((a) => {
      const m = a.paymentMethod || "unknown";
      if (!methodMap[m]) methodMap[m] = { label: PAYMENT_METHOD_LABELS[m] || m, count: 0, total: 0 };
      methodMap[m].count++;
      methodMap[m].total += getPrice(a);
    });

    return {
      paidCount: paid.length,
      unpaidCount: unpaid.length,
      paidTotal,
      unpaidTotal,
      total,
      collectionRate,
      methodBreakdown: Object.entries(methodMap)
        .sort((a, b) => b[1].total - a[1].total)
        .map(([key, v]) => ({ key, ...v })),
    };
  }, [filteredAppts, state.services]);

  // ─── Displayed list based on filter tab ──────────────────────────────────
  const displayedAppts = useMemo(() => {
    const getPrice = (a: Appointment) =>
      a.totalPrice ?? state.services.find((s) => s.id === a.serviceId)?.price ?? 0;

    let list = filteredAppts;
    if (filterTab === "paid") list = filteredAppts.filter((a) => a.paymentStatus === "paid");
    if (filterTab === "unpaid") list = filteredAppts.filter((a) => a.paymentStatus !== "paid");
    if (methodFilter) list = list.filter((a) => (a.paymentMethod || "unknown") === methodFilter);

    return list
      .sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time))
      .map((a) => ({
        appt: a,
        clientName: state.clients.find((c) => c.id === a.clientId)?.name ?? "Unknown",
        serviceName: state.services.find((s) => s.id === a.serviceId)?.name ?? "Unknown",
        price: getPrice(a),
      }));
  }, [filteredAppts, filterTab, methodFilter, state.clients, state.services]);

  // ─── Export handler ───────────────────────────────────────────────────────
  const handleExport = useCallback(async () => {
    if (isFreeplan) {
      Alert.alert(
        "Upgrade Required",
        "Downloading reports is available on Growth, Studio, and Enterprise plans. Upgrade to unlock PDF exports.",
        [{ text: "OK" }]
      );
      return;
    }
    if (exporting) return;
    setExporting(true);
    try {
      const { generatePaymentSummaryPdf, exportPdf } = await import("@/lib/pdf-export");
      const activeLocation = state.locations.find((l) => l.active && l.isDefault) ?? state.locations.find((l) => l.active);
      const rangeLabel = DATE_RANGE_OPTIONS.find((r) => r.key === dateRange)?.label ?? dateRange;
      const html = generatePaymentSummaryPdf(
        state.settings.businessName || "My Business",
        filteredAppts,
        state.services,
        state.clients,
        "#22C55E",
        rangeLabel,
        activeLocation?.name,
        activeLocation?.address
      );
      await exportPdf(html, `payment-summary-${dateRange}-${Date.now()}.pdf`);
    } catch (e) {
      Alert.alert("Export Failed", "Could not generate the PDF. Please try again.");
    } finally {
      setExporting(false);
    }
  }, [isFreeplan, exporting, state, filteredAppts, dateRange]);

  const rangeLabel = DATE_RANGE_OPTIONS.find((r) => r.key === dateRange)?.label ?? dateRange;

  return (
    <ScreenContainer>
      {/* ─── Header ─────────────────────────────────────────────────── */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backBtn, { opacity: pressed ? 0.6 : 1 }]}
        >
          <Text style={{ fontSize: 24, color: colors.primary, lineHeight: 28 }}>‹</Text>
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>
          {methodFilter ? `${PAYMENT_METHOD_LABELS[methodFilter] ?? methodFilter} Payments` : "Payment Summary"}
        </Text>
        <Pressable
          onPress={handleExport}
          style={({ pressed }) => [
            styles.exportBtn,
            {
              backgroundColor: isFreeplan ? colors.border : colors.primary,
              opacity: pressed ? 0.8 : 1,
            },
          ]}
        >
          {exporting ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <IconSymbol
              name={isFreeplan ? "lock.fill" : "arrow.down.circle.fill"}
              size={16}
              color="#FFF"
            />
          )}
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* ─── Date Range Filter ──────────────────────────────────────── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.rangeRow}
        >
          {DATE_RANGE_OPTIONS.map((opt) => {
            const active = dateRange === opt.key;
            return (
              <Pressable
                key={opt.key}
                onPress={() => setDateRange(opt.key)}
                style={({ pressed }) => [
                  styles.rangeChip,
                  {
                    backgroundColor: active ? colors.primary : colors.surface,
                    borderColor: active ? colors.primary : colors.border,
                    opacity: pressed ? 0.75 : 1,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.rangeChipText,
                    { color: active ? "#FFF" : colors.muted },
                  ]}
                >
                  {opt.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* ─── Summary Cards ──────────────────────────────────────────── */}
        <View style={styles.summaryRow}>
          <View style={[styles.summaryCard, { backgroundColor: colors.success + "15", borderColor: colors.success + "30" }]}>
            <Text style={[styles.summaryLabel, { color: colors.success }]}>COLLECTED</Text>
            <Text style={[styles.summaryValue, { color: colors.success }]}>
              ${stats.paidTotal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </Text>
            <Text style={[styles.summaryCount, { color: colors.muted }]}>{stats.paidCount} appointment{stats.paidCount !== 1 ? "s" : ""}</Text>
          </View>
          <View style={[styles.summaryCard, { backgroundColor: colors.error + "15", borderColor: colors.error + "30" }]}>
            <Text style={[styles.summaryLabel, { color: colors.error }]}>OUTSTANDING</Text>
            <Text style={[styles.summaryValue, { color: colors.error }]}>
              ${stats.unpaidTotal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </Text>
            <Text style={[styles.summaryCount, { color: colors.muted }]}>{stats.unpaidCount} appointment{stats.unpaidCount !== 1 ? "s" : ""}</Text>
          </View>
        </View>

        {/* ─── Collection Rate Bar ────────────────────────────────────── */}
        {stats.total > 0 && (
          <View style={[styles.rateCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.rateHeader}>
              <Text style={[styles.rateLabel, { color: colors.foreground }]}>Collection Rate</Text>
              <Text style={[styles.rateValue, { color: stats.collectionRate >= 80 ? colors.success : stats.collectionRate >= 50 ? colors.warning : colors.error }]}>
                {stats.collectionRate}%
              </Text>
            </View>
            <View style={[styles.rateBarBg, { backgroundColor: colors.border }]}>
              <View
                style={[
                  styles.rateBarFill,
                  {
                    width: `${stats.collectionRate}%` as any,
                    backgroundColor: stats.collectionRate >= 80 ? colors.success : stats.collectionRate >= 50 ? colors.warning : colors.error,
                  },
                ]}
              />
            </View>
            <Text style={[styles.rateSubtext, { color: colors.muted }]}>
              ${stats.paidTotal.toFixed(0)} collected of ${stats.total.toFixed(0)} total · {rangeLabel}
            </Text>
          </View>
        )}

        {/* ─── Payment Method Breakdown ───────────────────────────────── */}
        {/* ─── Active method filter banner ──────────────────────────── */}
        {methodFilter && (
          <Pressable
            onPress={() => setMethodFilter(null)}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              paddingHorizontal: 14,
              paddingVertical: 10,
              borderRadius: 12,
              backgroundColor: (METHOD_COLORS[methodFilter] ?? colors.primary) + "18",
              borderWidth: 1,
              borderColor: (METHOD_COLORS[methodFilter] ?? colors.primary) + "40",
              opacity: pressed ? 0.75 : 1,
            })}
          >
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: METHOD_COLORS[methodFilter] ?? colors.primary }} />
            <Text style={{ flex: 1, fontSize: 13, fontWeight: "700", color: METHOD_COLORS[methodFilter] ?? colors.primary }}>
              Filtered: {PAYMENT_METHOD_LABELS[methodFilter] ?? methodFilter}
            </Text>
            <Text style={{ fontSize: 12, color: colors.muted }}>Tap to clear ×</Text>
          </Pressable>
        )}

        {stats.methodBreakdown.length > 0 && (
          <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>By Payment Method</Text>
            {stats.methodBreakdown.map((m, i) => {
              const isActive = methodFilter === m.key;
              const dotColor = METHOD_COLORS[m.key] ?? colors.primary;
              return (
                <Pressable
                  key={m.key}
                  onPress={() => setMethodFilter((prev) => (prev === m.key ? null : m.key))}
                  style={({ pressed }) => ([
                    styles.methodRow,
                    {
                      borderBottomColor: colors.border,
                      backgroundColor: isActive ? dotColor + "12" : "transparent",
                      borderRadius: isActive ? 8 : 0,
                      opacity: pressed ? 0.75 : 1,
                    },
                  ])}
                >
                  <View style={[styles.methodDot, { backgroundColor: dotColor }]} />
                  <Text style={[styles.methodLabel, { color: isActive ? dotColor : colors.foreground, fontWeight: isActive ? "800" : "600" }]}>{m.label}</Text>
                  <Text style={[styles.methodCount, { color: colors.muted }]}>{m.count} appt{m.count !== 1 ? "s" : ""}</Text>
                  <Text style={[styles.methodTotal, { color: dotColor }]}>${m.total.toFixed(2)}</Text>
                  <IconSymbol name="chevron.right" size={12} color={isActive ? dotColor : colors.muted} />
                </Pressable>
              );
            })}
          </View>
        )}

        {/* ─── Filter Tabs ────────────────────────────────────────────── */}
        <View style={[styles.tabRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {(["all", "paid", "unpaid"] as FilterTab[]).map((tab) => {
            const labels: Record<FilterTab, string> = {
              all: `All (${filteredAppts.length})`,
              paid: `Paid (${stats.paidCount})`,
              unpaid: `Unpaid (${stats.unpaidCount})`,
            };
            const active = filterTab === tab;
            return (
              <Pressable
                key={tab}
                onPress={() => setFilterTab(tab)}
                style={({ pressed }) => [
                  styles.tabBtn,
                  {
                    backgroundColor: active ? colors.primary : "transparent",
                    opacity: pressed ? 0.75 : 1,
                  },
                ]}
              >
                <Text style={[styles.tabBtnText, { color: active ? "#FFF" : colors.muted }]}>
                  {labels[tab]}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* ─── Appointment List ────────────────────────────────────────── */}
        {displayedAppts.length === 0 ? (
          <View style={[styles.emptyState, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <IconSymbol name="dollarsign.circle.fill" size={36} color={colors.border} />
            <Text style={[styles.emptyTitle, { color: colors.muted }]}>No appointments found</Text>
            <Text style={[styles.emptySubtitle, { color: colors.muted }]}>
              Try selecting a different date range or filter.
            </Text>
          </View>
        ) : (
          <View style={styles.listContainer}>
            {displayedAppts.map(({ appt, clientName, serviceName, price }) => (
              <Pressable
                key={appt.id}
                onPress={() => router.push({ pathname: "/appointment-detail", params: { id: appt.id } } as any)}
                style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}
              >
                <ApptRow
                  appt={appt}
                  clientName={clientName}
                  serviceName={serviceName}
                  price={price}
                  colors={colors}
                />
              </Pressable>
            ))}
          </View>
        )}

        {/* ─── Free Plan Download Banner ───────────────────────────────── */}
        {isFreeplan && (
          <View style={[styles.upgradeBanner, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <IconSymbol name="lock.fill" size={18} color={colors.muted} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.upgradeTitle, { color: colors.foreground }]}>Download Blocked</Text>
              <Text style={[styles.upgradeSubtitle, { color: colors.muted }]}>
                PDF export is available on Growth, Studio, and Enterprise plans.
              </Text>
            </View>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: "700",
  },
  exportBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  scrollContent: {
    padding: 16,
    gap: 12,
  },
  rangeRow: {
    flexDirection: "row",
    gap: 8,
    paddingBottom: 4,
  },
  rangeChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  rangeChipText: {
    fontSize: 13,
    fontWeight: "600",
  },
  summaryRow: {
    flexDirection: "row",
    gap: 12,
  },
  summaryCard: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
  },
  summaryLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 22,
    fontWeight: "800",
  },
  summaryCount: {
    fontSize: 12,
    marginTop: 2,
  },
  rateCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
  },
  rateHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  rateLabel: {
    fontSize: 14,
    fontWeight: "700",
  },
  rateValue: {
    fontSize: 16,
    fontWeight: "800",
  },
  rateBarBg: {
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: 6,
  },
  rateBarFill: {
    height: 8,
    borderRadius: 4,
  },
  rateSubtext: {
    fontSize: 12,
  },
  section: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 10,
  },
  methodRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 0.5,
    gap: 8,
  },
  methodDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  methodLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
  },
  methodCount: {
    fontSize: 12,
  },
  methodTotal: {
    fontSize: 14,
    fontWeight: "700",
    minWidth: 70,
    textAlign: "right",
  },
  tabRow: {
    flexDirection: "row",
    borderRadius: 12,
    borderWidth: 1,
    padding: 4,
    gap: 4,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 9,
    alignItems: "center",
  },
  tabBtnText: {
    fontSize: 12,
    fontWeight: "700",
  },
  listContainer: {
    gap: 8,
  },
  apptRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    gap: 12,
  },
  apptLeft: {
    flex: 1,
    gap: 2,
  },
  apptClient: {
    fontSize: 14,
    fontWeight: "700",
  },
  apptService: {
    fontSize: 12,
  },
  apptDate: {
    fontSize: 11,
  },
  apptRight: {
    alignItems: "flex-end",
    gap: 4,
  },
  apptPrice: {
    fontSize: 16,
    fontWeight: "800",
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  emptyState: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 32,
    alignItems: "center",
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: "center",
  },
  upgradeBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
  },
  upgradeTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  upgradeSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
});
