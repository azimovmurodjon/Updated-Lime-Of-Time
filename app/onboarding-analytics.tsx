import { View, Text, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";

// ─── Types ────────────────────────────────────────────────────────────────────
interface StepVisit {
  step: string;
  label: string;
  at: string;
}
interface Session {
  date: string;
  steps: StepVisit[];
  highestIdx: number;
  highestStep: string;
  highestStepLabel: string;
  completed: boolean;
}
interface AnalyticsData {
  sessions: Session[];
}

// All possible onboarding steps in order
const ALL_STEPS = [
  { key: "1",            label: "Phone Entry" },
  { key: "socialPhone",  label: "Social Phone" },
  { key: "otp",          label: "OTP Verification" },
  { key: "2",            label: "Business Info" },
  { key: "subscription", label: "Plan Selection" },
  { key: "3",            label: "Complete" },
];

// ─── Funnel bar component ─────────────────────────────────────────────────────
function FunnelBar({ label, count, max, color }: { label: string; count: number; max: number; color: string }) {
  const pct = max > 0 ? count / max : 0;
  return (
    <View style={{ marginBottom: 14 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
        <Text style={{ fontSize: 13, fontWeight: "600", color: "#111827", flex: 1 }} numberOfLines={1}>{label}</Text>
        <Text style={{ fontSize: 13, fontWeight: "700", color }}>{count}</Text>
      </View>
      <View style={{ height: 8, backgroundColor: "#F3F4F6", borderRadius: 4, overflow: "hidden" }}>
        <View style={{ height: 8, width: `${Math.round(pct * 100)}%`, backgroundColor: color, borderRadius: 4 }} />
      </View>
      <Text style={{ fontSize: 11, color: "#6B7280", marginTop: 2 }}>{Math.round(pct * 100)}% of sessions reached this step</Text>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function OnboardingAnalyticsScreen() {
  const router = useRouter();
  const colors = useColors();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        // Merge both analytics keys (legacy tour analytics + new onboarding analytics)
        const raw = await AsyncStorage.getItem("onboarding_analytics");
        const parsed: AnalyticsData = raw ? JSON.parse(raw) : { sessions: [] };
        setData(parsed);
      } catch {
        setData({ sessions: [] });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // ─── Derived stats ────────────────────────────────────────────────────────
  const sessions = data?.sessions ?? [];
  const totalSessions = sessions.length;
  const completedSessions = sessions.filter((s) => s.completed).length;
  const completionRate = totalSessions > 0 ? Math.round((completedSessions / totalSessions) * 100) : 0;

  // Count how many sessions reached each step
  const stepCounts: Record<string, number> = {};
  ALL_STEPS.forEach(({ key }) => { stepCounts[key] = 0; });
  sessions.forEach((session) => {
    const visitedKeys = new Set(session.steps.map((sv) => sv.step));
    ALL_STEPS.forEach(({ key }) => {
      if (visitedKeys.has(key)) stepCounts[key] = (stepCounts[key] ?? 0) + 1;
    });
  });

  const maxCount = Math.max(...Object.values(stepCounts), 1);

  // Drop-off: sessions that reached a step but not the next
  const dropOffs = ALL_STEPS.map(({ key, label }, i) => {
    const reached = stepCounts[key] ?? 0;
    const nextKey = ALL_STEPS[i + 1]?.key;
    const nextReached = nextKey ? (stepCounts[nextKey] ?? 0) : reached;
    const dropped = reached - nextReached;
    const dropPct = reached > 0 ? Math.round((dropped / reached) * 100) : 0;
    return { key, label, reached, dropped, dropPct };
  });

  // Worst drop-off step
  const worstDropOff = dropOffs
    .filter((d) => d.reached > 0 && d.dropped > 0)
    .sort((a, b) => b.dropPct - a.dropPct)[0];

  // Recent sessions (last 7)
  const recentSessions = [...sessions].reverse().slice(0, 7);

  const TEAL = "#14B8A6";
  const AMBER = "#F59E0B";

  return (
    <ScreenContainer>
      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, borderBottomWidth: 0.5, borderBottomColor: colors.border }}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1, padding: 4, marginRight: 8 })}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <IconSymbol name="chevron.left" size={22} color={colors.primary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 18, fontWeight: "700", color: colors.foreground }}>Onboarding Analytics</Text>
          <Text style={{ fontSize: 12, color: colors.muted }}>Sign-up funnel & drop-off insights</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={{ alignItems: "center", paddingTop: 60 }}>
            <ActivityIndicator size="large" color={TEAL} />
            <Text style={{ marginTop: 12, color: colors.muted }}>Loading analytics…</Text>
          </View>
        ) : totalSessions === 0 ? (
          <View style={{ alignItems: "center", paddingTop: 60, gap: 12 }}>
            <Text style={{ fontSize: 40 }}>📊</Text>
            <Text style={{ fontSize: 17, fontWeight: "700", color: colors.foreground, textAlign: "center" }}>No data yet</Text>
            <Text style={{ fontSize: 14, color: colors.muted, textAlign: "center", maxWidth: 280 }}>
              Analytics will appear here once users start going through the onboarding flow.
            </Text>
          </View>
        ) : (
          <>
            {/* ── Summary cards ── */}
            <View style={{ flexDirection: "row", gap: 10, marginBottom: 20 }}>
              <View style={{ flex: 1, backgroundColor: "#F0FDFA", borderRadius: 14, padding: 14, borderWidth: 1, borderColor: "#99F6E4" }}>
                <Text style={{ fontSize: 28, fontWeight: "800", color: TEAL }}>{totalSessions}</Text>
                <Text style={{ fontSize: 12, color: "#0F766E", fontWeight: "600", marginTop: 2 }}>Total Sessions</Text>
              </View>
              <View style={{ flex: 1, backgroundColor: "#FFFBEB", borderRadius: 14, padding: 14, borderWidth: 1, borderColor: "#FDE68A" }}>
                <Text style={{ fontSize: 28, fontWeight: "800", color: AMBER }}>{completionRate}%</Text>
                <Text style={{ fontSize: 12, color: "#92400E", fontWeight: "600", marginTop: 2 }}>Completion Rate</Text>
              </View>
              <View style={{ flex: 1, backgroundColor: "#F0FFF4", borderRadius: 14, padding: 14, borderWidth: 1, borderColor: "#BBF7D0" }}>
                <Text style={{ fontSize: 28, fontWeight: "800", color: "#16A34A" }}>{completedSessions}</Text>
                <Text style={{ fontSize: 12, color: "#15803D", fontWeight: "600", marginTop: 2 }}>Completed</Text>
              </View>
            </View>

            {/* ── Worst drop-off alert ── */}
            {worstDropOff && (
              <View style={{ backgroundColor: "#FFF7ED", borderRadius: 14, padding: 14, marginBottom: 20, borderWidth: 1, borderColor: "#FED7AA", flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
                <Text style={{ fontSize: 22 }}>⚠️</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: "700", color: "#92400E" }}>Highest Drop-off</Text>
                  <Text style={{ fontSize: 13, color: "#B45309", marginTop: 2 }}>
                    <Text style={{ fontWeight: "700" }}>{worstDropOff.dropPct}%</Text> of users who reached{" "}
                    <Text style={{ fontWeight: "700" }}>{worstDropOff.label}</Text> did not continue.
                    {" "}({worstDropOff.dropped} of {worstDropOff.reached} sessions)
                  </Text>
                </View>
              </View>
            )}

            {/* ── Funnel chart ── */}
            <View style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: colors.border }}>
              <Text style={{ fontSize: 15, fontWeight: "700", color: colors.foreground, marginBottom: 14 }}>Sign-up Funnel</Text>
              {ALL_STEPS.filter(({ key }) => (stepCounts[key] ?? 0) > 0).map(({ key, label }) => (
                <FunnelBar
                  key={key}
                  label={label}
                  count={stepCounts[key] ?? 0}
                  max={maxCount}
                  color={TEAL}
                />
              ))}
            </View>

            {/* ── Drop-off table ── */}
            <View style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: colors.border }}>
              <Text style={{ fontSize: 15, fontWeight: "700", color: colors.foreground, marginBottom: 14 }}>Step-by-Step Drop-off</Text>
              <View style={{ flexDirection: "row", marginBottom: 8 }}>
                <Text style={{ flex: 2, fontSize: 11, fontWeight: "700", color: colors.muted, textTransform: "uppercase" }}>Step</Text>
                <Text style={{ flex: 1, fontSize: 11, fontWeight: "700", color: colors.muted, textTransform: "uppercase", textAlign: "right" }}>Reached</Text>
                <Text style={{ flex: 1, fontSize: 11, fontWeight: "700", color: colors.muted, textTransform: "uppercase", textAlign: "right" }}>Dropped</Text>
                <Text style={{ flex: 1, fontSize: 11, fontWeight: "700", color: colors.muted, textTransform: "uppercase", textAlign: "right" }}>Drop %</Text>
              </View>
              {dropOffs.filter((d) => d.reached > 0).map((d) => (
                <View key={d.key} style={{ flexDirection: "row", paddingVertical: 8, borderTopWidth: 0.5, borderTopColor: colors.border }}>
                  <Text style={{ flex: 2, fontSize: 13, color: colors.foreground }} numberOfLines={1}>{d.label}</Text>
                  <Text style={{ flex: 1, fontSize: 13, color: colors.foreground, textAlign: "right" }}>{d.reached}</Text>
                  <Text style={{ flex: 1, fontSize: 13, color: d.dropped > 0 ? "#EF4444" : colors.muted, textAlign: "right" }}>{d.dropped}</Text>
                  <Text style={{ flex: 1, fontSize: 13, fontWeight: "600", color: d.dropPct > 50 ? "#EF4444" : d.dropPct > 25 ? AMBER : "#16A34A", textAlign: "right" }}>{d.dropPct}%</Text>
                </View>
              ))}
            </View>

            {/* ── Recent sessions ── */}
            <View style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: colors.border }}>
              <Text style={{ fontSize: 15, fontWeight: "700", color: colors.foreground, marginBottom: 14 }}>Recent Sessions</Text>
              {recentSessions.map((s, i) => (
                <View key={i} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 10, borderTopWidth: i === 0 ? 0 : 0.5, borderTopColor: colors.border, gap: 10 }}>
                  <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: s.completed ? "#DCFCE7" : "#FEF3C7", alignItems: "center", justifyContent: "center" }}>
                    <Text style={{ fontSize: 16 }}>{s.completed ? "✅" : "⏸️"}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: "600", color: colors.foreground }}>
                      {s.completed ? "Completed" : `Stopped at: ${s.highestStepLabel ?? s.highestStep}`}
                    </Text>
                    <Text style={{ fontSize: 11, color: colors.muted, marginTop: 1 }}>{s.date} · {s.steps.length} step{s.steps.length !== 1 ? "s" : ""} visited</Text>
                  </View>
                  <View style={{ backgroundColor: s.completed ? "#DCFCE7" : "#FEF3C7", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                    <Text style={{ fontSize: 11, fontWeight: "700", color: s.completed ? "#16A34A" : "#92400E" }}>
                      {s.completed ? "Done" : "Dropped"}
                    </Text>
                  </View>
                </View>
              ))}
            </View>

            {/* ── Clear data button ── */}
            <Pressable
              onPress={async () => {
                await AsyncStorage.removeItem("onboarding_analytics");
                setData({ sessions: [] });
              }}
              style={({ pressed }) => ({
                alignItems: "center",
                paddingVertical: 12,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: "#FCA5A5",
                backgroundColor: pressed ? "#FEF2F2" : "transparent",
              })}
            >
              <Text style={{ fontSize: 14, color: "#EF4444", fontWeight: "600" }}>Clear Analytics Data</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}
