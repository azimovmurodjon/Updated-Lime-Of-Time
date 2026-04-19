import { useState, useCallback, useEffect } from "react";
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
  ActivityIndicator,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useStore } from "@/lib/store";
import { useColors } from "@/hooks/use-colors";
import { useRouter } from "expo-router";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { FuturisticBackground } from "@/components/futuristic-background";
import { apiCall } from "@/lib/_core/api";
import * as WebBrowser from "expo-web-browser";
import { getApiBaseUrl } from "@/constants/oauth";

type ConnectStatus = {
  connected: boolean;
  chargesEnabled: boolean;
  onboardingComplete: boolean;
  accountId: string | null;
  stripeConfigured: boolean;
};

export default function PaymentMethodsScreen() {
  const { state, dispatch, syncToDb } = useStore();
  const colors = useColors();
  const router = useRouter();
  const settings = state.settings;
  const businessOwnerId = state.businessOwnerId;

  const [zelleHandle, setZelleHandle] = useState(settings.zelleHandle ?? "");
  const [cashAppHandle, setCashAppHandle] = useState(settings.cashAppHandle ?? "");
  const [venmoHandle, setVenmoHandle] = useState(settings.venmoHandle ?? "");
  const [paymentNotes, setPaymentNotes] = useState(settings.paymentNotes ?? "");
  const [saved, setSaved] = useState(false);

  // Stripe Connect state
  const [connectStatus, setConnectStatus] = useState<ConnectStatus | null>(null);
  const [connectLoading, setConnectLoading] = useState(false);
  const [connectStatusLoading, setConnectStatusLoading] = useState(true);

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

  // Load Stripe Connect status on mount
  const loadConnectStatus = useCallback(async () => {
    if (!businessOwnerId) return;
    setConnectStatusLoading(true);
    try {
      const data = await apiCall<ConnectStatus>(
        `/api/stripe-connect/status?businessOwnerId=${businessOwnerId}`
      );
      setConnectStatus(data);
    } catch {
      setConnectStatus(null);
    } finally {
      setConnectStatusLoading(false);
    }
  }, [businessOwnerId]);

  useEffect(() => {
    loadConnectStatus();
  }, [loadConnectStatus]);

  const handleConnectStripe = useCallback(async () => {
    if (!businessOwnerId) return;
    setConnectLoading(true);
    try {
      const data = await apiCall<{ url: string }>("/api/stripe-connect/onboard", {
        method: "POST",
        body: JSON.stringify({ businessOwnerId }),
      });
      if (data.url) {
        await WebBrowser.openBrowserAsync(data.url);
        // Refresh status after returning from browser
        await loadConnectStatus();
      }
    } catch (err: any) {
      Alert.alert("Error", err?.message ?? "Failed to start Stripe onboarding");
    } finally {
      setConnectLoading(false);
    }
  }, [businessOwnerId, loadConnectStatus]);

  const handleOpenDashboard = useCallback(async () => {
    if (!businessOwnerId) return;
    setConnectLoading(true);
    try {
      const data = await apiCall<{ url: string }>("/api/stripe-connect/dashboard-link", {
        method: "POST",
        body: JSON.stringify({ businessOwnerId }),
      });
      if (data.url) {
        await WebBrowser.openBrowserAsync(data.url);
      }
    } catch (err: any) {
      Alert.alert("Error", err?.message ?? "Failed to open Stripe dashboard");
    } finally {
      setConnectLoading(false);
    }
  }, [businessOwnerId]);

  const handleDisconnect = useCallback(() => {
    Alert.alert(
      "Disconnect Stripe",
      "Are you sure you want to disconnect your Stripe account? Clients will no longer be able to pay by card.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Disconnect",
          style: "destructive",
          onPress: async () => {
            try {
              await apiCall("/api/admin/stripe-connect/disconnect", {
                method: "POST",
                body: JSON.stringify({ businessOwnerId }),
              });
              await loadConnectStatus();
            } catch (err: any) {
              Alert.alert("Error", err?.message ?? "Failed to disconnect");
            }
          },
        },
      ]
    );
  }, [businessOwnerId, loadConnectStatus]);

  // Stripe Connect status badge
  const renderConnectBadge = () => {
    if (!connectStatus) return null;
    if (!connectStatus.stripeConfigured) {
      return (
        <View style={[styles.badge, { backgroundColor: "#f59e0b20" }]}>
          <Text style={[styles.badgeText, { color: "#f59e0b" }]}>⚠ Not Configured</Text>
        </View>
      );
    }
    if (!connectStatus.connected) {
      return (
        <View style={[styles.badge, { backgroundColor: "#6b728020" }]}>
          <Text style={[styles.badgeText, { color: "#6b7280" }]}>Not Connected</Text>
        </View>
      );
    }
    if (connectStatus.chargesEnabled) {
      return (
        <View style={[styles.badge, { backgroundColor: "#22c55e20" }]}>
          <Text style={[styles.badgeText, { color: "#16a34a" }]}>✓ Active</Text>
        </View>
      );
    }
    return (
      <View style={[styles.badge, { backgroundColor: "#f59e0b20" }]}>
        <Text style={[styles.badgeText, { color: "#f59e0b" }]}>Pending Verification</Text>
      </View>
    );
  };

  return (
    <ScreenContainer>
      <FuturisticBackground />
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

          {/* ── Stripe Connect Section ── */}
          <View style={[styles.stripeCard, { backgroundColor: "#635bff12", borderColor: "#635bff40" }]}>
            <View style={styles.stripeHeader}>
              <View style={styles.stripeTitleRow}>
                <Text style={styles.stripeIcon}>💳</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.stripeTitle, { color: colors.foreground }]}>Accept Card Payments</Text>
                  <Text style={[styles.stripeSubtitle, { color: colors.muted }]}>
                    Powered by Stripe Connect · 1.5% platform fee
                  </Text>
                </View>
              </View>
              {connectStatusLoading ? (
                <ActivityIndicator size="small" color="#635bff" />
              ) : (
                renderConnectBadge()
              )}
            </View>

            {!connectStatusLoading && connectStatus && (
              <>
                {!connectStatus.stripeConfigured && (
                  <Text style={[styles.stripeNote, { color: colors.muted }]}>
                    Stripe is not configured yet. Ask your platform admin to add the Stripe Secret Key in Platform Config.
                  </Text>
                )}

                {connectStatus.stripeConfigured && !connectStatus.connected && (
                  <>
                    <Text style={[styles.stripeNote, { color: colors.muted }]}>
                      Connect your Stripe account to let clients pay by card (Visa, Mastercard, Apple Pay, Google Pay) when booking. Funds go directly to your bank.
                    </Text>
                    <TouchableOpacity
                      style={[styles.stripeBtn, { backgroundColor: "#635bff" }]}
                      onPress={handleConnectStripe}
                      disabled={connectLoading}
                      activeOpacity={0.8}
                    >
                      {connectLoading ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text style={styles.stripeBtnText}>Connect with Stripe →</Text>
                      )}
                    </TouchableOpacity>
                  </>
                )}

                {connectStatus.connected && !connectStatus.chargesEnabled && (
                  <>
                    <Text style={[styles.stripeNote, { color: "#f59e0b" }]}>
                      Your Stripe account is connected but not fully verified yet. Complete the onboarding to start accepting card payments.
                    </Text>
                    <TouchableOpacity
                      style={[styles.stripeBtn, { backgroundColor: "#f59e0b" }]}
                      onPress={handleConnectStripe}
                      disabled={connectLoading}
                      activeOpacity={0.8}
                    >
                      {connectLoading ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text style={styles.stripeBtnText}>Complete Onboarding →</Text>
                      )}
                    </TouchableOpacity>
                  </>
                )}

                {connectStatus.chargesEnabled && (
                  <>
                    <Text style={[styles.stripeNote, { color: "#16a34a" }]}>
                      Your Stripe account is active. Clients can now pay by card on the booking page.
                    </Text>
                    <View style={styles.stripeActions}>
                      <TouchableOpacity
                        style={[styles.stripeBtnSmall, { backgroundColor: "#635bff" }]}
                        onPress={handleOpenDashboard}
                        disabled={connectLoading}
                        activeOpacity={0.8}
                      >
                        {connectLoading ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <Text style={styles.stripeBtnText}>View Stripe Dashboard</Text>
                        )}
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.stripeBtnSmall, { backgroundColor: "#ef444420", borderWidth: 1, borderColor: "#ef4444" }]}
                        onPress={handleDisconnect}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.stripeBtnText, { color: "#ef4444" }]}>Disconnect</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                )}

                <TouchableOpacity
                  onPress={loadConnectStatus}
                  style={styles.refreshBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <IconSymbol name="arrow.clockwise" size={13} color={colors.muted} />
                  <Text style={[styles.refreshText, { color: colors.muted }]}>Refresh status</Text>
                </TouchableOpacity>
              </>
            )}
          </View>

          {/* Divider */}
          <View style={[styles.divider, { borderColor: colors.border }]}>
            <Text style={[styles.dividerText, { color: colors.muted, backgroundColor: colors.background }]}>
              Manual Payment Handles
            </Text>
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
  // Stripe Connect
  stripeCard: {
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 16,
    marginBottom: 20,
  },
  stripeHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  stripeTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  stripeIcon: {
    fontSize: 24,
  },
  stripeTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  stripeSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  stripeNote: {
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 12,
  },
  stripeBtn: {
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    marginBottom: 8,
  },
  stripeActions: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
  },
  stripeBtnSmall: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  stripeBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    alignSelf: "flex-start",
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "600",
  },
  refreshBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  refreshText: {
    fontSize: 12,
  },
  // Divider
  divider: {
    borderTopWidth: 1,
    alignItems: "center",
    marginBottom: 16,
    marginTop: 4,
  },
  dividerText: {
    fontSize: 12,
    fontWeight: "600",
    paddingHorizontal: 10,
    marginTop: -9,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  // Existing styles
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
