import React, { createContext, useContext, useEffect, useReducer, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  Service,
  Client,
  Appointment,
  BusinessSettings,
  DEFAULT_WORKING_HOURS,
  DEFAULT_BUSINESS_PROFILE,
  AppointmentStatus,
} from "./types";

// ─── State ───────────────────────────────────────────────────────────
interface AppState {
  services: Service[];
  clients: Client[];
  appointments: Appointment[];
  settings: BusinessSettings;
  loaded: boolean;
}

const initialSettings: BusinessSettings = {
  businessName: "My Business",
  defaultDuration: 60,
  notificationsEnabled: true,
  workingHours: DEFAULT_WORKING_HOURS,
  profile: DEFAULT_BUSINESS_PROFILE,
  themeMode: "system",
};

const initialState: AppState = {
  services: [],
  clients: [],
  appointments: [],
  settings: initialSettings,
  loaded: false,
};

// ─── Actions ─────────────────────────────────────────────────────────
type Action =
  | { type: "LOAD_DATA"; payload: Partial<AppState> }
  | { type: "ADD_SERVICE"; payload: Service }
  | { type: "UPDATE_SERVICE"; payload: Service }
  | { type: "DELETE_SERVICE"; payload: string }
  | { type: "ADD_CLIENT"; payload: Client }
  | { type: "UPDATE_CLIENT"; payload: Client }
  | { type: "DELETE_CLIENT"; payload: string }
  | { type: "ADD_APPOINTMENT"; payload: Appointment }
  | { type: "UPDATE_APPOINTMENT"; payload: Appointment }
  | { type: "UPDATE_APPOINTMENT_STATUS"; payload: { id: string; status: AppointmentStatus } }
  | { type: "DELETE_APPOINTMENT"; payload: string }
  | { type: "UPDATE_SETTINGS"; payload: Partial<BusinessSettings> };

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "LOAD_DATA":
      return { ...state, ...action.payload, loaded: true };
    case "ADD_SERVICE":
      return { ...state, services: [...state.services, action.payload] };
    case "UPDATE_SERVICE":
      return {
        ...state,
        services: state.services.map((s) =>
          s.id === action.payload.id ? action.payload : s
        ),
      };
    case "DELETE_SERVICE":
      return {
        ...state,
        services: state.services.filter((s) => s.id !== action.payload),
      };
    case "ADD_CLIENT":
      return { ...state, clients: [...state.clients, action.payload] };
    case "UPDATE_CLIENT":
      return {
        ...state,
        clients: state.clients.map((c) =>
          c.id === action.payload.id ? action.payload : c
        ),
      };
    case "DELETE_CLIENT":
      return {
        ...state,
        clients: state.clients.filter((c) => c.id !== action.payload),
      };
    case "ADD_APPOINTMENT":
      return { ...state, appointments: [...state.appointments, action.payload] };
    case "UPDATE_APPOINTMENT":
      return {
        ...state,
        appointments: state.appointments.map((a) =>
          a.id === action.payload.id ? action.payload : a
        ),
      };
    case "UPDATE_APPOINTMENT_STATUS":
      return {
        ...state,
        appointments: state.appointments.map((a) =>
          a.id === action.payload.id ? { ...a, status: action.payload.status } : a
        ),
      };
    case "DELETE_APPOINTMENT":
      return {
        ...state,
        appointments: state.appointments.filter((a) => a.id !== action.payload),
      };
    case "UPDATE_SETTINGS":
      return {
        ...state,
        settings: { ...state.settings, ...action.payload },
      };
    default:
      return state;
  }
}

// ─── Context ─────────────────────────────────────────────────────────
interface StoreContextType {
  state: AppState;
  dispatch: React.Dispatch<Action>;
  getServiceById: (id: string) => Service | undefined;
  getClientById: (id: string) => Client | undefined;
  getAppointmentsForDate: (date: string) => Appointment[];
  getAppointmentsForClient: (clientId: string) => Appointment[];
  getTodayStats: () => { todayCount: number; weekCount: number; weekRevenue: number };
}

const StoreContext = createContext<StoreContextType | null>(null);

const STORAGE_KEYS = {
  services: "@bookease_services",
  clients: "@bookease_clients",
  appointments: "@bookease_appointments",
  settings: "@bookease_settings",
};

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  // Load data from AsyncStorage on mount
  useEffect(() => {
    (async () => {
      try {
        const [servicesRaw, clientsRaw, appointmentsRaw, settingsRaw] =
          await Promise.all([
            AsyncStorage.getItem(STORAGE_KEYS.services),
            AsyncStorage.getItem(STORAGE_KEYS.clients),
            AsyncStorage.getItem(STORAGE_KEYS.appointments),
            AsyncStorage.getItem(STORAGE_KEYS.settings),
          ]);
        dispatch({
          type: "LOAD_DATA",
          payload: {
            services: servicesRaw ? JSON.parse(servicesRaw) : [],
            clients: clientsRaw ? JSON.parse(clientsRaw) : [],
            appointments: appointmentsRaw ? JSON.parse(appointmentsRaw) : [],
            settings: settingsRaw
              ? { ...initialSettings, ...JSON.parse(settingsRaw) }
              : initialSettings,
          },
        });
      } catch {
        dispatch({ type: "LOAD_DATA", payload: {} });
      }
    })();
  }, []);

  // Persist data whenever it changes
  useEffect(() => {
    if (!state.loaded) return;
    AsyncStorage.setItem(STORAGE_KEYS.services, JSON.stringify(state.services));
  }, [state.services, state.loaded]);

  useEffect(() => {
    if (!state.loaded) return;
    AsyncStorage.setItem(STORAGE_KEYS.clients, JSON.stringify(state.clients));
  }, [state.clients, state.loaded]);

  useEffect(() => {
    if (!state.loaded) return;
    AsyncStorage.setItem(
      STORAGE_KEYS.appointments,
      JSON.stringify(state.appointments)
    );
  }, [state.appointments, state.loaded]);

  useEffect(() => {
    if (!state.loaded) return;
    AsyncStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(state.settings));
  }, [state.settings, state.loaded]);

  const getServiceById = useCallback(
    (id: string) => state.services.find((s) => s.id === id),
    [state.services]
  );

  const getClientById = useCallback(
    (id: string) => state.clients.find((c) => c.id === id),
    [state.clients]
  );

  const getAppointmentsForDate = useCallback(
    (date: string) =>
      state.appointments
        .filter((a) => a.date === date && a.status !== "cancelled")
        .sort((a, b) => a.time.localeCompare(b.time)),
    [state.appointments]
  );

  const getAppointmentsForClient = useCallback(
    (clientId: string) =>
      state.appointments
        .filter((a) => a.clientId === clientId)
        .sort((a, b) => {
          const dateComp = b.date.localeCompare(a.date);
          return dateComp !== 0 ? dateComp : b.time.localeCompare(a.time);
        }),
    [state.appointments]
  );

  const getTodayStats = useCallback(() => {
    const now = new Date();
    const todayStr = formatDateStr(now);
    const todayCount = state.appointments.filter(
      (a) => a.date === todayStr && a.status !== "cancelled"
    ).length;

    // Get start of week (Sunday)
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);

    const weekAppts = state.appointments.filter((a) => {
      if (a.status === "cancelled") return false;
      return a.date >= formatDateStr(startOfWeek) && a.date <= formatDateStr(endOfWeek);
    });

    const weekCount = weekAppts.length;
    const weekRevenue = weekAppts.reduce((sum, a) => {
      const svc = state.services.find((s) => s.id === a.serviceId);
      return sum + (svc?.price ?? 0);
    }, 0);

    return { todayCount, weekCount, weekRevenue };
  }, [state.appointments, state.services]);

  return (
    <StoreContext.Provider
      value={{
        state,
        dispatch,
        getServiceById,
        getClientById,
        getAppointmentsForDate,
        getAppointmentsForClient,
        getTodayStats,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}

// ─── Helpers ─────────────────────────────────────────────────────────
export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

export function formatDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function formatTime(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")} ${ampm}`;
}

export function formatDateDisplay(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}
