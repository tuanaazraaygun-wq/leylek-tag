# Answer Engine (Leylek Zeka deterministic katmanı)

**Amaç:** Kullanıcı mesajını intent’lere eşleyip **sabit şablon** yanıtlar döndürmek (ML yok). Leylek Zeka HTTP akışında **Claude’dan önce** çalışır.

## Giriş noktası

- Dışarıdan import: `from services.answer_engine import try_resolve` (veya `matcher.try_resolve`).
- Tanımlar: `catalog.py` → `INTENT_DEFINITIONS`.
- Eşleme: `matcher.py` — `try_resolve(message, context) -> ResolvedAnswer | None`.

## Dosyalar

| Dosya | İş |
|-------|-----|
| `__init__.py` | Public export’lar |
| `catalog.py` | Intent id, `match_phrases`, şablon metinler |
| `matcher.py` | Normalize, skor, rol uyumu, `try_resolve` |
| `normalize.py` | Metin normalizasyonu (Türkçe karakter vb.) |
| `telemetry.py` | Çözüm telemetrisi |
| `coverage.py` | Admin / coverage payload |

## Orchestrator ilişkisi

`controllers/ai_controller.py` içinde `get_leylek_zeka_reply` önce `try_resolve` çağırır; sonuç varsa `source=answer_engine` döner.

## Genişletme

Yeni intent: `catalog.py` içine `IntentDefinition` ekleyin; gerekirse `matcher.py`’de ceza / özel kural (ör. teklif vs mesaj ayrımı).
