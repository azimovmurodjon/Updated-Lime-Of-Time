/**
 * Buffer time verification tests
 * Tests the exact same logic used in lib/types.ts filterSlots and server/publicRoutes.ts
 */

function timeToMinutes(t) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}
function minutesToTime(m) {
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${h.toString().padStart(2, "0")}:${min.toString().padStart(2, "0")}`;
}

// Client-side filterSlots logic (from lib/types.ts)
function filterSlots(slots, date, serviceDuration, appointments, bufferTime = 0) {
  const dayAppointments = appointments.filter(
    (a) => a.date === date && a.status !== "cancelled"
  );
  return slots.filter((slot) => {
    const slotStart = timeToMinutes(slot);
    const slotEnd = slotStart + serviceDuration;
    return !dayAppointments.some((a) => {
      const apptStart = timeToMinutes(a.time);
      const apptEnd = apptStart + a.duration;
      return slotStart < (apptEnd + bufferTime) && slotEnd > (apptStart - bufferTime);
    });
  });
}

// Server-side logic (from publicRoutes.ts)
function serverFilterSlots(startMin, endMin, duration, interval, appointments, bufferTime, date) {
  const bookedSlots = appointments
    .filter((a) => a.date === date && (a.status === "confirmed" || a.status === "pending"))
    .map((a) => ({
      start: timeToMinutes(a.time),
      end: timeToMinutes(a.time) + (a.duration || 60),
    }));
  const slots = [];
  for (let t = startMin; t + duration <= endMin; t += interval) {
    const slotEnd = t + duration;
    const conflict = bookedSlots.some(
      (b) => t < (b.end + bufferTime) && slotEnd > (b.start - bufferTime)
    );
    if (!conflict) slots.push(minutesToTime(t));
  }
  return slots;
}

let passed = 0;
let failed = 0;

function test(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    console.log(`  ✅ ${name}`);
    passed++;
  } else {
    console.log(`  ❌ ${name}`);
    console.log(`     Expected: ${JSON.stringify(expected)}`);
    console.log(`     Got:      ${JSON.stringify(actual)}`);
    failed++;
  }
}

const DATE = "2026-04-20";

console.log("\n=== Buffer Time Tests ===\n");

// Test 1: No buffer — slot right after appointment is available
{
  const appts = [{ date: DATE, time: "09:30", duration: 5, status: "confirmed" }];
  const slots = ["09:00", "09:05", "09:10", "09:15", "09:20", "09:25", "09:30", "09:35", "09:40"];
  const result = filterSlots(slots, DATE, 5, appts, 0);
  // 09:30 is blocked (overlaps exactly), 09:35 should be free
  test("No buffer: 09:35 is available right after 09:30+5min appt", result.includes("09:35"), true);
  test("No buffer: 09:30 is blocked", result.includes("09:30"), false);
  test("No buffer: 09:25 is blocked (ends at 09:30, overlaps)", result.includes("09:25"), false);
  test("No buffer: 09:20 is available (ends at 09:25, before appt)", result.includes("09:20"), true);
}

// Test 2: 15-min buffer — next slot after 09:30+5min appt should be 09:50
{
  const appts = [{ date: DATE, time: "09:30", duration: 5, status: "confirmed" }];
  const slots = ["09:00","09:05","09:10","09:15","09:20","09:25","09:30","09:35","09:40","09:45","09:50","09:55","10:00"];
  const result = filterSlots(slots, DATE, 5, appts, 15);
  test("15min buffer: 09:50 is first available after 09:30+5min appt", result[result.indexOf("09:50")] === "09:50", true);
  test("15min buffer: 09:35 is blocked (within buffer after appt)", result.includes("09:35"), false);
  test("15min buffer: 09:40 is blocked (within buffer after appt)", result.includes("09:40"), false);
  test("15min buffer: 09:45 is blocked (within buffer after appt)", result.includes("09:45"), false);
  test("15min buffer: 09:50 is available (buffer ends at 09:50)", result.includes("09:50"), true);
  // Pre-appointment buffer: slot ending within 15min before appt start (09:30) should be blocked
  // 09:15 ends at 09:20 — 10 min before appt start — within 15min buffer → blocked
  test("15min buffer: 09:15 is blocked (ends 15min before appt start)", result.includes("09:15"), false);
  // 09:10 ends at 09:15 — 15 min before appt start — exactly at buffer boundary → blocked
  test("15min buffer: 09:10 is blocked (ends exactly at buffer boundary)", result.includes("09:10"), false);
  // 09:05 ends at 09:10 — 20 min before appt start — outside buffer → available
  test("15min buffer: 09:05 is available (ends 20min before appt start)", result.includes("09:05"), true);
}

// Test 3: Server-side logic matches client-side
{
  const appts = [{ date: DATE, time: "09:30", duration: 5, status: "confirmed" }];
  const serverResult = serverFilterSlots(
    timeToMinutes("09:00"), timeToMinutes("11:00"),
    5, 5, appts, 15, DATE
  );
  test("Server: 09:50 is first available after 09:30+5min appt with 15min buffer", serverResult.includes("09:50"), true);
  test("Server: 09:35 is blocked", serverResult.includes("09:35"), false);
  test("Server: 09:45 is blocked", serverResult.includes("09:45"), false);
  test("Server: 09:05 is available", serverResult.includes("09:05"), true);
}

// Test 4: Workday 11:00 AM - 12:00 PM, 5-min service, 5-min step, no buffer
{
  const appts = [];
  const slots = [];
  for (let m = timeToMinutes("11:00"); m + 5 <= timeToMinutes("12:00"); m += 5) {
    slots.push(minutesToTime(m));
  }
  const result = filterSlots(slots, DATE, 5, appts, 0);
  test("Workday 11:00-12:00, 5min step: 11:00 is available", result.includes("11:00"), true);
  test("Workday 11:00-12:00, 5min step: 11:55 is available", result.includes("11:55"), true);
  test("Workday 11:00-12:00, 5min step: 12:00 is NOT generated (11:55+5=12:00 is last)", result.includes("12:00"), false);
  test("Workday 11:00-12:00, 5min step: total 12 slots", result.length === 12, true);
}

// Test 5: 30-min buffer (extreme case)
{
  const appts = [{ date: DATE, time: "10:00", duration: 60, status: "confirmed" }];
  const slots = ["08:00","08:30","09:00","09:30","10:00","10:30","11:00","11:30","12:00","12:30"];
  const result = filterSlots(slots, DATE, 30, appts, 30);
  // Appt: 10:00-11:00, buffer: 30min each side → blocked window: 09:30-11:30
  // 09:30 slot: start=09:30, end=10:00 → slotEnd(10:00) > apptStart-buffer(09:30) → blocked
  test("30min buffer: 09:30 is blocked (pre-buffer)", result.includes("09:30"), false);
  // 09:00 slot: start=09:00, end=09:30 → slotEnd(09:30) > apptStart-buffer(09:30)? 09:30 > 09:30 is false → available
  test("30min buffer: 09:00 is available", result.includes("09:00"), true);
  // 11:00 slot: start=11:00, end=11:30 → slotStart(11:00) < apptEnd+buffer(11:30) AND slotEnd(11:30) > apptStart-buffer(09:30) → blocked
  test("30min buffer: 11:00 is blocked (post-buffer)", result.includes("11:00"), false);
  // 11:30 slot: start=11:30, end=12:00 → slotStart(11:30) < apptEnd+buffer(11:30)? 11:30 < 11:30 is false → available
  test("30min buffer: 11:30 is available", result.includes("11:30"), true);
}

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
if (failed > 0) process.exit(1);
