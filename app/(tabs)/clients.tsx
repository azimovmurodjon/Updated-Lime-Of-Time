import { FlatList, Text, View, Pressable, StyleSheet, TextInput, useWindowDimensions, Alert, Platform, Modal } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useStore, generateId } from "@/lib/store";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useState, useMemo, useCallback } from "react";
import { Client, Review } from "@/lib/types";
import * as Contacts from "expo-contacts";

export default function ClientsScreen() {
  const { state, dispatch, getReviewsForClient, getAppointmentsForClient } = useStore();
  const colors = useColors();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const hp = Math.round(Math.max(16, width * 0.045));
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newEmail, setNewEmail] = useState("");

  // Contact picker modal
  const [contactPickerVisible, setContactPickerVisible] = useState(false);
  const [deviceContacts, setDeviceContacts] = useState<Contacts.Contact[]>([]);
  const [contactSearch, setContactSearch] = useState("");

  const filteredClients = useMemo(() => {
    const q = search.toLowerCase();
    return state.clients
      .filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.phone.includes(q) ||
          c.email.toLowerCase().includes(q)
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [state.clients, search]);

  const filteredContacts = useMemo(() => {
    if (!contactSearch) return deviceContacts;
    const q = contactSearch.toLowerCase();
    return deviceContacts.filter((c) => {
      const name = c.name || `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim();
      return name.toLowerCase().includes(q);
    });
  }, [deviceContacts, contactSearch]);

  const handleAddClient = useCallback(() => {
    if (!newName.trim()) return;
    const client: Client = {
      id: generateId(),
      name: newName.trim(),
      phone: newPhone.trim(),
      email: newEmail.trim(),
      notes: "",
      createdAt: new Date().toISOString(),
    };
    dispatch({ type: "ADD_CLIENT", payload: client });
    setNewName("");
    setNewPhone("");
    setNewEmail("");
    setShowAdd(false);
  }, [newName, newPhone, newEmail, dispatch]);

  const handleOpenContactPicker = useCallback(async () => {
    if (Platform.OS === "web") {
      Alert.alert("Not Available", "Contact import is only available on mobile devices.");
      return;
    }
    try {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Denied", "Please allow access to contacts in your device settings.");
        return;
      }

      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Emails],
        sort: Contacts.SortTypes.FirstName,
      });

      if (data.length === 0) {
        Alert.alert("No Contacts", "No contacts found on your device.");
        return;
      }

      // Filter out contacts already in client list
      const existingNames = new Set(state.clients.map((c) => c.name.toLowerCase()));
      const available = data.filter((c) => {
        const name = c.name || `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim();
        return name && !existingNames.has(name.toLowerCase());
      });

      if (available.length === 0) {
        Alert.alert("All Imported", "All your contacts are already in your client list.");
        return;
      }

      setDeviceContacts(available);
      setContactSearch("");
      setContactPickerVisible(true);
    } catch (error) {
      Alert.alert("Error", "Failed to access contacts. Please try again.");
    }
  }, [state.clients]);

  const handleSelectContact = useCallback(
    (contact: Contacts.Contact) => {
      const name = contact.name || `${contact.firstName ?? ""} ${contact.lastName ?? ""}`.trim();
      if (!name) return;
      const phone = contact.phoneNumbers?.[0]?.number ?? "";
      const email = contact.emails?.[0]?.email ?? "";
      const client: Client = {
        id: generateId(),
        name,
        phone,
        email,
        notes: "Imported from contacts",
        createdAt: new Date().toISOString(),
      };
      dispatch({ type: "ADD_CLIENT", payload: client });
      setContactPickerVisible(false);
      Alert.alert("Added", `${name} has been added as a client.`);
    },
    [dispatch]
  );

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
    <ScreenContainer>
      <View style={{ paddingHorizontal: hp }}>
        <View style={styles.header}>
          <Text style={{ fontSize: 24, fontWeight: "700", color: colors.foreground }}>Clients</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Pressable
              onPress={handleOpenContactPicker}
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
              placeholder="Phone"
              placeholderTextColor={colors.muted}
              value={newPhone}
              onChangeText={setNewPhone}
              keyboardType="phone-pad"
              returnKeyType="next"
            />
            <TextInput
              style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground, marginBottom: 14 }]}
              placeholder="Email"
              placeholderTextColor={colors.muted}
              value={newEmail}
              onChangeText={setNewEmail}
              keyboardType="email-address"
              autoCapitalize="none"
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
          const apptCount = getAppointmentsForClient(item.id).length;
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
                    {item.phone || item.email || "No contact info"}
                  </Text>
                  {apptCount > 0 && (
                    <Text style={{ fontSize: 11, color: colors.muted, marginLeft: 8 }}>
                      {apptCount} appt{apptCount > 1 ? "s" : ""}
                    </Text>
                  )}
                </View>
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

      {/* Contact Picker Modal */}
      <Modal visible={contactPickerVisible} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={() => setContactPickerVisible(false)}>
          <Pressable style={[styles.modalContent, { backgroundColor: colors.background }]} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <Text style={{ fontSize: 17, fontWeight: "700", color: colors.foreground }}>Select Contact</Text>
              <Pressable onPress={() => setContactPickerVisible(false)} style={({ pressed }) => [{ opacity: pressed ? 0.5 : 1 }]}>
                <IconSymbol name="xmark" size={22} color={colors.foreground} />
              </Pressable>
            </View>
            <View style={[styles.searchBar, { backgroundColor: colors.surface, borderColor: colors.border, marginBottom: 12 }]}>
              <IconSymbol name="magnifyingglass" size={16} color={colors.muted} />
              <TextInput
                style={[styles.searchInput, { color: colors.foreground, fontSize: 14 }]}
                placeholder="Search contacts..."
                placeholderTextColor={colors.muted}
                value={contactSearch}
                onChangeText={setContactSearch}
                returnKeyType="done"
                autoFocus
              />
            </View>
            <FlatList
              data={filteredContacts}
              keyExtractor={(item) => item.contactType ?? item.name ?? Math.random().toString()}
              showsVerticalScrollIndicator={false}
              style={{ maxHeight: 400 }}
              renderItem={({ item }) => {
                const name = item.name || `${item.firstName ?? ""} ${item.lastName ?? ""}`.trim();
                const phone = item.phoneNumbers?.[0]?.number ?? "";
                return (
                  <Pressable
                    onPress={() => handleSelectContact(item)}
                    style={({ pressed }) => [
                      styles.contactRow,
                      { borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
                    ]}
                  >
                    <View style={[styles.contactAvatar, { backgroundColor: colors.primary + "15" }]}>
                      <Text style={{ fontSize: 13, fontWeight: "700", color: colors.primary }}>
                        {name ? name.slice(0, 2).toUpperCase() : "?"}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 15, fontWeight: "500", color: colors.foreground }}>{name || "Unknown"}</Text>
                      {phone ? <Text style={{ fontSize: 12, color: colors.muted }}>{phone}</Text> : null}
                    </View>
                    <IconSymbol name="plus" size={18} color={colors.primary} />
                  </Pressable>
                );
              }}
              ListEmptyComponent={
                <View style={{ alignItems: "center", paddingVertical: 32 }}>
                  <Text style={{ fontSize: 14, color: colors.muted }}>No matching contacts</Text>
                </View>
              }
            />
          </Pressable>
        </Pressable>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16, paddingTop: 4 },
  iconButton: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  addButton: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  searchBar: { flexDirection: "row", alignItems: "center", borderRadius: 12, paddingHorizontal: 12, marginBottom: 16, borderWidth: 1 },
  searchInput: { flex: 1, paddingVertical: 12, paddingHorizontal: 8, fontSize: 14 },
  addForm: { borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1 },
  input: { borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12, fontSize: 14, marginBottom: 8, borderWidth: 1 },
  formActions: { flexDirection: "row", gap: 8 },
  formButton: { paddingVertical: 12, borderRadius: 12, alignItems: "center", justifyContent: "center", paddingHorizontal: 16 },
  clientRow: { flexDirection: "row", alignItems: "center", borderRadius: 14, padding: 12, marginBottom: 8, borderWidth: 1 },
  avatar: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", marginRight: 12 },
  avatarText: { fontSize: 14, fontWeight: "700" },
  emptyContainer: { alignItems: "center", paddingVertical: 48 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  modalContent: { borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 16, paddingBottom: 40, paddingHorizontal: 20, maxHeight: "80%" },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  contactRow: { flexDirection: "row", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1 },
  contactAvatar: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", marginRight: 12 },
});
