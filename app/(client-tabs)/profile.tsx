/**
 * Client Portal — Profile Tab
 *
 * Shows account info, saved businesses shortcut, notification prefs,
 * and sign out. Also allows switching back to Business profile.
 */

import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Alert,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useClientStore, clearProfileMode } from "@/lib/client-store";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { FuturisticBackground } from "@/components/futuristic-background";
import * as Haptics from "expo-haptics";

interface MenuItemProps {
  icon: string;
  label: string;
  subtitle?: string;
  onPress: () => void;
  destructive?: boolean;
  badge?: number;
  colors: ReturnType<typeof useColors>;
}

function MenuItem({ icon, label, subtitle, onPress, destructive, badge, colors }: MenuItemProps) {
  return (
    <Pressable
      style={({ pressed }) => [
        {
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 16,
          paddingVertical: 14,
          gap: 12,
          backgroundColor: pressed ? colors.surface : "transparent",
        },
      ]}
      onPress={onPress}
    >
      <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: destructive ? colors.error + "20" : "#8B5CF620", alignItems: "center", justifyContent: "center" }}>
        <IconSymbol name={icon as any} size={18} color={destructive ? colors.error : "#8B5CF6"} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 15, fontWeight: "500", color: destructive ? colors.error : colors.foreground }}>{label}</Text>
        {subtitle && <Text style={{ fontSize: 12, color: colors.muted, marginTop: 1 }}>{subtitle}</Text>}
      </View>
      {badge != null && badge > 0 && (
        <View style={{ backgroundColor: "#EF4444", minWidth: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center", paddingHorizontal: 5 }}>
          <Text style={{ color: "#FFFFFF", fontSize: 11, fontWeight: "700" }}>{badge}</Text>
        </View>
      )}
      {!destructive && <IconSymbol name="chevron.right" size={14} color={colors.muted} />}
    </Pressable>
  );
}

export default function ClientProfileScreen() {
  const colors = useColors();
  const router = useRouter();
  const { state, signOut } = useClientStore();
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = () => {
    Alert.alert(
      "Sign Out",
      "Are you sure you want to sign out of your client account?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign Out",
          style: "destructive",
          onPress: async () => {
            if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            setSigningOut(true);
            await signOut();
            router.replace("/(client-tabs)" as any);
          },
        },
      ]
    );
  };

  const handleSwitchToBusiness = () => {
    Alert.alert(
      "Switch to Business Profile",
      "This will take you to the business owner app. Your client account will remain active.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Switch",
          onPress: async () => {
            const { setProfileMode } = await import("@/lib/client-store");
            await setProfileMode("business");
            router.replace("/onboarding" as any);
          },
        },
      ]
    );
  };

  const s = styles(colors);

  if (!state.account) {
    return (
      <ScreenContainer className="px-6">
        <FuturisticBackground />
        <View style={s.guestContainer}>
          <View style={[s.guestAvatar, { backgroundColor: "#8B5CF620" }]}>
            <IconSymbol name="person.crop.circle.fill" size={48} color="#8B5CF6" />
          </View>
          <Text style={[s.guestTitle, { color: colors.foreground }]}>Create your client account</Text>
          <Text style={[s.guestSubtitle, { color: colors.muted }]}>
            Sign in to save your bookings, message businesses, and get reminders.
          </Text>
          <Pressable
            style={({ pressed }) => [s.signInBtn, pressed && { opacity: 0.85 }]}
            onPress={() => router.push("/client-signin" as any)}
          >
            <Text style={s.signInBtnText}>Sign In / Create Account</Text>
          </Pressable>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <FuturisticBackground />
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Profile Header */}
        <View style={s.profileHeader}>
          <View style={[s.avatar, { backgroundColor: "#8B5CF620" }]}>
            <Text style={s.avatarInitial}>
              {(state.account.name ?? "?").charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text style={[s.name, { color: colors.foreground }]}>{state.account.name}</Text>
          {state.account.email && (
            <Text style={[s.email, { color: colors.muted }]}>{state.account.email}</Text>
          )}
          {state.account.phone && (
            <Text style={[s.phone, { color: colors.muted }]}>{state.account.phone}</Text>
          )}
          <Pressable
            style={({ pressed }) => [s.editBtn, { borderColor: "#8B5CF6" }, pressed && { opacity: 0.7 }]}
            onPress={() => router.push("/client-edit-profile" as any)}
          >
            <Text style={{ color: "#8B5CF6", fontSize: 14, fontWeight: "600" }}>Edit Profile</Text>
          </Pressable>
        </View>

        {/* Menu Sections */}
        <View style={[s.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[s.sectionLabel, { color: colors.muted }]}>BOOKINGS</Text>
          <MenuItem icon="calendar" label="My Bookings" onPress={() => router.push("/(client-tabs)/bookings" as any)} colors={colors} />
          <View style={[s.divider, { backgroundColor: colors.border }]} />
          <MenuItem icon="bookmark.fill" label="Saved Businesses" onPress={() => router.push("/client-saved-businesses" as any)} colors={colors} />
        </View>

        <View style={[s.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[s.sectionLabel, { color: colors.muted }]}>ACCOUNT</Text>
          <MenuItem icon="bell.fill" label="Notification Preferences" subtitle="SMS, push reminders" onPress={() => router.push("/client-notifications" as any)} colors={colors} />
          <View style={[s.divider, { backgroundColor: colors.border }]} />
          <MenuItem icon="briefcase.fill" label="Switch to Business Profile" subtitle="Manage your own business" onPress={handleSwitchToBusiness} colors={colors} />
        </View>

        <View style={[s.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <MenuItem icon="rectangle.portrait.and.arrow.right" label="Sign Out" onPress={handleSignOut} destructive colors={colors} />
        </View>

        <Text style={[s.version, { color: colors.muted }]}>Client Portal v1.0</Text>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = (colors: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    profileHeader: {
      alignItems: "center",
      paddingVertical: 32,
      paddingHorizontal: 20,
      gap: 6,
    },
    avatar: {
      width: 80,
      height: 80,
      borderRadius: 40,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 8,
    },
    avatarInitial: {
      fontSize: 32,
      fontWeight: "700",
      color: "#8B5CF6",
    },
    name: {
      fontSize: 22,
      fontWeight: "700",
    },
    email: {
      fontSize: 14,
    },
    phone: {
      fontSize: 14,
    },
    editBtn: {
      borderWidth: 1.5,
      borderRadius: 20,
      paddingHorizontal: 20,
      paddingVertical: 8,
      marginTop: 8,
    },
    section: {
      marginHorizontal: 16,
      marginBottom: 16,
      borderRadius: 16,
      borderWidth: 1,
      overflow: "hidden",
    },
    sectionLabel: {
      fontSize: 11,
      fontWeight: "700",
      letterSpacing: 0.8,
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 4,
    },
    divider: {
      height: 1,
      marginLeft: 64,
    },
    version: {
      textAlign: "center",
      fontSize: 12,
      marginTop: 8,
    },
    guestContainer: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: 16,
      paddingVertical: 40,
    },
    guestAvatar: {
      width: 96,
      height: 96,
      borderRadius: 48,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 8,
    },
    guestTitle: {
      fontSize: 20,
      fontWeight: "700",
      textAlign: "center",
    },
    guestSubtitle: {
      fontSize: 14,
      textAlign: "center",
      lineHeight: 20,
      maxWidth: 280,
    },
    signInBtn: {
      backgroundColor: "#8B5CF6",
      paddingHorizontal: 32,
      paddingVertical: 14,
      borderRadius: 28,
      marginTop: 8,
    },
    signInBtnText: {
      color: "#FFFFFF",
      fontSize: 15,
      fontWeight: "700",
    },
  });
