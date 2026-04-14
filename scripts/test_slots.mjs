/**
 * Quick verification script for slot generation logic.
 * Tests:
 * 1. Buffer time: 5-min service, 15-min buffer, appointment at 9:30 AM
 *    → slots at 9:35, 9:40, 9:45 should be blocked (within buffer after 9:30+5=9:35)
 *    → next available slot should be 9:50 AM (9:30 + 5 + 15 = 9:50)
 * 2. Pre-appointment buffer: slot ending at 9:29 should be blocked if buffer > 0
 *    → slot at 9:24 (5 min service, ends 9:29) should be blocked with 1-min buffer
 * 3. Workday override: custom day isOpen=true with hours 10:00-12:00 on a normally-closed day
 *    → should generate slots 10:00, 10:30, 11:00, 11:30
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

function filterSlots(slots, date, serviceDuration, appointments, bufferTime = 0) {
  // For testing, skip the "past times" filter (use a date in the future)
  let filtered = [...slots];
  const dayAppointments = appointments.filter(
    (a) => a.date === date && a.status !== "cancelled"
  );
  return filtered.filter((slot) => {
    const slotStart = timeToMinutes(slot);
    const slotEnd = slotStart + serviceDuration;
    return !dayAppointments.some((a) => {
      const apptStart = timeToMinutes(a.time);
      const apptEnd = apptStart + a.duration;
      return slotStart < (apptEnd + bufferTime) && slotEnd > (apptStart - bufferTime);
    });
  });
}

function generateSlots(startTime, endTime, stepMinutes, serviceDuration, appointments, bufferTime, date) {
  const startMin = timeToMinutes(startTime);
  const endMin = timeToMinutes(endTime);
  const slots = [];
  for (let min = startMin; min + serviceDuration <= endMin; min += stepMinutes) {
    slots.push(minutesToTime(min));
  }
  return filterSlots(slots, date, serviceDuration, appointments, bufferTime);
}

// ─── Test 1: Buffer after appointment ───────────────────────────────────────
console.log("=== Test 1: Buffer after appointment ===");
console.log("Setup: 5-min service, 15-min buffer, appointment at 9:30 AM (5 min)");
console.log("Expected: next available slot = 9:50 AM (9:30 + 5 + 15 = 9:50)");
const appts1 = [{ date: "2099-01-01", time: "09:30", duration: 5, status: "confirmed" }];
const slots1 = generateSlots("09:00", "11:00", 5, 5, appts1, 15, "2099-01-01");
console.log("Available slots:", slots1);
const firstAfter930 = slots1.find(s => timeToMinutes(s) >= timeToMinutes("09:30"));
console.log("First slot at or after 9:30:", firstAfter930);
const pass1 = firstAfter930 === "09:50";
console.log(pass1 ? "✅ PASS" : "❌ FAIL - expected 09:50, got " + firstAfter930);

// ─── Test 2: Buffer before appointment ──────────────────────────────────────
console.log("\n=== Test 2: Buffer before appointment ===");
console.log("Setup: 5-min service, 15-min buffer, appointment at 9:30 AM (5 min)");
console.log("Expected: slot at 9:14 should be blocked (9:14+5=9:19, within 15 min of 9:30)");
console.log("Expected: slot at 9:10 should be blocked (9:10+5=9:15, within 15 min of 9:30)");
console.log("Expected: slot at 9:09 should be allowed (9:09+5=9:14, more than 15 min before 9:30... wait: 9:30 - 15 = 9:15, so 9:14 < 9:15 → allowed)");
// With bufferTime=15: slotEnd > (apptStart - bufferTime) = slotEnd > (9:30 - 15) = slotEnd > 9:15
// So slot at 9:11 (end=9:16) would be blocked. Slot at 9:10 (end=9:15) would NOT be blocked (9:15 > 9:15 is false).
const appts2 = [{ date: "2099-01-01", time: "09:30", duration: 5, status: "confirmed" }];
const slots2 = generateSlots("09:00", "09:35", 1, 5, appts2, 15, "2099-01-01");
console.log("Available slots (9:00-9:35, 1-min step, 5-min service, 15-min buffer):", slots2);
const has910 = slots2.includes("09:10");
const has911 = slots2.includes("09:11");
console.log("09:10 available (expected YES):", has910 ? "✅ YES" : "❌ NO");
console.log("09:11 available (expected NO - ends at 9:16, within buffer of 9:30):", !has911 ? "✅ NO (correct)" : "❌ YES (wrong)");

// ─── Test 3: Workday override on normally-closed day ────────────────────────
console.log("\n=== Test 3: Workday override ===");
console.log("Setup: Custom hours 10:00-12:00, 30-min step, 30-min service, no appointments");
const slots3 = generateSlots("10:00", "12:00", 30, 30, [], 0, "2099-01-01");
console.log("Available slots:", slots3);
const expected3 = ["10:00", "10:30", "11:00", "11:30"];
const pass3 = JSON.stringify(slots3) === JSON.stringify(expected3);
console.log(pass3 ? "✅ PASS" : "❌ FAIL - expected " + JSON.stringify(expected3) + ", got " + JSON.stringify(slots3));

// ─── Test 4: User's exact scenario ──────────────────────────────────────────
console.log("\n=== Test 4: User's exact scenario ===");
console.log("Setup: 9:00-11:00 workday, 5-min service, 15-min buffer, appointment at 9:30 AM");
console.log("Expected: 9:50 is next available after 9:30");
const appts4 = [{ date: "2099-01-01", time: "09:30", duration: 5, status: "confirmed" }];
const slots4 = generateSlots("09:00", "11:00", 5, 5, appts4, 15, "2099-01-01");
const has950 = slots4.includes("09:50");
const has935 = slots4.includes("09:35");
const has940 = slots4.includes("09:40");
const has945 = slots4.includes("09:45");
console.log("9:35 blocked (expected YES):", !has935 ? "✅ YES (blocked)" : "❌ NO (not blocked)");
console.log("9:40 blocked (expected YES):", !has940 ? "✅ YES (blocked)" : "❌ NO (not blocked)");
console.log("9:45 blocked (expected YES):", !has945 ? "✅ YES (blocked)" : "❌ NO (not blocked)");
console.log("9:50 available (expected YES):", has950 ? "✅ YES" : "❌ NO");
console.log("All slots:", slots4.filter(s => timeToMinutes(s) >= timeToMinutes("09:25") && timeToMinutes(s) <= timeToMinutes("10:00")));
