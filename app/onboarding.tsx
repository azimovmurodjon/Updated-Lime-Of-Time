import {
  Text,
  View,
  Pressable,
  StyleSheet,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Image,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useStore } from "@/lib/store";
import { useColors } from "@/hooks/use-colors";
import { useResponsive } from "@/hooks/use-responsive";
import { useState, useCallback, useEffect, useRef } from "react";
import {
  formatPhoneNumber,
  stripPhoneFormat,
  DEFAULT_WORKING_HOURS,
  DEFAULT_CANCELLATION_POLICY,
} from "@/lib/types";
import {
  generateId,
  dbServiceToLocal,
  dbClientToLocal,
  dbAppointmentToLocal,
  dbReviewToLocal,
  dbDiscountToLocal,
  dbGiftCardToLocal,
  dbLocationToLocal,
  dbProductToLocal,
  dbStaffToLocal,
  dbCustomScheduleToLocal,
  dbOwnerToSettings,
} from "@/lib/store";
import { trpc } from "@/lib/trpc";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAppLockContext } from "@/lib/app-lock-provider";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSpring,
  withRepeat,
  withSequence,
  Easing,
  interpolate,
  runOnJS,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { CountryCodePicker, DEFAULT_COUNTRY, type Country } from "@/components/country-code-picker";
import { startOAuthLogin } from "@/constants/oauth";
import { GoogleLogo, MicrosoftLogo, AppleLogo } from "@/components/brand-icons";

type Step = 1 | "otp" | 2 | 3 | "socialPhone";

// ─── Floating Particle ─────────────────────────────────────────────
function FloatingParticle({
  x,
  y,
  size,
  delay,
  duration,
  opacity: baseOpacity,
}: {
  x: number;
  y: number;
  size: number;
  delay: number;
  duration: number;
  opacity: number;
}) {
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(baseOpacity, { duration: 800 }));
    translateY.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(-18, { duration, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        false,
      ),
    );
  }, []);

  const style = useAnimatedStyle(() => ({
    position: "absolute",
    left: x,
    top: y,
    width: size,
    height: size,
    borderRadius: size / 2,
    backgroundColor: "rgba(255,255,255,0.6)",
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return <Animated.View style={style} />;
}

// ─── Clock Icon SVG-like (drawn with Views) ─────────────────────────
function ClockIcon({ size, color }: { size: number; color: string }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: 3,
        borderColor: color,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* Hour hand */}
      <View
        style={{
          position: "absolute",
          width: 2,
          height: size * 0.25,
          backgroundColor: color,
          bottom: "50%",
          left: "50%",
          marginLeft: -1,
          borderRadius: 1,
          transformOrigin: "bottom",
          transform: [{ rotate: "-30deg" }],
        }}
      />
      {/* Minute hand */}
      <View
        style={{
          position: "absolute",
          width: 2,
          height: size * 0.32,
          backgroundColor: color,
          bottom: "50%",
          left: "50%",
          marginLeft: -1,
          borderRadius: 1,
          transformOrigin: "bottom",
          transform: [{ rotate: "60deg" }],
        }}
      />
      {/* Center dot */}
      <View
        style={{
          width: 4,
          height: 4,
          borderRadius: 2,
          backgroundColor: color,
        }}
      />
    </View>
  );
}

export default function OnboardingScreen() {
  const { dispatch, syncToDb } = useStore();
  const colors = useColors();
  const router = useRouter();
  const { isTablet, hp, width, height } = useResponsive();

  const socialParams = useLocalSearchParams<{ socialLogin?: string; socialName?: string; socialEmail?: string }>();
  const isSocialFlow = socialParams.socialLogin === "1";
  const [step, setStep] = useState<Step>(isSocialFlow ? "socialPhone" : 1);
  const { biometricAvailable, biometricType, toggleBiometric } = useAppLockContext();
  const [selectedCountry, setSelectedCountry] = useState<Country>(DEFAULT_COUNTRY);
  const [phone, setPhone] = useState("");
  const [otpValue, setOtpValue] = useState("");
  const [otpError, setOtpError] = useState("");
  const [otpCountdown, setOtpCountdown] = useState(0); // seconds remaining before resend is allowed
  const [otpResendLoading, setOtpResendLoading] = useState(false);
  // Pending action after OTP: "existing" = login, "new" = go to step 2
  const [pendingOtpAction, setPendingOtpAction] = useState<"existing" | "new">("new");
  const [pendingExistingId, setPendingExistingId] = useState<number | null>(null);
  const [pendingFullData, setPendingFullData] = useState<any>(null);
  const STATIC_OTP = "123456";
  const [businessName, setBusinessName] = useState("");
  const [businessPhone, setBusinessPhone] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [onboardingErrors, setOnboardingErrors] = useState<{ businessName?: string }>({});
  const [inputFocused, setInputFocused] = useState(false);

  const trpcUtils = trpc.useUtils();
  const createBusinessMut = trpc.business.create.useMutation();

  // ─── Entrance animations ─────────────────────────────────────────
  const logoScale = useSharedValue(0.6);
  const logoOpacity = useSharedValue(0);
  const titleOpacity = useSharedValue(0);
  const titleTranslateY = useSharedValue(20);
  const subtitleOpacity = useSharedValue(0);
  const subtitleTranslateY = useSharedValue(20);
  const inputOpacity = useSharedValue(0);
  const inputTranslateY = useSharedValue(20);
  const btnScale = useSharedValue(1);
  const btnOpacity = useSharedValue(0);
  const gradientShift = useSharedValue(0);

  useEffect(() => {
    // Staggered entrance
    logoScale.value = withDelay(100, withSpring(1, { damping: 14, stiffness: 120 }));
    logoOpacity.value = withDelay(100, withTiming(1, { duration: 500 }));
    titleOpacity.value = withDelay(300, withTiming(1, { duration: 400 }));
    titleTranslateY.value = withDelay(300, withTiming(0, { duration: 400, easing: Easing.out(Easing.quad) }));
    subtitleOpacity.value = withDelay(450, withTiming(1, { duration: 400 }));
    subtitleTranslateY.value = withDelay(450, withTiming(0, { duration: 400, easing: Easing.out(Easing.quad) }));
    inputOpacity.value = withDelay(600, withTiming(1, { duration: 400 }));
    inputTranslateY.value = withDelay(600, withTiming(0, { duration: 400, easing: Easing.out(Easing.quad) }));
    btnOpacity.value = withDelay(750, withTiming(1, { duration: 400 }));
    // Slow gradient animation
    gradientShift.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 4000, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 4000, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
  }, []);

  // Re-animate on step change
  useEffect(() => {
    titleOpacity.value = 0;
    titleTranslateY.value = 16;
    subtitleOpacity.value = 0;
    subtitleTranslateY.value = 16;
    inputOpacity.value = 0;
    inputTranslateY.value = 16;
    btnOpacity.value = 0;

    titleOpacity.value = withDelay(60, withTiming(1, { duration: 300 }));
    titleTranslateY.value = withDelay(60, withTiming(0, { duration: 300, easing: Easing.out(Easing.quad) }));
    subtitleOpacity.value = withDelay(140, withTiming(1, { duration: 300 }));
    subtitleTranslateY.value = withDelay(140, withTiming(0, { duration: 300, easing: Easing.out(Easing.quad) }));
    inputOpacity.value = withDelay(220, withTiming(1, { duration: 300 }));
    inputTranslateY.value = withDelay(220, withTiming(0, { duration: 300, easing: Easing.out(Easing.quad) }));
    btnOpacity.value = withDelay(320, withTiming(1, { duration: 300 }));
  }, [step]);

  // OTP countdown timer — counts down from 60 when OTP step is shown
  useEffect(() => {
    if (step !== "otp") return;
    setOtpCountdown(60);
    const id = setInterval(() => {
      setOtpCountdown((prev) => {
        if (prev <= 1) { clearInterval(id); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [step]);

  const logoStyle = useAnimatedStyle(() => ({
    transform: [{ scale: logoScale.value }],
    opacity: logoOpacity.value,
  }));
  const titleStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
    transform: [{ translateY: titleTranslateY.value }],
  }));
  const subtitleStyle = useAnimatedStyle(() => ({
    opacity: subtitleOpacity.value,
    transform: [{ translateY: subtitleTranslateY.value }],
  }));
  const inputStyle = useAnimatedStyle(() => ({
    opacity: inputOpacity.value,
    transform: [{ translateY: inputTranslateY.value }],
  }));
  const btnStyle = useAnimatedStyle(() => ({
    opacity: btnOpacity.value,
    transform: [{ scale: btnScale.value }],
  }));

  const handlePhoneChange = (text: string) => {
    setPhone(formatPhoneNumber(text));
  };

  const handleBusinessPhoneChange = (text: string) => {
    setBusinessPhone(formatPhoneNumber(text));
  };

  const handleBtnPress = (cb: () => void) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    btnScale.value = withSequence(
      withTiming(0.96, { duration: 80 }),
      withSpring(1, { damping: 12, stiffness: 200 }),
    );
    cb();
  };

  const handlePhoneNext = async () => {
    if (!phone.trim()) return;
    setLoading(true);
    try {
      // For non-US numbers, prepend the dial code; for US (+1) keep existing 10-digit format
      const stripped = stripPhoneFormat(phone);
      const rawPhone = selectedCountry.dial === "+1" ? stripped : `${selectedCountry.dial.replace("+", "")}${stripped}`;
      const existing = await trpcUtils.business.checkByPhone.fetch({ phone: rawPhone });
      if (existing) {
        // Existing user — fetch full data, then show OTP before logging in
        const fullData = await trpcUtils.business.getFullData.fetch({ id: existing.id });
        setPendingExistingId(existing.id);
        setPendingFullData(fullData);
        setPendingOtpAction("existing");
        setOtpValue("");
        setOtpError("");
        setStep("otp");
        return;
      }
    } catch (err) {
      console.error("[Onboarding] Phone check failed:", err);
      // If the API is unreachable, show error instead of silently going to step 2
      const isNetworkError =
        err instanceof Error &&
        (err.message.includes("Network") ||
          err.message.includes("fetch") ||
          err.message.includes("connect") ||
          err.message.includes("ECONNREFUSED") ||
          err.message.includes("Failed to fetch"));
      if (isNetworkError) {
        Alert.alert(
          "Connection Error",
          "Cannot reach the server. Please check your internet connection and try again.",
          [{ text: "OK" }]
        );
        return;
      }
      // Non-network error (e.g. phone not found) — proceed to registration via OTP
    } finally {
      setLoading(false);
    }
    // New user — show OTP before registration
    setPendingOtpAction("new");
    setOtpValue("");
    setOtpError("");
    setStep("otp");
  };

  const handleSocialPhoneNext = async () => {
    if (!phone.trim()) return;
    setLoading(true);
    try {
      const stripped = stripPhoneFormat(phone);
      const rawPhone = selectedCountry.dial === "+1" ? stripped : `${selectedCountry.dial.replace("+", "")}${stripped}`;
      // Check if a business owner already exists with this phone
      const existing = await trpcUtils.business.checkByPhone.fetch({ phone: rawPhone });
      if (existing) {
        // Link social account to existing business owner and log in
        const fullData = await trpcUtils.business.getFullData.fetch({ id: existing.id });
        dispatch({ type: "SET_BUSINESS_OWNER_ID", payload: existing.id });
        await AsyncStorage.setItem("@bookease_business_owner_id", String(existing.id));
        if (fullData && fullData.owner) {
          dispatch({
            type: "LOAD_DATA",
            payload: {
              services: (fullData.services || []).map(dbServiceToLocal),
              clients: (fullData.clients || []).map(dbClientToLocal),
              appointments: (fullData.appointments || []).map(dbAppointmentToLocal),
              reviews: (fullData.reviews || []).map(dbReviewToLocal),
              discounts: (fullData.discounts || []).map(dbDiscountToLocal),
              giftCards: (fullData.giftCards || []).map(dbGiftCardToLocal),
              locations: (fullData.locations || []).map(dbLocationToLocal),
              products: (fullData.products || []).map(dbProductToLocal),
              staff: (fullData.staff || []).map(dbStaffToLocal),
              customSchedule: (fullData.customSchedule || []).map(dbCustomScheduleToLocal),
              settings: dbOwnerToSettings(fullData.owner) as any,
              businessOwnerId: existing.id,
            },
          });
        }
        if (biometricAvailable && Platform.OS !== "web") {
          setStep(3);
        } else {
          router.replace("/(tabs)");
        }
        return;
      }
      // New user — pre-fill from social data and go to business registration
      if (socialParams.socialEmail) setEmail(socialParams.socialEmail);
      setBusinessPhone(phone);
      setStep(2);
    } catch (err) {
      console.error("[Onboarding] Social phone check failed:", err);
      Alert.alert("Connection Error", "Cannot reach the server. Please check your internet connection and try again.", [{ text: "OK" }]);
    } finally {
      setLoading(false);
    }
  };

  const handleOtpResend = async () => {
    if (otpCountdown > 0 || otpResendLoading) return;
    setOtpResendLoading(true);
    setOtpValue("");
    setOtpError("");
    try {
      // In production this would trigger a real SMS; for now just reset the countdown
      await new Promise((resolve) => setTimeout(resolve, 600));
      setOtpCountdown(60);
      const id = setInterval(() => {
        setOtpCountdown((prev) => {
          if (prev <= 1) { clearInterval(id); return 0; }
          return prev - 1;
        });
      }, 1000);
    } finally {
      setOtpResendLoading(false);
    }
  };

  const handleOtpVerify = async () => {
    if (otpValue.trim() !== STATIC_OTP) {
      setOtpError("Incorrect code. Please try again.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (pendingOtpAction === "existing" && pendingExistingId !== null) {
      setLoading(true);
      try {
        dispatch({ type: "SET_BUSINESS_OWNER_ID", payload: pendingExistingId });
        await AsyncStorage.setItem("@bookease_business_owner_id", String(pendingExistingId));
        if (pendingFullData && pendingFullData.owner) {
          const settingsFromDb = dbOwnerToSettings(pendingFullData.owner);
          dispatch({
            type: "LOAD_DATA",
            payload: {
              services: (pendingFullData.services || []).map(dbServiceToLocal),
              clients: (pendingFullData.clients || []).map(dbClientToLocal),
              appointments: (pendingFullData.appointments || []).map(dbAppointmentToLocal),
              reviews: (pendingFullData.reviews || []).map(dbReviewToLocal),
              discounts: (pendingFullData.discounts || []).map(dbDiscountToLocal),
              giftCards: (pendingFullData.giftCards || []).map(dbGiftCardToLocal),
              locations: (pendingFullData.locations || []).map(dbLocationToLocal),
              products: (pendingFullData.products || []).map(dbProductToLocal),
              staff: (pendingFullData.staff || []).map(dbStaffToLocal),
              customSchedule: (pendingFullData.customSchedule || []).map(dbCustomScheduleToLocal),
              settings: settingsFromDb as any,
              businessOwnerId: pendingExistingId,
            },
          });
        }
        if (biometricAvailable && Platform.OS !== "web") {
          setStep(3);
        } else {
          router.replace("/(tabs)");
        }
      } finally {
        setLoading(false);
      }
    } else {
      // New user — proceed to business registration
      setBusinessPhone(phone);
      setStep(2);
    }
  };

  const handleComplete = async () => {
    const newErrors: { businessName?: string } = {};
    if (!businessName.trim()) newErrors.businessName = "Business name is required";
    if (Object.keys(newErrors).length > 0) {
      setOnboardingErrors(newErrors);
      return;
    }
    setOnboardingErrors({});
    setLoading(true);
    try {
      const rawPhone = stripPhoneFormat(businessPhone.trim() || phone.trim());
      const newOwner = await createBusinessMut.mutateAsync({
        phone: rawPhone,
        businessName: businessName.trim(),
        email: email.trim() || undefined,
        website: website.trim() || undefined,
        description: description.trim() || undefined,
        workingHours: DEFAULT_WORKING_HOURS,
        cancellationPolicy: DEFAULT_CANCELLATION_POLICY,
      });
      dispatch({ type: "SET_BUSINESS_OWNER_ID", payload: newOwner.id });
      await AsyncStorage.setItem("@bookease_business_owner_id", String(newOwner.id));
      dispatch({
        type: "UPDATE_SETTINGS",
        payload: {
          businessName: businessName.trim(),
          onboardingComplete: true,
          profile: {
            ownerName: "",
            phone: businessPhone.trim() || phone.trim(),
            email: email.trim(),
            address: "",
            city: "",
            state: "",
            zipCode: "",
            description: description.trim(),
            website: website.trim(),
          },
        },
      });
      if (biometricAvailable && Platform.OS !== "web") {
        setStep(3);
      } else {
        router.replace("/(tabs)");
      }
    } catch (err) {
      console.error("[Onboarding] Failed to create business in DB:", err);
      // Show a clear error — do NOT silently proceed to local-only mode
      // because the user's data would be lost on logout/reinstall
      Alert.alert(
        "Connection Error",
        "Could not save your business to the server. Please check your internet connection and try again.\n\nYour data will not be saved until this succeeds.",
        [{ text: "Try Again" }]
      );
    } finally {
      setLoading(false);
    }
  };

  const handleEnableFaceId = useCallback(async () => {
    setLoading(true);
    try {
      await toggleBiometric(true);
    } catch (err) {
      console.warn("[Onboarding] Face ID setup failed:", err);
    } finally {
      setLoading(false);
      router.replace("/(tabs)");
    }
  }, [toggleBiometric, router]);

  const handleSkipFaceId = useCallback(() => {
    router.replace("/(tabs)");
  }, [router]);

  // ─── Particles (only on step 1) ─────────────────────────────────
  const particles = [
    { x: width * 0.08, y: height * 0.12, size: 8, delay: 200, duration: 3200, opacity: 0.35 },
    { x: width * 0.82, y: height * 0.08, size: 12, delay: 600, duration: 2800, opacity: 0.25 },
    { x: width * 0.15, y: height * 0.35, size: 6, delay: 1000, duration: 3600, opacity: 0.3 },
    { x: width * 0.75, y: height * 0.28, size: 10, delay: 400, duration: 3000, opacity: 0.2 },
    { x: width * 0.55, y: height * 0.06, size: 7, delay: 800, duration: 2600, opacity: 0.3 },
    { x: width * 0.9, y: height * 0.42, size: 9, delay: 300, duration: 3400, opacity: 0.2 },
  ];

  return (
    <View style={{ flex: 1 }}>
      {/* ─── Animated Gradient Background ─────────────────────── */}
      <LinearGradient
        colors={["#1A3A28", "#2D5A3D", "#4A7C59", "#3D6B4A"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />

      {/* ─── Floating Particles ────────────────────────────────── */}
      {step === 1 && particles.map((p, i) => (
        <FloatingParticle key={i} {...p} />
      ))}

      {/* ─── Bottom Wave Decoration ────────────────────────────── */}
      <View
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: height * 0.38,
          backgroundColor: "rgba(255,255,255,0.06)",
          borderTopLeftRadius: width * 0.5,
          borderTopRightRadius: width * 0.5,
        }}
      />
      <View
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: height * 0.28,
          backgroundColor: "rgba(255,255,255,0.05)",
          borderTopLeftRadius: width * 0.6,
          borderTopRightRadius: width * 0.6,
        }}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            paddingHorizontal: hp,
            paddingTop: 60,
            paddingBottom: 40,
          }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ─── Logo + App Name ─────────────────────────────── */}
          <Animated.View style={[styles.logoContainer, logoStyle]}>
            <View style={styles.logoRing}>
              <Image
                source={require("@/assets/images/icon.png")}
                style={styles.logo}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.appName}>Lime Of Time</Text>
            <Text style={styles.appTagline}>Smart scheduling for your business</Text>
          </Animated.View>

          {/* ─── Progress Dots ───────────────────────────────── */}
          <View style={styles.progressRow}>
            {[1, 2, 3].map((s) => {
              const numericStep = step === "otp" ? 1 : (step as number);
              return (
                <View
                  key={s}
                  style={[
                    styles.progressDot,
                    {
                      backgroundColor: s <= numericStep ? "#8FBF6A" : "rgba(255,255,255,0.25)",
                      width: s === numericStep ? 24 : 8,
                    },
                  ]}
                />
              );
            })}
          </View>

          {/* ─── White Card ──────────────────────────────────── */}
          <View style={styles.card}>
            {/* Step 1: Phone */}
            {step === 1 && (
              <>
                <Animated.View style={titleStyle}>
                  <Text style={styles.stepTitle}>Welcome back!</Text>
                  <Text style={styles.stepSubtitle}>
                    Enter your phone number to continue
                  </Text>
                </Animated.View>

                <Animated.View style={[styles.inputGroup, inputStyle]}>
                  <Text style={styles.inputLabel}>Phone Number</Text>
                  <View style={styles.phoneRow}>
                    <CountryCodePicker
                      selected={selectedCountry}
                      onSelect={setSelectedCountry}
                      backgroundColor="#F9FAFB"
                      textColor="#111827"
                      borderColor="#E5E7EB"
                    />
                    <TextInput
                      style={[
                        styles.input,
                        styles.phoneInput,
                        inputFocused && styles.inputFocused,
                      ]}
                      placeholder={selectedCountry.dial === "+1" ? "(000) 000-0000" : "Phone number"}
                      placeholderTextColor="#9CA3AF"
                      value={phone}
                      onChangeText={handlePhoneChange}
                      keyboardType="phone-pad"
                      returnKeyType="done"
                      onSubmitEditing={() => handleBtnPress(handlePhoneNext)}
                      maxLength={selectedCountry.dial === "+1" ? 14 : 15}
                      autoFocus
                      editable={!loading}
                      onFocus={() => setInputFocused(true)}
                      onBlur={() => setInputFocused(false)}
                    />
                  </View>
                </Animated.View>

                <Animated.View style={btnStyle}>
                  <Pressable
                    onPress={() => handleBtnPress(handlePhoneNext)}
                    style={({ pressed }) => [
                      styles.primaryBtn,
                      {
                        backgroundColor: phone.trim() && !loading ? "#4A7C59" : "#9CA3AF",
                        opacity: pressed ? 0.9 : 1,
                      },
                    ]}
                    disabled={!phone.trim() || loading}
                  >
                    {loading ? (
                      <ActivityIndicator color="#FFF" size="small" />
                    ) : (
                      <Text style={styles.primaryBtnText}>Continue</Text>
                    )}
                  </Pressable>

                  {/* ─── Social Login Divider ─────────────────── */}
                  <View style={styles.dividerRow}>
                    <View style={styles.dividerLine} />
                    <Text style={styles.dividerText}>or continue with</Text>
                    <View style={styles.dividerLine} />
                  </View>

                  {/* ─── Social Login Buttons ─────────────────── */}
                  <View style={styles.socialRow}>
                    <Pressable
                      onPress={() => startOAuthLogin("google")}
                      style={({ pressed }) => [styles.socialBtn, { opacity: pressed ? 0.75 : 1 }]}
                    >
                      <GoogleLogo size={18} />
                      <Text style={styles.socialBtnText}>Google</Text>
                    </Pressable>
                    {Platform.OS === "ios" && (
                      <Pressable
                        onPress={() => startOAuthLogin("apple")}
                        style={({ pressed }) => [styles.socialBtn, { opacity: pressed ? 0.75 : 1 }]}
                      >
                        <AppleLogo size={18} color="#000" />
                        <Text style={styles.socialBtnText}>Apple</Text>
                      </Pressable>
                    )}
                    <Pressable
                      onPress={() => startOAuthLogin("microsoft")}
                      style={({ pressed }) => [styles.socialBtn, { opacity: pressed ? 0.75 : 1 }]}
                    >
                      <MicrosoftLogo size={18} />
                      <Text style={styles.socialBtnText}>Microsoft</Text>
                    </Pressable>
                  </View>
                </Animated.View>
              </>
            )}

            {/* Step socialPhone: Phone collection for new social login users */}
            {step === "socialPhone" && (
              <>
                <Animated.View style={titleStyle}>
                  <Text style={styles.stepTitle}>One more step!</Text>
                  <Text style={styles.stepSubtitle}>
                    {socialParams.socialName ? `Welcome, ${socialParams.socialName}! ` : ""}
                    Please enter your phone number to complete setup.
                  </Text>
                </Animated.View>

                <Animated.View style={[styles.inputGroup, inputStyle]}>
                  <Text style={styles.inputLabel}>Phone Number</Text>
                  <View style={styles.phoneRow}>
                    <CountryCodePicker
                      selected={selectedCountry}
                      onSelect={setSelectedCountry}
                      backgroundColor="#F9FAFB"
                      textColor="#111827"
                      borderColor="#E5E7EB"
                    />
                    <TextInput
                      style={[
                        styles.input,
                        styles.phoneInput,
                        inputFocused && styles.inputFocused,
                      ]}
                      placeholder={selectedCountry.dial === "+1" ? "(000) 000-0000" : "Phone number"}
                      placeholderTextColor="#9CA3AF"
                      value={phone}
                      onChangeText={handlePhoneChange}
                      keyboardType="phone-pad"
                      returnKeyType="done"
                      onSubmitEditing={() => handleBtnPress(handleSocialPhoneNext)}
                      maxLength={selectedCountry.dial === "+1" ? 14 : 15}
                      autoFocus
                      editable={!loading}
                      onFocus={() => setInputFocused(true)}
                      onBlur={() => setInputFocused(false)}
                    />
                  </View>
                </Animated.View>

                <Animated.View style={btnStyle}>
                  <Pressable
                    onPress={() => handleBtnPress(handleSocialPhoneNext)}
                    style={({ pressed }) => [
                      styles.primaryBtn,
                      {
                        backgroundColor: phone.trim() && !loading ? "#4A7C59" : "#9CA3AF",
                        opacity: pressed ? 0.9 : 1,
                      },
                    ]}
                    disabled={!phone.trim() || loading}
                  >
                    {loading ? (
                      <ActivityIndicator color="#FFF" size="small" />
                    ) : (
                      <Text style={styles.primaryBtnText}>Continue</Text>
                    )}
                  </Pressable>
                </Animated.View>
              </>
            )}

            {/* Step OTP: Verification */}
            {step === "otp" && (
              <>
                <Animated.View style={[titleStyle, { alignItems: "center" }]}>
                  <View style={{
                    width: 72, height: 72, borderRadius: 20,
                    backgroundColor: "rgba(255,255,255,0.15)",
                    alignItems: "center", justifyContent: "center",
                    marginBottom: 16, borderWidth: 2,
                    borderColor: "rgba(255,255,255,0.25)",
                  }}>
                    <Text style={{ fontSize: 36 }}>🔐</Text>
                  </View>
                  <Text style={[styles.stepTitle, { textAlign: "center" }]}>Verify Your Number</Text>
                  <Text style={[styles.stepSubtitle, { textAlign: "center" }]}>
                    Enter the 6-digit code sent to{"\n"}{selectedCountry.dial} {phone}
                  </Text>
                </Animated.View>

                <Animated.View style={[styles.inputGroup, inputStyle]}>
                  <Text style={styles.inputLabel}>Verification Code</Text>
                  <TextInput
                    style={[
                      styles.input,
                      { textAlign: "center", fontSize: 28, fontWeight: "700", letterSpacing: 12 },
                      inputFocused && styles.inputFocused,
                      otpError ? styles.inputError : undefined,
                    ]}
                    placeholder="------"
                    placeholderTextColor="#9CA3AF"
                    value={otpValue}
                    onChangeText={(t) => { setOtpValue(t.replace(/[^0-9]/g, "").slice(0, 6)); setOtpError(""); }}
                    keyboardType="number-pad"
                    returnKeyType="done"
                    maxLength={6}
                    autoFocus
                    editable={!loading}
                    onFocus={() => setInputFocused(true)}
                    onBlur={() => setInputFocused(false)}
                    onSubmitEditing={() => handleBtnPress(handleOtpVerify)}
                  />
                  {otpError ? (
                    <View style={{
                      backgroundColor: "rgba(239,68,68,0.18)",
                      borderWidth: 1,
                      borderColor: "rgba(239,68,68,0.6)",
                      borderRadius: 10,
                      paddingHorizontal: 14,
                      paddingVertical: 8,
                      marginTop: 10,
                      alignItems: "center",
                    }}>
                      <Text style={{ color: "#FF6B6B", fontSize: 13, fontWeight: "600", textAlign: "center" }}>
                        {otpError}
                      </Text>
                    </View>
                  ) : null}
                  {/* Resend Code button with countdown */}
                  <View style={{ alignItems: "center", marginTop: 16 }}>
                    {otpCountdown > 0 ? (
                      <Text style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", textAlign: "center" }}>
                        Resend code in{" "}
                        <Text style={{ fontWeight: "700", color: "rgba(255,255,255,0.85)" }}>{otpCountdown}s</Text>
                      </Text>
                    ) : (
                      <Pressable
                        onPress={handleOtpResend}
                        disabled={otpResendLoading}
                        style={({ pressed }) => ({
                          opacity: pressed || otpResendLoading ? 0.6 : 1,
                          paddingVertical: 6,
                          paddingHorizontal: 12,
                        })}
                      >
                        {otpResendLoading ? (
                          <ActivityIndicator size="small" color="rgba(255,255,255,0.8)" />
                        ) : (
                          <Text style={{ fontSize: 13, color: "#FFFFFF", fontWeight: "600", textDecorationLine: "underline" }}>
                            Resend Code
                          </Text>
                        )}
                      </Pressable>
                    )}
                  </View>
                </Animated.View>

                <Animated.View style={btnStyle}>
                  <View style={styles.buttonRow}>
                    <Pressable
                      onPress={() => { setStep(1); setOtpValue(""); setOtpError(""); }}
                      style={({ pressed }) => [styles.secondaryBtn, { opacity: pressed ? 0.7 : 1 }]}
                      disabled={loading}
                    >
                      <Text style={styles.secondaryBtnText}>Back</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => handleBtnPress(handleOtpVerify)}
                      style={({ pressed }) => [
                        styles.primaryBtn,
                        { flex: 1, backgroundColor: otpValue.length === 6 && !loading ? "#4A7C59" : "#9CA3AF", opacity: pressed ? 0.9 : 1 },
                      ]}
                      disabled={otpValue.length !== 6 || loading}
                    >
                      {loading ? (
                        <ActivityIndicator color="#FFF" size="small" />
                      ) : (
                        <Text style={styles.primaryBtnText}>Verify</Text>
                      )}
                    </Pressable>
                  </View>
                </Animated.View>
              </>
            )}

            {/* Step 2: Business Info */}
            {step === 2 && (
              <>
                <Animated.View style={titleStyle}>
                  <Text style={styles.stepTitle}>Business Information</Text>
                  <Text style={styles.stepSubtitle}>Setup takes about 2 minutes</Text>
                </Animated.View>

                <Animated.View style={inputStyle}>
                  {/* Quick-setup intro card */}
                  <View style={{ backgroundColor: "rgba(143,191,106,0.12)", borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: "rgba(143,191,106,0.25)" }}>
                    <Text style={{ fontSize: 13, color: "#4A7C59", fontWeight: "600", marginBottom: 4 }}>What happens next?</Text>
                    <Text style={{ fontSize: 12, color: "#687076", lineHeight: 18 }}>
                      ✓  Your booking page goes live instantly{"\n"}
                      ✓  Clients can book 24/7 from any device{"\n"}
                      ✓  You get notified for every new request
                    </Text>
                  </View>
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Business Name *</Text>
                    <TextInput
                      style={[
                        styles.input,
                        onboardingErrors.businessName && styles.inputError,
                      ]}
                      placeholder="Your Business Name"
                      placeholderTextColor="#9CA3AF"
                      value={businessName}
                      onChangeText={(v) => {
                        setBusinessName(v);
                        if (onboardingErrors.businessName) setOnboardingErrors((e) => ({ ...e, businessName: undefined }));
                      }}
                      returnKeyType="next"
                      autoFocus
                      editable={!loading}
                    />
                    {onboardingErrors.businessName ? (
                      <Text style={styles.errorText}>{onboardingErrors.businessName}</Text>
                    ) : null}
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Phone Number</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="(000) 000-0000"
                      placeholderTextColor="#9CA3AF"
                      value={businessPhone}
                      onChangeText={handleBusinessPhoneChange}
                      keyboardType="phone-pad"
                      returnKeyType="next"
                      maxLength={14}
                      editable={!loading}
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Email (optional)</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="email@business.com"
                      placeholderTextColor="#9CA3AF"
                      value={email}
                      onChangeText={setEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      returnKeyType="next"
                      editable={!loading}
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Website (optional)</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="https://www.yourbusiness.com"
                      placeholderTextColor="#9CA3AF"
                      value={website}
                      onChangeText={setWebsite}
                      autoCapitalize="none"
                      returnKeyType="next"
                      editable={!loading}
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Description (optional)</Text>
                    <TextInput
                      style={[styles.input, { minHeight: 80, textAlignVertical: "top" }]}
                      placeholder="Brief description of your business..."
                      placeholderTextColor="#9CA3AF"
                      value={description}
                      onChangeText={setDescription}
                      multiline
                      numberOfLines={3}
                      editable={!loading}
                    />
                  </View>
                </Animated.View>

                <Animated.View style={btnStyle}>
                  <View style={styles.buttonRow}>
                    <Pressable
                      onPress={() => setStep(1)}
                      style={({ pressed }) => [
                        styles.secondaryBtn,
                        { opacity: pressed ? 0.7 : 1 },
                      ]}
                      disabled={loading}
                    >
                      <Text style={styles.secondaryBtnText}>Back</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => handleBtnPress(handleComplete)}
                      style={({ pressed }) => [
                        styles.primaryBtn,
                        {
                          flex: 1,
                          backgroundColor: businessName.trim() && !loading ? "#4A7C59" : "#9CA3AF",
                          opacity: pressed ? 0.9 : 1,
                        },
                      ]}
                      disabled={!businessName.trim() || loading}
                    >
                      {loading ? (
                        <ActivityIndicator color="#FFF" size="small" />
                      ) : (
                        <Text style={styles.primaryBtnText}>Get Started</Text>
                      )}
                    </Pressable>
                  </View>
                </Animated.View>
              </>
            )}

            {/* Step 3: Biometrics */}
            {step === 3 && (
              <>
                <Animated.View style={[titleStyle, { alignItems: "center" }]}>
                  <View style={styles.biometricIcon}>
                    <Text style={{ fontSize: 40 }}>
                      {biometricType === "face" ? "🔐" : "👆"}
                    </Text>
                  </View>
                  <Text style={[styles.stepTitle, { textAlign: "center" }]}>
                    {biometricType === "face" ? "Enable Face ID?" : "Enable Fingerprint?"}
                  </Text>
                  <Text style={[styles.stepSubtitle, { textAlign: "center" }]}>
                    Secure your app with {biometricType === "face" ? "Face ID" : "fingerprint"} authentication.
                  </Text>
                </Animated.View>

                <Animated.View style={btnStyle}>
                  <Pressable
                    onPress={() => handleBtnPress(handleEnableFaceId)}
                    style={({ pressed }) => [
                      styles.primaryBtn,
                      {
                        backgroundColor: !loading ? "#4A7C59" : "#9CA3AF",
                        opacity: pressed ? 0.9 : 1,
                      },
                    ]}
                    disabled={loading}
                  >
                    {loading ? (
                      <ActivityIndicator color="#FFF" size="small" />
                    ) : (
                      <Text style={styles.primaryBtnText}>
                        Enable {biometricType === "face" ? "Face ID" : "Fingerprint"}
                      </Text>
                    )}
                  </Pressable>
                  <Pressable
                    onPress={handleSkipFaceId}
                    style={({ pressed }) => [
                      styles.skipBtn,
                      { opacity: pressed ? 0.6 : 1 },
                    ]}
                    disabled={loading}
                  >
                    <Text style={styles.skipBtnText}>Skip for now</Text>
                  </Pressable>
                </Animated.View>
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  logoContainer: {
    alignItems: "center",
    marginBottom: 28,
  },
  logoRing: {
    width: 96,
    height: 96,
    borderRadius: 28,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.25)",
  },
  logo: {
    width: 72,
    height: 72,
    borderRadius: 20,
  },
  appName: {
    fontSize: 28,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: -0.5,
    fontFamily: Platform.OS === "ios" ? "Inter_700Bold" : undefined,
  },
  appTagline: {
    fontSize: 14,
    color: "rgba(255,255,255,0.7)",
    marginTop: 4,
    fontFamily: Platform.OS === "ios" ? "Inter_400Regular" : undefined,
  },
  progressRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    marginBottom: 20,
  },
  progressDot: {
    height: 8,
    borderRadius: 4,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 8,
  },
  stepTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 6,
    fontFamily: Platform.OS === "ios" ? "Inter_700Bold" : undefined,
  },
  stepSubtitle: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 24,
    lineHeight: 20,
    fontFamily: Platform.OS === "ios" ? "Inter_400Regular" : undefined,
  },
  inputGroup: {
    marginBottom: 16,
    width: "100%",
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 6,
    marginLeft: 2,
    fontFamily: Platform.OS === "ios" ? "Inter_600SemiBold" : undefined,
  },
  input: {
    width: "100%",
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    lineHeight: 20,
    color: "#111827",
    backgroundColor: "#F9FAFB",
    fontFamily: Platform.OS === "ios" ? "Inter_400Regular" : undefined,
  },
  inputFocused: {
    borderColor: "#4A7C59",
    backgroundColor: "#FFFFFF",
    shadowColor: "#4A7C59",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
  },
  phoneRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    width: "100%",
  },
  phoneInput: {
    flex: 1,
    width: undefined,
  },
  inputError: {
    borderColor: "#EF4444",
  },
  errorText: {
    color: "#EF4444",
    fontSize: 12,
    marginTop: 4,
    fontFamily: Platform.OS === "ios" ? "Inter_400Regular" : undefined,
  },
  primaryBtn: {
    width: "100%",
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
    minHeight: 52,
  },
  primaryBtnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 22,
    fontFamily: Platform.OS === "ios" ? "Inter_700Bold" : undefined,
  },
  secondaryBtn: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
    minHeight: 52,
  },
  secondaryBtnText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#374151",
    fontFamily: Platform.OS === "ios" ? "Inter_600SemiBold" : undefined,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
    width: "100%",
  },
  biometricIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#F0FDF4",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  skipBtn: {
    width: "100%",
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
  },
  skipBtnText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#6B7280",
    fontFamily: Platform.OS === "ios" ? "Inter_600SemiBold" : undefined,
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 20,
    marginBottom: 16,
    gap: 10,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#E5E7EB",
  },
  dividerText: {
    fontSize: 12,
    color: "#9CA3AF",
    fontWeight: "500",
  },
  socialRow: {
    flexDirection: "row",
    gap: 10,
    justifyContent: "center",
  },
  socialBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    backgroundColor: "#F9FAFB",
  },
  socialBtnIcon: {
    fontSize: 16,
    fontWeight: "700",
    color: "#374151",
  },
  socialBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#374151",
    fontFamily: Platform.OS === "ios" ? "Inter_600SemiBold" : undefined,
  },
});
