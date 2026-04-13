import { ThemedView } from "@/components/themed-view";
import * as Api from "@/lib/_core/api";
import * as Auth from "@/lib/_core/auth";
import * as Linking from "expo-linking";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { trpc } from "@/lib/trpc";
import { useStore } from "@/lib/store";
import {
  dbServiceToLocal,
  dbClientToLocal,
  dbAppointmentToLocal,
  dbReviewToLocal,
  dbDiscountToLocal,
  dbGiftCardToLocal,
  dbLocationToLocal,
  dbProductToLocal,
  dbStaffToLocal,
  dbCustomScheduleToLocal,
  dbOwnerToSettings,
} from "@/lib/store";

export default function OAuthCallback() {
  const router = useRouter();
  const { dispatch } = useStore();
  const params = useLocalSearchParams<{
    code?: string;
    state?: string;
    error?: string;
    sessionToken?: string;
    user?: string;
  }>();
  const [status, setStatus] = useState<"processing" | "success" | "error">("processing");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const trpcUtils = trpc.useUtils();

  useEffect(() => {
    const handleCallback = async () => {
      console.log("[OAuth] Callback handler triggered");
      try {
        let userInfo: Auth.User | null = null;

        // ── Web callback: sessionToken in params ──────────────────────
        if (params.sessionToken) {
          await Auth.setSessionToken(params.sessionToken);
          if (params.user) {
            try {
              const userJson =
                typeof atob !== "undefined"
                  ? atob(params.user)
                  : Buffer.from(params.user, "base64").toString("utf-8");
              const userData = JSON.parse(userJson);
              userInfo = {
                id: userData.id,
                openId: userData.openId,
                name: userData.name,
                email: userData.email,
                loginMethod: userData.loginMethod,
                lastSignedIn: new Date(userData.lastSignedIn || Date.now()),
              };
              await Auth.setUserInfo(userInfo);
            } catch (err) {
              console.error("[OAuth] Failed to parse user data:", err);
            }
          }
        } else {
          // ── Native / code exchange flow ───────────────────────────────
          let url: string | null = null;
          if (params.code || params.state || params.error) {
            const urlParams = new URLSearchParams();
            if (params.code) urlParams.set("code", params.code);
            if (params.state) urlParams.set("state", params.state);
            if (params.error) urlParams.set("error", params.error);
            url = `?${urlParams.toString()}`;
          } else {
            const initialUrl = await Linking.getInitialURL();
            if (initialUrl) url = initialUrl;
          }

          const error =
            params.error || (url ? new URL(url, "http://dummy").searchParams.get("error") : null);
          if (error) {
            setStatus("error");
            setErrorMessage(error || "OAuth error occurred");
            return;
          }

          let code: string | null = null;
          let state: string | null = null;
          let sessionToken: string | null = null;

          if (params.code && params.state) {
            code = params.code;
            state = params.state;
          } else if (url) {
            try {
              const urlObj = new URL(url);
              code = urlObj.searchParams.get("code");
              state = urlObj.searchParams.get("state");
              sessionToken = urlObj.searchParams.get("sessionToken");
            } catch {
              const match = url.match(/[?&](code|state|sessionToken)=([^&]+)/g);
              if (match) {
                match.forEach((param) => {
                  const [key, value] = param.substring(1).split("=");
                  if (key === "code") code = decodeURIComponent(value);
                  if (key === "state") state = decodeURIComponent(value);
                  if (key === "sessionToken") sessionToken = decodeURIComponent(value);
                });
              }
            }
          }

          if (sessionToken) {
            await Auth.setSessionToken(sessionToken);
          } else if (code && state) {
            const result = await Api.exchangeOAuthCode(code, state);
            if (!result.sessionToken) {
              setStatus("error");
              setErrorMessage("No session token received");
              return;
            }
            await Auth.setSessionToken(result.sessionToken);
            if (result.user) {
              userInfo = {
                id: result.user.id,
                openId: result.user.openId,
                name: result.user.name,
                email: result.user.email,
                loginMethod: result.user.loginMethod,
                lastSignedIn: new Date(result.user.lastSignedIn || Date.now()),
              };
              await Auth.setUserInfo(userInfo);
            }
          } else {
            setStatus("error");
            setErrorMessage("Missing code or state parameter");
            return;
          }
        }

        // ── Check if a business owner exists for this social user ─────
        // Load userInfo from storage if not already set
        if (!userInfo) {
          userInfo = await Auth.getUserInfo();
        }

        const email = userInfo?.email;
        if (email) {
          try {
            const existing = await trpcUtils.business.checkByEmail.fetch({ email });
            if (existing) {
              // Existing business owner — load full data and go to home
              console.log("[OAuth] Found existing business owner by email, loading data...");
              const fullData = await trpcUtils.business.getFullData.fetch({ id: existing.id });
              if (fullData) {
                dispatch({ type: "LOAD_DATA", payload: {
                  settings: fullData.owner ? (dbOwnerToSettings(fullData.owner) as any) : undefined,
                  services: (fullData.services || []).map(dbServiceToLocal),
                  clients: (fullData.clients || []).map(dbClientToLocal),
                  appointments: (fullData.appointments || []).map(dbAppointmentToLocal),
                  reviews: (fullData.reviews || []).map(dbReviewToLocal),
                  discounts: (fullData.discounts || []).map(dbDiscountToLocal),
                  giftCards: (fullData.giftCards || []).map(dbGiftCardToLocal),
                  locations: (fullData.locations || []).map(dbLocationToLocal),
                  products: (fullData.products || []).map(dbProductToLocal),
                  staff: (fullData.staff || []).map(dbStaffToLocal),
                  customSchedule: (fullData.customSchedule || []).map(dbCustomScheduleToLocal),
                  businessOwnerId: existing.id,
                }});
              }
              setStatus("success");
              setTimeout(() => router.replace("/(tabs)"), 800);
              return;
            }
          } catch (err) {
            console.warn("[OAuth] checkByEmail failed:", err);
          }
        }

        // ── New social user — redirect to onboarding to collect phone ──
        console.log("[OAuth] New social user, redirecting to onboarding for phone collection...");
        setStatus("success");
        const socialName = userInfo?.name ?? "";
        const socialEmail = userInfo?.email ?? "";
        setTimeout(() => {
          router.replace({
            pathname: "/onboarding",
            params: {
              socialLogin: "1",
              socialName,
              socialEmail,
            },
          });
        }, 500);
      } catch (error) {
        console.error("[OAuth] Callback error:", error);
        setStatus("error");
        setErrorMessage(
          error instanceof Error ? error.message : "Failed to complete authentication",
        );
      }
    };

    handleCallback();
  }, [params.code, params.state, params.error, params.sessionToken, params.user, router]);

  return (
    <SafeAreaView className="flex-1" edges={["top", "bottom", "left", "right"]}>
      <ThemedView className="flex-1 items-center justify-center gap-4 p-5">
        {status === "processing" && (
          <>
            <ActivityIndicator size="large" />
            <Text className="mt-4 text-base leading-6 text-center text-foreground">
              Completing authentication...
            </Text>
          </>
        )}
        {status === "success" && (
          <>
            <ActivityIndicator size="large" />
            <Text className="mt-4 text-base leading-6 text-center text-foreground">
              Setting up your account...
            </Text>
          </>
        )}
        {status === "error" && (
          <>
            <Text className="mb-2 text-xl font-bold leading-7 text-error">
              Authentication failed
            </Text>
            <Text className="text-base leading-6 text-center text-foreground">
              {errorMessage}
            </Text>
          </>
        )}
      </ThemedView>
    </SafeAreaView>
  );
}
