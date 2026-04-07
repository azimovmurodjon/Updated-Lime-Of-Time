import { useEffect, useRef, useState, useCallback } from "react";
import { AppState, Platform } from "react-native";
import * as LocalAuthentication from "expo-local-authentication";
import AsyncStorage from "@react-native-async-storage/async-storage";

const BIOMETRIC_ENABLED_KEY = "@bookease_biometric_enabled";
/** Minimum time in background (ms) before re-locking on foreground */
const BACKGROUND_LOCK_THRESHOLD = 2000;

/**
 * Hook that manages app lock with biometric authentication.
 * When enabled, prompts Face ID / fingerprint when the app returns from background.
 */
export function useAppLock() {
  const [isLocked, setIsLocked] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricType, setBiometricType] = useState<"face" | "fingerprint" | "none">("none");
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  const appStateRef = useRef(AppState.currentState);
  const hasRunInitialAuth = useRef(false);
  const biometricEnabledRef = useRef(false);
  const isAuthenticating = useRef(false);
  const backgroundTimestamp = useRef<number>(0);

  // Keep ref in sync with state
  useEffect(() => {
    biometricEnabledRef.current = biometricEnabled;
  }, [biometricEnabled]);

  // Check biometric hardware availability AND load saved preference
  useEffect(() => {
    if (Platform.OS === "web") {
      setSettingsLoaded(true);
      return;
    }

    (async () => {
      try {
        const hasHardware = await LocalAuthentication.hasHardwareAsync();
        const isEnrolled = await LocalAuthentication.isEnrolledAsync();
        setBiometricAvailable(hasHardware && isEnrolled);

        if (hasHardware && isEnrolled) {
          const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
          if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
            setBiometricType("face");
          } else if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
            setBiometricType("fingerprint");
          }
        }

        // Load saved preference
        const saved = await AsyncStorage.getItem(BIOMETRIC_ENABLED_KEY);
        if (saved === "true" && hasHardware && isEnrolled) {
          setBiometricEnabled(true);
          biometricEnabledRef.current = true;
          // Set locked immediately so the lock screen shows before auth prompt
          setIsLocked(true);
        }
      } catch (err) {
        console.warn("[AppLock] Error checking biometrics:", err);
      } finally {
        setSettingsLoaded(true);
      }
    })();
  }, []);

  // Authenticate with biometrics
  const authenticate = useCallback(async (): Promise<boolean> => {
    if (Platform.OS === "web") return true;

    // Prevent concurrent auth prompts
    if (isAuthenticating.current) return false;
    isAuthenticating.current = true;

    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();

      if (!hasHardware || !isEnrolled) {
        setIsLocked(false);
        return true;
      }

      const promptMessage =
        biometricType === "face"
          ? "Unlock with Face ID"
          : biometricType === "fingerprint"
          ? "Unlock with Fingerprint"
          : "Authenticate to continue";

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage,
        disableDeviceFallback: false,
        cancelLabel: "Cancel",
      });

      if (result.success) {
        setIsLocked(false);
        return true;
      }

      // User cancelled or failed — keep locked, they can tap "Unlock" button to retry
      return false;
    } catch (err) {
      console.warn("[AppLock] Authentication error:", err);
      return false;
    } finally {
      isAuthenticating.current = false;
    }
  }, [biometricType]);

  // Toggle biometric lock on/off
  const toggleBiometric = useCallback(
    async (enabled: boolean) => {
      if (enabled) {
        // Verify biometrics work before enabling
        const success = await authenticate();
        if (success) {
          setBiometricEnabled(true);
          biometricEnabledRef.current = true;
          await AsyncStorage.setItem(BIOMETRIC_ENABLED_KEY, "true");
          return true;
        }
        return false;
      } else {
        setBiometricEnabled(false);
        biometricEnabledRef.current = false;
        await AsyncStorage.setItem(BIOMETRIC_ENABLED_KEY, "false");
        setIsLocked(false);
        return true;
      }
    },
    [authenticate]
  );

  // Initial authentication on first mount AFTER settings are loaded
  useEffect(() => {
    if (Platform.OS === "web") return;
    if (!settingsLoaded) return;
    if (!biometricEnabled) return;
    if (hasRunInitialAuth.current) return;
    hasRunInitialAuth.current = true;

    // isLocked was already set to true during load, now prompt
    const timer = setTimeout(async () => {
      await authenticate();
    }, 600);

    return () => clearTimeout(timer);
  }, [settingsLoaded, biometricEnabled, authenticate]);

  // Listen for app state changes to lock/unlock
  useEffect(() => {
    if (Platform.OS === "web") return;

    const subscription = AppState.addEventListener("change", async (nextState) => {
      const prevState = appStateRef.current;
      appStateRef.current = nextState;

      // Track when we go to background
      if (nextState === "background" || nextState === "inactive") {
        backgroundTimestamp.current = Date.now();
        return;
      }

      // App came to foreground from background/inactive
      if (
        (prevState === "background" || prevState === "inactive") &&
        nextState === "active" &&
        biometricEnabledRef.current
      ) {
        // Only lock if we were in background long enough
        const elapsed = Date.now() - backgroundTimestamp.current;
        if (elapsed >= BACKGROUND_LOCK_THRESHOLD) {
          setIsLocked(true);
          // Small delay to let the app fully render before showing biometric prompt
          setTimeout(async () => {
            await authenticate();
          }, 500);
        }
      }
    });

    return () => subscription.remove();
  }, [authenticate]);

  return {
    isLocked,
    biometricEnabled,
    biometricAvailable,
    biometricType,
    authenticate,
    toggleBiometric,
  };
}
