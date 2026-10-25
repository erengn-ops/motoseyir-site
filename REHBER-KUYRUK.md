# Rehber / blog konu kuyruğu

Haftada bir yazı. Yeni yazı nasıl eklenir: `REHBER-EKLE.md`. Kural: kuyruktaki İLK uygun konu alınır; yazı yayına girince
satır "Sırada"dan "Yayında"ya taşınır (tarih + adres). Her konunun en az bir **resmî / işletme / turizm kurulu** kaynağı olmalı;
doğrulanamayan sayı yazıya girmez, konu o zaman kuyrukta bekletilir.

Hedef sorgular `SEO.md` Bölüm 1'deki anahtar kelime haritasından (Apple Ads arama terimleri; Search Console verisi gelince
buradaki "Hedef sorgu" sütunu GERÇEK sorgularla güncellenir — önce Performans raporuna bak, kuyruğu ona göre sırala).

## Yayında

| Tarih | Dil | Adres | Hedef sorgu | Veri kaynağı |
|---|---|---|---|---|
| 2026-10-25 | tr | `/rehber/` | motosiklet rehberi, motor rotaları | — (merkez) |
| 2026-10-25 | tr | `/rehber/turkiye-motosiklet-rotalari/` | türkiye motosiklet rotaları, motor turu rotaları | uygulamanın `presetTours` verisi (durak, uzunluk), Vikipedi (Zigana) |
| 2026-10-25 | tr | `/rehber/motor-turu-planlama/` | motor turu planlama, motor turu nasıl planlanır | uygulamanın kendi özellikleri (`dil/tr.json`: tur üret, en uygun sıra, grup) |
| 2026-10-25 | tr | `/rehber/koy-yolu-motosiklet-rotasi/` | köy yolu motosiklet rotası, köy yollarıyla motor turu | uygulamanın köy yolları modu, `veri-kaynaklari` (OpenStreetMap) |
| 2026-10-25 | tr | `/rehber/turkiye-dag-gecitleri-motosiklet/` | türkiye dağ geçitleri motosiklet, zigana kop ovit geçidi | Vikipedi (Zigana, Kop, Sertavul, Gülek, D 975, Ovit Tüneli) + uygulamanın geçit verisi |
| 2026-10-25 | en | `/en/guides/`, `/en/guides/motorcycle-route-planner/` | motorcycle route planner, how to plan a motorcycle trip | uygulamanın özellikleri |
| 2026-10-25 | en | `/en/guides/alpine-passes-motorcycle/` | alpine passes motorcycle, stelvio iseran galibier | Route des Grandes Alpes, Bormio Turismo, IDM Südtirol, Valloire, Grossglockner AG, Timmelsjoch, Switzerland Tourism |
| 2026-10-25 | en | `/en/guides/furka-grimsel-susten-loop/` | furka grimsel susten motorcycle | Luzern Tourismus, Switzerland Tourism, Wikipedia |
| 2026-10-25 | de | `/de/ratgeber/`, `/de/ratgeber/motorradtour-planen/` | motorradtour planen, motorrad routenplaner | uygulamanın özellikleri |
| 2026-10-25 | de | `/de/ratgeber/alpenpaesse-motorrad/` | alpenpässe motorrad, alpenpässe mit dem motorrad | EN ile aynı kaynaklar |
| 2026-10-25 | de | `/de/ratgeber/drei-paesse-runde-furka-grimsel-susten/` | furka grimsel susten motorrad | EN ile aynı kaynaklar |
| 2026-10-25 | fr | `/fr/guides/`, `/fr/guides/balade-moto-grands-cols-france/` | balade moto, cols moto france | RDGA, Valloire, Val d'Isère Tourisme, Côte d'Azur France, Tourmalet Pic du Midi |
| 2026-10-25 | it | `/it/guide/`, `/it/guide/passi-in-moto-stelvio-gavia-dolomiti/` | passi in moto, percorsi moto, stelvio | Bormio Turismo, IDM Südtirol, Alta Badia, Arabba Fodom |
| 2026-10-25 | es | `/es/guias/`, `/es/guias/rutas-en-moto-picos-de-europa/` | rutas en moto, picos de europa moto | Wikipedia (es), Ayto. Posada de Valdeón, Turismo Asturias |

hreflang grupları (`icerik/<grup>.<kod>.json` dosya adındaki grup): `hub` (6 dil), `tur-planlama` (tr, en, de), `alpler` (en, de), `uc-gecit` (en, de);
`turkiye-rotalari`, `koy-yolu`, `turkiye-gecitleri`, `fr-cols`, `it-passi`, `es-rutas` tek dillidir (hreflang yok).

## Sırada (öncelik sırasıyla)

Veri kaynağı sütunundaki "app" = `~/Claude/moto-rota/src/data/` (bkz. `REHBER-EKLE.md` › Veri kaynakları).

| # | Dil | Grup / çalışma adı | Hedef sorgu | Veri / kaynak | Not |
|---|---|---|---|---|---|
| 1 | tr | `alpler` — Alp geçitleri motosiklet | alp geçitleri motosiklet, alpler motor turu | `icerik/alpler.en.json` olguları aynen (tablo + kaynaklar); Türkçeye UYARLA | `alpler` grubuna tr eklenir → hreflang 3 dil |
| 2 | tr | `karadeniz` — Karadeniz motosiklet rotası | karadeniz motosiklet rotası, ayder zigana motor | app: Ayder–Çamlıhemşin, Trabzon–Zigana–Torul, Hemşin 24,1 km örneği; Vikipedi Zigana/Kop/Ovit | Yayla yollarının yol durumu için Karayolları (KGM) kaynağı bul |
| 3 | tr | `istanbul-gunubirlik` — İstanbul çevresi günübirlik motor rotaları | istanbul motor rotaları, şile ağva motor | app: Şile–Ağva, Sapanca–Kartepe, Abant–Yedigöller | Bölgeye özgü yeni olgu için resmî kaynak (örn. belediye / milli park) gerek |
| 4 | tr | `ege-akdeniz` — Ege ve Akdeniz sahil motor turu | likya D400 motor, datça motor rotası | app: Likya, Datça, Assos, Olympos; D400 için Karayolları sayfası | |
| 5 | en | `stelvio` — Stelvio Pass by motorcycle | stelvio pass motorcycle | Bormio, IDM Südtirol, Wikipedia; Prad/Bormio tırmanış ayrıntısı | de: Stilfser Joch Motorrad |
| 6 | en+de | `grossglockner` — Großglockner by motorcycle | grossglockner motorcycle toll, großglockner motorrad maut | grossglockner.at (fiyat ve saatler her yıl değişir: güncelle) | Fiyatlar yıla bağlı; yazıya yıl yaz |
| 7 | en+de+it | `dolomiten` — Dolomites by motorcycle | dolomites motorcycle, dolomiten motorrad | Alta Badia, IDM Südtirol, Arabba Fodom, it.wikipedia Sellaronda | it yazısıyla (`it-passi`) çakışmasın: o Stelvio+Gavia+Sellaronda |
| 8 | en+de+fr | `rumaenien` — Transfăgărășan and Transalpina | transfagarasan motorcycle, transalpina motorrad | app `avrupaEfsaneYollari` (Argeș İl Meclisi, Sibiu Turism, Gorj İl Meclisi, Novaci) | Kaynak sayfaları yeniden aç, kapanış/saat bilgisini doğrula |
| 9 | en | `norwegen` — Trollstigen and the Atlantic Road | trollstigen motorcycle | app: Nasjonale turistveger, Fjord Norway | |
| 10 | fr | `fr-gps-moto` — GPS moto : comment choisir | gps moto, gps moto gratuit | özellikler sayfası (rakip adı yok; ölçüt listesi) | `SEO.md` FR: gps moto 104 gösterim |
| 11 | de | `de-motorrad-navi` — Motorrad Navi: worauf achten | motorrad navi, motorrad navigation | özellikler sayfası | DE: motorrad navi 35 gösterim |
| 12 | it | `it-navigatore-moto` — Navigatore moto | navigatore moto, percorsi moto | özellikler sayfası | |
| 13 | es | `es-gps-moto` — GPS para moto | gps moto, navegador para moto | özellikler sayfası; ES arayüz dili yok → düğme adları İngilizce | |
| 14 | fr | `col-turini-route-des-grandes-alpes` ya da `tourmalet` ayrı yazı | col de turini moto, col du tourmalet moto | Côte d'Azur France, Tourmalet Pic du Midi (şu an `fr-cols` içinde kısa) | Ayrı sayfa yalnız yeterli olgu varsa |
| 15 | es | `es-pirineos` — Pirineos en moto | pirineos moto | app: Pireneler listesi (94 geçit) + resmî kaynak | |
| 16 | en | `us-legendary-roads` — Tail of the Dragon, Beartooth, Blue Ridge | tail of the dragon motorcycle | app `abdEfsaneYollari` (NPS, eyalet DOT kaynakları) | ABD vitrininde uygulama durumunu kontrol et (`SEO.md` eski notu) |
| 17 | tr | `motosiklet-yakit-hesabi` — rota yakıt hesabı | motosiklet yakıt hesabı | uygulama özellikleri | Ürün-özellik yazısı; SSS ağırlıklı |
| 18 | tr | `grupla-motor-turu` — grupla motor turu | grup motor turu, motor grubu navigasyon | özellikler sayfası (grup, interkom) | |
| 19 | nl, pl, cs … | `tur-planlama` çevirisi | motor gps, nawigacja motocyklowa | EN yazının uyarlaması + yerel Search Console sorgusu | Önce Search Console'da o dilin gösterimi var mı bak |

Sıradaki konu seçilirken: (1) Search Console'da gösterimi olan dil/sorgu, (2) elde doğrulanmış kaynak, (3) aynı haftada aynı dilde iki yazı yok.

## Kurallar özeti (ayrıntı: `REHBER-EKLE.md`)

- Ürünün rolü: "kendi turunu çiz"; hazır rotalar yalnız `urun.ikincil` cümlesinde.
- Rakip uygulama adı başlık / açıklama / h1 / gövdede yok (`icerik-denetim.py` kontrol eder).
- Uydurma sayı, uydurma kullanıcı yorumu, sahte puan yok.
- Türkçe: yüklem sonda, devrik cümle ve slogan kalıbı yok, aynı kalıp tekrarlanmaz.
