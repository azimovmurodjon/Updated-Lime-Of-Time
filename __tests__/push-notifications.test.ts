/**
 * Tests for the Expo push notification server module (server/push.ts)
 * Validates payload construction, token validation, and helper functions.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock fetch ─────────────────────────────────────────────────────────────
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// Import after stubbing globals
import {
  sendExpoPush,
  notifyNewBooking,
  notifyCancellation,
  notifyReschedule,
  notifyWaitlist,
} from "../server/push";

const VALID_TOKEN = "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]";

beforeEach(() => {
  mockFetch.mockReset();
  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => ({ data: { status: "ok", id: "test-ticket-123" } }),
    text: async () => "ok",
  });
});

describe("sendExpoPush", () => {
  it("returns false for invalid token (empty string)", async () => {
    const result = await sendExpoPush("", { title: "Test", body: "Body" });
    expect(result).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns false for invalid token (no ExponentPushToken prefix)", async () => {
    const result = await sendExpoPush("invalid-token", {
      title: "Test",
      body: "Body",
    });
    expect(result).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("calls Expo push API with valid token", async () => {
    const result = await sendExpoPush(VALID_TOKEN, {
      title: "Test Title",
      body: "Test Body",
      data: { type: "general" },
    });
    expect(result).toBe(true);
    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe("https://exp.host/--/api/v2/push/send");
    expect(options.method).toBe("POST");
    const body = JSON.parse(options.body);
    expect(body.to).toBe(VALID_TOKEN);
    expect(body.title).toBe("Test Title");
    expect(body.body).toBe("Test Body");
  });

  it("sends to correct Expo push API endpoint", async () => {
    await sendExpoPush(VALID_TOKEN, { title: "T", body: "B" });
    expect(mockFetch.mock.calls[0][0]).toBe(
      "https://exp.host/--/api/v2/push/send"
    );
  });

  it("includes high priority in payload", async () => {
    await sendExpoPush(VALID_TOKEN, { title: "T", body: "B" });
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.priority).toBe("high");
  });

  it("returns false when Expo API returns error status", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => "Internal Server Error",
    });
    const result = await sendExpoPush(VALID_TOKEN, { title: "T", body: "B" });
    expect(result).toBe(false);
  });

  it("returns false when ticket has error status", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: { status: "error", message: "DeviceNotRegistered" },
      }),
      text: async () => "",
    });
    const result = await sendExpoPush(VALID_TOKEN, { title: "T", body: "B" });
    expect(result).toBe(false);
  });
});

describe("notifyNewBooking", () => {
  it("sends notification with correct appointment_request type", async () => {
    await notifyNewBooking(
      VALID_TOKEN,
      "Lime Of Time",
      "John Doe",
      "Hair Cut",
      "2026-04-20",
      "10:00",
      "appt-123"
    );
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.data.type).toBe("appointment_request");
    expect(body.data.filter).toBe("requests");
    expect(body.data.appointmentId).toBe("appt-123");
  });

  it("includes business name in title", async () => {
    await notifyNewBooking(
      VALID_TOKEN,
      "My Salon",
      "Jane",
      "Manicure",
      "2026-04-20",
      "14:30",
      "appt-456"
    );
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.title).toContain("My Salon");
  });

  it("formats 12-hour time in notification body", async () => {
    await notifyNewBooking(
      VALID_TOKEN,
      "Salon",
      "Client",
      "Service",
      "2026-04-20",
      "14:30",
      "appt-789"
    );
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.body).toContain("2:30 PM");
  });

  it("formats midnight correctly (12:00 AM)", async () => {
    await notifyNewBooking(
      VALID_TOKEN,
      "Salon",
      "Client",
      "Service",
      "2026-04-20",
      "00:00",
      "appt-midnight"
    );
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.body).toContain("12:00 AM");
  });

  it("formats noon correctly (12:00 PM)", async () => {
    await notifyNewBooking(
      VALID_TOKEN,
      "Salon",
      "Client",
      "Service",
      "2026-04-20",
      "12:00",
      "appt-noon"
    );
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.body).toContain("12:00 PM");
  });
});

describe("notifyCancellation", () => {
  it("sends notification with appointment_cancelled type", async () => {
    await notifyCancellation(
      VALID_TOKEN,
      "Lime Of Time",
      "John",
      "Hair Cut",
      "2026-04-20",
      "10:00",
      "appt-cancel-1"
    );
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.data.type).toBe("appointment_cancelled");
    expect(body.data.filter).toBe("cancelled");
    expect(body.data.appointmentId).toBe("appt-cancel-1");
  });

  it("includes client name in body", async () => {
    await notifyCancellation(
      VALID_TOKEN,
      "Salon",
      "Alice Smith",
      "Massage",
      "2026-04-21",
      "11:00",
      "appt-c2"
    );
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.body).toContain("Alice Smith");
  });
});

describe("notifyReschedule", () => {
  it("sends notification with appointment_rescheduled type and requests filter", async () => {
    await notifyReschedule(
      VALID_TOKEN,
      "Lime Of Time",
      "Bob",
      "Facial",
      "2026-04-25",
      "09:00",
      "appt-r1"
    );
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.data.type).toBe("appointment_rescheduled");
    expect(body.data.filter).toBe("requests");
    expect(body.data.appointmentId).toBe("appt-r1");
  });

  it("includes new date and time in body", async () => {
    await notifyReschedule(
      VALID_TOKEN,
      "Salon",
      "Client",
      "Service",
      "2026-05-01",
      "15:00",
      "appt-r2"
    );
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.body).toContain("2026-05-01");
    expect(body.body).toContain("3:00 PM");
  });
});

describe("notifyWaitlist", () => {
  it("sends notification with waitlist type and requests filter", async () => {
    await notifyWaitlist(
      VALID_TOKEN,
      "Lime Of Time",
      "Carol",
      "Haircut",
      "2026-04-22"
    );
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.data.type).toBe("waitlist");
    expect(body.data.filter).toBe("requests");
  });

  it("includes client name and preferred date in body", async () => {
    await notifyWaitlist(
      VALID_TOKEN,
      "Salon",
      "Dave",
      "Pedicure",
      "2026-04-30"
    );
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.body).toContain("Dave");
    expect(body.body).toContain("2026-04-30");
  });
});

describe("Notification channel IDs", () => {
  it("uses appointments channel for new booking", async () => {
    await notifyNewBooking(
      VALID_TOKEN,
      "S",
      "C",
      "Svc",
      "2026-04-20",
      "10:00",
      "a1"
    );
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.channelId).toBe("appointments");
  });

  it("uses appointments channel for cancellation", async () => {
    await notifyCancellation(VALID_TOKEN, "S", "C", "Svc", "2026-04-20", "10:00", "a2");
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.channelId).toBe("appointments");
  });
});
