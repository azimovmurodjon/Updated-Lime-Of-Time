import { Text, View, Pressable, StyleSheet, ScrollView, Alert, Platform, Linking, Modal, TextInput, TouchableOpacity, Image, FlatList } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useStore, formatTime, formatDateDisplay } from "@/lib/store";
import { useColors } from "@/hooks/use-colors";
import { useResponsive } from "@/hooks/use-responsive";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useMemo, useState, useCallback } from "react";
import { apiCall } from "@/lib/_core/api";
import { trpc } from "@/lib/trpc";
import { usePlanLimitCheck } from "@/hooks/use-plan-limit-check";
import { FuturisticBackground } from "@/components/futuristic-background";
import * as WebBrowser from "expo-web-browser";
import { getApiBaseUrl } from "@/constants/oauth";

import {
  minutesToTime,
  timeToMinutes,
  formatTimeDisplay,
  getServiceDisplayName,
  getMapUrl,
  stripPhoneFormat,
  formatPhoneNumber,
  generateAcceptMessage,
  generateRejectMessage,
  generateCancellationMessage,
  generateReminderMessage,
  formatFullAddress,
  PUBLIC_BOOKING_URL,
  LIME_OF_TIME_FOOTER,
  generateAvailableSlots,
  DAYS_OF_WEEK,
} from "@/lib/types";

/** Replace {variable} placeholders in a custom template and append the Lime Of Time footer */
function applyTemplate(
  template: string,
  vars: Record<string, string>
): string {
  let result = template;
  for (const [key, val] of Object.entries(vars)) {
    result = result.replaceAll(`{${key}}`, val);
  }
  return result + LIME_OF_TIME_FOOTER;
}

export default function AppointmentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state, dispatch, getServiceById, getClientById, getStaffById, getLocationById, syncToDb } = useStore();
  const colors = useColors();
  const router = useRouter();
  const { isTablet, hp } = useResponsive();
  const sendSmsMutation = trpc.twilio.sendSms.useMutation();
  const { planInfo } = usePlanLimitCheck();
  const isGrowthPlan = planInfo && planInfo.planKey !== "solo";

  const appointment = useMemo(
    () => state.appointments.find((a) => a.id === id),
    [state.appointments, id]
  );

  // ── All hooks must be declared before any early return (Rules of Hooks) ──
  const [cancelReasonModal, setCancelReasonModal] = useState(false);
  const [selectedReason, setSelectedReason] = useState("");
  const [customReason, setCustomReason] = useState("");
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const today = new Date();
  const [reschedDate, setReschedDate] = useState<string>(appointment?.date ?? "");
  const [reschedTime, setReschedTime] = useState<string | null>(null);
  const [reschedCalMonth, setReschedCalMonth] = useState<{ year: number; month: number }>(() => {
    const d = appointment ? new Date(appointment.date + "T12:00:00") : new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentConfirmInput, setPaymentConfirmInput] = useState("");
  const [refunding, setRefunding] = useState(false);
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [refundAmount, setRefundAmount] = useState("");
  const [showNoShowFeeModal, setShowNoShowFeeModal] = useState(false);
  const [noShowFeeAmount, setNoShowFeeAmount] = useState("");
  const [noShowFeeLoading, setNoShowFeeLoading] = useState(false);
  const [selectedPayMethod, setSelectedPayMethod] = useState<'cash' | 'zelle' | 'venmo' | 'cashapp'>(
    (appointment?.paymentMethod && appointment.paymentMethod !== 'unpaid' ? appointment.paymentMethod : 'cash') as 'cash' | 'zelle' | 'venmo' | 'cashapp'
  );

  if (!appointment) {
    return (
      <ScreenContainer edges={["top", "bottom", "left", "right"]} className="p-5">
      <FuturisticBackground />
        <Pressable onPress={() => router.back()} style={({ pressed }) => [{ opacity: pressed ? 0.5 : 1 }]}>
          <IconSymbol name="arrow.left" size={24} color={colors.foreground} />
        </Pressable>
        <View className="flex-1 items-center justify-center">
          <Text className="text-base text-muted">Appointment not found</Text>
        </View>
      </ScreenContainer>
    );
  }

  const service = getServiceById(appointment.serviceId);
  const client = getClientById(appointment.clientId);
  const assignedStaff = appointment.staffId ? getStaffById(appointment.staffId) : null;
  const assignedLocation = appointment.locationId ? getLocationById(appointment.locationId) : null;
  const endTimeStr = formatTime(minutesToTime(timeToMinutes(appointment.time) + appointment.duration));
  const policy = state.settings.cancellationPolicy;
  const biz = state.settings;
  const profile = biz.profile;

  const openSms = (phone: string, message: string) => {
    const rawPhone = stripPhoneFormat(phone);
    if (Platform.OS === "web") {
      Alert.alert("SMS Message", message);
      return;
    }
    const separator = Platform.OS === "ios" ? "&" : "?";
    const url = `sms:${rawPhone}${separator}body=${encodeURIComponent(message)}`;
    Linking.openURL(url).catch(() => Alert.alert("SMS", message));
  };

  const getCancellationInfo = () => {
    if (!policy.enabled) return { feeApplies: false, fee: 0 };
    const apptDateTime = new Date(`${appointment.date}T${appointment.time}:00`);
    const now = new Date();
    const hoursUntil = (apptDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);
    const feeApplies = hoursUntil <= policy.hoursBeforeAppointment;
    const fee = feeApplies ? Math.round((service?.price ?? 0) * policy.feePercentage / 100) : 0;
    return { feeApplies, fee };
  };

  const handleAccept = () => {
    dispatch({ type: "UPDATE_APPOINTMENT_STATUS", payload: { id: appointment.id, status: "confirmed" } });
    syncToDb({ type: "UPDATE_APPOINTMENT_STATUS", payload: { id: appointment.id, status: "confirmed" } });
    if (client?.phone) {
      const customTpl = biz.smsTemplates?.confirmation;
      let msg: string;
      if (customTpl) {
        const slug = biz.customSlug || biz.businessName.replace(/\s+/g, "-").toLowerCase();
        const fullAddr = assignedLocation
          ? formatFullAddress(assignedLocation.address, assignedLocation.city, assignedLocation.state, assignedLocation.zipCode)
          : formatFullAddress(profile.address, profile.city, profile.state, profile.zipCode);
        const locLine = assignedLocation?.name ? (fullAddr ? `${assignedLocation.name} \u2014 ${fullAddr}` : assignedLocation.name) : fullAddr;
        // Build paymentOptions string for {paymentOptions} template variable
        const _payLines: string[] = [];
        if (biz.zelleHandle) _payLines.push(`💳 Zelle: ${biz.zelleHandle}`);
        if (biz.cashAppHandle) _payLines.push(`💵 Cash App: ${biz.cashAppHandle}`);
        if (biz.venmoHandle) _payLines.push(`💸 Venmo: ${biz.venmoHandle}`);
        const _paymentOptions = _payLines.length > 0 ? _payLines.join("\n") : "";
        msg = applyTemplate(customTpl, {
          clientName: client.name,
          businessName: biz.businessName,
          serviceName: service ? getServiceDisplayName(service) : "Service",
          duration: String(appointment.duration),
          date: appointment.date,
          time: appointment.time,
          location: locLine,
          phone: formatPhoneNumber(stripPhoneFormat(assignedLocation?.phone || profile.phone)),
          clientPhone: client.phone,
          bookingUrl: `${PUBLIC_BOOKING_URL}/book/${slug}${assignedLocation?.id ? "?location=" + assignedLocation.id : ""}`,
          reviewUrl: `${PUBLIC_BOOKING_URL}/review/${slug}`,
          paymentOptions: _paymentOptions,
        });
      } else {
        msg = generateAcceptMessage(
          biz.businessName,
          assignedLocation?.address || profile.address,
          client.name,
          service ? getServiceDisplayName(service) : "Service",
          appointment.duration,
          appointment.date,
          appointment.time,
          assignedLocation?.phone || profile.phone,
          client.phone,
          appointment.id,
          assignedLocation?.name,
          assignedLocation?.id,
          biz.customSlug,
          assignedLocation?.city ?? profile.city,
          assignedLocation?.state ?? profile.state,
          assignedLocation?.zipCode ?? profile.zipCode,
          biz.zelleHandle,
          biz.cashAppHandle,
          biz.venmoHandle
        );
      }
      openSms(client.phone, msg);
    }
    router.back();
  };

  const reschedSlots = useMemo(() => {
    const loc = assignedLocation;
    const wh = (loc?.workingHours && Object.keys(loc.workingHours).length > 0)
      ? loc.workingHours as Record<string, import('@/lib/types').WorkingHours>
      : state.settings.workingHours;
    // Exclude the current appointment from conflict check
    const otherAppts = state.appointments.filter(a => a.id !== appointment.id);
    return generateAvailableSlots(
      reschedDate,
      appointment.duration,
      wh,
      otherAppts,
      30, // default step minutes
      undefined,
      state.settings.scheduleMode,
      state.settings.bufferTime ?? 0
    );
  }, [reschedDate, appointment.duration, appointment.id, assignedLocation, state.settings, state.appointments]);

  const handleReschedule = useCallback(() => {
    if (!reschedTime) return;
    const updated = { ...appointment, date: reschedDate, time: reschedTime };
    dispatch({ type: "UPDATE_APPOINTMENT", payload: updated });
    syncToDb({ type: "UPDATE_APPOINTMENT", payload: updated });
    setShowRescheduleModal(false);
      // Send reschedule SMS if client has phone — respect master notificationsEnabled
    const _notifPrefs3 = state.settings.notificationPreferences ?? {};
    const _masterNotifOn3 = state.settings.notificationsEnabled !== false;
    const _smsReschedOn = (_notifPrefs3 as any).smsClientOnConfirmation !== false; // reuse confirmation toggle for reschedule
    if (client?.phone && _masterNotifOn3 && _smsReschedOn) {
      const svcName = service ? getServiceDisplayName(service) : "your appointment";
      const locLine = assignedLocation?.name ? `\n📍 ${assignedLocation.name}` : "";
      const slug = biz.customSlug || biz.businessName.replace(/\s+/g, "-").toLowerCase();
      const bookingLink = `${PUBLIC_BOOKING_URL}/book/${slug}${assignedLocation?.id ? "?location=" + assignedLocation.id : ""}`;
      const manageLink = appointment.id ? `${PUBLIC_BOOKING_URL}/manage/${slug}/${appointment.id}` : "";
      const calendarLine = manageLink ? `\n\n🗓️ Add to calendar / manage: ${manageLink}` : "";
      const msg = `Hi ${client.name}, your appointment for ${svcName} has been rescheduled to ${reschedDate} at ${formatTime(reschedTime)}.${locLine}${calendarLine}\n\n📅 Book again: ${bookingLink}\n\n— ${biz.businessName}${LIME_OF_TIME_FOOTER}`;
      const rawPhone = stripPhoneFormat(client.phone);
      const smsEnabled = state.settings.twilioEnabled;
      if (smsEnabled && state.businessOwnerId) {
        const toNumber = rawPhone.startsWith('+') ? rawPhone : `+1${rawPhone.replace(/\D/g, '')}`;
        sendSmsMutation
          .mutateAsync({
            businessOwnerId: state.businessOwnerId,
            toNumber,
            body: msg,
            smsAction: 'confirmation',
          })
          .catch(() => openSms(client.phone!, msg));
      } else {
        openSms(client.phone, msg);
      }
    }
  }, [appointment, reschedDate, reschedTime, client, service, assignedLocation, biz, dispatch, syncToDb, sendSmsMutation, state.settings.twilioEnabled, state.businessOwnerId]);

  // Calendar helpers for reschedule
  const reschedCalDays = useMemo(() => {
    const { year, month } = reschedCalMonth;
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    return cells;
  }, [reschedCalMonth]);
  const DETAIL_PAYMENT_METHODS = [
    { key: 'cash' as const, label: 'Cash' },
    { key: 'zelle' as const, label: 'Zelle' },
    { key: 'venmo' as const, label: 'Venmo' },
    { key: 'cashapp' as const, label: 'Cash App' },
  ];

  const handleRefund = useCallback(async (partial?: number) => {
    if (!appointment || !state.businessOwnerId) return;
    setRefunding(true);
    try {
      const result = await apiCall<{ ok: boolean; refundId: string; amount: number }>("/api/stripe-connect/refund", {
        method: "POST",
        body: JSON.stringify({
          businessOwnerId: state.businessOwnerId,
          appointmentLocalId: appointment.id,
          ...(partial ? { amount: partial } : {}),
        }),
      });
      const refundedAppt = { ...appointment, paymentStatus: "unpaid" as const, paymentMethod: undefined };
      dispatch({ type: "UPDATE_APPOINTMENT", payload: refundedAppt });
      syncToDb({ type: "UPDATE_APPOINTMENT", payload: refundedAppt });
      Alert.alert("Refund Issued", `$${result.amount.toFixed(2)} has been refunded to the client's card.\nRefund ID: ${result.refundId}`);
    } catch (err: any) {
      Alert.alert("Refund Failed", err?.message ?? "Could not issue refund. Please try again.");
    } finally {
      setRefunding(false);
      setShowRefundModal(false);
      setRefundAmount("");
    }
  }, [appointment, state.businessOwnerId, dispatch, syncToDb]);

  const handleMarkPaid = (confirmationNumber?: string) => {
    // Use the method from the picker if the appointment doesn't have one set
    const effectiveMethod = appointment.paymentMethod && appointment.paymentMethod !== 'unpaid'
      ? appointment.paymentMethod
      : selectedPayMethod;
    const updated = {
      ...appointment,
      paymentStatus: 'paid' as const,
      paymentMethod: effectiveMethod,
      paymentConfirmationNumber: confirmationNumber || undefined,
    };
    dispatch({ type: "UPDATE_APPOINTMENT", payload: updated });
    syncToDb({ type: "UPDATE_APPOINTMENT", payload: updated });
    setShowPaymentModal(false);
    setPaymentConfirmInput("");
    // Send payment receipt SMS to client — respect master notificationsEnabled
    const _notifPrefsP = state.settings.notificationPreferences ?? {};
    const _masterNotifOnP = state.settings.notificationsEnabled !== false;
    const _smsPaymentOn = (_notifPrefsP as any).smsClientOnConfirmation !== false; // reuse confirmation toggle for payment receipt
    if (client?.phone && _masterNotifOnP && _smsPaymentOn) {
      const methodLabel =
        appointment.paymentMethod === 'zelle' ? 'Zelle' :
        appointment.paymentMethod === 'cashapp' ? 'Cash App' :
        appointment.paymentMethod === 'venmo' ? 'Venmo' : 'Cash';
      const confLine = confirmationNumber ? `\nConfirmation #: ${confirmationNumber}` : '';
      const serviceName = service ? getServiceDisplayName(service) : 'your appointment';
      const locLine = assignedLocation?.name ? `\n\uD83D\uDCCD ${assignedLocation.name}` : '';
      const msg = `Hi ${client.name}, your payment of $${(appointment.totalPrice ?? 0).toFixed(2)} via ${methodLabel} for ${serviceName} on ${formatDateDisplay(appointment.date)} at ${appointment.time} has been received.${confLine}${locLine}\n\nThank you! — ${biz.businessName}${LIME_OF_TIME_FOOTER}`;
      // Try server-side SMS first (subscription-gated), fall back to native SMS
      const rawPhone = stripPhoneFormat(client.phone);
      const smsEnabled = state.settings.twilioEnabled;
      if (smsEnabled && state.businessOwnerId) {
        const toNumber = rawPhone.startsWith('+') ? rawPhone : `+1${rawPhone.replace(/\D/g, '')}`;
        sendSmsMutation
          .mutateAsync({
            businessOwnerId: state.businessOwnerId,
            toNumber,
            body: msg,
            smsAction: 'confirmation',
          })
          .catch(() => openSms(client.phone!, msg));
      } else {
        openSms(client.phone, msg);
      }
    }
  };

  const CANCEL_REASONS = [
    "Client requested",
    "No-show",
    "Staff unavailable",
    "Rescheduled",
    "Weather / emergency",
    "Other",
  ];

  const handleStatusChange = (status: "completed" | "cancelled") => {
    const cancInfo = getCancellationInfo();
    const doIt = (cancellationReason?: string) => {
      dispatch({ type: "UPDATE_APPOINTMENT_STATUS", payload: { id: appointment.id, status, ...(cancellationReason ? { cancellationReason } : {}) } });
      syncToDb({ type: "UPDATE_APPOINTMENT_STATUS", payload: { id: appointment.id, status, ...(cancellationReason ? { cancellationReason } : {}) } });
      // Respect master notificationsEnabled and per-event SMS toggles
      const _notifPrefs2 = state.settings.notificationPreferences ?? {};
      const _masterNotifOn2 = state.settings.notificationsEnabled !== false;
      const _smsCancelOn = (_notifPrefs2 as any).smsClientOnCancellation !== false; // default true
      const _smsConfirmOn = (_notifPrefs2 as any).smsClientOnConfirmation !== false; // default true
      const _smsAllowed = status === "cancelled" ? _smsCancelOn : _smsConfirmOn;
      if (client?.phone && _masterNotifOn2 && _smsAllowed) {
        let msg = "";
        if (status === "completed") {
          const completedFullAddr = assignedLocation
            ? formatFullAddress(assignedLocation.address, assignedLocation.city, assignedLocation.state, assignedLocation.zipCode)
            : formatFullAddress(profile.address, profile.city, profile.state, profile.zipCode);
          const completedLocLine = assignedLocation?.name
            ? (completedFullAddr ? `${assignedLocation.name} \u2014 ${completedFullAddr}` : assignedLocation.name)
            : completedFullAddr;
          const completedSlug = biz.customSlug || biz.businessName.replace(/\s+/g, "-").toLowerCase();
          const customCompletedTpl = biz.smsTemplates?.completed;
          if (customCompletedTpl) {
            msg = applyTemplate(customCompletedTpl, {
              clientName: client.name,
              businessName: biz.businessName,
              serviceName: service ? getServiceDisplayName(service) : "service",
              date: formatDateDisplay(appointment.date),
              time: appointment.time,
              location: completedLocLine,
              phone: formatPhoneNumber(stripPhoneFormat(assignedLocation?.phone || profile.phone)),
              clientPhone: client.phone,
              bookingUrl: `${PUBLIC_BOOKING_URL}/book/${completedSlug}${assignedLocation?.id ? "?location=" + assignedLocation.id : ""}`,
              reviewUrl: `${PUBLIC_BOOKING_URL}/review/${completedSlug}`,
            });
          } else {
            msg = `Dear ${client.name},\n\nThank you for visiting ${biz.businessName}! Your appointment for ${service ? getServiceDisplayName(service) : "service"} on ${formatDateDisplay(appointment.date)} has been completed.\n\nWe hope you had a great experience. We\u2019d love to see you again!\n\n\uD83D\uDCCD ${completedLocLine}\n\uD83D\uDCDE ${formatPhoneNumber(stripPhoneFormat(assignedLocation?.phone || profile.phone))}\n\n\uD83D\uDD17 Book again: ${PUBLIC_BOOKING_URL}/book/${completedSlug}${assignedLocation?.id ? "?location=" + assignedLocation.id : ""}\n\nBest regards,\n${biz.businessName}${LIME_OF_TIME_FOOTER}`;
          }
        } else {
          const feeStr = cancInfo.feeApplies && cancInfo.fee > 0 ? `$${cancInfo.fee} (${policy.feePercentage}%)` : "";
          const customCancelTpl = biz.smsTemplates?.cancellation;
          if (customCancelTpl) {
            const cancelFullAddr = assignedLocation
              ? formatFullAddress(assignedLocation.address, assignedLocation.city, assignedLocation.state, assignedLocation.zipCode)
              : formatFullAddress(profile.address, profile.city, profile.state, profile.zipCode);
            const cancelLocLine = assignedLocation?.name
              ? (cancelFullAddr ? `${assignedLocation.name} \u2014 ${cancelFullAddr}` : assignedLocation.name)
              : cancelFullAddr;
            msg = applyTemplate(customCancelTpl, {
              clientName: client.name,
              businessName: biz.businessName,
              serviceName: service ? getServiceDisplayName(service) : "Service",
              date: appointment.date,
              time: appointment.time,
              location: cancelLocLine,
              phone: formatPhoneNumber(stripPhoneFormat(assignedLocation?.phone || profile.phone)),
              clientPhone: client.phone,
            });
          } else {
            msg = generateCancellationMessage(
              biz.businessName,
              client.name,
              service ? getServiceDisplayName(service) : "Service",
              appointment.date,
              appointment.time,
              feeStr,
              assignedLocation?.phone || profile.phone,
              assignedLocation?.name,
              assignedLocation?.address ?? profile.address,
              assignedLocation?.city ?? profile.city,
              assignedLocation?.state ?? profile.state,
              assignedLocation?.zipCode ?? profile.zipCode
            );
          }
        }
        // Try server-side SMS (subscription gated); fall back to native SMS
        const biz2 = state.settings;
        const isCompleted = status === "completed";
        const smsAction = isCompleted ? "rebooking" : "confirmation";
        const smsEnabled = biz2.twilioEnabled;
        const rawPhone2 = stripPhoneFormat(client.phone);
        if (smsEnabled && state.businessOwnerId) {
          const toNumber2 = rawPhone2.startsWith("+") ? rawPhone2 : `+1${rawPhone2.replace(/\D/g, "")}`;
          sendSmsMutation
            .mutateAsync({
              businessOwnerId: state.businessOwnerId,
              toNumber: toNumber2,
              body: msg,
              smsAction,
            })
            .catch(() => openSms(client.phone, msg));
        } else {
          openSms(client.phone, msg);
        }
      }
      router.back();
    };
    if (status === "cancelled") {
      // Show reason picker modal for cancellations
      setSelectedReason("");
      setCustomReason("");
      setCancelReasonModal(true);
      return;
    }
    if (Platform.OS === "web") {
      doIt();
    } else {
      Alert.alert(
        "Complete Appointment",
        "Are you sure you want to mark this appointment as completed?",
        [
          { text: "No", style: "cancel" },
          { text: "Yes", onPress: () => doIt() },
        ]
      );
    }
  };

  // ── No-show fee via Stripe ───────────────────────────────────────────────
  const handleChargeNoShowFee = useCallback(async (feeAmount: number) => {
    if (!state.businessOwnerId || !appointment) return;
    setNoShowFeeLoading(true);
    try {
      const apiBase = getApiBaseUrl();
      const successUrl = `${apiBase}/api/stripe-connect/webhook-success?type=no_show_fee&appointmentId=${appointment.id}`;
      const cancelUrl = `${apiBase}/api/stripe-connect/webhook-cancel`;
      const result = await apiCall<{ url: string; sessionId: string }>("/api/stripe-connect/no-show-fee", {
        method: "POST",
        body: JSON.stringify({
          businessOwnerId: state.businessOwnerId,
          appointmentLocalId: appointment.id,
          amount: feeAmount,
          serviceName: service ? getServiceDisplayName(service) : "Appointment",
          clientName: client?.name ?? "",
          successUrl,
          cancelUrl,
        }),
      });
      setShowNoShowFeeModal(false);
      if (result.url) {
        await WebBrowser.openBrowserAsync(result.url);
      }
    } catch (err: any) {
      Alert.alert("Error", err?.message ?? "Could not create no-show fee charge");
    } finally {
      setNoShowFeeLoading(false);
    }
  }, [state.businessOwnerId, appointment, service, client]);

  const handleNoShow = () => {
    if (!isGrowthPlan) {
      Alert.alert("Upgrade Required", "No-Show SMS is available on the Growth plan and above. Upgrade to automatically notify clients when they miss their appointment.", [{ text: "OK" }]);
      return;
    }
    const doIt = () => {
      dispatch({ type: "UPDATE_APPOINTMENT_STATUS", payload: { id: appointment.id, status: "no_show" } });
      syncToDb({ type: "UPDATE_APPOINTMENT_STATUS", payload: { id: appointment.id, status: "no_show" } });
      // Send no-show SMS if enabled
      const _notifPrefsNS = state.settings.notificationPreferences ?? {};
      const _masterNotifNS = state.settings.notificationsEnabled !== false;
      const _smsNoShowOn = (_notifPrefsNS as any).smsClientOnNoShow !== false;
      if (client?.phone && _masterNotifNS && _smsNoShowOn) {
        const biz = state.settings;
        const noShowSlug = biz.customSlug || biz.businessName.replace(/\s+/g, "-").toLowerCase();
        const customNoShowTpl = biz.smsTemplates?.noShow;
        let msg: string;
        if (customNoShowTpl) {
          msg = applyTemplate(customNoShowTpl, {
            clientName: client.name,
            businessName: biz.businessName,
            serviceName: service ? getServiceDisplayName(service) : "service",
            date: formatDateDisplay(appointment.date),
            time: appointment.time,
            bookingUrl: `${PUBLIC_BOOKING_URL}/book/${noShowSlug}${assignedLocation?.id ? "?location=" + assignedLocation.id : ""}`,
          });
        } else {
          msg = `Hi ${client.name}, we noticed you missed your appointment for ${service ? getServiceDisplayName(service) : "your service"} on ${formatDateDisplay(appointment.date)} at ${appointment.time}. We’d love to see you — tap to rebook: ${PUBLIC_BOOKING_URL}/book/${noShowSlug}${assignedLocation?.id ? "?location=" + assignedLocation.id : ""}${LIME_OF_TIME_FOOTER}`;
        }
        const rawPhoneNS = stripPhoneFormat(client.phone);
        if (biz.twilioEnabled && state.businessOwnerId) {
          const toNumberNS = rawPhoneNS.startsWith("+") ? rawPhoneNS : `+1${rawPhoneNS.replace(/\D/g, "")}`;
          sendSmsMutation
            .mutateAsync({ businessOwnerId: state.businessOwnerId, toNumber: toNumberNS, body: msg, smsAction: "rebooking" })
            .catch(() => openSms(client.phone, msg));
        } else {
          openSms(client.phone, msg);
        }
      }
      router.back();
    };
    // Check if Stripe is connected — if so, offer fee charging option
    const stripeConnected = !!(state.settings as any).stripeConnectEnabled;
    if (Platform.OS === "web") {
      doIt();
    } else if (stripeConnected) {
      // Offer to charge a no-show fee via Stripe
      const defaultFee = service ? Math.round((service.price ?? 0) * 0.5 * 100) / 100 : 0;
      Alert.alert(
        "Mark as No-Show",
        `Mark this appointment as no-show?${isGrowthPlan && (state.settings.notificationPreferences as any)?.smsClientOnNoShow !== false ? " An SMS will be sent to " + (client?.name ?? "the client") + " with a rebooking link." : ""}

Would you also like to charge a no-show fee via Stripe?`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "No Fee", style: "default", onPress: doIt },
          {
            text: "Charge Fee",
            style: "destructive",
            onPress: () => {
              doIt();
              setNoShowFeeAmount(String(defaultFee > 0 ? defaultFee : ""));
              setShowNoShowFeeModal(true);
            },
          },
        ]
      );
    } else {
      Alert.alert(
        "Mark as No-Show",
        `Mark this appointment as no-show? ${isGrowthPlan && (state.settings.notificationPreferences as any)?.smsClientOnNoShow !== false ? "An SMS will be sent to " + (client?.name ?? "the client") + " with a rebooking link." : ""}`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Mark No-Show", style: "destructive", onPress: doIt },
        ]
      );
    }
  };

  const handleDelete = () => {
    const doIt = () => {
      dispatch({ type: "DELETE_APPOINTMENT", payload: appointment.id });
      syncToDb({ type: "DELETE_APPOINTMENT", payload: appointment.id });
      router.back();
    };
    if (Platform.OS === "web") {
      doIt();
    } else {
      Alert.alert("Delete Appointment", "This action cannot be undone.", [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: doIt },
      ]);
    }
  };

  const handleSendReminder = () => {
    if (!client?.phone) return;
    const customReminderTpl = biz.smsTemplates?.reminder;
    let msg: string;
    if (customReminderTpl) {
      const slug = biz.customSlug || biz.businessName.replace(/\s+/g, "-").toLowerCase();
      const fullAddr = assignedLocation
        ? formatFullAddress(assignedLocation.address, assignedLocation.city, assignedLocation.state, assignedLocation.zipCode)
        : formatFullAddress(profile.address, profile.city, profile.state, profile.zipCode);
      const locLine = assignedLocation?.name ? (fullAddr ? `${assignedLocation.name} \u2014 ${fullAddr}` : assignedLocation.name) : fullAddr;
      msg = applyTemplate(customReminderTpl, {
        clientName: client.name,
        businessName: biz.businessName,
        serviceName: service ? getServiceDisplayName(service) : "Service",
        duration: String(appointment.duration),
        date: appointment.date,
        time: appointment.time,
        location: locLine,
        phone: formatPhoneNumber(stripPhoneFormat(assignedLocation?.phone || profile.phone)),
        clientPhone: client.phone,
        bookingUrl: `${PUBLIC_BOOKING_URL}/book/${slug}${assignedLocation?.id ? "?location=" + assignedLocation.id : ""}`,
        reviewUrl: `${PUBLIC_BOOKING_URL}/review/${slug}`,
      });
    } else {
      msg = generateReminderMessage(
        biz.businessName,
        assignedLocation?.address || profile.address,
        client.name,
        service ? getServiceDisplayName(service) : "Service",
        appointment.duration,
        appointment.date,
        appointment.time,
        assignedLocation?.phone || profile.phone,
        assignedLocation?.name,
        assignedLocation?.city ?? profile.city,
        assignedLocation?.state ?? profile.state,
        assignedLocation?.zipCode ?? profile.zipCode
      );
    }
    openSms(client.phone, msg);
  };

  const handleOpenMap = () => {
    if (!profile.address) return;
    const url = getMapUrl(profile.address);
    Linking.openURL(url).catch(() => {});
  };

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]} tabletMaxWidth={680}>
      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 24, paddingTop: 8, paddingHorizontal: hp }}>
        <Pressable onPress={() => router.back()} style={({ pressed }) => [{ opacity: pressed ? 0.5 : 1 }]}>
          <IconSymbol name="arrow.left" size={24} color={colors.foreground} />
        </Pressable>
        <Text style={{ fontSize: 20, fontWeight: "700", color: colors.foreground, marginLeft: 16 }}>Appointment</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: hp, paddingBottom: 40 }}>
        {/* Service Card */}
        <View
          className="rounded-2xl p-5 mb-4"
          style={{ backgroundColor: (service?.color ?? colors.primary) + "12" }}
        >
          <View className="flex-row items-center mb-2">
            <View style={[styles.colorDot, { backgroundColor: service?.color ?? colors.primary }]} />
            <Text className="text-xl font-bold text-foreground ml-3">
              {service ? getServiceDisplayName(service) : "Service"}
            </Text>
          </View>
          <Text className="text-sm text-muted">
            {appointment.duration} min · ${appointment.totalPrice != null ? appointment.totalPrice.toFixed(2) : (service?.price ?? 0)}
          </Text>
        </View>

        {/* Itemized Charges */}
        {(() => {
          const extras = appointment.extraItems ?? [];
          const extrasTotal = extras.reduce((s, e) => s + (e.price || 0), 0);
          // Discount
          const discountAmt = appointment.discountAmount ?? 0;
          const discountPct = appointment.discountPercent ?? 0;
          const discountLabel = appointment.discountName || (discountPct > 0 ? `${discountPct}% Off` : "Discount");
          // Gift card
          const giftUsedAmount = appointment.giftUsedAmount ?? 0;
          // Derive the original service price at booking time:
          // If totalPrice is stored, back-calculate: svcPrice = totalPrice + discountAmt + giftUsed - extrasTotal
          // This ensures the service line matches what was actually charged, even if the service price changed later.
          let svcPrice: number;
          if (appointment.totalPrice != null) {
            svcPrice = appointment.totalPrice + discountAmt + giftUsedAmount - extrasTotal;
            // Clamp to 0 in edge cases
            if (svcPrice < 0) svcPrice = service?.price ?? 0;
          } else {
            svcPrice = service?.price ?? 0;
          }
          const subtotal = svcPrice + extrasTotal;
          const afterDiscount = Math.max(0, subtotal - discountAmt);
          let giftDeduction = 0;
          if (appointment.giftApplied) {
            if (giftUsedAmount > 0) {
              giftDeduction = giftUsedAmount;
            } else if (appointment.totalPrice != null) {
              giftDeduction = Math.max(0, afterDiscount - appointment.totalPrice);
            } else {
              giftDeduction = afterDiscount;
            }
          }
          const computedTotal = appointment.totalPrice != null
            ? appointment.totalPrice
            : Math.max(0, afterDiscount - giftDeduction);
          return (
            <View className="bg-surface rounded-2xl p-4 mb-4 border border-border">
              <Text className="text-xs text-muted mb-2">Charges</Text>
              <View className="flex-row justify-between py-1">
                <Text className="text-sm text-foreground">{service ? getServiceDisplayName(service) : "Service"}</Text>
                <Text className="text-sm font-semibold text-foreground">${svcPrice.toFixed(2)}</Text>
              </View>
              {extras.map((item, idx) => (
                <View key={idx} className="flex-row justify-between py-1">
                  <Text className="text-sm text-foreground">{item.name} ({item.type === "product" ? "Product" : "Service"})</Text>
                  <Text className="text-sm font-semibold text-foreground">${(item.price || 0).toFixed(2)}</Text>
                </View>
              ))}
              {extras.length > 0 && (
                <View style={{ borderTopWidth: 1, borderTopColor: colors.border + "40", marginTop: 4, paddingTop: 4 }} className="flex-row justify-between py-1">
                  <Text className="text-sm text-muted">Subtotal</Text>
                  <Text className="text-sm text-muted">${subtotal.toFixed(2)}</Text>
                </View>
              )}
              {discountAmt > 0 && (
                <View className="flex-row justify-between py-1">
                  <Text className="text-sm" style={{ color: '#F59E0B' }}>{discountLabel}</Text>
                  <Text className="text-sm font-semibold" style={{ color: '#F59E0B' }}>-${discountAmt.toFixed(2)}</Text>
                </View>
              )}
              {appointment.giftApplied && giftDeduction > 0 && (
                <View className="flex-row justify-between py-1">
                  <Text className="text-sm" style={{ color: colors.success }}>Gift Card Applied</Text>
                  <Text className="text-sm font-semibold" style={{ color: colors.success }}>-${giftDeduction.toFixed(2)}</Text>
                </View>
              )}
              <View style={{ borderTopWidth: 1, borderTopColor: colors.border, marginTop: 6, paddingTop: 6 }} className="flex-row justify-between">
                <Text className="text-sm font-bold text-foreground">Total Charged</Text>
                <Text className="text-sm font-bold" style={{ color: colors.primary }}>
                  ${computedTotal.toFixed(2)}
                </Text>
              </View>
              {(discountAmt > 0 || giftDeduction > 0) && (
                <View className="flex-row justify-between py-1">
                  <Text className="text-xs" style={{ color: colors.success }}>You Saved</Text>
                  <Text className="text-xs font-semibold" style={{ color: colors.success }}>
                    ${(discountAmt + giftDeduction).toFixed(2)}
                  </Text>
                </View>
              )}
            </View>
          );
        })()}

        {/* Payment Status — shown for all appointments (with or without a pre-set method) */}
        {appointment.status !== 'cancelled' && (
          <View className="bg-surface rounded-2xl p-4 mb-4 border border-border">
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <Text className="text-xs text-muted">Payment</Text>
              <View style={{
                paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20,
                backgroundColor: appointment.paymentStatus === 'paid' ? colors.success + '20' : appointment.paymentStatus === 'pending_cash' ? '#FF980020' : colors.warning + '20',
              }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: appointment.paymentStatus === 'paid' ? colors.success : appointment.paymentStatus === 'pending_cash' ? '#FF9800' : colors.warning }}>
                  {appointment.paymentStatus === 'paid' ? '✓ Paid' : appointment.paymentStatus === 'pending_cash' ? 'Cash — Pending' : 'Unpaid'}
                </Text>
              </View>
            </View>
            {(appointment.totalPrice ?? 0) <= 0 ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <View style={{ backgroundColor: colors.primary + '18', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4, flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <Text style={{ fontSize: 13 }}>🎁</Text>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: colors.primary }}>Complimentary</Text>
                </View>
                <Text style={{ fontSize: 12, color: colors.muted }}>No charge</Text>
              </View>
            ) : appointment.paymentMethod && appointment.paymentMethod !== 'free' ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: appointment.paymentStatus !== 'paid' ? 10 : 0 }}>
                <Text style={{ fontSize: 14, color: colors.foreground }}>
                  {appointment.paymentMethod === 'card' ? '💳 Card' : appointment.paymentMethod === 'zelle' ? '💜 Zelle' : appointment.paymentMethod === 'cashapp' ? '💚 Cash App' : appointment.paymentMethod === 'venmo' ? '💙 Venmo' : '💵 Cash'}
                </Text>
                {appointment.paymentConfirmationNumber && (
                  <Text style={{ fontSize: 12, color: colors.muted }}>Conf# {appointment.paymentConfirmationNumber}</Text>
                )}
              </View>
            ) : null}
            {appointment.clientPaidNotifiedAt && appointment.paymentStatus !== 'paid' && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8, backgroundColor: '#FFF7ED', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: '#FED7AA' }}>
                <Text style={{ fontSize: 13 }}>💰</Text>
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#C2410C', flex: 1 }}>Client says payment was sent</Text>
                <Pressable onPress={() => setShowPaymentModal(true)} style={({ pressed }) => [{ backgroundColor: '#EA580C', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, opacity: pressed ? 0.7 : 1 }]}>
                  <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>Confirm</Text>
                </Pressable>
              </View>
            )}
            {appointment.paymentStatus !== 'paid' && (
              <Pressable
                onPress={() => setShowPaymentModal(true)}
                style={({ pressed }) => [{ backgroundColor: colors.success, borderRadius: 12, paddingVertical: 10, alignItems: 'center', opacity: pressed ? 0.8 : 1 }]}
              >
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>
                  {appointment.paymentMethod === 'cash' ? 'Confirm Cash Received' : 'Mark as Paid'}
                </Text>
              </Pressable>
            )}
            {appointment.paymentStatus === 'paid' && appointment.paymentMethod === 'card' && !appointment.refundedAt && (
              <Pressable
                onPress={() => setShowRefundModal(true)}
                style={({ pressed }) => [{ backgroundColor: '#635BFF15', borderRadius: 12, paddingVertical: 10, alignItems: 'center', marginTop: 8, borderWidth: 1, borderColor: '#635BFF40', opacity: pressed ? 0.7 : 1 }]}
              >
                <Text style={{ color: '#635BFF', fontWeight: '700', fontSize: 14 }}>
                  {refunding ? 'Processing Refund…' : '💳 Issue Refund'}
                </Text>
              </Pressable>
            )}
            {appointment.refundedAt && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, backgroundColor: '#EF444415', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: '#EF444430' }}>
                <Text style={{ fontSize: 13, color: '#EF4444' }}>↩ Refunded</Text>
                {appointment.refundedAmount != null && (
                  <Text style={{ fontSize: 13, color: '#EF4444', fontWeight: '700' }}>${appointment.refundedAmount.toFixed(2)}</Text>
                )}
                <Text style={{ fontSize: 12, color: colors.muted, marginLeft: 'auto' }}>
                  {new Date(appointment.refundedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Status */}
        <View className="bg-surface rounded-2xl p-4 mb-4 border border-border">
          <Text className="text-xs text-muted mb-1">Status</Text>
          <View
            className="self-start rounded-full px-3 py-1"
            style={{
              backgroundColor:
                appointment.status === "completed" ? colors.success + "20"
                : appointment.status === "cancelled" ? colors.error + "20"
                : appointment.status === "pending" ? "#FF980020"
                : colors.primary + "20",
            }}
          >
            <Text
              className="text-sm font-semibold capitalize"
              style={{
                color:
                  appointment.status === "completed" ? colors.success
                  : appointment.status === "cancelled" ? colors.error
                  : appointment.status === "pending" ? "#FF9800"
                  : colors.primary,
              }}
            >
              {appointment.status}
            </Text>
          </View>
        </View>

        {/* Special Requests / Notes */}
        {appointment.notes ? (
          <View
            style={{
              backgroundColor: colors.warning + "18",
              borderColor: colors.warning + "60",
              borderWidth: 1,
              borderRadius: 16,
              padding: 16,
              marginBottom: 16,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
              <IconSymbol name="exclamationmark.triangle.fill" size={16} color={colors.warning} />
              <Text style={{ fontSize: 13, fontWeight: "700", color: colors.warning, marginLeft: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>
                Special Requests
              </Text>
            </View>
            <Text style={{ fontSize: 15, color: colors.foreground, lineHeight: 22 }}>
              {appointment.notes}
            </Text>
          </View>
        ) : null}

        {/* Details */}
        <View className="bg-surface rounded-2xl p-4 mb-4 border border-border">
          <DetailRow icon="calendar" label="Date" value={formatDateDisplay(appointment.date)} colors={colors} />
          <DetailRow
            icon="clock.fill"
            label="Time"
            value={`${formatTime(appointment.time)} - ${endTimeStr}`}
            colors={colors}
          />
          <DetailRow
            icon="person.fill"
            label="Client"
            value={client?.name ?? "Unknown"}
            colors={colors}
            onPress={client ? () => router.push({ pathname: "/client-detail" as any, params: { id: client.id } }) : undefined}
          />
          {client?.phone ? (
            <DetailRow icon="phone.fill" label="Phone" value={formatPhoneNumber(client.phone)} colors={colors} />
          ) : null}
          {assignedStaff ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border + '40' }}>
              {assignedStaff.photoUri ? (
                <Image source={{ uri: assignedStaff.photoUri }} style={{ width: 36, height: 36, borderRadius: 18, marginRight: 10 }} />
              ) : (
                <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: assignedStaff.color || colors.primary, alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>{assignedStaff.name.charAt(0).toUpperCase()}</Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, color: colors.muted, marginBottom: 1 }}>Staff</Text>
                <Text style={{ fontSize: 15, color: colors.foreground, fontWeight: '600' }}>{assignedStaff.name}{assignedStaff.role ? ` · ${assignedStaff.role}` : ''}</Text>
              </View>
            </View>
          ) : null}
          {assignedLocation ? (
            <DetailRow
              icon="location.fill"
              label="Location"
              value={(() => {
                const fullAddr = formatFullAddress(
                  assignedLocation.address || "",
                  assignedLocation.city,
                  assignedLocation.state,
                  assignedLocation.zipCode
                );
                return assignedLocation.name
                  ? (fullAddr ? `${assignedLocation.name}\n${fullAddr}` : assignedLocation.name)
                  : (fullAddr || assignedLocation.address || "");
              })()}
              colors={colors}
              onPress={() => {
                const fullAddr = formatFullAddress(
                  assignedLocation.address || "",
                  assignedLocation.city,
                  assignedLocation.state,
                  assignedLocation.zipCode
                );
                const mapAddr = fullAddr || assignedLocation.address;
                if (mapAddr) Linking.openURL(getMapUrl(mapAddr)).catch(() => {});
              }}
            />
          ) : profile.address ? (
            <DetailRow
              icon="mappin"
              label="Location"
              value={profile.address}
              colors={colors}
              onPress={handleOpenMap}
            />
          ) : null}
        </View>

        {/* Cancellation Policy Info */}
        {policy.enabled && (appointment.status === "confirmed" || appointment.status === "pending") && (
          <View className="bg-surface rounded-2xl p-4 mb-4 border border-border">
            <Text className="text-xs text-muted mb-1">Cancellation Policy</Text>
            <Text className="text-sm text-foreground">
              {policy.feePercentage}% fee if cancelled within {policy.hoursBeforeAppointment} hours of appointment
            </Text>
          </View>
        )}

        {/* Cancellation Reason */}
        {appointment.status === "cancelled" && appointment.cancellationReason ? (
          <View style={{ backgroundColor: colors.error + "12", borderColor: colors.error + "40", borderWidth: 1, borderRadius: 16, padding: 16, marginBottom: 16 }}>
            <Text style={{ fontSize: 11, fontWeight: "700", color: colors.error, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Cancellation Reason</Text>
            <Text style={{ fontSize: 14, color: colors.foreground }}>{appointment.cancellationReason}</Text>
          </View>
        ) : null}
        {/* Notes */}
        {appointment.notes ? (
          <View className="bg-surface rounded-2xl p-4 mb-4 border border-border">
            <Text className="text-xs text-muted mb-1">Notes</Text>
            <Text className="text-sm text-foreground">{appointment.notes}</Text>
          </View>
        ) : null}

        {/* Message Client Button */}
        {client?.phone && (
          <Pressable
            onPress={handleSendReminder}
            style={({ pressed }) => [
              styles.messageBtn,
              { borderColor: colors.primary, opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <IconSymbol name="paperplane.fill" size={18} color={colors.primary} />
            <Text style={[styles.messageBtnText, { color: colors.primary }]}>Send Reminder</Text>
          </Pressable>
        )}

        {/* Actions */}
        {appointment.status === "pending" && (
          <View className="gap-3 mt-2 mb-4">
            <Pressable
              onPress={handleAccept}
              style={({ pressed }) => [styles.actionButton, { backgroundColor: colors.success, opacity: pressed ? 0.8 : 1 }]}
            >
              <IconSymbol name="checkmark" size={20} color="#FFFFFF" />
              <Text className="text-white font-semibold ml-2">Accept Appointment</Text>
            </Pressable>
            <Pressable
              onPress={() => { setReschedDate(appointment.date); setReschedTime(null); setReschedCalMonth(() => { const d = new Date(appointment.date + "T12:00:00"); return { year: d.getFullYear(), month: d.getMonth() }; }); setShowRescheduleModal(true); }}
              style={({ pressed }) => [styles.actionButton, { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 }]}
            >
              <IconSymbol name="calendar" size={20} color="#FFFFFF" />
              <Text className="text-white font-semibold ml-2">Reschedule</Text>
            </Pressable>
            <Pressable
              onPress={() => handleStatusChange("cancelled")}
              style={({ pressed }) => [styles.actionButton, { backgroundColor: colors.error, opacity: pressed ? 0.8 : 1 }]}
            >
              <IconSymbol name="xmark" size={20} color="#FFFFFF" />
              <Text className="text-white font-semibold ml-2">Reject Appointment</Text>
            </Pressable>
          </View>
        )}

        {appointment.status === "confirmed" && (
          <View className="gap-3 mt-2 mb-4">
            <Pressable
              onPress={() => handleStatusChange("completed")}
              style={({ pressed }) => [styles.actionButton, { backgroundColor: colors.success, opacity: pressed ? 0.8 : 1 }]}
            >
              <IconSymbol name="checkmark" size={20} color="#FFFFFF" />
              <Text className="text-white font-semibold ml-2">Mark Complete</Text>
            </Pressable>
            <Pressable
              onPress={() => { setReschedDate(appointment.date); setReschedTime(null); setReschedCalMonth(() => { const d = new Date(appointment.date + "T12:00:00"); return { year: d.getFullYear(), month: d.getMonth() }; }); setShowRescheduleModal(true); }}
              style={({ pressed }) => [styles.actionButton, { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 }]}
            >
              <IconSymbol name="calendar" size={20} color="#FFFFFF" />
              <Text className="text-white font-semibold ml-2">Reschedule</Text>
            </Pressable>
            <Pressable
              onPress={handleNoShow}
              style={({ pressed }) => [styles.actionButton, { backgroundColor: "#F59E0B", opacity: pressed ? 0.8 : 1 }]}
            >
              <IconSymbol name="person.fill.xmark" size={20} color="#FFFFFF" />
              <Text className="text-white font-semibold ml-2">Mark as No-Show{!isGrowthPlan ? " 🔒" : ""}</Text>
            </Pressable>
            <Pressable
              onPress={() => handleStatusChange("cancelled")}
              style={({ pressed }) => [styles.actionButton, { backgroundColor: colors.error, opacity: pressed ? 0.8 : 1 }]}
            >
              <IconSymbol name="xmark" size={20} color="#FFFFFF" />
              <Text className="text-white font-semibold ml-2">Cancel Appointment</Text>
            </Pressable>
          </View>
        )}

        {/* Persistent no-show fee button for already-marked no-show appointments */}
        {appointment.status === "no_show" && !!(state.settings as any).stripeConnectEnabled && (
          <View className="gap-3 mt-2 mb-2">
            <Pressable
              onPress={() => {
                const defaultFee = service ? Math.round((service.price ?? 0) * 0.5 * 100) / 100 : 0;
                setNoShowFeeAmount(String(defaultFee > 0 ? defaultFee : ""));
                setShowNoShowFeeModal(true);
              }}
              style={({ pressed }) => [styles.actionButton, { backgroundColor: "#F59E0B", opacity: pressed ? 0.8 : 1 }]}
            >
              <IconSymbol name="creditcard" size={20} color="#FFFFFF" />
              <Text className="text-white font-semibold ml-2">Charge No-Show Fee</Text>
            </Pressable>
          </View>
        )}

        <Pressable
          onPress={handleDelete}
          style={({ pressed }) => [styles.deleteButton, { borderColor: colors.error, opacity: pressed ? 0.7 : 1 }]}
        >
          <Text className="text-sm font-medium" style={{ color: colors.error }}>Delete Appointment</Text>
        </Pressable>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Payment Confirmation Modal */}
      <Modal visible={showPaymentModal} transparent animationType="slide">
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' }}>
          <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 }}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: colors.foreground, marginBottom: 4 }}>
              Mark as Paid
            </Text>
            <Text style={{ fontSize: 13, color: colors.muted, marginBottom: 16 }}>
              {client?.name ?? 'Client'}{appointment.totalPrice != null ? ` · $${appointment.totalPrice.toFixed(2)}` : ''}
            </Text>

            {/* Method picker — only shown when no method is pre-set */}
            {(!appointment.paymentMethod || appointment.paymentMethod === 'unpaid') && (
              <>
                <Text style={{ fontSize: 12, fontWeight: '600', color: colors.muted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Payment Method</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                  {DETAIL_PAYMENT_METHODS.map((pm) => (
                    <Pressable
                      key={pm.key}
                      onPress={() => setSelectedPayMethod(pm.key)}
                      style={({ pressed }) => [{
                        paddingHorizontal: 16, paddingVertical: 9, borderRadius: 20,
                        backgroundColor: selectedPayMethod === pm.key ? colors.success : colors.background,
                        borderWidth: 1.5,
                        borderColor: selectedPayMethod === pm.key ? colors.success : colors.border,
                        opacity: pressed ? 0.7 : 1,
                      }]}
                    >
                      <Text style={{ fontSize: 14, fontWeight: '700', color: selectedPayMethod === pm.key ? '#FFF' : colors.foreground }}>{pm.label}</Text>
                    </Pressable>
                  ))}
                </View>
              </>
            )}

            {/* Confirmation number for digital methods */}
            {(appointment.paymentMethod ?? selectedPayMethod) !== 'cash' && (
              <TextInput
                value={paymentConfirmInput}
                onChangeText={setPaymentConfirmInput}
                placeholder="Confirmation number (optional)"
                placeholderTextColor={colors.muted}
                style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, fontSize: 14, color: colors.foreground, backgroundColor: colors.background, marginBottom: 16 }}
                returnKeyType="done"
              />
            )}
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                onPress={() => { setShowPaymentModal(false); setPaymentConfirmInput(''); }}
                style={{ flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: colors.border, alignItems: 'center' }}
              >
                <Text style={{ fontSize: 15, fontWeight: '600', color: colors.muted }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleMarkPaid(paymentConfirmInput.trim() || undefined)}
                style={{ flex: 2, paddingVertical: 14, borderRadius: 12, backgroundColor: colors.success, alignItems: 'center' }}
              >
                <Text style={{ fontSize: 15, fontWeight: '700', color: '#FFF' }}>Confirm Paid</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Refund Modal */}
      <Modal visible={showRefundModal} transparent animationType="slide">
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' }}>
          <View style={{ backgroundColor: colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 40 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: colors.foreground }}>💳 Issue Refund</Text>
              <Pressable onPress={() => { setShowRefundModal(false); setRefundAmount(''); }} style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}>
                <IconSymbol name="xmark" size={22} color={colors.muted} />
              </Pressable>
            </View>
            <Text style={{ fontSize: 14, color: colors.muted, marginBottom: 16, lineHeight: 20 }}>
              The refund will be sent to the client's card via Stripe.
            </Text>
            {/* Full Refund quick-tap */}
            <Pressable
              onPress={() => {
                const total = appointment?.totalPrice ?? 0;
                Alert.alert(
                  'Confirm Full Refund',
                  `Issue a full refund of $${total.toFixed(2)} to the client's card?`,
                  [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Refund', style: 'destructive', onPress: () => handleRefund(undefined) },
                  ]
                );
              }}
              disabled={refunding}
              style={({ pressed }) => [{
                backgroundColor: '#635BFF',
                borderRadius: 12,
                paddingVertical: 14,
                alignItems: 'center',
                marginBottom: 12,
                opacity: pressed || refunding ? 0.7 : 1,
              }]}
            >
              <Text style={{ fontSize: 15, fontWeight: '700', color: '#FFF' }}>
                {refunding ? 'Processing…' : `Full Refund · $${(appointment?.totalPrice ?? 0).toFixed(2)}`}
              </Text>
            </Pressable>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
              <Text style={{ fontSize: 12, color: colors.muted }}>or enter partial amount</Text>
              <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
            </View>
            <Text style={{ fontSize: 12, fontWeight: '600', color: colors.muted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Partial Refund Amount</Text>
            <TextInput
              value={refundAmount}
              onChangeText={setRefundAmount}
              placeholder={`Full refund ($${((appointment?.totalPrice ?? 0)).toFixed(2)})`}
              placeholderTextColor={colors.muted}
              keyboardType="decimal-pad"
              returnKeyType="done"
              style={{ backgroundColor: colors.surface, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: colors.foreground, borderWidth: 1, borderColor: colors.border, marginBottom: 20 }}
            />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity
                onPress={() => { setShowRefundModal(false); setRefundAmount(''); }}
                style={{ flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: colors.border, alignItems: 'center' }}
              >
                <Text style={{ fontSize: 15, fontWeight: '600', color: colors.muted }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  const partial = refundAmount.trim() ? parseFloat(refundAmount.trim()) : undefined;
                  if (partial !== undefined && (isNaN(partial) || partial <= 0)) {
                    Alert.alert('Invalid Amount', 'Please enter a valid positive amount or leave blank for full refund.');
                    return;
                  }
                  Alert.alert(
                    'Confirm Refund',
                    partial
                      ? `Issue a $${partial.toFixed(2)} partial refund to the client’s card?`
                      : `Issue a full refund of $${((appointment?.totalPrice ?? 0)).toFixed(2)} to the client’s card?`,
                    [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Refund', style: 'destructive', onPress: () => handleRefund(partial) },
                    ]
                  );
                }}
                disabled={refunding}
                style={{ flex: 2, paddingVertical: 14, borderRadius: 12, backgroundColor: '#635BFF', alignItems: 'center', opacity: refunding ? 0.6 : 1 }}
              >
                <Text style={{ fontSize: 15, fontWeight: '700', color: '#FFF' }}>{refunding ? 'Processing…' : 'Issue Refund'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* No-Show Fee Modal */}
      <Modal visible={showNoShowFeeModal} transparent animationType="slide" onRequestClose={() => setShowNoShowFeeModal(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' }}>
          <View style={{ backgroundColor: colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 40 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: colors.foreground }}>💳 Charge No-Show Fee</Text>
              <Pressable onPress={() => setShowNoShowFeeModal(false)} style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}>
                <IconSymbol name="xmark" size={22} color={colors.muted} />
              </Pressable>
            </View>
            <Text style={{ fontSize: 14, color: colors.muted, marginBottom: 16, lineHeight: 20 }}>
              Charge {client?.name ?? 'the client'} a no-show fee via Stripe. They will receive a secure payment link.
              {service ? ` Suggested: $${Math.round((service.price ?? 0) * 0.5 * 100) / 100} (50% of service price)` : ''}
            </Text>
            <TextInput
              style={{ borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: colors.foreground, borderColor: colors.border, backgroundColor: colors.surface }}
              value={noShowFeeAmount}
              onChangeText={setNoShowFeeAmount}
              placeholder="Fee amount (e.g. 25.00)"
              placeholderTextColor={colors.muted}
              keyboardType="decimal-pad"
              returnKeyType="done"
            />
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
              <TouchableOpacity
                onPress={() => setShowNoShowFeeModal(false)}
                style={{ flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: colors.border, alignItems: 'center' }}
              >
                <Text style={{ fontSize: 15, fontWeight: '600', color: colors.muted }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  const fee = parseFloat(noShowFeeAmount.trim());
                  if (isNaN(fee) || fee <= 0) {
                    Alert.alert('Invalid Amount', 'Please enter a valid fee amount.');
                    return;
                  }
                  Alert.alert(
                    'Confirm No-Show Fee',
                    `Charge ${client?.name ?? 'the client'} a no-show fee of $${fee.toFixed(2)} via Stripe?`,
                    [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Charge', style: 'destructive', onPress: () => handleChargeNoShowFee(fee) },
                    ]
                  );
                }}
                disabled={noShowFeeLoading}
                style={{ flex: 2, paddingVertical: 14, borderRadius: 12, backgroundColor: '#F59E0B', alignItems: 'center', opacity: noShowFeeLoading ? 0.6 : 1 }}
              >
                <Text style={{ fontSize: 15, fontWeight: '700', color: '#FFF' }}>{noShowFeeLoading ? 'Processing…' : 'Send Payment Link'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Reschedule Modal */}
      <Modal visible={showRescheduleModal} transparent animationType="slide">
        <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.45)" }}>
          <View style={{ backgroundColor: colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 40, maxHeight: "85%" }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <Text style={{ fontSize: 18, fontWeight: "700", color: colors.foreground }}>Reschedule Appointment</Text>
              <Pressable onPress={() => setShowRescheduleModal(false)} style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}>
                <IconSymbol name="xmark" size={22} color={colors.muted} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Calendar card */}
              <View style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: colors.border }}>
                {/* Month navigation */}
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                  <Pressable
                    onPress={() => setReschedCalMonth(m => {
                      const d = new Date(m.year, m.month - 1, 1);
                      return { year: d.getFullYear(), month: d.getMonth() };
                    })}
                    style={({ pressed }) => [{ padding: 8, opacity: pressed ? 0.6 : 1, backgroundColor: colors.background, borderRadius: 10 }]}
                  >
                    <IconSymbol name="chevron.left" size={18} color={colors.primary} />
                  </Pressable>
                  <Text style={{ fontSize: 16, fontWeight: "700", color: colors.foreground }}>
                    {new Date(reschedCalMonth.year, reschedCalMonth.month, 1).toLocaleString("default", { month: "long", year: "numeric" })}
                  </Text>
                  <Pressable
                    onPress={() => setReschedCalMonth(m => {
                      const d = new Date(m.year, m.month + 1, 1);
                      return { year: d.getFullYear(), month: d.getMonth() };
                    })}
                    style={({ pressed }) => [{ padding: 8, opacity: pressed ? 0.6 : 1, backgroundColor: colors.background, borderRadius: 10 }]}
                  >
                    <IconSymbol name="chevron.right" size={18} color={colors.primary} />
                  </Pressable>
                </View>

                {/* Day headers */}
                <View style={{ flexDirection: "row", marginBottom: 6 }}>
                  {["Su","Mo","Tu","We","Th","Fr","Sa"].map(d => (
                    <Text key={d} style={{ flex: 1, textAlign: "center", fontSize: 11, fontWeight: "700", color: colors.muted, letterSpacing: 0.3 }}>{d}</Text>
                  ))}
                </View>

                {/* Calendar grid */}
                <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                  {reschedCalDays.map((day, idx) => {
                    if (!day) return <View key={`e${idx}`} style={{ width: "14.28%", height: 40 }} />;
                    const dateStr = `${reschedCalMonth.year}-${String(reschedCalMonth.month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                    const isPast = new Date(dateStr + "T23:59:59") < today;
                    const isSelected = dateStr === reschedDate;
                    const todayStr = today.toISOString().split("T")[0];
                    const isToday = dateStr === todayStr;
                    return (
                      <Pressable
                        key={dateStr}
                        onPress={() => { if (!isPast) { setReschedDate(dateStr); setReschedTime(null); } }}
                        style={({ pressed }) => [{
                          width: "14.28%", height: 40, alignItems: "center", justifyContent: "center",
                          borderRadius: 10,
                          backgroundColor: isSelected ? colors.primary : isToday ? colors.primary + "20" : "transparent",
                          opacity: isPast ? 0.3 : pressed ? 0.7 : 1,
                        }]}
                      >
                        <Text style={{ fontSize: 15, fontWeight: isSelected || isToday ? "700" : "400", color: isSelected ? "#FFF" : isToday ? colors.primary : colors.foreground }}>{day}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {/* Time slots */}
              <Text style={{ fontSize: 13, fontWeight: "700", color: colors.muted, textTransform: "uppercase", letterSpacing: 0.5, marginTop: 20, marginBottom: 10 }}>Available Times</Text>
              {reschedSlots.length === 0 ? (
                <Text style={{ fontSize: 14, color: colors.muted, textAlign: "center", paddingVertical: 16 }}>No available slots on this date</Text>
              ) : (
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
                  {reschedSlots.map(slot => (
                    <Pressable
                      key={slot}
                      onPress={() => setReschedTime(slot)}
                      style={({ pressed }) => [{
                        paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20,
                        backgroundColor: reschedTime === slot ? colors.primary : colors.background,
                        borderWidth: 1.5,
                        borderColor: reschedTime === slot ? colors.primary : colors.border,
                        opacity: pressed ? 0.7 : 1,
                      }]}
                    >
                      <Text style={{ fontSize: 14, fontWeight: "600", color: reschedTime === slot ? "#FFF" : colors.foreground }}>
                        {formatTime(slot)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}

              {/* Confirm button */}
              <View style={{ flexDirection: "row", gap: 12, marginTop: 8 }}>
                <TouchableOpacity
                  onPress={() => setShowRescheduleModal(false)}
                  style={{ flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: colors.border, alignItems: "center" }}
                >
                  <Text style={{ fontSize: 15, fontWeight: "600", color: colors.muted }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleReschedule}
                  disabled={!reschedTime}
                  style={{ flex: 2, paddingVertical: 14, borderRadius: 12, backgroundColor: reschedTime ? colors.primary : colors.border, alignItems: "center" }}
                >
                  <Text style={{ fontSize: 15, fontWeight: "700", color: reschedTime ? "#FFF" : colors.muted }}>Confirm Reschedule</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Cancellation Reason Modal */}
      <Modal visible={cancelReasonModal} transparent animationType="slide">
        <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.45)" }}>
          <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 }}>
            <Text style={{ fontSize: 18, fontWeight: "700", color: colors.foreground, marginBottom: 4 }}>Cancel Appointment</Text>
            <Text style={{ fontSize: 13, color: colors.muted, marginBottom: 20 }}>Select a reason for cancellation</Text>
            {CANCEL_REASONS.map((r) => (
              <TouchableOpacity
                key={r}
                onPress={() => setSelectedReason(r)}
                style={{ flexDirection: "row", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}
              >
                <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: selectedReason === r ? colors.primary : colors.border, alignItems: "center", justifyContent: "center", marginRight: 12 }}>
                  {selectedReason === r && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary }} />}
                </View>
                <Text style={{ fontSize: 15, color: colors.foreground }}>{r}</Text>
              </TouchableOpacity>
            ))}
            {selectedReason === "Other" && (
              <TextInput
                value={customReason}
                onChangeText={setCustomReason}
                placeholder="Describe the reason..."
                placeholderTextColor={colors.muted}
                style={{ marginTop: 12, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, fontSize: 14, color: colors.foreground, backgroundColor: colors.background }}
                multiline
                numberOfLines={2}
              />
            )}
            <View style={{ flexDirection: "row", gap: 12, marginTop: 24 }}>
              <TouchableOpacity
                onPress={() => setCancelReasonModal(false)}
                style={{ flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: colors.border, alignItems: "center" }}
              >
                <Text style={{ fontSize: 15, fontWeight: "600", color: colors.muted }}>Go Back</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  const reason = selectedReason === "Other" ? (customReason.trim() || "Other") : selectedReason;
                  setCancelReasonModal(false);
                  const cancInfo = getCancellationInfo();
                  const proceed = () => {
                    dispatch({ type: "UPDATE_APPOINTMENT_STATUS", payload: { id: appointment.id, status: "cancelled", cancellationReason: reason || undefined } });
                    syncToDb({ type: "UPDATE_APPOINTMENT_STATUS", payload: { id: appointment.id, status: "cancelled", cancellationReason: reason || undefined } });
                    if (client?.phone) {
                      const feeStr = cancInfo.feeApplies && cancInfo.fee > 0 ? `$${cancInfo.fee} (${policy.feePercentage}%)` : "";
                      const msg = generateCancellationMessage(
                        biz.businessName, client.name,
                        service ? getServiceDisplayName(service) : "Service",
                        appointment.date, appointment.time, feeStr,
                        assignedLocation?.phone || profile.phone,
                        assignedLocation?.name,
                        assignedLocation?.address ?? profile.address,
                        assignedLocation?.city ?? profile.city,
                        assignedLocation?.state ?? profile.state,
                        assignedLocation?.zipCode ?? profile.zipCode
                      );
                      openSms(client.phone, msg);
                    }
                    router.back();
                  };
                  if (cancInfo.feeApplies && cancInfo.fee > 0 && Platform.OS !== "web") {
                    Alert.alert("Cancellation Fee", `A fee of $${cancInfo.fee} (${policy.feePercentage}%) applies.`, [
                      { text: "Cancel", style: "cancel" },
                      { text: "Confirm", onPress: proceed },
                    ]);
                  } else {
                    proceed();
                  }
                }}
                style={{ flex: 2, paddingVertical: 14, borderRadius: 12, backgroundColor: colors.error, alignItems: "center" }}
              >
                <Text style={{ fontSize: 15, fontWeight: "700", color: "#FFF" }}>Cancel Appointment</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

function DetailRow({ icon, label, value, colors, onPress }: { icon: any; label: string; value: string; colors: any; onPress?: () => void }) {
  const content = (
    <View className="flex-row items-center py-2">
      <IconSymbol name={icon} size={18} color={colors.muted} />
      <Text className="text-xs text-muted ml-2 w-16">{label}</Text>
      <Text className="text-sm text-foreground flex-1" numberOfLines={2}>{value}</Text>
      {onPress && <IconSymbol name="chevron.right" size={14} color={colors.muted} />}
    </View>
  );
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}>
        {content}
      </Pressable>
    );
  }
  return content;
}

const styles = StyleSheet.create({
  colorDot: { width: 14, height: 14, borderRadius: 7 },
  actionButton: { width: "100%", flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 14, borderRadius: 14, minHeight: 52 },
  deleteButton: { width: "100%", alignItems: "center", justifyContent: "center", paddingVertical: 12, borderRadius: 14, borderWidth: 1, minHeight: 48 },
  messageBtn: { width: "100%", flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 14, borderRadius: 14, borderWidth: 1.5, marginBottom: 12, minHeight: 52 },
  messageBtnText: { fontSize: 15, fontWeight: "600", marginLeft: 8 },
});
