"""
Patch calendar.tsx, staff-form.tsx, and discounts.tsx to replace ScrollWheelTimePicker
with TapTimePicker using the Start/End row + sub-picker approach.
"""
import re

# ─────────────────────────────────────────────────────────────────────────────
# Helper
# ─────────────────────────────────────────────────────────────────────────────

def replace_all(content, old, new, label=""):
    if old in content:
        content = content.replace(old, new)
        print(f"  OK: {label}")
    else:
        print(f"  MISS: {label}")
    return content

# ─────────────────────────────────────────────────────────────────────────────
# CALENDAR.TSX
# ─────────────────────────────────────────────────────────────────────────────

cal_path = "/home/ubuntu/manus-scheduler/app/(tabs)/calendar.tsx"
with open(cal_path, "r") as f:
    cal = f.read()

print("=== calendar.tsx ===")

# 1. Replace import
cal = replace_all(cal,
    'import { ScrollWheelTimePicker } from "@/components/scroll-wheel-time-picker";',
    'import { TapTimePicker, timeToMinutes as tapTimeToMinutes } from "@/components/tap-time-picker";',
    "import"
)

# 2. Find and replace the time picker state block — remove refs, add subPicker state
old_cal_state = '''  const draftStartRef = useRef<string>("09:00");
  const draftEndRef = useRef<string>("17:00");
  const [draftStart, setDraftStart] = useState("09:00");
  const [draftEnd, setDraftEnd] = useState("17:00");
  const [timeError, setTimeError] = useState<string | null>(null);

  const setDraftStartSync = useCallback((v: string) => {
    draftStartRef.current = v;
    setDraftStart(v);
    setTimeError(null);
  }, []);
  const setDraftEndSync = useCallback((v: string) => {
    draftEndRef.current = v;
    setDraftEnd(v);
    setTimeError(null);
  }, []);'''

new_cal_state = '''  const [draftStart, setDraftStart] = useState("09:00");
  const [draftEnd, setDraftEnd] = useState("17:00");
  const [timeError, setTimeError] = useState<string | null>(null);
  const [calSubPicker, setCalSubPicker] = useState<"start" | "end" | null>(null);'''

cal = replace_all(cal, old_cal_state, new_cal_state, "state block")

# 3. Fix openTimePicker to not use refs
old_cal_open = '''    draftStartRef.current = s;
    draftEndRef.current = e;
    setDraftStart(s);
    setDraftEnd(e);'''
new_cal_open = '''    setDraftStart(s);
    setDraftEnd(e);
    setCalSubPicker(null);
    setTimeError(null);'''
cal = replace_all(cal, old_cal_open, new_cal_open, "openTimePicker")

# 4. Fix saveTimePicker to use state not refs
old_cal_save_check = '    const startMin = timeToMinutes(draftStartRef.current);\n    const endMin = timeToMinutes(draftEndRef.current);'
new_cal_save_check = '    const startMin = tapTimeToMinutes(draftStart);\n    const endMin = tapTimeToMinutes(draftEnd);'
cal = replace_all(cal, old_cal_save_check, new_cal_save_check, "save check")

old_cal_save_use1 = 'start: draftStartRef.current, end: draftEndRef.current'
new_cal_save_use1 = 'start: draftStart, end: draftEnd'
cal = replace_all(cal, old_cal_save_use1, new_cal_save_use1, "save use refs")

# 5. Find and replace the modal JSX using line ranges
lines = cal.split('\n')
start_modal = None
end_modal = None
for i, line in enumerate(lines):
    stripped = line.strip()
    if start_modal is None and 'timePickerModal' in stripped and 'visible' in stripped.lower():
        start_modal = i
    elif start_modal is None and 'visible={!!timePickerVisible' in stripped:
        start_modal = i
    elif start_modal is None and 'visible={timePickerVisible' in stripped:
        start_modal = i
    elif start_modal is None and ('Set Hours' in stripped or 'time-picker' in stripped.lower() or 'timePicker' in stripped) and 'Modal' in stripped and 'visible' in stripped:
        start_modal = i

# Fallback: find by ScrollWheelTimePicker usage
if start_modal is None:
    for i, line in enumerate(lines):
        if 'ScrollWheelTimePicker' in line:
            # Walk back to find Modal
            for j in range(i, max(0, i-30), -1):
                if '<Modal' in lines[j]:
                    start_modal = j
                    break
            break

if start_modal is not None:
    # Find the closing </Modal>
    depth = 0
    for i in range(start_modal, len(lines)):
        if '<Modal' in lines[i]:
            depth += 1
        if '</Modal>' in lines[i]:
            depth -= 1
            if depth == 0:
                end_modal = i
                break
    print(f"  Calendar modal: lines {start_modal+1}-{end_modal+1}")
else:
    print("  MISS: could not find calendar modal start")

with open(cal_path, "w") as f:
    f.write(cal)
print("calendar.tsx written")

# ─────────────────────────────────────────────────────────────────────────────
# STAFF-FORM.TSX
# ─────────────────────────────────────────────────────────────────────────────

staff_path = "/home/ubuntu/manus-scheduler/app/staff-form.tsx"
with open(staff_path, "r") as f:
    staff = f.read()

print("\n=== staff-form.tsx ===")

staff = replace_all(staff,
    'import { ScrollWheelTimePicker } from "@/components/scroll-wheel-time-picker";',
    'import { TapTimePicker, timeToMinutes as tapTimeToMinutes } from "@/components/tap-time-picker";',
    "import"
)

# Remove refs, add subPicker state
old_staff_state = '''  const staffStartRef = useRef<string>("09:00");
  const staffEndRef = useRef<string>("17:00");
  const [staffDraftStart, setStaffDraftStart] = useState("09:00");
  const [staffDraftEnd, setStaffDraftEnd] = useState("17:00");
  const [staffTimeError, setStaffTimeError] = useState<string | null>(null);

  const setStaffStartSync = useCallback((v: string) => {
    staffStartRef.current = v;
    setStaffDraftStart(v);
    setStaffTimeError(null);
  }, []);
  const setStaffEndSync = useCallback((v: string) => {
    staffEndRef.current = v;
    setStaffDraftEnd(v);
    setStaffTimeError(null);
  }, []);'''

new_staff_state = '''  const [staffDraftStart, setStaffDraftStart] = useState("09:00");
  const [staffDraftEnd, setStaffDraftEnd] = useState("17:00");
  const [staffTimeError, setStaffTimeError] = useState<string | null>(null);
  const [staffSubPicker, setStaffSubPicker] = useState<"start" | "end" | null>(null);'''

staff = replace_all(staff, old_staff_state, new_staff_state, "state block")

# Fix open handler
old_staff_open = '''    staffStartRef.current = s;
    staffEndRef.current = e;
    setStaffDraftStart(s);
    setStaffDraftEnd(e);'''
new_staff_open = '''    setStaffDraftStart(s);
    setStaffDraftEnd(e);
    setStaffSubPicker(null);
    setStaffTimeError(null);'''
staff = replace_all(staff, old_staff_open, new_staff_open, "open handler")

# Fix save check
old_staff_save_check = '    const startMin = timeToMinutes(staffStartRef.current);\n    const endMin = timeToMinutes(staffEndRef.current);'
new_staff_save_check = '    const startMin = tapTimeToMinutes(staffDraftStart);\n    const endMin = tapTimeToMinutes(staffDraftEnd);'
staff = replace_all(staff, old_staff_save_check, new_staff_save_check, "save check")

old_staff_save_use = 'start: staffStartRef.current, end: staffEndRef.current'
new_staff_save_use = 'start: staffDraftStart, end: staffDraftEnd'
staff = replace_all(staff, old_staff_save_use, new_staff_save_use, "save refs")

with open(staff_path, "w") as f:
    f.write(staff)
print("staff-form.tsx written")

# ─────────────────────────────────────────────────────────────────────────────
# DISCOUNTS.TSX
# ─────────────────────────────────────────────────────────────────────────────

disc_path = "/home/ubuntu/manus-scheduler/app/discounts.tsx"
with open(disc_path, "r") as f:
    disc = f.read()

print("\n=== discounts.tsx ===")

disc = replace_all(disc,
    'import { ScrollWheelTimePicker } from "@/components/scroll-wheel-time-picker";',
    'import { TapTimePicker, timeToMinutes as tapTimeToMinutes } from "@/components/tap-time-picker";',
    "import"
)

# Remove refs, add subPicker state
old_disc_state = '''  const discStartRef = useRef<string>("09:00");
  const discEndRef = useRef<string>("17:00");
  const [discDraftStart, setDiscDraftStart] = useState("09:00");
  const [discDraftEnd, setDiscDraftEnd] = useState("17:00");
  const [discTimeError, setDiscTimeError] = useState<string | null>(null);

  const setDiscStartSync = useCallback((v: string) => {
    discStartRef.current = v;
    setDiscDraftStart(v);
    setDiscTimeError(null);
  }, []);
  const setDiscEndSync = useCallback((v: string) => {
    discEndRef.current = v;
    setDiscDraftEnd(v);
    setDiscTimeError(null);
  }, []);'''

new_disc_state = '''  const [discDraftStart, setDiscDraftStart] = useState("09:00");
  const [discDraftEnd, setDiscDraftEnd] = useState("17:00");
  const [discTimeError, setDiscTimeError] = useState<string | null>(null);
  const [discSubPicker, setDiscSubPicker] = useState<"start" | "end" | null>(null);'''

disc = replace_all(disc, old_disc_state, new_disc_state, "state block")

# Fix open handler
old_disc_open = '''    discStartRef.current = s;
    discEndRef.current = e;
    setDiscDraftStart(s);
    setDiscDraftEnd(e);'''
new_disc_open = '''    setDiscDraftStart(s);
    setDiscDraftEnd(e);
    setDiscSubPicker(null);
    setDiscTimeError(null);'''
disc = replace_all(disc, old_disc_open, new_disc_open, "open handler")

# Fix save check
old_disc_save_check = '    const startMin = timeToMinutes(discStartRef.current);\n    const endMin = timeToMinutes(discEndRef.current);'
new_disc_save_check = '    const startMin = tapTimeToMinutes(discDraftStart);\n    const endMin = tapTimeToMinutes(discDraftEnd);'
disc = replace_all(disc, old_disc_save_check, new_disc_save_check, "save check")

old_disc_save_use = 'timeWindowStart: discStartRef.current, timeWindowEnd: discEndRef.current'
new_disc_save_use = 'timeWindowStart: discDraftStart, timeWindowEnd: discDraftEnd'
disc = replace_all(disc, old_disc_save_use, new_disc_save_use, "save refs")

with open(disc_path, "w") as f:
    f.write(disc)
print("discounts.tsx written")

print("\nAll done.")
