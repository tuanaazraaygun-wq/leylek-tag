# LeylekTAG Marker Lab

Bu klasör, LeylekTAG uygulaması için harita marker tasarımlarını keşfetmek ve geliştirmek amacıyla oluşturulmuş bir **marka dili çalışma alanıdır**.

## Amaç

- Araç (araba), motor ve insan marker'larının görsel dilini tanımlamak ve denemek
- Tasarım ilkelerini (`constitution.md`) referans alarak tutarlı bir marker ailesi oluşturmak
- AI ve tasarım araçları için prompt'ları (`prompts/`) kullanmak
- Referans görselleri toplamak (`references/`)
- Üretilen çıktıları düzenli biçimde saklamak (`exports/`)
- Henüz kesinleşmemiş denemeleri ayırmak (`drafts/`)

## Bu alan ne için değil?

- Canlı frontend veya backend koduna doğrudan entegrasyon
- Uygulama içi asset yönetimi veya build süreçlerine dahil etme
- Production marker'larının tek kaynak olarak buradan deploy edilmesi

Marker'lar üretim ortamına taşınmadan önce uygulama kodunda ayrı bir entegrasyon adımı gerektirir.

## Klasör yapısı

| Klasör | İçerik |
|--------|--------|
| `constitution.md` | Marker tasarım ilkeleri ve marka karakteri |
| `prompts/` | Marker türüne özel AI üretim prompt'ları |
| `references/` | İlham ve referans görseller |
| `exports/svg/` | Nihai veya yarı nihai SVG çıktıları |
| `exports/png/` | Raster (PNG) çıktıları |
| `exports/lottie/` | Animasyonlu Lottie çıktıları |
| `drafts/` | Kesinleşmemiş denemeler ve varyasyonlar |

## Çalışma akışı (öneri)

1. `constitution.md` dosyasını okuyun — tüm marker'lar bu ilkelerle uyumlu olmalı.
2. İlgili marker türü için `prompts/` altındaki prompt dosyasını kullanın.
3. Referansları `references/` altına ekleyin.
4. Denemeleri `drafts/` altında tutun; olgun varyasyonları `exports/` altına taşıyın.
5. Entegrasyon kararı verildiğinde çıktıları uygulama ekibiyle paylaşın — bu klasörden otomatik entegrasyon yapılmaz.

## Marker türleri

- **Araba** — `prompts/car-marker.prompt.md`
- **Motor** — `prompts/motor-marker.prompt.md`
- **İnsan** — `prompts/human-marker.prompt.md`
