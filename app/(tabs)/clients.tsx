import { FlatList, Text, View, Pressable, StyleSheet, TextInput, useWindowDimensions, Alert, Platform } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useStore, generateId } from "@/lib/store";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useState, useMemo, useCallback } from "react";
import { Client } from "@/lib/types";
import * as Contacts from "expo-contacts";

export default function ClientsScreen() {
  const { state, dispatch } = useStore();
  const colors = useColors();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const hp = Math.round(Math.max(16, width * 0.045));
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newEmail, setNewEmail] = useState("");

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

  const handleImportContacts = useCallback(async () => {
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

      // Filter out contacts that are already clients (by name match)
      const existingNames = new Set(state.clients.map((c) => c.name.toLowerCase()));
      const newContacts = data.filter((c) => {
        const name = c.name || `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim();
        return name && !existingNames.has(name.toLowerCase());
      });

      if (newContacts.length === 0) {
        Alert.alert("All Imported", "All your contacts are already in your client list.");
        return;
      }

      // Show selection: import first 50 for performance
      const toImport = newContacts.slice(0, 50);
      Alert.alert(
        "Import Contacts",
        `Found ${newContacts.length} new contacts. Import ${toImport.length > 50 ? "first 50" : `${toImport.length}`}?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Import",
            onPress: () => {
              let imported = 0;
              toImport.forEach((contact) => {
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
                imported++;
              });
              Alert.alert("Success", `Imported ${imported} contacts as clients.`);
            },
          },
        ]
      );
    } catch (error) {
      Alert.alert("Error", "Failed to access contacts. Please try again.");
    }
  }, [state.clients, dispatch]);

  const getInitials = (name: string) => {
    const parts = name.split(" ");
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <ScreenContainer>
      <View style={{ paddingHorizontal: hp }}>
        <View style={styles.header}>
          <Text style={{ fontSize: 24, fontWeight: "700", color: colors.foreground }}>Clients</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Pressable
              onPress={handleImportContacts}
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
        renderItem={({ item }) => (
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
              <Text style={{ fontSize: 12, color: colors.muted }} numberOfLines={1}>
                {item.phone || item.email || "No contact info"}
              </Text>
            </View>
            <IconSymbol name="chevron.right" size={16} color={colors.muted} />
          </Pressable>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <IconSymbol name="person.2.fill" size={48} color={colors.muted + "60"} />
            <Text style={{ fontSize: 15, color: colors.muted, marginTop: 12 }}>No clients yet</Text>
            <Text style={{ fontSize: 13, color: colors.muted, marginTop: 4 }}>Tap + to add or import contacts</Text>
          </View>
        }
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
    paddingTop: 4,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: 16,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    fontSize: 14,
  },
  addForm: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
  },
  input: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    marginBottom: 8,
    borderWidth: 1,
  },
  formActions: {
    flexDirection: "row",
    gap: 8,
  },
  formButton: {
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  clientRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  avatarText: {
    fontSize: 14,
    fontWeight: "700",
  },
  emptyContainer: {
    alignItems: "center",
    paddingVertical: 48,
  },
});
