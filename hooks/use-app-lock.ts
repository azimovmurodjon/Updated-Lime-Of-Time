import { useState, useCallback } from "react";

/**
 * Hook that manages app lock.
 * 
 * TEMPORARILY DISABLED: expo-local-authentication native module crashes on iOS 26 beta
 * during TurboModule auto-registration (LAContext SIGABRT). The native module is removed
 * from the build entirely. Biometric lock will be re-enabled once iOS 26 is stable or
 * Expo SDK updates to support it.
 * 
 * All biometric features return safe no-op values so the rest of the app works unchanged.
 */
export function useAppLock() {
  const [isLocked] = useState(false);
  const [biometricEnabled] = useState(false);
  const [biometricAvailable] = useState(false);
  const [biometricType] = useState<"face" | "fingerprint" | "none">("none");

  const authenticate = useCallback(async (): Promise<boolean> => {
    return true;
  }, []);

  const toggleBiometric = useCallback(async (_enabled: boolean) => {
    // Biometrics temporarily disabled for iOS 26 compatibility
    return false;
  }, []);

  return {
    isLocked,
    biometricEnabled,
    biometricAvailable,
    biometricType,
    authenticate,
    toggleBiometric,
  };
}
