# Leylek Normal Ride Checklist

Goal:
Ensure we NEVER break the working ride system again.

## Critical Flow Checklist

1. Passenger creates ride
2. Driver sees offer
3. Driver accepts
4. ride_matched received
5. driver_on_the_way received
6. activeTag is set
7. pickup_lat / pickup_lng exist
8. route_info exists
9. Driver presses "Yolcuya Git"
10. Navigation starts (no alert)
11. Route polyline visible
12. Pickup distance/time visible
13. QR works
14. Güven Al works
15. Voice call works

## Debug Checklist

- YOLCUYA_GIT_BLOCKED_EXACT should NEVER appear in normal flow
- DRIVER_ACTIVE_TAG_AFTER_SOCKET should contain pickup coords
- DRIVER_MAP_ROUTE_INPUT should contain overview_polyline

## Rules

- Any change must pass ALL checklist items
- If one breaks -> rollback
