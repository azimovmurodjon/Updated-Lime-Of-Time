import { Text, View, Pressable, StyleSheet, ScrollView, Alert, Platform, Linking } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useStore, formatTime, formatDateDisplay } from "@/lib/store";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useMemo } from "react";
import {
  minutesToTime,
  timeToMinutes,
  formatTimeDisplay,
  getServiceDisplayName,
  getMapUrl,
  stripPhoneFormat,
  generateAcceptMessage,
  generateRejectMessage,
  generateCancellationMessage,
  generateReminderMessage,
} from "@/lib/types";

export default function AppointmentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state, dispatch, getServiceById, getClientById, syncToDb } = useStore();
  const colors = useColors();
  const router = useRouter();

  const appointment = useMemo(
    () => state.appointments.find((a) => a.id === id),
    [state.appointments, id]
  );

  if (!appointment) {
    return (
      <ScreenContainer edges={["top", "bottom", "left", "right"]} className="p-5">
        <Pressable onPress={() => router.back()} style={({ pressed }) => [{ opacity: pressed ? 0.5 : 1 }]}>
          <IconSymbol name="arrow.left" size={24} color={colors.foreground} />
        </Pressable>
        <View className="flex-1 items-center justify-center">
          <Text className="text-base text-muted">Appointment not found</Text>
        </View>
      </ScreenContainer>
    );
  }

  const service = getServiceById(appointment.serviceId);
  const client = getClientById(appointment.clientId);
  const endTimeStr = formatTime(minutesToTime(timeToMinutes(appointment.time) + appointment.duration));
  const policy = state.settings.cancellationPolicy;
  const biz = state.settings;
  const profile = biz.profile;

  const openSms = (phone: string, message: string) => {
    const rawPhone = stripPhoneFormat(phone);
    if (Platform.OS === "web") {
      Alert.alert("SMS Message", message);
      return;
    }
    const separator = Platform.OS === "ios" ? "&" : "?";
    const url = `sms:${rawPhone}${separator}body=${encodeURIComponent(message)}`;
    Linking.openURL(url).catch(() => Alert.alert("SMS", message));
  };

  const getCancellationInfo = () => {
    if (!policy.enabled) return { feeApplies: false, fee: 0 };
    const apptDateTime = new Date(`${appointment.date}T${appointment.time}:00`);
    const now = new Date();
    const hoursUntil = (apptDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);
    const feeApplies = hoursUntil <= policy.hoursBeforeAppointment;
    const fee = feeApplies ? Math.round((service?.price ?? 0) * policy.feePercentage / 100) : 0;
    return { feeApplies, fee };
  };

  const handleAccept = () => {
    dispatch({ type: "UPDATE_APPOINTMENT_STATUS", payload: { id: appointment.id, status: "confirmed" } });
    syncToDb({ type: "UPDATE_APPOINTMENT_STATUS", payload: { id: appointment.id, status: "confirmed" } });
    if (client?.phone) {
      const msg = generateAcceptMessage(
        biz.businessName,
        profile.address,
        client.name,
        service ? getServiceDisplayName(service) : "Service",
        appointment.duration,
        appointment.date,
        appointment.time,
        profile.phone
      );
      openSms(client.phone, msg);
    }
    router.back();
  };

  const handleStatusChange = (status: "completed" | "cancelled") => {
    const cancInfo = getCancellationInfo();
    const doIt = () => {
      dispatch({ type: "UPDATE_APPOINTMENT_STATUS", payload: { id: appointment.id, status } });
      syncToDb({ type: "UPDATE_APPOINTMENT_STATUS", payload: { id: appointment.id, status } });
      if (client?.phone) {
        let msg = "";
        if (status === "completed") {
          msg = `Dear ${client.name},\n\nThank you for visiting ${biz.businessName}! Your appointment for ${service ? getServiceDisplayName(service) : "service"} on ${formatDateDisplay(appointment.date)} has been completed.\n\nWe hope you had a great experience. We'd love to see you again!\n\n📍 ${profile.address}\n📞 ${profile.phone}\n\nBest regards,\n${biz.businessName}`;
        } else {
          const feeStr = cancInfo.feeApplies && cancInfo.fee > 0 ? `$${cancInfo.fee} (${policy.feePercentage}%)` : "";
          msg = generateCancellationMessage(
            biz.businessName,
            client.name,
            service ? getServiceDisplayName(service) : "Service",
            appointment.date,
            appointment.time,
            feeStr,
            profile.phone
          );
        }
        openSms(client.phone, msg);
      }
      router.back();
    };
    if (Platform.OS === "web") {
      doIt();
    } else {
      let alertMsg = `Are you sure you want to mark this appointment as ${status}?`;
      if (status === "cancelled" && cancInfo.feeApplies && cancInfo.fee > 0) {
        alertMsg += `\n\nA cancellation fee of $${cancInfo.fee} (${policy.feePercentage}%) applies.`;
      }
      Alert.alert(
        status === "completed" ? "Complete Appointment" : "Cancel Appointment",
        alertMsg,
        [
          { text: "No", style: "cancel" },
          { text: "Yes", onPress: doIt },
        ]
      );
    }
  };

  const handleDelete = () => {
    const doIt = () => {
      dispatch({ type: "DELETE_APPOINTMENT", payload: appointment.id });
      syncToDb({ type: "DELETE_APPOINTMENT", payload: appointment.id });
      router.back();
    };
    if (Platform.OS === "web") {
      doIt();
    } else {
      Alert.alert("Delete Appointment", "This action cannot be undone.", [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: doIt },
      ]);
    }
  };

  const handleSendReminder = () => {
    if (!client?.phone) return;
    const msg = generateReminderMessage(
      biz.businessName,
      profile.address,
      client.name,
      service ? getServiceDisplayName(service) : "Service",
      appointment.duration,
      appointment.date,
      appointment.time,
      profile.phone
    );
    openSms(client.phone, msg);
  };

  const handleOpenMap = () => {
    if (!profile.address) return;
    const url = getMapUrl(profile.address);
    Linking.openURL(url).catch(() => {});
  };

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]} className="p-5">
      {/* Header */}
      <View className="flex-row items-center mb-6" style={{ paddingTop: 8 }}>
        <Pressable onPress={() => router.back()} style={({ pressed }) => [{ opacity: pressed ? 0.5 : 1 }]}>
          <IconSymbol name="arrow.left" size={24} color={colors.foreground} />
        </Pressable>
        <Text className="text-xl font-bold text-foreground ml-4">Appointment</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Service Card */}
        <View
          className="rounded-2xl p-5 mb-4"
          style={{ backgroundColor: (service?.color ?? colors.primary) + "12" }}
        >
          <View className="flex-row items-center mb-2">
            <View style={[styles.colorDot, { backgroundColor: service?.color ?? colors.primary }]} />
            <Text className="text-xl font-bold text-foreground ml-3">
              {service ? getServiceDisplayName(service) : "Service"}
            </Text>
          </View>
          <Text className="text-sm text-muted">
            {appointment.duration} min · ${service?.price ?? 0}
          </Text>
        </View>

        {/* Itemized Charges */}
        {(() => {
          const svcPrice = service?.price ?? 0;
          const extras = appointment.extraItems ?? [];
          const extrasTotal = extras.reduce((s, e) => s + (e.price || 0), 0);
          const giftUsedAmount = appointment.giftUsedAmount ?? 0;
          // Use stored giftUsedAmount; if not available but gift was applied,
          // infer deduction from the difference between subtotal and stored totalPrice
          let giftDeduction = 0;
          if (appointment.giftApplied) {
            if (giftUsedAmount > 0) {
              giftDeduction = giftUsedAmount;
            } else if (appointment.totalPrice != null) {
              // Infer: subtotal - totalPrice = gift deduction
              giftDeduction = Math.max(0, svcPrice + extrasTotal - appointment.totalPrice);
            } else {
              // Last resort: assume full service price was covered by gift
              giftDeduction = svcPrice;
            }
          }
          const computedTotal = appointment.totalPrice != null
            ? appointment.totalPrice
            : Math.max(0, svcPrice + extrasTotal - giftDeduction);
          return (
            <View className="bg-surface rounded-2xl p-4 mb-4 border border-border">
              <Text className="text-xs text-muted mb-2">Charges</Text>
              <View className="flex-row justify-between py-1">
                <Text className="text-sm text-foreground">{service ? getServiceDisplayName(service) : "Service"}</Text>
                <Text className="text-sm font-semibold text-foreground">${svcPrice.toFixed(2)}</Text>
              </View>
              {extras.map((item, idx) => (
                <View key={idx} className="flex-row justify-between py-1">
                  <Text className="text-sm text-foreground">{item.name} ({item.type === "product" ? "Product" : "Service"})</Text>
                  <Text className="text-sm font-semibold text-foreground">${(item.price || 0).toFixed(2)}</Text>
                </View>
              ))}
              {appointment.giftApplied && (
                <View className="flex-row justify-between py-1">
                  <Text className="text-sm" style={{ color: colors.success }}>Gift Card Applied</Text>
                  <Text className="text-sm font-semibold" style={{ color: colors.success }}>-${giftDeduction.toFixed(2)}</Text>
                </View>
              )}
              <View style={{ borderTopWidth: 1, borderTopColor: colors.border, marginTop: 6, paddingTop: 6 }} className="flex-row justify-between">
                <Text className="text-sm font-bold text-foreground">Total Charged</Text>
                <Text className="text-sm font-bold" style={{ color: colors.primary }}>
                  ${computedTotal.toFixed(2)}
                </Text>
              </View>
            </View>
          );
        })()}

        {/* Status */}
        <View className="bg-surface rounded-2xl p-4 mb-4 border border-border">
          <Text className="text-xs text-muted mb-1">Status</Text>
          <View
            className="self-start rounded-full px-3 py-1"
            style={{
              backgroundColor:
                appointment.status === "completed" ? colors.success + "20"
                : appointment.status === "cancelled" ? colors.error + "20"
                : appointment.status === "pending" ? "#FF980020"
                : colors.primary + "20",
            }}
          >
            <Text
              className="text-sm font-semibold capitalize"
              style={{
                color:
                  appointment.status === "completed" ? colors.success
                  : appointment.status === "cancelled" ? colors.error
                  : appointment.status === "pending" ? "#FF9800"
                  : colors.primary,
              }}
            >
              {appointment.status}
            </Text>
          </View>
        </View>

        {/* Details */}
        <View className="bg-surface rounded-2xl p-4 mb-4 border border-border">
          <DetailRow icon="calendar" label="Date" value={formatDateDisplay(appointment.date)} colors={colors} />
          <DetailRow
            icon="clock.fill"
            label="Time"
            value={`${formatTime(appointment.time)} - ${endTimeStr}`}
            colors={colors}
          />
          <DetailRow
            icon="person.fill"
            label="Client"
            value={client?.name ?? "Unknown"}
            colors={colors}
            onPress={client ? () => router.push({ pathname: "/client-detail" as any, params: { id: client.id } }) : undefined}
          />
          {client?.phone ? (
            <DetailRow icon="phone.fill" label="Phone" value={client.phone} colors={colors} />
          ) : null}
          {profile.address ? (
            <DetailRow
              icon="mappin"
              label="Location"
              value={profile.address}
              colors={colors}
              onPress={handleOpenMap}
            />
          ) : null}
        </View>

        {/* Cancellation Policy Info */}
        {policy.enabled && (appointment.status === "confirmed" || appointment.status === "pending") && (
          <View className="bg-surface rounded-2xl p-4 mb-4 border border-border">
            <Text className="text-xs text-muted mb-1">Cancellation Policy</Text>
            <Text className="text-sm text-foreground">
              {policy.feePercentage}% fee if cancelled within {policy.hoursBeforeAppointment} hours of appointment
            </Text>
          </View>
        )}

        {/* Notes */}
        {appointment.notes ? (
          <View className="bg-surface rounded-2xl p-4 mb-4 border border-border">
            <Text className="text-xs text-muted mb-1">Notes</Text>
            <Text className="text-sm text-foreground">{appointment.notes}</Text>
          </View>
        ) : null}

        {/* Message Client Button */}
        {client?.phone && (
          <Pressable
            onPress={handleSendReminder}
            style={({ pressed }) => [
              styles.messageBtn,
              { borderColor: colors.primary, opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <IconSymbol name="paperplane.fill" size={18} color={colors.primary} />
            <Text style={[styles.messageBtnText, { color: colors.primary }]}>Send Reminder</Text>
          </Pressable>
        )}

        {/* Actions */}
        {appointment.status === "pending" && (
          <View className="gap-3 mt-2 mb-4">
            <Pressable
              onPress={handleAccept}
              style={({ pressed }) => [styles.actionButton, { backgroundColor: colors.success, opacity: pressed ? 0.8 : 1 }]}
            >
              <IconSymbol name="checkmark" size={20} color="#FFFFFF" />
              <Text className="text-white font-semibold ml-2">Accept Appointment</Text>
            </Pressable>
            <Pressable
              onPress={() => handleStatusChange("cancelled")}
              style={({ pressed }) => [styles.actionButton, { backgroundColor: colors.error, opacity: pressed ? 0.8 : 1 }]}
            >
              <IconSymbol name="xmark" size={20} color="#FFFFFF" />
              <Text className="text-white font-semibold ml-2">Reject Appointment</Text>
            </Pressable>
          </View>
        )}

        {appointment.status === "confirmed" && (
          <View className="gap-3 mt-2 mb-4">
            <Pressable
              onPress={() => handleStatusChange("completed")}
              style={({ pressed }) => [styles.actionButton, { backgroundColor: colors.success, opacity: pressed ? 0.8 : 1 }]}
            >
              <IconSymbol name="checkmark" size={20} color="#FFFFFF" />
              <Text className="text-white font-semibold ml-2">Mark Complete</Text>
            </Pressable>
            <Pressable
              onPress={() => handleStatusChange("cancelled")}
              style={({ pressed }) => [styles.actionButton, { backgroundColor: colors.error, opacity: pressed ? 0.8 : 1 }]}
            >
              <IconSymbol name="xmark" size={20} color="#FFFFFF" />
              <Text className="text-white font-semibold ml-2">Cancel Appointment</Text>
            </Pressable>
          </View>
        )}

        <Pressable
          onPress={handleDelete}
          style={({ pressed }) => [styles.deleteButton, { borderColor: colors.error, opacity: pressed ? 0.7 : 1 }]}
        >
          <Text className="text-sm font-medium" style={{ color: colors.error }}>Delete Appointment</Text>
        </Pressable>

        <View style={{ height: 40 }} />
      </ScrollView>
    </ScreenContainer>
  );
}

function DetailRow({ icon, label, value, colors, onPress }: { icon: any; label: string; value: string; colors: any; onPress?: () => void }) {
  const content = (
    <View className="flex-row items-center py-2">
      <IconSymbol name={icon} size={18} color={colors.muted} />
      <Text className="text-xs text-muted ml-2 w-16">{label}</Text>
      <Text className="text-sm text-foreground flex-1" numberOfLines={2}>{value}</Text>
      {onPress && <IconSymbol name="chevron.right" size={14} color={colors.muted} />}
    </View>
  );
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}>
        {content}
      </Pressable>
    );
  }
  return content;
}

const styles = StyleSheet.create({
  colorDot: { width: 14, height: 14, borderRadius: 7 },
  actionButton: { width: "100%", flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 14, borderRadius: 14, minHeight: 52 },
  deleteButton: { width: "100%", alignItems: "center", justifyContent: "center", paddingVertical: 12, borderRadius: 14, borderWidth: 1, minHeight: 48 },
  messageBtn: { width: "100%", flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 14, borderRadius: 14, borderWidth: 1.5, marginBottom: 12, minHeight: 52 },
  messageBtnText: { fontSize: 15, fontWeight: "600", marginLeft: 8 },
});
