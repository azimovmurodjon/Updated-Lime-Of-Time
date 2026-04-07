import { useEffect, useRef, useState, useCallback } from "react";
import { Platform } from "react-native";
import * as LocalAuthentication from "expo-local-authentication";
import AsyncStorage from "@react-native-async-storage/async-storage";

const BIOMETRIC_ENABLED_KEY = "@bookease_biometric_enabled";

/**
 * Hook that manages app lock with biometric authentication.
 * When enabled, prompts Face ID / fingerprint ONLY on initial app launch (cold start).
 * Does NOT re-lock on every foreground transition to avoid the lock loop issue.
 */
export function useAppLock() {
  const [isLocked, setIsLocked] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricType, setBiometricType] = useState<"face" | "fingerprint" | "none">("none");
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  const hasRunInitialAuth = useRef(false);
  const isAuthenticating = useRef(false);

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
          await AsyncStorage.setItem(BIOMETRIC_ENABLED_KEY, "true");
          return true;
        }
        return false;
      } else {
        setBiometricEnabled(false);
        await AsyncStorage.setItem(BIOMETRIC_ENABLED_KEY, "false");
        setIsLocked(false);
        return true;
      }
    },
    [authenticate]
  );

  // Initial authentication on first mount AFTER settings are loaded
  // This is the ONLY time we auto-prompt — on cold start
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

  // NOTE: Removed the AppState listener that re-locked on every foreground transition.
  // This was causing the "non-stop locking" issue. Now Face ID only prompts on cold launch.

  return {
    isLocked,
    biometricEnabled,
    biometricAvailable,
    biometricType,
    authenticate,
    toggleBiometric,
  };
}
