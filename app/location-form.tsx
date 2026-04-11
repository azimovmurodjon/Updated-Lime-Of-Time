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
  Modal,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useStore, generateId } from "@/lib/store";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { TapTimePicker } from "@/components/tap-time-picker";
import {
  Location,
  DAYS_OF_WEEK,
  formatPhoneNumber,
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

function fmt24to12(t: string): string {
  if (!t) return "";
  const [hStr, mStr] = t.split(":");
  let h = parseInt(hStr, 10);
  const m = mStr ?? "00";
  const ampm = h >= 12 ? "PM" : "AM";
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return `${h}:${m} ${ampm}`;
}

type TimePickerTarget = { day: string; field: "start" | "end" } | null;

export default function LocationFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { state, dispatch, syncToDb } = useStore();
  const colors = useColors();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const hp = isTablet ? 32 : Math.max(16, width * 0.05);

  const existing = useMemo(
    () => (id ? state.locations.find((l) => l.id === id) : undefined),
    [state.locations, id]
  );

  const isEdit = !!existing;

  const [name, setName] = useState(existing?.name ?? "");
  const [address, setAddress] = useState(existing?.address ?? "");
  const [city, setCity] = useState(existing?.city ?? "");
  const [locationState, setLocationState] = useState(existing?.state ?? "");
  const [zipCode, setZipCode] = useState(existing?.zipCode ?? "");
  const [phone, setPhone] = useState(existing?.phone ?? "");
  const [email, setEmail] = useState(existing?.email ?? "");
  const [isDefault, setIsDefault] = useState(existing?.isDefault ?? state.locations.length === 0);
  const [active, setActive] = useState(existing?.active ?? true);

  // Business Hours — always shown, always saved
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

  // Time picker modal state
  const [pickerTarget, setPickerTarget] = useState<TimePickerTarget>(null);
  const [pickerValue, setPickerValue] = useState("09:00");
  const [timeError, setTimeError] = useState("");

  const updateDaySchedule = (day: string, field: keyof DaySchedule, value: any) => {
    setWeekSchedule((prev) => ({
      ...prev,
      [day]: { ...prev[day], [field]: value },
    }));
  };

  const openTimePicker = (day: string, field: "start" | "end") => {
    const ds = weekSchedule[day] || DEFAULT_DAY;
    setPickerValue(field === "start" ? ds.start : ds.end);
    setTimeError("");
    setPickerTarget({ day, field });
  };

  const saveTimePicker = () => {
    if (!pickerTarget) return;
    const { day, field } = pickerTarget;
    const ds = weekSchedule[day] || DEFAULT_DAY;
    const newStart = field === "start" ? pickerValue : ds.start;
    const newEnd = field === "end" ? pickerValue : ds.end;
    const toMin = (t: string) => {
      const [h, m] = t.split(":").map(Number);
      return h * 60 + m;
    };
    if (toMin(newEnd) <= toMin(newStart)) {
      setTimeError("End time must be after start time.");
      return;
    }
    updateDaySchedule(day, field, pickerValue);
    setPickerTarget(null);
    setTimeError("");
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
      city: city.trim(),
      state: locationState.trim(),
      zipCode: zipCode.trim(),
      phone: phone.trim(),
      email: email.trim(),
      isDefault,
      active,
      workingHours: weekSchedule as any,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    };

    const action = isEdit
      ? { type: "UPDATE_LOCATION" as const, payload: loc }
      : { type: "ADD_LOCATION" as const, payload: loc };

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

          {/* City / State / ZIP row */}
          <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
            <View style={{ flex: 2 }}>
              <Text className="text-xs font-medium text-muted mb-1">City</Text>
              <TextInput
                value={city}
                onChangeText={setCity}
                placeholder="City"
                placeholderTextColor={colors.muted}
                style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
                returnKeyType="next"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text className="text-xs font-medium text-muted mb-1">State</Text>
              <TextInput
                value={locationState}
                onChangeText={setLocationState}
                placeholder="CA"
                placeholderTextColor={colors.muted}
                autoCapitalize="characters"
                maxLength={2}
                style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
                returnKeyType="next"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text className="text-xs font-medium text-muted mb-1">ZIP</Text>
              <TextInput
                value={zipCode}
                onChangeText={setZipCode}
                placeholder="90210"
                placeholderTextColor={colors.muted}
                keyboardType="numeric"
                maxLength={10}
                style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
                returnKeyType="next"
              />
            </View>
          </View>

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

        {/* Business Hours — always shown */}
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text className="text-base font-semibold text-foreground mb-1">Business Hours</Text>
          <Text className="text-xs text-muted mb-3">
            Set the working hours for this location. Staff assigned here will be constrained to these hours.
          </Text>

          <View style={{ gap: 8 }}>
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
                        textTransform: "capitalize",
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
                      <Pressable
                        onPress={() => openTimePicker(day, "start")}
                        style={[styles.timeBtn, { backgroundColor: colors.surface, borderColor: colors.primary }]}
                      >
                        <Text style={{ color: colors.primary, fontSize: 14, fontWeight: "600" }}>
                          {fmt24to12(ds.start)}
                        </Text>
                      </Pressable>
                      <Text className="text-sm text-muted mx-2">–</Text>
                      <Pressable
                        onPress={() => openTimePicker(day, "end")}
                        style={[styles.timeBtn, { backgroundColor: colors.surface, borderColor: colors.primary }]}
                      >
                        <Text style={{ color: colors.primary, fontSize: 14, fontWeight: "600" }}>
                          {fmt24to12(ds.end)}
                        </Text>
                      </Pressable>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
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

      {/* Time Picker Modal */}
      <Modal
        visible={!!pickerTarget}
        transparent
        animationType="fade"
        onRequestClose={() => setPickerTarget(null)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setPickerTarget(null)}
        >
          <Pressable
            style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={{ fontSize: 16, fontWeight: "700", color: colors.foreground, marginBottom: 4 }}>
              {pickerTarget?.field === "start" ? "Start Time" : "End Time"}
            </Text>
            <Text style={{ fontSize: 12, color: colors.muted, marginBottom: 12, textTransform: "capitalize" }}>
              {pickerTarget?.day ?? ""}
            </Text>
            <TapTimePicker
              value={pickerValue}
              onChange={(v) => { setPickerValue(v); setTimeError(""); }}
            />
            {timeError ? (
              <Text style={{ color: colors.error, fontSize: 12, marginTop: 8, textAlign: "center" }}>
                {timeError}
              </Text>
            ) : null}
            <View style={{ flexDirection: "row", gap: 12, marginTop: 16 }}>
              <Pressable
                onPress={() => { setPickerTarget(null); setTimeError(""); }}
                style={[styles.modalBtn, { backgroundColor: colors.background, borderColor: colors.border, borderWidth: 1 }]}
              >
                <Text style={{ color: colors.muted, fontWeight: "600" }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={saveTimePicker}
                style={[styles.modalBtn, { backgroundColor: colors.primary }]}
              >
                <Text style={{ color: "#fff", fontWeight: "700" }}>Apply</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
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
  timeBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalCard: {
    width: "100%",
    maxWidth: 340,
    borderRadius: 18,
    borderWidth: 1,
    padding: 20,
    alignItems: "center",
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
});
