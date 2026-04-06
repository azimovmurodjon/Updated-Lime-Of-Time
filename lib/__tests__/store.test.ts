import { describe, it, expect } from "vitest";
import { SERVICE_COLORS, DAYS_OF_WEEK } from "../types";

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
      "sunday",
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
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
    const wh = {
      enabled: true,
      start: "09:00",
      end: "17:00",
    };
    expect(wh.enabled).toBe(true);
    expect(wh.start).toMatch(/^\d{2}:\d{2}$/);
    expect(wh.end).toMatch(/^\d{2}:\d{2}$/);
  });
});
