/**
 * Request Expiry Cron
 *
 * Runs every hour. Auto-expires any pending cancel or reschedule requests
 * that are older than the owner's configured response window (default 48h).
 * Sends an SMS to the client notifying them that their request expired.
 */
import { getDb } from "./db";
import { appointments, businessOwners, clients } from "../drizzle/schema";
import { eq, and, isNotNull } from "drizzle-orm";
import { getPlatformConfig } from "./subscription";

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

  // Fetch all appointments that have a cancelRequest or rescheduleRequest set
  const allAppts = await db
    .select()
    .from(appointments)
    .where(isNotNull(appointments.localId));

  // Cache owner settings to avoid repeated DB queries per appointment
  const ownerCache: Record<number, { businessName: string; expiryHours: number }> = {};

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
          .select({ businessName: businessOwners.businessName, requestResponseWindowHours: (businessOwners as any).requestResponseWindowHours })
          .from(businessOwners)
          .where(eq(businessOwners.id, appt.businessOwnerId))
          .limit(1);
        ownerCache[appt.businessOwnerId] = {
          businessName: ownerRows[0]?.businessName || "the business",
          expiryHours: ownerRows[0]?.requestResponseWindowHours ?? DEFAULT_EXPIRY_HOURS,
        };
      } catch {
        ownerCache[appt.businessOwnerId] = {
          businessName: "the business",
          expiryHours: DEFAULT_EXPIRY_HOURS,
        };
      }
    }

    const { businessName, expiryHours } = ownerCache[appt.businessOwnerId];
    const cutoff = new Date(now.getTime() - expiryHours * 60 * 60 * 1000);

    let updated = false;
    let newCancelReq = cancelReq;
    let newReschedReq = reschedReq;

    // Check cancel request expiry
    if (cancelReq?.status === "pending" && cancelReq.submittedAt) {
      const submittedAt = new Date(cancelReq.submittedAt);
      if (submittedAt < cutoff) {
        newCancelReq = { ...cancelReq, status: "expired", expiredAt: now.toISOString() };
        updated = true;

        // Send SMS to client
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
      }
    }

    // Check reschedule request expiry
    if (reschedReq?.status === "pending" && reschedReq.submittedAt) {
      const submittedAt = new Date(reschedReq.submittedAt);
      if (submittedAt < cutoff) {
        newReschedReq = { ...reschedReq, status: "expired", expiredAt: now.toISOString() };
        updated = true;

        // Send SMS to client
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
      }
    }

    if (updated) {
      await db
        .update(appointments)
        .set({ cancelRequest: newCancelReq, rescheduleRequest: newReschedReq } as any)
        .where(and(eq(appointments.localId, appt.localId ?? ""), eq(appointments.businessOwnerId, appt.businessOwnerId)));
      expiredCount++;
    }
  }

  if (expiredCount > 0) {
    console.log(`[RequestExpiryCron] Expired ${expiredCount} request(s)`);
  }
}

export function startRequestExpiryCron() {
  const INTERVAL_MS = 60 * 60 * 1000; // 1 hour
  console.log("[RequestExpiryCron] Started — checking every hour for expired requests (per-owner response window)");

  // Run immediately on startup
  expireOldRequests().catch(console.error);

  // Then run every hour
  setInterval(() => {
    expireOldRequests().catch(console.error);
  }, INTERVAL_MS);
}
