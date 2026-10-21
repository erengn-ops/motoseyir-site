#!/usr/bin/env python3
"""Motoseyir SEO denetimi — yayından önce çalıştır:

    python3 uret.py && python3 seo-denetim.py

Yalnız Python 3 standart kütüphanesi. Hata varsa çıkış kodu 1.

Neye bakar (her HTML dosyası; `sablon/`, `*taslak.html` ve Search Console doğrulama dosyası `google*.html` hariç):
  - <title> ≤ 60, meta description 140–160 karakter; sayfa başına tek <h1>
  - og:title/og:description/twitter:title/twitter:description = title/description; og:url = canonical
  - canonical = sayfanın kendi adresi; hreflang kümesi tam (14 dil + x-default) ve karşılıklı
  - JSON-LD: her blok JSON olarak ayrışır; FAQPage soruları sayfadaki GÖRÜNÜR SSS ile birebir; aggregateRating/review yok
  - <img>: alt, width, height var
  - dahili bağlantılar (href/src) ve #parça hedefleri gerçekten var
  - sitemap.xml: her adres bir dosyaya karşılık gelir, indexlenebilir her sayfa sitemap'te, noindex sayfalar (indir, get, 404) yok
  - başlık ve açıklamalar tekil (aynı dilde iki sayfa aynı metni kullanmaz)
"""
from __future__ import annotations

import html as _html
import json
import os
import re
import sys
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit
import xml.etree.ElementTree as ET

KOK = Path(__file__).resolve().parent
ALAN = "https://motoseyir-app.com"
DILLER = ["tr", "en", "de", "fr", "it", "es", "nl", "pl", "cs", "sk", "hu", "ro", "hr", "el"]
HARIC_DIZIN = {"sablon", "_kanit", "node_modules", ".git", "m", "img", "dil"}
NOINDEX_BEKLENEN = {"indir/index.html", "get/index.html", "404.html"}
SERBEST_UZUNLUK = NOINDEX_BEKLENEN  # bu sayfalarda başlık/açıklama sınırı aranmaz


class Ayrac(HTMLParser):
    """Sayfadan title, meta, link, başlık, JSON-LD, img ve bağlantıları toplar."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.lang = None
        self.title = None
        self._t = False
        self.metas, self.links, self.imgs, self.refs, self.ids = [], [], [], [], set()
        self.basliklar = []  # (etiket, metin)
        self._h = None
        self.ld, self._ld, self._ldbuf = [], False, ""
        self.skip = 0

    def handle_starttag(self, t, a):
        a = dict(a)
        if "id" in a:
            self.ids.add(a["id"])
        if t == "html":
            self.lang = a.get("lang")
        elif t == "title":
            self._t = True
            self.title = ""
        elif t == "meta":
            self.metas.append(a)
        elif t == "link":
            self.links.append(a)
        elif t in ("h1", "h2", "h3", "h4"):
            self._h = [t, ""]
        elif t == "script":
            if a.get("type") == "application/ld+json":
                self._ld, self._ldbuf = True, ""
            else:
                self.skip += 1
        elif t in ("style", "noscript"):
            self.skip += 1
        elif t == "img":
            self.imgs.append(a)
        for k in ("href", "src", "poster", "data-src", "data-poster"):
            if not a.get(k):
                continue
            if t != "link" or a.get("rel") in ("icon", "apple-touch-icon", "stylesheet", "preload"):
                self.refs.append((t, k, a[k]))

    def handle_endtag(self, t):
        if t == "title":
            self._t = False
        elif t in ("h1", "h2", "h3", "h4") and self._h and self._h[0] == t:
            self.basliklar.append(tuple(self._h))
            self._h = None
        elif t == "script":
            if self._ld:
                self._ld = False
                self.ld.append(self._ldbuf)
            elif self.skip:
                self.skip -= 1
        elif t in ("style", "noscript") and self.skip:
            self.skip -= 1

    def handle_data(self, d):
        if self._t:
            self.title += d
        if self._ld:
            self._ldbuf += d
        if self._h is not None:
            self._h[1] += d


def _temiz(s: str) -> str:
    return re.sub(r"\s+", " ", _html.unescape(s).replace("\xa0", " ")).strip()


def meta(p: Ayrac, ad: str, nitelik: str = "name"):
    for m in p.metas:
        if m.get(nitelik) == ad:
            return m.get("content")
    return None


def beklenen_adres(rel: str) -> str:
    if rel == "index.html":
        return f"{ALAN}/"
    if rel.endswith("/index.html"):
        return f"{ALAN}/{rel[:-len('index.html')]}"
    return f"{ALAN}/{rel}"


def cevap_ciftleri_corider(src: str):
    """AI CoRider görünür SSS: <details class="sss"><summary>S</summary><div class="cevap"><p>C</p></div></details>"""
    cikti = []
    for q, a in re.findall(r'<details class="sss"[^>]*><summary>(.*?)</summary><div class="cevap"><p>(.*?)</p></div></details>', src, flags=re.S):
        cikti.append((_temiz(re.sub(r"<[^>]+>", "", q)), _temiz(re.sub(r"<[^>]+>", " ", a))))
    return cikti


def cevap_ciftleri_anasayfa(src: str):
    bolum = re.search(r'<section[^>]*id="sss".*?</section>', src, flags=re.S)
    if not bolum:
        return []
    return [(_temiz(re.sub(r"<[^>]+>", "", q)), _temiz(re.sub(r"<[^>]+>", " ", a)))
            for q, a in re.findall(r"<li><h3>(.*?)</h3><p>(.*?)</p></li>", bolum.group(0), flags=re.S)]


def ld_duz(s: str) -> str:
    return _temiz(re.sub(r"<[^>]+>", " ", s))


def main() -> int:
    hatalar, uyarilar = [], []
    sayfalar = {}
    for f in sorted(KOK.rglob("*.html")):
        rel = f.relative_to(KOK).as_posix()
        if f.relative_to(KOK).parts[0] in HARIC_DIZIN or rel.endswith("taslak.html"):
            continue
        if re.fullmatch(r"google[0-9a-f]+\.html", f.name):  # Search Console HTML dosyası doğrulaması: HTML değil, düz metin
            continue
        sayfalar[rel] = f
    if not sayfalar:
        print("HTML bulunamadı")
        return 1

    veri = {}
    for rel, f in sayfalar.items():
        src = f.read_text(encoding="utf-8")
        p = Ayrac()
        p.feed(src)
        veri[rel] = (p, src)
        if "{{" in src and rel != "404.html":
            hatalar.append(f"{rel}: çözülmemiş {{{{yer tutucu}}}} kalmış")

    basliklar, aciklamalar = {}, {}
    for rel, (p, src) in veri.items():
        noindex = rel in NOINDEX_BEKLENEN
        robots = meta(p, "robots") or ""
        if noindex:
            if "noindex" not in robots:
                hatalar.append(f"{rel}: noindex olmalı")
            continue
        if "noindex" in robots:
            hatalar.append(f"{rel}: beklenmedik noindex")
        title = _temiz(p.title or "")
        desc = meta(p, "description") or ""
        if not title:
            hatalar.append(f"{rel}: title yok")
        elif len(title) > 60:
            hatalar.append(f"{rel}: title {len(title)} karakter (>60): {title}")
        if not 140 <= len(desc) <= 160:
            hatalar.append(f"{rel}: description {len(desc)} karakter (140–160 olmalı)")
        h1 = [t for tag, t in p.basliklar if tag == "h1"]
        if len(h1) != 1:
            hatalar.append(f"{rel}: <h1> sayısı {len(h1)}")
        canon = [l["href"] for l in p.links if l.get("rel") == "canonical"]
        if canon != [beklenen_adres(rel)]:
            hatalar.append(f"{rel}: canonical {canon} ≠ {beklenen_adres(rel)}")
        for ad, deger in (("og:title", title), ("twitter:title", title)):
            v = meta(p, ad, "property" if ad.startswith("og:") else "name")
            if v is None or _temiz(v) != deger:
                hatalar.append(f"{rel}: {ad} başlıkla aynı değil")
        for ad in ("og:description", "twitter:description"):
            v = meta(p, ad, "property" if ad.startswith("og:") else "name")
            if v is None or _temiz(v) != _temiz(desc):
                hatalar.append(f"{rel}: {ad} açıklamayla aynı değil")
        if meta(p, "og:url", "property") != beklenen_adres(rel):
            hatalar.append(f"{rel}: og:url canonical değil")
        for ad in ("og:image", "og:image:width", "og:image:height", "twitter:image"):
            if not (meta(p, ad, "property" if ad.startswith("og:") else "name")):
                hatalar.append(f"{rel}: {ad} yok")
        if meta(p, "twitter:card") != "summary_large_image":
            hatalar.append(f"{rel}: twitter:card yok")
        if not getattr(p, "lang", None):
            hatalar.append(f"{rel}: <html lang> yok")
        dil = rel.split("/")[0] if rel.split("/")[0] in DILLER else "tr"
        if rel.startswith(("gizlilik/en/", "impressum/en/")):
            dil = "en"
        elif rel.startswith(("gizlilik/de/", "impressum/")):
            dil = "de"
        basliklar.setdefault((dil, title), []).append(rel)
        aciklamalar.setdefault((dil, desc), []).append(rel)
        # hreflang
        hl = {l["hreflang"]: l["href"] for l in p.links if l.get("rel") == "alternate" and "hreflang" in l}
        if rel.startswith("gizlilik/"):
            beklenen = {"tr", "en", "de", "x-default"}
        elif rel.startswith("impressum/"):
            beklenen = {"de", "en", "x-default"}
        else:
            beklenen = set(DILLER) | {"x-default"}
        if set(hl) != beklenen:
            hatalar.append(f"{rel}: hreflang kümesi eksik/fazla: {sorted(set(hl) ^ beklenen)}")
        for kod, url in hl.items():
            yol = urlsplit(url).path.lstrip("/")
            hedef = yol + "index.html" if (yol == "" or yol.endswith("/")) else yol
            if hedef not in veri:
                hatalar.append(f"{rel}: hreflang {kod} → {url} dosya yok")
                continue
            karsi = {l["hreflang"]: l["href"] for l in veri[hedef][0].links if l.get("rel") == "alternate" and "hreflang" in l}
            if karsi != hl:
                hatalar.append(f"{rel}: hreflang karşılıklı değil ({kod} sayfası farklı küme listeliyor)")
        # JSON-LD
        tipler = []
        for blok in p.ld:
            try:
                j = json.loads(blok)
            except Exception as e:  # noqa: BLE001
                hatalar.append(f"{rel}: JSON-LD ayrışmıyor: {e}")
                continue
            dugumler = j["@graph"] if isinstance(j, dict) and "@graph" in j else [j]
            for d in dugumler:
                t = d.get("@type")
                tipler.append(t if isinstance(t, str) else "+".join(t))
                if t == "FAQPage":
                    gorunur = cevap_ciftleri_corider(src) if rel.endswith("corider.html") else cevap_ciftleri_anasayfa(src)
                    ld_sss = [(ld_duz(q["name"]), ld_duz(q["acceptedAnswer"]["text"])) for q in d["mainEntity"]]
                    if gorunur != ld_sss or not gorunur:
                        hatalar.append(f"{rel}: FAQPage ile görünür SSS aynı değil ({len(ld_sss)} ↔ {len(gorunur)})")
            if re.search(r'"(aggregateRating|review|reviewRating|ratingValue)"', blok):
                hatalar.append(f"{rel}: aggregateRating/review yasak")
        if not tipler:
            hatalar.append(f"{rel}: JSON-LD yok")
        elif "WebPage" not in tipler:
            hatalar.append(f"{rel}: JSON-LD'de WebPage yok")
        if not rel.startswith(("gizlilik/", "impressum/")) and not {"Organization", "WebSite", "MobileApplication"} <= set(tipler):
            hatalar.append(f"{rel}: JSON-LD türleri eksik: {tipler}")
        if rel not in ("index.html",) and not rel.endswith("/index.html") and not rel.startswith(("gizlilik/", "impressum/")) and "BreadcrumbList" not in tipler:
            hatalar.append(f"{rel}: BreadcrumbList yok")
        # görseller
        for im in p.imgs:
            if "alt" not in im:
                hatalar.append(f"{rel}: <img> alt yok: {im.get('src')}")
            if "width" not in im or "height" not in im:
                hatalar.append(f"{rel}: <img> width/height yok: {im.get('src')}")

    for (dil, t), liste in basliklar.items():
        if len(liste) > 1:
            hatalar.append(f"aynı başlık ({dil}): {t!r} → {liste}")
    for (dil, d), liste in aciklamalar.items():
        if len(liste) > 1:
            hatalar.append(f"aynı açıklama ({dil}): {liste}")

    # ---- dahili bağlantılar ----
    def cozumle(url: str, sayfa: str):
        u = urlsplit(url)
        if u.scheme in ("http", "https"):
            if u.netloc != "motoseyir-app.com":
                return None, None
            yol = u.path
        elif u.scheme in ("mailto", "tel", "javascript", "data", "sms", "itms-apps"):
            return None, None
        elif u.path == "":
            return sayfa, u.fragment
        elif u.path.startswith("/"):
            yol = u.path
        else:
            yol = "/" + os.path.normpath(os.path.join(os.path.dirname(sayfa), u.path))
        yol = unquote(yol)
        p = KOK / yol.lstrip("/")
        adaylar = [p / "index.html"] if yol.endswith("/") else [p, p.with_suffix(".html") if p.suffix == "" else p, p / "index.html"]
        for c in adaylar:
            if c.exists() and c.is_file():
                return c.relative_to(KOK).as_posix(), u.fragment
        return False, u.fragment

    n = 0
    for rel, (p, src) in veri.items():
        for t, k, url in p.refs:
            n += 1
            hedef, frag = cozumle(url, rel)
            if hedef is None:
                continue
            if hedef is False:
                hatalar.append(f"{rel}: kırık bağlantı {k}={url}")
            elif frag and hedef in veri and frag not in veri[hedef][0].ids:
                hatalar.append(f"{rel}: #{frag} hedefi yok → {hedef}")

    # ---- sitemap ----
    ns = {"s": "http://www.sitemaps.org/schemas/sitemap/0.9"}
    kok = ET.parse(KOK / "sitemap.xml").getroot()
    adresler = [u.find("s:loc", ns).text for u in kok.findall("s:url", ns)]
    for u in kok.findall("s:url", ns):
        lm = u.find("s:lastmod", ns)
        if lm is None or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", lm.text or ""):
            hatalar.append(f"sitemap: lastmod geçersiz {u.find('s:loc', ns).text}")
    gorulen = set()
    for a in adresler:
        yol = urlsplit(a).path.lstrip("/")
        hedef = yol + "index.html" if (yol == "" or yol.endswith("/")) else yol
        if hedef not in veri:
            hatalar.append(f"sitemap: dosya yok {a}")
        if hedef in NOINDEX_BEKLENEN:
            hatalar.append(f"sitemap: noindex sayfa listelenmiş {a}")
        if a in gorulen:
            hatalar.append(f"sitemap: yinelenen adres {a}")
        gorulen.add(a)
    for rel in veri:
        if rel not in NOINDEX_BEKLENEN and beklenen_adres(rel) not in gorulen:
            hatalar.append(f"sitemap'te yok: {rel}")
    robots = (KOK / "robots.txt").read_text(encoding="utf-8")
    if f"Sitemap: {ALAN}/sitemap.xml" not in robots:
        hatalar.append("robots.txt: Sitemap satırı yok")
    for yasak in ("/indir", "/get"):
        if re.search(rf"^Disallow:\s*{yasak}", robots, flags=re.M):
            hatalar.append(f"robots.txt: {yasak} engellenmiş (noindex etiketi okunamaz)")

    print(f"{len(veri)} HTML dosyası, {n} dahili bağlantı, {len(adresler)} sitemap adresi denetlendi.")
    for u in uyarilar:
        print("UYARI:", u)
    if hatalar:
        print(f"{len(hatalar)} HATA:")
        for h in hatalar[:200]:
            print(" -", h)
        return 1
    print("Sorun yok.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
