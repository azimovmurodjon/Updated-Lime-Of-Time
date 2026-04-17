import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  Linking,
  Alert,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useStore } from "@/lib/store";
import { useColors } from "@/hooks/use-colors";
import { useRouter } from "expo-router";
import { IconSymbol } from "@/components/ui/icon-symbol";
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";
import { FuturisticBackground } from "@/components/futuristic-background";


export default function SocialLinksScreen() {
  const { state, dispatch, syncToDb } = useStore();
  const colors = useColors();
  const router = useRouter();
  const settings = state.settings;

  const [instagram, setInstagram] = useState(settings.instagramHandle ?? "");
  const [facebook, setFacebook] = useState(settings.facebookHandle ?? "");
  const [tiktok, setTiktok] = useState(settings.tiktokHandle ?? "");
  const [saved, setSaved] = useState(false);

  const handleSave = useCallback(() => {
    const action = {
      type: "UPDATE_SETTINGS" as const,
      payload: {
        instagramHandle: instagram.replace(/^@/, "").trim(),
        facebookHandle: facebook.trim(),
        tiktokHandle: tiktok.replace(/^@/, "").trim(),
      },
    };
    dispatch(action);
    syncToDb(action);
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }, [instagram, facebook, tiktok, dispatch, syncToDb]);

  const openLink = useCallback((url: string) => {
    Linking.openURL(url).catch(() => Alert.alert("Cannot open URL", url));
  }, []);

  const SOCIAL_FIELDS: {
    key: "instagram" | "facebook" | "tiktok";
    label: string;
    placeholder: string;
    prefix: string;
    icon: any;
    color: string;
    buildUrl: (handle: string) => string;
    value: string;
    setter: (v: string) => void;
  }[] = [
    {
      key: "instagram",
      label: "Instagram",
      placeholder: "your_handle",
      prefix: "@",
      icon: "camera.fill" as const,
      color: "#E1306C",
      buildUrl: (h) => `https://instagram.com/${h}`,
      value: instagram,
      setter: setInstagram,
    },
    {
      key: "facebook",
      label: "Facebook",
      placeholder: "YourPageName",
      prefix: "fb.com/",
      icon: "person.2.fill" as const,
      color: "#1877F2",
      buildUrl: (h) => `https://facebook.com/${h}`,
      value: facebook,
      setter: setFacebook,
    },
    {
      key: "tiktok",
      label: "TikTok",
      placeholder: "your_handle",
      prefix: "@",
      icon: "music.note" as const,
      color: "#010101",
      buildUrl: (h) => `https://tiktok.com/@${h}`,
      value: tiktok,
      setter: setTiktok,
    },
  ];

  return (
    <ScreenContainer>
      <FuturisticBackground />
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backBtn, { opacity: pressed ? 0.6 : 1 }]}
        >
          <IconSymbol name="chevron.left" size={20} color={colors.primary} />
          <Text style={[styles.backLabel, { color: colors.primary }]}>Settings</Text>
        </Pressable>
        <Text style={[styles.title, { color: colors.foreground }]}>Social Links</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={[styles.sectionDesc, { color: colors.muted }]}>
          Add your social media handles to display tap-to-open icons on your public booking page footer.
        </Text>

        {SOCIAL_FIELDS.map((field) => (
          <View key={field.key} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.cardHeader}>
              <View style={[styles.iconBadge, { backgroundColor: field.color + "18" }]}>
                <IconSymbol name={field.icon} size={20} color={field.color} />
              </View>
              <Text style={[styles.cardLabel, { color: colors.foreground }]}>{field.label}</Text>
              {field.value.trim() !== "" && (
                <Pressable
                  onPress={() => openLink(field.buildUrl(field.value.replace(/^@/, "").trim()))}
                  style={({ pressed }) => [styles.previewBtn, { opacity: pressed ? 0.6 : 1, backgroundColor: field.color + "15" }]}
                >
                  <Text style={[styles.previewBtnText, { color: field.color }]}>Preview ↗</Text>
                </Pressable>
              )}
            </View>
            <View style={[styles.inputRow, { borderColor: colors.border, backgroundColor: colors.background }]}>
              <Text style={[styles.prefix, { color: colors.muted }]}>{field.prefix}</Text>
              <TextInput
                style={[styles.input, { color: colors.foreground }]}
                value={field.value}
                onChangeText={field.setter}
                placeholder={field.placeholder}
                placeholderTextColor={colors.muted}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="done"
              />
            </View>
          </View>
        ))}

        <Pressable
          onPress={handleSave}
          style={({ pressed }) => [
            styles.saveBtn,
            { backgroundColor: saved ? "#22C55E" : colors.primary, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Text style={styles.saveBtnText}>{saved ? "Saved ✓" : "Save Social Links"}</Text>
        </Pressable>

        <View style={styles.note}>
          <IconSymbol name="info.circle.fill" size={14} color={colors.muted} />
          <Text style={[styles.noteText, { color: colors.muted }]}>
            These links will appear as icons at the bottom of your public booking page so clients can follow you.
          </Text>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    minWidth: 80,
  },
  backLabel: {
    fontSize: 16,
  },
  title: {
    fontSize: 17,
    fontWeight: "600",
  },
  scroll: {
    padding: 16,
    gap: 12,
    paddingBottom: 40,
  },
  sectionDesc: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 4,
  },
  card: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    gap: 10,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  iconBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  cardLabel: {
    fontSize: 15,
    fontWeight: "600",
    flex: 1,
  },
  previewBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  previewBtnText: {
    fontSize: 12,
    fontWeight: "600",
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
  },
  prefix: {
    fontSize: 15,
  },
  input: {
    flex: 1,
    fontSize: 15,
    padding: 0,
  },
  saveBtn: {
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 8,
  },
  saveBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  note: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    marginTop: 4,
  },
  noteText: {
    fontSize: 12,
    lineHeight: 18,
    flex: 1,
  },
});
