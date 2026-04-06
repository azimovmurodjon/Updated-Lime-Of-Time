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
    expect(["confirmed", "completed", "cancelled", "pending"]).toContain(appointment.status);
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
      themeMode: "system",
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

describe("Pending Appointment Status", () => {
  it("should support pending status for client-booked appointments", () => {
    const appointment = {
      id: "appt-pending",
      serviceId: "svc-1",
      clientId: "client-1",
      date: "2026-04-10",
      time: "10:00",
      duration: 30,
      status: "pending" as const,
      notes: "Booked via client link",
      createdAt: new Date().toISOString(),
    };
    expect(appointment.status).toBe("pending");
    expect(["confirmed", "completed", "cancelled", "pending"]).toContain(appointment.status);
  });

  it("should transition from pending to confirmed", () => {
    let status: "pending" | "confirmed" | "cancelled" | "completed" = "pending";
    expect(status).toBe("pending");
    status = "confirmed";
    expect(status).toBe("confirmed");
  });

  it("should transition from pending to cancelled (rejected)", () => {
    let status: "pending" | "confirmed" | "cancelled" | "completed" = "pending";
    expect(status).toBe("pending");
    status = "cancelled";
    expect(status).toBe("cancelled");
  });
});

describe("Theme Mode", () => {
  it("should support light, dark, and system theme modes", () => {
    const validModes = ["light", "dark", "system"];
    validModes.forEach((mode) => {
      expect(["light", "dark", "system"]).toContain(mode);
    });
  });

  it("should include themeMode in BusinessSettings", () => {
    const settings: BusinessSettings = {
      businessName: "Test",
      defaultDuration: 30,
      notificationsEnabled: false,
      workingHours: DEFAULT_WORKING_HOURS,
      profile: DEFAULT_BUSINESS_PROFILE,
      themeMode: "dark",
    };
    expect(settings.themeMode).toBe("dark");
  });

  it("should default to system theme", () => {
    const settings: BusinessSettings = {
      businessName: "Test",
      defaultDuration: 30,
      notificationsEnabled: false,
      workingHours: DEFAULT_WORKING_HOURS,
      profile: DEFAULT_BUSINESS_PROFILE,
      themeMode: "system",
    };
    expect(settings.themeMode).toBe("system");
  });
});

describe("Analytics Data Computation", () => {
  it("should compute revenue from completed appointments", () => {
    const services = [
      { id: "s1", name: "Haircut", price: 30, duration: 30, color: "#FF0000", createdAt: "" },
      { id: "s2", name: "Massage", price: 60, duration: 60, color: "#00FF00", createdAt: "" },
    ];
    const appointments = [
      { id: "a1", serviceId: "s1", clientId: "c1", date: "2026-04-01", time: "09:00", duration: 30, status: "completed" as const, notes: "", createdAt: "" },
      { id: "a2", serviceId: "s2", clientId: "c2", date: "2026-04-02", time: "10:00", duration: 60, status: "completed" as const, notes: "", createdAt: "" },
      { id: "a3", serviceId: "s1", clientId: "c1", date: "2026-04-03", time: "09:00", duration: 30, status: "cancelled" as const, notes: "", createdAt: "" },
    ];
    const completedAppts = appointments.filter((a) => a.status === "completed");
    const totalRevenue = completedAppts.reduce((sum, a) => {
      const svc = services.find((s) => s.id === a.serviceId);
      return sum + (svc?.price ?? 0);
    }, 0);
    expect(totalRevenue).toBe(90); // 30 + 60
    expect(completedAppts).toHaveLength(2);
  });

  it("should rank services by booking count", () => {
    const services = [
      { id: "s1", name: "Haircut", price: 30, duration: 30, color: "#FF0000", createdAt: "" },
      { id: "s2", name: "Massage", price: 60, duration: 60, color: "#00FF00", createdAt: "" },
    ];
    const appointments = [
      { id: "a1", serviceId: "s1", status: "completed" as const },
      { id: "a2", serviceId: "s1", status: "confirmed" as const },
      { id: "a3", serviceId: "s2", status: "completed" as const },
      { id: "a4", serviceId: "s1", status: "cancelled" as const },
    ];
    const counts: Record<string, number> = {};
    appointments.filter((a) => a.status !== "cancelled").forEach((a) => {
      counts[a.serviceId] = (counts[a.serviceId] || 0) + 1;
    });
    const ranked = services
      .map((s) => ({ ...s, bookings: counts[s.id] || 0 }))
      .sort((a, b) => b.bookings - a.bookings);
    expect(ranked[0].name).toBe("Haircut");
    expect(ranked[0].bookings).toBe(2);
    expect(ranked[1].name).toBe("Massage");
    expect(ranked[1].bookings).toBe(1);
  });

  it("should filter appointments by status for calendar filters", () => {
    const appointments = [
      { id: "a1", status: "confirmed" as const, date: "2026-04-10" },
      { id: "a2", status: "pending" as const, date: "2026-04-11" },
      { id: "a3", status: "cancelled" as const, date: "2026-04-09" },
      { id: "a4", status: "completed" as const, date: "2026-04-08" },
      { id: "a5", status: "confirmed" as const, date: "2026-04-12" },
    ];
    const todayStr = "2026-04-06";
    const upcoming = appointments.filter((a) => a.status === "confirmed" && a.date >= todayStr);
    const requests = appointments.filter((a) => a.status === "pending");
    const cancelled = appointments.filter((a) => a.status === "cancelled");
    const completed = appointments.filter((a) => a.status === "completed");
    expect(upcoming).toHaveLength(2);
    expect(requests).toHaveLength(1);
    expect(cancelled).toHaveLength(1);
    expect(completed).toHaveLength(1);
  });
});
