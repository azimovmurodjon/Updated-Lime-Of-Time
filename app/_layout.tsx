import "@/global.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "react-native-reanimated";
import { Platform, StyleSheet, View } from "react-native";
import "@/lib/_core/nativewind-pressable";
import { ThemeProvider } from "@/lib/theme-provider";
import * as SplashScreen from "expo-splash-screen";
import {
  SafeAreaFrameContext,
  SafeAreaInsetsContext,
  SafeAreaProvider,
  initialWindowMetrics,
} from "react-native-safe-area-context";
import type { EdgeInsets, Metrics, Rect } from "react-native-safe-area-context";

import { trpc, createTRPCClient } from "@/lib/trpc";
import { initManusRuntime, subscribeSafeAreaInsets } from "@/lib/_core/manus-runtime";
import { StoreProvider } from "@/lib/store";
import { ClientStoreProvider, getProfileMode } from "@/lib/client-store";
import { AppLockProvider } from "@/lib/app-lock-provider";
import { NotificationProvider } from "@/lib/notification-provider";
import { initSentry, withSentryWrapper } from "@/lib/sentry";
import { AnimatedSplash } from "@/components/animated-splash";

// Initialize Sentry as early as possible (before any React rendering)
initSentry();

SplashScreen.preventAutoHideAsync();

const DEFAULT_WEB_INSETS: EdgeInsets = { top: 0, right: 0, bottom: 0, left: 0 };
const DEFAULT_WEB_FRAME: Rect = { x: 0, y: 0, width: 0, height: 0 };

export const unstable_settings = {
  anchor: "(tabs)",
};

function RootLayout() {
  // Use system fonts (SF Pro on iOS, Roboto on Android) — no external font package needed
  const fontsLoaded = true;
  const [splashDone, setSplashDone] = useState(false);
  const router = useRouter();

  const onLayoutRootView = useCallback(async () => {
    // Hide the native splash immediately — we use our own animated splash instead
    await SplashScreen.hideAsync();
  }, []);

  const initialInsets = initialWindowMetrics?.insets ?? DEFAULT_WEB_INSETS;
  const initialFrame = initialWindowMetrics?.frame ?? DEFAULT_WEB_FRAME;

  const [insets, setInsets] = useState<EdgeInsets>(initialInsets);
  const [frame, setFrame] = useState<Rect>(initialFrame);

  // Initialize Manus runtime for cookie injection from parent container
  useEffect(() => {
    initManusRuntime();
  }, []);

  const handleSafeAreaUpdate = useCallback((metrics: Metrics) => {
    setInsets(metrics.insets);
    setFrame(metrics.frame);
  }, []);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    const unsubscribe = subscribeSafeAreaInsets(handleSafeAreaUpdate);
    return () => unsubscribe();
  }, [handleSafeAreaUpdate]);

  /**
   * Called when the animated splash screen finishes.
   * Always shows the Profile Selection screen first so the user can choose
   * Business Portal or Client Portal every time they open the app.
   * The profile-select screen itself handles redirecting returning users
   * who have already authenticated (it can skip straight to the right portal).
   */
  const handleSplashFinish = useCallback(async () => {
    setSplashDone(true);
    try {
      // Always land on profile-select — it will auto-redirect if already logged in
      router.replace("/profile-select" as any);
    } catch {
      // Fallback: do nothing, let normal routing take over
    }
  }, [router]);

  // Create clients once and reuse them
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Disable automatic refetching on window focus for mobile
            refetchOnWindowFocus: false,
            // Retry failed requests once
            retry: 1,
          },
        },
      }),
  );
  const [trpcClient] = useState(() => createTRPCClient());

  // Ensure minimum 8px padding for top and bottom on mobile
  const providerInitialMetrics = useMemo(() => {
    const metrics = initialWindowMetrics ?? { insets: initialInsets, frame: initialFrame };
    return {
      ...metrics,
      insets: {
        ...metrics.insets,
        top: Math.max(metrics.insets.top, 16),
        bottom: Math.max(metrics.insets.bottom, 12),
      },
    };
  }, [initialInsets, initialFrame]);

  if (!fontsLoaded) {
    return null;
  }

  const content = (
    <View style={{ flex: 1 }}>
    <GestureHandlerRootView style={{ flex: 1 }} onLayout={onLayoutRootView}>
      <trpc.Provider client={trpcClient} queryClient={queryClient}>
        <QueryClientProvider client={queryClient}>
          <StoreProvider>
            <ClientStoreProvider>
            <AppLockProvider>
            <NotificationProvider>
            {/* Default to hiding native headers so raw route segments don't appear (e.g. "(tabs)", "products/[id]"). */}
            {/* If a screen needs the native header, explicitly enable it and set a human title via Stack.Screen options. */}
            {/* in order for ios apps tab switching to work properly, use presentation: "fullScreenModal" for login page, whenever you decide to use presentation: "modal*/}
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(tabs)" options={{ presentation: "fullScreenModal" }} />
              <Stack.Screen name="new-booking" options={{ presentation: "fullScreenModal" }} />
              <Stack.Screen name="appointment-detail" options={{ presentation: "card" }} />
              <Stack.Screen name="client-detail" options={{ presentation: "card" }} />
              <Stack.Screen name="service-form" options={{ presentation: "fullScreenModal" }} />
              <Stack.Screen name="booking" options={{ presentation: "fullScreenModal" }} />
              <Stack.Screen name="onboarding" options={{ presentation: "fullScreenModal" }} />
              <Stack.Screen name="analytics-detail" options={{ presentation: "card" }} />
              <Stack.Screen name="discounts" options={{ presentation: "fullScreenModal" }} />
              <Stack.Screen name="gift-cards" options={{ presentation: "fullScreenModal" }} />
              <Stack.Screen name="book/[slug]" options={{ presentation: "fullScreenModal" }} />
              <Stack.Screen name="review/[slug]" options={{ presentation: "fullScreenModal" }} />
              <Stack.Screen name="gift/[code]" options={{ presentation: "fullScreenModal" }} />
              <Stack.Screen name="oauth/callback" />
              <Stack.Screen name="schedule-settings" options={{ presentation: "card" }} />
              <Stack.Screen name="booking-policies" options={{ presentation: "card" }} />
              <Stack.Screen name="business-profile" options={{ presentation: "card" }} />
              <Stack.Screen name="locations" options={{ presentation: "card" }} />
              <Stack.Screen name="location-form" options={{ presentation: "fullScreenModal" }} />
              <Stack.Screen name="reviews" options={{ presentation: "card" }} />
              <Stack.Screen name="notification-settings" options={{ presentation: "card" }} />
              <Stack.Screen name="data-export" options={{ presentation: "card" }} />
              <Stack.Screen name="staff" options={{ presentation: "card" }} />
              <Stack.Screen name="staff-form" options={{ presentation: "fullScreenModal" }} />
              <Stack.Screen name="staff-calendar" options={{ presentation: "card" }} />
              <Stack.Screen name="product-form" options={{ presentation: "fullScreenModal" }} />
              <Stack.Screen name="sms-templates" options={{ presentation: "card" }} />
              {/* Client Portal Screens */}
              <Stack.Screen name="profile-select" options={{ presentation: "fullScreenModal" }} />
              <Stack.Screen name="client-signin" options={{ presentation: "fullScreenModal" }} />
              <Stack.Screen name="client-profile-onboarding" options={{ presentation: "fullScreenModal" }} />
              <Stack.Screen name="client-edit-profile" options={{ presentation: "modal", headerShown: false }} />
              <Stack.Screen name="(client-tabs)" options={{ presentation: "fullScreenModal" }} />
              <Stack.Screen name="client-business-detail" options={{ presentation: "card" }} />
              <Stack.Screen name="client-booking-wizard" options={{ presentation: "fullScreenModal" }} />
              <Stack.Screen name="client-appointment-detail" options={{ presentation: "card" }} />
              <Stack.Screen name="client-message-thread" options={{ presentation: "card" }} />
              <Stack.Screen name="client-saved-businesses" options={{ presentation: "card" }} />
              <Stack.Screen name="client-message-thread-business" options={{ presentation: "card" }} />
            </Stack>
            <StatusBar style="auto" />
            </NotificationProvider>
            </AppLockProvider>
            </ClientStoreProvider>
          </StoreProvider>
        </QueryClientProvider>
      </trpc.Provider>
    </GestureHandlerRootView>
    </View>
  );

  const shouldOverrideSafeArea = Platform.OS === "web";

  if (shouldOverrideSafeArea) {
    return (
      <ThemeProvider>
        <SafeAreaProvider initialMetrics={providerInitialMetrics}>
          <SafeAreaFrameContext.Provider value={frame}>
            <SafeAreaInsetsContext.Provider value={insets}>
              {content}
              {!splashDone && (
                <View style={StyleSheet.absoluteFill} pointerEvents="none">
                  <AnimatedSplash onFinish={handleSplashFinish} />
                </View>
              )}
            </SafeAreaInsetsContext.Provider>
          </SafeAreaFrameContext.Provider>
        </SafeAreaProvider>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <SafeAreaProvider initialMetrics={providerInitialMetrics}>
        {content}
        {!splashDone && (
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <AnimatedSplash onFinish={handleSplashFinish} />
          </View>
        )}
      </SafeAreaProvider>
    </ThemeProvider>
  );
}

// Wrap with Sentry for automatic crash reporting and performance monitoring.
// withSentryWrapper is a no-op when EXPO_PUBLIC_SENTRY_DSN is not set.
export default withSentryWrapper(RootLayout);
