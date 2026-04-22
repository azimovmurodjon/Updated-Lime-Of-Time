export interface Service {
  id: string;
  name: string;
  duration: number; // in minutes
  price: number;
  color: string;
  description?: string; // optional description shown on booking page detail sheet
  category?: string; // service category for grouping
  photoUri?: string; // optional photo shown on booking page
  locationIds?: string[] | null; // null = all locations
  reminderHours?: number | null; // override global SMS reminder timing for this service (null = use global)
  createdAt: string;
}

export interface Client {
  id: string;
  name: string;
  phone: string;
  email: string;
  notes: string;
  birthday: string; // MM-DD format, e.g. "03-15" for March 15 (empty string = not set)
  createdAt: string;
}

/** A before/after photo attached to a client profile */
export interface ClientPhoto {
  id: string;
  clientId: string;
  uri: string; // local file URI or base64 data URI
  label: "before" | "after" | "other";
  note: string;
  takenAt: string; // ISO date string
  /** Optional service this photo is tagged to (e.g. "Balayage") */
  serviceId?: string;
  serviceName?: string;
}

export interface ServicePhoto {
  id: string;
  serviceId: string;
  uri: string; // local file URI or base64 data URI
  label: "before" | "after" | "other";
  note: string;
  takenAt: string; // ISO date string
}

export type AppointmentStatus = "pending" | "confirmed" | "completed" | "cancelled" | "no_show";

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
  /** Reason for cancellation (set when status changes to 'cancelled') */
  cancellationReason?: string;
  /** Payment method chosen: zelle | venmo | cashapp | cash | card | unpaid */
  paymentMethod?: "zelle" | "venmo" | "cashapp" | "cash" | "card" | "unpaid" | "free";
  /** Payment status: unpaid | pending_cash | paid */
  paymentStatus?: "unpaid" | "pending_cash" | "paid";
  /** Confirmation number provided by business owner after receiving digital payment */
  paymentConfirmationNumber?: string;
  /** ISO timestamp when payment was confirmed */
  paymentConfirmedAt?: string;
  /** ISO timestamp when a Stripe refund was issued */
  refundedAt?: string;
  /** Amount refunded in dollars */
  refundedAmount?: number;
  /** Stripe refund ID */
  stripeRefundId?: string;
  /** ISO timestamp when client tapped 'I Sent Payment' on the manage page */
  clientPaidNotifiedAt?: string;
  /** Client-submitted cancellation request */
  cancelRequest?: {
    status: 'pending' | 'approved' | 'declined';
    reason?: string;
    submittedAt: string;
    resolvedAt?: string;
  } | null;
  /** Client-submitted reschedule request */
  rescheduleRequest?: {
    status: 'pending' | 'approved' | 'declined';
    requestedDate: string;
    requestedTime: string;
    reason?: string;
    submittedAt: string;
    resolvedAt?: string;
  } | null;
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
  /** Optional max number of uses; discount auto-deactivates when reached */
  maxUses?: number | null;
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
  brand?: string; // product brand for grouping
  category?: string; // product category for grouping
  photoUri?: string; // optional photo shown on booking page
  available: boolean;
  createdAt: string;
}

export interface Location {
  id: string;
  name: string;
  address: string;
  city?: string;
  state?: string;
  zipCode?: string;
  phone: string;
  email: string;
  isDefault: boolean;
  active: boolean;
  /** When true, the location is paused for new bookings without being fully deactivated */
  temporarilyClosed?: boolean;
  /** ISO date string YYYY-MM-DD: if set, location auto-reopens on this date */
  reopenOn?: string;
  /** ISO date string YYYY-MM-DD: if set, this location stops accepting bookings after this date */
  activeUntil?: string;
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
  locationIds: string[] | null; // null = all locations
  workingHours: Record<string, WorkingHours> | null; // null = use business hours
  active: boolean;
  createdAt: string;
  /** Commission rate as a percentage (0-100). e.g. 40 means staff earns 40% of service revenue */
  commissionRate?: number | null;
  /** Profile photo URI (local file URI or remote URL) */
  photoUri?: string | null;
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

/** Reusable appointment note template saved per client or globally */
export interface NoteTemplate {
  id: string;
  title: string; // short label e.g. "Prefers no heat styling"
  body: string;  // full note text
  createdAt: string;
}

/** A service bundle / package deal — multiple services sold together at a discounted price */
export interface ServicePackage {
  id: string;
  name: string;
  description: string;
  /** Service localIds included in this package */
  serviceIds: string[];
  /** Total price for the bundle (should be less than sum of individual prices) */
  price: number;
  /** Optional number of sessions (e.g. 5-session package) */
  sessions?: number;
  /** Whether this package is currently active / available for booking */
  active: boolean;
  /** Optional expiry in days from purchase date (null = no expiry) */
  expiryDays?: number | null;
  createdAt: string;
}

/** Waitlist entry for a fully-booked time slot */
export interface WaitlistEntry {
  id: string;
  clientName: string;
  clientPhone: string;
  serviceId: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  locationId?: string;
  staffId?: string;
  createdAt: string;
  notified: boolean; // true once we've sent the "slot available" SMS
}

/** A referral or promotional code that gives clients a discount at checkout */
export interface PromoCode {
  id: string;
  code: string; // e.g. "SUMMER20"
  label: string; // e.g. "Summer Referral"
  percentage: number; // 0-100; if 0, use flatAmount
  flatAmount?: number | null; // flat dollar discount
  maxUses?: number | null; // null = unlimited
  usedCount: number;
  expiresAt?: string | null; // YYYY-MM-DD
  active: boolean;
  createdAt: string;
}

export interface CustomScheduleDay {
  date: string; // YYYY-MM-DD
  isOpen: boolean;
  startTime?: string; // HH:MM
  endTime?: string; // HH:MM
  /** When set, this override applies only to this location. Null/undefined = global override. */
  locationId?: string | null;
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
  /** City — stored alongside address for full-address SMS fallback */
  city?: string;
  /** State/Province — stored alongside address for full-address SMS fallback */
  state?: string;
  /** ZIP code — stored alongside address for full-address SMS fallback */
  zipCode?: string;
  description: string;
  website: string;
  /** Zelle phone/email handle for payment SMS */
  zelleHandle?: string;
  /** Cash App $handle for payment SMS */
  cashAppHandle?: string;
  /** Venmo @handle for payment SMS */
  venmoHandle?: string;
}

export interface CancellationPolicy {
  enabled: boolean;
  hoursBeforeAppointment: number; // e.g. 2 hours
  feePercentage: number; // e.g. 50 means 50% of service price
}

/** Per-event notification preferences for the business owner */
export interface NotificationPreferences {
  /** Push notification on new booking request */
  pushOnNewBooking: boolean;
  /** Push notification on client cancellation */
  pushOnCancellation: boolean;
  /** Push notification on client reschedule */
  pushOnReschedule: boolean;
  /** Push notification on waitlist entry */
  pushOnWaitlist: boolean;
  /** Email notification to business owner on new booking request */
  emailOnNewBooking: boolean;
  /** Email confirmation to client when business owner accepts appointment */
  emailClientOnConfirmation: boolean;
  /** Daily push notification listing clients with birthdays today */
  birthdayReminderEnabled?: boolean;
  /** Hour (0-23) at which the daily birthday reminder fires. Default 8 (8 AM) */
  birthdayReminderHour?: number;
  /** Email reminder sent to the client before their confirmed appointment */
  emailOnReminder?: boolean;
  /** How many hours before the appointment to send the client reminder email.
   * Options: 12, 24, 48, 72, 168 (1 week). Default: 24. */
  reminderHoursBefore?: number;
  /** SMS to client when appointment is confirmed by owner */
  smsClientOnConfirmation?: boolean;
  /** SMS to client when appointment is cancelled */
  smsClientOnCancellation?: boolean;
  /** Email to client when appointment is cancelled */
  emailClientOnCancellation?: boolean;
  /** Email to client when appointment is marked completed */
  emailClientOnComplete?: boolean;
  /** SMS to client when appointment is marked as no-show */
  smsClientOnNoShow?: boolean;
  /** Email to client when owner marks appointment as paid (payment receipt) */
  emailClientOnPaymentConfirmed?: boolean;
}

/** Per-event SMS message templates. Each key maps to a custom message body.
 * The "Lime Of Time" footer is always appended automatically and cannot be removed.
 */
export interface SmsTemplates {
  confirmation?: string;   // sent when owner confirms/accepts appointment
  reminder?: string;       // sent as upcoming reminder
  cancellation?: string;   // sent when appointment is cancelled
  completed?: string;      // sent when appointment is marked complete
  newBooking?: string;     // sent to owner on new booking request (internal)
  followUp?: string;       // sent as a follow-up / re-booking nudge from client page
  noShow?: string;         // sent when appointment is marked as no-show
}
export const DEFAULT_SMS_TEMPLATES: SmsTemplates = {
  confirmation: undefined,
  reminder: undefined,
  cancellation: undefined,
  completed: undefined,
  newBooking: undefined,
  followUp: undefined,
  noShow: undefined,
};

export const LIME_OF_TIME_FOOTER = "\n\nSent via Lime Of Time";

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  pushOnNewBooking: false,
  pushOnCancellation: false,
  pushOnReschedule: false,
  pushOnWaitlist: false,
  emailOnNewBooking: false,
  emailClientOnConfirmation: false,
  birthdayReminderEnabled: false,
  birthdayReminderHour: 8,
  emailOnReminder: false,
  reminderHoursBefore: 24,
  smsClientOnConfirmation: true,
  smsClientOnCancellation: true,
  emailClientOnCancellation: false,
  emailClientOnComplete: false,
  smsClientOnNoShow: true,
  emailClientOnPaymentConfirmed: false,
};

export interface BusinessSettings {
  businessName: string;
  defaultDuration: number;
  notificationsEnabled: boolean;
  notificationPreferences: NotificationPreferences;
  workingHours: Record<string, WorkingHours>;
  profile: BusinessProfile;
  themeMode: "light" | "dark" | "system";
  cancellationPolicy: CancellationPolicy;
  onboardingComplete: boolean;
  temporaryClosed: boolean;
  businessLogoUri: string; // local URI for custom uploaded logo
  scheduleMode: "weekly" | "custom"; // which schedule drives availability
  bufferTime: number; // minutes between appointments (0 = no buffer)
  slotInterval: number; // time slot step in minutes (5, 10, 15, 30) — 0 means auto (match service duration, capped at 30)
  customSlug: string; // custom booking page slug
  businessHoursEndDate: string | null; // ISO date string "YYYY-MM-DD" or null for open-ended
  autoCompleteEnabled: boolean; // automatically mark appointments as completed after end time + delay
  autoCompleteDelayMinutes: number; // minutes after appointment end time to auto-complete (5, 10, 15, 30)
  smsTemplates: SmsTemplates; // custom SMS message templates per event type
  monthlyRevenueGoal: number; // monthly revenue target in dollars (0 = no goal set)
  staffAlertThreshold: number; // completion rate % below which staff alert fires (0 = disabled)
  // Twilio SMS integration (all optional so existing settings objects remain valid)
  twilioAccountSid?: string; // Twilio Account SID (starts with AC)
  twilioAuthToken?: string; // Twilio Auth Token
  twilioFromNumber?: string; // Twilio phone number in E.164 format e.g. +14124827733
  twilioEnabled?: boolean; // master on/off switch for Twilio SMS sending
  twilioBookingReminder?: boolean; // send reminder SMS before appointment
  twilioReminderHoursBeforeAppt?: number; // hours before appointment to send reminder (e.g. 24)
  twilioRebookingNudge?: boolean; // send rebooking nudge after appointment
  twilioRebookingNudgeDays?: number; // days after appointment to send rebooking nudge
  twilioBirthdaySms?: boolean; // send birthday SMS to clients
  // Email notification preferences (all optional so existing settings remain valid)
  emailNotifNewBooking?: boolean;    // receive email when a new booking is made
  emailNotifCancellation?: boolean;  // receive email when a booking is cancelled
  emailNotifReschedule?: boolean;    // receive email when a booking is rescheduled
  emailNotifReminder?: boolean;      // receive daily summary email of upcoming appointments
  emailNotifReview?: boolean;        // receive email when a client leaves a review
  emailNotifPayment?: boolean;       // receive email when a payment is received
  // Payment methods for booking page
  zelleHandle?: string; // Zelle phone/email handle
  cashAppHandle?: string; // CashApp $handle (include the $)
  venmoHandle?: string; // Venmo @handle (include the @)
  paymentNotes?: string; // free-text payment instructions shown on booking page
  // Social media handles
  instagramHandle?: string; // Instagram username (without @)
  facebookHandle?: string; // Facebook page name or URL slug
  tiktokHandle?: string; // TikTok username (without @)
  // Request response window
  requestResponseWindowHours?: number; // hours before a pending cancel/reschedule request auto-expires (default: 48)
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
  enabled: false,
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

// ─── Address Formatting ────────────────────────────────────────────────
/**
 * Formats separate address components into a single clean address string.
 * e.g. "123 S Main St", "Pittsburgh", "PA", "15220" → "123 S Main St, Pittsburgh, PA 15220"
 */
export function formatFullAddress(
  address: string,
  city?: string,
  state?: string,
  zipCode?: string
): string {
  const streetPart = address?.trim() || "";
  const stateZip = [state?.trim(), zipCode?.trim()].filter(Boolean).join(" ");
  const cityStatePart = [city?.trim(), stateZip].filter(Boolean).join(", ");
  return [streetPart, cityStatePart].filter(Boolean).join(", ");
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
  // Filter out past times for today (using device local time, which is always correct on-device)
  // Only show slots that start strictly in the future (current minute is already in progress)
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
    const slotStart = timeToMinutes(slot);
    const slotEnd = slotStart + serviceDuration;
    return !dayAppointments.some((a) => {
      const apptStart = timeToMinutes(a.time);
      const apptEnd = apptStart + a.duration;
      // Block if the new slot overlaps the appointment window expanded by buffer on both sides:
      // - slot must not start within bufferTime minutes before the appointment ends
      // - slot must not end within bufferTime minutes after the appointment starts
      return slotStart < (apptEnd + bufferTime) && slotEnd > (apptStart - bufferTime);
    });
  });
}

/** Generate available time slots for a given date, considering working hours, custom schedule overrides, existing appointments, and past-time filtering.
 *  When scheduleMode is "custom", ONLY custom schedule entries are used (no weekly fallback).
 *  When scheduleMode is "weekly" (default), custom overrides take precedence for specific dates, then weekly hours are used. */
export function generateAvailableSlots(
  date: string,
  serviceDuration: number,
  workingHours: Record<string, WorkingHours> | null | undefined,
  appointments: Appointment[],
  stepMinutes: number = 30,
  customSchedule?: CustomScheduleDay[],
  scheduleMode: "weekly" | "custom" = "weekly",
  bufferTime: number = 0
): string[] {
  // Guard: if workingHours is null/undefined, fall back to DEFAULT_WORKING_HOURS
  const resolvedWorkingHours: Record<string, WorkingHours> = workingHours ?? DEFAULT_WORKING_HOURS;
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
      // Workday is ON with explicit custom hours — use them regardless of weekly schedule
      const startMin = timeToMinutes(customDay.startTime);
      const endMin = timeToMinutes(customDay.endTime);
      const slots: string[] = [];
      for (let min = startMin; min + serviceDuration <= endMin; min += stepMinutes) {
        slots.push(minutesToTime(min));
      }
      return filterSlots(slots, date, serviceDuration, appointments, bufferTime);
    }
    // Workday is ON but no explicit hours set — use weekly hours as fallback.
    // IMPORTANT: we still proceed even if the weekly day is normally disabled,
    // because the Workday override explicitly opens this date.
    const dateObj2 = new Date(date + "T12:00:00");
    const dayIndex2 = dateObj2.getDay();
    const dayName2 = DAYS_OF_WEEK[dayIndex2];
    const wh2 = resolvedWorkingHours[dayName2] || resolvedWorkingHours[dayName2.toLowerCase()];
    const fallbackStart = wh2?.start ?? "09:00";
    const fallbackEnd = wh2?.end ?? "17:00";
    const startMin2 = timeToMinutes(fallbackStart);
    const endMin2 = timeToMinutes(fallbackEnd);
    const slots2: string[] = [];
    for (let min = startMin2; min + serviceDuration <= endMin2; min += stepMinutes) {
      slots2.push(minutesToTime(min));
    }
    return filterSlots(slots2, date, serviceDuration, appointments, bufferTime);
  }

  // Fall back to weekly working hours
  // Guard: if date is empty or invalid, getDay() returns NaN and DAYS_OF_WEEK[NaN] is undefined
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return [];
  const dateObj = new Date(date + "T12:00:00");
  const dayIndex = dateObj.getDay();
  const dayName = DAYS_OF_WEEK[dayIndex];
  if (!dayName) return []; // safety guard for invalid date
  const wh = resolvedWorkingHours[dayName] || resolvedWorkingHours[dayName.toLowerCase()];
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
  serviceId: string,
  appointments?: { discountName?: string; status?: string }[]
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
    // Check maxUses: count all appointments (any status except cancelled) that used this discount
    if (disc.maxUses != null && appointments) {
      const usedCount = appointments.filter(
        (a) => a.discountName === disc.name && a.status !== "cancelled"
      ).length;
      if (usedCount >= disc.maxUses) continue;
    }
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
  clientPhone?: string,
  locationName?: string,
  locationId?: string,
  customSlug?: string,
  city?: string,
  state?: string,
  zipCode?: string
): string {
  const endTime = formatTimeDisplay(minutesToTime(timeToMinutes(time) + serviceDuration));
  const slug = customSlug || businessName.replace(/\s+/g, "-").toLowerCase();
  const reviewParams = new URLSearchParams();
  if (clientName) reviewParams.set("name", clientName);
  if (clientPhone) reviewParams.set("phone", stripPhoneFormat(clientPhone));
  const reviewUrl = `${PUBLIC_BOOKING_URL}/review/${slug}${reviewParams.toString() ? "?" + reviewParams.toString() : ""}`;
  const fullAddr = formatFullAddress(address, city, state, zipCode);
  const locationLine = locationName
    ? (fullAddr ? `${locationName} — ${fullAddr}` : locationName)
    : fullAddr;
  const bookingUrl = locationId
    ? `${PUBLIC_BOOKING_URL}/book/${slug}?location=${locationId}`
    : `${PUBLIC_BOOKING_URL}/book/${slug}`;
  return `Dear ${clientName},\n\nYour appointment has been confirmed!\n\n📋 Service: ${serviceName} (${serviceDuration} min)\n📅 Date: ${formatDateLong(date)}\n⏰ Time: ${formatTimeDisplay(time)} - ${endTime}\n📍 Location: ${locationLine}\n🏢 Business: ${businessName}\n📞 Contact: ${formatPhoneNumber(stripPhoneFormat(businessPhone))}\n\nPlease arrive 5 minutes early. If you need to reschedule or cancel, please contact us at least 2 hours before your appointment.\n\n🔗 Book again: ${bookingUrl}\n⭐ After your visit, leave a review: ${reviewUrl}\n\nThank you for choosing ${businessName}!`;
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
  appointmentId?: string,
  locationName?: string,
  locationId?: string,
  customSlug?: string,
  city?: string,
  state?: string,
  zipCode?: string,
  zelleHandle?: string,
  cashAppHandle?: string,
  venmoHandle?: string
): string {
  const endTime = formatTimeDisplay(minutesToTime(timeToMinutes(time) + serviceDuration));
  const slug = customSlug || businessName.replace(/\s+/g, "-").toLowerCase();
  const reviewParams = new URLSearchParams();
  if (clientName) reviewParams.set("name", clientName);
  if (clientPhone) reviewParams.set("phone", stripPhoneFormat(clientPhone));
  const reviewUrl = `${PUBLIC_BOOKING_URL}/review/${slug}${reviewParams.toString() ? "?" + reviewParams.toString() : ""}`;
  const manageUrl = appointmentId ? `${PUBLIC_BOOKING_URL}/manage/${slug}/${appointmentId}` : "";
  const fullAddr = formatFullAddress(address, city, state, zipCode);
  const locationLine = locationName
    ? (fullAddr ? `${locationName} — ${fullAddr}` : locationName)
    : fullAddr;
  // Build payment handles line
  const paymentLines: string[] = [];
  if (zelleHandle) paymentLines.push(`💳 Zelle: ${zelleHandle}`);
  if (cashAppHandle) paymentLines.push(`💵 Cash App: ${cashAppHandle}`);
  if (venmoHandle) paymentLines.push(`💸 Venmo: ${venmoHandle}`);
  const paymentSection = paymentLines.length > 0
    ? `\n\n💰 Payment Options:\n${paymentLines.join("\n")}`
    : "";
  return `Dear ${clientName},\n\nGreat news! Your appointment request has been accepted.\n\n📋 Service: ${serviceName} (${serviceDuration} min)\n📅 Date: ${formatDateLong(date)}\n⏰ Time: ${formatTimeDisplay(time)} - ${endTime}\n📍 Location: ${locationLine}\n🏢 Business: ${businessName}\n📞 Contact: ${formatPhoneNumber(stripPhoneFormat(businessPhone))}${paymentSection}\n\nPlease arrive 5 minutes early.${manageUrl ? `\n\n🔄 Need to reschedule or cancel? Use this link (available 24+ hours before your appointment):\n${manageUrl}` : ""}\n\n⭐ After your visit, leave a review: ${reviewUrl}\n\nWe look forward to seeing you!\n${businessName}`;
}

/** Generate professional appointment rejection message */
export function generateRejectMessage(
  businessName: string,
  clientName: string,
  serviceName: string,
  date: string,
  time: string,
  businessPhone: string,
  locationName?: string,
  locationAddress?: string,
  locationCity?: string,
  locationState?: string,
  locationZip?: string
): string {
  const fullAddr = formatFullAddress(locationAddress ?? "", locationCity, locationState, locationZip);
  const locationLine = locationName
    ? (fullAddr ? `${locationName} — ${fullAddr}` : locationName)
    : fullAddr;
  const locationRow = locationLine ? `\n📍 Location: ${locationLine}` : "";
  return `Dear ${clientName},\n\nWe regret to inform you that your appointment request could not be accommodated at this time.\n\n📋 Service: ${serviceName}\n📅 Requested Date: ${formatDateLong(date)}\n⏰ Requested Time: ${formatTimeDisplay(time)}${locationRow}\n\nWe apologize for any inconvenience. Please feel free to book another available time slot through our scheduling page or contact us directly.\n\n📞 Contact: ${formatPhoneNumber(stripPhoneFormat(businessPhone))}\n\nThank you for your understanding.\n${businessName}`;
}

/** Generate professional cancellation message */
export function generateCancellationMessage(
  businessName: string,
  clientName: string,
  serviceName: string,
  date: string,
  time: string,
  cancellationFee: string,
  businessPhone: string,
  locationName?: string,
  locationAddress?: string,
  locationCity?: string,
  locationState?: string,
  locationZip?: string
): string {
  const feeNote = cancellationFee
    ? `\n\n⚠️ Cancellation Fee: ${cancellationFee}\nAs per our cancellation policy, a fee applies for cancellations made within the required notice period.`
    : "";
  const fullAddr = formatFullAddress(locationAddress ?? "", locationCity, locationState, locationZip);
  const locationLine = locationName
    ? (fullAddr ? `${locationName} — ${fullAddr}` : locationName)
    : fullAddr;
  const locationRow = locationLine ? `\n📍 Location: ${locationLine}` : "";
  return `Dear ${clientName},\n\nYour appointment has been cancelled.\n\n📋 Service: ${serviceName}\n📅 Date: ${formatDateLong(date)}\n⏰ Time: ${formatTimeDisplay(time)}${locationRow}${feeNote}\n\nIf you would like to reschedule, please visit our booking page or contact us directly.\n\n📞 Contact: ${formatPhoneNumber(stripPhoneFormat(businessPhone))}\n\nThank you.\n${businessName}`;
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
  businessPhone: string,
  locationName?: string,
  city?: string,
  state?: string,
  zipCode?: string
): string {
  const endTime = formatTimeDisplay(minutesToTime(timeToMinutes(time) + serviceDuration));
  const fullAddr = formatFullAddress(address, city, state, zipCode);
  const locationLine = locationName
    ? (fullAddr ? `${locationName} — ${fullAddr}` : locationName)
    : fullAddr;
  return `Dear ${clientName},\n\nThis is a friendly reminder about your upcoming appointment.\n\n📋 Service: ${serviceName} (${serviceDuration} min)\n📅 Date: ${formatDateLong(date)}\n⏰ Time: ${formatTimeDisplay(time)} - ${endTime}\n📍 Location: ${locationLine}\n🏢 Business: ${businessName}\n📞 Contact: ${formatPhoneNumber(stripPhoneFormat(businessPhone))}\n\nPlease arrive 5 minutes early. If you need to reschedule or cancel, please contact us as soon as possible.\n\nSee you soon!\n${businessName}`;
}

/** Public booking URL base — DO NOT CHANGE. Production domain is lime-of-time.com */
export const PUBLIC_BOOKING_URL = "https://lime-of-time.com";

/** Generate the correct public booking link for a business */
export function getBookingUrl(businessName: string, customSlug?: string): string {
  const slug = customSlug || businessName.replace(/\s+/g, "-").toLowerCase();
  return `${PUBLIC_BOOKING_URL}/book/${slug}`;
}

/** Generate the correct public review link for a business */
export function getReviewUrl(businessName: string, customSlug?: string): string {
  const slug = customSlug || businessName.replace(/\s+/g, "-").toLowerCase();
  return `${PUBLIC_BOOKING_URL}/review/${slug}`;
}

/** Generate the correct public gift card link */
export function getGiftUrl(code: string): string {
  return `${PUBLIC_BOOKING_URL}/gift/${code}`;
}
