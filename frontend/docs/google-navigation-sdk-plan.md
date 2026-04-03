# Google Navigation SDK — Aşama 2 entegrasyon planı

## Resmi paket

- **`@googlemaps/react-native-navigation-sdk`** (npm) — Google’ın React Native sarmalayıcısı, **beta**.
- Kaynak: [googlemaps/react-native-navigation-sdk](https://github.com/googlemaps/react-native-navigation-sdk)

## Gereksinimler (özet)

- **React Native 0.79+**, **Yeni Mimari** (Fabric / TurboModules) açık olması bekleniyor; proje şu an **RN 0.81** ile uyumlu görünür, yine de EAS `expo prebuild` + `newArchEnabled` doğrulanmalı.
- **Android**: minSdk 24+, Google Play Services, Cloud Console’da **Navigation SDK** etkin lisans / faturalandırma.
- **iOS**: 16+, Maps SDK + Navigation için gerekli CocoaPods pod’ları, API anahtarları.
- **Expo managed** tek başına yeterli değil: **development build / `expo prebuild`** ve **config plugin** veya manuel native düzenleme gerekir.

## Önerilen mimari

1. **`NavigationSurface` (native)**  
   Pickup ve destination için ayrı `Navigator` oturumları veya tek oturumda hedef güncelleme — SDK dokümantasyonundaki “waypoint / destination” akışına göre.

2. **`LiveMapView` fallback**  
   `navigationMode && !googleNavReady` veya kullanıcı ayarı “Klasik harita” iken mevcut **OSRM + `react-native-maps`** akışı aynen kalsın.

3. **Ses**  
   SDK’nın **voice guidance** seçenekleri açık; ek olarak sistem TTS (`expo-speech`) yalnızca fallback modunda kullanılmaya devam eder.

4. **Feature flag**  
   Örn. `EXPO_PUBLIC_USE_GOOGLE_NAV=1` + remote config ile kademeli açılım.

## Uygulama adımları (checklist)

1. Google Cloud: **Maps SDK for Android/iOS**, **Navigation SDK** lisansları; API key kısıtları (paket adı + SHA-1).
2. `yarn add @googlemaps/react-native-navigation-sdk`
3. `app.json` / `app.config.js` içinde **config plugin** veya README’deki native kurulum adımları.
4. `expo prebuild` → `eas build` (managed workflow’da klasik `expo start` ile native modül çalışmaz).
5. Sürücü ekranında: **Yolcuya Git** → önce Google Nav surface’i dene; hata / izin / bölge → `LiveMapView` navigasyonuna düş.
6. Pickup bitince (`< 50 m` veya yolcu bindi olayı) → destination için **hedef güncelle** veya ikinci segment başlat.

## Riskler

- Beta API kırılabilir.
- EEA / kullanım şartları ve maliyet (Directions + Navigation birleşik).
- Cihazda Google Play Services olmayan Android’de fallback şart.

## Mevcut durum (Aşama 1)

Uygulama içi navigasyon **OSRM** adımları + **`react-native-maps`** + **`expo-speech`** ile çalışıyor; bu dosya Aşama 2 için yol haritasıdır.
