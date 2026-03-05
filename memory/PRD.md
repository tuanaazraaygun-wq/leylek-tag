# Leylek TAG - Product Requirements Document

## Original Problem Statement
Ride-sharing application with QR-based trip ending, symmetric rating system, driver activation packages, and intelligent dispatch queue.

## Core Features
1. **QR Trip Ending System** - Personal QR codes for instant trip completion
2. **Symmetric Rating System** - Both driver and passenger rate each other
3. **Driver Activation Packages** - Time-based packages (3, 6, 9, 12, 24 hours)
4. **Driver Dashboard** - Stats panel showing earnings, trips, active time
5. **Dispatch Queue System** - Intelligent driver matching by proximity and rating
6. **Admin Panel** - Comprehensive dashboard for platform management

## Tech Stack
- **Frontend:** React Native (Expo)
- **Backend:** FastAPI + Python Socket.IO
- **Database:** Supabase (PostgreSQL)
- **Real-time:** Socket.IO for live updates
- **Production Server:** api.leylektag.com (157.173.113.156)

## What's Been Implemented

### 2026-03-05 - Admin Panel Fix
- **ROOT CAUSE IDENTIFIED:** API parameter mismatch
  - Frontend was sending `phone` but backend expected `admin_phone`
  - Endpoints were wrong: `/admin/dashboard` vs `/admin/dashboard/full`
- **FIXES APPLIED:**
  - `loadDashboard()` - Changed to `/admin/dashboard/full?admin_phone=...`
  - `loadUsers()` - Changed to `/admin/users/full?admin_phone=...`
  - `loadTrips()` - Changed to `/admin/trips?admin_phone=...`
  - `loadSettings()` - Changed to `/admin/pricing?phone=...`
  - Updated Dashboard UI to match new stats structure
  - Updated Users list to show correct fields (is_driver, is_online)
  - Updated Trips list to show correct status and info
- **FILE:** `/app/frontend/components/AdminPanel.tsx`

### 2026-03-04 - v1.0.11
- **DISPATCH QUEUE SYSTEM:**
  - New `dispatch_queue` table
  - Priority-based driver matching (distance, rating)
  - 20 second timeout per driver
  - Auto-advance to next driver on timeout/reject
  - Config API for admin management
  
- **QR SYSTEM IMPROVEMENTS:**
  - Personal QR codes (no API call, instant load)
  - Removed QR code text from display
  - Vibration feedback on scan
  - Format: `leylektag://end?u={user_id}&t={tag_id}`

### 2026-03-04 - v1.0.10
- **BUG FIX:** Fixed `currentLocation is not defined` crash

### Previous Implementation
- Dynamic QR trip ending system
- Symmetric rating flow with Socket.IO
- Driver activation packages UI
- Driver dashboard panel
- Removed Daily.co voice call feature
- Login screen background image

## Prioritized Backlog

### P0 - Critical
- [x] Fix app crash on role selection
- [x] Implement dispatch queue system
- [x] Fix Admin Panel empty data bug

### P1 - High Priority
- [ ] iyzico payment integration for driver packages
- [ ] Fix NETGSM SMS authentication (need server IP whitelist)
- [ ] Build new APK with Admin Panel fixes

### P2 - Medium Priority
- [ ] Run SQL migrations for new tables (promotions, driver_kyc)
- [ ] Push notification system refinement
- [ ] Admin panel logging view
- [ ] Admin dispatch monitoring dashboard
- [ ] Refactor index.tsx (10,000+ lines)

### P3 - Low Priority
- [ ] Performance optimizations
- [ ] Additional admin features

## SQL Migrations Needed
Located at: `/app/sql_migrations/schema_updates.sql`
- `promotions` table for promo codes
- `driver_kyc` table for driver verification
- `end_method` column on `tags` table
- `dispatch_queue` table for driver matching

## Key Files
- `/app/frontend/app/index.tsx` - Main app file
- `/app/frontend/components/AdminPanel.tsx` - Admin Panel (FIXED)
- `/app/frontend/components/QRTripEndModal.tsx` - QR scanning flow
- `/app/backend/server.py` - Backend API + Socket.IO + Dispatch Queue

## Admin Panel API Endpoints
- `GET /api/admin/check?phone=...` - Check admin status
- `GET /api/admin/dashboard/full?admin_phone=...` - Get dashboard stats
- `GET /api/admin/users/full?admin_phone=...` - Get users list
- `GET /api/admin/trips?admin_phone=...` - Get trips list
- `GET /api/admin/pricing?phone=...` - Get pricing settings
- `GET /api/admin/kyc/all?admin_phone=...` - Get KYC requests

## Dispatch Queue API Endpoints
- `GET /api/dispatch/config` - Get dispatch settings
- `POST /api/dispatch/config` - Update dispatch settings
- `GET /api/dispatch/queue/{tag_id}` - Get queue status for tag
- `POST /api/ride/reject` - Driver reject offer

## Database Schema

### dispatch_queue table
- id: UUID
- tag_id: UUID (FK to tags)
- driver_id: UUID (FK to users)
- priority: INTEGER
- status: TEXT (waiting/sent/accepted/rejected/expired)
- created_at: TIMESTAMP
- sent_at: TIMESTAMP
- responded_at: TIMESTAMP

## Known Issues
- NETGSM authentication error (code 30) - needs server IP whitelist
- TypeScript type definition warnings (non-breaking)
- Missing SQL tables: promotions, driver_kyc (migration script ready)

## Admin Credentials
- Admin Phone: 5326497412
- Production Server: api.leylektag.com (157.173.113.156)

## Latest APK
https://expo.dev/artifacts/eas/wduhZgNZSyH2ygztkp92JU.apk
**Note:** This APK has the old code. New APK needs to be built with Admin Panel fixes.
