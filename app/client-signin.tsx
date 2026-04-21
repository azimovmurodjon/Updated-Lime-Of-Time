/**
 * Client Portal — Sign In Screen
 *
 * Matches the business onboarding visual style exactly:
 * - Same dark green LinearGradient background (#1A3A28 → #4A7C59)
 * - App logo (icon.png) at top, same ring treatment
 * - White card with Phone+OTP flow AND social login buttons
 * - Real Google / Microsoft / Apple brand logos (via brand-icons.tsx)
 * - Back button to profile-select
 */
import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Platform,
  ActivityIndicator,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  ScrollView,
  TextInput,
  Pressable,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { setProfileMode, useClientStore } from "@/lib/client-store";
import { startOAuthLogin } from "@/constants/oauth";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { LinearGradient } from "expo-linear-gradient";
import { CountryCodePicker, DEFAULT_COUNTRY, type Country } from "@/components/country-code-picker";
import { GoogleLogo, MicrosoftLogo, AppleLogo } from "@/components/brand-icons";
import { trpc } from "@/lib/trpc";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSpring,
  withSequence,
  Easing,
  runOnJS,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import * as Haptics from "expo-haptics";

const { width, height } = Dimensions.get("window");
const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? "http://127.0.0.1:3000";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatPhoneUS(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 10);
  if (digits.length <= 3) return digits.length ? `(${digits}` : "";
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}
function stripPhoneFormat(formatted: string): string {
  return formatted.replace(/\D/g, "");
}

// ─── Animated OAuth Button ────────────────────────────────────────────────────
function OAuthButton({
  label, icon, bgColor, textColor, borderColor, loading, disabled, delay, onPress,
}: {
  label: string; icon: React.ReactNode; bgColor: string; textColor: string;
  borderColor?: string; loading?: boolean; disabled?: boolean; delay?: number; onPress: () => void;
}) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(16);
  useEffect(() => {
    opacity.value = withDelay(delay ?? 0, withTiming(1, { duration: 380, easing: Easing.out(Easing.cubic) }));
    translateY.value = withDelay(delay ?? 0, withSpring(0, { damping: 18, stiffness: 120 }));
  }, []);
  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }, { scale: scale.value }],
  }));
  const tap = Gesture.Tap()
    .onBegin(() => { scale.value = withSpring(0.96, { damping: 20, stiffness: 300 }); })
    .onFinalize((_, success) => {
      scale.value = withSpring(1, { damping: 18, stiffness: 200 });
      if (success && !disabled) {
        if (Platform.OS !== "web") runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Light);
        runOnJS(onPress)();
      }
    });
  return (
    <GestureDetector gesture={tap}>
      <Animated.View style={[styles.oauthWrap, animStyle]}>
        <View style={[
          styles.oauthBtn,
          { backgroundColor: bgColor },
          borderColor ? { borderWidth: 1, borderColor } : {},
        ]}>
          {loading ? (
            <ActivityIndicator color={textColor} size="small" />
          ) : icon}
          <Text style={[styles.oauthBtnText, { color: textColor }]}>{label}</Text>
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
type Step = "options" | "phone" | "otp";

export default function ClientSignInScreen() {
  const router = useRouter();
  const { signIn } = useClientStore();
  const [oauthLoading, setOauthLoading] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("options");

  // Phone step
  const [selectedCountry, setSelectedCountry] = useState<Country>(DEFAULT_COUNTRY);
  const [phone, setPhone] = useState("");
  const [inputFocused, setInputFocused] = useState(false);
  const [phoneLoading, setPhoneLoading] = useState(false);
  const [phoneError, setPhoneError] = useState("");

  // OTP step
  const [otpDigits, setOtpDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const [otpValue, setOtpValue] = useState("");
  const [otpError, setOtpError] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpCountdown, setOtpCountdown] = useState(0);
  const otpRefs = useRef<(TextInput | null)[]>([null, null, null, null, null, null]);

  const sendOtpMut = trpc.otp.send.useMutation();
  const verifyOtpMut = trpc.otp.verify.useMutation();

  // OTP countdown
  useEffect(() => {
    if (otpCountdown <= 0) return;
    const t = setTimeout(() => setOtpCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [otpCountdown]);

  // ── Animations ──────────────────────────────────────────────────────────────
  const logoScale = useSharedValue(0.5);
  const logoOpacity = useSharedValue(0);
  const appNameOpacity = useSharedValue(0);
  const appNameY = useSharedValue(10);
  const cardOpacity = useSharedValue(0);
  const cardY = useSharedValue(40);

  useEffect(() => {
    logoOpacity.value = withTiming(1, { duration: 600, easing: Easing.out(Easing.cubic) });
    logoScale.value = withSpring(1, { damping: 14, stiffness: 120 });
    appNameOpacity.value = withDelay(300, withTiming(1, { duration: 500 }));
    appNameY.value = withDelay(300, withSpring(0, { damping: 18, stiffness: 100 }));
    cardOpacity.value = withDelay(500, withTiming(1, { duration: 500, easing: Easing.out(Easing.cubic) }));
    cardY.value = withDelay(500, withSpring(0, { damping: 20, stiffness: 120 }));
  }, []);

  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));
  const appNameStyle = useAnimatedStyle(() => ({
    opacity: appNameOpacity.value,
    transform: [{ translateY: appNameY.value }],
  }));
  const cardStyle = useAnimatedStyle(() => ({
    opacity: cardOpacity.value,
    transform: [{ translateY: cardY.value }],
  }));

  // OTP box animated scales (must be declared at top level — no hooks in loops)
  const otpScale0 = useSharedValue(1); const otpScale1 = useSharedValue(1);
  const otpScale2 = useSharedValue(1); const otpScale3 = useSharedValue(1);
  const otpScale4 = useSharedValue(1); const otpScale5 = useSharedValue(1);
  const otpBorder0 = useSharedValue(0); const otpBorder1 = useSharedValue(0);
  const otpBorder2 = useSharedValue(0); const otpBorder3 = useSharedValue(0);
  const otpBorder4 = useSharedValue(0); const otpBorder5 = useSharedValue(0);
  const otpBoxScales = [otpScale0, otpScale1, otpScale2, otpScale3, otpScale4, otpScale5];
  const otpBoxBorders = [otpBorder0, otpBorder1, otpBorder2, otpBorder3, otpBorder4, otpBorder5];
  const otpBoxStyle0 = useAnimatedStyle(() => ({ transform: [{ scale: otpBoxScales[0].value }], borderColor: otpBorder0.value === 1 ? "#4A7C59" : "#E5E7EB", backgroundColor: otpBorder0.value === 1 ? "#F0FFF4" : "#F9FAFB" }));
  const otpBoxStyle1 = useAnimatedStyle(() => ({ transform: [{ scale: otpBoxScales[1].value }], borderColor: otpBorder1.value === 1 ? "#4A7C59" : "#E5E7EB", backgroundColor: otpBorder1.value === 1 ? "#F0FFF4" : "#F9FAFB" }));
  const otpBoxStyle2 = useAnimatedStyle(() => ({ transform: [{ scale: otpBoxScales[2].value }], borderColor: otpBorder2.value === 1 ? "#4A7C59" : "#E5E7EB", backgroundColor: otpBorder2.value === 1 ? "#F0FFF4" : "#F9FAFB" }));
  const otpBoxStyle3 = useAnimatedStyle(() => ({ transform: [{ scale: otpBoxScales[3].value }], borderColor: otpBorder3.value === 1 ? "#4A7C59" : "#E5E7EB", backgroundColor: otpBorder3.value === 1 ? "#F0FFF4" : "#F9FAFB" }));
  const otpBoxStyle4 = useAnimatedStyle(() => ({ transform: [{ scale: otpBoxScales[4].value }], borderColor: otpBorder4.value === 1 ? "#4A7C59" : "#E5E7EB", backgroundColor: otpBorder4.value === 1 ? "#F0FFF4" : "#F9FAFB" }));
  const otpBoxStyle5 = useAnimatedStyle(() => ({ transform: [{ scale: otpBoxScales[5].value }], borderColor: otpBorder5.value === 1 ? "#4A7C59" : "#E5E7EB", backgroundColor: otpBorder5.value === 1 ? "#F0FFF4" : "#F9FAFB" }));
  const otpBoxAnimStyles = [otpBoxStyle0, otpBoxStyle1, otpBoxStyle2, otpBoxStyle3, otpBoxStyle4, otpBoxStyle5];

  // ── Handlers ─────────────────────────────────────────────────────────────────
  const handleOAuth = async (provider: "apple" | "google" | "microsoft") => {
    setOauthLoading(provider);
    await setProfileMode("client");
    await startOAuthLogin(provider);
    setOauthLoading(null);
  };

  const handlePhoneChange = (text: string) => {
    setPhoneError("");
    if (selectedCountry.dial === "+1") {
      setPhone(formatPhoneUS(text));
    } else {
      setPhone(text.replace(/[^0-9]/g, "").slice(0, 15));
    }
  };

  const handlePhoneNext = async () => {
    const stripped = stripPhoneFormat(phone);
    const isValid = selectedCountry.dial === "+1" ? stripped.length === 10 : stripped.length >= 7;
    if (!isValid) { setPhoneError("Please enter a valid phone number."); return; }
    setPhoneLoading(true);
    setPhoneError("");
    try {
      const rawPhone = selectedCountry.dial === "+1" ? stripped : `${selectedCountry.dial.replace("+", "")}${stripped}`;
      await sendOtpMut.mutateAsync({ phone: rawPhone });
      setOtpDigits(["", "", "", "", "", ""]);
      setOtpValue("");
      setOtpError("");
      setOtpCountdown(60);
      setStep("otp");
      setTimeout(() => otpRefs.current[0]?.focus(), 300);
    } catch (e: any) {
      setPhoneError(e.message ?? "Failed to send code. Please try again.");
    } finally {
      setPhoneLoading(false);
    }
  };

  const handleOtpDigitChange = (index: number, value: string) => {
    setOtpError("");
    if (value.length > 1) {
      const digits = value.replace(/\D/g, "").slice(0, 6).split("");
      const newDigits = ["", "", "", "", "", ""];
      digits.forEach((d, i) => { newDigits[i] = d; });
      setOtpDigits(newDigits);
      setOtpValue(newDigits.join(""));
      const lastIdx = Math.min(digits.length, 5);
      setTimeout(() => otpRefs.current[lastIdx]?.focus(), 30);
      return;
    }
    const newDigits = [...otpDigits];
    newDigits[index] = value.replace(/\D/g, "").slice(-1);
    setOtpDigits(newDigits);
    setOtpValue(newDigits.join(""));
    otpBoxBorders[index].value = newDigits[index] ? 1 : 0;
    otpBoxScales[index].value = withSequence(
      withSpring(1.08, { damping: 12, stiffness: 300 }),
      withSpring(1, { damping: 18, stiffness: 200 }),
    );
    if (newDigits[index] && index < 5) setTimeout(() => otpRefs.current[index + 1]?.focus(), 30);
  };

  const handleOtpKeyPress = (index: number, e: any) => {
    if (e.nativeEvent.key === "Backspace" && !otpDigits[index] && index > 0) {
      const newDigits = [...otpDigits];
      newDigits[index - 1] = "";
      setOtpDigits(newDigits);
      setOtpValue(newDigits.join(""));
      otpBoxBorders[index - 1].value = 0;
      setTimeout(() => otpRefs.current[index - 1]?.focus(), 10);
    }
  };

  const handleOtpVerify = async () => {
    if (otpValue.length < 6) return;
    setOtpLoading(true);
    setOtpError("");
    try {
      const stripped = stripPhoneFormat(phone);
      const rawPhone = selectedCountry.dial === "+1" ? stripped : `${selectedCountry.dial.replace("+", "")}${stripped}`;
      const result = await verifyOtpMut.mutateAsync({ phone: rawPhone, code: otpValue.trim() });
      if (!result.success) {
        setOtpError((result as any).error ?? "Incorrect code. Please try again.");
        otpBoxScales.forEach((s, i) => {
          s.value = withDelay(i * 30, withSequence(
            withTiming(0.92, { duration: 60 }),
            withTiming(1.04, { duration: 60 }),
            withTiming(1, { duration: 60 }),
          ));
        });
        if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setOtpLoading(false);
        return;
      }
      const res = await fetch(`${API_BASE}/api/client/phone-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: rawPhone }),
      });
      if (!res.ok) throw new Error("Login failed");
      const data = await res.json() as { token: string; account: any };
      await signIn(data.account, data.token);
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace("/(client-tabs)" as any);
    } catch (e: any) {
      setOtpError(e.message ?? "Verification failed. Please try again.");
    } finally {
      setOtpLoading(false);
    }
  };

  const handleOtpResend = async () => {
    const stripped = stripPhoneFormat(phone);
    const rawPhone = selectedCountry.dial === "+1" ? stripped : `${selectedCountry.dial.replace("+", "")}${stripped}`;
    try {
      await sendOtpMut.mutateAsync({ phone: rawPhone });
      setOtpCountdown(60);
      setOtpDigits(["", "", "", "", "", ""]);
      setOtpValue("");
      setOtpError("");
    } catch {}
  };

  // Back button
  const backScale = useSharedValue(1);
  const goBack = () => {
    if (step === "otp") { setStep("phone"); return; }
    if (step === "phone") { setStep("options"); return; }
    router.replace("/profile-select" as any);
  };
  const backTap = Gesture.Tap()
    .onBegin(() => { backScale.value = withSpring(0.93, { damping: 20, stiffness: 300 }); })
    .onFinalize((_, success) => {
      backScale.value = withSpring(1, { damping: 18, stiffness: 200 });
      if (success) {
        if (Platform.OS !== "web") runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Light);
        runOnJS(goBack)();
      }
    });
  const backStyle = useAnimatedStyle(() => ({ transform: [{ scale: backScale.value }] }));

  const isPhoneReady = selectedCountry.dial === "+1"
    ? stripPhoneFormat(phone).length === 10
    : stripPhoneFormat(phone).length >= 7;

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]}>
      {/* ─── Green gradient background ────────────────────────── */}
      <LinearGradient
        colors={["#1A3A28", "#2D5A3D", "#4A7C59", "#3D6B4A"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
      <View style={styles.wave1} />
      <View style={styles.wave2} />

      <KeyboardAvoidingView
        behavior="padding"
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 24}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ─── Back button ─────────────────────────────────── */}
          <GestureDetector gesture={backTap}>
            <Animated.View style={[styles.backBtn, backStyle]}>
              <IconSymbol name="chevron.left" size={20} color="rgba(255,255,255,0.8)" />
              <Text style={styles.backText}>Back</Text>
            </Animated.View>
          </GestureDetector>

          {/* ─── Logo + App Name ─────────────────────────────── */}
          <Animated.View style={[styles.logoWrap, logoStyle]}>
            <View style={styles.logoRing}>
              <Image
                source={require("../assets/images/icon.png")}
                style={styles.logo}
                resizeMode="cover"
              />
            </View>
          </Animated.View>
          <Animated.View style={[styles.titleWrap, appNameStyle]}>
            <Text style={styles.appName}>Lime Of Time</Text>
            <Text style={styles.appTagline}>Book appointments with ease</Text>
            <View style={styles.byLine}>
              <View style={styles.byLineDash} />
              <Text style={styles.byLineText}>CLIENT PORTAL</Text>
              <View style={styles.byLineDash} />
            </View>
          </Animated.View>

          {/* ─── White Card ──────────────────────────────────── */}
          <Animated.View style={[styles.card, cardStyle]}>

            {/* ── Step: Options ──────────────────────────────── */}
            {step === "options" && (
              <>
                <Text style={styles.cardTitle}>Welcome!</Text>
                <Text style={styles.cardSubtitle}>
                  Sign in to book appointments, manage your schedule, and discover new services.
                </Text>
                <View style={styles.buttons}>
                  <OAuthButton
                    label="Continue with Apple"
                    icon={<AppleLogo size={20} color="#FFFFFF" />}
                    bgColor="#000000"
                    textColor="#FFFFFF"
                    loading={oauthLoading === "apple"}
                    disabled={oauthLoading !== null}
                    delay={600}
                    onPress={() => handleOAuth("apple")}
                  />
                  <OAuthButton
                    label="Continue with Google"
                    icon={<GoogleLogo size={20} />}
                    bgColor="#FFFFFF"
                    textColor="#111827"
                    borderColor="#E5E7EB"
                    loading={oauthLoading === "google"}
                    disabled={oauthLoading !== null}
                    delay={700}
                    onPress={() => handleOAuth("google")}
                  />
                  <OAuthButton
                    label="Continue with Microsoft"
                    icon={<MicrosoftLogo size={20} />}
                    bgColor="#FFFFFF"
                    textColor="#111827"
                    borderColor="#E5E7EB"
                    loading={oauthLoading === "microsoft"}
                    disabled={oauthLoading !== null}
                    delay={800}
                    onPress={() => handleOAuth("microsoft")}
                  />
                  <OAuthButton
                    label="Continue with Phone"
                    icon={<Text style={{ fontSize: 18 }}>📱</Text>}
                    bgColor="#F0FFF4"
                    textColor="#1A3A28"
                    borderColor="#C6E8D1"
                    disabled={oauthLoading !== null}
                    delay={900}
                    onPress={() => setStep("phone")}
                  />
                </View>
                <View style={styles.dividerRow}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>or</Text>
                  <View style={styles.dividerLine} />
                </View>
                <Pressable
                  onPress={() => router.replace("/(client-tabs)" as any)}
                  style={({ pressed }) => [styles.skipBtn, { opacity: pressed ? 0.7 : 1 }]}
                >
                  <Text style={styles.skipText}>Browse without signing in</Text>
                </Pressable>
                <Text style={styles.terms}>
                  By continuing you agree to our Terms of Service and Privacy Policy.
                </Text>
              </>
            )}

            {/* ── Step: Phone Number ──────────────────────────── */}
            {step === "phone" && (
              <>
                <View style={styles.stepBackRow}>
                  <Pressable
                    onPress={() => setStep("options")}
                    style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1, padding: 4, marginRight: 4 })}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Text style={styles.stepBackChevron}>‹</Text>
                  </Pressable>
                  <Text style={styles.stepBackLabel}>Back</Text>
                </View>
                <View style={styles.stepIconWrap}>
                  <Text style={{ fontSize: 34 }}>📱</Text>
                </View>
                <Text style={styles.stepTitle}>Your Phone Number</Text>
                <Text style={styles.stepSubtitle}>
                  We'll send a 6-digit verification code to confirm your number.
                </Text>
                <View style={styles.inputGroup}>
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
                        phoneError ? styles.inputError : undefined,
                      ]}
                      placeholder={selectedCountry.dial === "+1" ? "(000) 000-0000" : "Phone number"}
                      placeholderTextColor="#9CA3AF"
                      value={phone}
                      onChangeText={handlePhoneChange}
                      keyboardType="phone-pad"
                      returnKeyType="done"
                      onSubmitEditing={handlePhoneNext}
                      maxLength={selectedCountry.dial === "+1" ? 14 : 15}
                      editable={!phoneLoading}
                      onFocus={() => setInputFocused(true)}
                      onBlur={() => setInputFocused(false)}
                      autoFocus={false}
                    />
                  </View>
                  {phoneError ? <Text style={styles.errorText}>{phoneError}</Text> : null}
                </View>
                <Pressable
                  onPress={handlePhoneNext}
                  disabled={!isPhoneReady || phoneLoading}
                  style={({ pressed }) => [
                    styles.primaryBtn,
                    { backgroundColor: isPhoneReady && !phoneLoading ? "#4A7C59" : "#9CA3AF", opacity: pressed ? 0.9 : 1 },
                  ]}
                >
                  {phoneLoading
                    ? <ActivityIndicator color="#FFF" size="small" />
                    : <Text style={styles.primaryBtnText}>Send Code</Text>}
                </Pressable>
              </>
            )}

            {/* ── Step: OTP Verification ──────────────────────── */}
            {step === "otp" && (
              <>
                <View style={styles.stepBackRow}>
                  <Pressable
                    onPress={() => setStep("phone")}
                    style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1, padding: 4, marginRight: 4 })}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Text style={styles.stepBackChevron}>‹</Text>
                  </Pressable>
                  <Text style={styles.stepBackLabel}>Back</Text>
                </View>
                <View style={[styles.stepIconWrap, { alignSelf: "center" }]}>
                  <Text style={{ fontSize: 34 }}>🔐</Text>
                </View>
                <Text style={[styles.stepTitle, { textAlign: "center" }]}>Verify Your Number</Text>
                <Text style={[styles.stepSubtitle, { textAlign: "center" }]}>
                  Enter the 6-digit code sent to{"\n"}
                  <Text style={{ fontWeight: "700", color: "#111827" }}>
                    {selectedCountry.dial} {phone}
                  </Text>
                </Text>
                <View style={styles.otpRow}>
                  {otpDigits.map((digit, i) => (
                    <Animated.View
                      key={i}
                      style={[
                        styles.otpBox,
                        otpBoxAnimStyles[i],
                        otpError ? { borderColor: "#EF4444" } : undefined,
                      ]}
                    >
                      <TextInput
                        ref={ref => { otpRefs.current[i] = ref; }}
                        style={styles.otpInput}
                        value={digit}
                        onChangeText={v => handleOtpDigitChange(i, v)}
                        onKeyPress={e => handleOtpKeyPress(i, e)}
                        keyboardType="number-pad"
                        maxLength={i === 0 ? 6 : 1}
                        editable={!otpLoading}
                        selectTextOnFocus
                        caretHidden
                        textContentType={i === 0 ? "oneTimeCode" : "none"}
                        autoComplete={i === 0 ? "sms-otp" : "off"}
                      />
                    </Animated.View>
                  ))}
                </View>
                {otpError ? (
                  <View style={styles.otpErrorWrap}>
                    <Text style={styles.otpErrorText}>{otpError}</Text>
                  </View>
                ) : null}
                <View style={{ alignItems: "center", marginTop: 16, marginBottom: 20 }}>
                  {otpCountdown > 0 ? (
                    <Text style={{ fontSize: 13, color: "#6B7280", textAlign: "center" }}>
                      Resend code in{" "}
                      <Text style={{ fontWeight: "700", color: "#4A7C59" }}>{otpCountdown}s</Text>
                    </Text>
                  ) : (
                    <Pressable
                      onPress={handleOtpResend}
                      style={({ pressed }) => ({
                        opacity: pressed ? 0.6 : 1,
                        paddingVertical: 8, paddingHorizontal: 16,
                        borderRadius: 8, backgroundColor: "rgba(74,124,89,0.08)",
                      })}
                    >
                      <Text style={{ fontSize: 14, color: "#4A7C59", fontWeight: "600" }}>Resend Code</Text>
                    </Pressable>
                  )}
                </View>
                <View style={styles.buttonRow}>
                  <Pressable
                    onPress={() => { setStep("phone"); setOtpDigits(["", "", "", "", "", ""]); setOtpValue(""); setOtpError(""); }}
                    style={({ pressed }) => [styles.secondaryBtn, { opacity: pressed ? 0.7 : 1 }]}
                    disabled={otpLoading}
                  >
                    <Text style={styles.secondaryBtnText}>Back</Text>
                  </Pressable>
                  <Pressable
                    onPress={handleOtpVerify}
                    disabled={otpValue.length !== 6 || otpLoading}
                    style={({ pressed }) => [
                      styles.primaryBtn,
                      { flex: 1, backgroundColor: otpValue.length === 6 && !otpLoading ? "#4A7C59" : "#9CA3AF", opacity: pressed ? 0.9 : 1 },
                    ]}
                  >
                    {otpLoading
                      ? <ActivityIndicator color="#FFF" size="small" />
                      : <Text style={styles.primaryBtnText}>Verify</Text>}
                  </Pressable>
                </View>
              </>
            )}

          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scroll: {
    minHeight: height, paddingHorizontal: 24, paddingTop: 32, paddingBottom: 48,
  },
  wave1: {
    position: "absolute", bottom: 0, left: 0, right: 0, height: height * 0.38,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderTopLeftRadius: width * 0.5, borderTopRightRadius: width * 0.5,
  },
  wave2: {
    position: "absolute", bottom: 0, left: 0, right: 0, height: height * 0.28,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderTopLeftRadius: width * 0.6, borderTopRightRadius: width * 0.6,
  },
  backBtn: {
    flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 16, alignSelf: "flex-start",
  },
  backText: { fontSize: 16, color: "rgba(255,255,255,0.8)", fontWeight: "500" },
  logoWrap: { alignItems: "center", marginBottom: 12, marginTop: 8 },
  logoRing: {
    width: 96, height: 96, borderRadius: 28,
    backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center",
    borderWidth: 1.5, borderColor: "rgba(255,255,255,0.25)",
  },
  logo: { width: 72, height: 72, borderRadius: 20 },
  titleWrap: { alignItems: "center", marginBottom: 24 },
  appName: {
    fontSize: 28, fontWeight: "800", color: "#FFFFFF", letterSpacing: -0.5, marginBottom: 4,
  },
  appTagline: { fontSize: 14, color: "rgba(255,255,255,0.65)", letterSpacing: 0.2, marginBottom: 10 },
  byLine: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  byLineDash: { width: 24, height: 1, backgroundColor: "rgba(255,255,255,0.3)" },
  byLineText: {
    fontSize: 11, color: "rgba(255,255,255,0.45)", letterSpacing: 1.5, textTransform: "uppercase",
  },
  card: {
    backgroundColor: "#FFFFFF", borderRadius: 24, padding: 24,
    shadowColor: "#000", shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15, shadowRadius: 24, elevation: 10,
  },
  cardTitle: {
    fontSize: 24, fontWeight: "800", color: "#111827", marginBottom: 8, letterSpacing: -0.3,
  },
  cardSubtitle: { fontSize: 14, color: "#6B7280", lineHeight: 20, marginBottom: 24 },
  buttons: { gap: 10 },
  oauthWrap: { borderRadius: 14, overflow: "hidden" },
  oauthBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 10, paddingVertical: 14, paddingHorizontal: 20, borderRadius: 14,
  },
  oauthBtnText: { fontSize: 15, fontWeight: "600" },
  dividerRow: {
    flexDirection: "row", alignItems: "center", gap: 12, marginVertical: 18,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: "#E5E7EB" },
  dividerText: { fontSize: 13, color: "#9CA3AF", fontWeight: "500" },
  skipBtn: {
    alignItems: "center", paddingVertical: 12, borderRadius: 12,
    backgroundColor: "#F3F4F6", marginBottom: 16,
  },
  skipText: { fontSize: 14, color: "#4A7C59", fontWeight: "600" },
  terms: { fontSize: 11, color: "#9CA3AF", textAlign: "center", lineHeight: 16, marginTop: 4 },
  // Phone step
  stepBackRow: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
  stepBackChevron: { fontSize: 22, color: "#4A7C59", fontWeight: "600" },
  stepBackLabel: { fontSize: 13, color: "#4A7C59", fontWeight: "600" },
  stepIconWrap: {
    width: 64, height: 64, borderRadius: 20,
    backgroundColor: "#F0FFF4", alignItems: "center", justifyContent: "center", marginBottom: 16,
  },
  stepTitle: { fontSize: 22, fontWeight: "800", color: "#111827", marginBottom: 6, letterSpacing: -0.3 },
  stepSubtitle: { fontSize: 14, color: "#6B7280", lineHeight: 20, marginBottom: 20 },
  inputGroup: { marginBottom: 16 },
  inputLabel: {
    fontSize: 11, fontWeight: "700", color: "#6B7280",
    letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 8,
  },
  phoneRow: { flexDirection: "row", gap: 8 },
  input: {
    flex: 1, height: 52, borderWidth: 1.5, borderColor: "#E5E7EB",
    borderRadius: 14, paddingHorizontal: 16, fontSize: 16, color: "#111827", backgroundColor: "#F9FAFB",
  },
  phoneInput: { flex: 1 },
  inputFocused: { borderColor: "#4A7C59", backgroundColor: "#F0FFF4" },
  inputError: { borderColor: "#EF4444" },
  errorText: { fontSize: 12, color: "#EF4444", marginTop: 6 },
  primaryBtn: {
    height: 52, borderRadius: 14, alignItems: "center", justifyContent: "center", marginTop: 4,
  },
  primaryBtnText: { fontSize: 16, fontWeight: "700", color: "#FFFFFF" },
  secondaryBtn: {
    height: 52, borderRadius: 14, alignItems: "center", justifyContent: "center",
    backgroundColor: "#F3F4F6", paddingHorizontal: 20, marginTop: 4,
  },
  secondaryBtnText: { fontSize: 15, fontWeight: "600", color: "#374151" },
  buttonRow: { flexDirection: "row", gap: 10 },
  // OTP
  otpRow: { flexDirection: "row", justifyContent: "space-between", gap: 8, marginBottom: 12 },
  otpBox: {
    flex: 1, height: 56, borderRadius: 14, borderWidth: 2,
    alignItems: "center", justifyContent: "center",
  },
  otpInput: {
    width: "100%", height: "100%", textAlign: "center",
    fontSize: 22, fontWeight: "700", color: "#111827",
  },
  otpErrorWrap: {
    backgroundColor: "#FEF2F2", borderRadius: 10, padding: 10, marginBottom: 8,
  },
  otpErrorText: { fontSize: 13, color: "#EF4444", textAlign: "center" },
});
