# Motoseyir tanıtım sitesi

Statik site, GitHub Pages'te yayında: <https://motoseyir-app.com> (alan adı `CNAME`).
Derleme aracı, paket yöneticisi, bağımlılık yok — yalnız Python 3 standart
kütüphanesi.

## Üretim komutu

```sh
python3 uret.py
```

Bu komut `sablon/` + `dil/` ikilisinden 14 dilde 4 sayfa (56 dosya: anasayfa, özellikler,
nasıl yapılır, AI CoRider), `sablon/rehber.html` + `icerik/` ikilisinden rehber sayfalarını (6 dilde hub + yazılar, 25 Eki 2026'da 19 dosya),
ayrıca `sitemap.xml` ve `robots.txt` üretir. Türkçe **köke** yazılır
(`index.html`, `ozellikler.html`, `nasil-yapilir.html`, `corider.html`) — eski adresler
bozulmasın diye; diğer diller `/<kod>/` altına.

Çıktı dosyaları **elle düzenlenmez**: bir sonraki koşuda üzerine yazılır.
Metin değişikliği `dil/<kod>.json`, yapı/düzen değişikliği `sablon/*.html`
içine yazılır, sonra betik yeniden koşturulur.

## Hareketli anasayfa (TR + EN)

`/` ve `/en/` yeni, kaydırma sahneli anasayfayı kullanır; öteki 12 dilin anasayfası
eski `sablon/index.html` ile üretilmeye devam eder (`uret.py` içindeki
`HAREKETLI_ANASAYFA`).

| Yol | Ne |
| --- | --- |
| `sablon/anasayfa.html` | yeni anasayfa şablonu |
| `dil/anasayfa.tr.json`, `dil/anasayfa.en.json` | yeni anasayfanın metinleri (ortak anahtarlar `dil/<kod>.json`'dan gelir) |
| `m/a.css`, `m/a.js` | anasayfa stili ve sayfaya özgü hareket: kahraman, sticky anlatı + rota çizgisi, dönen motor (bağımlılık yok; renkler uygulamanın kendi paleti, tek yazı ailesi Manrope) |
| `m/h.js` | ortak hareket kütüphanesi (anasayfa + AI CoRider sayfası): kelime kelime başlıklar, sayaçlar, eğim, mıknatıs düğmeler, paralaks yedeği. Hareket kuralları `m/a.css` / `m/corider.css` sonundaki «HAREKET» bloğunda; her şey `html.hm` (JS var + hareketi azalt kapalı) altında, yoksa içerik durağan ve görünür. `html.sd` = tarayıcı `animation-timeline` biliyor → kaydırma efektleri CSS'te, bilmiyorsa h.js `--p`/`--hp`/ilerleme çizgisini yazar |
| `m/` | video, poster, ekran görüntüleri, motosiklet kareleri, yazı tipleri (OFL metinleriyle). Videolar TAM çözünürlük, ham kaynaktan: kahraman bandı `sahne-hd` (1920×1080) / `sahne-dikey-hd` (608×1080, kaynağın kendi pikseli) + `-hevc` eşleri (hvc1; Safari/iPhone ve HEVC çözen Chrome); CoRider klipleri 1080×2212 (`corider-<dil>`), gezi 1080×1920 (`gezi-<dil>`). 720p / `-kucuk` yedekler kaldırıldı. Kesim listesi ve kodlama ayarları `sablon/anasayfa.html` baştaki yorumda. Telefon demo klipleri 1320×2868 (`demo-<ad>-<kod>.mp4` + `-hevc.mp4` + `.webp` kapak; `uret.py` yalnız o dilin dosyası varsa `<video>` yazar, yoksa durağan `ekran-*` kalır; şimdilik yalnız `-tr`: rota, tur-uret, gecit; kaynak `~/Claude/motoseyir-social/02-kaynak/uygulama-demo-1019/`, kodlama olduğu gibi). Tanıtım videosu (`tani`) depoda değil, Cloudflare Worker'dan geliyor |

Arka plan videosu yapay zekâ ile üretildi (Higgsfield Wan 3.0); gerçek çekim değildir.
`_kanit/` yerel test kanıtıdır, depoya girmez.

## Dosya düzeni

| Yol | Ne |
| --- | --- |
| `uret.py` | üretici; dil listesi, App Store vitrin eşlemesi ve hreflang burada |
| `sablon/index.html` | anasayfa şablonu (`{{anahtar}}` yer tutucuları) |
| `sablon/ozellikler.html` | ayrıntılı özellikler şablonu |
| `sablon/nasil-yapilir.html` | "nasıl yapılır" şablonu |
| `dil/tr.json` | **kaynak metin** — diğer diller buradan çevrilir |
| `dil/<kod>.json` | o dilin metinleri (272 anahtar, hepsi zorunlu) |
| `style.css` | tek stil dosyası, elle tutuluyor |
| `img/` | ortak görseller; `img/<kod>/` varsa o dilde onlar kullanılır |
| `gizlilik/index.html` | Türkçe tam gizlilik politikası — **elle** tutuluyor |
| `gizlilik/en/index.html` | İngilizce gizlilik metni — **elle** tutuluyor |
| `indir/index.html`, `get/index.html` | Instagram reklamı yönlendirme sayfaları (`noindex`, ölçüm işareti var; **dokunma**) — **elle** tutuluyor |
| `404.html` | bulunamayan adres sayfası (`noindex`) — **elle** tutuluyor |
| `seo-denetim.py` | yayın öncesi SEO denetimi (aşağıda) |
| `sablon/rehber.html` | rehber (hub + yazı) kabuk şablonu; gövde `uret.py` içinde bloklardan üretilir |
| `icerik/hub.<kod>.json`, `icerik/<grup>.<kod>.json` | rehber ana sayfası + arayüz metinleri; yazılar. **Elle yazılan kaynak** — alanlar: `REHBER-EKLE.md` |
| `icerik-denetim.py` | rehber içerik denetimi (uzunluk, rakip adı, kaynak, tablo, tekrar, Türkçe yüklem uyarıları) |
| `REHBER-EKLE.md`, `REHBER-KUYRUK.md`, `REHBER-GOREV-TASLAGI.md` | yazı ekleme talimatı; konu kuyruğu (hedef sorgu + kaynak); haftalık görev talimat TASLAĞI (görev kurulmadı) |
| `SEO.md` | anahtar kelime haritası, yapılan SEO işleri, sahibinin yapacakları |

`uret.py` yalnız yukarıdaki üç şablondan üretilen sayfalara, `sitemap.xml` ve
`robots.txt`'ye dokunur. Gizlilik ve indir sayfaları ile `style.css` ondan
bağımsızdır.

## Rehber (rota / geçit / tur planlama yazıları)

`python3 uret.py` ayrıca her dilin rehberini yazar: `/rehber/` (TR), `/en/guides/`, `/de/ratgeber/`, `/fr/guides/`, `/it/guide/`, `/es/guias/` ve altındaki
yazılar (`/<hub>/<slug>/`). Aynı konunun farklı dillerdeki yazıları `icerik/` altında aynı grup adını taşır ve birbirinin hreflang eşidir; tek dilli
yazıda hreflang yoktur. Altbilgiye ve (TR, EN, DE, FR, IT, ES) anasayfaya "Rehber" bağlantısı kendiliğinden girer; diğer 8 dil değişmez.
Yazı eklemek `icerik/` altına bir JSON eklemekten ibarettir (`REHBER-EKLE.md`). App Store bağlantısı `ct=site-<kod>-rehber` etiketlidir.

## Yeni dil eklemek

1. `uret.py` içindeki `DILLER` listesine bir satır ekle:

   ```python
   {"kod": "pt", "ad": "Português", "lang": "pt", "og": "pt_PT", "vitrin": "pt"},
   ```

   - `kod` — hem klasör adı (`/pt/`) hem `ct=site-pt` kampanya etiketi.
   - `ad` — dil seçicide görünen ad, **o dilin kendi yazımıyla**.
   - `lang` / `og` — `<html lang>` ve `og:locale`.
   - `vitrin` — App Store ülke vitrini. Dil kodundan farklı olabilir
     (cs→`cz`, el→`gr`). Uygulama o vitrinde satışta değilse `None` yaz:
     adres vitrinsiz kurulur ve Apple okuyanı kendi mağazasına yönlendirir
     (İngilizce böyle).

2. `dil/tr.json`'u `dil/pt.json` olarak kopyala ve **272 anahtarın tamamını**
   çevir. Eksik anahtar varsa betik hata verip durur, yarım sayfa üretmez.
   Çeviride tutulacak ölçüler:

   - Uygulama arayüzü beş dilde: **Türkçe, İngilizce, Almanca, Fransızca,
     İtalyanca**. Yeni dil bunlardan biri DEĞİLSE, sayfada düğme adları
     İngilizce yazılır (kullanıcı uygulamada onları öyle görüyor) ve
     `hero_micro` sonuna arayüz dillerini söyleyen bir cümle eklenir —
     mağaza açıklamalarının yaptığı gibi.
   - Kayıtlı doğal seslendirme **yalnız Türkçe** (`assets/ses/tr`); öteki
     dillerde telefonun sesi konuşuyor. `d2_p` ve `oz11_p` buna göre yazılır.
   - "Pro", "Courier Pro", "AI CoRider", "Motoseyir", "GPX", ölçü birimleri
     ve km değerleri **çevrilmez**.
   - Arayüz terimleri, uygulamanın kendi sözlüğünden alınır
     (`moto-rota/src/i18n/{en,de,fr,it}.ts`) — sitede başka bir karşılık
     kullanılmaz.
   - Değerlerde satır içi HTML olabilir (`<strong>`, `<br>`,
     `<span class="vurgu">`); üretici kaçışlama yapmaz, metinler bizim.

3. Görsel: o dilin ekran görüntüleri varsa `img/<kod>/` altına aynı dosya
   adlarıyla koy (ör. `img/pt/kesfet.jpg`); üretici dosya varsa onu, yoksa
   ortak `img/` sürümünü kullanır — betikte değişiklik gerekmez. Kaynak:
   uygulama deposundaki `store/screenshots/yeni-<dil>` setleri, 414×900'e
   küçültülür:

   ```sh
   sips -s format jpeg -s formatOptions 78 -z 900 414 <kaynak.png> --out img/pt/kesfet.jpg
   ```

4. `python3 uret.py` koş. Yeni dil hem `/pt/` altına yazılır hem de **tüm**
   sayfaların hreflang listesine, dil seçicisine ve sitemap'e kendiliğinden
   girer.

## Sürüm notu eklemek

Yeni sürüm çıktığında `sablon/index.html` içindeki "YENİLİKLER" bölümüne en
üste yeni bir `<article class="surum">` ekle, metinleri her `dil/<kod>.json`
dosyasına yaz. Mağaza notları hazır çeviri kaynağıdır:
`moto-rota/store/metin/<build>/yenilikler-<locale>.txt`.

## SEO

Başlık/açıklama/H1 metinleri dil dosyalarında (`baslik`/`aciklama`, `oz_*`, `ny_*`, `cr_*`). `og:*` ve `twitter:*` etiketleri ile
JSON-LD (`@graph`: Organization, WebSite, WebPage, BreadcrumbList, MobileApplication, FAQPage) şablonlarda DEĞİL, `uret.py`
içinde üretilir: şablonlarda yalnız `{{seo_head}}` ve `{{json_ld}}` var. Sınırlar: başlık ≤ 60, açıklama 140–160 karakter.
Anasayfadaki SSS (`#sss`) `faq_q1…faq_a6` anahtarlarından gelir; FAQPage yapısal verisi aynı anahtarlardan çıkar, yani
görünür metinle birebir. Yeni soru eklenirse 14 dil dosyasına da eklenmeli. Ayrıntı: `SEO.md`.

## Yayına almadan önce

```sh
python3 uret.py
python3 seo-denetim.py        # SEO + bağlantı + sitemap denetimi; sorun varsa çıkış kodu 1
python3 icerik-denetim.py     # rehber içeriği (icerik/*.json) denetimi
python3 -m http.server 8099   # http://127.0.0.1:8099/
```

Bakılacaklar: dil seçici (dar ekranda da), `/`, `/en/`, `/de/` sayfaları,
altbilgideki gizlilik bağlantısı, App Store bağlantısında `pt=` ve `ct=`.


## Web tur üreticisi

`arac/tur-uretici.<kod>.json` + `sablon/arac.html` → TR/EN/DE üç sayfa (`uret.py` üretir). Araç motoru `m/tur/motor.js` moto-rota kaynağından
`tur-araci/derle.mjs` ile derlenir (elle düzenlenmez); ayrıntı ve kurallar: `tur-araci/README.md`.

## Geçit sayfaları

`python3 uret.py` uygulamanın geçit listesinden EN (`/en/passes/`, ABD + Alpler), DE (`/de/paesse/`, Alpler) ve TR (`/gecitler/`) sayfalarını da
yazar (27 Eki 2026'da 1.516 dosya). Veri ve fotoğraflar `gecit/` altındaki üç betikle yenilenir; ayrıntı ve kurallar: `SEO.md` Bölüm 8.
