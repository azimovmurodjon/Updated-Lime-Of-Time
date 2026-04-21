/**
 * Client Portal — Appointment Detail Screen
 *
 * Shows full appointment details, cancel/reschedule request options,
 * and a link to the message thread.
 */

import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useClientStore, ClientAppointment } from "@/lib/client-store";
import { IconSymbol } from "@/components/ui/icon-symbol";
import * as Haptics from "expo-haptics";

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

function statusColor(status: ClientAppointment["status"], colors: ReturnType<typeof useColors>) {
  switch (status) {
    case "confirmed": return colors.success;
    case "pending": return colors.warning;
    case "completed": return colors.muted;
    case "cancelled":
    case "no_show": return colors.error;
    default: return colors.muted;
  }
}

function statusLabel(status: ClientAppointment["status"]): string {
  switch (status) {
    case "confirmed": return "Confirmed";
    case "pending": return "Pending Approval";
    case "completed": return "Completed";
    case "cancelled": return "Cancelled";
    case "no_show": return "No Show";
    default: return status;
  }
}

export default function ClientAppointmentDetailScreen() {
  const colors = useColors();
  const router = useRouter();
  const { id, new: isNew } = useLocalSearchParams<{ id: string; new?: string }>();
  const { state, apiCall, dispatch } = useClientStore();
  const [appt, setAppt] = useState<ClientAppointment | null>(null);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await apiCall<ClientAppointment>(`/api/client/appointments/${id}`);
        setAppt(data);
      } catch (err) {
        console.warn("[ApptDetail] load error:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const handleCancelRequest = () => {
    Alert.alert(
      "Request Cancellation",
      "Send a cancellation request to the business? They will need to approve it.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Send Request",
          style: "destructive",
          onPress: async () => {
            if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            setRequesting(true);
            try {
              await apiCall(`/api/client/appointments/${id}/cancel-request`, { method: "POST" });
              const updated = await apiCall<ClientAppointment>(`/api/client/appointments/${id}`);
              setAppt(updated);
            } catch (err: any) {
              Alert.alert("Error", err?.message ?? "Could not send request.");
            } finally {
              setRequesting(false);
            }
          },
        },
      ]
    );
  };

  const s = styles(colors);

  if (loading) {
    return (
      <ScreenContainer>
        <View style={s.loadingContainer}>
          <ActivityIndicator size="large" color="#8B5CF6" />
        </View>
      </ScreenContainer>
    );
  }

  if (!appt) {
    return (
      <ScreenContainer className="px-6">
        <View style={s.loadingContainer}>
          <Text style={{ color: colors.foreground }}>Appointment not found.</Text>
          <Pressable onPress={() => router.back()} style={{ marginTop: 16 }}>
            <Text style={{ color: "#8B5CF6" }}>Go back</Text>
          </Pressable>
        </View>
      </ScreenContainer>
    );
  }

  const canCancel = appt.status === "confirmed" || appt.status === "pending";
  const hasPendingCancel = appt.cancelRequest?.status === "pending";
  const hasPendingReschedule = appt.rescheduleRequest?.status === "pending";

  return (
    <ScreenContainer>
      {/* Header */}
      <View style={s.header}>
        <Pressable style={({ pressed }) => [s.backBtn, pressed && { opacity: 0.7 }]} onPress={() => router.back()}>
          <IconSymbol name="chevron.left" size={20} color={colors.foreground} />
        </Pressable>
        <Text style={[s.headerTitle, { color: colors.foreground }]}>Appointment</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}>
        {/* New booking success banner */}
        {isNew === "1" && (
          <View style={[s.successBanner, { backgroundColor: colors.success + "20" }]}>
            <IconSymbol name="checkmark.circle.fill" size={20} color={colors.success} />
            <Text style={[s.successText, { color: colors.success }]}>Booking request sent! The business will confirm shortly.</Text>
          </View>
        )}

        {/* Status Badge */}
        <View style={[s.statusCard, { backgroundColor: statusColor(appt.status, colors) + "15" }]}>
          <View style={[s.statusDot, { backgroundColor: statusColor(appt.status, colors) }]} />
          <Text style={[s.statusText, { color: statusColor(appt.status, colors) }]}>{statusLabel(appt.status)}</Text>
        </View>

        {/* Main Info Card */}
        <View style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[s.serviceName, { color: colors.foreground }]}>{appt.serviceName}</Text>
          <Text style={[s.businessName, { color: "#8B5CF6" }]}>{appt.businessName}</Text>

          <View style={[s.divider, { backgroundColor: colors.border }]} />

          <InfoRow icon="calendar" label="Date" value={formatDate(appt.date)} colors={colors} />
          <InfoRow icon="clock" label="Time" value={appt.time} colors={colors} />
          {appt.duration && (
            <InfoRow icon="timer" label="Duration" value={`${appt.duration} min`} colors={colors} />
          )}
          {appt.staffName && (
            <InfoRow icon="person.fill" label="Staff" value={appt.staffName} colors={colors} />
          )}
          {appt.totalPrice != null && (
            <InfoRow icon="creditcard.fill" label="Price" value={`$${parseFloat(appt.totalPrice).toFixed(2)}`} colors={colors} />
          )}
          {appt.notes && (
            <InfoRow icon="note.text" label="Notes" value={appt.notes} colors={colors} />
          )}
        </View>

        {/* Pending request banners */}
        {hasPendingCancel && (
          <View style={[s.requestBanner, { backgroundColor: colors.warning + "20", borderColor: colors.warning + "40" }]}>
            <IconSymbol name="clock" size={16} color={colors.warning} />
            <Text style={[s.requestBannerText, { color: colors.warning }]}>
              Cancellation request pending — awaiting business response.
            </Text>
          </View>
        )}
        {hasPendingReschedule && (
          <View style={[s.requestBanner, { backgroundColor: colors.warning + "20", borderColor: colors.warning + "40" }]}>
            <IconSymbol name="clock" size={16} color={colors.warning} />
            <Text style={[s.requestBannerText, { color: colors.warning }]}>
              Reschedule request pending — awaiting business response.
            </Text>
          </View>
        )}

        {/* Actions */}
        <View style={s.actions}>
          {/* Message Business */}
          <Pressable
            style={({ pressed }) => [s.actionBtn, { backgroundColor: "#8B5CF6" }, pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] }]}
            onPress={() => router.push({ pathname: "/client-message-thread", params: { appointmentId: String(appt.id) } } as any)}
          >
            <IconSymbol name="text.bubble.fill" size={18} color="#FFFFFF" />
            <Text style={[s.actionBtnText, { color: "#FFFFFF" }]}>Message Business</Text>
          </Pressable>

          {/* Cancel Request */}
          {canCancel && !hasPendingCancel && !hasPendingReschedule && (
            <Pressable
              style={({ pressed }) => [
                s.actionBtn,
                { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.error },
                pressed && { opacity: 0.85 },
                requesting && { opacity: 0.6 },
              ]}
              onPress={handleCancelRequest}
              disabled={requesting}
            >
              {requesting ? (
                <ActivityIndicator size="small" color={colors.error} />
              ) : (
                <IconSymbol name="xmark.circle" size={18} color={colors.error} />
              )}
              <Text style={[s.actionBtnText, { color: colors.error }]}>Request Cancellation</Text>
            </Pressable>
          )}

          {/* View Business */}
          {appt.businessSlug && (
            <Pressable
              style={({ pressed }) => [s.actionBtn, { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }, pressed && { opacity: 0.85 }]}
              onPress={() => router.push({ pathname: "/client-business-detail", params: { slug: appt.businessSlug } } as any)}
            >
              <IconSymbol name="safari.fill" size={18} color={colors.foreground} />
              <Text style={[s.actionBtnText, { color: colors.foreground }]}>View Business</Text>
            </Pressable>
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

function InfoRow({ icon, label, value, colors }: { icon: string; label: string; value: string; colors: ReturnType<typeof useColors> }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10, paddingVertical: 8 }}>
      <IconSymbol name={icon as any} size={16} color={colors.muted} style={{ marginTop: 1 }} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.muted, fontSize: 12 }}>{label}</Text>
        <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "500", marginTop: 1 }}>{value}</Text>
      </View>
    </View>
  );
}

const styles = (colors: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center" },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
    backBtn: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
    headerTitle: { fontSize: 17, fontWeight: "600" },
    successBanner: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14, borderRadius: 12, marginBottom: 16 },
    successText: { flex: 1, fontSize: 13, lineHeight: 18 },
    statusCard: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, borderRadius: 12, marginBottom: 16 },
    statusDot: { width: 8, height: 8, borderRadius: 4 },
    statusText: { fontSize: 14, fontWeight: "700" },
    card: { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 16, gap: 4 },
    serviceName: { fontSize: 20, fontWeight: "700" },
    businessName: { fontSize: 14, fontWeight: "600", marginBottom: 4 },
    divider: { height: 1, marginVertical: 8 },
    requestBanner: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 12, borderWidth: 1, marginBottom: 12 },
    requestBannerText: { flex: 1, fontSize: 13, lineHeight: 18 },
    actions: { gap: 10 },
    actionBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 14, borderRadius: 14 },
    actionBtnText: { fontSize: 15, fontWeight: "600" },
  });
