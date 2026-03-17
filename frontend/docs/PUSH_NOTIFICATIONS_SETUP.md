# Android Push Notifications (Expo + FCM v1)

Bu projede Android bildirimleri **Expo Push API** ve **Firebase Cloud Messaging v1** ile çalışır.

## Proje tarafında yapılanlar

- **expo-notifications** kurulu ve `app.json` içinde plugin yapılandırıldı (`defaultChannelId: "default"`).
- **app.json** → `expo.android.googleServicesFile`: `./google-services.json` (proje kökünde).
- **google-services.json** Firebase Android istemci config’i (package: `com.leylektag.app`, project: `leylektag-50877`).
- **ExpoPushToken** `usePushNotifications` hook’unda `getExpoPushTokenAsync({ projectId })` ile alınıyor; `projectId` `app.json` → `extra.eas.projectId` ile eşleşiyor.

## EAS’te FCM v1 credential’ı (zorunlu)

Backend’deki Firebase service account **Expo sunucularına verilmez**. Bildirimleri Android’e ulaştıran **Expo** olduğu için FCM v1 credential’ı **EAS’e** eklenmelidir.

1. **Firebase Console** → Aynı proje: **leylektag-50877** (google-services.json’daki `project_id`).
2. **Project settings** → **Service accounts** → **Generate new private key** → JSON indir.
3. Bu JSON’u **EAS’e** yükle:
   - **CLI:** `cd frontend` → `eas credentials`
   - **Android** → **production** (veya kullandığın profile) → **Google Service Account** → **Set up a Google Service Account Key for Push Notifications (FCM V1)** → **Upload a new service account key** → indirdiğin JSON’u seç.
   - Veya [expo.dev](https://expo.dev) → Proje → **Credentials** → **Android** → **FCM V1** → Service account JSON yükle.

4. Bu JSON’u **.gitignore**’da tut (repo’ya commit etme).

Bu adım yapılmadan Android cihazlara push gitmez; Expo yanıtında “Unable to retrieve the FCM server key” benzeri hata alırsın.

## Test

- Backend’den test push gönder (örn. `/api/admin/push-test` veya ilgili endpoint).
- Cihazda bildirim izni açık, uygulama en az bir kez açılmış ve Expo push token backend’e kaydedilmiş olmalı.

## Kaynaklar

- [Expo: FCM credentials (FCM v1)](https://docs.expo.dev/push-notifications/fcm-credentials/)
- [Expo: Push notifications setup](https://docs.expo.dev/push-notifications/push-notifications-setup/)
