/**
 * Request Expiry Cron
 *
 * Runs every hour. Does two things:
 * 1. Sends a 1-hour-before-expiry reminder push notification to the owner
 *    when a pending request is within the last hour of its response window.
 * 2. Auto-expires any pending cancel or reschedule requests that are older
 *    than the owner's configured response window (default 48h).
 *    Sends an SMS to the client notifying them that their request expired.
 */
import { getDb } from "./db";
import { appointments, businessOwners, clients } from "../drizzle/schema";
import { eq, and, isNotNull } from "drizzle-orm";
import { getPlatformConfig } from "./subscription";
import { sendExpoPush } from "./push";

const DEFAULT_EXPIRY_HOURS = 48;

async function sendExpirySms(toPhone: string, body: string) {
  try {
    const accountSid = await getPlatformConfig("TWILIO_ACCOUNT_SID");
    const authToken = await getPlatformConfig("TWILIO_AUTH_TOKEN");
    const fromNumber = await getPlatformConfig("TWILIO_FROM_NUMBER");
    if (!accountSid || !authToken || !fromNumber) return;
    const testMode = await getPlatformConfig("TWILIO_TEST_MODE");
    if (testMode === "true") {
      console.log(`[RequestExpiryCron SMS TEST] To: ${toPhone} | Body: ${body}`);
      return;
    }
    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const params = new URLSearchParams();
    params.append("From", fromNumber);
    params.append("To", toPhone);
    params.append("Body", body);
    const credentials = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
    await fetch(url, {
      method: "POST",
      headers: { Authorization: `Basic ${credentials}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
  } catch (err) {
    console.error("[RequestExpiryCron] SMS error:", err);
  }
}

async function expireOldRequests() {
  const db = await getDb();
  if (!db) return;

  const now = new Date();
  let expiredCount = 0;
  let reminderCount = 0;

  // Fetch all appointments that have a localId (may have requests)
  const allAppts = await db
    .select()
    .from(appointments)
    .where(isNotNull(appointments.localId));

  // Cache owner settings to avoid repeated DB queries per appointment
  const ownerCache: Record<number, { businessName: string; expiryHours: number; expoPushToken: string | null }> = {};

  for (const appt of allAppts) {
    const cancelReq = (appt as any).cancelRequest as any;
    const reschedReq = (appt as any).rescheduleRequest as any;

    // Skip if no pending requests
    if (
      !(cancelReq?.status === "pending" && cancelReq.submittedAt) &&
      !(reschedReq?.status === "pending" && reschedReq.submittedAt)
    ) {
      continue;
    }

    // Load owner settings (cached)
    if (!ownerCache[appt.businessOwnerId]) {
      try {
        const ownerRows = await db
          .select({
            businessName: businessOwners.businessName,
            requestResponseWindowHours: (businessOwners as any).requestResponseWindowHours,
            expoPushToken: businessOwners.expoPushToken,
          })
          .from(businessOwners)
          .where(eq(businessOwners.id, appt.businessOwnerId))
          .limit(1);
        ownerCache[appt.businessOwnerId] = {
          businessName: ownerRows[0]?.businessName || "the business",
          expiryHours: ownerRows[0]?.requestResponseWindowHours ?? DEFAULT_EXPIRY_HOURS,
          expoPushToken: ownerRows[0]?.expoPushToken ?? null,
        };
      } catch {
        ownerCache[appt.businessOwnerId] = {
          businessName: "the business",
          expiryHours: DEFAULT_EXPIRY_HOURS,
          expoPushToken: null,
        };
      }
    }

    const { businessName, expiryHours, expoPushToken } = ownerCache[appt.businessOwnerId];
    const cutoff = new Date(now.getTime() - expiryHours * 60 * 60 * 1000);
    // 1-hour-before-expiry window: request age is between (expiryHours - 1h) and expiryHours
    const reminderStart = new Date(now.getTime() - (expiryHours - 1) * 60 * 60 * 1000);

    let updated = false;
    let newCancelReq = cancelReq;
    let newReschedReq = reschedReq;

    // ── Cancel request ────────────────────────────────────────────────────
    if (cancelReq?.status === "pending" && cancelReq.submittedAt) {
      const submittedAt = new Date(cancelReq.submittedAt);

      if (submittedAt < cutoff) {
        // EXPIRED
        newCancelReq = { ...cancelReq, status: "expired", expiredAt: now.toISOString() };
        updated = true;

        try {
          const clientRows = await db
            .select({ phone: clients.phone, name: clients.name })
            .from(clients)
            .where(and(eq(clients.localId, appt.clientLocalId ?? ""), eq(clients.businessOwnerId, appt.businessOwnerId)))
            .limit(1);
          const clientPhone = clientRows[0]?.phone;
          const clientName = clientRows[0]?.name || "there";

          if (clientPhone) {
            const formattedDate = appt.date
              ? new Date(appt.date + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
              : "your appointment";
            await sendExpirySms(
              clientPhone,
              `Hi ${clientName}, your cancellation request for your appointment on ${formattedDate} with ${businessName} has expired (no response within ${expiryHours} hours). Your appointment remains as scheduled. Please contact ${businessName} directly if you still need to cancel.`
            );
          }
        } catch (smsErr) {
          console.error("[RequestExpiryCron] Cancel expiry SMS error:", smsErr);
        }

      } else if (submittedAt < reminderStart && !cancelReq.reminderSent && expoPushToken) {
        // 1-HOUR REMINDER — request is in the last hour before expiry
        newCancelReq = { ...cancelReq, reminderSent: true };
        updated = true;

        const formattedDate = appt.date
          ? new Date(appt.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })
          : "an appointment";
        const clientName = appt.clientLocalId ? (
          await db.select({ name: clients.name }).from(clients)
            .where(and(eq(clients.localId, appt.clientLocalId), eq(clients.businessOwnerId, appt.businessOwnerId)))
            .limit(1)
        ).then(rows => rows[0]?.name || "A client").catch(() => "A client") : "A client";

        await sendExpoPush(expoPushToken, {
          title: `⚠️ Cancellation Request Expiring Soon`,
          body: `${clientName}'s cancellation request for ${formattedDate} expires in ~1 hour. Respond now to approve or decline.`,
          data: { type: "cancel_request", appointmentId: appt.localId ?? undefined, filter: "requests" },
          channelId: "appointments",
        });
        reminderCount++;
      }
    }

    // ── Reschedule request ────────────────────────────────────────────────
    if (reschedReq?.status === "pending" && reschedReq.submittedAt) {
      const submittedAt = new Date(reschedReq.submittedAt);

      if (submittedAt < cutoff) {
        // EXPIRED
        newReschedReq = { ...reschedReq, status: "expired", expiredAt: now.toISOString() };
        updated = true;

        try {
          const clientRows = await db
            .select({ phone: clients.phone, name: clients.name })
            .from(clients)
            .where(and(eq(clients.localId, appt.clientLocalId ?? ""), eq(clients.businessOwnerId, appt.businessOwnerId)))
            .limit(1);
          const clientPhone = clientRows[0]?.phone;
          const clientName = clientRows[0]?.name || "there";

          if (clientPhone) {
            const formattedDate = appt.date
              ? new Date(appt.date + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
              : "your appointment";
            await sendExpirySms(
              clientPhone,
              `Hi ${clientName}, your reschedule request for your appointment on ${formattedDate} with ${businessName} has expired (no response within ${expiryHours} hours). Your original appointment remains as scheduled. Please contact ${businessName} directly to reschedule.`
            );
          }
        } catch (smsErr) {
          console.error("[RequestExpiryCron] Reschedule expiry SMS error:", smsErr);
        }

      } else if (submittedAt < reminderStart && !reschedReq.reminderSent && expoPushToken) {
        // 1-HOUR REMINDER
        newReschedReq = { ...reschedReq, reminderSent: true };
        updated = true;

        const formattedDate = appt.date
          ? new Date(appt.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })
          : "an appointment";
        const clientName = appt.clientLocalId ? (
          await db.select({ name: clients.name }).from(clients)
            .where(and(eq(clients.localId, appt.clientLocalId), eq(clients.businessOwnerId, appt.businessOwnerId)))
            .limit(1)
        ).then(rows => rows[0]?.name || "A client").catch(() => "A client") : "A client";

        await sendExpoPush(expoPushToken, {
          title: `⚠️ Reschedule Request Expiring Soon`,
          body: `${clientName}'s reschedule request for ${formattedDate} expires in ~1 hour. Respond now to approve or decline.`,
          data: { type: "reschedule_request", appointmentId: appt.localId ?? undefined, filter: "requests" },
          channelId: "appointments",
        });
        reminderCount++;
      }
    }

    if (updated) {
      await db
        .update(appointments)
        .set({ cancelRequest: newCancelReq, rescheduleRequest: newReschedReq } as any)
        .where(and(eq(appointments.localId, appt.localId ?? ""), eq(appointments.businessOwnerId, appt.businessOwnerId)));
      if (newCancelReq?.status === "expired" || newReschedReq?.status === "expired") {
        expiredCount++;
      }
    }
  }

  if (expiredCount > 0) {
    console.log(`[RequestExpiryCron] Expired ${expiredCount} request(s)`);
  }
  if (reminderCount > 0) {
    console.log(`[RequestExpiryCron] Sent ${reminderCount} 1-hour expiry reminder(s)`);
  }
}

export function startRequestExpiryCron() {
  const INTERVAL_MS = 60 * 60 * 1000; // 1 hour
  console.log("[RequestExpiryCron] Started — checking every hour for expired requests and sending 1-hour reminders");

  // Run immediately on startup
  expireOldRequests().catch(console.error);

  // Then run every hour
  setInterval(() => {
    expireOldRequests().catch(console.error);
  }, INTERVAL_MS);
}
