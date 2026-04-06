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
  ActivityIndicator,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useStore } from "@/lib/store";
import { useColors } from "@/hooks/use-colors";
import { useState } from "react";
import {
  formatPhoneNumber,
  stripPhoneFormat,
  DEFAULT_WORKING_HOURS,
  DEFAULT_CANCELLATION_POLICY,
} from "@/lib/types";
import { trpc } from "@/lib/trpc";
import AsyncStorage from "@react-native-async-storage/async-storage";

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
  const [loading, setLoading] = useState(false);

  const trpcUtils = trpc.useUtils();
  const createBusinessMut = trpc.business.create.useMutation();

  const handlePhoneChange = (text: string) => {
    setPhone(formatPhoneNumber(text));
  };

  const handleBusinessPhoneChange = (text: string) => {
    setBusinessPhone(formatPhoneNumber(text));
  };

  const handlePhoneNext = async () => {
    if (!phone.trim()) return;
    setLoading(true);
    try {
      // Check if a business owner already exists with this phone number
      const rawPhone = stripPhoneFormat(phone);
      const existing = await trpcUtils.business.checkByPhone.fetch({ phone: rawPhone });
      if (existing) {
        // Business owner already exists – load their data and go to home
        dispatch({ type: "SET_BUSINESS_OWNER_ID", payload: existing.id });
        await AsyncStorage.setItem("@bookease_business_owner_id", String(existing.id));
        // Load full data from DB
        const fullData = await trpcUtils.business.getFullData.fetch({ id: existing.id });
        if (fullData && fullData.owner) {
          const settingsFromDb = ownerToSettings(fullData.owner);
          dispatch({
            type: "LOAD_DATA",
            payload: {
              services: (fullData.services || []).map(dbServiceToLocal),
              clients: (fullData.clients || []).map(dbClientToLocal),
              appointments: (fullData.appointments || []).map(dbAppointmentToLocal),
              reviews: (fullData.reviews || []).map(dbReviewToLocal),
              settings: settingsFromDb,
              businessOwnerId: existing.id,
            },
          });
        }
        router.replace("/(tabs)");
        return;
      }
    } catch (err) {
      console.warn("[Onboarding] Phone check failed, continuing to step 2:", err);
    } finally {
      setLoading(false);
    }
    setBusinessPhone(phone);
    setStep(2);
  };

  const handleComplete = async () => {
    if (!businessName.trim()) return;
    setLoading(true);
    try {
      const rawPhone = stripPhoneFormat(businessPhone.trim() || phone.trim());
      // Create business owner in database
      const newOwner = await createBusinessMut.mutateAsync({
        phone: rawPhone,
        businessName: businessName.trim(),
        email: email.trim() || undefined,
        address: address.trim() || undefined,
        website: website.trim() || undefined,
        description: description.trim() || undefined,
        workingHours: DEFAULT_WORKING_HOURS,
        cancellationPolicy: DEFAULT_CANCELLATION_POLICY,
      });

      // Store the business owner ID
      dispatch({ type: "SET_BUSINESS_OWNER_ID", payload: newOwner.id });
      await AsyncStorage.setItem("@bookease_business_owner_id", String(newOwner.id));

      // Update local settings
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
    } catch (err) {
      console.warn("[Onboarding] Failed to create business:", err);
      // Fallback: save locally only
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
    } finally {
      setLoading(false);
    }
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
                  editable={!loading}
                />
              </View>

              <Pressable
                onPress={handlePhoneNext}
                style={({ pressed }) => [
                  styles.primaryBtn,
                  {
                    backgroundColor: phone.trim() && !loading ? colors.primary : colors.muted,
                    opacity: pressed && phone.trim() && !loading ? 0.8 : 1,
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
                  editable={!loading}
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
                  editable={!loading}
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
                  editable={!loading}
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
                  editable={!loading}
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
                  editable={!loading}
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
                  editable={!loading}
                />
              </View>

              <View style={styles.buttonRow}>
                <Pressable
                  onPress={() => setStep(1)}
                  style={({ pressed }) => [
                    styles.secondaryBtn,
                    { borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
                  ]}
                  disabled={loading}
                >
                  <Text style={[styles.secondaryBtnText, { color: colors.foreground }]}>Back</Text>
                </Pressable>
                <Pressable
                  onPress={handleComplete}
                  style={({ pressed }) => [
                    styles.primaryBtn,
                    {
                      flex: 1,
                      backgroundColor: businessName.trim() && !loading ? colors.primary : colors.muted,
                      opacity: pressed && businessName.trim() && !loading ? 0.8 : 1,
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
            </View>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

// ─── DB conversion helpers (duplicated for onboarding isolation) ─────

function ownerToSettings(owner: any) {
  return {
    businessName: owner.businessName,
    defaultDuration: owner.defaultDuration ?? 60,
    notificationsEnabled: owner.notificationsEnabled ?? true,
    themeMode: owner.themeMode ?? "system",
    temporaryClosed: owner.temporaryClosed ?? false,
    onboardingComplete: owner.onboardingComplete ?? false,
    businessLogoUri: owner.businessLogoUri ?? "",
    workingHours: owner.workingHours ?? DEFAULT_WORKING_HOURS,
    cancellationPolicy: owner.cancellationPolicy ?? DEFAULT_CANCELLATION_POLICY,
    profile: {
      ownerName: owner.ownerName ?? "",
      phone: owner.phone ?? "",
      email: owner.email ?? "",
      address: owner.address ?? "",
      description: owner.description ?? "",
      website: owner.website ?? "",
    },
  };
}

function dbServiceToLocal(s: any) {
  return {
    id: s.localId,
    name: s.name,
    duration: s.duration,
    price: typeof s.price === "string" ? parseFloat(s.price) : s.price,
    color: s.color,
    createdAt: s.createdAt ? new Date(s.createdAt).toISOString() : new Date().toISOString(),
  };
}

function dbClientToLocal(c: any) {
  return {
    id: c.localId,
    name: c.name,
    phone: c.phone ?? "",
    email: c.email ?? "",
    notes: c.notes ?? "",
    createdAt: c.createdAt ? new Date(c.createdAt).toISOString() : new Date().toISOString(),
  };
}

function dbAppointmentToLocal(a: any) {
  return {
    id: a.localId,
    serviceId: a.serviceLocalId,
    clientId: a.clientLocalId,
    date: a.date,
    time: a.time,
    duration: a.duration,
    status: a.status,
    notes: a.notes ?? "",
    createdAt: a.createdAt ? new Date(a.createdAt).toISOString() : new Date().toISOString(),
  };
}

function dbReviewToLocal(r: any) {
  return {
    id: r.localId,
    clientId: r.clientLocalId,
    appointmentId: r.appointmentLocalId ?? undefined,
    rating: r.rating,
    comment: r.comment ?? "",
    createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : new Date().toISOString(),
  };
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
