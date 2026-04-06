import { useState, useCallback, useMemo } from "react";
import {
  Text,
  View,
  Pressable,
  StyleSheet,
  Switch,
  TextInput,
  ScrollView,
  Alert,
  FlatList,
  Modal,
  Image,
  useWindowDimensions,
  Platform,
  Linking,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useStore, formatTime } from "@/lib/store";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useRouter } from "expo-router";
import { useThemeContext } from "@/lib/theme-provider";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { formatPhoneNumber, getMapUrl } from "@/lib/types";
import { trpc } from "@/lib/trpc";

const DAYS_OF_WEEK = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const;
const DAY_LABELS: Record<string, string> = {
  sunday: "Sun",
  monday: "Mon",
  tuesday: "Tue",
  wednesday: "Wed",
  thursday: "Thu",
  friday: "Fri",
  saturday: "Sat",
};

const TIME_OPTIONS: string[] = [];
for (let h = 0; h < 24; h++) {
  for (let m = 0; m < 60; m += 30) {
    TIME_OPTIONS.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
  }
}

function formatTimeLabel(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")} ${ampm}`;
}

export default function SettingsScreen() {
  const { state, dispatch, syncToDb } = useStore();
  const deleteBusinessMut = trpc.business.delete.useMutation();
  const colors = useColors();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const hp = Math.round(Math.max(16, width * 0.045));
  const { setColorScheme: setThemeOverride } = useThemeContext();
  const settings = state.settings;

  // Business Name editing
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(settings.businessName);

  // Profile editing
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState(settings.profile);

  // Time picker
  const [timePickerVisible, setTimePickerVisible] = useState(false);
  const [timePickerDay, setTimePickerDay] = useState("");
  const [timePickerField, setTimePickerField] = useState<"start" | "end">("start");

  const currentPickerValue = useMemo(() => {
    if (!timePickerDay) return "09:00";
    const wh = settings.workingHours[timePickerDay];
    return timePickerField === "start" ? wh?.start ?? "09:00" : wh?.end ?? "17:00";
  }, [timePickerDay, timePickerField, settings.workingHours]);

  const saveName = useCallback(() => {
    if (nameValue.trim()) {
      const action = { type: "UPDATE_SETTINGS" as const, payload: { businessName: nameValue.trim() } };
      dispatch(action);
      syncToDb(action);
    }
    setEditingName(false);
  }, [nameValue, dispatch, syncToDb]);

  const handleProfilePhoneChange = useCallback((text: string) => {
    setProfileForm((p) => ({ ...p, phone: formatPhoneNumber(text) }));
  }, []);

  const saveProfile = useCallback(() => {
    const action = { type: "UPDATE_SETTINGS" as const, payload: { profile: profileForm } };
    dispatch(action);
    syncToDb(action);
    setEditingProfile(false);
  }, [profileForm, dispatch, syncToDb]);

  const openAddressInMap = useCallback(() => {
    const address = settings.profile.address;
    if (!address) {
      Alert.alert("No Address", "Please add an address to your business profile first.");
      return;
    }
    const url = getMapUrl(address);
    Linking.openURL(url).catch(() => {
      Alert.alert("Error", "Could not open maps application.");
    });
  }, [settings.profile.address]);

  const toggleNotifications = useCallback(() => {
    const action = { type: "UPDATE_SETTINGS" as const, payload: { notificationsEnabled: !settings.notificationsEnabled } };
    dispatch(action);
    syncToDb(action);
  }, [settings.notificationsEnabled, dispatch, syncToDb]);

  const toggleDay = useCallback(
    (day: string) => {
      const wh = { ...settings.workingHours };
      wh[day] = { ...wh[day], enabled: !wh[day].enabled };
      const action = { type: "UPDATE_SETTINGS" as const, payload: { workingHours: wh } };
      dispatch(action);
      syncToDb(action);
    },
    [settings.workingHours, dispatch, syncToDb]
  );

  const openTimePicker = useCallback((day: string, field: "start" | "end") => {
    setTimePickerDay(day);
    setTimePickerField(field);
    setTimePickerVisible(true);
  }, []);

  const selectTime = useCallback(
    (time: string) => {
      const wh = { ...settings.workingHours };
      wh[timePickerDay] = { ...wh[timePickerDay], [timePickerField]: time };
      const action = { type: "UPDATE_SETTINGS" as const, payload: { workingHours: wh } };
      dispatch(action);
      syncToDb(action);
      setTimePickerVisible(false);
    },
    [timePickerDay, timePickerField, settings.workingHours, dispatch, syncToDb]
  );

  const setThemeMode = useCallback(
    (mode: "light" | "dark" | "system") => {
      const action = { type: "UPDATE_SETTINGS" as const, payload: { themeMode: mode } };
      dispatch(action);
      syncToDb(action);
      setThemeOverride(mode === "system" ? "light" : mode);
    },
    [dispatch, setThemeOverride, syncToDb]
  );

  const policy = settings.cancellationPolicy;

  const toggleCancellation = useCallback(() => {
    const action = { type: "UPDATE_SETTINGS" as const, payload: { cancellationPolicy: { ...policy, enabled: !policy.enabled } } };
    dispatch(action);
    syncToDb(action);
  }, [policy, dispatch, syncToDb]);

  const setCancellationHours = useCallback(
    (hours: number) => {
      const action = { type: "UPDATE_SETTINGS" as const, payload: { cancellationPolicy: { ...policy, hoursBeforeAppointment: hours } } };
      dispatch(action);
      syncToDb(action);
    },
    [policy, dispatch, syncToDb]
  );

  const setCancellationFee = useCallback(
    (fee: number) => {
      const action = { type: "UPDATE_SETTINGS" as const, payload: { cancellationPolicy: { ...policy, feePercentage: fee } } };
      dispatch(action);
      syncToDb(action);
    },
    [policy, dispatch, syncToDb]
  );

  // Temporary Closed toggle
  const toggleTemporaryClosed = useCallback(() => {
    const newValue = !settings.temporaryClosed;
    const action = { type: "UPDATE_SETTINGS" as const, payload: { temporaryClosed: newValue } };
    dispatch(action);
    syncToDb(action);
    if (newValue) {
      Alert.alert("Business Closed", "Your business is now marked as temporarily closed. Clients will not be able to book new appointments.");
    }
  }, [settings.temporaryClosed, dispatch, syncToDb]);

  // Logout
  const handleLogout = useCallback(() => {
    Alert.alert("Log Out", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log Out",
        style: "destructive",
        onPress: async () => {
          dispatch({ type: "RESET_ALL_DATA" });
          try {
            await AsyncStorage.multiRemove([
              "@bookease_services",
              "@bookease_clients",
              "@bookease_appointments",
              "@bookease_reviews",
              "@bookease_settings",
              "@bookease_business_owner_id",
            ]);
          } catch {}
          router.replace("/onboarding");
        },
      },
    ]);
  }, [dispatch, router]);

  // Delete Business
  const handleDeleteBusiness = useCallback(() => {
    Alert.alert(
      "Delete Business",
      "This will permanently delete all your data including services, clients, appointments, and reviews. This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete Everything",
          style: "destructive",
          onPress: async () => {
            // Delete from database first
            if (state.businessOwnerId) {
              try {
                await deleteBusinessMut.mutateAsync({ id: state.businessOwnerId });
              } catch (err) {
                console.warn("[Settings] Failed to delete from DB:", err);
              }
            }
            dispatch({ type: "RESET_ALL_DATA" });
            try {
              await AsyncStorage.multiRemove([
                "@bookease_services",
                "@bookease_clients",
                "@bookease_appointments",
                "@bookease_reviews",
                "@bookease_settings",
                "@bookease_business_owner_id",
              ]);
            } catch {}
            router.replace("/onboarding");
          },
        },
      ]
    );
  }, [dispatch, router, state.businessOwnerId, deleteBusinessMut]);

  const themeOptions: { key: "light" | "dark" | "system"; label: string; icon: string }[] = [
    { key: "light", label: "Light", icon: "sun.max.fill" },
    { key: "dark", label: "Dark", icon: "moon.fill" },
    { key: "system", label: "Auto", icon: "gear" },
  ];

  return (
    <ScreenContainer>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: hp, paddingTop: 8, paddingBottom: 100 }}>
        {/* Header */}
        <View style={styles.headerRow}>
          <Text style={{ fontSize: 24, fontWeight: "700", color: colors.foreground }}>Settings</Text>
          <Image source={require("@/assets/images/icon.png")} style={styles.headerLogo} resizeMode="contain" />
        </View>

        {/* Temporary Closed Banner */}
        {settings.temporaryClosed && (
          <View style={[styles.closedBanner, { backgroundColor: colors.error + "15", borderColor: colors.error + "40" }]}>
            <IconSymbol name="xmark.circle.fill" size={18} color={colors.error} />
            <Text style={{ fontSize: 13, fontWeight: "600", color: colors.error, marginLeft: 8, flex: 1 }}>
              Business is temporarily closed
            </Text>
          </View>
        )}

        {/* Business Name */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <IconSymbol name="building.2.fill" size={20} color={colors.primary} />
              <Text style={[styles.cardTitle, { color: colors.foreground }]}>Business Name</Text>
            </View>
            {!editingName && (
              <Pressable onPress={() => { setNameValue(settings.businessName); setEditingName(true); }} style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}>
                <IconSymbol name="pencil" size={18} color={colors.primary} />
              </Pressable>
            )}
          </View>
          {editingName ? (
            <View style={styles.editRow}>
              <TextInput
                style={[styles.editInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
                value={nameValue}
                onChangeText={setNameValue}
                returnKeyType="done"
                onSubmitEditing={saveName}
                autoFocus
              />
              <Pressable onPress={saveName} style={({ pressed }) => [styles.smallButton, { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 }]}>
                <Text style={styles.smallButtonText}>Save</Text>
              </Pressable>
            </View>
          ) : (
            <Text style={{ fontSize: 16, color: colors.foreground, fontWeight: "500" }}>{settings.businessName}</Text>
          )}
        </View>

        {/* Business Profile */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <IconSymbol name="person.fill" size={20} color={colors.primary} />
              <Text style={[styles.cardTitle, { color: colors.foreground }]}>Business Profile</Text>
            </View>
            {!editingProfile && (
              <Pressable onPress={() => { setProfileForm(settings.profile); setEditingProfile(true); }} style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}>
                <IconSymbol name="pencil" size={18} color={colors.primary} />
              </Pressable>
            )}
          </View>

          {editingProfile ? (
            <View>
              <Text style={[styles.fieldLabel, { color: colors.muted }]}>Owner Name</Text>
              <TextInput
                style={[styles.profileInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
                placeholder="John Doe"
                placeholderTextColor={colors.muted}
                value={profileForm.ownerName}
                onChangeText={(v) => setProfileForm((p) => ({ ...p, ownerName: v }))}
                returnKeyType="next"
              />

              <Text style={[styles.fieldLabel, { color: colors.muted }]}>Phone</Text>
              <TextInput
                style={[styles.profileInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
                placeholder="(000) 000-0000"
                placeholderTextColor={colors.muted}
                value={profileForm.phone}
                onChangeText={handleProfilePhoneChange}
                keyboardType="phone-pad"
                returnKeyType="next"
                maxLength={14}
              />

              <Text style={[styles.fieldLabel, { color: colors.muted }]}>Email (optional)</Text>
              <TextInput
                style={[styles.profileInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
                placeholder="you@business.com"
                placeholderTextColor={colors.muted}
                value={profileForm.email}
                onChangeText={(v) => setProfileForm((p) => ({ ...p, email: v }))}
                keyboardType="email-address"
                autoCapitalize="none"
                returnKeyType="next"
              />

              <Text style={[styles.fieldLabel, { color: colors.muted }]}>Address</Text>
              <TextInput
                style={[styles.profileInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
                placeholder="4661 McKnight Road, Pittsburgh PA, 15237"
                placeholderTextColor={colors.muted}
                value={profileForm.address}
                onChangeText={(v) => setProfileForm((p) => ({ ...p, address: v }))}
                returnKeyType="next"
              />

              <Text style={[styles.fieldLabel, { color: colors.muted }]}>Website (optional)</Text>
              <TextInput
                style={[styles.profileInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
                placeholder="https://www.yourbusiness.com"
                placeholderTextColor={colors.muted}
                value={profileForm.website}
                onChangeText={(v) => setProfileForm((p) => ({ ...p, website: v }))}
                autoCapitalize="none"
                returnKeyType="next"
              />

              <Text style={[styles.fieldLabel, { color: colors.muted }]}>Description</Text>
              <TextInput
                style={[styles.profileInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground, minHeight: 70, textAlignVertical: "top" }]}
                placeholder="Tell clients about your business..."
                placeholderTextColor={colors.muted}
                value={profileForm.description}
                onChangeText={(v) => setProfileForm((p) => ({ ...p, description: v }))}
                multiline
                numberOfLines={3}
              />

              <View style={styles.profileActions}>
                <Pressable onPress={() => setEditingProfile(false)} style={({ pressed }) => [styles.cancelButton, { borderColor: colors.border, opacity: pressed ? 0.7 : 1 }]}>
                  <Text style={{ fontSize: 14, color: colors.foreground }}>Cancel</Text>
                </Pressable>
                <Pressable onPress={saveProfile} style={({ pressed }) => [styles.saveButton, { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 }]}>
                  <Text style={styles.saveButtonText}>Save Profile</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <View>
              {settings.profile.ownerName ? (
                <View style={styles.profileRow}>
                  <IconSymbol name="person.fill" size={14} color={colors.muted} />
                  <Text style={{ fontSize: 14, color: colors.foreground, marginLeft: 8 }}>{settings.profile.ownerName}</Text>
                </View>
              ) : null}
              {settings.profile.phone ? (
                <View style={styles.profileRow}>
                  <IconSymbol name="phone.fill" size={14} color={colors.muted} />
                  <Text style={{ fontSize: 14, color: colors.foreground, marginLeft: 8 }}>{settings.profile.phone}</Text>
                </View>
              ) : null}
              {settings.profile.email ? (
                <View style={styles.profileRow}>
                  <IconSymbol name="envelope.fill" size={14} color={colors.muted} />
                  <Text style={{ fontSize: 14, color: colors.foreground, marginLeft: 8 }}>{settings.profile.email}</Text>
                </View>
              ) : null}
              {settings.profile.address ? (
                <Pressable
                  onPress={openAddressInMap}
                  style={({ pressed }) => [styles.profileRow, { opacity: pressed ? 0.6 : 1 }]}
                >
                  <IconSymbol name="mappin" size={14} color={colors.primary} />
                  <Text style={{ fontSize: 14, color: colors.primary, marginLeft: 8, textDecorationLine: "underline", flex: 1 }}>
                    {settings.profile.address}
                  </Text>
                  <IconSymbol name="arrow.up.right.square" size={14} color={colors.primary} style={{ marginLeft: 4 }} />
                </Pressable>
              ) : null}
              {settings.profile.website ? (
                <Pressable
                  onPress={() => {
                    const url = settings.profile.website.startsWith("http") ? settings.profile.website : `https://${settings.profile.website}`;
                    Linking.openURL(url).catch(() => {});
                  }}
                  style={({ pressed }) => [styles.profileRow, { opacity: pressed ? 0.6 : 1 }]}
                >
                  <IconSymbol name="globe" size={14} color={colors.primary} />
                  <Text style={{ fontSize: 14, color: colors.primary, marginLeft: 8, textDecorationLine: "underline" }}>{settings.profile.website}</Text>
                </Pressable>
              ) : null}
              {settings.profile.description ? (
                <Text style={{ fontSize: 13, color: colors.muted, marginTop: 6, lineHeight: 18 }}>{settings.profile.description}</Text>
              ) : null}
              {!settings.profile.ownerName && !settings.profile.phone && (
                <Text style={{ fontSize: 13, color: colors.muted }}>Tap edit to add your business profile</Text>
              )}
            </View>
          )}
        </View>

        {/* Temporary Closed */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.switchRow}>
            <View style={styles.switchLabel}>
              <IconSymbol name="clock.fill" size={20} color={settings.temporaryClosed ? colors.error : colors.primary} />
              <View style={{ marginLeft: 12, flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: "500", color: colors.foreground }}>Temporarily Closed</Text>
                <Text style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>
                  Blocks all new bookings when enabled
                </Text>
              </View>
            </View>
            <Switch
              value={settings.temporaryClosed}
              onValueChange={toggleTemporaryClosed}
              trackColor={{ false: colors.border, true: colors.error + "60" }}
              thumbColor={settings.temporaryClosed ? colors.error : colors.muted}
            />
          </View>
        </View>

        {/* Theme Mode */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.cardLabel, { color: colors.muted }]}>Appearance</Text>
          <View style={styles.themeRow}>
            {themeOptions.map((opt) => {
              const isActive = settings.themeMode === opt.key;
              return (
                <Pressable
                  key={opt.key}
                  onPress={() => setThemeMode(opt.key)}
                  style={({ pressed }) => [
                    styles.themeOption,
                    {
                      flex: 1,
                      backgroundColor: isActive ? colors.primary + "15" : colors.background,
                      borderColor: isActive ? colors.primary : colors.border,
                      opacity: pressed ? 0.8 : 1,
                    },
                  ]}
                >
                  <IconSymbol name={opt.icon as any} size={22} color={isActive ? colors.primary : colors.muted} />
                  <Text style={{ fontSize: 12, fontWeight: "600", color: isActive ? colors.primary : colors.muted, marginTop: 6 }}>
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Cancellation Policy */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.switchRow}>
            <View style={styles.switchLabel}>
              <IconSymbol name="exclamationmark.triangle.fill" size={20} color="#FF9800" />
              <Text style={{ fontSize: 15, fontWeight: "500", color: colors.foreground, marginLeft: 12 }}>Cancellation Fee</Text>
            </View>
            <Switch
              value={policy.enabled}
              onValueChange={toggleCancellation}
              trackColor={{ false: colors.border, true: colors.primary + "60" }}
              thumbColor={policy.enabled ? colors.primary : colors.muted}
            />
          </View>
          {policy.enabled && (
            <View style={{ marginTop: 14 }}>
              <Text style={{ fontSize: 12, fontWeight: "500", color: colors.muted, marginBottom: 8 }}>Hours Before Appointment</Text>
              <View style={styles.durationRow}>
                {[1, 2, 4, 6, 12, 24].map((h) => (
                  <Pressable
                    key={h}
                    onPress={() => setCancellationHours(h)}
                    style={({ pressed }) => [
                      styles.durationChip,
                      {
                        backgroundColor: policy.hoursBeforeAppointment === h ? colors.primary : colors.background,
                        borderColor: policy.hoursBeforeAppointment === h ? colors.primary : colors.border,
                        opacity: pressed ? 0.7 : 1,
                      },
                    ]}
                  >
                    <Text style={{ fontSize: 13, fontWeight: "500", color: policy.hoursBeforeAppointment === h ? "#FFFFFF" : colors.foreground }}>
                      {h}h
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Text style={{ fontSize: 12, fontWeight: "500", color: colors.muted, marginTop: 12, marginBottom: 8 }}>Fee Percentage</Text>
              <View style={styles.durationRow}>
                {[25, 50, 75, 100].map((p) => (
                  <Pressable
                    key={p}
                    onPress={() => setCancellationFee(p)}
                    style={({ pressed }) => [
                      styles.durationChip,
                      {
                        backgroundColor: policy.feePercentage === p ? colors.primary : colors.background,
                        borderColor: policy.feePercentage === p ? colors.primary : colors.border,
                        opacity: pressed ? 0.7 : 1,
                      },
                    ]}
                  >
                    <Text style={{ fontSize: 13, fontWeight: "500", color: policy.feePercentage === p ? "#FFFFFF" : colors.foreground }}>
                      {p}%
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Text style={{ fontSize: 11, color: colors.muted, marginTop: 8, lineHeight: 16 }}>
                Clients will be charged {policy.feePercentage}% of the service price if they cancel within {policy.hoursBeforeAppointment} hour{policy.hoursBeforeAppointment > 1 ? "s" : ""} of the appointment.
              </Text>
            </View>
          )}
        </View>

        {/* Notifications */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.switchRow}>
            <View style={styles.switchLabel}>
              <IconSymbol name="bell.fill" size={20} color={colors.primary} />
              <Text style={{ fontSize: 15, fontWeight: "500", color: colors.foreground, marginLeft: 12 }}>Notifications</Text>
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
                <Text style={{ fontSize: 13, fontWeight: "500", width: 44, marginLeft: 8, color: wh.enabled ? colors.foreground : colors.muted }}>
                  {DAY_LABELS[day]}
                </Text>
                {wh.enabled && (
                  <View style={styles.timeInputs}>
                    <Pressable
                      onPress={() => openTimePicker(day, "start")}
                      style={({ pressed }) => [styles.timeButton, { backgroundColor: colors.background, borderColor: colors.border, opacity: pressed ? 0.7 : 1 }]}
                    >
                      <Text style={{ fontSize: 12, color: colors.foreground, textAlign: "center" }}>{formatTimeLabel(wh.start)}</Text>
                    </Pressable>
                    <Text style={{ fontSize: 12, color: colors.muted, marginHorizontal: 4 }}>to</Text>
                    <Pressable
                      onPress={() => openTimePicker(day, "end")}
                      style={({ pressed }) => [styles.timeButton, { backgroundColor: colors.background, borderColor: colors.border, opacity: pressed ? 0.7 : 1 }]}
                    >
                      <Text style={{ fontSize: 12, color: colors.foreground, textAlign: "center" }}>{formatTimeLabel(wh.end)}</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            );
          })}
        </View>

        {/* Quick Stats */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.cardLabel, { color: colors.muted }]}>Quick Stats</Text>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={[styles.statNumber, { color: colors.primary }]}>{state.services.length}</Text>
              <Text style={{ fontSize: 12, color: colors.muted }}>Services</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statNumber, { color: colors.primary }]}>{state.clients.length}</Text>
              <Text style={{ fontSize: 12, color: colors.muted }}>Clients</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statNumber, { color: colors.primary }]}>{state.appointments.length}</Text>
              <Text style={{ fontSize: 12, color: colors.muted }}>Bookings</Text>
            </View>
          </View>
        </View>

        {/* Log Out */}
        <Pressable
          onPress={handleLogout}
          style={({ pressed }) => [styles.dangerButton, { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.7 : 1 }]}
        >
          <IconSymbol name="arrow.right.square.fill" size={20} color={colors.primary} />
          <Text style={{ fontSize: 15, fontWeight: "600", color: colors.primary, marginLeft: 12, flex: 1 }}>Log Out</Text>
          <IconSymbol name="chevron.right" size={16} color={colors.muted} />
        </Pressable>

        {/* Delete Business */}
        <Pressable
          onPress={handleDeleteBusiness}
          style={({ pressed }) => [styles.dangerButton, { backgroundColor: colors.error + "08", borderColor: colors.error + "30", opacity: pressed ? 0.7 : 1 }]}
        >
          <IconSymbol name="trash.fill" size={20} color={colors.error} />
          <Text style={{ fontSize: 15, fontWeight: "600", color: colors.error, marginLeft: 12, flex: 1 }}>Delete Business</Text>
          <IconSymbol name="chevron.right" size={16} color={colors.error + "60"} />
        </Pressable>

        {/* App Info */}
        <View style={styles.appInfo}>
          <Image source={require("@/assets/images/icon.png")} style={{ width: 48, height: 48, borderRadius: 12, marginBottom: 8 }} resizeMode="contain" />
          <Text style={[styles.appName, { color: colors.primary }]}>Lime Of Time</Text>
          <Text style={{ fontSize: 12, color: colors.muted, marginTop: 4 }}>Version 1.0.0</Text>
          <Text style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>Smart Scheduling for Small Business</Text>
        </View>
      </ScrollView>

      {/* Time Picker Modal */}
      <Modal visible={timePickerVisible} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={() => setTimePickerVisible(false)}>
          <Pressable style={[styles.modalContent, { backgroundColor: colors.background }]} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <Text style={{ fontSize: 17, fontWeight: "700", color: colors.foreground }}>
                Select {timePickerField === "start" ? "Start" : "End"} Time
              </Text>
              <Pressable onPress={() => setTimePickerVisible(false)} style={({ pressed }) => [{ opacity: pressed ? 0.5 : 1 }]}>
                <IconSymbol name="xmark" size={22} color={colors.foreground} />
              </Pressable>
            </View>
            <FlatList
              data={TIME_OPTIONS}
              keyExtractor={(item) => item}
              showsVerticalScrollIndicator={false}
              style={{ maxHeight: 360 }}
              initialScrollIndex={Math.max(0, TIME_OPTIONS.indexOf(currentPickerValue) - 2)}
              getItemLayout={(_, index) => ({ length: 48, offset: 48 * index, index })}
              renderItem={({ item }) => {
                const isSelected = item === currentPickerValue;
                return (
                  <Pressable
                    onPress={() => selectTime(item)}
                    style={({ pressed }) => [
                      styles.timePickerItem,
                      {
                        backgroundColor: isSelected ? colors.primary + "15" : "transparent",
                        borderColor: isSelected ? colors.primary : "transparent",
                        opacity: pressed ? 0.7 : 1,
                      },
                    ]}
                  >
                    <Text style={{ fontSize: 16, fontWeight: isSelected ? "700" : "400", color: isSelected ? colors.primary : colors.foreground }}>
                      {formatTimeLabel(item)}
                    </Text>
                    {isSelected && <IconSymbol name="checkmark" size={18} color={colors.primary} />}
                  </Pressable>
                );
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 20, paddingTop: 4 },
  headerLogo: { width: 32, height: 32, borderRadius: 8 },
  closedBanner: { flexDirection: "row", alignItems: "center", padding: 12, borderRadius: 12, borderWidth: 1, marginBottom: 14 },
  card: { borderRadius: 16, padding: 16, marginBottom: 14, borderWidth: 1 },
  cardLabel: { fontSize: 12, fontWeight: "500", marginBottom: 10 },
  cardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  cardHeaderLeft: { flexDirection: "row", alignItems: "center" },
  cardTitle: { fontSize: 15, fontWeight: "600", marginLeft: 10 },
  editRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  editInput: { flex: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, borderWidth: 1 },
  smallButton: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  smallButtonText: { color: "#FFFFFF", fontSize: 12, fontWeight: "600" },
  fieldLabel: { fontSize: 12, fontWeight: "500", marginBottom: 4, marginTop: 6, color: "#687076" },
  profileInput: { borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, borderWidth: 1, marginBottom: 6 },
  profileActions: { flexDirection: "row", gap: 8, marginTop: 10 },
  cancelButton: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1, alignItems: "center" },
  saveButton: { flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: "center" },
  saveButtonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "600" },
  profileRow: { flexDirection: "row", alignItems: "center", paddingVertical: 6 },
  themeRow: { flexDirection: "row", gap: 10 },
  themeOption: { alignItems: "center", paddingVertical: 14, borderRadius: 14, borderWidth: 1.5 },
  durationRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  durationChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1 },
  switchRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  switchLabel: { flexDirection: "row", alignItems: "center", flex: 1 },
  dayRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10 },
  timeInputs: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "flex-end" },
  timeButton: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, minWidth: 72 },
  statsRow: { flexDirection: "row", justifyContent: "space-between" },
  statItem: { flex: 1, alignItems: "center" },
  statNumber: { fontSize: 24, fontWeight: "700", lineHeight: 30 },
  dangerButton: { flexDirection: "row", alignItems: "center", borderRadius: 16, padding: 16, marginBottom: 14, borderWidth: 1 },
  appInfo: { alignItems: "center", paddingVertical: 24 },
  appName: { fontSize: 16, fontWeight: "700" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  modalContent: { borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 16, paddingBottom: 40, paddingHorizontal: 20 },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  timePickerItem: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, borderWidth: 1, marginBottom: 4, height: 48 },
});
