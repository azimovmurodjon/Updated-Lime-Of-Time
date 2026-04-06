import {
  Text,
  View,
  Pressable,
  StyleSheet,
  TextInput,
  ScrollView,
  Switch,
  useWindowDimensions,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useStore } from "@/lib/store";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useState, useCallback } from "react";
import { DAYS_OF_WEEK, WorkingHours, BusinessProfile } from "@/lib/types";

const DAY_LABELS: Record<string, string> = {
  sunday: "Sunday",
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
};

export default function SettingsScreen() {
  const { state, dispatch } = useStore();
  const colors = useColors();
  const { width } = useWindowDimensions();
  const hp = Math.max(16, width * 0.05);
  const { settings } = state;

  const [businessName, setBusinessName] = useState(settings.businessName);
  const [editingName, setEditingName] = useState(false);

  // Business Profile state
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState<BusinessProfile>({
    ownerName: settings.profile?.ownerName ?? "",
    phone: settings.profile?.phone ?? "",
    email: settings.profile?.email ?? "",
    address: settings.profile?.address ?? "",
    description: settings.profile?.description ?? "",
    website: settings.profile?.website ?? "",
  });

  const handleSaveName = useCallback(() => {
    if (businessName.trim()) {
      dispatch({ type: "UPDATE_SETTINGS", payload: { businessName: businessName.trim() } });
    }
    setEditingName(false);
  }, [businessName, dispatch]);

  const handleSaveProfile = useCallback(() => {
    dispatch({
      type: "UPDATE_SETTINGS",
      payload: {
        profile: {
          ownerName: profileForm.ownerName.trim(),
          phone: profileForm.phone.trim(),
          email: profileForm.email.trim(),
          address: profileForm.address.trim(),
          description: profileForm.description.trim(),
          website: profileForm.website.trim(),
        },
      },
    });
    setEditingProfile(false);
  }, [profileForm, dispatch]);

  const toggleNotifications = useCallback(() => {
    dispatch({
      type: "UPDATE_SETTINGS",
      payload: { notificationsEnabled: !settings.notificationsEnabled },
    });
  }, [settings.notificationsEnabled, dispatch]);

  const toggleDay = useCallback(
    (day: string) => {
      const current = settings.workingHours[day];
      const updated: Record<string, WorkingHours> = {
        ...settings.workingHours,
        [day]: { ...current, enabled: !current.enabled },
      };
      dispatch({ type: "UPDATE_SETTINGS", payload: { workingHours: updated } });
    },
    [settings.workingHours, dispatch]
  );

  const updateDayTime = useCallback(
    (day: string, field: "start" | "end", value: string) => {
      const current = settings.workingHours[day];
      const updated: Record<string, WorkingHours> = {
        ...settings.workingHours,
        [day]: { ...current, [field]: value },
      };
      dispatch({ type: "UPDATE_SETTINGS", payload: { workingHours: updated } });
    },
    [settings.workingHours, dispatch]
  );

  const setDefaultDuration = useCallback(
    (duration: number) => {
      dispatch({ type: "UPDATE_SETTINGS", payload: { defaultDuration: duration } });
    },
    [dispatch]
  );

  const updateProfileField = (field: keyof BusinessProfile, value: string) => {
    setProfileForm((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <ScreenContainer className="pt-2" style={{ paddingHorizontal: hp }}>
      <Text className="text-2xl font-bold text-foreground" style={{ marginBottom: 20 }}>Settings</Text>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Business Name */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.cardLabel, { color: colors.muted }]}>Business Name</Text>
          {editingName ? (
            <View style={styles.editRow}>
              <TextInput
                style={[styles.editInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
                value={businessName}
                onChangeText={setBusinessName}
                returnKeyType="done"
                onSubmitEditing={handleSaveName}
                autoFocus
              />
              <Pressable
                onPress={handleSaveName}
                style={({ pressed }) => [styles.smallButton, { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 }]}
              >
                <Text style={styles.smallButtonText}>Save</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable
              onPress={() => setEditingName(true)}
              style={({ pressed }) => [styles.editableRow, { opacity: pressed ? 0.7 : 1 }]}
            >
              <Text className="text-base font-semibold text-foreground" style={{ flex: 1 }}>{settings.businessName}</Text>
              <IconSymbol name="pencil" size={18} color={colors.muted} />
            </Pressable>
          )}
        </View>

        {/* Business Profile */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <IconSymbol name="person.fill" size={18} color={colors.primary} />
              <Text style={[styles.cardTitle, { color: colors.foreground }]}>Business Profile</Text>
            </View>
            <Pressable
              onPress={() => {
                if (editingProfile) {
                  handleSaveProfile();
                } else {
                  setProfileForm({
                    ownerName: settings.profile?.ownerName ?? "",
                    phone: settings.profile?.phone ?? "",
                    email: settings.profile?.email ?? "",
                    address: settings.profile?.address ?? "",
                    description: settings.profile?.description ?? "",
                    website: settings.profile?.website ?? "",
                  });
                  setEditingProfile(true);
                }
              }}
              style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
            >
              <Text style={{ color: colors.primary, fontSize: 14, fontWeight: "600" }}>
                {editingProfile ? "Save" : "Edit"}
              </Text>
            </Pressable>
          </View>

          {editingProfile ? (
            <View>
              <Text style={[styles.fieldLabel, { color: colors.muted }]}>Owner Name</Text>
              <TextInput
                style={[styles.profileInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
                placeholder="Your full name"
                placeholderTextColor={colors.muted}
                value={profileForm.ownerName}
                onChangeText={(v) => updateProfileField("ownerName", v)}
                returnKeyType="next"
              />

              <Text style={[styles.fieldLabel, { color: colors.muted }]}>Phone</Text>
              <TextInput
                style={[styles.profileInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
                placeholder="Business phone number"
                placeholderTextColor={colors.muted}
                value={profileForm.phone}
                onChangeText={(v) => updateProfileField("phone", v)}
                keyboardType="phone-pad"
                returnKeyType="next"
              />

              <Text style={[styles.fieldLabel, { color: colors.muted }]}>Email</Text>
              <TextInput
                style={[styles.profileInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
                placeholder="Business email"
                placeholderTextColor={colors.muted}
                value={profileForm.email}
                onChangeText={(v) => updateProfileField("email", v)}
                keyboardType="email-address"
                autoCapitalize="none"
                returnKeyType="next"
              />

              <Text style={[styles.fieldLabel, { color: colors.muted }]}>Address</Text>
              <TextInput
                style={[styles.profileInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
                placeholder="Business address"
                placeholderTextColor={colors.muted}
                value={profileForm.address}
                onChangeText={(v) => updateProfileField("address", v)}
                returnKeyType="next"
              />

              <Text style={[styles.fieldLabel, { color: colors.muted }]}>Website</Text>
              <TextInput
                style={[styles.profileInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
                placeholder="https://yourbusiness.com"
                placeholderTextColor={colors.muted}
                value={profileForm.website}
                onChangeText={(v) => updateProfileField("website", v)}
                keyboardType="url"
                autoCapitalize="none"
                returnKeyType="next"
              />

              <Text style={[styles.fieldLabel, { color: colors.muted }]}>Description</Text>
              <TextInput
                style={[styles.profileInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground, minHeight: 60, textAlignVertical: "top" }]}
                placeholder="Tell clients about your business..."
                placeholderTextColor={colors.muted}
                value={profileForm.description}
                onChangeText={(v) => updateProfileField("description", v)}
                multiline
                numberOfLines={3}
                returnKeyType="done"
              />

              <View style={styles.profileActions}>
                <Pressable
                  onPress={() => setEditingProfile(false)}
                  style={({ pressed }) => [styles.cancelButton, { borderColor: colors.border, opacity: pressed ? 0.7 : 1 }]}
                >
                  <Text className="text-sm font-medium text-foreground">Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={handleSaveProfile}
                  style={({ pressed }) => [styles.saveButton, { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 }]}
                >
                  <Text style={styles.saveButtonText}>Save Profile</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <View>
              {settings.profile?.ownerName ? (
                <View style={styles.profileRow}>
                  <IconSymbol name="person.fill" size={14} color={colors.muted} />
                  <Text className="text-sm text-foreground" style={{ marginLeft: 8 }}>{settings.profile.ownerName}</Text>
                </View>
              ) : null}
              {settings.profile?.phone ? (
                <View style={styles.profileRow}>
                  <IconSymbol name="phone.fill" size={14} color={colors.muted} />
                  <Text className="text-sm text-foreground" style={{ marginLeft: 8 }}>{settings.profile.phone}</Text>
                </View>
              ) : null}
              {settings.profile?.email ? (
                <View style={styles.profileRow}>
                  <IconSymbol name="envelope.fill" size={14} color={colors.muted} />
                  <Text className="text-sm text-foreground" style={{ marginLeft: 8 }}>{settings.profile.email}</Text>
                </View>
              ) : null}
              {settings.profile?.address ? (
                <View style={styles.profileRow}>
                  <IconSymbol name="mappin" size={14} color={colors.muted} />
                  <Text className="text-sm text-foreground" style={{ marginLeft: 8 }}>{settings.profile.address}</Text>
                </View>
              ) : null}
              {settings.profile?.website ? (
                <View style={styles.profileRow}>
                  <IconSymbol name="globe" size={14} color={colors.muted} />
                  <Text className="text-sm text-foreground" style={{ marginLeft: 8 }}>{settings.profile.website}</Text>
                </View>
              ) : null}
              {settings.profile?.description ? (
                <Text className="text-xs text-muted" style={{ marginTop: 8, lineHeight: 18 }}>{settings.profile.description}</Text>
              ) : null}
              {!settings.profile?.ownerName && !settings.profile?.phone && !settings.profile?.email ? (
                <Text className="text-sm text-muted" style={{ fontStyle: "italic" }}>Tap Edit to add your business profile</Text>
              ) : null}
            </View>
          )}
        </View>

        {/* Default Duration */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.cardLabel, { color: colors.muted }]}>Default Appointment Duration</Text>
          <View style={styles.durationRow}>
            {[15, 30, 45, 60, 90, 120].map((d) => (
              <Pressable
                key={d}
                onPress={() => setDefaultDuration(d)}
                style={({ pressed }) => [
                  styles.durationChip,
                  {
                    backgroundColor: settings.defaultDuration === d ? colors.primary : colors.background,
                    borderColor: settings.defaultDuration === d ? colors.primary : colors.border,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "500",
                    color: settings.defaultDuration === d ? "#FFFFFF" : colors.foreground,
                  }}
                >
                  {d} min
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Notifications */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.switchRow}>
            <View style={styles.switchLabel}>
              <IconSymbol name="bell.fill" size={20} color={colors.primary} />
              <Text className="text-base font-medium text-foreground" style={{ marginLeft: 12 }}>Notifications</Text>
            </View>
            <Switch
              value={settings.notificationsEnabled}
              onValueChange={toggleNotifications}
              trackColor={{ false: colors.border, true: colors.primary + "60" }}
              thumbColor={settings.notificationsEnabled ? colors.primary : colors.muted}
            />
          </View>
        </View>

        {/* Working Hours */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.cardLabel, { color: colors.muted }]}>Working Hours</Text>
          {DAYS_OF_WEEK.map((day, idx) => {
            const wh = settings.workingHours[day];
            const isLast = idx === DAYS_OF_WEEK.length - 1;
            return (
              <View key={day} style={[styles.dayRow, !isLast && { borderBottomWidth: 1, borderBottomColor: colors.border + "40" }]}>
                <Switch
                  value={wh.enabled}
                  onValueChange={() => toggleDay(day)}
                  trackColor={{ false: colors.border, true: colors.primary + "60" }}
                  thumbColor={wh.enabled ? colors.primary : colors.muted}
                  style={{ transform: [{ scale: 0.8 }] }}
                />
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "500",
                    width: 90,
                    marginLeft: 8,
                    color: wh.enabled ? colors.foreground : colors.muted,
                  }}
                >
                  {DAY_LABELS[day]}
                </Text>
                {wh.enabled && (
                  <View style={styles.timeInputs}>
                    <TextInput
                      style={[styles.timeInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
                      value={wh.start}
                      onChangeText={(v) => updateDayTime(day, "start", v)}
                      returnKeyType="done"
                    />
                    <Text style={{ fontSize: 12, color: colors.muted, marginHorizontal: 4 }}>to</Text>
                    <TextInput
                      style={[styles.timeInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
                      value={wh.end}
                      onChangeText={(v) => updateDayTime(day, "end", v)}
                      returnKeyType="done"
                    />
                  </View>
                )}
              </View>
            );
          })}
        </View>

        {/* Stats */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.cardLabel, { color: colors.muted }]}>Quick Stats</Text>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={[styles.statNumber, { color: colors.primary }]}>{state.services.length}</Text>
              <Text className="text-xs text-muted">Services</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statNumber, { color: colors.primary }]}>{state.clients.length}</Text>
              <Text className="text-xs text-muted">Clients</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statNumber, { color: colors.primary }]}>{state.appointments.length}</Text>
              <Text className="text-xs text-muted">Bookings</Text>
            </View>
          </View>
        </View>

        {/* App Info */}
        <View style={styles.appInfo}>
          <Text style={[styles.appName, { color: colors.primary }]}>Lime Of Time</Text>
          <Text className="text-xs text-muted" style={{ marginTop: 4 }}>Version 1.0.0</Text>
          <Text className="text-xs text-muted" style={{ marginTop: 2 }}>Smart Scheduling for Small Business</Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
  },
  cardLabel: {
    fontSize: 12,
    fontWeight: "500",
    marginBottom: 10,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  cardHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "600",
    marginLeft: 10,
  },
  editRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  editInput: {
    flex: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    borderWidth: 1,
  },
  editableRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  smallButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  smallButtonText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "500",
    marginBottom: 4,
    marginTop: 6,
  },
  profileInput: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    borderWidth: 1,
    marginBottom: 6,
  },
  profileActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
  },
  cancelButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
  },
  saveButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: "center",
  },
  saveButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  profileRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
  },
  durationRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  durationChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  switchLabel: {
    flexDirection: "row",
    alignItems: "center",
  },
  dayRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
  },
  timeInputs: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
  },
  timeInput: {
    width: 56,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 4,
    fontSize: 12,
    textAlign: "center",
    borderWidth: 1,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  statItem: {
    flex: 1,
    alignItems: "center",
  },
  statNumber: {
    fontSize: 24,
    fontWeight: "700",
    lineHeight: 30,
  },
  appInfo: {
    alignItems: "center",
    paddingVertical: 24,
  },
  appName: {
    fontSize: 16,
    fontWeight: "700",
  },
});
