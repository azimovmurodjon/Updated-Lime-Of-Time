import { useMemo, useState, useCallback } from "react";
import {
  Text,
  View,
  Pressable,
  StyleSheet,
  ScrollView,
  Alert,
  Platform,
  ActivityIndicator,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useStore, formatDateDisplay, formatTime } from "@/lib/store";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { minutesToTime, timeToMinutes } from "@/lib/types";
import { useActiveLocation } from "@/hooks/use-active-location";
import { useResponsive } from "@/hooks/use-responsive";
import { LocationSwitcher } from "@/components/location-switcher";

export default function AnalyticsDetailScreen() {
  const { tab } = useLocalSearchParams<{ tab: string }>();
  const { state, getServiceById, getClientById, filterAppointmentsByLocation, clientsForActiveLocation } = useStore();
  const { activeLocation, hasMultipleLocations: hasMultiLoc } = useActiveLocation();
  const colors = useColors();
  const router = useRouter();
  const { isTablet, hp } = useResponsive();
  const [generating, setGenerating] = useState(false);
  // Use global activeLocationId — no separate local filter needed
  const filteredAppts = useMemo(
    () => filterAppointmentsByLocation(state.appointments),
    [state.appointments, filterAppointmentsByLocation]
  );

  const titles: Record<string, string> = {
    overview: "Analytics Overview",
    clients: "Total Clients",
    appointments: "Appointments",
    revenue: "Revenue",
    topservice: "Top Service",
  };

  // Clients analytics — scoped to active location
  const clientsData = useMemo(() => {
    return clientsForActiveLocation
      .map((c) => {
        const apptCount = filteredAppts.filter(
          (a) => a.clientId === c.id && a.status !== "cancelled"
        ).length;
        const totalSpent = filteredAppts
          .filter((a) => a.clientId === c.id && a.status === "completed")
          .reduce((sum, a) => {
            if (a.totalPrice != null) return sum + a.totalPrice;
            const svc = getServiceById(a.serviceId);
            return sum + (svc?.price ?? 0);
          }, 0);
        return { ...c, apptCount, totalSpent };
      })
      .sort((a, b) => b.apptCount - a.apptCount);
  }, [clientsForActiveLocation, filteredAppts, state.services]);

  // Appointments analytics - by month
  const appointmentsData = useMemo(() => {
    const months: Record<
      string,
      { confirmed: number; completed: number; cancelled: number; pending: number }
    > = {};
    filteredAppts.forEach((a) => {
      const monthKey = a.date.substring(0, 7);
      if (!months[monthKey])
        months[monthKey] = { confirmed: 0, completed: 0, cancelled: 0, pending: 0 };
      if (a.status === "confirmed") months[monthKey].confirmed++;
      else if (a.status === "completed") months[monthKey].completed++;
      else if (a.status === "cancelled") months[monthKey].cancelled++;
      else if (a.status === "pending") months[monthKey].pending++;
    });
    return Object.entries(months)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([month, counts]) => ({ month, ...counts }));
  }, [filteredAppts]);

  // Revenue analytics - by service
  const revenueData = useMemo(() => {
    const byService: Record<
      string,
      { name: string; revenue: number; count: number; color: string }
    > = {};
    filteredAppts
      .filter((a) => a.status === "completed")
      .forEach((a) => {
        const svc = getServiceById(a.serviceId);
        if (svc) {
          if (!byService[svc.id])
            byService[svc.id] = { name: svc.name, revenue: 0, count: 0, color: svc.color };
          // Use totalPrice if available (includes extras), else fall back to service price
          const apptRevenue = a.totalPrice != null ? a.totalPrice : svc.price;
          byService[svc.id].revenue += apptRevenue;
          byService[svc.id].count++;
        }
      });
    return Object.values(byService).sort((a, b) => b.revenue - a.revenue);
  }, [filteredAppts, state.services]);

  const totalRevenue = revenueData.reduce((s, r) => s + r.revenue, 0);

  // Top service analytics
  const serviceRanking = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredAppts
      .filter((a) => a.status !== "cancelled")
      .forEach((a) => {
        counts[a.serviceId] = (counts[a.serviceId] || 0) + 1;
      });
    return state.services
      .map((s) => ({ ...s, bookings: counts[s.id] || 0 }))
      .sort((a, b) => b.bookings - a.bookings);
  }, [state.services, filteredAppts]);

  const maxBar = Math.max(...serviceRanking.map((s) => s.bookings), 1);

  // ─── Overview analytics ────────────────────────────────────────────
  const overviewData = useMemo(() => {
    const completed = filteredAppts.filter((a) => a.status === "completed");
    const cancelled = filteredAppts.filter((a) => a.status === "cancelled");
    const confirmed = filteredAppts.filter((a) => a.status === "confirmed");
    const pending = filteredAppts.filter((a) => a.status === "pending");
    const total = filteredAppts.length;
    const completionRate = total > 0 ? Math.round((completed.length / total) * 100) : 0;
    const cancellationRate = total > 0 ? Math.round((cancelled.length / total) * 100) : 0;
    const avgRevenue = completed.length > 0 ? Math.round(totalRevenue / completed.length) : 0;

    // Monthly revenue for last 6 months
    const now = new Date();
    const last6Months: { label: string; revenue: number; count: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString("en-US", { month: "short" });
      const monthAppts = completed.filter((a) => a.date.startsWith(key));
      const rev = monthAppts.reduce((s, a) => {
        if (a.totalPrice != null) return s + a.totalPrice;
        const svc = getServiceById(a.serviceId);
        return s + (svc?.price ?? 0);
      }, 0);
      last6Months.push({ label, revenue: rev, count: monthAppts.length });
    }
    const maxMonthRev = Math.max(...last6Months.map((m) => m.revenue), 1);

    // Busiest day of week
    const dayCount: number[] = [0, 0, 0, 0, 0, 0, 0];
    filteredAppts.filter((a) => a.status !== "cancelled").forEach((a) => {
      const d = new Date(a.date + "T12:00:00");
      dayCount[d.getDay()]++;
    });
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const busiestDayIdx = dayCount.indexOf(Math.max(...dayCount));
    const busiestDay = dayNames[busiestDayIdx];

    // Top client
    const topClient = clientsData[0];
    // Top service
    const topService = serviceRanking[0];
    // Avg rating
    const reviews = state.reviews;
    const avgRating = reviews.length > 0
      ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
      : null;

    // New clients last 30 days (by first appointment)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyKey = thirtyDaysAgo.toISOString().substring(0, 10);
    const recentClientIds = new Set(
      filteredAppts
        .filter((a) => a.date >= thirtyKey)
        .map((a) => a.clientId)
    );
    const newClientsLast30 = recentClientIds.size;

    return {
      total, completed: completed.length, cancelled: cancelled.length,
      confirmed: confirmed.length, pending: pending.length,
      completionRate, cancellationRate, avgRevenue,
      last6Months, maxMonthRev, busiestDay,
      topClient, topService, avgRating, newClientsLast30,
      totalClients: clientsForActiveLocation.length,
      reviewCount: reviews.length,
    };
  }, [filteredAppts, totalRevenue, clientsData, serviceRanking, state.reviews, clientsForActiveLocation, getServiceById]);

  // ─── Year-End / Tax Report Generation ─────────────────────────────
  const generateYearEndReport = useCallback(
    async (reportType: string) => {
      setGenerating(true);
      try {
        const now = new Date();
        const currentYear = now.getFullYear();
        const businessName = state.settings.businessName || "My Business";
        const profile = state.settings.profile;

        // Filter appointments for the current year — scoped to active location
        const locationAppts = filterAppointmentsByLocation(state.appointments);
        const yearAppts = locationAppts.filter((a) =>
          a.date.startsWith(`${currentYear}`)
        );
        const completedAppts = yearAppts.filter((a) => a.status === "completed");
        const cancelledAppts = yearAppts.filter((a) => a.status === "cancelled");
        const pendingAppts = yearAppts.filter((a) => a.status === "pending");
        const confirmedAppts = yearAppts.filter((a) => a.status === "confirmed");

        // Revenue calculations
        const yearRevenue = completedAppts.reduce((sum, a) => {
          if (a.totalPrice != null) return sum + a.totalPrice;
          const svc = getServiceById(a.serviceId);
          return sum + (svc?.price ?? 0);
        }, 0);

        // Monthly revenue breakdown
        const monthlyRevenue: Record<string, number> = {};
        completedAppts.forEach((a) => {
          const monthKey = a.date.substring(0, 7);
          const apptPrice = a.totalPrice != null ? a.totalPrice : (getServiceById(a.serviceId)?.price ?? 0);
          monthlyRevenue[monthKey] = (monthlyRevenue[monthKey] || 0) + apptPrice;
        });

        // Service revenue breakdown
        const serviceRevenue: Record<string, { name: string; revenue: number; count: number }> = {};
        completedAppts.forEach((a) => {
          const svc = getServiceById(a.serviceId);
          if (svc) {
            if (!serviceRevenue[svc.id])
              serviceRevenue[svc.id] = { name: svc.name, revenue: 0, count: 0 };
            serviceRevenue[svc.id].revenue += a.totalPrice != null ? a.totalPrice : svc.price;
            serviceRevenue[svc.id].count++;
          }
        });

        // Client revenue breakdown
        const clientRevenue: Record<string, { name: string; phone: string; email: string; revenue: number; visits: number }> = {};
        completedAppts.forEach((a) => {
          const client = getClientById(a.clientId);
          const svc = getServiceById(a.serviceId);
          if (client) {
            if (!clientRevenue[client.id])
              clientRevenue[client.id] = {
                name: client.name,
                phone: client.phone,
                email: client.email,
                revenue: 0,
                visits: 0,
              };
            clientRevenue[client.id].revenue += a.totalPrice != null ? a.totalPrice : (svc?.price ?? 0);
            clientRevenue[client.id].visits++;
          }
        });

        // Cancellation fee estimate
        const cancellationFees = cancelledAppts.reduce((sum, a) => {
          if (state.settings.cancellationPolicy.enabled) {
            const svc = getServiceById(a.serviceId);
            return sum + ((svc?.price ?? 0) * state.settings.cancellationPolicy.feePercentage) / 100;
          }
          return sum;
        }, 0);

        // Total hours worked
        const totalMinutesWorked = completedAppts.reduce((sum, a) => sum + a.duration, 0);
        const totalHoursWorked = Math.round((totalMinutesWorked / 60) * 10) / 10;

        // Average revenue per appointment
        const avgRevenuePerAppt =
          completedAppts.length > 0 ? Math.round(yearRevenue / completedAppts.length) : 0;

        // Build CSV content based on report type
        let csvContent = "";
        let fileName = "";
        const dateGenerated = now.toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        });

        if (reportType === "revenue" || reportType === "full") {
          fileName = `${businessName.replace(/\s+/g, "_")}_Tax_Report_${currentYear}.csv`;
          csvContent += `"${businessName} - Year-End Tax Report ${currentYear}"\n`;
          csvContent += `"Generated: ${dateGenerated}"\n`;
          if (profile.ownerName) csvContent += `"Owner: ${profile.ownerName}"\n`;
          if (profile.address) csvContent += `"Address: ${profile.address}"\n`;
          if (profile.phone) csvContent += `"Phone: ${profile.phone}"\n`;
          if (profile.email) csvContent += `"Email: ${profile.email}"\n`;
          csvContent += `\n`;

          // Summary section
          csvContent += `"ANNUAL SUMMARY"\n`;
          csvContent += `"Metric","Value"\n`;
          csvContent += `"Total Gross Revenue","$${yearRevenue.toLocaleString()}"\n`;
          csvContent += `"Total Completed Appointments","${completedAppts.length}"\n`;
          csvContent += `"Total Cancelled Appointments","${cancelledAppts.length}"\n`;
          csvContent += `"Total Pending Appointments","${pendingAppts.length}"\n`;
          csvContent += `"Total Confirmed Appointments","${confirmedAppts.length}"\n`;
          csvContent += `"Estimated Cancellation Fees","$${cancellationFees.toLocaleString()}"\n`;
          csvContent += `"Total Hours Worked","${totalHoursWorked}"\n`;
          csvContent += `"Average Revenue Per Appointment","$${avgRevenuePerAppt}"\n`;
          csvContent += `"Total Clients Served","${Object.keys(clientRevenue).length}"\n`;
          csvContent += `"Total Services Offered","${state.services.length}"\n`;
          csvContent += `\n`;

          // Monthly breakdown
          csvContent += `"MONTHLY REVENUE BREAKDOWN"\n`;
          csvContent += `"Month","Revenue","Appointments"\n`;
          const monthNames = [
            "January",
            "February",
            "March",
            "April",
            "May",
            "June",
            "July",
            "August",
            "September",
            "October",
            "November",
            "December",
          ];
          for (let m = 0; m < 12; m++) {
            const monthKey = `${currentYear}-${String(m + 1).padStart(2, "0")}`;
            const rev = monthlyRevenue[monthKey] || 0;
            const count = completedAppts.filter((a) => a.date.startsWith(monthKey)).length;
            csvContent += `"${monthNames[m]} ${currentYear}","$${rev.toLocaleString()}","${count}"\n`;
          }
          csvContent += `\n`;

          // Service breakdown
          csvContent += `"REVENUE BY SERVICE"\n`;
          csvContent += `"Service","Revenue","Appointments","Avg Price"\n`;
          Object.values(serviceRevenue)
            .sort((a, b) => b.revenue - a.revenue)
            .forEach((s) => {
              const avg = s.count > 0 ? Math.round(s.revenue / s.count) : 0;
              csvContent += `"${s.name}","$${s.revenue.toLocaleString()}","${s.count}","$${avg}"\n`;
            });
          csvContent += `\n`;

          // Client breakdown
          csvContent += `"REVENUE BY CLIENT"\n`;
          csvContent += `"Client","Phone","Email","Revenue","Visits"\n`;
          Object.values(clientRevenue)
            .sort((a, b) => b.revenue - a.revenue)
            .forEach((c) => {
              csvContent += `"${c.name}","${c.phone}","${c.email}","$${c.revenue.toLocaleString()}","${c.visits}"\n`;
            });
        } else if (reportType === "clients") {
          fileName = `${businessName.replace(/\s+/g, "_")}_Client_Report_${currentYear}.csv`;
          csvContent += `"${businessName} - Client Report ${currentYear}"\n`;
          csvContent += `"Generated: ${dateGenerated}"\n\n`;
          const reportClients = filterAppointmentsByLocation === ((a: any[]) => a) ? state.clients : clientsForActiveLocation;
          csvContent += `"TOTAL CLIENTS: ${reportClients.length}"\n\n`;
          csvContent += `"Client Name","Phone","Email","Total Appointments","Completed","Cancelled","Total Spent","Notes"\n`;
          reportClients.forEach((c) => {
            const cAppts = yearAppts.filter((a) => a.clientId === c.id);
            const cCompleted = cAppts.filter((a) => a.status === "completed").length;
            const cCancelled = cAppts.filter((a) => a.status === "cancelled").length;
            const cSpent = cAppts
              .filter((a) => a.status === "completed")
              .reduce((sum, a) => {
                if (a.totalPrice != null) return sum + a.totalPrice;
                const svc = getServiceById(a.serviceId);
                return sum + (svc?.price ?? 0);
              }, 0);
            csvContent += `"${c.name}","${c.phone}","${c.email}","${cAppts.length}","${cCompleted}","${cCancelled}","$${cSpent}","${c.notes.replace(/"/g, '""')}"\n`;
          });
        } else if (reportType === "appointments") {
          fileName = `${businessName.replace(/\s+/g, "_")}_Appointment_Report_${currentYear}.csv`;
          csvContent += `"${businessName} - Appointment Report ${currentYear}"\n`;
          csvContent += `"Generated: ${dateGenerated}"\n\n`;
          csvContent += `"TOTAL APPOINTMENTS: ${yearAppts.length}"\n`;
          csvContent += `"Completed: ${completedAppts.length} | Confirmed: ${confirmedAppts.length} | Pending: ${pendingAppts.length} | Cancelled: ${cancelledAppts.length}"\n\n`;
          csvContent += `"Date","Time","End Time","Client","Service","Duration (min)","Price","Status","Notes"\n`;
          yearAppts
            .sort((a, b) => {
              const dc = a.date.localeCompare(b.date);
              return dc !== 0 ? dc : a.time.localeCompare(b.time);
            })
            .forEach((a) => {
              const client = getClientById(a.clientId);
              const svc = getServiceById(a.serviceId);
              const endMin = timeToMinutes(a.time) + a.duration;
              const endTime = minutesToTime(endMin);
              csvContent += `"${a.date}","${a.time}","${endTime}","${client?.name ?? "Unknown"}","${svc?.name ?? "Unknown"}","${a.duration}","$${a.totalPrice != null ? a.totalPrice : (svc?.price ?? 0)}","${a.status}","${a.notes.replace(/"/g, '""')}"\n`;
            });
        } else if (reportType === "topservice") {
          fileName = `${businessName.replace(/\s+/g, "_")}_Service_Report_${currentYear}.csv`;
          csvContent += `"${businessName} - Service Performance Report ${currentYear}"\n`;
          csvContent += `"Generated: ${dateGenerated}"\n\n`;
          csvContent += `"Service Name","Price","Duration (min)","Total Bookings","Completed","Revenue","Avg Monthly Bookings"\n`;
          state.services.forEach((s) => {
            const sAppts = yearAppts.filter((a) => a.serviceId === s.id);
            const sCompleted = sAppts.filter((a) => a.status === "completed").length;
            const sRevenue = sCompleted * s.price;
            const avgMonthly = Math.round((sAppts.length / 12) * 10) / 10;
            csvContent += `"${s.name}","$${s.price}","${s.duration}","${sAppts.length}","${sCompleted}","$${sRevenue}","${avgMonthly}"\n`;
          });
        }

        // Write file and share
        const fileUri = FileSystem.documentDirectory + fileName;
        await FileSystem.writeAsStringAsync(fileUri, csvContent, {
          encoding: FileSystem.EncodingType.UTF8,
        });

        if (Platform.OS === "web") {
          // On web, create a download link
          const blob = new Blob([csvContent], { type: "text/csv" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = fileName;
          a.click();
          URL.revokeObjectURL(url);
          Alert.alert("Report Downloaded", `${fileName} has been downloaded.`);
        } else {
          const available = await Sharing.isAvailableAsync();
          if (available) {
            await Sharing.shareAsync(fileUri, {
              mimeType: "text/csv",
              dialogTitle: `Share ${fileName}`,
            });
          } else {
            Alert.alert("Report Saved", `Report saved to: ${fileUri}`);
          }
        }
      } catch (error) {
        Alert.alert("Error", "Failed to generate report. Please try again.");
      } finally {
        setGenerating(false);
      }
    },
    [state, getServiceById, getClientById, filterAppointmentsByLocation, clientsForActiveLocation]
  );

  const getReportType = (): string => {
    if (tab === "revenue") return "full";
    return tab ?? "full";
  };

  const getReportLabel = (): string => {
    switch (tab) {
      case "clients":
        return "Client Report";
      case "appointments":
        return "Appointment Report";
      case "revenue":
        return "Tax / Year-End Report";
      case "topservice":
        return "Service Performance Report";
      default:
        return "Year-End Report";
    }
  };

  return (
    <ScreenContainer tabletMaxWidth={900} edges={["top", "bottom", "left", "right"]}>
      <View
        style={[
          styles.header,
          { paddingHorizontal: hp, borderBottomColor: colors.border },
        ]}
      >
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
        >
          <IconSymbol name="arrow.left" size={24} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>
          {titles[tab ?? ""] ?? "Analytics"}
        </Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: hp, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Location Switcher — uses global activeLocationId */}
        {hasMultiLoc && (
          <View style={{ marginTop: 12, marginBottom: 4 }}>
            <LocationSwitcher showAll />
          </View>
        )}

        {/* ─── Report Generation Button ─── */}
        <Pressable
          onPress={() => generateYearEndReport(getReportType())}
          disabled={generating}
          style={({ pressed }) => [
            styles.reportButton,
            {
              backgroundColor: colors.primary,
              opacity: pressed || generating ? 0.7 : 1,
            },
          ]}
        >
          {generating ? (
            <ActivityIndicator color="#FFF" size="small" />
          ) : (
            <IconSymbol name="doc.text.fill" size={18} color="#FFF" />
          )}
          <Text style={styles.reportButtonText}>
            {generating ? "Generating..." : `Generate ${getReportLabel()}`}
          </Text>
          <IconSymbol name="square.and.arrow.up" size={16} color="#FFF" />
        </Pressable>

        {/* Overview Tab */}
        {tab === "overview" && (
          <View>
            {/* KPI Grid */}
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 12 }}>
              {[
                { label: "Total Revenue", value: `$${totalRevenue.toLocaleString()}`, color: "#FF9800", bg: "#FFF3E0" },
                { label: "Avg / Appt", value: `$${overviewData.avgRevenue}`, color: "#FF9800", bg: "#FFF3E0" },
                { label: "Total Clients", value: overviewData.totalClients, color: "#4CAF50", bg: "#E8F5E9" },
                { label: "New (30d)", value: overviewData.newClientsLast30, color: "#4CAF50", bg: "#E8F5E9" },
                { label: "Completed", value: overviewData.completed, color: "#2196F3", bg: "#E3F2FD" },
                { label: "Completion %", value: `${overviewData.completionRate}%`, color: "#2196F3", bg: "#E3F2FD" },
                { label: "Cancelled", value: overviewData.cancelled, color: "#EF4444", bg: "#FEF2F2" },
                { label: "Cancel Rate", value: `${overviewData.cancellationRate}%`, color: "#EF4444", bg: "#FEF2F2" },
              ].map((kpi) => (
                <View key={kpi.label} style={[styles.kpiCard, { backgroundColor: kpi.bg, borderColor: kpi.color + "30" }]}>
                  <Text style={{ fontSize: 22, fontWeight: "800", color: kpi.color }}>{String(kpi.value)}</Text>
                  <Text style={{ fontSize: 11, color: kpi.color + "CC", marginTop: 2 }}>{kpi.label}</Text>
                </View>
              ))}
            </View>

            {/* Revenue Trend — last 6 months */}
            <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={{ fontSize: 15, fontWeight: "700", color: colors.foreground, marginBottom: 12 }}>Revenue — Last 6 Months</Text>
              <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 6, height: 80 }}>
                {overviewData.last6Months.map((m) => (
                  <View key={m.label} style={{ flex: 1, alignItems: "center" }}>
                    <View style={{
                      width: "100%",
                      height: Math.max((m.revenue / overviewData.maxMonthRev) * 64, m.revenue > 0 ? 4 : 0),
                      backgroundColor: colors.primary,
                      borderRadius: 4,
                    }} />
                    <Text style={{ fontSize: 10, color: colors.muted, marginTop: 4 }}>{m.label}</Text>
                    <Text style={{ fontSize: 9, color: colors.primary, fontWeight: "600" }}>
                      {m.revenue > 0 ? `$${Math.round(m.revenue / 1000)}k` : ""}
                    </Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Highlights row */}
            <View style={{ flexDirection: "row", gap: 10 }}>
              <View style={[styles.sectionCard, { flex: 1, backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={{ fontSize: 12, color: colors.muted, marginBottom: 4 }}>Busiest Day</Text>
                <Text style={{ fontSize: 22, fontWeight: "800", color: colors.primary }}>{overviewData.busiestDay}</Text>
              </View>
              <View style={[styles.sectionCard, { flex: 1, backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={{ fontSize: 12, color: colors.muted, marginBottom: 4 }}>Avg Rating</Text>
                <Text style={{ fontSize: 22, fontWeight: "800", color: "#f59e0b" }}>
                  {overviewData.avgRating ? `${overviewData.avgRating} ★` : "—"}
                </Text>
                {overviewData.reviewCount > 0 && (
                  <Text style={{ fontSize: 10, color: colors.muted }}>{overviewData.reviewCount} reviews</Text>
                )}
              </View>
            </View>

            {/* Top Client */}
            {overviewData.topClient && (
              <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={{ fontSize: 13, fontWeight: "700", color: colors.foreground, marginBottom: 8 }}>Top Client</Text>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <View style={[styles.avatar, { backgroundColor: "#4CAF5018" }]}>
                    <Text style={{ fontSize: 16, fontWeight: "700", color: "#4CAF50" }}>{overviewData.topClient.name.charAt(0).toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={{ fontSize: 15, fontWeight: "600", color: colors.foreground }}>{overviewData.topClient.name}</Text>
                    <Text style={{ fontSize: 12, color: colors.muted }}>{overviewData.topClient.apptCount} appointments · ${overviewData.topClient.totalSpent} spent</Text>
                  </View>
                </View>
              </View>
            )}

            {/* Top Service */}
            {overviewData.topService && (
              <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={{ fontSize: 13, fontWeight: "700", color: colors.foreground, marginBottom: 8 }}>Top Service</Text>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <View style={[styles.avatar, { backgroundColor: overviewData.topService.color + "18" }]}>
                    <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: overviewData.topService.color }} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={{ fontSize: 15, fontWeight: "600", color: colors.foreground }}>{overviewData.topService.name}</Text>
                    <Text style={{ fontSize: 12, color: colors.muted }}>{overviewData.topService.bookings} bookings · ${overviewData.topService.price}</Text>
                  </View>
                </View>
              </View>
            )}

            {/* Quick nav to detailed tabs */}
            <Text style={{ fontSize: 13, fontWeight: "700", color: colors.muted, marginTop: 8, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>Detailed Reports</Text>
            {[
              { label: "Clients", tab: "clients", icon: "person.2.fill" as const, color: "#4CAF50" },
              { label: "Appointments", tab: "appointments", icon: "calendar" as const, color: "#2196F3" },
              { label: "Revenue", tab: "revenue", icon: "chart.bar.fill" as const, color: "#FF9800" },
              { label: "Top Services", tab: "topservice", icon: "crown.fill" as const, color: "#9C27B0" },
            ].map((item) => (
              <Pressable
                key={item.tab}
                onPress={() => router.replace({ pathname: "/analytics-detail", params: { tab: item.tab } })}
                style={({ pressed }) => [styles.listItem, { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.8 : 1 }]}
              >
                <View style={[styles.avatar, { backgroundColor: item.color + "18" }]}>
                  <IconSymbol name={item.icon} size={18} color={item.color} />
                </View>
                <Text style={{ flex: 1, marginLeft: 12, fontSize: 15, fontWeight: "600", color: colors.foreground }}>{item.label}</Text>
                <IconSymbol name="chevron.right" size={16} color={colors.muted} />
              </Pressable>
            ))}
          </View>
        )}

        {/* Clients Tab */}
        {tab === "clients" && (
          <View>
            <View
              style={[
                styles.summaryCard,
                { backgroundColor: "#E8F5E9", borderColor: "#4CAF5030" },
              ]}
            >
              <Text style={{ fontSize: 36, fontWeight: "800", color: "#4CAF50" }}>
                {clientsForActiveLocation.length}
              </Text>
              <Text style={{ fontSize: 14, color: "#4CAF50CC", marginTop: 4 }}>
                Total Clients
              </Text>
            </View>
            {/* Quick stats */}
            <View style={styles.quickStats}>
              <View style={[styles.quickStatCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={{ fontSize: 20, fontWeight: "700", color: colors.primary }}>
                  {clientsData.filter((c) => c.apptCount > 0).length}
                </Text>
                <Text style={{ fontSize: 11, color: colors.muted }}>Active</Text>
              </View>
              <View style={[styles.quickStatCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={{ fontSize: 20, fontWeight: "700", color: "#FF9800" }}>
                  ${clientsData.reduce((s, c) => s + c.totalSpent, 0).toLocaleString()}
                </Text>
                <Text style={{ fontSize: 11, color: colors.muted }}>Total Spent</Text>
              </View>
            </View>
            {clientsData.map((c) => (
              <Pressable
                key={c.id}
                onPress={() =>
                  router.push({
                    pathname: "/client-detail",
                    params: { id: c.id },
                  })
                }
                style={({ pressed }) => [
                  styles.listItem,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
              >
                <View
                  style={[styles.avatar, { backgroundColor: colors.primary + "18" }]}
                >
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: "700",
                      color: colors.primary,
                    }}
                  >
                    {c.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text
                    style={{
                      fontSize: 15,
                      fontWeight: "600",
                      color: colors.foreground,
                    }}
                  >
                    {c.name}
                  </Text>
                  <Text style={{ fontSize: 12, color: colors.muted }}>
                    {c.phone || c.email || "No contact info"}
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <View
                    style={[
                      styles.countBadge,
                      { backgroundColor: colors.primary + "15" },
                    ]}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: "600",
                        color: colors.primary,
                      }}
                    >
                      {c.apptCount} appts
                    </Text>
                  </View>
                  {c.totalSpent > 0 && (
                    <Text style={{ fontSize: 11, color: "#FF9800", fontWeight: "600", marginTop: 4 }}>
                      ${c.totalSpent}
                    </Text>
                  )}
                </View>
              </Pressable>
            ))}
          </View>
        )}

        {/* Appointments Tab */}
        {tab === "appointments" && (
          <View>
            <View
              style={[
                styles.summaryCard,
                { backgroundColor: "#E3F2FD", borderColor: "#2196F330" },
              ]}
            >
              <Text style={{ fontSize: 36, fontWeight: "800", color: "#2196F3" }}>
                {state.appointments.filter((a) => a.status !== "cancelled").length}
              </Text>
              <Text style={{ fontSize: 14, color: "#2196F3CC", marginTop: 4 }}>
                Total Appointments
              </Text>
            </View>
            {/* Status breakdown */}
            <View style={styles.quickStats}>
              <View style={[styles.quickStatCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={{ fontSize: 18, fontWeight: "700", color: "#4CAF50" }}>
                  {state.appointments.filter((a) => a.status === "completed").length}
                </Text>
                <Text style={{ fontSize: 10, color: colors.muted }}>Completed</Text>
              </View>
              <View style={[styles.quickStatCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={{ fontSize: 18, fontWeight: "700", color: "#2196F3" }}>
                  {state.appointments.filter((a) => a.status === "confirmed").length}
                </Text>
                <Text style={{ fontSize: 10, color: colors.muted }}>Confirmed</Text>
              </View>
              <View style={[styles.quickStatCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={{ fontSize: 18, fontWeight: "700", color: "#FF9800" }}>
                  {state.appointments.filter((a) => a.status === "pending").length}
                </Text>
                <Text style={{ fontSize: 10, color: colors.muted }}>Pending</Text>
              </View>
              <View style={[styles.quickStatCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={{ fontSize: 18, fontWeight: "700", color: "#EF4444" }}>
                  {state.appointments.filter((a) => a.status === "cancelled").length}
                </Text>
                <Text style={{ fontSize: 10, color: colors.muted }}>Cancelled</Text>
              </View>
            </View>
            <View style={styles.barChart}>
              {appointmentsData.map((m) => {
                const total = m.confirmed + m.completed + m.pending;
                const monthLabel = new Date(m.month + "-01").toLocaleDateString(
                  "en-US",
                  { month: "short", year: "2-digit" }
                );
                return (
                  <View key={m.month} style={styles.barRow}>
                    <Text style={{ width: 60, fontSize: 12, color: colors.muted }}>
                      {monthLabel}
                    </Text>
                    <View style={styles.barTrack}>
                      <View
                        style={[
                          styles.barFill,
                          {
                            width: `${Math.max(
                              (m.completed / Math.max(total + m.cancelled, 1)) * 100,
                              0
                            )}%`,
                            backgroundColor: "#4CAF50",
                          },
                        ]}
                      />
                      <View
                        style={[
                          styles.barFill,
                          {
                            width: `${Math.max(
                              (m.confirmed / Math.max(total + m.cancelled, 1)) * 100,
                              0
                            )}%`,
                            backgroundColor: "#2196F3",
                          },
                        ]}
                      />
                      <View
                        style={[
                          styles.barFill,
                          {
                            width: `${Math.max(
                              (m.pending / Math.max(total + m.cancelled, 1)) * 100,
                              0
                            )}%`,
                            backgroundColor: "#FF9800",
                          },
                        ]}
                      />
                    </View>
                    <Text
                      style={{
                        width: 30,
                        fontSize: 12,
                        color: colors.foreground,
                        textAlign: "right",
                        fontWeight: "600",
                      }}
                    >
                      {total}
                    </Text>
                  </View>
                );
              })}
            </View>
            <View style={styles.legend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: "#4CAF50" }]} />
                <Text style={{ fontSize: 11, color: colors.muted }}>Completed</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: "#2196F3" }]} />
                <Text style={{ fontSize: 11, color: colors.muted }}>Confirmed</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: "#FF9800" }]} />
                <Text style={{ fontSize: 11, color: colors.muted }}>Pending</Text>
              </View>
            </View>
            {appointmentsData.length === 0 && (
              <Text
                style={{
                  textAlign: "center",
                  color: colors.muted,
                  marginTop: 20,
                }}
              >
                No appointment data yet
              </Text>
            )}
          </View>
        )}

        {/* Revenue Tab */}
        {tab === "revenue" && (
          <View>
            <View
              style={[
                styles.summaryCard,
                { backgroundColor: "#FFF3E0", borderColor: "#FF980030" },
              ]}
            >
              <Text style={{ fontSize: 36, fontWeight: "800", color: "#FF9800" }}>
                ${totalRevenue.toLocaleString()}
              </Text>
              <Text style={{ fontSize: 14, color: "#FF9800CC", marginTop: 4 }}>
                Total Revenue
              </Text>
            </View>
            {/* Revenue quick stats */}
            <View style={styles.quickStats}>
              <View style={[styles.quickStatCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={{ fontSize: 18, fontWeight: "700", color: colors.primary }}>
                  {state.appointments.filter((a) => a.status === "completed").length}
                </Text>
                <Text style={{ fontSize: 10, color: colors.muted }}>Paid Appts</Text>
              </View>
              <View style={[styles.quickStatCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={{ fontSize: 18, fontWeight: "700", color: "#FF9800" }}>
                  ${state.appointments.filter((a) => a.status === "completed").length > 0
                    ? Math.round(totalRevenue / state.appointments.filter((a) => a.status === "completed").length)
                    : 0}
                </Text>
                <Text style={{ fontSize: 10, color: colors.muted }}>Avg/Appt</Text>
              </View>
            </View>
            {revenueData.map((r) => (
              <View
                key={r.name}
                style={[
                  styles.listItem,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                <View style={[styles.avatar, { backgroundColor: r.color + "18" }]}>
                  <View
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: 6,
                      backgroundColor: r.color,
                    }}
                  />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text
                    style={{
                      fontSize: 15,
                      fontWeight: "600",
                      color: colors.foreground,
                    }}
                  >
                    {r.name}
                  </Text>
                  <Text style={{ fontSize: 12, color: colors.muted }}>
                    {r.count} completed
                  </Text>
                </View>
                <Text
                  style={{ fontSize: 16, fontWeight: "700", color: "#FF9800" }}
                >
                  ${r.revenue.toLocaleString()}
                </Text>
              </View>
            ))}
            {revenueData.length === 0 && (
              <Text
                style={{
                  textAlign: "center",
                  color: colors.muted,
                  marginTop: 20,
                }}
              >
                No revenue data yet. Complete appointments to track revenue.
              </Text>
            )}
          </View>
        )}

        {/* Top Service Tab */}
        {tab === "topservice" && (
          <View>
            <View
              style={[
                styles.summaryCard,
                { backgroundColor: "#F3E5F5", borderColor: "#9C27B030" },
              ]}
            >
              {serviceRanking.length > 0 ? (
                <>
                  <IconSymbol name="crown.fill" size={28} color="#9C27B0" />
                  <Text
                    style={{
                      fontSize: 24,
                      fontWeight: "800",
                      color: "#9C27B0",
                      marginTop: 8,
                    }}
                  >
                    {serviceRanking[0].name}
                  </Text>
                  <Text
                    style={{
                      fontSize: 14,
                      color: "#9C27B0CC",
                      marginTop: 4,
                    }}
                  >
                    {serviceRanking[0].bookings} bookings
                  </Text>
                </>
              ) : (
                <Text style={{ fontSize: 14, color: "#9C27B0CC" }}>
                  No services yet
                </Text>
              )}
            </View>
            {serviceRanking.map((s, idx) => (
              <View
                key={s.id}
                style={[
                  styles.listItem,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                <View
                  style={[
                    styles.rankBadge,
                    {
                      backgroundColor:
                        idx === 0
                          ? "#FFD700"
                          : idx === 1
                          ? "#C0C0C0"
                          : idx === 2
                          ? "#CD7F32"
                          : colors.muted + "30",
                    },
                  ]}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: "700",
                      color: idx < 3 ? "#FFF" : colors.muted,
                    }}
                  >
                    #{idx + 1}
                  </Text>
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text
                    style={{
                      fontSize: 15,
                      fontWeight: "600",
                      color: colors.foreground,
                    }}
                  >
                    {s.name}
                  </Text>
                  <Text style={{ fontSize: 12, color: colors.muted }}>
                    ${s.price} · {s.duration} min
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: "700",
                      color: "#9C27B0",
                    }}
                  >
                    {s.bookings}
                  </Text>
                  <Text style={{ fontSize: 10, color: colors.muted }}>
                    bookings
                  </Text>
                </View>
                <View
                  style={[
                    styles.barSmall,
                    {
                      width: `${(s.bookings / maxBar) * 100}%`,
                      backgroundColor: s.color + "30",
                    },
                  ]}
                />
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  reportButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 16,
    marginBottom: 4,
  },
  reportButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFF",
  },
  summaryCard: {
    alignItems: "center",
    paddingVertical: 28,
    borderRadius: 20,
    borderWidth: 1,
    marginVertical: 16,
  },
  kpiCard: {
    width: "47%",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRadius: 16,
    borderWidth: 1,
  },
  sectionCard: {
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 10,
  },
  quickStats: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  quickStatCard: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  listItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 8,
    overflow: "hidden",
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  countBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  rankBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  barChart: {
    marginTop: 12,
  },
  barRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  barTrack: {
    flex: 1,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#E0E0E0",
    flexDirection: "row",
    overflow: "hidden",
    marginHorizontal: 8,
  },
  barFill: {
    height: 16,
  },
  barSmall: {
    position: "absolute",
    bottom: 0,
    left: 0,
    height: 3,
    borderRadius: 2,
  },
  legend: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 16,
    marginTop: 8,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
