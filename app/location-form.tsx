import { useState, useMemo } from "react";
import {
  ScrollView,
  Text,
  View,
  TextInput,
  Pressable,
  StyleSheet,
  Alert,
  Switch,
  useWindowDimensions,
  Platform,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useStore, generateId } from "@/lib/store";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import {
  Location,
  DAYS_OF_WEEK,
  formatPhoneNumber,
  stripPhoneFormat,
} from "@/lib/types";

type DaySchedule = { enabled: boolean; start: string; end: string };
type WeekSchedule = Record<string, DaySchedule>;

const DEFAULT_DAY: DaySchedule = { enabled: true, start: "09:00", end: "17:00" };

function buildDefaultWeekSchedule(): WeekSchedule {
  const schedule: WeekSchedule = {};
  DAYS_OF_WEEK.forEach((day) => {
    const isWeekend = day === "sunday" || day === "saturday";
    schedule[day] = { enabled: !isWeekend, start: "09:00", end: "17:00" };
  });
  return schedule;
}

export default function LocationFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { state, dispatch, syncToDb } = useStore();
  const colors = useColors();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const hp = Math.max(16, width * 0.05);

  const existing = useMemo(
    () => (id ? state.locations.find((l) => l.id === id) : undefined),
    [state.locations, id]
  );

  const isEdit = !!existing;

  const [name, setName] = useState(existing?.name ?? "");
  const [address, setAddress] = useState(existing?.address ?? "");
  const [phone, setPhone] = useState(existing?.phone ?? "");
  const [email, setEmail] = useState(existing?.email ?? "");
  const [isDefault, setIsDefault] = useState(existing?.isDefault ?? state.locations.length === 0);
  const [active, setActive] = useState(existing?.active ?? true);
  const [useCustomSchedule, setUseCustomSchedule] = useState(!!existing?.workingHours);
  const [weekSchedule, setWeekSchedule] = useState<WeekSchedule>(() => {
    if (existing?.workingHours) {
      const ws: WeekSchedule = {};
      DAYS_OF_WEEK.forEach((day) => {
        const wh = (existing.workingHours as any)?.[day];
        ws[day] = wh
          ? { enabled: wh.enabled ?? false, start: wh.start ?? "09:00", end: wh.end ?? "17:00" }
          : { ...DEFAULT_DAY };
      });
      return ws;
    }
    return buildDefaultWeekSchedule();
  });

  const updateDaySchedule = (day: string, field: keyof DaySchedule, value: any) => {
    setWeekSchedule((prev) => ({
      ...prev,
      [day]: { ...prev[day], [field]: value },
    }));
  };

  const handleSave = () => {
    if (!name.trim()) {
      Alert.alert("Required", "Please enter a location name.");
      return;
    }
    if (!address.trim()) {
      Alert.alert("Required", "Please enter an address.");
      return;
    }

    const loc: Location = {
      id: existing?.id ?? generateId(),
      name: name.trim(),
      address: address.trim(),
      phone: phone.trim(),
      email: email.trim(),
      isDefault,
      active,
      workingHours: useCustomSchedule ? (weekSchedule as any) : null,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    };

    const action = isEdit
      ? { type: "UPDATE_LOCATION" as const, payload: loc }
      : { type: "ADD_LOCATION" as const, payload: loc };

    // If setting as default, unset other defaults
    if (isDefault) {
      state.locations.forEach((l) => {
        if (l.id !== loc.id && l.isDefault) {
          const updateAction = {
            type: "UPDATE_LOCATION" as const,
            payload: { ...l, isDefault: false },
          };
          dispatch(updateAction);
          syncToDb(updateAction);
        }
      });
    }

    dispatch(action);
    syncToDb(action);
    router.back();
  };

  const handleDelete = () => {
    if (!existing) return;
    Alert.alert(
      "Delete Location",
      `Are you sure you want to delete "${existing.name}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            const action = { type: "DELETE_LOCATION" as const, payload: existing.id };
            dispatch(action);
            syncToDb(action);
            router.back();
          },
        },
      ]
    );
  };

  return (
    <ScreenContainer edges={["top", "left", "right"]} className="pt-2" style={{ paddingHorizontal: hp }}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backBtn, { opacity: pressed ? 0.6 : 1 }]}
        >
          <IconSymbol name="arrow.left" size={22} color={colors.foreground} />
        </Pressable>
        <Text className="text-xl font-bold text-foreground" style={{ flex: 1 }}>
          {isEdit ? "Edit Location" : "Add Location"}
        </Text>
        <Pressable
          onPress={handleSave}
          style={({ pressed }) => [
            styles.saveBtn,
            { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 },
          ]}
        >
          <Text style={{ color: "#FFFFFF", fontWeight: "600", fontSize: 15 }}>Save</Text>
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Basic Info */}
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text className="text-base font-semibold text-foreground mb-3">Location Details</Text>

          <Text className="text-xs font-medium text-muted mb-1">Name *</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="e.g. Main Office, Downtown Branch"
            placeholderTextColor={colors.muted}
            style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
            returnKeyType="done"
          />

          <Text className="text-xs font-medium text-muted mb-1 mt-3">Address *</Text>
          <TextInput
            value={address}
            onChangeText={setAddress}
            placeholder="Full street address"
            placeholderTextColor={colors.muted}
            style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
            returnKeyType="done"
          />

          <Text className="text-xs font-medium text-muted mb-1 mt-3">Phone</Text>
          <TextInput
            value={phone}
            onChangeText={(val) => setPhone(formatPhoneNumber(val))}
            placeholder="Location phone number"
            placeholderTextColor={colors.muted}
            keyboardType="phone-pad"
            style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
            returnKeyType="done"
          />

          <Text className="text-xs font-medium text-muted mb-1 mt-3">Email</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="Location email address"
            placeholderTextColor={colors.muted}
            keyboardType="email-address"
            autoCapitalize="none"
            style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
            returnKeyType="done"
          />
        </View>

        {/* Settings */}
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text className="text-base font-semibold text-foreground mb-3">Settings</Text>

          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text className="text-sm text-foreground">Default Location</Text>
              <Text className="text-xs text-muted">Used as the primary location for bookings</Text>
            </View>
            <Switch
              value={isDefault}
              onValueChange={setIsDefault}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={Platform.OS === "android" ? (isDefault ? colors.primary : "#f4f3f4") : undefined}
            />
          </View>

          <View style={[styles.switchRow, { marginTop: 16 }]}>
            <View style={{ flex: 1 }}>
              <Text className="text-sm text-foreground">Active</Text>
              <Text className="text-xs text-muted">Inactive locations are hidden from booking</Text>
            </View>
            <Switch
              value={active}
              onValueChange={setActive}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={Platform.OS === "android" ? (active ? colors.primary : "#f4f3f4") : undefined}
            />
          </View>
        </View>

        {/* Working Hours */}
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text className="text-base font-semibold text-foreground mb-2">Working Hours</Text>
          <Text className="text-xs text-muted mb-3">
            Set individual hours for this location or use the business default schedule.
          </Text>

          <View style={styles.switchRow}>
            <Text className="text-sm text-foreground">Use custom schedule</Text>
            <Switch
              value={useCustomSchedule}
              onValueChange={setUseCustomSchedule}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={Platform.OS === "android" ? (useCustomSchedule ? colors.primary : "#f4f3f4") : undefined}
            />
          </View>

          {useCustomSchedule && (
            <View style={{ marginTop: 12, gap: 8 }}>
              {DAYS_OF_WEEK.map((day) => {
                const ds = weekSchedule[day] || DEFAULT_DAY;
                return (
                  <View
                    key={day}
                    style={[
                      styles.dayRow,
                      { backgroundColor: colors.background, borderColor: colors.border },
                    ]}
                  >
                    <View style={styles.dayHeader}>
                      <Text
                        style={{
                          fontSize: 14,
                          fontWeight: "600",
                          color: ds.enabled ? colors.foreground : colors.muted,
                          width: 80,
                        }}
                      >
                        {day.slice(0, 3)}
                      </Text>
                      <Switch
                        value={ds.enabled}
                        onValueChange={(val) => updateDaySchedule(day, "enabled", val)}
                        trackColor={{ false: colors.border, true: colors.primary }}
                        thumbColor={Platform.OS === "android" ? (ds.enabled ? colors.primary : "#f4f3f4") : undefined}
                        style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
                      />
                    </View>
                    {ds.enabled && (
                      <View style={styles.timeRow}>
                        <TextInput
                          value={ds.start}
                          onChangeText={(val) => updateDaySchedule(day, "start", val)}
                          placeholder="09:00"
                          placeholderTextColor={colors.muted}
                          style={[
                            styles.timeInput,
                            { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground },
                          ]}
                          returnKeyType="done"
                        />
                        <Text className="text-sm text-muted mx-2">to</Text>
                        <TextInput
                          value={ds.end}
                          onChangeText={(val) => updateDaySchedule(day, "end", val)}
                          placeholder="17:00"
                          placeholderTextColor={colors.muted}
                          style={[
                            styles.timeInput,
                            { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground },
                          ]}
                          returnKeyType="done"
                        />
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* Delete Button (edit mode only) */}
        {isEdit && (
          <Pressable
            onPress={handleDelete}
            style={({ pressed }) => [
              styles.deleteBtn,
              { borderColor: colors.error, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <IconSymbol name="trash.fill" size={18} color={colors.error} />
            <Text style={{ color: colors.error, fontWeight: "600", fontSize: 15 }}>
              Delete Location
            </Text>
          </Pressable>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    gap: 12,
  },
  backBtn: {
    padding: 4,
  },
  saveBtn: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
  },
  section: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  input: {
    height: 44,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 15,
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dayRow: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
  },
  dayHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
  },
  timeInput: {
    height: 36,
    width: 80,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    fontSize: 14,
    textAlign: "center",
  },
  deleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 16,
  },
});
