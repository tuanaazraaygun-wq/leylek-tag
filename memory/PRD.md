# Leylek TAG - Product Requirements Document

## Original Problem Statement
Ride-sharing application with QR-based trip ending, symmetric rating system, driver activation packages, and intelligent dispatch queue.

## Core Features
1. **QR Trip Ending System** - Personal QR codes for instant trip completion
2. **Symmetric Rating System** - Both driver and passenger rate each other
3. **Driver Activation Packages** - Time-based packages (3, 6, 9, 12, 24 hours)
4. **Driver Dashboard** - Stats panel showing earnings, trips, active time
5. **Dispatch Queue System** - Intelligent driver matching by proximity and rating

## Tech Stack
- **Frontend:** React Native (Expo)
- **Backend:** FastAPI + Python Socket.IO
- **Database:** Supabase (PostgreSQL)
- **Real-time:** Socket.IO for live updates

## What's Been Implemented

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

### P1 - High Priority
- [ ] iyzico payment integration for driver packages
- [ ] Fix NETGSM SMS authentication (need new credentials)

### P2 - Medium Priority
- [ ] Push notification system
- [ ] Admin panel logging view
- [ ] Admin dispatch monitoring dashboard
- [ ] Refactor index.tsx (10,000+ lines)

### P3 - Low Priority
- [ ] Performance optimizations
- [ ] Additional admin features

## Key Files
- `/app/frontend/app/index.tsx` - Main app file
- `/app/frontend/components/QRTripEndModal.tsx` - QR scanning flow (improved)
- `/app/backend/server.py` - Backend API + Socket.IO + Dispatch Queue

## Dispatch Queue API Endpoints
- `GET /api/dispatch/config` - Get dispatch settings
- `POST /api/dispatch/config` - Update dispatch settings
- `GET /api/dispatch/queue/{tag_id}` - Get queue status for tag
- `POST /api/ride/reject` - Driver reject offer

## Dispatch Queue Config
```json
{
  "matching_radius_km": 15,
  "max_driver_dispatch": 5,
  "driver_offer_timeout": 20,
  "enabled": true
}
```

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
- NETGSM authentication error (code 30) - needs new credentials
- TypeScript type definition warnings (non-breaking)

## Latest APK
https://expo.dev/artifacts/eas/wduhZgNZSyH2ygztkp92JU.apk
