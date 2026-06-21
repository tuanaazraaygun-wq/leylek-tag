# LeylekTAG Legal DNA v1

**Phase:** P2-L1  
**Version:** v1.0  
**Parent:** `LEGAL_CONSTITUTION_V1.md`

---

## 1. Legal DNA tanımı

Legal DNA, LeylekTAG hukuk belgelerinin **değişmeyen karakterini** tanımlar — tıpkı Logo DNA'nın marka siluetini kilitlemesi gibi.

| DNA ekseni | Oran (rehber) | Hukuk ifadesi |
|------------|---------------|---------------|
| **Şeffaflık** | %22 | Veri ne, neden, ne kadar — açık |
| **Güven** | %20 | QR, doğrulama, güven ağı kuralları net |
| **Platform sınırı** | %18 | Aracı platform — taşımacı değil |
| **Kullanıcı sorumluluğu** | %15 | Yolculuk riski taraflarda |
| **Topluluk** | %12 | Muhabbet, teklif, kurallar |
| **Uyum** | %10 | KVKK, 5651, tüketici |
| **Erişilebilirlik** | %3 | Sade dil, madde yapısı |

---

## 2. Platform gerçeği (hukuk DNA anchor)

Belgeler aşağıdaki **ürün gerçeklerini** yansıtmalıdır; çelişki yasak.

| Gerçek | Hukuk DNA |
|--------|-----------|
| Yolcu–sürücü eşleştirme platformu | Aracılık hizmeti |
| QR boarding doğrulama | Operasyonel güven katmanı |
| Güven ağı / Trusted Direct | Opt-in, çift taraflı onay |
| Leylek Teklifi / Muhabbet | İletişim modülü — saklama sınırlı |
| VoIP / ses | Metadata + opsiyonel ses saklama |
| Konum | Aktif kullanım / yolculuk bağlamı |
| Ödeme | Taraflar arası; platform tahsilat yapmaz (mevcut) |
| Hesap silme | Uygulama içi + 30 gün silme |
| Ehliyet / araç foto | Sürücü doğrulama — KYC |

**Drift uyarısı:** `frontend/app/terms.tsx` §5 komisyon/üyelik ifadesi — `legal-content.ts` ile çelişir. SSOT'ta **tek ifade** (masraf paylaşımı, platform tahsilat yapmaz).

---

## 3. Veri sınıfları (cross-document)

Tüm belgeler aynı taksonomiyi kullanır:

| Sınıf ID | İçerik | KVKK | Gizlilik | Saklama |
|----------|--------|------|----------|---------|
| `data.identity` | Ad, telefon, profil | ✓ | ✓ | Üyelik |
| `data.location` | GPS, rota | ✓ | ✓ | Aktif trip |
| `data.trip` | Teklif, eşleşme, geçmiş | ✓ | ✓ | 5 yıl trip |
| `data.communication` | Muhabbet, VoIP meta | ✓ | ✓ | 7 gün msg |
| `data.driver.kyc` | Ehliyet, plaka, araç foto | ✓ | ✓ | Üyelik |
| `data.technical` | IP, device, push token, log | ✓ | ✓ | Mevzuat |
| `data.trust` | Güven ağı graph, davet | ✓ | ✓ | Üyelik |
| `data.consent` | Onay kayıtları | ✓ | — | Yasal süre |
| `data.payment.meta` | IBAN (varsa) — sürücü | ✓ | ✓ | İşlem |

---

## 4. Saklama DNA (canonical matrix — hedef)

| Veri | Süre | Kaynak today |
|------|------|--------------|
| Hesap bilgileri | Üyelik süresince | kvkk, legal-content |
| Trip kayıtları | 5 yıl | kvkk |
| Muhabbet mesaj/ses | 7 güne kadar | Tüm kaynaklar uyumlu |
| Ehliyet/araç | Üyelik süresince | kvkk |
| Log kayıtları | Mevzuat süresi | kvkk |
| Hesap silme execution | 30 gün | hesap-silme |
| Consent logs | 10 yıl (öneri) | **Yeni** — P2-L3 |

---

## 5. Rol bazlı belge DNA

| Rol | Zorunlu belgeler (kayıt/onay) |
|-----|--------------------------------|
| **Yolcu** | terms-user, privacy, kvkk, explicit-consent, age |
| **Sürücü** | + terms-driver, KYC consent |
| **Güven ağı** | + trust-network (davet anında) |
| **Trusted Direct** | + trusted-direct |
| **QR boarding** | qr-usage (bilgilendirme) |

---

## 6. Dil DNA

| Kural | Detay |
|-------|-------|
| Birincil dil | Türkçe (tr) — master |
| İkincil | English (en) — privacy, store, delete-account |
| Ton | Profesyonel, sade, tehditkar değil |
| Yapı | Numaralı maddeler + `LegalSection` headings |
| Yasak | Hukuki boşluk dolduran belirsiz "vb." |
| Zorunlu | Veri sorumlusu bloğu her aydınlatmada |

---

## 7. Ürün modül → belge DNA map

| Modül | Belgeler |
|-------|----------|
| Kayıt / OTP | kvkk, privacy, explicit-consent, terms-user |
| Sürücü KYC | terms-driver, kvkk (sürücü veri) |
| Teklif / eşleşme | trip-rules, terms-user |
| QR boarding | qr-usage, trip-rules |
| Güven Al / Ver | trust-give-receive, trust-network |
| Trusted Direct | trusted-direct, trust-network |
| Muhabbet | community-guidelines, privacy (communication) |
| Rating | community-guidelines |
| Hesap silme | data-destruction, kvkk-application |
| Website çerez | cookie-policy |
| Gelecek abonelik | subscription-terms, cancellation-refund |
| Destek | support-policy |
| Moderasyon | community-enforcement, appeal-policy |

---

## 8. Mevcut içerikten korunacak DNA

`legal-content.ts` + `kvkk` route (Mayıs 2026) hizalı içerik:

- Karekod Teknoloji veri sorumlusu
- Meşrutiyet Mah. adres
- Konum: aktif kullanım only
- Muhabbet 7 gün
- 5651 uyum maddesi (gizlilik)
- Ankara mahkeme yetkisi (kullanım)
- Platform taşımacılık sunmaz
- Yurt dışı aktarım (Supabase, Google Maps)

---

## 9. Retire edilecek DNA (eski)

| Kaynak | Neden |
|--------|-------|
| Leylek Teknoloji A.Ş. | Yanlış entity |
| leylekapp.com | Yanlış iletişim |
| Karanfil Mah. No:23 | Eski adres |
| Ocak 2025 API metinleri | Stale |
| Aralık 2024 KVKKComponents | Stale |

---

## 10. Beslediği sistemler

| Sistem | DNA kullanımı |
|--------|---------------|
| Website legal pages | Section headings + retention |
| Mobile consent | Mandatory doc list |
| Backend API | JSON section export |
| Store Data Safety | Data class inventory |
| Admin moderation | Enforcement DNA |
| Product copy | guvenlik page — marketing only, legal link |

---

**İlişkili:** `LEGAL_STANDARDS_V1.md`, `DOCUMENT_MATRIX.md`
