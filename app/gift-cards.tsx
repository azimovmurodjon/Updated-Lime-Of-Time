import {
  Text,
  View,
  Pressable,
  StyleSheet,
  TextInput,
  FlatList,
  Alert,
  Modal,
  Platform,
  Linking,
  useWindowDimensions,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useStore, generateId } from "@/lib/store";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useState, useCallback, useMemo } from "react";
import { GiftCard, formatPhoneNumber, stripPhoneFormat, PUBLIC_BOOKING_URL } from "@/lib/types";
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
  const { width } = useWindowDimensions();
  const hp = Math.round(Math.max(16, width * 0.045));

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
  }, [selectedServiceId, recipientName, recipientPhone, message, expiresInDays, dispatch, syncToDb, resetForm]);

  const handleRedeem = useCallback(
    (card: GiftCard) => {
      Alert.alert("Redeem Gift Card", `Mark gift card ${card.code} as redeemed?`, [
        { text: "Cancel", style: "cancel" },
        {
          text: "Redeem",
          onPress: () => {
            const updated: GiftCard = { ...card, redeemed: true, redeemedAt: new Date().toISOString() };
            dispatch({ type: "UPDATE_GIFT_CARD", payload: updated });
            syncToDb({ type: "UPDATE_GIFT_CARD", payload: updated });
          },
        },
      ]);
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

  const handleSendGiftSMS = useCallback((card: GiftCard) => {
    const service = getServiceById(card.serviceLocalId);
    const businessName = state.settings.businessName || "Our Business";
    const serviceName = service?.name ?? "a service";
    const servicePrice = service?.price?.toFixed(2) ?? "0.00";
    const expiryText = card.expiresAt
      ? `\nThis gift card expires on ${new Date(card.expiresAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}.`
      : "";
    const personalMsg = card.message ? `\n\n"${card.message}"` : "";
    const giftUrl = `${PUBLIC_BOOKING_URL}/gift/${card.code}`;
    const body = `🎁 You've received a Gift Card from ${businessName}!\n\nService: ${serviceName} ($${servicePrice})\nGift Code: ${card.code}${personalMsg}${expiryText}\n\nRedeem here: ${giftUrl}\n\n— ${businessName}`;
    const phone = card.recipientPhone ? stripPhoneFormat(card.recipientPhone) : "";
    const smsUrl = Platform.OS === "ios"
      ? `sms:${phone}&body=${encodeURIComponent(body)}`
      : `sms:${phone}?body=${encodeURIComponent(body)}`;
    Linking.openURL(smsUrl).catch(() => {
      Alert.alert("Error", "Could not open messaging app.");
    });
  }, [getServiceById, state.settings.businessName]);

  const handlePhoneInput = useCallback((text: string) => {
    setRecipientPhone(formatPhoneNumber(text));
  }, []);

  const sortedCards = useMemo(
    () => [...state.giftCards].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [state.giftCards]
  );
  const activeCards = useMemo(() => sortedCards.filter((c) => !c.redeemed), [sortedCards]);
  const redeemedCards = useMemo(() => sortedCards.filter((c) => c.redeemed), [sortedCards]);
  const allCards = useMemo(() => [...activeCards, ...redeemedCards], [activeCards, redeemedCards]);

  const renderCard = useCallback(
    ({ item }: { item: GiftCard }) => {
      const service = getServiceById(item.serviceLocalId);
      const isExpired = item.expiresAt && new Date(item.expiresAt) < new Date();

      return (
        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.surface,
              borderColor: item.redeemed ? colors.muted + "40" : service?.color ?? colors.primary,
              borderLeftWidth: 4,
              opacity: item.redeemed ? 0.7 : 1,
            },
          ]}
        >
          {/* Code + Badge */}
          <View style={styles.cardHeader}>
            <View style={{ flex: 1 }}>
              <View style={styles.codeRow}>
                <Text style={[styles.codeText, { color: colors.foreground }]}>{item.code}</Text>
                {!item.redeemed && (
                  <Pressable onPress={() => handleCopyCode(item.code)} style={({ pressed }) => [pressed && { opacity: 0.6 }]}>
                    <IconSymbol name="doc.text.fill" size={16} color={colors.primary} />
                  </Pressable>
                )}
              </View>
              <Text style={[styles.serviceName, { color: colors.muted }]}>
                {service?.name ?? "Unknown Service"} — ${service?.price?.toFixed(2) ?? "0.00"}
              </Text>
            </View>
            <View style={[styles.badge, { backgroundColor: item.redeemed ? colors.success + "20" : isExpired ? colors.error + "20" : colors.primary + "20" }]}>
              <Text style={[styles.badgeText, { color: item.redeemed ? colors.success : isExpired ? colors.error : colors.primary }]}>
                {item.redeemed ? "Redeemed" : isExpired ? "Expired" : "Active"}
              </Text>
            </View>
          </View>

          {/* Recipient */}
          {(item.recipientName || item.recipientPhone) && (
            <View style={styles.detailRow}>
              <IconSymbol name="person.fill" size={14} color={colors.muted} />
              <Text style={[styles.detailText, { color: colors.muted }]}>
                {item.recipientName}{item.recipientPhone ? ` (${item.recipientPhone})` : ""}
              </Text>
            </View>
          )}

          {/* Message */}
          {item.message ? (
            <Text style={[styles.messageText, { color: colors.muted }]} numberOfLines={2}>
              &ldquo;{item.message}&rdquo;
            </Text>
          ) : null}

          {/* Footer */}
          <View style={styles.cardFooter}>
            <Text style={[styles.dateText, { color: colors.muted }]}>
              Created {new Date(item.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              {item.expiresAt ? ` · Expires ${new Date(item.expiresAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : ""}
            </Text>
            <View style={styles.cardActions}>
              {!item.redeemed && !isExpired && (
                <>
                  <Pressable
                    onPress={() => handleSendGiftSMS(item)}
                    style={({ pressed }) => [styles.actionBtn, { backgroundColor: colors.primary + "15" }, pressed && { opacity: 0.7 }]}
                  >
                    <IconSymbol name="paperplane.fill" size={14} color={colors.primary} />
                    <Text style={[styles.actionText, { color: colors.primary }]}>Send</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => handleRedeem(item)}
                    style={({ pressed }) => [styles.actionBtn, { backgroundColor: colors.success + "15" }, pressed && { opacity: 0.7 }]}
                  >
                    <IconSymbol name="checkmark" size={14} color={colors.success} />
                    <Text style={[styles.actionText, { color: colors.success }]}>Redeem</Text>
                  </Pressable>
                </>
              )}
              <Pressable
                onPress={() => handleDelete(item.id)}
                style={({ pressed }) => [styles.actionBtn, { backgroundColor: colors.error + "15" }, pressed && { opacity: 0.7 }]}
              >
                <IconSymbol name="trash.fill" size={14} color={colors.error} />
              </Pressable>
            </View>
          </View>
        </View>
      );
    },
    [colors, getServiceById, handleRedeem, handleDelete, handleCopyCode]
  );

  const formContent = showForm ? (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, borderLeftWidth: 1 }]}>
      <Text style={[styles.formTitle, { color: colors.foreground }]}>New Gift Card</Text>

      {/* Service */}
      <Text style={[styles.fieldLabel, { color: colors.muted }]}>Service *</Text>
      <Pressable
        onPress={() => setShowServicePicker(true)}
        style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, justifyContent: "center" }]}
      >
        <Text style={{ color: selectedServiceId ? colors.foreground : colors.muted + "80", fontSize: 15, lineHeight: 20 }}>
          {selectedServiceId ? getServiceById(selectedServiceId)?.name ?? "Select service" : "Select a service"}
        </Text>
      </Pressable>

      {/* Recipient Name */}
      <Text style={[styles.fieldLabel, { color: colors.muted }]}>Recipient Name</Text>
      <TextInput
        style={[styles.input, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border }]}
        value={recipientName}
        onChangeText={setRecipientName}
        placeholder="Optional"
        placeholderTextColor={colors.muted + "80"}
      />

      {/* Recipient Phone */}
      <Text style={[styles.fieldLabel, { color: colors.muted }]}>Recipient Phone</Text>
      <TextInput
        style={[styles.input, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border }]}
        value={recipientPhone}
        onChangeText={handlePhoneInput}
        placeholder="(000) 000-0000"
        placeholderTextColor={colors.muted + "80"}
        keyboardType="phone-pad"
        maxLength={19}
      />

      {/* Personal Message */}
      <Text style={[styles.fieldLabel, { color: colors.muted }]}>Personal Message</Text>
      <TextInput
        style={[styles.input, styles.multilineInput, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border }]}
        value={message}
        onChangeText={setMessage}
        placeholder="Optional gift message"
        placeholderTextColor={colors.muted + "80"}
        multiline
      />

      {/* Expires In */}
      <Text style={[styles.fieldLabel, { color: colors.muted }]}>Expires In (days)</Text>
      <TextInput
        style={[styles.input, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border }]}
        value={expiresInDays}
        onChangeText={setExpiresInDays}
        keyboardType="number-pad"
        placeholder="30"
        placeholderTextColor={colors.muted + "80"}
      />

      {/* Actions */}
      <View style={styles.formActions}>
        <Pressable
          onPress={resetForm}
          style={({ pressed }) => [styles.formBtnCancel, { borderColor: colors.border }, pressed && { opacity: 0.7 }]}
        >
          <Text style={{ color: colors.foreground, fontWeight: "600", fontSize: 14, lineHeight: 20 }}>Cancel</Text>
        </Pressable>
        <Pressable
          onPress={handleCreate}
          style={({ pressed }) => [styles.formBtnSave, { backgroundColor: colors.primary }, pressed && { opacity: 0.8 }]}
        >
          <Text style={{ color: "#fff", fontWeight: "600", fontSize: 14, lineHeight: 20 }}>Create Gift Card</Text>
        </Pressable>
      </View>
    </View>
  ) : null;

  return (
    <ScreenContainer edges={["top", "left", "right"]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.headerBackBtn, pressed && { opacity: 0.6 }]}>
          <IconSymbol name="arrow.left" size={22} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Gift Cards</Text>
        <Pressable
          onPress={() => { resetForm(); setShowForm(true); }}
          style={({ pressed }) => [styles.addBtn, { backgroundColor: colors.primary }, pressed && { opacity: 0.8 }]}
        >
          <IconSymbol name="plus" size={20} color="#fff" />
        </Pressable>
      </View>

      {/* Stats Row */}
      <View style={[styles.statsRow, { borderBottomColor: colors.border }]}>
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: colors.primary }]}>{activeCards.length}</Text>
          <Text style={[styles.statLabel, { color: colors.muted }]}>Active</Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: colors.success }]}>{redeemedCards.length}</Text>
          <Text style={[styles.statLabel, { color: colors.muted }]}>Redeemed</Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: colors.foreground }]}>{state.giftCards.length}</Text>
          <Text style={[styles.statLabel, { color: colors.muted }]}>Total</Text>
        </View>
      </View>

      {allCards.length === 0 && !showForm ? (
        <View style={styles.empty}>
          <IconSymbol name="gift.fill" size={48} color={colors.muted + "40"} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No Gift Cards Yet</Text>
          <Text style={[styles.emptySubtitle, { color: colors.muted }]}>
            Create gift cards for your services that clients can share and redeem.
          </Text>
          <Pressable
            onPress={() => setShowForm(true)}
            style={({ pressed }) => [styles.emptyBtn, { backgroundColor: colors.primary }, pressed && { opacity: 0.8 }]}
          >
            <Text style={styles.emptyBtnText}>Create Gift Card</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={allCards}
          keyExtractor={(item) => item.id}
          renderItem={renderCard}
          contentContainerStyle={{ paddingHorizontal: hp, paddingTop: 16, paddingBottom: 100 }}
          ListHeaderComponent={formContent}
        />
      )}

      {/* Service Picker Modal */}
      <Modal visible={showServicePicker} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setShowServicePicker(false)}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>Select Service</Text>
              <Pressable onPress={() => setShowServicePicker(false)} style={({ pressed }) => [pressed && { opacity: 0.6 }]}>
                <IconSymbol name="xmark" size={20} color={colors.muted} />
              </Pressable>
            </View>
            <FlatList
              data={state.services}
              keyExtractor={(item) => item.id}
              style={{ maxHeight: 340 }}
              renderItem={({ item }) => {
                const isActive = selectedServiceId === item.id;
                return (
                  <Pressable
                    onPress={() => { setSelectedServiceId(item.id); setShowServicePicker(false); }}
                    style={[styles.serviceOption, { backgroundColor: isActive ? colors.primary + "15" : "transparent", borderColor: isActive ? colors.primary : colors.border }]}
                  >
                    <View style={[styles.serviceColorDot, { backgroundColor: item.color }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.foreground, fontWeight: "600", fontSize: 15, lineHeight: 20 }}>{item.name}</Text>
                      <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 18 }}>${item.price.toFixed(2)} · {item.duration} min</Text>
                    </View>
                    {isActive && <IconSymbol name="checkmark" size={18} color={colors.primary} />}
                  </Pressable>
                );
              }}
              ListEmptyComponent={
                <Text style={{ color: colors.muted, textAlign: "center", padding: 20, fontSize: 14, lineHeight: 20 }}>
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
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: 0.5,
    gap: 12,
    width: "100%",
  },
  headerBackBtn: { padding: 4 },
  headerTitle: { fontSize: 20, fontWeight: "700", flex: 1, lineHeight: 26 },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  statsRow: {
    flexDirection: "row",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 0.5,
    width: "100%",
  },
  statItem: { flex: 1, alignItems: "center" },
  statValue: { fontSize: 22, fontWeight: "800", lineHeight: 28 },
  statLabel: { fontSize: 12, marginTop: 2, lineHeight: 16 },
  statDivider: { width: 1, marginVertical: 4 },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 12,
  },
  emptyTitle: { fontSize: 20, fontWeight: "700", lineHeight: 26 },
  emptySubtitle: { fontSize: 14, textAlign: "center", lineHeight: 20 },
  emptyBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    marginTop: 8,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyBtnText: { color: "#fff", fontWeight: "700", fontSize: 15, lineHeight: 20 },
  card: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    width: "100%",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 10,
    width: "100%",
  },
  codeRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  codeText: { fontSize: 17, fontWeight: "800", letterSpacing: 1, lineHeight: 22 },
  serviceName: { fontSize: 14, marginTop: 2, lineHeight: 18 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeText: { fontSize: 12, fontWeight: "700", lineHeight: 16 },
  detailRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4, width: "100%" },
  detailText: { fontSize: 13, lineHeight: 18, flex: 1 },
  messageText: { fontSize: 13, fontStyle: "italic", marginBottom: 8, lineHeight: 18 },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 0.5,
    borderTopColor: "#E5E7EB",
    width: "100%",
  },
  dateText: { fontSize: 12, lineHeight: 16, flex: 1 },
  cardActions: { flexDirection: "row", gap: 8 },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    minHeight: 36,
  },
  actionText: { fontSize: 12, fontWeight: "600", lineHeight: 16 },
  formTitle: { fontSize: 18, fontWeight: "700", marginBottom: 16, lineHeight: 24 },
  fieldLabel: { fontSize: 12, fontWeight: "500", marginBottom: 6, marginTop: 8 },
  input: {
    width: "100%",
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 15,
    lineHeight: 20,
    marginBottom: 4,
  },
  multilineInput: {
    height: 80,
    textAlignVertical: "top",
    paddingTop: 12,
  },
  formActions: { flexDirection: "row", gap: 10, marginTop: 12, width: "100%" },
  formBtnCancel: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
  },
  formBtnSave: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 16,
    paddingBottom: 40,
    paddingHorizontal: 20,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
    width: "100%",
  },
  modalTitle: { fontSize: 18, fontWeight: "700", lineHeight: 24 },
  serviceOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
    marginBottom: 4,
  },
  serviceColorDot: { width: 12, height: 12, borderRadius: 6 },
});
