# Root Cause Found

## API Response
The working-days API returns: all weeklyDays are FALSE, scheduleMode is "weekly", customDays is empty.

This means the business has scheduleMode="weekly" but ALL weekly days are set to false (no working days configured).

## Two Issues:
1. The JS variables `workingDays` and `schedMode` are undefined - meaning the loadWorkingDays() function either doesn't assign to global vars correctly, or the fetch fails silently
2. Even if the fetch works, all days are false because the business hasn't configured working hours yet OR the DB migration defaulted all days to false

## Fix needed:
1. Fix the JS loadWorkingDays function to properly set global variables
2. Check why the business working days are all false in the DB
