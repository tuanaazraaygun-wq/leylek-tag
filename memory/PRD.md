# Leylek TAG - Product Requirements Document

## Original Problem Statement
Ride-sharing application with QR-based trip ending, symmetric rating system, and driver activation packages.

## Core Features
1. **QR Trip Ending System** - Dynamic QR codes for secure trip completion
2. **Symmetric Rating System** - Both driver and passenger rate each other after trip
3. **Driver Activation Packages** - Time-based packages (3, 6, 9, 12, 24 hours)
4. **Driver Dashboard** - Stats panel showing earnings, trips, active time

## Tech Stack
- **Frontend:** React Native (Expo)
- **Backend:** FastAPI + Python Socket.IO
- **Database:** Supabase (PostgreSQL)
- **Real-time:** Socket.IO for live updates

## What's Been Implemented

### 2026-03-04 - v1.0.9
- **BUG FIX:** Fixed `currentLocation is not defined` crash
  - Changed `currentLocation` to `userLocation` in QRTripEndModal props
  - Affected both PassengerDashboard and DriverDashboard
- **APK:** https://expo.dev/artifacts/eas/3N1wxW2ekW4nRWnngsSJE5.apk

### Previous Implementation
- Dynamic QR trip ending system (backend + frontend)
- Symmetric rating flow with Socket.IO
- Driver activation packages UI (DriverPackagesModal)
- Driver dashboard panel (DriverDashboardPanel)
- Removed Daily.co voice call feature
- Login screen background image

## Prioritized Backlog

### P0 - Critical
- [x] Fix app crash on role selection

### P1 - High Priority
- [ ] iyzico payment integration for driver packages
- [ ] Fix NETGSM SMS authentication (need new credentials)
- [ ] Fix OTP rate limiting issue

### P2 - Medium Priority
- [ ] Push notification system
- [ ] Admin panel logging view
- [ ] Refactor index.tsx (10,000+ lines - stability risk)

### P3 - Low Priority
- [ ] Performance optimizations
- [ ] Additional admin features

## Key Files
- `/app/frontend/app/index.tsx` - Main app file (needs refactoring)
- `/app/frontend/components/DriverDashboardPanel.tsx` - Driver stats panel
- `/app/frontend/components/QRTripEndModal.tsx` - QR scanning flow
- `/app/backend/server.py` - Backend API + Socket.IO

## API Endpoints
- `POST /api/qr/trip/generate` - Generate trip QR code
- `POST /api/qr/verify` - Verify QR to complete trip
- `GET /api/driver/packages` - List activation packages
- `GET /api/driver/dashboard` - Driver stats data

## Known Issues
- NETGSM authentication error (code 30) - needs new credentials
- TypeScript type definition warnings (non-breaking)
