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

/** Public booking URL base */
export const PUBLIC_BOOKING_URL = "http://limeoftime.com";
