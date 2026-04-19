import { useState, useCallback, useEffect, useRef } from "react";
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
  Modal,
  Pressable,
  Share,
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
import QRCode from "react-native-qrcode-svg";
import ViewShot, { captureRef } from "react-native-view-shot";
import * as Sharing from "expo-sharing";

type ConnectStatus = {
  connected: boolean;
  chargesEnabled: boolean;
  onboardingComplete: boolean;
  accountId: string | null;
  stripeConfigured: boolean;
};

type PayoutInfo = {
  id: string;
  amount: number;
  currency: string;
  arrivalDate: number; // Unix timestamp
  status: string;
  description: string | null;
};

type PayoutData = {
  schedule: {
    interval: string;
    weeklyAnchor: string | null;
    monthlyAnchor: number | null;
    delayDays: number | null;
  } | null;
  nextPayout: PayoutInfo | null;
  recentPayouts: PayoutInfo[];
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

  // Payout schedule state
  const [payoutData, setPayoutData] = useState<PayoutData | null>(null);
  const [payoutLoading, setPayoutLoading] = useState(false);

  // QR code modal state
  type QrMethod = { label: string; handle: string; color: string; qrValue: string };
  const [qrModal, setQrModal] = useState<QrMethod | null>(null);
  const qrRef = useRef<ViewShot>(null);
  const [savingQr, setSavingQr] = useState(false);

  const saveQrToPhotos = useCallback(async () => {
    if (!qrRef.current) return;
    setSavingQr(true);
    try {
      const uri = await captureRef(qrRef, { format: "png", quality: 1 });
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(uri, { mimeType: "image/png", dialogTitle: "Save or Share QR Code" });
      } else {
        Alert.alert("Sharing not available", "Cannot share on this device.");
      }
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Failed to save QR code");
    } finally {
      setSavingQr(false);
    }
  }, []);

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

  const loadPayoutData = useCallback(async () => {
    if (!businessOwnerId) return;
    setPayoutLoading(true);
    try {
      const data = await apiCall<PayoutData>(
        `/api/stripe-connect/payouts?businessOwnerId=${businessOwnerId}`
      );
      setPayoutData(data);
    } catch {
      setPayoutData(null);
    } finally {
      setPayoutLoading(false);
    }
  }, [businessOwnerId]);

  // Load payout data once Stripe is confirmed active
  useEffect(() => {
    if (connectStatus?.chargesEnabled) {
      loadPayoutData();
    }
  }, [connectStatus?.chargesEnabled, loadPayoutData]);

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

                    {/* Payout Schedule Section */}
                    <View style={[styles.payoutSection, { backgroundColor: colors.background, borderColor: colors.border }]}>
                      <View style={styles.payoutSectionHeader}>
                        <Text style={[styles.payoutSectionTitle, { color: colors.foreground }]}>💰 Payout Schedule</Text>
                        {payoutLoading && <ActivityIndicator size="small" color="#635bff" />}
                      </View>

                      {!payoutLoading && payoutData && (
                        <>
                          {/* Schedule interval */}
                          {payoutData.schedule && (
                            <View style={styles.payoutRow}>
                              <Text style={[styles.payoutLabel, { color: colors.muted }]}>Frequency</Text>
                              <Text style={[styles.payoutValue, { color: colors.foreground }]}>
                                {payoutData.schedule.interval === "daily" ? "Daily" :
                                 payoutData.schedule.interval === "weekly"
                                   ? `Weekly (${payoutData.schedule.weeklyAnchor ? payoutData.schedule.weeklyAnchor.charAt(0).toUpperCase() + payoutData.schedule.weeklyAnchor.slice(1) : ""})` :
                                 payoutData.schedule.interval === "monthly"
                                   ? `Monthly (day ${payoutData.schedule.monthlyAnchor ?? ""})` :
                                 payoutData.schedule.interval === "manual" ? "Manual" :
                                 payoutData.schedule.interval}
                                {payoutData.schedule.delayDays ? ` · ${payoutData.schedule.delayDays}d delay` : ""}
                              </Text>
                            </View>
                          )}

                          {/* Next payout */}
                          {payoutData.nextPayout ? (
                            <View style={styles.payoutRow}>
                              <Text style={[styles.payoutLabel, { color: colors.muted }]}>Next Payout</Text>
                              <View style={{ alignItems: "flex-end" }}>
                                <Text style={[styles.payoutValue, { color: "#16a34a", fontWeight: "700" }]}>
                                  ${payoutData.nextPayout.amount.toFixed(2)}
                                </Text>
                                <Text style={[styles.payoutSub, { color: colors.muted }]}>
                                  {new Date(payoutData.nextPayout.arrivalDate * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                                </Text>
                              </View>
                            </View>
                          ) : (
                            <Text style={[styles.payoutEmpty, { color: colors.muted }]}>No upcoming payouts</Text>
                          )}

                          {/* Recent payouts */}
                          {payoutData.recentPayouts.filter(p => p.status === "paid").length > 0 && (
                            <>
                              <Text style={[styles.payoutHistoryLabel, { color: colors.muted }]}>Recent Payouts</Text>
                              {payoutData.recentPayouts
                                .filter(p => p.status === "paid")
                                .slice(0, 3)
                                .map((p) => (
                                  <View key={p.id} style={[styles.payoutHistoryRow, { borderTopColor: colors.border }]}>
                                    <Text style={[styles.payoutHistoryDate, { color: colors.muted }]}>
                                      {new Date(p.arrivalDate * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                    </Text>
                                    <Text style={[styles.payoutHistoryAmount, { color: colors.foreground }]}>
                                      ${p.amount.toFixed(2)}
                                    </Text>
                                  </View>
                                ))
                              }
                            </>
                          )}
                        </>
                      )}

                      {!payoutLoading && !payoutData && (
                        <Text style={[styles.payoutEmpty, { color: colors.muted }]}>Unable to load payout info</Text>
                      )}
                    </View>

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
              {zelleHandle.trim() ? (
                <TouchableOpacity
                  style={[styles.qrBtn, { borderColor: "#6C1D45" }]}
                  onPress={() => setQrModal({ label: "Zelle", handle: zelleHandle.trim(), color: "#6C1D45", qrValue: zelleHandle.trim() })}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.qrBtnText, { color: "#6C1D45" }]}>QR</Text>
                </TouchableOpacity>
              ) : null}
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
              {cashAppHandle.trim() ? (
                <TouchableOpacity
                  style={[styles.qrBtn, { borderColor: "#00C244" }]}
                  onPress={() => {
                    const tag = cashAppHandle.trim().startsWith("$") ? cashAppHandle.trim() : `$${cashAppHandle.trim()}`;
                    setQrModal({ label: "Cash App", handle: tag, color: "#00C244", qrValue: `https://cash.app/${tag.replace("$", "")}` });
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.qrBtnText, { color: "#00C244" }]}>QR</Text>
                </TouchableOpacity>
              ) : null}
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
              {venmoHandle.trim() ? (
                <TouchableOpacity
                  style={[styles.qrBtn, { borderColor: "#3D95CE" }]}
                  onPress={() => {
                    const user = venmoHandle.trim().replace(/^@/, "");
                    setQrModal({ label: "Venmo", handle: `@${user}`, color: "#3D95CE", qrValue: `https://venmo.com/${user}` });
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.qrBtnText, { color: "#3D95CE" }]}>QR</Text>
                </TouchableOpacity>
              ) : null}
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

      {/* QR Code Modal */}
      <Modal visible={!!qrModal} transparent animationType="slide" onRequestClose={() => setQrModal(null)}>
        <Pressable style={styles.qrModalOverlay} onPress={() => setQrModal(null)}>
          <Pressable style={[styles.qrModalContent, { backgroundColor: colors.background }]} onPress={() => {}}>
            {/* Header */}
            <View style={styles.qrModalHeader}>
              <Text style={[styles.qrModalTitle, { color: colors.foreground }]}>
                {qrModal?.label} QR Code
              </Text>
              <Pressable onPress={() => setQrModal(null)} style={({ pressed }) => [{ opacity: pressed ? 0.5 : 1 }]}>
                <IconSymbol name="xmark" size={22} color={colors.foreground} />
              </Pressable>
            </View>
            {qrModal && (
              <>
                <Text style={[styles.qrModalSubtitle, { color: colors.muted }]}>
                  Clients can scan this to send payment to {qrModal.handle}
                </Text>
                {/* QR code capture area */}
                <ViewShot ref={qrRef} style={styles.qrCapture}>
                  <QRCode value={qrModal.qrValue} size={200} color="#000" backgroundColor="#FFF" />
                </ViewShot>
                <Text style={[styles.qrHandleText, { color: colors.muted }]} numberOfLines={2}>
                  {qrModal.handle}
                </Text>
                {/* Action buttons */}
                <View style={styles.qrActions}>
                  <Pressable
                    onPress={saveQrToPhotos}
                    disabled={savingQr}
                    style={({ pressed }) => [styles.qrActionBtn, { backgroundColor: qrModal.color, opacity: (pressed || savingQr) ? 0.75 : 1 }]}
                  >
                    <IconSymbol name="arrow.down.to.line" size={16} color="#FFF" />
                    <Text style={styles.qrActionBtnText}>{savingQr ? "Saving..." : "Save / Share"}</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => Share.share({ url: qrModal.qrValue, message: `Pay me via ${qrModal.label}: ${qrModal.handle}` })}
                    style={({ pressed }) => [styles.qrActionBtn, { backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border, opacity: pressed ? 0.7 : 1 }]}
                  >
                    <IconSymbol name="square.and.arrow.up" size={16} color={colors.foreground} />
                    <Text style={[styles.qrActionBtnText, { color: colors.foreground }]}>Share Link</Text>
                  </Pressable>
                </View>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
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
  // Payout section
  payoutSection: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
  },
  payoutSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  payoutSectionTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  payoutRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  payoutLabel: {
    fontSize: 13,
  },
  payoutValue: {
    fontSize: 13,
    fontWeight: "600",
    textAlign: "right",
  },
  payoutSub: {
    fontSize: 11,
    marginTop: 2,
  },
  payoutEmpty: {
    fontSize: 13,
    fontStyle: "italic",
    textAlign: "center",
    paddingVertical: 4,
  },
  payoutHistoryLabel: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 4,
    marginBottom: 4,
  },
  payoutHistoryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
    borderTopWidth: 0.5,
  },
  payoutHistoryDate: {
    fontSize: 13,
  },
  payoutHistoryAmount: {
    fontSize: 13,
    fontWeight: "600",
  },
  // QR button on payment method cards
  qrBtn: {
    marginLeft: "auto",
    borderWidth: 1.5,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  qrBtnText: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  // QR Modal
  qrModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  qrModalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    alignItems: "center",
  },
  qrModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    marginBottom: 12,
  },
  qrModalTitle: {
    fontSize: 17,
    fontWeight: "700",
  },
  qrModalSubtitle: {
    fontSize: 13,
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 18,
  },
  qrCapture: {
    padding: 16,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    marginBottom: 12,
  },
  qrHandleText: {
    fontSize: 13,
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 18,
  },
  qrActions: {
    flexDirection: "row",
    gap: 10,
    width: "100%",
  },
  qrActionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 13,
    borderRadius: 12,
  },
  qrActionBtnText: {
    color: "#FFF",
    fontWeight: "700",
    fontSize: 14,
  },
});
