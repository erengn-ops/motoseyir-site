#!/usr/bin/env python3
"""Rehber içeriği denetimi — `icerik/*.json` için. Yayından önce:

    python3 uret.py && python3 seo-denetim.py && python3 icerik-denetim.py

Hata (çıkış kodu 1):
  - başlık/açıklama/h1 uzunluğu: başlık (marka eki dahil gösterilen hâliyle) ≤ 60, açıklama 140–160, h1 ≤ 110
  - başlık/açıklama aynı dilde başka yazıyla aynı
  - rakip marka adı (Google Maps, Waze, Calimoto, Kurviger, Garmin, TomTom, REVER, Komoot, Strava, Sygic …) metinde geçiyor
  - kaynak URL'si yok / https değil; bölüm, tablo satırı, SSS boş
  - aynı yazıda bir tablo satırının sütun sayısı başlıktan farklı
  - yazının `urun` bloğunda uygulama dili dışında uygulama dışı iddia: `ikincil` boş (hazır rotalar ikincil cümlede kalmalı)
  - `urun.p` ya da `lead` ilk cümlesi sayıyla başlıyor ("11 efsane rota…" gibi; konumlandırma kuralı)
Uyarı (inceleme için, hata sayılmaz):
  - aynı yazıda aynı iki kelimeyle başlayan ≥ 3 cümle; aynı beş kelimelik dizi birden çok yazıda (≥ 3) tekrar ediyor
  - Türkçe (tr) cümlelerde yüklemin sonda olmadığı izlenimi veren cümleler: son sözcük çekimli bir fiile benzemiyor
    (kural: yüklem sonda, devrik cümle ve slogan kalıbı yok) — bu liste İNSAN gözüyle okunur
  - "X değil, Y" gibi slogan kalıbı (tr), "—" ile biten cümle
"""
from __future__ import annotations

import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

KOK = Path(__file__).resolve().parent
RAKIP = ["google maps", "waze", "calimoto", "kurviger", "garmin", "tomtom", "rever", "komoot", "strava", "sygic", "scenic", "mapout",
         "apple maps", "here wego", "yandex", "mapy.cz", "organic maps", "osmand", "cardo"]
YAZI_ALAN = ("baslik", "aciklama", "h1", "eyebrow", "lead", "ozet")


def duz(s: str) -> str:
    s = re.sub(r"<[^>]+>", " ", str(s))
    return re.sub(r"\s+", " ", s).strip()


def metinler(v: dict):
    """(alan adı, düz metin) çiftleri: görünen her metin."""
    for a in YAZI_ALAN:
        if a in v:
            yield a, duz(v[a])
    for i, b in enumerate(v.get("bolumler", [])):
        yield f"bolum{i}.h2", duz(b["h2"])
        for blok in b["icerik"]:
            (tur, deger), = blok.items()
            if tur in ("p", "h3", "not"):
                yield f"bolum{i}.{tur}", duz(deger)
            elif tur in ("liste", "adimlar"):
                for x in deger:
                    yield f"bolum{i}.{tur}", duz(x)
            elif tur == "tablo":
                for s in deger["satirlar"]:
                    for h in s:
                        yield f"bolum{i}.tablo", duz(h)
                if deger.get("not"):
                    yield f"bolum{i}.tablo.not", duz(deger["not"])
    for s in v.get("sss", []):
        yield "sss.s", duz(s["s"])
        yield "sss.c", duz(s["c"])
    u = v.get("urun", {})
    for p in u.get("p", []):
        yield "urun.p", duz(p)
    for p in u.get("adimlar", []):
        yield "urun.adim", duz(p)
    if u.get("ikincil"):
        yield "urun.ikincil", duz(u["ikincil"])


def cumleler(metin: str):
    return [c.strip() for c in re.split(r"(?<=[.!?])\s+", metin) if len(c.split()) >= 4]


FIIL_SON = re.compile(
    r"(yor|yorsun|yoruz|yorlar|ıyor|iyor|uyor|üyor|ır|ir|ur|ür|ar|er|dır|dir|dur|dür|tır|tir|tur|tür|ıdır|idir|"
    r"mez|maz|mıyor|miyor|acak|ecek|acaksın|eceksin|ın|in|un|ün|sın|sin|sun|sün|ız|iz|uz|üz|ması|mesi|"
    r"dı|di|du|dü|tı|ti|tu|tü|mış|miş|muş|müş|lar|ler|abilir|ebilir|bilir|r|k|n|m|t|ak|ek|lı|li)$")


def main() -> int:
    hatalar, uyarilar = [], []
    sayfalar = {}
    # `arac/` = web tur üreticisi sayfaları (aynı kurallar: başlık/açıklama uzunluğu, rakip adı, kaynak, Türkçe uyarılar)
    for f in sorted([*(KOK / "icerik").glob("*.json"), *(KOK / "arac").glob("*.json")]):
        sayfalar[f.name] = json.loads(f.read_text(encoding="utf-8"))
    if not sayfalar:
        print("icerik/ boş")
        return 1
    basliklar, aciklamalar = defaultdict(list), defaultdict(list)
    ngram = defaultdict(set)
    for ad, v in sayfalar.items():
        grup, kod = ad[:-5].split(".")
        baslik = duz(v["baslik"])
        tam = f"{baslik} — Motoseyir"
        gorunen = tam if len(tam) <= 60 else baslik
        acik = duz(v["aciklama"])
        if len(gorunen) > 60:
            hatalar.append(f"{ad}: başlık {len(gorunen)} karakter (>60)")
        if not 140 <= len(acik) <= 160:
            hatalar.append(f"{ad}: açıklama {len(acik)} karakter (140–160 olmalı)")
        if len(duz(v["h1"])) > 110:
            hatalar.append(f"{ad}: h1 110 karakterden uzun")
        basliklar[(kod, gorunen)].append(ad)
        aciklamalar[(kod, acik)].append(ad)
        if grup != "hub":
            if not v["bolumler"] or not v["sss"]:
                hatalar.append(f"{ad}: bölüm ya da SSS boş")
            for k in v["kaynaklar"]:
                if not k["url"].startswith("https://") or not k["ad"]:
                    hatalar.append(f"{ad}: kaynak geçersiz: {k}")
            if not v["kaynaklar"]:
                hatalar.append(f"{ad}: kaynak yok")
            for i, b in enumerate(v["bolumler"]):
                for blok in b["icerik"]:
                    if len(blok) != 1:
                        hatalar.append(f"{ad}: bölüm {i}: blok tek anahtarlı olmalı: {list(blok)}")
                    if "tablo" in blok:
                        n = len(blok["tablo"]["baslik"])
                        for s in blok["tablo"]["satirlar"]:
                            if len(s) != n:
                                hatalar.append(f"{ad}: tablo satırı {len(s)} sütun, başlık {n}: {s[0]}")
        u = v["urun"]
        if not u.get("ikincil"):
            hatalar.append(f"{ad}: urun.ikincil boş (hazır rotalar ikincil cümlede anılmalı)")
        ilk = [duz(u["p"][0])] if u.get("p") else []
        ilk.append(duz(v["lead"]))
        for c in ilk:
            if re.match(r"^\d", c):
                hatalar.append(f"{ad}: sayıyla başlayan ilk cümle: {c[:50]}")
        # rakip adı
        tum = " ".join(t for _, t in metinler(v)).lower()
        for r in RAKIP:
            if re.search(rf"(?<![\w]){re.escape(r)}(?![\w])", tum):
                hatalar.append(f"{ad}: rakip adı geçiyor: {r}")
        # tekrarlar
        acilis = Counter()
        for alan, t in metinler(v):
            for c in cumleler(t):
                acilis[" ".join(c.lower().split()[:2])] += 1
                kel = re.findall(r"\w+", c.lower())
                for i in range(len(kel) - 4):
                    ngram[" ".join(kel[i:i + 5])].add(ad)
        for a, n in acilis.items():
            if n >= 3:
                uyarilar.append(f"{ad}: '{a} …' ile {n} cümle başlıyor")
        if kod == "tr":
            for alan, t in metinler(v):
                if alan in ("lead", "sss.c", "urun.p", "urun.ikincil") or alan.endswith((".p", ".liste", ".adimlar")):
                    for c in cumleler(t):
                        son = re.findall(r"[\w’']+", c)[-1].lower()
                        if not FIIL_SON.search(son) and not son.isdigit():
                            uyarilar.append(f"{ad}: yüklem sonda mı? «{c[:90]}… {son}»")
                        if re.search(r"\bdeğil,\s", c) and not c.lower().startswith("süreye"):
                            uyarilar.append(f"{ad}: 'X değil, Y' kalıbı: «{c[:90]}»")
    for (kod, t), liste in basliklar.items():
        if len(liste) > 1:
            hatalar.append(f"aynı başlık ({kod}): {liste}")
    for (kod, t), liste in aciklamalar.items():
        if len(liste) > 1:
            hatalar.append(f"aynı açıklama ({kod}): {liste}")
    for g, dosyalar in ngram.items():
        if len(dosyalar) >= 3 and len(g) > 28:
            uyarilar.append(f"'{g}' {len(dosyalar)} dosyada tekrar ediyor")
    print(f"{len(sayfalar)} içerik dosyası denetlendi.")
    for u in uyarilar:
        print("UYARI:", u)
    if hatalar:
        print(f"{len(hatalar)} HATA:")
        for h in hatalar:
            print(" -", h)
        return 1
    print("Hata yok.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
