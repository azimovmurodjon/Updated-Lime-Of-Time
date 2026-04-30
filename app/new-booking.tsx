import {
  Text,
  View,
  Pressable,
  StyleSheet,
  TextInput,
  FlatList,
  ScrollView,
  Linking,
  Platform,
  Alert,
  Modal,
  Image,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useStore, generateId, formatDateStr, formatTime, formatDateDisplay } from "@/lib/store";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { Appointment, Client, Product, Discount, DAYS_OF_WEEK, generateAvailableSlots, minutesToTime, timeToMinutes, getApplicableDiscount, generateConfirmationMessage, getServiceDisplayName, stripPhoneFormat, timeSlotsOverlap, PUBLIC_BOOKING_URL } from "@/lib/types";
import { trpc } from "@/lib/trpc";
import { useActiveLocation } from "@/hooks/use-active-location";
import { useResponsive } from "@/hooks/use-responsive";
import { FuturisticBackground } from "@/components/futuristic-background";


type Step = 1 | 2 | 3 | 4 | 5;

type CartItem = {
  type: "service" | "product";
  id: string;
  name: string;
  price: number;
  duration: number;
};

export default function NewBookingScreen() {
  const { state, dispatch, getServiceById, getClientById, getLocationById, syncToDb, filterAppointmentsByLocation, getActiveCustomSchedule } = useStore();
  // Helper: merge global customSchedule entries with location-specific ones (location takes precedence)
  const getLocCustomSchedule = useCallback((locId: string): import('@/lib/types').CustomScheduleDay[] => {
    const locEntries = (state as any).locationCustomSchedule?.[locId] ?? [];
    const locDates = new Set(locEntries.map((cs: any) => cs.date));
    const globalFallback = (state.customSchedule ?? []).filter((cs) => !locDates.has(cs.date));
    return [...locEntries, ...globalFallback];
  }, [(state as any).locationCustomSchedule, state.customSchedule]);
  const { activeLocations: _allActiveLocations } = useActiveLocation();
  const colors = useColors();
  const router = useRouter();
  const { isTablet, hp } = useResponsive();
  const params = useLocalSearchParams<{ date?: string }>();

  const sendSmsMutation = trpc.twilio.sendSms.useMutation();

  const [step, setStep] = useState<Step>(1);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string | null>(null);
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(params.date ?? formatDateStr(new Date()));
  const dateScrollRef = useRef<import("react-native").ScrollView>(null);
  // Scroll the date strip to the selected date on mount / when date changes from outside
  const CHIP_WIDTH = 70; // chip width (62) + gap (8)
  const todayStr2 = formatDateStr(new Date());
  // Auto-scroll date strip to the selected date chip
  useEffect(() => {
    if (!dateScrollRef.current) return;
    const today = new Date();
    const todayMs = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    const selMs = new Date(selectedDate + "T12:00:00");
    const diff = Math.round((selMs.getTime() - todayMs) / 86400000);
    const idx = Math.max(0, diff);
    // Scroll so the selected chip is near the left with a small offset
    const offset = Math.max(0, idx * CHIP_WIDTH - 8);
    setTimeout(() => {
      dateScrollRef.current?.scrollTo({ x: offset, animated: true });
    }, 100);
  }, [selectedDate]);


  // Calendar month view: track which month is displayed (offset from today's month)
  const [calMonthOffset, setCalMonthOffset] = useState(0);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [showTemplatesPicker, setShowTemplatesPicker] = useState(false);
  const [clientSearch, setClientSearch] = useState("");
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickName, setQuickName] = useState("");
  const [quickPhone, setQuickPhone] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [addMoreTab, setAddMoreTab] = useState<"services" | "products">("services");
  // Category drill-down for Step 1: null = show category tiles, string = show services in that category
  const [step1CategoryFilter, setStep1CategoryFilter] = useState<string | null>(null);
  // Filter chips for the "Add More" section
  const [addMoreCategoryFilter, setAddMoreCategoryFilter] = useState<string | null>(null);
  const [addMoreBrandFilter, setAddMoreBrandFilter] = useState<string | null>(null);
  const [recurring, setRecurring] = useState<"none" | "weekly" | "biweekly" | "monthly">("none");
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  // Pre-select the currently active location (single source of truth).
  // When activeLocationId is null (All mode), keep null so the date picker shows all locations.
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(() => {
    const allActive = state.locations.filter((l) => l.active);
    // If user is in "All" mode (null) AND there are multiple locations, keep null
    if (state.activeLocationId === null && allActive.length > 1) {
      return null;
    }
    // If there's an explicit active location, use it
    const activeLoc = state.locations.find((l) => l.id === state.activeLocationId && l.active);
    if (activeLoc) return activeLoc.id;
    // If there's only one active location, always pre-select it so its hours are used
    if (allActive.length === 1) return allActive[0].id;
    // Fall back to default location
    const defaultLoc = state.locations.find((l) => l.isDefault && l.active);
    return defaultLoc?.id ?? null;
  });

  const activeLocations = useMemo(
    () => state.locations.filter((l) => l.active),
    [state.locations]
  );

  // Per-location open/closed check for the currently selected date.
  // Returns a map of locationId -> boolean (true = open, false = closed).
  const locationOpenOnDate = useMemo((): Record<string, boolean> => {
    const result: Record<string, boolean> = {};
    const endDate = state.settings.businessHoursEndDate;
    const d = new Date(selectedDate + "T12:00:00");
    const dayName = DAYS_OF_WEEK[d.getDay()];
    for (const loc of activeLocations) {
      // Temporarily closed = never open
      if (loc.temporarilyClosed) { result[loc.id] = false; continue; }
      // Active Until expiry
      if (endDate && selectedDate > endDate) { result[loc.id] = false; continue; }
      const locCustomSchedule = getLocCustomSchedule(loc.id);
      const customDay = locCustomSchedule.find((cs: { date: string; isOpen: boolean }) => cs.date === selectedDate);
      const locWH = (loc.workingHours != null && Object.keys(loc.workingHours).length > 0)
        ? loc.workingHours as Record<string, import('@/lib/types').WorkingHours>
        : (state.settings.workingHours ?? undefined);
      if (state.settings.scheduleMode === "custom") {
        result[loc.id] = !!(customDay?.isOpen);
      } else if (customDay) {
        result[loc.id] = customDay.isOpen;
      } else {
        const wh = locWH[dayName];
        result[loc.id] = !!(wh && wh.enabled);
      }
    }
    return result;
  }, [activeLocations, selectedDate, state.settings.businessHoursEndDate, state.settings.scheduleMode, state.settings.workingHours, (state as any).locationCustomSchedule]);

  const activeStaff = useMemo(() => {
    return state.staff.filter((s) => {
      if (!s.active) return false;
      // Filter by selected location if set
      if (selectedLocationId && s.locationIds && s.locationIds.length > 0) {
        if (!s.locationIds.includes(selectedLocationId)) return false;
      }
      if (!selectedServiceId) return true;
      if (!s.serviceIds || s.serviceIds.length === 0) return true; // null = all services
      return s.serviceIds.includes(selectedServiceId);
    });
  }, [state.staff, selectedServiceId, selectedLocationId]);

  const selectedStaff = useMemo(() => {
    if (!selectedStaffId) return null;
    return state.staff.find((s) => s.id === selectedStaffId) ?? null;
  }, [state.staff, selectedStaffId]);

  const selectedService = selectedServiceId ? getServiceById(selectedServiceId) : null;
  const selectedClient = selectedClientId ? getClientById(selectedClientId) : null;

  // Total duration includes primary service + cart items
  const totalDuration = useMemo(() => {
    const baseDur = selectedService?.duration ?? state.settings.defaultDuration;
    return baseDur + cart.reduce((sum, item) => sum + item.duration, 0);
  }, [selectedService, cart, state.settings.defaultDuration]);

  const subtotal = useMemo(() => {
    const basePrice = selectedService ? parseFloat(String(selectedService.price)) : 0;
    return basePrice + cart.reduce((sum, item) => sum + item.price, 0);
  }, [selectedService, cart]);

  // Effective slot step: use configured slotInterval when non-zero, else auto (service duration capped at 30)
  const effectiveStep = useMemo(() => {
    const configured = (state.settings as any).slotInterval ?? 0;
    return configured > 0 ? configured : Math.min(totalDuration, 30);
  }, [(state.settings as any).slotInterval, totalDuration]);

  // Auto-detect applicable discount (pass appointments to enforce maxUses cap)
  const appliedDiscount = useMemo(() => {
    if (!selectedServiceId || !selectedDate || !selectedTime) return null;
    return getApplicableDiscount(state.discounts, selectedDate, selectedTime, selectedServiceId, state.appointments);
  }, [state.discounts, selectedDate, selectedTime, selectedServiceId, state.appointments]);

  const discountAmount = useMemo(() => {
    if (!appliedDiscount) return 0;
    // Apply discount to the full cart subtotal (base service + extra items)
    return subtotal * (appliedDiscount.percentage / 100);
  }, [appliedDiscount, subtotal]);

  const totalPrice = subtotal - discountAmount;

  // Per-location time-slot availability: when a time is selected, check whether that specific
  // time slot is available at each location (within working hours + no conflicting appointments).
  // Returns a map of locationId -> boolean (true = time is available at this location).
  const locationTimeAvailable = useMemo((): Record<string, boolean> => {
    // If no time selected yet, all open locations are considered available
    if (!selectedTime) {
      const all: Record<string, boolean> = {};
      for (const loc of activeLocations) all[loc.id] = true;
      return all;
    }
    const result: Record<string, boolean> = {};
    for (const loc of activeLocations) {
      // If location is closed on this date, time is also unavailable
      if (locationOpenOnDate[loc.id] === false) { result[loc.id] = false; continue; }
      const locCustomSchedule = getLocCustomSchedule(loc.id);
      const locWH = (loc.workingHours != null && Object.keys(loc.workingHours).length > 0)
        ? loc.workingHours as Record<string, import('@/lib/types').WorkingHours>
        : (state.settings.workingHours ?? undefined);
      const locAppts = state.appointments.filter((a) => a.locationId === loc.id);
      const slots = generateAvailableSlots(
        selectedDate, totalDuration, locWH, locAppts, effectiveStep,
        locCustomSchedule, state.settings.scheduleMode, state.settings.bufferTime ?? 0
      );
      result[loc.id] = slots.includes(selectedTime);
    }
    return result;
  }, [activeLocations, selectedTime, selectedDate, totalDuration, locationOpenOnDate,
      state.appointments, state.settings.workingHours, state.settings.scheduleMode,
      state.settings.bufferTime, (state as any).locationCustomSchedule]);

  // Combined availability: open on date AND time slot available
  const locationAvailable = useMemo((): Record<string, boolean> => {
    const result: Record<string, boolean> = {};
    for (const loc of activeLocations) {
      result[loc.id] = (locationOpenOnDate[loc.id] !== false) && (locationTimeAvailable[loc.id] !== false);
    }
    return result;
  }, [activeLocations, locationOpenOnDate, locationTimeAvailable]);

  // Auto-select single location whenever activeLocations changes
  // This handles the case where locations load after initial render
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const prevActiveLocCount = activeLocations.length;
  if (!selectedLocationId && activeLocations.length === 1) {
    setSelectedLocationId(activeLocations[0].id);
  }
  // Auto-clear selectedLocationId if the chosen location is no longer available
  // (closed on this date OR time slot not available there)
  const prevSelectedLocationId = selectedLocationId;
  if (prevSelectedLocationId && locationAvailable[prevSelectedLocationId] === false) {
    setSelectedLocationId(null);
  }

  // Per-staff availability: a staff member is unavailable if they have a confirmed/pending
  // appointment that overlaps the selected date + time + totalDuration.
  const staffAvailabilityMap = useMemo((): Record<string, boolean> => {
    if (!selectedDate || !selectedTime) return {};
    const result: Record<string, boolean> = {};
    for (const member of activeStaff) {
      const staffAppts = state.appointments.filter(
        (a) =>
          a.staffId === member.id &&
          a.date === selectedDate &&
          (a.status === "confirmed" || a.status === "pending")
      );
      const hasConflict = staffAppts.some((a) =>
        timeSlotsOverlap(selectedTime, totalDuration, a.time, a.duration)
      );
      result[member.id] = !hasConflict;
    }
    return result;
  }, [activeStaff, state.appointments, selectedDate, selectedTime, totalDuration]);

  // Use the form-selected location's working hours (not the globally active location)
  const selectedLocation = useMemo(
    () => state.locations.find((l) => l.id === selectedLocationId) ?? null,
    [state.locations, selectedLocationId]
  );
  const locationWorkingHours = useMemo(() => {
    // Use the explicitly selected location's hours
    if (selectedLocation?.workingHours && Object.keys(selectedLocation.workingHours).length > 0) {
      return selectedLocation.workingHours as Record<string, import('@/lib/types').WorkingHours>;
    }
    // If no location is selected but there is exactly one active location, use its hours
    // (handles the case where selectedLocationId is null but only one location exists)
    if (!selectedLocationId && activeLocations.length === 1) {
      const onlyLoc = activeLocations[0];
      if (onlyLoc.workingHours && Object.keys(onlyLoc.workingHours).length > 0) {
        return onlyLoc.workingHours as Record<string, import('@/lib/types').WorkingHours>;
      }
    }
    return state.settings.workingHours;
  }, [selectedLocation, selectedLocationId, activeLocations, state.settings.workingHours]);
  // Filter appointments by the form-selected location (not the global active location)
  const locationAppts = useMemo(
    () => {
      if (!selectedLocationId) return state.appointments;
      return state.appointments.filter((a) => a.locationId === selectedLocationId);
    },
    [state.appointments, selectedLocationId]
  );
  const activeCustomSchedule = useMemo(() => {
    const mergeWithGlobal = (locId: string) => {
      const locEntries = (state as any).locationCustomSchedule?.[locId] ?? [];
      const locDates = new Set(locEntries.map((cs: any) => cs.date));
      const globalFallback = (state.customSchedule ?? []).filter((cs) => !locDates.has(cs.date));
      return [...locEntries, ...globalFallback];
    };
    if (selectedLocationId) {
      return mergeWithGlobal(selectedLocationId);
    }
    // No location explicitly selected — if there is exactly one active location,
    // use its per-location custom schedule so Workday overrides are visible.
    if (activeLocations.length === 1) {
      return mergeWithGlobal(activeLocations[0].id);
    }
    // Multi-location with no selection: fall back to global custom schedule
    return state.customSchedule ?? [];
  }, [selectedLocationId, activeLocations, (state as any).locationCustomSchedule, state.customSchedule]);
  // isAllMode: no location pre-selected and multiple active locations exist.
  // In this mode the time slot list is the UNION of all open locations' slots so the user
  // can see every possible time across all locations before choosing one.
  const isAllMode = !selectedLocationId && activeLocations.length > 1;

  const timeSlots = useMemo(() => {
    if (!isAllMode) {
      // Single-location mode: use the selected (or only) location's hours and appointments
      return generateAvailableSlots(
        selectedDate,
        totalDuration,
        locationWorkingHours,
        locationAppts,
        effectiveStep,
        activeCustomSchedule,
        state.settings.scheduleMode,
        state.settings.bufferTime ?? 0
      );
    }
    // All-mode: union of available slots across every open, non-temporarily-closed location
    const slotSet = new Set<string>();
    for (const loc of activeLocations) {
      if (locationOpenOnDate[loc.id] === false) continue;
      const locCustomSchedule = getLocCustomSchedule(loc.id);
      const locWH = (loc.workingHours != null && Object.keys(loc.workingHours).length > 0)
        ? loc.workingHours as Record<string, import('@/lib/types').WorkingHours>
        : (state.settings.workingHours ?? undefined);
      const locAppts = state.appointments.filter((a) => a.locationId === loc.id);
      const slots = generateAvailableSlots(
        selectedDate, totalDuration, locWH, locAppts, effectiveStep,
        locCustomSchedule, state.settings.scheduleMode, state.settings.bufferTime ?? 0
      );
      slots.forEach((s) => slotSet.add(s));
    }
    // Sort chronologically
    return Array.from(slotSet).sort();
  }, [isAllMode, selectedDate, locationWorkingHours, locationAppts, totalDuration,
      activeCustomSchedule, state.settings.scheduleMode, state.settings.bufferTime,
      activeLocations, locationOpenOnDate, state.appointments, state.settings.workingHours,
      (state as any).locationCustomSchedule, refreshKey]);

  // Per-slot location count: how many locations are available for each time slot in All mode.
  // Used to show a badge like "2 locations" on the time chip when multiple locations share a slot.
  const slotLocationCount = useMemo((): Record<string, number> => {
    if (!isAllMode) return {};
    const counts: Record<string, number> = {};
    for (const loc of activeLocations) {
      if (locationOpenOnDate[loc.id] === false) continue;
      const locCustomSchedule = getLocCustomSchedule(loc.id);
      const locWH = (loc.workingHours && Object.keys(loc.workingHours).length > 0)
        ? loc.workingHours as Record<string, import('@/lib/types').WorkingHours>
        : state.settings.workingHours;
      const locAppts = state.appointments.filter((a) => a.locationId === loc.id);
      const slots = generateAvailableSlots(
        selectedDate, totalDuration, locWH, locAppts, effectiveStep,
        locCustomSchedule, state.settings.scheduleMode, state.settings.bufferTime ?? 0
      );
      slots.forEach((s) => { counts[s] = (counts[s] ?? 0) + 1; });
    }
    return counts;
  }, [isAllMode, activeLocations, locationOpenOnDate, selectedDate, totalDuration,
      state.appointments, state.settings.workingHours, state.settings.scheduleMode,
      state.settings.bufferTime, (state as any).locationCustomSchedule]);

  // Bidirectional sync (location → time):
  // If a specific location is selected and the previously chosen time is no longer in its
  // slot list, clear it. Only applies in single-location mode to avoid clearing valid
  // union-mode times when switching to All.
  if (!isAllMode && selectedTime && timeSlots.length > 0 && !timeSlots.includes(selectedTime)) {
    setSelectedTime(null);
  }

  // Auto-select location when only one location has the chosen time available.
  // This gives the user instant feedback without requiring an extra tap.
  if (isAllMode && selectedTime && !selectedLocationId) {
    const availableForTime = activeLocations.filter(
      (loc) => locationTimeAvailable[loc.id] === true
    );
    if (availableForTime.length === 1) {
      setSelectedLocationId(availableForTime[0].id);
    }
  }

  // Date options: next 14 days with closed-day and no-slots awareness
  // When no location is selected (All mode), aggregate across all active locations:
  // a day is open if ANY location has it open, and has slots if ANY location has slots.
  const dateOptions = useMemo(() => {
    const dates: { date: string; closed: boolean; noSlots: boolean }[] = [];
    const today = new Date();
    const endDate = state.settings.businessHoursEndDate;
    // All-locations mode: selectedLocationId is null and there are multiple active locations
    const isAllMode = !selectedLocationId && activeLocations.length > 1;
    for (let i = 0; i < 90; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const ds = formatDateStr(d);
      // Check Active Until expiry first
      let closed = !!(endDate && ds > endDate);
      if (!closed) {
        if (isAllMode) {
          // Open if ANY active location has this day open
          let anyOpen = false;
          for (const loc of activeLocations) {
            if (loc.temporarilyClosed) continue;
            const locCustomSchedule = getLocCustomSchedule(loc.id);
            const locCustomDay = locCustomSchedule.find((cs: { date: string; isOpen: boolean }) => cs.date === ds);
            const locWH = (loc.workingHours != null && Object.keys(loc.workingHours).length > 0)
              ? loc.workingHours as Record<string, import('@/lib/types').WorkingHours>
              : (state.settings.workingHours ?? undefined);
            if (state.settings.scheduleMode === "custom") {
              if (locCustomDay?.isOpen) { anyOpen = true; break; }
            } else {
              if (locCustomDay) {
                if (locCustomDay.isOpen) { anyOpen = true; break; }
              } else {
                const dayName = DAYS_OF_WEEK[d.getDay()];
                const wh = locWH[dayName];
                if (wh && wh.enabled) { anyOpen = true; break; }
              }
            }
          }
          closed = !anyOpen;
        } else {
          const customDay = activeCustomSchedule.find((cs: { date: string; isOpen: boolean }) => cs.date === ds);
          if (state.settings.scheduleMode === "custom") {
            closed = !customDay || !customDay.isOpen;
          } else {
            if (customDay) {
              closed = !customDay.isOpen;
            } else {
              const dayIndex = d.getDay();
              const dayName = DAYS_OF_WEEK[dayIndex];
              const wh = locationWorkingHours[dayName];
              closed = !wh || !wh.enabled;
            }
          }
        }
      }
      let noSlots = false;
      if (!closed) {
        if (isAllMode) {
          // Has slots if ANY location has at least one slot
          let anySlots = false;
          for (const loc of activeLocations) {
            if (loc.temporarilyClosed) continue;
            const locCustomSchedule = getLocCustomSchedule(loc.id);
            const locWH = (loc.workingHours != null && Object.keys(loc.workingHours).length > 0)
              ? loc.workingHours as Record<string, import('@/lib/types').WorkingHours>
              : (state.settings.workingHours ?? undefined);
            const locAppts = state.appointments.filter((a) => a.locationId === loc.id);
            const slots = generateAvailableSlots(ds, totalDuration, locWH, locAppts, effectiveStep, locCustomSchedule, state.settings.scheduleMode, state.settings.bufferTime ?? 0);
            if (slots.length > 0) { anySlots = true; break; }
          }
          noSlots = !anySlots;
        } else {
          const slots = generateAvailableSlots(ds, totalDuration, locationWorkingHours, locationAppts, effectiveStep, activeCustomSchedule, state.settings.scheduleMode, state.settings.bufferTime ?? 0);
          noSlots = slots.length === 0;
        }
      }
      dates.push({ date: ds, closed, noSlots });
    }
    return dates;
  }, [selectedLocationId, activeLocations, activeCustomSchedule, locationWorkingHours, locationAppts, totalDuration, state.settings.scheduleMode, state.settings.bufferTime, state.settings.businessHoursEndDate, (state as any).locationCustomSchedule, state.appointments, state.settings.workingHours]);

  const filteredClients = useMemo(() => {
    const q = clientSearch.toLowerCase();
    return state.clients
      .filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.phone.includes(q)
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [state.clients, clientSearch]);

  // Available products (not already in cart)
  const availableProducts = useMemo(() => {
    const cartProductIds = cart.filter((c) => c.type === "product").map((c) => c.id);
    return state.products.filter((p) => p.available && !cartProductIds.includes(p.id));
  }, [state.products, cart]);

  // Available extra services (not primary, not already in cart)
  const availableExtraServices = useMemo(() => {
    const cartServiceIds = cart.filter((c) => c.type === "service").map((c) => c.id);
    return state.services.filter(
      (s) => s.id !== selectedServiceId && !cartServiceIds.includes(s.id)
    );
  }, [state.services, selectedServiceId, cart]);

  const handleQuickAddClient = useCallback(() => {
    if (!quickName.trim()) return;
    const client: Client = {
      id: generateId(),
      name: quickName.trim(),
      phone: quickPhone.trim(),
      email: "",
      notes: "",
      birthday: "",
      createdAt: new Date().toISOString(),
    };
    dispatch({ type: "ADD_CLIENT", payload: client });
    syncToDb({ type: "ADD_CLIENT", payload: client });
    setSelectedClientId(client.id);
    setShowQuickAdd(false);
    setQuickName("");
    setQuickPhone("");
    setStep(3);
  }, [quickName, quickPhone, dispatch]);

  const addToCart = useCallback((item: CartItem) => {
    setCart((prev) => [...prev, item]);
  }, []);

  const removeFromCart = useCallback((index: number) => {
    setCart((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleBook = useCallback(() => {
    if (!selectedServiceId || !selectedClientId || !selectedTime) return;
    // Auto-select the only location if none is selected
    let effectiveLocationId = selectedLocationId;
    if (!effectiveLocationId && activeLocations.length === 1) {
      effectiveLocationId = activeLocations[0].id;
      setSelectedLocationId(effectiveLocationId);
    }
    if (activeLocations.length > 1 && !effectiveLocationId) {
      Alert.alert("Location Required", "Please select a location before confirming the booking.");
      return;
    }
    // Build notes with extra items
    let bookNotes = notes.trim();
    if (cart.length > 0) {
      const extras = cart.map((c) => `${c.name} ($${c.price.toFixed(2)})`).join(", ");
      bookNotes = bookNotes ? `${bookNotes}\nAdditional items: ${extras}` : `Additional items: ${extras}`;
    }
    if (recurring !== "none") {
      bookNotes = bookNotes ? `${bookNotes}\nRecurring: ${recurring}` : `Recurring: ${recurring}`;
    }

    // Calculate dates for recurring appointments
    const dates: string[] = [selectedDate];
    if (recurring !== "none") {
      const baseDate = new Date(selectedDate + "T12:00:00");
      const count = recurring === "weekly" ? 8 : recurring === "biweekly" ? 6 : 4; // weeks ahead
      for (let i = 1; i < count; i++) {
        const nextDate = new Date(baseDate);
        if (recurring === "weekly") nextDate.setDate(baseDate.getDate() + 7 * i);
        else if (recurring === "biweekly") nextDate.setDate(baseDate.getDate() + 14 * i);
        else nextDate.setMonth(baseDate.getMonth() + i);
        dates.push(formatDateStr(nextDate));
      }
    }

    for (const date of dates) {
      const appointment: Appointment = {
        id: generateId(),
        serviceId: selectedServiceId,
        clientId: selectedClientId,
        date,
        time: selectedTime,
        duration: totalDuration,
        status: "confirmed",
        notes: bookNotes,
        createdAt: new Date().toISOString(),
        totalPrice,
        extraItems: cart.length > 0 ? cart.map((c) => ({ type: c.type, id: c.id, name: c.name, price: c.price, duration: c.duration })) : undefined,
        staffId: selectedStaffId ?? undefined,
        locationId: effectiveLocationId ?? undefined,
        discountPercent: appliedDiscount?.percentage,
        discountAmount: discountAmount > 0 ? discountAmount : undefined,
        discountName: appliedDiscount?.name,
        paymentMethod: totalPrice <= 0 ? 'free' as any : ((selectedPaymentMethod as 'zelle' | 'venmo' | 'cashapp' | 'cash' | undefined) ?? undefined),
        paymentStatus: totalPrice <= 0 ? 'paid' as const : (selectedPaymentMethod === 'cash' ? 'pending_cash' : (selectedPaymentMethod ? 'unpaid' : undefined)),
      };
      dispatch({ type: "ADD_APPOINTMENT", payload: appointment });
      syncToDb({ type: "ADD_APPOINTMENT", payload: appointment });
    }

    // Send confirmation SMS to client
    // Respect master notificationsEnabled and smsClientOnConfirmation toggle
    const notifPrefs = state.settings.notificationPreferences ?? {};
    const masterNotifOn = state.settings.notificationsEnabled !== false;
    const smsClientConfirmOn = (notifPrefs as any).smsClientOnConfirmation !== false; // default true
    if (selectedClient?.phone && masterNotifOn && smsClientConfirmOn) {
      const svc = selectedService;
      const biz = state.settings;
      const profile = biz.profile;
      const apptLoc = selectedLocationId ? getLocationById(selectedLocationId) : null;
      const msg = generateConfirmationMessage(
        biz.businessName,
        apptLoc?.address || profile.address,
        selectedClient.name,
        svc ? getServiceDisplayName(svc) : "Service",
        totalDuration,
        selectedDate,
        selectedTime,
        apptLoc?.phone || profile.phone,
        selectedClient.phone,
        apptLoc?.name,
        apptLoc?.id,
        biz.customSlug,
        apptLoc?.city,
        apptLoc?.state,
        apptLoc?.zipCode
      );
      const rawPhone = stripPhoneFormat(selectedClient.phone);
      // Try server-side SMS (subscription gated); fall back to native SMS app
      const smsEnabled = biz.twilioEnabled && biz.twilioBookingReminder;
      if (smsEnabled && state.businessOwnerId) {
        const toNumber = rawPhone.startsWith("+") ? rawPhone : `+1${rawPhone.replace(/\D/g, "")}`;
        sendSmsMutation
          .mutateAsync({
            businessOwnerId: state.businessOwnerId,
            toNumber,
            body: msg,
            smsAction: "confirmation",
          })
          .catch(() => {
            // Silently fall back — don't block booking flow
          });
      } else if (Platform.OS === "web") {
        Alert.alert("SMS Message", msg);
      } else {
        const separator = Platform.OS === "ios" ? "&" : "?";
        const url = `sms:${rawPhone}${separator}body=${encodeURIComponent(msg)}`;
        Linking.openURL(url).catch(() => Alert.alert("SMS", msg));
      }
    }

    router.back();
  }, [selectedServiceId, selectedClientId, selectedDate, selectedTime, totalDuration, notes, cart, recurring, dispatch, router, appliedDiscount, discountAmount, totalPrice, subtotal, selectedStaffId, selectedLocationId, syncToDb, selectedService, selectedClient, state.settings, sendSmsMutation]);

  const getInitials = (name: string) => {
    const parts = name.split(" ");
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  const getEndTime = (time: string) => {
    return formatTime(minutesToTime(timeToMinutes(time) + totalDuration));
  };

  const TOTAL_STEPS = 5;

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]} tabletMaxWidth={720}>
      <FuturisticBackground />
      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8, paddingTop: 8, paddingHorizontal: hp }}>
        <View className="flex-row items-center">
          <Pressable onPress={() => router.back()} style={({ pressed }) => [{ opacity: pressed ? 0.5 : 1 }]}>
            <IconSymbol name="xmark" size={24} color={colors.foreground} />
          </Pressable>
          <Text className="text-xl font-bold text-foreground ml-4">New Booking</Text>
        </View>
        <Text className="text-sm text-muted">Step {step}/{TOTAL_STEPS}</Text>
      </View>

      {/* Progress Bar */}
      <View style={{ flexDirection: "row", gap: 8, marginBottom: 20, paddingHorizontal: hp }}>
        {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map((s) => (
          <View
            key={s}
            className="flex-1 h-1 rounded-full"
            style={{ backgroundColor: s <= step ? colors.primary : colors.border }}
          />
        ))}
      </View>

      {/* Step 1: Select Service — category drill-down */}
      {step === 1 && (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40, paddingHorizontal: hp }}>
          {state.services.length === 0 ? (
            <View className="items-center py-12">
              <Text className="text-base text-muted">No services available</Text>
              <Text className="text-sm text-muted mt-1">Create a service first</Text>
            </View>
          ) : (() => {
            // Build category map
            const groups = new Map<string, typeof state.services>();
            state.services.forEach((s) => {
              const cat = s.category?.trim() || "General";
              if (!groups.has(cat)) groups.set(cat, []);
              groups.get(cat)!.push(s);
            });
            const entries = Array.from(groups.entries()).sort((a, b) => {
              if (a[0] === "General") return 1;
              if (b[0] === "General") return -1;
              return a[0].localeCompare(b[0]);
            });
            const hasMultiCat = entries.length > 1;

            if (hasMultiCat && step1CategoryFilter === null) {
              // Level 1: show category tiles
              return (
                <View>
                  <Text className="text-base font-semibold text-foreground mb-3">Select a Category</Text>
                  {entries.map(([cat, svcs]) => (
                    <Pressable
                      key={cat}
                      onPress={() => setStep1CategoryFilter(cat)}
                      style={({ pressed }) => ([
                        styles.optionCard,
                        { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
                      ])}
                    >
                      <View style={[styles.colorDot, { backgroundColor: colors.primary }]} />
                      <View style={styles.optionContent}>
                        <Text className="text-base font-semibold text-foreground">{cat}</Text>
                        <Text className="text-xs text-muted mt-0.5">{svcs.length} service{svcs.length !== 1 ? "s" : ""}</Text>
                      </View>
                      <IconSymbol name="chevron.right" size={16} color={colors.muted} />
                    </Pressable>
                  ))}
                </View>
              );
            }

            // Level 2 (or single category): show services
            const displaySvcs = hasMultiCat && step1CategoryFilter
              ? (groups.get(step1CategoryFilter) ?? [])
              : state.services;
            return (
              <View>
                {hasMultiCat && step1CategoryFilter && (
                  <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12, gap: 8 }}>
                    <Pressable
                      onPress={() => setStep1CategoryFilter(null)}
                      style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
                    >
                      <Text style={{ fontSize: 14, color: colors.primary }}>← Categories</Text>
                    </Pressable>
                    <Text className="text-base font-semibold text-foreground">{step1CategoryFilter}</Text>
                  </View>
                )}
                {!hasMultiCat && (
                  <Text className="text-base font-semibold text-foreground mb-3">Select a Service</Text>
                )}
                {displaySvcs.map((item) => (
                  <Pressable
                    key={item.id}
                    onPress={() => {
                      setSelectedServiceId(item.id);
                      setStep(2);
                    }}
                    style={({ pressed }) => [
                      styles.optionCard,
                      {
                        backgroundColor: selectedServiceId === item.id ? item.color + "15" : colors.surface,
                        borderColor: selectedServiceId === item.id ? item.color : colors.border,
                        opacity: pressed ? 0.7 : 1,
                      },
                    ]}
                  >
                    <View style={[styles.colorDot, { backgroundColor: item.color }]} />
                    <View style={styles.optionContent}>
                      <Text className="text-base font-semibold text-foreground">{item.name}</Text>
                      <Text className="text-xs text-muted mt-0.5">{item.duration} min · ${item.price}</Text>
                    </View>
                    <IconSymbol name="chevron.right" size={16} color={colors.muted} />
                  </Pressable>
                ))}
              </View>
            );
          })()}
        </ScrollView>
      )}

      {/* Step 2: Select Client */}
      {step === 2 && (
        <View style={{ flex: 1, paddingHorizontal: hp }}>
          <View className="flex-row items-center justify-between mb-3">
            <Pressable onPress={() => setStep(1)} style={({ pressed }) => [{ opacity: pressed ? 0.5 : 1 }]}>
              <Text className="text-sm" style={{ color: colors.primary }}>← Back</Text>
            </Pressable>
            <Text className="text-base font-semibold text-foreground">Select Client</Text>
            <Pressable
              onPress={() => setShowQuickAdd(!showQuickAdd)}
              style={({ pressed }) => [{ opacity: pressed ? 0.5 : 1 }]}
            >
              <Text className="text-sm" style={{ color: colors.primary }}>
                {showQuickAdd ? "Cancel" : "+ New"}
              </Text>
            </Pressable>
          </View>

          {showQuickAdd ? (
            <View className="bg-surface rounded-2xl p-4 mb-4 border border-border">
              <TextInput
                className="bg-background rounded-xl px-3 py-3 text-sm mb-2 border border-border"
                placeholder="Client Name *"
                placeholderTextColor={colors.muted}
                value={quickName}
                onChangeText={setQuickName}
                style={{ color: colors.foreground }}
                returnKeyType="next"
              />
              <TextInput
                className="bg-background rounded-xl px-3 py-3 text-sm mb-3 border border-border"
                placeholder="Phone (optional)"
                placeholderTextColor={colors.muted}
                value={quickPhone}
                onChangeText={setQuickPhone}
                keyboardType="phone-pad"
                style={{ color: colors.foreground }}
                returnKeyType="done"
                onSubmitEditing={handleQuickAddClient}
              />
              <Pressable
                onPress={handleQuickAddClient}
                style={({ pressed }) => [
                  styles.primaryButton,
                  { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 },
                ]}
              >
                <Text className="text-sm font-semibold text-white">Add & Continue</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <View
                className="flex-row items-center rounded-xl px-3 mb-3 border"
                style={{ backgroundColor: colors.surface, borderColor: colors.border }}
              >
                <IconSymbol name="magnifyingglass" size={18} color={colors.muted} />
                <TextInput
                  className="flex-1 py-3 px-2 text-sm"
                  placeholder="Search clients..."
                  placeholderTextColor={colors.muted}
                  value={clientSearch}
                  onChangeText={setClientSearch}
                  style={{ color: colors.foreground }}
                />
              </View>
              <FlatList
                data={filteredClients}
                keyExtractor={(item) => item.id}
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => (
                  <Pressable
                    onPress={() => {
                      setSelectedClientId(item.id);
                      setStep(3);
                    }}
                    style={({ pressed }) => [
                      styles.optionCard,
                      {
                        backgroundColor: selectedClientId === item.id ? colors.primary + "15" : colors.surface,
                        borderColor: selectedClientId === item.id ? colors.primary : colors.border,
                        opacity: pressed ? 0.7 : 1,
                      },
                    ]}
                  >
                    <View style={[styles.avatar, { backgroundColor: colors.primary + "20" }]}>
                      <Text style={{ fontSize: 13, fontWeight: "700", color: colors.primary }}>
                        {getInitials(item.name)}
                      </Text>
                    </View>
                    <View style={styles.optionContent}>
                      <Text className="text-base font-semibold text-foreground">{item.name}</Text>
                      {item.phone ? (
                        <Text className="text-xs text-muted mt-0.5">{item.phone}</Text>
                      ) : null}
                    </View>
                    <IconSymbol name="chevron.right" size={16} color={colors.muted} />
                  </Pressable>
                )}
                ListEmptyComponent={
                  <View className="items-center py-8">
                    <Text className="text-sm text-muted">No clients found</Text>
                    <Pressable
                      onPress={() => setShowQuickAdd(true)}
                      style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1, marginTop: 8 }]}
                    >
                      <Text className="text-sm font-medium" style={{ color: colors.primary }}>
                        + Add New Client
                      </Text>
                    </Pressable>
                  </View>
                }
                contentContainerStyle={{ paddingBottom: 40 }}
              />
            </>
          )}
        </View>
      )}

      {/* Step 3: Pick Date & Time */}
      {step === 3 && (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: hp, paddingBottom: 40 }}>
          <View className="flex-row items-center justify-between mb-3">
            <Pressable onPress={() => setStep(2)} style={({ pressed }) => [{ opacity: pressed ? 0.5 : 1 }]}>
              <Text className="text-sm" style={{ color: colors.primary }}>← Back</Text>
            </Pressable>
            <Text className="text-base font-semibold text-foreground">Pick Date & Time</Text>
            <View style={{ width: 40 }} />
          </View>

          {/* Date Selection — Modern Horizontal Strip with Month Label */}
          {(() => {
            // Group dateOptions by month for the month label
            const today = new Date();
            const todayStr = today.getFullYear() + "-" + String(today.getMonth()+1).padStart(2,"0") + "-" + String(today.getDate()).padStart(2,"0");
            // Find the month of the selected date to show as header
            const selDateObj = selectedDate ? new Date(selectedDate + "T12:00:00") : today;
            const monthLabel = selDateObj.toLocaleDateString("en-US", { month: "long", year: "numeric" });
            return (
              <View style={{ marginBottom: 16 }}>
                {/* Month label + Today button */}
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <Text style={{ fontSize: 13, fontWeight: "600", color: colors.muted, marginLeft: 2 }}>
                    {monthLabel}
                  </Text>
                  {selectedDate !== todayStr && (
                    <Pressable
                      onPress={() => {
                        setSelectedDate(todayStr);
                        setSelectedTime(null);
                      }}
                      style={({ pressed }) => ({
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 4,
                        paddingHorizontal: 10,
                        paddingVertical: 4,
                        borderRadius: 12,
                        backgroundColor: colors.primary + "18",
                        opacity: pressed ? 0.65 : 1,
                      })}
                    >
                      <Text style={{ fontSize: 12, fontWeight: "600", color: colors.primary }}>Today</Text>
                    </Pressable>
                  )}
                </View>
                {/* Horizontal scrolling date strip */}
                <ScrollView
                  ref={dateScrollRef}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ paddingHorizontal: 2, gap: 8 }}
                >
                  {dateOptions.map((opt) => {
                    const dateObj = new Date(opt.date + "T12:00:00");
                    const isSelected = opt.date === selectedDate;
                    const isToday = opt.date === todayStr;
                    const isPast = opt.date < todayStr;
                    const isUnavailable = opt.closed || opt.noSlots || isPast;
                    const dayAbbr = dateObj.toLocaleDateString("en-US", { weekday: "short" });
                    const dayNum = dateObj.getDate();
                    const monthAbbr = dateObj.toLocaleDateString("en-US", { month: "short" });
                    return (
                      <Pressable
                        key={opt.date}
                        onPress={() => {
                          if (!isUnavailable) {
                            setSelectedDate(opt.date);
                            setSelectedTime(null);
                          }
                        }}
                        style={({ pressed }) => ({
                          width: 62,
                          paddingVertical: 12,
                          paddingHorizontal: 4,
                          borderRadius: 16,
                          alignItems: "center",
                          justifyContent: "center",
                          backgroundColor: isSelected ? colors.primary : isToday && !isUnavailable ? colors.primary + "12" : colors.surface,
                          borderWidth: isToday && !isSelected ? 1.5 : isSelected ? 0 : 1,
                          borderColor: isSelected ? colors.primary : isToday ? colors.primary : colors.border,
                          opacity: isUnavailable ? 0.3 : pressed ? 0.65 : 1,
                          shadowColor: isSelected ? colors.primary : "transparent",
                          shadowOffset: { width: 0, height: 2 },
                          shadowOpacity: isSelected ? 0.25 : 0,
                          shadowRadius: 6,
                          elevation: isSelected ? 3 : 0,
                        })}
                      >
                        <Text style={{
                          fontSize: 10,
                          fontWeight: "600",
                          color: isSelected ? "rgba(255,255,255,0.8)" : colors.muted,
                          letterSpacing: 0.5,
                          textTransform: "uppercase",
                          marginBottom: 4,
                        }}>
                          {dayAbbr}
                        </Text>
                        <Text style={{
                          fontSize: 22,
                          fontWeight: "700",
                          color: isSelected ? "#FFFFFF" : isUnavailable ? colors.muted : colors.foreground,
                          lineHeight: 26,
                        }}>
                          {dayNum}
                        </Text>
                        <Text style={{
                          fontSize: 10,
                          fontWeight: "500",
                          color: isSelected ? "rgba(255,255,255,0.75)" : colors.muted,
                          marginTop: 3,
                        }}>
                          {monthAbbr}
                        </Text>
                        {opt.closed && !isPast && (
                          <View style={{ marginTop: 4, backgroundColor: colors.error + "20", borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1 }}>
                            <Text style={{ fontSize: 8, color: colors.error, fontWeight: "700" }}>OFF</Text>
                          </View>
                        )}
                        {!opt.closed && opt.noSlots && (
                          <View style={{ marginTop: 4, backgroundColor: colors.warning + "20", borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1 }}>
                            <Text style={{ fontSize: 8, color: colors.warning, fontWeight: "700" }}>FULL</Text>
                          </View>
                        )}
                        {isToday && !isSelected && (
                          <View style={{ position: "absolute", bottom: 6, width: 4, height: 4, borderRadius: 2, backgroundColor: colors.primary }} />
                        )}
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            );
          })()}

          {/* Selected date full label */}
          {selectedDate && (
            <View style={{ marginBottom: 12, marginHorizontal: 2 }}>
              <Text style={{ fontSize: 16, fontWeight: "700", color: colors.foreground }}>
                {new Date(selectedDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
              </Text>
            </View>
          )}
          {/* Time Slots */}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8, marginHorizontal: 4 }}>
            <Text className="text-xs font-medium text-muted">Available Times</Text>
            <Pressable
              onPress={() => setRefreshKey((k) => k + 1)}
              style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1, padding: 4 })}
            >
              <IconSymbol name="arrow.clockwise" size={16} color={colors.muted} />
            </Pressable>
          </View>
          {timeSlots.length === 0 ? (
            <View className="items-center py-8 bg-surface rounded-2xl border border-border">
              {selectedDate === formatDateStr(new Date()) ? (
                <>
                  <Text className="text-sm font-semibold text-warning">All slots for today have passed</Text>
                  <Text className="text-xs text-muted mt-1">Select another date to book an appointment</Text>
                </>
              ) : (
                <>
                  <Text className="text-sm text-muted">No available times for this date</Text>
                  <Text className="text-xs text-muted mt-1">Try a different date or check working hours</Text>
                </>
              )}
            </View>
          ) : (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16, justifyContent: "center" }}>
              {timeSlots.map((t) => {
                const isSelected = t === selectedTime;
                const locCount = isAllMode ? (slotLocationCount[t] ?? 1) : 1;
                const multiLoc = isAllMode && locCount > 1;
                return (
                  <Pressable
                    key={t}
                    onPress={() => setSelectedTime(t)}
                    style={({ pressed }) => [
                      styles.timeChip,
                      {
                        backgroundColor: isSelected ? colors.primary : colors.surface,
                        borderColor: isSelected ? colors.primary : multiLoc ? colors.primary + "60" : colors.border,
                        opacity: pressed ? 0.7 : 1,
                        width: 100,
                      },
                    ]}
                  >
                    <Text
                      className="text-sm font-semibold"
                      style={{ color: isSelected ? "#FFFFFF" : colors.foreground, textAlign: "center" }}
                    >
                      {formatTime(t)}
                    </Text>
                    <Text
                      style={{
                        fontSize: 10,
                        color: isSelected ? "#FFFFFF99" : colors.muted,
                        marginTop: 1,
                        textAlign: "center",
                      }}
                    >
                      to {getEndTime(t)}
                    </Text>
                    {multiLoc && (
                      <View style={{
                        marginTop: 3,
                        backgroundColor: isSelected ? "#FFFFFF30" : colors.primary + "20",
                        borderRadius: 4,
                        paddingHorizontal: 4,
                        paddingVertical: 1,
                      }}>
                        <Text style={{
                          fontSize: 9,
                          fontWeight: "700",
                          color: isSelected ? "#FFFFFF" : colors.primary,
                          textAlign: "center",
                        }}>
                          {locCount} locations
                        </Text>
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>
          )}

          {/* Notes */}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4, marginTop: 8 }}>
            <Text className="text-xs font-medium text-muted ml-1">Notes (optional)</Text>
            {(state.noteTemplates ?? []).length > 0 && (
              <Pressable
                onPress={() => setShowTemplatesPicker(true)}
                style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, flexDirection: "row", alignItems: "center", gap: 4 })}
              >
                <IconSymbol name="doc.text.fill" size={13} color={colors.primary} />
                <Text style={{ fontSize: 12, color: colors.primary, fontWeight: "600" }}>Templates</Text>
              </Pressable>
            )}
          </View>
          <TextInput
            className="bg-surface rounded-xl px-4 py-3 text-sm mb-4 border border-border"
            placeholder="Add any notes..."
            placeholderTextColor={colors.muted}
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={2}
            style={{ color: colors.foreground, minHeight: 50, textAlignVertical: "top" }}
          />

          {/* Continue to Add More or Book */}
          {selectedTime && (
            <Pressable
              onPress={() => setStep(4)}
              style={({ pressed }) => [
                styles.bookButton,
                {
                  backgroundColor: colors.primary,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <Text className="text-base font-semibold text-white">Continue</Text>
            </Pressable>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {/* Step 4: Add More & Confirm */}
      {step === 4 && (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: hp, paddingBottom: 40 }}>
          <View className="flex-row items-center justify-between mb-3">
            <Pressable onPress={() => setStep(3)} style={({ pressed }) => [{ opacity: pressed ? 0.5 : 1 }]}>
              <Text className="text-sm" style={{ color: colors.primary }}>← Back</Text>
            </Pressable>
            <Text className="text-base font-semibold text-foreground">Review & Add More</Text>
            <View style={{ width: 40 }} />
          </View>

          {/* Cart Summary */}
          <View className="bg-surface rounded-2xl p-4 mb-4 border border-border">
            <Text className="text-xs font-medium text-muted mb-3">Booking Items</Text>

            {/* Primary Service */}
            {selectedService && (
              <View style={styles.cartItem}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <View style={[styles.colorDot, { backgroundColor: selectedService.color, marginRight: 8 }]} />
                    <Text className="text-sm font-semibold text-foreground">{selectedService.name}</Text>
                  </View>
                  <Text className="text-xs text-muted ml-5">{selectedService.duration} min</Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text className="text-sm font-bold" style={{ color: colors.primary }}>${parseFloat(String(selectedService.price)).toFixed(2)}</Text>
                  <Text style={{ fontSize: 10, color: colors.success, fontWeight: "600" }}>PRIMARY</Text>
                </View>
              </View>
            )}

            {/* Cart Items */}
            {cart.map((item, index) => (
              <View key={`${item.type}-${item.id}-${index}`} style={styles.cartItem}>
                <View style={{ flex: 1 }}>
                  <Text className="text-sm font-semibold text-foreground">{item.name}</Text>
                  <Text className="text-xs text-muted">
                    {item.type === "product" ? "Product" : `${item.duration} min`}
                  </Text>
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Text className="text-sm font-bold" style={{ color: colors.primary }}>${item.price.toFixed(2)}</Text>
                  <Pressable
                    onPress={() => removeFromCart(index)}
                    style={({ pressed }) => [{ opacity: pressed ? 0.5 : 1 }]}
                  >
                    <IconSymbol name="xmark" size={16} color={colors.error} />
                  </Pressable>
                </View>
              </View>
            ))}

            {/* Subtotal */}
            {discountAmount > 0 && (
              <View style={[styles.cartItem, { borderTopWidth: 1, borderTopColor: colors.border, marginTop: 4, paddingTop: 8 }]}>
                <Text className="text-sm text-muted">Subtotal</Text>
                <Text className="text-sm text-muted">${subtotal.toFixed(2)}</Text>
              </View>
            )}
            {/* Discount */}
            {appliedDiscount && discountAmount > 0 && (
              <View style={[styles.cartItem]}>
                <Text className="text-sm font-medium" style={{ color: colors.warning }}>{appliedDiscount.name} ({appliedDiscount.percentage}% off)</Text>
                <Text className="text-sm font-medium" style={{ color: colors.warning }}>-${discountAmount.toFixed(2)}</Text>
              </View>
            )}
            {/* Totals */}
            <View style={[styles.cartItem, { borderTopWidth: 2, borderTopColor: colors.border, marginTop: 4, paddingTop: 10 }]}>
              <Text className="text-sm font-bold text-foreground">Total ({totalDuration} min)</Text>
              <Text className="text-base font-bold" style={{ color: colors.primary }}>${totalPrice.toFixed(2)}</Text>
            </View>
          </View>

          {/* Staff Selector */}
          {activeStaff.length > 0 && (
            <View className="bg-surface rounded-2xl p-4 mb-4 border border-border">
              <Text className="text-xs font-medium text-muted mb-3">Assign Staff (Optional)</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <Pressable
                    onPress={() => setSelectedStaffId(null)}
                    style={({ pressed }) => [{
                      paddingHorizontal: 14,
                      paddingVertical: 10,
                      borderRadius: 12,
                      borderWidth: 1.5,
                      backgroundColor: !selectedStaffId ? colors.primary + "15" : colors.background,
                      borderColor: !selectedStaffId ? colors.primary : colors.border,
                      opacity: pressed ? 0.7 : 1,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                    }]}
                  >
                    <Text style={{ fontSize: 13, fontWeight: "600", color: !selectedStaffId ? colors.primary : colors.foreground }}>Any Available</Text>
                  </Pressable>
                  {activeStaff.map((member) => {
                    // Availability dot: green = available, grey = busy (only shown when date+time selected)
                    const hasTimeSelected = !!(selectedDate && selectedTime);
                    const isAvailable = staffAvailabilityMap[member.id] !== false;
                    const dotColor = !hasTimeSelected ? colors.border : isAvailable ? colors.success : colors.muted;
                    return (
                      <Pressable
                        key={member.id}
                        onPress={() => setSelectedStaffId(member.id)}
                        style={({ pressed }) => [{
                          paddingHorizontal: 14,
                          paddingVertical: 10,
                          borderRadius: 12,
                          borderWidth: 1.5,
                          backgroundColor: selectedStaffId === member.id ? (member.color || colors.primary) + "15" : colors.background,
                          borderColor: selectedStaffId === member.id ? (member.color || colors.primary) : colors.border,
                          opacity: pressed ? 0.7 : 1,
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 8,
                        }]}
                      >
                        <View style={{ position: "relative" }}>
                          <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: member.color || colors.primary, alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                            {member.photoUri ? (
                              <Image source={{ uri: member.photoUri }} style={{ width: 28, height: 28, borderRadius: 14 }} />
                            ) : (
                              <Text style={{ color: "#FFF", fontSize: 12, fontWeight: "700" }}>{member.name.charAt(0).toUpperCase()}</Text>
                            )}
                          </View>
                          {/* Availability dot — bottom-right of avatar */}
                          <View style={{
                            position: "absolute",
                            bottom: -1,
                            right: -1,
                            width: 9,
                            height: 9,
                            borderRadius: 5,
                            backgroundColor: dotColor,
                            borderWidth: 1.5,
                            borderColor: colors.background,
                          }} />
                        </View>
                        <Text style={{ fontSize: 13, fontWeight: "600", color: selectedStaffId === member.id ? (member.color || colors.primary) : colors.foreground }}>{member.name}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </ScrollView>
            </View>
          )}

          {/* Location Selector */}
          {activeLocations.length > 0 && (
            <View className="bg-surface rounded-2xl p-4 mb-4 border border-border">
              <Text className="text-xs font-medium text-muted mb-3">Location <Text style={{ color: colors.error }}>*</Text></Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  {activeLocations.map((loc) => {
                    const isAvailable = locationAvailable[loc.id] !== false;
                    const isSelected = selectedLocationId === loc.id;
                    // Determine the reason for being unavailable (for the label)
                    const isClosed = locationOpenOnDate[loc.id] === false;
                    const noTimeSlot = !isClosed && selectedTime != null && locationTimeAvailable[loc.id] === false;
                    return (
                      <Pressable
                        key={loc.id}
                        onPress={() => { if (isAvailable) setSelectedLocationId(loc.id); }}
                        style={[{
                          paddingHorizontal: 14,
                          paddingVertical: 10,
                          borderRadius: 12,
                          borderWidth: 1.5,
                          backgroundColor: isSelected ? colors.primary + "15" : colors.background,
                          borderColor: isSelected ? colors.primary : isAvailable ? colors.border : colors.error + "40",
                          opacity: isAvailable ? 1 : 0.45,
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 8,
                        }]}
                      >
                        <IconSymbol name="location.fill" size={14} color={isSelected ? colors.primary : isAvailable ? colors.muted : colors.error} />
                        <View>
                          <Text style={{ fontSize: 13, fontWeight: "600", color: isSelected ? colors.primary : isAvailable ? colors.foreground : colors.muted }}>{loc.name}</Text>
                          {!!loc.address && (
                            <Text style={{ fontSize: 11, color: colors.muted, marginTop: 1 }} numberOfLines={1}>{loc.address}</Text>
                          )}
                          {isClosed && (
                            <Text style={{ fontSize: 10, color: colors.error, marginTop: 1, fontWeight: "600" }}>Closed this day</Text>
                          )}
                          {noTimeSlot && (
                            <Text style={{ fontSize: 10, color: colors.error, marginTop: 1, fontWeight: "600" }}>Time unavailable here</Text>
                          )}
                        </View>
                        {loc.isDefault && isAvailable && (
                          <View style={{ backgroundColor: colors.primary + "20", paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 }}>
                            <Text style={{ fontSize: 9, fontWeight: "700", color: colors.primary }}>DEFAULT</Text>
                          </View>
                        )}
                      </Pressable>
                    );
                  })}
                </View>
              </ScrollView>
            </View>
          )}

          {/* Add More Section */}
          <Text className="text-xs font-medium text-muted mb-2 ml-1">Add More (Optional)</Text>

          {/* Segmented Control */}
          <View style={[styles.segControl, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Pressable
              onPress={() => setAddMoreTab("services")}
              style={[
                styles.segBtn,
                addMoreTab === "services" && { backgroundColor: colors.primary },
              ]}
            >
              <Text
                className="text-xs font-semibold"
                style={{ color: addMoreTab === "services" ? "#FFFFFF" : colors.muted }}
              >
                Services
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setAddMoreTab("products")}
              style={[
                styles.segBtn,
                addMoreTab === "products" && { backgroundColor: colors.primary },
              ]}
            >
              <Text
                className="text-xs font-semibold"
                style={{ color: addMoreTab === "products" ? "#FFFFFF" : colors.muted }}
              >
                Products
              </Text>
            </Pressable>
          </View>

          {/* Extra Services — category filter chips */}
          {addMoreTab === "services" && (
            <View className="mb-4">
              {availableExtraServices.length === 0 ? (
                <View className="items-center py-6 bg-surface rounded-xl border border-border">
                  <Text className="text-xs text-muted">No additional services available</Text>
                </View>
              ) : (() => {
                const svcCats = Array.from(new Set(availableExtraServices.map((s) => s.category?.trim() || "General"))).sort();
                const hasMultiCat = svcCats.length > 1;
                const filteredSvcs = addMoreCategoryFilter
                  ? availableExtraServices.filter((s) => (s.category?.trim() || "General") === addMoreCategoryFilter)
                  : availableExtraServices;
                return (
                  <View>
                    {hasMultiCat && (
                      <ScrollView horizontal showsHorizontalScrollIndicator={false}
                        contentContainerStyle={{ gap: 8, paddingBottom: 8, flexDirection: "row" }}
                        style={{ marginBottom: 8 }}
                      >
                        <Pressable
                          onPress={() => setAddMoreCategoryFilter(null)}
                          style={[styles.filterChip, { backgroundColor: !addMoreCategoryFilter ? colors.primary : colors.surface, borderColor: !addMoreCategoryFilter ? colors.primary : colors.border }]}
                        >
                          <Text style={{ fontSize: 12, fontWeight: "600", color: !addMoreCategoryFilter ? "#fff" : colors.muted }}>All</Text>
                        </Pressable>
                        {svcCats.map((cat) => (
                          <Pressable
                            key={cat}
                            onPress={() => setAddMoreCategoryFilter(addMoreCategoryFilter === cat ? null : cat)}
                            style={[styles.filterChip, { backgroundColor: addMoreCategoryFilter === cat ? colors.primary : colors.surface, borderColor: addMoreCategoryFilter === cat ? colors.primary : colors.border }]}
                          >
                            <Text style={{ fontSize: 12, fontWeight: "600", color: addMoreCategoryFilter === cat ? "#fff" : colors.muted }} numberOfLines={1}>{cat}</Text>
                          </Pressable>
                        ))}
                      </ScrollView>
                    )}
                    {filteredSvcs.map((s) => (
                      <Pressable
                        key={s.id}
                        onPress={() =>
                          addToCart({ type: "service", id: s.id, name: s.name, price: parseFloat(String(s.price)), duration: s.duration })
                        }
                        style={({ pressed }) => [
                          styles.optionCard,
                          { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
                        ]}
                      >
                        <View style={[styles.colorDot, { backgroundColor: s.color }]} />
                        <View style={styles.optionContent}>
                          <Text className="text-sm font-semibold text-foreground">{s.name}</Text>
                          <Text className="text-xs text-muted">{s.duration} min{s.category ? " · " + s.category : ""}</Text>
                        </View>
                        <Text className="text-sm font-bold" style={{ color: colors.primary }}>+ ${parseFloat(String(s.price)).toFixed(2)}</Text>
                      </Pressable>
                    ))}
                  </View>
                );
              })()}
            </View>
          )}

          {/* Products — brand filter chips */}
          {addMoreTab === "products" && (
            <View className="mb-4">
              {availableProducts.length === 0 ? (
                <View className="items-center py-6 bg-surface rounded-xl border border-border">
                  <Text className="text-xs text-muted">No products available</Text>
                </View>
              ) : (() => {
                const allBrands = Array.from(new Set(availableProducts.map((p) => p.brand?.trim() || "Other"))).sort();
                const hasMultiBrand = allBrands.length > 1;
                const filteredProds = addMoreBrandFilter
                  ? availableProducts.filter((p) => (p.brand?.trim() || "Other") === addMoreBrandFilter)
                  : availableProducts;
                return (
                  <View>
                    {hasMultiBrand && (
                      <ScrollView horizontal showsHorizontalScrollIndicator={false}
                        contentContainerStyle={{ gap: 8, paddingBottom: 8, flexDirection: "row" }}
                        style={{ marginBottom: 8 }}
                      >
                        <Pressable
                          onPress={() => setAddMoreBrandFilter(null)}
                          style={[styles.filterChip, { backgroundColor: !addMoreBrandFilter ? colors.primary : colors.surface, borderColor: !addMoreBrandFilter ? colors.primary : colors.border }]}
                        >
                          <Text style={{ fontSize: 12, fontWeight: "600", color: !addMoreBrandFilter ? "#fff" : colors.muted }}>All</Text>
                        </Pressable>
                        {allBrands.map((brand) => (
                          <Pressable
                            key={brand}
                            onPress={() => setAddMoreBrandFilter(addMoreBrandFilter === brand ? null : brand)}
                            style={[styles.filterChip, { backgroundColor: addMoreBrandFilter === brand ? colors.primary : colors.surface, borderColor: addMoreBrandFilter === brand ? colors.primary : colors.border }]}
                          >
                            <Text style={{ fontSize: 12, fontWeight: "600", color: addMoreBrandFilter === brand ? "#fff" : colors.muted }} numberOfLines={1}>{brand}</Text>
                          </Pressable>
                        ))}
                      </ScrollView>
                    )}
                    {filteredProds.map((p) => (
                      <Pressable
                        key={p.id}
                        onPress={() =>
                          addToCart({ type: "product", id: p.id, name: p.name, price: parseFloat(String(p.price)), duration: 0 })
                        }
                        style={({ pressed }) => [
                          styles.optionCard,
                          { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
                        ]}
                      >
                        <IconSymbol name="bag.fill" size={18} color={colors.primary} style={{ marginRight: 12 }} />
                        <View style={styles.optionContent}>
                          <Text className="text-sm font-semibold text-foreground">{p.name}</Text>
                          {p.brand ? <Text className="text-xs text-muted">{p.brand}{p.description ? " · " + p.description : ""}</Text> : p.description ? <Text className="text-xs text-muted">{p.description}</Text> : null}
                        </View>
                        <Text className="text-sm font-bold" style={{ color: colors.primary }}>+ ${parseFloat(String(p.price)).toFixed(2)}</Text>
                      </Pressable>
                    ))}
                  </View>
                );
              })()}
            </View>
          )}

          {/* Booking Summary */}
          {selectedTime && (
            <View className="bg-surface rounded-2xl p-4 mb-4 border border-border">
              <Text className="text-xs text-muted mb-2">Booking Summary</Text>
              <View className="flex-row items-center mb-2">
                <View
                  style={[
                    styles.summaryDot,
                    { backgroundColor: selectedService?.color ?? colors.primary },
                  ]}
                />
                <Text className="text-base font-semibold text-foreground ml-2">
                  {selectedService?.name}
                  {cart.length > 0 ? ` + ${cart.length} more` : ""}
                </Text>
              </View>
              <Text className="text-sm text-muted">
                {selectedClient?.name} · {formatDateDisplay(selectedDate)}
              </Text>
              {selectedStaff && (
                <View style={{ flexDirection: "row", alignItems: "center", marginTop: 2, gap: 4 }}>
                  <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: selectedStaff.color || colors.primary, alignItems: "center", justifyContent: "center" }}>
                    <Text style={{ color: "#FFF", fontSize: 8, fontWeight: "700" }}>{selectedStaff.name.charAt(0)}</Text>
                  </View>
                  <Text className="text-sm text-muted">{selectedStaff.name}</Text>
                </View>
              )}
              <Text className="text-sm text-muted">
                {formatTime(selectedTime)} - {getEndTime(selectedTime)} ({totalDuration} min)
              </Text>
              {appliedDiscount && discountAmount > 0 ? (
                <View style={{ marginTop: 2 }}>
                  <Text style={{ fontSize: 12, color: colors.warning }}>{appliedDiscount.name} ({appliedDiscount.percentage}% off)</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Text style={{ fontSize: 12, color: colors.muted, textDecorationLine: "line-through" }}>${subtotal.toFixed(2)}</Text>
                    <Text className="text-sm font-semibold" style={{ color: colors.primary }}>Total: ${totalPrice.toFixed(2)}</Text>
                  </View>
                </View>
              ) : (
                <Text className="text-sm font-semibold" style={{ color: colors.primary, marginTop: 2 }}>
                  Total: ${totalPrice.toFixed(2)}
                </Text>
              )}
            </View>
          )}

          {/* Recurring Option */}
          <View className="bg-surface rounded-2xl p-4 mb-4 border border-border">
            <Text className="text-xs text-muted mb-2">Repeat Appointment</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {(["none", "weekly", "biweekly", "monthly"] as const).map((opt) => (
                <Pressable
                  key={opt}
                  onPress={() => setRecurring(opt)}
                  style={({ pressed }) => [{
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                    borderRadius: 10,
                    borderWidth: 1,
                    backgroundColor: recurring === opt ? colors.primary : colors.background,
                    borderColor: recurring === opt ? colors.primary : colors.border,
                    opacity: pressed ? 0.7 : 1,
                  }]}
                >
                  <Text style={{ fontSize: 13, fontWeight: "500", color: recurring === opt ? "#FFFFFF" : colors.foreground }}>
                    {opt === "none" ? "One-time" : opt === "weekly" ? "Weekly" : opt === "biweekly" ? "Bi-weekly" : "Monthly"}
                  </Text>
                </Pressable>
              ))}
            </View>
            {recurring !== "none" && (
              <Text style={{ fontSize: 11, color: colors.muted, marginTop: 6 }}>
                {recurring === "weekly" ? "8 appointments" : recurring === "biweekly" ? "6 appointments" : "4 appointments"} will be created
              </Text>
            )}
          </View>

          {/* Continue to Payment Button */}
          <Pressable
            onPress={() => {
              if (!selectedTime || (activeLocations.length > 0 && !selectedLocationId)) return;
              setStep(5);
            }}
            style={({ pressed }) => [
              styles.bookButton,
              {
                backgroundColor: (selectedTime && (activeLocations.length === 0 || selectedLocationId)) ? colors.primary : colors.muted,
                opacity: pressed && selectedTime ? 0.8 : 1,
              },
            ]}
            disabled={!selectedTime || (activeLocations.length > 0 && !selectedLocationId)}
          >
            <Text className="text-base font-semibold text-white">Continue to Payment →</Text>
          </Pressable>

          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {/* ── Step 5: Payment Method ── */}
      {step === 5 && (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: hp, paddingBottom: 40 }}>
          <View className="flex-row items-center justify-between mb-3">
            <Pressable onPress={() => setStep(4)} style={({ pressed }) => [{ opacity: pressed ? 0.5 : 1 }]}>
              <Text className="text-sm" style={{ color: colors.primary }}>← Back</Text>
            </Pressable>
            <Text className="text-base font-semibold text-foreground">Payment Method</Text>
            <View style={{ width: 40 }} />
          </View>

          {/* Amount Due */}
          <View className="bg-surface rounded-2xl p-4 mb-4 border border-border">
            <Text className="text-xs font-medium text-muted mb-1">Amount Due</Text>
            <Text className="text-2xl font-bold" style={{ color: colors.primary }}>${totalPrice.toFixed(2)}</Text>
            {selectedService && <Text className="text-xs text-muted mt-1">{selectedService.name}{cart.length > 0 ? ` + ${cart.length} extra item${cart.length > 1 ? 's' : ''}` : ''}</Text>}
          </View>

          {/* Payment Options */}
          <View className="bg-surface rounded-2xl p-4 mb-4 border border-border">
            <Text className="text-xs font-medium text-muted mb-3">How will the client pay?</Text>
            {(() => {
              const pm = state.settings;
              const opts: { id: string; label: string; sub: string; color: string }[] = [];
              if (pm.zelleHandle) opts.push({ id: 'zelle', label: '💜 Zelle', sub: pm.zelleHandle, color: '#6d28d9' });
              if (pm.cashAppHandle) opts.push({ id: 'cashapp', label: '💚 Cash App', sub: pm.cashAppHandle.startsWith('$') ? pm.cashAppHandle : '$' + pm.cashAppHandle, color: '#00d632' });
              if (pm.venmoHandle) opts.push({ id: 'venmo', label: '💙 Venmo', sub: pm.venmoHandle.startsWith('@') ? pm.venmoHandle : '@' + pm.venmoHandle, color: '#3d95ce' });
              opts.push({ id: 'cash', label: '💵 Cash', sub: 'Collect in person', color: '#888' });
              return opts.map((opt) => (
                <Pressable
                  key={opt.id}
                  onPress={() => setSelectedPaymentMethod(opt.id)}
                  style={[{
                    flexDirection: 'row', alignItems: 'center', gap: 12,
                    padding: 14, borderRadius: 14, marginBottom: 8,
                    borderWidth: 2,
                    borderColor: selectedPaymentMethod === opt.id ? opt.color : colors.border,
                    backgroundColor: selectedPaymentMethod === opt.id ? opt.color + '18' : colors.background,
                  }]}
                >
                  <Text style={{ fontSize: 22 }}>{opt.label.split(' ')[0]}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: '600', fontSize: 14, color: colors.foreground }}>{opt.label.slice(opt.label.indexOf(' ') + 1)}</Text>
                    <Text style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>{opt.sub}</Text>
                  </View>
                  {selectedPaymentMethod === opt.id && (
                    <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: opt.color, alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>✓</Text>
                    </View>
                  )}
                </Pressable>
              ));
            })()}
          </View>

          {/* Confirm Booking Button */}
          <Pressable
            onPress={() => {
              if (!selectedPaymentMethod) {
                Alert.alert('Payment Method', 'Please select a payment method to continue.');
                return;
              }
              handleBook();
            }}
            style={({ pressed }) => [styles.bookButton, { backgroundColor: selectedPaymentMethod ? colors.primary : colors.muted, opacity: pressed ? 0.8 : 1 }]}
          >
            <Text className="text-base font-semibold text-white">
              {recurring !== 'none' ? `Book ${recurring === 'weekly' ? 8 : recurring === 'biweekly' ? 6 : 4} Appointments` : 'Confirm Booking'}
            </Text>
          </Pressable>

          <View style={{ height: 40 }} />
        </ScrollView>
      )}
      {/* Note Templates Picker Modal */}
      <Modal
        visible={showTemplatesPicker}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowTemplatesPicker(false)}
      >
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 0.5, borderBottomColor: colors.border }}>
            <Pressable onPress={() => setShowTemplatesPicker(false)} style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}>
              <Text style={{ fontSize: 16, color: colors.muted }}>Cancel</Text>
            </Pressable>
            <Text style={{ fontSize: 17, fontWeight: "700", color: colors.foreground }}>Note Templates</Text>
            <View style={{ width: 60 }} />
          </View>
          <FlatList
            data={state.noteTemplates ?? []}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => {
                  setNotes((prev) => prev ? `${prev}\n${item.body}` : item.body);
                  setShowTemplatesPicker(false);
                }}
                style={({ pressed }) => ({
                  backgroundColor: pressed ? colors.primary + "15" : colors.surface,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: colors.border,
                  padding: 14,
                  marginBottom: 10,
                  opacity: pressed ? 0.9 : 1,
                })}
              >
                <Text style={{ fontSize: 14, fontWeight: "700", color: colors.foreground, marginBottom: 4 }}>{item.title}</Text>
                <Text style={{ fontSize: 13, color: colors.muted, lineHeight: 18 }} numberOfLines={3}>{item.body}</Text>
              </Pressable>
            )}
          />
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  optionCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    width: "100%",
  },
  colorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  optionContent: {
    flex: 1,
  },
  dateChip: {
    minWidth: 56,
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  timeChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 84,
    minHeight: 44,
  },
  summaryDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  primaryButton: {
    width: "100%",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
  },
  bookButton: {
    width: "100%",
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 52,
  },
  cartItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: "#e5e7eb",
  },
  segControl: {
    flexDirection: "row",
    borderRadius: 10,
    borderWidth: 1,
    padding: 3,
    marginBottom: 12,
  },
  segBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: "center",
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    alignSelf: "flex-start",
    height: 34,
    justifyContent: "center",
    alignItems: "center",
  },
});
