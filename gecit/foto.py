"""Geçit sayfalarının fotoğrafı (27 Eki 2026). Uygulamanın Commons listesindeki (gitFotolari → gecit/gecitler.json `foto`) İLK
fotoğraf, Wikimedia Commons'tan 640 px indirilir ve `m/gecit/<id>.webp` olarak depoya konur: sayfa açılınca üçüncü tarafa istek
gitmez (gizlilik metni değişmez). Atıf (yazar, lisans, Commons sayfası) sayfada fotoğrafın altında. Yalnız sayfası üretilen
bölgeler (uret.py GECIT_BOLGE) ve önceden indirilmemişler: python3 gecit/foto.py"""
import json, subprocess, sys, tempfile, time, urllib.parse, urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

KOK = Path(__file__).resolve().parent.parent
HEDEF = KOK / "m" / "gecit"
BOLGELER = {"abd", "alp", "tr"}
UA = "MotoseyirSite/1.0 (https://motoseyir-app.com; site build script)"


def indir(g):
    hedef = HEDEF / f"{g['id']}.webp"
    if hedef.exists():
        return g["id"], "var"
    ad = g["foto"][0]["ad"]
    url = "https://commons.wikimedia.org/wiki/Special:FilePath/" + urllib.parse.quote(ad.replace(" ", "_")) + "?width=640"
    for deneme in range(4):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=60) as r:
                veri = r.read()
            with tempfile.NamedTemporaryFile(suffix=Path(ad).suffix or ".jpg") as t:
                t.write(veri)
                t.flush()
                subprocess.run(["cwebp", "-quiet", "-q", "68", "-resize", "640", "0", "-metadata", "none", t.name, "-o", str(hedef)],
                               check=True)
            return g["id"], "indi"
        except Exception as e:
            hata = str(e)
            time.sleep(3 * (deneme + 1))
    return g["id"], f"HATA {hata[:80]}"


def main():
    HEDEF.mkdir(parents=True, exist_ok=True)
    veri = json.loads((KOK / "gecit" / "gecitler.json").read_text())["gecitler"]
    liste = [g for g in veri if g["bolge"] in BOLGELER and g.get("foto")]
    sonuc = {}
    with ThreadPoolExecutor(4) as h:
        for gid, s in h.map(indir, liste):
            sonuc[gid] = s
    hatalar = {k: v for k, v in sonuc.items() if v.startswith("HATA")}
    print(f"{len(liste)} fotoğraf: {sum(v == 'indi' for v in sonuc.values())} indi, {sum(v == 'var' for v in sonuc.values())} vardı, {len(hatalar)} hata")
    for k, v in list(hatalar.items())[:20]:
        print(" ", k, v, file=sys.stderr)


if __name__ == "__main__":
    main()
