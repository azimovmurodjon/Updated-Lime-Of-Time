import { Text, View, Pressable, StyleSheet, ScrollView, Alert, Platform, Linking, Modal, TextInput, TouchableOpacity, Image } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useStore, formatTime, formatDateDisplay } from "@/lib/store";
import { useColors } from "@/hooks/use-colors";
import { useResponsive } from "@/hooks/use-responsive";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { FuturisticBackground } from "@/components/futuristic-background";

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

  const appointment = useMemo(
    () => state.appointments.find((a) => a.id === id),
    [state.appointments, id]
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
          assignedLocation?.zipCode ?? profile.zipCode
        );
      }
      openSms(client.phone, msg);
    }
    router.back();
  };

  const [cancelReasonModal, setCancelReasonModal] = useState(false);
  const [selectedReason, setSelectedReason] = useState("");
  const [customReason, setCustomReason] = useState("");
  const DETAIL_PAYMENT_METHODS = [
    { key: 'cash' as const, label: 'Cash' },
    { key: 'zelle' as const, label: 'Zelle' },
    { key: 'venmo' as const, label: 'Venmo' },
    { key: 'cashapp' as const, label: 'Card' },
  ];
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentConfirmInput, setPaymentConfirmInput] = useState("");
  const [selectedPayMethod, setSelectedPayMethod] = useState<'cash' | 'zelle' | 'venmo' | 'cashapp'>(
    (appointment?.paymentMethod && appointment.paymentMethod !== 'unpaid' ? appointment.paymentMethod : 'cash') as 'cash' | 'zelle' | 'venmo' | 'cashapp'
  );

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
    // Send payment receipt SMS to client
    if (client?.phone) {
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
      if (client?.phone) {
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
            {appointment.paymentMethod && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: appointment.paymentStatus !== 'paid' ? 10 : 0 }}>
                <Text style={{ fontSize: 14, color: colors.foreground }}>
                  {appointment.paymentMethod === 'zelle' ? '💜 Zelle' : appointment.paymentMethod === 'cashapp' ? '💚 Cash App' : appointment.paymentMethod === 'venmo' ? '💙 Venmo' : '💵 Cash'}
                </Text>
                {appointment.paymentConfirmationNumber && (
                  <Text style={{ fontSize: 12, color: colors.muted }}>Conf# {appointment.paymentConfirmationNumber}</Text>
                )}
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
              onPress={() => handleStatusChange("cancelled")}
              style={({ pressed }) => [styles.actionButton, { backgroundColor: colors.error, opacity: pressed ? 0.8 : 1 }]}
            >
              <IconSymbol name="xmark" size={20} color="#FFFFFF" />
              <Text className="text-white font-semibold ml-2">Cancel Appointment</Text>
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
