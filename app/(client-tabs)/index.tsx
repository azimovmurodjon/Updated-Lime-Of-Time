/**
 * Client Portal — Dashboard (Home Tab)
 *
 * Full redesign — matches business app visual quality:
 * FuturisticBackground, Reanimated entrance animations, spring press feedback,
 * LinearGradient cards, and haptic confirmation.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Platform,
  Image,
  Dimensions,
} from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useClientStore, ClientAppointment } from "@/lib/client-store";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { FuturisticBackground } from "@/components/futuristic-background";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSpring,
  Easing,
  runOnJS,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import * as Haptics from "expo-haptics";

const CLIENT_PURPLE = "#8B5CF6";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function statusColor(status: ClientAppointment["status"], colors: ReturnType<typeof useColors>) {
  switch (status) {
    case "confirmed": return colors.success;
    case "pending": return colors.warning;
    case "completed": return colors.muted;
    case "cancelled":
    case "no_show": return colors.error;
    default: return colors.muted;
  }
}

function statusLabel(status: ClientAppointment["status"]): string {
  switch (status) {
    case "confirmed": return "Confirmed";
    case "pending": return "Pending";
    case "completed": return "Completed";
    case "cancelled": return "Cancelled";
    case "no_show": return "No Show";
    default: return status;
  }
}

// ─── Animated Press Wrapper ───────────────────────────────────────────────────
function AnimCard({ children, onPress, style }: { children: React.ReactNode; onPress: () => void; style?: any }) {
  const scale = useSharedValue(1);
  const tap = Gesture.Tap()
    .onBegin(() => { scale.value = withSpring(0.97, { damping: 20, stiffness: 300 }); })
    .onFinalize((_, s) => {
      scale.value = withSpring(1, { damping: 18, stiffness: 200 });
      if (s) {
        if (Platform.OS !== "web") runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Light);
        runOnJS(onPress)();
      }
    });
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <GestureDetector gesture={tap}>
      <Animated.View style={[animStyle, style]}>{children}</Animated.View>
    </GestureDetector>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function ClientHomeScreen() {
  const colors = useColors();
  const router = useRouter();
  const { state, dispatch, apiCall } = useClientStore();
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const isSignedIn = !!state.account;

  const loadData = useCallback(async (silent = false) => {
    if (!isSignedIn) return;
    if (!silent) setLoading(true);
    try {
      const [appts, saved] = await Promise.all([
        apiCall<ClientAppointment[]>("/api/client/appointments"),
        apiCall<any[]>("/api/client/saved-businesses"),
      ]);
      dispatch({ type: "SET_APPOINTMENTS", payload: appts });
      dispatch({ type: "SET_SAVED_BUSINESSES", payload: saved });
      const msgs = await apiCall<{ unreadCount: number }>("/api/client/messages/unread-count");
      dispatch({ type: "SET_UNREAD_COUNT", payload: msgs.unreadCount });
    } catch (err) {
      console.warn("[ClientHome] load error:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isSignedIn, apiCall, dispatch]);

  useFocusEffect(useCallback(() => { loadData(true); }, [loadData]));

  const onRefresh = () => { setRefreshing(true); loadData(); };

  const upcoming = state.appointments
    .filter((a) => a.status === "confirmed" || a.status === "pending")
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 5);

  // Entrance animations
  const headerOpacity = useSharedValue(0);
  const headerY = useSharedValue(-20);
  const contentOpacity = useSharedValue(0);
  const contentY = useSharedValue(30);
  const screenSlideX = useSharedValue(0);

  useEffect(() => {
    headerOpacity.value = withTiming(1, { duration: 450, easing: Easing.out(Easing.cubic) });
    headerY.value = withSpring(0, { damping: 18, stiffness: 120 });
    contentOpacity.value = withDelay(200, withTiming(1, { duration: 450 }));
    contentY.value = withDelay(200, withSpring(0, { damping: 18, stiffness: 100 }));
  }, []);

  const headerStyle = useAnimatedStyle(() => ({
    opacity: headerOpacity.value,
    transform: [{ translateY: headerY.value }],
  }));
  const contentStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
    transform: [{ translateY: contentY.value }],
  }));
  const screenSlideStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: screenSlideX.value }],
  }));

  function handleBackToPortal() {
    screenSlideX.value = withTiming(SCREEN_W, { duration: 280, easing: Easing.in(Easing.cubic) }, (done) => {
      if (done) runOnJS(router.replace)("/profile-select");
    });
  }

  // ── Not signed in ──────────────────────────────────────────────────────────
  if (!isSignedIn) {
    return (
      <ScreenContainer>
        <FuturisticBackground />
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center", paddingHorizontal: 24 }}>
          <GuestBanner colors={colors} router={router} />
        </ScrollView>
      </ScreenContainer>
    );
  }

  // ── Signed in ──────────────────────────────────────────────────────────────────
  return (
    <Animated.View style={[{ flex: 1 }, screenSlideStyle]}>
    <ScreenContainer>
      <FuturisticBackground />
      <ScrollView
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={CLIENT_PURPLE} />}
      >
        {/* Header */}
        <Animated.View style={[styles.header, headerStyle]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.greeting, { color: colors.foreground }]}>
              Hello, {state.account?.name?.split(" ")[0] ?? "there"} 👋
            </Text>
            <Text style={[styles.greetingSub, { color: colors.muted }]}>What are you booking today?</Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <AnimCard onPress={handleBackToPortal}>
              <View style={[styles.avatarBtn, { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }]}>
                <IconSymbol name="chevron.left" size={16} color={colors.muted} />
              </View>
            </AnimCard>
            <AnimCard onPress={() => router.push("/(client-tabs)/profile" as any)}>
              <View style={[styles.avatarBtn, { backgroundColor: CLIENT_PURPLE + "20" }]}>
                <IconSymbol name="person.crop.circle.fill" size={32} color={CLIENT_PURPLE} />
              </View>
            </AnimCard>
          </View>
        </Animated.View>

        <Animated.View style={contentStyle}>
          {/* Quick Actions */}
          <View style={styles.quickActions}>
            <AnimCard
              onPress={() => router.push("/(client-tabs)/discover" as any)}
              style={{ flex: 1 }}
            >
              <LinearGradient
                colors={[CLIENT_PURPLE, "#7C3AED"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.quickBtnGrad}
              >
                <IconSymbol name="safari.fill" size={20} color="#FFFFFF" />
                <Text style={[styles.quickBtnText, { color: "#FFFFFF" }]}>Discover</Text>
              </LinearGradient>
            </AnimCard>
            <AnimCard
              onPress={() => router.push("/(client-tabs)/bookings" as any)}
              style={{ flex: 1 }}
            >
              <View style={[styles.quickBtnOutline, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <IconSymbol name="calendar" size={20} color={colors.foreground} />
                <Text style={[styles.quickBtnText, { color: colors.foreground }]}>My Bookings</Text>
              </View>
            </AnimCard>
          </View>

          {/* Upcoming Appointments */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Upcoming</Text>
              {state.appointments.length > 0 && (
                <AnimCard onPress={() => router.push("/(client-tabs)/bookings" as any)}>
                  <Text style={[styles.seeAll, { color: CLIENT_PURPLE }]}>See all</Text>
                </AnimCard>
              )}
            </View>

            {loading ? (
              <ActivityIndicator color={CLIENT_PURPLE} style={{ marginTop: 24 }} />
            ) : upcoming.length === 0 ? (
              <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <IconSymbol name="calendar" size={28} color={colors.muted} />
                <Text style={[styles.emptyText, { color: colors.muted }]}>No upcoming appointments</Text>
                <AnimCard onPress={() => router.push("/(client-tabs)/discover" as any)}>
                  <View style={[styles.emptyBtn, { borderColor: CLIENT_PURPLE }]}>
                    <Text style={{ color: CLIENT_PURPLE, fontWeight: "600", fontSize: 14 }}>Book Now</Text>
                  </View>
                </AnimCard>
              </View>
            ) : (
              upcoming.map((appt, idx) => (
                <AnimCard
                  key={appt.id}
                  onPress={() => router.push({ pathname: "/client-appointment-detail", params: { id: String(appt.id) } } as any)}
                  style={{ marginBottom: 10 }}
                >
                  <View style={[styles.apptCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    {/* Left accent bar */}
                    <View style={[styles.apptAccent, { backgroundColor: statusColor(appt.status, colors) }]} />
                    <View style={styles.apptLeft}>
                      <Text style={[styles.apptService, { color: colors.foreground }]}>{appt.serviceName}</Text>
                      <Text style={[styles.apptBusiness, { color: colors.muted }]}>{appt.businessName}</Text>
                      <Text style={[styles.apptDate, { color: colors.muted }]}>
                        {formatDate(appt.date)} · {appt.time}
                        {appt.staffName ? ` · ${appt.staffName}` : ""}
                      </Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: statusColor(appt.status, colors) + "20" }]}>
                      <Text style={[styles.statusText, { color: statusColor(appt.status, colors) }]}>
                        {statusLabel(appt.status)}
                      </Text>
                    </View>
                  </View>
                </AnimCard>
              ))
            )}
          </View>

          {/* Saved Businesses */}
          {state.savedBusinesses.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Saved</Text>
                <AnimCard onPress={() => router.push("/client-saved-businesses" as any)}>
                  <Text style={[styles.seeAll, { color: CLIENT_PURPLE }]}>See all</Text>
                </AnimCard>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingHorizontal: 2 }}>
                {state.savedBusinesses.slice(0, 6).map((biz) => (
                  <AnimCard
                    key={biz.id}
                    onPress={() => router.push({ pathname: "/client-business-detail", params: { slug: biz.businessSlug } } as any)}
                  >
                    <View style={[styles.savedCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                      <View style={[styles.savedIcon, { backgroundColor: CLIENT_PURPLE + "20" }]}>
                        <IconSymbol name="scissors" size={20} color={CLIENT_PURPLE} />
                      </View>
                      <Text style={[styles.savedName, { color: colors.foreground }]} numberOfLines={2}>{biz.businessName}</Text>
                      {biz.businessCategory && (
                        <Text style={[styles.savedCat, { color: colors.muted }]} numberOfLines={1}>{biz.businessCategory}</Text>
                      )}
                    </View>
                  </AnimCard>
                ))}
              </ScrollView>
            </View>
          )}
        </Animated.View>
      </ScrollView>
    </ScreenContainer>
    </Animated.View>
  );
}

// ─── Guest Banner ─────────────────────────────────────────────────────────────
const { width: SCREEN_W } = Dimensions.get("window");

function GuestBanner({ colors, router }: { colors: ReturnType<typeof useColors>; router: any }) {
  const logoScale = useSharedValue(0.5);
  const logoOpacity = useSharedValue(0);
  const textOpacity = useSharedValue(0);
  const textY = useSharedValue(20);
  const btnsOpacity = useSharedValue(0);
  const btnsY = useSharedValue(20);
  const slideX = useSharedValue(0);

  useEffect(() => {
    logoOpacity.value = withTiming(1, { duration: 600, easing: Easing.out(Easing.cubic) });
    logoScale.value = withSpring(1, { damping: 14, stiffness: 120 });
    textOpacity.value = withDelay(250, withTiming(1, { duration: 450 }));
    textY.value = withDelay(250, withSpring(0, { damping: 18, stiffness: 100 }));
    btnsOpacity.value = withDelay(450, withTiming(1, { duration: 400 }));
    btnsY.value = withDelay(450, withSpring(0, { damping: 18, stiffness: 100 }));
  }, []);

  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));
  const textStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
    transform: [{ translateY: textY.value }],
  }));
  const btnsStyle = useAnimatedStyle(() => ({
    opacity: btnsOpacity.value,
    transform: [{ translateY: btnsY.value }],
  }));
  const slideStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: slideX.value }],
  }));

  function navigateBack() {
    slideX.value = withTiming(SCREEN_W, { duration: 280, easing: Easing.in(Easing.cubic) }, (done) => {
      if (done) runOnJS(router.replace)("/profile-select");
    });
  }

  return (
    <Animated.View style={[styles.guestContainer, slideStyle]}>
      <Animated.View style={[styles.guestLogoWrap, logoStyle]}>
        <View style={styles.guestLogoCircle}>
          <Image
            source={require("@/assets/images/icon.png")}
            style={{ width: 72, height: 72, borderRadius: 20 }}
            resizeMode="contain"
          />
        </View>
        <View style={[styles.guestLogoRing, { borderColor: "rgba(74,124,89,0.4)" }]} />
      </Animated.View>

      <Animated.View style={[{ alignItems: "center", gap: 6 }, textStyle]}>
        <Text style={[styles.guestLabel, { color: "#4A7C59", fontSize: 13, fontWeight: "700", letterSpacing: 2 }]}>LIME OF TIME</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 2 }}>
          <View style={{ height: 1, width: 28, backgroundColor: "rgba(74,124,89,0.4)" }} />
          <Text style={{ color: "rgba(74,124,89,0.7)", fontSize: 10, fontWeight: "500", letterSpacing: 1.5 }}>BY INNOVANCIO</Text>
          <View style={{ height: 1, width: 28, backgroundColor: "rgba(74,124,89,0.4)" }} />
        </View>
        <Text style={[styles.guestTitle, { color: colors.foreground }]}>Book Appointments{"\n"}Near You</Text>
        <Text style={[styles.guestSubtitle, { color: colors.muted }]}>
          Discover local services, book instantly, and manage all your appointments in one place.
        </Text>
      </Animated.View>

      <Animated.View style={[{ width: "100%", gap: 12, marginTop: 8 }, btnsStyle]}>
        <AnimCard onPress={() => router.push("/client-signin" as any)}>
          <LinearGradient
            colors={[CLIENT_PURPLE, "#7C3AED"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.guestPrimaryBtn}
          >
            <Text style={styles.guestPrimaryBtnText}>Get Started</Text>
          </LinearGradient>
        </AnimCard>
        <AnimCard onPress={() => router.push("/(client-tabs)/discover" as any)}>
          <View style={[styles.guestSecondaryBtn, { borderColor: CLIENT_PURPLE + "60" }]}>
            <Text style={[styles.guestSecondaryBtnText, { color: CLIENT_PURPLE }]}>Browse Without Account</Text>
          </View>
        </AnimCard>
        <AnimCard onPress={navigateBack}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 12 }}>
            <IconSymbol name="chevron.left" size={14} color={colors.muted} />
            <Text style={{ color: colors.muted, fontSize: 14, fontWeight: "500" }}>Back to Portal Selection</Text>
          </View>
        </AnimCard>
      </Animated.View>
    </Animated.View>
  );
}

// ─── Styles─────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  greeting: {
    fontSize: 22,
    fontWeight: "700",
  },
  greetingSub: {
    fontSize: 14,
    marginTop: 2,
  },
  avatarBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  quickActions: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 20,
    marginTop: 12,
    marginBottom: 8,
  },
  quickBtnGrad: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 16,
  },
  quickBtnOutline: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  quickBtnText: {
    fontSize: 15,
    fontWeight: "600",
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 20,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  seeAll: {
    fontSize: 14,
    fontWeight: "600",
  },
  apptCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  apptAccent: {
    width: 4,
    alignSelf: "stretch",
    borderRadius: 2,
    marginRight: 12,
  },
  apptLeft: {
    flex: 1,
    gap: 3,
  },
  apptService: {
    fontSize: 15,
    fontWeight: "600",
  },
  apptBusiness: {
    fontSize: 13,
  },
  apptDate: {
    fontSize: 12,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    marginLeft: 10,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "700",
  },
  emptyCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 28,
    alignItems: "center",
    gap: 10,
  },
  emptyText: {
    fontSize: 14,
  },
  emptyBtn: {
    borderWidth: 1.5,
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 8,
    marginTop: 4,
  },
  savedCard: {
    width: 130,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  savedIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  savedName: {
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
  },
  savedCat: {
    fontSize: 11,
  },
  // Guest styles
  guestContainer: {
    alignItems: "center",
    paddingVertical: 40,
    gap: 20,
  },
  guestLogoWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  guestLogoCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  guestLogoRing: {
    position: "absolute",
    width: 116,
    height: 116,
    borderRadius: 58,
    borderWidth: 1.5,
  },
  guestLabel: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  guestTitle: {
    fontSize: 28,
    fontWeight: "800",
    textAlign: "center",
    letterSpacing: -0.3,
    lineHeight: 36,
  },
  guestSubtitle: {
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
    maxWidth: 300,
  },
  guestPrimaryBtn: {
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
  },
  guestPrimaryBtnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  guestSecondaryBtn: {
    paddingVertical: 15,
    borderRadius: 16,
    alignItems: "center",
    borderWidth: 1.5,
  },
  guestSecondaryBtnText: {
    fontSize: 15,
    fontWeight: "600",
  },
});
