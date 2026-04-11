# Manus Scheduler - Comprehensive Improvement Plan
## Simplifying Complexity & Improving UX

**Document Version:** 1.0  
**Date:** April 10, 2026  
**Status:** PROPOSAL (awaiting approval before implementation)

---

## Executive Summary

The Manus Scheduler application has grown in features but has become complex in its scheduling and availability management. This document proposes a **unified availability management system** that simplifies the user experience while maintaining all functionality.

### Current Problems

1. **Fragmented Availability Control:** Business hours, staff availability, and calendar availability are managed in separate places
2. **Confusing Time Selection:** Multiple time picker implementations across the app (some native, some custom)
3. **Staff Calendar Incomplete:** Staff calendar exists but lacks integration with business hours and daily overrides
4. **Complex Settings:** "Custom Working Hours" is unclear terminology; the purpose is not obvious
5. **No Daily Overrides:** Business owners cannot easily mark specific dates as unavailable or change hours for one day
6. **Staff Scheduling Unclear:** No clear way to see which staff are available on which days
7. **Booking Logic Fragmented:** Availability checking happens in multiple places without a single source of truth

### Proposed Solution

A **three-tier availability system** with a unified time picker:

1. **Tier 1: Business Hours** (Weekly Schedule) — The default availability for the entire business
2. **Tier 2: Daily Overrides** (Calendar-based) — Override business hours for specific dates
3. **Tier 3: Staff Assignments** (Staff Calendar) — Assign staff to specific dates with their availability

---

## Part 1: Unified Availability Management System

### 1.1 Business Hours (Tier 1 - Weekly Schedule)

**Current State:**
- Located in Settings screen
- Confusing terminology ("Custom Working Hours")
- Separate from calendar view
- Not visually connected to calendar

**Proposed Changes:**

#### Rename & Clarify
- **Old:** "Custom Working Hours"
- **New:** "Business Hours" (main weekly schedule)
- **Description:** "Set your default business hours for each day of the week"

#### New Business Hours UI

**Location:** Settings → Business Hours (new dedicated section)

**Layout:**
```
┌─────────────────────────────────────────┐
│ Business Hours                          │
│ Default weekly schedule for your        │
│ business. Override specific dates in    │
│ the Calendar.                           │
├─────────────────────────────────────────┤
│ ☐ Monday                                │
│   9:00 AM - 5:00 PM                    │
│   [Edit] [Delete]                       │
├─────────────────────────────────────────┤
│ ☑ Tuesday                               │
│   9:00 AM - 5:00 PM                    │
│   [Edit]                                │
├─────────────────────────────────────────┤
│ ☑ Wednesday                             │
│   9:00 AM - 5:00 PM                    │
│   [Edit]                                │
├─────────────────────────────────────────┤
│ ☑ Thursday                              │
│   9:00 AM - 5:00 PM                    │
│   [Edit]                                │
├─────────────────────────────────────────┤
│ ☑ Friday                                │
│   9:00 AM - 5:00 PM                    │
│   [Edit]                                │
├─────────────────────────────────────────┤
│ ☐ Saturday                              │
│ ☐ Sunday                                │
│ [Add Weekend]                           │
└─────────────────────────────────────────┘
```

**Features:**
- Toggle each day on/off
- Edit start and end times for each day
- Preset templates: "9-5 Mon-Fri", "9-6 Mon-Sat", "Custom"
- "Apply to all days" button for quick setup
- Visual indicator: enabled days highlighted, disabled days grayed out

**Edit Business Hours Modal:**
```
┌─────────────────────────────────────────┐
│ Edit Monday Business Hours              │
├─────────────────────────────────────────┤
│ ☑ Open on Monday                        │
├─────────────────────────────────────────┤
│ From:                                   │
│ [9:00 AM ▼] (scrolling time picker)    │
├─────────────────────────────────────────┤
│ To:                                     │
│ [5:00 PM ▼] (scrolling time picker)    │
├─────────────────────────────────────────┤
│ [Cancel] [Save]                         │
└─────────────────────────────────────────┘
```

**Data Structure:**
```typescript
interface BusinessHours {
  dayOfWeek: 'Monday' | 'Tuesday' | ... | 'Sunday';
  isEnabled: boolean;
  startTime: string; // "09:00" (24-hour format in DB, displayed as 12-hour)
  endTime: string;   // "17:00"
  customDates?: {
    [date: string]: {
      isEnabled: boolean;
      startTime: string;
      endTime: string;
    }
  }
}
```

### 1.2 Daily Overrides (Tier 2 - Calendar-based)

**Current State:**
- No way to override business hours for specific dates
- Cannot mark a date as unavailable without changing business hours
- No visual feedback on calendar for overrides

**Proposed Changes:**

#### Calendar Screen Enhancement

**New Feature: Work Day Toggle**

When a date is selected on the calendar, show a panel on the right side:

```
┌──────────────────────────────────────────────┐
│ Calendar                                     │
│ ┌────────────────────┐ ┌──────────────────┐ │
│ │ April 2026         │ │ Monday, April 15 │ │
│ │ S M T W T F S      │ │                  │ │
│ │     1 2 3 4 5      │ │ Work Day         │ │
│ │ 6 7 8 9 10 11 12   │ │ [Toggle ON/OFF]  │ │
│ │ 13 14 [15] 16 17   │ │                  │ │
│ │ 18 19 20 21 22 23  │ │ From:            │ │
│ │ 24 25 26 27 28 29  │ │ [9:00 AM ▼]     │ │
│ │ 30                 │ │                  │ │
│ └────────────────────┘ │ To:              │ │
│                        │ [5:00 PM ▼]     │ │
│                        │                  │ │
│                        │ [Save]           │ │
│                        └──────────────────┘ │
└──────────────────────────────────────────────┘
```

**Behavior:**

1. **Date Selection:**
   - User taps a date on the calendar
   - Right panel shows date details

2. **Work Day Toggle:**
   - Toggle ON: Date is available for bookings
   - Toggle OFF: Date is unavailable (no bookings allowed)
   - Default state: Follows Business Hours (if Monday is enabled in Business Hours, Monday dates default to ON)

3. **Time Override:**
   - If Work Day is ON, show time pickers
   - User can set custom From/To times for that specific date
   - If times match Business Hours, show "Using Business Hours" note
   - If times differ, show "Custom hours" badge

4. **Visual Feedback:**
   - Available dates: Normal appearance
   - Unavailable dates (Work Day OFF): Grayed out, strikethrough
   - Dates with custom hours: Special indicator (e.g., small dot or badge)
   - Today's date: Highlighted
   - Past dates: Disabled (cannot edit)

**Conflict Detection:**
- If date has appointments and user tries to mark Work Day OFF, show warning:
  - "This date has 2 appointments. Mark as unavailable anyway?"
  - Option to cancel or proceed

**Data Structure:**
```typescript
interface DailyOverride {
  businessOwnerId: string;
  date: string; // "2026-04-15"
  isWorkDay: boolean;
  startTime?: string; // "09:00" (optional, if different from Business Hours)
  endTime?: string;   // "17:00"
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

**Database Table:**
```sql
CREATE TABLE dailyOverrides (
  id TEXT PRIMARY KEY,
  businessOwnerId TEXT NOT NULL REFERENCES businessOwners(id),
  date TEXT NOT NULL,
  isWorkDay BOOLEAN DEFAULT true,
  startTime TEXT,
  endTime TEXT,
  notes TEXT,
  createdAt TIMESTAMP DEFAULT NOW(),
  updatedAt TIMESTAMP DEFAULT NOW(),
  UNIQUE(businessOwnerId, date)
);
```

### 1.3 Staff Calendar (Tier 3 - Staff Assignments)

**Current State:**
- Staff calendar exists but is incomplete
- No clear integration with business hours
- Cannot see which staff are available on which days
- No way to assign staff to specific dates

**Proposed Changes:**

#### New Staff Calendar View

**Location:** Settings → Staff Calendar (or Calendar → Staff View)

**Feature: Staff Availability Toggle**

```
┌──────────────────────────────────────────────────┐
│ Staff Calendar                                   │
│ View and manage staff availability               │
│                                                  │
│ ☑ Multi-Staff Mode (toggle)                     │
│   When ON: Show all staff availability           │
│   When OFF: Show only your availability          │
├──────────────────────────────────────────────────┤
│ April 2026                                       │
│ S M T W T F S                                    │
│ 1 2 3 4 5 6 7                                    │
│ 8 9 10 11 12 13 14                               │
│ 15 16 17 18 19 20 21                             │
│ 22 23 24 25 26 27 28                             │
│ 29 30                                            │
├──────────────────────────────────────────────────┤
│ Staff: [All ▼] [Sarah] [John] [Emma]            │
│                                                  │
│ Monday, April 15                                 │
│ ☑ Sarah - 9:00 AM - 5:00 PM                    │
│ ☑ John - 10:00 AM - 6:00 PM                    │
│ ☐ Emma - Not scheduled                          │
│                                                  │
│ [Edit] [Save]                                    │
└──────────────────────────────────────────────────┘
```

**Multi-Staff Mode Toggle:**

**Purpose:** Allow business owner to switch between two views:

1. **Multi-Staff Mode ON:**
   - Show all staff members
   - See availability for each staff
   - Assign staff to specific dates
   - View staff conflicts
   - Useful for: Salons, spas, clinics with multiple staff

2. **Multi-Staff Mode OFF:**
   - Show only business owner's availability
   - Simplified calendar view
   - No staff assignments
   - Useful for: Solo practitioners, consultants

**Implementation:**

```typescript
interface StaffAvailability {
  businessOwnerId: string;
  staffId: string;
  date: string;
  isAvailable: boolean;
  startTime: string;
  endTime: string;
  notes?: string;
}

interface BusinessSettings {
  // ... existing fields ...
  multiStaffMode: boolean; // NEW
  businessHours: BusinessHours[];
  dailyOverrides: DailyOverride[];
}
```

**UI Changes:**

In Settings screen, add:
```
┌─────────────────────────────────────┐
│ Scheduling Mode                     │
│                                     │
│ ☐ Multi-Staff Mode                 │
│   When enabled, manage multiple     │
│   staff availability separately.    │
│   When disabled, manage only your   │
│   availability.                     │
└─────────────────────────────────────┘
```

---

## Part 2: Unified Time Picker System

### 2.1 Current Problem

**Issue:** Multiple time picker implementations across the app
- Some use native time pickers
- Some use custom input fields
- Some use dropdown selectors
- Inconsistent 12-hour vs 24-hour format
- No support for flexible minutes (e.g., 9:45 AM)

**Impact:**
- Confusing user experience
- Difficult to maintain
- Inconsistent behavior

### 2.2 Proposed Solution: Scrolling Wheel Time Picker

**Design:** iOS-style scrolling wheel picker with:
- 12-hour format with AM/PM
- Flexible minute selection (any minute, not just 15-min intervals)
- Smooth scrolling interaction
- Clear visual feedback

**Component: `TimePickerWheel`**

```typescript
interface TimePickerWheelProps {
  value: string; // "09:45" (24-hour format internally)
  onChange: (time: string) => void;
  minTime?: string; // "08:00"
  maxTime?: string; // "18:00"
  label?: string;
  disabled?: boolean;
}

export function TimePickerWheel({
  value,
  onChange,
  minTime,
  maxTime,
  label,
  disabled
}: TimePickerWheelProps) {
  // Implementation with scrolling wheels for:
  // - Hours (1-12)
  // - Minutes (0-59)
  // - AM/PM
}
```

**Visual Design:**

```
┌──────────────────────────────────┐
│ Select Time                      │
├──────────────────────────────────┤
│           ▲                      │
│        [09]                      │
│        [10] ← Selected           │
│        [11]                      │
│           ▼                      │
│                                  │
│           ▲                      │
│        [44]                      │
│        [45] ← Selected           │
│        [46]                      │
│           ▼                      │
│                                  │
│           ▲                      │
│        [AM]                      │
│        [PM] ← Selected           │
│        [AM]                      │
│           ▼                      │
│                                  │
│ Display: 10:45 PM               │
│                                  │
│ [Cancel] [Done]                 │
└──────────────────────────────────┘
```

**Locations to Update:**

1. **Business Hours Screen**
   - Start time picker → TimePickerWheel
   - End time picker → TimePickerWheel

2. **Calendar Daily Override**
   - From time picker → TimePickerWheel
   - To time picker → TimePickerWheel

3. **Staff Calendar**
   - Staff start time → TimePickerWheel
   - Staff end time → TimePickerWheel

4. **Service Creation**
   - Service duration → Keep as numeric input (minutes)
   - But show visual: "45 minutes" not just "45"

5. **New Booking Flow**
   - Time selection → TimePickerWheel

6. **Appointment Detail**
   - Reschedule time → TimePickerWheel

7. **Admin Dashboard**
   - All time inputs → TimePickerWheel

**Implementation Details:**

```typescript
// Convert between formats
function convertTo24Hour(hour: number, minute: number, period: 'AM' | 'PM'): string {
  let h = hour;
  if (period === 'PM' && h !== 12) h += 12;
  if (period === 'AM' && h === 12) h = 0;
  return `${String(h).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function convertTo12Hour(time24: string): { hour: number; minute: number; period: 'AM' | 'PM' } {
  const [h, m] = time24.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return { hour, minute: m, period };
}

// Display format
function formatTime(time24: string): string {
  const { hour, minute, period } = convertTo12Hour(time24);
  return `${hour}:${String(minute).padStart(2, '0')} ${period}`;
}
```

---

## Part 3: Availability Logic Integration

### 3.1 Availability Calculation Algorithm

**Goal:** Single source of truth for "is this date/time available?"

**Algorithm:**

```typescript
function isDateTimeAvailable(
  businessOwnerId: string,
  date: string,
  time: string,
  staffId?: string
): boolean {
  // Step 1: Check if date is in the past
  if (isPastDate(date)) return false;

  // Step 2: Check daily override
  const dailyOverride = getDailyOverride(businessOwnerId, date);
  if (dailyOverride && !dailyOverride.isWorkDay) {
    return false; // Date is explicitly marked as unavailable
  }

  // Step 3: Get available hours for this date
  const availableHours = getAvailableHours(businessOwnerId, date, staffId);
  if (!availableHours) return false;

  // Step 4: Check if time falls within available hours
  const [startTime, endTime] = availableHours;
  if (time < startTime || time >= endTime) {
    return false;
  }

  // Step 5: Check for conflicts with existing appointments
  if (hasConflict(businessOwnerId, date, time, staffId)) {
    return false;
  }

  return true;
}

function getAvailableHours(
  businessOwnerId: string,
  date: string,
  staffId?: string
): [string, string] | null {
  // Step 1: Check daily override first
  const dailyOverride = getDailyOverride(businessOwnerId, date);
  if (dailyOverride && dailyOverride.isWorkDay) {
    if (dailyOverride.startTime && dailyOverride.endTime) {
      return [dailyOverride.startTime, dailyOverride.endTime];
    }
  }

  // Step 2: Fall back to business hours for the day of week
  const dayOfWeek = getDayOfWeek(date); // "Monday", "Tuesday", etc.
  const businessHours = getBusinessHours(businessOwnerId, dayOfWeek);
  
  if (!businessHours || !businessHours.isEnabled) {
    return null; // Day is not a working day
  }

  // Step 3: If staff specified, check staff availability
  if (staffId) {
    const staffAvailability = getStaffAvailability(staffId, date);
    if (staffAvailability && !staffAvailability.isAvailable) {
      return null; // Staff not available on this date
    }
    if (staffAvailability && staffAvailability.startTime) {
      return [staffAvailability.startTime, staffAvailability.endTime];
    }
  }

  return [businessHours.startTime, businessHours.endTime];
}

function getAvailableTimeSlots(
  businessOwnerId: string,
  date: string,
  serviceDuration: number,
  staffId?: string
): string[] {
  const availableHours = getAvailableHours(businessOwnerId, date, staffId);
  if (!availableHours) return [];

  const [startTime, endTime] = availableHours;
  const slots: string[] = [];

  // Generate 15-minute intervals
  let currentTime = startTime;
  while (currentTime < endTime) {
    const endSlotTime = addMinutes(currentTime, serviceDuration);
    if (endSlotTime <= endTime && !hasConflict(businessOwnerId, date, currentTime, staffId)) {
      slots.push(currentTime);
    }
    currentTime = addMinutes(currentTime, 15); // 15-min intervals
  }

  return slots;
}
```

**Usage in Components:**

```typescript
// In Calendar screen
const availableHours = getAvailableHours(businessOwnerId, selectedDate, multiStaffMode ? null : staffId);
const isAvailable = availableHours !== null;

// In Booking flow
const timeSlots = getAvailableTimeSlots(businessOwnerId, selectedDate, serviceDuration);

// In Appointment creation
const canBook = isDateTimeAvailable(businessOwnerId, date, time, staffId);
```

### 3.2 Calendar Visual Feedback

**Date Styling:**

```typescript
function getDateStyle(businessOwnerId: string, date: string): {
  available: boolean;
  hasOverride: boolean;
  hasCustomHours: boolean;
  hasAppointments: number;
} {
  const availableHours = getAvailableHours(businessOwnerId, date);
  const dailyOverride = getDailyOverride(businessOwnerId, date);
  const appointments = getAppointmentsForDate(businessOwnerId, date);

  return {
    available: availableHours !== null,
    hasOverride: !!dailyOverride,
    hasCustomHours: dailyOverride?.startTime !== undefined,
    hasAppointments: appointments.length
  };
}

// CSS classes
const dateClasses = {
  available: 'bg-white text-black cursor-pointer',
  unavailable: 'bg-gray-200 text-gray-500 cursor-not-allowed line-through',
  customHours: 'border-2 border-blue-500',
  hasAppointments: 'badge-count-{count}' // Show appointment count
};
```

---

## Part 4: Implementation Roadmap

### Phase 1: Foundation (Week 1)

**Goal:** Build core components and database changes

**Tasks:**
1. Create `TimePickerWheel` component
2. Add `dailyOverrides` table to database
3. Add `multiStaffMode` to `businessSettings`
4. Create `getAvailableHours()` and `isDateTimeAvailable()` functions
5. Update database schema with new tables
6. Write unit tests for availability logic

**Files to Create:**
- `components/ui/time-picker-wheel.tsx`
- `lib/availability.ts` (availability logic)
- `server/schema.ts` (database schema updates)
- `__tests__/availability.test.ts`

**Files to Modify:**
- `server/db.ts` (add new queries)
- `lib/store.tsx` (add new state)
- `lib/types.ts` (add new types)

### Phase 2: Business Hours Refactor (Week 2)

**Goal:** Rename and simplify Business Hours UI

**Tasks:**
1. Rename "Custom Working Hours" → "Business Hours"
2. Redesign Business Hours screen with new UI
3. Update Business Hours edit modal with TimePickerWheel
4. Add preset templates (9-5 Mon-Fri, etc.)
5. Add "Apply to all days" button
6. Update Business Hours logic to use new availability system

**Files to Modify:**
- `app/(tabs)/settings.tsx` (Business Hours section)
- `app/business-hours.tsx` (new dedicated screen)
- `lib/store.tsx` (Business Hours state)
- `server/db.ts` (Business Hours queries)

### Phase 3: Calendar Daily Overrides (Week 3)

**Goal:** Add Work Day toggle and daily override UI

**Tasks:**
1. Add right panel to Calendar screen for date details
2. Implement Work Day toggle
3. Add time pickers for daily override
4. Add visual feedback (grayed out, badges, etc.)
5. Add conflict detection when marking date as unavailable
6. Sync daily overrides to database

**Files to Modify:**
- `app/(tabs)/calendar.tsx` (Calendar screen)
- `lib/store.tsx` (daily override state)
- `server/db.ts` (daily override queries)

### Phase 4: Staff Calendar (Week 4)

**Goal:** Complete staff calendar with multi-staff mode toggle

**Tasks:**
1. Add Multi-Staff Mode toggle to Settings
2. Create Staff Calendar screen
3. Implement staff availability assignment
4. Add staff availability to availability logic
5. Update calendar to show staff availability
6. Add staff conflict detection

**Files to Create:**
- `app/staff-calendar.tsx`

**Files to Modify:**
- `app/(tabs)/settings.tsx` (Multi-Staff Mode toggle)
- `app/(tabs)/calendar.tsx` (Staff view option)
- `lib/availability.ts` (add staff availability checks)
- `server/db.ts` (staff availability queries)

### Phase 5: Time Picker Integration (Week 5)

**Goal:** Replace all time pickers with TimePickerWheel

**Tasks:**
1. Replace time pickers in Business Hours
2. Replace time pickers in Calendar daily override
3. Replace time pickers in Staff Calendar
4. Replace time pickers in New Booking flow
5. Replace time pickers in Appointment detail
6. Replace time pickers in Admin dashboard
7. Test all flows end-to-end

**Files to Modify:**
- `app/(tabs)/settings.tsx`
- `app/(tabs)/calendar.tsx`
- `app/staff-calendar.tsx`
- `app/new-booking.tsx`
- `app/appointment-detail.tsx`
- `server/adminRoutes.ts`

### Phase 6: Testing & Polish (Week 6)

**Goal:** Comprehensive testing and UX refinement

**Tasks:**
1. Test availability logic with various scenarios
2. Test calendar visual feedback
3. Test staff calendar with multi-staff mode
4. Test time picker across all screens
5. Test booking flow end-to-end
6. Fix bugs and edge cases
7. Performance optimization
8. Create user documentation

**Test Scenarios:**
- Business hours: Mon-Fri 9-5
- Override Monday to 10-4
- Override Tuesday to unavailable
- Staff: Sarah available Mon-Fri, John available Tue-Sat
- Booking: Should only show available slots based on all rules
- Calendar: Should show correct visual feedback for each date

---

## Part 5: Data Migration Plan

### 5.1 Database Changes

**New Tables:**

```sql
CREATE TABLE dailyOverrides (
  id TEXT PRIMARY KEY,
  businessOwnerId TEXT NOT NULL REFERENCES businessOwners(id),
  date TEXT NOT NULL,
  isWorkDay BOOLEAN DEFAULT true,
  startTime TEXT,
  endTime TEXT,
  notes TEXT,
  createdAt TIMESTAMP DEFAULT NOW(),
  updatedAt TIMESTAMP DEFAULT NOW(),
  UNIQUE(businessOwnerId, date)
);

CREATE TABLE staffAvailability (
  id TEXT PRIMARY KEY,
  businessOwnerId TEXT NOT NULL REFERENCES businessOwners(id),
  staffId TEXT NOT NULL REFERENCES staffMembers(id),
  date TEXT NOT NULL,
  isAvailable BOOLEAN DEFAULT true,
  startTime TEXT,
  endTime TEXT,
  notes TEXT,
  createdAt TIMESTAMP DEFAULT NOW(),
  updatedAt TIMESTAMP DEFAULT NOW(),
  UNIQUE(staffId, date)
);
```

**Modified Tables:**

```sql
-- Add to businessOwners
ALTER TABLE businessOwners ADD COLUMN multiStaffMode BOOLEAN DEFAULT false;

-- Rename column in workingHours (if needed)
-- ALTER TABLE workingHours RENAME COLUMN customWorkingHours TO businessHours;
```

### 5.2 Data Migration Script

```typescript
// Migration: Add multiStaffMode to all existing businesses
async function migrateMultiStaffMode() {
  const businesses = await db.businessOwners.findMany();
  
  for (const business of businesses) {
    // Determine if business should have multi-staff mode
    const staffCount = await db.staffMembers.count({
      where: { businessOwnerId: business.id }
    });
    
    const multiStaffMode = staffCount > 1;
    
    await db.businessOwners.update(business.id, {
      multiStaffMode
    });
  }
}

// Migration: Create default dailyOverrides for existing businesses
async function createDefaultDailyOverrides() {
  const businesses = await db.businessOwners.findMany();
  
  for (const business of businesses) {
    const businessHours = await db.workingHours.findMany({
      where: { businessOwnerId: business.id }
    });
    
    // No action needed - dailyOverrides are created on-demand
    // This is just a placeholder for any data cleanup
  }
}
```

---

## Part 6: UI/UX Improvements

### 6.1 Settings Screen Reorganization

**Current Structure:**
```
Settings
├── Business Profile
├── Custom Working Hours
├── Staff Management
├── Cancellation Policy
├── Temporary Closed
└── Theme
```

**Proposed Structure:**
```
Settings
├── Business Profile
│   ├── Business Name
│   ├── Phone, Email
│   ├── Address
│   └── Logo
├── Scheduling (NEW SECTION)
│   ├── Business Hours (renamed from Custom Working Hours)
│   ├── Multi-Staff Mode (toggle)
│   ├── Staff Calendar (link)
│   └── Cancellation Policy
├── Staff Management
│   ├── Add Staff
│   ├── Staff List
│   └── Staff Calendar (link)
├── Preferences
│   ├── Temporary Closed
│   ├── Theme
│   └── Notifications
└── Advanced
    ├── Delete Business
    └── Export Data
```

**Benefits:**
- Clearer organization
- Related settings grouped together
- Easier to find features

### 6.2 Calendar Screen Improvements

**Current Layout:**
```
┌─────────────────────────────┐
│ Calendar                    │
│ [Month View]                │
│ [Filters] [Add Appointment] │
│ [Appointments List]         │
└─────────────────────────────┘
```

**Proposed Layout:**
```
┌──────────────────────────────────────────────┐
│ Calendar                                     │
├──────────────────────────────────────────────┤
│ [Month View]  [Day View]  [Staff View]      │
├──────────────────────────────────────────────┤
│ ┌────────────────────┐ ┌──────────────────┐ │
│ │ April 2026         │ │ Monday, April 15 │ │
│ │ S M T W T F S      │ │                  │ │
│ │ ... calendar ...   │ │ Work Day         │ │
│ │                    │ │ [Toggle ON/OFF]  │ │
│ │ [Filters]          │ │                  │ │
│ │ [Legend]           │ │ From: [9:00 AM] │ │
│ │                    │ │ To: [5:00 PM]   │ │
│ │                    │ │                  │ │
│ │                    │ │ Appointments (2) │ │
│ │                    │ │ - 9:30 AM: Sarah │ │
│ │                    │ │ - 2:00 PM: John  │ │
│ │                    │ │                  │ │
│ │                    │ │ [Save]           │ │
│ └────────────────────┘ └──────────────────┘ │
└──────────────────────────────────────────────┘
```

**Benefits:**
- All date information in one view
- No need to switch screens
- Clear visual feedback
- Easy to override availability

### 6.3 New Booking Flow Simplification

**Current Steps:**
1. Select/create client
2. Select service
3. Select date and time
4. Confirm and send SMS

**Proposed Changes:**
- Step 3: Use TimePickerWheel for time selection
- Show available slots based on Business Hours + Daily Overrides + Staff availability
- Real-time availability checking

---

## Part 7: Complexity Analysis & Simplification

### 7.1 Current Complexity Issues

| Issue | Impact | Severity |
|-------|--------|----------|
| Multiple time picker implementations | Inconsistent UX, hard to maintain | High |
| Fragmented availability logic | Bugs in booking, conflicts | High |
| Unclear terminology ("Custom Working Hours") | User confusion | Medium |
| No daily overrides | Limited flexibility | Medium |
| Incomplete staff calendar | Cannot manage multi-staff businesses well | High |
| Settings screen too crowded | Hard to find features | Medium |
| No visual feedback on calendar | Users don't know which dates are available | High |

### 7.2 Proposed Simplifications

| Change | Benefit | Complexity Reduction |
|--------|---------|---------------------|
| Unified TimePickerWheel | Consistent UX, easier maintenance | -20% |
| Centralized availability logic | Fewer bugs, single source of truth | -30% |
| Clearer terminology | Less user confusion | -10% |
| Daily overrides on calendar | More intuitive than separate settings | -15% |
| Reorganized settings | Easier to find features | -10% |
| Visual calendar feedback | Users understand availability at a glance | -15% |
| Multi-Staff Mode toggle | Simplified UI for solo practitioners | -20% |

**Total Complexity Reduction: ~40-50%**

### 7.3 User Journey Simplification

**Before (Complex):**
1. Open Settings
2. Find "Custom Working Hours"
3. Edit Monday hours
4. Go back to Settings
5. Go to Calendar
6. Try to figure out why a date is unavailable
7. Go back to Settings to check if it's a holiday
8. Repeat for each date

**After (Simplified):**
1. Open Calendar
2. Tap a date
3. Toggle "Work Day" on/off
4. Set custom hours if needed
5. Done - all in one place

---

## Part 8: Risk Assessment & Mitigation

### 8.1 Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|-----------|
| Breaking existing bookings | Low | High | Comprehensive testing, migration script |
| Time picker bugs | Medium | Medium | Unit tests, cross-browser testing |
| Staff availability conflicts | Medium | High | Conflict detection logic, warnings |
| Performance with many dates | Low | Medium | Pagination, caching |
| User confusion during transition | Medium | Medium | Clear documentation, in-app tooltips |

### 8.2 Testing Strategy

**Unit Tests:**
- Availability logic (all scenarios)
- Time conversion functions
- Conflict detection

**Integration Tests:**
- Booking flow end-to-end
- Calendar with overrides
- Staff calendar with multi-staff mode

**User Testing:**
- A/B test new UI vs. old
- Gather feedback on time picker
- Test with solo and multi-staff businesses

---

## Part 9: Implementation Checklist

### Pre-Implementation
- [ ] Get stakeholder approval on this plan
- [ ] Create feature branch for development
- [ ] Set up test database for migration testing
- [ ] Document current behavior (for regression testing)

### Phase 1: Foundation
- [ ] Create TimePickerWheel component
- [ ] Add dailyOverrides table
- [ ] Add multiStaffMode to businessSettings
- [ ] Implement availability logic functions
- [ ] Write unit tests
- [ ] Code review

### Phase 2: Business Hours
- [ ] Rename "Custom Working Hours" to "Business Hours"
- [ ] Redesign Business Hours screen
- [ ] Integrate TimePickerWheel
- [ ] Add preset templates
- [ ] Test Business Hours functionality
- [ ] Code review

### Phase 3: Calendar Overrides
- [ ] Add right panel to Calendar
- [ ] Implement Work Day toggle
- [ ] Add time pickers
- [ ] Add visual feedback
- [ ] Test calendar functionality
- [ ] Code review

### Phase 4: Staff Calendar
- [ ] Create Staff Calendar screen
- [ ] Add Multi-Staff Mode toggle
- [ ] Implement staff availability
- [ ] Integrate with availability logic
- [ ] Test staff calendar
- [ ] Code review

### Phase 5: Time Picker Integration
- [ ] Replace all time pickers
- [ ] Test each screen
- [ ] End-to-end testing
- [ ] Code review

### Phase 6: Testing & Polish
- [ ] Comprehensive testing
- [ ] Bug fixes
- [ ] Performance optimization
- [ ] User documentation
- [ ] Final code review
- [ ] Prepare for deployment

### Post-Implementation
- [ ] Deploy to staging
- [ ] User acceptance testing
- [ ] Deploy to production
- [ ] Monitor for issues
- [ ] Gather user feedback

---

## Part 10: Success Metrics

### Usability Metrics
- **Time to complete booking:** Should decrease by 20%
- **User errors in scheduling:** Should decrease by 50%
- **Support tickets related to availability:** Should decrease by 60%

### Technical Metrics
- **Code maintainability:** Reduce time picker implementations from 5 to 1
- **Availability logic bugs:** Reduce from current to zero
- **Test coverage:** Increase to 90%+

### Business Metrics
- **User satisfaction:** NPS score increase of 10+ points
- **Feature adoption:** 80%+ of users use daily overrides within 3 months
- **Multi-staff mode adoption:** 70%+ of multi-staff businesses enable it

---

## Part 11: Documentation & Training

### User Documentation
- [ ] Create "Business Hours" guide
- [ ] Create "Calendar Daily Overrides" guide
- [ ] Create "Staff Calendar" guide
- [ ] Create "Time Picker" guide
- [ ] Create video tutorials (5-10 min each)
- [ ] Create FAQ

### Developer Documentation
- [ ] Update API documentation
- [ ] Document availability logic
- [ ] Document database schema changes
- [ ] Create code examples
- [ ] Document migration process

### Training Materials
- [ ] Create in-app tooltips
- [ ] Create onboarding flow for new features
- [ ] Create email announcement
- [ ] Create blog post

---

## Conclusion

This improvement plan addresses the core complexity issues in the Manus Scheduler application by:

1. **Unifying availability management** into a three-tier system (Business Hours → Daily Overrides → Staff Assignments)
2. **Standardizing time selection** with a single, intuitive time picker component
3. **Simplifying the user interface** with better organization and visual feedback
4. **Improving the user experience** by putting all related features in one place

The proposed changes are **backward compatible** and can be implemented **incrementally** without breaking existing functionality. The phased approach allows for testing and validation at each stage.

**Estimated Timeline:** 6 weeks  
**Estimated Effort:** 120-150 developer hours  
**Risk Level:** Medium (with proper testing and migration)

---

**Next Steps:**
1. Review this document with stakeholders
2. Get approval to proceed
3. Schedule implementation kickoff
4. Begin Phase 1 (Foundation)

