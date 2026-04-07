import { useEffect, useRef, useState, useCallback } from "react";
import { AppState, Platform } from "react-native";
import * as LocalAuthentication from "expo-local-authentication";
import AsyncStorage from "@react-native-async-storage/async-storage";

const BIOMETRIC_ENABLED_KEY = "@bookease_biometric_enabled";

/**
 * Hook that manages app lock with biometric authentication.
 * When enabled, prompts Face ID / fingerprint when the app returns from background.
 * The lock triggers immediately when the app comes back to foreground.
 */
export function useAppLock() {
  const [isLocked, setIsLocked] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricType, setBiometricType] = useState<"face" | "fingerprint" | "none">("none");
  const appStateRef = useRef(AppState.currentState);
  const hasCheckedInitial = useRef(false);

  // Check biometric hardware availability
  useEffect(() => {
    if (Platform.OS === "web") return;

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
        if (saved === "true") {
          setBiometricEnabled(true);
        }
      } catch (err) {
        console.warn("[AppLock] Error checking biometrics:", err);
      }
    })();
  }, []);

  // Authenticate with biometrics
  const authenticate = useCallback(async (): Promise<boolean> => {
    if (Platform.OS === "web") return true;

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

      if (result.error === "user_cancel") {
        // User cancelled — keep locked
        return false;
      }

      return false;
    } catch (err) {
      console.warn("[AppLock] Authentication error:", err);
      return false;
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

  // Listen for app state changes to lock/unlock
  useEffect(() => {
    if (Platform.OS === "web" || !biometricEnabled) return;

    const subscription = AppState.addEventListener("change", async (nextState) => {
      const prevState = appStateRef.current;
      appStateRef.current = nextState;

      // App came to foreground from background/inactive
      if (
        (prevState === "background" || prevState === "inactive") &&
        nextState === "active"
      ) {
        setIsLocked(true);
        // Small delay to let the app fully render before showing biometric prompt
        setTimeout(async () => {
          const success = await authenticate();
          if (!success) {
            setIsLocked(true);
          }
        }, 300);
      }
    });

    return () => subscription.remove();
  }, [biometricEnabled, authenticate]);

  // Initial authentication on first mount if biometric is enabled
  useEffect(() => {
    if (Platform.OS === "web" || !biometricEnabled || hasCheckedInitial.current) return;
    hasCheckedInitial.current = true;

    (async () => {
      setIsLocked(true);
      const success = await authenticate();
      if (!success) {
        setIsLocked(true);
      }
    })();
  }, [biometricEnabled, authenticate]);

  return {
    isLocked,
    biometricEnabled,
    biometricAvailable,
    biometricType,
    authenticate,
    toggleBiometric,
  };
}
