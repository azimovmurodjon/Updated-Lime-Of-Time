import { FlatList, Text, View, Pressable, StyleSheet, TextInput } from "react-native";
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
    <ScreenContainer className="px-5 pt-2">
      <View className="flex-row items-center justify-between mb-4">
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
      <View
        className="flex-row items-center rounded-xl px-3 mb-4 border"
        style={{ backgroundColor: colors.surface, borderColor: colors.border }}
      >
        <IconSymbol name="magnifyingglass" size={18} color={colors.muted} />
        <TextInput
          className="flex-1 py-3 px-2 text-sm text-foreground"
          placeholder="Search clients..."
          placeholderTextColor={colors.muted}
          value={search}
          onChangeText={setSearch}
          style={{ color: colors.foreground }}
          returnKeyType="done"
        />
      </View>

      {/* Add Client Form */}
      {showAdd && (
        <View className="bg-surface rounded-2xl p-4 mb-4 border border-border">
          <Text className="text-sm font-semibold text-foreground mb-3">New Client</Text>
          <TextInput
            className="bg-background rounded-xl px-3 py-3 text-sm mb-2 border border-border"
            placeholder="Full Name *"
            placeholderTextColor={colors.muted}
            value={newName}
            onChangeText={setNewName}
            style={{ color: colors.foreground }}
            returnKeyType="next"
          />
          <TextInput
            className="bg-background rounded-xl px-3 py-3 text-sm mb-2 border border-border"
            placeholder="Phone"
            placeholderTextColor={colors.muted}
            value={newPhone}
            onChangeText={setNewPhone}
            keyboardType="phone-pad"
            style={{ color: colors.foreground }}
            returnKeyType="next"
          />
          <TextInput
            className="bg-background rounded-xl px-3 py-3 text-sm mb-3 border border-border"
            placeholder="Email"
            placeholderTextColor={colors.muted}
            value={newEmail}
            onChangeText={setNewEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            style={{ color: colors.foreground }}
            returnKeyType="done"
            onSubmitEditing={handleAddClient}
          />
          <View className="flex-row gap-2">
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
              router.push({
                pathname: "/client-detail" as any,
                params: { id: item.id },
              })
            }
            style={({ pressed }) => [
              styles.clientRow,
              { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <View
              style={[styles.avatar, { backgroundColor: colors.primary + "20" }]}
            >
              <Text className="text-sm font-bold" style={{ color: colors.primary }}>
                {getInitials(item.name)}
              </Text>
            </View>
            <View style={styles.clientInfo}>
              <Text className="text-base font-semibold text-foreground" numberOfLines={1}>
                {item.name}
              </Text>
              <Text className="text-xs text-muted" numberOfLines={1}>
                {item.phone || item.email || "No contact info"}
              </Text>
            </View>
            <IconSymbol name="chevron.right" size={16} color={colors.muted} />
          </Pressable>
        )}
        ListEmptyComponent={
          <View className="items-center py-12">
            <IconSymbol name="person.2.fill" size={48} color={colors.muted} />
            <Text className="text-base text-muted mt-3">No clients yet</Text>
            <Text className="text-sm text-muted mt-1">Tap + to add your first client</Text>
          </View>
        }
        contentContainerStyle={{ paddingBottom: 80 }}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  addButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
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
  clientInfo: {
    flex: 1,
  },
  formButton: {
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
});
