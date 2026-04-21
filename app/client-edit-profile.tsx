/**
 * Client Edit Profile Screen
 *
 * Allows signed-in clients to update their Full Name, Email, Birthday (MM/DD),
 * and Profile Photo. Accessed from the "Edit Profile" button in the Client Portal
 * profile tab. Saves via PATCH /api/client/profile.
 */
import React, { useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Image,
  Platform,
  Alert,
  KeyboardAvoidingView,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useClientStore } from "@/lib/client-store";
import { getApiBaseUrl } from "@/constants/oauth";
import { useColors } from "@/hooks/use-colors";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as Haptics from "expo-haptics";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useSafeAreaInsets } from "react-native-safe-area-context";

function formatBirthday(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

function formatPhoneDisplay(phone: string | null): string {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  if (digits.length === 11 && digits[0] === "1") {
    const d = digits.slice(1);
    return `+1 (${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  }
  return phone;
}

export default function ClientEditProfileScreen() {
  const router = useRouter();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { state, signIn } = useClientStore();

  const account = state.account;

  const [name, setName] = useState(account?.name ?? "");
  const [email, setEmail] = useState(account?.email ?? "");
  const [birthday, setBirthday] = useState(account?.birthday ?? "");
  const [photoUri, setPhotoUri] = useState<string | null>(account?.profilePhotoUri ?? null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const emailRef = useRef<TextInput>(null);
  const token = state.sessionToken;

  const handlePickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Please allow access to your photo library.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const handleRemovePhoto = () => {
    Alert.alert("Remove Photo", "Are you sure you want to remove your profile photo?", [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => setPhotoUri(null) },
    ]);
  };

  const uploadPhoto = async (uri: string): Promise<string | null> => {
    try {
      setUploading(true);
      const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
      const filename = uri.split("/").pop() ?? "photo.jpg";
      const ext = filename.split(".").pop()?.toLowerCase() ?? "jpg";
      const mimeType = ext === "png" ? "image/png" : "image/jpeg";
      const apiBase = getApiBaseUrl();
      const res = await fetch(`${apiBase}/api/client/upload-photo`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ base64, mimeType }),
      });
      if (!res.ok) return null;
      const data = await res.json() as { url: string };
      return data.url;
    } catch {
      return null;
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) { setError("Please enter your full name."); return; }
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Please enter a valid email address.");
      return;
    }
    if (birthday && !/^\d{2}\/\d{2}$/.test(birthday)) {
      setError("Birthday should be in MM/DD format (e.g. 03/15).");
      return;
    }

    setSaving(true);
    setError("");
    try {
      let finalPhotoUri = account?.profilePhotoUri ?? null;

      if (photoUri === null) {
        // User explicitly removed photo
        finalPhotoUri = null;
      } else if (photoUri && photoUri.startsWith("file")) {
        // New local photo — upload it
        const uploaded = await uploadPhoto(photoUri);
        if (uploaded) finalPhotoUri = uploaded;
        // If upload fails, keep old photo
      } else if (photoUri) {
        finalPhotoUri = photoUri; // already a remote URL, unchanged
      }

      const body: Record<string, string | null> = {
        name: trimmedName,
        email: email.trim() || null,
        birthday: birthday || null,
        profilePhotoUri: finalPhotoUri,
      };

      const apiBase = getApiBaseUrl();
      const res = await fetch(`${apiBase}/api/client/profile`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error("Failed to save profile.");
      const data = await res.json() as { clientAccount: any };

      await signIn(data.clientAccount, token!);

      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (e: any) {
      setError(e.message ?? "Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (!account) {
    return (
      <ScreenContainer className="px-6">
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: colors.muted }}>Not signed in.</Text>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer edges={["top", "left", "right"]}>
      {/* Navigation Bar */}
      <View style={[styles.navBar, { borderBottomColor: colors.border }]}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.navBack, { opacity: pressed ? 0.6 : 1 }]}
        >
          <IconSymbol name="chevron.left" size={18} color={colors.foreground} />
          <Text style={[styles.navBackText, { color: colors.foreground }]}>Back</Text>
        </Pressable>
        <Text style={[styles.navTitle, { color: colors.foreground }]}>Edit Profile</Text>
        <Pressable
          onPress={handleSave}
          disabled={saving || uploading}
          style={({ pressed }) => [styles.navSave, { opacity: pressed || saving || uploading ? 0.6 : 1 }]}
        >
          {saving || uploading ? (
            <ActivityIndicator size="small" color="#8B5CF6" />
          ) : (
            <Text style={styles.navSaveText}>Save</Text>
          )}
        </Pressable>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Profile Photo */}
          <View style={styles.photoSection}>
            <View style={styles.photoWrap}>
              {photoUri ? (
                <Image source={{ uri: photoUri }} style={styles.photoImage} />
              ) : (
                <View style={[styles.photoPlaceholder, { backgroundColor: "#8B5CF620", borderColor: "#8B5CF640" }]}>
                  <Text style={[styles.photoInitial, { color: "#8B5CF6" }]}>
                    {(account.name ?? "?").charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
              {/* Camera badge */}
              <Pressable
                onPress={handlePickPhoto}
                style={({ pressed }) => [styles.cameraBadge, { opacity: pressed ? 0.8 : 1 }]}
              >
                <Text style={{ fontSize: 14 }}>📷</Text>
              </Pressable>
            </View>

            <View style={styles.photoBtns}>
              <Pressable
                onPress={handlePickPhoto}
                style={({ pressed }) => [styles.photoChangeBtn, { borderColor: "#8B5CF6", opacity: pressed ? 0.7 : 1 }]}
              >
                <Text style={[styles.photoChangeBtnText, { color: "#8B5CF6" }]}>Change Photo</Text>
              </Pressable>
              {photoUri && (
                <Pressable
                  onPress={handleRemovePhoto}
                  style={({ pressed }) => [styles.photoRemoveBtn, { opacity: pressed ? 0.7 : 1 }]}
                >
                  <Text style={[styles.photoRemoveBtnText, { color: colors.error }]}>Remove</Text>
                </Pressable>
              )}
            </View>
          </View>

          {/* Form Card */}
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {/* Full Name */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: colors.muted }]}>FULL NAME <Text style={{ color: colors.error }}>*</Text></Text>
              <TextInput
                style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background }]}
                placeholder="e.g. Jane Smith"
                placeholderTextColor={colors.muted}
                value={name}
                onChangeText={(t) => { setName(t); setError(""); }}
                returnKeyType="next"
                onSubmitEditing={() => emailRef.current?.focus()}
                autoCapitalize="words"
                autoCorrect={false}
              />
            </View>

            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            {/* Phone (read-only) */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: colors.muted }]}>PHONE NUMBER</Text>
              <View style={[styles.input, styles.inputReadOnly, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                <Text style={[styles.inputReadOnlyText, { color: colors.foreground }]}>
                  {formatPhoneDisplay(account.phone)}
                </Text>
                <View style={[styles.verifiedBadge, { backgroundColor: colors.success + "20" }]}>
                  <Text style={[styles.verifiedText, { color: colors.success }]}>✓ Verified</Text>
                </View>
              </View>
              <Text style={[styles.fieldHint, { color: colors.muted }]}>Phone number cannot be changed here</Text>
            </View>

            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            {/* Email */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: colors.muted }]}>EMAIL <Text style={[styles.optional, { color: colors.muted }]}>(optional)</Text></Text>
              <TextInput
                ref={emailRef}
                style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background }]}
                placeholder="you@example.com"
                placeholderTextColor={colors.muted}
                value={email}
                onChangeText={(t) => { setEmail(t); setError(""); }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
              />
            </View>

            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            {/* Birthday */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: colors.muted }]}>BIRTHDAY <Text style={[styles.optional, { color: colors.muted }]}>(optional)</Text></Text>
              <TextInput
                style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background }]}
                placeholder="MM/DD  (e.g. 03/15)"
                placeholderTextColor={colors.muted}
                value={birthday}
                onChangeText={(t) => { setBirthday(formatBirthday(t)); setError(""); }}
                keyboardType="number-pad"
                maxLength={5}
                returnKeyType="done"
              />
              <Text style={[styles.fieldHint, { color: colors.muted }]}>
                Businesses may send you birthday discounts
              </Text>
            </View>
          </View>

          {/* Error */}
          {error ? (
            <View style={[styles.errorBanner, { backgroundColor: colors.error + "15", borderColor: colors.error + "40" }]}>
              <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
            </View>
          ) : null}

          {/* Save Button */}
          <Pressable
            onPress={handleSave}
            disabled={saving || uploading}
            style={({ pressed }) => [
              styles.saveBtn,
              { opacity: pressed || saving || uploading ? 0.85 : 1 },
            ]}
          >
            {saving || uploading ? (
              <ActivityIndicator color="#FFF" size="small" />
            ) : (
              <Text style={styles.saveBtnText}>Save Changes</Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  navBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
  },
  navBack: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    minWidth: 64,
  },
  navBackText: {
    fontSize: 16,
    fontWeight: "500",
  },
  navTitle: {
    fontSize: 17,
    fontWeight: "700",
  },
  navSave: {
    minWidth: 64,
    alignItems: "flex-end",
  },
  navSaveText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#8B5CF6",
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingTop: 24,
    gap: 16,
  },
  // ─── Photo ──────────────────────────────────────────────────────────────────
  photoSection: {
    alignItems: "center",
    gap: 14,
  },
  photoWrap: {
    position: "relative",
    width: 100,
    height: 100,
  },
  photoImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2.5,
    borderColor: "#8B5CF6",
  },
  photoPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
  },
  photoInitial: {
    fontSize: 36,
    fontWeight: "700",
  },
  cameraBadge: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#8B5CF6",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  photoBtns: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  photoChangeBtn: {
    borderWidth: 1.5,
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  photoChangeBtnText: {
    fontSize: 14,
    fontWeight: "600",
  },
  photoRemoveBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  photoRemoveBtnText: {
    fontSize: 14,
    fontWeight: "500",
  },
  // ─── Form ───────────────────────────────────────────────────────────────────
  card: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
    paddingVertical: 4,
  },
  fieldGroup: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 6,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  optional: {
    fontWeight: "400",
    textTransform: "none",
    letterSpacing: 0,
    fontSize: 11,
  },
  input: {
    height: 48,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 16,
  },
  inputReadOnly: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  inputReadOnlyText: {
    fontSize: 16,
    fontWeight: "500",
  },
  verifiedBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  verifiedText: {
    fontSize: 11,
    fontWeight: "700",
  },
  fieldHint: {
    fontSize: 12,
    lineHeight: 16,
  },
  divider: {
    height: 1,
    marginHorizontal: 16,
  },
  // ─── Error ──────────────────────────────────────────────────────────────────
  errorBanner: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
  },
  errorText: {
    fontSize: 13,
    fontWeight: "500",
    textAlign: "center",
  },
  // ─── Save Button ─────────────────────────────────────────────────────────────
  saveBtn: {
    height: 54,
    backgroundColor: "#8B5CF6",
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#8B5CF6",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  saveBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: 0.2,
  },
});
