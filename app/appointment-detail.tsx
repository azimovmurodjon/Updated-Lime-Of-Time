import { Text, View, Pressable, StyleSheet, ScrollView, Alert, Platform } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useStore, formatTime, formatDateDisplay } from "@/lib/store";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useMemo } from "react";

export default function AppointmentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state, dispatch, getServiceById, getClientById } = useStore();
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

  const handleStatusChange = (status: "completed" | "cancelled") => {
    const doIt = () => {
      dispatch({ type: "UPDATE_APPOINTMENT_STATUS", payload: { id: appointment.id, status } });
      router.back();
    };
    if (Platform.OS === "web") {
      doIt();
    } else {
      Alert.alert(
        status === "completed" ? "Complete Appointment" : "Cancel Appointment",
        `Are you sure you want to mark this appointment as ${status}?`,
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

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]} className="p-5">
      {/* Header */}
      <View className="flex-row items-center mb-6">
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
            <View
              style={[styles.colorDot, { backgroundColor: service?.color ?? colors.primary }]}
            />
            <Text className="text-xl font-bold text-foreground ml-3">
              {service?.name ?? "Service"}
            </Text>
          </View>
          <Text className="text-sm text-muted">
            {appointment.duration} min · ${service?.price ?? 0}
          </Text>
        </View>

        {/* Status */}
        <View className="bg-surface rounded-2xl p-4 mb-4 border border-border">
          <Text className="text-xs text-muted mb-1">Status</Text>
          <View
            className="self-start rounded-full px-3 py-1"
            style={{
              backgroundColor:
                appointment.status === "completed"
                  ? colors.success + "20"
                  : appointment.status === "cancelled"
                  ? colors.error + "20"
                  : colors.primary + "20",
            }}
          >
            <Text
              className="text-sm font-semibold capitalize"
              style={{
                color:
                  appointment.status === "completed"
                    ? colors.success
                    : appointment.status === "cancelled"
                    ? colors.error
                    : colors.primary,
              }}
            >
              {appointment.status}
            </Text>
          </View>
        </View>

        {/* Details */}
        <View className="bg-surface rounded-2xl p-4 mb-4 border border-border">
          <DetailRow
            icon="calendar"
            label="Date"
            value={formatDateDisplay(appointment.date)}
            colors={colors}
          />
          <DetailRow
            icon="clock.fill"
            label="Time"
            value={formatTime(appointment.time)}
            colors={colors}
          />
          <DetailRow
            icon="person.fill"
            label="Client"
            value={client?.name ?? "Unknown"}
            colors={colors}
            onPress={
              client
                ? () =>
                    router.push({
                      pathname: "/client-detail" as any,
                      params: { id: client.id },
                    })
                : undefined
            }
          />
          {client?.phone ? (
            <DetailRow icon="phone.fill" label="Phone" value={client.phone} colors={colors} />
          ) : null}
        </View>

        {/* Notes */}
        {appointment.notes ? (
          <View className="bg-surface rounded-2xl p-4 mb-4 border border-border">
            <Text className="text-xs text-muted mb-1">Notes</Text>
            <Text className="text-sm text-foreground">{appointment.notes}</Text>
          </View>
        ) : null}

        {/* Actions */}
        {appointment.status === "confirmed" && (
          <View className="gap-3 mt-2 mb-8">
            <Pressable
              onPress={() => handleStatusChange("completed")}
              style={({ pressed }) => [
                styles.actionButton,
                { backgroundColor: colors.success, opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <IconSymbol name="checkmark" size={20} color="#FFFFFF" />
              <Text className="text-white font-semibold ml-2">Mark Complete</Text>
            </Pressable>
            <Pressable
              onPress={() => handleStatusChange("cancelled")}
              style={({ pressed }) => [
                styles.actionButton,
                { backgroundColor: colors.error, opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <IconSymbol name="xmark" size={20} color="#FFFFFF" />
              <Text className="text-white font-semibold ml-2">Cancel Appointment</Text>
            </Pressable>
          </View>
        )}

        <Pressable
          onPress={handleDelete}
          style={({ pressed }) => [
            styles.deleteButton,
            { borderColor: colors.error, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Text className="text-sm font-medium" style={{ color: colors.error }}>
            Delete Appointment
          </Text>
        </Pressable>

        <View style={{ height: 40 }} />
      </ScrollView>
    </ScreenContainer>
  );
}

function DetailRow({
  icon,
  label,
  value,
  colors,
  onPress,
}: {
  icon: any;
  label: string;
  value: string;
  colors: any;
  onPress?: () => void;
}) {
  const content = (
    <View className="flex-row items-center py-2">
      <IconSymbol name={icon} size={18} color={colors.muted} />
      <Text className="text-xs text-muted ml-2 w-16">{label}</Text>
      <Text className="text-sm text-foreground flex-1">{value}</Text>
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
  colorDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 14,
  },
  deleteButton: {
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
});
