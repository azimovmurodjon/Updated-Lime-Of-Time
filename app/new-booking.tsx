import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useStore, generateId, formatDateStr, formatTime, formatDateDisplay } from "@/lib/store";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useState, useMemo, useCallback } from "react";
import { Appointment, Client, Product, Discount, DAYS_OF_WEEK, minutesToTime, timeToMinutes, getApplicableDiscount, generateConfirmationMessage, getServiceDisplayName, stripPhoneFormat, generateAvailableSlots } from "@/lib/types";

type Step = 1 | 2 | 3 | 4;

type CartItem = {
  type: "service" | "product";
  id: string;
  name: string;
  price: number;
  duration: number;
};

export default function NewBookingScreen() {
  const { state, dispatch, getServiceById, getClientById, syncToDb } = useStore();
  const colors = useColors();
  const router = useRouter();

  const [step, setStep] = useState<Step>(1);
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(formatDateStr(new Date()));
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
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(() => {
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
      if (!selectedServiceId) return true;
      if (!s.serviceIds || s.serviceIds.length === 0) return true;
      return s.serviceIds.includes(selectedServiceId);
    });
  }, [state.staff, selectedServiceId]);

  const selectedStaff = useMemo(() => {
    if (!selectedStaffId) return null;
    return state.staff.find((s) => s.id === selectedStaffId) ?? null;
  }, [state.staff, selectedStaffId]);

  const selectedService = selectedServiceId ? getServiceById(selectedServiceId) : null;
  const selectedClient = selectedClientId ? getClientById(selectedClientId) : null;

  const totalDuration = useMemo(() => {
    const baseDur = selectedService?.duration ?? state.settings.defaultDuration;
    return baseDur + cart.reduce((sum, item) => sum + item.duration, 0);
  }, [selectedService, cart, state.settings.defaultDuration]);

  const subtotal = useMemo(() => {
    const basePrice = selectedService ? parseFloat(String(selectedService.price)) : 0;
    return basePrice + cart.reduce((sum, item) => sum + item.price, 0);
  }, [selectedService, cart]);

  const appliedDiscount = useMemo(() => {
    if (!selectedServiceId || !selectedDate || !selectedTime) return null;
    return getApplicableDiscount(state.discounts, selectedDate, selectedTime, selectedServiceId);
  }, [state.discounts, selectedDate, selectedTime, selectedServiceId]);

  const discountAmount = useMemo(() => {
    if (!appliedDiscount || !selectedService) return 0;
    return parseFloat(String(selectedService.price)) * (appliedDiscount.percentage / 100);
  }, [appliedDiscount, selectedService]);

  const totalPrice = subtotal - discountAmount;

  // Generate available time slots using Business Hours logic
  const timeSlots = useMemo(() => {
    return generateAvailableSlots(
      selectedDate,
      totalDuration,
      state.settings.workingHours,
      state.appointments,
      30,
      undefined,
      "weekly",
      state.settings.bufferTime ?? 0
    );
  }, [selectedDate, state.settings.workingHours, state.appointments, totalDuration, state.settings.bufferTime]);

  // Date options: next 14 days with availability awareness
  const dateOptions = useMemo(() => {
    const dates: { date: string; closed: boolean; noSlots: boolean }[] = [];
    const today = new Date();
    for (let i = 0; i < 14; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const ds = formatDateStr(d);
      
      // Check if date is open using Business Hours
      const dayIndex = d.getDay();
      const dayName = DAYS_OF_WEEK[dayIndex];
      const wh = state.settings.workingHours[dayName];
      const closed = !wh || !wh.enabled;
      
      let noSlots = false;
      if (!closed) {
        const slots = generateAvailableSlots(ds, totalDuration, state.settings.workingHours, state.appointments, 30, undefined, "weekly", state.settings.bufferTime ?? 0);
        noSlots = slots.length === 0;
      }
      dates.push({ date: ds, closed, noSlots });
    }
    return dates;
  }, [state.settings.workingHours, state.appointments, totalDuration, state.settings.bufferTime]);

  const filteredClients = useMemo(() => {
    const q = clientSearch.toLowerCase();
    return state.clients.filter((c) =>
      c.name.toLowerCase().includes(q) || c.phone.includes(q)
    );
  }, [state.clients, clientSearch]);

  const handleQuickAddClient = async () => {
    if (!quickName.trim() || !quickPhone.trim()) {
      Alert.alert("Error", "Please enter name and phone");
      return;
    }
    const newClient: Client = {
      id: generateId(),
      name: quickName,
      phone: quickPhone,
      email: "",
      notes: "",
      createdAt: new Date().toISOString(),
    };
    dispatch({ type: "ADD_CLIENT", payload: newClient });
    await syncToDb({ type: "ADD_CLIENT", payload: newClient });
    setSelectedClientId(newClient.id);
    setShowQuickAdd(false);
    setQuickName("");
    setQuickPhone("");
  };

  const handleBook = async () => {
    if (!selectedServiceId || !selectedClientId || !selectedDate || !selectedTime) {
      Alert.alert("Error", "Please complete all fields");
      return;
    }

    // Validate time slot is still available by regenerating slots
    const currentSlots = generateAvailableSlots(
      selectedDate,
      totalDuration,
      state.settings.workingHours,
      state.appointments,
      30,
      undefined,
      "weekly",
      state.settings.bufferTime ?? 0
    );
    if (!currentSlots.includes(selectedTime)) {
      Alert.alert("Error", "This time slot is no longer available");
      return;
    }

    const appointment: Appointment = {
      id: generateId(),
      serviceId: selectedServiceId,
      clientId: selectedClientId,
      date: selectedDate,
      time: selectedTime,
      duration: totalDuration,
      status: "pending",
      notes,
      createdAt: new Date().toISOString(),
      totalPrice,
      extraItems: cart.length > 0 ? cart : undefined,
      staffId: selectedStaffId || undefined,
      locationId: selectedLocationId || undefined,
      discountPercent: appliedDiscount?.percentage,
      discountName: appliedDiscount?.name,
    };

    dispatch({ type: "ADD_APPOINTMENT", payload: appointment });
    await syncToDb({ type: "ADD_APPOINTMENT", payload: appointment });

    // Send SMS
    const client = selectedClient!;
    const service = selectedService!;
    const message = generateConfirmationMessage(
      state.settings.businessName,
      state.settings.profile?.address || "",
      client.name,
      service.name,
      service.duration,
      selectedDate,
      selectedTime,
      state.settings.profile?.phone || "",
      client.phone
    );

    if (Platform.OS !== "web") {
      try {
        const smsUrl = `sms:${stripPhoneFormat(client.phone)}?body=${encodeURIComponent(message)}`;
        await Linking.openURL(smsUrl);
      } catch (error) {
        console.error("Error opening SMS:", error);
      }
    }

    Alert.alert("Success", "Appointment created");
    router.back();
  };

  return (
    <ScreenContainer className="flex-1">
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Step Indicator */}
        <View className="flex-row justify-between mb-6">
          {[1, 2, 3, 4].map((s) => (
            <View
              key={s}
              className={`flex-1 h-1 mx-1 rounded ${
                s <= step ? "bg-primary" : "bg-border"
              }`}
            />
          ))}
        </View>

        {/* Step 1: Service Selection */}
        {step === 1 && (
          <View>
            <Text className="text-2xl font-bold text-foreground mb-4">Select Service</Text>
            <FlatList
              scrollEnabled={false}
              data={state.services}
              keyExtractor={(s) => s.id}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => {
                    setSelectedServiceId(item.id);
                    setStep(2);
                  }}
                  style={({ pressed }) => [
                    {
                      padding: 12,
                      marginBottom: 8,
                      borderRadius: 8,
                      backgroundColor:
                        selectedServiceId === item.id
                          ? colors.primary + "20"
                          : colors.surface,
                      borderWidth: 1,
                      borderColor:
                        selectedServiceId === item.id
                          ? colors.primary
                          : colors.border,
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}
                >
                  <Text className="font-semibold text-foreground">{item.name}</Text>
                  <Text className="text-sm text-muted mt-1">
                    {item.duration} min • ${item.price}
                  </Text>
                </Pressable>
              )}
            />
          </View>
        )}

        {/* Step 2: Date & Time Selection */}
        {step === 2 && (
          <View>
            <Text className="text-2xl font-bold text-foreground mb-4">Select Date & Time</Text>

            {/* Date Picker */}
            <Text className="text-sm font-semibold text-foreground mb-2">Date</Text>
            <FlatList
              scrollEnabled={false}
              data={dateOptions}
              keyExtractor={(d) => d.date}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => setSelectedDate(item.date)}
                  disabled={item.closed || item.noSlots}
                  style={({ pressed }) => [
                    {
                      padding: 12,
                      marginBottom: 8,
                      borderRadius: 8,
                      backgroundColor:
                        selectedDate === item.date
                          ? colors.primary + "20"
                          : colors.surface,
                      borderWidth: 1,
                      borderColor:
                        selectedDate === item.date
                          ? colors.primary
                          : colors.border,
                      opacity: item.closed || item.noSlots ? 0.5 : pressed ? 0.7 : 1,
                    },
                  ]}
                >
                  <Text
                    className={`font-semibold ${
                      item.closed || item.noSlots
                        ? "text-muted"
                        : "text-foreground"
                    }`}
                  >
                    {formatDateDisplay(item.date)}
                  </Text>
                  {item.closed && (
                    <Text className="text-xs text-error mt-1">Closed</Text>
                  )}
                  {item.noSlots && !item.closed && (
                    <Text className="text-xs text-warning mt-1">No available slots</Text>
                  )}
                </Pressable>
              )}
            />

            {/* Time Picker */}
            {!dateOptions.find((d) => d.date === selectedDate)?.closed && (
              <>
                <Text className="text-sm font-semibold text-foreground mb-2 mt-4">Time</Text>
                <FlatList
                  scrollEnabled={false}
                  data={timeSlots}
                  keyExtractor={(t) => t}
                  renderItem={({ item }) => (
                    <Pressable
                      onPress={() => setSelectedTime(item)}
                      style={({ pressed }) => [
                        {
                          paddingHorizontal: 12,
                          paddingVertical: 10,
                          marginRight: 8,
                          marginBottom: 8,
                          borderRadius: 8,
                          backgroundColor:
                            selectedTime === item
                              ? colors.primary
                              : colors.surface,
                          borderWidth: 1,
                          borderColor:
                            selectedTime === item
                              ? colors.primary
                              : colors.border,
                          opacity: pressed ? 0.7 : 1,
                        },
                      ]}
                    >
                      <Text
                        className={`font-semibold ${
                          selectedTime === item
                            ? "text-white"
                            : "text-foreground"
                        }`}
                      >
                        {formatTime(item)}
                      </Text>
                    </Pressable>
                  )}
                  numColumns={3}
                />
              </>
            )}

            <Pressable
              onPress={() => setStep(3)}
              disabled={!selectedDate || !selectedTime}
              style={({ pressed }) => [
                {
                  paddingVertical: 12,
                  borderRadius: 8,
                  backgroundColor: colors.primary,
                  marginTop: 20,
                  opacity: !selectedDate || !selectedTime || pressed ? 0.5 : 1,
                },
              ]}
            >
              <Text className="text-center text-white font-bold">Continue</Text>
            </Pressable>
          </View>
        )}

        {/* Step 3: Client & Notes */}
        {step === 3 && (
          <View>
            <Text className="text-2xl font-bold text-foreground mb-4">Client & Notes</Text>

            <Text className="text-sm font-semibold text-foreground mb-2">Select Client</Text>
            {!showQuickAdd && (
              <>
                <TextInput
                  placeholder="Search clients..."
                  value={clientSearch}
                  onChangeText={setClientSearch}
                  className="border border-border rounded-lg px-3 py-2 mb-3 text-foreground"
                  placeholderTextColor={colors.muted}
                />
                <FlatList
                  scrollEnabled={false}
                  data={filteredClients}
                  keyExtractor={(c) => c.id}
                  renderItem={({ item }) => (
                    <Pressable
                      onPress={() => setSelectedClientId(item.id)}
                      style={({ pressed }) => [
                        {
                          padding: 12,
                          marginBottom: 8,
                          borderRadius: 8,
                          backgroundColor:
                            selectedClientId === item.id
                              ? colors.primary + "20"
                              : colors.surface,
                          borderWidth: 1,
                          borderColor:
                            selectedClientId === item.id
                              ? colors.primary
                              : colors.border,
                          opacity: pressed ? 0.7 : 1,
                        },
                      ]}
                    >
                      <Text className="font-semibold text-foreground">{item.name}</Text>
                      <Text className="text-sm text-muted">{item.phone}</Text>
                    </Pressable>
                  )}
                />
                <Pressable
                  onPress={() => setShowQuickAdd(true)}
                  style={({ pressed }) => [
                    {
                      paddingVertical: 12,
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor: colors.primary,
                      marginTop: 12,
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}
                >
                  <Text className="text-center font-semibold" style={{ color: colors.primary }}>
                    + Add New Client
                  </Text>
                </Pressable>
              </>
            )}

            {showQuickAdd && (
              <View className="bg-surface p-4 rounded-lg border border-border mb-4">
                <TextInput
                  placeholder="Name"
                  value={quickName}
                  onChangeText={setQuickName}
                  className="border border-border rounded-lg px-3 py-2 mb-3 text-foreground"
                  placeholderTextColor={colors.muted}
                />
                <TextInput
                  placeholder="Phone"
                  value={quickPhone}
                  onChangeText={setQuickPhone}
                  className="border border-border rounded-lg px-3 py-2 mb-3 text-foreground"
                  placeholderTextColor={colors.muted}
                />
                <View className="flex-row gap-2">
                  <Pressable
                    onPress={handleQuickAddClient}
                    style={({ pressed }) => [
                      {
                        flex: 1,
                        paddingVertical: 10,
                        borderRadius: 8,
                        backgroundColor: colors.primary,
                        opacity: pressed ? 0.7 : 1,
                      },
                    ]}
                  >
                    <Text className="text-center text-white font-bold">Add</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setShowQuickAdd(false)}
                    style={({ pressed }) => [
                      {
                        flex: 1,
                        paddingVertical: 10,
                        borderRadius: 8,
                        borderWidth: 1,
                        borderColor: colors.border,
                        opacity: pressed ? 0.7 : 1,
                      },
                    ]}
                  >
                    <Text className="text-center text-foreground font-bold">Cancel</Text>
                  </Pressable>
                </View>
              </View>
            )}

            <Text className="text-sm font-semibold text-foreground mb-2 mt-4">Notes</Text>
            <TextInput
              placeholder="Add notes..."
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={4}
              className="border border-border rounded-lg px-3 py-2 text-foreground"
              placeholderTextColor={colors.muted}
            />

            <Pressable
              onPress={() => setStep(4)}
              disabled={!selectedClientId}
              style={({ pressed }) => [
                {
                  paddingVertical: 12,
                  borderRadius: 8,
                  backgroundColor: colors.primary,
                  marginTop: 20,
                  opacity: !selectedClientId || pressed ? 0.5 : 1,
                },
              ]}
            >
              <Text className="text-center text-white font-bold">Continue</Text>
            </Pressable>
          </View>
        )}

        {/* Step 4: Confirmation */}
        {step === 4 && (
          <View>
            <Text className="text-2xl font-bold text-foreground mb-4">Confirm Booking</Text>

            <View className="bg-surface p-4 rounded-lg border border-border mb-4">
              <View className="mb-3">
                <Text className="text-xs text-muted">Service</Text>
                <Text className="text-base font-semibold text-foreground">
                  {selectedService?.name}
                </Text>
              </View>
              <View className="mb-3">
                <Text className="text-xs text-muted">Client</Text>
                <Text className="text-base font-semibold text-foreground">
                  {selectedClient?.name}
                </Text>
              </View>
              <View className="mb-3">
                <Text className="text-xs text-muted">Date & Time</Text>
                <Text className="text-base font-semibold text-foreground">
                  {formatDateDisplay(selectedDate)} at {formatTime(selectedTime!)}
                </Text>
              </View>
              <View className="mb-3">
                <Text className="text-xs text-muted">Duration</Text>
                <Text className="text-base font-semibold text-foreground">
                  {totalDuration} minutes
                </Text>
              </View>
              {appliedDiscount && (
                <View className="mb-3">
                  <Text className="text-xs text-muted">Discount</Text>
                  <Text className="text-base font-semibold text-success">
                    {appliedDiscount.name} ({appliedDiscount.percentage}%)
                  </Text>
                </View>
              )}
              <View className="border-t border-border pt-3">
                <Text className="text-xs text-muted">Total Price</Text>
                <Text className="text-xl font-bold text-primary">
                  ${totalPrice.toFixed(2)}
                </Text>
              </View>
            </View>

            <Pressable
              onPress={handleBook}
              style={({ pressed }) => [
                {
                  paddingVertical: 14,
                  borderRadius: 8,
                  backgroundColor: colors.primary,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <Text className="text-center text-white font-bold text-base">
                Confirm Booking
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setStep(1)}
              style={({ pressed }) => [
                {
                  paddingVertical: 12,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: colors.border,
                  marginTop: 12,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <Text className="text-center text-foreground font-semibold">Start Over</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}
