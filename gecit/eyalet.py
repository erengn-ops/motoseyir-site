"""ABD geçitlerinin eyaleti (27 Eki 2026). Uygulamanın verisinde eyalet yok; konumdan ABD Nüfus Bürosu'nun ters kodlayıcısıyla
(geocoding.geo.census.gov, herkese açık, anahtarsız) bulunur ve `gecit/abd-eyalet.json`a önbelleklenir (geçit kimliği → eyalet).
Yalnız önbellekte olmayanları sorar: python3 gecit/eyalet.py"""
import json, time, urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

KOK = Path(__file__).resolve().parent
ONBELLEK = KOK / "abd-eyalet.json"
URL = ("https://geocoding.geo.census.gov/geocoder/geographies/coordinates?x={lon}&y={lat}"
       "&benchmark=Public_AR_Current&vintage=Current_Current&layers=States&format=json")


def sor(g):
    for deneme in range(4):
        try:
            with urllib.request.urlopen(URL.format(lat=g["lat"], lon=g["lon"]), timeout=40) as r:
                s = json.load(r)["result"]["geographies"]["States"]
            return g["id"], ({"kod": s[0]["STUSAB"], "ad": s[0]["NAME"]} if s else None)
        except Exception:
            time.sleep(2 * (deneme + 1))
    return g["id"], None


def main():
    veri = json.loads((KOK / "gecitler.json").read_text())["gecitler"]
    onb = json.loads(ONBELLEK.read_text()) if ONBELLEK.exists() else {}
    eksik = [g for g in veri if g["bolge"] == "abd" and g["id"] not in onb]
    with ThreadPoolExecutor(6) as h:
        for gid, e in h.map(sor, eksik):
            if e:
                onb[gid] = e
    ONBELLEK.write_text(json.dumps(dict(sorted(onb.items())), ensure_ascii=False, indent=0) + "\n")
    kalan = [g["ad"] for g in veri if g["bolge"] == "abd" and g["id"] not in onb]
    print(f"{len(onb)} eyalet; bulunamayan: {kalan}")


if __name__ == "__main__":
    main()
