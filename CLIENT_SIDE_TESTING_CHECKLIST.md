# Client-Side Testing Checklist - Unified Availability System

## Test Environment
- **Mobile App URL:** https://8081-ireac9uh0h4fiijtxpzq0-f6771665.us2.manus.computer
- **Public Booking Page:** https://manussched-dw4mhfnu.manus.space/api/book/wellness-suites
- **Test Business:** Wellness Suites
- **Test Date:** 2026-04-15 (Wednesday)

---

## Phase 1: Business Hours Settings Screen

### Test Cases
- [ ] **1.1** Navigate to Settings → Business Hours
- [ ] **1.2** Display current business hours for each day
- [ ] **1.3** Edit business hours for a specific day
- [ ] **1.4** Save changes and verify persistence
- [ ] **1.5** Add daily override for a specific date
- [ ] **1.6** Mark a date as "Closed" (no work day)
- [ ] **1.7** View list of all daily overrides
- [ ] **1.8** Delete a daily override
- [ ] **1.9** Verify changes reflect in calendar immediately
- [ ] **1.10** Test with different time formats (12-hour, 24-hour)

### Expected Results
- All business hours display correctly
- Daily overrides save and persist
- Changes appear in real-time without page refresh
- No errors in console

---

## Phase 2: Staff Calendar with Multi-Staff Mode

### Test Cases
- [ ] **2.1** Navigate to Staff Calendar
- [ ] **2.2** View multi-staff mode toggle
- [ ] **2.3** Enable multi-staff mode (if disabled)
- [ ] **2.4** View all staff members and their availability
- [ ] **2.5** Select a staff member to view their schedule
- [ ] **2.6** Add unavailability for a staff member on a specific date
- [ ] **2.7** Add unavailability for a specific time slot
- [ ] **2.8** View staff availability on calendar
- [ ] **2.9** Disable multi-staff mode (solo business owner)
- [ ] **2.10** Verify UI changes appropriately for solo mode

### Expected Results
- Multi-staff toggle works correctly
- Staff availability displays accurately
- Calendar updates when availability changes
- Solo mode hides staff-specific options

---

## Phase 3: TimePickerWheel Component

### Test Cases
- [ ] **3.1** Open Business Hours and test time picker
- [ ] **3.2** Scroll to select hour (0-23)
- [ ] **3.3** Scroll to select minute (0-59)
- [ ] **3.4** Verify selected time displays correctly
- [ ] **3.5** Test time picker in Staff Calendar
- [ ] **3.6** Test time picker in Daily Overrides
- [ ] **3.7** Verify time picker works on mobile (touch scrolling)
- [ ] **3.8** Verify time picker works on web (mouse scrolling)
- [ ] **3.9** Test time picker with different time formats
- [ ] **3.10** Verify time picker closes after selection

### Expected Results
- Time picker scrolls smoothly
- Selected time is accurate
- Component works on all platforms (iOS, Android, Web)
- No visual glitches or overlaps

---

## Phase 4: Public Booking Page

### Test Cases
- [ ] **4.1** Navigate to public booking page
- [ ] **4.2** Page loads without JavaScript errors
- [ ] **4.3** All form fields display correctly
- [ ] **4.4** Date picker shows available dates
- [ ] **4.5** Select a date and view available time slots
- [ ] **4.6** Time slots update when date changes
- [ ] **4.7** Select a time slot
- [ ] **4.8** Verify selected slot is highlighted
- [ ] **4.9** Fill in client information (name, phone, email)
- [ ] **4.10** Submit booking and receive confirmation

### Expected Results
- Page loads without errors
- Available dates and times display correctly
- Booking form submits successfully
- Confirmation message appears

---

## Phase 5: Client Booking Flow End-to-End

### Test Cases
- [ ] **5.1** Start new booking from app
- [ ] **5.2** Select a service with specific duration
- [ ] **5.3** View available dates for that service
- [ ] **5.4** Select a date
- [ ] **5.5** View available time slots for that date
- [ ] **5.6** Select a time slot
- [ ] **5.7** Confirm booking details
- [ ] **5.8** Submit booking
- [ ] **5.9** Receive SMS confirmation
- [ ] **5.10** Verify appointment appears in calendar

### Expected Results
- Full booking flow completes without errors
- Available slots respect business hours
- Available slots respect staff availability
- SMS is sent to client
- Appointment appears in business owner's calendar

---

## Phase 6: Availability Display in App Calendar

### Test Cases
- [ ] **6.1** Open calendar view
- [ ] **6.2** View business hours for each day
- [ ] **6.3** View daily overrides (visual indicator)
- [ ] **6.4** View staff unavailability (visual indicator)
- [ ] **6.5** View existing appointments
- [ ] **6.6** Identify available time slots visually
- [ ] **6.7** Click on available slot to create appointment
- [ ] **6.8** Click on unavailable slot (should show reason)
- [ ] **6.9** Scroll through multiple months
- [ ] **6.10** Verify availability updates when changes are made

### Expected Results
- Calendar displays all availability information
- Visual indicators are clear and distinct
- Clicking available slots works correctly
- Calendar updates in real-time

---

## Phase 7: Edge Cases & Error Handling

### Test Cases
- [ ] **7.1** Try to book in the past (should fail)
- [ ] **7.2** Try to book outside business hours (should fail)
- [ ] **7.3** Try to book when all staff are unavailable (should fail)
- [ ] **7.4** Try to book a slot that was just booked (should fail)
- [ ] **7.5** Try to book with invalid phone number (should fail)
- [ ] **7.6** Try to book with missing information (should fail)
- [ ] **7.7** Network error during booking (should handle gracefully)
- [ ] **7.8** Server timeout during booking (should show error message)
- [ ] **7.9** Try to access booking page for non-existent business (should show 404)
- [ ] **7.10** Try to access booking page with invalid slug (should show 404)

### Expected Results
- All error cases handled gracefully
- User-friendly error messages displayed
- No crashes or blank screens
- Booking form remains usable after error

---

## Phase 8: Performance Testing

### Test Cases
- [ ] **8.1** Business Hours page loads in < 2 seconds
- [ ] **8.2** Staff Calendar page loads in < 2 seconds
- [ ] **8.3** Public booking page loads in < 3 seconds
- [ ] **8.4** Available dates load in < 1 second
- [ ] **8.5** Available time slots load in < 1 second
- [ ] **8.6** Calendar scrolling is smooth (no lag)
- [ ] **8.7** Time picker scrolling is smooth
- [ ] **8.8** Booking submission completes in < 5 seconds
- [ ] **8.9** No memory leaks during extended use
- [ ] **8.10** App remains responsive with 100+ appointments

### Expected Results
- All pages load quickly
- UI is responsive and smooth
- No performance degradation over time

---

## Phase 9: Cross-Platform Testing

### Test Cases
- [ ] **9.1** Test on iOS (iPhone)
- [ ] **9.2** Test on Android (Samsung/Pixel)
- [ ] **9.3** Test on Web (Chrome)
- [ ] **9.4** Test on Web (Safari)
- [ ] **9.5** Test on Web (Firefox)
- [ ] **9.6** Test on tablet (iPad)
- [ ] **9.7** Test on tablet (Android tablet)
- [ ] **9.8** Test with different screen orientations
- [ ] **9.9** Test with different screen sizes
- [ ] **9.10** Test with accessibility features enabled

### Expected Results
- App works correctly on all platforms
- UI adapts to different screen sizes
- Accessibility features work properly

---

## Phase 10: Integration Testing

### Test Cases
- [ ] **10.1** Business owner sets up business hours
- [ ] **10.2** Business owner adds staff member
- [ ] **10.3** Staff member sets availability
- [ ] **10.4** Client books appointment
- [ ] **10.5** Appointment appears in both calendars
- [ ] **10.6** Business owner receives notification
- [ ] **10.7** Client receives SMS confirmation
- [ ] **10.8** Business owner can view client details
- [ ] **10.9** Business owner can reschedule appointment
- [ ] **10.10** Client receives rescheduled notification

### Expected Results
- All systems work together seamlessly
- Data is consistent across all views
- Notifications are sent correctly
- No data loss or corruption

---

## Test Results Summary

| Phase | Status | Issues Found | Notes |
|-------|--------|--------------|-------|
| 1. Business Hours Settings | ⬜ | - | - |
| 2. Staff Calendar | ⬜ | - | - |
| 3. TimePickerWheel | ⬜ | - | - |
| 4. Public Booking Page | ⬜ | - | - |
| 5. Client Booking Flow | ⬜ | - | - |
| 6. Availability Display | ⬜ | - | - |
| 7. Edge Cases | ⬜ | - | - |
| 8. Performance | ⬜ | - | - |
| 9. Cross-Platform | ⬜ | - | - |
| 10. Integration | ⬜ | - | - |

---

## Overall Assessment

**Status:** ⬜ Not Started

**Total Test Cases:** 100
**Passed:** 0
**Failed:** 0
**Blocked:** 0

**Critical Issues:** 0
**Major Issues:** 0
**Minor Issues:** 0

---

## Sign-Off

- **Tester:** Manus AI
- **Date:** 2026-04-11
- **Environment:** Development
- **Build Version:** 0c255335
