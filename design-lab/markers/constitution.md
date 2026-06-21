# LeylekTAG Marker Constitution

Bu belge, LeylekTAG harita marker'larının görsel dilini tanımlar. Araba, motor ve insan marker'ları aynı aileden gelmeli; ancak haritada birbirinden net ayrılmalıdır. Tüm tasarım ve üretim çalışmaları bu ilkelerle uyumlu olmalıdır.

---

## 1. Premium

Marker'lar ucuz veya amatör görünmemeli; kaliteli bir mobil uygulama deneyimini yansıtmalı.

**Rehberlik:** Temiz çizgiler, dengeli oranlar ve özenli detay seçimi kullanın. Düşük kaliteli gradient'ler, rastgele gölge yığınları veya dağınık renk paletleri premium algısını zayıflatır. Her piksel haritada küçük boyutta da “işlenmiş” görünmeli.

---

## 2. Güven veren (Trustworthy)

Kullanıcı marker'a baktığında güven ve istikrar hissetmeli; belirsiz veya aldatıcı bir görsel dil kullanılmamalı.

**Rehberlik:** Net siluet, tutarlı yön ve okunabilir form tercih edin. Aşırı soyutlama veya “oyun içi power-up” hissi veren formlar güven algısını düşürür. Marker, gerçek dünyadaki varlığı (araç, motor, insan) tanınabilir biçimde temsil etmeli — abartılı fantezi öğelerden kaçının.

---

## 3. Minimal

Gereksiz detay yok; her öğe bir işlev taşımalı.

**Rehberlik:** Küçük harita ölçeğinde kaybolan ince çizgiler, iç detaylar ve çok katmanlı şekillerden kaçının. Tek veya iki ana form ile tanınabilirlik hedefleyin. Boşluk (negatif alan) aktif bir tasarım öğesi olarak kullanılmalı.

---

## 4. Haritada küçük boyutta okunabilir

Marker'lar tipik harita zoom seviyelerinde — özellikle 24–40 px görünür alan civarında — net seçilebilir olmalı.

**Rehberlik:** Yüksek kontrast, kalın ana siluet ve sade iç yapı tercih edin. İnce detaylar büyük önizlemede güzel görünse bile küçük boyutta test edin. PNG ve SVG export'larında birden fazla boyutta (ör. 24, 32, 48 px) kontrol yapın.

---

## 5. Araba / motor / insan birbirinden net ayrılır

Üç marker türü aynı tasarım dilini paylaşır; ancak haritada yan yana geldiğinde anında ayırt edilebilir olmalı.

**Rehberlik:**
- **Araba:** Dört tekerlek, geniş gövde, yatay siluet — “otomobil” okuması
- **Motor:** İki tekerlek, dar gövde, daha dikey veya dinamik siluet — “motosiklet” okuması
- **İnsan:** Ayakta figür, baş–gövde–bacak oranı — “yaya / kişi” okuması

Renk, boyut veya ikon ailesi farkı tek başına yeterli değil; **form farkı** birincil ayırtıcı olmalı.

---

## 6. Abartılı lüks değil

Premium olmalı; ancak gösterişli lüks, altın kaplama veya ağır “premium badge” estetiği kullanılmamalı.

**Rehberlik:** Sessiz güven ve kalite; parlak mücevher efektleri, aşırı metalik yansımalar veya “VIP” rozeti hissi veren öğelerden uzak durun. LeylekTAG'in günlük kullanım odaklı, erişilebilir premium karakterini koruyun.

---

## 7. Oyuncak gibi değil

Çizgi film, emoji veya oyuncak araba estetiği hedeflenmemeli.

**Rehberlik:** Yuvarlak “balon” formlar, büyük gözler, aşırı pastel veya candy renkler, sticker/clipart havası uygun değil. Dijital premium ikon dili — net, yetişkin ve işlevsel — tercih edilir.

---

## 8. Dark theme ile uyumlu

Uygulamanın koyu arayüzü ve koyu harita katmanlarıyla uyumlu olmalı; açık zemin üzerinde kaybolmamalı.

**Rehberlik:** Koyu arka planlarda okunabilirlik için yeterli parlaklık ve kontrast sağlayın. Tam siyah (#000) siluetler harita detaylarıyla çakışabilir; hafif aydınlatma, ince kenar veya kontrollü vurgu rengi düşünün. Neon patlaması yerine **kontrollü dijital enerji** kullanın.

---

## 9. İleride white theme ile de uyumlu olacak

Tasarım yalnızca dark mode için optimize edilmemeli; gelecekte açık tema desteği için esnek bir renk mantığı kurulmalı.

**Rehberlik:** Tek renkli koyu siluet + vurgu rengi yapısı veya tema-bağımsız form önceliklendirin. Aşırı koyu gölgeler ve yalnızca koyu zeminde çalışan efektlerden kaçının. İki tema için ayrı renk varyantları üretilebilir; form ve siluet her iki temada aynı kalır.

---

## 10. Sonic / UI / marka diliyle aynı karakteri taşıyacak

Marker'lar uygulamanın ses tasarımı (Sonic), arayüz bileşenleri ve genel marka diliyle aynı “LeylekTAG karakterini” yansıtmalı.

**Rehberlik:** UI'daki ikon ağırlığı, köşe yuvarlaklığı, renk vurguları ve hareket hissi marker'lara yansımalı. Marker bir “harici clipart” gibi durmamalı; uygulama içinde doğal görünmeli. Yeni marker üretmeden önce mevcut UI ikonları ve marka referanslarını `references/` altında toplayın ve karşılaştırın.

---

## Özet kontrol listesi

Her marker varyasyonu için şunları sorun:

- [ ] Premium ve minimal mi?
- [ ] Küçük boyutta okunabilir mi?
- [ ] Türü (araba / motor / insan) formdan anlaşılıyor mu?
- [ ] Oyuncak veya abartılı lüks hissi veriyor mu? (vermemeli)
- [ ] Dark theme'de net mi?
- [ ] White theme'e taşınabilir bir renk mantığı var mı?
- [ ] LeylekTAG UI ve marka diliyle uyumlu mu?
