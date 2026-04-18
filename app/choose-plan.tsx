/**
 * Choose a Plan Screen
 * ─────────────────────────────────────────────────────────────────────────────
 * Shows all subscription plans as a modern horizontal swipeable carousel.
 */
import { useState } from "react";
import { useRouter } from "expo-router";
import { View, Text, Pressable, Alert, Linking } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";
import { PlanCarousel } from "@/components/plan-carousel";
import * as WebBrowser from "expo-web-browser";
import { getApiBaseUrl } from "@/constants/oauth";
import { useStore } from "@/lib/store";
import { FuturisticBackground } from "@/components/futuristic-background";


export default function ChoosePlanScreen() {
  const colors = useColors();
  const router = useRouter();
  const [isYearly, setIsYearly] = useState(false);
  const [loadingPlanKey, setLoadingPlanKey] = useState<string | null>(null);
  const { state } = useStore();

  const { data: plans, isLoading } = trpc.subscription.getPublicPlans.useQuery(undefined, {
    staleTime: 60_000,
  });

  const utils = trpc.useUtils();

  const handleSelectPlan = async (planKey: string, period: "monthly" | "yearly") => {
    const businessOwnerId = state.businessOwnerId;
    if (!businessOwnerId) {
      Alert.alert("Error", "Business owner not found. Please restart the app.");
      return;
    }

    const plan = plans?.find((p) => p.planKey === planKey);
    if (!plan) return;

    const isFree = plan.monthlyPrice === 0;

    if (isFree) {
      Alert.alert(
        "Downgrade to Free",
        "Are you sure you want to downgrade to the Solo (Free) plan? You may lose access to paid features.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Downgrade",
            style: "destructive",
            onPress: async () => {
              try {
                setLoadingPlanKey(planKey);
                const res = await fetch(`${getApiBaseUrl()}/api/stripe/create-checkout`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ businessOwnerId, planKey, period }),
                });
                const data = await res.json();
                if (data.activated || data.free) {
                  await utils.subscription.getMyPlan.invalidate();
                  Alert.alert("Plan Updated", "You are now on the free Solo plan.", [
                    { text: "OK", onPress: () => router.back() },
                  ]);
                }
              } catch {
                Alert.alert("Error", "Could not update plan. Please try again.");
              } finally {
                setLoadingPlanKey(null);
              }
            },
          },
        ]
      );
      return;
    }

    try {
      setLoadingPlanKey(planKey);
      const res = await fetch(`${getApiBaseUrl()}/api/stripe/create-checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessOwnerId, planKey, period }),
      });
      const data = await res.json();
      if (data.url) {
        await WebBrowser.openBrowserAsync(data.url);
        await utils.subscription.getMyPlan.invalidate();
      } else if (data.activated || data.free) {
        await utils.subscription.getMyPlan.invalidate();
        Alert.alert("Plan Updated", `You are now on the ${plan.displayName} plan.`, [
          { text: "OK", onPress: () => router.back() },
        ]);
      } else {
        Alert.alert("Error", data.error ?? "Could not start checkout. Please try again.");
      }
    } catch {
      Alert.alert("Error", "Could not start checkout. Please try again.");
    } finally {
      setLoadingPlanKey(null);
    }
  };

  return (
    <ScreenContainer>
      <FuturisticBackground />
      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4 }}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, marginRight: 12, padding: 4 })}
        >
          <IconSymbol name="arrow.left" size={24} color={colors.foreground} />
        </Pressable>
        <Text style={{ fontSize: 22, fontWeight: "700", color: colors.foreground, flex: 1 }}>Choose a Plan</Text>
      </View>
      <Text style={{ fontSize: 14, color: colors.muted, paddingHorizontal: 20, marginBottom: 8 }}>
        Swipe to compare plans. Upgrade or downgrade anytime.
      </Text>

      {/* Carousel */}
      <View style={{ flex: 1, paddingHorizontal: 16 }}>
        <PlanCarousel
          plans={(plans ?? []) as any}
          isLoading={isLoading}
          isYearly={isYearly}
          onToggleBilling={setIsYearly}
          onSelectPlan={handleSelectPlan}
          loadingPlanKey={loadingPlanKey}
        />
      </View>

      {/* Footer */}
      <Text style={{ fontSize: 12, color: colors.muted, textAlign: "center", paddingBottom: 16, paddingHorizontal: 20 }}>
        Need a custom plan?{" "}
        <Text
          style={{ color: colors.primary }}
          onPress={() => Linking.openURL("mailto:support@lime-of-time.com")}
        >
          Contact us
        </Text>
      </Text>
    </ScreenContainer>
  );
}
