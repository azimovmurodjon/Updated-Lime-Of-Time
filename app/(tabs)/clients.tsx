import { FlatList, Text, View, Pressable, StyleSheet, TextInput, Alert, Platform } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useStore, generateId } from "@/lib/store";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useState, useMemo, useCallback } from "react";
import { Client, formatPhoneNumber, stripPhoneFormat, LOCATION_COLORS } from "@/lib/types";
import { useActiveLocation } from "@/hooks/use-active-location";
import { useResponsive } from "@/hooks/use-responsive";
import { LocationSwitcher } from "@/components/location-switcher";
import * as Contacts from "expo-contacts";
import { usePlanLimitCheck } from "@/hooks/use-plan-limit-check";
import { UpgradePlanSheet } from "@/components/upgrade-plan-sheet";

export default function ClientsScreen() {
  const { state, dispatch, getReviewsForClient, getAppointmentsForClient, syncToDb, clientsForActiveLocation, filterAppointmentsByLocation } = useStore();
  const { hasMultipleLocations } = useActiveLocation();
  const colors = useColors();
  const router = useRouter();
  const { isTablet, isLargeTablet, hp, maxContentWidth } = useResponsive();
  const { checkLimit } = usePlanLimitCheck();
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newBirthday, setNewBirthday] = useState("");
  const [upgradeSheetVisible, setUpgradeSheetVisible] = useState(false);
  const [upgradeSheetInfo, setUpgradeSheetInfo] = useState<{ planKey: string; planName: string; limit: number } | null>(null);

  // Use location-scoped client list from store
  const filteredClients = useMemo(() => {
    const q = search.toLowerCase();
    return clientsForActiveLocation
      .filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.phone.includes(q) ||
          c.email.toLowerCase().includes(q)
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [clientsForActiveLocation, search]);

  // Appointment count scoped to active location
  const getLocationApptCount = useCallback(
    (clientId: string) => filterAppointmentsByLocation(getAppointmentsForClient(clientId)).length,
    [filterAppointmentsByLocation, getAppointmentsForClient]
  );

  // Get unique locations a client has visited (from all their appointments)
  const getClientLocationBadges = useCallback(
    (clientId: string) => {
      const appts = getAppointmentsForClient(clientId);
      const locationIds = [...new Set(appts.map((a) => a.locationId).filter(Boolean) as string[])];
      return locationIds
        .map((lid) => state.locations.find((l) => l.id === lid))
        .filter(Boolean) as import("@/lib/types").Location[];
    },
    [getAppointmentsForClient, state.locations]
  );

  const handlePhoneChange = useCallback((text: string) => {
    setNewPhone(formatPhoneNumber(text));
  }, []);

  const handleAddClient = useCallback(() => {
    if (!newName.trim()) return;
    // Check plan limit before adding
    const limitInfo = checkLimit("clients");
    if (!limitInfo.allowed) {
      setUpgradeSheetInfo({ planKey: limitInfo.planKey, planName: limitInfo.planName, limit: limitInfo.currentLimit });
      setUpgradeSheetVisible(true);
      return;
    }
    const client: Client = {
      id: generateId(),
      name: newName.trim(),
      phone: newPhone.trim(),
      email: newEmail.trim(),
      notes: "",
      birthday: newBirthday.trim(),
      createdAt: new Date().toISOString(),
    };
    dispatch({ type: "ADD_CLIENT", payload: client });
    syncToDb({ type: "ADD_CLIENT", payload: client });
    setNewName("");
    setNewPhone("");
    setNewEmail("");
    setNewBirthday("");
    setShowAdd(false);
  }, [newName, newPhone, newEmail, newBirthday, dispatch, syncToDb]);

  const handleSelectFromContacts = useCallback(async () => {
    // Check plan limit before importing
    const limitInfo = checkLimit("clients");
    if (!limitInfo.allowed) {
      setUpgradeSheetInfo({ planKey: limitInfo.planKey, planName: limitInfo.planName, limit: limitInfo.currentLimit });
      setUpgradeSheetVisible(true);
      return;
    }
    if (Platform.OS === "web") {
      Alert.alert("Not Available", "Contact import is only available on mobile devices.");
      return;
    }
    try {
      // On Android, request permission first
      if (Platform.OS === "android") {
        const { status } = await Contacts.requestPermissionsAsync();
        if (status !== "granted") {
          Alert.alert("Permission Denied", "Please allow access to contacts in your device settings.");
          return;
        }
      }

      // Use the native system contact picker — opens the device's contact list
      const contact = await Contacts.presentContactPickerAsync();

      if (!contact) {
        // User cancelled the picker
        return;
      }

      const name = contact.name || `${contact.firstName ?? ""} ${contact.lastName ?? ""}`.trim();
      if (!name) {
        Alert.alert("Invalid Contact", "The selected contact has no name.");
        return;
      }

      // Check if already exists
      const exists = state.clients.some(
        (c) => c.name.toLowerCase() === name.toLowerCase()
      );
      if (exists) {
        Alert.alert("Already Added", `${name} is already in your client list.`);
        return;
      }

      const phone = contact.phoneNumbers?.[0]?.number ?? "";
      const email = contact.emails?.[0]?.email ?? "";

      // Format phone number
      const formattedPhone = phone ? formatPhoneNumber(stripPhoneFormat(phone)) : "";

      const client: Client = {
        id: generateId(),
        name,
        phone: formattedPhone,
        email,
        notes: "Imported from contacts",
        birthday: "",
        createdAt: new Date().toISOString(),
      };
      dispatch({ type: "ADD_CLIENT", payload: client });
      syncToDb({ type: "ADD_CLIENT", payload: client });
      Alert.alert("Added", `${name} has been added as a client.`);
    } catch (error) {
      Alert.alert("Error", "Failed to access contacts. Please try again.");
    }
  }, [state.clients, dispatch, syncToDb]);

  const getInitials = (name: string) => {
    const parts = name.split(" ");
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  const getClientRating = (clientId: string): number | null => {
    const reviews = getReviewsForClient(clientId);
    if (reviews.length === 0) return null;
    const avg = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
    return Math.round(avg * 10) / 10;
  };

  return (
    <ScreenContainer tabletMaxWidth={0}>
      <View style={{ flex: 1, alignSelf: "center", width: "100%", maxWidth: maxContentWidth }}>
      <View style={{ paddingHorizontal: hp }}>
        <View style={styles.header}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text style={{ fontSize: 24, fontWeight: "700", color: colors.foreground }}>Clients</Text>
            {hasMultipleLocations && <LocationSwitcher compact />}
          </View>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Pressable
              onPress={() => router.push("/birthday-campaigns")}
              style={({ pressed }) => [
                styles.iconButton,
                { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <IconSymbol name="birthday.cake" size={20} color="#FF9800" />
            </Pressable>
            <Pressable
              onPress={handleSelectFromContacts}
              style={({ pressed }) => [
                styles.iconButton,
                { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <IconSymbol name="person.crop.circle.badge.plus" size={20} color={colors.primary} />
            </Pressable>
            <Pressable
              onPress={() => setShowAdd(!showAdd)}
              style={({ pressed }) => [
                styles.addButton,
                { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <IconSymbol name="plus" size={20} color="#FFFFFF" />
            </Pressable>
          </View>
        </View>

        {/* Search */}
        <View style={[styles.searchBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <IconSymbol name="magnifyingglass" size={18} color={colors.muted} />
          <TextInput
            style={[styles.searchInput, { color: colors.foreground }]}
            placeholder="Search clients..."
            placeholderTextColor={colors.muted}
            value={search}
            onChangeText={setSearch}
            returnKeyType="done"
          />
        </View>

        {/* Add Client Form */}
        {showAdd && (
          <View style={[styles.addForm, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={{ fontSize: 14, fontWeight: "600", color: colors.foreground, marginBottom: 12 }}>New Client</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
              placeholder="Full Name *"
              placeholderTextColor={colors.muted}
              value={newName}
              onChangeText={setNewName}
              returnKeyType="next"
            />
            <TextInput
              style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
              placeholder="(000) 000-0000"
              placeholderTextColor={colors.muted}
              value={newPhone}
              onChangeText={handlePhoneChange}
              keyboardType="phone-pad"
              returnKeyType="next"
              maxLength={19}
            />
            <TextInput
              style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
              placeholder="Email"
              placeholderTextColor={colors.muted}
              value={newEmail}
              onChangeText={setNewEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              returnKeyType="next"
            />
            <TextInput
              style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground, marginBottom: 14 }]}
              placeholder="Birthday (MM/DD or MM/DD/YYYY) — optional"
              placeholderTextColor={colors.muted}
              value={newBirthday}
              onChangeText={(t) => setNewBirthday(t.replace(/[^0-9/]/g, ""))}
              keyboardType="numbers-and-punctuation"
              returnKeyType="done"
              onSubmitEditing={handleAddClient}
            />
            <View style={styles.formActions}>
              <Pressable
                onPress={() => setShowAdd(false)}
                style={({ pressed }) => [
                  styles.formButton,
                  { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, opacity: pressed ? 0.7 : 1 },
                ]}
              >
                <Text style={{ fontSize: 14, fontWeight: "500", color: colors.foreground }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleAddClient}
                style={({ pressed }) => [
                  styles.formButton,
                  { backgroundColor: colors.primary, flex: 1, opacity: pressed ? 0.8 : 1 },
                ]}
              >
                <Text style={{ fontSize: 14, fontWeight: "600", color: "#FFF" }}>Save Client</Text>
              </Pressable>
            </View>
          </View>
        )}
      </View>

      <FlatList
        data={filteredClients}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: hp, paddingBottom: 80 }}
        renderItem={({ item }) => {
          const rating = getClientRating(item.id);
          const apptCount = getLocationApptCount(item.id);
          const locationBadges = getClientLocationBadges(item.id);
          return (
            <Pressable
              onPress={() => router.push({ pathname: "/client-detail", params: { id: item.id } })}
              style={({ pressed }) => [
                styles.clientRow,
                { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <View style={[styles.avatar, { backgroundColor: colors.primary + "20" }]}>
                <Text style={[styles.avatarText, { color: colors.primary }]}>{getInitials(item.name)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: "600", color: colors.foreground }} numberOfLines={1}>{item.name}</Text>
                <View style={{ flexDirection: "row", alignItems: "center", marginTop: 2 }}>
                  <Text style={{ fontSize: 12, color: colors.muted }} numberOfLines={1}>
                    {item.phone ? formatPhoneNumber(item.phone) : (item.email || "No contact info")}
                  </Text>
                  {apptCount > 0 && (
                    <Text style={{ fontSize: 11, color: colors.muted, marginLeft: 8 }}>
                      {apptCount} appt{apptCount > 1 ? "s" : ""}
                    </Text>
                  )}
                </View>
                {/* Location badges — show which location(s) this client has visited */}
                {locationBadges.length > 0 && (
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 5 }}>
                    {locationBadges.map((loc) => {
                      const dotColor = LOCATION_COLORS[state.locations.indexOf(loc) % LOCATION_COLORS.length] ?? colors.primary;
                      return (
                        <View
                          key={loc.id}
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            backgroundColor: dotColor + "18",
                            borderRadius: 8,
                            paddingHorizontal: 7,
                            paddingVertical: 2,
                            borderWidth: 1,
                            borderColor: dotColor + "40",
                          }}
                        >
                          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: dotColor, marginRight: 4 }} />
                          <Text style={{ fontSize: 10, fontWeight: "600", color: dotColor }} numberOfLines={1}>{loc.name}</Text>
                        </View>
                      );
                    })}
                  </View>
                )}
                {rating !== null && (
                  <View style={{ flexDirection: "row", alignItems: "center", marginTop: 3 }}>
                    <IconSymbol name="star.fill" size={12} color="#FFB300" />
                    <Text style={{ fontSize: 11, color: "#FFB300", fontWeight: "600", marginLeft: 3 }}>{rating}</Text>
                  </View>
                )}
              </View>
              <IconSymbol name="chevron.right" size={16} color={colors.muted} />
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <IconSymbol name="person.2.fill" size={48} color={colors.muted + "60"} />
            <Text style={{ fontSize: 15, color: colors.muted, marginTop: 12 }}>No clients yet</Text>
            <Text style={{ fontSize: 13, color: colors.muted, marginTop: 4 }}>Tap + to add or import from contacts</Text>
          </View>
        }
      />
      </View>
      {/* Upgrade Plan Sheet */}
      {upgradeSheetInfo && (
        <UpgradePlanSheet
          visible={upgradeSheetVisible}
          onClose={() => setUpgradeSheetVisible(false)}
          currentPlanKey={upgradeSheetInfo.planKey}
          currentPlanName={upgradeSheetInfo.planName}
          resource="clients"
          currentLimit={upgradeSheetInfo.limit}
          businessOwnerId={state.businessOwnerId!}
        />
      )}
    </ScreenContainer>
  );
}
const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16, paddingTop: 4 },
  iconButton: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  addButton: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  searchBar: { flexDirection: "row", alignItems: "center", borderRadius: 12, paddingHorizontal: 12, marginBottom: 16, borderWidth: 1 },
  searchInput: { flex: 1, paddingVertical: 12, paddingHorizontal: 8, fontSize: 14, lineHeight: 20 },
  addForm: { borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, width: "100%" },
  input: { width: "100%", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12, fontSize: 14, lineHeight: 20, marginBottom: 8, borderWidth: 1 },
  formActions: { flexDirection: "row", gap: 8, width: "100%" },
  formButton: { paddingVertical: 12, borderRadius: 12, alignItems: "center", justifyContent: "center", paddingHorizontal: 16, minHeight: 44 },
  clientRow: { flexDirection: "row", alignItems: "center", borderRadius: 14, padding: 12, marginBottom: 8, borderWidth: 1 },
  avatar: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", marginRight: 12 },
  avatarText: { fontSize: 14, fontWeight: "700" },
  emptyContainer: { alignItems: "center", paddingVertical: 48 },
});
