import {
  Text,
  View,
  Pressable,
  StyleSheet,
  TextInput,
  FlatList,
  Alert,
  ScrollView,
  Modal,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useStore, generateId } from "@/lib/store";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useState, useCallback, useMemo } from "react";
import { GiftCard } from "@/lib/types";
import * as Clipboard from "expo-clipboard";

function generateGiftCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `GIFT-${code}`;
}

export default function GiftCardsScreen() {
  const { state, dispatch, syncToDb, getServiceById } = useStore();
  const colors = useColors();
  const router = useRouter();

  const [showForm, setShowForm] = useState(false);
  const [selectedServiceId, setSelectedServiceId] = useState<string>("");
  const [recipientName, setRecipientName] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [message, setMessage] = useState("");
  const [expiresInDays, setExpiresInDays] = useState("30");
  const [showServicePicker, setShowServicePicker] = useState(false);

  const resetForm = useCallback(() => {
    setSelectedServiceId("");
    setRecipientName("");
    setRecipientPhone("");
    setMessage("");
    setExpiresInDays("30");
    setShowForm(false);
  }, []);

  const handleCreate = useCallback(() => {
    if (!selectedServiceId) {
      Alert.alert("Required", "Please select a service for this gift card.");
      return;
    }

    const days = parseInt(expiresInDays, 10);
    const expiresAt =
      !isNaN(days) && days > 0
        ? new Date(Date.now() + days * 86400000).toISOString().split("T")[0]
        : undefined;

    const newCard: GiftCard = {
      id: generateId(),
      code: generateGiftCode(),
      serviceLocalId: selectedServiceId,
      recipientName: recipientName.trim(),
      recipientPhone: recipientPhone.trim(),
      message: message.trim(),
      redeemed: false,
      expiresAt,
      createdAt: new Date().toISOString(),
    };

    dispatch({ type: "ADD_GIFT_CARD", payload: newCard });
    syncToDb({ type: "ADD_GIFT_CARD", payload: newCard });
    resetForm();
  }, [
    selectedServiceId,
    recipientName,
    recipientPhone,
    message,
    expiresInDays,
    dispatch,
    syncToDb,
    resetForm,
  ]);

  const handleRedeem = useCallback(
    (card: GiftCard) => {
      Alert.alert(
        "Redeem Gift Card",
        `Mark gift card ${card.code} as redeemed?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Redeem",
            onPress: () => {
              const updated: GiftCard = {
                ...card,
                redeemed: true,
                redeemedAt: new Date().toISOString(),
              };
              dispatch({ type: "UPDATE_GIFT_CARD", payload: updated });
              syncToDb({ type: "UPDATE_GIFT_CARD", payload: updated });
            },
          },
        ]
      );
    },
    [dispatch, syncToDb]
  );

  const handleDelete = useCallback(
    (id: string) => {
      Alert.alert("Delete Gift Card", "Are you sure?", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            dispatch({ type: "DELETE_GIFT_CARD", payload: id });
            syncToDb({ type: "DELETE_GIFT_CARD", payload: id });
          },
        },
      ]);
    },
    [dispatch, syncToDb]
  );

  const handleCopyCode = useCallback(async (code: string) => {
    try {
      if (Platform.OS === "web") {
        await navigator.clipboard.writeText(code);
      } else {
        await Clipboard.setStringAsync(code);
      }
      Alert.alert("Copied", `Gift code ${code} copied to clipboard.`);
    } catch {
      Alert.alert("Code", code);
    }
  }, []);

  const sortedCards = useMemo(
    () =>
      [...state.giftCards].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ),
    [state.giftCards]
  );

  const activeCards = useMemo(
    () => sortedCards.filter((c) => !c.redeemed),
    [sortedCards]
  );
  const redeemedCards = useMemo(
    () => sortedCards.filter((c) => c.redeemed),
    [sortedCards]
  );

  const renderCard = useCallback(
    ({ item }: { item: GiftCard }) => {
      const service = getServiceById(item.serviceLocalId);
      const isExpired =
        item.expiresAt && new Date(item.expiresAt) < new Date();

      return (
        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.surface,
              borderColor: item.redeemed
                ? colors.muted + "40"
                : service?.color ?? colors.primary,
              borderLeftWidth: 4,
              opacity: item.redeemed ? 0.7 : 1,
            },
          ]}
        >
          <View style={styles.cardHeader}>
            <View style={{ flex: 1 }}>
              <View style={styles.codeRow}>
                <Text
                  style={[styles.codeText, { color: colors.foreground }]}
                >
                  {item.code}
                </Text>
                {!item.redeemed && (
                  <Pressable
                    onPress={() => handleCopyCode(item.code)}
                    style={({ pressed }) => [pressed && { opacity: 0.7 }]}
                  >
                    <IconSymbol
                      name="doc.text.fill"
                      size={18}
                      color={colors.primary}
                    />
                  </Pressable>
                )}
              </View>
              <Text style={[styles.serviceName, { color: colors.muted }]}>
                {service?.name ?? "Unknown Service"} — $
                {service?.price?.toFixed(2) ?? "0.00"}
              </Text>
            </View>
            {item.redeemed ? (
              <View
                style={[
                  styles.badge,
                  { backgroundColor: colors.success + "20" },
                ]}
              >
                <Text
                  style={[styles.badgeText, { color: colors.success }]}
                >
                  Redeemed
                </Text>
              </View>
            ) : isExpired ? (
              <View
                style={[
                  styles.badge,
                  { backgroundColor: colors.error + "20" },
                ]}
              >
                <Text style={[styles.badgeText, { color: colors.error }]}>
                  Expired
                </Text>
              </View>
            ) : (
              <View
                style={[
                  styles.badge,
                  { backgroundColor: colors.primary + "20" },
                ]}
              >
                <Text
                  style={[styles.badgeText, { color: colors.primary }]}
                >
                  Active
                </Text>
              </View>
            )}
          </View>

          {(item.recipientName || item.recipientPhone) && (
            <View style={styles.recipientRow}>
              <IconSymbol
                name="person.fill"
                size={14}
                color={colors.muted}
              />
              <Text style={[styles.recipientText, { color: colors.muted }]}>
                {item.recipientName}
                {item.recipientPhone
                  ? ` (${item.recipientPhone})`
                  : ""}
              </Text>
            </View>
          )}

          {item.message ? (
            <Text
              style={[styles.messageText, { color: colors.muted }]}
              numberOfLines={2}
            >
              "{item.message}"
            </Text>
          ) : null}

          <View style={styles.cardFooter}>
            <Text style={[styles.dateText, { color: colors.muted }]}>
              Created{" "}
              {new Date(item.createdAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}
              {item.expiresAt
                ? ` · Expires ${new Date(item.expiresAt).toLocaleDateString(
                    "en-US",
                    { month: "short", day: "numeric" }
                  )}`
                : ""}
            </Text>
            <View style={styles.cardActions}>
              {!item.redeemed && !isExpired && (
                <Pressable
                  onPress={() => handleRedeem(item)}
                  style={({ pressed }) => [
                    styles.actionBtn,
                    { backgroundColor: colors.success + "15" },
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <IconSymbol
                    name="checkmark"
                    size={14}
                    color={colors.success}
                  />
                  <Text
                    style={[styles.actionText, { color: colors.success }]}
                  >
                    Redeem
                  </Text>
                </Pressable>
              )}
              <Pressable
                onPress={() => handleDelete(item.id)}
                style={({ pressed }) => [
                  styles.actionBtn,
                  { backgroundColor: colors.error + "15" },
                  pressed && { opacity: 0.7 },
                ]}
              >
                <IconSymbol
                  name="trash.fill"
                  size={14}
                  color={colors.error}
                />
              </Pressable>
            </View>
          </View>
        </View>
      );
    },
    [colors, getServiceById, handleRedeem, handleDelete, handleCopyCode]
  );

  const allCards = useMemo(
    () => [...activeCards, ...redeemedCards],
    [activeCards, redeemedCards]
  );

  return (
    <ScreenContainer edges={["top", "left", "right"]}>
      {/* Header */}
      <View
        style={[styles.header, { borderBottomColor: colors.border }]}
      >
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [pressed && { opacity: 0.7 }]}
        >
          <IconSymbol name="arrow.left" size={24} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>
          Gift Cards
        </Text>
        <Pressable
          onPress={() => {
            resetForm();
            setShowForm(true);
          }}
          style={({ pressed }) => [
            styles.addBtn,
            { backgroundColor: colors.primary },
            pressed && { opacity: 0.8 },
          ]}
        >
          <IconSymbol name="plus" size={20} color="#fff" />
        </Pressable>
      </View>

      {/* Stats */}
      <View style={[styles.statsRow, { borderBottomColor: colors.border }]}>
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: colors.primary }]}>
            {activeCards.length}
          </Text>
          <Text style={[styles.statLabel, { color: colors.muted }]}>
            Active
          </Text>
        </View>
        <View
          style={[styles.statDivider, { backgroundColor: colors.border }]}
        />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: colors.success }]}>
            {redeemedCards.length}
          </Text>
          <Text style={[styles.statLabel, { color: colors.muted }]}>
            Redeemed
          </Text>
        </View>
        <View
          style={[styles.statDivider, { backgroundColor: colors.border }]}
        />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: colors.foreground }]}>
            {state.giftCards.length}
          </Text>
          <Text style={[styles.statLabel, { color: colors.muted }]}>
            Total
          </Text>
        </View>
      </View>

      {allCards.length === 0 && !showForm ? (
        <View style={styles.empty}>
          <IconSymbol
            name="gift.fill"
            size={48}
            color={colors.muted + "40"}
          />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
            No Gift Cards Yet
          </Text>
          <Text style={[styles.emptySubtitle, { color: colors.muted }]}>
            Create gift cards for your services that clients can share and
            redeem.
          </Text>
          <Pressable
            onPress={() => setShowForm(true)}
            style={({ pressed }) => [
              styles.emptyBtn,
              { backgroundColor: colors.primary },
              pressed && { opacity: 0.8 },
            ]}
          >
            <Text style={styles.emptyBtnText}>Create Gift Card</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={allCards}
          keyExtractor={(item) => item.id}
          renderItem={renderCard}
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          ListHeaderComponent={
            showForm ? (
              <View
                style={[
                  styles.formCard,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Text
                  style={[styles.formTitle, { color: colors.foreground }]}
                >
                  New Gift Card
                </Text>

                <Text style={[styles.label, { color: colors.muted }]}>
                  Service *
                </Text>
                <Pressable
                  onPress={() => setShowServicePicker(true)}
                  style={[
                    styles.input,
                    {
                      backgroundColor: colors.background,
                      borderColor: colors.border,
                      justifyContent: "center",
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: selectedServiceId
                        ? colors.foreground
                        : colors.muted + "80",
                      fontSize: 15,
                    }}
                  >
                    {selectedServiceId
                      ? getServiceById(selectedServiceId)?.name ??
                        "Select service"
                      : "Select a service"}
                  </Text>
                </Pressable>

                <Text style={[styles.label, { color: colors.muted }]}>
                  Recipient Name
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      color: colors.foreground,
                      backgroundColor: colors.background,
                      borderColor: colors.border,
                    },
                  ]}
                  value={recipientName}
                  onChangeText={setRecipientName}
                  placeholder="Optional"
                  placeholderTextColor={colors.muted + "80"}
                />

                <Text style={[styles.label, { color: colors.muted }]}>
                  Recipient Phone
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      color: colors.foreground,
                      backgroundColor: colors.background,
                      borderColor: colors.border,
                    },
                  ]}
                  value={recipientPhone}
                  onChangeText={setRecipientPhone}
                  placeholder="Optional"
                  placeholderTextColor={colors.muted + "80"}
                  keyboardType="phone-pad"
                />

                <Text style={[styles.label, { color: colors.muted }]}>
                  Personal Message
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      color: colors.foreground,
                      backgroundColor: colors.background,
                      borderColor: colors.border,
                      height: 80,
                      textAlignVertical: "top",
                      paddingTop: 12,
                    },
                  ]}
                  value={message}
                  onChangeText={setMessage}
                  placeholder="Optional gift message"
                  placeholderTextColor={colors.muted + "80"}
                  multiline
                />

                <Text style={[styles.label, { color: colors.muted }]}>
                  Expires In (days)
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      color: colors.foreground,
                      backgroundColor: colors.background,
                      borderColor: colors.border,
                    },
                  ]}
                  value={expiresInDays}
                  onChangeText={setExpiresInDays}
                  keyboardType="number-pad"
                  placeholder="30"
                  placeholderTextColor={colors.muted + "80"}
                />

                <View style={styles.formActions}>
                  <Pressable
                    onPress={resetForm}
                    style={({ pressed }) => [
                      styles.formBtn,
                      {
                        backgroundColor: colors.background,
                        borderColor: colors.border,
                        borderWidth: 1,
                      },
                      pressed && { opacity: 0.7 },
                    ]}
                  >
                    <Text
                      style={{ color: colors.foreground, fontWeight: "600" }}
                    >
                      Cancel
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={handleCreate}
                    style={({ pressed }) => [
                      styles.formBtn,
                      { backgroundColor: colors.primary, flex: 1 },
                      pressed && { opacity: 0.8 },
                    ]}
                  >
                    <Text style={{ color: "#fff", fontWeight: "600" }}>
                      Create Gift Card
                    </Text>
                  </Pressable>
                </View>
              </View>
            ) : null
          }
        />
      )}

      {/* Service Picker Modal */}
      <Modal
        visible={showServicePicker}
        transparent
        animationType="fade"
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowServicePicker(false)}
        >
          <View
            style={[
              styles.modalContent,
              { backgroundColor: colors.surface },
            ]}
          >
            <Text
              style={[styles.modalTitle, { color: colors.foreground }]}
            >
              Select Service
            </Text>
            <FlatList
              data={state.services}
              keyExtractor={(item) => item.id}
              style={{ maxHeight: 300 }}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => {
                    setSelectedServiceId(item.id);
                    setShowServicePicker(false);
                  }}
                  style={({ pressed }) => [
                    styles.serviceOption,
                    {
                      backgroundColor:
                        selectedServiceId === item.id
                          ? colors.primary + "20"
                          : "transparent",
                    },
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <View
                    style={[
                      styles.serviceColorDot,
                      { backgroundColor: item.color },
                    ]}
                  />
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        color: colors.foreground,
                        fontWeight: "600",
                        fontSize: 15,
                      }}
                    >
                      {item.name}
                    </Text>
                    <Text
                      style={{ color: colors.muted, fontSize: 13 }}
                    >
                      ${item.price.toFixed(2)} · {item.duration} min
                    </Text>
                  </View>
                  {selectedServiceId === item.id && (
                    <IconSymbol
                      name="checkmark"
                      size={20}
                      color={colors.primary}
                    />
                  )}
                </Pressable>
              )}
              ListEmptyComponent={
                <Text
                  style={{
                    color: colors.muted,
                    textAlign: "center",
                    padding: 20,
                  }}
                >
                  No services available. Create a service first.
                </Text>
              }
            />
          </View>
        </Pressable>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    gap: 12,
  },
  headerTitle: { fontSize: 20, fontWeight: "700", flex: 1 },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  statsRow: {
    flexDirection: "row",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 0.5,
  },
  statItem: { flex: 1, alignItems: "center" },
  statValue: { fontSize: 22, fontWeight: "800" },
  statLabel: { fontSize: 12, marginTop: 2 },
  statDivider: { width: 1, marginVertical: 4 },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 12,
  },
  emptyTitle: { fontSize: 20, fontWeight: "700" },
  emptySubtitle: { fontSize: 14, textAlign: "center", lineHeight: 20 },
  emptyBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    marginTop: 8,
  },
  emptyBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  card: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  codeRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  codeText: { fontSize: 18, fontWeight: "800", letterSpacing: 1 },
  serviceName: { fontSize: 14, marginTop: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeText: { fontSize: 12, fontWeight: "700" },
  recipientRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  recipientText: { fontSize: 13 },
  messageText: { fontSize: 13, fontStyle: "italic", marginBottom: 8 },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
  },
  dateText: { fontSize: 12 },
  cardActions: { flexDirection: "row", gap: 8 },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  actionText: { fontSize: 12, fontWeight: "600" },
  formCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
  },
  formTitle: { fontSize: 18, fontWeight: "700", marginBottom: 16 },
  label: { fontSize: 13, fontWeight: "600", marginBottom: 6, marginTop: 4 },
  input: {
    width: "100%",
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 15,
    lineHeight: 20,
    marginBottom: 8,
  },
  formActions: { flexDirection: "row", gap: 12, marginTop: 8, width: "100%" },
  formBtn: {
    height: 44,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    minWidth: 80,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    width: "85%",
    maxWidth: 380,
    borderRadius: 16,
    padding: 20,
  },
  modalTitle: { fontSize: 18, fontWeight: "700", marginBottom: 12 },
  serviceOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 12,
  },
  serviceColorDot: { width: 12, height: 12, borderRadius: 6 },
});
