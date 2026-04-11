import { useState, useCallback } from "react";
import {
  Text,
  View,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  Alert,
  useWindowDimensions,
  Linking,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useStore } from "@/lib/store";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { formatPhoneNumber, stripPhoneFormat } from "@/lib/types";

export default function BusinessProfileScreen() {
  const { state, dispatch, syncToDb } = useStore();
  const colors = useColors();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const hp = isTablet ? 32 : Math.max(16, width * 0.05);
  const contentMaxWidth = isTablet ? 640 : undefined;

  const profile = state.settings.profile;

  const [businessName, setBusinessName] = useState(state.settings.businessName);
  const [ownerName, setOwnerName] = useState(profile.ownerName);
  const [phone, setPhone] = useState(profile.phone);
  const [email, setEmail] = useState(profile.email);
  const [website, setWebsite] = useState(profile.website);
  const [description, setDescription] = useState(profile.description);

  // Inline validation errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!businessName.trim()) newErrors.businessName = "Business name is required.";
    // ownerName is optional
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
  };

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
  }, [businessName, ownerName, phone, email, website, description, profile, dispatch, syncToDb, router]);

  const openWebsite = () => {
    const url = website.startsWith("http") ? website : `https://${website}`;
    Linking.openURL(url).catch(() => Alert.alert("Error", "Could not open website."));
  };

  const Field = ({
    label,
    required,
    error,
    children,
  }: {
    label: string;
    required?: boolean;
    error?: string;
    children: React.ReactNode;
  }) => (
    <View style={styles.fieldWrapper}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 6 }}>
        <Text style={[styles.fieldLabel, { color: colors.foreground }]}>{label}</Text>
        {required && <Text style={{ fontSize: 12, color: colors.error }}>*</Text>}
      </View>
      {children}
      {!!error && (
        <View style={styles.errorRow}>
          <IconSymbol name="exclamationmark.triangle.fill" size={12} color={colors.error} />
          <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
        </View>
      )}
    </View>
  );

  return (
    <ScreenContainer edges={["top", "left", "right"]} style={{ paddingHorizontal: hp }}>
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

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100, alignItems: contentMaxWidth ? "center" : undefined }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ width: "100%", maxWidth: contentMaxWidth }}>
          {/* Required fields note */}
          <Text style={[styles.requiredNote, { color: colors.muted }]}>
            Fields marked with <Text style={{ color: colors.error }}>*</Text> are required.
          </Text>

          {/* Business Name */}
          <Field label="Business Name" required error={errors.businessName}>
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
            />
          </Field>

          {/* Owner Name */}
          <Field label="Owner Name (optional)" error={errors.ownerName}>
            <TextInput
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
            />
          </Field>

          {/* Phone */}
          <Field label="Phone" required error={errors.phone}>
            <TextInput
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
            />
          </Field>

          {/* Email */}
          <Field label="Email (optional)" error={errors.email}>
            <TextInput
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
            />
          </Field>

          {/* Website */}
          <Field label="Website (optional)">
            <View style={styles.websiteRow}>
              <TextInput
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
          <Field label="Description (optional)">
            <TextInput
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
