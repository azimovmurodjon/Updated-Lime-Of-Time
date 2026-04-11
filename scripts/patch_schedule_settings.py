"""
Replace the two time picker modals in schedule-settings.tsx with TapTimePicker-based versions.
Also adds the missing customSubPicker state and removes the old setCustomDraftStartSync/setCustomDraftEndSync refs.
"""
import re

filepath = "/home/ubuntu/manus-scheduler/app/schedule-settings.tsx"

with open(filepath, "r") as f:
    content = f.read()

# ── 1. Remove the old customDraftStartRef / customDraftEndRef and their sync callbacks ──
# These are no longer needed since we use plain state
old_custom_refs = """  const customDraftStartRef = useRef("09:00");
  const customDraftEndRef = useRef("17:00");
  const [customDraftStart, setCustomDraftStart] = useState("09:00");
  const [customDraftEnd, setCustomDraftEnd] = useState("17:00");
  const [customTimeError, setCustomTimeError] = useState<string | null>(null);

  const setCustomDraftStartSync = useCallback((v: string) => {
    customDraftStartRef.current = v;
    setCustomDraftStart(v);
    setCustomTimeError(null);
  }, []);
  const setCustomDraftEndSync = useCallback((v: string) => {
    customDraftEndRef.current = v;
    setCustomDraftEnd(v);
    setCustomTimeError(null);
  }, []);"""

new_custom_refs = """  const [customDraftStart, setCustomDraftStart] = useState("09:00");
  const [customDraftEnd, setCustomDraftEnd] = useState("17:00");
  const [customTimeError, setCustomTimeError] = useState<string | null>(null);
  const [customSubPicker, setCustomSubPicker] = useState<"start" | "end" | null>(null);"""

content = content.replace(old_custom_refs, new_custom_refs)

# ── 2. Fix openCustomTimePicker to not use refs ──
old_open_custom = """  const openCustomTimePicker = useCallback((dateStr: string) => {
    const existing = state.customSchedule.find((cs) => cs.date === dateStr);
    const s = existing?.startTime ?? "09:00";
    const e = existing?.endTime ?? "17:00";
    customDraftStartRef.current = s;
    customDraftEndRef.current = e;
    setCustomDraftStart(s);
    setCustomDraftEnd(e);
    setCustomTimePicker({ date: dateStr });
  }, [state.customSchedule]);"""

new_open_custom = """  const openCustomTimePicker = useCallback((dateStr: string) => {
    const existing = state.customSchedule.find((cs) => cs.date === dateStr);
    setCustomDraftStart(existing?.startTime ?? "09:00");
    setCustomDraftEnd(existing?.endTime ?? "17:00");
    setCustomTimeError(null);
    setCustomSubPicker(null);
    setCustomTimePicker({ date: dateStr });
  }, [state.customSchedule]);"""

content = content.replace(old_open_custom, new_open_custom)

# ── 3. Fix saveCustomTimePicker to use state directly ──
old_save_custom_start = '  const saveCustomTimePicker = useCallback(() => {\n    if (!customTimePicker) return;\n    const startMin = timeToMinutes(customDraftStartRef.current);\n    const endMin = timeToMinutes(customDraftEndRef.current);'
new_save_custom_start = '  const saveCustomTimePicker = useCallback(() => {\n    if (!customTimePicker) return;\n    const startMin = tapTimeToMinutes(customDraftStart);\n    const endMin = tapTimeToMinutes(customDraftEnd);'
content = content.replace(old_save_custom_start, new_save_custom_start)

# Also fix the save to use state vars not refs
old_save_custom_body = '    const cs: CustomScheduleDay = { date: customTimePicker.date, isOpen: true, startTime: customDraftStartRef.current, endTime: customDraftEndRef.current };'
new_save_custom_body = '    const cs: CustomScheduleDay = { date: customTimePicker.date, isOpen: true, startTime: customDraftStart, endTime: customDraftEnd };'
content = content.replace(old_save_custom_body, new_save_custom_body)

# Fix saveCustomTimePicker deps
old_save_custom_deps = '  }, [customTimePicker, state.customSchedule, dispatch, syncToDb]);'
new_save_custom_deps = '  }, [customTimePicker, customDraftStart, customDraftEnd, state.customSchedule, dispatch, syncToDb]);'
# Only replace the first occurrence after saveCustomTimePicker
idx = content.find('const saveCustomTimePicker')
if idx != -1:
    after = content[idx:]
    after = after.replace(old_save_custom_deps, new_save_custom_deps, 1)
    content = content[:idx] + after

with open(filepath, "w") as f:
    f.write(content)

print("Phase 1 done — state/ref cleanup complete")
