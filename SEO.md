# Motoseyir — SEO Rehberi

Son güncelleme: 20 Ekim 2026 (`seo-2026-10-20` dalı). Alan adı: https://motoseyir-app.com (GitHub Pages, `CNAME`).
Site statik ve **üretilmiş**: 14 dil × 4 sayfa (anasayfa, özellikler, nasıl yapılır, AI CoRider) = 56 sayfa, ayrıca
2 gizlilik sayfası (elle), 2 reklam yönlendirme sayfası (`/indir/`, `/get/`, `noindex`) ve `404.html`. **25 Eki 2026'dan beri rehber merkezi var** (Bölüm 6: 6 dilde 19 sayfa).
Metinler `dil/*.json`, yapı `sablon/*.html`, SEO etiketleri `uret.py` içinde; ayrıntı için `README.md`.

## 1. Anahtar kelime haritası

**Veri kaynağı ve sınırı.** Google Search Console / Keyword Planner verisi yok (mülk yeni doğrulanıyor, bkz. Bölüm 4).
Talep göstergesi olarak Apple Ads **arama terimi raporu** (14 Motoseyir kampanyası, 20 Eyl – 19 Eki 2026; salt okuma) ve
`moto-rota/store/aso-kapsamli-2026-10-04.md` kullanıldı. Bu rakipler App Store aramasının gösterimleridir, Google web arama
hacmi değil; niyet olarak yakın ama birebir değil. Seçimler Search Console "Performans" raporu dolunca doğrulanmalı.
Rakip marka adları başlık/açıklama/H1'de kullanılmadı (reklamda rakip adları en çok gösterimi alıyor, ama sitede yeri yok).

Apple Ads 30 gün — jenerik (markasız) terimler, **gösterim / dokunuş / indirme**:

| Pazar | Terimler |
|---|---|
| TR | motosiklet navigasyon 206/24/11 · motosiklet rota 168/2/0 · motosiklet uygulaması 111/5/1 · moto rota 93/3/1 · motor turu 36/0/0 · kurye uygulaması 25 · rota planlayıcı 22 · motor rota 21/3/4 · kurye rotası 21 · motorcu uygulaması 20 · motor navigasyon 17/8/3 |
| US-CA + GB-IE | moto gps 143 · motorcycle app 87 · motorcycle route planner 27 · motorcycle ride app 13 · motorcycle gps 9 · twisty road 5 · motorcycle navigation 4 |
| DE/AT/CH | motorrad navi 35/6/1 · motorrad navigation 31/4/1 · motorradtouren 22 · motorrad routenplaner 5 · alpenpässe 5/1/1 |
| FR | gps moto 104/11/3 · balade moto 48/6/2 · gps moto gratuit 10/5/1 · itinéraires moto 6 |
| ES | gps moto 20 · app para moteros 11/3/2 · navegador para moto 4 · rutas en moto 3 |
| NL-BE | motor gps 24/2/1 · motor navigatie 4/1/0 |
| IT | moto gps 8 · navigatore moto 3 · percorsi moto 3 |

Türkçe + İngilizce harita (diğer 12 dilin karşılıkları `dil/*.json`'da; tablo altında):

| Sayfa | Birincil kelime | İkincil / uzun kuyruk | Not |
|---|---|---|---|
| `/` (TR) | motosiklet navigasyon | motosiklet rota, motor turu planlama, köy yolu, dağ geçidi, grup sürüşü, CarPlay, interkom, "motosiklet navigasyonu ücretsiz mi" (SSS) | Title "Motosiklet Navigasyon ve Rota Uygulaması" |
| `/en/` | motorcycle gps / motorcycle navigation | motorcycle route planner, motorcycle app, back roads, tour planning, mountain passes, group rides, CarPlay | EN pazarda "gps" gösterimi "navigation"ın ~30 katı → Title'da GPS, açıklamada navigation |
| `/ozellikler.html` | motosiklet navigasyon uygulaması özellikleri | en kısa rota, çok duraklı sıralama (kurye), efsane rotalar, tur günlüğü, interkom | H1 birincil kelimeyi taşıyor |
| `/nasil-yapilir.html` | motosiklet navigasyonu nasıl kullanılır | rota oluşturma, çok duraklı tur, sürüş kaydı, grup sürüşü | H1 marka sesinde bırakıldı (bkz. Bölüm 3) |
| `/corider.html` | AI CoRider | sesli motosiklet asistanı, kaskta sesli yol arkadaşı, yapay zekâ motosiklet | marka + niş |
| Yerel anasayfalar | DE motorrad navi · FR gps moto · IT navigatore moto · ES gps/navegador para moto · NL motor gps/motornavigatie · PL nawigacja motocyklowa · CS/SK navigace/navigácia na motorku · HU motoros navigáció · RO navigație moto · HR moto navigacija · EL πλοήγηση μοτοσυκλέτας | yukarıdaki arama terimleri + ASO notundaki yerel sıralama terimleri | |

Başlık ve açıklama (TR / EN, uzunluk: başlık ≤ 60, açıklama 140–160):

| Sayfa | TR başlık (karakter) | EN başlık (karakter) |
|---|---|---|
| anasayfa | Motosiklet Navigasyon ve Rota Uygulaması — Motoseyir (52) | Motorcycle GPS and Route Planner App — Motoseyir (48) |
| özellikler | Motosiklet Navigasyon Uygulaması Özellikleri — Motoseyir (56) | Motorcycle Navigation App Features — Motoseyir (46) |
| nasıl yapılır | Motosiklet Navigasyonu Nasıl Kullanılır? — Motoseyir (52) | How to Use Motoseyir Motorcycle Navigation, Step by Step (56) |
| AI CoRider | AI CoRider: Motosiklet İçin Sesli Yol Arkadaşı — Motoseyir (58) | AI CoRider — AI Voice Assistant for Motorcycles \| Motoseyir (59) |

Kelime kullanım ilkesi: birincil kelime title, meta description, ilk ekrandaki küçük başlık (hero eyebrow) ve metinde;
ikincil kelimeler description ve SSS'de doğal biçimde. Şişirme yapılmadı. TR anasayfanın görünür metninde "motosiklet
navigasyonu" ifadesi daha önce hiç geçmiyordu (yalnız description'da); eyebrow ve SSS ile eklendi.

## 2. Yapılan değişiklikler

Her şey `uret.py` + şablon + dil dosyaları üzerinden; üretilen 56 sayfa yeniden yazıldı. Tasarım, CSS, JS, görseller, video,
`/indir/` ve `/get/` (ölçüm işareti, `ct` işleme, bağlantılar) **değişmedi**; App Store bağlantıları (`pt`/`ct`) aynen duruyor.

- **Başlık ve açıklamalar (14 dil × 4 sayfa)**: 56 başlık ≤ 60, 56 açıklama 140–160 karakter (öncesinde 48 açıklama 160'ı
  aşıyordu, 241 karaktere kadar; 4 başlık 60'ı aşıyordu). Dil ve pazar terimleri yukarıdaki tabloya göre seçildi. Her dil
  için aynı dildeki sayfaların başlık ve açıklamaları tekil.
- **`og:*` ve `twitter:*`**: artık başlık ve açıklamayla birebir aynı (öncesinde 56 sayfanın 42'sinde og:description meta description'dan farklıydı; twitter:title/
  description/image yoktu); `og:image:width/height/type` eklendi (1200×630). Eski `og_*` dil anahtarları kaldırıldı.
  Tek yerde üretiliyor: `{{seo_head}}`.
- **robots meta**: `index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1`.
- **JSON-LD** (`{{json_ld}}`, `uret.py` içinde `json_ld()`): `@graph` ile Organization (logo = uygulama simgesi 512×512, sameAs
  iki Instagram hesabı), WebSite, WebPage (`dateModified`, `primaryImageOfPage`), BreadcrumbList (alt sayfalarda),
  **MobileApplication** (iOS, NavigationApplication, ücretsiz + Pro teklifleri, `downloadUrl` = mevcut `pt`/`ct` bağlantısı,
  ekran görüntüleri) ve FAQPage (yalnız görünür SSS'si olan anasayfa ve AI CoRider). `aggregateRating` / `review` yok.
  Önceden anasayfada yalnız SoftwareApplication, AI CoRider'da WebPage+FAQPage vardı; özellikler ve nasıl yapılır
  sayfalarında hiç yoktu. Gizlilik sayfalarına WebPage+BreadcrumbList eklendi.
- **Anasayfaya görünür SSS** (`#sss`, 6 soru, 14 dilde): Motoseyir nedir, ücretsiz mi, diğer navigasyonlardan farkı, hangi
  ülkelerde çalışır, CarPlay, grupla sürüş. Yanıtların tamamı sitede zaten yazan olgular (fiyat bölümü, `s1_t`, `hero_micro`,
  `k5_p`, Pro listesi). Mevcut `.izgara` stili; yeni CSS yok. FAQPage JSON-LD aynı anahtarlardan üretiliyor, `seo-denetim.py`
  görünür metinle eşitliği doğruluyor.
- **Hero eyebrow** (anasayfa, 14 dil): "Motorcunun navigasyonu" → "Motosiklet navigasyonu" (yerel karşılıkları). H1 dokunulmadı.
- **Özellikler sayfası H1**: "Motoseyir motosiklet navigasyonu: bütün özellikler" (+13 dil). Nasıl yapılır H1'i marka sesinde kaldı.
- **İç bağlantılar**: özellikler ve nasıl yapılır şablonlarındaki göreli `index.html`, `corider.html` vb. bağlantılar, `/de/`
  gibi dillerde `/de/index.html` gibi kanonik sayfanın kopya adresine gidiyordu; kanonik adreslere çevrildi. Anasayfaya
  ("Uygulamada daha neler var" bölümünün altına) özellikler ve nasıl yapılır sayfalarına bağlam içi bağlantı eklendi.
- **Gizlilik sayfaları**: TR sayfada description, canonical, og/twitter ve JSON-LD yoktu; eklendi; başlık "Gizlilik Politikası
  ve Destek — Motoseyir". Dil yönlendirme betiği (Türkçe tarayıcı dili yoksa İngilizce sayfaya atar) arama motoru robotlarını
  artık yönlendirmiyor (aksi hâlde Googlebot Türkçe gizlilik sayfasını Türkçe göremeyebilir); insan ziyaretçi davranışı aynı.
- **`404.html`** (noindex, kökten bağlantılar): GitHub Pages bulunamayan adreslerde varsayılan sayfa yerine bunu gösterir.
- **Simgeler**: `img/apple-touch-icon.png` (180) ve `img/uygulama-simgesi-512.png` (Organization logosu), ikisi de
  `moto-rota/assets/icon.png`'den küçültüldü.
- **Sitemap**: `lastmod` 2026-10-20. 58 adres, hreflang grupları (14 dil + x-default) zaten tamdı. `/indir/`, `/get/`, `404`
  sitemap'te yok. **robots.txt**: `Allow: /` + sitemap; `/indir/` ve `/get/` robots ile engellenmedi (engellenirse `noindex`
  okunamaz); yorum satırı düzeltildi.
- **`seo-denetim.py`** (yeni, yalnız standart kütüphane): yayından önce `python3 uret.py && python3 seo-denetim.py`. Başlık/açıklama
  sınırları, og/twitter eşitliği, canonical, hreflang karşılıklılığı, JSON-LD (ayrışma, FAQPage = görünür SSS, puan/yorum yasağı),
  `<img>` alt/width/height, dahili bağlantı ve `#parça` hedefleri, sitemap tutarlılığı, noindex sayfaların sitemap dışı olması.
  Kasıtlı bozulmuş bir kopyada 8 hata türünün hepsini yakaladı.

Doğrulama (bu dalda): 61 HTML dosyası, 3.691 dahili bağlantı, 58 sitemap adresi, 56+2 JSON-LD bloğu → sorun yok. Yerelde
`python3 -m http.server` ile anasayfa, `/en/`, özellikler, AI CoRider, gizlilik, `/indir/`, `/get/`, `404.html` açıldı;
masaüstü ve 375 px'te SSS ve hero kontrol edildi, konsol hatası yok.

Canlı sitenin (19 Ekim) denetim bulguları, düzeltilenler: 48 açıklama 160'ı aşıyor; 4 başlık 60'ı aşıyor; 42 sayfada og:description
meta description'dan farklı; twitter:title/description/image yok; özellikler ve nasıl yapılır sayfalarında JSON-LD yok;
anasayfada yalnız SoftwareApplication; AI CoRider'da BreadcrumbList/Organization/WebSite yok; TR gizlilik sayfasında
description, canonical, og yok ve JS yönlendirmesi robotu da yönlendiriyor; alt sayfa menü bağlantıları kanonik olmayan
`/xx/index.html`'e gidiyor; 404 sayfası varsayılan GitHub sayfası. Canlıda zaten doğru olanlar: canonical, hreflang (14 dil +
x-default, karşılıklı), `<html lang>`, tek H1, görsel alt/width/height, `/indir/` ve `/get/` noindex, sitemap'te yok, www/http
→ https://motoseyir-app.com yönlendirmeleri.

## 3. Sahibin onaylaması gereken noktalar

- **H1 anasayfa**: "Virajı seven motorcu için." / "For riders who love a corner." marka sesinde bırakıldı. Birincil kelime
  başlıkta, description'da, eyebrow'da ve SSS'de var; H1'de yok. H1'e "motosiklet navigasyonu" eklemek hero'da 3–4 satıra
  uzatır ve kelime kelime animasyonu etkiler; isterseniz birlikte bakarız.
- **Platform**: SSS ve JSON-LD yalnız olguları söylüyor; JSON-LD `operatingSystem: iOS` (önceki gibi). Android sürümü canlıysa
  (`moto-rota` içinde Android simgeleri var) `operatingSystem`, Play bağlantısı ve SSS'ye "Android'de var mı" eklenmeli.
- **Yerel diller**: 14 dilin başlık/açıklama/SSS metinlerinin hepsi bu çalışmada yazıldı; sitedeki mevcut çevirilerin sözlüğünden
  (arayüz terimleri, mod adları) kuruldu, ama ana dili konuşan biri bakmalı; en çok HU, EL, RO, HR, SK, CS, PL için.
- **`nasil-yapilir-1.1.6-taslak.html`**: ana çalışma dizininde (`~/Claude/motoseyir-site`) takipsiz bir taslak duruyor. Depoya
  eklenip yayınlanırsa `noindex`'siz, sitemap dışı, `/nasil-yapilir.html`'in kopyası olarak indekslenebilir. Yayınlanacaksa
  `<meta name="robots" content="noindex">` ekleyin ya da depoya koymayın.
- `uret.py` başındaki "uygulama ABD'de yok" yorumu eski (ABD açık); EN sayfası vitrinsiz App Store adresi kullanıyor, bu doğru
  çalışıyor, yorum güncellenebilir.
- Organization `sameAs`: `@motoseyir.app` ve `@motoseyir.app.en`. Başka resmî hesap (X, YouTube, TikTok) varsa eklenir.

## 4. Search Console ve Bing Webmaster Tools

**Durum (20 Ekim 2026).** Çalışma başlarken motoseyir-app.com sahibin hiçbir Search Console hesabında kayıtlı değildi. Çalışma
sürerken `main`'e `googleaa63f7cc032e9462.html` eklendi (commit `1d682af`, "Search Console doğrulama dosyası": URL öneki mülkü,
HTML dosyası yöntemi) ve canlıda 200 dönüyor. Yani doğrulama dosyası hazır; Search Console'da **Doğrula**'ya basıldı mı kontrol
edin. **Bu dosyayı silmeyin** (silinirse doğrulama düşer). Bu dalda `seo-denetim.py` bu dosyayı HTML saymaz; sitemap'e girmez.

Aşağıdakiler, mülk hâlâ doğrulanmadıysa ya da ek mülk istenirse:

**A. Alan adı mülkü (ek olarak önerilen: http/https/www ve alt alan adlarının hepsini kapsar)**
1. https://search.google.com/search-console → "Mülk ekle" → **Alan adı** → `motoseyir-app.com`.
2. Google bir `TXT` kaydı verir (`google-site-verification=…`). Alan adının DNS yönetiminde (alan adı nerede alındıysa orada)
   kök (`@`) için bu TXT kaydını ekleyin; DNS yayılımı birkaç dakika–saat sürer, sonra **Doğrula**.
   Depoda değişiklik gerekmez (GitHub Pages'in A/CNAME kayıtları aynen kalır).

**B. URL öneki mülkü, HTML etiketi** (dosya yöntemi yerine ya da Bing için)
1. "Mülk ekle" → **URL öneki** → `https://motoseyir-app.com/` → doğrulama yöntemi **HTML etiketi**.
2. Verilen `<meta name="google-site-verification" content="XXXX">` değerini (yalnız `XXXX`) `uret.py` içindeki
   `DOGRULAMA["google-site-verification"]` alanına yazın; `python3 uret.py` etiketi yalnız Türkçe anasayfaya (`/`) koyar.
   Sonra commit + push; site yayına çıkınca (GitHub Pages ~1–2 dk, önbellek 10 dk) **Doğrula**.
3. Bing için aynı yol: `DOGRULAMA["msvalidate.01"]` (Bing "Search Console'dan içe aktar" ile de gelir, etiket gerekmez).

Doğrulama bittikten sonra:
1. Sol menü **Site Haritaları** → `sitemap.xml` → **Gönder** (58 adres, hreflang grupları dahil).
2. **URL Denetimi** → şu adresleri tek tek denetleyip "Dizine eklenmesini iste": `/`, `/en/`, `/corider.html`, `/en/corider.html`,
   `/ozellikler.html`, `/nasil-yapilir.html`, `/de/`, `/fr/`, `/it/`, `/es/` (günlük kota ~10; kalanını ertesi gün).
3. **Bing Webmaster Tools** → Search Console'dan içe aktarın (en kolayı) → Site haritası gönderin.
4. Yapısal veriyi https://search.google.com/test/rich-results ve https://validator.schema.org ile deneyin (anasayfa, `/corider.html`).
   MobileApplication için puan/yorum olmadığından zengin sonuç çıkmaz; bu beklenen ve doğru (sahte puan yok). FAQ zengin sonucu
   Google'da artık çoğu site için gösterilmiyor; SSS'nin değeri uzun kuyruk arama metni ve kullanıcı yanıtı.
5. 2–4 hafta sonra **Performans** raporu: sorgular ("motosiklet navigasyon", "motorcycle gps", "gps moto", "motorrad navi"),
   ülke kırılımı ve konum. Title/description'ları tıklama oranına göre ayarlayın; hacim varsayımları burada doğrulanır.
6. **Sayfa dizine alma** raporunda 56 sayfanın hepsinin (çok dilli kopyalar dahil) indekslendiğine bakın; "Tarandı, şu anda
   dizine eklenmiyor" çıkarsa çeviri sayfaları çok benzer bulunmuş demektir; önce TR/EN/DE/FR odaklanılabilir.

### Sahibinin kendisi yapacakları (site dışı)

1. **Search Console'da mülkü doğrulayın** (`googleaa63f7cc032e9462.html` zaten canlı; **Doğrula**'ya basın), isterseniz ek olarak Alan adı mülkünü (A) ekleyin; **site haritasını gönderin**, bağlantıların dizine alınmasını isteyin.
2. **Bing Webmaster'a** içe aktarın.
3. **Instagram biyografi bağlantıları**: `@motoseyir.app` → `https://motoseyir-app.com/`, `@motoseyir.app.en` → `https://motoseyir-app.com/en/`
   (reklam bağlantıları `/indir/` ve `/get/` ayrı, onlara dokunmayın). Böylece siteye gerçek bir dış bağlantı gelir.
4. **App Store ürün sayfası → web sitesi**: App Store Connect'teki "Pazarlama URL'si" (marketing URL) alanlarına TR için
   `https://motoseyir-app.com/`, İngilizce için `https://motoseyir-app.com/en/` yazılı mı kontrol edin (bu çalışmada ASC'ye bakılmadı).
5. **Gerçek dış bağlantılar**: motosiklet forumları, motor kulüpleri ve yayınlarda uygulamanın tanıtımı (marka adı + site adresi).
   Satın alınmış/sahte bağlantı ve yorum yok.
6. Yayından sonra Search Console'da **Core Web Vitals**'a birkaç hafta sonra bakın (anasayfa büyük videolu; hero afişi
   `preload` + `fetchpriority="high"`, videolar `preload="none"`).

## 5. Sonraki adımlar (öneri)

- Blog / rehber sayfaları: "motosiklet için en kısa rota", "Alp geçitleri rehberi", "Karadeniz motor turu rotası" gibi
  ülkeye ve rotaya özgü içerik, `1.600+ geçit` verisinden üretilen geçit sayfaları (`/gecit/stelvio` gibi) uzun kuyrukta
  asıl kazancı getirir; şu an sitede bu tür içerik yok. Geçit verisi (rakım, kapanma ayları, fotoğraf) hazır.
- TR "kurye" kümesi: App Store verisinde "kurye uygulaması / kurye rotası" arama var; ayrı bir "kurye için navigasyon" sayfası
  (çok duraklı sıralama) hem ASO'daki Kurye ürün sayfasını hem web aramasını besler.
- Search Console verisi gelince küçük pazarlar (PL HU SK HR GR RO) ve dönüşüm sorunu olan Avrupa için hangi dil sayfalarının
  görüntülendiğine bakıp çeviri kalitesini öncelikle oralarda iyileştirin.
- Yeni özellik/sürüm geldiğinde `faq_*` ve ilgili `*_aciklama` metinlerini güncelleyin; `python3 seo-denetim.py` sınırları kontrol eder.

## 6. Rehber merkezi (25 Eki 2026, `seo-icerik-2026-10-25` dalı)

**Neden.** Search Console 19–23 Eki: 38 gösterim, 11'i "motoseyir"; geri kalanı "applicazione itinerari moto", "app itinerari in moto". Marka dışı
aramada görünmemenin asıl sebebi içerik eksikliği: 56 sayfa yalnız ürünü anlatıyor, kullanıcının soru sorduğu konularda ("alp geçitleri motosiklet",
"motor turu nasıl planlanır", "balade moto") hiç sayfa yok. Rehber merkezi bu açığı kapatır; ürün her sayfada "kendi turunu çiz" rolüyle, hazır rotalar
yalnız ikincil cümlede anılır.

**Yapı.** `/rehber/` (TR), `/en/guides/`, `/de/ratgeber/`, `/fr/guides/`, `/it/guide/`, `/es/guias/`: her dilde bir ana sayfa + yazılar. `uret.py`
üretir; kaynak `icerik/*.json` (alanlar ve kurallar `REHBER-EKLE.md`). Her sayfada canonical, og/twitter, JSON-LD (`Organization`, `WebSite`,
`WebPage`+`Article` ya da `CollectionPage`, `BreadcrumbList`, görünür SSS varsa `FAQPage`), kaynak listesi ve tek bir Motoseyir bloğu (App Store
bağlantısı `ct=site-<kod>-rehber`). Aynı konunun dil eşleri hreflang grubu; yerel yazılar tek başına. Sitemap'e 19 adres eklendi (`lastmod` = yazının
`guncelleme` tarihi). Altbilgiye (TR, EN, DE, FR, IT, ES) ve bu dillerin anasayfasına "Rehber" bağlantısı eklendi; diğer 8 dilde sayfa değişmedi.

| Dil | Adres | Hedef sorgu |
|---|---|---|
| tr | `/rehber/turkiye-motosiklet-rotalari/` | türkiye motosiklet rotaları, motor turu rotaları |
| tr, en, de | `/rehber/motor-turu-planlama/`, `/en/guides/motorcycle-route-planner/`, `/de/ratgeber/motorradtour-planen/` | motor turu planlama · motorcycle route planner · motorradtour planen, motorrad routenplaner |
| tr | `/rehber/koy-yolu-motosiklet-rotasi/` | köy yolu motosiklet rotası |
| tr | `/rehber/turkiye-dag-gecitleri-motosiklet/` | türkiye dağ geçitleri motosiklet |
| en, de | `/en/guides/alpine-passes-motorcycle/`, `/de/ratgeber/alpenpaesse-motorrad/` | alpine passes motorcycle · alpenpässe motorrad |
| en, de | `/en/guides/furka-grimsel-susten-loop/`, `/de/ratgeber/drei-paesse-runde-furka-grimsel-susten/` | furka grimsel susten motorcycle · …motorrad |
| fr | `/fr/guides/balade-moto-grands-cols-france/` | balade moto, cols moto france |
| it | `/it/guide/passi-in-moto-stelvio-gavia-dolomiti/` | passi in moto, percorsi moto, stelvio |
| es | `/es/guias/rutas-en-moto-picos-de-europa/` | rutas en moto, picos de europa moto |

**Veri kaynakları.** (1) Uygulamanın kendi verisi (`moto-rota/src/data`): Türkiye hazır rotaları (durak, uzunluk), Avrupa efsane yollarının kaynaklı
olguları, geçit sayıları. (2) Her sayı yazının `kaynaklar` listesindeki sayfadan 25 Eki 2026'da yeniden okundu (işletme, turizm kurulu, belediye,
Vikipedi). Uygulamanın bazı değerleri kaynağa göre farklı çıktı ve YAZIDA KAYNAĞIN değeri kullanıldı: Iseran 2.764 m (Route des Grandes Alpes; tepe
levhası 2.770 m, uygulamanın efsane verisi 2.770), Susten "ilk Alp otomobil yolu" yerine kaynağın ifadesi, Galibier açılış ayları (iki kaynak çelişiyor,
ikisi de yazıldı).

**Doğrulanamayıp yazılmayanlar.** Grimsel yolundaki 30 km/sa galeri sınırı ve Nufenen açılış ayları (kaynak sayfaya erişilemedi); Pontón geçidinin
yüksekliği (kaynak vermiyor); Stelvio'nun Bormio tarafındaki viraj sayısı (Bormio 41, Vikipedi 34 diyor: yazıda "Bormio Turismo'ya göre 41" diye
atfedildi); Türkiye'de Zigana dışındaki yayla yollarının kış durumu.

**Haftalık akış.** `REHBER-KUYRUK.md` (19 konu, hedef sorgu + kaynak) ve `REHBER-EKLE.md` (adım adım); zamanlanmış görev için talimat taslağı
`REHBER-GOREV-TASLAGI.md` (görev KURULMADI; otomatik push kararı kullanıcıda).

**İzleme.** Yayından 2–4 hafta sonra Search Console › Performans: sayfa filtresi `/rehber/`, `/guides/`, `/ratgeber/`, `/guide/`, `/guias/`. Hangi yazı
hangi sorguda gösterim alıyorsa o yazının başlık/açıklamasını tıklama oranına göre ayarla; kuyruktaki sırayı gerçek sorgulara göre yeniden diz.
Yayın sonrası yeni adresler için URL Denetimi › "Dizine eklenmesini iste" (günlük kota ~10; ana sayfalar ve en alakalı 6–8 yazı).

## 7. Web tur üreticisi (25 Eki 2026, `web-tur-uretici` dalı)

Üç sayfa, tek hreflang kümesi (tr, en, de, x-default): `/tur-olusturucu/` (TR), `/en/motorcycle-route-generator/`, `/de/motorrad-rundtour-planen/`.
Metin `arac/tur-uretici.<kod>.json`, şablon `sablon/arac.html`, motor `m/tur/` (bkz. `tur-araci/README.md`). Aranan ifadeler: EN "motorcycle route generator",
"round trip planner/generator", "random motorcycle route generator"; DE "motorrad rundtour planen (kostenlos)"; TR "motosiklet tur oluşturucu".
JSON-LD: Organization + WebSite + WebPage + BreadcrumbList + WebApplication + FAQPage (görünür SSS ile birebir). Başlık ≤ 60, açıklama 140–160.
Bağlantılar: tüm TR/EN/DE sayfaların altbilgisi (rehber_footer), anasayfadaki Tur üret bölümü, rehber yazıları (`{@arac}`, `{@arac}#kesfet`).
`seo-denetim.py` araç sayfalarını tanır (`ARAC_YOLLARI`); `icerik-denetim.py` `arac/*.json`'ı da tarar. App Store `ct`: `site-web-tur` (araçtaki bütün mağaza bağlantıları),
altbilgi/üst düğme `site-<dil>-web-tur`. Play bağlantısı Android yayına girince `uret.py` `PLAY_BAGLANTISI`.
Yapılacak: Search Console'da üç adres için indeks isteği; gizlilik sayfalarına (TR/EN/DE) web aracının veri akışı paragrafı (araç sayfasının "Hangi veri nereye gider" bölümü taslak).

## 8. Geçit sayfaları (27 Eki 2026, `seo-gecit-sayfalari` dalı)

Uygulamanın geçit listesinden programatik sayfalar (`uret.py` › GEÇİT SAYFALARI). Hedef: geçit adıyla yapılan aramalar ("Stilfser Joch
Motorrad", "Independence Pass motorcycle", "Kop Geçidi") ve bölge listeleri ("mountain passes in Colorado", "Alpenpässe Schweiz").

| Dil | Dizin | Liste | Geçit |
|---|---|---|---|
| EN | `/en/passes/` | eyalet (≥3 geçit) ve Alp ülkesi: `/en/passes/colorado/`, `/en/passes/switzerland/` | ABD + Alpler: `/en/passes/<ad>/` |
| DE | `/de/paesse/` | Alp ülkesi: `/de/paesse/schweiz/` | Alpler: `/de/paesse/<ad>/` |
| TR | — | `/gecitler/` | Türkiye: `/gecitler/<ad>/` |

- **Veri:** `gecit/gecitler.json` (uygulamadan, `node gecit/veri.mjs`), ABD eyaleti `gecit/abd-eyalet.json` (`python3 gecit/eyalet.py`, ABD Nüfus
  Bürosu ters kodlayıcısı), fotoğraf `m/gecit/<id>.webp` (`python3 gecit/foto.py`, Commons'tan bir kez indirilir; sayfa üçüncü tarafa istek atmaz,
  atıf fotoğrafın altında). Metin `gecit/metin.<kod>.json`. Uygulamanın geçit listesi değişince üçü sırayla, sonra `uret.py`.
- **Sayfada yalnız veri:** rakım, eyalet/ülke, yol yüzeyi, kapanış ayları (yumuşak dille + "yola çıkmadan bak"), konum, kaynak; bunlardan
  hesaplanan sıra ("Colorado'daki 63 geçidin 2.'si") ve en yakın 6 geçit (≤120 km). Uydurma açılış tarihi / yol adı / puan yok.
- **Tur bağlantısı:** "Plan a loop over …" web tur oluşturucuyu `?bas=<enlem>,<boylam>&ad=<ad>` ile açar (başlangıç geçit; `m/tur/tur.js`).
- **App Store** `ct=seo-gecit`. **hreflang:** Alp geçidi ve Alp ülke listesi EN↔DE; ABD (EN) ve Türkiye (TR) tek dilli.
- **JSON-LD:** WebPage + TouristAttraction (GeoCoordinates, elevation, sameAs Wikipedia/OSM) + BreadcrumbList; listelerde CollectionPage + ItemList.
- Almanca/İngilizce yerleşik adı olan birkaç İtalyan/İsviçre geçidi o adla (`eksonim`: Stilfser Joch, Stelvio Pass, Großer Sankt Bernhard…).
- Rehber yazılarından bağlantı: `{@gecitler}` yer tutucusu (alpler, uc-gecit, turkiye-gecitleri); altbilgide "Mountain passes / Alpenpässe / Dağ geçitleri".
- Yayından sonra: Search Console'a sitemap'i yeniden gönder; birkaç liste sayfası için URL Denetimi → dizine eklenmesini iste. 4–6 hafta sonra
  Performans'ta `/passes/` ve `/paesse/` sorgularına bak; gösterimi olmayan geçit sayfaları ince içerik sayılıyorsa listeyi daralt (ör. yalnız fotoğraflı).
