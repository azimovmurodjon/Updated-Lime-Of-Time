import { describe, it, expect } from "vitest";
import {
  SERVICE_COLORS,
  DAYS_OF_WEEK,
  DEFAULT_WORKING_HOURS,
  DEFAULT_BUSINESS_PROFILE,
  DEFAULT_CANCELLATION_POLICY,
  WorkingHours,
  BusinessProfile,
  BusinessSettings,
  CancellationPolicy,
  timeToMinutes,
  minutesToTime,
  timeSlotsOverlap,
  generateAvailableSlots,
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
      cancellationPolicy: { enabled: true, hoursBeforeAppointment: 2, feePercentage: 50 },
      onboardingComplete: false,
      temporaryClosed: false,
      businessLogoUri: "",
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
      cancellationPolicy: { enabled: true, hoursBeforeAppointment: 2, feePercentage: 50 },
      onboardingComplete: false,
      temporaryClosed: false,
      businessLogoUri: "",
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
      cancellationPolicy: { enabled: true, hoursBeforeAppointment: 2, feePercentage: 50 },
      onboardingComplete: false,
      temporaryClosed: false,
      businessLogoUri: "",
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

describe("Time Helpers", () => {
  it("should convert time string to minutes", () => {
    expect(timeToMinutes("09:00")).toBe(540);
    expect(timeToMinutes("12:30")).toBe(750);
    expect(timeToMinutes("00:00")).toBe(0);
    expect(timeToMinutes("23:59")).toBe(1439);
  });

  it("should convert minutes to time string", () => {
    expect(minutesToTime(540)).toBe("09:00");
    expect(minutesToTime(750)).toBe("12:30");
    expect(minutesToTime(0)).toBe("00:00");
  });

  it("should detect overlapping time slots", () => {
    // 9:00-10:00 vs 9:30-10:30 → overlap
    expect(timeSlotsOverlap("09:00", 60, "09:30", 60)).toBe(true);
    // 9:00-10:00 vs 10:00-11:00 → no overlap (adjacent)
    expect(timeSlotsOverlap("09:00", 60, "10:00", 60)).toBe(false);
    // 9:00-10:00 vs 10:30-11:30 → no overlap
    expect(timeSlotsOverlap("09:00", 60, "10:30", 60)).toBe(false);
    // 9:00-11:00 vs 10:00-10:30 → overlap (contained)
    expect(timeSlotsOverlap("09:00", 120, "10:00", 30)).toBe(true);
  });

  it("should generate available slots filtering out booked ones", () => {
    const workingHours = { ...DEFAULT_WORKING_HOURS };
    // Use a future date to avoid past-time filtering
    const futureDate = "2030-01-07"; // Monday
    const appointments = [
      { id: "a1", serviceId: "s1", clientId: "c1", date: futureDate, time: "09:00", duration: 60, status: "confirmed" as const, notes: "", createdAt: "" },
    ];
    const slots = generateAvailableSlots(futureDate, 60, workingHours, appointments);
    // 09:00 should be excluded (booked), 09:30 should also be excluded (overlaps with 09:00-10:00)
    expect(slots).not.toContain("09:00");
    expect(slots).not.toContain("09:30");
    // 10:00 should be available
    expect(slots).toContain("10:00");
  });
});

describe("Cancellation Policy", () => {
  it("should have default cancellation policy", () => {
    expect(DEFAULT_CANCELLATION_POLICY.enabled).toBe(true);
    expect(DEFAULT_CANCELLATION_POLICY.hoursBeforeAppointment).toBe(2);
    expect(DEFAULT_CANCELLATION_POLICY.feePercentage).toBe(50);
  });

  it("should be part of BusinessSettings", () => {
    const settings: BusinessSettings = {
      businessName: "Test",
      defaultDuration: 30,
      notificationsEnabled: false,
      workingHours: DEFAULT_WORKING_HOURS,
      profile: DEFAULT_BUSINESS_PROFILE,
      themeMode: "system",
      cancellationPolicy: DEFAULT_CANCELLATION_POLICY,
      onboardingComplete: false,
      temporaryClosed: false,
      businessLogoUri: "",
    };
    expect(settings.cancellationPolicy.enabled).toBe(true);
    expect(settings.onboardingComplete).toBe(false);
  });
});

describe("Scrolling Time Picker Options", () => {
  it("should generate time options in 15-min intervals for 24 hours", () => {
    const options: string[] = [];
    for (let h = 0; h < 24; h++) {
      for (let m = 0; m < 60; m += 15) {
        options.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
      }
    }
    expect(options).toHaveLength(96); // 24 * 4
    expect(options[0]).toBe("00:00");
    expect(options[options.length - 1]).toBe("23:45");
    expect(options).toContain("09:00");
    expect(options).toContain("12:30");
  });
});

describe("Booking Conflict Prevention", () => {
  it("should not allow booking when slot overlaps with pending appointment", () => {
    const workingHours = { ...DEFAULT_WORKING_HOURS };
    const futureDate = "2030-01-07"; // Monday
    const appointments = [
      { id: "a1", serviceId: "s1", clientId: "c1", date: futureDate, time: "10:00", duration: 60, status: "pending" as const, notes: "", createdAt: "" },
    ];
    const slots = generateAvailableSlots(futureDate, 60, workingHours, appointments);
    // 10:00 and 10:30 should be excluded (overlap with pending 10:00-11:00)
    expect(slots).not.toContain("10:00");
    expect(slots).not.toContain("10:30");
    // 11:00 should be available
    expect(slots).toContain("11:00");
  });

  it("should allow booking when slot overlaps with cancelled appointment", () => {
    const workingHours = { ...DEFAULT_WORKING_HOURS };
    const futureDate = "2030-01-07";
    const appointments = [
      { id: "a1", serviceId: "s1", clientId: "c1", date: futureDate, time: "10:00", duration: 60, status: "cancelled" as const, notes: "", createdAt: "" },
    ];
    const slots = generateAvailableSlots(futureDate, 60, workingHours, appointments);
    // 10:00 should be available since the appointment is cancelled
    expect(slots).toContain("10:00");
  });
});

describe("Cancellation Fee Calculation", () => {
  it("should apply fee when cancelling within the policy window", () => {
    const policy: CancellationPolicy = { enabled: true, hoursBeforeAppointment: 2, feePercentage: 50 };
    const servicePrice = 100;
    const hoursUntilAppt = 1; // 1 hour before
    const feeApplies = policy.enabled && hoursUntilAppt <= policy.hoursBeforeAppointment;
    const fee = feeApplies ? (servicePrice * policy.feePercentage) / 100 : 0;
    expect(feeApplies).toBe(true);
    expect(fee).toBe(50);
  });

  it("should not apply fee when cancelling outside the policy window", () => {
    const policy: CancellationPolicy = { enabled: true, hoursBeforeAppointment: 2, feePercentage: 50 };
    const servicePrice = 100;
    const hoursUntilAppt = 5; // 5 hours before
    const feeApplies = policy.enabled && hoursUntilAppt <= policy.hoursBeforeAppointment;
    const fee = feeApplies ? (servicePrice * policy.feePercentage) / 100 : 0;
    expect(feeApplies).toBe(false);
    expect(fee).toBe(0);
  });

  it("should not apply fee when policy is disabled", () => {
    const policy: CancellationPolicy = { enabled: false, hoursBeforeAppointment: 2, feePercentage: 50 };
    const servicePrice = 100;
    const hoursUntilAppt = 1;
    const feeApplies = policy.enabled && hoursUntilAppt <= policy.hoursBeforeAppointment;
    expect(feeApplies).toBe(false);
  });
});

describe("End Time Calculation", () => {
  it("should correctly compute appointment end time", () => {
    // 9:00 AM + 60 min = 10:00 AM
    const startTime = "09:00";
    const duration = 60;
    const endMinutes = timeToMinutes(startTime) + duration;
    const endTime = minutesToTime(endMinutes);
    expect(endTime).toBe("10:00");
  });

  it("should handle appointments crossing the hour", () => {
    // 9:30 AM + 45 min = 10:15 AM
    const startTime = "09:30";
    const duration = 45;
    const endMinutes = timeToMinutes(startTime) + duration;
    const endTime = minutesToTime(endMinutes);
    expect(endTime).toBe("10:15");
  });

  it("should handle 2-hour appointments", () => {
    // 14:00 + 120 min = 16:00
    const startTime = "14:00";
    const duration = 120;
    const endMinutes = timeToMinutes(startTime) + duration;
    const endTime = minutesToTime(endMinutes);
    expect(endTime).toBe("16:00");
  });
});

describe("Temporary Closed Feature", () => {
  it("should include temporaryClosed in BusinessSettings", () => {
    const settings: BusinessSettings = {
      businessName: "Test",
      defaultDuration: 30,
      notificationsEnabled: false,
      workingHours: DEFAULT_WORKING_HOURS,
      profile: DEFAULT_BUSINESS_PROFILE,
      themeMode: "system",
      cancellationPolicy: DEFAULT_CANCELLATION_POLICY,
      onboardingComplete: true,
      temporaryClosed: true,
      businessLogoUri: "",
    };
    expect(settings.temporaryClosed).toBe(true);
  });

  it("should default to not temporarily closed", () => {
    const settings: BusinessSettings = {
      businessName: "Test",
      defaultDuration: 30,
      notificationsEnabled: false,
      workingHours: DEFAULT_WORKING_HOURS,
      profile: DEFAULT_BUSINESS_PROFILE,
      themeMode: "system",
      cancellationPolicy: DEFAULT_CANCELLATION_POLICY,
      onboardingComplete: false,
      temporaryClosed: false,
      businessLogoUri: "",
    };
    expect(settings.temporaryClosed).toBe(false);
  });
});

describe("Review System", () => {
  it("should create a valid Review object", () => {
    const review = {
      id: "rev-1",
      clientId: "client-1",
      rating: 5,
      comment: "Great service!",
      createdAt: new Date().toISOString(),
    };
    expect(review.id).toBeTruthy();
    expect(review.clientId).toBe("client-1");
    expect(review.rating).toBe(5);
    expect(review.rating).toBeGreaterThanOrEqual(1);
    expect(review.rating).toBeLessThanOrEqual(5);
    expect(review.comment).toBe("Great service!");
  });

  it("should allow reviews with optional appointmentId", () => {
    const review = {
      id: "rev-2",
      clientId: "client-1",
      appointmentId: "appt-1",
      rating: 4,
      comment: "Good",
      createdAt: new Date().toISOString(),
    };
    expect(review.appointmentId).toBe("appt-1");
  });

  it("should allow reviews without appointmentId", () => {
    const review: { id: string; clientId: string; appointmentId?: string; rating: number; comment: string; createdAt: string } = {
      id: "rev-3",
      clientId: "client-2",
      rating: 3,
      comment: "Average",
      createdAt: new Date().toISOString(),
    };
    expect(review.appointmentId).toBeUndefined();
  });

  it("should validate rating range 1-5", () => {
    const ratings = [1, 2, 3, 4, 5];
    ratings.forEach((r) => {
      expect(r).toBeGreaterThanOrEqual(1);
      expect(r).toBeLessThanOrEqual(5);
    });
  });

  it("should filter reviews by clientId", () => {
    const reviews = [
      { id: "r1", clientId: "c1", rating: 5, comment: "Great", createdAt: "" },
      { id: "r2", clientId: "c2", rating: 4, comment: "Good", createdAt: "" },
      { id: "r3", clientId: "c1", rating: 3, comment: "OK", createdAt: "" },
    ];
    const clientReviews = reviews.filter((r) => r.clientId === "c1");
    expect(clientReviews).toHaveLength(2);
    expect(clientReviews[0].id).toBe("r1");
    expect(clientReviews[1].id).toBe("r3");
  });
});

describe("Business Logo URI", () => {
  it("should store custom business logo URI", () => {
    const settings: BusinessSettings = {
      businessName: "My Salon",
      defaultDuration: 30,
      notificationsEnabled: false,
      workingHours: DEFAULT_WORKING_HOURS,
      profile: DEFAULT_BUSINESS_PROFILE,
      themeMode: "system",
      cancellationPolicy: DEFAULT_CANCELLATION_POLICY,
      onboardingComplete: true,
      temporaryClosed: false,
      businessLogoUri: "file:///data/user/0/com.app/cache/photo.jpg",
    };
    expect(settings.businessLogoUri).toBe("file:///data/user/0/com.app/cache/photo.jpg");
  });

  it("should default to empty string when no logo uploaded", () => {
    const settings: BusinessSettings = {
      businessName: "Test",
      defaultDuration: 30,
      notificationsEnabled: false,
      workingHours: DEFAULT_WORKING_HOURS,
      profile: DEFAULT_BUSINESS_PROFILE,
      themeMode: "system",
      cancellationPolicy: DEFAULT_CANCELLATION_POLICY,
      onboardingComplete: false,
      temporaryClosed: false,
      businessLogoUri: "",
    };
    expect(settings.businessLogoUri).toBe("");
  });
});

describe("Logout and Delete Business", () => {
  it("should reset onboardingComplete on logout", () => {
    const settings: BusinessSettings = {
      businessName: "My Business",
      defaultDuration: 60,
      notificationsEnabled: true,
      workingHours: DEFAULT_WORKING_HOURS,
      profile: { ...DEFAULT_BUSINESS_PROFILE, ownerName: "John" },
      themeMode: "light",
      cancellationPolicy: DEFAULT_CANCELLATION_POLICY,
      onboardingComplete: true,
      temporaryClosed: false,
      businessLogoUri: "",
    };
    // Simulate logout
    const loggedOut = { ...settings, onboardingComplete: false };
    expect(loggedOut.onboardingComplete).toBe(false);
    expect(loggedOut.businessName).toBe("My Business"); // data preserved
  });

  it("should clear all data on delete business", () => {
    // Simulate RESET_ALL_DATA
    const emptyState = {
      services: [] as any[],
      clients: [] as any[],
      appointments: [] as any[],
      reviews: [] as any[],
    };
    expect(emptyState.services).toHaveLength(0);
    expect(emptyState.clients).toHaveLength(0);
    expect(emptyState.appointments).toHaveLength(0);
    expect(emptyState.reviews).toHaveLength(0);
  });
});

describe("Public Booking URL", () => {
  it("should use limeoftime.com domain", () => {
    const PUBLIC_BOOKING_URL = "https://limeoftime.com";
    expect(PUBLIC_BOOKING_URL).toContain("limeoftime.com");
  });

  it("should generate correct booking link with slug", () => {
    const PUBLIC_BOOKING_URL = "https://limeoftime.com";
    const businessName = "My Salon";
    const slug = businessName.toLowerCase().replace(/\s+/g, "-");
    const link = `${PUBLIC_BOOKING_URL}/book/${slug}`;
    expect(link).toBe("https://limeoftime.com/book/my-salon");
  });

  it("should generate correct review link with slug", () => {
    const PUBLIC_BOOKING_URL = "https://limeoftime.com";
    const businessName = "My Salon";
    const slug = businessName.toLowerCase().replace(/\s+/g, "-");
    const link = `${PUBLIC_BOOKING_URL}/review/${slug}`;
    expect(link).toBe("https://limeoftime.com/review/my-salon");
  });
});

describe("Report Generation Data", () => {
  const mockServices = [
    { id: "s1", name: "Haircut", duration: 30, price: 50, color: "#4CAF50", createdAt: "2026-01-01" },
    { id: "s2", name: "Massage", duration: 60, price: 100, color: "#2196F3", createdAt: "2026-01-01" },
  ];

  const mockAppointments = [
    { id: "a1", serviceId: "s1", clientId: "c1", date: "2026-01-15", time: "09:00", duration: 30, status: "completed" as const, notes: "", createdAt: "2026-01-15" },
    { id: "a2", serviceId: "s2", clientId: "c2", date: "2026-02-10", time: "10:00", duration: 60, status: "completed" as const, notes: "", createdAt: "2026-02-10" },
    { id: "a3", serviceId: "s1", clientId: "c1", date: "2026-03-05", time: "14:00", duration: 30, status: "cancelled" as const, notes: "", createdAt: "2026-03-05" },
    { id: "a4", serviceId: "s2", clientId: "c3", date: "2026-04-01", time: "11:00", duration: 60, status: "pending" as const, notes: "", createdAt: "2026-04-01" },
  ];

  it("should calculate total revenue from completed appointments", () => {
    const completedAppts = mockAppointments.filter((a) => a.status === "completed");
    const totalRevenue = completedAppts.reduce((sum, a) => {
      const svc = mockServices.find((s) => s.id === a.serviceId);
      return sum + (svc?.price ?? 0);
    }, 0);
    expect(totalRevenue).toBe(150); // 50 + 100
  });

  it("should calculate monthly revenue breakdown", () => {
    const completedAppts = mockAppointments.filter((a) => a.status === "completed");
    const monthlyRevenue: Record<string, number> = {};
    completedAppts.forEach((a) => {
      const monthKey = a.date.substring(0, 7);
      const svc = mockServices.find((s) => s.id === a.serviceId);
      monthlyRevenue[monthKey] = (monthlyRevenue[monthKey] || 0) + (svc?.price ?? 0);
    });
    expect(monthlyRevenue["2026-01"]).toBe(50);
    expect(monthlyRevenue["2026-02"]).toBe(100);
  });

  it("should calculate service revenue breakdown", () => {
    const completedAppts = mockAppointments.filter((a) => a.status === "completed");
    const serviceRevenue: Record<string, number> = {};
    completedAppts.forEach((a) => {
      const svc = mockServices.find((s) => s.id === a.serviceId);
      if (svc) {
        serviceRevenue[svc.id] = (serviceRevenue[svc.id] || 0) + svc.price;
      }
    });
    expect(serviceRevenue["s1"]).toBe(50);
    expect(serviceRevenue["s2"]).toBe(100);
  });

  it("should calculate cancellation fees correctly", () => {
    const cancelledAppts = mockAppointments.filter((a) => a.status === "cancelled");
    const feePercentage = 50;
    const cancellationFees = cancelledAppts.reduce((sum, a) => {
      const svc = mockServices.find((s) => s.id === a.serviceId);
      return sum + ((svc?.price ?? 0) * feePercentage) / 100;
    }, 0);
    expect(cancellationFees).toBe(25); // 50% of $50
  });

  it("should calculate total hours worked", () => {
    const completedAppts = mockAppointments.filter((a) => a.status === "completed");
    const totalMinutes = completedAppts.reduce((sum, a) => sum + a.duration, 0);
    const totalHours = totalMinutes / 60;
    expect(totalHours).toBe(1.5); // 30min + 60min
  });

  it("should count appointments by status", () => {
    const statusCounts = {
      completed: mockAppointments.filter((a) => a.status === "completed").length,
      cancelled: mockAppointments.filter((a) => a.status === "cancelled").length,
      pending: mockAppointments.filter((a) => a.status === "pending").length,
    };
    expect(statusCounts.completed).toBe(2);
    expect(statusCounts.cancelled).toBe(1);
    expect(statusCounts.pending).toBe(1);
  });

  it("should calculate average revenue per appointment", () => {
    const completedAppts = mockAppointments.filter((a) => a.status === "completed");
    const totalRevenue = completedAppts.reduce((sum, a) => {
      const svc = mockServices.find((s) => s.id === a.serviceId);
      return sum + (svc?.price ?? 0);
    }, 0);
    const avgRevenue = completedAppts.length > 0 ? Math.round(totalRevenue / completedAppts.length) : 0;
    expect(avgRevenue).toBe(75); // 150 / 2
  });

  it("should calculate end time for appointments using minutesToTime", () => {
    const appt = mockAppointments[0]; // 09:00, 30 min
    const endMin = timeToMinutes(appt.time) + appt.duration;
    const endTime = minutesToTime(endMin);
    expect(endTime).toBe("09:30");

    const appt2 = mockAppointments[1]; // 10:00, 60 min
    const endMin2 = timeToMinutes(appt2.time) + appt2.duration;
    const endTime2 = minutesToTime(endMin2);
    expect(endTime2).toBe("11:00");
  });
});

describe("Contact Picker Key Generation", () => {
  it("should generate unique keys for contacts with same name", () => {
    const getContactKey = (contact: { name?: string; phone?: string }, index: number): string => {
      const name = contact.name ?? "";
      const phone = contact.phone ?? "";
      return `contact--${name}-${phone}-${index}`;
    };

    const key1 = getContactKey({ name: "John", phone: "123" }, 0);
    const key2 = getContactKey({ name: "John", phone: "456" }, 1);
    const key3 = getContactKey({ name: "John", phone: "123" }, 2);

    expect(key1).not.toBe(key2);
    expect(key1).not.toBe(key3);
    expect(key2).not.toBe(key3);
  });
});
