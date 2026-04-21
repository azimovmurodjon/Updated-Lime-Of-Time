/**
 * Client Portal — Sign In Screen
 *
 * Allows clients to sign in using Apple, Google, or Microsoft OAuth.
 * After sign-in the OAuth callback routes to /(client-tabs).
 */

import React, { useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { setProfileMode } from "@/lib/client-store";
import { startOAuthLogin } from "@/constants/oauth";
import { IconSymbol } from "@/components/ui/icon-symbol";
import * as Haptics from "expo-haptics";

export default function ClientSignInScreen() {
  const colors = useColors();
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  const handleOAuth = async (provider: "apple" | "google" | "microsoft") => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLoading(provider);
    // Ensure profile mode is set to client before OAuth so callback routes correctly
    await setProfileMode("client");
    await startOAuthLogin(provider);
    // On native, the deep link callback will handle the rest
    // On web, the page redirects so we won't reach here
    setLoading(null);
  };

  const s = styles(colors);

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]} className="px-6">
      <View style={s.container}>
        {/* Back button */}
        <Pressable
          style={({ pressed }) => [s.backBtn, pressed && { opacity: 0.7 }]}
          onPress={() => router.back()}
        >
          <IconSymbol name="chevron.left" size={20} color={colors.foreground} />
          <Text style={[s.backText, { color: colors.foreground }]}>Back</Text>
        </Pressable>

        {/* Header */}
        <View style={s.header}>
          <View style={[s.iconCircle, { backgroundColor: "#8B5CF615" }]}>
            <IconSymbol name="person.crop.circle.fill" size={44} color="#8B5CF6" />
          </View>
          <Text style={[s.title, { color: colors.foreground }]}>Sign In</Text>
          <Text style={[s.subtitle, { color: colors.muted }]}>
            Create your free client account to book appointments and manage your schedule.
          </Text>
        </View>

        {/* OAuth Buttons */}
        <View style={s.buttons}>
          {/* Apple */}
          {Platform.OS !== "android" && (
            <Pressable
              style={({ pressed }) => [
                s.oauthBtn,
                { backgroundColor: colors.foreground },
                pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] },
                loading === "apple" && { opacity: 0.7 },
              ]}
              onPress={() => handleOAuth("apple")}
              disabled={loading !== null}
            >
              {loading === "apple" ? (
                <ActivityIndicator color={colors.background} size="small" />
              ) : (
                <IconSymbol name="apple.logo" size={20} color={colors.background} />
              )}
              <Text style={[s.oauthBtnText, { color: colors.background }]}>Continue with Apple</Text>
            </Pressable>
          )}

          {/* Google */}
          <Pressable
            style={({ pressed }) => [
              s.oauthBtn,
              { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
              pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] },
              loading === "google" && { opacity: 0.7 },
            ]}
            onPress={() => handleOAuth("google")}
            disabled={loading !== null}
          >
            {loading === "google" ? (
              <ActivityIndicator color={colors.foreground} size="small" />
            ) : (
              <Text style={{ fontSize: 18, fontWeight: "700", color: "#4285F4" }}>G</Text>
            )}
            <Text style={[s.oauthBtnText, { color: colors.foreground }]}>Continue with Google</Text>
          </Pressable>

          {/* Microsoft */}
          <Pressable
            style={({ pressed }) => [
              s.oauthBtn,
              { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
              pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] },
              loading === "microsoft" && { opacity: 0.7 },
            ]}
            onPress={() => handleOAuth("microsoft")}
            disabled={loading !== null}
          >
            {loading === "microsoft" ? (
              <ActivityIndicator color={colors.foreground} size="small" />
            ) : (
              <Text style={{ fontSize: 16, fontWeight: "700", color: "#0078D4" }}>M</Text>
            )}
            <Text style={[s.oauthBtnText, { color: colors.foreground }]}>Continue with Microsoft</Text>
          </Pressable>
        </View>

        {/* Browse without account */}
        <Pressable
          style={({ pressed }) => [s.skipBtn, pressed && { opacity: 0.7 }]}
          onPress={() => router.replace("/(client-tabs)" as any)}
        >
          <Text style={[s.skipText, { color: colors.muted }]}>Browse without signing in</Text>
        </Pressable>

        <Text style={[s.terms, { color: colors.muted }]}>
          By continuing you agree to our Terms of Service and Privacy Policy.
        </Text>
      </View>
    </ScreenContainer>
  );
}

const styles = (colors: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      paddingTop: 8,
    },
    backBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      marginBottom: 24,
      alignSelf: "flex-start",
    },
    backText: {
      fontSize: 16,
    },
    header: {
      alignItems: "center",
      marginBottom: 40,
      gap: 12,
    },
    iconCircle: {
      width: 88,
      height: 88,
      borderRadius: 44,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 8,
    },
    title: {
      fontSize: 30,
      fontWeight: "700",
    },
    subtitle: {
      fontSize: 15,
      textAlign: "center",
      lineHeight: 22,
      maxWidth: 300,
    },
    buttons: {
      gap: 12,
    },
    oauthBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 12,
      paddingVertical: 15,
      borderRadius: 14,
    },
    oauthBtnText: {
      fontSize: 16,
      fontWeight: "600",
    },
    skipBtn: {
      alignItems: "center",
      marginTop: 24,
      paddingVertical: 8,
    },
    skipText: {
      fontSize: 14,
    },
    terms: {
      fontSize: 11,
      textAlign: "center",
      lineHeight: 16,
      marginTop: 16,
    },
  });
