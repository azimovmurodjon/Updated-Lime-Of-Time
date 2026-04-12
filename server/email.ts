import { Resend } from "resend";

const LOGO_URL = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663347678319/jHoNjHdLsUGgpFhz.png";
const FROM_EMAIL = "Lime Of Time <noreply@lime-of-time.com>";

let resendClient: Resend | null = null;

function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) {
    console.warn("[Email] RESEND_API_KEY not set, email sending disabled");
    return null;
  }
  if (!resendClient) {
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }
  return resendClient;
}

function escHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function formatPhoneDisplay(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits.startsWith("1")) {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return phone;
}

/** Branded HTML email template for Lime Of Time */
function brandedTemplate(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f7f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f7f4;padding:24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
          <!-- Header with Logo -->
          <tr>
            <td style="background: linear-gradient(135deg, #2d5a27 0%, #4a8c3f 100%);padding:32px 24px;text-align:center;">
              <img src="${LOGO_URL}" alt="Lime Of Time" width="64" height="64" style="width:64px;height:64px;border-radius:14px;margin-bottom:12px;display:block;margin-left:auto;margin-right:auto;" />
              <div style="color:#ffffff;font-size:22px;font-weight:700;letter-spacing:0.5px;">Lime Of Time</div>
            </td>
          </tr>
          <!-- Title Bar -->
          <tr>
            <td style="background-color:#e8f5e3;padding:16px 24px;text-align:center;">
              <div style="color:#2d5a27;font-size:18px;font-weight:700;">${escHtml(title)}</div>
            </td>
          </tr>
          <!-- Body Content -->
          <tr>
            <td style="padding:28px 24px;">
              ${bodyHtml}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color:#f8faf8;padding:20px 24px;border-top:1px solid #e8ebe8;text-align:center;">
              <div style="color:#888;font-size:12px;line-height:1.5;">
                <div style="margin-bottom:4px;">Lime Of Time — Scheduling Made Simple</div>
                <a href="https://lime-of-time.com" style="color:#4a8c3f;text-decoration:none;">lime-of-time.com</a>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/** Detail row for email body */
function detailRow(icon: string, label: string, value: string): string {
  return `<tr>
    <td style="padding:6px 0;vertical-align:top;width:28px;font-size:16px;">${icon}</td>
    <td style="padding:6px 0;vertical-align:top;">
      <span style="color:#888;font-size:13px;">${escHtml(label)}</span><br/>
      <span style="color:#1a1a1a;font-size:15px;font-weight:500;">${escHtml(value)}</span>
    </td>
  </tr>`;
}

export interface BookingNotificationData {
  clientName: string;
  clientPhone?: string;
  serviceName: string;
  date: string;
  time: string;
  duration: number;
  totalPrice?: number;
  extras?: Array<{ name: string; price: number; type: string }>;
  giftApplied?: boolean;
  giftUsedAmount?: number;
  notes?: string;
  locationName?: string;
  locationAddress?: string;
}

/**
 * Send a branded "New Booking Request" email to the business owner.
 * Returns true if sent successfully, false otherwise.
 */
export async function sendBookingNotificationEmail(
  toEmail: string,
  businessName: string,
  data: BookingNotificationData
): Promise<boolean> {
  const resend = getResend();
  if (!resend) return false;

  // Format date nicely
  const dateObj = new Date(data.date + "T12:00:00");
  const dateStr = dateObj.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Format time
  const [h, m] = data.time.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 || 12;
  const timeStr = `${hour12}:${String(m).padStart(2, "0")} ${ampm}`;

  // End time
  const totalMin = h * 60 + m + data.duration;
  const endH = Math.floor(totalMin / 60) % 24;
  const endM = totalMin % 60;
  const endAmpm = endH >= 12 ? "PM" : "AM";
  const endHour12 = endH % 12 || 12;
  const endTimeStr = `${endHour12}:${String(endM).padStart(2, "0")} ${endAmpm}`;

  // Build details table
  let detailsHtml = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;">`;
  detailsHtml += detailRow("👤", "Client", data.clientName + (data.clientPhone ? ` — ${formatPhoneDisplay(data.clientPhone)}` : ""));
  detailsHtml += detailRow("💈", "Service", `${data.serviceName} (${data.duration} min)`);
  detailsHtml += detailRow("📅", "Date", dateStr);
  detailsHtml += detailRow("⏰", "Time", `${timeStr} — ${endTimeStr}`);

  // Location
  if (data.locationName) {
    const locValue = data.locationAddress
      ? `${data.locationName} — ${data.locationAddress}`
      : data.locationName;
    detailsHtml += detailRow("📍", "Location", locValue);
  }

  // Extras
  if (data.extras && data.extras.length > 0) {
    const extrasList = data.extras.map(e => `${e.name} ($${(e.price || 0).toFixed(2)})`).join(", ");
    detailsHtml += detailRow("🛒", "Add-ons", extrasList);
  }

  // Pricing
  if (data.totalPrice !== undefined && data.totalPrice > 0) {
    let priceStr = `$${data.totalPrice.toFixed(2)}`;
    if (data.giftApplied && data.giftUsedAmount) {
      priceStr += ` (Gift card applied: -$${data.giftUsedAmount.toFixed(2)})`;
    }
    detailsHtml += detailRow("💰", "Total", priceStr);
  }

  detailsHtml += `</table>`;

  // Notes
  let notesHtml = "";
  if (data.notes) {
    // Strip pricing block from notes for the email
    const cleanNotes = data.notes.replace(/\n?--- Pricing ---[\s\S]*$/, "").trim();
    if (cleanNotes) {
      notesHtml = `<div style="margin-top:12px;padding:12px 16px;background-color:#f8f8f8;border-radius:8px;border-left:3px solid #4a8c3f;">
        <div style="color:#888;font-size:12px;font-weight:600;margin-bottom:4px;">CLIENT NOTE</div>
        <div style="color:#333;font-size:14px;line-height:1.5;">${escHtml(cleanNotes)}</div>
      </div>`;
    }
  }

  const bodyHtml = `
    <div style="color:#333;font-size:15px;line-height:1.6;margin-bottom:16px;">
      You have a new appointment request that needs your review.
    </div>
    ${detailsHtml}
    ${notesHtml}
    <div style="margin-top:24px;text-align:center;">
      <div style="display:inline-block;background-color:#2d5a27;color:#ffffff;padding:12px 32px;border-radius:24px;font-size:15px;font-weight:600;">
        Open the app to accept or decline
      </div>
    </div>
    <div style="margin-top:16px;text-align:center;color:#888;font-size:13px;">
      Please respond promptly so your client can plan accordingly.
    </div>
  `;

  const html = brandedTemplate("New Booking Request", bodyHtml);

  try {
    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to: [toEmail],
      subject: `New Booking Request — ${data.clientName} for ${data.serviceName}`,
      html,
    });
    console.log("[Email] Booking notification sent:", result);
    return true;
  } catch (err) {
    console.error("[Email] Failed to send booking notification:", err);
    return false;
  }
}
