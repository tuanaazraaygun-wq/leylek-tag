# LeylekTAG Brand DNA v4 — Roadmap

**Version:** Brand DNA v4.0  
**Status:** Design-lab implementation plan — no code commits  
**Horizon:** V4 marka DNA spec → asset → production wiring

---

## 1. Roadmap Özeti

```
Faz 0 (bu patch)     Faz 1              Faz 2              Faz 3              Faz 4              Faz 5
──────────────────────────────────────────────────────────────────────────────────────────────────────────
V4 Master Analysis → Stakeholder      → Asset Lab        → Integration      → Production       → Platform
brand-dna/v4/        sign-off           sonic v3            LSX v2              PR'lar             Watch/Web
15 documents         North Star         logo geometry       orchestrator        ayrı onay          Widget
                     listening          marker v4           cross-platform QA
                     logo review        motion lottie
```

---

## 2. Faz 0 — Tamamlandı (bu patch)

| Deliverable | Durum |
|-------------|-------|
| `BRAND_CONSTITUTION_V4.md` | ✅ |
| `NORTH_STAR.md` | ✅ |
| `LOGO_DNA.md` | ✅ |
| `MARKER_DNA.md` | ✅ |
| `SONIC_DNA.md` | ✅ |
| `MOTION_DNA.md` | ✅ |
| `HAPTIC_DNA.md` | ✅ |
| `LIGHT_DNA.md` | ✅ |
| `WATCH_DNA.md` | ✅ |
| `AI_DNA.md` | ✅ |
| `WEBSITE_DNA.md` | ✅ |
| `CROSS_PLATFORM_DNA.md` | ✅ |
| `COMPETITOR_ANALYSIS.md` | ✅ |
| `FUTURE_VISION.md` | ✅ |
| `ROADMAP.md` | ✅ |

**Dokunulmayan:** `frontend/`, `backend/`, production assets, git commit.

---

## 3. Faz 1 — Stakeholder Onay (1–2 hafta)

### 3.1 Constitution review

| Aktivite | Çıktı |
|----------|-------|
| North Star sign-off | Onay veya revizyon |
| Eksen oranları review | %100 dağılım onayı |
| Competitor red team | "Taksi/Uber mi?" checklist |
| Logo yeterlilik kararı | Geometry migration onayı |

### 3.2 Sonic dinleme

Kaynak: `design-lab/sonic/v2/output/wav/`

| Token | Aksiyon |
|-------|---------|
| offer classic/urgent | v2a/b/c kazanan |
| qr.success | Attack onay |
| match.success | Warm resolve onay |
| presence.boot | V4 spec onay → Faz 2 generate |
| qr.remoteAck | V4 spec onay → Faz 2 generate |
| journey.start/end | V4 spec onay |

Script: `design-lab/sonic/LSDS_LISTENING_REPORT.md` + v2 report

### 3.3 Cross-platform priority

| Öncelik | Platform |
|---------|----------|
| P0 | iOS + Android mobile |
| P1 | Push notification sounds |
| P2 | Apple Watch |
| P3 | Widget |
| P4 | Website brand experience |
| P5 | CarPlay / Android Auto |

---

## 4. Faz 2 — Asset Lab (3–5 hafta)

### 4.1 Logo v4 (`design-lab/brand-dna/v4/exports/`)

| Asset | Spec kaynağı |
|-------|--------------|
| Master SVG 512 px | LOGO_DNA §2 |
| Symbol variants | LOGO_DNA §4 |
| Monochrome set | LOGO_DNA §3.9 |
| Boot Lottie 550 ms | LOGO_DNA §5.1 |
| Lock Lottie 320 ms | LOGO_DNA §5.2 |
| App icon matrix 16–512 px | LOGO_DNA §3.1 |
| Red team vs production pin logo | LOGO_DNA §1 |

### 4.2 Sonic v3 (`design-lab/sonic/v3/`)

| Asset | Spec kaynağı |
|-------|--------------|
| presence.boot | SONIC_DNA §3.1 |
| qr.remoteAck | SONIC_DNA §3.4 |
| journey.start / .end | SONIC_DNA §3.6 |
| leylek.open / .response | SONIC_DNA §3.9 |
| trust.micro | SONIC_DNA §3.8 |
| Notification excerpts | SONIC_DNA §3.15 |
| `generate_sonic_v3.py` | LSDS v2 genome |

### 4.3 Marker v4 (`design-lab/markers/`)

| Asset | Spec |
|-------|------|
| Car / motor / human SVG | MARKER_DNA §3 |
| Trust / QM / AI overlays | MARKER_DNA §3.3–3.10 |
| Lottie breathe + ringClose | MARKER_DNA §4 |
| Connection line | MARKER_DNA §3.7 |
| Prompt update | V4 DNA in prompts |
| 24/32/48 px QA matrix | MARKER_DNA §6 |

### 4.4 Motion assets (`design-lab/brand-dna/v4/exports/lottie/`)

| Asset | Token |
|-------|-------|
| Boot presence | v4.motion.presence.pulse |
| Offer ingress | v4.motion.relay.ingress |
| QR lock | v4.motion.lock.ringClose |
| AI orb | v4.motion.ai.orbExpand |

---

## 5. Faz 3 — Integration Spec (1–2 hafta)

Design-lab: `LSX_ORCHESTRATOR_SPEC_V2.md` (gelecek)

| Konu | İçerik |
|------|--------|
| Triad API v4 | `fireTriad(eventId, channels)` |
| Token namespace | v4.motion.* / v4.haptic.* / lsx.sound.* |
| Cross-platform matrix | CROSS_PLATFORM_DNA §5 |
| Watch sync | WATCH_DNA §11 latency |
| Silent mode | Ses bypass; haptic+motion Tier A |
| Widget timeline | Journey refresh rules |
| AI event subset | AI_DNA — no fight orb |
| Boot sequence | Splash → T4 timing |

**Çıktı:** Mobile + Watch engineer feasibility review.

---

## 6. Faz 4 — Production (ayrı onay, ayrı PR'lar)

| PR # | Kapsam | Risk | DNA kaynak |
|------|--------|------|------------|
| 1 | Boot presence (sound + logo motion) | Düşük | LOGO + SONIC §3.1 |
| 2 | Offer triad (motion + haptic) | Orta | MOTION + HAPTIC |
| 3 | QR lock + remote T3 | Orta | MARKER + SONIC §3.4 |
| 4 | Global Tier B tap | Orta | HAPTIC §3 |
| 5 | Logo + app icon swap | Yüksek | LOGO_DNA |
| 6 | Marker asset swap | Yüksek | MARKER_DNA |
| 7 | Match + journey tokens | Orta | SONIC §3.6 |
| 8 | Leylek Zeka sonic open | Düşük | AI_DNA |
| 9 | Push notification sounds | Orta | SONIC §3.15 |
| 10 | Trust micro | Düşük | SONIC §3.8 |

**Her PR öncesi:** Phone speaker QA + driver cabin + silent mode + watch sync.

---

## 7. Faz 5 — Platform Genişleme (ayrı program)

| Platform | Kapsam | Bağımlılık |
|----------|--------|------------|
| Apple Watch app | WATCH_DNA full | Faz 4 PR 1–3 |
| iOS Widget | CROSS_PLATFORM §4.5 | Faz 4 PR 6 |
| Website v4 | WEBSITE_DNA | Logo + marker assets |
| Android Widget | CROSS_PLATFORM | iOS widget pattern |
| CarPlay | CROSS_PLATFORM §4.7 | Sonic cabin QA |
| Live Activity | CROSS_PLATFORM §4.1 | Journey state bus |

---

## 8. Başarı Metrikleri

| Metrik | Hedef | Ölçüm |
|--------|-------|-------|
| 200 ms first sensory | ≤200 ms | Instrumentation |
| Boot presence | ≤250 ms felt | Session timing |
| Remote QR → driver | ≤200 ms | Socket + QA |
| "Bu LeylekTAG" blind | ≥80% | n≥8 panel |
| 3× offer fatigue | Mild veya None | Dinleme |
| Taksi benzerliği | 0 fail | Red team |
| Cross-platform cyan | Exact hex match | Visual QA |
| Logo 29 px readable | Pass | Asset matrix |
| 10 yr trend test | 0 red list hit | Design review |

---

## 9. Riskler & Azaltma

| Risk | Azaltma |
|------|---------|
| Logo migration user confusion | A/B app icon; gradual |
| Marker harita karmaşası | Zoom QA; phased rollout |
| Sonic fatigue | Triad + Tier C silence |
| Watch scope creep | WATCH_DNA minimal first |
| Big-bang rebrand | PR-by-PR Faz 4 |
| V3/V4 doc conflict | V4 supersedes V3 spec |
| AI purple creep | AI_DNA red list |

---

## 10. Bağımlılık Grafi

```
BRAND_CONSTITUTION_V4
        │
        ├── NORTH_STAR (filter)
        ├── LOGO_DNA ──────► Faz 2 logo exports
        ├── MARKER_DNA ────► Faz 2 marker exports
        ├── SONIC_DNA ─────► Faz 2 sonic/v3
        ├── MOTION_DNA ────► Faz 2 Lottie
        ├── HAPTIC_DNA ────► Faz 3 orchestrator
        ├── LIGHT_DNA ─────► Marker + logo glow QA
        ├── WATCH_DNA ─────► Faz 5 watch
        ├── AI_DNA ────────► Faz 4 PR 8
        ├── WEBSITE_DNA ───► Faz 5 web
        ├── CROSS_PLATFORM ► Faz 3 + 5
        ├── COMPETITOR ────► Red team checklist
        └── FUTURE_VISION ─► 10 yr gate
```

---

## 11. V3 Roadmap İlişkisi

| V3 Faz | V4 karşılığı |
|--------|--------------|
| V3 Faz 0 spec | V3 complete; V4 extends |
| V3 Faz 1 listening | V4 Faz 1 — same + logo review |
| V3 Faz 2 assets | V4 Faz 2 — expanded scope |
| V3 Faz 3 orchestrator | V4 Faz 3 — cross-platform |
| V3 Faz 4 production | V4 Faz 4 — same PR pattern |

**V3 docs:** Referans olarak kalır; **V4 authoritative** for new work.

---

## 12. Sonraki En Doğru Adım

**Faz 1 — Stakeholder sign-off paketi:**

1. `NORTH_STAR.md` — tek cümle onay
2. `BRAND_CONSTITUTION_V4.md` — eksen oranları onay
3. `LOGO_DNA.md` §1 — logo migration kararı
4. Sonic dinleme oturumu — v2 WAV + V4 token spec
5. `COMPETITOR_ANALYSIS.md` — red team checklist walkthrough
6. Onay → Faz 2 asset lab başlat

Kod, production ve commit **Faz 4'e kadar yok**.

---

## 13. Document Lineage

| Önceki | V4 ilişkisi |
|--------|-------------|
| Brand DNA v3 | Miras + genişletme |
| LSDS v1/v2 | Sonic genom |
| LSX v1 | Motion/haptic/timing miras |
| Marker Constitution | Marker DNA temel |
| LSX Silence Report | Tier C öncelik girdisi |

**V4 = LeylekTAG Brand Identity Master Reference — bundan sonraki tüm tasarım kararlarının tek kaynağı.**
