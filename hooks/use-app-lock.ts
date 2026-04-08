import { useEffect, useRef, useState, useCallback } from "react";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const BIOMETRIC_ENABLED_KEY = "@bookease_biometric_enabled";

/**
 * Lazily import LocalAuthentication to avoid crashing on iOS 26 beta
 * where LAContext initialization can SIGABRT during TurboModule setup.
 */
let LocalAuthentication: typeof import("expo-local-authentication") | null = null;

async function getLocalAuth() {
  if (!LocalAuthentication) {
    try {
      LocalAuthentication = await import("expo-local-authentication");
    } catch (err) {
      console.warn("[AppLock] Failed to import expo-local-authentication:", err);
      return null;
    }
  }
  return LocalAuthentication;
}

/**
 * Hook that manages app lock with biometric authentication.
 * When enabled, prompts Face ID / fingerprint ONLY on initial app launch (cold start).
 * Does NOT re-lock on every foreground transition to avoid the lock loop issue.
 *
 * IMPORTANT: Biometric hardware check is deferred to avoid crash on iOS 26 beta
 * where LAContext initialization can cause SIGABRT.
 */
export function useAppLock() {
  const [isLocked, setIsLocked] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricType, setBiometricType] = useState<"face" | "fingerprint" | "none">("none");
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  const hasRunInitialAuth = useRef(false);
  const isAuthenticating = useRef(false);

  // Load saved preference first, then check biometric hardware with delay
  useEffect(() => {
    if (Platform.OS === "web") {
      setSettingsLoaded(true);
      return;
    }

    (async () => {
      try {
        // First, just load the saved preference (no native module calls)
        const saved = await AsyncStorage.getItem(BIOMETRIC_ENABLED_KEY);
        const wasEnabled = saved === "true";

        if (wasEnabled) {
          // Optimistically set these so the lock screen shows
          setBiometricEnabled(true);
          setIsLocked(true);
        }
      } catch (err) {
        console.warn("[AppLock] Error loading preference:", err);
      } finally {
        setSettingsLoaded(true);
      }
    })();
  }, []);

  // Deferred biometric hardware check — runs after a delay to avoid
  // crashing during app initialization on iOS 26 beta
  useEffect(() => {
    if (Platform.OS === "web") return;
    if (!settingsLoaded) return;

    const timer = setTimeout(async () => {
      try {
        const LA = await getLocalAuth();
        if (!LA) {
          // Module failed to load — disable biometrics gracefully
          setBiometricAvailable(false);
          setBiometricType("none");
          if (biometricEnabled) {
            // Can't verify biometrics, unlock the app
            setIsLocked(false);
          }
          return;
        }

        const hasHardware = await LA.hasHardwareAsync();
        const isEnrolled = await LA.isEnrolledAsync();
        setBiometricAvailable(hasHardware && isEnrolled);

        if (hasHardware && isEnrolled) {
          const types = await LA.supportedAuthenticationTypesAsync();
          if (types.includes(LA.AuthenticationType.FACIAL_RECOGNITION)) {
            setBiometricType("face");
          } else if (types.includes(LA.AuthenticationType.FINGERPRINT)) {
            setBiometricType("fingerprint");
          }
        } else if (biometricEnabled) {
          // Hardware not available but was enabled — unlock gracefully
          setIsLocked(false);
        }
      } catch (err) {
        console.warn("[AppLock] Error checking biometrics:", err);
        // On error, unlock the app so user isn't stuck
        setIsLocked(false);
        setBiometricAvailable(false);
      }
    }, 1500); // 1.5s delay to let the app fully initialize first

    return () => clearTimeout(timer);
  }, [settingsLoaded, biometricEnabled]);

  // Authenticate with biometrics
  const authenticate = useCallback(async (): Promise<boolean> => {
    if (Platform.OS === "web") return true;

    // Prevent concurrent auth prompts
    if (isAuthenticating.current) return false;
    isAuthenticating.current = true;

    try {
      const LA = await getLocalAuth();
      if (!LA) {
        setIsLocked(false);
        return true;
      }

      const hasHardware = await LA.hasHardwareAsync();
      const isEnrolled = await LA.isEnrolledAsync();

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

      const result = await LA.authenticateAsync({
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
      // On error, unlock so user isn't stuck
      setIsLocked(false);
      return true;
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
    if (!biometricAvailable) return; // Wait until hardware check completes
    if (hasRunInitialAuth.current) return;
    hasRunInitialAuth.current = true;

    // isLocked was already set to true during load, now prompt
    const timer = setTimeout(async () => {
      await authenticate();
    }, 600);

    return () => clearTimeout(timer);
  }, [settingsLoaded, biometricEnabled, biometricAvailable, authenticate]);

  return {
    isLocked,
    biometricEnabled,
    biometricAvailable,
    biometricType,
    authenticate,
    toggleBiometric,
  };
}
