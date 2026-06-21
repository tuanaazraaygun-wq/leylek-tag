# P0 Dispatch Reliability — Offer Never Escapes + Seen Telemetry Plan

**Version:** P0 analysis v1.0  
**Status:** Analysis & architecture only — no code, no migration apply, no commit  
**Scope:** `design-lab/dispatch/`  
**Authors:** Chief Scale Engineer · Chief Dispatch Architect · Chief Socket Architect · Chief Backend Engineer · Chief Product Reliability Engineer  
**References:** `backend/server.py`, `backend/services/quick_match.py`, `frontend/app/index.tsx`, `frontend/components/DriverOfferScreen.tsx`, `frontend/hooks/useSocket.ts`

---

## Part A — Offer Never Escapes (Mevcut Mimari Özeti)

### A.1 Bugünkü dispatch mimarisi

Production’da normal yolculuk (`POST /ride/create`) **rolling batch dispatch** kullanır. Eski sıralı kuyruk (`create_dispatch_queue` → `dispatch_offer_to_next_driver`) **ride/create tarafından çağrılmaz**; yalnızca reject fallback’te (`rolling_dispatch_index` yoksa) devreye girer.

```
Yolcu POST /ride/create
    → tags INSERT (status=waiting)
    → rolling_dispatch_start(tag_id)
         → find_eligible_drivers (DISPATCH_RADIUS_KM, araç tipi, online, paket, konum)
         → rolling_dispatch_index (bellek)
         → rolling_dispatch_batch (dalga 1, BATCH_SIZE=5)
    → notified==0 → broadcast_offer_to_all (yedek, 5 sürücü)
    → hâlâ 0 → dispatch_exhausted (yolcuya socket)
```

**Dalga içi emit (sürücü başına):**

```
emit_new_passenger_offer_to_driver
    1. is_driver_eligible_for_dispatch_offer
    2. Socket new_passenger_offer (online + 120s dedupe)
    3. FCM push async (_driver_offer_push_fcm_deduped, 120s dedupe)
    4. return OfferEmitResult(True) — socket gitmese bile success
    → _dispatch_queue_insert_after_emit → dispatch_queue status=sent
    → 60s timer → rolling_dispatch_batch (sonraki dalga; önceki teklifler KALIR)
```

**Sürücü recovery katmanları:**

| Katman | Mekanizma | Periyot |
|--------|-----------|---------|
| Socket | `new_passenger_offer` | Anlık |
| Push | FCM `type=new_offer` | Async |
| Polling | `dispatch-pending-offer` + `driver/requests` | **2.5s** (`loadData`) |
| Reconnect | `register` → `emit_existing_waiting_offers_to_driver` | Dedupe 120s |

**Konfigürasyon:**

| Parametre | Varsayılan | Kaynak |
|-----------|------------|--------|
| Dalga boyutu | 5 | `BATCH_SIZE` |
| Dalga süresi | 60s (env 15–60) | `DISPATCH_BATCH_TIMEOUT_SECONDS` |
| Yarıçap | 10 km (env 5–100) | `DISPATCH_RADIUS_KM` |
| Sıralı mod timeout (legacy) | 10s | `driver_offer_timeout` |
| Broadcast yedek | 5 sürücü, payload 20s | `BROADCAST_*` |
| Socket/push dedupe | 120s | `OFFER_*_DEDUPE_WINDOW_SEC` |

---

### A.2 Offer lifecycle

```
[T0]  Tag waiting → rolling_dispatch_batch → emit + dispatch_queue.sent
[T0]  Sürücü: socket | push | poll (2.5s)
[T+60s] Sonraki dalga (remove_offer YOK — teklif ekranda kalır)
[Match] rolling_dispatch_stop(revoke=true) → remove_offer
[Reject rolling] excluded → sonraki dalga
[Reject legacy] dispatch_offer_to_next_driver → 10s timeout → passenger_offer_revoked(dispatch_timeout)
[Cancel] revoke + rolling_dispatch_stop
[Eligible=0] dispatch_exhausted
```

---

### A.3 TTL analizi

| TTL | Değer | Gerçek etki |
|-----|-------|-------------|
| Dalga | 60s | Sonraki dalga; **mevcut teklifi silmez** |
| Sıralı legacy | 10s | `passenger_offer_revoked` — nadir path |
| Broadcast payload | 20s | UI bilgisi; otomatik revoke yok |
| Tag (poll) | 10 dk | `pending/offers_received` only; **`waiting` etkilenmez** |
| Quick Match | `driver_seen_at` + extend | **Normal dispatch’te yok** |

---

### A.4 Seen (bugün)

| Soru | Normal dispatch |
|------|-----------------|
| Görüldü mü? | **Hayır** — `sent` = emit denendi |
| Socket ACK | Yok |
| UI → backend | Yok |
| QM pattern | `quick_match_invites.driver_seen_at` — referans alınabilir |

---

### A.5 Kaçma nedenleri (özet)

| Vektör | Risk |
|--------|------|
| **120s socket+push dedupe** | İlk delivery kaçınca 2 dk resend yok |
| **sent ≠ seen** | Expire/revoke kararları görülme bilgisine dayanmıyor |
| **dispatch_queue insert fail** | `dispatch-pending` kırılır; `driver/requests` fallback |
| **Multi-worker / multi-node** | Bellek state + socket split |
| **Leader deferral** | `DISPATCH_START_DEFERRED` — dispatch gecikir |
| **Legacy 10s sıralı** | Reject fallback’te anında revoke |
| **Tek yarıçap/TTL** | Bölgesel fark yok |

---

### A.6 En kritik P0 problemler

1. **120s dedupe + seen telemetry yok** — recovery kör nokta  
2. **`dispatch_queue.sent` ≠ görüldü** — metrik ve TTL kararları yanlış proxy  
3. **Queue insert fail** — pending poll güvenilirliği  
4. **Ops: multi-worker** — socket delivery  
5. **Legacy sıralı 10s** — nadir sert revoke  

---

## Part B — Seen Telemetry Patch Plan (Davranış Değiştirmez)

### B.1 Hedef

| İlke | P0-Seen |
|------|---------|
| `sent` vs `seen` ayrımı | `sent_at` = backend emit; `driver_seen_at` = sürücü UI render |
| Davranış değişimi | **Yok** — TTL extend, revoke erteleme, dedupe bypass **Phase 2+** |
| Yazım | İlk görülmede DB + structured log |
| Referans | `quick_match.py` → `_mark_driver_seen_if_needed` (idempotent null-check update) |

**Phase 2 (bu belge dışı, bilinçli erteleme):** seen sonrası TTL uzatma, revoke guard, dedupe bypass.

---

### B.2 Mevcut `dispatch_queue` şeması

Kaynak: `sql_migrations/schema_updates.sql`

```sql
dispatch_queue (
  id UUID PK,
  tag_id UUID FK → tags,
  driver_id UUID FK → auth.users,
  priority INTEGER,
  status VARCHAR(20),  -- waiting | sent | accepted | rejected | expired
  created_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  responded_at TIMESTAMPTZ,
  UNIQUE(tag_id, driver_id)
)
```

**Backend insert whitelist** (`DISPATCH_QUEUE_DB_KEYS`):

`id`, `tag_id`, `driver_id`, `priority`, `status`, `created_at`, `sent_at`, `responded_at`

Insert noktaları:

| Fonksiyon | Durum | Not |
|-----------|-------|-----|
| `create_dispatch_queue` | `waiting` | Legacy; ride/create çağırmıyor |
| `_dispatch_queue_insert_after_emit` | `sent` + `sent_at` | Rolling batch — **asıl yol** |
| `dispatch_offer_to_next_driver` | `sent` | Sıralı legacy |

Update noktaları: `expired`, `rejected`, `accepted`; `_expire_dispatch_queue_rows_for_tag` toplu expire.

**`/driver/dispatch-pending-offer`:** `status=sent` satırları; `driver_seen_at` **okumaz/döndürmez** (bugün).

**`/driver/requests`:** Tüm `waiting` tag’ler radius içinde — dispatch hedef listesi değil; seen telemetry için **secondary** (poll kaynağı teklif gösterimi).

---

### B.3 Migration ihtiyacı

**Dosya önerisi:** `backend/migrations/add_dispatch_queue_driver_seen_at.sql`

```sql
ALTER TABLE public.dispatch_queue
  ADD COLUMN IF NOT EXISTS driver_seen_at timestamptz NULL;

ALTER TABLE public.dispatch_queue
  ADD COLUMN IF NOT EXISTS driver_seen_source varchar(32) NULL;

COMMENT ON COLUMN public.dispatch_queue.driver_seen_at IS
  'First UI render ack from driver client; telemetry P0 — no TTL side effects yet.';

COMMENT ON COLUMN public.dispatch_queue.driver_seen_source IS
  'socket | poll | push | requests — client-declared ingress channel.';
```

**Index (opsiyonel, Phase 1 düşük hacim):**

```sql
CREATE INDEX IF NOT EXISTS idx_dispatch_queue_unseen_sent
  ON dispatch_queue (driver_id, tag_id)
  WHERE status = 'sent' AND driver_seen_at IS NULL;
```

**Backend kod güncellemesi (gelecek patch):**

- `DISPATCH_QUEUE_DB_KEYS` — **Phase 1’de insert’e ekleme** (seen endpoint update ile yazılır)
- Feature flag: `DISPATCH_OFFER_SEEN_TELEMETRY=1` (default off prod until rollout)

**RLS:** Mevcut SELECT policy yeterli; UPDATE service role / backend only (QM ile aynı model).

---

### B.4 Backend endpoint tasarımı

#### `POST /api/driver/offer-seen`

**Auth:** Mevcut driver endpoint pattern — `user_id` / JWT `resolve_user_id`.

**Request body:**

```json
{
  "tag_id": "uuid",
  "source": "socket"
}
```

| Alan | Zorunlu | Değerler |
|------|---------|----------|
| `tag_id` | Evet | UUID string |
| `source` | Hayır | `socket` \| `poll` \| `push` \| `requests` |

**Handler mantığı (telemetry-only):**

```
1. resolve_user_id(driver)
2. Validate tag_id format
3. tags SELECT status WHERE id=tag_id
   → status NOT IN (waiting) → log [offer_seen_skip_tag_status] → 200 { recorded: false, reason: "tag_not_waiting" }
4. dispatch_queue UPDATE
     SET driver_seen_at = now(), driver_seen_source = source
     WHERE tag_id = ? AND driver_id = ? AND status = 'sent' AND driver_seen_at IS NULL
5. If update.data empty:
     → SELECT exists sent/expired/accepted row for audit
     → log [offer_seen_no_row] or [offer_seen_already]
     → 200 { recorded: false, reason: "no_sent_row" | "already_seen" }
6. If update.data present:
     → log [offer_seen] tag_id=... driver_id=... source=... latency_ms=...
     → 200 { recorded: true, driver_seen_at: ISO }
```

**Davranış değiştirmez:**

- Tag TTL, rolling timer, revoke, dedupe — **dokunulmaz**
- `expires_at` extend — **yok** (QM `_compute_seen_extended_expires_at` Phase 2)
- 404 yerine 200 no-op — client spam-safe

**Response örneği:**

```json
{ "success": true, "recorded": true, "driver_seen_at": "2026-06-21T12:00:00Z" }
```

---

### B.5 Log formatı

Structured single-line (JSON veya key=value):

```
[offer_seen] tag_id=<uuid> driver_id=<masked> source=socket recorded=1 sent_to_seen_ms=<optional>
[offer_seen_already] tag_id=... driver_id=... source=poll
[offer_seen_no_row] tag_id=... driver_id=... source=requests hint=broadcast_or_poll_only
[offer_seen_skip_tag_status] tag_id=... status=matched
[offer_seen_rate_limited] driver_id=... tag_id=...
```

**`sent_to_seen_ms` (Phase 1 opsiyonel):** `now - dispatch_queue.sent_at` — P0 metrik altın.

QM referans logları:

- `quick_match_invite_seen invite_id=...`
- `_mark_driver_seen_if_needed` → `.is_("driver_seen_at", "null")` idempotent

---

### B.6 Frontend çağrı noktaları

#### Birincil hook — kart render (hedef)

**Dosya:** `frontend/components/DriverOfferScreen.tsx`  
**Bileşen:** `RequestCard` (satır ~1100)

**Tetik:** Kart DOM’a mount + layout tamamlandığında **bir kez**.

Önerilen pattern:

```typescript
// RequestCard içinde — pseudocode, uygulanmadı
const seenReportedRef = useRef(false);
const onCardLayout = () => {
  if (seenReportedRef.current) return;
  seenReportedRef.current = true;
  reportOfferSeen({ tag_id: request.id, source: request._ingressSource ?? 'requests' });
};
// View onLayout={onCardLayout}
```

**Neden `RequestCard`:**

- `FlatList` `renderItem` — gerçek teklif kartı burada
- `fadeAnim` useEffect ≠ görünürlük (below-fold olabilir)
- **İyileştirme (P0.1):** `FlatList` `onViewableItemsChanged` + `viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}` — yalnız viewport’taki kartlar seen raporlar

#### Ingress source propagation

`requests` state’ine append edilirken `_ingressSource` (internal, API’ye gönderilir) set edilmeli:

| Append yolu | Dosya | `source` |
|-------------|-------|----------|
| Socket `new_passenger_offer` | `index.tsx` `onTagCreated` / `useSocket` `handleNewTag` | `socket` |
| `loadDispatchPendingOffer` | `index.tsx` ~17358 | `poll` |
| `loadRequests` merge | `index.tsx` ~18129 | `requests` |
| Push foreground / tap | `fetchAndAppendOfferFromTagId` ~15258 | `push` |

**`useSocket.ts`:** `handleNewTag` → `onTagCreated` callback; source socket olarak parent’ta işaretlenir.

#### Çağrı yapılmayacak yerler

- Ses çalma (`notifyDriverNewOfferSoundFromRealtimeOffer`) — ses ≠ görüldü
- `setRequests` öncesi — liste güncellemesi ≠ render
- `driver/requests` API response handler alone — kart render olmadan seen sayılmaz

#### Feature flag (client)

```typescript
const OFFER_SEEN_TELEMETRY_ENABLED = __DEV__ || remoteConfig; // Phase 1 rollout
```

---

### B.7 Deduping

#### Client-side

| Mekanizma | Spec |
|-----------|------|
| `seenReportedRef` per `tag_id` | Kart başına bir kez |
| Global `Set<string>` `driverOfferSeenSentRef` | Unmount/remount duplicate önleme |
| Retry | **Yok** — fail silent (telemetry) |
| Debounce | Gerek yok (single-fire) |

#### Backend-side

| Mekanizme | Spec |
|-----------|------|
| DB | `UPDATE ... WHERE driver_seen_at IS NULL` — QM ile aynı |
| Rate limit | Driver başına max **30 req/min** tüm tag’ler (spam) |
| Per (driver, tag) | Idempotent — ikinci POST → `already_seen`, 200 |

---

### B.8 Risk analizi

| Risk | Açıklama | Azaltma |
|------|----------|---------|
| **Spam request** | FlatList re-render loop | client ref + backend rate limit |
| **Wrong user** | Başka driver tag_id POST | `resolve_user_id` + queue row driver_id match |
| **Tag matched/cancelled** | Geç seen | status check; 200 no-op; log skip |
| **Missing dispatch_queue row** | Broadcast / poll-only görünüm | 200 `no_sent_row`; log — **beklenen** |
| **Duplicate tag_id rows** | UNIQUE(tag_id, driver_id) — yok | — |
| **Below-fold false negative** | Kart listede ama görünmedi | P0.1 viewability threshold |
| **Privacy** | source + tag_id log | driver_id mask (`_mask_log_id`) |
| **Multi-worker** | Update her node’da DB — OK | Stateless endpoint |

---

### B.9 Rollback

| Katman | Rollback |
|--------|----------|
| Migration | Kolonlar nullable; drop optional later |
| Backend flag | `DISPATCH_OFFER_SEEN_TELEMETRY=0` → endpoint 404 veya no-op |
| Frontend flag | `OFFER_SEEN_TELEMETRY_ENABLED=false` → zero calls |
| Davranış | Hiçbir Phase 1 değişikliği TTL/revoke etkilemez — rollback = metrik kaybı only |

---

### B.10 En küçük güvenli patch planı (sıralı PR)

| PR | Kapsam | Davranış değişir mi? |
|----|--------|----------------------|
| **PR-1** | Migration `driver_seen_at`, `driver_seen_source` | Hayır |
| **PR-2** | `POST /driver/offer-seen` + flag off default | Hayır (flag off) |
| **PR-3** | `RequestCard` onLayout + `reportOfferSeen` + source propagation | Hayır (flag gated) |
| **PR-4** | Ops: flag on staging → `sent_to_seen_ms` dashboard | Hayır |
| **PR-5 (Phase 2)** | Seen → TTL extend / revoke guard | **Evet** — ayrı onay |

**Bağımlılık:** PR-1 → PR-2 → PR-3. Production’da PR-2 flag=0 merge safe.

**Kabul kriterleri (Phase 1):**

- [ ] Socket ile gelen teklif → `[offer_seen]` within 5s (render)
- [ ] Poll ile gelen → source=poll
- [ ] Duplicate POST → `already_seen`, DB single timestamp
- [ ] Matched tag POST → skip, no error
- [ ] Rolling revoke timing **değişmedi** (A/B log compare)

---

## Part C — Quick Match Pattern Referansı

`backend/services/quick_match.py`:

```python
def _mark_driver_seen_if_needed(...):
    if invite_row.get("driver_seen_at") is not None:
        return
    upd = supabase.table(...).update({"driver_seen_at": now_iso, ...})
        .eq("id", iid)
        .eq("status", INVITE_STATUS_PENDING)
        .is_("driver_seen_at", "null")
        .execute()
```

**Normal dispatch P0 farkları:**

| QM | Normal dispatch P0 |
|----|---------------------|
| Poll-triggered seen | UI render-triggered |
| TTL extend on seen | **Yok** |
| Table `quick_match_invites` | `dispatch_queue` |
| status `pending` | status `sent` |

---

## Part D — Document Index

| Konu | Bölüm |
|------|-------|
| Mimari özet | A.1 |
| Lifecycle | A.2 |
| Kaçma nedenleri | A.5 |
| Migration | B.3 |
| Endpoint | B.4 |
| Frontend hooks | B.6 |
| Dedupe | B.7 |
| Rollback | B.9 |
| Patch sırası | B.10 |

---

## Non-Goals (bu patch)

- Kod, commit, production config değişikliği yok  
- TTL / revoke / dedupe bypass yok  
- `driver/requests` veya rolling batch logic değişikliği yok  
- WAV / UI / Brand DNA yok

**Sonraki adım:** PR-1 migration review + PR-2 endpoint spec sign-off (flag off merge).
