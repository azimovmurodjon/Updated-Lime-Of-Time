import React, { useState, useCallback, useMemo } from "react";
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
  Linking,
  Platform,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { FuturisticBackground } from "@/components/futuristic-background";
import { useStore } from "@/lib/store";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useRouter } from "expo-router";
import { useThemeContext } from "@/lib/theme-provider";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { removeSessionToken, clearUserInfo } from "@/lib/_core/auth";
import { formatPhoneNumber, getMapUrl, DEFAULT_NOTIFICATION_PREFERENCES } from "@/lib/types";
import { trpc } from "@/lib/trpc";
import { useAppLockContext } from "@/lib/app-lock-provider";
import { LocationSwitcher } from "@/components/location-switcher";
import { useActiveLocation } from "@/hooks/use-active-location";
import { useResponsive } from "@/hooks/use-responsive";

type TabKey = "business" | "notifications" | "tools" | "account";

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: "business",      label: "Business",      icon: "building.2.fill" },
  { key: "notifications", label: "Alerts",         icon: "bell.fill" },
  { key: "tools",         label: "Tools",          icon: "wrench.fill" },
  { key: "account",       label: "Account",        icon: "person.fill" },
];

export default function SettingsScreen() {
  const { state, dispatch, syncToDb, filterAppointmentsByLocation, clientsForActiveLocation } = useStore();
  const deleteBusinessMut = trpc.business.delete.useMutation();
  const colors = useColors();
  const router = useRouter();
  const { isTablet, hp, maxContentWidth } = useResponsive();
  const { setThemeMode: setThemeOverrideMode } = useThemeContext();
  const { biometricAvailable, biometricEnabled, biometricType, toggleBiometric } = useAppLockContext();
  const settings = state.settings;
  const { hasMultipleLocations, activeLocation } = useActiveLocation();

  const [activeTab, setActiveTab] = useState<TabKey>("business");

  // Business Name editing
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(settings.businessName);

  // Monthly Revenue Goal
  const [goalInput, setGoalInput] = useState(settings.monthlyRevenueGoal > 0 ? String(settings.monthlyRevenueGoal) : "");
  const [editingGoal, setEditingGoal] = useState(false);

  // Staff Alert Threshold
  const [alertThresholdInput, setAlertThresholdInput] = useState(String(settings.staffAlertThreshold ?? 80));
  const [editingThreshold, setEditingThreshold] = useState(false);

  const saveName = useCallback(() => {
    if (nameValue.trim()) {
      const action = { type: "UPDATE_SETTINGS" as const, payload: { businessName: nameValue.trim() } };
      dispatch(action);
      syncToDb(action);
    }
    setEditingName(false);
  }, [nameValue, dispatch, syncToDb]);

  const saveGoal = useCallback(() => {
    const val = parseInt(goalInput.replace(/[^0-9]/g, ""), 10);
    const goal = isNaN(val) ? 0 : val;
    const action = { type: "UPDATE_SETTINGS" as const, payload: { monthlyRevenueGoal: goal } };
    dispatch(action);
    syncToDb(action);
    setEditingGoal(false);
  }, [goalInput, dispatch, syncToDb]);

  const saveThreshold = useCallback(() => {
    const val = parseInt(alertThresholdInput.replace(/[^0-9]/g, ""), 10);
    const threshold = isNaN(val) ? 80 : Math.min(100, Math.max(0, val));
    const action = { type: "UPDATE_SETTINGS" as const, payload: { staffAlertThreshold: threshold } };
    dispatch(action);
    syncToDb(action);
    setEditingThreshold(false);
  }, [alertThresholdInput, dispatch, syncToDb]);

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
    { key: "dark",  label: "Dark",  icon: "moon.fill" },
    { key: "system",label: "Auto",  icon: "gear" },
  ];

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
              "@bookease_services","@bookease_clients","@bookease_appointments",
              "@bookease_reviews","@bookease_settings","@bookease_business_owner_id",
              "@bookease_discounts","@bookease_gift_cards","@bookease_custom_schedule",
              "@bookease_location_custom_schedule","@bookease_products","@bookease_staff",
              "@bookease_locations","@bookease_active_location_id",
              "@bookease_client_photos","@bookease_packages","@bookease_service_photos",
              "@bookease_biometric_enabled",
              "@lime_tutorial_seen",
              "@lime_tour_analytics",
              "@lime_first_action_shown",
            ]);
          } catch {}
          try { await removeSessionToken(); } catch {}
          try { await clearUserInfo(); } catch {}
          router.replace("/onboarding");
        },
      },
    ]);
  }, [dispatch, router]);

  const handleDeleteBusiness = useCallback(() => {
    Alert.alert(
      "Delete Business",
      "This will permanently delete all your business data from our servers and remove all app data from this device. This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete Everything",
          style: "destructive",
          onPress: async () => {
            // 1. Delete all records from DB (cascade: appointments, clients, services,
            //    reviews, discounts, giftCards, customSchedule, products, staffMembers,
            //    locations, waitlist, promoCodes, then businessOwner itself)
            if (state.businessOwnerId) {
              try { await deleteBusinessMut.mutateAsync({ id: state.businessOwnerId }); } catch {}
            }
            // 2. Reset in-memory store
            dispatch({ type: "RESET_ALL_DATA" });
            // 3. Wipe ALL AsyncStorage keys used by this app
            try {
              await AsyncStorage.multiRemove([
                // Business data
                "@bookease_services","@bookease_clients","@bookease_appointments",
                "@bookease_reviews","@bookease_settings","@bookease_business_owner_id",
                "@bookease_discounts","@bookease_gift_cards","@bookease_custom_schedule",
                "@bookease_location_custom_schedule","@bookease_products","@bookease_staff",
                "@bookease_locations","@bookease_active_location_id",
                "@bookease_client_photos","@bookease_packages","@bookease_service_photos",
                // App preferences
                "@bookease_biometric_enabled",
                // Tour / onboarding state
                "@lime_tutorial_seen",
                "@lime_tour_analytics",
                "@lime_first_action_shown",
              ]);
            } catch {}
            // 4. Wipe SecureStore (session token + user info)
            try { await removeSessionToken(); } catch {}
            try { await clearUserInfo(); } catch {}
            router.replace("/onboarding");
          },
        },
      ]
    );
  }, [dispatch, router, state.businessOwnerId, deleteBusinessMut]);

  const reviewAvg = useMemo(() => {
    if (state.reviews.length === 0) return null;
    return (state.reviews.reduce((s, r) => s + r.rating, 0) / state.reviews.length).toFixed(1);
  }, [state.reviews]);

  // ── Nav item lists ──────────────────────────────────────────────────────────
  const locationNavItems = [
    { title: "Schedule & Hours",  subtitle: hasMultipleLocations && activeLocation ? `${activeLocation.name} hours` : "Working hours, buffer time, custom days", icon: "calendar.badge.clock" as const, route: "/schedule-settings" as const, color: "#10B981" },
    { title: "Booking Policies",  subtitle: "Cancellation fees, booking URL, temp closure", icon: "exclamationmark.triangle.fill" as const, route: "/booking-policies" as const, color: "#FF9800" },
    { title: "Locations",         subtitle: `${state.locations.length} location${state.locations.length !== 1 ? "s" : ""} configured`, icon: "building.2.fill" as const, route: "/locations" as const, color: "#3B82F6" },
    { title: "Payment Methods",   subtitle: (() => { const m=[]; if(settings.zelleHandle)m.push("Zelle"); if(settings.cashAppHandle)m.push("Cash App"); if(settings.venmoHandle)m.push("Venmo"); return m.length>0?m.join(" \u00b7 "):"Not configured"; })(), icon: "creditcard.fill" as const, route: "/payment-methods" as const, color: "#10B981" },
    { title: "Social Links",        subtitle: (() => { const s=[]; if(settings.instagramHandle)s.push("Instagram"); if(settings.facebookHandle)s.push("Facebook"); if(settings.tiktokHandle)s.push("TikTok"); return s.length>0?s.join(" \u00b7 "):"Instagram, Facebook, TikTok"; })(), icon: "link" as const, route: "/social-links" as const, color: "#E1306C" },
  ];

  const toolsNavItems = [
    { title: "Subscription",      subtitle: "Plan, usage & billing", icon: "crown.fill" as const, route: "/subscription" as const, color: "#F59E0B" },
    { title: "Analytics",         subtitle: "Revenue, clients, appointments insights", icon: "chart.bar.fill" as const, route: "/analytics-detail?tab=overview" as const, color: "#8b5cf6" },
    { title: "Note Templates",    subtitle: `${(state.noteTemplates ?? []).length} template${(state.noteTemplates ?? []).length !== 1 ? "s" : ""} saved`, icon: "note.text" as const, route: "/note-templates" as const, color: "#6366F1" },
    { title: "Promo Codes",        subtitle: `${(state.promoCodes ?? []).filter((p) => p.active).length} active code${(state.promoCodes ?? []).filter((p) => p.active).length !== 1 ? "s" : ""}`, icon: "ticket.fill" as const, route: "/promo-codes" as const, color: "#0EA5E9" },
    { title: "Category Management",subtitle: "Manage service and product categories", icon: "tag.fill" as const, route: "/category-management" as const, color: "#10B981" },
    { title: "Export Data",       subtitle: "PDF reports for clients, appointments, revenue", icon: "square.and.arrow.up.fill" as const, route: "/data-export" as const, color: colors.primary },
    { title: "Usage Guide",        subtitle: "How to use every feature in the app", icon: "book.fill" as const, route: "/usage-guide" as const, color: "#0EA5E9" },
  ];

  // ── Tab content renderers ───────────────────────────────────────────────────
  const renderNavList = (items: Array<{ title: string; subtitle: string; icon: any; route: any; color: string }>) => (
    <View style={isTablet ? { flexDirection: "row", flexWrap: "wrap", gap: 10 } : undefined}>
      {items.map((item) => (
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
  );

  const renderBusinessTab = () => (
    <>
      {/* Closed Banner */}
      {settings.temporaryClosed && (
        <View style={[styles.closedBanner, { backgroundColor: colors.error + "15", borderColor: colors.error + "40" }]}>
          <IconSymbol name="xmark.circle.fill" size={18} color={colors.error} />
          <Text style={{ fontSize: 13, fontWeight: "600", color: colors.error, marginLeft: 8, flex: 1 }}>Business is temporarily closed</Text>
        </View>
      )}

      {/* Location Switcher */}
      {hasMultipleLocations && (
        <View style={[{ backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 12, flexDirection: "row", alignItems: "center", gap: 10 }]}>
          <IconSymbol name="mappin.and.ellipse" size={18} color={colors.primary} />
          <Text style={{ fontSize: 13, color: colors.muted, flex: 1 }}>Active Location</Text>
          <LocationSwitcher />
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

      {/* Quick Stats */}
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.cardLabel, { color: colors.muted }]}>Quick Stats{hasMultipleLocations && activeLocation ? ` — ${activeLocation.name}` : ""}</Text>
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: colors.primary }]}>{state.services.length}</Text>
            <Text style={{ fontSize: 12, color: colors.muted }}>Services</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: colors.primary }]}>{clientsForActiveLocation.length}</Text>
            <Text style={{ fontSize: 12, color: colors.muted }}>Clients</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: colors.primary }]}>{filterAppointmentsByLocation(state.appointments).length}</Text>
            <Text style={{ fontSize: 12, color: colors.muted }}>Bookings</Text>
          </View>
        </View>
      </View>

      {/* Section: Location */}
      <Text style={styles.sectionLabel}>Location Settings</Text>
      {renderNavList(locationNavItems)}

      {/* Engagement */}
      <Text style={[styles.sectionLabel, { marginTop: 8 }]}>Engagement</Text>
      {renderNavList([
        { title: "Client Reviews",    subtitle: reviewAvg ? `${reviewAvg} ★ — ${state.reviews.length} review${state.reviews.length !== 1 ? "s" : ""}` : "No reviews yet", icon: "star.fill" as const, route: "/reviews" as const, color: "#f59e0b" },
        { title: "Packages & Bundles",subtitle: `${(state.packages ?? []).filter((p) => p.active).length} active package${(state.packages ?? []).filter((p) => p.active).length !== 1 ? "s" : ""}`, icon: "gift.fill" as const, route: "/packages" as const, color: "#E91E63" },
      ])}

      {/* Goals & Alerts */}
      <Text style={[styles.sectionLabel, { marginTop: 8 }]}>Goals & Alerts</Text>

      {/* Monthly Revenue Goal */}
      <View style={[styles.navCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={[styles.navIcon, { backgroundColor: "#FF980015" }]}>
          <IconSymbol name="chart.bar.fill" size={22} color="#FF9800" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 15, fontWeight: "600", color: colors.foreground }}>Monthly Revenue Goal</Text>
          {editingGoal ? (
            <View style={{ marginTop: 6 }}>
              <TextInput
                value={goalInput}
                onChangeText={setGoalInput}
                keyboardType="numeric"
                placeholder="e.g. 10000"
                placeholderTextColor={colors.muted}
                returnKeyType="done"
                onSubmitEditing={saveGoal}
                style={{ fontSize: 15, color: colors.foreground, borderBottomWidth: 1, borderBottomColor: colors.primary, paddingVertical: 4 }}
                autoFocus
              />
              <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                <Pressable onPress={saveGoal} style={{ flex: 1, backgroundColor: colors.primary, borderRadius: 8, paddingVertical: 8, alignItems: "center" }}>
                  <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>Save</Text>
                </Pressable>
                <Pressable onPress={() => setEditingGoal(false)} style={{ flex: 1, borderRadius: 8, paddingVertical: 8, alignItems: "center", borderWidth: 1, borderColor: colors.border }}>
                  <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "600" }}>Cancel</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <Text style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>
              {settings.monthlyRevenueGoal > 0 ? `$${settings.monthlyRevenueGoal.toLocaleString()} / month` : "Tap to set a monthly goal"}
            </Text>
          )}
        </View>
        {!editingGoal && (
          <Pressable onPress={() => setEditingGoal(true)}>
            <IconSymbol name="pencil" size={18} color={colors.muted} />
          </Pressable>
        )}
      </View>

      {/* Staff Alert Threshold */}
      <View style={[styles.navCard, { backgroundColor: colors.surface, borderColor: colors.border, marginTop: 8 }]}>
        <View style={[styles.navIcon, { backgroundColor: "#EF444415" }]}>
          <IconSymbol name="person.2.fill" size={22} color="#EF4444" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 15, fontWeight: "600", color: colors.foreground }}>Staff Alert Threshold</Text>
          {editingThreshold ? (
            <View style={{ marginTop: 6 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <TextInput
                  value={alertThresholdInput}
                  onChangeText={setAlertThresholdInput}
                  keyboardType="numeric"
                  placeholder="e.g. 80"
                  placeholderTextColor={colors.muted}
                  returnKeyType="done"
                  onSubmitEditing={saveThreshold}
                  style={{ flex: 1, fontSize: 15, color: colors.foreground, borderBottomWidth: 1, borderBottomColor: colors.primary, paddingVertical: 4 }}
                  autoFocus
                />
                <Text style={{ fontSize: 13, color: colors.muted }}>%</Text>
              </View>
              <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                <Pressable onPress={saveThreshold} style={{ flex: 1, backgroundColor: colors.primary, borderRadius: 8, paddingVertical: 8, alignItems: "center" }}>
                  <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>Save</Text>
                </Pressable>
                <Pressable onPress={() => setEditingThreshold(false)} style={{ flex: 1, borderRadius: 8, paddingVertical: 8, alignItems: "center", borderWidth: 1, borderColor: colors.border }}>
                  <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "600" }}>Cancel</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <Text style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>
              Alert when staff completion rate is below {settings.staffAlertThreshold ?? 80}%
            </Text>
          )}
        </View>
        {!editingThreshold && (
          <Pressable onPress={() => setEditingThreshold(true)}>
            <IconSymbol name="pencil" size={18} color={colors.muted} />
          </Pressable>
        )}
      </View>
    </>
  );

  const renderNotificationsTab = () => (
    <>
      <Pressable
        onPress={() => router.push("/notification-settings")}
        style={({ pressed }) => [styles.navCard, { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.75 : 1 }]}
      >
        <View style={[styles.navIcon, { backgroundColor: colors.primary + "15" }]}>
          <IconSymbol name="bell.fill" size={22} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 15, fontWeight: "600", color: colors.foreground }}>Notification Preferences</Text>
          <Text style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>
            {settings.notificationsEnabled ? "Active — push, email & reminder settings" : "Paused — tap to manage"}
          </Text>
        </View>
        <IconSymbol name="chevron.right" size={16} color={colors.muted} />
      </Pressable>

      <Pressable
        onPress={() => router.push("/sms-templates")}
        style={({ pressed }) => [styles.navCard, { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.75 : 1 }]}
      >
        <View style={[styles.navIcon, { backgroundColor: "#00897B15" }]}>
          <IconSymbol name="message.fill" size={22} color="#00897B" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 15, fontWeight: "600", color: colors.foreground }}>SMS Messages</Text>
          <Text style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>Customize messages sent to clients</Text>
        </View>
        <IconSymbol name="chevron.right" size={16} color={colors.muted} />
      </Pressable>
      {/* SMS Automation */}
      <Pressable
        onPress={() => router.push("/sms-automation")}
        style={({ pressed }) => [styles.navCard, { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.75 : 1 }]}
      >
        <View style={[styles.navIcon, { backgroundColor: "#00897B15" }]}>
          <IconSymbol name="message.fill" size={22} color="#00897B" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 15, fontWeight: "600", color: colors.foreground }}>SMS Automation</Text>
          <Text style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>{state.settings.twilioEnabled ? "Enabled" : "Disabled"}</Text>
        </View>
        <IconSymbol name="chevron.right" size={16} color={colors.muted} />
      </Pressable>
      {/* Face ID / Biometric Lock */}
      {Platform.OS !== "web" && biometricAvailable && (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, marginTop: 4 }]}>
          <View style={styles.switchRow}>
            <View style={styles.switchLabel}>
              <IconSymbol name="lock.fill" size={20} color={colors.primary} />
              <Text style={{ fontSize: 15, fontWeight: "500", color: colors.foreground, marginLeft: 12 }}>
                {biometricType === "face" ? "Face ID" : "Fingerprint"} Lock
              </Text>
            </View>
            <Switch
              value={biometricEnabled}
              onValueChange={async (val) => { await toggleBiometric(val); }}
              trackColor={{ false: colors.border, true: colors.primary + "60" }}
              thumbColor={biometricEnabled ? colors.primary : colors.muted}
            />
          </View>
          <Text style={{ fontSize: 12, color: colors.muted, marginTop: 4, marginLeft: 32 }}>
            {biometricEnabled ? "App will require authentication on launch" : "Enable to secure your app on launch"}
          </Text>
        </View>
      )}

    </>
  );

  const renderToolsTab = () => (
    <>
      {renderNavList(toolsNavItems)}
    </>
  );

  const renderAccountTab = () => (
    <>
      {/* App Info */}
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, alignItems: "center", paddingVertical: 24 }]}>
        <Image source={require("@/assets/images/icon.png")} style={{ width: 64, height: 64, borderRadius: 16, marginBottom: 10 }} resizeMode="contain" />
        <Text style={{ fontSize: 18, fontWeight: "700", color: colors.primary }}>Lime Of Time</Text>
        <Text style={{ fontSize: 13, color: colors.muted, marginTop: 4 }}>Version 1.0.0</Text>
        <Text style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>Smart Scheduling for Small Business</Text>
      </View>

      {/* Business Profile */}
      <Pressable
        onPress={() => router.push("/business-profile")}
        style={({ pressed }) => [styles.navCard, { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.75 : 1 }]}
      >
        <View style={[styles.navIcon, { backgroundColor: colors.primary + "15" }]}>
          <IconSymbol name="person.fill" size={22} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 15, fontWeight: "600", color: colors.foreground }}>Business Profile</Text>
          <Text style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>{settings.profile.ownerName ? `${settings.profile.ownerName} \u00b7 ${settings.businessName}` : "Name, owner, phone, email, website"}</Text>
        </View>
        <IconSymbol name="chevron.right" size={16} color={colors.muted} />
      </Pressable>
      {/* Appearance */}
      <Text style={[styles.sectionLabel, { marginTop: 8 }]}>Appearance</Text>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.cardLabel, { color: colors.muted }]}>Theme Mode</Text>
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

      {/* Replay App Tour */}
      <Text style={[styles.sectionLabel, { marginTop: 8 }]}>Help</Text>
      <Pressable
        onPress={async () => {
          try { await AsyncStorage.removeItem("@lime_tutorial_seen"); } catch {}
          // Navigate to Home tab — use push so focus event always fires even if already on Home
          router.push("/(tabs)/" as any);
        }}
        style={({ pressed }) => [styles.navCard, { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.75 : 1 }]}
      >
        <View style={[styles.navIcon, { backgroundColor: "#6366F115" }]}>
          <IconSymbol name="play.fill" size={22} color="#6366F1" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 15, fontWeight: "600", color: colors.foreground }}>Replay App Tour</Text>
          <Text style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>Re-watch the onboarding walkthrough</Text>
        </View>
        <IconSymbol name="chevron.right" size={16} color={colors.muted} />
      </Pressable>

      {/* Log Out */}
      <Text style={[styles.sectionLabel, { marginTop: 8 }]}>Account Actions</Text>
      <Pressable
        onPress={handleLogout}
        style={({ pressed }) => [styles.dangerButton, { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.7 : 1 }]}
      >
        <View style={[styles.navIcon, { backgroundColor: colors.primary + "15" }]}>
          <IconSymbol name="arrow.right.square.fill" size={22} color={colors.primary} />
        </View>
        <Text style={{ fontSize: 15, fontWeight: "600", color: colors.primary, flex: 1 }}>Log Out</Text>
        <IconSymbol name="chevron.right" size={16} color={colors.muted} />
      </Pressable>

      {/* Delete Business */}
      <Pressable
        onPress={handleDeleteBusiness}
        style={({ pressed }) => [styles.dangerButton, { backgroundColor: colors.error + "08", borderColor: colors.error + "30", opacity: pressed ? 0.7 : 1 }]}
      >
        <View style={[styles.navIcon, { backgroundColor: colors.error + "15" }]}>
          <IconSymbol name="trash.fill" size={22} color={colors.error} />
        </View>
        <Text style={{ fontSize: 15, fontWeight: "600", color: colors.error, flex: 1 }}>Delete Business</Text>
        <IconSymbol name="chevron.right" size={16} color={colors.error + "60"} />
      </Pressable>
    </>
  );

  const tabContent: Record<TabKey, () => React.ReactElement> = {
    business:      renderBusinessTab,
    notifications: renderNotificationsTab,
    tools:         renderToolsTab,
    account:       renderAccountTab,
  };

  return (
    <ScreenContainer tabletMaxWidth={0}>
      <FuturisticBackground />
      {/* ── Header ── */}
      <View style={[styles.headerRow, { paddingHorizontal: hp, paddingTop: 8 }]}>
        <Text style={{ fontSize: 24, fontWeight: "700", color: colors.foreground }}>Settings</Text>
        <Image source={require("@/assets/images/icon.png")} style={styles.headerLogo} resizeMode="contain" />
      </View>

      {/* ── Tab Bar ── */}
      <View style={[styles.tabBar, { borderBottomColor: colors.border, paddingHorizontal: hp }]}>
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <Pressable
              key={tab.key}
              onPress={() => setActiveTab(tab.key)}
              style={({ pressed }) => [
                styles.tabItem,
                { borderBottomColor: isActive ? colors.primary : "transparent", opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <IconSymbol name={tab.icon as any} size={16} color={isActive ? colors.primary : colors.muted} />
              <Text style={{ fontSize: 12, fontWeight: isActive ? "700" : "500", color: isActive ? colors.primary : colors.muted, marginTop: 3 }}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* ── Tab Content ── */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: hp, paddingTop: 16, paddingBottom: 100, alignSelf: "center", width: "100%", maxWidth: maxContentWidth }}
      >
        {tabContent[activeTab]()}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  headerRow:     { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 0, paddingBottom: 8 },
  headerLogo:    { width: 32, height: 32, borderRadius: 8 },
  tabBar:        { flexDirection: "row", borderBottomWidth: 1, marginBottom: 0 },
  tabItem:       { flex: 1, alignItems: "center", paddingVertical: 10, borderBottomWidth: 2.5 },
  closedBanner:  { flexDirection: "row", alignItems: "center", padding: 12, borderRadius: 12, borderWidth: 1, marginBottom: 14 },
  card:          { borderRadius: 16, padding: 16, marginBottom: 14, borderWidth: 1 },
  cardLabel:     { fontSize: 12, fontWeight: "500", marginBottom: 10 },
  cardHeader:    { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  cardHeaderLeft:{ flexDirection: "row", alignItems: "center" },
  cardTitle:     { fontSize: 15, fontWeight: "600", marginLeft: 10 },
  editRow:       { flexDirection: "row", alignItems: "center", gap: 8, width: "100%" },
  editInput:     { flex: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, lineHeight: 20, borderWidth: 1 },
  smallButton:   { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, alignItems: "center", justifyContent: "center", minHeight: 36 },
  smallButtonText:{ color: "#FFFFFF", fontSize: 12, fontWeight: "600", lineHeight: 18 },
  themeRow:      { flexDirection: "row", gap: 10, width: "100%" },
  themeOption:   { alignItems: "center", justifyContent: "center", paddingVertical: 14, borderRadius: 14, borderWidth: 1.5 },
  switchRow:     { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  switchLabel:   { flexDirection: "row", alignItems: "center", flex: 1 },
  statsRow:      { flexDirection: "row", justifyContent: "space-between", width: "100%" },
  statItem:      { flex: 1, alignItems: "center" },
  statNumber:    { fontSize: 24, fontWeight: "700", lineHeight: 30 },
  navCard:       { flexDirection: "row", alignItems: "center", borderRadius: 16, padding: 16, marginBottom: 10, borderWidth: 1, gap: 14 },
  navIcon:       { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  dangerButton:  { flexDirection: "row", alignItems: "center", borderRadius: 16, padding: 16, marginBottom: 14, borderWidth: 1, width: "100%", gap: 14 },
  sectionLabel:  { fontSize: 12, fontWeight: "600", color: "#687076", marginBottom: 8, marginTop: 4, textTransform: "uppercase", letterSpacing: 0.5 },
  appInfo:       { alignItems: "center", paddingVertical: 24 },
  appName:       { fontSize: 16, fontWeight: "700" },
});
