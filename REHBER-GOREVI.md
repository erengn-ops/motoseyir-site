# Haftalık rehber görevi — BULUT RUTİNİ (27 Eki 2026'dan beri tek kaynak)

Bu dosya Claude Code bulut rutininin ("Motoseyir haftalık rehber", claude.ai/code → Scheduled) talimatıdır. Rutin her
çarşamba 10:15'te (İstanbul) depoyu açar, bu dosyayı okur ve aynen uygular. Eski taslak: `REHBER-GOREV-TASLAGI.md`
(push'suzdu; 27 Eki'de kullanıcı "hepsini yapalım" dedi → yayın otomatik, Göz Kulak ve Ayumi rutinleri gibi).

Motoseyir (motosiklet navigasyon uygulaması) tanıtım sitesinin rehber bölümüne BU HAFTANIN yazısını ekle ve yayınla.
Depo GitHub Pages: `main`'e push = canlı. Site üretilmiş: `icerik/*.json` + `sablon/rehber.html` → `uret.py`.

## Önce oku
- `REHBER-EKLE.md` (alanlar, bloklar, yer tutucular, İÇERİK KURALLARI — hepsi bağlayıcı) ve `REHBER-KUYRUK.md`
  ("Sırada" ve "Yayında").
- `SEO.md` Bölüm 1 (anahtar kelime haritası).
- Örnek yazılar: `icerik/alpler.en.json` (tablo + kaynaklar), `icerik/tur-planlama.tr.json` (özellik rehberi).

## Akış
1. `REHBER-KUYRUK.md` "Sırada"nın İLK konusunu al (o dilde bu hafta zaten yazı çıktıysa sıradakine geç). Kuyruk boşsa
   SEO.md Bölüm 1'den, ölçülmüş aranan bir sorguya hizmet eden yeni konu seç ve kuyruğa yaz.
2. Kaynakları aç (WebFetch; resmî / işletme / turizm kurulu sayfaları). Uygulama verisi bu depoda yok; geçit sayfaları
   (`icerik/` altında geçit verisi varsa) BAŞLANGIÇTIR — her sayıyı kaynak sayfada yeniden doğrula. Doğrulayamadığını
   YAZMA. Kaynaklar çelişirse ikisini de yaz. Yeterli olgu yoksa konuyu kuyrukta "bekliyor: <neden>" diye işaretle ve
   sıradakine geç.
3. `icerik/<grup>.<kod>.json` yaz (tr ve en önce; konu uygunsa de). Yerel konu (fr/it/es) yalnız o dilde, yerel arama
   ifadesiyle. Uygulamanın rolü "kendi turunu çiz"; hazır rotalar yalnız `urun.ikincil`. Rakip adı, uydurma sayı/yorum
   yok. Türkçede yüklem sonda, devrik cümle ve slogan kalıbı yok, kalıp tekrarı yok. İlgili geçit/hub sayfası varsa
   ona iç bağlantı ver.
4. `python3 uret.py && python3 seo-denetim.py && python3 icerik-denetim.py` → yeni hata yok (`veri-kaynaklari` için
   bilinen eski hatalar hariç). Türkçe "yüklem sonda mı?" uyarılarını gözle değerlendir. Denetim temiz değilse
   PUSH YOK: dur, nedenini raporla.
5. `REHBER-KUYRUK.md`: konuyu "Sırada"dan "Yayında"ya taşı (tarih, adres, hedef sorgu, kaynaklar).
6. Commit: `git add icerik sitemap.xml <üretilen dizinler> REHBER-KUYRUK.md` (`git add -A` KULLANMA); mesaj
   "Rehber: <TR ya da EN başlık>"; sonuna `Co-Authored-By: Claude <noreply@anthropic.com>`.
7. Yayın: `git push origin HEAD:main`. Reddedilirse `git fetch origin && git rebase origin/main`, yeniden üret +
   denetle, sonra push. ZORLA PUSH YOK.
8. Canlı doğrulama: Pages yayını 1–3 dk sürer. Yeni adres(ler) `curl -s -o /dev/null -w '%{http_code}'
   https://motoseyir-app.com/<yol>` → 200 olana kadar (en çok ~6 dk, Monitor/until döngüsüyle) bekle.
9. IndexNow: anahtar dosyası kökte (`59ff4a2a91c4fd076ad2ad9fd82e27ad.txt`). Yeni adresleri ve ilgili hub'ı
   `POST https://api.indexnow.org/indexnow` ile gönder: `{"host":"motoseyir-app.com","key":"59ff4a2a91c4fd076ad2ad9fd82e27ad",
   "keyLocation":"https://motoseyir-app.com/59ff4a2a91c4fd076ad2ad9fd82e27ad.txt","urlList":[...]}`. 200/202 beklenir.

## Bitiş
Kısa Türkçe özet: başlık, canlı adres(ler), hedef sorgu, kaynaklar, dışarıda bırakılan doğrulanamayan bilgi, kuyrukta
kalan konu sayısı. Sorun olursa (denetim kırık, kaynak doğrulanamadı) yarım kalanı yayınlama, nedenini bildir.
