/**
 * Client Portal — Messages Tab
 *
 * Lists all message threads (one per appointment) with unread count badges.
 */

import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useClientStore } from "@/lib/client-store";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { getApiBaseUrl } from "@/constants/oauth";

interface MessageThread {
  appointmentId: number;
  businessName: string;
  serviceName: string;
  appointmentDate: string;
  lastMessage: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function MessagesScreen() {
  const colors = useColors();
  const router = useRouter();
  const { state, dispatch, apiCall } = useClientStore();
  const [threads, setThreads] = useState<MessageThread[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadThreads = useCallback(async (silent = false) => {
    if (!state.account) return;
    if (!silent) setLoading(true);
    try {
      const data = await apiCall<MessageThread[]>("/api/client/messages/threads");
      setThreads(data);
      const total = data.reduce((sum, t) => sum + t.unreadCount, 0);
      dispatch({ type: "SET_UNREAD_COUNT", payload: total });
    } catch (err) {
      console.warn("[Messages] load error:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [state.account, apiCall, dispatch]);

  useFocusEffect(useCallback(() => { loadThreads(true); }, [loadThreads]));

  const onRefresh = () => { setRefreshing(true); loadThreads(); };

  const s = styles(colors);

  if (!state.account) {
    return (
      <ScreenContainer className="px-6">
        <View style={s.guestContainer}>
          <IconSymbol name="text.bubble.fill" size={40} color={colors.muted} />
          <Text style={[s.guestTitle, { color: colors.foreground }]}>Sign in to view messages</Text>
          <Pressable
            style={({ pressed }) => [s.signInBtn, pressed && { opacity: 0.85 }]}
            onPress={() => router.push("/client-signin" as any)}
          >
            <Text style={s.signInBtnText}>Sign In</Text>
          </Pressable>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <View style={s.header}>
        <Text style={s.title}>Messages</Text>
      </View>

      {loading ? (
        <View style={s.loadingContainer}>
          <ActivityIndicator color="#8B5CF6" />
        </View>
      ) : (
        <FlatList
          data={threads}
          keyExtractor={(item) => String(item.appointmentId)}
          contentContainerStyle={{ paddingBottom: 32 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#8B5CF6" />}
          ListEmptyComponent={
            <View style={s.emptyContainer}>
              <IconSymbol name="text.bubble.fill" size={36} color={colors.muted} />
              <Text style={[s.emptyTitle, { color: colors.foreground }]}>No messages yet</Text>
              <Text style={[s.emptySubtitle, { color: colors.muted }]}>
                Messages with businesses will appear here after you book an appointment.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [
                s.threadCard,
                { borderBottomColor: colors.border },
                pressed && { backgroundColor: colors.surface },
              ]}
              onPress={() => router.push({ pathname: "/client-message-thread", params: { appointmentId: String(item.appointmentId) } } as any)}
            >
              <View style={[s.avatar, { backgroundColor: "#8B5CF620" }]}>
                <IconSymbol name="scissors" size={20} color="#8B5CF6" />
              </View>
              <View style={s.threadInfo}>
                <View style={s.threadTop}>
                  <Text style={[s.businessName, { color: colors.foreground }]} numberOfLines={1}>{item.businessName}</Text>
                  {item.lastMessageAt && (
                    <Text style={[s.timeAgo, { color: colors.muted }]}>{timeAgo(item.lastMessageAt)}</Text>
                  )}
                </View>
                <Text style={[s.serviceName, { color: "#8B5CF6" }]} numberOfLines={1}>{item.serviceName}</Text>
                {item.lastMessage ? (
                  <Text style={[s.lastMessage, { color: colors.muted, fontWeight: item.unreadCount > 0 ? "600" : "400" }]} numberOfLines={1}>
                    {item.lastMessage}
                  </Text>
                ) : (
                  <Text style={[s.lastMessage, { color: colors.muted, fontStyle: "italic" }]}>No messages yet — tap to send one</Text>
                )}
              </View>
              {item.unreadCount > 0 && (
                <View style={s.unreadBadge}>
                  <Text style={s.unreadText}>{item.unreadCount}</Text>
                </View>
              )}
            </Pressable>
          )}
        />
      )}
    </ScreenContainer>
  );
}

const styles = (colors: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    header: {
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 8,
    },
    title: {
      fontSize: 24,
      fontWeight: "700",
      color: colors.foreground,
    },
    loadingContainer: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    emptyContainer: {
      alignItems: "center",
      paddingTop: 60,
      paddingHorizontal: 32,
      gap: 12,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: "600",
    },
    emptySubtitle: {
      fontSize: 14,
      textAlign: "center",
      lineHeight: 20,
    },
    threadCard: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomWidth: 1,
      gap: 12,
    },
    avatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: "center",
      justifyContent: "center",
    },
    threadInfo: {
      flex: 1,
      gap: 3,
    },
    threadTop: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    businessName: {
      fontSize: 15,
      fontWeight: "700",
      flex: 1,
    },
    timeAgo: {
      fontSize: 11,
      marginLeft: 8,
    },
    serviceName: {
      fontSize: 12,
      fontWeight: "600",
    },
    lastMessage: {
      fontSize: 13,
      lineHeight: 18,
    },
    unreadBadge: {
      backgroundColor: "#8B5CF6",
      minWidth: 20,
      height: 20,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 5,
    },
    unreadText: {
      color: "#FFFFFF",
      fontSize: 11,
      fontWeight: "700",
    },
    guestContainer: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: 16,
    },
    guestTitle: {
      fontSize: 16,
      fontWeight: "600",
    },
    signInBtn: {
      backgroundColor: "#8B5CF6",
      paddingHorizontal: 32,
      paddingVertical: 12,
      borderRadius: 24,
    },
    signInBtnText: {
      color: "#FFFFFF",
      fontSize: 15,
      fontWeight: "700",
    },
  });
