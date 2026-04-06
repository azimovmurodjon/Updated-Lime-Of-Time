import {
  Text,
  View,
  Pressable,
  StyleSheet,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
  Image,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useStore } from "@/lib/store";
import { useColors } from "@/hooks/use-colors";
import { useState } from "react";
import { formatPhoneNumber } from "@/lib/types";

type Step = 1 | 2;

export default function OnboardingScreen() {
  const { dispatch } = useStore();
  const colors = useColors();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const hp = Math.max(16, width * 0.05);

  const [step, setStep] = useState<Step>(1);
  const [phone, setPhone] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [address, setAddress] = useState("");
  const [businessPhone, setBusinessPhone] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [description, setDescription] = useState("");

  const handlePhoneChange = (text: string) => {
    setPhone(formatPhoneNumber(text));
  };

  const handleBusinessPhoneChange = (text: string) => {
    setBusinessPhone(formatPhoneNumber(text));
  };

  const handlePhoneNext = () => {
    if (!phone.trim()) return;
    setBusinessPhone(phone);
    setStep(2);
  };

  const handleComplete = () => {
    if (!businessName.trim()) return;
    dispatch({
      type: "UPDATE_SETTINGS",
      payload: {
        businessName: businessName.trim(),
        onboardingComplete: true,
        profile: {
          ownerName: "",
          phone: businessPhone.trim() || phone.trim(),
          email: email.trim(),
          address: address.trim(),
          description: description.trim(),
          website: website.trim(),
        },
      },
    });
    router.replace("/(tabs)");
  };

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, paddingHorizontal: hp }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Logo */}
          <View style={styles.logoContainer}>
            <Image
              source={require("@/assets/images/icon.png")}
              style={styles.logo}
              resizeMode="contain"
            />
            <Text style={[styles.appName, { color: colors.primary }]}>Lime Of Time</Text>
          </View>

          {/* Progress */}
          <View style={[styles.progressRow, { paddingHorizontal: 0 }]}>
            {[1, 2].map((s) => (
              <View
                key={s}
                style={[
                  styles.progressBar,
                  { backgroundColor: s <= step ? colors.primary : colors.border },
                ]}
              />
            ))}
          </View>

          {step === 1 && (
            <View style={styles.stepContainer}>
              <Text style={[styles.stepTitle, { color: colors.foreground }]}>
                Welcome! Let's get started
              </Text>
              <Text style={[styles.stepSubtitle, { color: colors.muted }]}>
                Enter your phone number to set up your account
              </Text>

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.muted }]}>Phone Number</Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                      color: colors.foreground,
                    },
                  ]}
                  placeholder="(000) 000-0000"
                  placeholderTextColor={colors.muted}
                  value={phone}
                  onChangeText={handlePhoneChange}
                  keyboardType="phone-pad"
                  returnKeyType="done"
                  onSubmitEditing={handlePhoneNext}
                  maxLength={14}
                  autoFocus
                />
              </View>

              <Pressable
                onPress={handlePhoneNext}
                style={({ pressed }) => [
                  styles.primaryBtn,
                  {
                    backgroundColor: phone.trim() ? colors.primary : colors.muted,
                    opacity: pressed && phone.trim() ? 0.8 : 1,
                  },
                ]}
                disabled={!phone.trim()}
              >
                <Text style={styles.primaryBtnText}>Continue</Text>
              </Pressable>
            </View>
          )}

          {step === 2 && (
            <View style={styles.stepContainer}>
              <Text style={[styles.stepTitle, { color: colors.foreground }]}>
                Business Information
              </Text>
              <Text style={[styles.stepSubtitle, { color: colors.muted }]}>
                Tell us about your business
              </Text>

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.muted }]}>Business Name *</Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                      color: colors.foreground,
                    },
                  ]}
                  placeholder="Your Business Name"
                  placeholderTextColor={colors.muted}
                  value={businessName}
                  onChangeText={setBusinessName}
                  returnKeyType="next"
                  autoFocus
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.muted }]}>Address *</Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                      color: colors.foreground,
                    },
                  ]}
                  placeholder="4661 McKnight Road, Pittsburgh PA, 15237"
                  placeholderTextColor={colors.muted}
                  value={address}
                  onChangeText={setAddress}
                  returnKeyType="next"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.muted }]}>Phone Number</Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                      color: colors.foreground,
                    },
                  ]}
                  placeholder="(000) 000-0000"
                  placeholderTextColor={colors.muted}
                  value={businessPhone}
                  onChangeText={handleBusinessPhoneChange}
                  keyboardType="phone-pad"
                  returnKeyType="next"
                  maxLength={14}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.muted }]}>
                  Email (optional)
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                      color: colors.foreground,
                    },
                  ]}
                  placeholder="email@business.com"
                  placeholderTextColor={colors.muted}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  returnKeyType="next"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.muted }]}>
                  Website (optional)
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                      color: colors.foreground,
                    },
                  ]}
                  placeholder="https://www.yourbusiness.com"
                  placeholderTextColor={colors.muted}
                  value={website}
                  onChangeText={setWebsite}
                  autoCapitalize="none"
                  returnKeyType="next"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.muted }]}>
                  Description (optional)
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                      color: colors.foreground,
                      minHeight: 80,
                      textAlignVertical: "top",
                    },
                  ]}
                  placeholder="Brief description of your business..."
                  placeholderTextColor={colors.muted}
                  value={description}
                  onChangeText={setDescription}
                  multiline
                  numberOfLines={3}
                />
              </View>

              <View style={styles.buttonRow}>
                <Pressable
                  onPress={() => setStep(1)}
                  style={({ pressed }) => [
                    styles.secondaryBtn,
                    { borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
                  ]}
                >
                  <Text style={[styles.secondaryBtnText, { color: colors.foreground }]}>Back</Text>
                </Pressable>
                <Pressable
                  onPress={handleComplete}
                  style={({ pressed }) => [
                    styles.primaryBtn,
                    {
                      flex: 1,
                      backgroundColor: businessName.trim() ? colors.primary : colors.muted,
                      opacity: pressed && businessName.trim() ? 0.8 : 1,
                    },
                  ]}
                  disabled={!businessName.trim()}
                >
                  <Text style={styles.primaryBtnText}>Get Started</Text>
                </Pressable>
              </View>
            </View>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  logoContainer: {
    alignItems: "center",
    marginTop: 40,
    marginBottom: 24,
  },
  logo: {
    width: 80,
    height: 80,
    borderRadius: 20,
  },
  appName: {
    fontSize: 24,
    fontWeight: "800",
    marginTop: 12,
  },
  progressRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 32,
  },
  progressBar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  stepContainer: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 6,
  },
  stepSubtitle: {
    fontSize: 14,
    marginBottom: 24,
    lineHeight: 20,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 6,
    marginLeft: 2,
  },
  input: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
  },
  primaryBtn: {
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 8,
  },
  primaryBtnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  secondaryBtn: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    marginTop: 8,
  },
  secondaryBtnText: {
    fontSize: 16,
    fontWeight: "600",
  },
  buttonRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
});
