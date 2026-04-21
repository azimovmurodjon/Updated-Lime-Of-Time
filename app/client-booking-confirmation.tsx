/**
 * Client Portal — Booking Confirmation Screen
 *
 * Shown after a successful booking. Displays appointment summary
 * (service, staff, date, time, business) and an "Add to Calendar" button.
 */
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { FuturisticBackground } from "@/components/futuristic-background";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  Easing,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import * as Calendar from "expo-calendar";

const LIME_GREEN = "#4A7C59";

export default function ClientBookingConfirmationScreen() {
  const colors = useColors();
  const router = useRouter();
  const {
    serviceName,
    staffName,
    date,
    time,
    duration,
    businessName,
    businessSlug,
    price,
    locationName,
    locationAddress,
  } = useLocalSearchParams<{
    serviceName: string;
    staffName?: string;
    date: string;
    time: string;
    duration: string;
    businessName: string;
    businessSlug: string;
    price?: string;
    locationName?: string;
    locationAddress?: string;
  }>();

  // Entrance animation
  const scale = useSharedValue(0.85);
  const opacity = useSharedValue(0);
  useEffect(() => {
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    scale.value = withSpring(1, { damping: 16, stiffness: 140 });
    opacity.value = withTiming(1, { duration: 350, easing: Easing.out(Easing.cubic) });
  }, []);
  const cardStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  function formatDateDisplay(dateStr: string): string {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  }

  function formatTime12(t: string): string {
    if (!t) return t;
    const [h, m] = t.split(":").map(Number);
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 || 12;
    return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
  }

  const [calendarAdded, setCalendarAdded] = useState(false);
  const [calendarLoading, setCalendarLoading] = useState(false);

  const handleAddToCalendar = async () => {
    const startDate = new Date(`${date}T${time}:00`);
    const durationMins = parseInt(duration ?? "60", 10);
    const endDate = new Date(startDate.getTime() + durationMins * 60000);

    if (Platform.OS === "web") {
      // Web: download .ics file
      const pad = (n: number) => String(n).padStart(2, "0");
      const toICS = (d: Date) =>
        `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
      const icsContent = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "BEGIN:VEVENT",
        `SUMMARY:${serviceName} at ${businessName}`,
        `DTSTART:${toICS(startDate)}`,
        `DTEND:${toICS(endDate)}`,
        `DESCRIPTION:${staffName ? `Staff: ${staffName}\\n` : ""}${locationAddress ? `Location: ${locationAddress}` : ""}`,
        locationAddress ? `LOCATION:${locationAddress}` : "",
        "END:VEVENT",
        "END:VCALENDAR",
      ].filter(Boolean).join("\r\n");
      const blob = new Blob([icsContent], { type: "text/calendar" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "appointment.ics";
      a.click();
      URL.revokeObjectURL(url);
      setCalendarAdded(true);
      return;
    }

    // Native: use expo-calendar
    try {
      setCalendarLoading(true);
      const { status } = await Calendar.requestCalendarPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Denied", "Please allow calendar access in Settings to add this appointment.");
        return;
      }

      // Find a writable calendar
      let calendarId: string | undefined;
      if (Platform.OS === "ios") {
        const defaultCal = await Calendar.getDefaultCalendarAsync();
        calendarId = defaultCal?.id;
      }
      if (!calendarId) {
        const cals = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
        const writable = cals.filter(c => c.allowsModifications);
        calendarId = writable[0]?.id;
      }
      if (!calendarId) {
        Alert.alert("No Calendar", "No writable calendar found on this device.");
        return;
      }

      const description = [
        staffName ? `Staff: ${staffName}` : null,
        locationAddress ? `Location: ${locationAddress}` : null,
        `Booked via Lime Of Time`,
      ].filter(Boolean).join("\n");

      await Calendar.createEventAsync(calendarId, {
        title: `${serviceName} at ${businessName}`,
        startDate,
        endDate,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        location: locationAddress ?? businessName ?? "",
        alarms: [{ relativeOffset: -60 }],
      } as Calendar.Event);

      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setCalendarAdded(true);
      Alert.alert("Added!", "Your appointment has been added to your calendar.");
    } catch (err) {
      Alert.alert("Error", "Could not add to calendar. Please try again.");
    } finally {
      setCalendarLoading(false);
    }
  };

  const s = styles(colors);

  return (
    <ScreenContainer>
      <FuturisticBackground />
      <View style={s.container}>
        {/* Success icon */}
        <Animated.View style={[s.successCircle, cardStyle]}>
          <View style={[s.successInner, { backgroundColor: LIME_GREEN }]}>
            <IconSymbol name="checkmark" size={36} color="#FFFFFF" />
          </View>
        </Animated.View>

        <Animated.View style={[{ width: "100%" }, cardStyle]}>
          <Text style={[s.headline, { color: colors.foreground }]}>Booking Confirmed!</Text>
          <Text style={[s.subline, { color: colors.muted }]}>
            Your appointment has been submitted. The business will confirm shortly.
          </Text>

          {/* Summary card */}
          <View style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <SummaryRow
              icon="scissors"
              label="Service"
              value={serviceName ?? "—"}
              colors={colors}
            />
            {staffName ? (
              <SummaryRow
                icon="person.fill"
                label="Staff"
                value={staffName}
                colors={colors}
              />
            ) : null}
            <SummaryRow
              icon="calendar"
              label="Date"
              value={formatDateDisplay(date ?? "")}
              colors={colors}
            />
            <SummaryRow
              icon="clock"
              label="Time"
              value={formatTime12(time ?? "")}
              colors={colors}
            />
            <SummaryRow
              icon="building.2"
              label="Business"
              value={businessName ?? "—"}
              colors={colors}
              last
            />
            {locationAddress ? (
              <SummaryRow
                icon="location"
                label="Location"
                value={locationAddress}
                colors={colors}
                last
              />
            ) : null}
          </View>

          {/* Add to Calendar */}
          <Pressable
            style={({ pressed }) => [
              s.calBtn,
              calendarAdded && { backgroundColor: "rgba(74,124,89,0.08)", borderColor: LIME_GREEN },
              pressed && { opacity: 0.8 },
            ]}
            onPress={handleAddToCalendar}
            disabled={calendarLoading || calendarAdded}
          >
            {calendarLoading ? (
              <ActivityIndicator size="small" color={LIME_GREEN} />
            ) : calendarAdded ? (
              <IconSymbol name="checkmark" size={18} color={LIME_GREEN} />
            ) : (
              <IconSymbol name="calendar" size={18} color={LIME_GREEN} />
            )}
            <Text style={[s.calBtnText, { color: LIME_GREEN }]}>
              {calendarAdded ? "Added to Calendar" : "Add to Calendar"}
            </Text>
          </Pressable>

          {/* View Bookings */}
          <Pressable
            style={({ pressed }) => [s.primaryBtn, { backgroundColor: LIME_GREEN }, pressed && { opacity: 0.85 }]}
            onPress={() => {
              if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.replace("/(client-tabs)/bookings" as any);
            }}
          >
            <Text style={s.primaryBtnText}>View My Bookings</Text>
          </Pressable>

          {/* Back to Business */}
          {businessSlug ? (
            <Pressable
              style={({ pressed }) => [s.ghostBtn, pressed && { opacity: 0.7 }]}
              onPress={() => {
                if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.replace({ pathname: "/client-business-detail", params: { slug: businessSlug } } as any);
              }}
            >
              <Text style={[s.ghostBtnText, { color: colors.muted }]}>Back to Business</Text>
            </Pressable>
          ) : null}
        </Animated.View>
      </View>
    </ScreenContainer>
  );
}

function SummaryRow({
  icon,
  label,
  value,
  colors,
  last,
}: {
  icon: string;
  label: string;
  value: string;
  colors: ReturnType<typeof useColors>;
  last?: boolean;
}) {
  return (
    <View
      style={[
        rowStyles.row,
        !last && { borderBottomWidth: 1, borderBottomColor: colors.border },
      ]}
    >
      <View style={rowStyles.iconWrap}>
        <IconSymbol name={icon as any} size={15} color={LIME_GREEN} />
      </View>
      <View style={rowStyles.textWrap}>
        <Text style={[rowStyles.label, { color: colors.muted }]}>{label}</Text>
        <Text style={[rowStyles.value, { color: colors.foreground }]}>{value}</Text>
      </View>
    </View>
  );
}

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    gap: 12,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "rgba(74,124,89,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  textWrap: {
    flex: 1,
  },
  label: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 1,
  },
  value: {
    fontSize: 14,
    fontWeight: "600",
  },
});

const styles = (colors: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 24,
      gap: 16,
    },
    successCircle: {
      width: 96,
      height: 96,
      borderRadius: 48,
      backgroundColor: "rgba(74,124,89,0.15)",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 8,
    },
    successInner: {
      width: 72,
      height: 72,
      borderRadius: 36,
      alignItems: "center",
      justifyContent: "center",
    },
    headline: {
      fontSize: 26,
      fontWeight: "800",
      textAlign: "center",
      marginBottom: 6,
    },
    subline: {
      fontSize: 14,
      textAlign: "center",
      lineHeight: 20,
      marginBottom: 20,
      paddingHorizontal: 8,
    },
    card: {
      borderRadius: 18,
      borderWidth: 1,
      paddingHorizontal: 16,
      marginBottom: 16,
    },
    calBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: 14,
      borderRadius: 14,
      borderWidth: 1.5,
      borderColor: LIME_GREEN,
      marginBottom: 12,
    },
    calBtnText: {
      fontSize: 15,
      fontWeight: "700",
    },
    primaryBtn: {
      paddingVertical: 16,
      borderRadius: 14,
      alignItems: "center",
      marginBottom: 10,
    },
    primaryBtnText: {
      color: "#FFFFFF",
      fontSize: 16,
      fontWeight: "700",
    },
    ghostBtn: {
      paddingVertical: 10,
      alignItems: "center",
    },
    ghostBtnText: {
      fontSize: 14,
      fontWeight: "600",
    },
  });
