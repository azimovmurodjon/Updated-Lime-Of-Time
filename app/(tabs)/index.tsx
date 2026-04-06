import { useMemo, useEffect, useCallback } from "react";
import {
  Text,
  View,
  Pressable,
  StyleSheet,
  Share,
  useWindowDimensions,
  ScrollView,
  Image,
  Alert,
  Platform,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useStore, formatTime, formatDateStr } from "@/lib/store";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useRouter } from "expo-router";
import { minutesToTime, timeToMinutes, PUBLIC_BOOKING_URL } from "@/lib/types";
import * as ImagePicker from "expo-image-picker";

export default function HomeScreen() {
  const { state, dispatch, getServiceById, getClientById, getAppointmentsForDate, syncToDb } = useStore();
  const colors = useColors();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const hp = Math.round(Math.max(16, width * 0.045));
  const cardW = Math.round((width - hp * 2 - 12) / 2);

  // Redirect to onboarding if not completed
  useEffect(() => {
    if (state.loaded && !state.settings.onboardingComplete) {
      router.replace("/onboarding");
    }
  }, [state.loaded, state.settings.onboardingComplete]);

  const now = new Date();
  const todayStr = formatDateStr(now);
  const greeting =
    now.getHours() < 12 ? "Good Morning" : now.getHours() < 17 ? "Good Afternoon" : "Good Evening";
  const dateLabel = now.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const todayAppts = getAppointmentsForDate(todayStr);

  const analytics = useMemo(() => {
    const totalClients = state.clients.length;
    const totalAppointments = state.appointments.filter((a) => a.status !== "cancelled").length;
    const totalRevenue = state.appointments
      .filter((a) => a.status === "completed")
      .reduce((sum, a) => {
        const svc = state.services.find((s) => s.id === a.serviceId);
        return sum + (svc?.price ?? 0);
      }, 0);

    const svcCounts: Record<string, number> = {};
    state.appointments
      .filter((a) => a.status !== "cancelled")
      .forEach((a) => {
        svcCounts[a.serviceId] = (svcCounts[a.serviceId] || 0) + 1;
      });
    let topServiceId = "";
    let topCount = 0;
    Object.entries(svcCounts).forEach(([id, count]) => {
      if (count > topCount) {
        topServiceId = id;
        topCount = count;
      }
    });
    const topService = state.services.find((s) => s.id === topServiceId);

    return { totalClients, totalAppointments, totalRevenue, topService, topCount };
  }, [state.clients, state.appointments, state.services]);

  const pendingCount = state.appointments.filter((a) => a.status === "pending").length;

  const handleShareBookingLink = useCallback(async () => {
    const slug = state.settings.businessName.replace(/\s+/g, "-").toLowerCase();
    const url = `${PUBLIC_BOOKING_URL}/book/${slug}`;
    const profile = state.settings.profile;
    const addressLine = profile.address ? `\n📍 ${profile.address}` : "";
    const phoneLine = profile.phone ? `\n📞 ${profile.phone}` : "";
    const websiteLine = profile.website ? `\n🌐 ${profile.website}` : "";
    try {
      await Share.share({
        message: `Book an appointment with ${state.settings.businessName}!${addressLine}${phoneLine}${websiteLine}\n\nSchedule online: ${url}\n\nPowered by Lime Of Time`,
        title: "Book an Appointment",
      });
    } catch {}
  }, [state.settings.businessName, state.settings.profile]);

  const handlePickLogo = useCallback(async () => {
    if (Platform.OS === "web") {
      Alert.alert("Not Available", "Image upload is available on mobile devices.");
      return;
    }
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0]) {
        const action = { type: "UPDATE_SETTINGS" as const, payload: { businessLogoUri: result.assets[0].uri } };
        dispatch(action);
        syncToDb(action);
      }
    } catch {
      Alert.alert("Error", "Failed to pick image. Please try again.");
    }
  }, [dispatch]);

  const slides = [
    {
      id: "clients",
      title: "Total Clients",
      value: analytics.totalClients.toString(),
      icon: "person.2.fill" as const,
      color: "#4CAF50",
      bg: "#E8F5E9",
    },
    {
      id: "appointments",
      title: "Appointments",
      value: analytics.totalAppointments.toString(),
      icon: "calendar" as const,
      color: "#2196F3",
      bg: "#E3F2FD",
    },
    {
      id: "revenue",
      title: "Revenue",
      value: `$${analytics.totalRevenue.toLocaleString()}`,
      icon: "dollarsign.circle.fill" as const,
      color: "#FF9800",
      bg: "#FFF3E0",
    },
    {
      id: "topservice",
      title: "Top Service",
      value: analytics.topService?.name ?? "N/A",
      icon: "crown.fill" as const,
      color: "#9C27B0",
      bg: "#F3E5F5",
      sub: analytics.topCount > 0 ? `${analytics.topCount} bookings` : "",
    },
  ];

  const handleSlidePress = (id: string) => {
    router.push({ pathname: "/analytics-detail", params: { tab: id } });
  };

  const getEndTime = (time: string, duration: number) => {
    return formatTime(minutesToTime(timeToMinutes(time) + duration));
  };

  const logoSource = state.settings.businessLogoUri
    ? { uri: state.settings.businessLogoUri }
    : require("@/assets/images/icon.png");

  return (
    <ScreenContainer>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: hp, paddingTop: 8, paddingBottom: 100 }}
      >
        {/* Business Header */}
        <View style={styles.businessHeader}>
          <Pressable onPress={handlePickLogo} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}>
            <Image source={logoSource} style={styles.businessLogo} resizeMode="cover" />
            <View style={[styles.cameraOverlay, { backgroundColor: colors.primary }]}>
              <IconSymbol name="camera.fill" size={10} color="#FFF" />
            </View>
          </Pressable>
          <View style={{ flex: 1, marginLeft: 14 }}>
            <Text style={{ fontSize: 20, fontWeight: "700", color: colors.foreground }} numberOfLines={1}>
              {state.settings.businessName}
            </Text>
            <Text style={{ fontSize: 13, color: colors.muted, marginTop: 2 }}>{greeting}</Text>
          </View>
          {state.settings.temporaryClosed && (
            <View style={[styles.closedBadge, { backgroundColor: colors.error + "15" }]}>
              <Text style={{ fontSize: 10, fontWeight: "700", color: colors.error }}>CLOSED</Text>
            </View>
          )}
        </View>

        <Text style={[styles.dateLabel, { color: colors.muted }]}>{dateLabel}</Text>

        {/* Pending badge */}
        {pendingCount > 0 && (
          <Pressable
            onPress={() => router.push({ pathname: "/(tabs)/calendar", params: { filter: "requests" } })}
            style={({ pressed }) => [styles.pendingBanner, { backgroundColor: "#FFF3E0", borderColor: "#FF9800", opacity: pressed ? 0.8 : 1 }]}
          >
            <IconSymbol name="questionmark.circle.fill" size={20} color="#FF9800" />
            <Text style={{ color: "#E65100", fontSize: 14, fontWeight: "600", marginLeft: 8, flex: 1 }}>
              {pendingCount} appointment request{pendingCount > 1 ? "s" : ""} pending
            </Text>
            <IconSymbol name="chevron.right" size={16} color="#FF9800" />
          </Pressable>
        )}

        {/* Temporary Closed Banner */}
        {state.settings.temporaryClosed && (
          <View style={[styles.closedBanner, { backgroundColor: colors.error + "10", borderColor: colors.error + "30" }]}>
            <IconSymbol name="exclamationmark.triangle.fill" size={18} color={colors.error} />
            <Text style={{ fontSize: 13, color: colors.error, fontWeight: "500", marginLeft: 8 }}>
              Business is temporarily closed. New bookings are paused.
            </Text>
          </View>
        )}

        {/* Analytics Slides */}
        <Text style={[styles.sectionTitle, { color: colors.foreground, marginTop: 20 }]}>Dashboard</Text>
        <View style={styles.slidesGrid}>
          {slides.map((slide) => (
            <Pressable
              key={slide.id}
              onPress={() => handleSlidePress(slide.id)}
              style={({ pressed }) => [
                styles.slideCard,
                {
                  width: cardW,
                  backgroundColor: slide.bg,
                  borderColor: slide.color + "30",
                  opacity: pressed ? 0.85 : 1,
                  transform: [{ scale: pressed ? 0.97 : 1 }],
                },
              ]}
            >
              <View style={[styles.slideIconBg, { backgroundColor: slide.color + "20" }]}>
                <IconSymbol name={slide.icon} size={22} color={slide.color} />
              </View>
              <Text style={[styles.slideValue, { color: slide.color }]}>{slide.value}</Text>
              <Text style={[styles.slideTitle, { color: slide.color + "CC" }]}>{slide.title}</Text>
              {slide.sub ? (
                <Text style={{ fontSize: 11, color: slide.color + "99", marginTop: 2 }}>{slide.sub}</Text>
              ) : null}
            </Pressable>
          ))}
        </View>

        {/* Share Booking Link */}
        <Pressable
          onPress={handleShareBookingLink}
          style={({ pressed }) => [styles.bookingLinkBtn, { borderColor: colors.primary, opacity: pressed ? 0.8 : 1 }]}
        >
          <IconSymbol name="paperplane.fill" size={18} color={colors.primary} />
          <Text style={[styles.bookingLinkText, { color: colors.primary }]}>Send Booking Link to Client</Text>
        </Pressable>

        {/* Today's Schedule */}
        <Text style={[styles.sectionTitle, { color: colors.foreground, marginTop: 24 }]}>Today's Schedule</Text>
        {todayAppts.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <IconSymbol name="calendar" size={36} color={colors.muted + "60"} />
            <Text style={{ color: colors.muted, fontSize: 14, marginTop: 8 }}>No appointments today</Text>
            <Pressable
              onPress={() => router.push("/new-booking")}
              style={({ pressed }) => [styles.bookBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}
            >
              <Text style={styles.bookBtnText}>Book an Appointment</Text>
            </Pressable>
          </View>
        ) : (
          todayAppts.map((appt) => {
            const svc = getServiceById(appt.serviceId);
            const client = getClientById(appt.clientId);
            const statusColor =
              appt.status === "confirmed"
                ? colors.success
                : appt.status === "pending"
                ? "#FF9800"
                : appt.status === "completed"
                ? colors.primary
                : colors.error;
            return (
              <Pressable
                key={appt.id}
                onPress={() => router.push({ pathname: "/appointment-detail", params: { id: appt.id } })}
                style={({ pressed }) => [
                  styles.apptCard,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    borderLeftColor: svc?.color ?? colors.primary,
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
              >
                <View style={styles.apptRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.apptTime, { color: colors.foreground }]}>
                      {formatTime(appt.time)} - {getEndTime(appt.time, appt.duration)}
                    </Text>
                    <Text style={[styles.apptService, { color: colors.foreground }]}>{svc?.name ?? "Service"}</Text>
                    <Text style={{ fontSize: 13, color: colors.muted }}>{client?.name ?? "Client"}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: statusColor + "18" }]}>
                    <Text style={{ fontSize: 11, fontWeight: "600", color: statusColor, textTransform: "capitalize" }}>
                      {appt.status}
                    </Text>
                  </View>
                </View>
              </Pressable>
            );
          })
        )}
      </ScrollView>
      <Pressable
        onPress={() => router.push("/new-booking")}
        style={({ pressed }) => [styles.fab, { backgroundColor: colors.primary, right: hp, opacity: pressed ? 0.85 : 1 }]}
      >
        <IconSymbol name="plus" size={28} color="#FFF" />
      </Pressable>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  businessHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
    paddingTop: 4,
  },
  businessLogo: {
    width: 52,
    height: 52,
    borderRadius: 14,
  },
  cameraOverlay: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  closedBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  dateLabel: {
    fontSize: 14,
    marginTop: 2,
    marginBottom: 4,
  },
  pendingBanner: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 14,
  },
  closedBanner: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 12,
  },
  slidesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  slideCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
  },
  slideIconBg: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  slideValue: {
    fontSize: 22,
    fontWeight: "800",
    lineHeight: 28,
  },
  slideTitle: {
    fontSize: 12,
    fontWeight: "500",
    marginTop: 2,
  },
  bookingLinkBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    marginTop: 20,
  },
  bookingLinkText: {
    fontSize: 15,
    fontWeight: "600",
    marginLeft: 8,
  },
  emptyCard: {
    alignItems: "center",
    paddingVertical: 32,
    borderRadius: 16,
    borderWidth: 1,
  },
  bookBtn: {
    marginTop: 14,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  bookBtnText: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "600",
  },
  apptCard: {
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderLeftWidth: 4,
  },
  apptRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  apptTime: {
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 20,
  },
  apptService: {
    fontSize: 14,
    fontWeight: "500",
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  fab: {
    position: "absolute",
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
});
