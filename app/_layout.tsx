import "@/global.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "react-native-reanimated";
import { Animated, Platform } from "react-native";
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
  const contentOpacity = useRef(new Animated.Value(0)).current;

  // Fade in the app content after splash exits
  useEffect(() => {
    if (splashDone) {
      Animated.timing(contentOpacity, {
        toValue: 1,
        duration: 350,
        useNativeDriver: true,
      }).start();
    }
  }, [splashDone]);

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

  // Show our custom animated splash before the app content
  if (!splashDone) {
    return (
      <AnimatedSplash
        onFinish={() => setSplashDone(true)}
      />
    );
  }

  const content = (
    <Animated.View style={{ flex: 1, opacity: contentOpacity }}>
    <GestureHandlerRootView style={{ flex: 1 }} onLayout={onLayoutRootView}>
      <trpc.Provider client={trpcClient} queryClient={queryClient}>
        <QueryClientProvider client={queryClient}>
          <StoreProvider>
            <AppLockProvider>
            <NotificationProvider>
            {/* Default to hiding native headers so raw route segments don't appear (e.g. "(tabs)", "products/[id]"). */}
            {/* If a screen needs the native header, explicitly enable it and set a human title via Stack.Screen options. */}
            {/* in order for ios apps tab switching to work properly, use presentation: "fullScreenModal" for login page, whenever you decide to use presentation: "modal*/}
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(tabs)" />
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
            </Stack>
            <StatusBar style="auto" />
            </NotificationProvider>
            </AppLockProvider>
          </StoreProvider>
        </QueryClientProvider>
      </trpc.Provider>
    </GestureHandlerRootView>
    </Animated.View>
  );

  const shouldOverrideSafeArea = Platform.OS === "web";

  if (shouldOverrideSafeArea) {
    return (
      <ThemeProvider>
        <SafeAreaProvider initialMetrics={providerInitialMetrics}>
          <SafeAreaFrameContext.Provider value={frame}>
            <SafeAreaInsetsContext.Provider value={insets}>
              {content}
            </SafeAreaInsetsContext.Provider>
          </SafeAreaFrameContext.Provider>
        </SafeAreaProvider>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <SafeAreaProvider initialMetrics={providerInitialMetrics}>{content}</SafeAreaProvider>
    </ThemeProvider>
  );
}

// Wrap with Sentry for automatic crash reporting and performance monitoring.
// withSentryWrapper is a no-op when EXPO_PUBLIC_SENTRY_DSN is not set.
export default withSentryWrapper(RootLayout);
