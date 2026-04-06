# BookEase — Mobile App Interface Design

## App Concept

BookEase is a premium appointment scheduling app for small businesses. It combines the simplicity of Calendly, the deep customization of Acuity Scheduling, and the client-centric approach of Square Appointments into a single, beautifully crafted mobile experience.

## Screen List

| Screen | Tab | Description |
|--------|-----|-------------|
| Dashboard (Home) | Home | Today's overview: upcoming appointments, quick stats, quick-add button |
| Calendar | Calendar | Full month/week/day calendar view with color-coded appointments |
| Clients | Clients | Searchable client directory with contact info and history |
| Client Detail | — | Individual client profile, visit history, notes |
| Services | Services | List of offered services with duration, price, color |
| Add/Edit Service | — | Form to create or modify a service |
| New Booking | — | 3-step booking flow: select service → select client → pick date/time |
| Appointment Detail | — | Full appointment info with edit, cancel, and reschedule actions |
| Settings | Settings | Business profile, working hours, notification preferences |

## Primary Content and Functionality

### Dashboard (Home Tab)
- Greeting with business name and date
- "Today's Appointments" count card
- "This Week" stats card (total bookings, revenue)
- Scrollable list of today's upcoming appointments (time, client name, service, status pill)
- Floating action button (FAB) to create new booking

### Calendar Tab
- Month view with dots indicating days with appointments
- Tapping a day shows that day's appointments in a list below
- Color-coded by service type
- Swipe between months

### Clients Tab
- Search bar at top
- Alphabetical FlatList of clients
- Each row: avatar circle (initials), name, phone, last visit date
- Tap to open Client Detail
- "+" button to add new client

### Client Detail Screen
- Header with initials avatar, name, phone, email
- "Upcoming Appointments" section
- "Past Visits" section with service name and date
- Notes text area
- Edit and Delete actions

### Services Tab
- List of services with color indicator, name, duration, price
- Tap to edit
- "+" button to add new service

### Add/Edit Service Screen
- Name input
- Duration picker (15 min increments)
- Price input
- Color picker (preset palette)
- Save / Delete buttons

### New Booking Flow (Modal)
- Step 1: Select Service (list of services)
- Step 2: Select or Create Client (search + quick add)
- Step 3: Pick Date & Time (calendar + time slots based on working hours)
- Confirmation summary before saving

### Appointment Detail Screen
- Service name and color
- Client name and contact
- Date, time, duration
- Status (Confirmed, Completed, Cancelled)
- Action buttons: Mark Complete, Cancel, Reschedule
- Notes field

### Settings Screen
- Business Name
- Working Hours (per day toggles and time ranges)
- Default appointment duration
- Notification preferences toggle

## Key User Flows

### Flow 1: Quick Book an Appointment
Home → FAB "+" → Select Service → Select Client → Pick Date/Time → Confirm → Returns to Home with new appointment visible

### Flow 2: View and Manage Today's Schedule
Home → See today's list → Tap appointment → View Detail → Mark Complete or Cancel

### Flow 3: Add a New Client
Clients Tab → "+" → Fill name, phone, email → Save → Client appears in list

### Flow 4: Manage Services
Services Tab → "+" → Fill service details → Save → Service appears in list

### Flow 5: Browse Calendar
Calendar Tab → Swipe to month → Tap day → See day's appointments → Tap appointment → Detail

## Color Choices

| Token | Light | Dark | Purpose |
|-------|-------|------|---------|
| primary | #2563EB | #3B82F6 | Main accent — professional blue |
| background | #FFFFFF | #0F172A | Screen backgrounds |
| surface | #F8FAFC | #1E293B | Cards, elevated surfaces |
| foreground | #0F172A | #F1F5F9 | Primary text |
| muted | #64748B | #94A3B8 | Secondary text |
| border | #E2E8F0 | #334155 | Dividers, borders |
| success | #16A34A | #4ADE80 | Completed status |
| warning | #D97706 | #FBBF24 | Pending/upcoming status |
| error | #DC2626 | #F87171 | Cancelled, errors |

### Service Color Palette (for color-coding services)
- #2563EB (Blue), #7C3AED (Purple), #DB2777 (Pink), #EA580C (Orange), #16A34A (Green), #0891B2 (Teal)
