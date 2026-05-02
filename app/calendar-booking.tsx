import { useState, useMemo, useCallback } from "react";
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
  Image,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import {
  useStore,
  generateId,
  formatDateStr,
  formatTime,
  formatDateDisplay,
} from "@/lib/store";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import {
  Appointment,
  Client,
  DAYS_OF_WEEK,
  generateAvailableSlots,
  minutesToTime,
  timeToMinutes,
  getApplicableDiscount,
  generateConfirmationMessage,
  getServiceDisplayName,
  stripPhoneFormat,
  timeSlotsOverlap,
} from "@/lib/types";
import { trpc } from "@/lib/trpc";
import { useActiveLocation } from "@/hooks/use-active-location";
import { useResponsive } from "@/hooks/use-responsive";
import { FuturisticBackground } from "@/components/futuristic-background";

// Steps:
// 1 = Service Category / Service selection
// 2 = Client selection
// 3 = Location selection (only if multiple locations)
// 4 = Staff selection (filtered by location)
// 5 = Review & Add More
// 6 = Payment Method
// 7 = Confirm
type Step = 1 | 2 | 3 | 4 | 5 | 6 | 7;

type CartItem = {
  type: "service" | "product";
  id: string;
  name: string;
  price: number;
  duration: number;
};

export default function CalendarBookingScreen() {
  const {
    state,
    dispatch,
    getServiceById,
    getClientById,
    getLocationById,
    syncToDb,
  } = useStore();
  const { activeLocations } = useActiveLocation();
  const colors = useColors();
  const router = useRouter();
  const { hp } = useResponsive();
  const params = useLocalSearchParams<{
    date?: string;
    time?: string;
    locationId?: string;
  }>();

  const sendSmsMutation = trpc.twilio.sendSms.useMutation();

  // Pre-selected from calendar
  const preselectedDate = params.date ?? formatDateStr(new Date());
  const preselectedTime = params.time ?? null;
  // If a specific location was clicked from calendar, pre-select it
  const preselectedLocationId = params.locationId ?? null;

  const [step, setStep] = useState<Step>(1);
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [clientSearch, setClientSearch] = useState("");
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickName, setQuickName] = useState("");
  const [quickPhone, setQuickPhone] = useState("");
  const [step1CategoryFilter, setStep1CategoryFilter] = useState<string | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [addMoreTab, setAddMoreTab] = useState<"services" | "products">("services");
  const [addMoreCategoryFilter, setAddMoreCategoryFilter] = useState<string | null>(null);
  const [addMoreBrandFilter, setAddMoreBrandFilter] = useState<string | null>(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string | null>(null);

  // Location selection — pre-select if only one active location or if passed from calendar
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(() => {
    if (preselectedLocationId) return preselectedLocationId;
    if (activeLocations.length === 1) return activeLocations[0].id;
    // If user is in single-location mode
    const activeLoc = state.locations.find(
      (l) => l.id === state.activeLocationId && l.active
    );
    if (activeLoc) return activeLoc.id;
    return null;
  });

  const selectedService = selectedServiceId ? getServiceById(selectedServiceId) : null;
  const selectedClient = selectedClientId ? getClientById(selectedClientId) : null;
  const selectedLocation = useMemo(
    () => state.locations.find((l) => l.id === selectedLocationId) ?? null,
    [state.locations, selectedLocationId]
  );

  const totalDuration = useMemo(
    () => (selectedService?.duration ?? state.settings.defaultDuration) + cart.reduce((s, i) => s + i.duration, 0),
    [selectedService, state.settings.defaultDuration, cart]
  );

  const servicePrice = useMemo(() => {
    if (!selectedService) return 0;
    return parseFloat(String(selectedService.price));
  }, [selectedService]);

  const subtotal = useMemo(
    () => servicePrice + cart.reduce((s, i) => s + i.price, 0),
    [servicePrice, cart]
  );

  const effectiveStep = useMemo(() => {
    const configured = (state.settings as any).slotInterval ?? 0;
    return configured > 0 ? configured : Math.min(totalDuration, 30);
  }, [(state.settings as any).slotInterval, totalDuration]);

  const locationWorkingHours = useMemo(() => {
    if (
      selectedLocation?.workingHours &&
      Object.keys(selectedLocation.workingHours).length > 0
    ) {
      return selectedLocation.workingHours as Record<
        string,
        import("@/lib/types").WorkingHours
      >;
    }
    if (!selectedLocationId && activeLocations.length === 1) {
      const onlyLoc = activeLocations[0];
      if (onlyLoc.workingHours && Object.keys(onlyLoc.workingHours).length > 0) {
        return onlyLoc.workingHours as Record<
          string,
          import("@/lib/types").WorkingHours
        >;
      }
    }
    return state.settings.workingHours;
  }, [selectedLocation, selectedLocationId, activeLocations, state.settings.workingHours]);

  const locationAppts = useMemo(() => {
    if (!selectedLocationId) return state.appointments;
    return state.appointments.filter((a) => a.locationId === selectedLocationId);
  }, [state.appointments, selectedLocationId]);

  const activeCustomSchedule = useMemo(() => {
    const mergeWithGlobal = (locId: string) => {
      const locEntries = (state as any).locationCustomSchedule?.[locId] ?? [];
      const locDates = new Set(locEntries.map((cs: any) => cs.date));
      const globalFallback = (state.customSchedule ?? []).filter(
        (cs) => !locDates.has(cs.date)
      );
      return [...locEntries, ...globalFallback];
    };
    if (selectedLocationId) return mergeWithGlobal(selectedLocationId);
    if (activeLocations.length === 1) return mergeWithGlobal(activeLocations[0].id);
    return state.customSchedule ?? [];
  }, [
    selectedLocationId,
    activeLocations,
    (state as any).locationCustomSchedule,
    state.customSchedule,
  ]);

  // Available staff filtered by selected location and service
  const availableStaff = useMemo(() => {
    return state.staff.filter((s) => {
      if (!s.active) return false;
      if (selectedLocationId && s.locationIds && s.locationIds.length > 0) {
        if (!s.locationIds.includes(selectedLocationId)) return false;
      }
      if (!selectedServiceId) return true;
      if (!s.serviceIds || s.serviceIds.length === 0) return true;
      return s.serviceIds.includes(selectedServiceId);
    });
  }, [state.staff, selectedServiceId, selectedLocationId]);

  // Staff availability map for the pre-selected date/time
  const staffAvailabilityMap = useMemo((): Record<string, boolean> => {
    if (!preselectedDate || !preselectedTime) return {};
    const result: Record<string, boolean> = {};
    for (const member of availableStaff) {
      const staffAppts = state.appointments.filter(
        (a) =>
          a.staffId === member.id &&
          a.date === preselectedDate &&
          (a.status === "confirmed" || a.status === "pending")
      );
      const hasConflict = staffAppts.some((a) =>
        timeSlotsOverlap(preselectedTime, totalDuration, a.time, a.duration)
      );
      result[member.id] = !hasConflict;
    }
    return result;
  }, [availableStaff, state.appointments, preselectedDate, preselectedTime, totalDuration]);

  const appliedDiscount = useMemo(() => {
    if (!selectedServiceId || !preselectedDate || !preselectedTime) return null;
    return getApplicableDiscount(
      state.discounts,
      preselectedDate,
      preselectedTime,
      selectedServiceId,
      state.appointments
    );
  }, [state.discounts, preselectedDate, preselectedTime, selectedServiceId, state.appointments]);

  const discountAmount = useMemo(() => {
    if (!appliedDiscount) return 0;
    return subtotal * (appliedDiscount.percentage / 100);
  }, [appliedDiscount, subtotal]);

  const totalPrice = subtotal - discountAmount;

  // Available extra services (exclude the primary service already selected)
  const availableExtraServices = useMemo(
    () => state.services.filter((s) => s.id !== selectedServiceId),
    [state.services, selectedServiceId]
  );

  const availableProducts = useMemo(() => state.products ?? [], [state.products]);

  const addToCart = useCallback((item: CartItem) => {
    setCart((prev) => [...prev, item]);
  }, []);

  const removeFromCart = useCallback((index: number) => {
    setCart((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const filteredClients = useMemo(() => {
    const q = clientSearch.toLowerCase();
    return state.clients
      .filter(
        (c) =>
          c.name.toLowerCase().includes(q) || c.phone.includes(q)
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [state.clients, clientSearch]);

  const getInitials = (name: string) => {
    const parts = name.split(" ");
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

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
    advanceAfterClient();
  }, [quickName, quickPhone, dispatch, syncToDb]);

  // Determine next step after client selection
  const advanceAfterClient = useCallback(() => {
    if (activeLocations.length > 1 && !selectedLocationId) {
      setStep(3);
    } else {
      setStep(4);
    }
  }, [activeLocations.length, selectedLocationId]);

  const handleBook = useCallback(() => {
    if (!selectedServiceId || !selectedClientId || !preselectedTime) return;
    let effectiveLocationId = selectedLocationId;
    if (!effectiveLocationId && activeLocations.length === 1) {
      effectiveLocationId = activeLocations[0].id;
    }
    if (activeLocations.length > 1 && !effectiveLocationId) {
      Alert.alert(
        "Location Required",
        "Please select a location before confirming."
      );
      return;
    }

    const extraItems = cart.map((item) => ({
      type: item.type,
      id: item.id,
      name: item.name,
      price: item.price,
      duration: item.duration,
    }));

    const appointment: Appointment = {
      id: generateId(),
      serviceId: selectedServiceId,
      clientId: selectedClientId,
      date: preselectedDate,
      time: preselectedTime,
      duration: totalDuration,
      status: "confirmed",
      notes: notes.trim(),
      createdAt: new Date().toISOString(),
      totalPrice,
      staffId: selectedStaffId ?? undefined,
      locationId: effectiveLocationId ?? undefined,
      discountPercent: appliedDiscount?.percentage,
      discountAmount: discountAmount > 0 ? discountAmount : undefined,
      discountName: appliedDiscount?.name,
      paymentStatus: totalPrice <= 0 ? "paid" : "unpaid",
      paymentMethod: selectedPaymentMethod ?? undefined,
      extraItems: extraItems.length > 0 ? extraItems : undefined,
    };
    dispatch({ type: "ADD_APPOINTMENT", payload: appointment });
    syncToDb({ type: "ADD_APPOINTMENT", payload: appointment });

    // Send confirmation SMS
    const notifPrefs = state.settings.notificationPreferences ?? {};
    const masterNotifOn = state.settings.notificationsEnabled !== false;
    const smsClientConfirmOn =
      (notifPrefs as any).smsClientOnConfirmation !== false;
    const client = getClientById(selectedClientId);
    if (client?.phone && masterNotifOn && smsClientConfirmOn) {
      const svc = selectedService;
      const biz = state.settings;
      const profile = biz.profile;
      const apptLoc = effectiveLocationId ? getLocationById(effectiveLocationId) : null;
      const msg = generateConfirmationMessage(
        biz.businessName,
        apptLoc?.address || profile.address,
        client.name,
        svc ? getServiceDisplayName(svc) : "Service",
        totalDuration,
        preselectedDate,
        preselectedTime,
        apptLoc?.phone || profile.phone,
        client.phone,
        apptLoc?.name,
        apptLoc?.id,
        biz.customSlug,
        apptLoc?.city,
        apptLoc?.state,
        apptLoc?.zipCode
      );
      const rawPhone = stripPhoneFormat(client.phone);
      const smsEnabled = biz.twilioEnabled && biz.twilioBookingReminder;
      if (smsEnabled && state.businessOwnerId) {
        const toNumber = rawPhone.startsWith("+")
          ? rawPhone
          : `+1${rawPhone.replace(/\D/g, "")}`;
        sendSmsMutation
          .mutateAsync({
            businessOwnerId: state.businessOwnerId,
            toNumber,
            body: msg,
            smsAction: "confirmation",
          })
          .catch(() => {});
      } else if (Platform.OS === "web") {
        Alert.alert("SMS Message", msg);
      } else {
        const separator = Platform.OS === "ios" ? "&" : "?";
        const url = `sms:${rawPhone}${separator}body=${encodeURIComponent(msg)}`;
        Linking.openURL(url).catch(() => Alert.alert("SMS", msg));
      }
    }

    router.back();
  }, [
    selectedServiceId,
    selectedClientId,
    preselectedDate,
    preselectedTime,
    totalDuration,
    notes,
    totalPrice,
    subtotal,
    discountAmount,
    selectedStaffId,
    selectedLocationId,
    activeLocations,
    dispatch,
    syncToDb,
    appliedDiscount,
    cart,
    selectedPaymentMethod,
    state.settings,
    sendSmsMutation,
    router,
    getClientById,
    getLocationById,
    selectedService,
  ]);

  // Determine step count based on whether location selection is needed
  const needsLocationStep = activeLocations.length > 1 && !preselectedLocationId;
  // Steps: 1=Service, 2=Client, [3=Location if needed], 4=Staff, 5=Review+Add More, 6=Payment, 7=Confirm
  const TOTAL_STEPS = needsLocationStep ? 7 : 6;

  // Map logical steps to display step numbers (skip location step if not needed)
  const displayStep = useMemo(() => {
    if (!needsLocationStep) {
      // No location step: 1→1, 2→2, 4→3, 5→4, 6→5, 7→6
      if (step <= 2) return step;
      if (step === 4) return 3;
      if (step === 5) return 4;
      if (step === 6) return 5;
      if (step === 7) return 6;
    }
    return step;
  }, [step, needsLocationStep]);

  const formatTimeDisplay = (time: string) => {
    const [h, m] = time.split(":").map(Number);
    const ap = h >= 12 ? "PM" : "AM";
    const hr = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${hr}:${String(m).padStart(2, "0")} ${ap}`;
  };

  const getEndTime = (time: string) => {
    return formatTime(minutesToTime(timeToMinutes(time) + totalDuration));
  };

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]} tabletMaxWidth={720}>
      <FuturisticBackground />

      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 8,
          paddingTop: 8,
          paddingHorizontal: hp,
        }}
      >
        <View className="flex-row items-center">
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [{ opacity: pressed ? 0.5 : 1 }]}
          >
            <IconSymbol name="xmark" size={24} color={colors.foreground} />
          </Pressable>
          <Text className="text-xl font-bold text-foreground ml-4">
            Book Appointment
          </Text>
        </View>
        <Text className="text-sm text-muted">
          Step {displayStep}/{TOTAL_STEPS}
        </Text>
      </View>

      {/* Progress Bar */}
      <View
        style={{
          flexDirection: "row",
          gap: 8,
          marginBottom: 12,
          paddingHorizontal: hp,
        }}
      >
        {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map((s) => (
          <View
            key={s}
            className="flex-1 h-1 rounded-full"
            style={{
              backgroundColor: s <= displayStep ? colors.primary : colors.border,
            }}
          />
        ))}
      </View>

      {/* Pre-selected date/time banner */}
      <View
        style={{
          marginHorizontal: hp,
          marginBottom: 12,
          backgroundColor: colors.primary + "15",
          borderRadius: 12,
          paddingHorizontal: 14,
          paddingVertical: 10,
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          borderWidth: 1,
          borderColor: colors.primary + "40",
        }}
      >
        <IconSymbol name="calendar" size={16} color={colors.primary} />
        <Text style={{ fontSize: 14, fontWeight: "600", color: colors.primary }}>
          {formatDateDisplay(preselectedDate)}
          {preselectedTime ? ` · ${formatTimeDisplay(preselectedTime)}` : ""}
        </Text>
      </View>

      {/* ─── Step 1: Service Selection ─── */}
      {step === 1 && (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 40, paddingHorizontal: hp }}
        >
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

              if (hasMultiCat && step1CategoryFilter === null) {
                return (
                  <View>
                    <Text className="text-base font-semibold text-foreground mb-3">
                      Select a Category
                    </Text>
                    {entries.map(([cat, svcs]) => (
                      <Pressable
                        key={cat}
                        onPress={() => setStep1CategoryFilter(cat)}
                        style={({ pressed }) => [
                          styles.optionCard,
                          {
                            backgroundColor: colors.surface,
                            borderColor: colors.border,
                            opacity: pressed ? 0.7 : 1,
                          },
                        ]}
                      >
                        <View
                          style={[styles.colorDot, { backgroundColor: colors.primary }]}
                        />
                        <View style={styles.optionContent}>
                          <Text className="text-base font-semibold text-foreground">
                            {cat}
                          </Text>
                          <Text className="text-xs text-muted mt-0.5">
                            {svcs.length} service{svcs.length !== 1 ? "s" : ""}
                          </Text>
                        </View>
                        <IconSymbol
                          name="chevron.right"
                          size={16}
                          color={colors.muted}
                        />
                      </Pressable>
                    ))}
                  </View>
                );
              }

              const displaySvcs =
                hasMultiCat && step1CategoryFilter
                  ? (groups.get(step1CategoryFilter) ?? [])
                  : state.services;

              return (
                <View>
                  {hasMultiCat && step1CategoryFilter && (
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        marginBottom: 12,
                        gap: 8,
                      }}
                    >
                      <Pressable
                        onPress={() => setStep1CategoryFilter(null)}
                        style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
                      >
                        <Text style={{ fontSize: 14, color: colors.primary }}>
                          ← Categories
                        </Text>
                      </Pressable>
                      <Text className="text-base font-semibold text-foreground">
                        {step1CategoryFilter}
                      </Text>
                    </View>
                  )}
                  {!hasMultiCat && (
                    <Text className="text-base font-semibold text-foreground mb-3">
                      Select a Service
                    </Text>
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
                          backgroundColor:
                            selectedServiceId === item.id
                              ? item.color + "15"
                              : colors.surface,
                          borderColor:
                            selectedServiceId === item.id
                              ? item.color
                              : colors.border,
                          opacity: pressed ? 0.7 : 1,
                        },
                      ]}
                    >
                      {item.photoUri ? (
                        <Image
                          source={{ uri: item.photoUri }}
                          style={{
                            width: 40,
                            height: 40,
                            borderRadius: 8,
                            marginRight: 12,
                          }}
                        />
                      ) : (
                        <View
                          style={[styles.colorDot, { backgroundColor: item.color }]}
                        />
                      )}
                      <View style={styles.optionContent}>
                        <Text className="text-base font-semibold text-foreground">
                          {item.name}
                        </Text>
                        <Text className="text-xs text-muted mt-0.5">
                          {item.duration} min · ${item.price}
                        </Text>
                      </View>
                      <IconSymbol
                        name="chevron.right"
                        size={16}
                        color={colors.muted}
                      />
                    </Pressable>
                  ))}
                </View>
              );
            })()
          )}
        </ScrollView>
      )}

      {/* ─── Step 2: Client Selection ─── */}
      {step === 2 && (
        <View style={{ flex: 1, paddingHorizontal: hp }}>
          <View className="flex-row items-center justify-between mb-3">
            <Pressable
              onPress={() => setStep(1)}
              style={({ pressed }) => [{ opacity: pressed ? 0.5 : 1 }]}
            >
              <Text className="text-sm" style={{ color: colors.primary }}>
                ← Back
              </Text>
            </Pressable>
            <Text className="text-base font-semibold text-foreground">
              Select Client
            </Text>
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
                <Text className="text-sm font-semibold text-white">
                  Add & Continue
                </Text>
              </Pressable>
            </View>
          ) : (
            <TextInput
              className="bg-surface rounded-xl px-3 py-3 text-sm mb-3 border border-border"
              placeholder="Search clients..."
              placeholderTextColor={colors.muted}
              value={clientSearch}
              onChangeText={setClientSearch}
              style={{ color: colors.foreground }}
              returnKeyType="search"
            />
          )}

          <FlatList
            data={filteredClients}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <Pressable
                onPress={() => {
                  setSelectedClientId(item.id);
                  advanceAfterClient();
                }}
                style={({ pressed }) => [
                  styles.optionCard,
                  {
                    backgroundColor:
                      selectedClientId === item.id
                        ? colors.primary + "15"
                        : colors.surface,
                    borderColor:
                      selectedClientId === item.id
                        ? colors.primary
                        : colors.border,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <View
                  style={[
                    styles.avatar,
                    { backgroundColor: colors.primary + "20" },
                  ]}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: "700",
                      color: colors.primary,
                    }}
                  >
                    {getInitials(item.name)}
                  </Text>
                </View>
                <View style={styles.optionContent}>
                  <Text className="text-base font-semibold text-foreground">
                    {item.name}
                  </Text>
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
              </View>
            }
          />
        </View>
      )}

      {/* ─── Step 3: Location Selection (only if multiple locations) ─── */}
      {step === 3 && (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 40, paddingHorizontal: hp }}
        >
          <View className="flex-row items-center justify-between mb-4">
            <Pressable
              onPress={() => setStep(2)}
              style={({ pressed }) => [{ opacity: pressed ? 0.5 : 1 }]}
            >
              <Text className="text-sm" style={{ color: colors.primary }}>
                ← Back
              </Text>
            </Pressable>
            <Text className="text-base font-semibold text-foreground">
              Select Location
            </Text>
            <View style={{ width: 40 }} />
          </View>

          {/* Show locations that are open on the selected date */}
          {activeLocations.map((loc) => {
            const d = new Date(preselectedDate + "T12:00:00");
            const dayName = DAYS_OF_WEEK[d.getDay()];
            const locWH =
              loc.workingHours && Object.keys(loc.workingHours).length > 0
                ? (loc.workingHours as any)
                : state.settings.workingHours;
            const locCustom = (state as any).locationCustomSchedule?.[loc.id]?.find(
              (cs: any) => cs.date === preselectedDate
            );
            let isOpen = false;
            if (loc.temporarilyClosed) {
              isOpen = false;
            } else if (state.settings.scheduleMode === "custom") {
              isOpen = !!(locCustom?.isOpen);
            } else if (locCustom) {
              isOpen = locCustom.isOpen;
            } else {
              const wh = locWH?.[dayName];
              isOpen = !!(wh && wh.enabled);
            }

            let timeAvailable = true;
            if (preselectedTime && isOpen) {
              const locAppts = state.appointments.filter(
                (a) => a.locationId === loc.id
              );
              const locCustomSchedule =
                (state as any).locationCustomSchedule?.[loc.id] ?? [];
              const globalFallback = (state.customSchedule ?? []).filter(
                (cs) =>
                  !locCustomSchedule.some((lcs: any) => lcs.date === cs.date)
              );
              const mergedCustom = [...locCustomSchedule, ...globalFallback];
              const slots = generateAvailableSlots(
                preselectedDate,
                totalDuration,
                locWH,
                locAppts,
                effectiveStep,
                mergedCustom,
                state.settings.scheduleMode,
                state.settings.bufferTime ?? 0
              );
              timeAvailable = slots.includes(preselectedTime);
            }

            const isAvailable = isOpen && timeAvailable;
            const isSelected = selectedLocationId === loc.id;

            return (
              <Pressable
                key={loc.id}
                onPress={() => {
                  if (!isAvailable) return;
                  setSelectedLocationId(loc.id);
                  setStep(4);
                }}
                style={({ pressed }) => [
                  styles.optionCard,
                  {
                    backgroundColor: isSelected
                      ? colors.primary + "15"
                      : !isAvailable
                      ? colors.surface + "80"
                      : colors.surface,
                    borderColor: isSelected
                      ? colors.primary
                      : !isAvailable
                      ? colors.border + "60"
                      : colors.border,
                    opacity: !isAvailable ? 0.5 : pressed ? 0.7 : 1,
                  },
                ]}
              >
                {/* Location photo or map-pin icon */}
                {(loc as any).photoUri ? (
                  <Image
                    source={{ uri: (loc as any).photoUri }}
                    style={{ width: 44, height: 44, borderRadius: 10, marginRight: 12 }}
                  />
                ) : (
                  <View
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 10,
                      backgroundColor: isSelected ? colors.primary + "20" : colors.primary + "12",
                      alignItems: "center",
                      justifyContent: "center",
                      marginRight: 12,
                    }}
                  >
                    <IconSymbol name="location.fill" size={20} color={isSelected ? colors.primary : colors.muted} />
                  </View>
                )}
                <View style={styles.optionContent}>
                  <Text
                    className="text-base font-semibold"
                    style={{
                      color: isAvailable ? colors.foreground : colors.muted,
                    }}
                  >
                    {loc.name}
                  </Text>
                  {loc.address ? (
                    <Text className="text-xs text-muted mt-0.5" numberOfLines={1}>
                      {loc.address}
                    </Text>
                  ) : null}
                  {!isOpen && (
                    <Text
                      style={{
                        fontSize: 11,
                        color: colors.error,
                        marginTop: 2,
                        fontWeight: "600",
                      }}
                    >
                      Closed on this day
                    </Text>
                  )}
                  {isOpen && !timeAvailable && preselectedTime && (
                    <Text
                      style={{
                        fontSize: 11,
                        color: colors.warning,
                        marginTop: 2,
                        fontWeight: "600",
                      }}
                    >
                      {formatTimeDisplay(preselectedTime)} not available here
                    </Text>
                  )}
                </View>
                {isAvailable && (
                  <IconSymbol
                    name="chevron.right"
                    size={16}
                    color={colors.muted}
                  />
                )}
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      {/* ─── Step 4: Staff Selection ─── */}
      {step === 4 && (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 40, paddingHorizontal: hp }}
        >
          <View className="flex-row items-center justify-between mb-4">
            <Pressable
              onPress={() => {
                if (needsLocationStep) setStep(3);
                else setStep(2);
              }}
              style={({ pressed }) => [{ opacity: pressed ? 0.5 : 1 }]}
            >
              <Text className="text-sm" style={{ color: colors.primary }}>
                ← Back
              </Text>
            </Pressable>
            <Text className="text-base font-semibold text-foreground">
              Select Staff
            </Text>
            <View style={{ width: 40 }} />
          </View>

          {/* Skip option */}
          <Pressable
            onPress={() => {
              setSelectedStaffId(null);
              setStep(5);
            }}
            style={({ pressed }) => [
              styles.optionCard,
              {
                backgroundColor:
                  selectedStaffId === null ? colors.primary + "15" : colors.surface,
                borderColor:
                  selectedStaffId === null ? colors.primary : colors.border,
                opacity: pressed ? 0.7 : 1,
                marginBottom: 4,
              },
            ]}
          >
            <View
              style={[
                styles.avatar,
                { backgroundColor: colors.muted + "30" },
              ]}
            >
              <Text
                style={{ fontSize: 13, fontWeight: "700", color: colors.muted }}
              >
                Any
              </Text>
            </View>
            <View style={styles.optionContent}>
              <Text className="text-base font-semibold text-foreground">
                Any Available Staff
              </Text>
              <Text className="text-xs text-muted mt-0.5">
                No preference
              </Text>
            </View>
            <IconSymbol name="chevron.right" size={16} color={colors.muted} />
          </Pressable>

          {availableStaff.length === 0 ? (
            <View className="items-center py-8">
              <Text className="text-sm text-muted">No staff members found</Text>
            </View>
          ) : (
            availableStaff.map((member) => {
              const isAvailable = staffAvailabilityMap[member.id] !== false;
              const isSelected = selectedStaffId === member.id;
              return (
                <Pressable
                  key={member.id}
                  onPress={() => {
                    if (!isAvailable) return;
                    setSelectedStaffId(member.id);
                    setStep(5);
                  }}
                  style={({ pressed }) => [
                    styles.optionCard,
                    {
                      backgroundColor: isSelected
                        ? (member.color || colors.primary) + "15"
                        : !isAvailable
                        ? colors.surface + "80"
                        : colors.surface,
                      borderColor: isSelected
                        ? (member.color || colors.primary)
                        : !isAvailable
                        ? colors.border + "60"
                        : colors.border,
                      opacity: !isAvailable ? 0.5 : pressed ? 0.7 : 1,
                    },
                  ]}
                >
                  {/* Staff photo or initials avatar */}
                  <View style={{ position: "relative", marginRight: 12 }}>
                    <View
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 22,
                        backgroundColor: (member.color || colors.primary) + "20",
                        alignItems: "center",
                        justifyContent: "center",
                        overflow: "hidden",
                        borderWidth: isSelected ? 2 : 0,
                        borderColor: member.color || colors.primary,
                      }}
                    >
                      {member.photoUri ? (
                        <Image
                          source={{ uri: member.photoUri }}
                          style={{ width: 44, height: 44, borderRadius: 22 }}
                        />
                      ) : (
                        <Text
                          style={{
                            fontSize: 15,
                            fontWeight: "700",
                            color: member.color || colors.primary,
                          }}
                        >
                          {getInitials(member.name)}
                        </Text>
                      )}
                    </View>
                    {/* Availability dot */}
                    <View
                      style={{
                        position: "absolute",
                        bottom: 0,
                        right: 0,
                        width: 12,
                        height: 12,
                        borderRadius: 6,
                        backgroundColor: preselectedTime
                          ? isAvailable
                            ? colors.success
                            : colors.muted
                          : colors.border,
                        borderWidth: 2,
                        borderColor: colors.background,
                      }}
                    />
                  </View>
                  <View style={styles.optionContent}>
                    <Text
                      className="text-base font-semibold"
                      style={{
                        color: isAvailable ? colors.foreground : colors.muted,
                      }}
                    >
                      {member.name}
                    </Text>
                    {member.role ? (
                      <Text className="text-xs text-muted mt-0.5">{member.role}</Text>
                    ) : null}
                    {!isAvailable && preselectedTime && (
                      <Text
                        style={{
                          fontSize: 11,
                          color: colors.warning,
                          marginTop: 2,
                          fontWeight: "600",
                        }}
                      >
                        Busy at {formatTimeDisplay(preselectedTime)}
                      </Text>
                    )}
                  </View>
                  {isAvailable && (
                    <IconSymbol
                      name="chevron.right"
                      size={16}
                      color={colors.muted}
                    />
                  )}
                </Pressable>
              );
            })
          )}
        </ScrollView>
      )}

      {/* ─── Step 5: Review & Add More ─── */}
      {step === 5 && (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: hp, paddingBottom: 40 }}
        >
          <View className="flex-row items-center justify-between mb-3">
            <Pressable onPress={() => setStep(4)} style={({ pressed }) => [{ opacity: pressed ? 0.5 : 1 }]}>
              <Text className="text-sm" style={{ color: colors.primary }}>← Back</Text>
            </Pressable>
            <Text className="text-base font-semibold text-foreground">Review & Add More</Text>
            <View style={{ width: 40 }} />
          </View>

          {/* Cart Summary */}
          <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border, marginBottom: 16 }]}>
            <Text style={{ fontSize: 12, fontWeight: "600", color: colors.muted, marginBottom: 12 }}>Booking Items</Text>

            {/* Primary Service */}
            {selectedService && (
              <View style={styles.cartItem}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: selectedService.color, marginRight: 8 }} />
                    <Text style={{ fontSize: 14, fontWeight: "600", color: colors.foreground }}>{selectedService.name}</Text>
                  </View>
                  <Text style={{ fontSize: 12, color: colors.muted, marginLeft: 18 }}>{selectedService.duration} min</Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={{ fontSize: 14, fontWeight: "700", color: colors.primary }}>${servicePrice.toFixed(2)}</Text>
                  <Text style={{ fontSize: 10, color: colors.success, fontWeight: "600" }}>PRIMARY</Text>
                </View>
              </View>
            )}

            {/* Cart Items */}
            {cart.map((item, index) => (
              <View key={`${item.type}-${item.id}-${index}`} style={styles.cartItem}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: "600", color: colors.foreground }}>{item.name}</Text>
                  <Text style={{ fontSize: 12, color: colors.muted }}>
                    {item.type === "product" ? "Product" : `${item.duration} min`}
                  </Text>
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Text style={{ fontSize: 14, fontWeight: "700", color: colors.primary }}>${item.price.toFixed(2)}</Text>
                  <Pressable
                    onPress={() => removeFromCart(index)}
                    style={({ pressed }) => [{ opacity: pressed ? 0.5 : 1 }]}
                  >
                    <IconSymbol name="xmark" size={16} color={colors.error} />
                  </Pressable>
                </View>
              </View>
            ))}

            {/* Discount */}
            {appliedDiscount && discountAmount > 0 && (
              <>
                <View style={[styles.cartItem, { borderTopWidth: 1, borderTopColor: colors.border, marginTop: 4, paddingTop: 8 }]}>
                  <Text style={{ fontSize: 13, color: colors.muted }}>Subtotal</Text>
                  <Text style={{ fontSize: 13, color: colors.muted }}>${subtotal.toFixed(2)}</Text>
                </View>
                <View style={styles.cartItem}>
                  <Text style={{ fontSize: 13, fontWeight: "500", color: colors.warning }}>{appliedDiscount.name} ({appliedDiscount.percentage}% off)</Text>
                  <Text style={{ fontSize: 13, fontWeight: "500", color: colors.warning }}>-${discountAmount.toFixed(2)}</Text>
                </View>
              </>
            )}

            {/* Total */}
            <View style={[styles.cartItem, { borderTopWidth: 2, borderTopColor: colors.border, marginTop: 4, paddingTop: 10 }]}>
              <Text style={{ fontSize: 14, fontWeight: "700", color: colors.foreground }}>Total ({totalDuration} min)</Text>
              <Text style={{ fontSize: 16, fontWeight: "700", color: colors.primary }}>${totalPrice.toFixed(2)}</Text>
            </View>
          </View>

          {/* Add More Section */}
          <Text style={{ fontSize: 12, fontWeight: "600", color: colors.muted, marginBottom: 8, marginLeft: 2 }}>Add More (Optional)</Text>

          {/* Segmented Control */}
          <View style={[styles.segControl, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Pressable
              onPress={() => setAddMoreTab("services")}
              style={[styles.segBtn, addMoreTab === "services" && { backgroundColor: colors.primary }]}
            >
              <Text style={{ fontSize: 12, fontWeight: "600", color: addMoreTab === "services" ? "#FFF" : colors.muted }}>Services</Text>
            </Pressable>
            <Pressable
              onPress={() => setAddMoreTab("products")}
              style={[styles.segBtn, addMoreTab === "products" && { backgroundColor: colors.primary }]}
            >
              <Text style={{ fontSize: 12, fontWeight: "600", color: addMoreTab === "products" ? "#FFF" : colors.muted }}>Products</Text>
            </Pressable>
          </View>

          {/* Extra Services */}
          {addMoreTab === "services" && (
            <View style={{ marginBottom: 16 }}>
              {availableExtraServices.length === 0 ? (
                <View style={{ alignItems: "center", paddingVertical: 24, backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border }}>
                  <Text style={{ fontSize: 12, color: colors.muted }}>No additional services available</Text>
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
                        onPress={() => addToCart({ type: "service", id: s.id, name: s.name, price: parseFloat(String(s.price)), duration: s.duration })}
                        style={({ pressed }) => [styles.optionCard, { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.7 : 1 }]}
                      >
                        {s.photoUri ? (
                          <Image source={{ uri: s.photoUri }} style={{ width: 36, height: 36, borderRadius: 8, marginRight: 12 }} />
                        ) : (
                          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: s.color, marginRight: 12 }} />
                        )}
                        <View style={styles.optionContent}>
                          <Text style={{ fontSize: 14, fontWeight: "600", color: colors.foreground }}>{s.name}</Text>
                          <Text style={{ fontSize: 12, color: colors.muted }}>{s.duration} min{s.category ? " · " + s.category : ""}</Text>
                        </View>
                        <Text style={{ fontSize: 14, fontWeight: "700", color: colors.primary }}>+ ${parseFloat(String(s.price)).toFixed(2)}</Text>
                      </Pressable>
                    ))}
                  </View>
                );
              })()}
            </View>
          )}

          {/* Products */}
          {addMoreTab === "products" && (
            <View style={{ marginBottom: 16 }}>
              {availableProducts.length === 0 ? (
                <View style={{ alignItems: "center", paddingVertical: 24, backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border }}>
                  <Text style={{ fontSize: 12, color: colors.muted }}>No products available</Text>
                </View>
              ) : (() => {
                const allBrands = Array.from(new Set(availableProducts.map((p) => (p as any).brand?.trim() || "Other"))).sort();
                const hasMultiBrand = allBrands.length > 1;
                const filteredProds = addMoreBrandFilter
                  ? availableProducts.filter((p) => ((p as any).brand?.trim() || "Other") === addMoreBrandFilter)
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
                        onPress={() => addToCart({ type: "product", id: p.id, name: p.name, price: parseFloat(String(p.price)), duration: 0 })}
                        style={({ pressed }) => [styles.optionCard, { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.7 : 1 }]}
                      >
                        {(p as any).photoUri ? (
                          <Image source={{ uri: (p as any).photoUri }} style={{ width: 36, height: 36, borderRadius: 8, marginRight: 12 }} />
                        ) : (
                          <View style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: colors.primary + "18", alignItems: "center", justifyContent: "center", marginRight: 12 }}>
                            <IconSymbol name="bag.fill" size={18} color={colors.primary} />
                          </View>
                        )}
                        <View style={styles.optionContent}>
                          <Text style={{ fontSize: 14, fontWeight: "600", color: colors.foreground }}>{p.name}</Text>
                          {(p as any).brand ? <Text style={{ fontSize: 12, color: colors.muted }}>{(p as any).brand}{(p as any).description ? " · " + (p as any).description : ""}</Text> : null}
                        </View>
                        <Text style={{ fontSize: 14, fontWeight: "700", color: colors.primary }}>+ ${parseFloat(String(p.price)).toFixed(2)}</Text>
                      </Pressable>
                    ))}
                  </View>
                );
              })()}
            </View>
          )}

          {/* Continue to Payment */}
          <Pressable
            onPress={() => setStep(6)}
            style={({ pressed }) => [
              styles.confirmBtn,
              { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <Text style={{ color: "#FFF", fontSize: 16, fontWeight: "700" }}>Continue to Payment →</Text>
          </Pressable>
        </ScrollView>
      )}

      {/* ─── Step 6: Payment Method ─── */}
      {step === 6 && (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: hp, paddingBottom: 40 }}
        >
          <View className="flex-row items-center justify-between mb-3">
            <Pressable onPress={() => setStep(5)} style={({ pressed }) => [{ opacity: pressed ? 0.5 : 1 }]}>
              <Text className="text-sm" style={{ color: colors.primary }}>← Back</Text>
            </Pressable>
            <Text className="text-base font-semibold text-foreground">Payment Method</Text>
            <View style={{ width: 40 }} />
          </View>

          {/* Amount Due */}
          <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border, marginBottom: 16 }]}>
            <Text style={{ fontSize: 12, fontWeight: "600", color: colors.muted, marginBottom: 4 }}>Amount Due</Text>
            <Text style={{ fontSize: 28, fontWeight: "700", color: colors.primary }}>${totalPrice.toFixed(2)}</Text>
            {selectedService && (
              <Text style={{ fontSize: 12, color: colors.muted, marginTop: 4 }}>
                {selectedService.name}{cart.length > 0 ? ` + ${cart.length} extra item${cart.length > 1 ? "s" : ""}` : ""}
              </Text>
            )}
          </View>

          {/* Payment Options */}
          <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border, marginBottom: 16 }]}>
            <Text style={{ fontSize: 12, fontWeight: "600", color: colors.muted, marginBottom: 12 }}>How will the client pay?</Text>
            {(() => {
              const pm = state.settings;
              const opts: { id: string; label: string; sub: string; color: string }[] = [];
              if ((pm as any).zelleHandle) opts.push({ id: "zelle", label: "💜 Zelle", sub: (pm as any).zelleHandle, color: "#6d28d9" });
              if ((pm as any).cashAppHandle) opts.push({ id: "cashapp", label: "💚 Cash App", sub: (pm as any).cashAppHandle.startsWith("$") ? (pm as any).cashAppHandle : "$" + (pm as any).cashAppHandle, color: "#00d632" });
              if ((pm as any).venmoHandle) opts.push({ id: "venmo", label: "💙 Venmo", sub: (pm as any).venmoHandle.startsWith("@") ? (pm as any).venmoHandle : "@" + (pm as any).venmoHandle, color: "#3d95ce" });
              opts.push({ id: "cash", label: "💵 Cash", sub: "Collect in person", color: "#888" });
              return opts.map((opt) => (
                <Pressable
                  key={opt.id}
                  onPress={() => setSelectedPaymentMethod(opt.id)}
                  style={[{
                    flexDirection: "row", alignItems: "center", gap: 12,
                    padding: 14, borderRadius: 14, marginBottom: 8,
                    borderWidth: 2,
                    borderColor: selectedPaymentMethod === opt.id ? opt.color : colors.border,
                    backgroundColor: selectedPaymentMethod === opt.id ? opt.color + "18" : colors.background,
                  }]}
                >
                  <Text style={{ fontSize: 22 }}>{opt.label.split(" ")[0]}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: "600", fontSize: 14, color: colors.foreground }}>{opt.label.slice(opt.label.indexOf(" ") + 1)}</Text>
                    <Text style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>{opt.sub}</Text>
                  </View>
                  {selectedPaymentMethod === opt.id && (
                    <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: opt.color, alignItems: "center", justifyContent: "center" }}>
                      <Text style={{ color: "#fff", fontSize: 13, fontWeight: "700" }}>✓</Text>
                    </View>
                  )}
                </Pressable>
              ));
            })()}
          </View>

          {/* Continue to Confirm */}
          <Pressable
            onPress={() => {
              if (!selectedPaymentMethod) {
                Alert.alert("Payment Method", "Please select a payment method to continue.");
                return;
              }
              setStep(7);
            }}
            style={({ pressed }) => [
              styles.confirmBtn,
              { backgroundColor: selectedPaymentMethod ? colors.primary : colors.muted, opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <Text style={{ color: "#FFF", fontSize: 16, fontWeight: "700" }}>Continue →</Text>
          </Pressable>
        </ScrollView>
      )}

      {/* ─── Step 7: Confirm ─── */}
      {step === 7 && (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 40, paddingHorizontal: hp }}
        >
          <View className="flex-row items-center justify-between mb-4">
            <Pressable
              onPress={() => setStep(6)}
              style={({ pressed }) => [{ opacity: pressed ? 0.5 : 1 }]}
            >
              <Text className="text-sm" style={{ color: colors.primary }}>
                ← Back
              </Text>
            </Pressable>
            <Text className="text-base font-semibold text-foreground">
              Confirm Booking
            </Text>
            <View style={{ width: 40 }} />
          </View>

          {/* Summary card */}
          <View
            style={[
              styles.summaryCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text
              style={{
                fontSize: 13,
                fontWeight: "700",
                color: colors.muted,
                marginBottom: 12,
                textTransform: "uppercase",
                letterSpacing: 0.5,
              }}
            >
              Booking Summary
            </Text>

            <SummaryRow
              label="Date"
              value={formatDateDisplay(preselectedDate)}
              colors={colors}
            />
            {preselectedTime && (
              <SummaryRow
                label="Time"
                value={formatTimeDisplay(preselectedTime)}
                colors={colors}
              />
            )}
            {selectedService && (
              <SummaryRow
                label="Service"
                value={`${selectedService.name} (${totalDuration} min)`}
                colors={colors}
              />
            )}
            {cart.length > 0 && (
              <SummaryRow
                label="Extras"
                value={`${cart.length} item${cart.length > 1 ? "s" : ""} added`}
                colors={colors}
              />
            )}
            {selectedClient && (
              <SummaryRow
                label="Client"
                value={selectedClient.name}
                colors={colors}
              />
            )}
            {selectedLocation && (
              <SummaryRow
                label="Location"
                value={selectedLocation.name}
                colors={colors}
              />
            )}
            {selectedStaffId && (() => {
              const staff = state.staff.find((s) => s.id === selectedStaffId);
              return staff ? (
                <SummaryRow label="Staff" value={staff.name} colors={colors} />
              ) : null;
            })()}
            {selectedPaymentMethod && (
              <SummaryRow
                label="Payment"
                value={selectedPaymentMethod === "zelle" ? "Zelle" : selectedPaymentMethod === "cashapp" ? "Cash App" : selectedPaymentMethod === "venmo" ? "Venmo" : "Cash"}
                colors={colors}
              />
            )}

            {/* Divider */}
            <View
              style={{
                height: 1,
                backgroundColor: colors.border,
                marginVertical: 12,
              }}
            />

            {/* Pricing */}
            {servicePrice > 0 && (
              <>
                <SummaryRow
                  label="Service"
                  value={`$${servicePrice.toFixed(2)}`}
                  colors={colors}
                />
                {cart.length > 0 && (
                  <SummaryRow
                    label="Extras"
                    value={`$${cart.reduce((s, i) => s + i.price, 0).toFixed(2)}`}
                    colors={colors}
                  />
                )}
                {appliedDiscount && discountAmount > 0 && (
                  <SummaryRow
                    label={`Discount (${appliedDiscount.name})`}
                    value={`-$${discountAmount.toFixed(2)}`}
                    colors={colors}
                    valueColor={colors.success}
                  />
                )}
                <SummaryRow
                  label="Total"
                  value={`$${totalPrice.toFixed(2)}`}
                  colors={colors}
                  bold
                />
              </>
            )}
          </View>

          {/* Notes */}
          <View style={{ marginTop: 12 }}>
            <Text
              style={{
                fontSize: 13,
                fontWeight: "600",
                color: colors.foreground,
                marginBottom: 6,
              }}
            >
              Notes (optional)
            </Text>
            <TextInput
              multiline
              numberOfLines={3}
              placeholder="Add any notes..."
              placeholderTextColor={colors.muted}
              value={notes}
              onChangeText={setNotes}
              style={[
                styles.notesInput,
                {
                  color: colors.foreground,
                  borderColor: colors.border,
                  backgroundColor: colors.surface,
                },
              ]}
            />
          </View>

          {/* Confirm Button */}
          <Pressable
            onPress={handleBook}
            style={({ pressed }) => [
              styles.confirmBtn,
              { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <IconSymbol name="checkmark" size={18} color="#FFF" />
            <Text
              style={{
                color: "#FFF",
                fontSize: 16,
                fontWeight: "700",
                marginLeft: 8,
              }}
            >
              Confirm Booking
            </Text>
          </Pressable>

          {selectedClient?.phone && (
            <Text
              style={{
                fontSize: 12,
                color: colors.muted,
                textAlign: "center",
                marginTop: 8,
              }}
            >
              A confirmation SMS will be sent to {selectedClient.name}
            </Text>
          )}
        </ScrollView>
      )}
    </ScreenContainer>
  );
}

// Helper component for summary rows
function SummaryRow({
  label,
  value,
  colors,
  bold,
  valueColor,
}: {
  label: string;
  value: string;
  colors: any;
  bold?: boolean;
  valueColor?: string;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 8,
      }}
    >
      <Text
        style={{
          fontSize: 13,
          color: colors.muted,
          fontWeight: bold ? "700" : "400",
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          fontSize: 13,
          color: valueColor ?? colors.foreground,
          fontWeight: bold ? "700" : "500",
        }}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  optionCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
  },
  colorDot: {
    width: 36,
    height: 36,
    borderRadius: 18,
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
  primaryButton: {
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  summaryCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  notesInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: "top",
  },
  confirmBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 16,
    marginTop: 16,
    gap: 8,
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
