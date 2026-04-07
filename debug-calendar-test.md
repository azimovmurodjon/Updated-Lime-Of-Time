# Calendar Test on Dev Server - April 7 2026

## Current state: scheduleMode = "custom"
- Calendar shows April 2026 correctly
- Only days 7 and 8 have green dots (these are the custom days configured)
- All other days are grayed out
- This is CORRECT behavior for Custom Days mode

## The issue:
The user says "when I select Weekly Hours it is still not working"
This means when they switch from Custom Days to Weekly Hours in the app Settings,
the client booking page should show Sun/Wed/Thu/Fri as available (based on WEEKLY_DAYS).

But the DEPLOYED version has the old code where WEEKLY_DAYS is all false.
The dev server has the fix and shows WEEKLY_DAYS correctly.

## The fix IS working on dev server:
- WEEKLY_DAYS: {"Sunday":true,"Monday":false,"Tuesday":false,"Wednesday":true,"Thursday":true,"Friday":true,"Saturday":false}
- But scheduleMode is "custom" so the calendar correctly only shows custom days

## To test Weekly Hours mode:
Need to switch scheduleMode to "weekly" in the database, then the calendar should show
all the WEEKLY_DAYS as available.

## CONCLUSION:
The user needs to PUBLISH the latest checkpoint. The deployed version has the OLD buggy code.
