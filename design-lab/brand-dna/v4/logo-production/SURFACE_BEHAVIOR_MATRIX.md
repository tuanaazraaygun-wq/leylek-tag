# Surface Behavior Matrix — Logo Production Phase 1

**Version:** 1.0  
**Status:** Analysis only  
**Parent:** `LOGO_VARIANTS.md`, `CROSS_PLATFORM_DNA.md`, `WATCH_DNA.md`, `WEBSITE_DNA.md`

---

## 1. Yüzey Özeti Tablosu

| Yüzey | Boyut | Tier | Motion | Glow | Ses | Haptic | Varyant ID |
|-------|-------|------|--------|------|-----|--------|------------|
| Tek başına symbol | 128–512 px | F | Statik | Off | — | — | `symbol.dark` |
| App açılış splash | center F | F→motion | presence 550 ms | boot 0.25 | boot +40 ms | — | `motion.boot` |
| Harita watermark | 24–48 px | S/M0 | Statik | Off | — | — | `mono.white` @ 0.12 |
| Apple Watch icon | 44–50 px | M1 | Statik | Off | off | tap only | `small` M1 |
| Watch complication | 20–24 px | M0 | Statik | Off | — | primary | `micro` M0 |
| Widget small | 16–20 px | M0 | Statik | Off | — | — | dot/M0 |
| Widget medium | 24 px | S | Statik | Off | — | tap→tap | `standard` S |
| Favicon | 16–32 px | M0/M1 | Statik | Off | — | — | `micro` SVG |
| Bildirim | 24 dp mono | M0 | Statik | Off | token | — | `mono.white` |
| Çok küçük | 16 px | M0 | Statik | Off | — | — | dot+horizon hint |
| Çok büyük | billboard | F + wordmark | Statik | Off | — | — | `primary.dark` horiz |

---

## 2. Tek Başına Görünür (Symbol Only)

| Parametre | Spec |
|-----------|------|
| Kullanım | App icon önizleme, investor deck, sticker siluet, social avatar |
| Form | Wing arc + horizon + accent dot; ring idle ince veya gizli |
| Renk | Dark: white+cyan on void; Light: slate+cyan on white |
| Motion | **Statik** — nefes yok |
| Glow | **Off** |
| Min test | 64 px tam; 29 px settings geçmeli |
| Max | 512 master — detay ring görünür |

**Davranış:** Marka imzası = **sakin duruş**. Hareket yalnızca bağlamlı olaylarda (boot, lock).

---

## 3. Uygulama Açılırken (Splash)

| Parametre | Spec |
|-----------|------|
| Layout | Symbol merkez veya alt-üçte bir; wordmark opsiyonel +40 ms stagger |
| Background | Void `#0D1117` → Depth Slate gradient **zemin only** |
| Symbol | Tier F → `motion.boot` |
| Süre | 550 ms narrative; handoff 700 ms chrome full |
| Ses | `presence.boot` +40 ms |
| Glow | presence max 0.25 |
| Wordmark | `primary.dark` horizontal — ayrı katman |

**Native splash (Android drawable):** Statik `symbol.dark` Tier S — JS splash motion üstüne. Phase 5 migration notu; Phase 1 analiz.

---

## 4. Haritada

| Parametre | Spec |
|-----------|------|
| Rol | Watermark / chrome — **marker değil** |
| Opacity | 0.10–0.15 monochrome white |
| Boyut | 24–32 px max |
| Motion | **Statik** — marker breathe ayrı sistem |
| Glow | **Off** — harita okunurluğu |
| Zoom ≤14 | Gizli |
| Zoom ≥15 | Opsiyonel watermark köşe |

**Kural:** Logo pin formu haritada **asla** — marker siluet ayrı genom.

---

## 5. Apple Watch

| Varyant | Spec |
|---------|------|
| App icon | M1 @ 44 px; monochrome veya white+cyan dot |
| Complication | M0 — horizon line + cyan dot; ring **gizli** |
| Notification | M0 mono white on system bg |
| Motion | **Statik** — haptic öncelik |
| Ses | Default off; offer/QR shortened token |
| Glow | **Off** |

**Human Interface:** Tek bilgi yüzeyi — logo detay = noise. North Star "en sessiz yüzey".

---

## 6. Widget

| Size | Symbol | Motion | Cyan |
|------|--------|--------|------|
| Small | M0 dot veya gizli | Statik | Status text accent |
| Medium | S @ 24 px | Statik | Journey line accent |
| Large | S @ 32 px | Statik | Map chrome |

Tap → `ui.tap` + deep link; **boot sound yok** on refresh.

---

## 7. Favicon

| Asset | Tier | Format |
|-------|------|--------|
| 16×16 | M0 | ICO/PNG — dot + horizon |
| 32×32 | M1 | PNG |
| SVG | M1 scalable | `prefers-color-scheme` |
| apple-touch 180 | S | PNG |

**Mevcut risk:** Pin blob @ 16 px — V4 M0 geçmeli.

---

## 8. PWA

| Asset | Spec |
|-------|------|
| manifest icons 192/512 | `symbol.dark` Tier S/F |
| maskable | Safe zone 80%; void background layer |
| theme_color | `#0D1117` |
| background_color | `#0D1117` |
| Splash PWA | Statik symbol S — motion optional web only |

---

## 9. Bildirim

| Tür | Icon | Ses |
|-----|------|-----|
| Offer | `mono.white` M0 24 dp | offer excerpt |
| Match | M0 | match excerpt |
| QR remote | M0 | remoteAck |
| Generic | **Yasak** | **Yasak** |

Android adaptive notification icon: monochrome silhouette — gradient **yasak**.

---

## 10. Çok Küçük Boyut (16–20 px)

| Görünür | Gizli |
|---------|-------|
| Cyan accent dot | Ring |
| Horizon 1 px line | Wing detail |
| — | Wordmark |
| Siluet hint (M0) | Glow |

**Filled variant** (`logo.filled.dark`) 20 px altı alternatif QA — sketch Phase 2.

---

## 11. Çok Büyük Boyut (billboard, tabela)

| Parametre | Spec |
|-----------|------|
| Form | Siluet only + wordmark ayrı |
| Renk | Monochrome veya white+cyan single dot |
| Detay | Ring görünür Tier F |
| Glow | **Off** — fiziksel ışık ayrı |
| Min uzaklık test | 10 m siluet tanınır |

---

## 12. Platform Varyant Matrisi (üretim hedef)

### 12.1 App Icon

| Asset | iOS | Android |
|-------|-----|---------|
| 1024 master | `symbol.dark` F | aynı |
| Adaptive foreground | — | symbol F, safe 80% |
| Adaptive background | — | void flat `#0D1117` |
| Legacy 192 | S | S |

### 12.2 Adaptive Icon

| Layer | İçerik |
|-------|--------|
| Foreground | Symbol only — **pin yok** |
| Background | Solid void — gradient yok |
| Monochrome (Android 13+) | System tint; form okunur kalır |

### 12.3 Splash

| Katman | Varyant |
|--------|---------|
| Native static | `symbol.dark` S |
| JS animated | `motion.boot` |
| Background | void→slate gradient |

### 12.4 Website

| Yüzey | Varyant | Not |
|-------|---------|-----|
| Navbar | `standard` S | violet wrapper **retire** |
| Hero | `motion.boot` veya F static | reduced-motion fallback |
| Footer | S | |
| OG 1200×630 | `primary.dark` horizontal | |
| Favicon | `micro` SVG | |

### 12.5 Apple Watch

| Asset | Varyant |
|-------|---------|
| 44/46/49 icon | M1 |
| Complication | M0 |

### 12.6 Widget

| Platform | Small | Medium | Large |
|----------|-------|--------|-------|
| iOS | M0 | S 24 | S 32 |
| Android | M0 cyan preserve | S 24 | S 32 |

### 12.7 Favicon + PWA

| File | Size |
|------|------|
| favicon.ico | 16, 32 |
| icon-192.png | 192 |
| icon-512.png | 512 |
| maskable | 512 safe |

---

## 13. `prefers-reduced-motion`

Tüm motion yüzeyleri → statik `symbol.dark` Tier S; glow off; ses opsiyonel off.

---

**Non-goals:** Asset export yok.
