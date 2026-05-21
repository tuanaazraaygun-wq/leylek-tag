# GoogleService-Info.plist (zorunlu — Faz 1 iOS FCM)

EAS / `expo prebuild` iOS derlemesi için Firebase Console’dan indirdiğiniz dosyayı şu konuma koyun:

`frontend/GoogleService-Info.plist`

`app.json` → `expo.ios.googleServicesFile`: `./GoogleService-Info.plist`

Bundle ID: `com.leylektag.app`  
Firebase proje: `leylektag-50877`

Bu dosya repoda yoksa iOS native FCM (`messaging().getToken()`) çalışmaz; clean EAS build başarısız olabilir.
