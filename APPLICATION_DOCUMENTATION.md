# Manus Scheduler - Complete Application Documentation

**Application Name:** Lime Of Time  
**Version:** 1.0.0  
**Platform:** React Native (Expo SDK 54) + Express.js Backend  
**Database:** PostgreSQL with Drizzle ORM  
**Deployment:** Manus Platform (manussched-dw4mhfnu.manus.space)

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Architecture Overview](#architecture-overview)
3. [Mobile Application](#mobile-application)
4. [Backend Server](#backend-server)
5. [Database Schema](#database-schema)
6. [Authentication & Authorization](#authentication--authorization)
7. [Features & Functionality](#features--functionality)
8. [API Documentation](#api-documentation)
9. [Admin Dashboard](#admin-dashboard)
10. [Deployment & Infrastructure](#deployment--infrastructure)

---

## Executive Summary

**Lime Of Time** is a comprehensive appointment scheduling and business management platform designed for service-based businesses (salons, spas, fitness centers, consulting firms, etc.). The application enables business owners to manage their schedule, clients, services, staff, and locations while providing clients with a seamless booking experience through a public web interface.

### Key Capabilities

- **Mobile App:** React Native application for iOS, Android, and Web
- **Business Management:** Dashboard with analytics, client management, staff scheduling
- **Appointment Scheduling:** Calendar-based scheduling with conflict prevention
- **Client Portal:** Public web booking page with real-time availability
- **Notifications:** Push notifications and SMS alerts for appointments
- **Admin Dashboard:** Comprehensive management interface for system administrators
- **Multi-Location Support:** Manage multiple business locations with location-specific scheduling
- **Advanced Features:** Discounts, gift cards, reviews, products, working hours customization

---

## Architecture Overview

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     Client Layer                                 │
├─────────────────────────────────────────────────────────────────┤
│  Mobile App (React Native)    │    Web Booking Page (HTML/JS)    │
│  - iOS/Android/Web            │    - Public client booking       │
│  - Expo Router navigation     │    - Gift card redemption        │
│  - NativeWind (Tailwind CSS)  │    - Review submission          │
└─────────────────────────────────────────────────────────────────┘
                                  ↓
┌─────────────────────────────────────────────────────────────────┐
│                     API Layer (tRPC + REST)                      │
├─────────────────────────────────────────────────────────────────┤
│  Express.js Server (Port 3000)                                   │
│  - tRPC routes for authenticated business owners                 │
│  - REST endpoints for public booking/review/gift pages           │
│  - Admin authentication and management routes                    │
└─────────────────────────────────────────────────────────────────┘
                                  ↓
┌─────────────────────────────────────────────────────────────────┐
│                     Data Layer                                    │
├─────────────────────────────────────────────────────────────────┤
│  PostgreSQL Database with Drizzle ORM                            │
│  - Business owner accounts and profiles                          │
│  - Clients, appointments, services, staff, locations             │
│  - Discounts, gift cards, reviews, products                      │
│  - Working hours, notifications, audit logs                      │
└─────────────────────────────────────────────────────────────────┘
```

### Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | React Native 0.81 | Cross-platform mobile app |
| | Expo SDK 54 | Development and deployment framework |
| | Expo Router 6 | Navigation and routing |
| | NativeWind 4 | Tailwind CSS for React Native |
| | React 19 | UI component framework |
| | TanStack Query | Server state management |
| | React Context | Client state management |
| **Backend** | Express.js | REST API server |
| | tRPC 11.7.2 | Type-safe RPC framework |
| | Node.js | JavaScript runtime |
| **Database** | PostgreSQL | Relational database |
| | Drizzle ORM | Type-safe ORM |
| **Authentication** | OAuth 2.0 | Business owner login |
| | Face ID / Biometrics | Mobile app authentication |
| | Session tokens | API authentication |
| **Notifications** | Expo Notifications | Push notifications |
| | Twilio SMS API | SMS messaging (configured by user) |
| **Deployment** | Manus Platform | Managed hosting and deployment |

---

## Mobile Application

### Project Structure

```
app/
├── _layout.tsx                 # Root layout with providers
├── (tabs)/
│   ├── _layout.tsx            # Tab bar configuration
│   ├── index.tsx              # Dashboard/Home screen
│   ├── calendar.tsx           # Calendar view with appointments
│   ├── clients.tsx            # Clients list and management
│   └── settings.tsx           # Business settings and profile
├── appointment-detail.tsx      # Appointment details and actions
├── new-booking.tsx            # 4-step booking flow for clients
├── client-detail.tsx          # Individual client profile
├── services.tsx               # Services list and management
├── add-service.tsx            # Add/edit service form
├── discounts.tsx              # Discount management
├── gift-cards.tsx             # Gift card management
├── locations.tsx              # Location management
├── staff.tsx                  # Staff member management
├── booking-policies.tsx       # Cancellation policies
├── book/[slug].tsx            # Public booking page route
├── review/[slug].tsx          # Public review page route
├── gift/[code].tsx            # Gift card redemption route
└── oauth/                     # OAuth callback handler

components/
├── screen-container.tsx       # SafeArea wrapper for all screens
├── themed-view.tsx            # Theme-aware view component
├── ui/
│   ├── icon-symbol.tsx        # Icon mapping (SF Symbols → Material Icons)
│   └── [other UI components]

hooks/
├── use-auth.ts                # Authentication state hook
├── use-colors.ts              # Theme colors hook
├── use-color-scheme.ts        # Dark/light mode detection
├── use-notifications.ts       # Notification scheduling and handling

lib/
├── store.tsx                  # Global state management (React Context)
├── types.ts                   # TypeScript types and interfaces
├── utils.ts                   # Utility functions (cn, formatting)
├── notification-provider.tsx  # Notification setup and listeners
├── trpc.ts                    # tRPC client configuration
├── theme-provider.tsx         # Theme context provider

constants/
├── theme.ts                   # Runtime theme colors

assets/
├── images/
│   ├── icon.png              # App icon (1024x1024)
│   ├── splash-icon.png       # Splash screen icon
│   ├── favicon.png           # Web favicon
│   └── android-icon-*.png    # Android adaptive icons
```

### Key Screens

#### 1. Dashboard/Home Screen (`app/(tabs)/index.tsx`)
- **Purpose:** Business owner's main entry point
- **Features:**
  - Today's appointments list with status indicators
  - Analytics cards: Total Clients, Total Appointments, Total Revenue, Top Service
  - Quick action buttons: New Booking, Send Booking Link, View Calendar
  - Business name and logo display
  - Theme mode toggle
- **Data:** Fetches appointments for today, calculates stats from store

#### 2. Calendar Screen (`app/(tabs)/calendar.tsx`)
- **Purpose:** View and manage appointments by date
- **Features:**
  - Month view calendar with colored status dots
  - Day view with appointment list
  - Filter buttons: Upcoming, Requests, Cancelled, Completed
  - Location filter (if multiple locations)
  - Tap appointment to view details
  - Unselectable dates for non-working days
- **Data:** Fetches all appointments, filters by status and location

#### 3. Clients Screen (`app/(tabs)/clients.tsx`)
- **Purpose:** Manage client database
- **Features:**
  - Searchable client list
  - Client contact information
  - Appointment history per client
  - Contact import from device contacts
  - Tap to view client details
- **Data:** Fetches all clients, searches by name/phone

#### 4. Settings Screen (`app/(tabs)/settings.tsx`)
- **Purpose:** Business configuration and profile management
- **Features:**
  - Business profile (name, phone, email, address, description)
  - Working hours configuration (per day, custom hours)
  - Staff management
  - Cancellation policy settings
  - Temporary closed toggle
  - Theme mode toggle
  - Logout button
  - Delete business button
- **Data:** Fetches and updates business settings, staff, working hours

#### 5. Appointment Detail Screen (`app/appointment-detail.tsx`)
- **Purpose:** View and manage individual appointments
- **Features:**
  - Client information
  - Service details
  - Date and time
  - Appointment status
  - Notes and special requests
  - Accept/Reject buttons (for pending requests)
  - Reschedule option
  - Cancel appointment
  - Send SMS reminder
  - Auto-generated SMS message with appointment details
- **Data:** Fetches appointment by ID, client info, service info

#### 6. New Booking Flow (`app/new-booking.tsx`)
- **Purpose:** 4-step process for business owner to manually create appointments
- **Steps:**
  1. Select or create client (name, phone, email)
  2. Select service
  3. Select date and time
  4. Confirm and send SMS to client
- **Features:**
  - Time validation (prevent past times)
  - Conflict detection (prevent double-booking)
  - Auto-calculated end time based on service duration
  - SMS sending with appointment details
- **Data:** Creates appointment in store and syncs to DB

#### 7. Public Booking Page (`app/book/[slug].tsx`)
- **Purpose:** Client-facing booking interface
- **Features:**
  - Business information display
  - Service selection
  - Date and time picker (only available times)
  - Client information form
  - Booking confirmation
  - SMS notification to business owner
- **Data:** Fetches business info, services, available time slots

#### 8. Client Detail Screen (`app/client-detail.tsx`)
- **Purpose:** View individual client profile
- **Features:**
  - Client contact information
  - Appointment history
  - Notes and special requests
  - Send SMS message
  - Edit client information
  - Delete client
- **Data:** Fetches client by ID, associated appointments

### State Management

**Store Architecture** (`lib/store.tsx`)

The application uses React Context + `useReducer` for global state management:

```typescript
interface AppState {
  // Business owner data
  businessOwner: BusinessOwner | null;
  businessName: string;
  businessPhone: string;
  businessEmail: string;
  businessAddress: string;
  businessDescription: string;
  customSlug: string;
  logoUrl: string;
  
  // Collections
  services: Service[];
  clients: Client[];
  appointments: Appointment[];
  staffMembers: Staff[];
  locations: Location[];
  discounts: Discount[];
  giftCards: GiftCard[];
  reviews: Review[];
  products: Product[];
  
  // Settings
  settings: BusinessSettings;
  workingHours: WorkingHours;
  
  // UI state
  isLoading: boolean;
  error: string | null;
}
```

**Key Actions:**
- `SET_BUSINESS_OWNER` - Set authenticated business owner
- `ADD_APPOINTMENT` - Create new appointment
- `UPDATE_APPOINTMENT` - Modify appointment
- `DELETE_APPOINTMENT` - Remove appointment
- `ADD_CLIENT` - Create new client
- `UPDATE_CLIENT` - Modify client
- `DELETE_CLIENT` - Remove client
- `ADD_SERVICE` - Create new service
- `UPDATE_SERVICE` - Modify service
- `DELETE_SERVICE` - Remove service
- `SYNC_TO_DB` - Persist changes to database

### Styling System

**Theme Configuration** (`theme.config.js`)

```javascript
const themeColors = {
  primary: { light: '#0a7ea4', dark: '#0a7ea4' },
  background: { light: '#ffffff', dark: '#151718' },
  surface: { light: '#f5f5f5', dark: '#1e2022' },
  foreground: { light: '#11181C', dark: '#ECEDEE' },
  muted: { light: '#687076', dark: '#9BA1A6' },
  border: { light: '#E5E7EB', dark: '#334155' },
  success: { light: '#22C55E', dark: '#4ADE80' },
  warning: { light: '#F59E0B', dark: '#FBBF24' },
  error: { light: '#EF4444', dark: '#F87171' },
};
```

**NativeWind Integration:**
- Tailwind CSS for React Native
- CSS variables for theme colors
- Dark mode support via `data-theme` attribute
- Runtime color access via `useColors()` hook

### Notifications System

**Push Notifications** (`lib/notification-provider.tsx`)

The app uses Expo Notifications with the following flow:

1. **Request Permissions:** Ask user for notification permissions on app launch
2. **Register for Push:** Get push token and register with backend
3. **Receive Notifications:** Listen for incoming push notifications
4. **Handle Tap:** Navigate to relevant screen when notification is tapped
5. **Local Reminders:** Schedule local notifications for upcoming appointments

**Notification Types:**

| Type | Trigger | Title | Action |
|------|---------|-------|--------|
| New Booking Request | Client books online | "[Business] — New Booking Request" | Navigate to appointment detail |
| Appointment Confirmed | Business accepts request | "[Business] — Appointment Confirmed" | Navigate to appointment detail |
| Appointment Cancelled | Appointment cancelled | "[Business] — Appointment Cancelled" | Navigate to appointment detail |
| Appointment Rescheduled | Appointment rescheduled | "[Business] — Appointment Rescheduled" | Navigate to appointment detail |
| 30-min Reminder | 30 min before appointment | "[Business] — Appointment in 30 minutes" | Navigate to appointment detail |
| 1-hour Reminder | 1 hour before appointment | "[Business] — Appointment in 1 hour" | Navigate to appointment detail |
| Waitlist Available | Slot opens up | "[Business] — Waitlist Slot Available" | Navigate to calendar |

**SMS Notifications:**

When business owner confirms a booking, an SMS is sent to client with:
- Business name
- Service name and duration
- Date and time
- Business address (with map link)
- Cancellation policy
- Review link

---

## Backend Server

### Server Structure

```
server/
├── _core/
│   ├── index.ts               # Express app setup and route registration
│   ├── notification.ts        # Notification service
│   └── db.ts                  # Database connection and utilities
├── publicRoutes.ts            # Public booking/review/gift pages
├── adminRoutes.ts             # Admin dashboard routes
├── adminAuth.ts               # Admin authentication middleware
├── db.ts                      # Database queries and mutations
├── schema.ts                  # Drizzle ORM schema definitions
└── [other route files]
```

### Express Server Configuration

**Port:** 3000  
**Environment:** Development (hot reload) / Production (compiled)

**Middleware:**
- Express JSON parser
- CORS configuration
- Session management
- Admin authentication

**Routes:**
- `/api/trpc/*` - tRPC endpoints (authenticated)
- `/api/admin/*` - Admin dashboard (admin-auth protected)
- `/api/public/*` - Public API (public booking data)
- `/api/book/:slug` - Public booking page
- `/api/review/:slug` - Public review page
- `/api/gift/:code` - Gift card redemption page
- `/api/manage/:appointmentId/:clientId` - Appointment management page

### tRPC API Routes

**Authentication:**
- All tRPC routes require valid session token
- Session tokens issued after OAuth login
- Tokens validated on each request

**Main Routers:**

| Router | Methods | Purpose |
|--------|---------|---------|
| `businessOwner` | `getProfile`, `updateProfile`, `deleteAccount` | Business owner management |
| `services` | `list`, `create`, `update`, `delete` | Service CRUD operations |
| `clients` | `list`, `create`, `update`, `delete`, `search` | Client CRUD operations |
| `appointments` | `list`, `create`, `update`, `delete`, `getAvailable` | Appointment CRUD and availability |
| `staff` | `list`, `create`, `update`, `delete` | Staff member management |
| `locations` | `list`, `create`, `update`, `delete` | Location management |
| `discounts` | `list`, `create`, `update`, `delete` | Discount management |
| `giftCards` | `list`, `create`, `update`, `redeem` | Gift card management |
| `reviews` | `list`, `create`, `delete` | Review management |
| `products` | `list`, `create`, `update`, `delete` | Product management |
| `settings` | `get`, `update` | Business settings |
| `workingHours` | `get`, `update` | Working hours configuration |

### Public API Endpoints

**Booking Data:**
- `GET /api/public/business/:slug` - Get business info by slug
- `GET /api/public/services/:businessId` - Get services for business
- `GET /api/public/availability/:businessId/:date` - Get available time slots
- `POST /api/public/book` - Submit booking request

**Reviews:**
- `GET /api/public/reviews/:businessId` - Get business reviews
- `POST /api/public/reviews` - Submit review

**Gift Cards:**
- `GET /api/public/giftcard/:code` - Validate gift card
- `POST /api/public/giftcard/redeem` - Redeem gift card

### Database Connection

**Configuration:**
- PostgreSQL database hosted on Manus platform
- Connection pooling via node-postgres
- Drizzle ORM for type-safe queries
- Automatic schema migrations

**Connection String Format:**
```
postgresql://username:password@host:port/database
```

---

## Database Schema

### Core Tables

#### businessOwners
```sql
CREATE TABLE businessOwners (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  businessName TEXT NOT NULL,
  address TEXT,
  description TEXT,
  customSlug TEXT UNIQUE,
  logoUrl TEXT,
  createdAt TIMESTAMP DEFAULT NOW(),
  updatedAt TIMESTAMP DEFAULT NOW()
);
```

#### clients
```sql
CREATE TABLE clients (
  id TEXT PRIMARY KEY,
  businessOwnerId TEXT NOT NULL REFERENCES businessOwners(id),
  localId TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  notes TEXT,
  createdAt TIMESTAMP DEFAULT NOW(),
  updatedAt TIMESTAMP DEFAULT NOW(),
  UNIQUE(businessOwnerId, localId)
);
```

#### services
```sql
CREATE TABLE services (
  id TEXT PRIMARY KEY,
  businessOwnerId TEXT NOT NULL REFERENCES businessOwners(id),
  localId TEXT NOT NULL,
  name TEXT NOT NULL,
  duration INTEGER NOT NULL,
  price TEXT NOT NULL,
  color TEXT,
  description TEXT,
  createdAt TIMESTAMP DEFAULT NOW(),
  updatedAt TIMESTAMP DEFAULT NOW(),
  UNIQUE(businessOwnerId, localId)
);
```

#### appointments
```sql
CREATE TABLE appointments (
  id TEXT PRIMARY KEY,
  businessOwnerId TEXT NOT NULL REFERENCES businessOwners(id),
  clientLocalId TEXT NOT NULL,
  clientId TEXT,
  serviceLocalId TEXT NOT NULL,
  date TEXT NOT NULL,
  time TEXT NOT NULL,
  duration INTEGER NOT NULL,
  status TEXT DEFAULT 'pending',
  notes TEXT,
  createdAt TIMESTAMP DEFAULT NOW(),
  updatedAt TIMESTAMP DEFAULT NOW()
);
```

#### staff
```sql
CREATE TABLE staffMembers (
  id TEXT PRIMARY KEY,
  businessOwnerId TEXT NOT NULL REFERENCES businessOwners(id),
  localId TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  color TEXT,
  serviceIds TEXT DEFAULT '[]',
  workingHours TEXT DEFAULT '{}',
  createdAt TIMESTAMP DEFAULT NOW(),
  updatedAt TIMESTAMP DEFAULT NOW(),
  UNIQUE(businessOwnerId, localId)
);
```

#### locations
```sql
CREATE TABLE locations (
  id TEXT PRIMARY KEY,
  businessOwnerId TEXT NOT NULL REFERENCES businessOwners(id),
  localId TEXT NOT NULL,
  name TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  email TEXT,
  isActive BOOLEAN DEFAULT true,
  createdAt TIMESTAMP DEFAULT NOW(),
  updatedAt TIMESTAMP DEFAULT NOW(),
  UNIQUE(businessOwnerId, localId)
);
```

#### discounts
```sql
CREATE TABLE discounts (
  id TEXT PRIMARY KEY,
  businessOwnerId TEXT NOT NULL REFERENCES businessOwners(id),
  localId TEXT NOT NULL,
  name TEXT,
  type TEXT,
  value TEXT,
  code TEXT,
  startDate TEXT,
  endDate TEXT,
  isActive BOOLEAN DEFAULT true,
  createdAt TIMESTAMP DEFAULT NOW(),
  updatedAt TIMESTAMP DEFAULT NOW(),
  UNIQUE(businessOwnerId, localId)
);
```

#### giftCards
```sql
CREATE TABLE giftCards (
  id TEXT PRIMARY KEY,
  businessOwnerId TEXT NOT NULL REFERENCES businessOwners(id),
  code TEXT UNIQUE NOT NULL,
  amount TEXT NOT NULL,
  balance TEXT NOT NULL,
  createdAt TIMESTAMP DEFAULT NOW(),
  updatedAt TIMESTAMP DEFAULT NOW()
);
```

#### reviews
```sql
CREATE TABLE reviews (
  id TEXT PRIMARY KEY,
  businessOwnerId TEXT NOT NULL REFERENCES businessOwners(id),
  clientLocalId TEXT,
  clientName TEXT,
  rating INTEGER,
  comment TEXT,
  createdAt TIMESTAMP DEFAULT NOW(),
  updatedAt TIMESTAMP DEFAULT NOW()
);
```

#### products
```sql
CREATE TABLE products (
  id TEXT PRIMARY KEY,
  businessOwnerId TEXT NOT NULL REFERENCES businessOwners(id),
  localId TEXT NOT NULL,
  name TEXT NOT NULL,
  price TEXT NOT NULL,
  stock INTEGER,
  description TEXT,
  createdAt TIMESTAMP DEFAULT NOW(),
  updatedAt TIMESTAMP DEFAULT NOW(),
  UNIQUE(businessOwnerId, localId)
);
```

#### workingHours
```sql
CREATE TABLE workingHours (
  id TEXT PRIMARY KEY,
  businessOwnerId TEXT NOT NULL REFERENCES businessOwners(id),
  dayOfWeek TEXT,
  startTime TEXT,
  endTime TEXT,
  isEnabled BOOLEAN DEFAULT true,
  customDates TEXT DEFAULT '{}',
  createdAt TIMESTAMP DEFAULT NOW(),
  updatedAt TIMESTAMP DEFAULT NOW()
);
```

---

## Authentication & Authorization

### Business Owner Authentication

**Flow:**
1. User opens app for first time
2. Presented with onboarding/sign-up screen
3. User enters phone number
4. OAuth login (via Manus platform)
5. Session token issued and stored in secure storage
6. Token validated on each API request

**Session Management:**
- Tokens stored in `expo-secure-store`
- Tokens expire after 24 hours
- Refresh token mechanism for extended sessions
- Logout clears stored token and resets app state

### Face ID / Biometric Authentication

**Mobile App:**
- Optional Face ID setup during onboarding
- Biometric authentication on app reopen
- Falls back to manual login if biometric fails
- Configurable timeout for re-authentication

**Implementation:**
- Uses `expo-local-authentication` for biometric access
- Stores encrypted session token in secure storage
- Validates biometric on app foreground event

### Admin Authentication

**Admin Dashboard:**
- Separate admin login (username/password)
- Session stored in HTTP-only cookie
- Admin routes protected by middleware
- Admin actions logged for audit trail

**Protected Routes:**
- All delete operations require admin auth
- Business management requires admin auth
- User management requires admin auth

---

## Features & Functionality

### 1. Appointment Management

**Create Appointment:**
- Business owner manually creates appointment
- Or client books via public web page
- Automatic conflict detection
- SMS sent to client with details

**View Appointments:**
- Calendar view (month/day)
- List view (upcoming, requests, cancelled, completed)
- Filter by location and status
- Color-coded status indicators

**Modify Appointment:**
- Reschedule to different date/time
- Change service or duration
- Add notes or special requests
- Update client information

**Cancel Appointment:**
- Mark as cancelled
- Calculate cancellation fee if within policy window
- Send SMS notification to client
- Release time slot for other bookings

**Accept/Reject Requests:**
- Business owner reviews pending booking requests
- Accept to confirm appointment
- Reject to decline booking
- Send SMS response to client

### 2. Client Management

**Add Client:**
- Manual entry (name, phone, email)
- Import from device contacts
- Auto-detect duplicate phone numbers
- Link to appointments

**View Client:**
- Client profile with contact info
- Appointment history
- Notes and special requests
- Reviews submitted by client

**Edit Client:**
- Update contact information
- Add/edit notes
- Merge duplicate clients
- Update appointment history

**Delete Client:**
- Remove client from system
- Option to keep appointment history
- Cascade delete related records

### 3. Service Management

**Create Service:**
- Service name, duration, price
- Color indicator for calendar
- Description and details
- Assign to staff members

**Edit Service:**
- Update name, duration, price
- Change color
- Add/remove staff assignments
- Update description

**Delete Service:**
- Remove service from system
- Cascade delete related appointments
- Update client booking options

**Service Variants:**
- Allow multiple same services with different pricing/timing
- Example: "Hair Cut (20 min) - $25" and "Hair Cut (40 min) - $45"

### 4. Staff Management

**Add Staff:**
- Staff name, email, phone
- Color indicator for calendar
- Assign services
- Set working hours

**Edit Staff:**
- Update contact information
- Change assigned services
- Modify working hours
- Update color

**Delete Staff:**
- Remove staff member
- Reassign their appointments
- Update schedule

**Staff Scheduling:**
- Per-staff working hours
- Service-specific assignments
- Location-specific assignments
- Availability calendar

### 5. Location Management

**Add Location:**
- Location name, address, phone, email
- Active/inactive toggle
- Assign staff to locations
- Location-specific services

**Edit Location:**
- Update address and contact info
- Activate/deactivate
- Reassign staff
- Modify services

**Delete Location:**
- Remove location
- Reassign appointments
- Update business profile

**Multi-Location Support:**
- Filter appointments by location
- Location selector on booking page
- Location-specific analytics
- Location-specific staff and services

### 6. Discount System

**Create Discount:**
- Discount name and code
- Type: percentage or fixed amount
- Start and end dates
- Active/inactive toggle

**Apply Discount:**
- Client enters code during booking
- Discount automatically applied
- Reflected in total price
- Stored in appointment record

**Edit/Delete Discount:**
- Update discount details
- Deactivate expired discounts
- Delete unused discounts

**Discount Tracking:**
- View discounts used per appointment
- Analytics on discount usage
- Revenue impact reports

### 7. Gift Card System

**Create Gift Card:**
- Generate unique code
- Set amount (e.g., $50)
- Active/inactive toggle
- Track balance

**Share Gift Card:**
- Send SMS to client with code
- Client receives unique URL
- Shareable via social media

**Redeem Gift Card:**
- Client enters code on booking page
- Validates code and balance
- Applies to booking total
- Updates balance

**Track Gift Cards:**
- View all gift cards
- Track used vs. unused
- Monitor balance
- Generate reports

### 8. Review System

**Submit Review:**
- Client leaves star rating (1-5)
- Optional comment/feedback
- Submitted after appointment
- Linked to appointment

**View Reviews:**
- Business owner sees all reviews
- Displayed on public review page
- Average rating calculation
- Filter by rating

**Manage Reviews:**
- Delete inappropriate reviews
- Respond to reviews (future feature)
- Export reviews for marketing

### 9. Working Hours Configuration

**Set Working Days:**
- Select days business is open
- Set start and end times per day
- Different hours for different days
- Save as default schedule

**Custom Closed Days:**
- Mark specific dates as closed
- Holidays, special events
- Temporary closures
- Override default schedule

**Staff-Specific Hours:**
- Different hours per staff member
- Part-time staff support
- Vacation/time-off management

**Impact on Booking:**
- Only available times shown to clients
- Closed days unselectable
- Automatic conflict prevention

### 10. Notifications & Alerts

**Push Notifications:**
- New booking requests
- Appointment confirmations
- Cancellations and reschedules
- Appointment reminders (30 min, 1 hour)
- Tap notification to navigate to appointment

**SMS Notifications:**
- Sent to client after booking
- Includes appointment details
- Business address with map link
- Cancellation policy
- Review link

**Local Reminders:**
- Scheduled for upcoming appointments
- 30 minutes before
- 1 hour before
- Customizable per business

### 11. Analytics & Reporting

**Dashboard Analytics:**
- Total clients (clickable card)
- Total appointments (clickable card)
- Total revenue (clickable card)
- Top service (clickable card)

**Detailed Reports:**
- Revenue by month/year
- Appointment trends
- Client acquisition
- Service popularity
- Staff performance
- Location performance

**Export Reports:**
- PDF format
- CSV format
- Email delivery
- Tax/year-end reports

### 12. Public Booking Page

**Business Information:**
- Business name and logo
- Address and contact info
- Services with pricing
- Staff availability
- Reviews and ratings

**Booking Process:**
- Select service
- Pick date from calendar
- Select time from available slots
- Enter client information
- Confirm booking
- Receive confirmation SMS

**Gift Card Redemption:**
- Enter gift card code
- Validate and apply
- Discount reflected in total

**Review Submission:**
- Star rating (1-5)
- Comment/feedback
- Submit after appointment

---

## API Documentation

### tRPC Endpoints

All tRPC endpoints are accessed via `/api/trpc/[router].[method]`

**Example:** `POST /api/trpc/appointments.create`

### REST Endpoints

#### Public Booking API

**Get Business Info:**
```
GET /api/public/business/:slug
Response: {
  id, businessName, address, phone, email, description, services[], staff[], locations[]
}
```

**Get Available Slots:**
```
GET /api/public/availability/:businessId/:date
Response: {
  date, availableSlots: [{ time, duration, staffId }]
}
```

**Submit Booking:**
```
POST /api/public/book
Body: {
  businessId, serviceId, date, time, clientName, clientPhone, clientEmail, notes
}
Response: { appointmentId, confirmationMessage }
```

#### Admin API

**Get All Businesses:**
```
GET /api/admin/businesses
Response: [{ id, businessName, clientCount, appointmentCount, revenue }]
```

**Get Business Details:**
```
GET /api/admin/businesses/:id
Response: { ...businessData, clients[], appointments[], services[], staff[], locations[] }
```

**Delete Business:**
```
POST /api/admin/businesses/:id/delete
Response: { success: true }
```

**Delete Record:**
```
POST /api/admin/delete/:type/:id
Types: client, appointment, service, staff, location, discount, giftcard, review, product
Response: { success: true }
```

---

## Admin Dashboard

### Dashboard Structure

**URL:** `https://manussched-dw4mhfnu.manus.space/api/admin`

**Pages:**
- Dashboard (overview, stats)
- Businesses (list, detail, delete)
- Clients (list, search, delete)
- Appointments (list, filter, delete)
- Staff (list, detail, delete)
- Discounts (list, delete)
- Gift Cards (list, delete)
- Reviews (list, delete)
- Products (list, delete)
- Locations (list, delete)
- Database Explorer (raw table data)
- Analytics (charts, trends)

### Admin Features

**Cascade Delete:**
- Delete business removes all related data
- Clients, appointments, services, staff, locations
- Discounts, gift cards, reviews, products
- Working hours and notifications

**Individual Delete:**
- Delete buttons on each table row
- Confirmation dialog before delete
- Audit logging of deletions

**Search & Filter:**
- Search clients by name/phone
- Filter appointments by status
- Filter by business/location

**Analytics:**
- Appointment trends by month
- Business creation trends
- Average rating
- Top services

---

## Deployment & Infrastructure

### Deployment Platform

**Manus Platform:**
- Managed hosting for React Native apps
- Automatic build and deployment
- APK generation for Android
- iOS TestFlight distribution
- Web deployment

**Domain:**
- `manussched-dw4mhfnu.manus.space` (Manus domain)
- Custom domain support (user's own domain)

### Build Configuration

**Expo Configuration** (`app.config.ts`):
```typescript
{
  name: "Lime Of Time",
  slug: "manus-scheduler",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  ios: { bundleIdentifier: "space.manus.manus.scheduler.t..." },
  android: { package: "space.manus.manus.scheduler.t..." },
  plugins: [
    "expo-router",
    "expo-audio",
    "expo-video",
    "expo-splash-screen",
    "expo-build-properties"
  ]
}
```

### Environment Variables

**Required:**
- `DATABASE_URL` - PostgreSQL connection string
- `TWILIO_ACCOUNT_SID` - Twilio SMS API (if using SMS)
- `TWILIO_AUTH_TOKEN` - Twilio authentication
- `EXPO_NOTIFICATION_TOKEN` - Expo push notification token

**Optional:**
- `CUSTOM_DOMAIN` - User's custom domain
- `ADMIN_USERNAME` - Admin dashboard username
- `ADMIN_PASSWORD` - Admin dashboard password

### Testing

**Test Suite:**
- 305+ tests passing
- Unit tests for store, types, utilities
- Integration tests for API routes
- Database schema tests
- Notification system tests

**Test Coverage:**
- Store state management
- tRPC API routes
- Database operations
- Notification scheduling
- SMS message generation
- Booking link generation

### Performance Optimization

**Mobile App:**
- Lazy loading of screens
- Optimized re-renders with React.memo
- Efficient list rendering with FlatList
- Image caching with expo-image
- Code splitting via Expo Router

**Backend:**
- Database query optimization
- Connection pooling
- Caching of frequently accessed data
- Pagination for large datasets

**Frontend State:**
- Context-based state (minimal re-renders)
- TanStack Query for server state
- Debounced search and filters

---

## Known Limitations & Future Enhancements

### Current Limitations

1. **SMS Requires User Setup:** Twilio credentials must be provided by business owner
2. **Single Business Owner:** Each app instance is for one business (not multi-tenant)
3. **No Payment Processing:** Booking is request-based, not payment-based
4. **No Email Notifications:** Only SMS and push notifications

### Planned Enhancements

1. **Payment Integration:** Stripe/PayPal for online payments
2. **Email Notifications:** Email confirmations and reminders
3. **Recurring Appointments:** Support for recurring bookings
4. **Waitlist Management:** Automatic waitlist and slot notifications
5. **Advanced Reporting:** More detailed analytics and exports
6. **Mobile App Features:** Video consultations, file uploads
7. **Integration APIs:** Zapier, Make.com, IFTTT
8. **Multi-Business Support:** Manage multiple businesses from one account

---

## Support & Maintenance

### Reporting Issues

Issues can be reported via the Manus platform support system at https://help.manus.im

### Regular Maintenance

- Database backups (automatic via Manus platform)
- Security updates (automatic)
- Dependency updates (quarterly)
- Performance monitoring (continuous)

### Monitoring

- Error tracking via console logs
- Database query performance
- API response times
- Push notification delivery rates
- SMS delivery status

---

**Document Version:** 1.0  
**Last Updated:** April 10, 2026  
**Maintained By:** Manus Development Team
