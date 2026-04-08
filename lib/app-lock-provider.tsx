import { createContext, useContext } from "react";
import { useAppLock } from "@/hooks/use-app-lock";
import { LockScreen } from "@/components/lock-screen";

type AppLockContextType = {
  isLocked: boolean;
  biometricEnabled: boolean;
  biometricAvailable: boolean;
  biometricType: "face" | "fingerprint" | "none";
  authenticate: () => Promise<boolean>;
  toggleBiometric: (enabled: boolean) => Promise<boolean>;
};

const AppLockContext = createContext<AppLockContextType | null>(null);

export function AppLockProvider({ children }: { children: React.ReactNode }) {
  const appLock = useAppLock();

  return (
    <AppLockContext.Provider value={appLock}>
      {children}
      {appLock.isLocked && (
        <LockScreen
          biometricType={appLock.biometricType}
          onUnlock={appLock.authenticate}
        />
      )}
    </AppLockContext.Provider>
  );
}

export function useAppLockContext(): AppLockContextType {
  const ctx = useContext(AppLockContext);
  if (!ctx) {
    throw new Error("useAppLockContext must be used within AppLockProvider");
  }
  return ctx;
}
