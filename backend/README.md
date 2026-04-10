# Backend — LeylekTag

## Giriş noktası

- **Canlı uygulama:** `server.py` — FastAPI `app`, Socket.IO, `api_router` prefix `/api`.
- **Ortam:** `backend/.env` (repoya commit etmeyin) — Supabase, NetGSM, Google Maps, Agora, İyzico, `ANTHROPIC_API_KEY` (Leylek Zeka Claude), vb.

## Ortam değişkenleri (tek kaynak — prod)

- **Uygulamanın okuduğu dosya:** `server.py` ve `supabase_client.py` ikisi de `Path(__file__).parent / ".env"` yükler → **`backend/.env`** (repo kökündeki `.env` **otomatik okunmaz**).
- **Öncelik sırası:** Süreç başlarken zaten set edilmiş ortam değişkenleri (ör. **systemd** `Environment=` / `EnvironmentFile=`) **önce** gelir. `python-dotenv` varsayılanında (`override=False`) **aynı isimde bir değişken zaten doluysa** `.env` içindeki satır **üzerine yazmaz**.
- **NetGSM gönderici (log’daki Sender):** `NETGSM_MSGHEADER`, yoksa `NETGSM_MNGHEADER` (alias); ikisi de boşsa `usercode`. Kodda sabit `"KAREKOD AS"` yok; değer tamamen env’den gelir.
- **Prod tekilleştirme:** NetGSM ve diğer backend secret’ları için **tek otorite** olarak `backend/.env` kullanın; systemd’de aynı anahtarları **yinelenen** şekilde tanımlamayın. Kök `.env` kullanmayacaksanız dokümante edin veya `backend/.env` ile hizalayın (ör. sembolik link — operasyon kararı).

## Önemli uyarı

`server.py` on binlerce satır; çoğu HTTP route ve iş kuralları burada. Leylek Zeka **ayrı** router: `routes/ai.py` → `controllers/ai_controller.py`.

## Modül özetı

| Alan | Konum |
|------|--------|
| Supabase | `supabase_client.py` |
| Rota / Directions | `route_service.py` |
| Çağrı | `call_service.py` |
| Push | `services/push_notification_service.py`, `expo_push_channels.py` |
| Ödeme | `services/iyzico_payment_service.py` |
| Leylek Zeka deterministic | `services/answer_engine/` ([README](services/answer_engine/README.md)) |
| Leylek Zeka HTTP | `routes/ai.py` |
| Yasal metinler (JSON) | `routes/legal.py` (`/api/legal/*`) |

## Legacy

`server_supabase.py`, `server_mongodb_backup.py`, `server_old.py` — yedek / eski; varsayılan süreç `server.py`.
