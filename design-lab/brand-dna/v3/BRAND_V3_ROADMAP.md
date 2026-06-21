# LeylekTAG Brand DNA v3 — Roadmap

**Version:** Brand DNA v3.0  
**Status:** Design-lab implementation plan — no code commits in this patch  
**Horizon:** V3 marka dilinin spec → asset → production wiring

---

## 1. Roadmap özeti

```
Faz 0 (bu patch)     Faz 1              Faz 2              Faz 3              Faz 4
─────────────────────────────────────────────────────────────────────────────────────
Analiz & spec   →   Onay & dinleme  →  Asset lab       →  Integration spec →  Production
brand-dna/v3/       Stakeholder         sonic v3            LSX orchestrator     PR'lar
                    listening           markers v3            wiring guide         ayrı onay
                    boot/QR spec        logo motion
```

---

## 2. Faz 0 — Tamamlandı (bu patch)

| Deliverable | Durum |
|-------------|-------|
| `BRAND_V3_CONSTITUTION.md` | ✅ |
| `SONIC_DNA_V3.md` | ✅ |
| `MARKER_DNA_V3.md` | ✅ |
| `LOGO_DNA_V3.md` | ✅ |
| `MOTION_HAPTIC_DNA_V3.md` | ✅ |
| `CROSS_LANGUAGE_MAP_V3.md` | ✅ |
| `BRAND_V3_ROADMAP.md` | ✅ |

**Dokunulmayan:** `frontend/`, `backend/`, production assets, git commit.

---

## 3. Faz 1 — Onay & dinleme (1–2 hafta)

### 3.1 Stakeholder review

| Aktivite | Çıktı |
|----------|-------|
| Constitution + North Star onayı | Sign-off veya revizyon listesi |
| Cross-language map walkthrough | Tier A öncelik sırası |
| Rakip farkı red team | “Taksi/ Uber gibi mi?” kontrol listesi |

### 3.2 Sonic dinleme oturumu

Mevcut `design-lab/sonic/v2/output/wav/` + v1 karşılaştırması:

| Token | Aksiyon |
|-------|---------|
| offer classic/urgent | v2a/v2b kazanan + orchestration notu |
| qr.success | Attack güçlendirme ihtiyacı doğrula |
| match.success | v1 warm resolve onayı |
| **presence.boot** | Spec onayı → Faz 2 generate |
| **qr.remoteAck** | Spec onayı → Faz 2 generate |

**Script:** `design-lab/sonic/LSDS_LISTENING_REPORT.md` §5 (15 dk)

### 3.3 Cihaz geri bildirimi kapatma planı

| Sorun | Faz 1 karar |
|-------|-------------|
| Ses canlı değil | Triad wiring Faz 4'e spec |
| Teklif canlı değil | relay.ingress öncelik onayı |
| QR belirgin değil | lock attack + glow onayı |
| Boot sessiz | presence.boot süre/onay |
| Remote QR | LSX T3 — production verify checklist |

---

## 4. Faz 2 — Asset lab (2–4 hafta)

### 4.1 Sonic v3 (`design-lab/sonic/v3/`)

| Asset | Spec kaynağı |
|-------|--------------|
| `presence.boot` | SONIC_DNA_V3 §3.1 |
| `qr.remoteAck` | SONIC_DNA_V3 §3.3 |
| `journey.start` | SONIC_DNA_V3 §3.4 |
| `leylek.open` | SONIC_DNA_V3 §3.6 |
| `qr.scanTick` | SONIC_DNA_V3 §3.3 |
| `trust.micro` | SONIC_DNA_V3 §3.5 |

Mevcut v2 kazananları remix; yeni tokenlar `generate_sonic_v3.py` (henüz yok).

### 4.2 Marker v3 (`design-lab/markers/`)

| Asset | Spec kaynağı |
|-------|--------------|
| Car / motor / human SVG | MARKER_DNA_V3 §3 |
| Lottie breathe + ringClose | MARKER_DNA_V3 §2.3 |
| Match connection line | MARKER_DNA_V3 §3.4 |
| Prompt güncelleme | V3 glow/pulse ekle |

### 4.3 Logo motion (`design-lab/brand-dna/v3/exports/`)

| Asset | Spec kaynağı |
|-------|--------------|
| Boot Lottie 550 ms | LOGO_DNA_V3 §5.1 |
| Ring close element | LOGO_DNA_V3 §5.2 |
| App icon symbol review | LOGO_DNA_V3 §7 |

---

## 5. Faz 3 — Integration spec (1 hafta)

Design-lab dokümanı: `LSX_ORCHESTRATOR_SPEC.md` (gelecek) — production kod yazmadan:

| Konu | İçerik |
|------|--------|
| Triad API | `fireTriad(eventId, channels)` pseudo-spec |
| Event bus | LSX event ID → kanal mapping |
| Silent mode | Ses bypass; motion+haptic devam |
| Remote ack | Socket handler → T3 tetik |
| Fatigue gates | Mevcut cooldown ile hizalama |
| Boot sequence | Splash → presence.boot timing |

**Çıktı:** Mobile engineer review; feasibility notları.

---

## 6. Faz 4 — Production (ayrı onay, ayrı PR'lar)

Her kanal **bağımsız PR** — big-bang yok.

| PR sırası | Kapsam | Risk |
|-----------|--------|------|
| 1 | Boot presence (sound + logo motion) | Düşük |
| 2 | Offer triad (motion + haptic) | Orta |
| 3 | QR lock güçlendirme + remote T3 verify | Orta |
| 4 | Global Tier B tap (motion + haptic) | Orta |
| 5 | Marker asset swap | Yüksek — harita QA |
| 6 | Match connection + journey.start | Orta |
| 7 | Leylek Zeka open sound | Düşük |

**Her PR öncesi:** Phone speaker QA + driver cabin sample + silent mode test.

---

## 7. Başarı metrikleri

| Metrik | Hedef | Ölçüm |
|--------|-------|-------|
| Boot presence | ≤250 ms hissedilir | Session timing |
| Tap → sensory | ≤32 ms | Instrumentation |
| Remote QR → driver | ≤200 ms | Socket + QA |
| “Bu LeylekTAG” | ≥80% tanıma (iç panel) | Blind test n≥8 |
| 3× offer fatigue | Mild veya None | Dinleme |
| Taksi benzerliği | 0 fail | Red team |

---

## 8. Riskler & azaltma

| Risk | Azaltma |
|------|---------|
| Ses artışı = yorgunluk | Triad; bilinçli sessizlik Tier C |
| Marker değişimi harita karmaşası | Zoom matrisi QA; kademeli rollout |
| Orchestrator scope creep | Faz 4'te event-by-event PR |
| Boot sesi rahatsız edici | T4 kısa; −3 dB vs offer |
| Remote ack duplicate | tag_id dedupe (mevcut pattern) |

---

## 9. Bağımlılıklar

```
BRAND_V3_CONSTITUTION
        │
        ├── SONIC_DNA_V3 ──► sonic/v3 WAV (Faz 2)
        ├── MARKER_DNA_V3 ──► markers/exports (Faz 2)
        ├── LOGO_DNA_V3 ──► boot Lottie (Faz 2)
        ├── MOTION_HAPTIC_DNA_V3 ──► LSX orchestrator spec (Faz 3)
        └── CROSS_LANGUAGE_MAP_V3 ──► Integration PR checklist (Faz 4)
```

---

## 10. Sonraki en doğru adım

**Faz 1 — Sonic dinleme oturumu + boot/QR spec stakeholder onayı.**

1. `design-lab/sonic/v2/output/wav/` dosyalarını telefona aktar  
2. 15 dk dinleme scripti (`LSDS_LISTENING_REPORT.md`)  
3. Offer + QR + match kazananları işaretle  
4. `presence.boot` ve `qr.remoteAck` spec'ini onayla veya revize et  
5. Onay sonrası Faz 2'de `design-lab/sonic/v3/` generate  

Kod ve production asset'e **Faz 4'e kadar dokunulmaz**.

---

## 11. Document lineage

| Önceki | V3 ilişkisi |
|--------|-------------|
| LSDS v1/v2 | Sonic DNA miras + yeni tokenlar |
| LSX v1 | Motion/haptic/timing miras; V3 token prefix |
| Marker Constitution | Marker DNA genişletme |
| LSX Silence Report | Roadmap öncelik girdisi |
