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
  Image,
  useWindowDimensions,
  Linking,
  Platform,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useStore } from "@/lib/store";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useRouter } from "expo-router";
import { useThemeContext } from "@/lib/theme-provider";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { formatPhoneNumber, getMapUrl } from "@/lib/types";
import { trpc } from "@/lib/trpc";
import { useAppLockContext } from "@/lib/app-lock-provider";

export default function SettingsScreen() {
  const { state, dispatch, syncToDb } = useStore();
  const deleteBusinessMut = trpc.business.delete.useMutation();
  const colors = useColors();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const hp = isTablet ? 32 : Math.round(Math.max(16, width * 0.045));
  const { setThemeMode: setThemeOverrideMode } = useThemeContext();
  const { biometricAvailable, biometricEnabled, biometricType, toggleBiometric } = useAppLockContext();
  const settings = state.settings;

  // Business Name editing
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(settings.businessName);

  // Profile editing
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState(settings.profile);

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

  const setThemeMode = useCallback(
    (mode: "light" | "dark" | "system") => {
      const action = { type: "UPDATE_SETTINGS" as const, payload: { themeMode: mode } };
      dispatch(action);
      syncToDb(action);
      setThemeOverrideMode(mode);
    },
    [dispatch, setThemeOverrideMode, syncToDb]
  );

  const themeOptions: { key: "light" | "dark" | "system"; label: string; icon: string }[] = [
    { key: "light", label: "Light", icon: "sun.max.fill" },
    { key: "dark", label: "Dark", icon: "moon.fill" },
    { key: "system", label: "Auto", icon: "gear" },
  ];

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

  // Quick stats
  const reviewAvg = useMemo(() => {
    if (state.reviews.length === 0) return null;
    return (state.reviews.reduce((s, r) => s + r.rating, 0) / state.reviews.length).toFixed(1);
  }, [state.reviews]);

  // Navigation items for sub-screens
  const navItems = [
    {
      title: "Schedule & Hours",
      subtitle: "Working hours, buffer time, custom days",
      icon: "calendar.badge.clock" as const,
      route: "/schedule-settings" as const,
      color: colors.primary,
    },
    {
      title: "Booking Policies",
      subtitle: "Cancellation fees, booking URL, temp closure",
      icon: "exclamationmark.triangle.fill" as const,
      route: "/booking-policies" as const,
      color: "#FF9800",
    },
    {
      title: "Client Reviews",
      subtitle: reviewAvg ? `${reviewAvg} ★ — ${state.reviews.length} review${state.reviews.length !== 1 ? "s" : ""}` : "No reviews yet",
      icon: "star.fill" as const,
      route: "/reviews" as const,
      color: "#f59e0b",
    },
    {
      title: "Export Data",
      subtitle: "PDF reports for clients, appointments, revenue",
      icon: "square.and.arrow.up.fill" as const,
      route: "/data-export" as const,
      color: colors.primary,
    },
    {
      title: "Locations",
      subtitle: `${state.locations.length} location${state.locations.length !== 1 ? "s" : ""} configured`,
      icon: "building.2.fill" as const,
      route: "/locations" as const,
      color: "#3B82F6",
    },
    {
      title: "Analytics",
      subtitle: "Revenue, clients, appointments insights",
      icon: "chart.bar.fill" as const,
      route: "/analytics-detail?tab=revenue" as const,
      color: "#8b5cf6",
    },
  ];

  return (
    <ScreenContainer tabletMaxWidth={0}>
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
                maxLength={19}
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

        {/* Face ID / Biometric Lock */}
        {Platform.OS !== "web" && biometricAvailable && (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.switchRow}>
              <View style={styles.switchLabel}>
                <IconSymbol name="lock.fill" size={20} color={colors.primary} />
                <Text style={{ fontSize: 15, fontWeight: "500", color: colors.foreground, marginLeft: 12 }}>
                  {biometricType === "face" ? "Face ID" : "Fingerprint"} Lock
                </Text>
              </View>
              <Switch
                value={biometricEnabled}
                onValueChange={async (val) => {
                  await toggleBiometric(val);
                }}
                trackColor={{ false: colors.border, true: colors.primary + "60" }}
                thumbColor={biometricEnabled ? colors.primary : colors.muted}
              />
            </View>
            <Text style={{ fontSize: 12, color: colors.muted, marginTop: 4, marginLeft: 32 }}>
              {biometricEnabled
                ? "App will require authentication on launch"
                : "Enable to secure your app on launch"}
            </Text>
          </View>
        )}

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

        {/* Navigation Cards to Sub-Screens */}
        <Text style={{ fontSize: 12, fontWeight: "500", color: colors.muted, marginBottom: 10, marginTop: 4 }}>Manage</Text>
        <View style={isTablet ? { flexDirection: "row", flexWrap: "wrap", gap: 10 } : undefined}>
          {navItems.map((item) => (
            <Pressable
              key={item.title}
              onPress={() => router.push(item.route as any)}
              style={({ pressed }) => [
                styles.navCard,
                { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.8 : 1 },
                isTablet && { width: "48.5%" as any },
              ]}
            >
              <View style={[styles.navIcon, { backgroundColor: item.color + "15" }]}>
                <IconSymbol name={item.icon} size={22} color={item.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: "600", color: colors.foreground }}>{item.title}</Text>
                <Text style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>{item.subtitle}</Text>
              </View>
              <IconSymbol name="chevron.right" size={16} color={colors.muted} />
            </Pressable>
          ))}
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
  editRow: { flexDirection: "row", alignItems: "center", gap: 8, width: "100%" },
  editInput: { flex: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, lineHeight: 20, borderWidth: 1 },
  smallButton: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, alignItems: "center", justifyContent: "center", minHeight: 36 },
  smallButtonText: { color: "#FFFFFF", fontSize: 12, fontWeight: "600", lineHeight: 18 },
  fieldLabel: { fontSize: 12, fontWeight: "500", marginBottom: 4, marginTop: 6, color: "#687076" },
  profileInput: { width: "100%", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, lineHeight: 20, borderWidth: 1, marginBottom: 6 },
  profileActions: { flexDirection: "row", gap: 8, marginTop: 10, width: "100%" },
  cancelButton: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1, alignItems: "center", justifyContent: "center", minHeight: 44 },
  saveButton: { flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: "center", justifyContent: "center", minHeight: 44 },
  saveButtonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "600", lineHeight: 20 },
  profileRow: { flexDirection: "row", alignItems: "center", paddingVertical: 6 },
  themeRow: { flexDirection: "row", gap: 10, width: "100%" },
  themeOption: { alignItems: "center", justifyContent: "center", paddingVertical: 14, borderRadius: 14, borderWidth: 1.5 },
  switchRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  switchLabel: { flexDirection: "row", alignItems: "center", flex: 1 },
  statsRow: { flexDirection: "row", justifyContent: "space-between", width: "100%" },
  statItem: { flex: 1, alignItems: "center" },
  statNumber: { fontSize: 24, fontWeight: "700", lineHeight: 30 },
  navCard: { flexDirection: "row", alignItems: "center", borderRadius: 16, padding: 16, marginBottom: 10, borderWidth: 1, gap: 14 },
  navIcon: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  dangerButton: { flexDirection: "row", alignItems: "center", borderRadius: 16, padding: 16, marginBottom: 14, borderWidth: 1, width: "100%" },
  appInfo: { alignItems: "center", paddingVertical: 24 },
  appName: { fontSize: 16, fontWeight: "700" },
});
