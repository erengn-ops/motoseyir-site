#!/usr/bin/env python3
"""TR geçitlerinin il/ilçesi ve OSM'deki diğer adları -> gecit/yer.tr.json (8 Kas 2026).
Kaynak: OpenStreetMap Nominatim ters geocode (zoom=10, idari sınırlar) + OSM düğüm etiketleri (alt_name, old_name).
Kullanım politikası gereği saniyede en çok 1 istek; ~115 geçit için birkaç dakika sürer. Çalıştır: python3 gecit/yer.py"""
import json, time, urllib.request
from pathlib import Path

DIZIN = Path(__file__).resolve().parent
UA = {"User-Agent": "motoseyir-site-seo/1.0 (https://motoseyir-app.com)"}


def al(url):
    for _ in range(3):
        try:
            return json.load(urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30))
        except Exception:
            time.sleep(3)
    return None


def main():
    gecitler = [x for x in json.load((DIZIN / "gecitler.json").open(encoding="utf-8"))["gecitler"] if x["bolge"] == "tr"]
    cikti = {}
    for x in gecitler:
        r = al(f"https://nominatim.openstreetmap.org/reverse?lat={x['lat']}&lon={x['lon']}&format=jsonv2&zoom=10&accept-language=tr&addressdetails=1")
        time.sleep(1.1)
        a = (r or {}).get("address", {})
        etiket = {}
        if x["id"].startswith("osm-"):
            t = al(f"https://api.openstreetmap.org/api/0.6/node/{x['osm']}.json")
            if t:
                etiket = t["elements"][0].get("tags", {})
        alt = []
        for anahtar in ("alt_name", "old_name"):
            for ad in (etiket.get(anahtar) or "").split(";"):
                ad = ad.strip()
                if ad and ad != etiket.get("name") and ad not in alt:
                    alt.append(ad)
        cikti[x["id"]] = {"il": a.get("province") or a.get("state"),
                          "ilce": a.get("town") or a.get("county") or a.get("city") or a.get("district") or a.get("village"),
                          "alt": alt}
    (DIZIN / "yer.tr.json").write_text(json.dumps(cikti, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
