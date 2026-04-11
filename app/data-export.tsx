import { Text, View, Pressable, StyleSheet, Alert, ScrollView, useWindowDimensions } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useStore } from "@/lib/store";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useRouter } from "expo-router";

const EXPORT_ITEMS = [
  { key: "Clients", icon: "person.2.fill" as const, desc: "Client list with contact info and visit history" },
  { key: "Appointments", icon: "calendar" as const, desc: "All appointments with dates, services, and pricing" },
  { key: "Services", icon: "list.bullet" as const, desc: "Service catalog with pricing and booking counts" },
  { key: "Revenue", icon: "dollarsign.circle.fill" as const, desc: "Revenue breakdown by period and service" },
];

export default function DataExportScreen() {
  const { state } = useStore();
  const colors = useColors();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const hp = isTablet ? 32 : Math.round(Math.max(16, width * 0.045));

  const handleExport = async (label: string) => {
    try {
      const { generateClientsPdf, generateAppointmentsPdf, generateServicesPdf, generateRevenuePdf, exportPdf } = await import("@/lib/pdf-export");
      const accent = colors.primary;
      const bizName = state.settings.businessName;
      let html = "";
      if (label === "Clients") {
        html = generateClientsPdf(bizName, state.clients, accent);
      } else if (label === "Appointments") {
        html = generateAppointmentsPdf(bizName, state.appointments, state.services, state.clients, accent);
      } else if (label === "Services") {
        html = generateServicesPdf(bizName, state.services, state.appointments, accent);
      } else {
        html = generateRevenuePdf(bizName, state.appointments, state.services, accent);
      }
      await exportPdf(html, `${bizName}_${label}_Report.pdf`);
    } catch (err) {
      Alert.alert("Export Error", "Failed to generate PDF report");
    }
  };

  return (
    <ScreenContainer edges={["top", "left", "right"]} tabletMaxWidth={isTablet ? 720 : 0}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border, paddingHorizontal: hp }]}>
        <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.backBtn, { opacity: pressed ? 0.6 : 1 }]}>
          <IconSymbol name="arrow.left" size={22} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Export Data</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: hp, paddingVertical: 16, paddingBottom: 40 }}>
        <Text style={{ fontSize: 13, color: colors.muted, marginBottom: 16, lineHeight: 20 }}>
          Generate professional PDF reports for your business data. Reports include your business branding and current data.
        </Text>

        {EXPORT_ITEMS.map((item) => (
          <Pressable
            key={item.key}
            onPress={() => handleExport(item.key)}
            style={({ pressed }) => [
              styles.exportCard,
              { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <View style={[styles.iconWrap, { backgroundColor: colors.primary + "15" }]}>
              <IconSymbol name={item.icon} size={22} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: "600", color: colors.foreground }}>{item.key} Report</Text>
              <Text style={{ fontSize: 12, color: colors.muted, marginTop: 3, lineHeight: 17 }}>{item.desc}</Text>
            </View>
            <IconSymbol name="square.and.arrow.up.fill" size={18} color={colors.primary} />
          </Pressable>
        ))}

        {/* Quick Stats */}
        <View style={[styles.statsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={{ fontSize: 12, fontWeight: "500", color: colors.muted, marginBottom: 12 }}>Data Summary</Text>
          <View style={styles.statsGrid}>
            {[
              { label: "Services", count: state.services.length },
              { label: "Clients", count: state.clients.length },
              { label: "Appointments", count: state.appointments.length },
              { label: "Reviews", count: state.reviews.length },
            ].map((s) => (
              <View key={s.label} style={styles.statItem}>
                <Text style={[styles.statNum, { color: colors.primary }]}>{s.count}</Text>
                <Text style={{ fontSize: 11, color: colors.muted }}>{s.label}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 0.5 },
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 17, fontWeight: "700" },
  exportCard: { flexDirection: "row", alignItems: "center", borderRadius: 16, padding: 16, borderWidth: 1, marginBottom: 12, gap: 14 },
  iconWrap: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  statsCard: { borderRadius: 16, padding: 16, borderWidth: 1, marginTop: 8 },
  statsGrid: { flexDirection: "row", justifyContent: "space-between" },
  statItem: { flex: 1, alignItems: "center" },
  statNum: { fontSize: 22, fontWeight: "700", lineHeight: 28 },
});
