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
  useWindowDimensions,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useStore, generateId, formatDateStr, formatTime, formatDateDisplay } from "@/lib/store";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useState, useMemo, useCallback } from "react";
import { Appointment, Client, Product, Discount, DAYS_OF_WEEK, generateAvailableSlots, minutesToTime, timeToMinutes, getApplicableDiscount, generateConfirmationMessage, getServiceDisplayName, stripPhoneFormat } from "@/lib/types";
import { useActiveLocation } from "@/hooks/use-active-location";

type Step = 1 | 2 | 3 | 4;

type CartItem = {
  type: "service" | "product";
  id: string;
  name: string;
  price: number;
  duration: number;
};

export default function NewBookingScreen() {
  const { state, dispatch, getServiceById, getClientById, syncToDb, filterAppointmentsByLocation, getActiveCustomSchedule } = useStore();
  const { activeLocation, effectiveWorkingHours } = useActiveLocation();
  const colors = useColors();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const hp = isTablet ? 32 : Math.round(Math.max(16, width * 0.045));
  const params = useLocalSearchParams<{ date?: string }>();

  const [step, setStep] = useState<Step>(1);
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(params.date ?? formatDateStr(new Date()));
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [clientSearch, setClientSearch] = useState("");
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickName, setQuickName] = useState("");
  const [quickPhone, setQuickPhone] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [addMoreTab, setAddMoreTab] = useState<"services" | "products">("services");
  const [recurring, setRecurring] = useState<"none" | "weekly" | "biweekly" | "monthly">("none");
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  // Pre-select the currently active location (single source of truth)
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(() => {
    const activeLoc = state.locations.find((l) => l.id === state.activeLocationId && l.active);
    if (activeLoc) return activeLoc.id;
    const defaultLoc = state.locations.find((l) => l.isDefault && l.active);
    return defaultLoc?.id ?? null;
  });

  const activeLocations = useMemo(
    () => state.locations.filter((l) => l.active),
    [state.locations]
  );

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

  // Auto-detect applicable discount
  const appliedDiscount = useMemo(() => {
    if (!selectedServiceId || !selectedDate || !selectedTime) return null;
    return getApplicableDiscount(state.discounts, selectedDate, selectedTime, selectedServiceId);
  }, [state.discounts, selectedDate, selectedTime, selectedServiceId]);

  const discountAmount = useMemo(() => {
    if (!appliedDiscount || !selectedService) return 0;
    return parseFloat(String(selectedService.price)) * (appliedDiscount.percentage / 100);
  }, [appliedDiscount, selectedService]);

  const totalPrice = subtotal - discountAmount;

  // Generate available time slots using location-scoped hours and appointments
  const locationAppts = useMemo(
    () => filterAppointmentsByLocation(state.appointments),
    [state.appointments, filterAppointmentsByLocation]
  );
  const locationWorkingHours = effectiveWorkingHours ?? state.settings.workingHours;
  const activeCustomSchedule = useMemo(() => getActiveCustomSchedule(), [getActiveCustomSchedule]);
  const timeSlots = useMemo(() => {
    return generateAvailableSlots(
      selectedDate,
      totalDuration,
      locationWorkingHours,
      locationAppts,
      30,
      activeCustomSchedule,
      state.settings.scheduleMode,
      state.settings.bufferTime ?? 0
    );
  }, [selectedDate, locationWorkingHours, locationAppts, totalDuration, activeCustomSchedule, state.settings.scheduleMode, state.settings.bufferTime]);

  // Date options: next 14 days with closed-day and no-slots awareness
  const dateOptions = useMemo(() => {
    const dates: { date: string; closed: boolean; noSlots: boolean }[] = [];
    const today = new Date();
    for (let i = 0; i < 14; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const ds = formatDateStr(d);
      const customDay = activeCustomSchedule.find((cs) => cs.date === ds);
      // Check Active Until expiry first
      const endDate = state.settings.businessHoursEndDate;
      let closed = !!(endDate && ds > endDate);
      if (!closed) {
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
      let noSlots = false;
      if (!closed) {
        const slots = generateAvailableSlots(ds, totalDuration, locationWorkingHours, locationAppts, 30, activeCustomSchedule, state.settings.scheduleMode, state.settings.bufferTime ?? 0);
        noSlots = slots.length === 0;
      }
      dates.push({ date: ds, closed, noSlots });
    }
    return dates;
  }, [activeCustomSchedule, locationWorkingHours, locationAppts, totalDuration, state.settings.scheduleMode, state.settings.bufferTime, state.settings.businessHoursEndDate]);

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
        locationId: selectedLocationId ?? undefined,
        discountPercent: appliedDiscount?.percentage,
        discountAmount: discountAmount > 0 ? discountAmount : undefined,
        discountName: appliedDiscount?.name,
      };
      dispatch({ type: "ADD_APPOINTMENT", payload: appointment });
      syncToDb({ type: "ADD_APPOINTMENT", payload: appointment });
    }

    // Send confirmation SMS to client
    if (selectedClient?.phone) {
      const svc = selectedService;
      const biz = state.settings;
      const profile = biz.profile;
      const msg = generateConfirmationMessage(
        biz.businessName,
        profile.address,
        selectedClient.name,
        svc ? getServiceDisplayName(svc) : "Service",
        totalDuration,
        selectedDate,
        selectedTime,
        profile.phone,
        selectedClient.phone
      );
      const rawPhone = stripPhoneFormat(selectedClient.phone);
      if (Platform.OS === "web") {
        Alert.alert("SMS Message", msg);
      } else {
        const separator = Platform.OS === "ios" ? "&" : "?";
        const url = `sms:${rawPhone}${separator}body=${encodeURIComponent(msg)}`;
        Linking.openURL(url).catch(() => Alert.alert("SMS", msg));
      }
    }

    router.back();
  }, [selectedServiceId, selectedClientId, selectedDate, selectedTime, totalDuration, notes, cart, recurring, dispatch, router, appliedDiscount, discountAmount, totalPrice, subtotal, selectedStaffId, selectedLocationId, syncToDb, selectedService, selectedClient, state.settings]);

  const getInitials = (name: string) => {
    const parts = name.split(" ");
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  const getEndTime = (time: string) => {
    return formatTime(minutesToTime(timeToMinutes(time) + totalDuration));
  };

  const TOTAL_STEPS = 4;

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]} tabletMaxWidth={isTablet ? 720 : 0}>
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

      {/* Step 1: Select Service (grouped by category) */}
      {step === 1 && (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40, paddingHorizontal: hp }}>
          <Text className="text-base font-semibold text-foreground mb-3">Select a Service</Text>
          {state.services.length === 0 ? (
            <View className="items-center py-12">
              <Text className="text-base text-muted">No services available</Text>
              <Text className="text-sm text-muted mt-1">Create a service first</Text>
            </View>
          ) : (
            (() => {
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
              return entries.map(([cat, svcs]) => (
                <View key={cat} style={{ marginBottom: hasMultiCat ? 12 : 0 }}>
                  {hasMultiCat && (
                    <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 6, gap: 6 }}>
                      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary }} />
                      <Text style={{ fontSize: 13, fontWeight: "700", color: colors.foreground }}>{cat}</Text>
                      <Text style={{ fontSize: 12, color: colors.muted }}>({svcs.length})</Text>
                    </View>
                  )}
                  {svcs.map((item) => (
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
                          marginLeft: hasMultiCat ? 4 : 0,
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
              ));
            })()
          )}
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

          {/* Date Selection */}
          <Text className="text-xs font-medium text-muted mb-2 ml-1">Date</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
            <View className="flex-row gap-2">
              {dateOptions.map((opt) => {
                const dateObj = new Date(opt.date + "T12:00:00");
                const isSelected = opt.date === selectedDate;
                const dayName = dateObj.toLocaleDateString("en-US", { weekday: "short" });
                const dayNum = dateObj.getDate();
                const isUnavailable = opt.closed || opt.noSlots;
                return (
                  <Pressable
                    key={opt.date}
                    onPress={() => {
                      if (!isUnavailable) {
                        setSelectedDate(opt.date);
                        setSelectedTime(null);
                      }
                    }}
                    style={({ pressed }) => [
                      styles.dateChip,
                      {
                        backgroundColor: isSelected ? colors.primary : isUnavailable ? colors.border + "30" : colors.surface,
                        borderColor: isSelected ? colors.primary : colors.border,
                        opacity: isUnavailable ? 0.35 : pressed ? 0.7 : 1,
                      },
                    ]}
                  >
                    <Text
                      className="text-xs font-medium"
                      style={{ color: isSelected ? "#FFFFFF" : colors.muted }}
                    >
                      {dayName}
                    </Text>
                    <Text
                      className="text-lg font-bold"
                      style={{ color: isSelected ? "#FFFFFF" : isUnavailable ? colors.muted : colors.foreground }}
                    >
                      {dayNum}
                    </Text>
                    {opt.closed && <Text style={{ fontSize: 9, color: colors.error, fontWeight: "600" }}>OFF</Text>}
                    {!opt.closed && opt.noSlots && <Text style={{ fontSize: 9, color: colors.warning, fontWeight: "600" }}>FULL</Text>}
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>

          {/* Time Slots */}
          <Text className="text-xs font-medium text-muted mb-2 ml-1">Available Times</Text>
          {timeSlots.length === 0 ? (
            <View className="items-center py-8 bg-surface rounded-2xl border border-border">
              <Text className="text-sm text-muted">No available times for this date</Text>
              <Text className="text-xs text-muted mt-1">Try a different date or check working hours</Text>
            </View>
          ) : (
            <View className="flex-row flex-wrap gap-2 mb-4">
              {timeSlots.map((t) => {
                const isSelected = t === selectedTime;
                return (
                  <Pressable
                    key={t}
                    onPress={() => setSelectedTime(t)}
                    style={({ pressed }) => [
                      styles.timeChip,
                      {
                        backgroundColor: isSelected ? colors.primary : colors.surface,
                        borderColor: isSelected ? colors.primary : colors.border,
                        opacity: pressed ? 0.7 : 1,
                      },
                    ]}
                  >
                    <Text
                      className="text-sm font-medium"
                      style={{ color: isSelected ? "#FFFFFF" : colors.foreground }}
                    >
                      {formatTime(t)}
                    </Text>
                    <Text
                      style={{
                        fontSize: 10,
                        color: isSelected ? "#FFFFFF99" : colors.muted,
                        marginTop: 1,
                      }}
                    >
                      to {getEndTime(t)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}

          {/* Notes */}
          <Text className="text-xs font-medium text-muted mb-1 ml-1 mt-2">Notes (optional)</Text>
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
                  {activeStaff.map((member) => (
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
                      <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: member.color || colors.primary, alignItems: "center", justifyContent: "center" }}>
                        <Text style={{ color: "#FFF", fontSize: 12, fontWeight: "700" }}>{member.name.charAt(0).toUpperCase()}</Text>
                      </View>
                      <Text style={{ fontSize: 13, fontWeight: "600", color: selectedStaffId === member.id ? (member.color || colors.primary) : colors.foreground }}>{member.name}</Text>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>
            </View>
          )}

          {/* Location Selector */}
          {activeLocations.length > 0 && (
            <View className="bg-surface rounded-2xl p-4 mb-4 border border-border">
              <Text className="text-xs font-medium text-muted mb-3">Location (Optional)</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <Pressable
                    onPress={() => setSelectedLocationId(null)}
                    style={({ pressed }) => [{
                      paddingHorizontal: 14,
                      paddingVertical: 10,
                      borderRadius: 12,
                      borderWidth: 1.5,
                      backgroundColor: !selectedLocationId ? colors.primary + "15" : colors.background,
                      borderColor: !selectedLocationId ? colors.primary : colors.border,
                      opacity: pressed ? 0.7 : 1,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                    }]}
                  >
                    <Text style={{ fontSize: 13, fontWeight: "600", color: !selectedLocationId ? colors.primary : colors.foreground }}>No Location</Text>
                  </Pressable>
                  {activeLocations.map((loc) => (
                    <Pressable
                      key={loc.id}
                      onPress={() => setSelectedLocationId(loc.id)}
                      style={({ pressed }) => [{
                        paddingHorizontal: 14,
                        paddingVertical: 10,
                        borderRadius: 12,
                        borderWidth: 1.5,
                        backgroundColor: selectedLocationId === loc.id ? colors.primary + "15" : colors.background,
                        borderColor: selectedLocationId === loc.id ? colors.primary : colors.border,
                        opacity: pressed ? 0.7 : 1,
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 8,
                      }]}
                    >
                      <IconSymbol name="location.fill" size={14} color={selectedLocationId === loc.id ? colors.primary : colors.muted} />
                      <View>
                        <Text style={{ fontSize: 13, fontWeight: "600", color: selectedLocationId === loc.id ? colors.primary : colors.foreground }}>{loc.name}</Text>
                        {!!loc.address && (
                          <Text style={{ fontSize: 11, color: colors.muted, marginTop: 1 }} numberOfLines={1}>{loc.address}</Text>
                        )}
                      </View>
                      {loc.isDefault && (
                        <View style={{ backgroundColor: colors.primary + "20", paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 }}>
                          <Text style={{ fontSize: 9, fontWeight: "700", color: colors.primary }}>DEFAULT</Text>
                        </View>
                      )}
                    </Pressable>
                  ))}
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

          {/* Extra Services (grouped by category) */}
          {addMoreTab === "services" && (
            <View className="mb-4">
              {availableExtraServices.length === 0 ? (
                <View className="items-center py-6 bg-surface rounded-xl border border-border">
                  <Text className="text-xs text-muted">No additional services available</Text>
                </View>
              ) : (
                (() => {
                  const svcGroups = new Map<string, typeof availableExtraServices>();
                  availableExtraServices.forEach((s) => {
                    const cat = s.category?.trim() || "General";
                    if (!svcGroups.has(cat)) svcGroups.set(cat, []);
                    svcGroups.get(cat)!.push(s);
                  });
                  const svcEntries = Array.from(svcGroups.entries()).sort((a, b) => {
                    if (a[0] === "General") return 1;
                    if (b[0] === "General") return -1;
                    return a[0].localeCompare(b[0]);
                  });
                  const hasMultiCat = svcEntries.length > 1;
                  return svcEntries.map(([cat, svcs]) => (
                    <View key={cat} style={{ marginBottom: hasMultiCat ? 8 : 0 }}>
                      {hasMultiCat && (
                        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 4, gap: 6 }}>
                          <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: colors.primary }} />
                          <Text style={{ fontSize: 12, fontWeight: "700", color: colors.foreground }}>{cat}</Text>
                        </View>
                      )}
                      {svcs.map((s) => (
                        <Pressable
                          key={s.id}
                          onPress={() =>
                            addToCart({ type: "service", id: s.id, name: s.name, price: parseFloat(String(s.price)), duration: s.duration })
                          }
                          style={({ pressed }) => [
                            styles.optionCard,
                            { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.7 : 1, marginLeft: hasMultiCat ? 4 : 0 },
                          ]}
                        >
                          <View style={[styles.colorDot, { backgroundColor: s.color }]} />
                          <View style={styles.optionContent}>
                            <Text className="text-sm font-semibold text-foreground">{s.name}</Text>
                            <Text className="text-xs text-muted">{s.duration} min</Text>
                          </View>
                          <Text className="text-sm font-bold" style={{ color: colors.primary }}>+ ${parseFloat(String(s.price)).toFixed(2)}</Text>
                        </Pressable>
                      ))}
                    </View>
                  ));
                })()
              )}
            </View>
          )}

          {/* Products (grouped by brand) */}
          {addMoreTab === "products" && (
            <View className="mb-4">
              {availableProducts.length === 0 ? (
                <View className="items-center py-6 bg-surface rounded-xl border border-border">
                  <Text className="text-xs text-muted">No products available</Text>
                </View>
              ) : (
                (() => {
                  const prodGroups = new Map<string, typeof availableProducts>();
                  availableProducts.forEach((p) => {
                    const br = p.brand?.trim() || "Other";
                    if (!prodGroups.has(br)) prodGroups.set(br, []);
                    prodGroups.get(br)!.push(p);
                  });
                  const prodEntries = Array.from(prodGroups.entries()).sort((a, b) => {
                    if (a[0] === "Other") return 1;
                    if (b[0] === "Other") return -1;
                    return a[0].localeCompare(b[0]);
                  });
                  const hasMultiBrand = prodEntries.length > 1;
                  return prodEntries.map(([brand, prods]) => (
                    <View key={brand} style={{ marginBottom: hasMultiBrand ? 8 : 0 }}>
                      {hasMultiBrand && (
                        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 4, gap: 6 }}>
                          <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: colors.warning }} />
                          <Text style={{ fontSize: 12, fontWeight: "700", color: colors.foreground }}>{brand}</Text>
                        </View>
                      )}
                      {prods.map((p) => (
                        <Pressable
                          key={p.id}
                          onPress={() =>
                            addToCart({ type: "product", id: p.id, name: p.name, price: parseFloat(String(p.price)), duration: 0 })
                          }
                          style={({ pressed }) => [
                            styles.optionCard,
                            { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.7 : 1, marginLeft: hasMultiBrand ? 4 : 0 },
                          ]}
                        >
                          <IconSymbol name="bag.fill" size={18} color={colors.primary} style={{ marginRight: 12 }} />
                          <View style={styles.optionContent}>
                            <Text className="text-sm font-semibold text-foreground">{p.name}</Text>
                            {p.brand && !hasMultiBrand ? <Text className="text-xs text-muted">{p.brand}</Text> : p.description ? <Text className="text-xs text-muted">{p.description}</Text> : null}
                          </View>
                          <Text className="text-sm font-bold" style={{ color: colors.primary }}>+ ${parseFloat(String(p.price)).toFixed(2)}</Text>
                        </Pressable>
                      ))}
                    </View>
                  ));
                })()
              )}
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

          {/* Book Button */}
          <Pressable
            onPress={handleBook}
            style={({ pressed }) => [
              styles.bookButton,
              {
                backgroundColor: selectedTime ? colors.primary : colors.muted,
                opacity: pressed && selectedTime ? 0.8 : 1,
              },
            ]}
            disabled={!selectedTime}
          >
            <Text className="text-base font-semibold text-white">
              {recurring !== "none" ? `Book ${recurring === "weekly" ? 8 : recurring === "biweekly" ? 6 : 4} Appointments` : "Confirm Booking"}
            </Text>
          </Pressable>

          <View style={{ height: 40 }} />
        </ScrollView>
      )}
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
});
