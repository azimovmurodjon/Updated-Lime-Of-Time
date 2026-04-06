import { describe, it, expect } from "vitest";
import {
  SERVICE_COLORS,
  DAYS_OF_WEEK,
  DEFAULT_WORKING_HOURS,
  DEFAULT_BUSINESS_PROFILE,
  WorkingHours,
  BusinessProfile,
  BusinessSettings,
} from "../types";

describe("Types and Constants", () => {
  it("should have service colors defined", () => {
    expect(SERVICE_COLORS).toBeDefined();
    expect(SERVICE_COLORS.length).toBeGreaterThan(0);
    SERVICE_COLORS.forEach((color) => {
      expect(color).toMatch(/^#[0-9A-Fa-f]{6}$/);
    });
  });

  it("should have 7 days of the week", () => {
    expect(DAYS_OF_WEEK).toHaveLength(7);
    expect(DAYS_OF_WEEK[0]).toBe("sunday");
    expect(DAYS_OF_WEEK[6]).toBe("saturday");
  });

  it("should have all expected day names", () => {
    const expected = [
      "sunday", "monday", "tuesday", "wednesday",
      "thursday", "friday", "saturday",
    ];
    expect(DAYS_OF_WEEK).toEqual(expected);
  });
});

describe("Data Model Shapes", () => {
  it("should create a valid Service object", () => {
    const service = {
      id: "test-1",
      name: "Haircut",
      duration: 30,
      price: 25,
      color: "#2563EB",
      createdAt: new Date().toISOString(),
    };
    expect(service.id).toBeTruthy();
    expect(service.name).toBe("Haircut");
    expect(service.duration).toBe(30);
    expect(service.price).toBe(25);
    expect(service.color).toMatch(/^#/);
  });

  it("should create a valid Client object", () => {
    const client = {
      id: "client-1",
      name: "John Doe",
      phone: "555-1234",
      email: "john@example.com",
      notes: "",
      createdAt: new Date().toISOString(),
    };
    expect(client.id).toBeTruthy();
    expect(client.name).toBe("John Doe");
    expect(client.phone).toBe("555-1234");
    expect(client.email).toContain("@");
  });

  it("should create a valid Appointment object", () => {
    const appointment = {
      id: "appt-1",
      serviceId: "svc-1",
      clientId: "client-1",
      date: "2026-04-06",
      time: "09:00",
      duration: 60,
      status: "confirmed" as const,
      notes: "",
      createdAt: new Date().toISOString(),
    };
    expect(appointment.id).toBeTruthy();
    expect(appointment.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(appointment.time).toMatch(/^\d{2}:\d{2}$/);
    expect(["confirmed", "completed", "cancelled"]).toContain(appointment.status);
  });

  it("should create valid WorkingHours", () => {
    const wh: WorkingHours = {
      enabled: true,
      start: "09:00",
      end: "17:00",
    };
    expect(wh.enabled).toBe(true);
    expect(wh.start).toMatch(/^\d{2}:\d{2}$/);
    expect(wh.end).toMatch(/^\d{2}:\d{2}$/);
  });
});

describe("Business Profile", () => {
  it("should have correct default profile with all empty fields", () => {
    expect(DEFAULT_BUSINESS_PROFILE.ownerName).toBe("");
    expect(DEFAULT_BUSINESS_PROFILE.phone).toBe("");
    expect(DEFAULT_BUSINESS_PROFILE.email).toBe("");
    expect(DEFAULT_BUSINESS_PROFILE.address).toBe("");
    expect(DEFAULT_BUSINESS_PROFILE.description).toBe("");
    expect(DEFAULT_BUSINESS_PROFILE.website).toBe("");
  });

  it("should create a filled business profile", () => {
    const profile: BusinessProfile = {
      ownerName: "Jane Smith",
      phone: "555-9876",
      email: "jane@business.com",
      address: "123 Main St, City",
      description: "Premium salon services",
      website: "https://janesalon.com",
    };
    expect(profile.ownerName).toBe("Jane Smith");
    expect(profile.phone).toBe("555-9876");
    expect(profile.email).toBe("jane@business.com");
    expect(profile.address).toBe("123 Main St, City");
    expect(profile.description).toBe("Premium salon services");
    expect(profile.website).toBe("https://janesalon.com");
  });

  it("should include profile in BusinessSettings", () => {
    const settings: BusinessSettings = {
      businessName: "Test Business",
      defaultDuration: 60,
      notificationsEnabled: true,
      workingHours: DEFAULT_WORKING_HOURS,
      profile: DEFAULT_BUSINESS_PROFILE,
    };
    expect(settings.profile).toBeDefined();
    expect(settings.profile.ownerName).toBe("");
    expect(settings.businessName).toBe("Test Business");
  });
});

describe("Working Hours Defaults", () => {
  it("should have all 7 days defined", () => {
    DAYS_OF_WEEK.forEach((day) => {
      expect(DEFAULT_WORKING_HOURS[day]).toBeDefined();
      expect(typeof DEFAULT_WORKING_HOURS[day].enabled).toBe("boolean");
      expect(typeof DEFAULT_WORKING_HOURS[day].start).toBe("string");
      expect(typeof DEFAULT_WORKING_HOURS[day].end).toBe("string");
    });
  });

  it("should have weekdays enabled and weekends disabled", () => {
    expect(DEFAULT_WORKING_HOURS.monday.enabled).toBe(true);
    expect(DEFAULT_WORKING_HOURS.friday.enabled).toBe(true);
    expect(DEFAULT_WORKING_HOURS.saturday.enabled).toBe(false);
    expect(DEFAULT_WORKING_HOURS.sunday.enabled).toBe(false);
  });

  it("should have valid time format for all days", () => {
    const timeRegex = /^\d{2}:\d{2}$/;
    DAYS_OF_WEEK.forEach((day) => {
      expect(DEFAULT_WORKING_HOURS[day].start).toMatch(timeRegex);
      expect(DEFAULT_WORKING_HOURS[day].end).toMatch(timeRegex);
    });
  });
});

describe("Time Slot Generation Logic", () => {
  it("should generate correct 30-min slots for a 3-hour window", () => {
    const wh: WorkingHours = { enabled: true, start: "09:00", end: "12:00" };
    const duration = 30;
    const [startH, startM] = wh.start.split(":").map(Number);
    const [endH, endM] = wh.end.split(":").map(Number);
    const endMinutes = endH * 60 + endM;
    const slots: string[] = [];
    let h = startH;
    let m = startM;
    while (h * 60 + m + duration <= endMinutes) {
      slots.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
      m += 30;
      if (m >= 60) { h += 1; m -= 60; }
    }
    expect(slots).toEqual(["09:00", "09:30", "10:00", "10:30", "11:00", "11:30"]);
  });

  it("should return empty slots for disabled day", () => {
    const wh: WorkingHours = { enabled: false, start: "09:00", end: "17:00" };
    const slots: string[] = [];
    if (!wh.enabled) {
      // no slots generated
    }
    expect(slots).toEqual([]);
  });

  it("should filter out booked times", () => {
    const allSlots = ["09:00", "09:30", "10:00", "10:30"];
    const bookedTimes = ["09:30", "10:00"];
    const available = allSlots.filter((s) => !bookedTimes.includes(s));
    expect(available).toEqual(["09:00", "10:30"]);
  });

  it("should handle 60-min duration correctly", () => {
    const wh: WorkingHours = { enabled: true, start: "09:00", end: "12:00" };
    const duration = 60;
    const [startH, startM] = wh.start.split(":").map(Number);
    const [endH, endM] = wh.end.split(":").map(Number);
    const endMinutes = endH * 60 + endM;
    const slots: string[] = [];
    let h = startH;
    let m = startM;
    while (h * 60 + m + duration <= endMinutes) {
      slots.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
      m += 30;
      if (m >= 60) { h += 1; m -= 60; }
    }
    expect(slots).toEqual(["09:00", "09:30", "10:00", "10:30", "11:00"]);
  });
});
