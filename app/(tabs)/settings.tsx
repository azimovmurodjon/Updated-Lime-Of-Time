import {
  Text,
  View,
  Pressable,
  StyleSheet,
  TextInput,
  ScrollView,
  Switch,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useStore } from "@/lib/store";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useState, useCallback } from "react";
import { DAYS_OF_WEEK, WorkingHours } from "@/lib/types";

const DAY_LABELS: Record<string, string> = {
  sunday: "Sunday",
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
};

export default function SettingsScreen() {
  const { state, dispatch } = useStore();
  const colors = useColors();
  const { settings } = state;

  const [businessName, setBusinessName] = useState(settings.businessName);
  const [editingName, setEditingName] = useState(false);

  const handleSaveName = useCallback(() => {
    if (businessName.trim()) {
      dispatch({ type: "UPDATE_SETTINGS", payload: { businessName: businessName.trim() } });
    }
    setEditingName(false);
  }, [businessName, dispatch]);

  const toggleNotifications = useCallback(() => {
    dispatch({
      type: "UPDATE_SETTINGS",
      payload: { notificationsEnabled: !settings.notificationsEnabled },
    });
  }, [settings.notificationsEnabled, dispatch]);

  const toggleDay = useCallback(
    (day: string) => {
      const current = settings.workingHours[day];
      const updated: Record<string, WorkingHours> = {
        ...settings.workingHours,
        [day]: { ...current, enabled: !current.enabled },
      };
      dispatch({ type: "UPDATE_SETTINGS", payload: { workingHours: updated } });
    },
    [settings.workingHours, dispatch]
  );

  const updateDayTime = useCallback(
    (day: string, field: "start" | "end", value: string) => {
      const current = settings.workingHours[day];
      const updated: Record<string, WorkingHours> = {
        ...settings.workingHours,
        [day]: { ...current, [field]: value },
      };
      dispatch({ type: "UPDATE_SETTINGS", payload: { workingHours: updated } });
    },
    [settings.workingHours, dispatch]
  );

  const setDefaultDuration = useCallback(
    (duration: number) => {
      dispatch({ type: "UPDATE_SETTINGS", payload: { defaultDuration: duration } });
    },
    [dispatch]
  );

  return (
    <ScreenContainer className="px-5 pt-2">
      <Text className="text-2xl font-bold text-foreground mb-5">Settings</Text>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Business Name */}
        <View className="bg-surface rounded-2xl p-4 mb-4 border border-border">
          <Text className="text-xs font-medium text-muted mb-2">Business Name</Text>
          {editingName ? (
            <View className="flex-row items-center gap-2">
              <TextInput
                className="flex-1 bg-background rounded-xl px-3 py-2.5 text-base border border-border"
                value={businessName}
                onChangeText={setBusinessName}
                style={{ color: colors.foreground }}
                returnKeyType="done"
                onSubmitEditing={handleSaveName}
                autoFocus
              />
              <Pressable
                onPress={handleSaveName}
                style={({ pressed }) => [
                  styles.smallButton,
                  { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 },
                ]}
              >
                <Text className="text-xs font-semibold text-white">Save</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable
              onPress={() => setEditingName(true)}
              style={({ pressed }) => [
                styles.editableRow,
                { opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Text className="text-base font-semibold text-foreground flex-1">
                {settings.businessName}
              </Text>
              <IconSymbol name="pencil" size={18} color={colors.muted} />
            </Pressable>
          )}
        </View>

        {/* Default Duration */}
        <View className="bg-surface rounded-2xl p-4 mb-4 border border-border">
          <Text className="text-xs font-medium text-muted mb-2">Default Appointment Duration</Text>
          <View className="flex-row flex-wrap gap-2">
            {[15, 30, 45, 60, 90, 120].map((d) => (
              <Pressable
                key={d}
                onPress={() => setDefaultDuration(d)}
                style={({ pressed }) => [
                  styles.durationChip,
                  {
                    backgroundColor:
                      settings.defaultDuration === d ? colors.primary : colors.background,
                    borderColor:
                      settings.defaultDuration === d ? colors.primary : colors.border,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <Text
                  className="text-sm font-medium"
                  style={{
                    color:
                      settings.defaultDuration === d ? "#FFFFFF" : colors.foreground,
                  }}
                >
                  {d} min
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Notifications */}
        <View className="bg-surface rounded-2xl p-4 mb-4 border border-border">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center">
              <IconSymbol name="bell.fill" size={20} color={colors.primary} />
              <Text className="text-base font-medium text-foreground ml-3">
                Notifications
              </Text>
            </View>
            <Switch
              value={settings.notificationsEnabled}
              onValueChange={toggleNotifications}
              trackColor={{ false: colors.border, true: colors.primary + "60" }}
              thumbColor={settings.notificationsEnabled ? colors.primary : colors.muted}
            />
          </View>
        </View>

        {/* Working Hours */}
        <View className="bg-surface rounded-2xl p-4 mb-4 border border-border">
          <Text className="text-xs font-medium text-muted mb-3">Working Hours</Text>
          {DAYS_OF_WEEK.map((day) => {
            const wh = settings.workingHours[day];
            return (
              <View key={day} className="flex-row items-center py-2.5 border-b border-border" style={day === "saturday" ? { borderBottomWidth: 0 } : {}}>
                <Switch
                  value={wh.enabled}
                  onValueChange={() => toggleDay(day)}
                  trackColor={{ false: colors.border, true: colors.primary + "60" }}
                  thumbColor={wh.enabled ? colors.primary : colors.muted}
                  style={{ transform: [{ scale: 0.8 }] }}
                />
                <Text
                  className="text-sm font-medium w-24 ml-2"
                  style={{ color: wh.enabled ? colors.foreground : colors.muted }}
                >
                  {DAY_LABELS[day]}
                </Text>
                {wh.enabled && (
                  <View className="flex-row items-center flex-1 justify-end">
                    <TextInput
                      className="bg-background rounded-lg px-2 py-1 text-xs text-center border border-border"
                      value={wh.start}
                      onChangeText={(v) => updateDayTime(day, "start", v)}
                      style={{ color: colors.foreground, width: 56 }}
                      returnKeyType="done"
                    />
                    <Text className="text-xs text-muted mx-1">to</Text>
                    <TextInput
                      className="bg-background rounded-lg px-2 py-1 text-xs text-center border border-border"
                      value={wh.end}
                      onChangeText={(v) => updateDayTime(day, "end", v)}
                      style={{ color: colors.foreground, width: 56 }}
                      returnKeyType="done"
                    />
                  </View>
                )}
              </View>
            );
          })}
        </View>

        {/* Stats */}
        <View className="bg-surface rounded-2xl p-4 mb-4 border border-border">
          <Text className="text-xs font-medium text-muted mb-2">Quick Stats</Text>
          <View className="flex-row justify-between">
            <View className="items-center flex-1">
              <Text className="text-2xl font-bold" style={{ color: colors.primary }}>
                {state.services.length}
              </Text>
              <Text className="text-xs text-muted">Services</Text>
            </View>
            <View className="items-center flex-1">
              <Text className="text-2xl font-bold" style={{ color: colors.primary }}>
                {state.clients.length}
              </Text>
              <Text className="text-xs text-muted">Clients</Text>
            </View>
            <View className="items-center flex-1">
              <Text className="text-2xl font-bold" style={{ color: colors.primary }}>
                {state.appointments.length}
              </Text>
              <Text className="text-xs text-muted">Bookings</Text>
            </View>
          </View>
        </View>

        {/* App Info */}
        <View className="items-center py-6">
          <Text className="text-base font-bold" style={{ color: colors.primary }}>
            BookEase
          </Text>
          <Text className="text-xs text-muted mt-1">Version 1.0.0</Text>
          <Text className="text-xs text-muted mt-0.5">
            Smart Scheduling for Small Business
          </Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  smallButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  editableRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  durationChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
});
