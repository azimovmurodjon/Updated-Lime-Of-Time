"""
Replace the two time picker modal JSX blocks in schedule-settings.tsx.
Uses line-range replacement to avoid Unicode comment matching issues.
"""

filepath = "/home/ubuntu/manus-scheduler/app/schedule-settings.tsx"

with open(filepath, "r") as f:
    lines = f.readlines()

# Find the line ranges for the two modals
start_weekly = None
end_weekly = None
start_custom = None
end_custom = None

for i, line in enumerate(lines):
    stripped = line.strip()
    if start_weekly is None and "Weekly Time Picker Modal" in stripped:
        start_weekly = i
    elif start_weekly is not None and end_weekly is None and stripped == "</Modal>":
        end_weekly = i
    elif end_weekly is not None and start_custom is None and "Custom Schedule Time Picker Modal" in stripped:
        start_custom = i
    elif start_custom is not None and end_custom is None and stripped == "</Modal>":
        end_custom = i
        break

print(f"Weekly modal: lines {start_weekly+1}-{end_weekly+1}")
print(f"Custom modal: lines {start_custom+1}-{end_custom+1}")

# ── New weekly modal ──────────────────────────────────────────────────────────
new_weekly = """      {/* Weekly Time Picker Modal */}
      <Modal visible={!!timePickerDay} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={() => { setTimePickerDay(null); setWeekSubPicker(null); }}>
          <Pressable style={[styles.modalContent, { backgroundColor: colors.background }]} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <Text style={{ fontSize: 17, fontWeight: "700", color: colors.foreground }}>
                {timePickerDay ? DAY_FULL[timePickerDay] : ""} Hours
              </Text>
              <Pressable onPress={() => { setTimePickerDay(null); setWeekSubPicker(null); }} style={({ pressed }) => [{ opacity: pressed ? 0.5 : 1 }]}>
                <IconSymbol name="xmark" size={22} color={colors.foreground} />
              </Pressable>
            </View>

            {/* Start row */}
            <Pressable
              onPress={() => setWeekSubPicker(weekSubPicker === "start" ? null : "start")}
              style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 14, paddingHorizontal: 4, borderRadius: 12, backgroundColor: weekSubPicker === "start" ? colors.primary + "18" : "transparent", marginBottom: 4 }}
            >
              <Text style={{ fontSize: 15, fontWeight: "600", color: colors.foreground }}>Start Time</Text>
              <Text style={{ fontSize: 17, fontWeight: "700", color: colors.primary }}>{formatTimeLabel(draftStart)}</Text>
            </Pressable>
            {weekSubPicker === "start" && (
              <TapTimePicker value={draftStart} onChange={(v) => { setDraftStart(v); setWeekTimeError(null); }} stepMinutes={15} />
            )}

            {/* End row */}
            <Pressable
              onPress={() => setWeekSubPicker(weekSubPicker === "end" ? null : "end")}
              style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 14, paddingHorizontal: 4, borderRadius: 12, backgroundColor: weekSubPicker === "end" ? colors.primary + "18" : "transparent", marginBottom: 4 }}
            >
              <Text style={{ fontSize: 15, fontWeight: "600", color: colors.foreground }}>End Time</Text>
              <Text style={{ fontSize: 17, fontWeight: "700", color: colors.primary }}>{formatTimeLabel(draftEnd)}</Text>
            </Pressable>
            {weekSubPicker === "end" && (
              <TapTimePicker value={draftEnd} onChange={(v) => { setDraftEnd(v); setWeekTimeError(null); }} stepMinutes={15} />
            )}

            {weekTimeError ? (
              <Text style={{ color: colors.error, fontSize: 13, textAlign: "center", marginVertical: 8 }}>{weekTimeError}</Text>
            ) : null}
            <Pressable
              onPress={saveTimePicker}
              style={({ pressed }) => [styles.saveBtn, { backgroundColor: weekTimeError ? colors.border : colors.primary, opacity: pressed ? 0.8 : 1, marginTop: 12 }]}
            >
              <Text style={{ color: weekTimeError ? colors.muted : "#fff", fontWeight: "700", fontSize: 16 }}>Save Hours</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
"""

# ── New custom modal ──────────────────────────────────────────────────────────
new_custom = """      {/* Custom Schedule Time Picker Modal */}
      <Modal visible={!!customTimePicker} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={() => { setCustomTimePicker(null); setCustomSubPicker(null); }}>
          <Pressable style={[styles.modalContent, { backgroundColor: colors.background }]} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <Text style={{ fontSize: 17, fontWeight: "700", color: colors.foreground }}>
                {customTimePicker ? (() => {
                  const d = new Date(customTimePicker.date + "T12:00:00");
                  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
                })() : ""} Hours
              </Text>
              <Pressable onPress={() => { setCustomTimePicker(null); setCustomSubPicker(null); }} style={({ pressed }) => [{ opacity: pressed ? 0.5 : 1 }]}>
                <IconSymbol name="xmark" size={22} color={colors.foreground} />
              </Pressable>
            </View>

            {/* Start row */}
            <Pressable
              onPress={() => setCustomSubPicker(customSubPicker === "start" ? null : "start")}
              style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 14, paddingHorizontal: 4, borderRadius: 12, backgroundColor: customSubPicker === "start" ? colors.primary + "18" : "transparent", marginBottom: 4 }}
            >
              <Text style={{ fontSize: 15, fontWeight: "600", color: colors.foreground }}>Start Time</Text>
              <Text style={{ fontSize: 17, fontWeight: "700", color: colors.primary }}>{formatTimeLabel(customDraftStart)}</Text>
            </Pressable>
            {customSubPicker === "start" && (
              <TapTimePicker value={customDraftStart} onChange={(v) => { setCustomDraftStart(v); setCustomTimeError(null); }} stepMinutes={15} />
            )}

            {/* End row */}
            <Pressable
              onPress={() => setCustomSubPicker(customSubPicker === "end" ? null : "end")}
              style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 14, paddingHorizontal: 4, borderRadius: 12, backgroundColor: customSubPicker === "end" ? colors.primary + "18" : "transparent", marginBottom: 4 }}
            >
              <Text style={{ fontSize: 15, fontWeight: "600", color: colors.foreground }}>End Time</Text>
              <Text style={{ fontSize: 17, fontWeight: "700", color: colors.primary }}>{formatTimeLabel(customDraftEnd)}</Text>
            </Pressable>
            {customSubPicker === "end" && (
              <TapTimePicker value={customDraftEnd} onChange={(v) => { setCustomDraftEnd(v); setCustomTimeError(null); }} stepMinutes={15} />
            )}

            {customTimeError ? (
              <Text style={{ color: colors.error, fontSize: 13, textAlign: "center", marginVertical: 8 }}>{customTimeError}</Text>
            ) : null}
            <Pressable
              onPress={saveCustomTimePicker}
              style={({ pressed }) => [styles.saveBtn, { backgroundColor: customTimeError ? colors.border : colors.primary, opacity: pressed ? 0.8 : 1, marginTop: 12 }]}
            >
              <Text style={{ color: customTimeError ? colors.muted : "#fff", fontWeight: "700", fontSize: 16 }}>Save Hours</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
"""

# Replace the line ranges (keep everything before start_weekly, insert new_weekly,
# keep blank line between, insert new_custom, keep everything after end_custom)
new_lines = (
    lines[:start_weekly]
    + [new_weekly]
    + ["\n"]
    + [new_custom]
    + lines[end_custom + 1:]
)

with open(filepath, "w") as f:
    f.writelines(new_lines)

print("Done — both modals replaced")
