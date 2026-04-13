import { useState, useCallback } from "react";
import { Text, View, Pressable, StyleSheet, Switch, TextInput, Alert, ScrollView, Linking } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useStore } from "@/lib/store";
import { useColors } from "@/hooks/use-colors";
import { useResponsive } from "@/hooks/use-responsive";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useRouter } from "expo-router";

export default function BookingPoliciesScreen() {
  const { state, dispatch, syncToDb } = useStore();
  const colors = useColors();
  const router = useRouter();
  const { isTablet, hp } = useResponsive();
  const settings = state.settings;
  const policy = settings.cancellationPolicy;

  const autoComplete = settings.autoCompleteEnabled;
  const autoCompleteDelay = settings.autoCompleteDelayMinutes ?? 5;

  const toggleAutoComplete = useCallback(() => {
    const action = { type: "UPDATE_SETTINGS" as const, payload: { autoCompleteEnabled: !autoComplete } };
    dispatch(action);
    syncToDb(action);
  }, [autoComplete, dispatch, syncToDb]);

  const setAutoCompleteDelay = useCallback((minutes: number) => {
    const action = { type: "UPDATE_SETTINGS" as const, payload: { autoCompleteDelayMinutes: minutes } };
    dispatch(action);
    syncToDb(action);
  }, [dispatch, syncToDb]);

  const toggleCancellation = useCallback(() => {
    const action = { type: "UPDATE_SETTINGS" as const, payload: { cancellationPolicy: { ...policy, enabled: !policy.enabled } } };
    dispatch(action);
    syncToDb(action);
  }, [policy, dispatch, syncToDb]);

  const setCancellationHours = useCallback((hours: number) => {
    const action = { type: "UPDATE_SETTINGS" as const, payload: { cancellationPolicy: { ...policy, hoursBeforeAppointment: hours } } };
    dispatch(action);
    syncToDb(action);
  }, [policy, dispatch, syncToDb]);

  const setCancellationFee = useCallback((fee: number) => {
    const action = { type: "UPDATE_SETTINGS" as const, payload: { cancellationPolicy: { ...policy, feePercentage: fee } } };
    dispatch(action);
    syncToDb(action);
  }, [policy, dispatch, syncToDb]);

  const toggleTemporaryClosed = useCallback(() => {
    const newValue = !settings.temporaryClosed;
    const action = { type: "UPDATE_SETTINGS" as const, payload: { temporaryClosed: newValue } };
    dispatch(action);
    syncToDb(action);
    if (newValue) {
      Alert.alert("Business Closed", "Your business is now marked as temporarily closed. Clients will not be able to book new appointments.");
    }
  }, [settings.temporaryClosed, dispatch, syncToDb]);

  return (
    <ScreenContainer edges={["top", "left", "right"]} tabletMaxWidth={720}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border, paddingHorizontal: hp }]}>
        <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.backBtn, { opacity: pressed ? 0.6 : 1 }]}>
          <IconSymbol name="arrow.left" size={22} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Booking Policies</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: hp, paddingVertical: 16, paddingBottom: 60 }}>
        {/* Cancellation Policy */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.switchRow}>
            <View style={styles.switchLabel}>
              <IconSymbol name="exclamationmark.triangle.fill" size={20} color="#FF9800" />
              <Text style={{ fontSize: 15, fontWeight: "500", color: colors.foreground, marginLeft: 12 }}>Cancellation Fee</Text>
            </View>
            <Switch
              value={policy.enabled}
              onValueChange={toggleCancellation}
              trackColor={{ false: colors.border, true: colors.primary + "60" }}
              thumbColor={policy.enabled ? colors.primary : colors.muted}
            />
          </View>
          {policy.enabled && (
            <View style={{ marginTop: 14 }}>
              <Text style={{ fontSize: 12, fontWeight: "500", color: colors.muted, marginBottom: 8 }}>Hours Before Appointment</Text>
              <View style={styles.chipRow}>
                {[1, 2, 4, 6, 12, 24].map((h) => (
                  <Pressable
                    key={h}
                    onPress={() => setCancellationHours(h)}
                    style={({ pressed }) => [
                      styles.chip,
                      {
                        backgroundColor: policy.hoursBeforeAppointment === h ? colors.primary : colors.background,
                        borderColor: policy.hoursBeforeAppointment === h ? colors.primary : colors.border,
                        opacity: pressed ? 0.7 : 1,
                      },
                    ]}
                  >
                    <Text style={{ fontSize: 13, fontWeight: "500", color: policy.hoursBeforeAppointment === h ? "#FFFFFF" : colors.foreground }}>
                      {h}h
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Text style={{ fontSize: 12, fontWeight: "500", color: colors.muted, marginTop: 12, marginBottom: 8 }}>Fee Percentage</Text>
              <View style={styles.chipRow}>
                {[25, 50, 75, 100].map((p) => (
                  <Pressable
                    key={p}
                    onPress={() => setCancellationFee(p)}
                    style={({ pressed }) => [
                      styles.chip,
                      {
                        backgroundColor: policy.feePercentage === p ? colors.primary : colors.background,
                        borderColor: policy.feePercentage === p ? colors.primary : colors.border,
                        opacity: pressed ? 0.7 : 1,
                      },
                    ]}
                  >
                    <Text style={{ fontSize: 13, fontWeight: "500", color: policy.feePercentage === p ? "#FFFFFF" : colors.foreground }}>
                      {p}%
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Text style={{ fontSize: 11, color: colors.muted, marginTop: 8, lineHeight: 16 }}>
                Clients will be charged {policy.feePercentage}% of the service price if they cancel within {policy.hoursBeforeAppointment} hour{policy.hoursBeforeAppointment > 1 ? "s" : ""} of the appointment.
              </Text>
            </View>
          )}
        </View>

        {/* Auto-Complete Appointments */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.switchRow}>
            <View style={styles.switchLabel}>
              <IconSymbol name="checkmark.circle.fill" size={20} color={colors.success} />
              <View style={{ marginLeft: 12, flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: "500", color: colors.foreground }}>Auto-Complete Appointments</Text>
                <Text style={{ fontSize: 12, color: colors.muted, marginTop: 2, lineHeight: 16 }}>
                  Automatically mark appointments as completed after the service ends
                </Text>
              </View>
            </View>
            <Switch
              value={autoComplete}
              onValueChange={toggleAutoComplete}
              trackColor={{ false: colors.border, true: colors.success + "60" }}
              thumbColor={autoComplete ? colors.success : colors.muted}
            />
          </View>
          {autoComplete && (
            <View style={{ marginTop: 14 }}>
              <Text style={{ fontSize: 12, fontWeight: "500", color: colors.muted, marginBottom: 8 }}>Mark Complete After End Time</Text>
              <View style={styles.chipRow}>
                {[5, 10, 15, 30].map((m) => (
                  <Pressable
                    key={m}
                    onPress={() => setAutoCompleteDelay(m)}
                    style={({ pressed }) => [
                      styles.chip,
                      {
                        backgroundColor: autoCompleteDelay === m ? colors.success : colors.background,
                        borderColor: autoCompleteDelay === m ? colors.success : colors.border,
                        opacity: pressed ? 0.7 : 1,
                      },
                    ]}
                  >
                    <Text style={{ fontSize: 13, fontWeight: "500", color: autoCompleteDelay === m ? "#FFFFFF" : colors.foreground }}>
                      +{m} min
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Text style={{ fontSize: 11, color: colors.muted, marginTop: 8, lineHeight: 16 }}>
                Appointments will be automatically marked as completed {autoCompleteDelay} minute{autoCompleteDelay > 1 ? "s" : ""} after the scheduled end time. A notification will be sent to confirm.
              </Text>
            </View>
          )}
        </View>

        {/* Custom Booking Slug */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.switchRow}>
            <View style={styles.switchLabel}>
              <IconSymbol name="link" size={20} color={colors.primary} />
              <Text style={{ fontSize: 15, fontWeight: "500", color: colors.foreground, marginLeft: 12 }}>Booking Page URL</Text>
            </View>
          </View>
          <Text style={{ fontSize: 12, color: colors.muted, marginBottom: 8, marginTop: 4 }}>
            Custom slug for your public booking page
          </Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
            value={settings.customSlug || ""}
            onChangeText={(text) => {
              const slug = text.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-");
              dispatch({ type: "UPDATE_SETTINGS", payload: { customSlug: slug } });
            }}
            onBlur={() => {
              if (settings.customSlug) {
                syncToDb({ type: "UPDATE_SETTINGS", payload: { customSlug: settings.customSlug } });
              }
            }}
            placeholder={settings.businessName.toLowerCase().replace(/\s+/g, "-")}
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 0.5 },
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 17, fontWeight: "700" },
  card: { borderRadius: 16, padding: 16, marginBottom: 14, borderWidth: 1 },
  switchRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  switchLabel: { flexDirection: "row", alignItems: "center", flex: 1 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1, alignItems: "center", justifyContent: "center", minHeight: 36 },
  input: { borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12, fontSize: 14, lineHeight: 20, borderWidth: 1 },
});
