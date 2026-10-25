# Haftalık rehber görevi: TASLAK (zamanlanmış görev KURULMADI)

Bu dosya `~/.claude/scheduled-tasks/motoseyir-haftalik-rehber/SKILL.md` için talimat taslağıdır (Göz Kulak'ın
`gozkulak-haftalik-blog` görevinin Motoseyir karşılığı). Görev kullanıcı onaylayınca kurulur: aşağıdaki gövde olduğu gibi SKILL.md'ye taşınır.
**Açık karar:** otomatik `push` (= canlı) istenir mi? Taslakta 9. adım varsayılan olarak push'suz yazıldı; kullanıcı otomatik yayın isterse
o satır değiştirilir.

```markdown
---
name: motoseyir-haftalik-rehber
description: Haftada bir: Motoseyir sitesine (motoseyir-app.com) kuyruktaki konudan bir rehber yazısı ekler, denetler, dalda commit eder; yayın kararı kullanıcıda.
---

Motoseyir (motosiklet navigasyon uygulaması) tanıtım sitesinin rehber bölümüne BU HAFTANIN yazısını ekle. Kullanıcıyla Türkçe konuş.
Depo: ~/Claude/motoseyir-site (GitHub Pages; main'e push = canlı). Site üretilmiş: `icerik/*.json` + `sablon/rehber.html` → `uret.py`.

## Önce oku
- `REHBER-EKLE.md` (alanlar, bloklar, yer tutucular, İÇERİK KURALLARI — hepsi bağlayıcı) ve `REHBER-KUYRUK.md` (konular, "Sırada" ve "Yayında").
- `SEO.md` Bölüm 1 (anahtar kelime haritası). Search Console verisi varsa (kullanıcı verirse ya da Performans raporu açıksa) kuyruğu gerçek
  sorgulara göre sırala.
- Mevcut bir yazıyı örnek al: `icerik/alpler.en.json` (tablo + kaynaklar), `icerik/tur-planlama.tr.json` (özellik rehberi).

## Akış
1. Ayrı dal: `cd ~/Claude/motoseyir-site && git worktree add ../motoseyir-site-rehber -b rehber-<YYYY-AA-GG> main`; çalış, commit orada.
   Ana çalışma dizinindeki takipsiz `nasil-yapilir-*-taslak.html` dosyasına DOKUNMA. Başka oturumun açık dalı varsa onu bozma.
2. `REHBER-KUYRUK.md` "Sırada"nın İLK konusunu al (o hafta o dilde zaten yazı çıktıysa sıradakine geç).
3. Kaynakları aç (WebFetch, resmî / işletme / turizm kurulu sayfaları). Uygulama verisi `~/Claude/moto-rota/src/data/` bir BAŞLANGIÇTIR;
   her sayıyı kaynak sayfada yeniden doğrula. Doğrulayamadığını YAZMA. Kaynaklar çelişirse ikisini de yaz. Yeterli olgu yoksa konuyu
   kuyrukta "bekliyor: <neden>" diye işaretle ve sıradakine geç (zorlama yok).
4. `icerik/<grup>.<kod>.json` yaz (tr ve en önce; konu çeviriye uygunsa de). Yerel konu (fr/it/es) ise yalnız o dilde, yerel arama ifadesiyle.
   Uygulamanın rolü: "kendi turunu çiz"; hazır rotalar yalnız `urun.ikincil`. Rakip adı, uydurma sayı/yorum yok. Türkçede yüklem sonda,
   devrik cümle ve slogan kalıbı yok, kalıp tekrarı yok.
5. `python3 uret.py && python3 seo-denetim.py && python3 icerik-denetim.py` → yeni hata yok (`veri-kaynaklari` için bilinen eski hatalar hariç).
   Uyarıları oku; Türkçe "yüklem sonda mı?" uyarılarını gözle değerlendir.
6. Yerelde aç (`python3 -m http.server 8099`): yazı masaüstünde ve 375 px'te düzgün, tablo sayfayı yatay kaydırmıyor, bağlantılar çalışıyor.
7. `REHBER-KUYRUK.md`: konuyu "Sırada"dan "Yayında"ya taşı (tarih, adres, hedef sorgu, kaynaklar).
8. Commit (`git add icerik sitemap.xml <üretilen dizinler> REHBER-KUYRUK.md`; `git add -A` KULLANMA; mesaj: "Rehber: <TR başlık>"; Co-Authored-By satırı).
9. PUSH ETME. Kullanıcıya haber ver: dal adı, yazının adresi, kaynaklar, doğrulanamayıp dışarıda bırakılanlar. (Kullanıcı otomatik yayın isterse:
   `git push origin <dal>:main` + canlıda 200 kontrolü + Search Console URL Denetimi hatırlatması.)

## Bitiş
Kısa Türkçe özet: başlık, adres(ler), hedef sorgu, kullanılan kaynaklar, dışarıda bırakılan doğrulanamayan bilgi, kuyrukta kalan konu sayısı.
Sorun olursa (denetim kırık, kaynak doğrulanamadı) yarım kalanı yazma, nedenini bildir.
```
