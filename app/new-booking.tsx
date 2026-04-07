import {
  Text,
  View,
  Pressable,
  StyleSheet,
  TextInput,
  FlatList,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useStore, generateId, formatDateStr, formatTime, formatDateDisplay } from "@/lib/store";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useState, useMemo, useCallback } from "react";
import { Appointment, Client, DAYS_OF_WEEK, generateAvailableSlots, minutesToTime, timeToMinutes } from "@/lib/types";

type Step = 1 | 2 | 3;

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

  const selectedService = selectedServiceId ? getServiceById(selectedServiceId) : null;
  const selectedClient = selectedClientId ? getClientById(selectedClientId) : null;
  const duration = selectedService?.duration ?? state.settings.defaultDuration;

  // Generate available time slots using the shared helper (with custom schedule)
  const timeSlots = useMemo(() => {
    return generateAvailableSlots(
      selectedDate,
      duration,
      state.settings.workingHours,
      state.appointments,
      30,
      state.customSchedule
    );
  }, [selectedDate, state.settings.workingHours, state.appointments, duration, state.customSchedule]);

  // Date options: next 14 days with closed-day and no-slots awareness
  const dateOptions = useMemo(() => {
    const dates: { date: string; closed: boolean; noSlots: boolean }[] = [];
    const today = new Date();
    for (let i = 0; i < 14; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const ds = formatDateStr(d);
      const customDay = state.customSchedule.find((cs) => cs.date === ds);
      let closed = false;
      if (customDay) {
        closed = !customDay.isOpen;
      } else {
        const dayIndex = d.getDay();
        const dayName = DAYS_OF_WEEK[dayIndex];
        const wh = state.settings.workingHours[dayName];
        closed = !wh || !wh.enabled;
      }
      let noSlots = false;
      if (!closed) {
        const slots = generateAvailableSlots(ds, duration, state.settings.workingHours, state.appointments, 30, state.customSchedule);
        noSlots = slots.length === 0;
      }
      dates.push({ date: ds, closed, noSlots });
    }
    return dates;
  }, [state.customSchedule, state.settings.workingHours, state.appointments, duration]);

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

  const handleBook = useCallback(() => {
    if (!selectedServiceId || !selectedClientId || !selectedTime) return;
    const appointment: Appointment = {
      id: generateId(),
      serviceId: selectedServiceId,
      clientId: selectedClientId,
      date: selectedDate,
      time: selectedTime,
      duration,
      status: "confirmed",
      notes: notes.trim(),
      createdAt: new Date().toISOString(),
    };
    dispatch({ type: "ADD_APPOINTMENT", payload: appointment });
    syncToDb({ type: "ADD_APPOINTMENT", payload: appointment });
    router.back();
  }, [selectedServiceId, selectedClientId, selectedDate, selectedTime, duration, notes, dispatch, router]);

  const getInitials = (name: string) => {
    const parts = name.split(" ");
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  const getEndTime = (time: string) => {
    return formatTime(minutesToTime(timeToMinutes(time) + duration));
  };

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]} className="p-5">
      {/* Header */}
      <View className="flex-row items-center justify-between mb-2" style={{ paddingTop: 8 }}>
        <View className="flex-row items-center">
          <Pressable onPress={() => router.back()} style={({ pressed }) => [{ opacity: pressed ? 0.5 : 1 }]}>
            <IconSymbol name="xmark" size={24} color={colors.foreground} />
          </Pressable>
          <Text className="text-xl font-bold text-foreground ml-4">New Booking</Text>
        </View>
        <Text className="text-sm text-muted">Step {step}/3</Text>
      </View>

      {/* Progress Bar */}
      <View className="flex-row gap-2 mb-5">
        {[1, 2, 3].map((s) => (
          <View
            key={s}
            className="flex-1 h-1 rounded-full"
            style={{ backgroundColor: s <= step ? colors.primary : colors.border }}
          />
        ))}
      </View>

      {/* Step 1: Select Service */}
      {step === 1 && (
        <FlatList
          data={state.services}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <Text className="text-base font-semibold text-foreground mb-3">Select a Service</Text>
          }
          renderItem={({ item }) => (
            <Pressable
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
          )}
          ListEmptyComponent={
            <View className="items-center py-12">
              <Text className="text-base text-muted">No services available</Text>
              <Text className="text-sm text-muted mt-1">Create a service first</Text>
            </View>
          }
          contentContainerStyle={{ paddingBottom: 40 }}
        />
      )}

      {/* Step 2: Select Client */}
      {step === 2 && (
        <View className="flex-1">
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
                  returnKeyType="done"
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
                        backgroundColor: selectedClientId === item.id ? colors.primary + "10" : colors.surface,
                        borderColor: selectedClientId === item.id ? colors.primary : colors.border,
                        opacity: pressed ? 0.7 : 1,
                      },
                    ]}
                  >
                    <View style={[styles.avatar, { backgroundColor: colors.primary + "20" }]}>
                      <Text className="text-xs font-bold" style={{ color: colors.primary }}>
                        {getInitials(item.name)}
                      </Text>
                    </View>
                    <View style={styles.optionContent}>
                      <Text className="text-base font-semibold text-foreground">{item.name}</Text>
                      {item.phone ? <Text className="text-xs text-muted">{item.phone}</Text> : null}
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
        <ScrollView showsVerticalScrollIndicator={false}>
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

          {/* Summary */}
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
                </Text>
              </View>
              <Text className="text-sm text-muted">
                {selectedClient?.name} · {formatDateDisplay(selectedDate)}
              </Text>
              <Text className="text-sm text-muted">
                {formatTime(selectedTime)} - {getEndTime(selectedTime)} ({duration} min)
              </Text>
              <Text className="text-sm text-muted">${selectedService?.price}</Text>
            </View>
          )}

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
            <Text className="text-base font-semibold text-white">Confirm Booking</Text>
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
});
