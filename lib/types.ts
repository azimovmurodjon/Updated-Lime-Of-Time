export interface Service {
  id: string;
  name: string;
  duration: number; // in minutes
  price: number;
  color: string;
  category?: string; // service category for grouping
  createdAt: string;
}

export interface Client {
  id: string;
  name: string;
  phone: string;
  email: string;
  notes: string;
  createdAt: string;
}

export type AppointmentStatus = "pending" | "confirmed" | "completed" | "cancelled";

export interface AppointmentExtraItem {
  type: "service" | "product";
  id: string;
  name: string;
  price: number;
  duration: number;
}

export interface Appointment {
  id: string;
  serviceId: string;
  clientId: string;
  date: string; // ISO date string YYYY-MM-DD
  time: string; // HH:MM format
  duration: number; // in minutes
  status: AppointmentStatus;
  notes: string;
  createdAt: string;
  /** Total price including primary service + extra items. Falls back to service price if not set. */
  totalPrice?: number;
  /** Structured list of extra items (services/products) added to this appointment */
  extraItems?: AppointmentExtraItem[];
  /** Whether a gift card was applied to this appointment */
  giftApplied?: boolean;
  /** Amount deducted from gift card balance for this appointment */
  giftUsedAmount?: number;
  /** Staff member assigned to this appointment */
  staffId?: string;
  /** Discount percentage applied (0-100) */
  discountPercent?: number;
  /** Discount amount deducted */
  discountAmount?: number;
  /** Discount name/label */
  discountName?: string;
  /** Location assigned to this appointment */
  locationId?: string;
}

export interface Review {
  id: string;
  clientId: string;
  appointmentId?: string;
  rating: number; // 1-5
  comment: string;
  createdAt: string;
}

export interface Discount {
  id: string;
  name: string;
  percentage: number; // 0-100
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  daysOfWeek: string[]; // legacy, kept for backward compat
  dates: string[]; // specific dates YYYY-MM-DD (future dates only)
  serviceIds: string[] | null; // null = all services
  productIds?: string[] | null; // null = all products, [] = no products
  active: boolean;
  createdAt: string;
}

export interface GiftCard {
  id: string;
  code: string;
  serviceLocalId: string; // primary service (backward compat)
  serviceIds?: string[]; // multiple services
  productIds?: string[]; // products included
  /** Total monetary value of the gift card when created */
  originalValue: number;
  /** Remaining balance (decreases with each use, 0 = fully redeemed) */
  remainingBalance: number;
  recipientName: string;
  recipientPhone: string;
  message: string;
  redeemed: boolean;
  redeemedAt?: string;
  expiresAt?: string;
  createdAt: string;
}

export interface Product {
  id: string;
  name: string;
  price: number;
  description: string;
  available: boolean;
  createdAt: string;
}

export interface Location {
  id: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  isDefault: boolean;
  active: boolean;
  workingHours: Record<string, WorkingHours> | null; // null = use business hours
  createdAt: string;
}

export const LOCATION_COLORS = [
  "#3B82F6", // blue
  "#10B981", // emerald
  "#F59E0B", // amber
  "#EF4444", // red
  "#8B5CF6", // violet
  "#EC4899", // pink
];

export interface StaffMember {
  id: string;
  name: string;
  phone: string;
  email: string;
  role: string;
  color: string;
  serviceIds: string[] | null; // null = all services
  workingHours: Record<string, WorkingHours> | null; // null = use business hours
  active: boolean;
  createdAt: string;
}

export const STAFF_COLORS = [
  "#3B82F6", // blue
  "#EF4444", // red
  "#10B981", // emerald
  "#F59E0B", // amber
  "#8B5CF6", // violet
  "#EC4899", // pink
  "#06B6D4", // cyan
  "#F97316", // orange
];

export interface CustomScheduleDay {
  date: string; // YYYY-MM-DD
  isOpen: boolean;
  startTime?: string; // HH:MM
  endTime?: string; // HH:MM
}

export interface WorkingHours {
  enabled: boolean;
  start: string; // HH:MM
  end: string; // HH:MM
}

export interface BusinessProfile {
  ownerName: string;
  phone: string;
  email: string;
  address: string;
  description: string;
  website: string;
}

export interface CancellationPolicy {
  enabled: boolean;
  hoursBeforeAppointment: number; // e.g. 2 hours
  feePercentage: number; // e.g. 50 means 50% of service price
}

export interface BusinessSettings {
  businessName: string;
  defaultDuration: number;
  notificationsEnabled: boolean;
  workingHours: Record<string, WorkingHours>;
  profile: BusinessProfile;
  themeMode: "light" | "dark" | "system";
  cancellationPolicy: CancellationPolicy;
  onboardingComplete: boolean;
  temporaryClosed: boolean;
  businessLogoUri: string; // local URI for custom uploaded logo
  scheduleMode: "weekly" | "custom"; // which schedule drives availability
  bufferTime: number; // minutes between appointments (0 = no buffer)
  customSlug: string; // custom booking page slug
}

export const SERVICE_COLORS = [
  "#4CAF50",
  "#2E7D32",
  "#8BC34A",
  "#FF9800",
  "#2196F3",
  "#9C27B0",
];

export const DEFAULT_CANCELLATION_POLICY: CancellationPolicy = {
  enabled: true,
  hoursBeforeAppointment: 2,
  feePercentage: 50,
};

export const DEFAULT_BUSINESS_PROFILE: BusinessProfile = {
  ownerName: "",
  phone: "",
  email: "",
  address: "",
  description: "",
  website: "",
};

export const DEFAULT_WORKING_HOURS: Record<string, WorkingHours> = {
  monday: { enabled: true, start: "09:00", end: "17:00" },
  tuesday: { enabled: true, start: "09:00", end: "17:00" },
  wednesday: { enabled: true, start: "09:00", end: "17:00" },
  thursday: { enabled: true, start: "09:00", end: "17:00" },
  friday: { enabled: true, start: "09:00", end: "17:00" },
  saturday: { enabled: false, start: "10:00", end: "14:00" },
  sunday: { enabled: false, start: "10:00", end: "14:00" },
};

export const DAYS_OF_WEEK = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

// ─── Phone Normalization ────────────────────────────────────────────────
/** Normalize a phone number to 10-digit US format for consistent matching.
 *  "4124820000" -> "4124820000"
 *  "+14124820000" -> "4124820000"
 *  "14124820000" -> "4124820000"
 *  "(412) 482-0000" -> "4124820000" */
export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) {
    return digits.slice(1);
  }
  if (digits.length === 10) {
    return digits;
  }
  return digits;
}

// ─── Phone Formatting ────────────────────────────────────────────────────
/** Format a phone number to (000) 000-0000 or +1 (000) 000-0000 format.
 *  Handles US numbers with or without country code (+1 or leading 1). */
export function formatPhoneNumber(value: string): string {
  // Strip all non-digit characters
  let digits = value.replace(/\D/g, "");
  // Detect +1 prefix in original value
  const hasPlus1 = value.replace(/\s/g, "").startsWith("+1");
  // If 11 digits starting with 1, or original had +1, treat as US +1 number
  let prefix = "";
  if (hasPlus1 || (digits.length === 11 && digits.startsWith("1"))) {
    prefix = "+1 ";
    // Strip the leading country code 1
    if (digits.startsWith("1") && digits.length > 10) {
      digits = digits.slice(1);
    }
  }
  // Limit to 10 digits (the local part)
  const limited = digits.slice(0, 10);
  if (limited.length === 0) return prefix ? "+1" : "";
  if (limited.length <= 3) return `${prefix}(${limited}`;
  if (limited.length <= 6) return `${prefix}(${limited.slice(0, 3)}) ${limited.slice(3)}`;
  return `${prefix}(${limited.slice(0, 3)}) ${limited.slice(3, 6)}-${limited.slice(6)}`;
}

/** Strip phone formatting to get raw digits (keeps country code digit if present) */
export function stripPhoneFormat(formatted: string): string {
  return formatted.replace(/\D/g, "");
}

// ─── Map URL Helper ────────────────────────────────────────────────
/** Generate a map URL that opens in the device's default map app */
export function getMapUrl(address: string): string {
  const encoded = encodeURIComponent(address);
  return `https://maps.google.com/?q=${encoded}`;
}

// ─── Time Helpers ───────────────────────────────────────────────────
export function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Check if two time ranges overlap: [startA, startA+durA) vs [startB, startB+durB) */
export function timeSlotsOverlap(
  startA: string,
  durationA: number,
  startB: string,
  durationB: number
): boolean {
  const aStart = timeToMinutes(startA);
  const aEnd = aStart + durationA;
  const bStart = timeToMinutes(startB);
  const bEnd = bStart + durationB;
  return aStart < bEnd && bStart < aEnd;
}

/** Filter slots by past times and existing appointments (with optional buffer time) */
function filterSlots(
  slots: string[],
  date: string,
  serviceDuration: number,
  appointments: Appointment[],
  bufferTime: number = 0
): string[] {
  let filtered = [...slots];
  // Filter out past times for today
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  if (date === todayStr) {
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    filtered = filtered.filter((s) => timeToMinutes(s) > currentMinutes);
  }
  // Filter out slots that overlap with existing non-cancelled appointments
  const dayAppointments = appointments.filter(
    (a) => a.date === date && a.status !== "cancelled"
  );
  return filtered.filter((slot) => {
    return !dayAppointments.some((a) =>
      // Check overlap including buffer time: the new slot needs serviceDuration,
      // and existing appointments occupy their duration + buffer on each side
      timeSlotsOverlap(slot, serviceDuration, a.time, a.duration + bufferTime)
    );
  });
}

/** Generate available time slots for a given date, considering working hours, custom schedule overrides, existing appointments, and past-time filtering.
 *  When scheduleMode is "custom", ONLY custom schedule entries are used (no weekly fallback).
 *  When scheduleMode is "weekly" (default), custom overrides take precedence for specific dates, then weekly hours are used. */
export function generateAvailableSlots(
  date: string,
  serviceDuration: number,
  workingHours: Record<string, WorkingHours>,
  appointments: Appointment[],
  stepMinutes: number = 30,
  customSchedule?: CustomScheduleDay[],
  scheduleMode: "weekly" | "custom" = "weekly",
  bufferTime: number = 0
): string[] {
  const customDay = customSchedule?.find((cs) => cs.date === date);

  if (scheduleMode === "custom") {
    // In custom mode, ONLY custom schedule entries matter — no weekly fallback
    if (!customDay) return []; // No custom entry for this date = closed
    if (!customDay.isOpen) return []; // Explicitly closed
    if (customDay.startTime && customDay.endTime) {
      const startMin = timeToMinutes(customDay.startTime);
      const endMin = timeToMinutes(customDay.endTime);
      const slots: string[] = [];
      for (let min = startMin; min + serviceDuration <= endMin; min += stepMinutes) {
        slots.push(minutesToTime(min));
      }
      return filterSlots(slots, date, serviceDuration, appointments, bufferTime);
    }
    return []; // Custom entry exists but no hours set
  }

  // Weekly mode: custom overrides take precedence for specific dates
  if (customDay) {
    if (!customDay.isOpen) return [];
    if (customDay.startTime && customDay.endTime) {
      const startMin = timeToMinutes(customDay.startTime);
      const endMin = timeToMinutes(customDay.endTime);
      const slots: string[] = [];
      for (let min = startMin; min + serviceDuration <= endMin; min += stepMinutes) {
        slots.push(minutesToTime(min));
      }
      return filterSlots(slots, date, serviceDuration, appointments, bufferTime);
    }
  }

  // Fall back to weekly working hours
  const dateObj = new Date(date + "T12:00:00");
  const dayIndex = dateObj.getDay();
  const dayName = DAYS_OF_WEEK[dayIndex];
  const wh = workingHours[dayName] || workingHours[dayName.toLowerCase()];
  if (!wh || !wh.enabled) return [];

  const startMin = timeToMinutes(wh.start);
  const endMin = timeToMinutes(wh.end);
  const slots: string[] = [];

  for (let min = startMin; min + serviceDuration <= endMin; min += stepMinutes) {
    slots.push(minutesToTime(min));
  }

  return filterSlots(slots, date, serviceDuration, appointments, bufferTime);
}

/** Get applicable discount for a given time slot, date, and service */
export function getApplicableDiscount(
  discounts: Discount[],
  date: string,
  time: string,
  serviceId: string
): Discount | null {
  const dateObj = new Date(date + "T12:00:00");
  const dayIndex = dateObj.getDay();
  const dayName = DAYS_OF_WEEK[dayIndex];
  const timeMin = timeToMinutes(time);

  for (const disc of discounts) {
    if (!disc.active) continue;
    // Check specific dates first (new system)
    if (disc.dates && disc.dates.length > 0) {
      if (!disc.dates.includes(date)) continue;
    } else if (disc.daysOfWeek.length > 0) {
      // Legacy: check day of week
      if (!disc.daysOfWeek.includes(dayName)) continue;
    }
    // Check time window
    const discStart = timeToMinutes(disc.startTime);
    const discEnd = timeToMinutes(disc.endTime);
    if (timeMin < discStart || timeMin >= discEnd) continue;
    // Check service filter
    if (disc.serviceIds && disc.serviceIds.length > 0 && !disc.serviceIds.includes(serviceId)) continue;
    return disc;
  }
  return null;
}

/** Generate a unique gift card code */
export function generateGiftCardCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "GIFT-";
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/** Generate all time options for a scrolling time picker (every 30 min from 00:00 to 23:30) */
export function generateAllTimeOptions(): string[] {
  const options: string[] = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 30) {
      options.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
  }
  return options;
}

/** Format a date string for display in messages: "Monday, January 15, 2026" */
export function formatDateLong(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/** Format time for display: "9:00 AM" */
export function formatTimeDisplay(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")} ${ampm}`;
}

/** Get service display name with duration: "Haircut (20 min)" */
export function getServiceDisplayName(service: Service): string {
  return `${service.name} (${service.duration} min)`;
}

/** Check if a date string is in the past (before today) */
export function isDateInPast(dateStr: string): boolean {
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  return dateStr < todayStr;
}

/** Generate professional appointment confirmation message */
export function generateConfirmationMessage(
  businessName: string,
  address: string,
  clientName: string,
  serviceName: string,
  serviceDuration: number,
  date: string,
  time: string,
  businessPhone: string,
  clientPhone?: string
): string {
  const endTime = formatTimeDisplay(minutesToTime(timeToMinutes(time) + serviceDuration));
  const slug = businessName.replace(/\s+/g, "-").toLowerCase();
  const reviewParams = new URLSearchParams();
  if (clientName) reviewParams.set("name", clientName);
  if (clientPhone) reviewParams.set("phone", stripPhoneFormat(clientPhone));
  const reviewUrl = `${PUBLIC_BOOKING_URL}/review/${slug}${reviewParams.toString() ? "?" + reviewParams.toString() : ""}`;
  return `Dear ${clientName},\n\nYour appointment has been confirmed!\n\n📋 Service: ${serviceName} (${serviceDuration} min)\n📅 Date: ${formatDateLong(date)}\n⏰ Time: ${formatTimeDisplay(time)} - ${endTime}\n📍 Location: ${address}\n🏢 Business: ${businessName}\n📞 Contact: ${formatPhoneNumber(stripPhoneFormat(businessPhone))}\n\nPlease arrive 5 minutes early. If you need to reschedule or cancel, please contact us at least 2 hours before your appointment.\n\n⭐ After your visit, leave a review: ${reviewUrl}\n\nThank you for choosing ${businessName}!`;
}

/** Generate professional appointment request accepted message */
export function generateAcceptMessage(
  businessName: string,
  address: string,
  clientName: string,
  serviceName: string,
  serviceDuration: number,
  date: string,
  time: string,
  businessPhone: string,
  clientPhone?: string,
  appointmentId?: string
): string {
  const endTime = formatTimeDisplay(minutesToTime(timeToMinutes(time) + serviceDuration));
  const slug = businessName.replace(/\s+/g, "-").toLowerCase();
  const reviewParams = new URLSearchParams();
  if (clientName) reviewParams.set("name", clientName);
  if (clientPhone) reviewParams.set("phone", stripPhoneFormat(clientPhone));
  const reviewUrl = `${PUBLIC_BOOKING_URL}/review/${slug}${reviewParams.toString() ? "?" + reviewParams.toString() : ""}`;
  const manageUrl = appointmentId ? `${PUBLIC_BOOKING_URL}/manage/${slug}/${appointmentId}` : "";
  return `Dear ${clientName},\n\nGreat news! Your appointment request has been accepted.\n\n📋 Service: ${serviceName} (${serviceDuration} min)\n📅 Date: ${formatDateLong(date)}\n⏰ Time: ${formatTimeDisplay(time)} - ${endTime}\n📍 Location: ${address}\n🏢 Business: ${businessName}\n📞 Contact: ${formatPhoneNumber(stripPhoneFormat(businessPhone))}\n\nPlease arrive 5 minutes early.${manageUrl ? `\n\n🔄 Need to reschedule or cancel? Use this link (available 24+ hours before your appointment):\n${manageUrl}` : ""}\n\n⭐ After your visit, leave a review: ${reviewUrl}\n\nWe look forward to seeing you!\n${businessName}`;
}

/** Generate professional appointment rejection message */
export function generateRejectMessage(
  businessName: string,
  clientName: string,
  serviceName: string,
  date: string,
  time: string,
  businessPhone: string
): string {
  return `Dear ${clientName},\n\nWe regret to inform you that your appointment request could not be accommodated at this time.\n\n📋 Service: ${serviceName}\n📅 Requested Date: ${formatDateLong(date)}\n⏰ Requested Time: ${formatTimeDisplay(time)}\n\nWe apologize for any inconvenience. Please feel free to book another available time slot through our scheduling page or contact us directly.\n\n📞 Contact: ${formatPhoneNumber(stripPhoneFormat(businessPhone))}\n\nThank you for your understanding.\n${businessName}`;
}

/** Generate professional cancellation message */
export function generateCancellationMessage(
  businessName: string,
  clientName: string,
  serviceName: string,
  date: string,
  time: string,
  cancellationFee: string,
  businessPhone: string
): string {
  const feeNote = cancellationFee
    ? `\n\n⚠️ Cancellation Fee: ${cancellationFee}\nAs per our cancellation policy, a fee applies for cancellations made within the required notice period.`
    : "";
  return `Dear ${clientName},\n\nYour appointment has been cancelled.\n\n📋 Service: ${serviceName}\n📅 Date: ${formatDateLong(date)}\n⏰ Time: ${formatTimeDisplay(time)}${feeNote}\n\nIf you would like to reschedule, please visit our booking page or contact us directly.\n\n📞 Contact: ${formatPhoneNumber(stripPhoneFormat(businessPhone))}\n\nThank you.\n${businessName}`;
}

/** Generate professional upcoming reminder message */
export function generateReminderMessage(
  businessName: string,
  address: string,
  clientName: string,
  serviceName: string,
  serviceDuration: number,
  date: string,
  time: string,
  businessPhone: string
): string {
  const endTime = formatTimeDisplay(minutesToTime(timeToMinutes(time) + serviceDuration));
  return `Dear ${clientName},\n\nThis is a friendly reminder about your upcoming appointment.\n\n📋 Service: ${serviceName} (${serviceDuration} min)\n📅 Date: ${formatDateLong(date)}\n⏰ Time: ${formatTimeDisplay(time)} - ${endTime}\n📍 Location: ${address}\n🏢 Business: ${businessName}\n📞 Contact: ${formatPhoneNumber(stripPhoneFormat(businessPhone))}\n\nPlease arrive 5 minutes early. If you need to reschedule or cancel, please contact us as soon as possible.\n\nSee you soon!\n${businessName}`;
}

/** Public booking URL base */
export const PUBLIC_BOOKING_URL = "https://lime-of-time.com";
