# Project TODO

- [x] Update theme colors to match design.md brand palette
- [x] Set up icon mappings for all tabs
- [x] Create data models and state management (services, clients, appointments)
- [x] Build tab navigation (Home, Calendar, Clients, Services, Settings)
- [x] Build Dashboard/Home screen with today's appointments and stats
- [x] Build Calendar screen with month view and day appointment list
- [x] Build Clients screen with search and list
- [x] Build Client Detail screen with history and notes
- [x] Build Services screen with list
- [x] Build Add/Edit Service screen
- [x] Build New Booking flow (3-step modal)
- [x] Build Appointment Detail screen
- [x] Build Settings screen with business profile and working hours
- [x] Generate custom app icon
- [x] Final polish and delivery
- [x] Rebrand app to "Lime Of Time" with user's lime-clock logo
- [x] Update theme colors to lime green palette matching the logo
- [x] Fix responsive alignment for all screen sizes
- [x] Add "Send Booking Link" button to share with clients
- [x] Build public booking page accessible via shared link
- [x] Add business profile section in Settings (name, phone, email, address, description)
- [x] Add pending appointment status for client-booked appointments
- [x] Add accept/reject workflow with SMS message generation
- [x] Add contact list import to Clients page
- [x] Build 4 clickable analytics slides on Home (Total Clients, Total Appointments, Total Revenue, Top Service)
- [x] Build analytics detail screens for each slide
- [x] Add calendar filters: Upcoming, Requests, Cancelled, Completed
- [x] Add colored status dots on calendar days
- [x] Add background logo watermark
- [x] Add theme mode toggle in Settings
- [x] Fix responsive alignment for all device resolutions
- [x] Fix time validation: prevent selecting past times for same-day bookings
- [x] Fix appointment duration: end time = start time + service duration (e.g. 9AM + 1hr = 10AM)
- [x] Add sign-up page with phone number entry
- [x] Add business info page after sign-up (name, address, phone, optional email/website, description)
- [x] Wire sign-up business info to Settings profile
- [x] Remove dashboard background logo watermark
- [x] Add client messaging with auto-generated appointment messages (date, time, company, service)
- [x] Message button opens phone SMS with pre-filled message and client phone number
- [x] Add scrolling time picker for working hours selection
- [x] Prevent double-booking: accepted appointment times should be unavailable to other clients
- [x] Add cancellation fee policy controlled by business owner (2-hour window)
- [x] Make calendar green status dots darker green
- [x] Add logout tab in Settings
- [x] Add delete business tab in Settings
- [x] Add temporary closed toggle in Settings connected to scheduling
- [x] Add review system connected to client page
- [x] Use limeoftime.com for public client pages (reviews and booking)
- [x] Fix contact import to select individual contacts instead of bulk import
- [x] Add business name/logo to dashboard header
- [x] Allow user to upload custom business logo image
- [x] Replace logo everywhere with new attached image, remove white background
- [x] Fix contact picker: list hidden by keyboard, show list on top
- [x] Fix contact picker: results from top not bottom, hide keyboard until search bar tapped
- [x] Fix any existing errors in the app
- [x] Add report generator for tax/year-end with all data (revenue, clients, appointments, services)
- [x] Reports accessible from each dashboard analytics slide
- [x] Fix contact picker: properly request permissions and show phone contacts list
- [x] Phone number format: (000) 000-0000
- [x] Settings address: click opens maps showing location on device
- [x] Working hours: control by specific working days via calendar, select time per day
- [x] Calendar: previous days should not be selectable
- [x] Service name: show duration at end e.g. "Hair Cut (20 min)"
- [x] Allow multiple same services with different timing and price
- [x] Fix shared booking link: use limeoftime.com/book/business-name with full business info
- [x] Shared link page: show business name, address, services with duration, calendar with only available upcoming times
- [x] Accept appointment: share full address with map link (e.g. 4661 McKnight Road, Pittsburgh PA, 15237)
- [x] All messages: professional format with full business info, address, service, date, time
- [x] Address in messages: clickable map link for clients
- [x] Connect database - design and implement DB schema for all entities
- [x] Create tRPC API routes for business owner CRUD
- [x] Create tRPC API routes for clients CRUD (linked to business owner)
- [x] Create tRPC API routes for services CRUD (linked to business owner)
- [x] Create tRPC API routes for appointments CRUD (linked to business owner)
- [x] Create tRPC API routes for reviews CRUD (linked to business owner)
- [x] Create tRPC API routes for business settings/profile
- [x] Connect frontend store to database via tRPC
- [x] Implement auth flow - check DB for existing business owner on app launch
- [x] Route to onboarding if no business owner, home if exists
- [x] Ensure all client data is linked to specific business owner
- [x] Write tests for database connections and API routes
- [x] Fix client data not saving to DB - add syncToDb to clients.tsx
- [x] Add discount system - time-based discounts for specific durations
- [x] Add discount DB schema and tRPC routes
- [x] Add discount UI in services/settings
- [x] Add gift card system - shareable service gifts for clients
- [x] Add gift card DB schema and tRPC routes
- [x] Add gift card UI - create, share, redeem
- [x] Add professional dashboard charts (revenue, appointments, clients)
- [x] Add per-day working hours/schedule control with calendar
- [x] Working days calendar - select specific days and set custom hours
- [x] Integrate working days with DB and client-side booking
- [x] Closed days should block booking on client side
- [x] Fix dashboard layout alignment - charts, stats cards, quick actions properly aligned
- [x] Fix text fields and buttons alignment across all screens and resolutions
- [x] Fix responsive layout for all device sizes - consistent padding, margins, widths
- [x] Fix quick actions section alignment on dashboard
- [x] Fix form inputs alignment on onboarding, booking, settings screens
- [x] Fix Discounts page alignment to match Settings/Calendar/Home quality
- [x] Fix Gift Cards page alignment to match Settings/Calendar/Home quality
- [x] Fix Book an Appointment pages alignment to match Settings/Calendar/Home quality
- [x] Update discount system to use calendar date selection instead of day-of-week
- [x] Discount date picker: only allow future dates, not past ones
- [x] Integrate date-based discounts into booking flow and DB
- [x] Fix phone number formatting - +1 numbers should save as +1 (888) 888-8888 not (188) 888-8888
- [x] Fix custom days calendar alignment in Settings working hours
- [x] Add gift card sharing - business owner sends to client via SMS
- [x] Add gift card redemption on client web booking page
- [x] Make booking days unselectable when no available time slots exist
- [x] Release cancelled appointment time slots for rebooking by other clients
- [x] Change all limeoftime.com references to lime-of-time.com
- [x] Ensure backend serves public booking/review web pages for lime-of-time.com
- [x] Verify public web routes work correctly from server
- [x] Create /book/[slug] route for public booking URL
- [x] Create /review/[slug] route for public review URL
- [x] Create /gift/[code] route for gift card redemption URL
- [x] Add review link to confirmation and accept SMS messages
- [x] Add gift card URL to SMS sharing
- [x] Fix EAS build configuration error for publishing
- [x] Fix Android build minSdkVersion from 22 to 24
- [x] Fix Android EAS build minSdkVersion 22 error - expo-build-properties plugin not applied during cloud build
- [x] Add public REST API endpoints for booking data (business info, services, slots, submit appointment)
- [x] Build standalone HTML booking page served by Express server
- [x] Build standalone HTML review page served by Express server
- [x] Build standalone HTML gift card redemption page served by Express server
- [x] Client can select service, day, time, enter name and submit appointment request via web
- [x] Business owner receives appointment request in the app from web bookings
- [x] Provide DNS setup instructions for lime-of-time.com
- [x] Fix public web routes not being served on Manus deployment (book/review/gift pages return Not Found)
- [x] Issue 1: Fix resolution and responsive layout issues across the entire app (especially on iOS after closing/reopening)
- [x] Issue 2: Ensure consistent resolution handling on all pages (no shifting, clipping, scaling, or broken alignment)
- [x] Issue 3: Fix pages only functioning after opening Client Info — Discount, Gift, New Service pages should work from initial app launch
- [x] Issue 4: Fix system theme synchronization — app should update live when device switches between Light/Dark mode
- [x] Issue 5: Fix link reliability — shared booking links work inconsistently
- [x] Issue 6: Add Face ID login support for authentication
- [x] Issue 7: Implement logout and Face ID re-auth flow — business owner logged out on app close, Face ID prompt on reopen
- [x] Issue 8: Enhance splash screen with app logo for polished first impression
- [x] Issue 9: Improve Home Page UI — modernize charts with better graph presentation and readability
- [x] Issue 10: Validate all outgoing/shared links (lime-of-time.com/book, /gift, /review) route correctly every time
- [x] Fix Face ID functionality not working properly
- [x] Fix header overlap/layout on modal pages (Edit Service shows Chrome/back button overlapping title, Save button cut off)
- [x] Fix revenue trend chart not showing money numbers
- [x] Fix Discounts and Gifts not showing data until switching pages and coming back to dashboard
- [x] Fix URL/link routing issue for lime-of-time.com
- [x] Fix double /api prefix in generated links (e.g. /api/api/book/slug) — deployment proxy already adds /api
- [x] Remove Face ID toggle from Settings page
- [x] Fix header overlap on New Service, Gift Cards, and Discounts pages (titles and buttons hidden)
- [x] Fix Face ID logic — stops locking in a loop on every foreground event
- [x] Add Face ID option to onboarding/start page
- [x] Fix client booking calendar to match business working days/hours and custom schedule
- [x] Client calendar should display current month/year like business side
- [x] Non-working days should not be selectable on client booking calendar
- [x] Add Products model (DB schema, store, tRPC routes) for business products
- [x] Add Products management UI in Services tab
- [x] Add multi-service/product selection with "Add More" on client booking page
- [x] Update total appointment time when multiple services selected
- [x] Add "Save Receipt" button to booking confirmation
- [x] Receipt should show all selected services, products, pricing, and total
- [x] Fix duplicate client prevention with phone number normalization
- [x] Auto-update client name when same phone submits new request with different name
- [x] Connect all changes to public HTML booking page served by Express
- [x] Fix client booking calendar: days with no available time slots should be disabled/unselectable
- [x] Add green dot indicator on days that have available time slots
- [x] Ensure monthly calendar with month/year header and prev/next month navigation works on deployed version
- [x] Past days should not be selectable, only future available days
- [x] Add "Add More" button on confirm step so client can add services/products before final submit
- [x] Receipt on success page should show all added services, products, total price, total time, and download button
- [x] Fix client booking page Continue button not advancing to next step
- [x] Add Products selection to New Booking page for business user
- [x] Add multiple services and products selection to Gift Cards page
- [x] Add services and products selection to Discounts page (discount can apply to services, products, or both)
- [x] Ensure Products are fully integrated across all app sections
- [x] Add schedule mode switch to Settings (Weekly Hours vs Custom Days)
- [x] Only one schedule mode active at a time, switchable anytime
- [x] When Weekly Hours mode is on, booking uses fixed weekly schedule (e.g. Mon-Fri 8-5)
- [x] When Custom Days mode is on, booking uses per-day custom schedule
- [x] Connect schedule mode to public booking page slot generation
- [x] Fix loadWorkingDays JS function not setting global variables (workingDays/schedMode undefined)
- [x] Fix working-days API returning all days false when business has weekly hours configured (case mismatch: DB stores lowercase day names, code checked capitalized names)
- [x] Fix client booking page (public HTML) calendar not showing available days when Weekly Hours mode is selected (works in-app but not on web)
- [x] Fix revenue calculation: extra items (multi-service/product bookings) not adding to total income and weekly income properly
- [x] Fix business-side appointment detail: show full itemized charges (services, products, prices) not just in notes
- [x] Fix Face ID: after initial enable, auto-login without re-asking every time user opens app (added toggle to Settings, cold-start-only prompt)
- [x] Fix gift card: extra services added by client beyond the gift should be charged (gift only covers what was shared)
- [x] Gift link page: add Copy button for gift code string to paste in booking page gift field
- [x] Gift link: auto-fill gift code when client clicks shared link (pre-populate gift field on booking page)
- [x] Push notifications: send real-time notification to business owner phone when client submits appointment request
- [x] Remove "Map:" line from SMS acceptance message (keep Location line, remove raw URL)
- [x] Fix charges calculation: appointment detail should show full total (service + extras + products - gift - discount), not just base service price
- [x] Ensure income/revenue analytics reflect full charged amount including extras, gift deductions, and discounts across entire app
- [x] Redesign gift card to support monetary balance (sum of selected services/products)
- [x] Gift card creation: allow selecting multiple services and products
- [x] Gift card balance tracking: deduct from balance on each use, allow reuse until balance is $0
- [x] Client booking page: pre-select gifted services/products when gift code applied
- [x] Client booking page: deduct gift balance from total, charge remainder
- [x] In-app booking: support gift balance deduction and partial use
- [x] Server-side: update gift balance after each booking use
- [x] Appointment detail and analytics: show gift deduction correctly with balance-based gifts
- [x] Fix gift card page money calculation broken after balance-based redesign (fixed: server GIFT_DATA parsing, giftUsedAmount tracking, old card fallback, appointment detail deduction display)
- [x] Pre-fill client name and phone number on review page when client opens review link from SMS (already implemented: SMS includes ?name=&phone= params, review page reads and pre-fills)
- [x] Integrate Resend email service for branded appointment notifications from noreply@lime-of-time.com
- [x] Design branded HTML email template with Lime Of Time logo
- [x] Send email notification to business owner when client submits booking request
- [x] Remove Map line from SMS messages (accept, reminder, follow-up) and replace with booking link
- [x] Remove old Manus notification email for new booking requests — only use branded Resend email from lime-of-time.com
- [x] Enable push notification to business owner when new appointment request is submitted (app notification only, no email)

## Phase: Free Features Implementation (33 items)

### Admin Dashboard
- [x] Build admin dashboard with login (username/password from env vars)
- [x] Admin overview: total businesses, clients, appointments, revenue stats
- [x] Admin business management: view/edit/delete all businesses
- [x] Admin client management: view all clients across businesses
- [x] Admin appointment management: view/filter all appointments
- [x] Admin DB explorer: view/query all tables
- [x] Admin settings: manage admin credentials, feature flags
- [x] Admin analytics: user growth, appointment trends, geographic distribution

### Legal Protection
- [x] Generate Privacy Policy page (accessible from app Settings and booking page)
- [x] Generate Terms of Service page (linked from onboarding and booking page)
- [x] Generate End User License Agreement page
- [x] Add client consent checkbox on booking page with timestamp/IP logging
- [x] Generate Business Owner Agreement shown during onboarding
- [x] Add cookie consent banner on booking page
- [x] Add data deletion request feature in app Settings

### Booking Page Improvements
- [x] Display business logo on booking page
- [x] Add SEO meta tags and Open Graph to booking page
- [x] Add dark mode support to booking page
- [x] Add skeleton loading states to booking page
- [x] Improve booking page accessibility (WCAG compliance)

### Core App Features
- [x] Client self-service cancel/reschedule from booking link
- [x] Recurring/repeat appointments
- [x] Revenue analytics dashboard improvements
- [x] Waitlist for fully booked slots
- [x] Client notes and history improvements
- [x] Buffer time between appointments
- [x] Intake forms / pre-appointment questionnaire
- [x] Service categories and grouping
- [x] Blocked dates / holidays management
- [x] Custom booking slug
- [x] Export data (CSV/PDF)
- [x] Onboarding tutorial / walkthrough

### Notifications
- [x] Rich push notifications with appointment details

## Phase: Staff Management + Discount Fix + Admin Integration

### Staff/Team Management
- [x] Add staff DB schema (name, phone, email, role, services, schedule)
- [x] Add staff tRPC routes (CRUD operations)
- [x] Add staff to app store and types
- [x] Build staff management UI screen (add/edit/remove staff)
- [x] Staff service assignments (which staff can perform which services)
- [x] Staff individual schedules (working hours per staff member)
- [x] Integrate staff into booking flow (select staff when booking)
- [x] Show staff on calendar views

### Discount Fix
- [x] Fix discount calculation on client booking page checkout (100% off = $0 total)
- [x] Show discount breakdown on booking confirmation/receipt
- [x] Ensure discount applies correctly to multi-service bookings

### Admin Dashboard Integration
- [x] Add staff management section to admin dashboard
- [x] Add staff to business detail page in admin
- [x] Add staff count to admin dashboard overview
- [x] Ensure all new data visible in admin DB explorer (staff_members table added)

## Phase: PDF Export, Reviews, Cancel/Reschedule, Staff Booking, Staff Calendar

### PDF Export
- [x] Replace CSV export with professional PDF document generation
- [x] PDF should include business branding, formatted tables, and clean layout

### Reviews in Business Settings
- [x] Add reviews section to business settings/profile screen
- [x] Reviews are read-only (business cannot delete client reviews)
- [x] Display star ratings, client name, date, and review text

### Cancel/Reschedule Improvements
- [x] Auto-populate client phone number on manage appointment page
- [x] Pending appointments: client can only cancel (no reschedule option)
- [x] Accepted appointments: client can request reschedule
- [x] Reschedule only allowed 24+ hours before appointment time
- [x] Business acceptance SMS must include reschedule link at the end
- [x] Acceptance message must include client's approved message text

### Staff Selection in Client Booking
- [x] Show staff member selection step in client booking page
- [x] Filter available time slots based on selected staff member's schedule
- [x] Include selected staff name in booking confirmation

### Staff Calendar View
- [x] Build per-staff calendar view screen for business owners
- [x] Show individual staff member appointments on their calendar
- [x] Timeline and calendar view modes with stats

## Phase: Multi-Location Management + Remaining Items

### Multi-Location Management
- [x] Add locations DB schema (name, address, phone, email, working hours per location)
- [x] Add locations tRPC routes (CRUD operations)
- [x] Add locations to app store and types
- [x] Build location management UI screen (add/edit/remove locations)
- [ ] Each location has its own separate staff assignments
- [ ] Each location has its own separate scheduling/working hours
- [ ] Each location has its own separate services and pricing
- [ ] Location selector on dashboard — switch between locations to view stats
- [ ] Location-specific booking links (e.g. lime-of-time.com/book/business/location)
- [ ] Client booking page shows location selector when business has multiple locations
- [ ] Location-specific calendar view for business owner
- [ ] Location-specific analytics and revenue tracking
- [ ] Admin dashboard integration — view all locations per business

### Remaining Staff Items
- [x] Integrate staff into in-app booking flow (select staff when creating appointment from app)
- [x] Show staff assignments on main calendar view (color-coded by staff member)

## Phase: Multi-Location, Staff Fixes, Settings Restructure, Bug Fixes

### Bug Fixes
- [x] Fix phone number matching for cancel/reschedule (auto-filled phone shows mismatch error)
- [x] Fix charges/discount display in app — total charges from client must show correctly
- [x] Fix discount calculation accuracy across the entire app

### Settings Restructure
- [x] Move Reviews to a separate screen (not inside Settings)
- [x] Move Data Export to a separate screen
- [x] Move Staff Management to a separate screen (already done)
- [x] Move Discounts/Gift Cards to separate screens (already done)
- [x] Simplify Settings to only show core business settings
- [x] Create a "More" or organized navigation for all sub-features

### Multi-Location Management
- [x] Add locations DB schema (name, address, phone, email, working hours per location)
- [x] Add locations tRPC routes (CRUD operations)
- [x] Add locations to app store and types
- [x] Build location management UI screen (add/edit/remove locations)
- [ ] Each location has its own separate staff assignments
- [ ] Each location has its own separate scheduling/working hours
- [ ] Each location has its own separate services and pricing
- [ ] Location selector on dashboard — switch between locations to view stats
- [ ] Location-specific booking links
- [ ] Client booking page shows location selector when business has multiple locations
- [ ] Location-specific calendar view for business owner
- [ ] Location-specific analytics and revenue tracking
- [ ] Admin dashboard integration — view all locations per business

### Remaining Staff Items
- [x] Integrate staff into in-app booking flow (select staff when creating appointment from app)
- [x] Show staff assignments on main calendar view (color-coded by staff member)

## Phase: Multi-Location Deep Integration + Categories + Brands + Fixes + Admin Redesign

### Service Categories Integration
- [x] Add service categories to all service selection UIs (discounts, gift cards, appointment creation, client booking)
- [x] Group services by category in selection lists with collapsible headers
- [x] Ensure categories work in business-side new booking service picker
- [x] Ensure categories work in client-side web booking service picker
- [x] Ensure categories work in discount creation service picker
- [x] Ensure categories work in gift card creation service picker

### Product Brands
- [x] Add brand field to Product type and DB schema
- [x] Add brand input to product creation/edit form
- [x] Group products by brand in all product selection UIs
- [x] Ensure brands work in business-side new booking product picker
- [x] Ensure brands work in client-side web booking product picker
- [x] Ensure brands work in gift card creation product picker

### Cancellation Fee Visibility
- [x] Show cancellation fee policy on client booking page before appointment submission
- [x] Show cancellation fee warning when client cancels within the restricted time window
- [x] Display cancellation policy as a link/notice on the client-facing pages

### Discount Fixes
- [x] Fix day-specific percentage discounts not visible on client booking page
- [x] Add discount application to business-side new booking flow (apply active discounts when creating appointment from app)
- [x] Ensure discount breakdown shows correctly in all booking confirmation views

### Multi-Location Deep Integration
- [x] Wire location-specific staff assignments (staff linked to locations)
- [x] Wire location-specific scheduling/working hours into booking slot generation
- [x] Wire location-specific services and pricing
- [x] Add location selector/switcher on dashboard to filter stats by location
- [x] Create location-specific booking links (lime-of-time.com/book/business/location)
- [x] Add location selector to client booking page when business has multiple locations
- [x] Add location filter to calendar view for business owner
- [x] Add location-specific analytics and revenue tracking
- [x] Add locations to admin dashboard — view all locations per business

### Phone/Tablet Responsive Design
- [x] Optimize all app screens for tablet landscape and portrait modes
- [x] Ensure consistent padding, font sizes, and layout on both phone and tablet resolutions
- [x] Test and fix dashboard, calendar, settings, booking screens for tablet

### Admin Dashboard Redesign
- [x] Separate businesses into individual detail views instead of combined lists
- [x] Each business card/page shows all its data (clients, appointments, services, staff, locations, revenue)
- [x] Update admin dashboard logo to Lime Of Time logo (attached image)
- [x] Improve admin dashboard navigation and information hierarchy

## Phase: Notification Fixes — Business Name + Deep Navigation

### Notification Sender Name
- [x] Replace generic titles with business name in all push notification titles (server-side notifyOwner calls)
- [x] Use business name in local reminder notification titles instead of generic text

### Notification Tap Navigation (Deep Linking)
- [x] Add notification response listener (addNotificationResponseReceivedListener) to handle taps
- [x] Handle getLastNotificationResponseAsync for cold-start notification taps
- [x] Include navigation data (type, appointmentId, screen) in all notification payloads
- [x] New booking request notification tap → navigate to appointment-detail with the requested appointment
- [x] Appointment cancelled notification tap → navigate to appointment-detail
- [x] Appointment rescheduled notification tap → navigate to appointment-detail
- [x] 30-min reminder notification tap → navigate to appointment-detail with appointment info
- [x] 1-hour reminder notification tap → navigate to appointment-detail with appointment info
- [x] Waitlist notification tap → navigate to calendar/requests view

## Phase: SMS + Booking Link Fixes

- [x] Fix SMS not sending after confirming a booking from the app (regression)
- [x] Fix booking link missing /api/ prefix — should be /api/book/slug not /book/slug
- [x] Verify public client booking web page works properly for all businesses
- [x] Fix booking page JavaScript syntax error caused by unescaped quotes in selectLocation onclick handler
- [x] Fix manage page slot button quote escaping for selectSlot onclick handler

## Phase: Admin Dashboard Delete Functionality

- [x] Cascade delete business — deleting a business removes all related data (clients, appointments, services, staff, locations, discounts, gift cards, reviews, products, working days, notifications)
- [x] Add individual delete buttons on admin Clients page
- [x] Add individual delete buttons on admin Appointments page
- [x] Add individual delete buttons on admin Services page
- [x] Add individual delete buttons on admin Staff page
- [x] Add individual delete buttons on admin Locations page
- [x] Add individual delete buttons on admin Discounts page
- [x] Add individual delete buttons on admin Gift Cards page
- [x] Add individual delete buttons on admin Reviews page
- [x] Add individual delete buttons on admin Products page
- [x] Add confirmation dialog before any delete action
- [x] Ensure all delete APIs are protected by admin auth


## Phase: Unified Availability Management System Implementation

### Phase 1: Database Schema
- [ ] Create dailyOverrides table
- [ ] Create staffAvailability table
- [ ] Add multiStaffMode column to businessOwners
- [ ] Add staffId and locationId columns to appointments
- [ ] Create indexes for performance
- [ ] Write migration scripts with rollback capability

### Phase 2: Availability Logic Layer
- [ ] Create lib/availability.ts with core functions
- [ ] Implement getAvailableHours() function
- [ ] Implement isDateTimeAvailable() function
- [ ] Implement getAvailableTimeSlots() function
- [ ] Add fallback logic for backward compatibility
- [ ] Write unit tests for availability logic

### Phase 3: TimePickerWheel Component
- [ ] Create components/ui/time-picker-wheel.tsx
- [ ] Implement 12-hour format with AM/PM
- [ ] Support flexible minute selection
- [ ] Add scrolling wheel interaction
- [ ] Test on mobile and web
- [ ] Write component tests

### Phase 4: Business Hours Refactor
- [ ] Rename "Custom Working Hours" to "Business Hours"
- [ ] Redesign Business Hours screen
- [ ] Integrate TimePickerWheel
- [ ] Add preset templates (9-5 Mon-Fri, etc.)
- [ ] Add "Apply to all days" button
- [ ] Update store and API routes

### Phase 5: Calendar Daily Overrides
- [ ] Add right panel to Calendar screen
- [ ] Implement Work Day toggle
- [ ] Add time pickers for daily override
- [ ] Add visual feedback (grayed out, badges)
- [ ] Add conflict detection
- [ ] Sync to database

### Phase 6: Staff Calendar
- [ ] Create Staff Calendar screen
- [ ] Add Multi-Staff Mode toggle to Settings
- [ ] Implement staff availability assignment
- [ ] Integrate with availability logic
- [ ] Add staff conflict detection
- [ ] Update calendar to show staff view

### Phase 7: Data Migration
- [ ] Extract daily overrides from workingHours
- [ ] Extract staff availability from staffMembers
- [ ] Update multi-staff mode flags
- [ ] Enhance appointments with staffId
- [ ] Validate all migrated data
- [ ] Create migration validation report

### Phase 8: Comprehensive Testing
- [ ] Unit tests for availability logic (20+ test cases)
- [ ] Unit tests for TimePickerWheel component
- [ ] Integration tests for booking flow
- [ ] Regression tests for existing features
- [ ] E2E tests for calendar
- [ ] E2E tests for new booking flow
- [ ] Performance tests
- [ ] Mobile and web compatibility tests

### Phase 9: Final Validation & Deployment
- [ ] Run full test suite
- [ ] Verify no breaking changes
- [ ] Test rollback procedure
- [ ] Create deployment checklist
- [ ] Document all changes
- [ ] Save checkpoint


## Phase: Unified Availability Management System

### Phase 1-2: Foundation & Schema (COMPLETED)
- [x] Create database migration script for new tables (dailyOverrides, staffAvailability)
- [x] Implement backward compatibility layer
- [x] Add multiStaffMode flag to businessOwners
- [x] Add optional staffId, locationId to appointments

### Phase 3: TimePickerWheel Component (COMPLETED)
- [x] Create TimePickerWheel component with scrolling wheel interface
- [x] Implement SimpleTimePicker for quick adjustments
- [x] Support 12-hour and 24-hour formats
- [x] Add haptic feedback on selection

### Phase 4: Availability Logic Layer (COMPLETED)
- [x] Create availability.ts with core functions
- [x] Implement three-tier availability checking
- [x] Create 38 comprehensive unit/integration/E2E tests
- [x] All tests passing (343 total tests passing)

### Phase 5: Business Hours UI Refactor (COMPLETED)
- [x] Create business-hours-settings.tsx screen
- [x] Add weekly schedule editor with day toggles
- [x] Implement daily override management
- [x] Add multi-staff mode toggle

### Phase 6: Staff Calendar Enhancement (COMPLETED)
- [x] Verify existing staff-calendar.tsx has all required features
- [x] Staff availability override management exists

### Phase 7: Data Migration (PENDING)
- [ ] Create migration script to populate new tables
- [ ] Validate data integrity
- [ ] Test rollback procedures

### Phase 8: Comprehensive Testing (COMPLETED)
- [x] Unit tests for all availability functions (38 tests)
- [x] Integration tests with booking system
- [x] All 343 tests passing

### Phase 9: Final Delivery (IN PROGRESS)
- [ ] Code review and cleanup
- [ ] Save final checkpoint
- [ ] Deploy to production
- [x] Add per-day Workday override toggle in calendar (ON = available, OFF = blocked)
- [x] Add time range picker per day when Workday is ON (within Business Hours)
- [x] Persist dailyOverrides to customSchedule table in database
- [x] Build reusable ScrollWheelTimePicker (12-hour, AM/PM, flexible minutes)
- [x] Replace all time inputs app-wide with ScrollWheelTimePicker (schedule-settings, staff-form, discounts)
- [x] Add Day view to calendar (appointment timeline like staff-calendar)
- [x] Add Week view to calendar (7-column layout with appointment slots)
- [x] Wire dailyOverrides into new-booking.tsx booking flow (already integrated via customSchedule)
- [x] Wire dailyOverrides into public booking server-side availability (already integrated via customSchedule)
- [x] Fix Edit Hours save not persisting custom time override in Workday panel
- [x] Restrict ScrollWheelTimePicker items to Business Hours range only
- [x] Show Start and End time pickers side-by-side horizontally
- [x] Fix ScrollWheelTimePicker scroll animation lag
- [x] Rebuild Week view: standard weekly navigation, past days disabled, today first and highlighted
- [x] Add Workday switches per day column in Week view
- [x] Add day timeline for selected day in Week view
- [x] Add Business Hours Active Until toggle + date picker in settings
- [x] Replace time inputs with ScrollWheelTimePicker in business-hours-settings.tsx (via schedule-settings.tsx)
- [x] Replace time inputs with ScrollWheelTimePicker in new-booking.tsx (uses slot chips, not text input)
- [x] Wire businessHoursEndDate into calendar and booking to block dates after expiry
- [x] Redesign Week view: horizontal ScrollView, today first, each day = header + Workday switch + full timeline (same as Day view)
- [x] Fix ScrollWheelTimePicker: AM/PM column clipping, proper column widths
- [x] Fix ScrollWheelTimePicker: min/max bounds correctly restrict visible items (not just onChange)
- [x] Fix calendar Workday modal: correct Business Hours bounds passed to pickers
- [x] Fix saved custom hours override Business Hours in all booking flows
- [x] Apply consistent layout fixes to schedule-settings.tsx time picker modal
- [ ] Add end time validation error in calendar.tsx Workday modal (end must be after start)
- [ ] Add end time validation error in schedule-settings.tsx weekly and custom-date modals
- [ ] Add end time validation error in staff-form.tsx and discounts.tsx modals

## Multi-Location & Staff Management

- [ ] Staff form: add multi-location selector (toggle per location); auto-assign when single location (hidden)
- [ ] Location form: replace custom schedule toggle with always-visible Business Hours section using TapTimePicker
- [ ] Public staff API: expose locationIds in response so booking page can filter by location
- [ ] Client booking page: filter staff list to only those assigned to the selected location
- [ ] Staff calendar: constrain available hours to assigned location's business hours (fallback to global)
- [ ] Main calendar: show location filter tabs when multi-location exists
- [ ] Single-location: hide all location UI when only 1 location exists

## Multi-Location & Staff Integration Gaps (Audit Apr 11)
- [x] Fix staff API: use s.workingHours (not s.schedule) when returning staff to booking page
- [x] Fix staff API: use s.active (not s.isActive) for filtering active staff
- [x] Fix /slots endpoint: accept optional staffLocalId + locationLocalId query params; use most specific schedule (staff > location > global)
- [x] Fix booking page loadSlots: pass selectedStaff.localId + selectedLocation when fetching slots
- [ ] Fix booking page checkDayAvailability: pass selectedStaff.localId + selectedLocation when checking day availability
- [ ] Fix booking page isWorkingDay: use selected location's workingHours when a location is selected
- [x] Fix booking page: clear slotCache when staff or location changes
- [x] Fix locations API: include workingHours in response so booking page can use per-location hours
- [ ] Staff list screen: show location assignments (when multi-location) and per-day workday summary


## Multi-Location & Staff Integration Gaps (Audit Apr 11)
- [x] Fix staff API: use s.workingHours (not s.schedule) when returning staff to booking page
- [x] Fix staff API: use s.active (not s.isActive) for filtering active staff
- [x] Fix /slots endpoint: accept optional staffLocalId + locationLocalId query params
- [x] Fix booking page loadSlots: pass selectedStaff.localId + selectedLocation when fetching slots
- [x] Fix booking page checkDayAvailability: pass staff + location params
- [x] Fix booking page isWorkingDay: use selected location workingHours when location selected
- [x] Fix booking page: clear slotCache when staff or location changes
- [x] Fix locations API: include workingHours in response
- [x] Staff list screen: show location assignments and per-day workday summary

## Responsive Layout (Phone + Tablet + Web)
- [x] Create useResponsive hook with phone/tablet/web breakpoints
- [ ] Fix tab bar: wider tabs with labels on tablet/web, proper sizing
- [ ] Fix appointment-detail: add responsive padding and tabletMaxWidth centering
- [ ] Fix service-form: add responsive padding and tabletMaxWidth centering
- [ ] Fix new-booking: add responsive padding and tabletMaxWidth centering
- [ ] Fix business-hours-settings: add responsive padding and tabletMaxWidth centering
- [ ] Fix schedule-settings: add responsive padding and tabletMaxWidth centering
- [ ] Fix booking-policies: add responsive padding and tabletMaxWidth centering
- [ ] Fix data-export: add responsive padding and tabletMaxWidth centering
- [ ] Fix product-form: add responsive padding and tabletMaxWidth centering
- [ ] Fix home screen: 3-column KPI on large tablet, 2-column upcoming list on tablet
- [ ] Fix calendar screen: wider day/week view on tablet, better use of horizontal space
- [ ] Fix settings screen: 2-column layout for settings groups on tablet/web
- [ ] Ensure all screens with tabletMaxWidth=0 properly use full width with correct padding

## Global Location Context

- [ ] Add city, state, zipCode fields to Location type and DB schema
- [x] Add activeLocationId to global store with AsyncStorage persistence
- [x] Create useActiveLocation hook
- [x] Create LocationSwitcher component (header picker)
- [ ] Scope Staff list to active location
- [ ] Scope Staff form location assignment to active location
- [ ] Scope Staff calendar to active location
- [ ] Scope Calendar tab to active location (replace local filter with global)
- [ ] Scope Business Hours settings to active location
- [ ] Scope Schedule settings to active location
- [ ] Fix onboarding: split address into Address/City/State/ZIP, create first location
- [ ] Update Settings: location switcher at top, separate profile vs location data
- [ ] Auto-set active location on app load (default location or first location)

## Address Display & Business Profile Refactor

- [ ] Add formatFullAddress utility to types.ts
- [ ] Show formatted address in location cards (locations.tsx)
- [ ] Show formatted address in location-form header/preview
- [ ] Create business-profile.tsx screen (Name, Owner, Phone, Email, Website, Description — no address)
- [ ] Add Business Profile nav item to Settings locationNavItems
- [ ] Remove Business Profile inline card from settings.tsx
- [ ] Remove address field from BusinessProfile interface and settings profile form
- [ ] Add exclusive active-location toggle (Switch) at top of each location card
- [ ] Ensure toggling a location active deactivates all others
- [ ] Add required field validation (inline errors) to location-form
- [ ] Remove Business Hours section from location card in locations.tsx (it's now in Schedule & Hours)
- [x] Add Copy Booking Link button to each location card with toast feedback and cross-platform clipboard support
- [x] Add Share button to each location card that shares that specific location's unique booking URL via native Share sheet
- [x] Make Email and Owner Name optional in Business Profile (remove required validation)
- [ ] Remove Default Location toggle from location-form Settings section
- [ ] Remove Business Hours section from location-form (managed via Schedule & Hours)
- [ ] Staff-form: single-select location (not multi), pre-filled with active location, no "all locations" toggle
- [ ] Staff-calendar: disable past dates and days-off from being selectable (not just dimmed)
- [ ] Staff screen: replace location number badges with tappable location name that opens location switcher
- [ ] Staff screen: verify Remove/Delete staff button works correctly
- [x] Add location name/address to booking confirmation email
- [x] Add location name/address to web booking confirmation HTML
- [x] Add location name/address to in-app booking.tsx confirmation step
- [x] Add location name/address to appointment-detail.tsx
- [x] Surface per-location shareable booking links in Settings > Location screen
- [x] Update SMS acceptance message to use appointment's specific location name and address
- [x] Add location name and address to cancellation SMS message
- [x] Add location name and address to rejection SMS message
- [x] Add active location name and address to PDF export header
- [x] Fix booking link to use lime-of-time.com domain with correct business slug
- [x] Fix Share button to share correct per-location URL
- [x] New locations default to inactive (toggle off) with no placeholder name
- [x] Split address into Address, City, State, Zip fields in location form
- [x] Enforce single active location at a time (radio-style toggle)
- [x] Update public booking page to use correct domain in confirmation
- [x] Auto-activate first location added to prevent empty state
- [x] Fix web share link /book/slug to redirect to /api/book/slug
- [x] Fix address in SMS messages to show full address (street, city, state, zip)
- [x] Fix all SMS booking links to use https://lime-of-time.com domain
- [ ] Fix Business Hours/Calendar mismatch: calendar must use same per-location workingHours as Schedule & Hours
- [ ] Fix Clients tab: filter by active location using clientsForActiveLocation
- [ ] Add location switcher to Clients tab so clients can switch between locations
- [x] Location picker sheet on Home screen Share button — choose location without switching active
- [x] Reopen date on Temporarily Closed — optional YYYY-MM-DD date field with auto-reopen on app load
- [x] Fix web booking page address to show full address (Street, City, State ZIP)
- [x] Fix Business Hours/Calendar mismatch: calendar must use per-location workingHours
- [x] Fix Clients tab: filter by active location using clientsForActiveLocation
- [x] Remove "Today" button from Calendar header
- [x] New location should be disabled (active=false) by default until manually enabled
- [x] Locations: enforce single-active-location mutual exclusion (only one ON at a time)
- [x] Temporarily Closed: block Calendar and Staff Calendar from showing available slots
- [x] Add Location Switcher to Clients tab for filtering client list by location
- [x] Add location badges on client cards showing which locations they have visited
- [x] Remove Add Review and Delete Review buttons from client Reviews tab (read-only)
- [x] Remove Temporarily Closed toggle from Booking Policies screen
- [x] Replace YYYY-MM-DD text input with calendar date picker for Reopen Date in locations
- [x] Fix Temporarily Closed toggle wiping location address/data when toggled on
- [x] Fix Temporarily Closed toggle deleting/removing the location
- [x] Calendar: all future days red and unselectable when active location is temporarily closed
- [x] Staff Calendar: all future days red when location is temporarily closed
- [x] Home screen: red banner showing temporarily closed status with reopen date
- [x] Client booking page: professional "temporarily closed" message with reopen date

## Temporarily Closed UI Propagation
- [ ] Home page: show Temporarily Closed banner when location is closed
- [ ] Main calendar: show red days for the Temporarily Closed period (today through reopenOn date)
- [ ] Staff calendar: show red days for the Temporarily Closed period
- [ ] Client booking page: show Temporarily Closed message with reopen date
- [ ] All pages update in real-time when toggle changes (no reload required)
- [ ] Test full address display on client booking page
- [ ] Fix any address display bugs on client booking page

## UI/Design Overhaul
- [x] Update theme.config.js with deep sage green / dark navy brand palette
- [x] Add surfaceElevated and surfaceAlt tokens to theme.config.d.ts
- [x] Load Inter font weights (300–700) in app/_layout.tsx
- [x] Redesign onboarding screen: animated gradient background, floating particles, logo ring, progress dots, spring button
- [x] Redesign home screen header: gradient greeting banner with brand color
- [x] Upgrade KPI cards to full gradient cards (orange, blue, green, purple) with white text
- [x] Improve Today's Schedule section: count badge, time block pill, improved empty state
- [x] Upgrade FAB to gradient with scale press feedback and stronger shadow

## Data Persistence / DB Connectivity (TestFlight)
- [x] Fix API base URL: TestFlight builds must point to production server, not localhost
- [x] Fix auth login: phone lookup must query DB and return existing owner data
- [x] Fix data sync: all CRUD operations must write to DB on TestFlight (not just local AsyncStorage)
- [x] Fix logout: data must persist in DB so re-login restores all data
- [x] Fix new business registration: owner record must be created in DB on onboarding (no silent fallback)
- [x] Verify tRPC client URL is set correctly for production builds
- [x] Test phone 412-482-7733 can find existing owner in DB after fix
- [x] Fix phone normalization in DB lookup (server/db.ts + server/routers.ts)
- [x] Fix logout to clear ALL 14 AsyncStorage keys (not just 6)
- [x] Fix handleDeleteBusiness to clear ALL AsyncStorage keys
- [x] Improve DB failure logging in store bootstrap and syncToDb

## Home Page UI & Build Fixes
- [x] Fix @expo-google-fonts/inter build error - remove package, use system fonts
- [x] Fix KPI card grid alignment (equal height, proper 2-col grid on all screen sizes)
- [x] Add modern weekly revenue/appointments bar chart to home page
- [x] Add upcoming appointments section at bottom of home page (max 10, sorted by date/time)
- [x] Responsive layout audit: tablets and phones across all tab screens

## KPI Card Redesign & Detail Sheets
- [x] Redesign KPI cards: embedded sparkline charts, decorative circles, scale press animation, premium typography
- [x] Revenue KPI detail sheet: monthly bar chart + daily line chart + service breakdown
- [x] Appointments KPI detail sheet: daily bar chart + status breakdown + by-service breakdown
- [x] Clients KPI detail sheet: top clients ranked by visits + total spent
- [x] Top Service KPI detail sheet: all services ranked with horizontal progress bars
- [x] Wire detail sheets to KPI card onPress (open bottom sheet instead of navigating away)

## KPI Card & Home Page Polish
- [x] Remove "Details ›" text from KPI card bottom-right corner
- [x] Add count-up animation on KPI values when home screen mounts
- [x] Add Download Report button to each KPI detail sheet (PDF export)
- [x] Fix phone number formatting in appointment detail: (123) 456-7890 or +1 (123) 456-7890
- [x] Fix location in appointment detail: show full address (street, city, state, zip)
- [x] Redesign upcoming appointments section to match screenshot (colored left border, time block, service/client/staff, status badge, price)

## Upcoming Appointments Card Redesign (v2)
- [x] Redesign upcoming cards: colored left border, date·time range top line, service+duration, client·phone, staff dot, status badge, price

## Phone Number Formatting Fix
- [ ] Add formatPhone utility to lib/utils.ts
- [ ] Apply formatPhone in home page upcoming cards
- [ ] Apply formatPhone in calendar appointment list (all tabs)
- [ ] Apply formatPhone in appointment detail screen

## Push Notifications & Email Deep-Link Routing (Apr 13, 2026)
- [x] Add expoPushToken column to businessOwners DB schema + migration
- [x] Add expoPushToken to business.update tRPC router
- [x] Create server/push.ts with Expo Push API integration (notifyNewBooking, notifyCancellation, notifyReschedule, notifyWaitlist)
- [x] Update publicRoutes.ts: use Expo push for all 4 notification events (new booking, cancel, reschedule, waitlist) with Manus notifyOwner fallback
- [x] Update use-notifications.ts: register Expo push token on device, save to server via tRPC
- [x] Add expo-device package for physical device detection
- [x] Add expo-notifications plugin to app.config.ts with Android channel config
- [x] Create notification-icon.png for Android notification tray
- [x] Deep-link routing: appointment_request/rescheduled → Calendar Requests tab; appointment_cancelled → Calendar Cancelled tab; appointment_reminder → appointment detail; waitlist → Calendar Requests tab
- [x] Set RESEND_API_KEY environment variable for email sending from noreply@lime-of-time.com

## New Features & Fixes (Apr 13, 2026 - Session 2)
- [x] Fix expo-linear-gradient missing dependency (install package + add to app.config.ts plugins)
- [x] Add client confirmation email when business owner accepts appointment
- [x] Build notification preferences screen in Settings (toggle push/email per event type)

## iOS Crash Fix (Apr 13, 2026 - Session 3)
- [x] Fix iOS crash: Object.fromEntries(response.headers.entries()) crashes on iOS 26 / iPhone 16 Pro Max (Hermes SIGSEGV in objectFromEntries)

## Production Quality & Crash Reporting (Apr 13, 2026 - Session 4)
- [x] Create dev-only logger utility (lib/logger.ts) — replaces console.log with no-ops in production
- [x] Clean up all debug console.log calls in lib/_core/api.ts
- [x] Clean up debug console.log calls in other core lib files (auth.ts, store.tsx, trpc.ts)
- [x] Install and configure @sentry/react-native for automatic crash reporting
- [x] Wire Sentry into app _layout.tsx as error boundary
- [x] Add SENTRY_DSN environment variable (EXPO_PUBLIC_SENTRY_DSN — user must set from Sentry dashboard)

## EAS Build Fix (Apr 13, 2026 - Session 5)
- [x] Fix EAS iOS build failure: sentry-cli requires auth token for source map upload — add SENTRY_ALLOW_FAILURE=true to eas.json so build succeeds without a Sentry account configured

## Settings Tab Crash Fix (Apr 13, 2026 - Session 6)
- [x] Fix crash: settings.notificationPreferences undefined for existing users — add safe fallback merge with DEFAULT_NOTIFICATION_PREFERENCES in store and settings screen

## Multi-Bug Fix (Apr 13, 2026 - Session 7)
- [x] Investigate and fix APK build failure (removed Sentry Expo plugin that blocked Android Gradle build)
- [x] Fix SMS phone number format (showing raw digits instead of formatted e.g. (412) 555-0001)
- [x] Restore SMS pre-fill with appointment details after clicking Confirm Booking (was already present and working)
- [x] Fix Business Profile text inputs losing focus/keyboard dismissing after first character typed (moved Field component outside screen function)

## Session 8 (Apr 13, 2026)
- [x] Fix share link on Home page broken on TestFlight (Share API correct; issue is lime-of-time.com domain not deployed yet)
- [x] Fix client phone number display format in Clients list (raw digits → formatted)
- [x] Replace static splash screen with creative animated splash (AnimatedSplash with Reanimated)
- [x] Add country code picker (+1 US, +44 UK, all countries) to login phone input
- [x] Add static OTP verification screen (code: 123456) for all users after phone entry
- [x] Fix Rate Exceeded errors across the app (throttledNotifyOwner with 60s cooldown)

## Session 9 (Apr 13, 2026)
- [ ] Fix login page: show dial code number (+1) next to flag in country code picker
- [ ] Fix calendar timeline: appointments overlapping when multiple locations exist
- [ ] Add location filter to calendar timeline view

## Phase: Current Sprint

- [ ] OTP screen: show inline error message when incorrect code entered
- [ ] OTP screen: ensure Resend Code link is always visible after countdown
- [ ] Calendar: remove "All" from location filter chips; default to first location
- [ ] Settings → Schedule Hours: add per-location selector so each location has individual business hours
- [ ] Social login: add Google / Apple / Microsoft sign-in buttons on login page
- [ ] Social login: collect phone number from new social-login users on first sign-in

## Bug Fixes & Feature Requests (Apr 13 2026)

- [ ] Fix calendar tab showing wrong day of week (Apr 13 2026 shows Wednesday instead of Monday)
- [ ] Add custom buffer time option (free-text minutes input alongside preset chips)
- [ ] Set cancellation fee disabled by default, add helper text explaining it
- [ ] Fix Active Until toggle — cannot switch it back off after turning on
- [ ] Change workday minute picker steps from 0/15/30/45 to 0/5/10/15/20/25/30/35/40/45/50/55
- [ ] Build Notifications management page under Settings (manage message content, toggle per notification type)
- [ ] Fix OTP input showing raw digits instead of styled OTP boxes
- [ ] Fix Apple sign-in button showing wrong/missing icon
- [ ] Fix phone number input placeholder showing (000) 000-0000 style
- [ ] Fix Get Started button appearing greyed out on Business Information screen
- [ ] Fix splash screen not showing on TestFlight builds (app.config.ts)

## Phase: Location/Address Bug Fixes

- [x] Fix onboarding: await syncToDb for first location so it saves to DB before navigating away
- [x] Fix onboarding: save city/state/zip to BusinessProfile for SMS fallback
- [x] Fix share link: handle case where location not yet in DB (use slug-only fallback)
- [x] Fix SMS messages: use full address (city, state, zip) from location, not just street
- [x] Fix clients page: ensure location address displays correctly

## Phase: Location Edit & Public Booking Page Improvements

- [x] Verify location edit flow updates store correctly (address, city, state, zip reflected in share links)
- [x] Fix location edit: ensure UPDATE_LOCATION action syncs city/state/zip to DB
- [x] Public booking page: pre-select location from ?location= URL param
- [x] Public booking page: show full address (street + city + state + zip) prominently when location is pre-selected
## Phase: Calendar & SMS Manager (Apr 13 2026)
- [x] Fix public booking page calendar: apiWeeklyDays not stored from loadWorkingDays response — calendar shows all days greyed out
- [x] Add SMS Message Manager screen under Settings (editable templates per event type, locked Lime Of Time footer)
- [x] Wire custom SMS templates into appointment-detail.tsx and client-detail.tsx message generators
- [x] Add followUp template type to SmsTemplates interface and DEFAULT_SMS_TEMPLATES
- [x] Fix client booking page calendar sync with business calendar (slots not reflecting actual availability)
- [x] Add onboarding intro/welcome screen before Business Information tab
- [x] Pre-fill location phone from business phone when creating first location
- [x] Prompt address fields when creating first location (address no longer collected in onboarding)
- [x] Add validation error messages to staff creation form for required fields
- [x] Add error message popups throughout the client detail page
- [x] Fix email sender to no-reply@lime-of-time.com
- [x] Add location-specific business hours section inside Location edit page
- [x] Update booking confirmation SMS template to include full address
- [x] Add QR code generation per location in Location edit page

## Phase: Booking Link Fix & UI Modernization (Apr 14 2026)
- [ ] Fix shared booking link URL format - single location and multi-location
- [x] Redesign splash screen - modern, works on all iOS/Android sizes
- [x] Redesign login page - modern UI with animations
- [x] Redesign OTP page - 6 individual input boxes with forward/backward fill animation
- [x] Redesign onboarding Business Information page - modern UI
- [x] Add connected animations between login → OTP → onboarding screens
- [ ] Add phone widgets - calendar widget and upcoming/requested/cancelled appointments
- [x] Add Save QR to Photos button in QR code modal
- [x] Add Business Hours section when creating a new location (Add Location page)

## Phase: UI Modernization & Widgets (Apr 14 2026)
- [x] Redesign splash screen - modern, works on all iOS/Android sizes
- [x] Redesign login page - modern UI with smooth animations
- [x] Redesign OTP page - 6 individual input boxes, fills L→R, deletes R→L, connected animations
- [x] Modernize onboarding Business Information page with connected animations
- [x] Add Save QR to Photos button in QR code modal
- [x] Add Business Hours section when creating a new location (Add Location page)
- [ ] Add phone widgets - calendar widget and upcoming/requested/cancelled appointments widget

## Phase: Onboarding Slide Transitions (Apr 14 2026)
- [x] Add slide-left/slide-right animated transitions between onboarding steps (Step 1 → 2 → 3)

## Phase: Splash/Tour/OTP Improvements (Apr 14 2026)
- [ ] Make Business Phone a required field on onboarding Business Information step
- [ ] Add haptic feedback on each OTP box fill and delete
- [ ] Improve splash screen layout, vertical centering, and animated transition into login page
- [ ] Build modern guided first-launch tour with rich step-by-step Settings walkthrough popups
- [x] App icon badge count — set iOS/Android home screen badge to number of upcoming appointments today
- [x] Settings tab badge — show red dot badge on Settings tab when push notification permission is denied
- [x] Fix: cannot delete client — investigate and fix deletion bug
- [x] Fix: reviews from deleted clients must be preserved (not cascade-deleted)
- [x] Fix: Schedule & Hours screen in Settings throws error — investigate and fix crash
- [x] Fix: Delete Client button taps do nothing — deep debug required
- [x] Fix: email sender shows 'Manus Team' — change to 'Lime Of Time' with no-reply@lime-of-time.com
- [ ] Fix: Splash screen is static (no animation) and cuts abruptly to dashboard — add logo pulse/scale animation and fade transition
- [ ] Audit: Workday logic across the app and client page — verify correct behavior everywhere
- [ ] All Locations calendar: show union of all location slots (not just first/active location)
- [ ] All Locations calendar: show per-slot location count badge (e.g. "3 locations available")
- [ ] Booking flow: auto-assign correct location when slot selected in All Locations mode
- [ ] Multi-location availability: consistent across calendar, new-booking, staff-calendar screens
- [x] Configurable slot step interval in Settings (5/10/15/30 min picker)
- [x] Refresh availability button on booking time slot grid (new-booking + booking screens)
- [x] Workday "Repeat next week" quick-copy button in calendar Workday panel
- [ ] Fix clients page scroll (list not scrollable)
- [ ] Remove center number from "By Service" donut chart on home page
- [ ] Seed DB: ~6000 past appointments (last 6 months) + 200 upcoming appointments
- [ ] Seed DB: 200 more clients
- [ ] Seed DB: 50 more services with different categories
- [ ] Seed DB: 100 products with different brand names
- [ ] Seed DB: add discounts and gift cards so Quick Actions shows non-zero counts
- [x] Before/After Photo Gallery per client: ClientPhoto type, clientPhotos state, Photos tab in client detail
- [x] Birthday Campaigns screen: filter today/upcoming/all, send SMS with discount code
- [x] Birthday cake button in Clients tab header → Birthday Campaigns screen
- [x] Online Booking: staff picker step added (service → staff → datetime)
- [x] Staff selection saved to appointment.staffId, shown in booking summary confirm step
- [x] Calendar Sync (.ics export): confirmed present in Staff Calendar screen
- [x] GitHub dev branch pushed with all new features
