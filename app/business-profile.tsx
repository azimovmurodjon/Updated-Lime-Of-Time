import { useState, useCallback, useRef } from "react";
import {
  Text,
  View,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  Alert,
  Linking,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useStore } from "@/lib/store";
import { useColors } from "@/hooks/use-colors";
import { useResponsive } from "@/hooks/use-responsive";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { formatPhoneNumber, stripPhoneFormat } from "@/lib/types";

// ─── Field wrapper ────────────────────────────────────────────────────────────
// IMPORTANT: defined OUTSIDE the screen component so its identity is stable
// across re-renders. If defined inside, React unmounts/remounts it on every
// keystroke (because the function reference changes), which dismisses the keyboard.
type FieldProps = {
  label: string;
  required?: boolean;
  error?: string;
  errorColor: string;
  foregroundColor: string;
  children: React.ReactNode;
};

function Field({ label, required, error, errorColor, foregroundColor, children }: FieldProps) {
  return (
    <View style={styles.fieldWrapper}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 6 }}>
        <Text style={[styles.fieldLabel, { color: foregroundColor }]}>{label}</Text>
        {required && <Text style={{ fontSize: 12, color: errorColor }}>*</Text>}
      </View>
      {children}
      {!!error && (
        <View style={styles.errorRow}>
          <IconSymbol name="exclamationmark.triangle.fill" size={12} color={errorColor} />
          <Text style={[styles.errorText, { color: errorColor }]}>{error}</Text>
        </View>
      )}
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function BusinessProfileScreen() {
  const { state, dispatch, syncToDb } = useStore();
  const colors = useColors();
  const router = useRouter();
  const { isTablet, hp } = useResponsive();
  const contentMaxWidth = isTablet ? 640 : undefined;

  const profile = state.settings.profile;

  const [businessName, setBusinessName] = useState(state.settings.businessName);
  const [ownerName, setOwnerName] = useState(profile.ownerName ?? "");
  const [phone, setPhone] = useState(formatPhoneNumber(profile.phone || ""));
  const [email, setEmail] = useState(profile.email ?? "");
  const [website, setWebsite] = useState(profile.website ?? "");
  const [description, setDescription] = useState(profile.description ?? "");

  const [errors, setErrors] = useState<Record<string, string>>({});

  const ownerRef = useRef<TextInput>(null);
  const phoneRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);
  const websiteRef = useRef<TextInput>(null);
  const descRef = useRef<TextInput>(null);

  const validate = useCallback(() => {
    const newErrors: Record<string, string> = {};
    if (!businessName.trim()) newErrors.businessName = "Business name is required.";
    if (!phone.trim()) {
      newErrors.phone = "Phone number is required.";
    } else if (stripPhoneFormat(phone).length < 10) {
      newErrors.phone = "Please enter a valid 10-digit phone number.";
    }
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      newErrors.email = "Please enter a valid email address.";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [businessName, phone, email]);

  const handleSave = useCallback(() => {
    if (!validate()) return;
    const settingsAction = {
      type: "UPDATE_SETTINGS" as const,
      payload: {
        businessName: businessName.trim(),
        profile: {
          ...profile,
          ownerName: ownerName.trim(),
          phone: phone.trim(),
          email: email.trim(),
          website: website.trim(),
          description: description.trim(),
        },
      },
    };
    dispatch(settingsAction);
    syncToDb(settingsAction);
    router.back();
  }, [businessName, ownerName, phone, email, website, description, profile, dispatch, syncToDb, router, validate]);

  const openWebsite = useCallback(() => {
    const url = website.startsWith("http") ? website : `https://${website}`;
    Linking.openURL(url).catch(() => Alert.alert("Error", "Could not open website."));
  }, [website]);

  return (
    <ScreenContainer edges={["top", "left", "right"]} tabletMaxWidth={720} style={{ paddingHorizontal: hp }}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backBtn, { opacity: pressed ? 0.6 : 1 }]}
        >
          <IconSymbol name="arrow.left" size={22} color={colors.foreground} />
        </Pressable>
        <Text style={{ fontSize: 20, fontWeight: "700", color: colors.foreground, flex: 1 }}>
          Business Profile
        </Text>
        <Pressable
          onPress={handleSave}
          style={({ pressed }) => [
            styles.saveBtn,
            { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 },
          ]}
        >
          <Text style={{ color: "#FFFFFF", fontWeight: "600", fontSize: 14 }}>Save</Text>
        </Pressable>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 100, alignItems: contentMaxWidth ? "center" : undefined }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ width: "100%", maxWidth: contentMaxWidth }}>
            <Text style={[styles.requiredNote, { color: colors.muted }]}>
              Fields marked with <Text style={{ color: colors.error }}>*</Text> are required.
            </Text>

            {/* Business Name */}
            <Field
              label="Business Name"
              required
              error={errors.businessName}
              errorColor={colors.error}
              foregroundColor={colors.foreground}
            >
              <TextInput
                value={businessName}
                onChangeText={(v) => { setBusinessName(v); setErrors((e) => ({ ...e, businessName: "" })); }}
                placeholder="e.g. Lime of Time"
                placeholderTextColor={colors.muted}
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.background,
                    borderColor: errors.businessName ? colors.error : colors.border,
                    color: colors.foreground,
                  },
                ]}
                returnKeyType="next"
                blurOnSubmit={false}
                onSubmitEditing={() => ownerRef.current?.focus()}
              />
            </Field>

            {/* Owner Name */}
            <Field
              label="Owner Name (optional)"
              error={errors.ownerName}
              errorColor={colors.error}
              foregroundColor={colors.foreground}
            >
              <TextInput
                ref={ownerRef}
                value={ownerName}
                onChangeText={(v) => { setOwnerName(v); setErrors((e) => ({ ...e, ownerName: "" })); }}
                placeholder="e.g. Jane Smith"
                placeholderTextColor={colors.muted}
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.background,
                    borderColor: errors.ownerName ? colors.error : colors.border,
                    color: colors.foreground,
                  },
                ]}
                returnKeyType="next"
                blurOnSubmit={false}
                onSubmitEditing={() => phoneRef.current?.focus()}
              />
            </Field>

            {/* Phone */}
            <Field
              label="Phone"
              required
              error={errors.phone}
              errorColor={colors.error}
              foregroundColor={colors.foreground}
            >
              <TextInput
                ref={phoneRef}
                value={phone}
                onChangeText={(v) => { setPhone(formatPhoneNumber(v)); setErrors((e) => ({ ...e, phone: "" })); }}
                placeholder="(000) 000-0000"
                placeholderTextColor={colors.muted}
                keyboardType="phone-pad"
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.background,
                    borderColor: errors.phone ? colors.error : colors.border,
                    color: colors.foreground,
                  },
                ]}
                returnKeyType="next"
                blurOnSubmit={false}
                onSubmitEditing={() => emailRef.current?.focus()}
              />
            </Field>

            {/* Email */}
            <Field
              label="Email (optional)"
              error={errors.email}
              errorColor={colors.error}
              foregroundColor={colors.foreground}
            >
              <TextInput
                ref={emailRef}
                value={email}
                onChangeText={(v) => { setEmail(v); setErrors((e) => ({ ...e, email: "" })); }}
                placeholder="hello@yourbusiness.com"
                placeholderTextColor={colors.muted}
                keyboardType="email-address"
                autoCapitalize="none"
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.background,
                    borderColor: errors.email ? colors.error : colors.border,
                    color: colors.foreground,
                  },
                ]}
                returnKeyType="next"
                blurOnSubmit={false}
                onSubmitEditing={() => websiteRef.current?.focus()}
              />
            </Field>

            {/* Website */}
            <Field
              label="Website (optional)"
              errorColor={colors.error}
              foregroundColor={colors.foreground}
            >
              <View style={styles.websiteRow}>
                <TextInput
                  ref={websiteRef}
                  value={website}
                  onChangeText={setWebsite}
                  placeholder="https://www.yourbusiness.com"
                  placeholderTextColor={colors.muted}
                  autoCapitalize="none"
                  keyboardType="url"
                  style={[
                    styles.input,
                    {
                      flex: 1,
                      backgroundColor: colors.background,
                      borderColor: colors.border,
                      color: colors.foreground,
                    },
                  ]}
                  returnKeyType="next"
                  blurOnSubmit={false}
                  onSubmitEditing={() => descRef.current?.focus()}
                />
                {!!website.trim() && (
                  <Pressable
                    onPress={openWebsite}
                    style={({ pressed }) => [
                      styles.websiteOpenBtn,
                      { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.6 : 1 },
                    ]}
                  >
                    <IconSymbol name="arrow.up.right.square" size={18} color={colors.primary} />
                  </Pressable>
                )}
              </View>
            </Field>

            {/* Description */}
            <Field
              label="Description (optional)"
              errorColor={colors.error}
              foregroundColor={colors.foreground}
            >
              <TextInput
                ref={descRef}
                value={description}
                onChangeText={setDescription}
                placeholder="Tell clients about your business, specialties, and what makes you unique..."
                placeholderTextColor={colors.muted}
                multiline
                numberOfLines={4}
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                    color: colors.foreground,
                    minHeight: 100,
                    textAlignVertical: "top",
                    paddingTop: 12,
                  },
                ]}
              />
            </Field>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 8,
    paddingBottom: 16,
    gap: 12,
  },
  backBtn: {
    padding: 4,
  },
  saveBtn: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
  },
  requiredNote: {
    fontSize: 12,
    marginBottom: 16,
    marginTop: 4,
  },
  fieldWrapper: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "600",
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  errorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 5,
  },
  errorText: {
    fontSize: 12,
  },
  websiteRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  websiteOpenBtn: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
  },
});
