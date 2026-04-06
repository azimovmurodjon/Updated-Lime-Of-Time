import {
  Text,
  View,
  Pressable,
  StyleSheet,
  TextInput,
  ScrollView,
  useWindowDimensions,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useStore, generateId, formatDateStr, formatTime, formatDateDisplay } from "@/lib/store";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useState, useMemo, useCallback } from "react";
import { Appointment, Client, DAYS_OF_WEEK, generateAvailableSlots } from "@/lib/types";

type BookingStep = "info" | "service" | "datetime" | "confirm" | "done";

export default function PublicBookingScreen() {
  const { state, dispatch, getServiceById } = useStore();
  const colors = useColors();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const hp = Math.max(16, width * 0.05);

  const [step, setStep] = useState<BookingStep>("info");
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(formatDateStr(new Date()));
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [notes, setNotes] = useState("");

  const selectedService = selectedServiceId ? getServiceById(selectedServiceId) : null;

  // Generate available time slots using shared helper (filters past times, overlapping bookings)
  const timeSlots = useMemo(() => {
    const duration = selectedService?.duration ?? state.settings.defaultDuration;
    return generateAvailableSlots(
      selectedDate,
      duration,
      state.settings.workingHours,
      state.appointments,
      30
    );
  }, [selectedDate, state.settings, state.appointments, selectedService]);

  // Date options: next 14 days
  const dateOptions = useMemo(() => {
    const dates: string[] = [];
    const today = new Date();
    for (let i = 0; i < 14; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      dates.push(formatDateStr(d));
    }
    return dates;
  }, []);

  const handleConfirmBooking = useCallback(() => {
    if (!selectedServiceId || !selectedTime || !clientName.trim()) return;

    // Create or find client
    const existingClient = state.clients.find(
      (c) => c.phone === clientPhone.trim() && clientPhone.trim() !== ""
    );
    let clientId: string;
    if (existingClient) {
      clientId = existingClient.id;
    } else {
      clientId = generateId();
      const newClient: Client = {
        id: clientId,
        name: clientName.trim(),
        phone: clientPhone.trim(),
        email: clientEmail.trim(),
        notes: "Added via booking link",
        createdAt: new Date().toISOString(),
      };
      dispatch({ type: "ADD_CLIENT", payload: newClient });
    }

    const appointment: Appointment = {
      id: generateId(),
      serviceId: selectedServiceId,
      clientId,
      date: selectedDate,
      time: selectedTime,
      duration: selectedService?.duration ?? state.settings.defaultDuration,
      status: "pending",
      notes: notes.trim(),
      createdAt: new Date().toISOString(),
    };
    dispatch({ type: "ADD_APPOINTMENT", payload: appointment });
    setStep("done");
  }, [selectedServiceId, selectedTime, clientName, clientPhone, clientEmail, notes, selectedDate, selectedService, state, dispatch]);

  const businessName = state.settings.businessName || "Our Business";

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]} className="pt-2" style={{ paddingHorizontal: hp }}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={({ pressed }) => [{ opacity: pressed ? 0.5 : 1 }]}>
          <IconSymbol name="chevron.left" size={24} color={colors.foreground} />
        </Pressable>
        <View style={{ flex: 1, alignItems: "center" }}>
          <Text className="text-lg font-bold text-foreground">Book with {businessName}</Text>
        </View>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Step: Client Info */}
        {step === "info" && (
          <View>
            <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.iconRow}>
                <View style={[styles.iconCircle, { backgroundColor: colors.primary + "15" }]}>
                  <IconSymbol name="person.fill" size={22} color={colors.primary} />
                </View>
                <Text className="text-base font-semibold text-foreground" style={{ marginLeft: 12 }}>Your Information</Text>
              </View>

              <TextInput
                style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
                placeholder="Full Name *"
                placeholderTextColor={colors.muted}
                value={clientName}
                onChangeText={setClientName}
                returnKeyType="next"
              />
              <TextInput
                style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
                placeholder="Phone Number"
                placeholderTextColor={colors.muted}
                value={clientPhone}
                onChangeText={setClientPhone}
                keyboardType="phone-pad"
                returnKeyType="next"
              />
              <TextInput
                style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground, marginBottom: 0 }]}
                placeholder="Email"
                placeholderTextColor={colors.muted}
                value={clientEmail}
                onChangeText={setClientEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                returnKeyType="done"
              />
            </View>

            <Pressable
              onPress={() => {
                if (clientName.trim()) setStep("service");
              }}
              style={({ pressed }) => [
                styles.continueButton,
                {
                  backgroundColor: clientName.trim() ? colors.primary : colors.muted,
                  opacity: pressed && clientName.trim() ? 0.8 : 1,
                },
              ]}
            >
              <Text style={styles.continueText}>Continue</Text>
            </Pressable>
          </View>
        )}

        {/* Step: Select Service */}
        {step === "service" && (
          <View>
            <Pressable onPress={() => setStep("info")} style={({ pressed }) => [{ opacity: pressed ? 0.5 : 1, marginBottom: 12 }]}>
              <Text style={{ color: colors.primary, fontSize: 14 }}>← Back</Text>
            </Pressable>
            <Text className="text-base font-semibold text-foreground" style={{ marginBottom: 12 }}>Choose a Service</Text>
            {state.services.map((item) => (
              <Pressable
                key={item.id}
                onPress={() => {
                  setSelectedServiceId(item.id);
                  setStep("datetime");
                }}
                style={({ pressed }) => [
                  styles.serviceOption,
                  {
                    backgroundColor: selectedServiceId === item.id ? item.color + "15" : colors.surface,
                    borderColor: selectedServiceId === item.id ? item.color : colors.border,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <View style={[styles.colorDot, { backgroundColor: item.color }]} />
                <View style={{ flex: 1 }}>
                  <Text className="text-base font-semibold text-foreground">{item.name}</Text>
                  <Text className="text-xs text-muted" style={{ marginTop: 2 }}>{item.duration} min · ${item.price}</Text>
                </View>
                <IconSymbol name="chevron.right" size={16} color={colors.muted} />
              </Pressable>
            ))}
            {state.services.length === 0 && (
              <View style={{ alignItems: "center", paddingVertical: 32 }}>
                <Text className="text-sm text-muted">No services available at this time</Text>
              </View>
            )}
          </View>
        )}

        {/* Step: Date & Time */}
        {step === "datetime" && (
          <View>
            <Pressable onPress={() => setStep("service")} style={({ pressed }) => [{ opacity: pressed ? 0.5 : 1, marginBottom: 12 }]}>
              <Text style={{ color: colors.primary, fontSize: 14 }}>← Back</Text>
            </Pressable>
            <Text className="text-base font-semibold text-foreground" style={{ marginBottom: 12 }}>Pick a Date</Text>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
              <View style={styles.dateRow}>
                {dateOptions.map((d) => {
                  const dateObj = new Date(d + "T12:00:00");
                  const isSelected = d === selectedDate;
                  const dayName = dateObj.toLocaleDateString("en-US", { weekday: "short" });
                  const dayNum = dateObj.getDate();
                  const dayOfWeek = DAYS_OF_WEEK[dateObj.getDay()];
                  const wh = state.settings.workingHours[dayOfWeek];
                  const isOff = !wh || !wh.enabled;
                  return (
                    <Pressable
                      key={d}
                      onPress={() => {
                        if (!isOff) {
                          setSelectedDate(d);
                          setSelectedTime(null);
                        }
                      }}
                      style={({ pressed }) => [
                        styles.dateChip,
                        {
                          backgroundColor: isSelected ? colors.primary : isOff ? colors.border + "30" : colors.surface,
                          borderColor: isSelected ? colors.primary : colors.border,
                          opacity: isOff ? 0.4 : pressed ? 0.7 : 1,
                        },
                      ]}
                    >
                      <Text style={{ fontSize: 11, fontWeight: "500", color: isSelected ? "#FFFFFF" : colors.muted }}>{dayName}</Text>
                      <Text style={{ fontSize: 18, fontWeight: "700", color: isSelected ? "#FFFFFF" : colors.foreground, lineHeight: 24 }}>{dayNum}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>

            <Text className="text-base font-semibold text-foreground" style={{ marginBottom: 12 }}>Available Times</Text>
            {timeSlots.length === 0 ? (
              <View style={[styles.emptySlots, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text className="text-sm text-muted">No available times for this date</Text>
                <Text className="text-xs text-muted" style={{ marginTop: 4 }}>Try a different date</Text>
              </View>
            ) : (
              <View style={styles.timeGrid}>
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
                      <Text style={{ fontSize: 14, fontWeight: "500", color: isSelected ? "#FFFFFF" : colors.foreground }}>{formatTime(t)}</Text>
                    </Pressable>
                  );
                })}
              </View>
            )}

            {/* Notes */}
            <Text className="text-xs font-medium text-muted" style={{ marginTop: 16, marginBottom: 6 }}>Notes (optional)</Text>
            <TextInput
              style={[styles.notesInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]}
              placeholder="Any special requests..."
              placeholderTextColor={colors.muted}
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={2}
            />

            <Pressable
              onPress={() => { if (selectedTime) setStep("confirm"); }}
              style={({ pressed }) => [
                styles.continueButton,
                {
                  backgroundColor: selectedTime ? colors.primary : colors.muted,
                  opacity: pressed && selectedTime ? 0.8 : 1,
                },
              ]}
            >
              <Text style={styles.continueText}>Review Booking</Text>
            </Pressable>
          </View>
        )}

        {/* Step: Confirm */}
        {step === "confirm" && (
          <View>
            <Pressable onPress={() => setStep("datetime")} style={({ pressed }) => [{ opacity: pressed ? 0.5 : 1, marginBottom: 12 }]}>
              <Text style={{ color: colors.primary, fontSize: 14 }}>← Back</Text>
            </Pressable>

            <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text className="text-lg font-bold text-foreground" style={{ marginBottom: 16 }}>Booking Summary</Text>

              <View style={styles.summaryRow}>
                <Text className="text-sm text-muted">Client</Text>
                <Text className="text-sm font-semibold text-foreground">{clientName}</Text>
              </View>
              {clientPhone ? (
                <View style={styles.summaryRow}>
                  <Text className="text-sm text-muted">Phone</Text>
                  <Text className="text-sm font-semibold text-foreground">{clientPhone}</Text>
                </View>
              ) : null}
              <View style={styles.summaryRow}>
                <Text className="text-sm text-muted">Service</Text>
                <Text className="text-sm font-semibold text-foreground">{selectedService?.name}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text className="text-sm text-muted">Date</Text>
                <Text className="text-sm font-semibold text-foreground">{formatDateDisplay(selectedDate)}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text className="text-sm text-muted">Time</Text>
                <Text className="text-sm font-semibold text-foreground">{selectedTime ? formatTime(selectedTime) : ""}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text className="text-sm text-muted">Duration</Text>
                <Text className="text-sm font-semibold text-foreground">{selectedService?.duration} min</Text>
              </View>
              <View style={[styles.summaryRow, { borderBottomWidth: 0 }]}>
                <Text className="text-sm text-muted">Price</Text>
                <Text className="text-base font-bold" style={{ color: colors.primary }}>${selectedService?.price}</Text>
              </View>
            </View>

            <Pressable
              onPress={handleConfirmBooking}
              style={({ pressed }) => [
                styles.continueButton,
                { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <Text style={styles.continueText}>Confirm Booking</Text>
            </Pressable>
          </View>
        )}

        {/* Step: Done */}
        {step === "done" && (
          <View style={styles.doneContainer}>
            <View style={[styles.checkCircle, { backgroundColor: colors.success + "15" }]}>
              <IconSymbol name="checkmark" size={36} color={colors.success} />
            </View>
            <Text className="text-2xl font-bold text-foreground" style={{ marginTop: 20 }}>Booking Requested!</Text>
            <Text className="text-sm text-muted text-center" style={{ marginTop: 8, maxWidth: 260, lineHeight: 20 }}>
              Your appointment request with {businessName} has been submitted. The business owner will review and confirm your booking shortly.
            </Text>

            <View style={[styles.doneSummary, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text className="text-sm font-semibold text-foreground">{selectedService?.name}</Text>
              <Text className="text-sm text-muted" style={{ marginTop: 4 }}>
                {formatDateDisplay(selectedDate)} at {selectedTime ? formatTime(selectedTime) : ""}
              </Text>
            </View>

            <Pressable
              onPress={() => router.back()}
              style={({ pressed }) => [
                styles.continueButton,
                { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <Text style={styles.continueText}>Done</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
    paddingVertical: 4,
  },
  sectionCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    marginBottom: 20,
  },
  iconRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  input: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    marginBottom: 10,
    borderWidth: 1,
  },
  continueButton: {
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
    marginTop: 8,
  },
  continueText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  serviceOption: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
  },
  colorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  dateRow: {
    flexDirection: "row",
    gap: 8,
  },
  dateChip: {
    width: 56,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
  },
  timeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  timeChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  emptySlots: {
    alignItems: "center",
    paddingVertical: 24,
    borderRadius: 16,
    borderWidth: 1,
  },
  notesInput: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    borderWidth: 1,
    minHeight: 50,
    textAlignVertical: "top",
    marginBottom: 8,
  },
  summaryCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB20",
  },
  doneContainer: {
    alignItems: "center",
    paddingVertical: 40,
  },
  checkCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  doneSummary: {
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    marginTop: 24,
    marginBottom: 16,
    alignSelf: "stretch",
    alignItems: "center",
  },
});
