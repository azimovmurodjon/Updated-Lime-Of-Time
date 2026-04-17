/**
 * SMS Automation Screen
 * ─────────────────────────────────────────────────────────────────────────────
 * Configure which automated SMS messages are sent via Twilio:
 *   • Booking confirmation
 *   • Appointment reminder (X hours before)
 *   • Rebooking nudge (X days after)
 *   • Birthday SMS
 *
 * Actual sending is triggered from the relevant screens (new-booking,
 * appointment-detail, birthday-campaigns) using the trpc.twilio.sendSms
 * mutation — this screen only manages the on/off toggles and timing.
 */
import { useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  Switch,
  Alert,
  TextInput,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useStore } from "@/lib/store";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { FuturisticBackground } from "@/components/futuristic-background";


type RuleKey =
  | "twilioBookingReminder"
  | "twilioRebookingNudge"
  | "twilioBirthdaySms";

interface AutomationRule {
  key: RuleKey;
  title: string;
  description: string;
  icon: string;
  iconColor: string;
  timingKey?: "twilioReminderHoursBeforeAppt" | "twilioRebookingNudgeDays";
  timingLabel?: string;
  timingUnit?: string;
  timingMin?: number;
  timingMax?: number;
}

const RULES: AutomationRule[] = [
  {
    key: "twilioBookingReminder",
    title: "Appointment Reminder",
    description: "Send a reminder SMS to the client before their appointment.",
    icon: "bell.fill",
    iconColor: "#F59E0B",
    timingKey: "twilioReminderHoursBeforeAppt",
    timingLabel: "Hours before appointment",
    timingUnit: "hrs",
    timingMin: 1,
    timingMax: 72,
  },
  {
    key: "twilioRebookingNudge",
    title: "Rebooking Nudge",
    description: "Remind clients to rebook after their appointment.",
    icon: "arrow.clockwise",
    iconColor: "#6366F1",
    timingKey: "twilioRebookingNudgeDays",
    timingLabel: "Days after appointment",
    timingUnit: "days",
    timingMin: 1,
    timingMax: 90,
  },
  {
    key: "twilioBirthdaySms",
    title: "Birthday SMS",
    description: "Send a happy birthday message to clients on their birthday.",
    icon: "birthday.cake.fill",
    iconColor: "#EC4899",
  },
];

export default function SmsAutomationScreen() {
  const router = useRouter();
  const { state, dispatch } = useStore();
  const colors = useColors();
  const settings = state.settings;
  // SMS is handled by the Lime Of Time platform backend — no Twilio credentials required
  // The master toggle simply enables/disables the automation rules

  const [timingValues, setTimingValues] = useState<Record<string, string>>({
    twilioReminderHoursBeforeAppt: String(
      settings.twilioReminderHoursBeforeAppt ?? 24
    ),
    twilioRebookingNudgeDays: String(settings.twilioRebookingNudgeDays ?? 14),
  });

  const handleToggle = (key: RuleKey, value: boolean) => {
    dispatch({ type: "UPDATE_SETTINGS", payload: { [key]: value } });
  };

  const handleTimingBlur = (
    timingKey: "twilioReminderHoursBeforeAppt" | "twilioRebookingNudgeDays",
    rule: AutomationRule
  ) => {
    const raw = timingValues[timingKey];
    const parsed = parseInt(raw, 10);
    if (
      isNaN(parsed) ||
      parsed < (rule.timingMin ?? 1) ||
      parsed > (rule.timingMax ?? 999)
    ) {
      Alert.alert(
        "Invalid value",
        `Please enter a number between ${rule.timingMin} and ${rule.timingMax}.`
      );
      setTimingValues((prev) => ({
        ...prev,
        [timingKey]: String(settings[timingKey] ?? (timingKey === "twilioReminderHoursBeforeAppt" ? 24 : 14)),
      }));
      return;
    }
    dispatch({ type: "UPDATE_SETTINGS", payload: { [timingKey]: parsed } });
  };

  return (
    <ScreenContainer edges={["top", "left", "right"]}>
      <FuturisticBackground />
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [{ opacity: pressed ? 0.5 : 1 }]}
        >
          <IconSymbol name="chevron.left" size={24} color={colors.primary} />
        </Pressable>
        <Text
          style={{ fontSize: 17, fontWeight: "700", color: colors.foreground }}
        >
          SMS Automation
        </Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
        {/* Master toggle */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            backgroundColor: colors.surface,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: colors.border,
            padding: 14,
            marginBottom: 20,
          }}
        >
          <View style={{ flex: 1, marginRight: 12 }}>
            <Text
              style={{
                fontSize: 15,
                fontWeight: "700",
                color: colors.foreground,
              }}
            >
              SMS Automation Enabled
            </Text>
            <Text
              style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}
            >
              {settings.twilioEnabled
                ? "SMS reminders are active"
                : "Enable to send automated SMS to clients"}
            </Text>
          </View>
          <Switch
            value={settings.twilioEnabled ?? false}
            onValueChange={(v) => {
              dispatch({
                type: "UPDATE_SETTINGS",
                payload: { twilioEnabled: v },
              });
            }}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor="#FFF"
          />
        </View>

        {/* Automation rules */}
        <Text
          style={{
            fontSize: 16,
            fontWeight: "700",
            color: colors.foreground,
            marginBottom: 12,
          }}
        >
          Automation Rules
        </Text>

        {RULES.map((rule) => {
          const isOn = !!(settings[rule.key] ?? false);
          return (
            <View
              key={rule.key}
              style={{
                backgroundColor: colors.surface,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: isOn ? rule.iconColor + "40" : colors.border,
                padding: 14,
                marginBottom: 12,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                    flex: 1,
                  }}
                >
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      backgroundColor: rule.iconColor + "20",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <IconSymbol
                      name={rule.icon as any}
                      size={18}
                      color={rule.iconColor}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontSize: 14,
                        fontWeight: "700",
                        color: colors.foreground,
                      }}
                    >
                      {rule.title}
                    </Text>
                    <Text
                      style={{
                        fontSize: 12,
                        color: colors.muted,
                        marginTop: 2,
                      }}
                    >
                      {rule.description}
                    </Text>
                  </View>
                </View>
                <Switch
                  value={isOn}
                  onValueChange={(v) => handleToggle(rule.key, v)}
                  trackColor={{ false: colors.border, true: rule.iconColor }}
                  thumbColor="#FFF"
                />
              </View>

              {/* Timing input */}
              {isOn && rule.timingKey && (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    marginTop: 12,
                    gap: 10,
                    paddingTop: 12,
                    borderTopWidth: 1,
                    borderTopColor: colors.border,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      color: colors.muted,
                      flex: 1,
                    }}
                  >
                    {rule.timingLabel}
                  </Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <TextInput
                      value={timingValues[rule.timingKey]}
                      onChangeText={(v) =>
                        setTimingValues((prev) => ({
                          ...prev,
                          [rule.timingKey!]: v,
                        }))
                      }
                      onBlur={() => handleTimingBlur(rule.timingKey!, rule)}
                      keyboardType="number-pad"
                      returnKeyType="done"
                      style={{
                        width: 64,
                        borderRadius: 10,
                        borderWidth: 1,
                        borderColor: colors.border,
                        backgroundColor: colors.background,
                        paddingHorizontal: 10,
                        paddingVertical: 8,
                        fontSize: 15,
                        fontWeight: "700",
                        color: colors.foreground,
                        textAlign: "center",
                      }}
                    />
                    <Text style={{ fontSize: 13, color: colors.muted }}>
                      {rule.timingUnit}
                    </Text>
                  </View>
                </View>
              )}
            </View>
          );
        })}

        {/* How it works note */}
        <View
          style={{
            backgroundColor: colors.primary + "10",
            borderRadius: 14,
            borderWidth: 1,
            borderColor: colors.primary + "30",
            padding: 14,
            marginTop: 8,
          }}
        >
          <Text
            style={{
              fontSize: 13,
              fontWeight: "700",
              color: colors.foreground,
              marginBottom: 6,
            }}
          >
            How SMS automation works
          </Text>
          <Text style={{ fontSize: 12, color: colors.muted, lineHeight: 18 }}>
            • <Text style={{ fontWeight: "600" }}>Booking Reminder</Text>: Sent
            automatically when you confirm an appointment in the app.{"\n"}•{" "}
            <Text style={{ fontWeight: "600" }}>Rebooking Nudge</Text>: Sent
            from the appointment detail screen after marking as completed.{"\n"}
            • <Text style={{ fontWeight: "600" }}>Birthday SMS</Text>: Sent from
            the Birthday Campaigns screen with one tap.
          </Text>
        </View>

        {/* Powered-by note */}
        <View style={{ alignItems: "center", marginTop: 20, marginBottom: 4 }}>
          <Text style={{ fontSize: 12, color: colors.muted }}>
            SMS powered by Lime Of Time
          </Text>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
  },
});
