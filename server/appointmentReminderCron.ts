/**
 * Appointment Reminder Cron
 *
 * Runs every hour and sends a 24-hour-ahead reminder for upcoming confirmed appointments.
 *
 * For each confirmed appointment scheduled 24–25 hours from now:
 *   - Sends a push notification to the business owner's device
 *   - Sends a reminder email to the client (if they have an email on file)
 *
 * The 1-hour window ensures each appointment is only reminded once per run cycle.
 */
import { getDb } from "./db";
import {
  appointments,
  businessOwners,
  clients,
  services,
  locations,
} from "../drizzle/schema";
import { and, eq, inArray } from "drizzle-orm";
import { sendExpoPush } from "./push";
import { sendAppointmentReminderEmail } from "./email";

/** Format HH:MM → "10:30 AM" */
function formatTime(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${ampm}`;
}

/** Format YYYY-MM-DD → "Thursday, April 17, 2026" */
function formatDate(date: string): string {
  const d = new Date(date + "T12:00:00");
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

async function sendAppointmentReminders() {
  const db = await getDb();
  if (!db) return;

  // Calculate the 24–25 hour window from now
  const now = new Date();
  const windowStart = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const windowEnd = new Date(now.getTime() + 25 * 60 * 60 * 1000);

  // Get the date strings that fall in the window
  const startDate = windowStart.toISOString().slice(0, 10); // YYYY-MM-DD
  const endDate = windowEnd.toISOString().slice(0, 10);

  // The window start time in HH:MM
  const windowStartHH = String(windowStart.getHours()).padStart(2, "0");
  const windowStartMM = String(windowStart.getMinutes()).padStart(2, "0");
  const windowEndHH = String(windowEnd.getHours()).padStart(2, "0");
  const windowEndMM = String(windowEnd.getMinutes()).padStart(2, "0");
  const windowStartTime = `${windowStartHH}:${windowStartMM}`;
  const windowEndTime = `${windowEndHH}:${windowEndMM}`;

  try {
    // Fetch all confirmed appointments on the target date(s)
    const targetAppts = await db
      .select()
      .from(appointments)
      .where(
        and(
          eq(appointments.status, "confirmed"),
          // Date must be in the window range
          ...(startDate === endDate
            ? [eq(appointments.date, startDate)]
            : [inArray(appointments.date, [startDate, endDate])])
        )
      );

    if (targetAppts.length === 0) return;

    // Filter to only appointments whose time falls in the 24-25h window
    const toRemind = targetAppts.filter((appt) => {
      if (appt.date === startDate && appt.date === endDate) {
        return appt.time >= windowStartTime && appt.time < windowEndTime;
      }
      if (appt.date === startDate) {
        return appt.time >= windowStartTime;
      }
      if (appt.date === endDate) {
        return appt.time < windowEndTime;
      }
      return false;
    });

    if (toRemind.length === 0) return;

    // Collect unique business owner IDs
    const ownerIds = [...new Set(toRemind.map((a) => a.businessOwnerId))];

    // Fetch all relevant business owners
    const owners = await db
      .select({
        id: businessOwners.id,
        businessName: businessOwners.businessName,
        email: businessOwners.email,
        expoPushToken: businessOwners.expoPushToken,
        notificationPreferences: businessOwners.notificationPreferences,
        customSlug: businessOwners.customSlug,
        address: businessOwners.address,
        phone: businessOwners.phone,
      })
      .from(businessOwners)
      .where(inArray(businessOwners.id, ownerIds));

    const ownerMap = new Map(owners.map((o) => [o.id, o]));

    // Collect unique client localIds and service localIds
    const clientLocalIds = [...new Set(toRemind.map((a) => a.clientLocalId))];
    const serviceLocalIds = [...new Set(toRemind.map((a) => a.serviceLocalId))];
    const locationIds = [...new Set(toRemind.map((a) => a.locationId).filter(Boolean))] as string[];

    // Fetch clients
    const clientRows = await db
      .select()
      .from(clients)
      .where(inArray(clients.localId, clientLocalIds));
    const clientMap = new Map(clientRows.map((c) => [c.localId, c]));

    // Fetch services
    const serviceRows = await db
      .select()
      .from(services)
      .where(inArray(services.localId, serviceLocalIds));
    const serviceMap = new Map(serviceRows.map((s) => [s.localId, s]));

    // Fetch locations
    let locationMap = new Map<string, typeof locations.$inferSelect>();
    if (locationIds.length > 0) {
      const locationRows = await db
        .select()
        .from(locations)
        .where(inArray(locations.localId, locationIds));
      locationMap = new Map(locationRows.map((l) => [l.localId, l]));
    }

    let pushSent = 0;
    let emailSent = 0;

    for (const appt of toRemind) {
      const owner = ownerMap.get(appt.businessOwnerId);
      if (!owner) continue;

      const client = clientMap.get(appt.clientLocalId);
      const service = serviceMap.get(appt.serviceLocalId);
      const location = appt.locationId ? locationMap.get(appt.locationId) : undefined;

      const serviceName = service?.name ?? "Appointment";
      const clientName = client?.name ?? "Client";
      const dateStr = formatDate(appt.date);
      const timeStr = formatTime(appt.time);

      const notifPrefs = (owner.notificationPreferences as any) ?? {};

      // ── Push notification to business owner ─────────────────────────
      const pushEnabled = notifPrefs.pushOnReminder !== false;
      if (pushEnabled && owner.expoPushToken) {
        try {
          const sent = await sendExpoPush(owner.expoPushToken, {
            title: `⏰ Reminder: Appointment Tomorrow`,
            body: `${clientName} — ${serviceName} at ${timeStr} on ${dateStr}`,
            data: { type: "appointment_reminder", appointmentId: appt.localId },
            sound: "default",
          });
          if (sent) {
            pushSent++;
            console.log(`[ReminderCron] Push sent to owner ${owner.id} for appt ${appt.localId}`);
          }
        } catch (err) {
          console.warn(`[ReminderCron] Push failed for appt ${appt.localId}:`, err);
        }
      }

      // ── Reminder email to client ─────────────────────────────────────
      const emailEnabled = notifPrefs.emailOnReminder !== false;
      const clientEmail = client?.email;
      if (emailEnabled && clientEmail && clientEmail.includes("@")) {
        try {
          const locationAddress = location
            ? [location.address, location.city, location.state, location.zipCode]
                .filter(Boolean)
                .join(", ")
            : owner.address ?? undefined;

          const sent = await sendAppointmentReminderEmail(owner.businessName, {
            clientName,
            clientEmail,
            serviceName,
            date: appt.date,
            time: appt.time,
            duration: appt.duration,
            totalPrice: appt.totalPrice ? parseFloat(String(appt.totalPrice)) : undefined,
            locationName: location?.name ?? undefined,
            locationAddress,
            locationPhone: location?.phone ?? undefined,
            businessPhone: owner.phone ?? undefined,
            customSlug: owner.customSlug ?? undefined,
            locationId: appt.locationId ?? undefined,
          });
          if (sent) {
            emailSent++;
            console.log(`[ReminderCron] Email sent to client ${clientEmail} for appt ${appt.localId}`);
          }
        } catch (err) {
          console.warn(`[ReminderCron] Email failed for appt ${appt.localId}:`, err);
        }
      }
    }

    if (pushSent > 0 || emailSent > 0) {
      console.log(`[ReminderCron] Sent ${pushSent} push + ${emailSent} email reminders`);
    }
  } catch (err) {
    console.error("[ReminderCron] Error sending reminders:", err);
  }
}

/**
 * Start the appointment reminder cron.
 * Runs every hour; sends reminders for appointments 24–25 hours away.
 */
export function startAppointmentReminderCron() {
  const INTERVAL_MS = 60 * 60 * 1000; // 1 hour
  console.log("[ReminderCron] Started — checking every hour for 24-hour appointment reminders");

  // Run immediately on startup
  sendAppointmentReminders().catch(console.error);

  // Then run every hour
  setInterval(() => {
    sendAppointmentReminders().catch(console.error);
  }, INTERVAL_MS);
}
