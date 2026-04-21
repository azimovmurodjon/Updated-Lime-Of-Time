/**
 * Profile Selection Screen
 *
 * Shown to users who haven't chosen a profile mode yet.
 * Lets them choose between Business Owner and Client.
 */

import React, { useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Dimensions,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { setProfileMode } from "@/lib/client-store";
import { IconSymbol } from "@/components/ui/icon-symbol";
import * as Haptics from "expo-haptics";

const { width } = Dimensions.get("window");

export default function ProfileSelectScreen() {
  const colors = useColors();
  const router = useRouter();
  const [selecting, setSelecting] = useState<"business" | "client" | null>(null);

  const handleSelect = async (mode: "business" | "client") => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    setSelecting(mode);
    await setProfileMode(mode);
    if (mode === "business") {
      router.replace("/onboarding");
    } else {
      router.replace("/(client-tabs)" as any);
    }
  };

  const s = styles(colors);

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]} className="px-6">
      <View style={s.container}>
        {/* Header */}
        <View style={s.header}>
          <View style={s.logoCircle}>
            <IconSymbol name="calendar" size={40} color={colors.primary} />
          </View>
          <Text style={s.title}>Welcome</Text>
          <Text style={s.subtitle}>
            How would you like to use the app?
          </Text>
        </View>

        {/* Cards */}
        <View style={s.cards}>
          {/* Business Owner Card */}
          <Pressable
            style={({ pressed }) => [
              s.card,
              { borderColor: colors.primary, backgroundColor: colors.surface },
              pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] },
              selecting === "business" && { borderWidth: 2, borderColor: colors.primary },
            ]}
            onPress={() => handleSelect("business")}
            disabled={selecting !== null}
          >
            <View style={[s.cardIcon, { backgroundColor: colors.primary + "20" }]}>
              <IconSymbol name="briefcase.fill" size={32} color={colors.primary} />
            </View>
            <Text style={[s.cardTitle, { color: colors.foreground }]}>Business Owner</Text>
            <Text style={[s.cardDesc, { color: colors.muted }]}>
              Manage appointments, clients, staff, and grow your business.
            </Text>
            <View style={[s.cardBadge, { backgroundColor: colors.primary }]}>
              <Text style={s.cardBadgeText}>For Businesses</Text>
            </View>
          </Pressable>

          {/* Client Card */}
          <Pressable
            style={({ pressed }) => [
              s.card,
              { borderColor: colors.border, backgroundColor: colors.surface },
              pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] },
              selecting === "client" && { borderWidth: 2, borderColor: colors.primary },
            ]}
            onPress={() => handleSelect("client")}
            disabled={selecting !== null}
          >
            <View style={[s.cardIcon, { backgroundColor: "#8B5CF620" }]}>
              <IconSymbol name="person.crop.circle.fill" size={32} color="#8B5CF6" />
            </View>
            <Text style={[s.cardTitle, { color: colors.foreground }]}>Client</Text>
            <Text style={[s.cardDesc, { color: colors.muted }]}>
              Discover nearby services, book appointments, and manage your schedule.
            </Text>
            <View style={[s.cardBadge, { backgroundColor: "#8B5CF6" }]}>
              <Text style={s.cardBadgeText}>For Customers</Text>
            </View>
          </Pressable>
        </View>

        {/* Footer note */}
        <Text style={[s.footer, { color: colors.muted }]}>
          You can switch between profiles at any time from Settings.
        </Text>
      </View>
    </ScreenContainer>
  );
}

const styles = (colors: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingVertical: 32,
    },
    header: {
      alignItems: "center",
      marginBottom: 40,
    },
    logoCircle: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: colors.primary + "15",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 20,
    },
    title: {
      fontSize: 32,
      fontWeight: "700",
      color: colors.foreground,
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 16,
      color: colors.muted,
      textAlign: "center",
      lineHeight: 22,
    },
    cards: {
      width: "100%",
      gap: 16,
    },
    card: {
      width: "100%",
      borderRadius: 20,
      borderWidth: 1.5,
      padding: 24,
      gap: 8,
    },
    cardIcon: {
      width: 56,
      height: 56,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 4,
    },
    cardTitle: {
      fontSize: 20,
      fontWeight: "700",
    },
    cardDesc: {
      fontSize: 14,
      lineHeight: 20,
    },
    cardBadge: {
      alignSelf: "flex-start",
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 20,
      marginTop: 4,
    },
    cardBadgeText: {
      color: "#FFFFFF",
      fontSize: 11,
      fontWeight: "700",
    },
    footer: {
      fontSize: 13,
      textAlign: "center",
      marginTop: 32,
      lineHeight: 18,
    },
  });
