#!/usr/bin/env python3
"""Motoseyir tanıtım sitesi — çok dilli sayfa üreticisi.

Çalıştırma (depo kökünden):

    python3 uret.py

Ne yapar: `sablon/` altındaki HTML şablonlarını `dil/<kod>.json` metinleriyle
doldurup 14 dilde sayfa yazar. Türkçe KÖKE (index.html, ozellikler.html,
nasil-yapilir.html) — eski adresler bozulmasın diye. Diğer diller
`/<kod>/index.html` gibi alt yollara. Ayrıca sitemap.xml ve robots.txt
yeniden yazılır.

Rehber sayfaları (25 Eki 2026): `icerik/hub.<kod>.json` + `icerik/<grup>.<kod>.json` + `sablon/rehber.html` → `<dil>/<rehber dizini>/…`
(bkz. aşağıdaki «REHBER / BLOG» bölümü ve REHBER-EKLE.md).

Yalnız Python 3 standart kütüphanesi kullanılıyor; kurulum gerektirmez.

ELLE DÜZENLENMEZ: kökteki ve dil klasörlerindeki sayfalar (rehber dizinleri dahil) bu betiğin
çıktısıdır. Metin değişikliği `dil/<kod>.json`, yapı değişikliği `sablon/`
içine yazılır, sonra betik yeniden koşturulur.

ELLE TUTULANLAR (betik dokunmaz): gizlilik/index.html (TR tam politika),
gizlilik/en/index.html (İngilizce özet), gizlilik/de/index.html (Almanca),
impressum/index.html (Almanca) ve impressum/en/index.html (Legal notice) — sitemap'e yine bu betik yazar, indir/index.html, style.css, img/,
CNAME.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

KOK = Path(__file__).resolve().parent
SABLON = KOK / "sablon"
DIL = KOK / "dil"
ALAN = "https://motoseyir-app.com"
UYGULAMA_ID = "6792549131"
SAGLAYICI = "128439797"  # App Store Connect kampanya sağlayıcı kimliği (pt)
YIL = "2026"
GUNCELLEME = "2026-10-20"  # sitemap lastmod + JSON-LD dateModified

# Şablon adı -> (çıktı dosya adı, sitemap changefreq, sitemap priority)
SAYFALAR = {
    "index.html": ("index.html", "weekly", "1.0"),
    "ozellikler.html": ("ozellikler.html", "monthly", "0.8"),
    "nasil-yapilir.html": ("nasil-yapilir.html", "monthly", "0.6"),
    # AI CoRider sayfası (19 Eki 2026): koyu, kendi tasarımı — `sablon/corider.html` + `dil/corider.<kod>.json`
    # (anasayfa metinleri de okunur: k4_*, a4_*, c_*); stil `m/corider.css`, hareket `m/corider.js`.
    "corider.html": ("corider.html", "monthly", "0.8"),
}

# DİLLER — sıra hem dil seçicide hem sitemap'te bu sırayla görünür.
#
# vitrin: App Store ülke vitrini. Uygulama ABD'de YOK; İngilizce sayfa bu
# yüzden vitrinsiz adres kullanıyor — Apple onu okuyanın kendi mağazasına
# yönlendiriyor, "bu ülkede yok" duvarına çarpmıyor.
#
# hreflang'de x-default İngilizce: listede olmayan bir dille gelen ziyaretçi
# İngilizce sayfayı görsün.
DILLER = [
    {"kod": "tr", "ad": "Türkçe", "lang": "tr", "og": "tr_TR", "vitrin": "tr"},
    {"kod": "en", "ad": "English", "lang": "en", "og": "en_GB", "vitrin": None},
    {"kod": "de", "ad": "Deutsch", "lang": "de", "og": "de_DE", "vitrin": "de"},
    {"kod": "fr", "ad": "Français", "lang": "fr", "og": "fr_FR", "vitrin": "fr"},
    {"kod": "it", "ad": "Italiano", "lang": "it", "og": "it_IT", "vitrin": "it"},
    {"kod": "es", "ad": "Español", "lang": "es", "og": "es_ES", "vitrin": "es"},
    {"kod": "nl", "ad": "Nederlands", "lang": "nl", "og": "nl_NL", "vitrin": "nl"},
    {"kod": "pl", "ad": "Polski", "lang": "pl", "og": "pl_PL", "vitrin": "pl"},
    {"kod": "cs", "ad": "Čeština", "lang": "cs", "og": "cs_CZ", "vitrin": "cz"},
    {"kod": "sk", "ad": "Slovenčina", "lang": "sk", "og": "sk_SK", "vitrin": "sk"},
    {"kod": "hu", "ad": "Magyar", "lang": "hu", "og": "hu_HU", "vitrin": "hu"},
    {"kod": "ro", "ad": "Română", "lang": "ro", "og": "ro_RO", "vitrin": "ro"},
    {"kod": "hr", "ad": "Hrvatski", "lang": "hr", "og": "hr_HR", "vitrin": "hr"},
    {"kod": "el", "ad": "Ελληνικά", "lang": "el", "og": "el_GR", "vitrin": "gr"},
]

# Hareketli anasayfa (14 Eki 2026): yalnız TR ve EN anasayfası yeni tasarımda —
# `sablon/anasayfa.html` + `dil/anasayfa.<kod>.json`; stil/hareket `m/a.css`, `m/a.js` (+ ortak `m/h.js`).
# 18 Eki 2026: `dil/anasayfa.<kod>.json`u olan her dil yeni tasarıma geçer; olmayan eski şablonla
# (`sablon/index.html`) üretilmeye devam eder.
HAREKETLI_ANASAYFA = tuple(sorted(y.stem.split(".")[1] for y in (Path(__file__).resolve().parent / "dil").glob("anasayfa.*.json")))

# Yeni anasayfanın /m/ altındaki dile bağlı görselleri (ekran-*-<kod>.webp, gezi-<kod>.mp4, tani-<kod>.jpg):
# o dilin dosyası yoksa İngilizcesi kullanılır.
M_DILLI = re.compile(r'(/m/[a-z0-9-]+-)([a-z]{2})(\.(?:webp|jpg|png|mp4))')

# TELEFON DEMO KLİPLERİ (19 Eki 2026): şablonda `<img data-demo="<ad>" …>` işaretli ekran görüntüsü, o dilin klibi VARSA
# (`m/demo-<ad>-<kod>.mp4`) yerinde `<video>` ile değişir; yoksa işaret silinir, durağan görüntü olduğu gibi kalır.
# Klipler uygulamanın arayüz dilini gösterir (Türkçe metin) — başka dilin sayfasına Türkçe klip KONMAZ; o dilin klibi
# çekilince `m/demo-<ad>-<kod>.{mp4,webp}` (+ isteğe bağlı `-hevc.mp4`) dosyalarını koymak yeter, betik değişmez.
# `data-demo-ilk`: sayfanın ilk ekranındaki telefon — kapak (`poster`) doğrudan yazılır, video yükleme bittikten sonra başlar
# (bkz. m/a.js "telefon demoları"). Öteki kapaklar görünmeye yakın yüklenir (`data-poster`). `<noscript>` JS'siz durağan
# görüntüyü korur (a.css `.tel>noscript>img`).
# `type`ta TAM kodek dizisi: Chrome çıplak "hvc1"i reddeder (canPlayType "") ve sessizce H.264'e düşer; Safari ikisini de kabul eder.
# Klipler HEVC Main, seviye 5.0, ana kademe, hvc1 etiketli (ffprobe: profile=Main level=150).
HEVC_KODEK = "hvc1.1.6.L150.B0"
DEMO_IMG = re.compile(r'<img\b[^>]*?\bdata-demo="([a-z0-9-]+)"[^>]*>')
DEMO_ISARET = re.compile(r'\s+data-demo(?:-ilk)?(?:="[^"]*")?')
ALT = re.compile(r'\balt="([^"]*)"')


def demolari_yerlestir(html: str, kod: str) -> str:
    def degistir(m: re.Match) -> str:
        etiket, ad = m.group(0), m.group(1)
        durag = DEMO_ISARET.sub("", etiket)  # işaretsiz durağan görüntü
        if not (KOK / f"m/demo-{ad}-{kod}.mp4").exists():
            return durag
        ilk = "data-demo-ilk" in etiket
        kaynak = ""
        if (KOK / f"m/demo-{ad}-{kod}-hevc.mp4").exists():  # HEVC önce; a.js çözemeyen cihazda eler
            kaynak += f'<source data-src="/m/demo-{ad}-{kod}-hevc.mp4" type=\'video/mp4; codecs="{HEVC_KODEK}"\'>'
        kaynak += f'<source data-src="/m/demo-{ad}-{kod}.mp4" type="video/mp4">'
        kapak = ""
        if (KOK / f"m/demo-{ad}-{kod}.webp").exists():
            kapak = f' {"poster" if ilk else "data-poster"}="/m/demo-{ad}-{kod}.webp"'
        alt = ALT.search(etiket)
        etiket_alt = f' aria-label="{alt.group(1)}"' if alt and alt.group(1) else ""
        video = (f'<video data-demo{" data-demo-ilk" if ilk else ""} muted loop playsinline preload="none"{kapak}'
                 f' width="1320" height="2868"{etiket_alt}>{kaynak}</video>')
        return f"{video}<noscript>{durag}</noscript>"

    return DEMO_IMG.sub(degistir, html)


VARSAYILAN = "tr"  # köke yazılan dil
X_DEFAULT = "en"

# /indir/ ve /get/ reklam yönlendirme sayfaları `noindex`; robots.txt ile ENGELLENMEZ (engellenirse
# arama motoru noindex etiketini göremez). Sitemap'te de yoklar.
ROBOTS = f"""# Motoseyir tanıtım sitesi — {ALAN}/
User-agent: *
Allow: /

Sitemap: {ALAN}/sitemap.xml
"""


def dil_bilgisi(kod: str) -> dict:
    for d in DILLER:
        if d["kod"] == kod:
            return d
    raise KeyError(kod)


def cikti_dizin(kod: str) -> Path:
    """Türkçe köke, diğerleri /<kod>/ altına."""
    return KOK if kod == VARSAYILAN else KOK / kod


def sayfa_yolu(kod: str, dosya: str) -> str:
    """Sayfanın alan adına göre yolu — '/', '/ozellikler.html', '/de/' gibi."""
    on = "" if kod == VARSAYILAN else f"/{kod}"
    return f"{on}/" if dosya == "index.html" else f"{on}/{dosya}"


def magaza_baglantisi(kod: str, etiket: str = "") -> str:
    """App Store kampanya bağlantısı.

    `pt` (sağlayıcı) olmadan `ct` App Store Connect'te hiç görünmüyor — ikisi
    birlikte yazılıyor. `ct` dil başına ayrı, indirmenin hangi dildeki
    sayfadan geldiği ayrışsın diye. `etiket` verilirse `ct=site-<kod>-<etiket>`
    (rehber sayfaları `rehber`: indirme rehberden mi geldi ayrışsın).
    """
    vitrin = dil_bilgisi(kod)["vitrin"]
    yol = f"/{vitrin}/app/id{UYGULAMA_ID}" if vitrin else f"/app/id{UYGULAMA_ID}"
    ct = f"site-{kod}" + (f"-{etiket}" if etiket else "")
    return f"https://apps.apple.com{yol}?pt={SAGLAYICI}&amp;ct={ct}&amp;mt=8"


def gizlilik_url(kod: str) -> str:
    """Gizlilik politikası TR; İngilizce ve Almanca (21 Eki 2026) ayrı sayfalarda."""
    return {"en": "/gizlilik/en/", "de": "/gizlilik/de/"}.get(kod, "/gizlilik/")


def impressum_url(kod: str) -> str:
    """Impressum / Legal notice (21 Eki 2026): Almanca asıl metin, İngilizce sayfalar İngilizcesine gider."""
    return "/impressum/en/" if kod == "en" else "/impressum/"


def alternatifler(dosya: str) -> str:
    """hreflang bloğu: 14 dil + x-default. Her sayfada tam liste."""
    satir = []
    for d in DILLER:
        satir.append(
            f'<link rel="alternate" hreflang="{d["lang"]}" '
            f'href="{ALAN}{sayfa_yolu(d["kod"], dosya)}">'
        )
    satir.append(
        f'<link rel="alternate" hreflang="x-default" '
        f'href="{ALAN}{sayfa_yolu(X_DEFAULT, dosya)}">'
    )
    return "\n".join(satir)


def dil_secici(kod: str, dosya: str, metin: dict, yol=None) -> str:
    """Başlıktaki dil listesi.

    <details> ile: bayrak yok (bayrak dili değil ülkeyi anlatır), JavaScript
    yok, dil adları kendi dilinde. Kapalıyken tek satır yer tutuyor.
    `yol`: verilirse hedef adres `yol(dil_kodu)`'ndan gelir (rehber sayfaları).
    """
    yol = yol or (lambda k: sayfa_yolu(k, dosya))
    bu = dil_bilgisi(kod)
    ogeler = []
    for d in DILLER:
        if d["kod"] == kod:
            ogeler.append(f'<li><span aria-current="true">{d["ad"]}</span></li>')
        else:
            ogeler.append(
                f'<li><a href="{yol(d["kod"])}" lang="{d["lang"]}" '
                f'hreflang="{d["lang"]}">{d["ad"]}</a></li>'
            )
    liste = "\n    ".join(ogeler)
    # Dil adı ayrı <span>: dar ekranda yalnız kod kalıyor (bkz. style.css
    # `.dil-ad`). Başlık satırı 375 px'te taşıyordu — ad gizlenince sığıyor.
    return (
        '<details class="dil-sec">\n'
        f'  <summary aria-label="{metin["dil_sec_etiket"]}">'
        f'<span class="dil-kod">{kod.upper()}</span>'
        f'<span class="dil-ad">{bu["ad"]}</span></summary>\n'
        "  <ul>\n    " + liste + "\n  </ul>\n"
        "</details>"
    )


def dil_altbilgi(kod: str, dosya: str, yol=None) -> str:
    """Altbilgideki düz dil listesi — arama motorları ve JS'siz gezinme için."""
    yol = yol or (lambda k: sayfa_yolu(k, dosya))
    ogeler = []
    for d in DILLER:
        if d["kod"] == kod:
            ogeler.append(f'<li><strong lang="{d["lang"]}">{d["ad"]}</strong></li>')
        else:
            ogeler.append(
                f'<li><a href="{yol(d["kod"])}" lang="{d["lang"]}" '
                f'hreflang="{d["lang"]}">{d["ad"]}</a></li>'
            )
    return '<ul class="dil-liste">\n  ' + "\n  ".join(ogeler) + "\n</ul>"


GORSEL = re.compile(r'(src=")((?:\.\./)?img/)([a-z0-9][a-z0-9._-]*\.(?:jpg|png))(")')


def gorselleri_yerelle(html: str, kod: str) -> str:
    """Dili olan ekran görüntüsü varsa onu kullan, yoksa ortak TR görseli.

    Yerelleştirilmiş kareler `img/<kod>/<ad>` altında duruyor (uygulama
    deposundaki `store/screenshots/yeni-<dil>` setlerinden). Dosya yoksa
    şablondaki ortak yol olduğu gibi kalıyor — yeni bir dilin kareleri
    eklendiğinde bu betiği değiştirmek gerekmiyor, dosyayı koymak yeterli.
    """
    if kod == VARSAYILAN:
        return html

    def degistir(m: re.Match) -> str:
        on, yol, ad, kapa = m.groups()
        if (KOK / "img" / kod / ad).exists():
            return f"{on}{yol}{kod}/{ad}{kapa}"
        return m.group(0)

    return GORSEL.sub(degistir, html)


EKSIK = re.compile(r"\{\{([a-z0-9_]+)\}\}")


def doldur(sablon: str, degerler: dict, nerede: str) -> str:
    """{{anahtar}} yer tutucularını değiştir.

    Metinler kaçışlanmıyor: değerler bizim yazdığımız, içinde kasıtlı olarak
    <strong>, <span class="vurgu">, <br> gibi satır içi HTML var (bkz.
    README). Kullanıcıdan gelen veri yok.
    """
    cikti = sablon
    for anahtar, deger in degerler.items():
        cikti = cikti.replace("{{" + anahtar + "}}", str(deger))
    kalan = sorted(set(EKSIK.findall(cikti)))
    if kalan:
        raise SystemExit(f"HATA {nerede}: karşılığı olmayan anahtar(lar): {', '.join(kalan)}")
    return cikti


def sitemap() -> str:
    """Tüm sayfalar + hreflang grupları.

    Google hreflang'i sitemap'ten de okuyor; her <url> kendi grubunun tamamını
    (kendisi dahil) listeliyor — eksik listeleme sinyali geçersiz kılıyor.
    """
    parca = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        "<!--",
        "  Motoseyir tanıtım sitesi — sitemap. OTOMATİK ÜRETİLDİ: python3 uret.py",
        "  Elle düzenlemeyin; dil listesi ve sayfalar uret.py içinde.",
        "-->",
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
        '        xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    ]

    def grup(dosya: str) -> list[str]:
        satir = []
        for d in DILLER:
            satir.append(
                f'    <xhtml:link rel="alternate" hreflang="{d["lang"]}" '
                f'href="{ALAN}{sayfa_yolu(d["kod"], dosya)}"/>'
            )
        satir.append(
            f'    <xhtml:link rel="alternate" hreflang="x-default" '
            f'href="{ALAN}{sayfa_yolu(X_DEFAULT, dosya)}"/>'
        )
        return satir

    for sablon_adi, (dosya, sik, oncelik) in SAYFALAR.items():
        alt = grup(dosya)
        for d in DILLER:
            parca.append("  <url>")
            parca.append(f'    <loc>{ALAN}{sayfa_yolu(d["kod"], dosya)}</loc>')
            parca.append(f"    <lastmod>{GUNCELLEME}</lastmod>")
            parca.append(f"    <changefreq>{sik}</changefreq>")
            parca.append(f"    <priority>{oncelik}</priority>")
            parca.extend(alt)
            parca.append("  </url>")

    parca.extend(rehber_sitemap())

    # Elle tutulan sayfalar: gizlilik (TR tam metin + EN + DE) ve Impressum (DE + EN).
    GZ = [("tr", "/gizlilik/"), ("en", "/gizlilik/en/"), ("de", "/gizlilik/de/")]
    IM = [("de", "/impressum/"), ("en", "/impressum/en/")]
    for yol, esler, varsayilan in (
        ("/gizlilik/", GZ, "/gizlilik/en/"),
        ("/gizlilik/en/", GZ, "/gizlilik/en/"),
        ("/gizlilik/de/", GZ, "/gizlilik/en/"),
        ("/impressum/", IM, "/impressum/en/"),
        ("/impressum/en/", IM, "/impressum/en/"),
    ):
        parca.append("  <url>")
        parca.append(f"    <loc>{ALAN}{yol}</loc>")
        parca.append(f"    <lastmod>{GUNCELLEME}</lastmod>")
        parca.append("    <changefreq>yearly</changefreq>")
        parca.append("    <priority>0.3</priority>")
        for lang, hedef in esler:
            parca.append(
                f'    <xhtml:link rel="alternate" hreflang="{lang}" href="{ALAN}{hedef}"/>'
            )
        parca.append(
            f'    <xhtml:link rel="alternate" hreflang="x-default" href="{ALAN}{varsayilan}"/>'
        )
        parca.append("  </url>")

    parca.append("</urlset>")
    return "\n".join(parca) + "\n"



# ÖNBELLEK KIRICI (19 Eki 2026): GitHub Pages /m/*.css|js'i 10 dk önbelleğe veriyor; yayından sonra tarayıcı yeni HTML'i
# eski a.css ile çiziyordu (sahibin ekranında geçit şeridi düz liste, "Bir bakışta" bandı dağınık). Adrese içerik özeti
# eklenir: dosya değişince adres değişir, eski önbellek kullanılmaz.
import hashlib as _hashlib
_VARLIK = re.compile(r'((?:href|src)="/m/[A-Za-z0-9_.-]+\.(?:css|js))(")')
_ozet_onbellek: dict = {}
def varliklari_surumle(html: str) -> str:
    def degistir(m: re.Match) -> str:
        yol = m.group(1).split('"', 1)[1].lstrip("/")
        if yol not in _ozet_onbellek:
            dosya = KOK / yol
            _ozet_onbellek[yol] = _hashlib.md5(dosya.read_bytes()).hexdigest()[:8] if dosya.exists() else ""
        oz = _ozet_onbellek[yol]
        return f'{m.group(1)}?v={oz}{m.group(2)}' if oz else m.group(0)
    return _VARLIK.sub(degistir, html)


# ---------------------------------------------------------------------------------------------------------------------
# SEO ÜRETİMİ (20 Eki 2026): paylaşım/arama meta etiketleri ve JSON-LD tek yerden üretilir; şablonlarda yalnız
# `{{seo_head}}` ve `{{json_ld}}` yer tutucuları var. Başlık/açıklama dil dosyalarından gelir; og: ve twitter: etiketleri
# başlık/açıklamayla BİREBİR aynıdır. Anahtar kelime haritası ve gerekçe: SEO.md.
# ---------------------------------------------------------------------------------------------------------------------
import html as _html

SOSYAL_GORSEL = f"{ALAN}/img/og-kapak.jpg"  # 1200×630
LOGO = f"{ALAN}/img/uygulama-simgesi-512.png"  # 512×512, uygulama simgesi
# Sayfa -> (başlık anahtarı, açıklama anahtarı). Başlık ≤ 60, açıklama 140–160 karakter olmalı (denetim: SEO.md).
SEO_ANAHTAR = {
    "index.html": ("baslik", "aciklama"),
    "ozellikler.html": ("oz_baslik", "oz_aciklama"),
    "nasil-yapilir.html": ("ny_baslik", "ny_aciklama"),
    "corider.html": ("cr_baslik", "cr_aciklama"),
}
# Breadcrumb'ta sayfanın adı: (dil anahtarı veya sabit metin)
SEO_AD = {"ozellikler.html": "nav_ozellikler", "nasil-yapilir.html": "nav_nasil", "corider.html": "AI CoRider"}
SAMEAS = ["https://www.instagram.com/motoseyir.app/", "https://www.instagram.com/motoseyir.app.en/"]
# Arama motoru sahiplik doğrulaması (HTML etiketi yöntemi). Search Console / Bing "URL öneki" mülkü için sahibi etiketin
# `content` değerini verince buraya yazılır; yalnız Türkçe anasayfaya (https://motoseyir-app.com/) konur. Alan adı (DNS)
# yöntemi kullanılıyorsa boş kalır. Bkz. SEO.md.
DOGRULAMA = {"google-site-verification": "", "msvalidate.01": ""}


def duz(deger) -> str:
    """Dil dosyasındaki satır içi HTML'i düz metne çevir (meta ve JSON-LD için)."""
    s = re.sub(r"<br\s*/?>", " ", str(deger))
    s = re.sub(r"<[^>]+>", "", s)
    s = _html.unescape(s).replace("\xa0", " ")
    return re.sub(r"\s+", " ", s).strip()


def nitelik(deger) -> str:
    return _html.escape(duz(deger), quote=True)


def seo_head(dosya: str, v: dict) -> str:
    """robots + Open Graph + Twitter + dokunmatik simge. Başlık/açıklama sayfanın kendi <title>/description'ıyla aynı."""
    ba, ac = SEO_ANAHTAR[dosya]
    baslik, acik, url = nitelik(v[ba]), nitelik(v[ac]), v["kanonik"]
    satir = [
        '<meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1">',
        '<meta property="og:type" content="website">',
        '<meta property="og:site_name" content="Motoseyir">',
        f'<meta property="og:locale" content="{v["og_locale"]}">',
        f'<meta property="og:title" content="{baslik}">',
        f'<meta property="og:description" content="{acik}">',
        f'<meta property="og:url" content="{url}">',
        f'<meta property="og:image" content="{SOSYAL_GORSEL}">',
        '<meta property="og:image:type" content="image/jpeg">',
        '<meta property="og:image:width" content="1200">',
        '<meta property="og:image:height" content="630">',
        '<meta name="twitter:card" content="summary_large_image">',
        f'<meta name="twitter:title" content="{baslik}">',
        f'<meta name="twitter:description" content="{acik}">',
        f'<meta name="twitter:image" content="{SOSYAL_GORSEL}">',
        '<link rel="apple-touch-icon" href="/img/apple-touch-icon.png">',
    ]
    if dosya == "index.html" and v["dil_kodu"] == VARSAYILAN:
        satir += [f'<meta name="{ad}" content="{deger}">' for ad, deger in DOGRULAMA.items() if deger]
    return "\n".join(satir)


def m_gorsel(ad: str, kod: str) -> str:
    """/m/ekran-<ad>-<kod>.webp; o dilin dosyası yoksa İngilizcesi (sayfadaki görselle aynı kural)."""
    k = kod if (KOK / f"m/ekran-{ad}-{kod}.webp").exists() else "en"
    return f"{ALAN}/m/ekran-{ad}-{k}.webp"


def sorular(v: dict, soru: str, cevap: str) -> list:
    """Görünür SSS anahtarlarından FAQPage soruları. `soru`/`cevap` biçim dizgisi: "faq_q{}" / "cr_f{}_q" gibi.
    Yalnız sayfada görünen sorular girer (seo-denetim.py görünür metinle eşitliği doğrular)."""
    cikti = []
    for i in range(1, 30):
        if not v.get(soru.format(i)):
            break
        cikti.append({"@type": "Question", "name": duz(v[soru.format(i)]),
                      "acceptedAnswer": {"@type": "Answer", "text": duz(v[cevap.format(i)])}})
    return cikti


def json_ld(dosya: str, v: dict, kod: str) -> str:
    """JSON-LD @graph: Organization + WebSite + WebPage (+ BreadcrumbList alt sayfalarda) + MobileApplication
    (+ FAQPage: yalnız sayfada görünür SSS varsa — anasayfa ve AI CoRider). aggregateRating / review YOK."""
    ba, ac = SEO_ANAHTAR[dosya]
    url, lang = v["kanonik"], v["lang"]
    ana = f"{ALAN}/"
    anasayfa_url = f"{ALAN}{sayfa_yolu(kod, 'index.html')}"
    org = {"@type": "Organization", "@id": f"{ALAN}/#organization", "name": "Motoseyir", "url": ana,
           "logo": {"@type": "ImageObject", "url": LOGO, "width": 512, "height": 512}, "sameAs": SAMEAS}
    site = {"@type": "WebSite", "@id": f"{ALAN}/#website", "url": ana, "name": "Motoseyir", "inLanguage": lang,
            "publisher": {"@id": f"{ALAN}/#organization"}}
    uyg = {"@type": "MobileApplication", "@id": f"{ALAN}/#uygulama", "name": "Motoseyir", "operatingSystem": "iOS",
           "applicationCategory": "NavigationApplication", "inLanguage": lang, "url": anasayfa_url,
           "image": SOSYAL_GORSEL, "description": duz(v["jsonld_aciklama"]),
           "screenshot": [m_gorsel(a, kod) for a in ("nav", "tur", "gecit", "corider")],
           "offers": [
               {"@type": "Offer", "name": duz(v["plan_ucretsiz_ad"]), "price": "0", "priceCurrency": "EUR",
                "description": duz(v["jsonld_ucretsiz"])},
               {"@type": "Offer", "name": "Motoseyir Pro", "category": "subscription", "description": duz(v["jsonld_pro"])},
           ],
           "downloadUrl": _html.unescape(v["store"]), "publisher": {"@id": f"{ALAN}/#organization"}}
    sayfa = {"@type": "WebPage", "@id": f"{url}#sayfa", "url": url, "name": duz(v[ba]), "description": duz(v[ac]),
             "inLanguage": lang, "isPartOf": {"@id": f"{ALAN}/#website"}, "about": {"@id": f"{ALAN}/#uygulama"},
             "primaryImageOfPage": {"@type": "ImageObject", "url": SOSYAL_GORSEL, "width": 1200, "height": 630},
             "dateModified": GUNCELLEME}
    graf = [org, site, sayfa]
    if dosya != "index.html":
        ad = SEO_AD[dosya]
        sayfa["breadcrumb"] = {"@id": f"{url}#ekmek"}
        graf.append({"@type": "BreadcrumbList", "@id": f"{url}#ekmek", "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": duz(v["nav_anasayfa"]), "item": anasayfa_url},
            {"@type": "ListItem", "position": 2, "name": duz(v.get(ad, ad)), "item": url}]})
    graf.append(uyg)
    soru = []
    if dosya == "corider.html":
        soru = sorular(v, "cr_f{}_q", "cr_f{}_a")
    elif dosya == "index.html" and v.get("faq_q1"):
        soru = sorular(v, "faq_q{}", "faq_a{}")
    if soru:
        graf.append({"@type": "FAQPage", "@id": f"{url}#sss", "inLanguage": lang, "mainEntity": soru})
        sayfa["mainEntity"] = {"@id": f"{url}#sss"}
    govde = json.dumps({"@context": "https://schema.org", "@graph": graf}, ensure_ascii=False, indent=2)
    return '<script type="application/ld+json">\n' + govde.replace("</", "<\\/") + "\n</script>"


# ---------------------------------------------------------------------------------------------------------------------
# REHBER / BLOG (25 Eki 2026): rota, geçit ve tur-planlama yazıları. Uygulamanın kendi verisinden ve resmî kaynaklardan.
#
# Kaynak: `icerik/hub.<kod>.json` (dilin rehber ana sayfası + arayüz metinleri) ve `icerik/<grup>.<kod>.json` (yazı).
# `grup` = konu kimliği; aynı konunun farklı dillerdeki yazıları aynı `grup` adını taşır ve birbirinin hreflang eşi olur
# (yalnız var olan diller; yerel yazılar tek başına durur, hreflang yazılmaz). Çıktı:
#   TR  /rehber/                      /rehber/<slug>/
#   EN  /en/guides/   DE /de/ratgeber/   FR /fr/guides/   IT /it/guide/   ES /es/guias/
# Yeni yazı ekleme: REHBER-EKLE.md. Konu kuyruğu: REHBER-KUYRUK.md.
#
# Metinlerde {@grup} = aynı dildeki o yazının adresi, {@hub} {@anasayfa} {@ozellikler} {@nasil} {@corider} {@store}
# (rehber `ct` etiketli App Store bağlantısı) yer tutucuları kullanılır; karşılığı yoksa derleme durur.
# ---------------------------------------------------------------------------------------------------------------------
ICERIK = KOK / "icerik"
REHBER_DIZIN = {"tr": "rehber", "en": "guides", "de": "ratgeber", "fr": "guides", "it": "guide", "es": "guias"}
REHBER_ETIKET = "rehber"
HUB_ZORUNLU = ("baslik", "aciklama", "h1", "eyebrow", "lead", "guncelleme", "ui", "urun")
MAKALE_ZORUNLU = ("slug", "baslik", "aciklama", "h1", "eyebrow", "lead", "yayin", "guncelleme", "sira", "ozet",
                  "bolumler", "sss", "kaynaklar", "urun")
UI_ZORUNLU = ("rehber", "icindekiler", "yayin", "guncelleme", "kaynaklar", "kaynaklar_not", "sss", "ilgili", "oku",
              "ekmek", "tum_yazilar", "aylar", "anasayfa_baglanti", "tablo_etiket")
JETON = re.compile(r"\{@([a-z0-9-]+)\}")
_rehber_onbellek: list = []


def rehber_veri():
    """(hub, makale): hub[kod] = dict; makale[grup][kod] = dict. Eksik alan ya da hatalı kimlik derlemeyi durdurur."""
    if _rehber_onbellek:
        return _rehber_onbellek[0]
    hub, makale = {}, {}
    for f in sorted(ICERIK.glob("*.json")):
        if f.stem.count(".") != 1:
            raise SystemExit(f"HATA: icerik/{f.name}: ad '<grup>.<kod>.json' olmalı")
        grup, kod = f.stem.split(".")
        if kod not in REHBER_DIZIN:
            raise SystemExit(f"HATA: icerik/{f.name}: '{kod}' için rehber dizini tanımlı değil (REHBER_DIZIN)")
        v = json.loads(f.read_text(encoding="utf-8"))
        if grup == "hub":
            eksik = [a for a in HUB_ZORUNLU if a not in v] + [a for a in UI_ZORUNLU if a not in v.get("ui", {})]
            hub[kod] = v
        else:
            eksik = [a for a in MAKALE_ZORUNLU if a not in v]
            makale.setdefault(grup, {})[kod] = v
        if eksik:
            raise SystemExit(f"HATA: icerik/{f.name}: eksik alan(lar): {', '.join(eksik)}")
    slugs = {}
    for grup, diller in makale.items():
        for kod, v in diller.items():
            if kod not in hub:
                raise SystemExit(f"HATA: {kod} dilinde yazı var ama icerik/hub.{kod}.json yok")
            if slugs.setdefault((kod, v["slug"]), grup) != grup:
                raise SystemExit(f"HATA: {kod} dilinde aynı slug iki yazıda: {v['slug']}")
    _rehber_onbellek.append((hub, makale))
    return hub, makale


def rehber_hub_yolu(kod: str) -> str:
    on = "" if kod == VARSAYILAN else f"/{kod}"
    return f"{on}/{REHBER_DIZIN[kod]}/"


def rehber_yol(kod: str, grup: str) -> str:
    hub, makale = rehber_veri()
    return rehber_hub_yolu(kod) if grup == "hub" else f"{rehber_hub_yolu(kod)}{makale[grup][kod]['slug']}/"


def rehber_esler(grup: str) -> list:
    """Bu konunun var olduğu diller (DILLER sırasıyla)."""
    hub, makale = rehber_veri()
    var = hub if grup == "hub" else makale[grup]
    return [d["kod"] for d in DILLER if d["kod"] in var]


def rehber_dil_yolu(grup: str):
    """Dil seçicideki hedef: eşdeğer sayfa → yoksa o dilin rehber ana sayfası → yoksa o dilin anasayfası."""
    hub, _ = rehber_veri()
    esler = rehber_esler(grup)

    def yol(k: str) -> str:
        if k in esler:
            return rehber_yol(k, grup)
        if k in hub:
            return rehber_hub_yolu(k)
        return sayfa_yolu(k, "index.html")
    return yol


def rehber_alternatifler(grup: str) -> str:
    kodlar = rehber_esler(grup)
    if len(kodlar) < 2:  # tek dilli yazı: hreflang yok (kendine canonical yeter)
        return ""
    satir = [f'<link rel="alternate" hreflang="{dil_bilgisi(k)["lang"]}" href="{ALAN}{rehber_yol(k, grup)}">' for k in kodlar]
    varsayilan = X_DEFAULT if X_DEFAULT in kodlar else kodlar[0]
    satir.append(f'<link rel="alternate" hreflang="x-default" href="{ALAN}{rehber_yol(varsayilan, grup)}">')
    return "\n".join(satir)


def rehber_footer(kod: str) -> str:
    hub, _ = rehber_veri()
    if kod not in hub:
        return ""
    return f'<li><a href="{rehber_hub_yolu(kod)}">{hub[kod]["ui"]["rehber"]}</a></li>'


def rehber_baglam(kod: str) -> str:
    hub, _ = rehber_veri()
    if kod not in hub:
        return ""
    return f'<p class="cr-daha"><a href="{rehber_hub_yolu(kod)}">{hub[kod]["ui"]["anasayfa_baglanti"]}</a></p>'


def rehber_sitemap() -> list:
    hub, makale = rehber_veri()
    parca = []
    sirali = [("hub", hub, "0.7")] + [(g, makale[g], "0.7") for g in sorted(makale, key=lambda g: min(v["sira"] for v in makale[g].values()))]
    for grup, diller, oncelik in sirali:
        kodlar = rehber_esler(grup)
        alt = []
        if len(kodlar) > 1:
            alt = [f'    <xhtml:link rel="alternate" hreflang="{dil_bilgisi(k)["lang"]}" href="{ALAN}{rehber_yol(k, grup)}"/>' for k in kodlar]
            varsayilan = X_DEFAULT if X_DEFAULT in kodlar else kodlar[0]
            alt.append(f'    <xhtml:link rel="alternate" hreflang="x-default" href="{ALAN}{rehber_yol(varsayilan, grup)}"/>')
        for k in kodlar:
            parca += ["  <url>", f"    <loc>{ALAN}{rehber_yol(k, grup)}</loc>",
                      f"    <lastmod>{diller[k]['guncelleme']}</lastmod>", "    <changefreq>monthly</changefreq>",
                      f"    <priority>{oncelik}</priority>"] + alt + ["  </url>"]
    return parca


def webp_boyut(yol: Path):
    b = yol.read_bytes()[:40]
    if b[12:16] == b"VP8 ":
        return int.from_bytes(b[26:28], "little") & 0x3FFF, int.from_bytes(b[28:30], "little") & 0x3FFF
    if b[12:16] == b"VP8L":
        bits = int.from_bytes(b[21:25], "little")
        return (bits & 0x3FFF) + 1, ((bits >> 14) & 0x3FFF) + 1
    if b[12:16] == b"VP8X":
        return int.from_bytes(b[24:27], "little") + 1, int.from_bytes(b[27:30], "little") + 1
    raise SystemExit(f"HATA: webp boyutu okunamadı: {yol}")


def rehber_jetonlari_coz(deger, kod: str, nerede: str):
    """Metin içindeki {@...} yer tutucularını (özyinelemeli) bu dilin adresleriyle değiştirir."""
    _, makale = rehber_veri()
    if isinstance(deger, dict):
        return {a: rehber_jetonlari_coz(b, kod, nerede) for a, b in deger.items()}
    if isinstance(deger, list):
        return [rehber_jetonlari_coz(b, kod, nerede) for b in deger]
    if not isinstance(deger, str):
        return deger

    def degistir(m: re.Match) -> str:
        a = m.group(1)
        sabit = {"hub": rehber_hub_yolu(kod), "anasayfa": sayfa_yolu(kod, "index.html"),
                 "ozellikler": sayfa_yolu(kod, "ozellikler.html"), "nasil": sayfa_yolu(kod, "nasil-yapilir.html"),
                 "corider": sayfa_yolu(kod, "corider.html"), "store": magaza_baglantisi(kod, REHBER_ETIKET)}
        if a in sabit:
            return sabit[a]
        if a in makale and kod in makale[a]:
            return rehber_yol(kod, a)
        raise SystemExit(f"HATA {nerede}: {{@{a}}} bu dilde ({kod}) bir sayfaya karşılık gelmiyor")
    return JETON.sub(degistir, deger)


def r_liste(ogeler: list, sirali: bool = False) -> str:
    etiket = "ol" if sirali else "ul"
    return f"<{etiket}>" + "".join(f"<li>{o}</li>" for o in ogeler) + f"</{etiket}>"


def r_tablo(t: dict, ui: dict) -> str:
    bas = "".join(f'<th scope="col">{h}</th>' for h in t["baslik"])
    govde = ""
    for satir in t["satirlar"]:
        govde += f'<tr><th scope="row">{satir[0]}</th>' + "".join(f"<td>{h}</td>" for h in satir[1:]) + "</tr>"
    cap = t.get("baslik_metni", "")
    etiket = _html.escape(duz(cap) or ui["tablo_etiket"], quote=True)
    cikti = (f'<div class="rehber-tablo" role="region" aria-label="{etiket}" tabindex="0"><table>'
             + (f"<caption>{cap}</caption>" if cap else "") + f"<thead><tr>{bas}</tr></thead><tbody>{govde}</tbody></table></div>")
    if t.get("not"):
        cikti += f'<p class="kucuk">{t["not"]}</p>'
    return cikti


def r_bloklar(bloklar: list, ui: dict) -> str:
    cikti = []
    for b in bloklar:
        (tur, deger), = b.items()
        if tur == "p":
            cikti.append(f"<p>{deger}</p>")
        elif tur == "h3":
            cikti.append(f"<h3>{deger}</h3>")
        elif tur == "liste":
            cikti.append(r_liste(deger))
        elif tur == "adimlar":
            cikti.append(r_liste(deger, True))
        elif tur == "tablo":
            cikti.append(r_tablo(deger, ui))
        elif tur == "not":
            cikti.append(f'<p class="kucuk">{deger}</p>')
        else:
            raise SystemExit(f"HATA: bilinmeyen blok türü: {tur}")
    return "\n".join(cikti)


def r_tarih(iso: str, ui: dict) -> str:
    y, a, g = iso.split("-")
    return f"{int(g)} {ui['aylar'][int(a) - 1]} {y}"


def r_urun(urun: dict, kod: str, metin: dict) -> str:
    """Motoseyir bloğu: rolü 'kendi turunu çiz'; hazır rotalar yalnız `ikincil` cümlede (konumlandırma kuralı)."""
    govde = f'<h2>{urun["h2"]}</h2>\n' + "".join(f"<p>{p}</p>\n" for p in urun["p"])
    if urun.get("adimlar"):
        govde += r_liste(urun["adimlar"], True) + "\n"
    if urun.get("ikincil"):
        govde += f'<p class="kucuk">{urun["ikincil"]}</p>\n'
    govde += f'<p><a class="btn btn-primary" href="{magaza_baglantisi(kod, REHBER_ETIKET)}">{metin["btn_store"]}</a></p>\n'
    gorsel = ""
    if urun.get("gorsel"):
        ad = urun["gorsel"]
        k = kod if (KOK / f"m/ekran-{ad}-{kod}.webp").exists() else "en"
        yol = KOK / f"m/ekran-{ad}-{k}.webp"
        w, h = webp_boyut(yol)
        gorsel = (f'<img src="/m/ekran-{ad}-{k}.webp" alt="{_html.escape(urun["gorsel_alt"], quote=True)}" '
                  f'width="{w}" height="{h}" loading="lazy">')
    govde = govde.replace("<h2>", '<h2 id="urun-h2">', 1)
    return f'<section class="rehber-urun" aria-labelledby="urun-h2">\n<div>{govde}</div>\n{gorsel}\n</section>'


def r_ekmek(kod: str, ui: dict, metin: dict, son: str | None) -> str:
    hub = rehber_hub_yolu(kod)
    ogeler = [f'<a href="{sayfa_yolu(kod, "index.html")}">{metin["nav_anasayfa"]}</a>']
    ogeler.append(f'<a href="{hub}">{ui["rehber"]}</a>' if son else f'<span aria-current="page">{ui["rehber"]}</span>')
    if son:
        ogeler.append(f'<span aria-current="page">{son}</span>')
    return f'<nav class="rehber-ekmek" aria-label="{ui["ekmek"]}">' + " <span aria-hidden=\"true\">›</span> ".join(ogeler) + "</nav>"


def r_makale_govde(kod: str, grup: str, v: dict, ui: dict, metin: dict) -> str:
    hub, makale = rehber_veri()
    bolumler = v["bolumler"]
    for i, b in enumerate(bolumler):
        b.setdefault("id", f"b{i + 1}")
    icindekiler = ""
    if len(bolumler) >= 4:
        icindekiler = (f'<nav class="rehber-icindekiler" aria-label="{ui["icindekiler"]}"><p class="rehber-icindekiler-baslik">{ui["icindekiler"]}</p><ol>'
                       + "".join(f'<li><a href="#{b["id"]}">{b["h2"]}</a></li>' for b in bolumler) + "</ol></nav>")
    parca = [f'<section class="section rehber-ust"><div class="wrap">', r_ekmek(kod, ui, metin, duz(v["h1"])),
             f'<span class="eyebrow">{v["eyebrow"]}</span>', f"<h1>{v['h1']}</h1>", f'<p class="section-lead">{v["lead"]}</p>',
             f'<p class="rehber-meta">{ui["yayin"]}: <time datetime="{v["yayin"]}">{r_tarih(v["yayin"], ui)}</time> · '
             f'{ui["guncelleme"]}: <time datetime="{v["guncelleme"]}">{r_tarih(v["guncelleme"], ui)}</time></p>',
             "</div></section>", '<section class="section section-2 rehber-govde"><div class="wrap"><div class="rehber-kolon">']
    if icindekiler:
        parca.append(icindekiler)
    for b in bolumler:
        parca.append(f'<section id="{b["id"]}" class="rehber-bolum"><h2>{b["h2"]}</h2>\n{r_bloklar(b["icerik"], ui)}</section>')
    parca.append(r_urun(v["urun"], kod, metin))
    if v["sss"]:
        parca.append(f'<section id="sss" class="rehber-bolum"><h2>{ui["sss"]}</h2><ul class="rehber-sss-liste">'
                     + "".join(f"<li><h3>{s['s']}</h3><p>{s['c']}</p></li>" for s in v["sss"]) + "</ul></section>")
    digerleri = sorted(((makale[g][kod]["sira"], g) for g in makale if kod in makale[g] and g != grup))
    if digerleri:
        parca.append(f'<section class="rehber-bolum rehber-ilgili"><h2>{ui["ilgili"]}</h2><ul>'
                     + "".join(f'<li><a href="{rehber_yol(kod, g)}">{makale[g][kod]["h1"]}</a></li>' for _, g in digerleri)
                     + f'</ul><p><a href="{rehber_hub_yolu(kod)}">{ui["tum_yazilar"]}</a></p></section>')
    kaynak_liste = "".join(f'<li><a href="{k["url"]}" rel="noopener">{k["ad"]}</a></li>' for k in v["kaynaklar"])
    parca.append(f'<section id="kaynaklar" class="rehber-bolum rehber-kaynaklar"><h2>{ui["kaynaklar"]}</h2>'
                 f'<p class="kucuk">{ui["kaynaklar_not"]}</p><ul>{kaynak_liste}</ul></section>')
    parca.append("</div></div></section>")
    return "\n".join(parca)


def r_hub_govde(kod: str, v: dict, ui: dict, metin: dict) -> str:
    _, makale = rehber_veri()
    yazilar = sorted((m[kod]["sira"], g) for g, m in makale.items() if kod in m)
    kartlar = "".join(
        f'<li><article class="rehber-kart"><h2><a href="{rehber_yol(kod, g)}">{makale[g][kod]["h1"]}</a></h2>'
        f'<p>{makale[g][kod]["ozet"]}</p><p class="rehber-kart-oku"><a href="{rehber_yol(kod, g)}">{ui["oku"]}</a></p></article></li>'
        for _, g in yazilar)
    return "\n".join([
        '<section class="section rehber-ust"><div class="wrap">', r_ekmek(kod, ui, metin, None),
        f'<span class="eyebrow">{v["eyebrow"]}</span>', f"<h1>{v['h1']}</h1>", f'<p class="section-lead">{v["lead"]}</p>',
        '</div></section>', '<section class="section section-2 rehber-govde"><div class="wrap">',
        f'<ul class="rehber-kartlar">{kartlar}</ul>', '<div class="rehber-kolon">', r_urun(v["urun"], kod, metin), "</div>",
        "</div></section>"])


def rehber_seo_head(v: dict, baslik: str, aciklama: str, url: str, og_locale: str, makale: bool) -> str:
    b, a = _html.escape(baslik, quote=True), nitelik(aciklama)
    satir = ['<meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1">',
             f'<meta property="og:type" content="{"article" if makale else "website"}">',
             '<meta property="og:site_name" content="Motoseyir">', f'<meta property="og:locale" content="{og_locale}">',
             f'<meta property="og:title" content="{b}">', f'<meta property="og:description" content="{a}">',
             f'<meta property="og:url" content="{url}">', f'<meta property="og:image" content="{SOSYAL_GORSEL}">',
             '<meta property="og:image:type" content="image/jpeg">', '<meta property="og:image:width" content="1200">',
             '<meta property="og:image:height" content="630">']
    if makale:
        satir += [f'<meta property="article:published_time" content="{v["yayin"]}">',
                  f'<meta property="article:modified_time" content="{v["guncelleme"]}">']
    satir += ['<meta name="twitter:card" content="summary_large_image">', f'<meta name="twitter:title" content="{b}">',
              f'<meta name="twitter:description" content="{a}">', f'<meta name="twitter:image" content="{SOSYAL_GORSEL}">',
              '<link rel="apple-touch-icon" href="/img/apple-touch-icon.png">']
    return "\n".join(satir)


def rehber_json_ld(kod: str, grup: str, v: dict, ui: dict, metin: dict, baslik: str, aciklama: str, url: str) -> str:
    """Organization + WebSite + WebPage + BreadcrumbList; yazıda Article (+ görünür SSS varsa FAQPage), ana sayfada CollectionPage."""
    lang = dil_bilgisi(kod)["lang"]
    ana = f"{ALAN}/"
    org = {"@type": "Organization", "@id": f"{ALAN}/#organization", "name": "Motoseyir", "url": ana,
           "logo": {"@type": "ImageObject", "url": LOGO, "width": 512, "height": 512}, "sameAs": SAMEAS}
    site = {"@type": "WebSite", "@id": f"{ALAN}/#website", "url": ana, "name": "Motoseyir", "inLanguage": lang,
            "publisher": {"@id": f"{ALAN}/#organization"}}
    sayfa = {"@type": "CollectionPage" if grup == "hub" else "WebPage", "@id": f"{url}#sayfa", "url": url, "name": baslik,
             "description": aciklama, "inLanguage": lang, "isPartOf": {"@id": f"{ALAN}/#website"},
             "primaryImageOfPage": {"@type": "ImageObject", "url": SOSYAL_GORSEL, "width": 1200, "height": 630},
             "dateModified": v["guncelleme"], "breadcrumb": {"@id": f"{url}#ekmek"}}
    ogeler = [{"@type": "ListItem", "position": 1, "name": duz(metin["nav_anasayfa"]), "item": f"{ALAN}{sayfa_yolu(kod, 'index.html')}"}]
    if grup == "hub":
        ogeler.append({"@type": "ListItem", "position": 2, "name": duz(ui["rehber"]), "item": url})
    else:
        ogeler.append({"@type": "ListItem", "position": 2, "name": duz(ui["rehber"]), "item": f"{ALAN}{rehber_hub_yolu(kod)}"})
        ogeler.append({"@type": "ListItem", "position": 3, "name": duz(v["h1"]), "item": url})
    graf = [org, site, sayfa, {"@type": "BreadcrumbList", "@id": f"{url}#ekmek", "itemListElement": ogeler}]
    if grup != "hub":
        graf.append({"@type": "Article", "@id": f"{url}#makale", "headline": duz(v["h1"]), "description": aciklama,
                     "inLanguage": lang, "datePublished": v["yayin"], "dateModified": v["guncelleme"],
                     "author": {"@id": f"{ALAN}/#organization"}, "publisher": {"@id": f"{ALAN}/#organization"},
                     "mainEntityOfPage": {"@id": f"{url}#sayfa"}, "image": SOSYAL_GORSEL})
        if v["sss"]:
            graf.append({"@type": "FAQPage", "@id": f"{url}#sss", "inLanguage": lang, "mainEntity": [
                {"@type": "Question", "name": duz(s["s"]), "acceptedAnswer": {"@type": "Answer", "text": duz(s["c"])}} for s in v["sss"]]})
            sayfa["mainEntity"] = {"@id": f"{url}#sss"}
    govde = json.dumps({"@context": "https://schema.org", "@graph": graf}, ensure_ascii=False, indent=2)
    return '<script type="application/ld+json">\n' + govde.replace("</", "<\\/") + "\n</script>"


def rehber_yaz() -> int:
    """Her hub ve yazıyı `<dizin>/index.html` olarak yazar; yazılan dosya sayısını döndürür."""
    hub, makale = rehber_veri()
    sablon = (SABLON / "rehber.html").read_text(encoding="utf-8")
    yazilan = 0
    sayfalar = [("hub", k, hub[k]) for k in hub] + [(g, k, v) for g, m in makale.items() for k, v in m.items()]
    for grup, kod, v0 in sayfalar:
        d = dil_bilgisi(kod)
        metin = json.loads((DIL / f"{kod}.json").read_text(encoding="utf-8"))
        v = rehber_jetonlari_coz(v0, kod, f"icerik/{grup}.{kod}.json")
        ui = rehber_jetonlari_coz(hub[kod]["ui"], kod, f"icerik/hub.{kod}.json")
        yol = rehber_yol(kod, grup)
        url = f"{ALAN}{yol}"
        baslik = duz(v["baslik"])
        tam = f"{baslik} — Motoseyir"
        baslik_tam = tam if len(tam) <= 60 else baslik
        aciklama = duz(v["aciklama"])
        govde = r_hub_govde(kod, v, ui, metin) if grup == "hub" else r_makale_govde(kod, grup, v, ui, metin)
        degerler = {
            **metin,
            "lang": d["lang"], "baslik_tam": _html.escape(baslik_tam, quote=False),
            "aciklama_nitelik": _html.escape(aciklama, quote=True), "kanonik": url,
            "alternatifler": rehber_alternatifler(grup),
            "seo_head": rehber_seo_head(v, baslik_tam, aciklama, url, d["og"], grup != "hub"),
            "json_ld": rehber_json_ld(kod, grup, v, ui, metin, baslik_tam, aciklama, url),
            "dil_secici": dil_secici(kod, "", metin, rehber_dil_yolu(grup)),
            "dil_altbilgi": dil_altbilgi(kod, "", rehber_dil_yolu(grup)),
            "store": magaza_baglantisi(kod, REHBER_ETIKET), "gizlilik_url": gizlilik_url(kod),
            "impressum_url": impressum_url(kod), "anasayfa_url": sayfa_yolu(kod, "index.html"),
            "corider_url": sayfa_yolu(kod, "corider.html"), "ozellikler_url": sayfa_yolu(kod, "ozellikler.html"),
            "nasil_url": sayfa_yolu(kod, "nasil-yapilir.html"), "hub_url": rehber_hub_yolu(kod),
            "ui_rehber": ui["rehber"], "uygulama_id": UYGULAMA_ID, "yil": YIL, "rehber_icerik": govde,
        }
        html = doldur(sablon, degerler, f"{kod}/{grup}")
        hedef = KOK / yol.strip("/") / "index.html"
        hedef.parent.mkdir(parents=True, exist_ok=True)
        hedef.write_text(html, encoding="utf-8")
        yazilan += 1
    return yazilan


def main() -> None:
    sablonlar = {}
    for ad in SAYFALAR:
        yol = SABLON / ad
        if not yol.exists():
            raise SystemExit(f"HATA: şablon yok: {yol}")
        sablonlar[ad] = yol.read_text(encoding="utf-8")

    hareketli = (SABLON / "anasayfa.html").read_text(encoding="utf-8")

    yazilan = 0
    for d in DILLER:
        kod = d["kod"]
        json_yolu = DIL / f"{kod}.json"
        if not json_yolu.exists():
            raise SystemExit(f"HATA: metin dosyası yok: {json_yolu}")
        metin = json.loads(json_yolu.read_text(encoding="utf-8"))

        dizin = cikti_dizin(kod)
        dizin.mkdir(parents=True, exist_ok=True)

        for sablon_adi, (dosya, _, _) in SAYFALAR.items():
            ortak = {
                "kok": "" if kod == VARSAYILAN else "../",
                "lang": d["lang"],
                "og_locale": d["og"],
                "dil_kodu": kod,
                "kanonik": f"{ALAN}{sayfa_yolu(kod, dosya)}",
                "alternatifler": alternatifler(dosya),
                "dil_secici": dil_secici(kod, dosya, metin),
                "dil_altbilgi": dil_altbilgi(kod, dosya),
                "store": magaza_baglantisi(kod),
                "gizlilik_url": gizlilik_url(kod),
                "impressum_url": impressum_url(kod),
                "anasayfa_url": sayfa_yolu(kod, "index.html"),
                "corider_url": sayfa_yolu(kod, "corider.html"),
                "ozellikler_url": sayfa_yolu(kod, "ozellikler.html"),
                "nasil_url": sayfa_yolu(kod, "nasil-yapilir.html"),
                "uygulama_id": UYGULAMA_ID,
                "yil": YIL,
                "rehber_footer": rehber_footer(kod),
                "rehber_baglam": rehber_baglam(kod),
            }
            sablon_metni = sablonlar[sablon_adi]
            if dosya == "index.html" and kod in HAREKETLI_ANASAYFA:
                sablon_metni = hareketli
                metin_d = {**metin, **json.loads((DIL / f"anasayfa.{kod}.json").read_text(encoding="utf-8"))}
            elif dosya == "corider.html":
                metin_d = {**metin,
                           **json.loads((DIL / f"anasayfa.{kod}.json").read_text(encoding="utf-8")),
                           **json.loads((DIL / f"corider.{kod}.json").read_text(encoding="utf-8"))}
            else:
                metin_d = metin
            degerler = {**metin_d, **ortak}
            degerler["seo_head"] = seo_head(dosya, degerler)
            degerler["json_ld"] = json_ld(dosya, degerler, kod)
            html = doldur(sablon_metni, degerler, f"{kod}/{dosya}")
            html = varliklari_surumle(html)
            html = gorselleri_yerelle(html, kod)
            if sablon_metni is hareketli:
                html = demolari_yerlestir(html, kod)
            if sablon_metni is hareketli or dosya == "corider.html":
                html = M_DILLI.sub(lambda m: m.group(0) if m.group(2) != kod or (KOK / m.group(0).lstrip("/")).exists()
                                   else f"{m.group(1)}en{m.group(3)}", html)
            (dizin / dosya).write_text(html, encoding="utf-8")
            yazilan += 1

    rehber_yazilan = rehber_yaz()
    yazilan += rehber_yazilan

    (KOK / "sitemap.xml").write_text(sitemap(), encoding="utf-8")
    (KOK / "robots.txt").write_text(ROBOTS, encoding="utf-8")

    diller = ", ".join(d["kod"] for d in DILLER)
    print(f"{yazilan} sayfa yazıldı — {len(DILLER)} dil ({diller}); bunların {rehber_yazilan}'i rehber sayfası")
    print("sitemap.xml ve robots.txt yenilendi")


if __name__ == "__main__":
    main()
