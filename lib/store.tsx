import React, { createContext, useContext, useEffect, useReducer, useCallback, useMemo, useRef } from "react";
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
  StaffMember,
  Location,
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
  /** Per-location custom schedule overrides. Key = locationId, value = array of day overrides for that location. */
  locationCustomSchedule: Record<string, CustomScheduleDay[]>;
  products: Product[];
  staff: StaffMember[];
  locations: Location[];
  settings: BusinessSettings;
  loaded: boolean;
  /** DB id of the current business owner – null until bootstrap completes */
  businessOwnerId: number | null;
  /** Whether we're currently syncing with the server */
  syncing: boolean;
  /** The currently active location ID (null = all locations / no filter) */
  activeLocationId: string | null;
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
  bufferTime: 0,
  customSlug: "",
  businessHoursEndDate: null,
};

const initialState: AppState = {
  services: [],
  clients: [],
  appointments: [],
  reviews: [],
  discounts: [],
  giftCards: [],
  customSchedule: [],
  locationCustomSchedule: {},
  products: [],
  staff: [],
  locations: [],
  settings: initialSettings,
  loaded: false,
  businessOwnerId: null,
  syncing: false,
  activeLocationId: null,
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
  | { type: "SET_LOCATION_CUSTOM_SCHEDULE"; payload: { locationId: string; day: CustomScheduleDay } }
  | { type: "DELETE_LOCATION_CUSTOM_SCHEDULE"; payload: { locationId: string; date: string } }
  | { type: "ADD_PRODUCT"; payload: Product }
  | { type: "UPDATE_PRODUCT"; payload: Product }
  | { type: "DELETE_PRODUCT"; payload: string }
  | { type: "ADD_STAFF"; payload: StaffMember }
  | { type: "UPDATE_STAFF"; payload: StaffMember }
  | { type: "DELETE_STAFF"; payload: string }
  | { type: "ADD_LOCATION"; payload: Location }
  | { type: "UPDATE_LOCATION"; payload: Location }
  | { type: "DELETE_LOCATION"; payload: string }
  | { type: "SET_ACTIVE_LOCATION"; payload: string | null }
  | { type: "RESET_ALL_DATA" };

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "LOAD_DATA":
      return { ...state, ...action.payload, loaded: true };
    case "SET_BUSINESS_OWNER_ID":
      return { ...state, businessOwnerId: action.payload };
    case "SET_SYNCING":
      return { ...state, syncing: action.payload };
    case "SET_ACTIVE_LOCATION":
      return { ...state, activeLocationId: action.payload };
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
    case "SET_LOCATION_CUSTOM_SCHEDULE": {
      const { locationId, day } = action.payload;
      const existing = (state.locationCustomSchedule[locationId] ?? []);
      const idx = existing.findIndex((cs) => cs.date === day.date);
      const updated = idx >= 0
        ? existing.map((cs, i) => i === idx ? day : cs)
        : [...existing, day];
      return { ...state, locationCustomSchedule: { ...state.locationCustomSchedule, [locationId]: updated } };
    }
    case "DELETE_LOCATION_CUSTOM_SCHEDULE": {
      const { locationId, date } = action.payload;
      const existing = (state.locationCustomSchedule[locationId] ?? []);
      const updated = existing.filter((cs) => cs.date !== date);
      return { ...state, locationCustomSchedule: { ...state.locationCustomSchedule, [locationId]: updated } };
    }
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
    case "ADD_STAFF":
      return { ...state, staff: [...state.staff, action.payload] };
    case "UPDATE_STAFF":
      return {
        ...state,
        staff: state.staff.map((s) =>
          s.id === action.payload.id ? action.payload : s
        ),
      };
    case "DELETE_STAFF":
      return { ...state, staff: state.staff.filter((s) => s.id !== action.payload) };
    case "ADD_LOCATION":
      return { ...state, locations: [...state.locations, action.payload] };
    case "UPDATE_LOCATION":
      return {
        ...state,
        locations: state.locations.map((l) =>
          l.id === action.payload.id ? action.payload : l
        ),
      };
    case "DELETE_LOCATION":
      return { ...state, locations: state.locations.filter((l) => l.id !== action.payload) };
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
  getStaffById: (id: string) => StaffMember | undefined;
  getLocationById: (id: string) => Location | undefined;
  getAppointmentsForDate: (date: string) => Appointment[];
  getAppointmentsForClient: (clientId: string) => Appointment[];
  getReviewsForClient: (clientId: string) => Review[];
  getTodayStats: () => { todayCount: number; weekCount: number; weekRevenue: number };
  /** Filter appointments by the active location (pass-through when no location selected) */
  filterAppointmentsByLocation: (appointments: Appointment[]) => Appointment[];
  /** Clients who have had at least one appointment at the active location (all clients when no location selected) */
  clientsForActiveLocation: Client[];
  /** Returns the custom schedule overrides for the active location (or global if no location active) */
  getActiveCustomSchedule: () => CustomScheduleDay[];
  /** Sync a specific action to the database */
  syncToDb: (action: Action) => Promise<void>;
  /** Set the active location and persist to AsyncStorage */
  setActiveLocation: (locationId: string | null) => void;
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
  locationCustomSchedule: "@bookease_location_custom_schedule",
  products: "@bookease_products",
  staff: "@bookease_staff",
  locations: "@bookease_locations",
  activeLocationId: "@bookease_active_location_id",
};

/** Convert DB rows to local frontend models */
function dbServiceToLocal(s: any): Service {
  return {
    id: s.localId,
    name: s.name,
    duration: s.duration,
    price: typeof s.price === "string" ? parseFloat(s.price) : s.price,
    color: s.color,
    category: s.category ?? undefined,
    locationIds: s.locationIds ?? null,
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
  const notes = a.notes ?? "";
  // Prefer structured DB columns over notes parsing
  let totalPrice: number | undefined = a.totalPrice != null ? parseFloat(String(a.totalPrice)) : undefined;
  let extraItems: { type: "service" | "product"; id: string; name: string; price: number; duration: number }[] | undefined = Array.isArray(a.extraItems) ? a.extraItems : undefined;
  let giftApplied: boolean | undefined = a.giftApplied === true || a.giftApplied === 1 ? true : undefined;
  let giftUsedAmount: number | undefined = a.giftUsedAmount != null ? parseFloat(String(a.giftUsedAmount)) : undefined;
  let discountPercent: number | undefined = a.discountPercent != null ? a.discountPercent : undefined;
  let discountAmount: number | undefined = a.discountAmount != null ? parseFloat(String(a.discountAmount)) : undefined;
  let discountName: string | undefined = a.discountName ?? undefined;
  let cleanNotes = notes;
  const hasDbPricing = totalPrice != null;

  // Only parse notes for pricing if DB columns are empty (backward compat for old appointments)
  const pricingIdx = notes.indexOf("--- Pricing ---");
  if (!hasDbPricing && pricingIdx >= 0) {
    const pricingBlock = notes.slice(pricingIdx + "--- Pricing ---".length).trim();
    cleanNotes = notes.slice(0, pricingIdx).trim();
    // Also strip "Additional items:" line from clean notes
    cleanNotes = cleanNotes.replace(/\nAdditional items:.*$/m, "").trim();

    const lines = pricingBlock.split("\n").map((l: string) => l.trim()).filter(Boolean);
    const extras: { type: "service" | "product"; id: string; name: string; price: number; duration: number }[] = [];
    for (const line of lines) {
      const totalMatch = line.match(/^Total Charged:\s*\$([\d.]+)/);
      if (totalMatch) {
        totalPrice = parseFloat(totalMatch[1]);
        continue;
      }
      const giftMatch = line.match(/^Gift Card:\s*-\$([\d.]+)/);
      if (giftMatch) {
        giftApplied = true;
        giftUsedAmount = parseFloat(giftMatch[1]);
        continue;
      }
      const discountMatch = line.match(/^Discount:\s*(.+?)\s*\((\d+)%\s*off\):\s*-\$([\d.]+)/);
      if (discountMatch) {
        discountName = discountMatch[1];
        discountPercent = parseInt(discountMatch[2], 10);
        discountAmount = parseFloat(discountMatch[3]);
        continue;
      }
      // Also match simpler discount format: "Discount: -$X.XX"
      const simpleDiscountMatch = line.match(/^Discount:\s*-\$([\d.]+)/);
      if (simpleDiscountMatch && !discountAmount) {
        discountAmount = parseFloat(simpleDiscountMatch[1]);
        continue;
      }
      const extraMatch = line.match(/^(Product|Extra|Service):\s*(.+?)\s*\u2014\s*\$([\d.]+)/);
      if (extraMatch) {
        extras.push({
          type: extraMatch[1] === "Product" ? "product" : "service",
          id: "",
          name: extraMatch[2],
          price: parseFloat(extraMatch[3]),
          duration: 0,
        });
      }
    }
    if (extras.length > 0) extraItems = extras;
  } else if (!hasDbPricing) {
    // Try to parse "Additional items:" from notes for older bookings
    const addlMatch = notes.match(/Additional items:\s*(.+)/);
    if (addlMatch) {
      const itemsStr = addlMatch[1];
      const items = itemsStr.split(",").map((s: string) => s.trim());
      const extras: { type: "service" | "product"; id: string; name: string; price: number; duration: number }[] = [];
      for (const item of items) {
        const m = item.match(/^(.+?)\s*\(\$([\d.]+)\)$/);
        if (m) {
          extras.push({ type: "service", id: "", name: m[1].trim(), price: parseFloat(m[2]), duration: 0 });
        }
      }
      if (extras.length > 0) extraItems = extras;
      cleanNotes = notes.replace(/\nAdditional items:.*$/m, "").trim();
    }
  }

  // Strip pricing block from notes for display regardless
  const pricingStripIdx = cleanNotes.indexOf("--- Pricing ---");
  if (pricingStripIdx >= 0) {
    cleanNotes = cleanNotes.slice(0, pricingStripIdx).trim();
  }
  cleanNotes = cleanNotes.replace(/\nAdditional items:.*$/m, "").trim();

  return {
    id: a.localId,
    serviceId: a.serviceLocalId,
    clientId: a.clientLocalId,
    date: a.date,
    time: a.time,
    duration: a.duration,
    status: a.status as AppointmentStatus,
    notes: cleanNotes,
    createdAt: a.createdAt ? new Date(a.createdAt).toISOString() : new Date().toISOString(),
    totalPrice,
    extraItems,
    giftApplied,
    giftUsedAmount,
    discountPercent,
    discountAmount,
    discountName,
    staffId: a.staffId ?? undefined,
  } as Appointment;
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
  // Parse extended data from message field (JSON block at end)
  let serviceIds: string[] | undefined;
  let productIds: string[] | undefined;
  let originalValue = 0;
  let remainingBalance = 0;
  let hasGiftData = false;
  const msg = g.message ?? "";
  const jsonMatch = msg.match(/\n---GIFT_DATA---\n(.+)$/s);
  if (jsonMatch) {
    try {
      const data = JSON.parse(jsonMatch[1]);
      serviceIds = data.serviceIds;
      productIds = data.productIds;
      originalValue = data.originalValue ?? 0;
      remainingBalance = data.remainingBalance ?? originalValue;
      hasGiftData = true;
    } catch {}
  }
  // For old cards without GIFT_DATA block, serviceIds defaults to serviceLocalId
  if (!hasGiftData && g.serviceLocalId) {
    serviceIds = [g.serviceLocalId];
    // originalValue and remainingBalance stay 0 — will be resolved at display time via catalog lookup
  }
  const cleanMessage = msg.replace(/\n---GIFT_DATA---\n.+$/s, "");
  return {
    id: g.localId,
    code: g.code,
    serviceLocalId: g.serviceLocalId,
    serviceIds,
    productIds,
    originalValue,
    remainingBalance,
    recipientName: g.recipientName ?? "",
    recipientPhone: g.recipientPhone ?? "",
    message: cleanMessage,
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
    brand: p.brand ?? undefined,
    available: p.available ?? true,
    createdAt: p.createdAt ? new Date(p.createdAt).toISOString() : new Date().toISOString(),
  };
}

function dbStaffToLocal(s: any): StaffMember {
  return {
    id: s.localId,
    name: s.name,
    phone: s.phone ?? "",
    email: s.email ?? "",
    role: s.role ?? "",
    color: s.color ?? "#3B82F6",
    serviceIds: s.serviceIds ?? null,
    locationIds: s.locationIds ?? null,
    workingHours: s.workingHours ?? null,
    active: s.active ?? true,
    createdAt: s.createdAt ? new Date(s.createdAt).toISOString() : new Date().toISOString(),
  };
}

function dbLocationToLocal(l: any): Location {
  return {
    id: l.localId,
    name: l.name,
    address: l.address ?? "",
    city: l.city ?? undefined,
    state: l.state ?? undefined,
    zipCode: l.zipCode ?? undefined,
    phone: l.phone ?? "",
    email: l.email ?? "",
    isDefault: l.isDefault ?? false,
    active: l.active ?? true,
    workingHours: l.workingHours ?? null,
    createdAt: l.createdAt ? new Date(l.createdAt).toISOString() : new Date().toISOString(),
  };
}

function dbCustomScheduleToLocal(cs: any): CustomScheduleDay {
  return {
    date: cs.date,
    isOpen: cs.isOpen ?? true,
    startTime: cs.startTime ?? undefined,
    endTime: cs.endTime ?? undefined,
    locationId: cs.locationId ?? null,
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
    bufferTime: owner.bufferTime ?? 0,
    customSlug: owner.customSlug ?? "",
    businessHoursEndDate: (owner as any).businessHoursEndDate ?? null,
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
  const createStaffMut = trpc.staff.create.useMutation();
  const updateStaffMut = trpc.staff.update.useMutation();
  const deleteStaffMut = trpc.staff.delete.useMutation();
  const createLocationMut = trpc.locations.create.useMutation();
  const updateLocationMut = trpc.locations.update.useMutation();
  const deleteLocationMut = trpc.locations.delete.useMutation();

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
                  staff: (fullData.staff || []).map(dbStaffToLocal),
                  locations: (fullData.locations || []).map(dbLocationToLocal),
                  settings: { ...initialSettings, ...settingsFromDb },
                  businessOwnerId: ownerId,
                },
              });
              // Restore active location from AsyncStorage (or auto-set default)
              const storedActiveLoc = await AsyncStorage.getItem(STORAGE_KEYS.activeLocationId);
              const loadedLocations = (fullData.locations || []).map(dbLocationToLocal);
              const activeLocations = loadedLocations.filter((l) => l.active);
              if (storedActiveLoc && activeLocations.some((l) => l.id === storedActiveLoc)) {
                dispatch({ type: "SET_ACTIVE_LOCATION", payload: storedActiveLoc });
              } else if (activeLocations.length === 1) {
                dispatch({ type: "SET_ACTIVE_LOCATION", payload: activeLocations[0].id });
                AsyncStorage.setItem(STORAGE_KEYS.activeLocationId, activeLocations[0].id).catch(() => {});
              } else if (activeLocations.length > 1) {
                const defaultLoc = activeLocations.find((l) => l.isDefault) ?? activeLocations[0];
                dispatch({ type: "SET_ACTIVE_LOCATION", payload: defaultLoc.id });
                AsyncStorage.setItem(STORAGE_KEYS.activeLocationId, defaultLoc.id).catch(() => {});
              }
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
                (fullData.products || []).map(dbProductToLocal),
                (fullData.staff || []).map(dbStaffToLocal),
                (fullData.locations || []).map(dbLocationToLocal)
              );
              return;
            }
          } catch (err) {
            console.warn("[Store] Failed to load from DB, falling back to local:", err);
          }
        }

        // Fallback: load from AsyncStorage
        const [servicesRaw, clientsRaw, appointmentsRaw, reviewsRaw, settingsRaw, discountsRaw, giftCardsRaw, customScheduleRaw, productsRaw, staffRaw, locationsRaw, locationCustomScheduleRaw] =
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
            AsyncStorage.getItem(STORAGE_KEYS.staff),
            AsyncStorage.getItem(STORAGE_KEYS.locations),
            AsyncStorage.getItem(STORAGE_KEYS.locationCustomSchedule),
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
            locationCustomSchedule: locationCustomScheduleRaw ? JSON.parse(locationCustomScheduleRaw) : {},
            products: productsRaw ? JSON.parse(productsRaw) : [],
            staff: staffRaw ? JSON.parse(staffRaw) : [],
            locations: locationsRaw ? JSON.parse(locationsRaw) : [],
            settings: loadedSettings,
            businessOwnerId: storedOwnerId ? parseInt(storedOwnerId, 10) : null,
          },
        });
        // Restore active location from AsyncStorage (or auto-set default)
        const storedActiveLoc2 = await AsyncStorage.getItem(STORAGE_KEYS.activeLocationId);
        const parsedLocations: Location[] = locationsRaw ? JSON.parse(locationsRaw) : [];
        const activeLocations2 = parsedLocations.filter((l) => l.active);
        if (storedActiveLoc2 && activeLocations2.some((l) => l.id === storedActiveLoc2)) {
          dispatch({ type: "SET_ACTIVE_LOCATION", payload: storedActiveLoc2 });
        } else if (activeLocations2.length === 1) {
          dispatch({ type: "SET_ACTIVE_LOCATION", payload: activeLocations2[0].id });
          AsyncStorage.setItem(STORAGE_KEYS.activeLocationId, activeLocations2[0].id).catch(() => {});
        } else if (activeLocations2.length > 1) {
          const defaultLoc2 = activeLocations2.find((l) => l.isDefault) ?? activeLocations2[0];
          dispatch({ type: "SET_ACTIVE_LOCATION", payload: defaultLoc2.id });
          AsyncStorage.setItem(STORAGE_KEYS.activeLocationId, defaultLoc2.id).catch(() => {});
        }
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
    AsyncStorage.setItem(STORAGE_KEYS.locationCustomSchedule, JSON.stringify(state.locationCustomSchedule));
  }, [state.locationCustomSchedule, state.loaded]);

  useEffect(() => {
    if (!state.loaded) return;
    AsyncStorage.setItem(STORAGE_KEYS.products, JSON.stringify(state.products));
  }, [state.products, state.loaded]);

  useEffect(() => {
    if (!state.loaded) return;
    AsyncStorage.setItem(STORAGE_KEYS.staff, JSON.stringify(state.staff));
  }, [state.staff, state.loaded]);

  useEffect(() => {
    if (!state.loaded) return;
    AsyncStorage.setItem(STORAGE_KEYS.locations, JSON.stringify(state.locations));
  }, [state.locations, state.loaded]);

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
              category: svc.category,
              locationIds: svc.locationIds,
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
                category: svc.category,
                locationIds: svc.locationIds,
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
            // Enrich notes with pricing info for DB persistence
            let enrichedNotes = appt.notes || "";
            const svc = state.services.find(s => s.id === appt.serviceId);
            const svcPrice = svc?.price ?? 0;
            const extras = appt.extraItems ?? [];
            const hasDiscount = (appt.discountAmount ?? 0) > 0;
            if (extras.length > 0 || appt.giftApplied || hasDiscount) {
              const pricingLines: string[] = [];
              pricingLines.push(`Service: ${svc?.name ?? "Service"} \u2014 $${svcPrice.toFixed(2)}`);
              extras.forEach(e => {
                pricingLines.push(`${e.type === "product" ? "Product" : "Extra"}: ${e.name} \u2014 $${(e.price || 0).toFixed(2)}`);
              });
              if (hasDiscount) {
                const dName = appt.discountName || "Discount";
                const dPct = appt.discountPercent ?? 0;
                const dAmt = appt.discountAmount ?? 0;
                pricingLines.push(`Discount: ${dName} (${dPct}% off): -$${dAmt.toFixed(2)}`);
              }
              if (appt.giftApplied) {
                const giftAmt = appt.giftUsedAmount ?? svcPrice;
                pricingLines.push(`Gift Card: -$${giftAmt.toFixed(2)}`);
              }
              pricingLines.push(`Total Charged: $${(appt.totalPrice ?? svcPrice).toFixed(2)}`);
              enrichedNotes = (enrichedNotes ? enrichedNotes + "\n" : "") + "--- Pricing ---\n" + pricingLines.join("\n");
            } else if (appt.totalPrice != null && appt.totalPrice !== svcPrice) {
              enrichedNotes = (enrichedNotes ? enrichedNotes + "\n" : "") + `--- Pricing ---\nService: ${svc?.name ?? "Service"} \u2014 $${svcPrice.toFixed(2)}\nTotal Charged: $${appt.totalPrice.toFixed(2)}`;
            }
            await createApptMut.mutateAsync({
              businessOwnerId: ownerId,
              localId: appt.id,
              serviceLocalId: appt.serviceId,
              clientLocalId: appt.clientId,
              date: appt.date,
              time: appt.time,
              duration: appt.duration,
              status: appt.status,
              notes: enrichedNotes || undefined,
              totalPrice: appt.totalPrice,
              extraItems: appt.extraItems,
              discountPercent: appt.discountPercent,
              discountAmount: appt.discountAmount,
              discountName: appt.discountName,
              giftApplied: appt.giftApplied,
              giftUsedAmount: appt.giftUsedAmount,
              staffId: appt.staffId,
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
              totalPrice: appt.totalPrice,
              extraItems: appt.extraItems,
              discountPercent: appt.discountPercent,
              discountAmount: appt.discountAmount,
              discountName: appt.discountName,
              giftApplied: appt.giftApplied,
              giftUsedAmount: appt.giftUsedAmount,
              staffId: appt.staffId,
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
            if ((settings as any).bufferTime !== undefined) updateData.bufferTime = (settings as any).bufferTime;
            if ((settings as any).customSlug !== undefined) updateData.customSlug = (settings as any).customSlug;
            if ((settings as any).businessHoursEndDate !== undefined) updateData.businessHoursEndDate = (settings as any).businessHoursEndDate;
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
            // Encode extended data (serviceIds, productIds, balance) in message field
            const giftDataBlock = `\n---GIFT_DATA---\n${JSON.stringify({
              serviceIds: gc.serviceIds,
              productIds: gc.productIds,
              originalValue: gc.originalValue,
              remainingBalance: gc.remainingBalance,
            })}`;
            const msgWithData = (gc.message || "") + giftDataBlock;
            await createGiftCardMut.mutateAsync({
              businessOwnerId: ownerId,
              localId: gc.id,
              code: gc.code,
              serviceLocalId: gc.serviceLocalId,
              recipientName: gc.recipientName || undefined,
              recipientPhone: gc.recipientPhone || undefined,
              message: msgWithData,
              expiresAt: gc.expiresAt || undefined,
            });
            break;
          }
          case "UPDATE_GIFT_CARD": {
            const gc = action.payload as GiftCard;
            // Re-encode extended data in message field for balance updates
            const updGiftDataBlock = `\n---GIFT_DATA---\n${JSON.stringify({
              serviceIds: gc.serviceIds,
              productIds: gc.productIds,
              originalValue: gc.originalValue,
              remainingBalance: gc.remainingBalance,
            })}`;
            const updMsgWithData = (gc.message || "") + updGiftDataBlock;
            await updateGiftCardMut.mutateAsync({
              localId: gc.id,
              businessOwnerId: ownerId,
              redeemed: gc.redeemed,
              redeemedAt: gc.redeemedAt,
              message: updMsgWithData,
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
              locationId: cs.locationId ?? undefined,
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
          case "SET_LOCATION_CUSTOM_SCHEDULE": {
            const { locationId, day } = action.payload as { locationId: string; day: CustomScheduleDay };
            await upsertScheduleMut.mutateAsync({
              businessOwnerId: ownerId,
              date: day.date,
              isOpen: day.isOpen,
              startTime: day.startTime,
              endTime: day.endTime,
              locationId,
            });
            break;
          }
          case "DELETE_LOCATION_CUSTOM_SCHEDULE": {
            const { locationId, date } = action.payload as { locationId: string; date: string };
            await deleteScheduleMut.mutateAsync({
              businessOwnerId: ownerId,
              date,
              locationId,
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
              brand: prod.brand || undefined,
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
              brand: prod.brand || undefined,
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
          case "ADD_STAFF": {
            const staff = action.payload as StaffMember;
            await createStaffMut.mutateAsync({
              businessOwnerId: ownerId,
              localId: staff.id,
              name: staff.name,
              phone: staff.phone || undefined,
              email: staff.email || undefined,
              role: staff.role || undefined,
              color: staff.color || undefined,
              serviceIds: staff.serviceIds,
              locationIds: staff.locationIds,
              workingHours: staff.workingHours,
              active: staff.active,
            });
            break;
          }
          case "UPDATE_STAFF": {
            const staff = action.payload as StaffMember;
            await updateStaffMut.mutateAsync({
              localId: staff.id,
              businessOwnerId: ownerId,
              name: staff.name,
              phone: staff.phone || undefined,
              email: staff.email || undefined,
              role: staff.role || undefined,
              color: staff.color || undefined,
              serviceIds: staff.serviceIds,
              locationIds: staff.locationIds,
              workingHours: staff.workingHours,
              active: staff.active,
            });
            break;
          }
          case "DELETE_STAFF": {
            await deleteStaffMut.mutateAsync({
              localId: action.payload as string,
              businessOwnerId: ownerId,
            });
            break;
          }
          case "ADD_LOCATION": {
            const loc = action.payload as Location;
            await createLocationMut.mutateAsync({
              businessOwnerId: ownerId,
              localId: loc.id,
              name: loc.name,
              address: loc.address || undefined,
              city: loc.city || undefined,
              state: loc.state || undefined,
              zipCode: loc.zipCode || undefined,
              phone: loc.phone || undefined,
              email: loc.email || undefined,
              isDefault: loc.isDefault,
              active: loc.active,
              workingHours: loc.workingHours,
            });
            break;
          }
          case "UPDATE_LOCATION": {
            const loc = action.payload as Location;
            await updateLocationMut.mutateAsync({
              localId: loc.id,
              businessOwnerId: ownerId,
              name: loc.name,
              address: loc.address || undefined,
              city: loc.city || undefined,
              state: loc.state || undefined,
              zipCode: loc.zipCode || undefined,
              phone: loc.phone || undefined,
              email: loc.email || undefined,
              isDefault: loc.isDefault,
              active: loc.active,
              workingHours: loc.workingHours,
            });
            break;
          }
          case "DELETE_LOCATION": {
            await deleteLocationMut.mutateAsync({
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

  const getStaffById = useCallback(
    (id: string) => state.staff.find((s) => s.id === id),
    [state.staff]
  );

  const getLocationById = useCallback(
    (id: string) => state.locations.find((l) => l.id === id),
    [state.locations]
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
  const setActiveLocation = useCallback(
    (locationId: string | null) => {
      dispatch({ type: "SET_ACTIVE_LOCATION", payload: locationId });
      if (locationId) {
        AsyncStorage.setItem(STORAGE_KEYS.activeLocationId, locationId).catch(() => {});
      } else {
        AsyncStorage.removeItem(STORAGE_KEYS.activeLocationId).catch(() => {});
      }
    },
    [dispatch]
  );

  /**
   * Returns only appointments belonging to the active location.
   * When no location is active (null), returns all appointments unchanged.
   */
  const filterAppointmentsByLocation = useCallback(
    (appointments: Appointment[]) => {
      if (!state.activeLocationId) return appointments;
      return appointments.filter((a) => a.locationId === state.activeLocationId);
    },
    [state.activeLocationId]
  );

  /**
   * Returns the custom schedule overrides for the active location.
   * Falls back to the global customSchedule when no location is active.
   */
  const getActiveCustomSchedule = useCallback((): CustomScheduleDay[] => {
    if (!state.activeLocationId) return state.customSchedule;
    return state.locationCustomSchedule[state.activeLocationId] ?? [];
  }, [state.activeLocationId, state.locationCustomSchedule, state.customSchedule]);

  /**
   * Clients who have had at least one appointment at the active location.
   * When no location is active, returns all clients.
   */
  const clientsForActiveLocation = useMemo(() => {
    if (!state.activeLocationId) return state.clients;
    const clientIdsAtLocation = new Set(
      state.appointments
        .filter((a) => a.locationId === state.activeLocationId)
        .map((a) => a.clientId)
    );
    return state.clients.filter((c) => clientIdsAtLocation.has(c.id));
  }, [state.clients, state.appointments, state.activeLocationId]);
  return (
    <StoreContext.Provider
      value={{
        state,
        dispatch,
        getServiceById,
        getClientById,
        getStaffById,
        getLocationById,
        getAppointmentsForDate,
        getAppointmentsForClient,
        getReviewsForClient,
        getTodayStats,
        filterAppointmentsByLocation,
        clientsForActiveLocation,
        getActiveCustomSchedule,
        syncToDb,
        setActiveLocation,
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
  products?: Product[],
  staff?: StaffMember[],
  locations?: Location[]
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
    if (staff) ops.push(AsyncStorage.setItem(STORAGE_KEYS.staff, JSON.stringify(staff)));
    if (locations) ops.push(AsyncStorage.setItem(STORAGE_KEYS.locations, JSON.stringify(locations)));
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
