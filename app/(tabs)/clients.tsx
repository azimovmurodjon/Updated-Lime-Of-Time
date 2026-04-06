import { FlatList, Text, View, Pressable, StyleSheet, TextInput, useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useStore, generateId } from "@/lib/store";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useState, useMemo, useCallback } from "react";
import { Client } from "@/lib/types";

export default function ClientsScreen() {
  const { state, dispatch } = useStore();
  const colors = useColors();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const hp = Math.max(16, width * 0.05);
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

  const getInitials = (name: string) => {
    const parts = name.split(" ");
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <ScreenContainer className="pt-2" style={{ paddingHorizontal: hp }}>
      <View style={styles.header}>
        <Text className="text-2xl font-bold text-foreground">Clients</Text>
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
          <Text className="text-sm font-semibold text-foreground" style={{ marginBottom: 12 }}>New Client</Text>
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
              <Text className="text-sm font-medium text-foreground">Cancel</Text>
            </Pressable>
            <Pressable
              onPress={handleAddClient}
              style={({ pressed }) => [
                styles.formButton,
                { backgroundColor: colors.primary, flex: 1, opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <Text className="text-sm font-semibold text-white">Save Client</Text>
            </Pressable>
          </View>
        </View>
      )}

      <FlatList
        data={filteredClients}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <Pressable
            onPress={() =>
              router.push({ pathname: "/client-detail" as any, params: { id: item.id } })
            }
            style={({ pressed }) => [
              styles.clientRow,
              { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <View style={[styles.avatar, { backgroundColor: colors.primary + "20" }]}>
              <Text style={[styles.avatarText, { color: colors.primary }]}>{getInitials(item.name)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text className="text-base font-semibold text-foreground" numberOfLines={1}>{item.name}</Text>
              <Text className="text-xs text-muted" numberOfLines={1}>
                {item.phone || item.email || "No contact info"}
              </Text>
            </View>
            <IconSymbol name="chevron.right" size={16} color={colors.muted} />
          </Pressable>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <IconSymbol name="person.2.fill" size={48} color={colors.muted} />
            <Text className="text-base text-muted" style={{ marginTop: 12 }}>No clients yet</Text>
            <Text className="text-sm text-muted" style={{ marginTop: 4 }}>Tap + to add your first client</Text>
          </View>
        }
        contentContainerStyle={{ paddingBottom: 80 }}
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
