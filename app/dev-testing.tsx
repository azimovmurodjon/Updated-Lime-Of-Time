/**
 * Dev Testing Screen
 * ─────────────────────────────────────────────────────────────────────────────
 * Accessible only to the Dev Admin (phone number gated, stored in AsyncStorage).
 * Lets you generate bulk random test data and remove it all in one tap.
 *
 * Features:
 *  - Phone gate with configurable Dev Admin phone (persisted in AsyncStorage)
 *  - 9 categories: Clients, Appointments, Reviews, Promo Codes, Gift Cards,
 *    Discounts, Locations, Services, Staff
 *  - Date range picker for appointment distribution
 *  - Select All / individual category toggles
 *  - Seed Presets: built-in + custom (saved to AsyncStorage)
 *  - Remove All Seed Data (tagged with __dev_seed__)
 *  - Activity log
 */
import React, { useState, useCallback, useMemo, useEffect } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  ActivityIndicator,
  Modal,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useStore } from "@/lib/store";
import { SERVICE_COLORS, STAFF_COLORS } from "@/lib/types";
import type {
  Appointment,
  Client,
  CustomScheduleDay,
  Discount,
  GiftCard,
  Location,
  NoteTemplate,
  PromoCode,
  Product,
  Review,
  Service,
  ServicePackage,
  StaffMember,
  WaitlistEntry,
} from "@/lib/types";

// ─── AsyncStorage key for dev admin phone ─────────────────────────────────
const STORAGE_KEY_DEV_PHONE = "@dev_admin_phone";
const STORAGE_KEY_PRESETS = "@dev_seed_presets";
const DEFAULT_DEV_PHONE = "+13059999999";

// ─── Seed tag — all generated items carry this in their name/notes ─────────
export const SEED_TAG = "__dev_seed__";

// ─── Random helpers ────────────────────────────────────────────────────────
export function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}
export function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
export function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
export function padZ(n: number) {
  return String(n).padStart(2, "0");
}
export function dateStr(d: Date) {
  return `${d.getFullYear()}-${padZ(d.getMonth() + 1)}-${padZ(d.getDate())}`;
}
export function isoNow() {
  return new Date().toISOString();
}
export function randDate(from: Date, to: Date): Date {
  const ms = from.getTime() + Math.random() * (to.getTime() - from.getTime());
  return new Date(ms);
}
export function randTime() {
  const h = randInt(8, 19);
  const m = pick([0, 15, 30, 45]);
  return `${padZ(h)}:${padZ(m)}`;
}

// ─── Word banks ────────────────────────────────────────────────────────────
const FIRST_NAMES = ["Alex","Jordan","Taylor","Morgan","Casey","Riley","Drew","Quinn","Avery","Blake","Cameron","Dana","Elliot","Finley","Harper","Hayden","Jamie","Jesse","Kendall","Logan","Mackenzie","Mason","Micah","Parker","Peyton","Reese","Rowan","Sage","Skyler","Spencer","Sydney","Tatum","Teagan","Tyler","Wren","Zara","Zoe","Liam","Emma","Noah","Olivia","Ava","Sophia","Lucas","Mia","Ethan","Isabella"];
const LAST_NAMES = ["Smith","Johnson","Williams","Brown","Jones","Garcia","Miller","Davis","Martinez","Wilson","Anderson","Taylor","Thomas","Hernandez","Moore","Jackson","Martin","Lee","Perez","Thompson","White","Harris","Sanchez","Clark","Lewis","Robinson","Walker","Young","Allen","King","Wright","Scott","Torres","Nguyen","Hill","Flores","Green","Adams","Nelson","Baker","Hall","Rivera","Campbell","Mitchell","Carter","Roberts"];
const BIZ_WORDS = ["Glow","Luxe","Elite","Prime","Zen","Nova","Pure","Vivid","Chic","Bold","Serene","Radiant","Spark","Bloom","Craft","Art","Style","Grace","Lush","Vibe"];
const BIZ_TYPES = ["Studio","Salon","Spa","Lounge","Bar","Lab","Hub","Co","Works","Place","Space","Atelier","Boutique","Suite"];
const SERVICE_NAMES = ["Haircut","Balayage","Color","Highlights","Blowout","Deep Condition","Keratin","Perm","Trim","Shampoo & Style","Facial","Manicure","Pedicure","Massage","Wax","Brow Shaping","Lash Lift","Spray Tan","Scalp Treatment","Beard Trim"];
const STAFF_ROLES = ["Stylist","Senior Stylist","Colorist","Esthetician","Nail Tech","Massage Therapist","Receptionist","Manager","Assistant","Barber"];
const REVIEW_COMMENTS = [
  "Absolutely loved the service! Will definitely come back.",
  "Great experience, very professional and friendly staff.",
  "Amazing results, exceeded my expectations!",
  "Good service but a bit rushed. Overall satisfied.",
  "Fantastic job, my best experience yet!",
  "Very clean and comfortable environment.",
  "Highly recommend to anyone looking for quality service.",
  "The staff was incredibly knowledgeable and helpful.",
  "Decent service, nothing too special but got the job done.",
  "Outstanding! I always leave feeling great.",
];
const PROMO_PREFIXES = ["SAVE","DEAL","OFFER","SUMMER","WINTER","SPRING","FALL","VIP","NEW","WELCOME","LOYAL","FLASH","SPECIAL","BONUS","EXTRA"];
const DISCOUNT_NAMES = ["Happy Hour","Weekend Special","Loyalty Reward","First Visit","Flash Sale","Seasonal Offer","Birthday Discount","Referral Bonus","Early Bird","Last Minute"];
const LOCATION_NAMES = ["Downtown Branch","Westside Studio","Northpark Location","Eastside Hub","Midtown Suite","Uptown Lounge","Southgate Spot","Harbor View","City Center","Lakeside Studio"];
const CITY_NAMES = ["Miami","New York","Los Angeles","Chicago","Houston","Phoenix","Philadelphia","San Antonio","San Diego","Dallas"];
const STATES = ["FL","NY","CA","IL","TX","AZ","PA","TX","CA","TX"];
const GIFT_MESSAGES = [
  "Happy Birthday! Enjoy your special day.",
  "Congratulations on your achievement!",
  "Thank you for being such a great friend.",
  "Wishing you all the best on your special occasion.",
  "A little gift to brighten your day!",
  "Enjoy this treat, you deserve it!",
];

function randBusinessName() { return `${pick(BIZ_WORDS)} ${pick(BIZ_TYPES)} ${SEED_TAG}`; }
function randClientName() { return `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`; }
function randPhone() { return `+1305${randInt(100, 999)}${randInt(1000, 9999)}`; }
function randEmail(name: string) { return `${name.toLowerCase().replace(/\s/g, ".")}${randInt(1, 99)}@testmail.dev`; }

// ─── Category config ───────────────────────────────────────────────────────
export type Category =
  | "clients"
  | "appointments"
  | "reviews"
  | "promoCodes"
  | "giftCards"
  | "discounts"
  | "locations"
  | "services"
  | "staff"
  | "products"
  | "packages"
  | "waitlist"
  | "noteTemplates"
  | "customSchedule";

export const ALL_CATEGORIES: Category[] = [
  "clients",
  "appointments",
  "reviews",
  "promoCodes",
  "giftCards",
  "discounts",
  "locations",
  "services",
  "staff",
  "products",
  "packages",
  "waitlist",
  "noteTemplates",
  "customSchedule",
];

export const CATEGORY_LABELS: Record<Category, string> = {
  clients: "Clients",
  appointments: "Appointments",
  reviews: "Reviews",
  promoCodes: "Promo Codes",
  giftCards: "Gift Cards",
  discounts: "Discounts",
  locations: "Locations",
  services: "Services",
  staff: "Staff Members",
  products: "Products",
  packages: "Service Packages",
  waitlist: "Waitlist Entries",
  noteTemplates: "Note Templates",
  customSchedule: "Schedule Overrides",
};

const CATEGORY_ICONS: Record<Category, string> = {
  clients: "person.fill",
  appointments: "calendar",
  reviews: "star.fill",
  promoCodes: "tag.fill",
  giftCards: "gift.fill",
  discounts: "percent",
  locations: "location.fill",
  services: "wrench.fill",
  staff: "person.fill",
  products: "tag.fill",
  packages: "gift.fill",
  waitlist: "calendar",
  noteTemplates: "paperplane.fill",
  customSchedule: "calendar",
};

const CATEGORY_COLORS: Record<Category, string> = {
  clients: "#6366F1",
  appointments: "#0EA5E9",
  reviews: "#F59E0B",
  promoCodes: "#10B981",
  giftCards: "#EC4899",
  discounts: "#EF4444",
  locations: "#8B5CF6",
  services: "#06B6D4",
  staff: "#F97316",
  products: "#84CC16",
  packages: "#A855F7",
  waitlist: "#14B8A6",
  noteTemplates: "#F472B6",
  customSchedule: "#FB923C",
};

// ─── Preset types ──────────────────────────────────────────────────────────
export interface SeedPreset {
  id: string;
  name: string;
  counts: Record<Category, string>;
  selected: Record<Category, boolean>;
  fromDate: string;
  toDate: string;
  isBuiltIn?: boolean;
}

function makeDefaultDates() {
  const from = new Date();
  from.setMonth(from.getMonth() - 3);
  const to = new Date();
  to.setMonth(to.getMonth() + 2);
  return { from: dateStr(from), to: dateStr(to) };
}

const { from: DEFAULT_FROM, to: DEFAULT_TO } = makeDefaultDates();

const ALL_ON: Record<Category, boolean> = {
  clients: true, appointments: true, reviews: true, promoCodes: true,
  giftCards: true, discounts: true, locations: true, services: true, staff: true,
  products: true, packages: true, waitlist: true, noteTemplates: true, customSchedule: true,
};
const ALL_OFF: Record<Category, boolean> = {
  clients: false, appointments: false, reviews: false, promoCodes: false,
  giftCards: false, discounts: false, locations: false, services: false, staff: false,
  products: false, packages: false, waitlist: false, noteTemplates: false, customSchedule: false,
};

export const BUILT_IN_PRESETS: SeedPreset[] = [
  {
    id: "smoke",
    name: "🔬 Smoke Test",
    isBuiltIn: true,
    fromDate: DEFAULT_FROM,
    toDate: DEFAULT_TO,
    selected: ALL_ON,
    counts: { clients: "2", appointments: "3", reviews: "2", promoCodes: "1", giftCards: "1", discounts: "1", locations: "1", services: "2", staff: "1", products: "2", packages: "1", waitlist: "2", noteTemplates: "2", customSchedule: "2" },
  },
  {
    id: "light",
    name: "💡 Light Load",
    isBuiltIn: true,
    fromDate: DEFAULT_FROM,
    toDate: DEFAULT_TO,
    selected: { ...ALL_ON, locations: false, services: false, staff: false },
    counts: { clients: "10", appointments: "20", reviews: "8", promoCodes: "3", giftCards: "3", discounts: "3", locations: "0", services: "0", staff: "0", products: "5", packages: "2", waitlist: "5", noteTemplates: "3", customSchedule: "0" },
  },
  {
    id: "heavy",
    name: "🔥 Heavy Load",
    isBuiltIn: true,
    fromDate: (() => { const d = new Date(); d.setFullYear(d.getFullYear() - 1); return dateStr(d); })(),
    toDate: (() => { const d = new Date(); d.setFullYear(d.getFullYear() + 1); return dateStr(d); })(),
    selected: ALL_ON,
    counts: { clients: "50", appointments: "100", reviews: "40", promoCodes: "10", giftCards: "10", discounts: "10", locations: "5", services: "10", staff: "8", products: "20", packages: "8", waitlist: "15", noteTemplates: "10", customSchedule: "14" },
  },
  {
    id: "appts_only",
    name: "📅 Appointments Only",
    isBuiltIn: true,
    fromDate: DEFAULT_FROM,
    toDate: DEFAULT_TO,
    selected: { ...ALL_OFF, clients: true, appointments: true },
    counts: { clients: "15", appointments: "30", reviews: "0", promoCodes: "0", giftCards: "0", discounts: "0", locations: "0", services: "0", staff: "0", products: "0", packages: "0", waitlist: "8", noteTemplates: "0", customSchedule: "0" },
  },
  {
    id: "full_biz",
    name: "🏢 Full Business",
    isBuiltIn: true,
    fromDate: DEFAULT_FROM,
    toDate: DEFAULT_TO,
    selected: ALL_ON,
    counts: { clients: "20", appointments: "40", reviews: "15", promoCodes: "5", giftCards: "5", discounts: "5", locations: "3", services: "8", staff: "5", products: "10", packages: "4", waitlist: "8", noteTemplates: "5", customSchedule: "7" },
  },
];

// ─── Main Component ────────────────────────────────────────────────────────
export default function DevTestingScreen() {
  const colors = useColors();
  const router = useRouter();
  const { state, dispatch } = useStore();

  // ── Phone gate ──────────────────────────────────────────────────────────
  const [devAdminPhone, setDevAdminPhone] = useState(DEFAULT_DEV_PHONE);
  const [phoneInput, setPhoneInput] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [phoneError, setPhoneError] = useState("");
  const [editingPhone, setEditingPhone] = useState(false);
  const [newPhoneValue, setNewPhoneValue] = useState("");

  // Load saved phone on mount
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY_DEV_PHONE).then((v) => {
      if (v) setDevAdminPhone(v);
    });
  }, []);

  // ── Config state ────────────────────────────────────────────────────────
  const [counts, setCounts] = useState<Record<Category, string>>({
    clients: "10", appointments: "20", reviews: "10",
    promoCodes: "5", giftCards: "5", discounts: "5",
    locations: "3", services: "5", staff: "4",
    products: "5", packages: "3", waitlist: "5",
    noteTemplates: "4", customSchedule: "5",
  });
  const [selected, setSelected] = useState<Record<Category, boolean>>(ALL_ON);
  const [fromDate, setFromDate] = useState(DEFAULT_FROM);
  const [toDate, setToDate] = useState(DEFAULT_TO);

  // ── Preset state ────────────────────────────────────────────────────────
  const [customPresets, setCustomPresets] = useState<SeedPreset[]>([]);
  const [showPresets, setShowPresets] = useState(false);
  const [savingPreset, setSavingPreset] = useState(false);
  const [newPresetName, setNewPresetName] = useState("");

  const allPresets = useMemo(() => [...BUILT_IN_PRESETS, ...customPresets], [customPresets]);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY_PRESETS).then((v) => {
      if (v) {
        try { setCustomPresets(JSON.parse(v)); } catch { /* ignore */ }
      }
    });
  }, []);

  const applyPreset = useCallback((preset: SeedPreset) => {
    setCounts(preset.counts);
    setSelected(preset.selected);
    setFromDate(preset.fromDate);
    setToDate(preset.toDate);
    setShowPresets(false);
  }, []);

  const saveCurrentAsPreset = useCallback(async () => {
    const name = newPresetName.trim();
    if (!name) { Alert.alert("Name required", "Please enter a preset name."); return; }
    const preset: SeedPreset = {
      id: uid(),
      name,
      counts,
      selected,
      fromDate,
      toDate,
    };
    const updated = [...customPresets, preset];
    setCustomPresets(updated);
    await AsyncStorage.setItem(STORAGE_KEY_PRESETS, JSON.stringify(updated));
    setNewPresetName("");
    setSavingPreset(false);
    Alert.alert("Preset Saved", `"${name}" saved successfully.`);
  }, [newPresetName, counts, selected, fromDate, toDate, customPresets]);

  const deleteCustomPreset = useCallback(async (id: string) => {
    const updated = customPresets.filter((p) => p.id !== id);
    setCustomPresets(updated);
    await AsyncStorage.setItem(STORAGE_KEY_PRESETS, JSON.stringify(updated));
  }, [customPresets]);

  // ── Generation state ────────────────────────────────────────────────────
  const [generating, setGenerating] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [log, setLog] = useState<string[]>([]);

  // ── Helpers ─────────────────────────────────────────────────────────────
  const addLog = useCallback((msg: string) => {
    setLog((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  }, []);

  const toggleAll = useCallback(() => {
    const allOn = ALL_CATEGORIES.every((c) => selected[c]);
    const next = {} as Record<Category, boolean>;
    ALL_CATEGORIES.forEach((c) => { next[c] = !allOn; });
    setSelected(next);
  }, [selected]);

  const allSelected = ALL_CATEGORIES.every((c) => selected[c]);

  // ── Seed data count helpers ──────────────────────────────────────────────
  const seedClients = useMemo(() => state.clients.filter((c) => c.notes?.includes(SEED_TAG)), [state.clients]);
  const seedAppointments = useMemo(() => state.appointments.filter((a) => a.notes?.includes(SEED_TAG)), [state.appointments]);
  const seedReviews = useMemo(() => state.reviews.filter((r) => r.comment?.includes(SEED_TAG)), [state.reviews]);
  const seedPromoCodes = useMemo(() => state.promoCodes.filter((p) => p.label?.includes(SEED_TAG)), [state.promoCodes]);
  const seedGiftCards = useMemo(() => state.giftCards.filter((g) => g.message?.includes(SEED_TAG)), [state.giftCards]);
  const seedDiscounts = useMemo(() => state.discounts.filter((d) => d.name?.includes(SEED_TAG)), [state.discounts]);
  const seedLocations = useMemo(() => state.locations.filter((l) => l.name?.includes(SEED_TAG)), [state.locations]);
  const seedServices = useMemo(() => state.services.filter((s) => s.name?.includes(SEED_TAG)), [state.services]);
  const seedStaff = useMemo(() => state.staff.filter((s) => s.name?.includes(SEED_TAG)), [state.staff]);
  const seedProducts = useMemo(() => (state.products ?? []).filter((p) => p.description?.includes(SEED_TAG)), [state.products]);
  const seedPackages = useMemo(() => (state.packages ?? []).filter((p) => p.description?.includes(SEED_TAG)), [state.packages]);
  const seedWaitlist = useMemo(() => (state.waitlist ?? []).filter((w) => w.clientName?.includes(SEED_TAG)), [state.waitlist]);
  const seedNoteTemplates = useMemo(() => (state.noteTemplates ?? []).filter((n) => n.body?.includes(SEED_TAG)), [state.noteTemplates]);
  const seedCustomSchedule = useMemo(() => (state.customSchedule ?? []).filter((cs) => cs.date?.startsWith("__seed")), [state.customSchedule]);

  const totalSeedItems =
    seedClients.length + seedAppointments.length + seedReviews.length +
    seedPromoCodes.length + seedGiftCards.length + seedDiscounts.length +
    seedLocations.length + seedServices.length + seedStaff.length +
    seedProducts.length + seedPackages.length + seedWaitlist.length +
    seedNoteTemplates.length + seedCustomSchedule.length;

  // ── Generate ─────────────────────────────────────────────────────────────
  const handleGenerate = useCallback(async () => {
    const from = new Date(fromDate + "T00:00:00");
    const to = new Date(toDate + "T23:59:59");
    if (isNaN(from.getTime()) || isNaN(to.getTime()) || from > to) {
      Alert.alert("Invalid Dates", "Please enter valid from/to dates (YYYY-MM-DD) where from ≤ to.");
      return;
    }

    setGenerating(true);
    setLog([]);
    addLog("🚀 Starting data generation...");

    // ── Services ───────────────────────────────────────────────────────────
    const newServices: Service[] = [];
    if (selected.services) {
      const n = Math.max(0, parseInt(counts.services) || 0);
      for (let i = 0; i < n; i++) {
        const svc: Service = {
          id: uid(),
          name: `${pick(SERVICE_NAMES)} ${SEED_TAG}`,
          duration: pick([30, 45, 60, 90, 120]),
          price: randInt(20, 200),
          color: pick(SERVICE_COLORS),
          description: `Auto-generated test service ${SEED_TAG}`,
          category: pick(["Hair", "Nails", "Skin", "Body", "Other"]),
          locationIds: null,
          createdAt: isoNow(),
        };
        newServices.push(svc);
        dispatch({ type: "ADD_SERVICE", payload: svc });
      }
      addLog(`✅ Created ${n} services`);
    }

    // ── Staff ──────────────────────────────────────────────────────────────
    const newStaff: StaffMember[] = [];
    if (selected.staff) {
      const n = Math.max(0, parseInt(counts.staff) || 0);
      const allSvcIds = [...state.services, ...newServices].map((s) => s.id);
      for (let i = 0; i < n; i++) {
        const name = randClientName();
        const member: StaffMember = {
          id: uid(),
          name: `${name} ${SEED_TAG}`,
          phone: randPhone(),
          email: randEmail(name),
          role: pick(STAFF_ROLES),
          color: pick(STAFF_COLORS),
          serviceIds: allSvcIds.length > 0 ? [pick(allSvcIds)] : null,
          locationIds: null,
          workingHours: null,
          active: true,
          commissionRate: pick([null, 30, 40, 50]),
          createdAt: isoNow(),
        };
        newStaff.push(member);
        dispatch({ type: "ADD_STAFF", payload: member });
      }
      addLog(`✅ Created ${n} staff members`);
    }

    // ── Locations ──────────────────────────────────────────────────────────
    const newLocations: Location[] = [];
    if (selected.locations) {
      const n = Math.max(0, parseInt(counts.locations) || 0);
      for (let i = 0; i < n; i++) {
        const cityIdx = randInt(0, CITY_NAMES.length - 1);
        const loc: Location = {
          id: uid(),
          name: `${pick(LOCATION_NAMES)} ${SEED_TAG}`,
          address: `${randInt(100, 9999)} ${pick(LAST_NAMES)} St`,
          city: CITY_NAMES[cityIdx],
          state: STATES[cityIdx],
          zipCode: String(randInt(10000, 99999)),
          phone: randPhone(),
          email: `location${randInt(1, 999)}@testmail.dev`,
          isDefault: false,
          active: true,
          workingHours: null,
          createdAt: isoNow(),
        };
        newLocations.push(loc);
        dispatch({ type: "ADD_LOCATION", payload: loc });
      }
      addLog(`✅ Created ${n} locations`);
    }

    // ── Clients ────────────────────────────────────────────────────────────
    const newClients: Client[] = [];
    if (selected.clients) {
      const n = Math.max(0, parseInt(counts.clients) || 0);
      for (let i = 0; i < n; i++) {
        const name = randClientName();
        const client: Client = {
          id: uid(),
          name,
          phone: randPhone(),
          email: randEmail(name),
          notes: `Test client ${SEED_TAG}`,
          birthday: "",
          createdAt: isoNow(),
        };
        newClients.push(client);
        dispatch({ type: "ADD_CLIENT", payload: client });
      }
      addLog(`✅ Created ${n} clients`);
    }

    // ── Appointments ───────────────────────────────────────────────────────
    const newAppointments: Appointment[] = [];
    if (selected.appointments) {
      const n = Math.max(0, parseInt(counts.appointments) || 0);
      const allClients = [...state.clients, ...newClients];
      const allServices = [...state.services, ...newServices];
      const statuses: Appointment["status"][] = ["pending", "confirmed", "completed", "cancelled"];
      const payMethods: Appointment["paymentMethod"][] = ["cash", "zelle", "venmo", "cashapp", "card", "unpaid"];
      const payStatuses: Appointment["paymentStatus"][] = ["unpaid", "pending_cash", "paid"];

      for (let i = 0; i < n; i++) {
        const d = randDate(from, to);
        const svc = allServices.length > 0 ? pick(allServices) : null;
        const client = allClients.length > 0 ? pick(allClients) : null;
        const status = pick(statuses);
        const appt: Appointment = {
          id: uid(),
          serviceId: svc?.id ?? "svc_placeholder",
          clientId: client?.id ?? "cli_placeholder",
          date: dateStr(d),
          time: randTime(),
          duration: svc?.duration ?? pick([30, 45, 60, 90, 120]),
          status,
          notes: `Auto-generated test appointment ${SEED_TAG}`,
          createdAt: isoNow(),
          totalPrice: svc?.price ?? randInt(20, 200),
          locationId: newLocations.length > 0 ? pick(newLocations).id : undefined,
          paymentMethod: pick(payMethods),
          paymentStatus: status === "completed" ? pick(payStatuses) : "unpaid",
        };
        newAppointments.push(appt);
        dispatch({ type: "ADD_APPOINTMENT", payload: appt });
      }
      addLog(`✅ Created ${n} appointments`);
    }

    // ── Reviews ────────────────────────────────────────────────────────────
    if (selected.reviews) {
      const n = Math.max(0, parseInt(counts.reviews) || 0);
      const allClients = [...state.clients, ...newClients];
      const allAppts = [...state.appointments, ...newAppointments];
      for (let i = 0; i < n; i++) {
        const client = allClients.length > 0 ? pick(allClients) : null;
        const appt = allAppts.length > 0 ? pick(allAppts) : null;
        const review: Review = {
          id: uid(),
          clientId: client?.id ?? "cli_placeholder",
          appointmentId: appt?.id,
          rating: randInt(3, 5),
          comment: `${pick(REVIEW_COMMENTS)} ${SEED_TAG}`,
          createdAt: isoNow(),
        };
        dispatch({ type: "ADD_REVIEW", payload: review });
      }
      addLog(`✅ Created ${n} reviews`);
    }

    // ── Promo Codes ────────────────────────────────────────────────────────
    if (selected.promoCodes) {
      const n = Math.max(0, parseInt(counts.promoCodes) || 0);
      for (let i = 0; i < n; i++) {
        const code = `${pick(PROMO_PREFIXES)}${randInt(10, 99)}`;
        const promo: PromoCode = {
          id: uid(),
          code,
          label: `Test Promo ${SEED_TAG}`,
          percentage: pick([0, 10, 15, 20, 25, 30]),
          flatAmount: null,
          maxUses: pick([null, 10, 25, 50, 100]),
          usedCount: randInt(0, 5),
          expiresAt: dateStr(new Date(to.getTime() + 30 * 24 * 3600 * 1000)),
          active: true,
          createdAt: isoNow(),
        };
        dispatch({ type: "ADD_PROMO_CODE", payload: promo });
      }
      addLog(`✅ Created ${n} promo codes`);
    }

    // ── Gift Cards ─────────────────────────────────────────────────────────
    if (selected.giftCards) {
      const n = Math.max(0, parseInt(counts.giftCards) || 0);
      const allSvcIds = [...state.services, ...newServices].map((s) => s.id);
      for (let i = 0; i < n; i++) {
        const value = pick([25, 50, 75, 100, 150, 200]);
        const name = randClientName();
        const gift: GiftCard = {
          id: uid(),
          code: `GIFT${randInt(1000, 9999)}`,
          serviceLocalId: allSvcIds.length > 0 ? pick(allSvcIds) : "svc_placeholder",
          serviceIds: allSvcIds.length > 0 ? [pick(allSvcIds)] : [],
          originalValue: value,
          remainingBalance: value,
          recipientName: name,
          recipientPhone: randPhone(),
          message: `${pick(GIFT_MESSAGES)} ${SEED_TAG}`,
          redeemed: false,
          expiresAt: dateStr(new Date(to.getTime() + 90 * 24 * 3600 * 1000)),
          createdAt: isoNow(),
        };
        dispatch({ type: "ADD_GIFT_CARD", payload: gift });
      }
      addLog(`✅ Created ${n} gift cards`);
    }

    // ── Discounts ──────────────────────────────────────────────────────────
    if (selected.discounts) {
      const n = Math.max(0, parseInt(counts.discounts) || 0);
      for (let i = 0; i < n; i++) {
        const discount: Discount = {
          id: uid(),
          name: `${pick(DISCOUNT_NAMES)} ${SEED_TAG}`,
          percentage: pick([5, 10, 15, 20, 25, 30]),
          startTime: "09:00",
          endTime: "17:00",
          daysOfWeek: [],
          dates: [],
          serviceIds: null,
          active: true,
          createdAt: isoNow(),
        };
        dispatch({ type: "ADD_DISCOUNT", payload: discount });
      }
      addLog(`✅ Created ${n} discounts`);
    }

    // ── Products ───────────────────────────────────────────────────────────
    if (selected.products) {
      const n = Math.max(0, parseInt(counts.products) || 0);
      const PRODUCT_NAMES = ["Argan Oil", "Keratin Mask", "Color Protect Shampoo", "Deep Conditioner", "Scalp Serum", "Nail Polish", "Cuticle Oil", "Gel Top Coat", "Tanning Lotion", "Exfoliating Scrub", "Hydrating Mist", "Vitamin C Serum"];
      const PRODUCT_BRANDS = ["Olaplex", "Redken", "Wella", "L'Oreal", "Moroccanoil", "OPI", "CND", "Essie"];
      const PRODUCT_CATEGORIES = ["Hair Care", "Nail Care", "Skin Care", "Body Care", "Tools"];
      for (let i = 0; i < n; i++) {
        const product: Product = {
          id: uid(),
          name: `${pick(PRODUCT_NAMES)} ${SEED_TAG}`,
          price: randInt(10, 120),
          description: `Auto-generated test product ${SEED_TAG}`,
          brand: pick(PRODUCT_BRANDS),
          category: pick(PRODUCT_CATEGORIES),
          available: true,
          createdAt: isoNow(),
        };
        dispatch({ type: "ADD_PRODUCT", payload: product });
      }
      addLog(`✅ Created ${n} products`);
    }

    // ── Service Packages ───────────────────────────────────────────────────
    const newPackages: ServicePackage[] = [];
    if (selected.packages) {
      const n = Math.max(0, parseInt(counts.packages) || 0);
      const allSvcIds = [...state.services, ...newServices].map((s) => s.id);
      const PACKAGE_NAMES = ["Glow & Go Bundle", "Full Glam Package", "Relaxation Set", "Bridal Package", "Monthly Refresh", "VIP Treatment", "Express Combo"];
      for (let i = 0; i < n; i++) {
        const svcSubset = allSvcIds.length >= 2 ? [pick(allSvcIds), pick(allSvcIds)].filter((v, idx, arr) => arr.indexOf(v) === idx) : allSvcIds.slice(0, 1);
        const pkg: ServicePackage = {
          id: uid(),
          name: `${pick(PACKAGE_NAMES)} ${SEED_TAG}`,
          description: `Auto-generated test package ${SEED_TAG}`,
          serviceIds: svcSubset,
          price: randInt(50, 350),
          sessions: pick([undefined, 3, 5, 10]),
          active: true,
          expiryDays: pick([null, 30, 60, 90]),
          createdAt: isoNow(),
        };
        newPackages.push(pkg);
        dispatch({ type: "ADD_PACKAGE", payload: pkg });
      }
      addLog(`✅ Created ${n} service packages`);
    }

    // ── Waitlist Entries ───────────────────────────────────────────────────
    if (selected.waitlist) {
      const n = Math.max(0, parseInt(counts.waitlist) || 0);
      const allSvcIds = [...state.services, ...newServices].map((s) => s.id);
      const allLocIds = [...state.locations, ...newLocations].map((l) => l.id);
      const allStaffIds = [...state.staff, ...newStaff].map((s) => s.id);
      for (let i = 0; i < n; i++) {
        const name = `${randClientName()} ${SEED_TAG}`;
        const entry: WaitlistEntry = {
          id: uid(),
          clientName: name,
          clientPhone: randPhone(),
          serviceId: allSvcIds.length > 0 ? pick(allSvcIds) : "svc_placeholder",
          date: dateStr(randDate(from, to)),
          time: randTime(),
          locationId: allLocIds.length > 0 ? pick(allLocIds) : undefined,
          staffId: allStaffIds.length > 0 ? pick(allStaffIds) : undefined,
          createdAt: isoNow(),
          notified: false,
        };
        dispatch({ type: "ADD_WAITLIST_ENTRY", payload: entry });
      }
      addLog(`✅ Created ${n} waitlist entries`);
    }

    // ── Note Templates ─────────────────────────────────────────────────────
    if (selected.noteTemplates) {
      const n = Math.max(0, parseInt(counts.noteTemplates) || 0);
      const NOTE_TITLES = ["Prefers no heat", "Sensitive scalp", "Allergic to bleach", "Prefers morning slots", "VIP client", "Bring own products", "Needs extra time", "Prefers female staff"];
      const NOTE_BODIES = ["Client prefers no heat styling tools during service.", "Sensitive scalp — use gentle products only.", "Allergic to bleach and strong chemicals.", "Prefers early morning appointments before 10am.", "VIP client — priority scheduling.", "Client brings their own preferred products.", "Needs 15 extra minutes for consultation.", "Prefers female staff members only."];
      for (let i = 0; i < n; i++) {
        const idx = randInt(0, NOTE_TITLES.length - 1);
        const tmpl: NoteTemplate = {
          id: uid(),
          title: `${NOTE_TITLES[idx]} ${SEED_TAG}`,
          body: `${NOTE_BODIES[idx]} ${SEED_TAG}`,
          createdAt: isoNow(),
        };
        dispatch({ type: "ADD_NOTE_TEMPLATE", payload: tmpl });
      }
      addLog(`✅ Created ${n} note templates`);
    }

    // ── Custom Schedule Overrides ──────────────────────────────────────────
    if (selected.customSchedule) {
      const n = Math.max(0, parseInt(counts.customSchedule) || 0);
      const usedDates = new Set<string>();
      let attempts = 0;
      let created = 0;
      while (created < n && attempts < n * 5) {
        attempts++;
        const d = randDate(from, to);
        const ds = dateStr(d);
        if (usedDates.has(ds)) continue;
        usedDates.add(ds);
        const isOpen = Math.random() > 0.3;
        const cs: CustomScheduleDay = {
          date: ds,
          isOpen,
          startTime: isOpen ? pick(["08:00", "09:00", "10:00"]) : undefined,
          endTime: isOpen ? pick(["17:00", "18:00", "19:00", "20:00"]) : undefined,
          locationId: null,
        };
        dispatch({ type: "SET_CUSTOM_SCHEDULE", payload: cs });
        created++;
      }
      addLog(`✅ Created ${created} schedule overrides`);
    }

    addLog("🎉 Generation complete!");
    setGenerating(false);
  }, [selected, counts, fromDate, toDate, state, dispatch, addLog]);

  // ── Remove All Seed Data ──────────────────────────────────────────────────
  const handleRemoveAll = useCallback(() => {
    if (totalSeedItems === 0) {
      Alert.alert("Nothing to Remove", "No seed data found.");
      return;
    }
    Alert.alert(
      "Remove All Seed Data",
      `This will permanently delete ${totalSeedItems} seeded items. This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove All",
          style: "destructive",
          onPress: async () => {
            setRemoving(true);
            setLog([]);
            addLog("🗑️ Removing all seed data...");

            seedStaff.forEach((s) => dispatch({ type: "DELETE_STAFF", payload: s.id }));
            addLog(`Removed ${seedStaff.length} staff`);

            seedServices.forEach((s) => dispatch({ type: "DELETE_SERVICE", payload: s.id }));
            addLog(`Removed ${seedServices.length} services`);

            seedClients.forEach((c) => dispatch({ type: "DELETE_CLIENT", payload: c.id }));
            addLog(`Removed ${seedClients.length} clients`);

            seedAppointments.forEach((a) => dispatch({ type: "DELETE_APPOINTMENT", payload: a.id }));
            addLog(`Removed ${seedAppointments.length} appointments`);

            seedReviews.forEach((r) => dispatch({ type: "DELETE_REVIEW", payload: r.id }));
            addLog(`Removed ${seedReviews.length} reviews`);

            seedPromoCodes.forEach((p) => dispatch({ type: "DELETE_PROMO_CODE", payload: p.id }));
            addLog(`Removed ${seedPromoCodes.length} promo codes`);

            seedGiftCards.forEach((g) => dispatch({ type: "DELETE_GIFT_CARD", payload: g.id }));
            addLog(`Removed ${seedGiftCards.length} gift cards`);

            seedDiscounts.forEach((d) => dispatch({ type: "DELETE_DISCOUNT", payload: d.id }));
            addLog(`Removed ${seedDiscounts.length} discounts`);

            seedLocations.forEach((l) => dispatch({ type: "DELETE_LOCATION", payload: l.id }));
            addLog(`Removed ${seedLocations.length} locations`);

            seedProducts.forEach((p) => dispatch({ type: "DELETE_PRODUCT", payload: p.id }));
            addLog(`Removed ${seedProducts.length} products`);

            seedPackages.forEach((p) => dispatch({ type: "DELETE_PACKAGE", payload: p.id }));
            addLog(`Removed ${seedPackages.length} packages`);

            seedWaitlist.forEach((w) => dispatch({ type: "DELETE_WAITLIST_ENTRY", payload: w.id }));
            addLog(`Removed ${seedWaitlist.length} waitlist entries`);

            seedNoteTemplates.forEach((n) => dispatch({ type: "DELETE_NOTE_TEMPLATE", payload: n.id }));
            addLog(`Removed ${seedNoteTemplates.length} note templates`);

            seedCustomSchedule.forEach((cs) => dispatch({ type: "DELETE_CUSTOM_SCHEDULE", payload: cs.date }));
            addLog(`Removed ${seedCustomSchedule.length} schedule overrides`);

            addLog("✅ All seed data removed.");
            setRemoving(false);
          },
        },
      ]
    );
  }, [totalSeedItems, seedClients, seedAppointments, seedReviews, seedPromoCodes, seedGiftCards, seedDiscounts, seedLocations, seedServices, seedStaff, seedProducts, seedPackages, seedWaitlist, seedNoteTemplates, seedCustomSchedule, dispatch, addLog]);

  // ── Phone gate UI ─────────────────────────────────────────────────────────
  if (!unlocked) {
    return (
      <ScreenContainer>
        <View style={styles.gateContainer}>
          <View style={[styles.gateCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.gateIcon, { backgroundColor: "#F59E0B20" }]}>
              <IconSymbol name="lock.fill" size={32} color="#F59E0B" />
            </View>
            <Text style={[styles.gateTitle, { color: colors.foreground }]}>Dev Admin Access</Text>
            <Text style={[styles.gateSubtitle, { color: colors.muted }]}>
              Enter your Dev Admin phone number to unlock the testing panel.
            </Text>
            <TextInput
              style={[styles.gateInput, { backgroundColor: colors.background, borderColor: phoneError ? colors.error : colors.border, color: colors.foreground }]}
              placeholder="+13059999999"
              placeholderTextColor={colors.muted}
              value={phoneInput}
              onChangeText={(t) => { setPhoneInput(t); setPhoneError(""); }}
              keyboardType="phone-pad"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={() => {
                const normalized = phoneInput.replace(/\s/g, "");
                if (normalized === devAdminPhone) { setUnlocked(true); } else { setPhoneError("Incorrect phone number."); }
              }}
            />
            {phoneError ? <Text style={{ color: colors.error, fontSize: 12, marginTop: 4 }}>{phoneError}</Text> : null}
            <Pressable
              style={({ pressed }) => [styles.gateBtn, { backgroundColor: "#F59E0B", opacity: pressed ? 0.8 : 1 }]}
              onPress={() => {
                const normalized = phoneInput.replace(/\s/g, "");
                if (normalized === devAdminPhone) { setUnlocked(true); } else { setPhoneError("Incorrect phone number."); }
              }}
            >
              <Text style={{ color: "#FFF", fontWeight: "700", fontSize: 15 }}>Unlock</Text>
            </Pressable>
            <Pressable onPress={() => router.back()} style={{ marginTop: 12 }}>
              <Text style={{ color: colors.muted, fontSize: 13 }}>← Go Back</Text>
            </Pressable>
          </View>
        </View>
      </ScreenContainer>
    );
  }

  // ── Main Testing UI ───────────────────────────────────────────────────────
  return (
    <ScreenContainer>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>

        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
            <IconSymbol name="chevron.left" size={20} color={colors.muted} />
          </Pressable>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={{ fontSize: 20, fontWeight: "800", color: colors.foreground }}>🧪 Dev Testing</Text>
            <Text style={{ fontSize: 12, color: colors.muted, marginTop: 1 }}>Seed & cleanup test data</Text>
          </View>
          <View style={[styles.badge, { backgroundColor: "#F59E0B20" }]}>
            <Text style={{ fontSize: 11, fontWeight: "700", color: "#F59E0B" }}>DEV ADMIN</Text>
          </View>
        </View>

        {/* Dev Admin Phone Settings */}
        <Text style={[styles.sectionLabel, { color: colors.muted }]}>DEV ADMIN PHONE</Text>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {editingPhone ? (
            <View>
              <Text style={{ fontSize: 12, color: colors.muted, marginBottom: 6 }}>New phone number (E.164 format, e.g. +13059999999)</Text>
              <TextInput
                style={[styles.dateInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
                value={newPhoneValue}
                onChangeText={setNewPhoneValue}
                placeholder="+13059999999"
                placeholderTextColor={colors.muted}
                keyboardType="phone-pad"
                autoCorrect={false}
                returnKeyType="done"
              />
              <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
                <Pressable
                  style={({ pressed }) => [styles.smallBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1, flex: 1 }]}
                  onPress={async () => {
                    const v = newPhoneValue.replace(/\s/g, "");
                    if (!v.startsWith("+") || v.length < 10) {
                      Alert.alert("Invalid", "Phone must be in E.164 format, e.g. +13059999999");
                      return;
                    }
                    setDevAdminPhone(v);
                    await AsyncStorage.setItem(STORAGE_KEY_DEV_PHONE, v);
                    setEditingPhone(false);
                    setNewPhoneValue("");
                    Alert.alert("Saved", `Dev Admin phone updated to ${v}`);
                  }}
                >
                  <Text style={{ color: "#FFF", fontWeight: "700", fontSize: 13 }}>Save</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.smallBtn, { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, opacity: pressed ? 0.8 : 1, flex: 1 }]}
                  onPress={() => { setEditingPhone(false); setNewPhoneValue(""); }}
                >
                  <Text style={{ color: colors.muted, fontWeight: "600", fontSize: 13 }}>Cancel</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: "700", color: colors.foreground }}>{devAdminPhone}</Text>
                <Text style={{ fontSize: 11, color: colors.muted, marginTop: 2 }}>Phone required to unlock this panel</Text>
              </View>
              <Pressable
                style={({ pressed }) => [styles.smallBtn, { backgroundColor: "#F59E0B20", opacity: pressed ? 0.7 : 1 }]}
                onPress={() => { setEditingPhone(true); setNewPhoneValue(devAdminPhone); }}
              >
                <Text style={{ color: "#F59E0B", fontWeight: "700", fontSize: 12 }}>Change</Text>
              </Pressable>
            </View>
          )}
        </View>

        {/* Existing seed data summary */}
        {totalSeedItems > 0 && (
          <View style={[styles.summaryCard, { backgroundColor: "#EF444415", borderColor: "#EF444430" }]}>
            <Text style={{ fontSize: 13, fontWeight: "700", color: "#EF4444" }}>
              ⚠️ {totalSeedItems} seeded items exist in the store
            </Text>
            <Text style={{ fontSize: 11, color: "#EF4444", marginTop: 2, opacity: 0.8 }}>
              {seedClients.length} clients · {seedAppointments.length} appts · {seedReviews.length} reviews · {seedPromoCodes.length} promos · {seedGiftCards.length} gifts · {seedDiscounts.length} discounts · {seedLocations.length} locations · {seedServices.length} services · {seedStaff.length} staff · {seedProducts.length} products · {seedPackages.length} packages · {seedWaitlist.length} waitlist · {seedNoteTemplates.length} notes · {seedCustomSchedule.length} schedule
            </Text>
          </View>
        )}

        {/* Presets */}
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionLabel, { color: colors.muted }]}>PRESETS</Text>
          <Pressable
            onPress={() => setShowPresets(true)}
            style={({ pressed }) => [styles.selectAllBtn, { backgroundColor: "#8B5CF615", opacity: pressed ? 0.7 : 1 }]}
          >
            <Text style={{ fontSize: 11, fontWeight: "700", color: "#8B5CF6" }}>Load Preset</Text>
          </Pressable>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
          <View style={{ flexDirection: "row", gap: 8, paddingBottom: 4 }}>
            {BUILT_IN_PRESETS.map((p) => (
              <Pressable
                key={p.id}
                onPress={() => applyPreset(p)}
                style={({ pressed }) => [styles.presetChip, { backgroundColor: "#8B5CF615", borderColor: "#8B5CF640", opacity: pressed ? 0.75 : 1 }]}
              >
                <Text style={{ fontSize: 12, fontWeight: "600", color: "#8B5CF6" }}>{p.name}</Text>
              </Pressable>
            ))}
            {customPresets.map((p) => (
              <Pressable
                key={p.id}
                onPress={() => applyPreset(p)}
                style={({ pressed }) => [styles.presetChip, { backgroundColor: "#06B6D415", borderColor: "#06B6D440", opacity: pressed ? 0.75 : 1 }]}
              >
                <Text style={{ fontSize: 12, fontWeight: "600", color: "#06B6D4" }}>{p.name}</Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>

        {/* Save current as preset */}
        {savingPreset ? (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, marginBottom: 12 }]}>
            <Text style={{ fontSize: 12, color: colors.muted, marginBottom: 6 }}>Preset name</Text>
            <TextInput
              style={[styles.dateInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
              value={newPresetName}
              onChangeText={setNewPresetName}
              placeholder="e.g. My Custom Load"
              placeholderTextColor={colors.muted}
              autoCorrect={false}
              returnKeyType="done"
            />
            <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
              <Pressable
                style={({ pressed }) => [styles.smallBtn, { backgroundColor: "#06B6D4", opacity: pressed ? 0.8 : 1, flex: 1 }]}
                onPress={saveCurrentAsPreset}
              >
                <Text style={{ color: "#FFF", fontWeight: "700", fontSize: 13 }}>Save Preset</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.smallBtn, { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, opacity: pressed ? 0.8 : 1, flex: 1 }]}
                onPress={() => { setSavingPreset(false); setNewPresetName(""); }}
              >
                <Text style={{ color: colors.muted, fontWeight: "600", fontSize: 13 }}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <Pressable
            onPress={() => setSavingPreset(true)}
            style={({ pressed }) => [styles.savePresetBtn, { borderColor: "#06B6D440", backgroundColor: "#06B6D410", opacity: pressed ? 0.75 : 1 }]}
          >
            <Text style={{ fontSize: 12, fontWeight: "600", color: "#06B6D4" }}>+ Save Current Config as Preset</Text>
          </Pressable>
        )}

        {/* Date Range */}
        <Text style={[styles.sectionLabel, { color: colors.muted }]}>DATE RANGE</Text>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.dateRow}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 11, fontWeight: "600", color: colors.muted, marginBottom: 4 }}>FROM (YYYY-MM-DD)</Text>
              <TextInput
                style={[styles.dateInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
                value={fromDate}
                onChangeText={setFromDate}
                placeholder="2024-01-01"
                placeholderTextColor={colors.muted}
                autoCorrect={false}
                returnKeyType="done"
              />
            </View>
            <View style={{ width: 12 }} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 11, fontWeight: "600", color: colors.muted, marginBottom: 4 }}>TO (YYYY-MM-DD)</Text>
              <TextInput
                style={[styles.dateInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
                value={toDate}
                onChangeText={setToDate}
                placeholder="2025-12-31"
                placeholderTextColor={colors.muted}
                autoCorrect={false}
                returnKeyType="done"
              />
            </View>
          </View>
          <Text style={{ fontSize: 11, color: colors.muted, marginTop: 8 }}>
            Appointments will be randomly distributed between these dates (past & future supported).
          </Text>
        </View>

        {/* Category selection */}
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionLabel, { color: colors.muted }]}>CATEGORIES & COUNTS</Text>
          <Pressable
            onPress={toggleAll}
            style={({ pressed }) => [styles.selectAllBtn, { backgroundColor: colors.primary + "15", opacity: pressed ? 0.7 : 1 }]}
          >
            <Text style={{ fontSize: 11, fontWeight: "700", color: colors.primary }}>
              {allSelected ? "Deselect All" : "Select All"}
            </Text>
          </Pressable>
        </View>

        {ALL_CATEGORIES.map((cat) => {
          const color = CATEGORY_COLORS[cat];
          const isOn = selected[cat];
          return (
            <View
              key={cat}
              style={[styles.categoryRow, { backgroundColor: colors.surface, borderColor: isOn ? color + "40" : colors.border }]}
            >
              <Switch
                value={isOn}
                onValueChange={(v) => setSelected((prev) => ({ ...prev, [cat]: v }))}
                trackColor={{ false: colors.border, true: color + "60" }}
                thumbColor={isOn ? color : colors.muted}
              />
              <View style={[styles.catIcon, { backgroundColor: color + "15" }]}>
                <IconSymbol name={CATEGORY_ICONS[cat] as any} size={18} color={color} />
              </View>
              <Text style={{ flex: 1, fontSize: 14, fontWeight: "600", color: isOn ? colors.foreground : colors.muted }}>
                {CATEGORY_LABELS[cat]}
              </Text>
              <TextInput
                style={[styles.countInput, { backgroundColor: isOn ? colors.background : colors.surface, borderColor: isOn ? color + "50" : colors.border, color: isOn ? colors.foreground : colors.muted }]}
                value={counts[cat]}
                onChangeText={(v) => setCounts((prev) => ({ ...prev, [cat]: v.replace(/[^0-9]/g, "") }))}
                keyboardType="number-pad"
                editable={isOn}
                maxLength={4}
                returnKeyType="done"
              />
            </View>
          );
        })}

        {/* Generate Button */}
        <Pressable
          onPress={handleGenerate}
          disabled={generating || removing}
          style={({ pressed }) => [styles.generateBtn, { backgroundColor: generating ? colors.muted : "#10B981", opacity: pressed ? 0.85 : 1 }]}
        >
          {generating ? (
            <ActivityIndicator color="#FFF" size="small" />
          ) : (
            <IconSymbol name="paperplane.fill" size={18} color="#FFF" />
          )}
          <Text style={{ color: "#FFF", fontWeight: "800", fontSize: 15, marginLeft: 8 }}>
            {generating ? "Generating..." : "Generate Test Data"}
          </Text>
        </Pressable>

        {/* Remove All Button */}
        <Pressable
          onPress={handleRemoveAll}
          disabled={generating || removing || totalSeedItems === 0}
          style={({ pressed }) => [styles.removeBtn, { backgroundColor: totalSeedItems === 0 ? colors.surface : "#EF444415", borderColor: totalSeedItems === 0 ? colors.border : "#EF444440", opacity: pressed ? 0.75 : totalSeedItems === 0 ? 0.5 : 1 }]}
        >
          {removing ? (
            <ActivityIndicator color="#EF4444" size="small" />
          ) : (
            <IconSymbol name="trash.fill" size={18} color={totalSeedItems === 0 ? colors.muted : "#EF4444"} />
          )}
          <Text style={{ fontWeight: "700", fontSize: 15, marginLeft: 8, color: totalSeedItems === 0 ? colors.muted : "#EF4444" }}>
            {removing ? "Removing..." : `Remove All Seed Data (${totalSeedItems})`}
          </Text>
        </Pressable>

        {/* Activity Log */}
        {log.length > 0 && (
          <>
            <Text style={[styles.sectionLabel, { color: colors.muted, marginTop: 20 }]}>ACTIVITY LOG</Text>
            <View style={[styles.logBox, { backgroundColor: "#0D1117", borderColor: "#30363D" }]}>
              {log.map((line, i) => (
                <Text key={i} style={styles.logLine}>{line}</Text>
              ))}
            </View>
          </>
        )}

        {/* Info card */}
        <View style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={{ fontSize: 12, fontWeight: "700", color: colors.muted, marginBottom: 6 }}>ℹ️ HOW IT WORKS</Text>
          <Text style={{ fontSize: 12, color: colors.muted, lineHeight: 18 }}>
            All generated items are tagged with a hidden marker so they can be identified and removed in bulk. Use "Remove All Seed Data" to clean up without affecting real data.{"\n\n"}
            Services and Staff are seeded into the active business. Appointments use seeded or existing services/clients.{"\n\n"}
            Presets let you save and reload configurations instantly. Built-in presets cannot be deleted.{"\n\n"}
            Phone gate: only the registered Dev Admin phone can access this screen. Tap "Change" above to update it.
          </Text>
        </View>
      </ScrollView>

      {/* Presets Modal */}
      <Modal visible={showPresets} transparent animationType="slide" onRequestClose={() => setShowPresets(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 16 }}>
              <Text style={{ fontSize: 17, fontWeight: "800", color: colors.foreground, flex: 1 }}>Load Preset</Text>
              <Pressable onPress={() => setShowPresets(false)} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
                <Text style={{ fontSize: 14, color: colors.muted }}>Close</Text>
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={{ fontSize: 11, fontWeight: "700", color: colors.muted, marginBottom: 8 }}>BUILT-IN</Text>
              {BUILT_IN_PRESETS.map((p) => (
                <Pressable
                  key={p.id}
                  onPress={() => applyPreset(p)}
                  style={({ pressed }) => [styles.presetRow, { backgroundColor: "#8B5CF610", borderColor: "#8B5CF630", opacity: pressed ? 0.75 : 1 }]}
                >
                  <Text style={{ fontSize: 14, fontWeight: "600", color: "#8B5CF6", flex: 1 }}>{p.name}</Text>
                  <Text style={{ fontSize: 11, color: colors.muted }}>
                    {Object.entries(p.counts).filter(([k]) => p.selected[k as Category]).map(([k, v]) => `${v} ${CATEGORY_LABELS[k as Category]}`).join(" · ")}
                  </Text>
                </Pressable>
              ))}
              {customPresets.length > 0 && (
                <>
                  <Text style={{ fontSize: 11, fontWeight: "700", color: colors.muted, marginTop: 16, marginBottom: 8 }}>CUSTOM</Text>
                  {customPresets.map((p) => (
                    <View key={p.id} style={[styles.presetRow, { backgroundColor: "#06B6D410", borderColor: "#06B6D430" }]}>
                      <Pressable onPress={() => applyPreset(p)} style={{ flex: 1 }}>
                        <Text style={{ fontSize: 14, fontWeight: "600", color: "#06B6D4" }}>{p.name}</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => Alert.alert("Delete Preset", `Delete "${p.name}"?`, [
                          { text: "Cancel", style: "cancel" },
                          { text: "Delete", style: "destructive", onPress: () => deleteCustomPreset(p.id) },
                        ])}
                        style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, paddingLeft: 12 })}
                      >
                        <IconSymbol name="trash.fill" size={16} color="#EF4444" />
                      </Pressable>
                    </View>
                  ))}
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  gateContainer: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  gateCard: { width: "100%", maxWidth: 360, borderRadius: 20, padding: 24, alignItems: "center", borderWidth: 1 },
  gateIcon: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center", marginBottom: 16 },
  gateTitle: { fontSize: 22, fontWeight: "800", marginBottom: 8 },
  gateSubtitle: { fontSize: 13, textAlign: "center", marginBottom: 20, lineHeight: 18 },
  gateInput: { width: "100%", borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, marginBottom: 4 },
  gateBtn: { width: "100%", paddingVertical: 14, borderRadius: 12, alignItems: "center", marginTop: 12 },
  header: { flexDirection: "row", alignItems: "center", marginBottom: 20 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  sectionLabel: { fontSize: 11, fontWeight: "700", letterSpacing: 0.5, marginBottom: 8, marginTop: 4 },
  sectionHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8, marginTop: 4 },
  card: { borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 12 },
  summaryCard: { borderRadius: 12, borderWidth: 1, padding: 12, marginBottom: 12 },
  dateRow: { flexDirection: "row" },
  dateInput: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 9, fontSize: 14 },
  selectAllBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  categoryRow: { flexDirection: "row", alignItems: "center", borderRadius: 12, borderWidth: 1, padding: 10, marginBottom: 8, gap: 10 },
  catIcon: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  countInput: { width: 56, borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 7, fontSize: 14, textAlign: "center" },
  generateBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 16, borderRadius: 14, marginTop: 8, marginBottom: 10 },
  removeBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 14, borderRadius: 14, borderWidth: 1, marginBottom: 8 },
  logBox: { borderRadius: 12, borderWidth: 1, padding: 12, marginBottom: 12 },
  logLine: { fontSize: 11, color: "#7EE787", fontFamily: "monospace", lineHeight: 18 },
  infoCard: { borderRadius: 14, borderWidth: 1, padding: 14, marginTop: 8, marginBottom: 20 },
  smallBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, alignItems: "center" },
  presetChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  savePresetBtn: { borderWidth: 1, borderRadius: 10, paddingVertical: 10, alignItems: "center", marginBottom: 12 },
  presetRow: { borderRadius: 10, borderWidth: 1, padding: 12, marginBottom: 8 },
  modalOverlay: { flex: 1, backgroundColor: "#00000080", justifyContent: "flex-end" },
  modalCard: { borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, padding: 20, maxHeight: "80%" },
});
