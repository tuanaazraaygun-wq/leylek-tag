# Leylek Navigation System

## Normal Ride Driver Navigation Flow

Normal ride sisteminde surucu eslesmeden sonra yolcuya gitmek icin driver -> pickup navigation akisina girer. Bu akis normal ride icin kritiktir ve Leylek Teklif Sende mimarisiyle karistirilmamalidir.

Temel akış:

1. Yolcu teklif olusturur.
2. Surucu teklifi gorur ve kabul eder.
3. Backend eslesmeyi olusturur.
4. Surucu tarafina rota ve pickup bilgileri socket/event ile gelir.
5. Frontend activeTag icine route_info ve pickup koordinatlarini normalize ederek yazar.
6. LiveMapView "Yolcuya Git" ile origin/destination fallback zincirinden rota baslatir.

## Backend Events

- `ride_matched`: Normal ride eslesmesi icin kullanilir. Yolcu ve surucu ekranlarinda activeTag state'ini besler.
- `driver_on_the_way`: Surucu "Yolcuya Git" akisini baslattiginda driver -> pickup rota bilgisini tasir.

## Backend Payload Shape

Driver navigation icin beklenen payload:

```ts
{
  tag,
  route,
  route_info,
  pickup_lat,
  pickup_lng
}
```

`pickup_lat` ve `pickup_lng` backend/socket katmanindan string olarak gelebilir. Frontend validation oncesinde bu degerleri number'a normalize etmelidir.

## Frontend Normalization

`frontend/app/index.tsx` icinde driver socket normalization activeTag'i koruyarak gunceller:

- `tag`, `route` ve duz payload alanlari tek activeTag modelinde birlestirilir.
- `route_info` activeTag icine merge edilir.
- `pickup_lat` ve `pickup_lng` number'a normalize edilir.
- Pickup koordinatlari yolcu pini ve driver -> pickup rota hedefi icin ayni kaynak olarak kullanilir.

## LiveMapView Fallback Chain

`frontend/components/LiveMapView.tsx` icinde "Yolcuya Git" baslatilirken iki zincir korunur:

- Origin fallback chain: surucu konumu, current/user location, nav marker fallback'leri.
- Destination fallback chain: otherLocation, activeTag passenger_location, activeTag pickup_lat/pickup_lng, passenger coordinate alias'lari.

Bu fallback zincirleri bozulursa surucu "Yolcuya Git" butonunda rota baslatamayabilir.

## Debug Logs

Sorun aninda once su loglara bak:

- `YOLCUYA_GIT_BLOCKED_EXACT`: Origin/destination validation neden bloklandi?
- `DRIVER_MAP_ROUTE_INPUT`: Haritaya verilen route/pickup girdileri ne?
- `DRIVER_ACTIVE_TAG_AFTER_SOCKET`: Socket sonrasi activeTag icinde route_info ve pickup koordinatlari var mi?

## Deploy / APK Notes

- Normal ride flow calisiyorsa navigation degisiklikleri kucuk ve geri alinabilir tutulmali.
- APK/release testinde "Yolcuya Git" once driver -> pickup rotasini, biniş/QR sonrasi hedef fazini dogrulamalidir.
- Runtime hata varsa Android/Hermes stack trace ve yukaridaki debug loglar birlikte okunmalidir.
- Rollback icin comment ve markdown degisiklikleri davranissal etki tasimaz; logic degisikligi iceren commit'ler ayrica tutulmalidir.
