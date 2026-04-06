import {
  Text,
  View,
  Pressable,
  StyleSheet,
  TextInput,
  ScrollView,
  useWindowDimensions,
  Linking,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useStore, generateId, formatDateStr, formatTime, formatDateDisplay } from "@/lib/store";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useState, useMemo, useCallback } from "react";
import {
  Appointment,
  Client,
  DAYS_OF_WEEK,
  generateAvailableSlots,
  getServiceDisplayName,
  formatPhoneNumber,
  stripPhoneFormat,
  getMapUrl,
  minutesToTime,
  timeToMinutes,
  formatDateLong,
  formatTimeDisplay,
  isDateInPast,
  getApplicableDiscount,
  Discount,
} from "@/lib/types";

type BookingStep = "info" | "service" | "datetime" | "confirm" | "done";

export default function PublicBookingScreen() {
  const { state, dispatch, getServiceById, syncToDb } = useStore();
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
  const [giftCode, setGiftCode] = useState("");
  const [giftApplied, setGiftApplied] = useState<string | null>(null); // gift card id if applied

  const selectedService = selectedServiceId ? getServiceById(selectedServiceId) : null;
  const businessName = state.settings.businessName || "Our Business";
  const profile = state.settings.profile;
  const isClosed = state.settings.temporaryClosed;

  const handlePhoneChange = (text: string) => {
    setClientPhone(formatPhoneNumber(text));
  };

  // Generate available time slots using shared helper (with custom schedule)
  const timeSlots = useMemo(() => {
    const duration = selectedService?.duration ?? state.settings.defaultDuration;
    return generateAvailableSlots(
      selectedDate,
      duration,
      state.settings.workingHours,
      state.appointments,
      30,
      state.customSchedule
    );
  }, [selectedDate, state.settings, state.appointments, selectedService, state.customSchedule]);

  // Date options: next 30 days, only future dates — mark closed days
  const dateOptions = useMemo(() => {
    const dates: { date: string; closed: boolean }[] = [];
    const today = new Date();
    for (let i = 0; i < 30; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const ds = formatDateStr(d);
      // Check custom schedule override first
      const customDay = state.customSchedule.find((cs) => cs.date === ds);
      let closed = false;
      if (customDay) {
        closed = !customDay.isOpen;
      } else {
        // Fall back to weekly hours
        const dayIndex = d.getDay();
        const dayName = DAYS_OF_WEEK[dayIndex];
        const wh = state.settings.workingHours[dayName];
        closed = !wh || !wh.enabled;
      }
      dates.push({ date: ds, closed });
    }
    return dates;
  }, [state.customSchedule, state.settings.workingHours]);

  // Get applicable discount for selected time
  const applicableDiscount = useMemo((): Discount | null => {
    if (!selectedServiceId || !selectedTime) return null;
    return getApplicableDiscount(state.discounts, selectedDate, selectedTime, selectedServiceId);
  }, [state.discounts, selectedDate, selectedTime, selectedServiceId]);

  // Gift card validation
  const handleApplyGiftCode = useCallback(() => {
    if (!giftCode.trim()) return;
    const card = state.giftCards.find((g) => g.code.toUpperCase() === giftCode.trim().toUpperCase() && !g.redeemed);
    if (!card) {
      setGiftApplied(null);
      return;
    }
    // Check expiry
    if (card.expiresAt && new Date(card.expiresAt) < new Date()) {
      setGiftApplied(null);
      return;
    }
    setGiftApplied(card.id);
    // Auto-select the service from the gift card
    if (card.serviceLocalId) {
      setSelectedServiceId(card.serviceLocalId);
    }
  }, [giftCode, state.giftCards]);

  const appliedGiftCard = giftApplied ? state.giftCards.find((g) => g.id === giftApplied) : null;

  // Calculate final price
  const priceInfo = useMemo(() => {
    if (!selectedService) return { original: 0, final: 0, discountPct: 0, isGift: false };
    const original = selectedService.price;
    if (appliedGiftCard) {
      return { original, final: 0, discountPct: 100, isGift: true };
    }
    if (applicableDiscount) {
      const discounted = original * (1 - applicableDiscount.percentage / 100);
      return { original, final: Math.round(discounted * 100) / 100, discountPct: applicableDiscount.percentage, isGift: false };
    }
    return { original, final: original, discountPct: 0, isGift: false };
  }, [selectedService, applicableDiscount, appliedGiftCard]);

  const handleConfirmBooking = useCallback(() => {
    if (!selectedServiceId || !selectedTime || !clientName.trim()) return;

    const existingClient = state.clients.find(
      (c) => stripPhoneFormat(c.phone) === stripPhoneFormat(clientPhone) && stripPhoneFormat(clientPhone) !== ""
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
      syncToDb({ type: "ADD_CLIENT", payload: newClient });
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
    syncToDb({ type: "ADD_APPOINTMENT", payload: appointment });

    // Redeem gift card if applied
    if (appliedGiftCard) {
      const updatedGift = { ...appliedGiftCard, redeemed: true, redeemedAt: new Date().toISOString() };
      dispatch({ type: "UPDATE_GIFT_CARD", payload: updatedGift });
      syncToDb({ type: "UPDATE_GIFT_CARD", payload: updatedGift });
    }

    setStep("done");
  }, [selectedServiceId, selectedTime, clientName, clientPhone, clientEmail, notes, selectedDate, selectedService, state, dispatch, appliedGiftCard, syncToDb]);

  const openMap = useCallback(() => {
    if (profile.address) {
      Linking.openURL(getMapUrl(profile.address));
    }
  }, [profile.address]);

  const endTimeStr = useMemo(() => {
    if (!selectedTime || !selectedService) return "";
    return formatTimeDisplay(minutesToTime(timeToMinutes(selectedTime) + selectedService.duration));
  }, [selectedTime, selectedService]);

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]} className="pt-2" style={{ paddingHorizontal: hp }}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={({ pressed }) => [{ opacity: pressed ? 0.5 : 1 }]}>
          <IconSymbol name="chevron.left" size={24} color={colors.foreground} />
        </Pressable>
        <View style={{ flex: 1, alignItems: "center" }}>
          <Text style={{ fontSize: 18, fontWeight: "700", color: colors.foreground }}>Book with {businessName}</Text>
          <Text style={{ fontSize: 11, color: colors.muted, marginTop: 2 }}>Powered by Lime Of Time</Text>
        </View>
        <View style={{ width: 24 }} />
      </View>

      {/* Business Info Card */}
      <View style={[styles.bizInfoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={{ fontSize: 16, fontWeight: "700", color: colors.foreground }}>{businessName}</Text>
        {profile.address ? (
          <Pressable onPress={openMap} style={({ pressed }) => [styles.bizInfoRow, { opacity: pressed ? 0.6 : 1 }]}>
            <IconSymbol name="mappin" size={14} color={colors.primary} />
            <Text style={{ fontSize: 13, color: colors.primary, marginLeft: 8, flex: 1, textDecorationLine: "underline" }}>{profile.address}</Text>
          </Pressable>
        ) : null}
        {profile.phone ? (
          <View style={styles.bizInfoRow}>
            <IconSymbol name="phone.fill" size={14} color={colors.muted} />
            <Text style={{ fontSize: 13, color: colors.muted, marginLeft: 8 }}>{formatPhoneNumber(stripPhoneFormat(profile.phone))}</Text>
          </View>
        ) : null}
        {profile.email ? (
          <View style={styles.bizInfoRow}>
            <IconSymbol name="envelope.fill" size={14} color={colors.muted} />
            <Text style={{ fontSize: 13, color: colors.muted, marginLeft: 8 }}>{profile.email}</Text>
          </View>
        ) : null}
        {profile.website ? (
          <View style={styles.bizInfoRow}>
            <IconSymbol name="globe" size={14} color={colors.muted} />
            <Text style={{ fontSize: 13, color: colors.muted, marginLeft: 8 }}>{profile.website}</Text>
          </View>
        ) : null}
      </View>

      {/* Temporary Closed Banner */}
      {isClosed && (
        <View style={[styles.closedBanner, { backgroundColor: colors.error + "15", borderColor: colors.error + "30" }]}>
          <IconSymbol name="xmark.circle.fill" size={18} color={colors.error} />
          <Text style={{ fontSize: 14, fontWeight: "600", color: colors.error, marginLeft: 8 }}>
            {businessName} is temporarily closed
          </Text>
        </View>
      )}

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Closed message */}
        {isClosed && step === "info" && (
          <View style={{ alignItems: "center", paddingVertical: 40 }}>
            <Text style={{ fontSize: 16, color: colors.muted, textAlign: "center", lineHeight: 24 }}>
              {businessName} is not accepting bookings at this time. Please check back later.
            </Text>
          </View>
        )}

        {/* Step: Client Info */}
        {step === "info" && !isClosed && (
          <View>
            <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.iconRow}>
                <View style={[styles.iconCircle, { backgroundColor: colors.primary + "15" }]}>
                  <IconSymbol name="person.fill" size={22} color={colors.primary} />
                </View>
                <Text style={{ fontSize: 16, fontWeight: "600", color: colors.foreground, marginLeft: 12 }}>Your Information</Text>
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
                placeholder="(000) 000-0000"
                placeholderTextColor={colors.muted}
                value={clientPhone}
                onChangeText={handlePhoneChange}
                keyboardType="phone-pad"
                returnKeyType="next"
              />
              <TextInput
                style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground, marginBottom: 0 }]}
                placeholder="Email (optional)"
                placeholderTextColor={colors.muted}
                value={clientEmail}
                onChangeText={setClientEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                returnKeyType="done"
              />
            </View>

            <Pressable
              onPress={() => { if (clientName.trim()) setStep("service"); }}
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
            <Text style={{ fontSize: 16, fontWeight: "600", color: colors.foreground, marginBottom: 12 }}>Choose a Service</Text>
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
                  <Text style={{ fontSize: 15, fontWeight: "600", color: colors.foreground }}>{getServiceDisplayName(item)}</Text>
                  <Text style={{ fontSize: 13, color: colors.muted, marginTop: 2 }}>${item.price}</Text>
                </View>
                <IconSymbol name="chevron.right" size={16} color={colors.muted} />
              </Pressable>
            ))}
            {state.services.length === 0 && (
              <View style={{ alignItems: "center", paddingVertical: 32 }}>
                <Text style={{ fontSize: 14, color: colors.muted }}>No services available at this time</Text>
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
            <Text style={{ fontSize: 16, fontWeight: "600", color: colors.foreground, marginBottom: 12 }}>Pick a Date</Text>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
              <View style={styles.dateRow}>
                {dateOptions.map((opt) => {
                  const dateObj = new Date(opt.date + "T12:00:00");
                  const isSelected = opt.date === selectedDate;
                  const dayName = dateObj.toLocaleDateString("en-US", { weekday: "short" });
                  const dayNum = dateObj.getDate();
                  const isOff = opt.closed;
                  return (
                    <Pressable
                      key={opt.date}
                      onPress={() => {
                        if (!isOff) {
                          setSelectedDate(opt.date);
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
                      {isOff && <Text style={{ fontSize: 9, color: colors.error, fontWeight: "600" }}>OFF</Text>}
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>

            <Text style={{ fontSize: 16, fontWeight: "600", color: colors.foreground, marginBottom: 12 }}>Available Times</Text>
            {timeSlots.length === 0 ? (
              <View style={[styles.emptySlots, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={{ fontSize: 14, color: colors.muted }}>No available times for this date</Text>
                <Text style={{ fontSize: 12, color: colors.muted, marginTop: 4 }}>Try a different date</Text>
              </View>
            ) : (
              <View style={styles.timeGrid}>
                {timeSlots.map((t) => {
                  const isSelected = t === selectedTime;
                  const endT = minutesToTime(timeToMinutes(t) + (selectedService?.duration ?? state.settings.defaultDuration));
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
                      <Text style={{ fontSize: 10, color: isSelected ? "#FFFFFF99" : colors.muted, marginTop: 1 }}>to {formatTime(endT)}</Text>
                    </Pressable>
                  );
                })}
              </View>
            )}

            {/* Discount indicator */}
            {applicableDiscount && selectedTime && (
              <View style={[styles.discountBanner, { backgroundColor: "#FF9800" + "15", borderColor: "#FF9800" + "40" }]}>
                <Text style={{ fontSize: 13, fontWeight: "600", color: "#FF9800" }}>
                  {applicableDiscount.percentage}% OFF — {applicableDiscount.name}
                </Text>
                <Text style={{ fontSize: 12, color: "#FF9800", marginTop: 2 }}>
                  ${selectedService ? (selectedService.price * (1 - applicableDiscount.percentage / 100)).toFixed(2) : "0"} instead of ${selectedService?.price}
                </Text>
              </View>
            )}

            {/* Gift Card Code */}
            <Text style={{ fontSize: 12, fontWeight: "500", color: colors.muted, marginTop: 16, marginBottom: 6 }}>Gift Card Code (optional)</Text>
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
              <TextInput
                style={[styles.notesInput, { flex: 1, backgroundColor: colors.surface, borderColor: giftApplied ? colors.success : colors.border, color: colors.foreground }]}
                placeholder="Enter gift code..."
                placeholderTextColor={colors.muted}
                value={giftCode}
                onChangeText={(t) => { setGiftCode(t.toUpperCase()); setGiftApplied(null); }}
                autoCapitalize="characters"
                returnKeyType="done"
                onSubmitEditing={handleApplyGiftCode}
              />
              <Pressable
                onPress={handleApplyGiftCode}
                style={({ pressed }) => [{ backgroundColor: colors.primary, paddingHorizontal: 16, borderRadius: 12, justifyContent: "center", opacity: pressed ? 0.8 : 1 }]}
              >
                <Text style={{ color: "#fff", fontWeight: "600", fontSize: 13 }}>Apply</Text>
              </Pressable>
            </View>
            {giftApplied && appliedGiftCard && (
              <View style={[styles.discountBanner, { backgroundColor: colors.success + "15", borderColor: colors.success + "40" }]}>
                <Text style={{ fontSize: 13, fontWeight: "600", color: colors.success }}>Gift Card Applied!</Text>
                <Text style={{ fontSize: 12, color: colors.success, marginTop: 2 }}>
                  Free service: {state.services.find((s) => s.id === appliedGiftCard.serviceLocalId)?.name ?? "Service"}
                </Text>
              </View>
            )}

            {/* Notes */}
            <Text style={{ fontSize: 12, fontWeight: "500", color: colors.muted, marginTop: 16, marginBottom: 6 }}>Notes (optional)</Text>
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
              <Text style={{ fontSize: 18, fontWeight: "700", color: colors.foreground, marginBottom: 16 }}>Booking Summary</Text>

              {clientPhone ? (
                <View style={[styles.summaryRow, { borderBottomColor: colors.border + "40" }]}>
                  <Text style={{ fontSize: 14, color: colors.muted }}>Phone</Text>
                  <Text style={{ fontSize: 14, fontWeight: "600", color: colors.foreground }}>{clientPhone}</Text>
                </View>
              ) : null}
              <View style={[styles.summaryRow, { borderBottomColor: colors.border + "40" }]}>
                <Text style={{ fontSize: 14, color: colors.muted }}>Service</Text>
                <Text style={{ fontSize: 14, fontWeight: "600", color: colors.foreground }}>{selectedService ? getServiceDisplayName(selectedService) : ""}</Text>
              </View>
              <View style={[styles.summaryRow, { borderBottomColor: colors.border + "40" }]}>
                <Text style={{ fontSize: 14, color: colors.muted }}>Date</Text>
                <Text style={{ fontSize: 14, fontWeight: "600", color: colors.foreground }}>{formatDateDisplay(selectedDate)}</Text>
              </View>
              <View style={[styles.summaryRow, { borderBottomColor: colors.border + "40" }]}>
                <Text style={{ fontSize: 14, color: colors.muted }}>Time</Text>
                <Text style={{ fontSize: 14, fontWeight: "600", color: colors.foreground }}>
                  {selectedTime ? formatTime(selectedTime) : ""} - {endTimeStr}
                </Text>
              </View>
              <View style={[styles.summaryRow, { borderBottomColor: colors.border + "40" }]}>
                <Text style={{ fontSize: 14, color: colors.muted }}>Duration</Text>
                <Text style={{ fontSize: 14, fontWeight: "600", color: colors.foreground }}>{selectedService?.duration} min</Text>
              </View>
              <View style={[styles.summaryRow, { borderBottomWidth: 0 }]}>
                <Text style={{ fontSize: 14, color: colors.muted }}>Price</Text>
                <View style={{ alignItems: "flex-end" }}>
                  {priceInfo.discountPct > 0 && (
                    <Text style={{ fontSize: 12, textDecorationLine: "line-through", color: colors.muted }}>${priceInfo.original.toFixed(2)}</Text>
                  )}
                  <Text style={{ fontSize: 16, fontWeight: "700", color: priceInfo.isGift ? colors.success : colors.primary }}>
                    {priceInfo.isGift ? "FREE (Gift)" : `$${priceInfo.final.toFixed(2)}`}
                  </Text>
                  {priceInfo.discountPct > 0 && !priceInfo.isGift && (
                    <Text style={{ fontSize: 11, color: "#FF9800", fontWeight: "600" }}>{priceInfo.discountPct}% discount applied</Text>
                  )}
                </View>
              </View>

              {/* Business Location */}
              {profile.address ? (
                <Pressable onPress={openMap} style={({ pressed }) => [styles.locationRow, { backgroundColor: colors.primary + "08", borderColor: colors.primary + "20", opacity: pressed ? 0.7 : 1 }]}>
                  <IconSymbol name="mappin" size={16} color={colors.primary} />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={{ fontSize: 12, color: colors.muted }}>Location</Text>
                    <Text style={{ fontSize: 13, fontWeight: "500", color: colors.primary, textDecorationLine: "underline" }}>{profile.address}</Text>
                  </View>
                  <Text style={{ fontSize: 11, color: colors.primary }}>Open Map →</Text>
                </Pressable>
              ) : null}
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
            <Text style={{ fontSize: 24, fontWeight: "700", color: colors.foreground, marginTop: 20 }}>Booking Requested!</Text>
            <Text style={{ fontSize: 14, color: colors.muted, textAlign: "center", marginTop: 8, maxWidth: 280, lineHeight: 20 }}>
              Your appointment request with {businessName} has been submitted. The business owner will review and confirm your booking shortly.
            </Text>

            <View style={[styles.doneSummary, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={{ fontSize: 15, fontWeight: "600", color: colors.foreground }}>{selectedService ? getServiceDisplayName(selectedService) : ""}</Text>
              <Text style={{ fontSize: 14, color: colors.muted, marginTop: 4 }}>
                {formatDateDisplay(selectedDate)} at {selectedTime ? formatTime(selectedTime) : ""} - {endTimeStr}
              </Text>
              {profile.address ? (
                <Pressable onPress={openMap} style={({ pressed }) => [{ marginTop: 8, opacity: pressed ? 0.6 : 1 }]}>
                  <Text style={{ fontSize: 13, color: colors.primary, textDecorationLine: "underline" }}>📍 {profile.address}</Text>
                </Pressable>
              ) : null}
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
    marginBottom: 12,
    paddingVertical: 4,
  },
  bizInfoCard: {
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    marginBottom: 16,
  },
  bizInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
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
    alignItems: "center",
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
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 12,
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
  closedBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  discountBanner: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 12,
  },
});
