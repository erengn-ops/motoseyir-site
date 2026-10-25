# Rehber yazısı nasıl eklenir

Rehber merkezi (25 Eki 2026): her dilin kendi dizininde bir ana sayfa ve yazılar. `python3 uret.py` hepsini üretir.

| Dil | Ana sayfa | Yazı adresi |
|---|---|---|
| tr | `/rehber/` | `/rehber/<slug>/` |
| en | `/en/guides/` | `/en/guides/<slug>/` |
| de | `/de/ratgeber/` | `/de/ratgeber/<slug>/` |
| fr | `/fr/guides/` | `/fr/guides/<slug>/` |
| it | `/it/guide/` | `/it/guide/<slug>/` |
| es | `/es/guias/` | `/es/guias/<slug>/` |

Konu sırası: `REHBER-KUYRUK.md`. Aşağıdaki akış tek bir yazı içindir (haftada bir).

## 1. Dosyalar

Her yazı `icerik/<grup>.<kod>.json`. `grup` = konu kimliği (küçük harf, tire); aynı konunun başka dildeki yazısı AYNI grup adını taşır
ve otomatik hreflang eşi olur (yalnız var olan diller; tek dilli yazıda hreflang yazılmaz). `kod` = dil kodu.
Dilin rehber ana sayfası ve arayüz metinleri `icerik/hub.<kod>.json`. Yeni yazı için başka dosyaya dokunmak gerekmez:
ana sayfadaki kart, "Diğer rehberler" listesi, dil seçici, hreflang, sitemap `uret.py` içinde kendiliğinden oluşur.

Yeni bir DİLE rehber eklemek için: `icerik/hub.<kod>.json` yaz (mevcut bir hub'ı kopyala, `ui` dahil hepsi zorunlu), `uret.py` içindeki
`REHBER_DIZIN`e dizin adını ekle. Başka değişiklik yok; o dilin altbilgisine "Rehber" bağlantısı kendiliğinden girer.

## 2. Yazı JSON'u

| Alan | Anlam |
|---|---|
| `slug` | adres parçası, o dilde ASCII, küçük harf, tire (aynı dilde tekil) |
| `sira` | rehber ana sayfasındaki sıra (küçük önce); sitemap'te de bu sırayla |
| `baslik` | sayfa başlığı; sonuna otomatik " — Motoseyir" eklenir (sığıyorsa). **Gösterilen başlık ≤ 60** |
| `aciklama` | meta description, **140–160 karakter** (denetim bunu zorlar) |
| `h1`, `eyebrow`, `lead` | ana başlık, küçük üst başlık, ilk paragraf |
| `yayin`, `guncelleme` | `YYYY-AA-GG`; `guncelleme` sitemap `lastmod` ve JSON-LD `dateModified` olur — içeriği değiştirince güncelle |
| `ozet` | ana sayfadaki kart metni (1–2 cümle) |
| `bolumler` | `[{ "id": "...", "h2": "...", "icerik": [blok, …] }]`. ≥ 4 bölümde "Bu yazıda" içindekiler listesi otomatik |
| `sss` | `[{ "s": soru, "c": cevap }]`. Görünür SSS **ve** FAQPage JSON-LD aynı kaynaktan (birebir) |
| `kaynaklar` | `[{ "ad": ..., "url": "https://..." }]` — yazıdaki sayıların geldiği sayfalar. Boş olamaz |
| `urun` | Motoseyir bloğu: `h2`, `p` (liste), `adimlar` (isteğe bağlı), `ikincil` (**zorunlu**), `gorsel` (`tur` `efsane` `gecit` `nav`; isteğe bağlı) + `gorsel_alt` |

Bloklar (`icerik` içinde, her blok TEK anahtarlı): `{"p": "…"}`, `{"h3": "…"}`, `{"liste": ["…"]}`, `{"adimlar": ["…"]}` (numaralı),
`{"not": "…"}` (küçük gri not), `{"tablo": {"baslik_metni": "…", "baslik": ["…"], "satirlar": [["…"]], "not": "…"}}`.
Metinlerde satır içi HTML serbest (`<strong>`, `<a href="…">`); `uret.py` kaçışlamaz, metinler bizim.

Yer tutucular (aynı dilin adresine çözülür; karşılığı yoksa derleme durur): `{@<grup>}` aynı dildeki o yazı, `{@hub}`, `{@anasayfa}`,
`{@ozellikler}`, `{@nasil}`, `{@corider}`, `{@store}` (`ct=site-<kod>-rehber` etiketli App Store bağlantısı). Bağlantı olarak
`<a href="{@alpler}">…</a>` yazılır. İç bağlantı kuralı: her yazıdan en az bir başka rehbere ya da özellikler sayfasına bağ olsun.

## 3. İçerik kuralları (denetim kısmen otomatik)

1. **Her sayı kaynaklı.** Yükseklik, uzunluk, açık olduğu aylar, ücret: resmî kaynak, işletme ya da turizm kurulu sayfası, ansiklopedi.
   Önce kaynağı WebFetch ile aç, sayıyı oradan al, `kaynaklar`a yaz. Doğrulayamadığını yazma. İki kaynak çelişirse ikisini de yaz
   (örnek: Iseran 2.764 m, tepedeki levha 2.770 m; Galibier açılış ayları). Uygulamanın kendi `avrupaEfsaneYollari.ts` değerleri
   bir başlangıçtır, kaynak sayfaya yeniden bakmadan **kopyalama** (4 Eki derlemesi: bazı sayılar kaynağa göre değişti).
2. **Mevsim / kapanış** hiçbir zaman "açık" diye kesin yazılmaz: "genellikle … açık; yola çıkmadan işletmenin güncel duyurusuna bak".
   Fiyatlar yılla birlikte yazılır ("2026'da"); her yıl güncellenmesi gerekir.
3. **Ürünün rolü:** uygulama "kendi turunu çiz" diye anlatılır (başlangıç/bitiş, durak ekleme, sıra değiştirme, haritaya uzun basma).
   Hazır rotalar yalnız `urun.ikincil` cümlesindedir ve sayıyla başlayan cümle (`11 hazır rota…`) kurulmaz.
4. **Uygulamayı yalnız sitede zaten yazanla anlat** (`dil/<kod>.json`, `ozellikler`, `nasil-yapilir`). Özellik adları o dilin arayüzünden
   (`~/Claude/moto-rota/src/i18n/{en,de,fr,it}.ts`; ES için arayüz dili yok, düğme adları İngilizce). Pro / ücretsiz ayrımını yanlış söyleme:
   En uygun sıra, Keşfet, Köy yolları ve Sahil modu, grup kurma Pro; rota hesaplama ve navigasyon TR/Avrupa/ABD'de ücretsiz ve sınırsız,
   ücretsiz kademede 1 kayıtlı tur. Köy yolları motoru yalnız Türkiye + Yunanistan'da; Alp'te standart mod.
5. **Rakip uygulama adı yok** (başlık, açıklama, h1, gövde). `icerik-denetim.py` listeyi kontrol eder.
6. **Uydurma yorum, sahte puan, "binlerce motorcu kullanıyor" gibi doğrulanamayan söz yok.**
7. **Türkçe:** düz, "sen" hitabı, yüklem sonda, devrik cümle ve slogan kalıbı ("X değil, Y") yok; aynı cümle kalıbı (özellikle kapanış ve
   ürün bloğu) iki yazıda tekrarlanmaz; açıklama bilgi verir. Yayından önce metni baştan sona yüksek sesle oku.
8. **Yerel yazılar çeviri değil:** o ülkenin arama ifadesi ve yerel rotası (FR balade moto + Fransız geçitleri, IT percorsi moto + Stelvio,
   ES rutas en moto + Picos). Çeviri yalnız aynı konunun gerçekten aynı içeriğiyse (alpler, uc-gecit, tur-planlama) ve o zaman aynı `grup`.

## 4. Derle ve denetle

```sh
python3 uret.py                # üretir; eksik alan, çözülemeyen {@…} ya da yinelenen slug'ta durur
python3 seo-denetim.py         # tüm sayfalar: başlık/açıklama, canonical, hreflang, JSON-LD, bağlantılar, sitemap
python3 icerik-denetim.py      # rehber içeriği: uzunluklar, rakip adı, kaynak, tablo, tekrar ve Türkçe yüklem uyarıları
python3 -m http.server 8099    # elle bak: /rehber/…, telefon genişliğinde tablo yatay kaymıyor mu
```

`seo-denetim.py` çıktısında `veri-kaynaklari/index.html` için bilinen eski hatalar olabilir (25 Eki'de: açıklama 90 karakter, og/twitter yok,
sitemap'te yok); o sayfa elle tutuluyor, rehber işiyle ilgisi yok.

## 5. Yayın

1. Kuyruk dosyasını güncelle (`REHBER-KUYRUK.md`: "Sırada"dan "Yayında"ya; tarih + adres).
2. `git add icerik sitemap.xml <üretilen dizinler> REHBER-KUYRUK.md` ve commit (`git add -A` KULLANMA; takipsiz `nasil-yapilir-*-taslak.html` dosyasına dokunma).
3. `main`'e push = canlı (GitHub Pages, 1–2 dk). Push kararı kullanıcıda.
4. Canlıda yeni adresi ve `sitemap.xml`'i aç (200). Search Console → URL Denetimi → yeni yazı için "Dizine eklenmesini iste"
   (günlük kota ~10). 2–4 hafta sonra Performans raporunda o yazının sorguları: gösterim varsa `baslik`/`aciklama`yı tıklama oranına göre ayarla.

## 6. Veri kaynakları (uygulama deposu, salt okunur)

`~/Claude/moto-rota/src/data/`: `presetTours.ts` (Türkiye hazır rotaları: durak, uzunluk), `avrupaEfsaneYollari.ts` + `avrupaEfsaneGeometri.ts`
(Avrupa efsane yolları: kaynaklı olgular, durak listesi, rota uzunluğu), `abdEfsaneYollari.ts` (ABD), `gecitler.ts` (elle seçilmiş Türkiye +
Alp geçitleri), `avrupaGecitleri.ts`, `asyaGecitleri.ts`, `abdGecitleri.ts` (OSM'den derlenen geçit listesi: rakım, kapanış ayı, `kaynak`).
Uygulama arayüz terimleri: `src/i18n/`. Bu dosyalardaki sayılar derleme tarihli (4 Eki 2026); yazıya almadan önce `kaynaklar` sayfasına bak.
