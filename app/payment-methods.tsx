import { useState, useCallback } from "react";
import {
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useStore } from "@/lib/store";
import { useColors } from "@/hooks/use-colors";
import { useRouter } from "expo-router";
import { IconSymbol } from "@/components/ui/icon-symbol";

export default function PaymentMethodsScreen() {
  const { state, dispatch, syncToDb } = useStore();
  const colors = useColors();
  const router = useRouter();
  const settings = state.settings;

  const [zelleHandle, setZelleHandle] = useState(settings.zelleHandle ?? "");
  const [cashAppHandle, setCashAppHandle] = useState(settings.cashAppHandle ?? "");
  const [venmoHandle, setVenmoHandle] = useState(settings.venmoHandle ?? "");
  const [paymentNotes, setPaymentNotes] = useState(settings.paymentNotes ?? "");
  const [saved, setSaved] = useState(false);

  const handleSave = useCallback(() => {
    const action = {
      type: "UPDATE_SETTINGS" as const,
      payload: {
        zelleHandle: zelleHandle.trim(),
        cashAppHandle: cashAppHandle.trim(),
        venmoHandle: venmoHandle.trim(),
        paymentNotes: paymentNotes.trim(),
      },
    };
    dispatch(action);
    syncToDb(action);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }, [zelleHandle, cashAppHandle, venmoHandle, paymentNotes, dispatch, syncToDb]);

  const hasAnyMethod =
    zelleHandle.trim() || cashAppHandle.trim() || venmoHandle.trim();

  return (
    <ScreenContainer>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.backBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <IconSymbol name="chevron.left" size={22} color={colors.primary} />
            </TouchableOpacity>
            <Text style={[styles.title, { color: colors.foreground }]}>Payment Methods</Text>
            <View style={{ width: 36 }} />
          </View>

          {/* Info Banner */}
          <View style={[styles.infoBanner, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <IconSymbol name="info.circle.fill" size={16} color={colors.primary} />
            <Text style={[styles.infoText, { color: colors.muted }]}>
              These handles are shown to clients on the booking confirmation page so they know how to pay you.
            </Text>
          </View>

          {/* Zelle */}
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.methodHeader}>
              <View style={[styles.iconBadge, { backgroundColor: "#6C1D45" }]}>
                <Text style={styles.iconBadgeText}>Z</Text>
              </View>
              <Text style={[styles.methodName, { color: colors.foreground }]}>Zelle</Text>
            </View>
            <Text style={[styles.fieldLabel, { color: colors.muted }]}>Phone number or email</Text>
            <TextInput
              style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
              value={zelleHandle}
              onChangeText={setZelleHandle}
              placeholder="e.g. +14125551234 or you@email.com"
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
              keyboardType="email-address"
              returnKeyType="done"
            />
          </View>

          {/* CashApp */}
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.methodHeader}>
              <View style={[styles.iconBadge, { backgroundColor: "#00C244" }]}>
                <Text style={styles.iconBadgeText}>$</Text>
              </View>
              <Text style={[styles.methodName, { color: colors.foreground }]}>Cash App</Text>
            </View>
            <Text style={[styles.fieldLabel, { color: colors.muted }]}>$Cashtag</Text>
            <TextInput
              style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
              value={cashAppHandle}
              onChangeText={setCashAppHandle}
              placeholder="e.g. $YourCashtag"
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
              returnKeyType="done"
            />
          </View>

          {/* Venmo */}
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.methodHeader}>
              <View style={[styles.iconBadge, { backgroundColor: "#3D95CE" }]}>
                <Text style={styles.iconBadgeText}>V</Text>
              </View>
              <Text style={[styles.methodName, { color: colors.foreground }]}>Venmo</Text>
            </View>
            <Text style={[styles.fieldLabel, { color: colors.muted }]}>@Username</Text>
            <TextInput
              style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
              value={venmoHandle}
              onChangeText={setVenmoHandle}
              placeholder="e.g. @YourVenmo"
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
              returnKeyType="done"
            />
          </View>

          {/* Payment Notes */}
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.methodHeader}>
              <View style={[styles.iconBadge, { backgroundColor: colors.muted }]}>
                <Text style={styles.iconBadgeText}>✎</Text>
              </View>
              <Text style={[styles.methodName, { color: colors.foreground }]}>Additional Notes</Text>
            </View>
            <Text style={[styles.fieldLabel, { color: colors.muted }]}>
              Optional instructions shown on booking confirmation
            </Text>
            <TextInput
              style={[styles.input, styles.multilineInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
              value={paymentNotes}
              onChangeText={setPaymentNotes}
              placeholder="e.g. Please include your name in the payment note."
              placeholderTextColor={colors.muted}
              multiline
              numberOfLines={3}
              returnKeyType="done"
            />
          </View>

          {/* Preview */}
          {hasAnyMethod ? (
            <View style={[styles.previewCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.previewTitle, { color: colors.foreground }]}>Preview on Booking Page</Text>
              <Text style={[styles.previewSubtitle, { color: colors.muted }]}>
                Clients will see this after booking:
              </Text>
              <View style={styles.previewMethods}>
                {zelleHandle.trim() ? (
                  <View style={styles.previewRow}>
                    <View style={[styles.previewBadge, { backgroundColor: "#6C1D45" }]}>
                      <Text style={styles.previewBadgeText}>Z</Text>
                    </View>
                    <Text style={[styles.previewHandle, { color: colors.foreground }]}>{zelleHandle.trim()}</Text>
                  </View>
                ) : null}
                {cashAppHandle.trim() ? (
                  <View style={styles.previewRow}>
                    <View style={[styles.previewBadge, { backgroundColor: "#00C244" }]}>
                      <Text style={styles.previewBadgeText}>$</Text>
                    </View>
                    <Text style={[styles.previewHandle, { color: colors.foreground }]}>{cashAppHandle.trim()}</Text>
                  </View>
                ) : null}
                {venmoHandle.trim() ? (
                  <View style={styles.previewRow}>
                    <View style={[styles.previewBadge, { backgroundColor: "#3D95CE" }]}>
                      <Text style={styles.previewBadgeText}>V</Text>
                    </View>
                    <Text style={[styles.previewHandle, { color: colors.foreground }]}>{venmoHandle.trim()}</Text>
                  </View>
                ) : null}
                {paymentNotes.trim() ? (
                  <Text style={[styles.previewNotes, { color: colors.muted }]}>{paymentNotes.trim()}</Text>
                ) : null}
              </View>
            </View>
          ) : null}

          {/* Save Button */}
          <TouchableOpacity
            style={[styles.saveBtn, { backgroundColor: saved ? "#22C55E" : colors.primary }]}
            onPress={handleSave}
            activeOpacity={0.8}
          >
            <Text style={styles.saveBtnText}>
              {saved ? "✓ Saved!" : "Save Payment Methods"}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
  },
  infoBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 16,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  methodHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  iconBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  iconBadgeText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 15,
  },
  methodName: {
    fontSize: 16,
    fontWeight: "600",
  },
  fieldLabel: {
    fontSize: 12,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  multilineInput: {
    height: 80,
    textAlignVertical: "top",
    paddingTop: 10,
  },
  previewCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  previewTitle: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 4,
  },
  previewSubtitle: {
    fontSize: 12,
    marginBottom: 12,
  },
  previewMethods: {
    gap: 10,
  },
  previewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  previewBadge: {
    width: 28,
    height: 28,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  previewBadgeText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 13,
  },
  previewHandle: {
    fontSize: 14,
    fontWeight: "500",
  },
  previewNotes: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  saveBtn: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginBottom: 20,
  },
  saveBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
});
