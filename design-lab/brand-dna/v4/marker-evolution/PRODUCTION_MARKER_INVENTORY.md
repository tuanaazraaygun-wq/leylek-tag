# Production Marker Inventory

**Sprint:** B-2 — Marker Evolution Full Analysis  
**Mode:** Read-only scan  
**Date:** 2026-06-21

---

## Executive summary

Production'da **iki paralel marker dili** yaşar:

| Sistem | Yüzeyler | Görsel dil |
|--------|---------|------------|
| **A — PNG entity markers** | LiveMapView, PassengerWaitingScreen, SearchingMapView, LeylekTripMapPreview | `mapNavMarkers.ts` PNG + `MapEntityMarkerImage` cyan glow |
| **B — View/Ionicons field markers** | DriverOfferScreen, OfferMapScreen, index destination picker | Renkli daire + Ionicons; yeşil/turuncu/mavi generic |
| **C — Website CSS markers** | real-city-map, intercity-real-map | `.leylek-marker-*` divIcon |

`design-lab/brand-dna/v4/MARKER_DNA.md` hedef genom tanımlı — production henüz uygulamıyor.

---

## Core production files

| Dosya | Rol |
|-------|-----|
| `frontend/lib/mapNavMarkers.ts` | PNG paths, MARKER_PIXEL, rotation/anchor |
| `frontend/lib/mapMarkerChrome.tsx` | MapEntityMarkerImage, MapDestinationFlagPin, MapPickupPin |
| `frontend/components/LiveMapView.tsx` | Trip map — PNG markers + destination flag |
| `frontend/components/PassengerWaitingScreen.tsx` | Waiting map — PNG |
| `frontend/components/SearchingMapView.tsx` | Search map — PNG |
| `frontend/components/DriverOfferScreen.tsx` | Field map — heat/seeking/light/driver View markers |
| `frontend/components/OfferMapScreen.tsx` | Legacy offer map — generic circles |
| `frontend/app/index.tsx` | Destination route picker — custom pin rings |
| `frontend/components/LeylekTripMapPreview.tsx` | Preview — PNG + pickup/destination chrome |
| `website/components/real-city-map.tsx` | Marketing district markers |
| `website/app/globals.css` | `.leylek-marker-*` styles |

## Referenced PNG assets (code)

| Asset path | Tip |
|------------|-----|
| `frontend/assets/markers/driver-car.png` | Driver car |
| `frontend/assets/markers/driver-motor.png` | Driver motorcycle |
| `frontend/assets/markers/passenger-woman.png` | Passenger |

**Not:** Repo taramasında `frontend/assets/markers/` boş veya gitignore — build'de local olabilir; migration öncesi hash verify gerekir.

## Design-lab (production değil)

| Path | İçerik |
|------|--------|
| `design-lab/markers/constitution.md` | İlkeler |
| `design-lab/markers/prompts/*.prompt.md` | AI prompt car/motor/human |
| `design-lab/markers/exports/` | Boş (.gitkeep) |
| `design-lab/brand-dna/v4/MARKER_DNA.md` | V4 hedef spec |

---

## Marker tip → production eşlemesi

| # | Marker tip | Production karşılığı | Sistem |
|---|------------|---------------------|--------|
| 1 | Passenger | `passenger-woman.png` + glow | A |
| 2 | Driver Car | `driver-car.png` + glow / field car icon | A / B |
| 3 | Motorcycle | `driver-motor.png` + glow / field motor icon | A / B |
| 4 | Quick Match | **Yok** — match_channel UI only | — |
| 5 | Trusted Driver | TrustedAddButton chip (harita üstü UI) | UI overlay |
| 6 | Trust Network | Hub/list UI — map pin yok | — |
| 7 | Destination | MapDestinationFlagPin + index destinationPinCore | A / B |
| 8 | Pickup | MapPickupPin + OfferMapScreen yeşil daire | A / B |
| 9 | Journey Active | Polyline + DriverNavDirectionPointer | Nav chrome |
| 10 | Cluster | **Implementasyon yok** | DNA only |
| 11 | Offline Driver | **Map marker yok** — go-offline API | — |
| 12 | Searching Animation | seeking/light/heat markers DriverOfferScreen | B |

---

**Sonraki:** `markers/MARKER_*.md` per-type analizler
