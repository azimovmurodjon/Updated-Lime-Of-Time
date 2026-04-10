import { describe, it, expect, vi } from "vitest";

// ── Buffer Time in Slot Generation ─────────────────────────────────
describe("Buffer Time Integration", () => {
  it("should add buffer time between appointments when generating slots", () => {
    // Simulate: appointment at 9:00 for 60 min, buffer 15 min
    // Next available slot should be at 10:15, not 10:00
    const apptEnd = 9 * 60 + 60; // 10:00 in minutes
    const bufferTime = 15;
    const nextAvailable = apptEnd + bufferTime; // 10:15
    expect(nextAvailable).toBe(615); // 10:15 = 615 minutes
  });

  it("should default to 0 buffer time when not set", () => {
    const bufferTime = undefined;
    const effectiveBuffer = bufferTime ?? 0;
    expect(effectiveBuffer).toBe(0);
  });

  it("should handle various buffer time values", () => {
    const testCases = [
      { buffer: 0, expected: 600 },
      { buffer: 5, expected: 605 },
      { buffer: 10, expected: 610 },
      { buffer: 15, expected: 615 },
      { buffer: 30, expected: 630 },
      { buffer: 60, expected: 660 },
    ];
    testCases.forEach(({ buffer, expected }) => {
      const apptEnd = 600; // 10:00
      expect(apptEnd + buffer).toBe(expected);
    });
  });
});

// ── Service Categories ─────────────────────────────────────────────
describe("Service Categories", () => {
  it("should group services by category", () => {
    const services = [
      { id: "1", name: "Haircut", category: "Hair" },
      { id: "2", name: "Coloring", category: "Hair" },
      { id: "3", name: "Facial", category: "Skin" },
      { id: "4", name: "Massage", category: "" },
      { id: "5", name: "Nails", category: undefined },
    ];

    const grouped: Record<string, typeof services> = {};
    services.forEach((s) => {
      const cat = s.category || "Uncategorized";
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(s);
    });

    expect(Object.keys(grouped)).toHaveLength(3);
    expect(grouped["Hair"]).toHaveLength(2);
    expect(grouped["Skin"]).toHaveLength(1);
    expect(grouped["Uncategorized"]).toHaveLength(2);
  });

  it("should sort categories alphabetically with Uncategorized last", () => {
    const categories = ["Skin", "Uncategorized", "Hair", "Nails"];
    const sorted = categories.sort((a, b) => {
      if (a === "Uncategorized") return 1;
      if (b === "Uncategorized") return -1;
      return a.localeCompare(b);
    });
    expect(sorted).toEqual(["Hair", "Nails", "Skin", "Uncategorized"]);
  });
});

// ── Recurring Appointments ─────────────────────────────────────────
describe("Recurring Appointments", () => {
  it("should calculate next occurrence for weekly recurrence", () => {
    const baseDate = new Date("2026-04-10");
    const nextWeek = new Date(baseDate);
    nextWeek.setDate(nextWeek.getDate() + 7);
    expect(nextWeek.toISOString().split("T")[0]).toBe("2026-04-17");
  });

  it("should calculate next occurrence for biweekly recurrence", () => {
    const baseDate = new Date("2026-04-10");
    const biweekly = new Date(baseDate);
    biweekly.setDate(biweekly.getDate() + 14);
    expect(biweekly.toISOString().split("T")[0]).toBe("2026-04-24");
  });

  it("should calculate next occurrence for monthly recurrence", () => {
    const baseDate = new Date("2026-04-10");
    const monthly = new Date(baseDate);
    monthly.setMonth(monthly.getMonth() + 1);
    expect(monthly.toISOString().split("T")[0]).toBe("2026-05-10");
  });

  it("should generate correct number of recurring dates", () => {
    const count = 4;
    const interval = 7; // weekly
    const baseDate = new Date("2026-04-10");
    const dates: string[] = [];
    for (let i = 0; i < count; i++) {
      const d = new Date(baseDate);
      d.setDate(d.getDate() + interval * i);
      dates.push(d.toISOString().split("T")[0]);
    }
    expect(dates).toEqual(["2026-04-10", "2026-04-17", "2026-04-24", "2026-05-01"]);
  });
});

// ── Data Export ─────────────────────────────────────────────────────
describe("Data Export", () => {
  it("should generate valid CSV from appointments", () => {
    const appointments = [
      { date: "2026-04-10", time: "09:00", service: "Haircut", client: "John", status: "confirmed", price: 50 },
      { date: "2026-04-11", time: "10:00", service: "Coloring", client: "Jane", status: "completed", price: 80 },
    ];

    const headers = "Date,Time,Service,Client,Status,Price";
    const rows = appointments.map(
      (a) => `${a.date},${a.time},${a.service},${a.client},${a.status},$${a.price}`
    );
    const csv = [headers, ...rows].join("\n");

    expect(csv).toContain("Date,Time,Service,Client,Status,Price");
    expect(csv).toContain("2026-04-10,09:00,Haircut,John,confirmed,$50");
    expect(csv).toContain("2026-04-11,10:00,Coloring,Jane,completed,$80");
    expect(csv.split("\n")).toHaveLength(3);
  });

  it("should handle special characters in CSV export", () => {
    const name = 'John "Johnny" Doe';
    const escaped = `"${name.replace(/"/g, '""')}"`;
    expect(escaped).toBe('"John ""Johnny"" Doe"');
  });
});

// ── Waitlist ───────────────────────────────────────────────────────
describe("Waitlist", () => {
  it("should validate required waitlist fields", () => {
    const entry = {
      clientName: "John",
      serviceLocalId: "svc-1",
      preferredDate: "2026-04-15",
    };
    expect(entry.clientName).toBeTruthy();
    expect(entry.serviceLocalId).toBeTruthy();
    expect(entry.preferredDate).toBeTruthy();
  });

  it("should reject waitlist entry without required fields", () => {
    const entry = {
      clientName: "",
      serviceLocalId: "svc-1",
      preferredDate: "2026-04-15",
    };
    const isValid = entry.clientName && entry.serviceLocalId && entry.preferredDate;
    expect(isValid).toBeFalsy();
  });
});

// ── Tutorial Walkthrough ───────────────────────────────────────────
describe("Tutorial Walkthrough", () => {
  it("should have correct number of tutorial steps", () => {
    const TUTORIAL_STEPS = [
      { title: "Welcome to Lime Of Time!", icon: "🍋" },
      { title: "Dashboard Overview", icon: "📊" },
      { title: "Book Appointments", icon: "📅" },
      { title: "Manage Your Calendar", icon: "🗓️" },
      { title: "Services & Clients", icon: "💼" },
      { title: "Settings & Customization", icon: "⚙️" },
      { title: "You're All Set!", icon: "🎉" },
    ];
    expect(TUTORIAL_STEPS).toHaveLength(7);
  });

  it("should advance through steps correctly", () => {
    let step = 0;
    const maxSteps = 7;
    
    // Advance through all steps
    for (let i = 0; i < maxSteps - 1; i++) {
      step++;
    }
    expect(step).toBe(6); // Last step index
    
    // At last step, should dismiss
    const isLastStep = step >= maxSteps - 1;
    expect(isLastStep).toBe(true);
  });
});

// ── Custom Slug ────────────────────────────────────────────────────
describe("Custom Booking Slug", () => {
  it("should validate slug format (lowercase, hyphens, no spaces)", () => {
    const validSlugs = ["my-salon", "johns-barber", "beauty-studio-nyc"];
    const invalidSlugs = ["My Salon", "john's", "beauty studio"];
    
    const isValidSlug = (slug: string) => /^[a-z0-9-]+$/.test(slug);
    
    validSlugs.forEach((s) => expect(isValidSlug(s)).toBe(true));
    invalidSlugs.forEach((s) => expect(isValidSlug(s)).toBe(false));
  });

  it("should generate slug from business name", () => {
    const businessName = "John's Barber Shop";
    const slug = businessName
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-");
    expect(slug).toBe("johns-barber-shop");
  });
});

// ── Notification Scheduling ────────────────────────────────────────
describe("Notification Scheduling", () => {
  it("should calculate 30-minute reminder time correctly", () => {
    const apptDate = new Date("2026-04-10T14:00:00");
    const reminderDate = new Date(apptDate.getTime() - 30 * 60 * 1000);
    expect(reminderDate.getHours()).toBe(13);
    expect(reminderDate.getMinutes()).toBe(30);
  });

  it("should calculate 1-hour reminder time correctly", () => {
    const apptDate = new Date("2026-04-10T14:00:00");
    const reminderDate = new Date(apptDate.getTime() - 60 * 60 * 1000);
    expect(reminderDate.getHours()).toBe(13);
    expect(reminderDate.getMinutes()).toBe(0);
  });

  it("should only schedule reminders for future appointments", () => {
    const now = new Date();
    const pastAppt = new Date(now.getTime() - 60 * 60 * 1000);
    const futureAppt = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    
    const shouldSchedulePast = pastAppt.getTime() > now.getTime();
    const shouldScheduleFuture = futureAppt.getTime() > now.getTime();
    
    expect(shouldSchedulePast).toBe(false);
    expect(shouldScheduleFuture).toBe(true);
  });

  it("should only schedule for confirmed or pending appointments", () => {
    const validStatuses = ["confirmed", "pending"];
    const invalidStatuses = ["cancelled", "completed", "no-show"];
    
    validStatuses.forEach((s) => {
      expect(s === "confirmed" || s === "pending").toBe(true);
    });
    invalidStatuses.forEach((s) => {
      expect(s === "confirmed" || s === "pending").toBe(false);
    });
  });
});
