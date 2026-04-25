# Leylek System Boundaries

## Amaç

Normal Ride sistemi su an calisan kritik yolculuk akisidir. Leylek Teklif Sende bu akisa karismadan, ayri veri modeli ve ayri ekran/servis sinirlariyla gelistirilmelidir.

## Normal Ride

Normal Ride kapsami:

- `tags`
- dispatch
- driver accept
- route
- QR
- Guven Al
- Agora

Bu alanlar teklif, eslesme, surucu/yolcu aktif yolculuk, rota, biniş dogrulama, guvenlik ve sesli arama akislarini tasir.

## Leylek Teklif Sende

Leylek Teklif Sende kapsami:

- `ride_listings`
- `conversations`
- `messages`
- chat-based future matching

Teklif Sende, sohbet ve gelecekte sohbet tabanli eslesme icin ayri mimari olarak ele alinmalidir.

## Do Not Cross

Leylek Teklif Sende su normal ride akislarina dokunmayacak:

- active check
- dispatch
- route
- QR
- payment
- Agora

Teklif Sende icin yeni davranis gerekiyorsa normal ride activeTag, dispatch, route, payment, QR veya Agora akisi uzerinden shortcut alinmayacak; ayri endpoint/state/event sinirlari kullanilacak.
