/**
 * Professional PDF Export Utility
 * Generates HTML-based PDFs using expo-print for mobile and browser print for web.
 * Each export type generates a branded, professional document.
 */
import { Platform } from "react-native";
import type { Service, Appointment, Client, Review, StaffMember } from "./types";
import { formatPhoneNumber, stripPhoneFormat, formatTimeDisplay, formatDateLong } from "./types";

// ── Shared Styles ────────────────────────────────────────────────────

function pdfStyles(accentColor: string): string {
  return `
    <style>
      @page { margin: 40px 50px; }
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif; color: #1a1a1a; font-size: 12px; line-height: 1.5; }
      .header { text-align: center; padding: 24px 0 20px; border-bottom: 3px solid ${accentColor}; margin-bottom: 24px; }
      .header h1 { font-size: 22px; font-weight: 700; color: ${accentColor}; margin-bottom: 4px; }
      .header p { font-size: 11px; color: #666; }
      .section { margin-bottom: 20px; }
      .section-title { font-size: 14px; font-weight: 700; color: ${accentColor}; margin-bottom: 10px; padding-bottom: 6px; border-bottom: 1.5px solid ${accentColor}33; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
      th { background: ${accentColor}11; color: ${accentColor}; font-weight: 600; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; padding: 8px 10px; text-align: left; border-bottom: 2px solid ${accentColor}33; }
      td { padding: 7px 10px; border-bottom: 1px solid #eee; font-size: 11px; }
      tr:nth-child(even) td { background: #fafafa; }
      .stat-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
      .stat-label { color: #666; font-size: 11px; }
      .stat-value { font-weight: 600; font-size: 13px; }
      .summary-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-bottom: 20px; }
      .summary-card { background: ${accentColor}08; border: 1px solid ${accentColor}22; border-radius: 8px; padding: 14px; text-align: center; }
      .summary-card .label { font-size: 10px; color: #666; text-transform: uppercase; letter-spacing: 0.5px; }
      .summary-card .value { font-size: 20px; font-weight: 700; color: ${accentColor}; margin-top: 4px; }
      .footer { text-align: center; padding: 16px 0; border-top: 1px solid #eee; margin-top: 24px; color: #999; font-size: 10px; }
      .badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 10px; font-weight: 600; }
      .badge-confirmed { background: #dcfce7; color: #166534; }
      .badge-pending { background: #fef3c7; color: #92400e; }
      .badge-cancelled { background: #fee2e2; color: #991b1b; }
      .badge-completed { background: #e0e7ff; color: #3730a3; }
      .notes-cell { max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .star { color: #f59e0b; }
      .star-empty { color: #d1d5db; }
    </style>
  `;
}

function pdfHeader(businessName: string, reportTitle: string, dateRange?: string, locationName?: string, locationAddress?: string, logoUri?: string): string {
  const now = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const locationLine = locationName
    ? (locationAddress ? `${escHtml(locationName)} — ${escHtml(locationAddress)}` : escHtml(locationName))
    : (locationAddress ? escHtml(locationAddress) : "");
  const logoHtml = logoUri
    ? `<img src="${logoUri}" alt="${escHtml(businessName)}" style="width:64px;height:64px;border-radius:50%;object-fit:cover;margin-bottom:8px;border:2px solid rgba(0,0,0,0.08);" /><br/>`
    : "";
  return `
    <div class="header">
      ${logoHtml}
      <h1>${escHtml(businessName)}</h1>
      ${locationLine ? `<p style="font-size:12px;color:#555;margin-top:2px;">📍 ${locationLine}</p>` : ""}
      <p style="font-size:16px;font-weight:600;color:#333;margin-top:6px;">${reportTitle}</p>
      <p>Generated on ${now}${dateRange ? ` | ${dateRange}` : ""}</p>
    </div>
  `;
}

function pdfFooter(businessName: string): string {
  return `
    <div class="footer">
      <p>Confidential — ${escHtml(businessName)} | Powered by Lime of Time</p>
    </div>
  `;
}

function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function fmtCurrency(n: number): string {
  return "$" + n.toFixed(2);
}

function starRating(rating: number): string {
  let s = "";
  for (let i = 1; i <= 5; i++) {
    s += i <= rating ? '<span class="star">★</span>' : '<span class="star-empty">★</span>';
  }
  return s;
}

// ── Client Report ────────────────────────────────────────────────────

export function generateClientsPdf(businessName: string, clients: Client[], accentColor: string, locationName?: string, locationAddress?: string, logoUri?: string): string {
  const totalClients = clients.length;
  const withEmail = clients.filter((c) => c.email).length;
  const withNotes = clients.filter((c) => c.notes).length;

  return `<!DOCTYPE html><html><head><meta charset="UTF-8">${pdfStyles(accentColor)}</head><body>
    ${pdfHeader(businessName, "Client Directory Report", undefined, locationName, locationAddress, logoUri)}
    <div class="summary-grid">
      <div class="summary-card"><div class="label">Total Clients</div><div class="value">${totalClients}</div></div>
      <div class="summary-card"><div class="label">With Email</div><div class="value">${withEmail}</div></div>
      <div class="summary-card"><div class="label">With Notes</div><div class="value">${withNotes}</div></div>
    </div>
    <div class="section">
      <div class="section-title">Client List</div>
      <table>
        <thead><tr><th>#</th><th>Name</th><th>Phone</th><th>Email</th><th>Notes</th><th>Added</th></tr></thead>
        <tbody>
          ${clients.map((c, i) => `<tr>
            <td>${i + 1}</td>
            <td style="font-weight:600;">${escHtml(c.name)}</td>
            <td>${formatPhoneNumber(stripPhoneFormat(c.phone))}</td>
            <td>${c.email ? escHtml(c.email) : "—"}</td>
            <td class="notes-cell">${c.notes ? escHtml(c.notes) : "—"}</td>
            <td>${c.createdAt ? new Date(c.createdAt).toLocaleDateString() : "—"}</td>
          </tr>`).join("")}
        </tbody>
      </table>
    </div>
    ${pdfFooter(businessName)}
  </body></html>`;
}

// ── Appointments Report ──────────────────────────────────────────────

export function generateAppointmentsPdf(
  businessName: string,
  appointments: Appointment[],
  services: Service[],
  clients: Client[],
  accentColor: string,
  locationName?: string,
  locationAddress?: string,
  logoUri?: string
): string {
  const total = appointments.length;
  const confirmed = appointments.filter((a) => a.status === "confirmed").length;
  const completed = appointments.filter((a) => a.status === "completed").length;
  const cancelled = appointments.filter((a) => a.status === "cancelled").length;
  const pending = appointments.filter((a) => a.status === "pending").length;
  const totalRevenue = appointments
    .filter((a) => a.status === "completed")
    .reduce((sum, a) => {
      const svc = services.find((s) => s.id === a.serviceId);
      return sum + (a.totalPrice ?? svc?.price ?? 0);
    }, 0);

  const sorted = [...appointments].sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time));

  return `<!DOCTYPE html><html><head><meta charset="UTF-8">${pdfStyles(accentColor)}</head><body>
    ${pdfHeader(businessName, "Appointments Report", undefined, locationName, locationAddress, logoUri)}
    <div class="summary-grid">
      <div class="summary-card"><div class="label">Total</div><div class="value">${total}</div></div>
      <div class="summary-card"><div class="label">Completed</div><div class="value">${completed}</div></div>
      <div class="summary-card"><div class="label">Revenue</div><div class="value">${fmtCurrency(totalRevenue)}</div></div>
    </div>
    <div style="display:flex;gap:12px;margin-bottom:20px;">
      <div style="flex:1;text-align:center;padding:8px;background:#dcfce7;border-radius:6px;"><strong>${confirmed}</strong><br><span style="font-size:10px;color:#166534;">Confirmed</span></div>
      <div style="flex:1;text-align:center;padding:8px;background:#fef3c7;border-radius:6px;"><strong>${pending}</strong><br><span style="font-size:10px;color:#92400e;">Pending</span></div>
      <div style="flex:1;text-align:center;padding:8px;background:#fee2e2;border-radius:6px;"><strong>${cancelled}</strong><br><span style="font-size:10px;color:#991b1b;">Cancelled</span></div>
    </div>
    <div class="section">
      <div class="section-title">Appointment Details</div>
      <table>
        <thead><tr><th>Date</th><th>Time</th><th>Duration</th><th>Service</th><th>Client</th><th>Status</th><th>Total</th></tr></thead>
        <tbody>
          ${sorted.map((a) => {
            const svc = services.find((s) => s.id === a.serviceId);
            const client = clients.find((c) => c.id === a.clientId);
            const statusClass = `badge-${a.status}`;
            const price = a.totalPrice ?? svc?.price ?? 0;
            return `<tr>
              <td>${a.date}</td>
              <td>${formatTimeDisplay(a.time)}</td>
              <td>${a.duration} min</td>
              <td>${svc ? escHtml(svc.name) : "—"}</td>
              <td>${client ? escHtml(client.name) : "—"}</td>
              <td><span class="badge ${statusClass}">${a.status}</span></td>
              <td>${fmtCurrency(price)}</td>
            </tr>`;
          }).join("")}
        </tbody>
      </table>
    </div>
    ${pdfFooter(businessName)}
  </body></html>`;
}

// ── Services Report ──────────────────────────────────────────────────

export function generateServicesPdf(businessName: string, services: Service[], appointments: Appointment[], accentColor: string, locationName?: string, locationAddress?: string, logoUri?: string): string {
  const totalServices = services.length;
  const avgPrice = services.length > 0 ? services.reduce((s, svc) => s + svc.price, 0) / services.length : 0;
  const avgDuration = services.length > 0 ? services.reduce((s, svc) => s + svc.duration, 0) / services.length : 0;

  // Calculate booking count per service
  const bookingCounts: Record<string, number> = {};
  appointments.forEach((a) => { bookingCounts[a.serviceId] = (bookingCounts[a.serviceId] || 0) + 1; });

  // Group by category
  const categories: Record<string, Service[]> = {};
  services.forEach((s) => {
    const cat = s.category || "Uncategorized";
    if (!categories[cat]) categories[cat] = [];
    categories[cat].push(s);
  });

  let categoryHtml = "";
  Object.entries(categories).sort(([a], [b]) => a.localeCompare(b)).forEach(([cat, svcs]) => {
    categoryHtml += `
      <div class="section">
        <div class="section-title">${escHtml(cat)} (${svcs.length})</div>
        <table>
          <thead><tr><th>Service</th><th>Duration</th><th>Price</th><th>Bookings</th><th>Revenue</th></tr></thead>
          <tbody>
            ${svcs.map((s) => {
              const count = bookingCounts[s.id] || 0;
              const rev = count * s.price;
              return `<tr>
                <td style="font-weight:600;"><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${s.color};margin-right:6px;vertical-align:middle;"></span>${escHtml(s.name)}</td>
                <td>${s.duration} min</td>
                <td>${fmtCurrency(s.price)}</td>
                <td>${count}</td>
                <td>${fmtCurrency(rev)}</td>
              </tr>`;
            }).join("")}
          </tbody>
        </table>
      </div>
    `;
  });

  return `<!DOCTYPE html><html><head><meta charset="UTF-8">${pdfStyles(accentColor)}</head><body>
    ${pdfHeader(businessName, "Services Report", undefined, locationName, locationAddress, logoUri)}
    <div class="summary-grid">
      <div class="summary-card"><div class="label">Total Services</div><div class="value">${totalServices}</div></div>
      <div class="summary-card"><div class="label">Avg Price</div><div class="value">${fmtCurrency(avgPrice)}</div></div>
      <div class="summary-card"><div class="label">Avg Duration</div><div class="value">${Math.round(avgDuration)} min</div></div>
    </div>
    ${categoryHtml}
    ${pdfFooter(businessName)}
  </body></html>`;
}

// ── Revenue Report ───────────────────────────────────────────────────

export function generateRevenuePdf(
  businessName: string,
  appointments: Appointment[],
  services: Service[],
  accentColor: string,
  locationName?: string,
  locationAddress?: string,
  logoUri?: string
): string {
  const completed = appointments.filter((a) => a.status === "completed");
  const totalRevenue = completed.reduce((sum, a) => {
    const svc = services.find((s) => s.id === a.serviceId);
    return sum + (a.totalPrice ?? svc?.price ?? 0);
  }, 0);

  // Monthly breakdown
  const months: Record<string, { rev: number; count: number }> = {};
  completed.forEach((a) => {
    const m = a.date.substring(0, 7);
    if (!months[m]) months[m] = { rev: 0, count: 0 };
    const svc = services.find((s) => s.id === a.serviceId);
    months[m].rev += a.totalPrice ?? svc?.price ?? 0;
    months[m].count++;
  });
  const sortedMonths = Object.entries(months).sort(([a], [b]) => a.localeCompare(b));

  // Top services by revenue
  const svcRev: Record<string, { name: string; rev: number; count: number }> = {};
  completed.forEach((a) => {
    const svc = services.find((s) => s.id === a.serviceId);
    if (svc) {
      if (!svcRev[svc.id]) svcRev[svc.id] = { name: svc.name, rev: 0, count: 0 };
      svcRev[svc.id].rev += a.totalPrice ?? svc.price ?? 0;
      svcRev[svc.id].count++;
    }
  });
  const topServices = Object.values(svcRev).sort((a, b) => b.rev - a.rev).slice(0, 10);

  const avgPerAppt = completed.length > 0 ? totalRevenue / completed.length : 0;

  return `<!DOCTYPE html><html><head><meta charset="UTF-8">${pdfStyles(accentColor)}</head><body>
    ${pdfHeader(businessName, "Revenue Report", undefined, locationName, locationAddress, logoUri)}
    <div class="summary-grid">
      <div class="summary-card"><div class="label">Total Revenue</div><div class="value">${fmtCurrency(totalRevenue)}</div></div>
      <div class="summary-card"><div class="label">Completed Appts</div><div class="value">${completed.length}</div></div>
      <div class="summary-card"><div class="label">Avg per Appt</div><div class="value">${fmtCurrency(avgPerAppt)}</div></div>
    </div>
    <div class="section">
      <div class="section-title">Monthly Revenue Breakdown</div>
      <table>
        <thead><tr><th>Month</th><th>Revenue</th><th>Appointments</th><th>Avg per Appt</th></tr></thead>
        <tbody>
          ${sortedMonths.map(([m, d]) => `<tr>
            <td style="font-weight:600;">${m}</td>
            <td>${fmtCurrency(d.rev)}</td>
            <td>${d.count}</td>
            <td>${fmtCurrency(d.count > 0 ? d.rev / d.count : 0)}</td>
          </tr>`).join("")}
          <tr style="font-weight:700;border-top:2px solid #333;">
            <td>TOTAL</td>
            <td>${fmtCurrency(totalRevenue)}</td>
            <td>${completed.length}</td>
            <td>${fmtCurrency(avgPerAppt)}</td>
          </tr>
        </tbody>
      </table>
    </div>
    ${topServices.length > 0 ? `
    <div class="section">
      <div class="section-title">Top Services by Revenue</div>
      <table>
        <thead><tr><th>#</th><th>Service</th><th>Revenue</th><th>Bookings</th></tr></thead>
        <tbody>
          ${topServices.map((s, i) => `<tr>
            <td>${i + 1}</td>
            <td style="font-weight:600;">${escHtml(s.name)}</td>
            <td>${fmtCurrency(s.rev)}</td>
            <td>${s.count}</td>
          </tr>`).join("")}
        </tbody>
      </table>
    </div>` : ""}
    ${pdfFooter(businessName)}
  </body></html>`;
}

// ── Export Function ──────────────────────────────────────────────────

export async function exportPdf(html: string, filename: string): Promise<void> {
  if (Platform.OS === "web") {
    // On web, open print dialog
    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => printWindow.print(), 500);
    }
  } else {
    // On native, use expo-print + expo-sharing
    const Print = await import("expo-print");
    const Sharing = await import("expo-sharing");
    const { uri } = await Print.printToFileAsync({ html, base64: false });
    await Sharing.shareAsync(uri, { mimeType: "application/pdf", dialogTitle: filename });
  }
}

// ── Payment Summary Report ────────────────────────────────────────────

export function generatePaymentSummaryPdf(
  businessName: string,
  appointments: Appointment[],
  services: Service[],
  clients: Client[],
  accentColor: string,
  dateRangeLabel: string,
  locationName?: string,
  locationAddress?: string,
  logoUri?: string
): string {
  const getPrice = (a: Appointment) => a.totalPrice ?? services.find((s) => s.id === a.serviceId)?.price ?? 0;
  const getClientName = (a: Appointment) => clients.find((c) => c.id === a.clientId)?.name ?? "Unknown";
  const getServiceName = (a: Appointment) => services.find((s) => s.id === a.serviceId)?.name ?? "Unknown";

  const active = appointments.filter((a) => a.status !== "cancelled");
  const paid = active.filter((a) => a.paymentStatus === "paid");
  const unpaid = active.filter((a) => a.paymentStatus !== "paid");

  const paidTotal = paid.reduce((s, a) => s + getPrice(a), 0);
  const unpaidTotal = unpaid.reduce((s, a) => s + getPrice(a), 0);
  const totalAmount = paidTotal + unpaidTotal;
  const collectionRate = totalAmount > 0 ? Math.round((paidTotal / totalAmount) * 100) : 0;

  // Payment method breakdown
  const methodMap: Record<string, { label: string; count: number; total: number }> = {};
  const methodLabels: Record<string, string> = { cash: "Cash", zelle: "Zelle", venmo: "Venmo", cashapp: "Card" };
  paid.forEach((a) => {
    const m = a.paymentMethod || "unknown";
    if (!methodMap[m]) methodMap[m] = { label: methodLabels[m] || m, count: 0, total: 0 };
    methodMap[m].count++;
    methodMap[m].total += getPrice(a);
  });
  const methodRows = Object.values(methodMap).sort((a, b) => b.total - a.total);

  const fmtDate = (d: string) => {
    try { return new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); }
    catch { return d; }
  };

  const paidRows = paid.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 50);
  const unpaidRows = unpaid.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 50);

  return `<!DOCTYPE html><html><head><meta charset="UTF-8">${pdfStyles(accentColor)}</head><body>
    ${pdfHeader(businessName, "Payment Summary", dateRangeLabel, locationName, locationAddress, logoUri)}
    <div class="summary-grid">
      <div class="summary-card"><div class="label">Total Collected</div><div class="value">${fmtCurrency(paidTotal)}</div></div>
      <div class="summary-card"><div class="label">Outstanding</div><div class="value" style="color:#EF4444;">${fmtCurrency(unpaidTotal)}</div></div>
      <div class="summary-card"><div class="label">Collection Rate</div><div class="value">${collectionRate}%</div></div>
    </div>

    ${methodRows.length > 0 ? `
    <div class="section">
      <div class="section-title">Payment Method Breakdown</div>
      <table>
        <thead><tr><th>Method</th><th>Count</th><th>Total Collected</th></tr></thead>
        <tbody>
          ${methodRows.map((m) => `<tr>
            <td style="font-weight:600;">${escHtml(m.label)}</td>
            <td>${m.count}</td>
            <td>${fmtCurrency(m.total)}</td>
          </tr>`).join("")}
        </tbody>
      </table>
    </div>` : ""}

    ${paidRows.length > 0 ? `
    <div class="section">
      <div class="section-title">Paid Appointments (${paid.length})</div>
      <table>
        <thead><tr><th>Date</th><th>Client</th><th>Service</th><th>Method</th><th>Amount</th></tr></thead>
        <tbody>
          ${paidRows.map((a) => `<tr>
            <td>${fmtDate(a.date)}</td>
            <td style="font-weight:600;">${escHtml(getClientName(a))}</td>
            <td>${escHtml(getServiceName(a))}</td>
            <td>${escHtml(methodLabels[a.paymentMethod || ""] || a.paymentMethod || "—")}</td>
            <td style="font-weight:600;color:#22C55E;">${fmtCurrency(getPrice(a))}</td>
          </tr>`).join("")}
        </tbody>
      </table>
    </div>` : ""}

    ${unpaidRows.length > 0 ? `
    <div class="section">
      <div class="section-title">Outstanding Appointments (${unpaid.length})</div>
      <table>
        <thead><tr><th>Date</th><th>Client</th><th>Service</th><th>Status</th><th>Amount Due</th></tr></thead>
        <tbody>
          ${unpaidRows.map((a) => `<tr>
            <td>${fmtDate(a.date)}</td>
            <td style="font-weight:600;">${escHtml(getClientName(a))}</td>
            <td>${escHtml(getServiceName(a))}</td>
            <td><span class="badge badge-${a.status}">${a.status}</span></td>
            <td style="font-weight:600;color:#EF4444;">${fmtCurrency(getPrice(a))}</td>
          </tr>`).join("")}
        </tbody>
      </table>
    </div>` : ""}

    ${pdfFooter(businessName)}
  </body></html>`;
}
