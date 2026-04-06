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

export type AppointmentStatus = "confirmed" | "completed" | "cancelled";

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

export interface BusinessSettings {
  businessName: string;
  defaultDuration: number;
  notificationsEnabled: boolean;
  workingHours: Record<string, WorkingHours>; // key: 'monday', 'tuesday', etc.
  profile: BusinessProfile;
}

export const SERVICE_COLORS = [
  "#4CAF50",
  "#2E7D32",
  "#8BC34A",
  "#FF9800",
  "#2196F3",
  "#9C27B0",
];

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
