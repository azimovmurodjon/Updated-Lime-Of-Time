"""
Patch calendar.tsx, staff-form.tsx, and discounts.tsx with exact text replacements.
"""

# ─────────────────────────────────────────────────────────────────────────────
# STAFF-FORM.TSX
# ─────────────────────────────────────────────────────────────────────────────

staff_path = "/home/ubuntu/manus-scheduler/app/staff-form.tsx"
with open(staff_path, "r") as f:
    staff = f.read()

print("=== staff-form.tsx ===")

# 1. Remove refs, add subPicker state
old = """  const staffDraftStartRef = useRef("09:00");
  const staffDraftEndRef = useRef("17:00");
  const [staffDraftStart, setStaffDraftStart] = useState("09:00");
  const [staffDraftEnd, setStaffDraftEnd] = useState("17:00");
  const [staffTimeError, setStaffTimeError] = useState<string | null>(null);"""
new = """  const [staffDraftStart, setStaffDraftStart] = useState("09:00");
  const [staffDraftEnd, setStaffDraftEnd] = useState("17:00");
  const [staffTimeError, setStaffTimeError] = useState<string | null>(null);
  const [staffSubPicker, setStaffSubPicker] = useState<"start" | "end" | null>(null);"""
if old in staff:
    staff = staff.replace(old, new); print("  OK: state block")
else:
    print("  MISS: state block")

# 2. Fix openStaffTimePicker
old = """    staffDraftStartRef.current = ds.start;
    staffDraftEndRef.current = ds.end;
    setStaffDraftStart(ds.start);
    setStaffDraftEnd(ds.end);
    setStaffTimePicker({ day });"""
new = """    setStaffDraftStart(ds.start);
    setStaffDraftEnd(ds.end);
    setStaffTimeError(null);
    setStaffSubPicker(null);
    setStaffTimePicker({ day });"""
if old in staff:
    staff = staff.replace(old, new); print("  OK: openStaffTimePicker")
else:
    print("  MISS: openStaffTimePicker")

# 3. Fix saveStaffTimePicker
old = """    const [sh, sm] = staffDraftStartRef.current.split(":").map(Number);
    const [eh, em] = staffDraftEndRef.current.split(":").map(Number);
    const startMin = sh * 60 + (sm || 0);
    const endMin = eh * 60 + (em || 0);
    if (endMin <= startMin) {
      setStaffTimeError("End time must be after start time.");
      return;
    }
    setStaffTimeError(null);
    updateDaySchedule(staffTimePicker.day, "start", staffDraftStartRef.current);
    updateDaySchedule(staffTimePicker.day, "end", staffDraftEndRef.current);
    setStaffTimePicker(null);
  }, [staffTimePicker]);"""
new = """    const [sh, sm] = staffDraftStart.split(":").map(Number);
    const [eh, em] = staffDraftEnd.split(":").map(Number);
    const startMin = sh * 60 + (sm || 0);
    const endMin = eh * 60 + (em || 0);
    if (endMin <= startMin) {
      setStaffTimeError("End time must be after start time.");
      return;
    }
    setStaffTimeError(null);
    updateDaySchedule(staffTimePicker.day, "start", staffDraftStart);
    updateDaySchedule(staffTimePicker.day, "end", staffDraftEnd);
    setStaffTimePicker(null);
    setStaffSubPicker(null);
  }, [staffTimePicker, staffDraftStart, staffDraftEnd]);"""
if old in staff:
    staff = staff.replace(old, new); print("  OK: saveStaffTimePicker")
else:
    print("  MISS: saveStaffTimePicker")

# 4. Replace modal JSX
old = """      {/* Staff Time Picker Modal */}
      <Modal visible={!!staffTimePicker} transparent animationType="slide">
        <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" }} onPress={() => setStaffTimePicker(null)}>
          <Pressable style={[{ borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 16, paddingBottom: 40, paddingHorizontal: 20, backgroundColor: colors.background }]} onPress={() => {}}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <Text style={{ fontSize: 17, fontWeight: "700", color: colors.foreground }}>
                {staffTimePicker ? (staffTimePicker.day.charAt(0).toUpperCase() + staffTimePicker.day.slice(1)) : ""} Hours
              </Text>
              <Pressable onPress={() => setStaffTimePicker(null)} style={({ pressed }) => [{ opacity: pressed ? 0.5 : 1 }]}>
                <IconSymbol name="xmark" size={22} color={colors.foreground} />
              </Pressable>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 16, marginBottom: 16 }}>
              <View style={{ alignItems: "center", gap: 6 }}>
                <Text style={{ fontSize: 11, fontWeight: "700", color: colors.muted, letterSpacing: 0.8 }}>START</Text>
                <ScrollWheelTimePicker
                  value={staffDraftStart}
                  onChange={(v) => { staffDraftStartRef.current = v; setStaffDraftStart(v); setStaffTimeError(null); }}
                  stepMinutes={15}
                />
              </View>
              <View style={{ width: 1, height: 160, backgroundColor: colors.border }} />
              <View style={{ alignItems: "center", gap: 6 }}>
                <Text style={{ fontSize: 11, fontWeight: "700", color: colors.muted, letterSpacing: 0.8 }}>END</Text>
                <ScrollWheelTimePicker
                  value={staffDraftEnd}
                  onChange={(v) => { staffDraftEndRef.current = v; setStaffDraftEnd(v); setStaffTimeError(null); }}
                  stepMinutes={15}
                />
              </View>
            </View>
            {staffTimeError ? (
              <Text style={{ color: colors.error, fontSize: 13, textAlign: "center", marginBottom: 12 }}>{staffTimeError}</Text>
            ) : null}
            <Pressable
              onPress={saveStaffTimePicker}
              style={({ pressed }) => [{ backgroundColor: staffTimeError ? colors.border : colors.primary, paddingVertical: 16, borderRadius: 14, alignItems: "center", opacity: pressed ? 0.8 : 1 }]}
            >
              <Text style={{ color: staffTimeError ? colors.muted : "#fff", fontWeight: "700", fontSize: 16 }}>Save Hours</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>"""
new = """      {/* Staff Time Picker Modal */}
      <Modal visible={!!staffTimePicker} transparent animationType="slide">
        <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" }} onPress={() => { setStaffTimePicker(null); setStaffSubPicker(null); }}>
          <Pressable style={[{ borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 16, paddingBottom: 40, paddingHorizontal: 20, backgroundColor: colors.background }]} onPress={() => {}}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <Text style={{ fontSize: 17, fontWeight: "700", color: colors.foreground }}>
                {staffTimePicker ? (staffTimePicker.day.charAt(0).toUpperCase() + staffTimePicker.day.slice(1)) : ""} Hours
              </Text>
              <Pressable onPress={() => { setStaffTimePicker(null); setStaffSubPicker(null); }} style={({ pressed }) => [{ opacity: pressed ? 0.5 : 1 }]}>
                <IconSymbol name="xmark" size={22} color={colors.foreground} />
              </Pressable>
            </View>

            {/* Start row */}
            <Pressable
              onPress={() => setStaffSubPicker(staffSubPicker === "start" ? null : "start")}
              style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 14, paddingHorizontal: 4, borderRadius: 12, backgroundColor: staffSubPicker === "start" ? colors.primary + "18" : "transparent", marginBottom: 4 }}
            >
              <Text style={{ fontSize: 15, fontWeight: "600", color: colors.foreground }}>Start Time</Text>
              <Text style={{ fontSize: 17, fontWeight: "700", color: colors.primary }}>{(() => { const [h, m] = staffDraftStart.split(":").map(Number); const ap = h >= 12 ? "PM" : "AM"; const hr = h === 0 ? 12 : h > 12 ? h - 12 : h; return `${hr}:${String(m).padStart(2,"0")} ${ap}`; })()}</Text>
            </Pressable>
            {staffSubPicker === "start" && (
              <TapTimePicker value={staffDraftStart} onChange={(v) => { setStaffDraftStart(v); setStaffTimeError(null); }} stepMinutes={15} />
            )}

            {/* End row */}
            <Pressable
              onPress={() => setStaffSubPicker(staffSubPicker === "end" ? null : "end")}
              style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 14, paddingHorizontal: 4, borderRadius: 12, backgroundColor: staffSubPicker === "end" ? colors.primary + "18" : "transparent", marginBottom: 4 }}
            >
              <Text style={{ fontSize: 15, fontWeight: "600", color: colors.foreground }}>End Time</Text>
              <Text style={{ fontSize: 17, fontWeight: "700", color: colors.primary }}>{(() => { const [h, m] = staffDraftEnd.split(":").map(Number); const ap = h >= 12 ? "PM" : "AM"; const hr = h === 0 ? 12 : h > 12 ? h - 12 : h; return `${hr}:${String(m).padStart(2,"0")} ${ap}`; })()}</Text>
            </Pressable>
            {staffSubPicker === "end" && (
              <TapTimePicker value={staffDraftEnd} onChange={(v) => { setStaffDraftEnd(v); setStaffTimeError(null); }} stepMinutes={15} />
            )}

            {staffTimeError ? (
              <Text style={{ color: colors.error, fontSize: 13, textAlign: "center", marginVertical: 8 }}>{staffTimeError}</Text>
            ) : null}
            <Pressable
              onPress={saveStaffTimePicker}
              style={({ pressed }) => [{ backgroundColor: staffTimeError ? colors.border : colors.primary, paddingVertical: 16, borderRadius: 14, alignItems: "center", opacity: pressed ? 0.8 : 1, marginTop: 12 }]}
            >
              <Text style={{ color: staffTimeError ? colors.muted : "#fff", fontWeight: "700", fontSize: 16 }}>Save Hours</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>"""
if old in staff:
    staff = staff.replace(old, new); print("  OK: modal JSX")
else:
    print("  MISS: modal JSX")

# 5. Remove unused useRef import if no more useRef calls
import re
if "useRef" not in staff.replace("useRef(", "").replace("useRef<", ""):
    staff = re.sub(r',\s*useRef', '', staff)
    staff = re.sub(r'useRef,\s*', '', staff)

with open(staff_path, "w") as f:
    f.write(staff)
print("  staff-form.tsx written")

# ─────────────────────────────────────────────────────────────────────────────
# DISCOUNTS.TSX — already has separate start/end rows; just replace the modal
# ─────────────────────────────────────────────────────────────────────────────

disc_path = "/home/ubuntu/manus-scheduler/app/discounts.tsx"
with open(disc_path, "r") as f:
    disc = f.read()

print("\n=== discounts.tsx ===")

# 1. Replace the modal JSX — discounts already has showTimePicker: "start"|"end"|null
# The modal shows both pickers; replace with single focused picker
old = """      {/* Time Picker Modal */}
      <Modal visible={showTimePicker !== null} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={() => setShowTimePicker(null)}>
          <Pressable style={[styles.modalContent, { backgroundColor: colors.surface }]} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>Time Window</Text>
              <Pressable onPress={() => setShowTimePicker(null)} style={({ pressed }) => [pressed && { opacity: 0.6 }]}>
                <IconSymbol name="xmark" size={20} color={colors.muted} />
              </Pressable>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 16, marginBottom: 16 }}>
              <View style={{ alignItems: "center", gap: 6 }}>
                <Text style={{ fontSize: 11, fontWeight: "700", color: colors.muted, letterSpacing: 0.8 }}>START</Text>
                <ScrollWheelTimePicker
                  value={draftPickerStart}
                  onChange={(v) => { draftStartRef.current = v; setDraftPickerStart(v); setDiscountTimeError(null); }}
                  stepMinutes={15}
                />
              </View>
              <View style={{ width: 1, height: 160, backgroundColor: colors.border }} />
              <View style={{ alignItems: "center", gap: 6 }}>
                <Text style={{ fontSize: 11, fontWeight: "700", color: colors.muted, letterSpacing: 0.8 }}>END</Text>
                <ScrollWheelTimePicker
                  value={draftPickerEnd}
                  onChange={(v) => { draftEndRef.current = v; setDraftPickerEnd(v); setDiscountTimeError(null); }}
                  stepMinutes={15}
                />
              </View>
            </View>
            {discountTimeError ? (
              <Text style={{ color: colors.error, fontSize: 13, textAlign: "center", marginBottom: 12 }}>{discountTimeError}</Text>
            ) : null}
            <Pressable
              onPress={saveTimePicker}
              style={({ pressed }) => [{ backgroundColor: discountTimeError ? colors.border : colors.primary, paddingVertical: 14, borderRadius: 12, alignItems: "center", opacity: pressed ? 0.8 : 1 }]}
            >
              <Text style={{ color: discountTimeError ? colors.muted : "#fff", fontWeight: "700", fontSize: 15 }}>Apply</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>"""
new = """      {/* Time Picker Modal */}
      <Modal visible={showTimePicker !== null} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={() => setShowTimePicker(null)}>
          <Pressable style={[styles.modalContent, { backgroundColor: colors.surface }]} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>
                {showTimePicker === "start" ? "Start Time" : "End Time"}
              </Text>
              <Pressable onPress={() => setShowTimePicker(null)} style={({ pressed }) => [pressed && { opacity: 0.6 }]}>
                <IconSymbol name="xmark" size={20} color={colors.muted} />
              </Pressable>
            </View>
            {showTimePicker === "start" && (
              <TapTimePicker
                value={draftPickerStart}
                onChange={(v) => { draftStartRef.current = v; setDraftPickerStart(v); setDiscountTimeError(null); }}
                stepMinutes={15}
              />
            )}
            {showTimePicker === "end" && (
              <TapTimePicker
                value={draftPickerEnd}
                onChange={(v) => { draftEndRef.current = v; setDraftPickerEnd(v); setDiscountTimeError(null); }}
                stepMinutes={15}
              />
            )}
            {discountTimeError ? (
              <Text style={{ color: colors.error, fontSize: 13, textAlign: "center", marginVertical: 8 }}>{discountTimeError}</Text>
            ) : null}
            <Pressable
              onPress={saveTimePicker}
              style={({ pressed }) => [{ backgroundColor: discountTimeError ? colors.border : colors.primary, paddingVertical: 14, borderRadius: 12, alignItems: "center", opacity: pressed ? 0.8 : 1, marginTop: 12 }]}
            >
              <Text style={{ color: discountTimeError ? colors.muted : "#fff", fontWeight: "700", fontSize: 15 }}>Apply</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>"""
if old in disc:
    disc = disc.replace(old, new); print("  OK: modal JSX")
else:
    print("  MISS: modal JSX")

with open(disc_path, "w") as f:
    f.write(disc)
print("  discounts.tsx written")

# ─────────────────────────────────────────────────────────────────────────────
# CALENDAR.TSX — replace the time picker modal JSX using line ranges
# ─────────────────────────────────────────────────────────────────────────────

cal_path = "/home/ubuntu/manus-scheduler/app/(tabs)/calendar.tsx"
with open(cal_path, "r") as f:
    cal_lines = f.readlines()

print("\n=== calendar.tsx ===")

# Find the modal
start_modal = None
end_modal = None
for i, line in enumerate(cal_lines):
    if start_modal is None and 'ScrollWheelTimePicker' in line:
        # Walk back to find the <Modal
        for j in range(i, max(0, i-40), -1):
            if '<Modal' in cal_lines[j]:
                start_modal = j
                break
        break

if start_modal is not None:
    depth = 0
    for i in range(start_modal, len(cal_lines)):
        if '<Modal' in cal_lines[i]:
            depth += 1
        if '</Modal>' in cal_lines[i]:
            depth -= 1
            if depth == 0:
                end_modal = i
                break
    print(f"  Calendar modal: lines {start_modal+1}-{end_modal+1}")

    # Get the indentation from the first line
    indent = len(cal_lines[start_modal]) - len(cal_lines[start_modal].lstrip())
    ind = " " * indent

    # Build the new modal block
    new_cal_modal = ind + """{/* Time Override Modal */}
""" + ind + """<Modal visible={showTimePickerModal} transparent animationType="slide">
""" + ind + """  <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }} onPress={() => { setShowTimePickerModal(false); setCalSubPicker(null); }}>
""" + ind + """    <Pressable style={{ borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 16, paddingBottom: 40, paddingHorizontal: 20, backgroundColor: colors.background }} onPress={() => {}}>
""" + ind + """      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
""" + ind + """        <Text style={{ fontSize: 17, fontWeight: "700", color: colors.foreground }}>
""" + ind + """          {editingDate ? (() => { const d = new Date(editingDate + "T12:00:00"); return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }); })() : ""} Hours
""" + ind + """        </Text>
""" + ind + """        <Pressable onPress={() => { setShowTimePickerModal(false); setCalSubPicker(null); }} style={({ pressed }) => [{ opacity: pressed ? 0.5 : 1 }]}>
""" + ind + """          <IconSymbol name="xmark" size={22} color={colors.foreground} />
""" + ind + """        </Pressable>
""" + ind + """      </View>

""" + ind + """      {/* Start row */}
""" + ind + """      <Pressable
""" + ind + """        onPress={() => setCalSubPicker(calSubPicker === "start" ? null : "start")}
""" + ind + """        style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 14, paddingHorizontal: 4, borderRadius: 12, backgroundColor: calSubPicker === "start" ? colors.primary + "18" : "transparent", marginBottom: 4 }}
""" + ind + """      >
""" + ind + """        <Text style={{ fontSize: 15, fontWeight: "600", color: colors.foreground }}>Start Time</Text>
""" + ind + """        <Text style={{ fontSize: 17, fontWeight: "700", color: colors.primary }}>{(() => { const [h, m] = draftStart.split(":").map(Number); const ap = h >= 12 ? "PM" : "AM"; const hr = h === 0 ? 12 : h > 12 ? h - 12 : h; return `${hr}:${String(m).padStart(2,"0")} ${ap}`; })()}</Text>
""" + ind + """      </Pressable>
""" + ind + """      {calSubPicker === "start" && (
""" + ind + """        <TapTimePicker value={draftStart} onChange={(v) => { setDraftStart(v); setTimeError(null); }} stepMinutes={15} />
""" + ind + """      )}

""" + ind + """      {/* End row */}
""" + ind + """      <Pressable
""" + ind + """        onPress={() => setCalSubPicker(calSubPicker === "end" ? null : "end")}
""" + ind + """        style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 14, paddingHorizontal: 4, borderRadius: 12, backgroundColor: calSubPicker === "end" ? colors.primary + "18" : "transparent", marginBottom: 4 }}
""" + ind + """      >
""" + ind + """        <Text style={{ fontSize: 15, fontWeight: "600", color: colors.foreground }}>End Time</Text>
""" + ind + """        <Text style={{ fontSize: 17, fontWeight: "700", color: colors.primary }}>{(() => { const [h, m] = draftEnd.split(":").map(Number); const ap = h >= 12 ? "PM" : "AM"; const hr = h === 0 ? 12 : h > 12 ? h - 12 : h; return `${hr}:${String(m).padStart(2,"0")} ${ap}`; })()}</Text>
""" + ind + """      </Pressable>
""" + ind + """      {calSubPicker === "end" && (
""" + ind + """        <TapTimePicker value={draftEnd} onChange={(v) => { setDraftEnd(v); setTimeError(null); }} stepMinutes={15} />
""" + ind + """      )}

""" + ind + """      {timeError ? (
""" + ind + """        <Text style={{ color: colors.error, fontSize: 13, textAlign: "center", marginVertical: 8 }}>⚠ {timeError}</Text>
""" + ind + """      ) : null}
""" + ind + """      <Pressable
""" + ind + """        onPress={handleSaveTimeOverride}
""" + ind + """        style={({ pressed }) => [{ backgroundColor: timeError ? colors.border : colors.primary, paddingVertical: 16, borderRadius: 14, alignItems: "center", opacity: pressed ? 0.8 : 1, marginTop: 12 }]}
""" + ind + """      >
""" + ind + """        <Text style={{ color: timeError ? colors.muted : "#fff", fontWeight: "700", fontSize: 16 }}>Save Hours</Text>
""" + ind + """      </Pressable>
""" + ind + """    </Pressable>
""" + ind + """  </Pressable>
""" + ind + """</Modal>
"""

    new_lines = cal_lines[:start_modal] + [new_cal_modal] + cal_lines[end_modal + 1:]
    with open(cal_path, "w") as f:
        f.writelines(new_lines)
    print("  calendar.tsx modal replaced")
else:
    print("  MISS: could not find calendar modal")

# ─────────────────────────────────────────────────────────────────────────────
# CALENDAR.TSX — also fix the state block and save handler
# ─────────────────────────────────────────────────────────────────────────────
with open(cal_path, "r") as f:
    cal = f.read()

# Add calSubPicker state if not present
if "calSubPicker" not in cal:
    old = "  const [timeError, setTimeError] = useState<string | null>(null);"
    new = """  const [timeError, setTimeError] = useState<string | null>(null);
  const [calSubPicker, setCalSubPicker] = useState<"start" | "end" | null>(null);"""
    if old in cal:
        cal = cal.replace(old, new, 1); print("  OK: calSubPicker state")
    else:
        print("  MISS: calSubPicker state insertion point")

# Fix handleSaveTimeOverride to use state not refs
old = "    const startToSave = draftStartRef.current;\n    const endToSave = draftEndRef.current;"
new = "    const startToSave = draftStart;\n    const endToSave = draftEnd;"
if old in cal:
    cal = cal.replace(old, new); print("  OK: save uses state")
else:
    print("  MISS: save refs")

# Fix setDraftStartSync / setDraftEndSync calls in handleWorkdayToggle and elsewhere
# Replace draftStartRef.current = x; setDraftStart(x) with just setDraftStart(x)
import re
cal = re.sub(r'draftStartRef\.current = ([^;]+);\s*\n\s*setDraftStart\(\1\);', r'setDraftStart(\1);', cal)
cal = re.sub(r'draftEndRef\.current = ([^;]+);\s*\n\s*setDraftEnd\(\1\);', r'setDraftEnd(\1);', cal)

# Remove setDraftStartSync / setDraftEndSync definitions if present
old_sync = """  const setDraftStartSync = useCallback((v: string) => { draftStartRef.current = v; setDraftStart(v); setTimeError(null); }, []);
  const setDraftEndSync = useCallback((v: string) => { draftEndRef.current = v; setDraftEnd(v); setTimeError(null); }, []);"""
if old_sync in cal:
    cal = cal.replace(old_sync, ""); print("  OK: removed sync callbacks")

with open(cal_path, "w") as f:
    f.write(cal)
print("  calendar.tsx written")

print("\nAll done.")
