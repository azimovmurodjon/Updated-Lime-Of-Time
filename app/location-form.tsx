import { useState, useMemo, useCallback } from "react";
import {
  ScrollView,
  Text,
  View,
  TextInput,
  Pressable,
  StyleSheet,
  Alert,
  Share,
  Platform,
  Switch,
  Modal,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useStore, generateId } from "@/lib/store";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import {
  Location,
  formatPhoneNumber,
  formatFullAddress,
  PUBLIC_BOOKING_URL,
  WorkingHours,
  DEFAULT_WORKING_HOURS,
  DAYS_OF_WEEK,
} from "@/lib/types";
import { useActiveLocation } from "@/hooks/use-active-location";
import { useResponsive } from "@/hooks/use-responsive";
import { TapTimePicker, timeToMinutes as tapTimeToMinutes } from "@/components/tap-time-picker";
import QRCode from "react-native-qrcode-svg";

const DAY_LABELS: Record<string, string> = { sunday: "Sun", monday: "Mon", tuesday: "Tue", wednesday: "Wed", thursday: "Thu", friday: "Fri", saturday: "Sat" };
const DAY_FULL: Record<string, string> = { sunday: "Sunday", monday: "Monday", tuesday: "Tuesday", wednesday: "Wednesday", thursday: "Thursday", friday: "Friday", saturday: "Saturday" };

function formatTimeLabel(t: string) {
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hr = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hr}:${String(m).padStart(2, "0")} ${ampm}`;
}

export default function LocationFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { state, dispatch, syncToDb } = useStore();
  const { setActiveLocation } = useActiveLocation();
  const colors = useColors();
  const router = useRouter();
  const { isTablet, hp } = useResponsive();

  const existing = useMemo(
    () => (id ? state.locations.find((l) => l.id === id) : undefined),
    [state.locations, id]
  );

  const isEdit = !!existing;

  const [name, setName] = useState(existing?.name ?? "");
  const [address, setAddress] = useState(existing?.address ?? "");
  const [city, setCity] = useState(existing?.city ?? "");
  const [locationState, setLocationState] = useState(existing?.state ?? "");
  const [zipCode, setZipCode] = useState(existing?.zipCode ?? "");
  const isFirstLocation = !isEdit && state.locations.length === 0;
  const [phone, setPhone] = useState(
    formatPhoneNumber(existing?.phone ?? (isFirstLocation ? (state.settings.profile?.phone ?? "") : ""))
  );
  const [email, setEmail] = useState(existing?.email ?? "");
  // Validation errors
  const [errors, setErrors] = useState<{ name?: string; address?: string }>({});

  const handleSave = () => {
    const newErrors: { name?: string; address?: string } = {};
    if (!name.trim()) newErrors.name = "Location name is required";
    if (!address.trim()) newErrors.address = "Street address is required";
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    setErrors({});

    // New locations default to active. The first location is also set as default.
    const loc: Location = {
      id: existing?.id ?? generateId(),
      name: name.trim(),
      address: address.trim(),
      city: city.trim(),
      state: locationState.trim(),
      zipCode: zipCode.trim(),
      phone: phone.trim(),
      email: email.trim(),
      isDefault: existing?.isDefault ?? isFirstLocation,
      active: existing?.active ?? true,
      temporarilyClosed: existing?.temporarilyClosed,
      reopenOn: existing?.reopenOn,
      workingHours: useLocationHours ? locationHours : {},
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    };

    const action = isEdit
      ? { type: "UPDATE_LOCATION" as const, payload: loc }
      : { type: "ADD_LOCATION" as const, payload: loc };

    dispatch(action);
    syncToDb(action);
    // Auto-set as active location when adding a new location
    if (!isEdit) setActiveLocation(loc.id);
    router.back();
  };

  const handleDelete = () => {
    if (!existing) return;
    Alert.alert(
      "Delete Location",
      `Are you sure you want to delete "${existing.name}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            const action = { type: "DELETE_LOCATION" as const, payload: existing.id };
            dispatch(action);
            syncToDb(action);
            router.back();
          },
        },
      ]
    );
  };

  // ── Business Hours state ────────────────────────────────────────────────────
  const [locationHours, setLocationHours] = useState<Record<string, WorkingHours>>(() => {
    if (existing?.workingHours && Object.keys(existing.workingHours).length > 0) {
      return existing.workingHours as Record<string, WorkingHours>;
    }
    return { ...DEFAULT_WORKING_HOURS };
  });
  const [useLocationHours, setUseLocationHours] = useState(
    !!(existing?.workingHours && Object.keys(existing.workingHours).length > 0)
  );
  const [timePickerDay, setTimePickerDay] = useState<string | null>(null);
  const [draftStart, setDraftStart] = useState("09:00");
  const [draftEnd, setDraftEnd] = useState("17:00");
  const [weekTimeError, setWeekTimeError] = useState<string | null>(null);
  const [weekSubPicker, setWeekSubPicker] = useState<"start" | "end" | null>(null);

  const openTimePicker = useCallback((day: string) => {
    const wh = locationHours[day];
    setDraftStart(wh?.start ?? "09:00");
    setDraftEnd(wh?.end ?? "17:00");
    setWeekTimeError(null);
    setWeekSubPicker(null);
    setTimePickerDay(day);
  }, [locationHours]);

  const saveTimePicker = useCallback(() => {
    if (!timePickerDay) return;
    if (tapTimeToMinutes(draftEnd) <= tapTimeToMinutes(draftStart)) {
      setWeekTimeError("End time must be after start time.");
      return;
    }
    setWeekTimeError(null);
    setLocationHours((prev) => ({ ...prev, [timePickerDay]: { ...prev[timePickerDay], start: draftStart, end: draftEnd } }));
    setTimePickerDay(null);
    setWeekSubPicker(null);
  }, [timePickerDay, draftStart, draftEnd]);

  const toggleDay = useCallback((day: string) => {
    setLocationHours((prev) => ({ ...prev, [day]: { ...prev[day], enabled: !prev[day].enabled } }));
  }, []);

  // ── QR code modal ────────────────────────────────────────────────────────────
  const [showQr, setShowQr] = useState(false);

  const [copiedLink, setCopiedLink] = useState(false);

  const locationBookingUrl = useMemo(() => {
    if (!existing) return null;
    const slug =
      state.settings.customSlug ||
      state.settings.businessName.replace(/\s+/g, "-").toLowerCase();
    return `${PUBLIC_BOOKING_URL}/book/${slug}?location=${existing.id}`;
  }, [existing, state.settings.customSlug, state.settings.businessName]);

  const handleCopyLink = useCallback(async () => {
    if (!locationBookingUrl) return;
    await Clipboard.setStringAsync(locationBookingUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  }, [locationBookingUrl]);

  const handleShareLink = useCallback(async () => {
    if (!locationBookingUrl || !existing) return;
    const businessName = state.settings.businessName || "our business";
    const fullAddr = formatFullAddress(existing.address, existing.city, existing.state, existing.zipCode);
    const addrLine = fullAddr ? `\n📍 ${fullAddr}` : "";
    const phoneLine = existing.phone ? `\n📞 ${formatPhoneNumber(existing.phone)}` : "";
    try {
      await Share.share({
        message: `Book an appointment with ${businessName}!${addrLine}${phoneLine}\n\nSchedule online: ${locationBookingUrl}\n\nPowered by Lime Of Time`,
        url: locationBookingUrl,
        title: `Book at ${existing.name}`,
      });
    } catch {
      // User dismissed
    }
  }, [locationBookingUrl, existing, state.settings.businessName]);

  return (
    <ScreenContainer edges={["top", "left", "right"]} tabletMaxWidth={720} className="pt-2" style={{ paddingHorizontal: hp }}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backBtn, { opacity: pressed ? 0.6 : 1 }]}
        >
          <IconSymbol name="arrow.left" size={22} color={colors.foreground} />
        </Pressable>
        <Text className="text-xl font-bold text-foreground" style={{ flex: 1 }}>
          {isEdit ? "Edit Location" : "Add Location"}
        </Text>
        <Pressable
          onPress={handleSave}
          style={({ pressed }) => [
            styles.saveBtn,
            { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 },
          ]}
        >
          <Text style={{ color: "#FFFFFF", fontWeight: "600", fontSize: 15 }}>Save</Text>
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        {/* First-location welcome banner */}
        {isFirstLocation && (
          <View style={[styles.section, { backgroundColor: colors.primary + "12", borderColor: colors.primary + "30" }]}>
            <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
              <Text style={{ fontSize: 22 }}>📍</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: "700", color: colors.primary, marginBottom: 4 }}>Add Your Business Location</Text>
                <Text style={{ fontSize: 13, color: colors.muted, lineHeight: 19 }}>
                  Your address will appear on your booking page so clients know where to find you. You can always add more locations later.
                </Text>
              </View>
            </View>
          </View>
        )}
        {/* Basic Info */}
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text className="text-base font-semibold text-foreground mb-3">Location Details</Text>

          <Text className="text-xs font-medium text-muted mb-1">Name *</Text>
          <TextInput
            value={name}
            onChangeText={(v) => { setName(v); if (errors.name) setErrors((e) => ({ ...e, name: undefined })); }}
            placeholder="e.g. Main Office, Downtown Branch"
            placeholderTextColor={colors.muted}
            style={[styles.input, { backgroundColor: colors.background, borderColor: errors.name ? colors.error : colors.border, color: colors.foreground }]}
            returnKeyType="done"
          />
          {errors.name ? <Text style={{ color: colors.error, fontSize: 12, marginTop: 4 }}>{errors.name}</Text> : null}

          <Text className="text-xs font-medium text-muted mb-1 mt-3">Address *</Text>
          <TextInput
            value={address}
            onChangeText={(v) => { setAddress(v); if (errors.address) setErrors((e) => ({ ...e, address: undefined })); }}
            placeholder="e.g. 123 Main Street"
            placeholderTextColor={colors.muted}
            style={[styles.input, { backgroundColor: colors.background, borderColor: errors.address ? colors.error : colors.border, color: colors.foreground }]}
            returnKeyType="done"
          />
          {errors.address ? <Text style={{ color: colors.error, fontSize: 12, marginTop: 4 }}>{errors.address}</Text> : null}

          {/* City / State / ZIP row */}
          <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
            <View style={{ flex: 2 }}>
              <Text className="text-xs font-medium text-muted mb-1">City</Text>
              <TextInput
                value={city}
                onChangeText={setCity}
                placeholder="e.g. New York"
                placeholderTextColor={colors.muted}
                style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
                returnKeyType="next"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text className="text-xs font-medium text-muted mb-1">State</Text>
              <TextInput
                value={locationState}
                onChangeText={setLocationState}
                placeholder="NY"
                placeholderTextColor={colors.muted}
                autoCapitalize="characters"
                maxLength={2}
                style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
                returnKeyType="next"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text className="text-xs font-medium text-muted mb-1">ZIP</Text>
              <TextInput
                value={zipCode}
                onChangeText={setZipCode}
                placeholder="10001"
                placeholderTextColor={colors.muted}
                keyboardType="numeric"
                maxLength={10}
                style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
                returnKeyType="next"
              />
            </View>
          </View>

          <Text className="text-xs font-medium text-muted mb-1 mt-3">Phone</Text>
          <TextInput
            value={phone}
            onChangeText={(val) => setPhone(formatPhoneNumber(val))}
            placeholder="e.g. (212) 555-0100"
            placeholderTextColor={colors.muted}
            keyboardType="phone-pad"
            style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
            returnKeyType="done"
          />

          <Text className="text-xs font-medium text-muted mb-1 mt-3">Email</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="e.g. info@yourbusiness.com"
            placeholderTextColor={colors.muted}
            keyboardType="email-address"
            autoCapitalize="none"
            style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
            returnKeyType="done"
          />
        </View>

        {/* Booking Link (edit mode only) */}
        {isEdit && locationBookingUrl && (
          <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 }}>
              <IconSymbol name="link" size={15} color={colors.primary} />
              <Text style={{ fontSize: 14, fontWeight: "700", color: colors.foreground }}>Booking Link</Text>
            </View>
            <Text style={{ fontSize: 12, color: colors.muted, lineHeight: 17, marginBottom: 10 }}>
              Share this link so clients can book directly at this location.
            </Text>
            {/* URL preview */}
            <View style={[styles.urlPreviewBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <Text style={{ fontSize: 12, color: colors.muted, flex: 1 }} numberOfLines={1}>
                {locationBookingUrl}
              </Text>
            </View>
            {/* Copy + Share buttons */}
            <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
              <Pressable
                onPress={handleCopyLink}
                style={({ pressed }) => [
                  styles.linkBtn,
                  {
                    backgroundColor: copiedLink ? colors.success + "18" : colors.primary + "12",
                    borderColor: copiedLink ? colors.success + "50" : colors.primary + "30",
                    opacity: pressed ? 0.7 : 1,
                    flex: 1,
                  },
                ]}
              >
                <IconSymbol
                  name={copiedLink ? "checkmark.circle.fill" : "doc.on.doc.fill"}
                  size={15}
                  color={copiedLink ? colors.success : colors.primary}
                />
                <Text style={{ fontSize: 13, fontWeight: "600", color: copiedLink ? colors.success : colors.primary }}>
                  {copiedLink ? "Copied!" : "Copy Link"}
                </Text>
              </Pressable>
              {Platform.OS !== "web" && (
                <Pressable
                  onPress={handleShareLink}
                  style={({ pressed }) => [
                    styles.linkBtn,
                    {
                      backgroundColor: colors.primary + "12",
                      borderColor: colors.primary + "30",
                      opacity: pressed ? 0.7 : 1,
                      flex: 1,
                    },
                  ]}
                >
                  <IconSymbol name="square.and.arrow.up" size={15} color={colors.primary} />
                  <Text style={{ fontSize: 13, fontWeight: "600", color: colors.primary }}>Share</Text>
                </Pressable>
              )}
            </View>
          </View>
        )}

        {/* Business Hours (edit mode only) */}
        {isEdit && (
          <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: "700", color: colors.foreground }}>Location Business Hours</Text>
                <Text style={{ fontSize: 12, color: colors.muted, marginTop: 2, lineHeight: 17 }}>
                  {useLocationHours ? "Custom hours for this location." : "Using global business hours from Schedule Settings."}
                </Text>
              </View>
              <Switch
                value={useLocationHours}
                onValueChange={setUseLocationHours}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor={useLocationHours ? colors.primary : colors.muted}
              />
            </View>
            {useLocationHours && (
              <View style={{ marginTop: 12 }}>
                {DAYS_OF_WEEK.map((day, idx) => {
                  const wh = locationHours[day] ?? { enabled: false, start: "09:00", end: "17:00" };
                  const isLast = idx === DAYS_OF_WEEK.length - 1;
                  return (
                    <View key={day} style={[styles.dayRow, !isLast && { borderBottomWidth: 1, borderBottomColor: colors.border + "40" }]}>
                      <Switch
                        value={wh.enabled}
                        onValueChange={() => toggleDay(day)}
                        trackColor={{ false: colors.border, true: colors.primary + "60" }}
                        thumbColor={wh.enabled ? colors.primary : colors.muted}
                        style={{ transform: [{ scale: 0.8 }] }}
                      />
                      <Text style={{ fontSize: 13, fontWeight: "500", width: 44, marginLeft: 8, color: wh.enabled ? colors.foreground : colors.muted }}>
                        {DAY_LABELS[day]}
                      </Text>
                      {wh.enabled && (
                        <Pressable
                          onPress={() => openTimePicker(day)}
                          style={({ pressed }) => [
                            styles.timeButton,
                            { backgroundColor: colors.background, borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
                          ]}
                        >
                          <Text style={{ fontSize: 12, color: colors.foreground }}>
                            {formatTimeLabel(wh.start)} – {formatTimeLabel(wh.end)}
                          </Text>
                        </Pressable>
                      )}
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        )}

        {/* QR Code (edit mode only) */}
        {isEdit && locationBookingUrl && (
          <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 }}>
              <IconSymbol name="qrcode" size={15} color={colors.primary} />
              <Text style={{ fontSize: 14, fontWeight: "700", color: colors.foreground }}>QR Code</Text>
            </View>
            <Text style={{ fontSize: 12, color: colors.muted, lineHeight: 17, marginBottom: 10 }}>
              Display or print this QR code so walk-in clients can scan it to book online.
            </Text>
            <Pressable
              onPress={() => setShowQr(true)}
              style={({ pressed }) => [
                styles.linkBtn,
                { backgroundColor: colors.primary + "12", borderColor: colors.primary + "30", opacity: pressed ? 0.7 : 1, alignSelf: "flex-start" },
              ]}
            >
              <IconSymbol name="qrcode" size={15} color={colors.primary} />
              <Text style={{ fontSize: 13, fontWeight: "600", color: colors.primary }}>View QR Code</Text>
            </Pressable>
          </View>
        )}

        {/* Delete Button (edit mode only) */}
        {isEdit && (
          <Pressable
            onPress={handleDelete}
            style={({ pressed }) => [
              styles.deleteBtn,
              { borderColor: colors.error, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <IconSymbol name="trash.fill" size={18} color={colors.error} />
            <Text style={{ color: colors.error, fontWeight: "600", fontSize: 15 }}>
              Delete Location
            </Text>
          </Pressable>
        )}
      </ScrollView>
      {/* Time Picker Modal */}
      <Modal visible={!!timePickerDay} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={() => { setTimePickerDay(null); setWeekSubPicker(null); }}>
          <Pressable style={[styles.modalContent, { backgroundColor: colors.background }]} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <Text style={{ fontSize: 17, fontWeight: "700", color: colors.foreground }}>
                {timePickerDay ? DAY_FULL[timePickerDay] : ""} Hours
              </Text>
              <Pressable onPress={() => { setTimePickerDay(null); setWeekSubPicker(null); }} style={({ pressed }) => [{ opacity: pressed ? 0.5 : 1 }]}>
                <IconSymbol name="xmark" size={22} color={colors.foreground} />
              </Pressable>
            </View>
            <Pressable
              onPress={() => setWeekSubPicker(weekSubPicker === "start" ? null : "start")}
              style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 14, paddingHorizontal: 4, borderRadius: 12, backgroundColor: weekSubPicker === "start" ? colors.primary + "18" : "transparent", marginBottom: 4 }}
            >
              <Text style={{ fontSize: 15, fontWeight: "600", color: colors.foreground }}>Start Time</Text>
              <Text style={{ fontSize: 17, fontWeight: "700", color: colors.primary }}>{formatTimeLabel(draftStart)}</Text>
            </Pressable>
            {weekSubPicker === "start" && (
              <TapTimePicker value={draftStart} onChange={(v) => { setDraftStart(v); setWeekTimeError(null); }} stepMinutes={5} />
            )}
            <Pressable
              onPress={() => setWeekSubPicker(weekSubPicker === "end" ? null : "end")}
              style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 14, paddingHorizontal: 4, borderRadius: 12, backgroundColor: weekSubPicker === "end" ? colors.primary + "18" : "transparent", marginBottom: 4 }}
            >
              <Text style={{ fontSize: 15, fontWeight: "600", color: colors.foreground }}>End Time</Text>
              <Text style={{ fontSize: 17, fontWeight: "700", color: colors.primary }}>{formatTimeLabel(draftEnd)}</Text>
            </Pressable>
            {weekSubPicker === "end" && (
              <TapTimePicker value={draftEnd} onChange={(v) => { setDraftEnd(v); setWeekTimeError(null); }} stepMinutes={5} />
            )}
            {weekTimeError ? (
              <Text style={{ color: colors.error, fontSize: 13, textAlign: "center", marginVertical: 8 }}>{weekTimeError}</Text>
            ) : null}
            <Pressable
              onPress={saveTimePicker}
              style={({ pressed }) => [styles.saveBtn, { backgroundColor: weekTimeError ? colors.border : colors.primary, opacity: pressed ? 0.8 : 1, marginTop: 12 }]}
            >
              <Text style={{ color: weekTimeError ? colors.muted : "#fff", fontWeight: "700", fontSize: 16 }}>Save Hours</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* QR Code Modal */}
      <Modal visible={showQr} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={() => setShowQr(false)}>
          <Pressable style={[styles.qrModalContent, { backgroundColor: colors.background }]} onPress={() => {}}>
            <View style={[styles.modalHeader, { width: "100%" }]}>
              <Text style={{ fontSize: 17, fontWeight: "700", color: colors.foreground }}>Booking QR Code</Text>
              <Pressable onPress={() => setShowQr(false)} style={({ pressed }) => [{ opacity: pressed ? 0.5 : 1 }]}>
                <IconSymbol name="xmark" size={22} color={colors.foreground} />
              </Pressable>
            </View>
            {existing && locationBookingUrl && (
              <>
                <Text style={{ fontSize: 13, color: colors.muted, textAlign: "center", marginBottom: 20, lineHeight: 18 }}>
                  Scan to book at {existing.name}
                </Text>
                <View style={{ padding: 16, backgroundColor: "#FFFFFF", borderRadius: 16, marginBottom: 20 }}>
                  <QRCode value={locationBookingUrl} size={200} />
                </View>
                <Text style={{ fontSize: 11, color: colors.muted, textAlign: "center", lineHeight: 16 }} numberOfLines={2}>
                  {locationBookingUrl}
                </Text>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    gap: 12,
  },
  backBtn: {
    padding: 4,
  },
  saveBtn: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
  },
  section: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  input: {
    height: 44,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 15,
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  deleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 16,
  },
  urlPreviewBox: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  linkBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
  },
  dayRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10 },
  timeButton: { flex: 1, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8, borderWidth: 1, alignItems: "center", justifyContent: "center", minHeight: 36, marginLeft: 4 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  modalContent: { borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 16, paddingBottom: 40, paddingHorizontal: 20 },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  qrModalContent: { borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 16, paddingBottom: 40, paddingHorizontal: 20, alignItems: "center" },
});
