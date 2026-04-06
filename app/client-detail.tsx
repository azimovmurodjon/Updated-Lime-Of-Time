import { FlatList, Text, View, Pressable, StyleSheet, TextInput, Alert, Platform } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useStore, formatTime, formatDateDisplay } from "@/lib/store";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useMemo, useState } from "react";

export default function ClientDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state, dispatch, getServiceById, getAppointmentsForClient } = useStore();
  const colors = useColors();
  const router = useRouter();

  const client = useMemo(() => state.clients.find((c) => c.id === id), [state.clients, id]);
  const appointments = useMemo(() => (id ? getAppointmentsForClient(id) : []), [getAppointmentsForClient, id]);

  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(client?.name ?? "");
  const [editPhone, setEditPhone] = useState(client?.phone ?? "");
  const [editEmail, setEditEmail] = useState(client?.email ?? "");
  const [editNotes, setEditNotes] = useState(client?.notes ?? "");

  if (!client) {
    return (
      <ScreenContainer edges={["top", "bottom", "left", "right"]} className="p-5">
        <Pressable onPress={() => router.back()} style={({ pressed }) => [{ opacity: pressed ? 0.5 : 1 }]}>
          <IconSymbol name="arrow.left" size={24} color={colors.foreground} />
        </Pressable>
        <View className="flex-1 items-center justify-center">
          <Text className="text-base text-muted">Client not found</Text>
        </View>
      </ScreenContainer>
    );
  }

  const getInitials = (name: string) => {
    const parts = name.split(" ");
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  const handleSave = () => {
    if (!editName.trim()) return;
    dispatch({
      type: "UPDATE_CLIENT",
      payload: {
        ...client,
        name: editName.trim(),
        phone: editPhone.trim(),
        email: editEmail.trim(),
        notes: editNotes.trim(),
      },
    });
    setEditing(false);
  };

  const handleDelete = () => {
    const doIt = () => {
      dispatch({ type: "DELETE_CLIENT", payload: client.id });
      router.back();
    };
    if (Platform.OS === "web") {
      doIt();
    } else {
      Alert.alert("Delete Client", "This will remove the client permanently.", [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: doIt },
      ]);
    }
  };

  const upcomingAppts = appointments.filter((a) => a.status === "confirmed");
  const pastAppts = appointments.filter((a) => a.status !== "confirmed");

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]} className="p-5">
      {/* Header */}
      <View className="flex-row items-center justify-between mb-6">
        <View className="flex-row items-center">
          <Pressable onPress={() => router.back()} style={({ pressed }) => [{ opacity: pressed ? 0.5 : 1 }]}>
            <IconSymbol name="arrow.left" size={24} color={colors.foreground} />
          </Pressable>
          <Text className="text-xl font-bold text-foreground ml-4">Client</Text>
        </View>
        {!editing && (
          <Pressable
            onPress={() => {
              setEditName(client.name);
              setEditPhone(client.phone);
              setEditEmail(client.email);
              setEditNotes(client.notes);
              setEditing(true);
            }}
            style={({ pressed }) => [{ opacity: pressed ? 0.5 : 1 }]}
          >
            <IconSymbol name="pencil" size={22} color={colors.primary} />
          </Pressable>
        )}
      </View>

      <FlatList
        data={editing ? [] : [...upcomingAppts, ...pastAppts]}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View>
            {/* Profile Card */}
            {editing ? (
              <View className="bg-surface rounded-2xl p-4 mb-4 border border-border">
                <TextInput
                  className="bg-background rounded-xl px-3 py-3 text-sm mb-2 border border-border"
                  placeholder="Full Name *"
                  placeholderTextColor={colors.muted}
                  value={editName}
                  onChangeText={setEditName}
                  style={{ color: colors.foreground }}
                  returnKeyType="next"
                />
                <TextInput
                  className="bg-background rounded-xl px-3 py-3 text-sm mb-2 border border-border"
                  placeholder="Phone"
                  placeholderTextColor={colors.muted}
                  value={editPhone}
                  onChangeText={setEditPhone}
                  keyboardType="phone-pad"
                  style={{ color: colors.foreground }}
                  returnKeyType="next"
                />
                <TextInput
                  className="bg-background rounded-xl px-3 py-3 text-sm mb-2 border border-border"
                  placeholder="Email"
                  placeholderTextColor={colors.muted}
                  value={editEmail}
                  onChangeText={setEditEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  style={{ color: colors.foreground }}
                  returnKeyType="next"
                />
                <TextInput
                  className="bg-background rounded-xl px-3 py-3 text-sm mb-3 border border-border"
                  placeholder="Notes"
                  placeholderTextColor={colors.muted}
                  value={editNotes}
                  onChangeText={setEditNotes}
                  multiline
                  numberOfLines={3}
                  style={{ color: colors.foreground, minHeight: 60, textAlignVertical: "top" }}
                  returnKeyType="done"
                />
                <View className="flex-row gap-2">
                  <Pressable
                    onPress={() => setEditing(false)}
                    style={({ pressed }) => [
                      styles.formButton,
                      { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, opacity: pressed ? 0.7 : 1 },
                    ]}
                  >
                    <Text className="text-sm font-medium text-foreground">Cancel</Text>
                  </Pressable>
                  <Pressable
                    onPress={handleSave}
                    style={({ pressed }) => [
                      styles.formButton,
                      { backgroundColor: colors.primary, flex: 1, opacity: pressed ? 0.8 : 1 },
                    ]}
                  >
                    <Text className="text-sm font-semibold text-white">Save</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <View className="items-center mb-6">
                <View
                  style={[styles.bigAvatar, { backgroundColor: colors.primary + "20" }]}
                >
                  <Text className="text-2xl font-bold" style={{ color: colors.primary }}>
                    {getInitials(client.name)}
                  </Text>
                </View>
                <Text className="text-xl font-bold text-foreground mt-3">{client.name}</Text>
                {client.phone ? (
                  <View className="flex-row items-center mt-2">
                    <IconSymbol name="phone.fill" size={14} color={colors.muted} />
                    <Text className="text-sm text-muted ml-1">{client.phone}</Text>
                  </View>
                ) : null}
                {client.email ? (
                  <View className="flex-row items-center mt-1">
                    <IconSymbol name="envelope.fill" size={14} color={colors.muted} />
                    <Text className="text-sm text-muted ml-1">{client.email}</Text>
                  </View>
                ) : null}
                {client.notes ? (
                  <View className="bg-surface rounded-xl p-3 mt-3 w-full border border-border">
                    <Text className="text-xs text-muted mb-1">Notes</Text>
                    <Text className="text-sm text-foreground">{client.notes}</Text>
                  </View>
                ) : null}
              </View>
            )}

            {!editing && (
              <>
                {upcomingAppts.length > 0 && (
                  <Text className="text-base font-semibold text-foreground mb-3">
                    Upcoming ({upcomingAppts.length})
                  </Text>
                )}
                {upcomingAppts.length === 0 && pastAppts.length > 0 && (
                  <Text className="text-base font-semibold text-foreground mb-3">
                    Past Visits ({pastAppts.length})
                  </Text>
                )}
              </>
            )}
          </View>
        }
        renderItem={({ item, index }) => {
          const service = getServiceById(item.serviceId);
          const isFirstPast = index === upcomingAppts.length && upcomingAppts.length > 0;
          return (
            <View>
              {isFirstPast && (
                <Text className="text-base font-semibold text-foreground mb-3 mt-4">
                  Past Visits ({pastAppts.length})
                </Text>
              )}
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: "/appointment-detail" as any,
                    params: { id: item.id },
                  })
                }
                style={({ pressed }) => [
                  styles.apptRow,
                  { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
                ]}
              >
                <View style={[styles.colorDot, { backgroundColor: service?.color ?? colors.primary }]} />
                <View style={styles.rowContent}>
                  <Text className="text-sm font-semibold text-foreground">{service?.name ?? "Service"}</Text>
                  <Text className="text-xs text-muted">
                    {formatDateDisplay(item.date)} · {formatTime(item.time)}
                  </Text>
                </View>
                <View
                  className="rounded-full px-2 py-0.5"
                  style={{
                    backgroundColor:
                      item.status === "completed" ? colors.success + "20" :
                      item.status === "cancelled" ? colors.error + "20" :
                      colors.primary + "20",
                  }}
                >
                  <Text
                    className="text-xs capitalize"
                    style={{
                      color:
                        item.status === "completed" ? colors.success :
                        item.status === "cancelled" ? colors.error :
                        colors.primary,
                    }}
                  >
                    {item.status}
                  </Text>
                </View>
              </Pressable>
            </View>
          );
        }}
        ListFooterComponent={
          !editing ? (
            <Pressable
              onPress={handleDelete}
              style={({ pressed }) => [
                styles.deleteButton,
                { borderColor: colors.error, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Text className="text-sm font-medium" style={{ color: colors.error }}>
                Delete Client
              </Text>
            </Pressable>
          ) : null
        }
        ListEmptyComponent={
          !editing ? (
            <View className="items-center py-8">
              <Text className="text-sm text-muted">No appointment history</Text>
            </View>
          ) : null
        }
        contentContainerStyle={{ paddingBottom: 40 }}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  bigAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  apptRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
  },
  colorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 12,
  },
  rowContent: {
    flex: 1,
  },
  formButton: {
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  deleteButton: {
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 20,
  },
});
