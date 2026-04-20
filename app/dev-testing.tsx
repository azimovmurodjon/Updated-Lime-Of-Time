/**
 * Dev Testing Screen
 * ─────────────────────────────────────────────────────────────────────────────
 * Accessible only to the Dev Admin (phone number gated).
 * Lets you generate bulk random test data and remove it all in one tap.
 */
import React, { useState, useCallback, useMemo } from "react";
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
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useStore } from "@/lib/store";
import type {
  Appointment,
  Client,
  Discount,
  GiftCard,
  Location,
  PromoCode,
  Review,
} from "@/lib/types";

// ─── Dev-admin phone gate ──────────────────────────────────────────────────
const DEV_ADMIN_PHONE = "+13059999999"; // change to your real dev phone

// ─── Seed tag — all generated items carry this in their name/notes ─────────
const SEED_TAG = "__dev_seed__";

// ─── Random helpers ────────────────────────────────────────────────────────
function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function padZ(n: number) {
  return String(n).padStart(2, "0");
}
function dateStr(d: Date) {
  return `${d.getFullYear()}-${padZ(d.getMonth() + 1)}-${padZ(d.getDate())}`;
}
function isoNow() {
  return new Date().toISOString();
}
/** Random date between fromDate and toDate (inclusive) */
function randDate(from: Date, to: Date): Date {
  const ms = from.getTime() + Math.random() * (to.getTime() - from.getTime());
  return new Date(ms);
}
function randTime() {
  const h = randInt(8, 19);
  const m = pick([0, 15, 30, 45]);
  return `${padZ(h)}:${padZ(m)}`;
}

const FIRST_NAMES = ["Alex","Jordan","Taylor","Morgan","Casey","Riley","Drew","Quinn","Avery","Blake","Cameron","Dana","Elliot","Finley","Harper","Hayden","Jamie","Jesse","Kendall","Logan","Mackenzie","Mason","Micah","Morgan","Parker","Peyton","Reese","Rowan","Sage","Skyler","Spencer","Sydney","Tatum","Teagan","Tyler","Wren","Zara","Zoe","Liam","Emma","Noah","Olivia","Ava","Sophia","Lucas","Mia","Ethan","Isabella"];
const LAST_NAMES = ["Smith","Johnson","Williams","Brown","Jones","Garcia","Miller","Davis","Martinez","Wilson","Anderson","Taylor","Thomas","Hernandez","Moore","Jackson","Martin","Lee","Perez","Thompson","White","Harris","Sanchez","Clark","Lewis","Robinson","Walker","Young","Allen","King","Wright","Scott","Torres","Nguyen","Hill","Flores","Green","Adams","Nelson","Baker","Hall","Rivera","Campbell","Mitchell","Carter","Roberts"];
const BIZ_WORDS = ["Glow","Luxe","Elite","Prime","Zen","Nova","Pure","Vivid","Chic","Bold","Serene","Radiant","Spark","Bloom","Craft","Art","Style","Grace","Lush","Vibe"];
const BIZ_TYPES = ["Studio","Salon","Spa","Lounge","Bar","Lab","Hub","Co","Works","Place","Space","Atelier","Boutique","Suite"];
const SERVICE_NAMES = ["Haircut","Balayage","Color","Highlights","Blowout","Deep Condition","Keratin","Perm","Trim","Shampoo & Style","Facial","Manicure","Pedicure","Massage","Wax","Brow Shaping","Lash Lift","Spray Tan","Scalp Treatment","Beard Trim"];
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
  "Quick and efficient, exactly what I needed.",
  "Wonderful atmosphere and skilled professionals.",
  "I've been coming here for years and never disappointed.",
  "A bit pricey but worth every penny.",
  "Friendly team and excellent results every time.",
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
  "With love and best wishes.",
  "Celebrating you today and always!",
];

function randBusinessName() {
  return `${pick(BIZ_WORDS)} ${pick(BIZ_TYPES)} ${SEED_TAG}`;
}
function randClientName() {
  return `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
}
function randPhone() {
  return `+1305${randInt(100, 999)}${randInt(1000, 9999)}`;
}
function randEmail(name: string) {
  return `${name.toLowerCase().replace(/\s/g, ".")}${randInt(1, 99)}@testmail.dev`;
}

// ─── Category config ───────────────────────────────────────────────────────
type Category =
  | "clients"
  | "appointments"
  | "reviews"
  | "promoCodes"
  | "giftCards"
  | "discounts"
  | "locations";

const ALL_CATEGORIES: Category[] = [
  "clients",
  "appointments",
  "reviews",
  "promoCodes",
  "giftCards",
  "discounts",
  "locations",
];

const CATEGORY_LABELS: Record<Category, string> = {
  clients: "Clients",
  appointments: "Appointments",
  reviews: "Reviews",
  promoCodes: "Promo Codes",
  giftCards: "Gift Cards",
  discounts: "Discounts",
  locations: "Locations",
};

const CATEGORY_ICONS: Record<Category, string> = {
  clients: "person.fill",
  appointments: "calendar",
  reviews: "star.fill",
  promoCodes: "tag.fill",
  giftCards: "gift.fill",
  discounts: "percent",
  locations: "location.fill",
};

const CATEGORY_COLORS: Record<Category, string> = {
  clients: "#6366F1",
  appointments: "#0EA5E9",
  reviews: "#F59E0B",
  promoCodes: "#10B981",
  giftCards: "#EC4899",
  discounts: "#EF4444",
  locations: "#8B5CF6",
};

// ─── Main Component ────────────────────────────────────────────────────────
export default function DevTestingScreen() {
  const colors = useColors();
  const router = useRouter();
  const { state, dispatch } = useStore();

  // ── Phone gate ──────────────────────────────────────────────────────────
  const [phoneInput, setPhoneInput] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [phoneError, setPhoneError] = useState("");

  // ── Config state ────────────────────────────────────────────────────────
  const [counts, setCounts] = useState<Record<Category, string>>({
    clients: "10",
    appointments: "20",
    reviews: "10",
    promoCodes: "5",
    giftCards: "5",
    discounts: "5",
    locations: "3",
  });
  const [selected, setSelected] = useState<Record<Category, boolean>>({
    clients: true,
    appointments: true,
    reviews: true,
    promoCodes: true,
    giftCards: true,
    discounts: true,
    locations: true,
  });
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 3);
    return dateStr(d);
  });
  const [toDate, setToDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 2);
    return dateStr(d);
  });

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
  const seedClients = useMemo(
    () => state.clients.filter((c) => c.notes?.includes(SEED_TAG)),
    [state.clients]
  );
  const seedAppointments = useMemo(
    () => state.appointments.filter((a) => a.notes?.includes(SEED_TAG)),
    [state.appointments]
  );
  const seedReviews = useMemo(
    () => state.reviews.filter((r) => r.comment?.includes(SEED_TAG)),
    [state.reviews]
  );
  const seedPromoCodes = useMemo(
    () => state.promoCodes.filter((p) => p.label?.includes(SEED_TAG)),
    [state.promoCodes]
  );
  const seedGiftCards = useMemo(
    () => state.giftCards.filter((g) => g.message?.includes(SEED_TAG)),
    [state.giftCards]
  );
  const seedDiscounts = useMemo(
    () => state.discounts.filter((d) => d.name?.includes(SEED_TAG)),
    [state.discounts]
  );
  const seedLocations = useMemo(
    () => state.locations.filter((l) => l.name?.includes(SEED_TAG)),
    [state.locations]
  );

  const totalSeedItems =
    seedClients.length +
    seedAppointments.length +
    seedReviews.length +
    seedPromoCodes.length +
    seedGiftCards.length +
    seedDiscounts.length +
    seedLocations.length;

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

    // We need at least one service for appointments
    const services = state.services.length > 0 ? state.services : null;

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
      const statuses: Appointment["status"][] = ["pending", "confirmed", "completed", "cancelled"];
      const payMethods: Appointment["paymentMethod"][] = ["cash", "zelle", "venmo", "cashapp", "card", "unpaid"];
      const payStatuses: Appointment["paymentStatus"][] = ["unpaid", "pending_cash", "paid"];

      for (let i = 0; i < n; i++) {
        const d = randDate(from, to);
        const svc = services ? pick(services) : null;
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
      const svcIds = state.services.map((s) => s.id);
      for (let i = 0; i < n; i++) {
        const value = pick([25, 50, 75, 100, 150, 200]);
        const name = randClientName();
        const gift: GiftCard = {
          id: uid(),
          code: `GIFT${randInt(1000, 9999)}`,
          serviceLocalId: svcIds.length > 0 ? pick(svcIds) : "svc_placeholder",
          serviceIds: svcIds.length > 0 ? [pick(svcIds)] : [],
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
      `This will permanently delete ${totalSeedItems} seeded items (clients, appointments, reviews, promo codes, gift cards, discounts, locations). This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove All",
          style: "destructive",
          onPress: async () => {
            setRemoving(true);
            setLog([]);
            addLog("🗑️ Removing all seed data...");

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

            addLog("✅ All seed data removed.");
            setRemoving(false);
          },
        },
      ]
    );
  }, [
    totalSeedItems,
    seedClients,
    seedAppointments,
    seedReviews,
    seedPromoCodes,
    seedGiftCards,
    seedDiscounts,
    seedLocations,
    dispatch,
    addLog,
  ]);

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
                if (normalized === DEV_ADMIN_PHONE) {
                  setUnlocked(true);
                } else {
                  setPhoneError("Incorrect phone number.");
                }
              }}
            />
            {phoneError ? <Text style={{ color: colors.error, fontSize: 12, marginTop: 4 }}>{phoneError}</Text> : null}
            <Pressable
              style={({ pressed }) => [styles.gateBtn, { backgroundColor: "#F59E0B", opacity: pressed ? 0.8 : 1 }]}
              onPress={() => {
                const normalized = phoneInput.replace(/\s/g, "");
                if (normalized === DEV_ADMIN_PHONE) {
                  setUnlocked(true);
                } else {
                  setPhoneError("Incorrect phone number.");
                }
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
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
      >
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

        {/* Existing seed data summary */}
        {totalSeedItems > 0 && (
          <View style={[styles.summaryCard, { backgroundColor: "#EF444415", borderColor: "#EF444430" }]}>
            <Text style={{ fontSize: 13, fontWeight: "700", color: "#EF4444" }}>
              ⚠️ {totalSeedItems} seeded items exist in the store
            </Text>
            <Text style={{ fontSize: 11, color: "#EF4444", marginTop: 2, opacity: 0.8 }}>
              {seedClients.length} clients · {seedAppointments.length} appts · {seedReviews.length} reviews · {seedPromoCodes.length} promos · {seedGiftCards.length} gifts · {seedDiscounts.length} discounts · {seedLocations.length} locations
            </Text>
          </View>
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
                style={[
                  styles.countInput,
                  {
                    backgroundColor: isOn ? colors.background : colors.surface,
                    borderColor: isOn ? color + "50" : colors.border,
                    color: isOn ? colors.foreground : colors.muted,
                  },
                ]}
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
          style={({ pressed }) => [
            styles.generateBtn,
            { backgroundColor: generating ? colors.muted : "#10B981", opacity: pressed ? 0.85 : 1 },
          ]}
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
          style={({ pressed }) => [
            styles.removeBtn,
            {
              backgroundColor: totalSeedItems === 0 ? colors.surface : "#EF444415",
              borderColor: totalSeedItems === 0 ? colors.border : "#EF444440",
              opacity: pressed ? 0.75 : totalSeedItems === 0 ? 0.5 : 1,
            },
          ]}
        >
          {removing ? (
            <ActivityIndicator color="#EF4444" size="small" />
          ) : (
            <IconSymbol name="trash.fill" size={18} color={totalSeedItems === 0 ? colors.muted : "#EF4444"} />
          )}
          <Text
            style={{
              fontWeight: "700",
              fontSize: 15,
              marginLeft: 8,
              color: totalSeedItems === 0 ? colors.muted : "#EF4444",
            }}
          >
            {removing ? "Removing..." : `Remove All Seed Data (${totalSeedItems})`}
          </Text>
        </Pressable>

        {/* Activity Log */}
        {log.length > 0 && (
          <>
            <Text style={[styles.sectionLabel, { color: colors.muted, marginTop: 20 }]}>ACTIVITY LOG</Text>
            <View style={[styles.logBox, { backgroundColor: "#0D1117", borderColor: "#30363D" }]}>
              {log.map((line, i) => (
                <Text key={i} style={styles.logLine}>
                  {line}
                </Text>
              ))}
            </View>
          </>
        )}

        {/* Info card */}
        <View style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={{ fontSize: 12, fontWeight: "700", color: colors.muted, marginBottom: 6 }}>ℹ️ HOW IT WORKS</Text>
          <Text style={{ fontSize: 12, color: colors.muted, lineHeight: 18 }}>
            All generated items are tagged with a hidden marker so they can be identified and removed in bulk. Use "Remove All Seed Data" to clean up without affecting real data.{"\n\n"}
            Appointments require at least one service to exist. Clients are created first and used for appointments/reviews.{"\n\n"}
            Phone gate: only the registered Dev Admin phone can access this screen.
          </Text>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  gateContainer: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  gateCard: { width: "100%", maxWidth: 360, borderRadius: 20, padding: 24, alignItems: "center", borderWidth: 1 },
  gateIcon: { width: 64, height: 64, borderRadius: 20, alignItems: "center", justifyContent: "center", marginBottom: 16 },
  gateTitle: { fontSize: 20, fontWeight: "800", marginBottom: 8 },
  gateSubtitle: { fontSize: 13, textAlign: "center", lineHeight: 18, marginBottom: 20 },
  gateInput: { width: "100%", borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, marginBottom: 4 },
  gateBtn: { width: "100%", paddingVertical: 14, borderRadius: 14, alignItems: "center", marginTop: 12 },
  header: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  summaryCard: { borderRadius: 12, padding: 12, borderWidth: 1, marginBottom: 16 },
  sectionLabel: { fontSize: 11, fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase", marginBottom: 8, marginTop: 4 },
  sectionHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8, marginTop: 4 },
  selectAllBtn: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 8 },
  card: { borderRadius: 14, padding: 14, borderWidth: 1, marginBottom: 16 },
  dateRow: { flexDirection: "row", alignItems: "flex-end" },
  dateInput: { borderRadius: 10, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 9, fontSize: 14 },
  categoryRow: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 14, padding: 12, borderWidth: 1, marginBottom: 8 },
  catIcon: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  countInput: { width: 60, borderRadius: 10, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 7, fontSize: 15, fontWeight: "700", textAlign: "center" },
  generateBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", borderRadius: 16, paddingVertical: 16, marginTop: 20, marginBottom: 10 },
  removeBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", borderRadius: 16, paddingVertical: 14, borderWidth: 1, marginBottom: 10 },
  logBox: { borderRadius: 12, padding: 14, borderWidth: 1, marginBottom: 16 },
  logLine: { fontSize: 11, color: "#58A6FF", fontFamily: "monospace", lineHeight: 18 },
  infoCard: { borderRadius: 14, padding: 14, borderWidth: 1, marginTop: 8 },
});
