import React, { createContext, useContext, useEffect, useReducer, useCallback, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  Service,
  Client,
  Appointment,
  Review,
  Discount,
  GiftCard,
  CustomScheduleDay,
  Product,
  BusinessSettings,
  DEFAULT_WORKING_HOURS,
  DEFAULT_BUSINESS_PROFILE,
  DEFAULT_CANCELLATION_POLICY,
  AppointmentStatus,
} from "./types";
import { trpc } from "./trpc";

// ─── State ───────────────────────────────────────────────────────────
interface AppState {
  services: Service[];
  clients: Client[];
  appointments: Appointment[];
  reviews: Review[];
  discounts: Discount[];
  giftCards: GiftCard[];
  customSchedule: CustomScheduleDay[];
  products: Product[];
  settings: BusinessSettings;
  loaded: boolean;
  /** DB id of the current business owner – null until bootstrap completes */
  businessOwnerId: number | null;
  /** Whether we're currently syncing with the server */
  syncing: boolean;
}

const initialSettings: BusinessSettings = {
  businessName: "My Business",
  defaultDuration: 60,
  notificationsEnabled: true,
  workingHours: DEFAULT_WORKING_HOURS,
  profile: DEFAULT_BUSINESS_PROFILE,
  themeMode: "system",
  cancellationPolicy: DEFAULT_CANCELLATION_POLICY,
  onboardingComplete: false,
  temporaryClosed: false,
  businessLogoUri: "",
  scheduleMode: "weekly",
};

const initialState: AppState = {
  services: [],
  clients: [],
  appointments: [],
  reviews: [],
  discounts: [],
  giftCards: [],
  customSchedule: [],
  products: [],
  settings: initialSettings,
  loaded: false,
  businessOwnerId: null,
  syncing: false,
};

// ─── Actions ─────────────────────────────────────────────────────────
type Action =
  | { type: "LOAD_DATA"; payload: Partial<AppState> }
  | { type: "SET_BUSINESS_OWNER_ID"; payload: number | null }
  | { type: "SET_SYNCING"; payload: boolean }
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
  | { type: "UPDATE_SETTINGS"; payload: Partial<BusinessSettings> }
  | { type: "ADD_REVIEW"; payload: Review }
  | { type: "DELETE_REVIEW"; payload: string }
  | { type: "ADD_DISCOUNT"; payload: Discount }
  | { type: "UPDATE_DISCOUNT"; payload: Discount }
  | { type: "DELETE_DISCOUNT"; payload: string }
  | { type: "ADD_GIFT_CARD"; payload: GiftCard }
  | { type: "UPDATE_GIFT_CARD"; payload: GiftCard }
  | { type: "DELETE_GIFT_CARD"; payload: string }
  | { type: "SET_CUSTOM_SCHEDULE"; payload: CustomScheduleDay }
  | { type: "DELETE_CUSTOM_SCHEDULE"; payload: string }
  | { type: "ADD_PRODUCT"; payload: Product }
  | { type: "UPDATE_PRODUCT"; payload: Product }
  | { type: "DELETE_PRODUCT"; payload: string }
  | { type: "RESET_ALL_DATA" };

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "LOAD_DATA":
      return { ...state, ...action.payload, loaded: true };
    case "SET_BUSINESS_OWNER_ID":
      return { ...state, businessOwnerId: action.payload };
    case "SET_SYNCING":
      return { ...state, syncing: action.payload };
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
    case "ADD_REVIEW":
      return { ...state, reviews: [...state.reviews, action.payload] };
    case "DELETE_REVIEW":
      return { ...state, reviews: state.reviews.filter((r) => r.id !== action.payload) };
    case "ADD_DISCOUNT":
      return { ...state, discounts: [...state.discounts, action.payload] };
    case "UPDATE_DISCOUNT":
      return {
        ...state,
        discounts: state.discounts.map((d) =>
          d.id === action.payload.id ? action.payload : d
        ),
      };
    case "DELETE_DISCOUNT":
      return { ...state, discounts: state.discounts.filter((d) => d.id !== action.payload) };
    case "ADD_GIFT_CARD":
      return { ...state, giftCards: [...state.giftCards, action.payload] };
    case "UPDATE_GIFT_CARD":
      return {
        ...state,
        giftCards: state.giftCards.map((g) =>
          g.id === action.payload.id ? action.payload : g
        ),
      };
    case "DELETE_GIFT_CARD":
      return { ...state, giftCards: state.giftCards.filter((g) => g.id !== action.payload) };
    case "SET_CUSTOM_SCHEDULE": {
      const existing = state.customSchedule.findIndex((cs) => cs.date === action.payload.date);
      if (existing >= 0) {
        const updated = [...state.customSchedule];
        updated[existing] = action.payload;
        return { ...state, customSchedule: updated };
      }
      return { ...state, customSchedule: [...state.customSchedule, action.payload] };
    }
    case "DELETE_CUSTOM_SCHEDULE":
      return { ...state, customSchedule: state.customSchedule.filter((cs) => cs.date !== action.payload) };
    case "ADD_PRODUCT":
      return { ...state, products: [...state.products, action.payload] };
    case "UPDATE_PRODUCT":
      return {
        ...state,
        products: state.products.map((p) =>
          p.id === action.payload.id ? action.payload : p
        ),
      };
    case "DELETE_PRODUCT":
      return { ...state, products: state.products.filter((p) => p.id !== action.payload) };
    case "RESET_ALL_DATA":
      return { ...initialState, loaded: true };
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
  getReviewsForClient: (clientId: string) => Review[];
  getTodayStats: () => { todayCount: number; weekCount: number; weekRevenue: number };
  /** Sync a specific action to the database */
  syncToDb: (action: Action) => Promise<void>;
}

const StoreContext = createContext<StoreContextType | null>(null);

const STORAGE_KEYS = {
  services: "@bookease_services",
  clients: "@bookease_clients",
  appointments: "@bookease_appointments",
  reviews: "@bookease_reviews",
  settings: "@bookease_settings",
  businessOwnerId: "@bookease_business_owner_id",
  discounts: "@bookease_discounts",
  giftCards: "@bookease_gift_cards",
  customSchedule: "@bookease_custom_schedule",
  products: "@bookease_products",
};

/** Convert DB rows to local frontend models */
function dbServiceToLocal(s: any): Service {
  return {
    id: s.localId,
    name: s.name,
    duration: s.duration,
    price: typeof s.price === "string" ? parseFloat(s.price) : s.price,
    color: s.color,
    createdAt: s.createdAt ? new Date(s.createdAt).toISOString() : new Date().toISOString(),
  };
}

function dbClientToLocal(c: any): Client {
  return {
    id: c.localId,
    name: c.name,
    phone: c.phone ?? "",
    email: c.email ?? "",
    notes: c.notes ?? "",
    createdAt: c.createdAt ? new Date(c.createdAt).toISOString() : new Date().toISOString(),
  };
}

function dbAppointmentToLocal(a: any): Appointment {
  return {
    id: a.localId,
    serviceId: a.serviceLocalId,
    clientId: a.clientLocalId,
    date: a.date,
    time: a.time,
    duration: a.duration,
    status: a.status as AppointmentStatus,
    notes: a.notes ?? "",
    createdAt: a.createdAt ? new Date(a.createdAt).toISOString() : new Date().toISOString(),
  };
}

function dbReviewToLocal(r: any): Review {
  return {
    id: r.localId,
    clientId: r.clientLocalId,
    appointmentId: r.appointmentLocalId ?? undefined,
    rating: r.rating,
    comment: r.comment ?? "",
    createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : new Date().toISOString(),
  };
}

function dbDiscountToLocal(d: any): Discount {
  return {
    id: d.localId,
    name: d.name,
    percentage: d.percentage,
    startTime: d.startTime,
    endTime: d.endTime,
    daysOfWeek: Array.isArray(d.daysOfWeek) ? d.daysOfWeek : [],
    dates: Array.isArray(d.dates) ? d.dates : [],
    serviceIds: d.serviceIds ?? null,
    active: d.active ?? true,
    createdAt: d.createdAt ? new Date(d.createdAt).toISOString() : new Date().toISOString(),
  };
}

function dbGiftCardToLocal(g: any): GiftCard {
  return {
    id: g.localId,
    code: g.code,
    serviceLocalId: g.serviceLocalId,
    recipientName: g.recipientName ?? "",
    recipientPhone: g.recipientPhone ?? "",
    message: g.message ?? "",
    redeemed: g.redeemed ?? false,
    redeemedAt: g.redeemedAt ? new Date(g.redeemedAt).toISOString() : undefined,
    expiresAt: g.expiresAt ?? undefined,
    createdAt: g.createdAt ? new Date(g.createdAt).toISOString() : new Date().toISOString(),
  };
}

function dbProductToLocal(p: any): Product {
  return {
    id: p.localId,
    name: p.name,
    price: typeof p.price === "string" ? parseFloat(p.price) : p.price,
    description: p.description ?? "",
    available: p.available ?? true,
    createdAt: p.createdAt ? new Date(p.createdAt).toISOString() : new Date().toISOString(),
  };
}

function dbCustomScheduleToLocal(cs: any): CustomScheduleDay {
  return {
    date: cs.date,
    isOpen: cs.isOpen ?? true,
    startTime: cs.startTime ?? undefined,
    endTime: cs.endTime ?? undefined,
  };
}

function dbOwnerToSettings(owner: any): Partial<BusinessSettings> {
  return {
    businessName: owner.businessName,
    defaultDuration: owner.defaultDuration ?? 60,
    notificationsEnabled: owner.notificationsEnabled ?? true,
    themeMode: owner.themeMode ?? "system",
    temporaryClosed: owner.temporaryClosed ?? false,
    onboardingComplete: owner.onboardingComplete ?? false,
    businessLogoUri: owner.businessLogoUri ?? "",
    scheduleMode: owner.scheduleMode ?? "weekly",
    workingHours: owner.workingHours ?? DEFAULT_WORKING_HOURS,
    cancellationPolicy: owner.cancellationPolicy ?? DEFAULT_CANCELLATION_POLICY,
    profile: {
      ownerName: owner.ownerName ?? "",
      phone: owner.phone ?? "",
      email: owner.email ?? "",
      address: owner.address ?? "",
      description: owner.description ?? "",
      website: owner.website ?? "",
    },
  };
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const trpcUtils = trpc.useUtils();
  const businessOwnerIdRef = useRef<number | null>(null);

  // Keep ref in sync
  useEffect(() => {
    businessOwnerIdRef.current = state.businessOwnerId;
  }, [state.businessOwnerId]);

  // ─── tRPC mutations ─────────────────────────────────────────────
  const createServiceMut = trpc.services.create.useMutation();
  const updateServiceMut = trpc.services.update.useMutation();
  const deleteServiceMut = trpc.services.delete.useMutation();
  const createClientMut = trpc.clients.create.useMutation();
  const updateClientMut = trpc.clients.update.useMutation();
  const deleteClientMut = trpc.clients.delete.useMutation();
  const createApptMut = trpc.appointments.create.useMutation();
  const updateApptMut = trpc.appointments.update.useMutation();
  const deleteApptMut = trpc.appointments.delete.useMutation();
  const createReviewMut = trpc.reviews.create.useMutation();
  const deleteReviewMut = trpc.reviews.delete.useMutation();
  const updateBusinessMut = trpc.business.update.useMutation();
  const createDiscountMut = trpc.discounts.create.useMutation();
  const updateDiscountMut = trpc.discounts.update.useMutation();
  const deleteDiscountMut = trpc.discounts.delete.useMutation();
  const createGiftCardMut = trpc.giftCards.create.useMutation();
  const updateGiftCardMut = trpc.giftCards.update.useMutation();
  const deleteGiftCardMut = trpc.giftCards.delete.useMutation();
  const upsertScheduleMut = trpc.customSchedule.upsert.useMutation();
  const deleteScheduleMut = trpc.customSchedule.delete.useMutation();
  const createProductMut = trpc.products.create.useMutation();
  const updateProductMut = trpc.products.update.useMutation();
  const deleteProductMut = trpc.products.delete.useMutation();

  // ─── Bootstrap: Load from DB or fallback to AsyncStorage ────────
  useEffect(() => {
    (async () => {
      try {
        // First check if we have a stored business owner ID
        const storedOwnerId = await AsyncStorage.getItem(STORAGE_KEYS.businessOwnerId);
        
        if (storedOwnerId) {
          const ownerId = parseInt(storedOwnerId, 10);
          try {
            // Try to load from database
            const fullData = await trpcUtils.business.getFullData.fetch({ id: ownerId });
            if (fullData && fullData.owner) {
              const settingsFromDb = dbOwnerToSettings(fullData.owner);
              dispatch({
                type: "LOAD_DATA",
                payload: {
                  services: (fullData.services || []).map(dbServiceToLocal),
                  clients: (fullData.clients || []).map(dbClientToLocal),
                  appointments: (fullData.appointments || []).map(dbAppointmentToLocal),
                  reviews: (fullData.reviews || []).map(dbReviewToLocal),
                  discounts: (fullData.discounts || []).map(dbDiscountToLocal),
                  giftCards: (fullData.giftCards || []).map(dbGiftCardToLocal),
                  customSchedule: (fullData.customSchedule || []).map(dbCustomScheduleToLocal),
                  products: (fullData.products || []).map(dbProductToLocal),
                  settings: { ...initialSettings, ...settingsFromDb },
                  businessOwnerId: ownerId,
                },
              });
              // Also persist to AsyncStorage as cache
              await persistToAsyncStorage(
                (fullData.services || []).map(dbServiceToLocal),
                (fullData.clients || []).map(dbClientToLocal),
                (fullData.appointments || []).map(dbAppointmentToLocal),
                (fullData.reviews || []).map(dbReviewToLocal),
                { ...initialSettings, ...settingsFromDb },
                (fullData.discounts || []).map(dbDiscountToLocal),
                (fullData.giftCards || []).map(dbGiftCardToLocal),
                (fullData.customSchedule || []).map(dbCustomScheduleToLocal),
                (fullData.products || []).map(dbProductToLocal)
              );
              return;
            }
          } catch (err) {
            console.warn("[Store] Failed to load from DB, falling back to local:", err);
          }
        }

        // Fallback: load from AsyncStorage
        const [servicesRaw, clientsRaw, appointmentsRaw, reviewsRaw, settingsRaw, discountsRaw, giftCardsRaw, customScheduleRaw, productsRaw] =
          await Promise.all([
            AsyncStorage.getItem(STORAGE_KEYS.services),
            AsyncStorage.getItem(STORAGE_KEYS.clients),
            AsyncStorage.getItem(STORAGE_KEYS.appointments),
            AsyncStorage.getItem(STORAGE_KEYS.reviews),
            AsyncStorage.getItem(STORAGE_KEYS.settings),
            AsyncStorage.getItem(STORAGE_KEYS.discounts),
            AsyncStorage.getItem(STORAGE_KEYS.giftCards),
            AsyncStorage.getItem(STORAGE_KEYS.customSchedule),
            AsyncStorage.getItem(STORAGE_KEYS.products),
          ]);
        
        const loadedSettings = settingsRaw
          ? { ...initialSettings, ...JSON.parse(settingsRaw) }
          : initialSettings;
        
        dispatch({
          type: "LOAD_DATA",
          payload: {
            services: servicesRaw ? JSON.parse(servicesRaw) : [],
            clients: clientsRaw ? JSON.parse(clientsRaw) : [],
            appointments: appointmentsRaw ? JSON.parse(appointmentsRaw) : [],
            reviews: reviewsRaw ? JSON.parse(reviewsRaw) : [],
            discounts: discountsRaw ? JSON.parse(discountsRaw) : [],
            giftCards: giftCardsRaw ? JSON.parse(giftCardsRaw) : [],
            customSchedule: customScheduleRaw ? JSON.parse(customScheduleRaw) : [],
            products: productsRaw ? JSON.parse(productsRaw) : [],
            settings: loadedSettings,
            businessOwnerId: storedOwnerId ? parseInt(storedOwnerId, 10) : null,
          },
        });
      } catch {
        dispatch({ type: "LOAD_DATA", payload: {} });
      }
    })();
  }, []);

  // ─── Persist to AsyncStorage whenever state changes ─────────────
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
    AsyncStorage.setItem(STORAGE_KEYS.appointments, JSON.stringify(state.appointments));
  }, [state.appointments, state.loaded]);

  useEffect(() => {
    if (!state.loaded) return;
    AsyncStorage.setItem(STORAGE_KEYS.reviews, JSON.stringify(state.reviews));
  }, [state.reviews, state.loaded]);

  useEffect(() => {
    if (!state.loaded) return;
    AsyncStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(state.settings));
  }, [state.settings, state.loaded]);

  useEffect(() => {
    if (!state.loaded) return;
    AsyncStorage.setItem(STORAGE_KEYS.discounts, JSON.stringify(state.discounts));
  }, [state.discounts, state.loaded]);

  useEffect(() => {
    if (!state.loaded) return;
    AsyncStorage.setItem(STORAGE_KEYS.giftCards, JSON.stringify(state.giftCards));
  }, [state.giftCards, state.loaded]);

  useEffect(() => {
    if (!state.loaded) return;
    AsyncStorage.setItem(STORAGE_KEYS.customSchedule, JSON.stringify(state.customSchedule));
  }, [state.customSchedule, state.loaded]);

  useEffect(() => {
    if (!state.loaded) return;
    AsyncStorage.setItem(STORAGE_KEYS.products, JSON.stringify(state.products));
  }, [state.products, state.loaded]);

  useEffect(() => {
    if (state.businessOwnerId !== null) {
      AsyncStorage.setItem(STORAGE_KEYS.businessOwnerId, String(state.businessOwnerId));
    }
  }, [state.businessOwnerId]);

  // ─── Sync action to database ────────────────────────────────────
  const syncToDb = useCallback(
    async (action: Action) => {
      const ownerId = businessOwnerIdRef.current;
      if (!ownerId) return; // No business owner yet, skip DB sync

      try {
        switch (action.type) {
          case "ADD_SERVICE": {
            const svc = action.payload as Service;
            await createServiceMut.mutateAsync({
              businessOwnerId: ownerId,
              localId: svc.id,
              name: svc.name,
              duration: svc.duration,
              price: String(svc.price),
              color: svc.color,
            });
            break;
          }
          case "UPDATE_SERVICE": {
            const svc = action.payload as Service;
            // Find the DB record by localId
            const dbSvc = await trpcUtils.services.list.fetch({ businessOwnerId: ownerId });
            const match = dbSvc.find((s: any) => s.localId === svc.id);
            if (match) {
              await updateServiceMut.mutateAsync({
                dbId: match.id,
                businessOwnerId: ownerId,
                name: svc.name,
                duration: svc.duration,
                price: String(svc.price),
                color: svc.color,
              });
            }
            break;
          }
          case "DELETE_SERVICE": {
            await deleteServiceMut.mutateAsync({
              localId: action.payload as string,
              businessOwnerId: ownerId,
            });
            break;
          }
          case "ADD_CLIENT": {
            const cl = action.payload as Client;
            await createClientMut.mutateAsync({
              businessOwnerId: ownerId,
              localId: cl.id,
              name: cl.name,
              phone: cl.phone || undefined,
              email: cl.email || undefined,
              notes: cl.notes || undefined,
            });
            break;
          }
          case "UPDATE_CLIENT": {
            const cl = action.payload as Client;
            await updateClientMut.mutateAsync({
              localId: cl.id,
              businessOwnerId: ownerId,
              name: cl.name,
              phone: cl.phone || undefined,
              email: cl.email || undefined,
              notes: cl.notes || undefined,
            });
            break;
          }
          case "DELETE_CLIENT": {
            await deleteClientMut.mutateAsync({
              localId: action.payload as string,
              businessOwnerId: ownerId,
            });
            break;
          }
          case "ADD_APPOINTMENT": {
            const appt = action.payload as Appointment;
            await createApptMut.mutateAsync({
              businessOwnerId: ownerId,
              localId: appt.id,
              serviceLocalId: appt.serviceId,
              clientLocalId: appt.clientId,
              date: appt.date,
              time: appt.time,
              duration: appt.duration,
              status: appt.status,
              notes: appt.notes || undefined,
            });
            break;
          }
          case "UPDATE_APPOINTMENT": {
            const appt = action.payload as Appointment;
            await updateApptMut.mutateAsync({
              localId: appt.id,
              businessOwnerId: ownerId,
              status: appt.status,
              date: appt.date,
              time: appt.time,
              duration: appt.duration,
              notes: appt.notes || undefined,
            });
            break;
          }
          case "UPDATE_APPOINTMENT_STATUS": {
            const { id, status } = action.payload as { id: string; status: AppointmentStatus };
            await updateApptMut.mutateAsync({
              localId: id,
              businessOwnerId: ownerId,
              status,
            });
            break;
          }
          case "DELETE_APPOINTMENT": {
            await deleteApptMut.mutateAsync({
              localId: action.payload as string,
              businessOwnerId: ownerId,
            });
            break;
          }
          case "ADD_REVIEW": {
            const rev = action.payload as Review;
            await createReviewMut.mutateAsync({
              businessOwnerId: ownerId,
              localId: rev.id,
              clientLocalId: rev.clientId,
              appointmentLocalId: rev.appointmentId || undefined,
              rating: rev.rating,
              comment: rev.comment || undefined,
            });
            break;
          }
          case "DELETE_REVIEW": {
            await deleteReviewMut.mutateAsync({
              localId: action.payload as string,
              businessOwnerId: ownerId,
            });
            break;
          }
          case "UPDATE_SETTINGS": {
            const settings = action.payload as Partial<BusinessSettings>;
            const updateData: any = { id: ownerId };
            if (settings.businessName !== undefined) updateData.businessName = settings.businessName;
            if (settings.profile) {
              if (settings.profile.ownerName !== undefined) updateData.ownerName = settings.profile.ownerName;
              if (settings.profile.phone !== undefined) updateData.phone = settings.profile.phone;
              if (settings.profile.email !== undefined) updateData.email = settings.profile.email;
              if (settings.profile.address !== undefined) updateData.address = settings.profile.address;
              if (settings.profile.description !== undefined) updateData.description = settings.profile.description;
              if (settings.profile.website !== undefined) updateData.website = settings.profile.website;
            }
            if (settings.businessLogoUri !== undefined) updateData.businessLogoUri = settings.businessLogoUri;
            if (settings.defaultDuration !== undefined) updateData.defaultDuration = settings.defaultDuration;
            if (settings.notificationsEnabled !== undefined) updateData.notificationsEnabled = settings.notificationsEnabled;
            if (settings.themeMode !== undefined) updateData.themeMode = settings.themeMode;
            if (settings.temporaryClosed !== undefined) updateData.temporaryClosed = settings.temporaryClosed;
            if (settings.scheduleMode !== undefined) updateData.scheduleMode = settings.scheduleMode;
            if (settings.workingHours !== undefined) updateData.workingHours = settings.workingHours;
            if (settings.cancellationPolicy !== undefined) updateData.cancellationPolicy = settings.cancellationPolicy;
            // Only update if there's something besides id
            if (Object.keys(updateData).length > 1) {
              await updateBusinessMut.mutateAsync(updateData);
            }
            break;
          }
          case "ADD_DISCOUNT": {
            const disc = action.payload as Discount;
            await createDiscountMut.mutateAsync({
              businessOwnerId: ownerId,
              localId: disc.id,
              name: disc.name,
              percentage: disc.percentage,
              startTime: disc.startTime,
              endTime: disc.endTime,
              daysOfWeek: disc.daysOfWeek,
              dates: disc.dates ?? [],
              serviceIds: disc.serviceIds,
              active: disc.active,
            });
            break;
          }
          case "UPDATE_DISCOUNT": {
            const disc = action.payload as Discount;
            await updateDiscountMut.mutateAsync({
              localId: disc.id,
              businessOwnerId: ownerId,
              name: disc.name,
              percentage: disc.percentage,
              startTime: disc.startTime,
              endTime: disc.endTime,
              daysOfWeek: disc.daysOfWeek,
              dates: disc.dates ?? [],
              serviceIds: disc.serviceIds,
              active: disc.active,
            });
            break;
          }
          case "DELETE_DISCOUNT": {
            await deleteDiscountMut.mutateAsync({
              localId: action.payload as string,
              businessOwnerId: ownerId,
            });
            break;
          }
          case "ADD_GIFT_CARD": {
            const gc = action.payload as GiftCard;
            await createGiftCardMut.mutateAsync({
              businessOwnerId: ownerId,
              localId: gc.id,
              code: gc.code,
              serviceLocalId: gc.serviceLocalId,
              recipientName: gc.recipientName || undefined,
              recipientPhone: gc.recipientPhone || undefined,
              message: gc.message || undefined,
              expiresAt: gc.expiresAt || undefined,
            });
            break;
          }
          case "UPDATE_GIFT_CARD": {
            const gc = action.payload as GiftCard;
            await updateGiftCardMut.mutateAsync({
              localId: gc.id,
              businessOwnerId: ownerId,
              redeemed: gc.redeemed,
              redeemedAt: gc.redeemedAt,
            });
            break;
          }
          case "DELETE_GIFT_CARD": {
            await deleteGiftCardMut.mutateAsync({
              localId: action.payload as string,
              businessOwnerId: ownerId,
            });
            break;
          }
          case "SET_CUSTOM_SCHEDULE": {
            const cs = action.payload as CustomScheduleDay;
            await upsertScheduleMut.mutateAsync({
              businessOwnerId: ownerId,
              date: cs.date,
              isOpen: cs.isOpen,
              startTime: cs.startTime,
              endTime: cs.endTime,
            });
            break;
          }
          case "DELETE_CUSTOM_SCHEDULE": {
            await deleteScheduleMut.mutateAsync({
              businessOwnerId: ownerId,
              date: action.payload as string,
            });
            break;
          }
          case "ADD_PRODUCT": {
            const prod = action.payload as Product;
            await createProductMut.mutateAsync({
              businessOwnerId: ownerId,
              localId: prod.id,
              name: prod.name,
              price: String(prod.price),
              description: prod.description || undefined,
              available: prod.available,
            });
            break;
          }
          case "UPDATE_PRODUCT": {
            const prod = action.payload as Product;
            await updateProductMut.mutateAsync({
              localId: prod.id,
              businessOwnerId: ownerId,
              name: prod.name,
              price: String(prod.price),
              description: prod.description || undefined,
              available: prod.available,
            });
            break;
          }
          case "DELETE_PRODUCT": {
            await deleteProductMut.mutateAsync({
              localId: action.payload as string,
              businessOwnerId: ownerId,
            });
            break;
          }
          default:
            break;
        }
      } catch (err) {
        console.warn("[Store] Failed to sync to DB:", action.type, err);
        // Local state is still updated, DB sync failed silently
      }
    },
    []
  );

  // ─── Selectors ──────────────────────────────────────────────────
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

  const getReviewsForClient = useCallback(
    (clientId: string) =>
      state.reviews.filter((r) => r.clientId === clientId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [state.reviews]
  );

  const getTodayStats = useCallback(() => {
    const now = new Date();
    const todayStr = formatDateStr(now);
    const todayCount = state.appointments.filter(
      (a) => a.date === todayStr && a.status !== "cancelled"
    ).length;

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
      if (a.totalPrice != null) return sum + a.totalPrice;
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
        getReviewsForClient,
        getTodayStats,
        syncToDb,
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
async function persistToAsyncStorage(
  services: Service[],
  clients: Client[],
  appointments: Appointment[],
  reviews: Review[],
  settings: BusinessSettings,
  discounts?: Discount[],
  giftCards?: GiftCard[],
  customSchedule?: CustomScheduleDay[],
  products?: Product[]
) {
  try {
    const ops = [
      AsyncStorage.setItem(STORAGE_KEYS.services, JSON.stringify(services)),
      AsyncStorage.setItem(STORAGE_KEYS.clients, JSON.stringify(clients)),
      AsyncStorage.setItem(STORAGE_KEYS.appointments, JSON.stringify(appointments)),
      AsyncStorage.setItem(STORAGE_KEYS.reviews, JSON.stringify(reviews)),
      AsyncStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(settings)),
    ];
    if (discounts) ops.push(AsyncStorage.setItem(STORAGE_KEYS.discounts, JSON.stringify(discounts)));
    if (giftCards) ops.push(AsyncStorage.setItem(STORAGE_KEYS.giftCards, JSON.stringify(giftCards)));
    if (customSchedule) ops.push(AsyncStorage.setItem(STORAGE_KEYS.customSchedule, JSON.stringify(customSchedule)));
    if (products) ops.push(AsyncStorage.setItem(STORAGE_KEYS.products, JSON.stringify(products)));
    await Promise.all(ops);
  } catch (err) {
    console.warn("[Store] Failed to persist to AsyncStorage:", err);
  }
}

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
