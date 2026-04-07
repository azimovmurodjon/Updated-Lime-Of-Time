# Debug Notes - Calendar Issues

## Screenshot: April 2026 Calendar
- Month/year header "April 2026" IS showing correctly
- Prev/Next arrows ARE present (← →)
- Day headers: Sun Mon Tue Wed Thu Fri Sat
- ALL days appear grayed out/disabled - no green dots visible
- No days are clickable - the entire calendar is inactive
- This means the availability check is returning 0 available slots for ALL days
- The issue is likely that:
  1. The working-days API returns no working days, OR
  2. The slot availability check fails for all days, OR
  3. The scheduleMode is "custom" but no custom days are configured

## What works:
- Continue button works (step 0 → step 1 → step 2)
- Service selection works
- Calendar renders with correct month/year
- Navigation arrows present

## Root cause hypothesis:
- scheduleMode defaults to "weekly" but the working-days endpoint may not be returning the correct data
- OR the batch slot check is failing silently
