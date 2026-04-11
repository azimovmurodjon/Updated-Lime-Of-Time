import { useState, useCallback, useMemo, useRef } from "react";
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
  StaffMember,
  STAFF_COLORS,
  DAYS_OF_WEEK,
  WorkingHours,
  DEFAULT_WORKING_HOURS,
  formatTimeDisplay,
} from "@/lib/types";
import { TapTimePicker, timeToMinutes as tapTimeToMinutes } from "@/components/tap-time-picker";
import { Modal } from "react-native";

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

export default function StaffFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { state, dispatch, syncToDb } = useStore();
  const colors = useColors();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const hp = isTablet ? 32 : Math.max(16, width * 0.05);

  const existing = useMemo(
    () => (id ? state.staff.find((s) => s.id === id) : undefined),
    [state.staff, id]
  );

  const isEdit = !!existing;

  const [name, setName] = useState(existing?.name ?? "");
  const [phone, setPhone] = useState(existing?.phone ?? "");
  const [email, setEmail] = useState(existing?.email ?? "");
  const [role, setRole] = useState(existing?.role ?? "");
  const [color, setColor] = useState(existing?.color ?? STAFF_COLORS[0]);
  const [active, setActive] = useState(existing?.active ?? true);
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>(
    existing?.serviceIds ?? []
  );
  const [allServices, setAllServices] = useState(
    !existing?.serviceIds || existing.serviceIds.length === 0
  );

  // Location assignments — null means all locations
  const [selectedLocationIds, setSelectedLocationIds] = useState<string[]>(() => {
    if (existing?.locationIds && existing.locationIds.length > 0) return existing.locationIds;
    // Auto-assign to single location if only one exists
    if (state.locations.length === 1) return [state.locations[0].id];
    return [];
  });
  const [allLocations, setAllLocations] = useState(
    !existing?.locationIds || existing.locationIds.length === 0
  );

  const toggleLocation = (locId: string) => {
    setSelectedLocationIds((prev) =>
      prev.includes(locId) ? prev.filter((id) => id !== locId) : [...prev, locId]
    );
  };
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

  const toggleService = (svcId: string) => {
    setSelectedServiceIds((prev) =>
      prev.includes(svcId) ? prev.filter((id) => id !== svcId) : [...prev, svcId]
    );
  };

  const updateDaySchedule = (day: string, field: keyof DaySchedule, value: any) => {
    setWeekSchedule((prev) => ({
      ...prev,
      [day]: { ...prev[day], [field]: value },
    }));
  };

  const [staffTimePicker, setStaffTimePicker] = useState<{ day: string } | null>(null);
  const [staffDraftStart, setStaffDraftStart] = useState("09:00");
  const [staffDraftEnd, setStaffDraftEnd] = useState("17:00");
  const [staffTimeError, setStaffTimeError] = useState<string | null>(null);
  const [staffSubPicker, setStaffSubPicker] = useState<"start" | "end" | null>(null);

  const openStaffTimePicker = useCallback((day: string) => {
    const ds = weekSchedule[day];
    setStaffDraftStart(ds.start);
    setStaffDraftEnd(ds.end);
    setStaffTimeError(null);
    setStaffSubPicker(null);
    setStaffTimePicker({ day });
  }, [weekSchedule]);

  const saveStaffTimePicker = useCallback(() => {
    if (!staffTimePicker) return;
    const [sh, sm] = staffDraftStart.split(":").map(Number);
    const [eh, em] = staffDraftEnd.split(":").map(Number);
    const startMin = sh * 60 + (sm || 0);
    const endMin = eh * 60 + (em || 0);
    if (endMin <= startMin) {
      setStaffTimeError("End time must be after start time.");
      return;
    }
    setStaffTimeError(null);
    updateDaySchedule(staffTimePicker.day, "start", staffDraftStart);
    updateDaySchedule(staffTimePicker.day, "end", staffDraftEnd);
    setStaffTimePicker(null);
    setStaffSubPicker(null);
  }, [staffTimePicker, staffDraftStart, staffDraftEnd]);

  const handleSave = () => {
    if (!name.trim()) {
      Alert.alert("Required", "Please enter a staff member name.");
      return;
    }

    const member: StaffMember = {
      id: existing?.id ?? generateId(),
      name: name.trim(),
      phone: phone.trim(),
      email: email.trim(),
      role: role.trim(),
      color,
      serviceIds: allServices ? null : selectedServiceIds,
      locationIds: allLocations ? null : (selectedLocationIds.length > 0 ? selectedLocationIds : null),
      workingHours: useCustomSchedule ? (weekSchedule as any) : null,
      active,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    };

    const action = isEdit
      ? { type: "UPDATE_STAFF" as const, payload: member }
      : { type: "ADD_STAFF" as const, payload: member };

    dispatch(action);
    syncToDb(action);
    router.back();
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
          {isEdit ? "Edit Staff" : "Add Staff Member"}
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
          <Text className="text-base font-semibold text-foreground mb-3">Basic Information</Text>

          <Text className="text-xs font-medium text-muted mb-1">Name *</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Staff member name"
            placeholderTextColor={colors.muted}
            style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
            returnKeyType="done"
          />

          <Text className="text-xs font-medium text-muted mb-1 mt-3">Role / Title</Text>
          <TextInput
            value={role}
            onChangeText={setRole}
            placeholder="e.g. Stylist, Therapist, Manager"
            placeholderTextColor={colors.muted}
            style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
            returnKeyType="done"
          />

          <Text className="text-xs font-medium text-muted mb-1 mt-3">Phone</Text>
          <TextInput
            value={phone}
            onChangeText={setPhone}
            placeholder="Phone number"
            placeholderTextColor={colors.muted}
            keyboardType="phone-pad"
            style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
            returnKeyType="done"
          />

          <Text className="text-xs font-medium text-muted mb-1 mt-3">Email</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="Email address"
            placeholderTextColor={colors.muted}
            keyboardType="email-address"
            autoCapitalize="none"
            style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
            returnKeyType="done"
          />

          <View style={styles.switchRow}>
            <Text className="text-sm text-foreground">Active</Text>
            <Switch
              value={active}
              onValueChange={setActive}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={Platform.OS === "android" ? (active ? colors.primary : "#f4f3f4") : undefined}
            />
          </View>
        </View>

        {/* Color */}
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text className="text-base font-semibold text-foreground mb-3">Profile Color</Text>
          <View style={styles.colorRow}>
            {STAFF_COLORS.map((c) => (
              <Pressable
                key={c}
                onPress={() => setColor(c)}
                style={[
                  styles.colorDot,
                  { backgroundColor: c },
                  color === c && styles.colorDotSelected,
                ]}
              >
                {color === c && (
                  <IconSymbol name="checkmark" size={16} color="#FFFFFF" />
                )}
              </Pressable>
            ))}
          </View>
        </View>

        {/* Service Assignments */}
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text className="text-base font-semibold text-foreground mb-2">Service Assignments</Text>
          <Text className="text-xs text-muted mb-3">
            Choose which services this staff member can perform.
          </Text>

          <View style={styles.switchRow}>
            <Text className="text-sm text-foreground">Can perform all services</Text>
            <Switch
              value={allServices}
              onValueChange={(val) => {
                setAllServices(val);
                if (val) setSelectedServiceIds([]);
              }}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={Platform.OS === "android" ? (allServices ? colors.primary : "#f4f3f4") : undefined}
            />
          </View>

          {!allServices && (
            <View style={{ marginTop: 12, gap: 6 }}>
              {state.services.length === 0 ? (
                <Text className="text-sm text-muted">No services created yet.</Text>
              ) : (
                state.services.map((svc) => {
                  const selected = selectedServiceIds.includes(svc.id);
                  return (
                    <Pressable
                      key={svc.id}
                      onPress={() => toggleService(svc.id)}
                      style={({ pressed }) => [
                        styles.serviceChip,
                        {
                          backgroundColor: selected ? colors.primary + "15" : colors.background,
                          borderColor: selected ? colors.primary : colors.border,
                          opacity: pressed ? 0.7 : 1,
                        },
                      ]}
                    >
                      <View style={[styles.svcDot, { backgroundColor: svc.color }]} />
                      <Text
                        style={{
                          flex: 1,
                          fontSize: 14,
                          color: colors.foreground,
                        }}
                        numberOfLines={1}
                      >
                        {svc.name}
                      </Text>
                      {selected && (
                        <IconSymbol name="checkmark" size={16} color={colors.primary} />
                      )}
                    </Pressable>
                  );
                })
              )}
            </View>
          )}
        </View>

        {/* Location Assignments — only shown when multiple locations exist */}
        {state.locations.length > 1 && (
          <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text className="text-base font-semibold text-foreground mb-2">Location Assignments</Text>
            <Text className="text-xs text-muted mb-3">
              Choose which locations this staff member works at.
            </Text>

            <View style={styles.switchRow}>
              <Text className="text-sm text-foreground">Works at all locations</Text>
              <Switch
                value={allLocations}
                onValueChange={(val) => {
                  setAllLocations(val);
                  if (val) setSelectedLocationIds([]);
                }}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor={Platform.OS === "android" ? (allLocations ? colors.primary : "#f4f3f4") : undefined}
              />
            </View>

            {!allLocations && (
              <View style={{ marginTop: 12, gap: 6 }}>
                {state.locations.length === 0 ? (
                  <Text className="text-sm text-muted">No locations created yet.</Text>
                ) : (
                  state.locations.map((loc) => {
                    const selected = selectedLocationIds.includes(loc.id);
                    return (
                      <Pressable
                        key={loc.id}
                        onPress={() => toggleLocation(loc.id)}
                        style={({ pressed }) => [
                          styles.serviceChip,
                          {
                            backgroundColor: selected ? colors.primary + "15" : colors.background,
                            borderColor: selected ? colors.primary : colors.border,
                            opacity: pressed ? 0.7 : 1,
                          },
                        ]}
                      >
                        <IconSymbol name="location.fill" size={14} color={selected ? colors.primary : colors.muted} />
                        <Text
                          style={{ flex: 1, fontSize: 14, color: colors.foreground }}
                          numberOfLines={1}
                        >
                          {loc.name}
                        </Text>
                        {loc.isDefault && (
                          <Text style={{ fontSize: 11, color: colors.muted }}>Default</Text>
                        )}
                        {selected && (
                          <IconSymbol name="checkmark" size={16} color={colors.primary} />
                        )}
                      </Pressable>
                    );
                  })
                )}
              </View>
            )}
          </View>
        )}

        {/* Working Hours */}
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text className="text-base font-semibold text-foreground mb-2">Working Hours</Text>
          <Text className="text-xs text-muted mb-3">
            Set individual hours or use the business default schedule.
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
                      <Pressable
                        onPress={() => openStaffTimePicker(day)}
                        style={({ pressed }) => [{
                          flexDirection: "row",
                          alignItems: "center",
                          paddingHorizontal: 12,
                          paddingVertical: 8,
                          borderRadius: 10,
                          borderWidth: 1,
                          borderColor: colors.border,
                          backgroundColor: colors.surface,
                          marginTop: 6,
                          opacity: pressed ? 0.7 : 1,
                        }]}
                      >
                        <IconSymbol name="clock.fill" size={14} color={colors.primary} />
                        <Text style={{ fontSize: 13, color: colors.foreground, marginLeft: 6 }}>
                          {formatTimeDisplay(ds.start)} – {formatTimeDisplay(ds.end)}
                        </Text>
                      </Pressable>
                    )}
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Staff Time Picker Modal */}
      <Modal visible={!!staffTimePicker} transparent animationType="slide">
        <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" }} onPress={() => { setStaffTimePicker(null); setStaffSubPicker(null); }}>
          <Pressable style={[{ borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 16, paddingBottom: 40, paddingHorizontal: 20, backgroundColor: colors.background }]} onPress={() => {}}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <Text style={{ fontSize: 17, fontWeight: "700", color: colors.foreground }}>
                {staffTimePicker ? (staffTimePicker.day.charAt(0).toUpperCase() + staffTimePicker.day.slice(1)) : ""} Hours
              </Text>
              <Pressable onPress={() => { setStaffTimePicker(null); setStaffSubPicker(null); }} style={({ pressed }) => [{ opacity: pressed ? 0.5 : 1 }]}>
                <IconSymbol name="xmark" size={22} color={colors.foreground} />
              </Pressable>
            </View>

            {/* Start row */}
            <Pressable
              onPress={() => setStaffSubPicker(staffSubPicker === "start" ? null : "start")}
              style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 14, paddingHorizontal: 4, borderRadius: 12, backgroundColor: staffSubPicker === "start" ? colors.primary + "18" : "transparent", marginBottom: 4 }}
            >
              <Text style={{ fontSize: 15, fontWeight: "600", color: colors.foreground }}>Start Time</Text>
              <Text style={{ fontSize: 17, fontWeight: "700", color: colors.primary }}>{(() => { const [h, m] = staffDraftStart.split(":").map(Number); const ap = h >= 12 ? "PM" : "AM"; const hr = h === 0 ? 12 : h > 12 ? h - 12 : h; return `${hr}:${String(m).padStart(2,"0")} ${ap}`; })()}</Text>
            </Pressable>
            {staffSubPicker === "start" && (
              <TapTimePicker value={staffDraftStart} onChange={(v) => { setStaffDraftStart(v); setStaffTimeError(null); }} stepMinutes={15} />
            )}

            {/* End row */}
            <Pressable
              onPress={() => setStaffSubPicker(staffSubPicker === "end" ? null : "end")}
              style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 14, paddingHorizontal: 4, borderRadius: 12, backgroundColor: staffSubPicker === "end" ? colors.primary + "18" : "transparent", marginBottom: 4 }}
            >
              <Text style={{ fontSize: 15, fontWeight: "600", color: colors.foreground }}>End Time</Text>
              <Text style={{ fontSize: 17, fontWeight: "700", color: colors.primary }}>{(() => { const [h, m] = staffDraftEnd.split(":").map(Number); const ap = h >= 12 ? "PM" : "AM"; const hr = h === 0 ? 12 : h > 12 ? h - 12 : h; return `${hr}:${String(m).padStart(2,"0")} ${ap}`; })()}</Text>
            </Pressable>
            {staffSubPicker === "end" && (
              <TapTimePicker value={staffDraftEnd} onChange={(v) => { setStaffDraftEnd(v); setStaffTimeError(null); }} stepMinutes={15} />
            )}

            {staffTimeError ? (
              <Text style={{ color: colors.error, fontSize: 13, textAlign: "center", marginVertical: 8 }}>{staffTimeError}</Text>
            ) : null}
            <Pressable
              onPress={saveStaffTimePicker}
              style={({ pressed }) => [{ backgroundColor: staffTimeError ? colors.border : colors.primary, paddingVertical: 16, borderRadius: 14, alignItems: "center", opacity: pressed ? 0.8 : 1, marginTop: 12 }]}
            >
              <Text style={{ color: staffTimeError ? colors.muted : "#fff", fontWeight: "700", fontSize: 16 }}>Save Hours</Text>
            </Pressable>
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
    marginTop: 8,
  },
  colorRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  colorDot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  colorDotSelected: {
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.6)",
  },
  serviceChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    gap: 8,
  },
  svcDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
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
});
