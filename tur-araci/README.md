# Web tur üreticisi — motor ve derleme

`/tur-olusturucu/`, `/en/motorcycle-route-generator/`, `/de/motorrad-rundtour-planen/` sayfalarındaki araç (web uygulaması). Özelliği anlatan AYRI sayfa: `/tur-uret/`, `/en/tour-generator/`, `/de/tourengenerator/` (`sablon/tur-uret.html`, metin `tanitim/`). Uygulamadaki **Tur üret** ile
**aynı kod** çalışır: hesap, moto-rota kaynağından tek dosyaya paketlenir, kopyalanıp çatallanmaz.

## Derleme

```sh
cd tur-araci && npm install          # yalnız esbuild (0.25.10, sabit)
node derle.mjs                       # kaynak: ~/Claude/moto-rota/src  (MOTO_ROTA_SRC ile değişir)
cd .. && python3 uret.py             # sayfalar (m/tur/* sürüm özetiyle bağlanır)
```

`derle.mjs` üç şey üretir (hepsi depoya girer, **elle düzenlenmez**):

| Çıktı | İçerik |
| --- | --- |
| `m/tur/motor.js` | `services/turUret`, `utils/turUretici`, `gecitliTur`, `turKacin`, `virajliSecim`, `valhallaApi` (istek gövdesi + ayrıştırma), `data/gecitler` ... uygulamanın dosyaları olduğu gibi. Başındaki satır hangi moto-rota commit'inden derlendiğini yazar (`+yerel` = o dosyalarda commit edilmemiş değişiklik vardı). |
| `m/tur/kesfet.<dil>.json` | Keşfet "bölgendeki rotalar" verisi: Türkiye klasikleri + Avrupa/ABD efsane yolları (`data/presetTours`, `avrupaEfsaneYollari`, `abdEfsaneYollari`); metinler uygulamanın çeviri sözlüğünden (`i18n/en.ts`, `de.ts`). Çevirisi olmayan metin derlemede UYARI olarak yazılır. |
| `m/tur/harita/` | Uygulamanın çevrimdışı harita stili (`assets/harita/protomaps-acik.json`), yazı tipleri ve simgeleri; kaynak: gezegen yapısı (vekil). Dışarıya istek yok. |

`node derle.mjs --geometri` yalnız `m/tur/geometri.js`i yeniler (motor.js'e dokunmaz): Tur üret kadranının geometrisi (`components/turUretici/geometri.ts`, saf işlevler) `window.TurGeometri` olarak paketlenir; `m/tur/kadran.js` onu kullanır, kopya yok.

`stubs/` uygulamanın React Native'e bağlı küçük katmanlarının web karşılıklarıdır: `routesApi` (tur üreticinin kullandığı DAR yol; kendi
sunucu + dış motor, dış motorda 10 konum sınırı için bacak grupları), `i18n`, `format`, `expo-location` (yer adları Photon ile), `preferences`,
`uzakAyar`, `surusKaydi`, `react-native`. `web/giris.ts` ağ yapıştırıcısıdır (vekil, dış motora nazik hız, sayaç/hata sebebi), turu uygulamanın
`Tour` biçiminde kurar (`turKaydi`) ve paylaşır (`turPaylas`), yeniden rotalar (`rotaKur`), yerleri sorar (`yerlerKoridor`).

## Ağ

| Ne | Nereye | Not |
| --- | --- | --- |
| Rota (Türkiye + Yunanistan kutusu) | vekil `motorota-rota.erengn.workers.dev/route` + `/locate` → rota.motoseyir-app.com | `X-Motoseyir-Key` Worker'da; tarayıcıda sır yok |
| Rota (başka her yer) | `valhalla1.openstreetmap.de/route` (FOSSGIS herkese açık demo, **doğrudan tarayıcıdan**) | adil kullanım: 1 istek/sn/kullanıcı; iki eşzamanlı, 450 ms aralık, 429'da geri çekilme. Ticari/ağır kullanım için kendi Valhalla (Almanya, ABD) ya da Stadia (alan adı doğrulamalı anahtar) gerekir; değiştirmek `DIS_ROTA` ortam değişkeniyle derleme + `stubs/routesApi.ts` |
| Tur kodu | vekil `/tur/paylas`, `/tur/al` | cihaz kimliği: tarayıcıda rastgele `web-…`; sunucu şeması uygulamayla aynı (`test/sema-testi.mjs`) |
| Rota üstü yerler | vekil `/takip/yerler/koridor` (kendi yer veritabanı) | yalnız koridor ucu açık |
| Durak hava durumu | vekil `GET /web/hava?lat&lon` → MET Norway locationforecast 2.0 | tarayıcı doğrudan çağıramaz (kimlikli User-Agent şart); vekil koordinatı 2 ondalığa yuvarlar, Cache API'de ≥30 dk tutar, `If-Modified-Since` ile sorar, günlük web tavanına (hava: 600) dahil. Atıf: MET Norway, CC BY 4.0. Kaynak: `moto-rota-web-tur/server/rota-worker` (dal `web-tur-worker`) |
| Tur kodu ile açma | vekil `/tur/al` | düzenleyiciye yüklenir; GPX içe/dışa aktarma YOK |
| Harita karoları | vekil `/web/harita.pmtiles` (R2 `gezegen/…pmtiles`, Range) | yalnız `motoseyir-app.com` ve localhost Origin'i |
| Yer arama / ters kodlama | `photon.komoot.io` (doğrudan) | yalnız Enter/düğme; yazarken sorgu yok |

Worker: `moto-rota/server/rota-worker` (CORS, web hız sınırı, KV günlük tavan, test: `node test.mjs`). Web için IP başına günlük tavan:
rota 2500, tur paylaşımı 25, tur alma 300, yer sorgusu 150; hepsi KV'de örneklemeli sayım, KV arızasında tavan açık.

## Sınama

```sh
node test/sema-testi.mjs     # web turu == uygulamanın paylasilacakTur çıktısı; sunucuya yaz/geri oku birebir; baglantidanKod; /k/<KOD> sayfası
```

## Kurallar

* Dışarı alma YOK: GPX/KML/GeoJSON indirme, başka haritada açma, koordinat kopyalama, yol tarifi listesi yok. Tek çıkış Motoseyir tur kodu
  (`motoseyir://tur/<KOD>`, `/k/<KOD>`, QR). Sayfada ham rota cevabı tutulmuyor (adım ve bacak bilgisi atılıyor); çizgi tarayıcıya gösterim için
  gelir, teknik biri yine çıkarabilir.
* Google/Apple anahtarı tarayıcıda yok. Android: Play'de yayın yok (`uret.py` `PLAY_BAGLANTISI`).
