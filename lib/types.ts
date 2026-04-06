export interface Service {
  id: string;
  name: string;
  duration: number; // in minutes
  price: number;
  color: string;
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
}

export interface Review {
  id: string;
  clientId: string;
  appointmentId?: string;
  rating: number; // 1-5
  comment: string;
  createdAt: string;
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

// ─── Phone Formatting ──────────────────────────────────────────────
/** Format a phone number to (000) 000-0000 format */
export function formatPhoneNumber(value: string): string {
  // Strip all non-digit characters
  const digits = value.replace(/\D/g, "");
  // Limit to 10 digits
  const limited = digits.slice(0, 10);
  if (limited.length === 0) return "";
  if (limited.length <= 3) return `(${limited}`;
  if (limited.length <= 6) return `(${limited.slice(0, 3)}) ${limited.slice(3)}`;
  return `(${limited.slice(0, 3)}) ${limited.slice(3, 6)}-${limited.slice(6)}`;
}

/** Strip phone formatting to get raw digits */
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

/** Generate available time slots for a given date, considering working hours, existing appointments, and past-time filtering */
export function generateAvailableSlots(
  date: string,
  serviceDuration: number,
  workingHours: Record<string, WorkingHours>,
  appointments: Appointment[],
  stepMinutes: number = 30
): string[] {
  const dateObj = new Date(date + "T12:00:00");
  const dayIndex = dateObj.getDay();
  const dayName = DAYS_OF_WEEK[dayIndex];
  const wh = workingHours[dayName];
  if (!wh || !wh.enabled) return [];

  const startMin = timeToMinutes(wh.start);
  const endMin = timeToMinutes(wh.end);
  const slots: string[] = [];

  for (let min = startMin; min + serviceDuration <= endMin; min += stepMinutes) {
    slots.push(minutesToTime(min));
  }

  // Filter out past times for today
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  if (date === todayStr) {
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const filtered = slots.filter((s) => timeToMinutes(s) > currentMinutes);
    slots.length = 0;
    slots.push(...filtered);
  }

  // Filter out slots that overlap with existing non-cancelled appointments (including pending/confirmed)
  const dayAppointments = appointments.filter(
    (a) => a.date === date && a.status !== "cancelled"
  );

  return slots.filter((slot) => {
    return !dayAppointments.some((a) =>
      timeSlotsOverlap(slot, serviceDuration, a.time, a.duration)
    );
  });
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
  businessPhone: string
): string {
  const endTime = formatTimeDisplay(minutesToTime(timeToMinutes(time) + serviceDuration));
  return `Dear ${clientName},\n\nYour appointment has been confirmed!\n\n📋 Service: ${serviceName} (${serviceDuration} min)\n📅 Date: ${formatDateLong(date)}\n⏰ Time: ${formatTimeDisplay(time)} - ${endTime}\n📍 Location: ${address}\n🏢 Business: ${businessName}\n📞 Contact: ${formatPhoneNumber(stripPhoneFormat(businessPhone))}\n\nPlease arrive 5 minutes early. If you need to reschedule or cancel, please contact us at least 2 hours before your appointment.\n\nThank you for choosing ${businessName}!`;
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
  businessPhone: string
): string {
  const endTime = formatTimeDisplay(minutesToTime(timeToMinutes(time) + serviceDuration));
  const mapUrl = getMapUrl(address);
  return `Dear ${clientName},\n\nGreat news! Your appointment request has been accepted.\n\n📋 Service: ${serviceName} (${serviceDuration} min)\n📅 Date: ${formatDateLong(date)}\n⏰ Time: ${formatTimeDisplay(time)} - ${endTime}\n📍 Location: ${address}\n🗺️ Map: ${mapUrl}\n🏢 Business: ${businessName}\n📞 Contact: ${formatPhoneNumber(stripPhoneFormat(businessPhone))}\n\nPlease arrive 5 minutes early. If you need to reschedule or cancel, please contact us at least 2 hours before your appointment.\n\nWe look forward to seeing you!\n${businessName}`;
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
  const mapUrl = getMapUrl(address);
  return `Dear ${clientName},\n\nThis is a friendly reminder about your upcoming appointment.\n\n📋 Service: ${serviceName} (${serviceDuration} min)\n📅 Date: ${formatDateLong(date)}\n⏰ Time: ${formatTimeDisplay(time)} - ${endTime}\n📍 Location: ${address}\n🗺️ Map: ${mapUrl}\n🏢 Business: ${businessName}\n📞 Contact: ${formatPhoneNumber(stripPhoneFormat(businessPhone))}\n\nPlease arrive 5 minutes early. If you need to reschedule or cancel, please contact us as soon as possible.\n\nSee you soon!\n${businessName}`;
}

/** Public booking URL base */
export const PUBLIC_BOOKING_URL = "http://limeoftime.com";
