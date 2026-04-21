/**
 * Client Portal — Booking Wizard
 *
 * 5-step native booking flow:
 * 1. Service selection (pre-selected if coming from service card)
 * 2. Staff selection (or "Any available")
 * 3. Date picker
 * 4. Time slot picker
 * 5. Confirm & notes
 */
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  Alert,
  Platform,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useClientStore } from "@/lib/client-store";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { getApiBaseUrl } from "@/constants/oauth";
import * as Haptics from "expo-haptics";
import { FuturisticBackground } from "@/components/futuristic-background";

const LIME_GREEN = "#4A7C59";

interface PublicService {
  localId: string;
  name: string;
  duration: number;
  price: string | null;
  description: string | null;
}
interface PublicStaff {
  localId: string;
  name: string;
  role: string | null;
  photoUri: string | null;
  serviceIds: string[];
}
interface AvailableSlot {
  time: string;
}

const STEPS = ["Service", "Staff", "Date", "Time", "Confirm"];

function formatPrice(price: string | null): string {
  if (price == null) return "Price varies";
  const n = parseFloat(price);
  return isNaN(n) ? "Price varies" : `$${n.toFixed(2)}`;
}
function getDaysInMonth(year: number, month: number): Date[] {
  const days: Date[] = [];
  const date = new Date(year, month, 1);
  while (date.getMonth() === month) {
    days.push(new Date(date));
    date.setDate(date.getDate() + 1);
  }
  return days;
}
function formatDateLabel(d: Date): string {
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

export default function ClientBookingWizardScreen() {
  const colors = useColors();
  const router = useRouter();
  const { slug, serviceLocalId } = useLocalSearchParams<{ slug: string; serviceLocalId?: string }>();
  const { state } = useClientStore();
  const apiBase = getApiBaseUrl();

  const [step, setStep] = useState(0);
  const [services, setServices] = useState<PublicService[]>([]);
  const [staff, setStaff] = useState<PublicStaff[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [selectedService, setSelectedService] = useState<PublicService | null>(null);
  const [selectedStaffId, setSelectedStaffId] = useState<string>("any");
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<AvailableSlot | null>(null);
  const [notes, setNotes] = useState("");
  const [slots, setSlots] = useState<AvailableSlot[]>([]);

  const today = new Date();
  const [calYear, setCalYear] = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth());

  // Load services and staff from separate public endpoints
  useEffect(() => {
    (async () => {
      try {
        const [svcRes, staffRes] = await Promise.all([
          fetch(`${apiBase}/api/public/business/${slug}/services`),
          fetch(`${apiBase}/api/public/business/${slug}/staff`),
        ]);
        const svcData = svcRes.ok ? await svcRes.json() : [];
        const staffData = staffRes.ok ? await staffRes.json() : [];
        const svcList: PublicService[] = Array.isArray(svcData) ? svcData : [];
        const staffList: PublicStaff[] = Array.isArray(staffData) ? staffData : [];
        setServices(svcList);
        setStaff(staffList);
        if (serviceLocalId) {
          const found = svcList.find((s) => s.localId === serviceLocalId);
          if (found) {
            setSelectedService(found);
            setStep(1);
          }
        }
      } catch (err) {
        console.warn("[BookingWizard] load error:", err);
      } finally {
        setLoadingData(false);
      }
    })();
  }, [slug, serviceLocalId, apiBase]);

  // Load slots using /api/public/business/:slug/slots
  useEffect(() => {
    if (!selectedDate || !selectedService) return;
    (async () => {
      setLoadingSlots(true);
      setSlots([]);
      setSelectedSlot(null);
      try {
        const dateStr = selectedDate.toISOString().split("T")[0];
        const staffParam = selectedStaffId !== "any" ? `&staffId=${encodeURIComponent(selectedStaffId)}` : "";
        const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
        const clientToday = new Date().toISOString().split("T")[0];
        const url = `${apiBase}/api/public/business/${slug}/slots?date=${dateStr}&duration=${selectedService.duration}${staffParam}&clientToday=${clientToday}&nowMinutes=${nowMinutes}`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          const rawSlots: string[] = data.slots ?? [];
          setSlots(rawSlots.map((t) => ({ time: t })));
        }
      } catch (err) {
        console.warn("[BookingWizard] slots error:", err);
      } finally {
        setLoadingSlots(false);
      }
    })();
  }, [selectedDate, selectedService, selectedStaffId, slug, apiBase]);

  const handleNext = () => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };
  const handleBack = () => {
    if (step === 0) { router.back(); return; }
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setStep((s) => Math.max(s - 1, 0));
  };

  const handleSubmit = async () => {
    if (!selectedService || !selectedDate || !selectedSlot) return;
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setSubmitting(true);
    try {
      const dateStr = selectedDate.toISOString().split("T")[0];
      const clientName = state.account?.name ?? "Guest";
      const clientEmail = state.account?.email ?? undefined;
      // Normalize phone: strip non-digits, add country code if needed
      const rawPhone = state.account?.phone ?? "";
      const clientPhone = rawPhone.startsWith("oauth:") ? undefined : rawPhone || undefined;
      const res = await fetch(`${apiBase}/api/public/business/${slug}/book`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientName,
          clientEmail,
          clientPhone,
          serviceLocalId: selectedService.localId,
          date: dateStr,
          time: selectedSlot.time,
          duration: selectedService.duration,
          notes: notes.trim() || null,
          staffId: selectedStaffId !== "any" ? selectedStaffId : undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Booking failed" }));
        throw new Error((err as any).error ?? `HTTP ${res.status}`);
      }
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const selectedStaffMember = selectedStaffId !== "any" ? staff.find((m) => m.localId === selectedStaffId) : null;
      router.replace({
        pathname: "/client-booking-confirmation",
        params: {
          serviceName: selectedService.name,
          staffName: selectedStaffMember?.name ?? "",
          date: dateStr,
          time: selectedSlot.time,
          duration: String(selectedService.duration),
          businessName: slug,
          businessSlug: slug,
          price: selectedService.price ?? "",
        },
      } as any);
    } catch (err: any) {
      Alert.alert("Booking Failed", err?.message ?? "Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const s = styles(colors);

  if (loadingData) {
    return (
      <ScreenContainer>
        <FuturisticBackground />
        <View style={s.loadingContainer}>
          <ActivityIndicator color={LIME_GREEN} size="large" />
          <Text style={{ color: colors.muted, marginTop: 12 }}>Loading...</Text>
        </View>
      </ScreenContainer>
    );
  }

  const calDays = getDaysInMonth(calYear, calMonth);
  const monthLabel = new Date(calYear, calMonth, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const eligibleStaff = selectedService
    ? staff.filter((m) => !m.serviceIds?.length || m.serviceIds.includes(selectedService.localId))
    : staff;

  return (
    <ScreenContainer>
      <FuturisticBackground />
      {/* Header */}
      <View style={s.header}>
        <Pressable style={({ pressed }) => [s.backBtn, pressed && { opacity: 0.7 }]} onPress={handleBack}>
          <IconSymbol name="chevron.left" size={20} color={colors.foreground} />
        </Pressable>
        <Text style={[s.headerTitle, { color: colors.foreground }]}>Book Appointment</Text>
        <View style={{ width: 32 }} />
      </View>
      {/* Step indicator */}
      <View style={s.stepIndicator}>
        {STEPS.map((label, i) => (
          <View key={i} style={s.stepItem}>
            <View style={[s.stepDot, { backgroundColor: i <= step ? LIME_GREEN : colors.border }]}>
              {i < step ? (
                <IconSymbol name="checkmark" size={12} color="#FFFFFF" />
              ) : (
                <Text style={{ color: i <= step ? "#FFFFFF" : colors.muted, fontSize: 11, fontWeight: "700" }}>{i + 1}</Text>
              )}
            </View>
            {i < STEPS.length - 1 && (
              <View style={[s.stepLine, { backgroundColor: i < step ? LIME_GREEN : colors.border }]} />
            )}
          </View>
        ))}
      </View>
      <Text style={[s.stepLabel, { color: LIME_GREEN }]}>{STEPS[step]}</Text>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        {/* Step 0: Service */}
        {step === 0 && (
          <View style={s.stepContent}>
            <Text style={[s.stepTitle, { color: colors.foreground }]}>Choose a Service</Text>
            {services.length === 0 ? (
              <Text style={{ color: colors.muted, textAlign: "center", marginTop: 24 }}>No services available.</Text>
            ) : services.map((svc) => (
              <Pressable
                key={svc.localId}
                style={({ pressed }) => [
                  s.optionCard,
                  { backgroundColor: colors.surface, borderColor: selectedService?.localId === svc.localId ? LIME_GREEN : colors.border },
                  selectedService?.localId === svc.localId && { borderWidth: 2 },
                  pressed && { opacity: 0.85 },
                ]}
                onPress={() => {
                  if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setSelectedService(svc);
                  setSelectedStaffId("any");
                  setSelectedDate(null);
                  setSelectedSlot(null);
                }}
              >
                <View style={s.optionLeft}>
                  <Text style={[s.optionName, { color: colors.foreground }]}>{svc.name}</Text>
                  {svc.description ? <Text style={[s.optionDesc, { color: colors.muted }]} numberOfLines={2}>{svc.description}</Text> : null}
                  <Text style={[s.optionMeta, { color: LIME_GREEN }]}>{svc.duration} min · {formatPrice(svc.price)}</Text>
                </View>
                {selectedService?.localId === svc.localId && (
                  <View style={[s.checkCircle, { backgroundColor: LIME_GREEN }]}>
                    <IconSymbol name="checkmark" size={14} color="#FFFFFF" />
                  </View>
                )}
              </Pressable>
            ))}
          </View>
        )}

        {/* Step 1: Staff */}
        {step === 1 && (
          <View style={s.stepContent}>
            <Text style={[s.stepTitle, { color: colors.foreground }]}>Choose a Staff Member</Text>
            <Pressable
              style={({ pressed }) => [
                s.optionCard,
                { backgroundColor: colors.surface, borderColor: selectedStaffId === "any" ? LIME_GREEN : colors.border },
                selectedStaffId === "any" && { borderWidth: 2 },
                pressed && { opacity: 0.85 },
              ]}
              onPress={() => setSelectedStaffId("any")}
            >
              <View style={[s.staffAvatar, { backgroundColor: `${LIME_GREEN}20` }]}>
                <IconSymbol name="person.3.fill" size={20} color={LIME_GREEN} />
              </View>
              <View style={s.optionLeft}>
                <Text style={[s.optionName, { color: colors.foreground }]}>Any Available</Text>
                <Text style={[s.optionDesc, { color: colors.muted }]}>First available staff member</Text>
              </View>
              {selectedStaffId === "any" && (
                <View style={[s.checkCircle, { backgroundColor: LIME_GREEN }]}>
                  <IconSymbol name="checkmark" size={14} color="#FFFFFF" />
                </View>
              )}
            </Pressable>
            {eligibleStaff.map((member) => (
              <Pressable
                key={member.localId}
                style={({ pressed }) => [
                  s.optionCard,
                  { backgroundColor: colors.surface, borderColor: selectedStaffId === member.localId ? LIME_GREEN : colors.border },
                  selectedStaffId === member.localId && { borderWidth: 2 },
                  pressed && { opacity: 0.85 },
                ]}
                onPress={() => setSelectedStaffId(member.localId)}
              >
                <View style={[s.staffAvatar, { backgroundColor: `${LIME_GREEN}20` }]}>
                  <Text style={{ fontSize: 16, fontWeight: "700", color: LIME_GREEN }}>{member.name.charAt(0)}</Text>
                </View>
                <View style={s.optionLeft}>
                  <Text style={[s.optionName, { color: colors.foreground }]}>{member.name}</Text>
                  {member.role ? <Text style={[s.optionDesc, { color: colors.muted }]}>{member.role}</Text> : null}
                </View>
                {selectedStaffId === member.localId && (
                  <View style={[s.checkCircle, { backgroundColor: LIME_GREEN }]}>
                    <IconSymbol name="checkmark" size={14} color="#FFFFFF" />
                  </View>
                )}
              </Pressable>
            ))}
          </View>
        )}

        {/* Step 2: Date */}
        {step === 2 && (
          <View style={s.stepContent}>
            <Text style={[s.stepTitle, { color: colors.foreground }]}>Pick a Date</Text>
            <View style={s.monthNav}>
              <Pressable
                style={({ pressed }) => [s.monthBtn, pressed && { opacity: 0.7 }]}
                onPress={() => { if (calMonth === 0) { setCalMonth(11); setCalYear((y) => y - 1); } else setCalMonth((m) => m - 1); }}
              >
                <IconSymbol name="chevron.left" size={18} color={colors.foreground} />
              </Pressable>
              <Text style={[s.monthLabel, { color: colors.foreground }]}>{monthLabel}</Text>
              <Pressable
                style={({ pressed }) => [s.monthBtn, pressed && { opacity: 0.7 }]}
                onPress={() => { if (calMonth === 11) { setCalMonth(0); setCalYear((y) => y + 1); } else setCalMonth((m) => m + 1); }}
              >
                <IconSymbol name="chevron.right" size={18} color={colors.foreground} />
              </Pressable>
            </View>
            <View style={s.dayHeaders}>
              {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                <Text key={i} style={[s.dayHeader, { color: colors.muted }]}>{d}</Text>
              ))}
            </View>
            <View style={s.calGrid}>
              {Array.from({ length: new Date(calYear, calMonth, 1).getDay() }).map((_, i) => (
                <View key={`empty-${i}`} style={s.calCell} />
              ))}
              {calDays.map((day) => {
                const isPast = day < new Date(today.getFullYear(), today.getMonth(), today.getDate());
                const isSelected = selectedDate?.toDateString() === day.toDateString();
                const isToday = day.toDateString() === today.toDateString();
                return (
                  <Pressable
                    key={day.toISOString()}
                    style={({ pressed }) => [
                      s.calCell,
                      isSelected && { backgroundColor: LIME_GREEN, borderRadius: 20 },
                      isToday && !isSelected && { borderWidth: 1.5, borderColor: LIME_GREEN, borderRadius: 20 },
                      isPast && { opacity: 0.3 },
                      pressed && !isPast && { opacity: 0.7 },
                    ]}
                    onPress={() => {
                      if (isPast) return;
                      if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setSelectedDate(day);
                    }}
                    disabled={isPast}
                  >
                    <Text style={{ color: isSelected ? "#FFFFFF" : colors.foreground, fontSize: 14, fontWeight: isToday ? "700" : "400" }}>
                      {day.getDate()}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {selectedDate && (
              <Text style={[s.selectedDateLabel, { color: LIME_GREEN }]}>Selected: {formatDateLabel(selectedDate)}</Text>
            )}
          </View>
        )}

        {/* Step 3: Time Slots */}
        {step === 3 && (
          <View style={s.stepContent}>
            <Text style={[s.stepTitle, { color: colors.foreground }]}>
              Available Times{selectedDate ? ` · ${formatDateLabel(selectedDate)}` : ""}
            </Text>
            {loadingSlots ? (
              <ActivityIndicator color={LIME_GREEN} style={{ marginTop: 24 }} />
            ) : slots.length === 0 ? (
              <View style={s.noSlots}>
                <IconSymbol name="clock" size={28} color={colors.muted} />
                <Text style={[s.noSlotsText, { color: colors.muted }]}>No available times on this date.</Text>
                <Pressable onPress={() => setStep(2)}>
                  <Text style={{ color: LIME_GREEN, fontWeight: "600" }}>Pick another date</Text>
                </Pressable>
              </View>
            ) : (
              <View style={s.slotsGrid}>
                {slots.map((slot) => {
                  const isSelected = selectedSlot?.time === slot.time;
                  return (
                    <Pressable
                      key={slot.time}
                      style={({ pressed }) => [
                        s.slotBtn,
                        { backgroundColor: isSelected ? LIME_GREEN : colors.surface, borderColor: isSelected ? LIME_GREEN : colors.border },
                        pressed && { opacity: 0.8 },
                      ]}
                      onPress={() => {
                        if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setSelectedSlot(slot);
                      }}
                    >
                      <Text style={{ color: isSelected ? "#FFFFFF" : colors.foreground, fontSize: 14, fontWeight: "600" }}>
                        {slot.time}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>
        )}

        {/* Step 4: Confirm */}
        {step === 4 && selectedService && selectedDate && selectedSlot && (
          <View style={s.stepContent}>
            <Text style={[s.stepTitle, { color: colors.foreground }]}>Confirm Booking</Text>
            <View style={[s.confirmCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Row label="Service" value={selectedService.name} colors={colors} />
              <Row label="Duration" value={`${selectedService.duration} min`} colors={colors} />
              <Row label="Price" value={formatPrice(selectedService.price)} colors={colors} />
              <Row label="Date" value={formatDateLabel(selectedDate)} colors={colors} />
              <Row label="Time" value={selectedSlot.time} colors={colors} />
              {selectedStaffId !== "any" && (
                <Row
                  label="Staff"
                  value={staff.find((m) => m.localId === selectedStaffId)?.name ?? selectedStaffId}
                  colors={colors}
                />
              )}
            </View>
            <Text style={[s.notesLabel, { color: colors.foreground }]}>Notes (optional)</Text>
            <TextInput
              style={[s.notesInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]}
              placeholder="Any special requests..."
              placeholderTextColor={colors.muted}
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              returnKeyType="done"
            />
          </View>
        )}
      </ScrollView>

      {/* Bottom Action */}
      <View style={[s.bottomAction, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
        {step < STEPS.length - 1 ? (
          <Pressable
            style={({ pressed }) => [
              s.nextBtn,
              { opacity: canProceed(step, selectedService, selectedStaffId, selectedDate, selectedSlot) ? 1 : 0.4 },
              pressed && canProceed(step, selectedService, selectedStaffId, selectedDate, selectedSlot) && { transform: [{ scale: 0.97 }] },
            ]}
            onPress={handleNext}
            disabled={!canProceed(step, selectedService, selectedStaffId, selectedDate, selectedSlot)}
          >
            <Text style={s.nextBtnText}>Continue</Text>
            <IconSymbol name="chevron.right" size={16} color="#FFFFFF" />
          </Pressable>
        ) : (
          <Pressable
            style={({ pressed }) => [s.nextBtn, submitting && { opacity: 0.7 }, pressed && { transform: [{ scale: 0.97 }] }]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <IconSymbol name="checkmark.circle.fill" size={18} color="#FFFFFF" />
                <Text style={s.nextBtnText}>Confirm Booking</Text>
              </>
            )}
          </Pressable>
        )}
      </View>
    </ScreenContainer>
  );
}

function canProceed(step: number, selectedService: any, selectedStaffId: any, selectedDate: Date | null, selectedSlot: any): boolean {
  if (step === 0) return selectedService != null;
  if (step === 1) return selectedStaffId !== undefined;
  if (step === 2) return selectedDate != null;
  if (step === 3) return selectedSlot != null;
  return true;
}

function Row({ label, value, colors }: { label: string; value: string; colors: ReturnType<typeof useColors> }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border }}>
      <Text style={{ color: colors.muted, fontSize: 14 }}>{label}</Text>
      <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "600" }}>{value}</Text>
    </View>
  );
}

const styles = (colors: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center" },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
    backBtn: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
    headerTitle: { fontSize: 17, fontWeight: "600" },
    stepIndicator: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingHorizontal: 24, paddingTop: 8 },
    stepItem: { flexDirection: "row", alignItems: "center" },
    stepDot: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center" },
    stepLine: { width: 28, height: 2, marginHorizontal: 2 },
    stepLabel: { textAlign: "center", fontSize: 13, fontWeight: "600", marginTop: 6, marginBottom: 4 },
    stepContent: { paddingTop: 16, gap: 12 },
    stepTitle: { fontSize: 20, fontWeight: "700", marginBottom: 4 },
    optionCard: { flexDirection: "row", alignItems: "center", borderRadius: 14, borderWidth: 1, padding: 14, gap: 12 },
    optionLeft: { flex: 1, gap: 3 },
    optionName: { fontSize: 15, fontWeight: "600" },
    optionDesc: { fontSize: 12, lineHeight: 17 },
    optionMeta: { fontSize: 12 },
    checkCircle: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center" },
    staffAvatar: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
    monthNav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
    monthBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
    monthLabel: { fontSize: 16, fontWeight: "700" },
    dayHeaders: { flexDirection: "row", marginBottom: 4 },
    dayHeader: { flex: 1, textAlign: "center", fontSize: 12, fontWeight: "600" },
    calGrid: { flexDirection: "row", flexWrap: "wrap" },
    calCell: { width: "14.28%" as any, aspectRatio: 1, alignItems: "center", justifyContent: "center" },
    selectedDateLabel: { textAlign: "center", fontSize: 14, fontWeight: "600", marginTop: 12 },
    noSlots: { alignItems: "center", paddingTop: 40, gap: 12 },
    noSlotsText: { fontSize: 14 },
    slotsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    slotBtn: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 12, alignItems: "center", minWidth: 90 },
    confirmCard: { borderRadius: 16, borderWidth: 1, paddingHorizontal: 16, paddingTop: 4, marginBottom: 16 },
    notesLabel: { fontSize: 15, fontWeight: "600", marginBottom: 6 },
    notesInput: { borderRadius: 12, borderWidth: 1, padding: 12, fontSize: 14, minHeight: 80 },
    bottomAction: { position: "absolute", bottom: 0, left: 0, right: 0, padding: 16, borderTopWidth: 1 },
    nextBtn: { backgroundColor: LIME_GREEN, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 14 },
    nextBtnText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
  });
