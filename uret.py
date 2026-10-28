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
    parca.extend(arac_sitemap())
    parca.extend(tanitim_sitemap())
    parca.extend(gecit_sitemap())

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
_VARLIK = re.compile(r'((?:href|src)="/m/(?:[A-Za-z0-9_.-]+/)*[A-Za-z0-9_.-]+\.(?:css|js))(")')
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
# ---------------------------------------------------------------------------------------------------------------------
# WEB TUR ÜRETİCİ SAYFALARI (25 Eki 2026) — uygulamadaki "Tur üret"in tarayıcıdaki karşılığı. Arama niyeti: "motorcycle route
# generator", "motorrad rundtour planen", TR "motosiklet tur oluşturucu". Üç dilde (TR, EN, DE), tek hreflang kümesi.
#   TR /tur-olusturucu/   EN /en/motorcycle-route-generator/   DE /de/motorrad-rundtour-planen/
# Metin: arac/tur-uretici.<kod>.json (arayüz dizgeleri `ui` içinde, sayfaya JSON olarak da gömülür). Şablon: sablon/arac.html.
# Stil/davranış: m/tur/tur.css, m/tur/tur.js; hesap motoru m/tur/motor.js (moto-rota'dan paketlenir: tur-araci/derle.mjs).
# Telefona aktarma: tur kodu (vekil → /tur/paylas), QR + `motoseyir://tur/<KOD>`; bkz. tur-araci/README.md.
# ---------------------------------------------------------------------------------------------------------------------
ARAC_ICERIK = KOK / "arac"
ARAC_ETIKET = "web-tur"  # App Store `ct`: site-web-tur (hangi dil olursa olsun aynı etiket)
ARAC_VEKIL = "https://motorota-rota.erengn.workers.dev"  # Cloudflare Worker (server/rota-worker): rota + tur kodu, CORS yalnız bu site
ARAC_KOD_KOKU = "https://rota.motoseyir-app.com"  # QR/bağlantı /k/<KOD> sayfası (sunucu tur kodunu uygulamaya yönlendiriyor)
PLAY_BAGLANTISI = None  # Android sürümü Google Play'de yayına girince buraya mağaza adresi yazılır (25 Eki 2026'da sayfa 404)
ARAC_ZORUNLU = ("anasayfa_baglanti", "dizin", "baslik", "aciklama", "h1", "eyebrow", "lead", "yayin", "guncelleme", "ondalik", "ui", "adimlar_h2", "adimlar",
                "bolumler", "sss", "urun", "urun_dugme", "ilgili_baslik", "ilgili", "kaynaklar_baslik", "kaynaklar", "tasarim")
_arac_onbellek: list = []


def arac_veri() -> dict:
    """arac[kod] = dict. Eksik alan ya da diller arası arayüz anahtarı farkı derlemeyi durdurur."""
    if _arac_onbellek:
        return _arac_onbellek[0]
    veri = {}
    for f in sorted(ARAC_ICERIK.glob("tur-uretici.*.json")):
        kod = f.stem.split(".")[1]
        v = json.loads(f.read_text(encoding="utf-8"))
        eksik = [a for a in ARAC_ZORUNLU if a not in v]
        if eksik:
            raise SystemExit(f"HATA: arac/{f.name}: eksik alan(lar): {', '.join(eksik)}")
        veri[kod] = v
    if veri:
        ana = set(next(iter(veri.values()))["ui"])
        for kod, v in veri.items():
            fark = ana ^ set(v["ui"])
            if fark:
                raise SystemExit(f"HATA: arac/tur-uretici.{kod}.json: ui anahtarları diğer dillerden farklı: {sorted(fark)}")
    _arac_onbellek.append(veri)
    return veri


def arac_yol(kod: str) -> str:
    on = "" if kod == VARSAYILAN else f"/{kod}"
    return f"{on}/{arac_veri()[kod]['dizin']}/"


def arac_footer(kod: str) -> str:
    if kod not in arac_veri():
        return ""
    return (f'<li><a href="{arac_yol(kod)}">{arac_veri()[kod]["ui"]["ekmek_son"]}</a></li>'
            + f'<li><a href="{tanitim_yol(kod)}">{tanitim_veri()[kod]["ad"]}</a></li>' + gecit_footer(kod))


def arac_baglanti(kod: str) -> str:
    """Anasayfadaki "Tur üret" bölümünün altındaki bağlantı (TR/EN/DE); öteki dillerde boş."""
    if kod not in arac_veri():
        return ""
    return (f'<p class="arac-baglanti"><a class="btn btn-hayalet btn-kucuk" href="{arac_yol(kod)}">{arac_veri()[kod]["anasayfa_baglanti"]} →</a> '
            f'<a class="btn btn-hayalet btn-kucuk" href="{tanitim_yol(kod)}">{tanitim_veri()[kod]["ad"]} →</a></p>')


def arac_menu(kod: str) -> str:
    """Anasayfa üst menüsünde web tur oluşturucu (26 Eki, kullanıcı: "ana sayfaya tur generator ile ilgili bir şey koymamışsın")."""
    if kod not in arac_veri():
        return ""
    return f'<li><a href="{arac_yol(kod)}">{arac_veri()[kod]["ui"]["ekmek_son"]}</a></li>'


def arac_hero(kod: str) -> str:
    if kod not in arac_veri():
        return ""
    return f'<a class="btn btn-cam" href="{arac_yol(kod)}">{arac_veri()[kod]["anasayfa_hero"]} →</a>'


def arac_bant(kod: str) -> str:
    """Rakam şeridinin altında web aracının görselli bandı (TR/EN/DE; görsel m/web-arac-<kod>.webp)."""
    if kod not in arac_veri():
        return ""
    b = arac_veri()[kod]["anasayfa_bant"]
    return (f'<section class="web-arac" aria-labelledby="web-arac-h"><div class="web-arac-ic">'
            f'<div class="web-arac-metin" data-r><p class="ust-yazi">{b["ust"]}</p><h2 id="web-arac-h">{b["h2"]}</h2><p>{b["p"]}</p>'
            f'<a class="btn" href="{arac_yol(kod)}">{b["btn"]} →</a></div>'
            f'<a class="web-arac-gorsel" href="{arac_yol(kod)}" tabindex="-1" data-r><img src="/m/web-arac-{kod}.webp" alt="{b["alt"]}" '
            f'width="1200" height="769" loading="lazy" decoding="async"></a></div></section>')


def arac_dil_yolu(k: str) -> str:
    return arac_yol(k) if k in arac_veri() else sayfa_yolu(k, "index.html")


def arac_alternatifler() -> str:
    kodlar = [d["kod"] for d in DILLER if d["kod"] in arac_veri()]
    satir = [f'<link rel="alternate" hreflang="{dil_bilgisi(k)["lang"]}" href="{ALAN}{arac_yol(k)}">' for k in kodlar]
    varsayilan = X_DEFAULT if X_DEFAULT in kodlar else kodlar[0]
    satir.append(f'<link rel="alternate" hreflang="x-default" href="{ALAN}{arac_yol(varsayilan)}">')
    return "\n".join(satir)


def arac_sitemap() -> list:
    veri = arac_veri()
    kodlar = [d["kod"] for d in DILLER if d["kod"] in veri]
    if not kodlar:
        return []
    alt = [f'    <xhtml:link rel="alternate" hreflang="{dil_bilgisi(k)["lang"]}" href="{ALAN}{arac_yol(k)}"/>' for k in kodlar]
    varsayilan = X_DEFAULT if X_DEFAULT in kodlar else kodlar[0]
    alt.append(f'    <xhtml:link rel="alternate" hreflang="x-default" href="{ALAN}{arac_yol(varsayilan)}"/>')
    parca = []
    for k in kodlar:
        parca += ["  <url>", f"    <loc>{ALAN}{arac_yol(k)}</loc>", f"    <lastmod>{veri[k]['guncelleme']}</lastmod>",
                  "    <changefreq>monthly</changefreq>", "    <priority>0.9</priority>"] + alt + ["  </url>"]
    return parca


def arac_magaza(kod: str) -> str:
    """App Store bağlantısı, `ct=site-web-tur` (dilden bağımsız); vitrin dilin vitrini."""
    return magaza_baglantisi(kod, "").replace(f"ct=site-{kod}&amp;", f"ct=site-{ARAC_ETIKET}&amp;")


def uygulama_dugumu(kod: str, magaza: str) -> dict:
    """Araç ve tanıtım sayfalarındaki MobileApplication (27 Eki 2026, SEO): anasayfadakiyle aynı @id; indirme ücretsiz, Pro uygulama
    içi abonelik. aggregateRating / review YOK (uydurma puan yazılmaz)."""
    return {"@type": "MobileApplication", "@id": f"{ALAN}/#uygulama", "name": "Motoseyir", "operatingSystem": "iOS",
            "applicationCategory": "NavigationApplication", "inLanguage": dil_bilgisi(kod)["lang"],
            "url": f"{ALAN}{sayfa_yolu(kod, 'index.html')}", "image": SOSYAL_GORSEL, "downloadUrl": _html.unescape(magaza),
            "offers": {"@type": "Offer", "price": "0", "priceCurrency": "EUR"}, "publisher": {"@id": f"{ALAN}/#organization"}}


def arac_json_ld(kod: str, v: dict, hub_ui: dict, metin: dict, baslik: str, aciklama: str, url: str) -> str:
    lang = dil_bilgisi(kod)["lang"]
    ana = f"{ALAN}/"
    org = {"@type": "Organization", "@id": f"{ALAN}/#organization", "name": "Motoseyir", "url": ana,
           "logo": {"@type": "ImageObject", "url": LOGO, "width": 512, "height": 512}, "sameAs": SAMEAS}
    site = {"@type": "WebSite", "@id": f"{ALAN}/#website", "url": ana, "name": "Motoseyir", "inLanguage": lang,
            "publisher": {"@id": f"{ALAN}/#organization"}}
    sayfa = {"@type": "WebPage", "@id": f"{url}#sayfa", "url": url, "name": baslik, "description": aciklama, "inLanguage": lang,
             "isPartOf": {"@id": f"{ALAN}/#website"}, "primaryImageOfPage": {"@type": "ImageObject", "url": SOSYAL_GORSEL, "width": 1200, "height": 630},
             "dateModified": v["guncelleme"], "breadcrumb": {"@id": f"{url}#ekmek"}, "mainEntity": {"@id": f"{url}#arac"}}
    ekmek = {"@type": "BreadcrumbList", "@id": f"{url}#ekmek", "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": duz(metin["nav_anasayfa"]), "item": f"{ALAN}{sayfa_yolu(kod, 'index.html')}"},
        {"@type": "ListItem", "position": 2, "name": duz(v["ui"]["ekmek_son"]), "item": url}]}
    uygulama = {"@type": "WebApplication", "@id": f"{url}#arac", "name": duz(v["h1"]), "url": url, "description": aciklama,
                "applicationCategory": "TravelApplication", "operatingSystem": "Any (web browser)", "browserRequirements": "Requires JavaScript",
                "inLanguage": lang, "isAccessibleForFree": True, "offers": {"@type": "Offer", "price": "0", "priceCurrency": "USD"},
                "publisher": {"@id": f"{ALAN}/#organization"}, "datePublished": v["yayin"], "dateModified": v["guncelleme"]}
    sss = {"@type": "FAQPage", "@id": f"{url}#sss", "inLanguage": lang, "mainEntity": [
        {"@type": "Question", "name": duz(s["s"]), "acceptedAnswer": {"@type": "Answer", "text": duz(s["c"])}} for s in v["sss"]]}
    govde = json.dumps({"@context": "https://schema.org", "@graph": [org, site, sayfa, ekmek, uygulama, uygulama_dugumu(kod, arac_magaza(kod)), sss]},
                       ensure_ascii=False, indent=2)
    return '<script type="application/ld+json">\n' + govde.replace("</", "<\\/") + "\n</script>"


def arac_icerik_govde(kod: str, v: dict) -> str:
    """Aracın altındaki içerik (anasayfa kalıbında bölümler): metin bölümleri, SSS, ilgili rehberler, atıflar.
    "Nasıl çalışır" adımları sticky anlatıda (arac_hikaye); ürün bloğu bitiş çağrısında (arac_varis)."""
    hub, makale = rehber_veri()
    parca = []
    for b in v["bolumler"]:
        parca.append(f'<section class="bolum" id="{b["id"]}"><div class="kap"><div class="tur-yazi" data-r><h2>{b["h2"]}</h2>\n{r_bloklar(b["icerik"], {"tablo_etiket": ""})}</div></div></section>')
    parca.append(f'<section class="bolum" id="sss" aria-labelledby="sss-h"><div class="kap"><h2 id="sss-h">{hub[kod]["ui"]["sss"]}</h2><ul class="izgara tur-sss" data-r>'
                 + "".join(f"<li><h3>{s['s']}</h3><p>{s['c']}</p></li>" for s in v["sss"]) + "</ul></div></section>")
    return "\n".join(parca)


def arac_ayrinti(kod: str, v: dict, kaynak_goster: bool = True) -> str:
    """Bitiş çağrısından sonra: ilgili rehberler ve veri atıfları (anasayfadaki .ayr kalıbı)."""
    hub, makale = rehber_veri()
    ilgili = [g for g in v["ilgili"] if g in makale and kod in makale[g]]
    sol = ""
    if ilgili:
        sol = (f'<div class="rehber-ilgili"><p class="km">{v["tasarim"]["ilgili_etiket"]}</p><h2>{v["ilgili_baslik"]}</h2><ul class="d">'
               + "".join(f'<li><a href="{rehber_yol(kod, g)}">{makale[g][kod]["h1"]}</a></li>' for g in ilgili)
               + f'</ul><a class="ok" href="{rehber_hub_yolu(kod)}">{hub[kod]["ui"]["tum_yazilar"]}</a></div>')
    kaynak = "".join(f'<li><a href="{k["url"]}" rel="noopener">{k["ad"]}</a></li>' for k in v["kaynaklar"])
    sag = f'<div id="kaynaklar" class="rehber-kaynaklar"><h2>{v["kaynaklar_baslik"]}</h2><ul class="d">{kaynak}</ul></div>' if kaynak_goster else ""
    if not sol and not sag:
        return ""

    return f'<section class="ayr"><div class="kap">{sol}{sag}</div></section>'


def arac_varis(kod: str, v: dict) -> str:
    u = v["urun"]
    govde = "".join(f'<p class="metin">{p}</p>' for p in u["p"])
    if u.get("ikincil"):
        govde += f'<p class="metin kucuk">{u["ikincil"]}</p>'
    return (f'<section class="varis" data-ton aria-labelledby="urun-h2"><div class="kap" data-r><h2 id="urun-h2">{u["h2"]}</h2>{govde}'
            f'<div class="cta-satir"><a class="btn" href="{arac_magaza(kod)}">{v["urun_dugme"]}</a></div></div></section>\n'
            + arac_ayrinti(kod, v))


def arac_hikaye(kod: str, v: dict, href: str = "#arac-bolum") -> tuple:
    """Sticky anlatı: adım listesi + 3. adımdaki gerçek ekran kaydı (klip yalnız TR'de var; hangi dilde olursa o klip)."""
    t = v["tasarim"]
    ad = "".join(
        f'        <li class="hk-adim{" on" if i == 0 else ""}" data-i="{i}"><p class="km">{t["adim"].format(n=i + 1)}</p><h3>{b}</h3>'
        f'<p class="metin">{p}</p><a class="hk-link" href="{href}">{t["dene"]}</a></li>\n'
        for i, (b, p) in enumerate(v["adimlar"]))
    klip = "tur-uret-tr"
    kaynak = ""
    if (KOK / f"m/demo-{klip}-hevc.mp4").exists():
        kaynak += f'<source data-src="/m/demo-{klip}-hevc.mp4" type=\'video/mp4; codecs="{HEVC_KODEK}"\'>'
    kaynak += f'<source data-src="/m/demo-{klip}.mp4" type="video/mp4">'
    video = (f'<video class="e e2" data-demo data-demo-gec="2" muted loop playsinline preload="none" poster="/m/ekran-tur-{kod}.webp" '
             f'data-poster="/m/demo-{klip}.webp" width="1320" height="2868" aria-hidden="true" tabindex="-1">{kaynak}</video>'
             f'<noscript><img class="e e2" src="/m/ekran-tur-{kod}.webp" alt="" width="540" height="1174"></noscript>')
    return ad.rstrip("\n"), video


# ---------------------------------------------------------------------------------------------------------------------
# TANITIM SAYFASI (27 Eki 2026): telefondaki "Tur üret" özelliğini anlatan sayfa — web uygulamasından AYRI (iki ayrı niyet, iki ayrı sayfa).
#   TR /tur-uret/   EN /en/tour-generator/   DE /de/tourengenerator/        Metin: arac/tur-uret.<kod>.json (+ adımlar ve şerit metni
#   web uygulaması dosyasından: arac/tur-uretici.<kod>.json `adimlar`, `tasarim`). Şablon: sablon/tur-uret.html. App Store ct=site-tur-uret.
# ---------------------------------------------------------------------------------------------------------------------
_tanitim_onbellek: list = []
TANITIM_ZORUNLU = ("dizin", "ad", "baslik", "aciklama", "eyebrow", "h1", "lead", "yayin", "guncelleme", "indir", "web", "bolumler", "sss", "varis")


def tanitim_veri() -> dict:
    if _tanitim_onbellek:
        return _tanitim_onbellek[0]
    veri = {}
    for f in sorted((KOK / "tanitim").glob("tur-uret.*.json")):
        kod = f.stem.split(".")[1]
        v = json.loads(f.read_text(encoding="utf-8"))
        eksik = [a for a in TANITIM_ZORUNLU if a not in v]
        if eksik:
            raise SystemExit(f"HATA: arac/{f.name}: eksik alan(lar): {', '.join(eksik)}")
        veri[kod] = v
    _tanitim_onbellek.append(veri)
    return veri


def tanitim_yol(kod: str) -> str:
    on = "" if kod == VARSAYILAN else f"/{kod}"
    return f"{on}/{tanitim_veri()[kod]['dizin']}/"


def tanitim_dil_yolu(k: str) -> str:
    return tanitim_yol(k) if k in tanitim_veri() else sayfa_yolu(k, "index.html")


def tanitim_alternatifler() -> str:
    kodlar = [d["kod"] for d in DILLER if d["kod"] in tanitim_veri()]
    satir = [f'<link rel="alternate" hreflang="{dil_bilgisi(k)["lang"]}" href="{ALAN}{tanitim_yol(k)}">' for k in kodlar]
    varsayilan = X_DEFAULT if X_DEFAULT in kodlar else kodlar[0]
    satir.append(f'<link rel="alternate" hreflang="x-default" href="{ALAN}{tanitim_yol(varsayilan)}">')
    return "\n".join(satir)


def tanitim_sitemap() -> list:
    veri = tanitim_veri()
    kodlar = [d["kod"] for d in DILLER if d["kod"] in veri]
    if not kodlar:
        return []
    alt = [f'    <xhtml:link rel="alternate" hreflang="{dil_bilgisi(k)["lang"]}" href="{ALAN}{tanitim_yol(k)}"/>' for k in kodlar]
    varsayilan = X_DEFAULT if X_DEFAULT in kodlar else kodlar[0]
    alt.append(f'    <xhtml:link rel="alternate" hreflang="x-default" href="{ALAN}{tanitim_yol(varsayilan)}"/>')
    parca = []
    for k in kodlar:
        parca += ["  <url>", f"    <loc>{ALAN}{tanitim_yol(k)}</loc>", f"    <lastmod>{veri[k]['guncelleme']}</lastmod>",
                  "    <changefreq>monthly</changefreq>", "    <priority>0.8</priority>"] + alt + ["  </url>"]
    return parca


def tanitim_json_ld(kod: str, v: dict, metin: dict, baslik: str, aciklama: str, url: str) -> str:
    lang = dil_bilgisi(kod)["lang"]
    ana = f"{ALAN}/"
    org = {"@type": "Organization", "@id": f"{ALAN}/#organization", "name": "Motoseyir", "url": ana,
           "logo": {"@type": "ImageObject", "url": LOGO, "width": 512, "height": 512}, "sameAs": SAMEAS}
    site = {"@type": "WebSite", "@id": f"{ALAN}/#website", "url": ana, "name": "Motoseyir", "inLanguage": lang, "publisher": {"@id": f"{ALAN}/#organization"}}
    sayfa = {"@type": "WebPage", "@id": f"{url}#sayfa", "url": url, "name": baslik, "description": aciklama, "inLanguage": lang,
             "isPartOf": {"@id": f"{ALAN}/#website"}, "primaryImageOfPage": {"@type": "ImageObject", "url": SOSYAL_GORSEL, "width": 1200, "height": 630},
             "dateModified": v["guncelleme"], "breadcrumb": {"@id": f"{url}#ekmek"}}
    ekmek = {"@type": "BreadcrumbList", "@id": f"{url}#ekmek", "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": duz(metin["nav_anasayfa"]), "item": f"{ALAN}{sayfa_yolu(kod, 'index.html')}"},
        {"@type": "ListItem", "position": 2, "name": duz(v["ad"]), "item": url}]}
    sss = {"@type": "FAQPage", "@id": f"{url}#sss", "inLanguage": lang, "mainEntity": [
        {"@type": "Question", "name": duz(x["s"]), "acceptedAnswer": {"@type": "Answer", "text": duz(x["c"])}} for x in v["sss"]]}
    govde = json.dumps({"@context": "https://schema.org", "@graph": [org, site, sayfa, ekmek, uygulama_dugumu(kod, magaza_baglantisi(kod, "tur-uret")), sss]},
                       ensure_ascii=False, indent=2)
    return '<script type="application/ld+json">\n' + govde.replace("</", "<\\/") + "\n</script>"


def tanitim_yaz() -> int:
    veri = tanitim_veri()
    if not veri:
        return 0
    hub, _ = rehber_veri()
    sablon = (SABLON / "tur-uret.html").read_text(encoding="utf-8")
    yazilan = 0
    for kod, v in veri.items():
        a = arac_veri()[kod]
        d = dil_bilgisi(kod)
        metin = json.loads((DIL / f"{kod}.json").read_text(encoding="utf-8"))
        url = f"{ALAN}{tanitim_yol(kod)}"
        baslik = duz(v["baslik"])
        tam = f"{baslik} — Motoseyir"
        baslik_tam = tam if len(tam) <= 60 else baslik
        aciklama = duz(v["aciklama"])
        hk_ad, hk_video = arac_hikaye(kod, a, arac_yol(kod))
        magaza = magaza_baglantisi(kod, "tur-uret")
        govde = []
        for b in v["bolumler"]:
            ic = r_bloklar(b["icerik"], {"tablo_etiket": ""}).replace("{arac}", arac_yol(kod))
            govde.append(f'<section class="bolum" id="{b["id"]}"><div class="kap"><div class="tur-yazi" data-r><h2>{b["h2"]}</h2>\n{ic}</div></div></section>')
        govde.append(f'<section class="bolum" id="sss" aria-labelledby="sss-h"><div class="kap"><h2 id="sss-h">{hub[kod]["ui"]["sss"]}</h2><ul class="izgara tur-sss" data-r>'
                     + "".join(f"<li><h3>{x['s']}</h3><p>{x['c']}</p></li>" for x in v["sss"]) + "</ul></div></section>")
        vr = v["varis"]
        varis = (f'<section class="varis" data-ton aria-labelledby="urun-h2"><div class="kap" data-r><h2 id="urun-h2">{vr["h2"]}</h2>'
                 + "".join(f'<p class="metin">{p}</p>' for p in vr["p"])
                 + f'<div class="cta-satir"><a class="btn" href="{magaza}">{v["indir"]}</a><a class="btn btn-hayalet" href="{arac_yol(kod)}">{v["web"]}</a></div></div></section>')
        degerler = {
            **metin, **{f"u_{x}": y for x, y in a["ui"].items() if isinstance(y, str)}, **{f"t_{x}": y for x, y in a["tasarim"].items() if isinstance(y, str)},
            "lang": d["lang"], "baslik_tam": _html.escape(baslik_tam, quote=False), "aciklama_nitelik": _html.escape(aciklama, quote=True), "kanonik": url,
            "alternatifler": tanitim_alternatifler(), "seo_head": rehber_seo_head(v, baslik_tam, aciklama, url, d["og"], False),
            "json_ld": tanitim_json_ld(kod, v, metin, baslik_tam, aciklama, url),
            "dil_secici": dil_secici(kod, "", metin, tanitim_dil_yolu), "dil_altbilgi": dil_altbilgi(kod, "", tanitim_dil_yolu),
            "store": magaza, "gizlilik_url": gizlilik_url(kod), "impressum_url": impressum_url(kod), "anasayfa_url": sayfa_yolu(kod, "index.html"),
            "corider_url": sayfa_yolu(kod, "corider.html"), "ozellikler_url": sayfa_yolu(kod, "ozellikler.html"), "nasil_url": sayfa_yolu(kod, "nasil-yapilir.html"),
            "hub_url": rehber_hub_yolu(kod), "arac_url": arac_yol(kod), "tanitim_url": tanitim_yol(kod), "ui_rehber": hub[kod]["ui"]["rehber"],
            "uygulama_id": UYGULAMA_ID, "yil": YIL, "dil_kodu": kod,
            "eyebrow": v["eyebrow"], "h1": v["h1"], "adimlar_h2": a["adimlar_h2"], "hk_adimlar": hk_ad, "hk_video": hk_video,
            "t_serit": "\n".join(f'<div class="sayi"><b>{b}</b><span>{y}</span></div>' for b, y in a["tasarim"]["serit"]),
            "p_ad": v["ad"], "p_indir": v["indir"], "p_web": v["web"],
            "arac_icerik": "\n".join(govde), "arac_varis": varis + "\n" + arac_ayrinti(kod, a, False),
        }
        html = doldur(sablon, degerler, f"tanitim/{kod}")
        html = demolari_yerlestir(html, "tr")
        html = M_DILLI.sub(lambda m: m.group(0) if m.group(2) != kod or (KOK / m.group(0).lstrip("/")).exists() else f"{m.group(1)}en{m.group(3)}", html)
        html = varliklari_surumle(html)
        hedef = KOK / tanitim_yol(kod).strip("/") / "index.html"
        hedef.parent.mkdir(parents=True, exist_ok=True)
        hedef.write_text(html, encoding="utf-8")
        yazilan += 1
    return yazilan


def arac_yaz() -> int:
    veri = arac_veri()
    if not veri:
        return 0
    hub, _ = rehber_veri()
    sablon = (SABLON / "arac.html").read_text(encoding="utf-8")
    yazilan = 0
    for kod, v in veri.items():
        if kod not in hub:
            raise SystemExit(f"HATA: {kod} dilinde araç sayfası var ama icerik/hub.{kod}.json yok")
        d = dil_bilgisi(kod)
        metin = json.loads((DIL / f"{kod}.json").read_text(encoding="utf-8"))
        url = f"{ALAN}{arac_yol(kod)}"
        baslik = duz(v["baslik"])
        tam = f"{baslik} — Motoseyir"
        baslik_tam = tam if len(tam) <= 60 else baslik
        aciklama = duz(v["aciklama"])
        hk_ad, hk_video = arac_hikaye(kod, v)
        ayar = {"dil": kod, "ui": v["ui"], "ondalik": v["ondalik"], "kok": ARAC_KOD_KOKU, "vekil": ARAC_VEKIL,
                "magaza": {"ios": arac_magaza(kod).replace("&amp;", "&"), "play": PLAY_BAGLANTISI}}
        degerler = {
            **metin,
            **{f"u_{a}": b for a, b in v["ui"].items() if isinstance(b, str)},
            "lang": d["lang"], "baslik_tam": _html.escape(baslik_tam, quote=False),
            "aciklama_nitelik": _html.escape(aciklama, quote=True), "kanonik": url,
            "alternatifler": arac_alternatifler(),
            "seo_head": rehber_seo_head(v, baslik_tam, aciklama, url, d["og"], False),
            "json_ld": arac_json_ld(kod, v, hub[kod]["ui"], metin, baslik_tam, aciklama, url),
            "dil_secici": dil_secici(kod, "", metin, arac_dil_yolu),
            "dil_altbilgi": dil_altbilgi(kod, "", arac_dil_yolu),
            "store": magaza_baglantisi(kod, ARAC_ETIKET), "gizlilik_url": gizlilik_url(kod),
            "impressum_url": impressum_url(kod), "anasayfa_url": sayfa_yolu(kod, "index.html"),
            "corider_url": sayfa_yolu(kod, "corider.html"), "ozellikler_url": sayfa_yolu(kod, "ozellikler.html"),
            "nasil_url": sayfa_yolu(kod, "nasil-yapilir.html"), "hub_url": rehber_hub_yolu(kod), "arac_url": arac_yol(kod),
            "tanitim_url": tanitim_yol(kod), "p_ad": tanitim_veri()[kod]["ad"], "ui_rehber": hub[kod]["ui"]["rehber"], "uygulama_id": UYGULAMA_ID, "yil": YIL, "vekil": ARAC_VEKIL,
            "eyebrow": v["eyebrow"], "h1": v["h1"], "lead": v["lead"], "adimlar_h2": v["adimlar_h2"],
            "arac_icerik": arac_icerik_govde(kod, v),
            "arac_varis": arac_varis(kod, v),
            "dil_kodu": kod,
            "hk_adimlar": hk_ad, "hk_video": hk_video,
            "t_serit": "\n".join(f'<div class="sayi"><b>{b}</b><span>{y}</span></div>' for b, y in v["tasarim"]["serit"]),
            **{f"t_{a}": b for a, b in v["tasarim"].items() if isinstance(b, str)},
            "arac_ayar": json.dumps(ayar, ensure_ascii=False).replace("</", "<\\/"),
        }
        html = doldur(sablon, degerler, f"arac/{kod}")
        html = demolari_yerlestir(html, "tr")  # kahraman telefonu: gerçek ekran kaydı (TR klibi tüm dillerde)
        html = M_DILLI.sub(lambda m: m.group(0) if m.group(2) != kod or (KOK / m.group(0).lstrip("/")).exists() else f"{m.group(1)}en{m.group(3)}", html)  # dil görseli yoksa EN
        html = varliklari_surumle(html)
        hedef = KOK / arac_yol(kod).strip("/") / "index.html"
        hedef.parent.mkdir(parents=True, exist_ok=True)
        hedef.write_text(html, encoding="utf-8")
        yazilan += 1
    return yazilan


# ---------------------------------------------------------------------------------------------------------------------
# CANLI İZLEME SAYFASI (25 Eki 2026): /izle/ — uygulamadaki "Sürüşümü paylaş" bağlantısı burada açılır.
# Bağlantı biçimi `https://motoseyir-app.com/izle/#/izle/<belirteç>` (sunucu: server/takip.py, MOTOSEYIR_IZLE_SITE=1; parça
# sunucuya gitmez). Sayfa tek ve dili tarayıcıdan seçer (tr/en/de/fr/it); üst menü/altbilgi metinleri bu betikte mevcut dil
# sözlüklerinden JSON'a konur ve m/izle/izle.js dile göre değiştirir. KİŞİSEL sürüş sayfası: noindex, sitemap'e GİRMEZ.
# Metin: arac/canli-izle.json · şablon: sablon/izle.html · stil/davranış: m/izle/izle.css, m/izle/izle.js.
# Veri: IZLE_API/izle/<belirteç>/durum (CORS yalnız bu site); harita: tur üreticisiyle aynı stil/parçalar.
# ---------------------------------------------------------------------------------------------------------------------
IZLE_ETIKET = "canli-izle"  # App Store `ct`
IZLE_API = "https://rota.motoseyir-app.com"
IZLE_DILLER = ("tr", "en", "de", "fr", "it")  # uygulamanın beş dili
IZLE_MAGAZA = f"https://apps.apple.com/app/apple-store/id{UYGULAMA_ID}?pt={SAGLAYICI}&ct={IZLE_ETIKET}&mt=8"


def izle_dil_secici(metin_tr: dict, v: dict) -> str:
    ogeler = "\n    ".join(
        f'<li><a href="#" data-dil="{k}" lang="{k}" hreflang="{k}"{" aria-current=" + chr(34) + "true" + chr(34) if k == "tr" else ""}>{v[k]["ad"]}</a></li>'
        for k in IZLE_DILLER)
    return ('<details class="dil-sec">\n'
            f'  <summary aria-label="{metin_tr["dil_sec_etiket"]}"><span class="dil-kod">TR</span><span class="dil-ad">{v["tr"]["ad"]}</span></summary>\n'
            f'  <ul>\n    {ogeler}\n  </ul>\n</details>')


def izle_dil_altbilgi(v: dict) -> str:
    ogeler = "\n  ".join(
        f'<li><a href="#" data-dil="{k}" lang="{k}" hreflang="{k}"{" aria-current=" + chr(34) + "true" + chr(34) if k == "tr" else ""}>{v[k]["ad"]}</a></li>'
        for k in IZLE_DILLER)
    return f'<ul class="dil-liste">\n  {ogeler}\n</ul>'


def izle_yaz() -> int:
    dosya = ARAC_ICERIK / "canli-izle.json"
    if not dosya.exists():
        return 0
    v = json.loads(dosya.read_text(encoding="utf-8"))
    v.pop("_not", None)
    zorunlu = ("lang", "yerel", "ad", "baslik", "eyebrow", "aciklama", "harita_etiket", "durum", "etiket", "ortala", "ag_hata", "harita_hata", "alt",
               "iz_not", "js_gerekli", "cta_baslik", "cta_metin", "cta_dugme", "cta_android")
    durumlar = ("canli", "bekliyor", "bekliyor_alt", "kopuk", "kopuk_alt", "bitti", "bitti_alt", "varis", "kapatildi", "sessiz", "yok", "yok_alt")
    for k in IZLE_DILLER:
        eksik = [a for a in zorunlu if a not in v.get(k, {})] + [f"durum.{a}" for a in durumlar if a not in v.get(k, {}).get("durum", {})]
        eksik += [f"etiket.{a}" for a in ("hedef", "kalan", "varis", "son") if a not in v.get(k, {}).get("etiket", {})]
        if eksik:
            raise SystemExit(f"HATA: arac/canli-izle.json [{k}]: eksik alan(lar): {', '.join(eksik)}")
    hub, _ = rehber_veri()
    chrome = {}
    for k in IZLE_DILLER:
        m = json.loads((DIL / f"{k}.json").read_text(encoding="utf-8"))
        u = _html.unescape
        chrome[k] = {
            "skip": u(m["skip"]), "nav_etiket": u(m["nav_etiket"]), "dil_sec_etiket": u(m["dil_sec_etiket"]),
            "haklar": u(m["footer_haklar"]), "diller": u(m["footer_diller"]),
            "anasayfa": {"t": u(m["nav_anasayfa"]), "h": sayfa_yolu(k, "index.html")},
            "ozellikler": {"t": u(m["footer_tum_ozellikler"]), "h": sayfa_yolu(k, "ozellikler.html")},
            "rehber": {"t": u(hub[k]["ui"]["rehber"]), "h": rehber_hub_yolu(k)},
            "corider": {"t": "AI CoRider", "h": sayfa_yolu(k, "corider.html")},
            "iletisim": {"t": u(m["nav_iletisim"]), "h": sayfa_yolu(k, "index.html") + "#iletisim"},
            "nasil": {"t": u(m["nav_nasil"]), "h": sayfa_yolu(k, "nasil-yapilir.html")},
            "gizlilik": {"t": u(m["nav_gizlilik"]) + u(m["gizlilik_tr_notu"]), "h": gizlilik_url(k)},
            "impressum": {"t": u(m["nav_impressum"]), "h": impressum_url(k)},
            "indir": {"t": u(m["btn_indir"]), "h": IZLE_MAGAZA},
        }
    tr, metin_tr = v["tr"], json.loads((DIL / "tr.json").read_text(encoding="utf-8"))
    ayar = {"metin": {k: v[k] for k in IZLE_DILLER}, "chrome": chrome, "api": IZLE_API,
            "magaza": {"ios": IZLE_MAGAZA, "play": PLAY_BAGLANTISI}}
    degerler = {
        **metin_tr,
        **{a: b for a, b in tr.items() if isinstance(b, str)},
        "aciklama_nitelik": _html.escape(tr["aciklama"], quote=True),
        "og_aciklama": _html.escape(f'{tr["aciklama"].split(".")[0]}. · {v["en"]["aciklama"].split(".")[0]}.', quote=True),
        "e_hedef": tr["etiket"]["hedef"], "e_kalan": tr["etiket"]["kalan"], "e_varis": tr["etiket"]["varis"], "e_son": tr["etiket"]["son"],
        "alan": ALAN, "vekil": ARAC_VEKIL, "api": IZLE_API, "store": IZLE_MAGAZA.replace("&", "&amp;"),
        "dil_secici": izle_dil_secici(metin_tr, v), "dil_altbilgi": izle_dil_altbilgi(v),
        "ui_rehber": hub["tr"]["ui"]["rehber"], "yil": YIL,
        "izle_ayar": json.dumps(ayar, ensure_ascii=False).replace("</", "<\\/"),
    }
    html = doldur((SABLON / "izle.html").read_text(encoding="utf-8"), degerler, "izle")
    html = varliklari_surumle(html)
    hedef = KOK / "izle" / "index.html"
    hedef.parent.mkdir(parents=True, exist_ok=True)
    hedef.write_text(html, encoding="utf-8")
    return 1


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
    return f'<li><a href="{rehber_hub_yolu(kod)}">{hub[kod]["ui"]["rehber"]}</a></li>' + arac_footer(kod)


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
        if kod in arac_veri():
            sabit["arac"] = arac_yol(kod)
        if kod in GECIT_KAPSAM:
            sabit["gecitler"] = gecit_kok(kod)
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
            "arac_footer": arac_footer(kod),
        }
        html = doldur(sablon, degerler, f"{kod}/{grup}")
        hedef = KOK / yol.strip("/") / "index.html"
        hedef.parent.mkdir(parents=True, exist_ok=True)
        hedef.write_text(html, encoding="utf-8")
        yazilan += 1
    return yazilan


# ---------------------------------------------------------------------------------------------------------------------
# GEÇİT SAYFALARI (27 Eki 2026, SEO; kullanıcı: "hepsini yapalım"). Uygulamanın geçit listesinden programatik sayfalar:
#   EN /en/passes/ (dizin) · /en/passes/<eyalet|ülke>/ (liste) · /en/passes/<geçit>/   — ABD + Alpler
#   DE /de/paesse/ · /de/paesse/<land>/ · /de/paesse/<pass>/                              — Alpler
#   TR /gecitler/ (liste) · /gecitler/<geçit>/                                             — Türkiye
# Veri: gecit/gecitler.json (uygulamadan, gecit/veri.mjs), gecit/abd-eyalet.json (gecit/eyalet.py), fotoğraf m/gecit/<id>.webp
# (gecit/foto.py, Commons'tan; atıf sayfada). Metin gecit/metin.<kod>.json. Sayfada YALNIZ veride olan yazar: rakım, ülke/eyalet,
# yol yüzeyi (`toprak`), kapanış ayları (`kapaliAylar`), konum, kaynak ve bunlardan hesaplanan sıra ve komşu geçitler. Uydurma
# açılış tarihi, yol adı, puan YOK. Şablon rehberinki (sablon/rehber.html). App Store `ct=seo-gecit`. Alp geçidinin EN↔DE
# sayfaları hreflang eşi; ABD (yalnız EN) ve Türkiye (yalnız TR) tek dilli.
# ---------------------------------------------------------------------------------------------------------------------
GECIT_DIZIN = KOK / "gecit"
GECIT_KAPSAM = {"en": ("abd", "alp"), "de": ("alp",), "tr": ("tr",)}
GECIT_ETIKET = "seo-gecit"
GECIT_HUB_EN_AZ = 3  # bu sayıdan az geçidi olan eyaletin liste sayfası yok (dizinde "diğer eyaletler")
GECIT_YAKIN = 6
GECIT_YAKIN_KM = 120
GECIT_GUNCELLEME = "2026-10-27"
# Kalkan geçit sayfalarının adresi → yeni adres (GitHub Pages'te sunucu yönlendirmesi yok: canonical + anında meta yenileme,
# noindex; Google bunu kalıcı yönlendirme sayar). 28 Eki 2026: etiketi kopyalanmış üç ABD düğümü uygulamadan elendi
# (moto-rota f18cf0c9); sahte Newfound Gap gidince gerçeğinin adı da "-tennessee" ekinden kurtuldu.
GECIT_YONLENDIRME = {
    "/en/passes/newfound-gap-tennessee/": "/en/passes/newfound-gap/",
    "/en/passes/newfound-gap-north-carolina/": "/en/passes/newfound-gap/",
    "/en/passes/granite-pass/": "/en/passes/montana/",
    "/en/passes/siskiyou-gap/": "/en/passes/oregon/",
}
_gecit_onbellek: dict = {}


def _ascii_slug(ad: str) -> str:
    import unicodedata
    s = ad.replace("ß", "ss").replace("ı", "i").replace("’", "").replace("'", "")
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")


def gecit_veri() -> dict:
    """{kod: {"metin", "gecitler": [g...], "hub": {hub_id: {...}}}}; g'ye dile özgü ad/slug/hub eklenir."""
    if _gecit_onbellek:
        return _gecit_onbellek
    hepsi = json.loads((GECIT_DIZIN / "gecitler.json").read_text(encoding="utf-8"))["gecitler"]
    eyalet = json.loads((GECIT_DIZIN / "abd-eyalet.json").read_text(encoding="utf-8"))
    for kod, bolgeler in GECIT_KAPSAM.items():
        m = json.loads((GECIT_DIZIN / f"metin.{kod}.json").read_text(encoding="utf-8"))
        liste = []
        for g0 in hepsi:
            if g0["bolge"] not in bolgeler:
                continue
            g = dict(g0)
            g["gad"] = m["eksonim"].get(g["id"], g["ad"])
            if g["gad"] != g["ad"]:
                g["gad_tam"] = f'{g["gad"]} ({g["ad"]})'
            else:
                g["gad_tam"] = g["ad"]
            if g["bolge"] == "abd":
                e = eyalet[g["id"]]
                g["hublar"] = [("abd-" + _ascii_slug(e["ad"]), e["ad"])]
            elif g["bolge"] == "alp":
                g["hublar"] = [("alp-" + u, m["ulkeler"][u]) for u in g["ulkeler"] if u in m["ulkeler"]]
            else:
                g["hublar"] = [("tr", m["ulkeler"]["TR"])]
            liste.append(g)
        liste.sort(key=lambda g: (-g["rakimM"], g["ad"]))
        # slug: adın ASCII'si; aynı ad iki kez varsa eyalet/ülke eklenir, yine çakışırsa rakım
        say: dict = {}
        for g in liste:
            say[_ascii_slug(g["gad"])] = say.get(_ascii_slug(g["gad"]), 0) + 1
        alinan = set()
        for g in liste:
            s = _ascii_slug(g["gad"])
            if say[s] > 1:
                s = f'{s}-{_ascii_slug(g["hublar"][0][1])}'
                if s in alinan:
                    s = f'{s}-{g["rakimM"]}'
            if s in alinan:
                raise SystemExit(f"HATA: geçit slug'ı çakıştı: {s}")
            alinan.add(s)
            g["slug"] = s
        hub: dict = {}
        for g in liste:
            for hid, had in g["hublar"]:
                hub.setdefault(hid, {"id": hid, "ad": had, "gecitler": []})["gecitler"].append(g)
        for hid, h in hub.items():
            if hid.startswith("abd-"):
                h["slug"] = hid[4:]
                h["sayfa"] = len(h["gecitler"]) >= GECIT_HUB_EN_AZ
            elif hid.startswith("alp-"):
                h["slug"] = m["ulke_slug"][hid[4:]]
                h["sayfa"] = True
                h["ulke"] = hid[4:]
            else:
                h["slug"] = ""
                h["sayfa"] = True
            if h["slug"] in alinan:
                raise SystemExit(f"HATA: liste sayfası adı bir geçitle çakıştı: {h['slug']}")
        _gecit_onbellek[kod] = {"metin": m, "gecitler": liste, "hub": hub}
    return _gecit_onbellek


def gecit_kok(kod: str) -> str:
    m = gecit_veri()[kod]["metin"]
    return f'{"" if kod == VARSAYILAN else "/" + kod}/{m["dizin"]}/'


def gecit_yol(kod: str, g: dict) -> str:
    return f'{gecit_kok(kod)}{g["slug"]}/'


def gecit_hub_yol(kod: str, h: dict) -> str:
    if not h["slug"]:
        return gecit_kok(kod)
    return f'{gecit_kok(kod)}{h["slug"]}/' if h["sayfa"] else gecit_kok(kod)


def gecit_esi(kod: str, g: dict):
    """Alp geçidinin öbür dildeki sayfası (EN↔DE)."""
    if g["bolge"] != "alp":
        return None
    diger = "de" if kod == "en" else "en"
    for x in gecit_veri()[diger]["gecitler"]:
        if x["id"] == g["id"]:
            return diger, x
    return None


def _sayi(n, m: dict) -> str:
    s = f"{int(round(n)):,}"
    return s.replace(",", m["sayi_bin"])


def gecit_rakim(g: dict, kod: str, m: dict, tam: bool = False) -> str:
    metre = f'{_sayi(g["rakimM"], m)} m'
    if g["bolge"] == "abd":
        ft = f'{_sayi(g["rakimM"] * 3.28084, m)} ft'
        return f"{ft} ({metre})" if tam else ft
    if kod == "en" and tam:
        return f'{metre} ({_sayi(g["rakimM"] * 3.28084, m)} ft)'
    return metre


def _mesafe(a: dict, b: dict) -> float:
    import math
    r = 6371.0
    p1, p2 = math.radians(a["lat"]), math.radians(b["lat"])
    dp, dl = p2 - p1, math.radians(b["lon"] - a["lon"])
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(h))


def _yon(a: dict, b: dict, yonler: list) -> str:
    import math
    p1, p2 = math.radians(a["lat"]), math.radians(b["lat"])
    dl = math.radians(b["lon"] - a["lon"])
    x = math.sin(dl) * math.cos(p2)
    y = math.cos(p1) * math.sin(p2) - math.sin(p1) * math.cos(p2) * math.cos(dl)
    aci = (math.degrees(math.atan2(x, y)) + 360) % 360
    return yonler[int((aci + 22.5) // 45) % 8]


def _sira(n: int, kod: str) -> str:
    if kod == "en":
        son = "th" if 10 <= n % 100 <= 20 else {1: "st", 2: "nd", 3: "rd"}.get(n % 10, "th")
        return f"{n}{son}"
    return f"{n}."


def _kaynak_ad(url: str) -> str:
    if "wikipedia.org" in url:
        return "Wikipedia"
    if "wikidata.org" in url:
        return "Wikidata"
    if "openstreetmap.org" in url:
        return "OpenStreetMap"
    return re.sub(r"^https?://(www\.)?", "", url).split("/")[0]


def _aciklama_sec(bas: str, kuyruklar: list) -> str:
    """140–160 karakterlik açıklama: gövde + sığan ilk kuyruk (yoksa iki kuyruk); hiçbiri sığmazsa 160'ı aşmayan en uzunu."""
    adaylar = [bas + k for k in kuyruklar] + [bas + k1 + k2 for i, k1 in enumerate(kuyruklar) for k2 in kuyruklar[i + 1:]]
    for a in adaylar:
        if 140 <= len(a) <= 160:
            return a
    sigan = [a for a in adaylar if len(a) <= 160]
    return max(sigan, key=len) if sigan else adaylar[0]


def _baslik_sec(adaylar: list) -> str:
    for a in adaylar:
        if len(a) <= 60:
            return a
    return adaylar[-1][:60]


def gecit_bolge_adi(kod: str, h: dict, m: dict) -> tuple:
    """(ad, 'in …' biçimi). DE'de ülke artikelli: in der Schweiz."""
    if kod == "de" and h.get("ulke"):
        return h["ad"], m["ulke_in"][h["ulke"]]
    return h["ad"], h["ad"]


def gecit_magaza(kod: str) -> str:
    return magaza_baglantisi(kod, "").replace(f"ct=site-{kod}&amp;", f"ct={GECIT_ETIKET}&amp;")


def gecit_arac_baglanti(kod: str, g: dict) -> str:
    from urllib.parse import quote
    return f'{arac_yol(kod)}?bas={g["lat"]:.5f},{g["lon"]:.5f}&amp;ad={quote(g["gad"])}'


def gecit_footer(kod: str) -> str:
    if kod not in GECIT_KAPSAM:
        return ""
    return f'<li><a href="{gecit_kok(kod)}">{gecit_veri()[kod]["metin"]["ad"]}</a></li>'


def _gecit_yapi(kod: str, g: dict, m: dict, ui: dict) -> dict:
    """Bir geçidin dile göre metin parçaları."""
    v = gecit_veri()[kod]
    h = v["hub"][g["hublar"][0][0]]
    bolge, bolge_in = gecit_bolge_adi(kod, h, m)
    sira_list = h["gecitler"]
    n = len(sira_list)
    sira = sira_list.index(g) + 1
    gm = m["gecit"]
    ad = g["gad"]
    p = {"ad": ad, "bolge": bolge, "bolge_in": bolge_in, "rakim": gecit_rakim(g, kod, m), "rakim_tam": gecit_rakim(g, kod, m, True)}
    if n > 1:
        p["siralama"] = gm["siralama_ilk" if sira == 1 else "siralama"].format(
            ad=ad, sira=sira if kod == "de" else _sira(sira, kod), n=n, bolge=bolge, bolge_in=bolge_in)
    else:
        p["siralama"] = gm["siralama_tek"].format(ad=ad, bolge=bolge, bolge_in=bolge_in)
    kis = ""
    if g.get("kapaliAylar"):
        a1, a2 = g["kapaliAylar"]
        p["kis_kisa"] = gm["kis_kisa"].format(ay1=m["ay_kisa"][a1 - 1], ay2=m["ay_kisa"][a2 - 1])
        kis = gm["kis_var"].format(ay1=ui["aylar"][a1 - 1], ay2=ui["aylar"][a2 - 1])
    else:
        p["kis_kisa"] = ""
        kis = gm["kis_yok"]
    p["yuzey_kisa"] = gm["yuzey_kisa_toprak"] if g.get("toprak") else ""
    p["kis"] = kis
    return p


def gecit_govde(kod: str, g: dict, m: dict, ui: dict, metin: dict) -> tuple:
    """(gövde html, başlık, açıklama, h1)."""
    v = gecit_veri()[kod]
    gm = m["gecit"]
    p = _gecit_yapi(kod, g, m, ui)
    h0 = v["hub"][g["hublar"][0][0]]
    ad = g["gad"]
    baslik = _baslik_sec([b.format(**p) for b in gm["baslik"]])
    aciklama = _aciklama_sec(gm["aciklama_bas"].format(**p), gm["aciklama_kuyruk"])
    h1 = gm["h1"].format(**p)
    e = _html.escape
    # sayfa yolu
    ek = [f'<a href="{sayfa_yolu(kod, "index.html")}">{metin["nav_anasayfa"]}</a>']
    if kod != "tr":
        ek.append(f'<a href="{gecit_kok(kod)}">{m["ad"]}</a>')
    if h0["sayfa"] and h0["slug"]:
        ek.append(f'<a href="{gecit_hub_yol(kod, h0)}">{e(p["bolge"])}</a>')
    elif kod == "tr":
        ek.append(f'<a href="{gecit_kok(kod)}">{m["ad"]}</a>')
    ek.append(f'<span aria-current="page">{e(ad)}</span>')
    ekmek = f'<nav class="rehber-ekmek" aria-label="{ui["ekmek"]}">' + ' <span aria-hidden="true">›</span> '.join(ek) + "</nav>"
    parca = ['<section class="section rehber-ust"><div class="wrap">', ekmek,
             f'<span class="eyebrow">{e(gm["eyebrow"].format(**p))}</span>', f"<h1>{e(h1)}</h1>",
             f'<p class="section-lead">{e(gm["lead"].format(**p)).replace("  ", " ")}</p>', "</div></section>",
             '<section class="section section-2 rehber-govde"><div class="wrap"><div class="rehber-kolon">']
    # fotoğraf
    foto = KOK / "m" / "gecit" / f'{g["id"]}.webp'
    if g.get("foto") and foto.exists():
        f0 = g["foto"][0]
        w, hh = webp_boyut(foto)
        commons = "https://commons.wikimedia.org/wiki/File:" + _html.escape(f0["ad"].replace(" ", "_"), quote=True)
        yazar = re.sub(r"\s+", " ", f0["yazar"]).strip()
        # uygulamanın listesinde yazar 60 harfte kesik ya da "No machine-readable author" olabilir: o zaman adı dosya sayfasında
        if not yazar or len(yazar) >= 60 or yazar.lower().startswith("no machine-readable"):
            atif = gm["foto_atif_genel"].format(lisans=e(f0["lisans"]))
        else:
            atif = gm["foto_atif"].format(yazar=e(yazar), lisans=e(f0["lisans"]))
        parca.append(f'<figure class="gecit-foto"><img src="/m/gecit/{g["id"]}.webp" alt="{e(gm["foto_alt"].format(**p), quote=True)}" '
                     f'width="{w}" height="{hh}" fetchpriority="high"><figcaption><a href="{commons}" rel="noopener">{atif}</a></figcaption></figure>')
    # kısaca
    yer = ", ".join(e(x[1]) for x in g["hublar"]) if g["bolge"] != "abd" else e(f'{p["bolge"]}, {m["ulkeler"]["US"]}')
    yuzey = m["toprak"] if g.get("toprak") else m["asfalt"]
    osm = f'https://www.openstreetmap.org/node/{g["osm"]}'
    kaynaklar = [f'<a href="{e(g["kaynak"], quote=True)}" rel="noopener">{_kaynak_ad(g["kaynak"])}</a>']
    if "openstreetmap.org" not in g["kaynak"]:
        kaynaklar.append(f'<a href="{osm}" rel="noopener">OpenStreetMap</a>')
    satirlar = [(gm["b_rakim"], e(p["rakim_tam"])), (gm["b_yer"], yer), (gm["b_yuzey"], yuzey), (gm["b_kis"], e(p["kis"])),
                (gm["b_konum"], f'<a href="{osm}" rel="noopener">{g["lat"]:.4f}, {g["lon"]:.4f}</a>'),
                (gm["b_kaynak"], " · ".join(kaynaklar))]
    parca.append(f'<section id="kisaca" class="rehber-bolum"><h2>{gm["bilgi_h2"]}</h2><dl class="gecit-bilgi">'
                 + "".join(f"<dt>{a}</dt><dd>{b}</dd>" for a, b in satirlar)
                 + f'</dl><p class="kucuk">{gm["rakim_not"]}</p></section>')
    # tur
    parca.append(f'<section id="tur" class="rehber-bolum gecit-tur"><h2>{e(gm["tur_h2"].format(**p))}</h2><p>{e(gm["tur_p"].format(**p))}</p>'
                 f'<p><a class="btn btn-primary" href="{gecit_arac_baglanti(kod, g)}">{e(gm["tur_dugme"].format(**p))}</a></p></section>')
    # yakındaki geçitler
    yakin = sorted(((_mesafe(g, x), x) for x in v["gecitler"] if x is not g), key=lambda t: t[0])
    yakin = [(d, x) for d, x in yakin if d <= GECIT_YAKIN_KM][:GECIT_YAKIN]
    if yakin:
        mil = g["bolge"] == "abd"
        ogeler = []
        for d, x in yakin:
            mesafe = f'{_sayi(d / 1.609344, m)} mi' if mil else f'{_sayi(d, m)} km'
            if d < 1:
                mesafe = "< 1 mi" if mil else "< 1 km"
            satir = gm["yakin_satir"].format(mesafe=mesafe, yon=_yon(g, x, m["yonler"]), rakim=gecit_rakim(x, kod, m))
            ogeler.append(f'<li><a href="{gecit_yol(kod, x)}">{e(x["gad"])}</a> <span class="gecit-yakin-bilgi">{e(satir)}</span></li>')
        parca.append(f'<section id="yakin" class="rehber-bolum"><h2>{e(gm["yakin_h2"].format(**p))}</h2><ul class="gecit-yakin">'
                     + "".join(ogeler) + "</ul></section>")
    # uygulama
    parca.append(f'<section class="rehber-urun" aria-labelledby="urun-h2"><div><h2 id="urun-h2">{e(gm["uyg_h2"].format(**p))}</h2>'
                 f'<p>{e(gm["uyg_p1"].format(**p))}</p><p>{e(gm["uyg_p2"].format(**p))}</p>'
                 f'<p><a class="btn btn-primary" href="{gecit_magaza(kod)}">{metin["btn_store"]}</a></p></div></section>')
    # alt bağlantılar + veri notu
    alt = []
    if h0["sayfa"] and h0["slug"]:
        alt.append(f'<a href="{gecit_hub_yol(kod, h0)}">{e(gm["hub_baglanti"].format(bolge=p["bolge"], bolge_in=p["bolge_in"]))}</a>')
    alt.append(f'<a href="{gecit_kok(kod)}">{gm["index_baglanti"]}</a>')
    parca.append(f'<section class="rehber-bolum"><p>{" · ".join(dict.fromkeys(alt))}</p><p class="kucuk">{gm["veri_not"]}</p></section>')
    parca.append("</div></div></section>")
    return "\n".join(parca), baslik, aciklama, h1, p


def gecit_tablo(kod: str, gecitler: list, m: dict, ui: dict) -> str:
    t = m["tablo"]
    e = _html.escape
    kis_var = any(g.get("kapaliAylar") for g in gecitler)
    bas = f'<th scope="col">{t["gecit"]}</th><th scope="col">{t["rakim"]}</th><th scope="col">{t["yuzey"]}</th>'
    if kis_var:
        bas += f'<th scope="col">{t["kis"]}</th>'
    satir = []
    for g in gecitler:
        s = (f'<tr><th scope="row"><a href="{gecit_yol(kod, g)}">{e(g["gad"])}</a></th><td>{e(gecit_rakim(g, kod, m))}</td>'
             f'<td>{m["toprak_kisa"] if g.get("toprak") else m["asfalt"]}</td>')
        if kis_var:
            if g.get("kapaliAylar"):
                a1, a2 = g["kapaliAylar"]
                s += f'<td>{m["ay_kisa"][a1 - 1]}–{m["ay_kisa"][a2 - 1]}</td>'
            else:
                s += f'<td>{m["bilinmiyor"]}</td>'
        satir.append(s + "</tr>")
    return (f'<div class="rehber-tablo gecit-tablo" role="region" aria-label="{e(ui["tablo_etiket"], quote=True)}" tabindex="0"><table>'
            f"<thead><tr>{bas}</tr></thead><tbody>{''.join(satir)}</tbody></table></div>")


def gecit_hub_govde(kod: str, h: dict, m: dict, ui: dict, metin: dict) -> tuple:
    e = _html.escape
    gecitler = h["gecitler"]
    bolge, bolge_in = gecit_bolge_adi(kod, h, m)
    anahtar = "hub_abd" if h["id"].startswith("abd-") else ("hub_alp" if h["id"].startswith("alp-") else "hub_tr")
    hm = m[anahtar]
    ilk = gecitler[0]
    p = {"n": len(gecitler), "bolge": bolge, "bolge_in": bolge_in, "ilk": ilk["gad"], "rakim": gecit_rakim(ilk, kod, m)}
    t = sum(1 for g in gecitler if g.get("toprak"))
    k = sum(1 for g in gecitler if g.get("kapaliAylar"))
    toprak_cumle = m["toprak_cumle"].format(t=t) if t else m["toprak_yok"]
    kis_cumle = m["kis_cumle"].format(k=k) if (k and m["kis_cumle"]) else ""
    lead = m["hub_lead"].format(**p, toprak_cumle=toprak_cumle, kis_cumle=kis_cumle)
    baslik = _baslik_sec([hm["baslik"].format(**p)])
    adaylar = [a.format(**p) for a in hm["aciklama"]]
    aciklama = next((a for a in adaylar if 140 <= len(a) <= 160), min(adaylar, key=lambda a: abs(len(a) - 150)))
    h1 = hm["h1"].format(**p)
    ek = [f'<a href="{sayfa_yolu(kod, "index.html")}">{metin["nav_anasayfa"]}</a>']
    if h["slug"]:
        ek.append(f'<a href="{gecit_kok(kod)}">{m["ad"]}</a>')
    ek.append(f'<span aria-current="page">{e(bolge)}</span>' if h["slug"] else f'<span aria-current="page">{m["ad"]}</span>')
    ekmek = f'<nav class="rehber-ekmek" aria-label="{ui["ekmek"]}">' + ' <span aria-hidden="true">›</span> '.join(ek) + "</nav>"
    govde = "\n".join([
        '<section class="section rehber-ust"><div class="wrap">', ekmek, f'<span class="eyebrow">{e(hm["eyebrow"])}</span>',
        f"<h1>{e(h1)}</h1>", f'<p class="section-lead">{e(lead)}</p>', "</div></section>",
        '<section class="section section-2 rehber-govde"><div class="wrap"><div class="rehber-kolon">',
        gecit_tablo(kod, gecitler, m, ui),
        f'<section class="rehber-urun" aria-labelledby="urun-h2"><div><h2 id="urun-h2">Motoseyir</h2>'
        f'<p>{e(m["gecit"]["uyg_p2"])}</p><p><a class="btn btn-primary" href="{gecit_magaza(kod)}">{metin["btn_store"]}</a></p></div></section>',
        (f'<p><a href="{gecit_kok(kod)}">{m["gecit"]["index_baglanti"]}</a></p>' if h["slug"] else ""),
        f'<p class="kucuk">{m["gecit"]["veri_not"]}</p>',
        "</div></div></section>"])
    return govde, baslik, aciklama, h1


def gecit_index_govde(kod: str, m: dict, ui: dict, metin: dict) -> tuple:
    """EN/DE dizin sayfası: bölgelere göre liste sayfaları + en yüksek on geçit."""
    e = _html.escape
    v = gecit_veri()[kod]
    im = m["index"]
    n_abd = sum(1 for g in v["gecitler"] if g["bolge"] == "abd")
    n_alp = sum(1 for g in v["gecitler"] if g["bolge"] == "alp")
    p = {"n_abd": n_abd, "n_alp": n_alp}
    parca = ['<section class="section rehber-ust"><div class="wrap">',
             f'<nav class="rehber-ekmek" aria-label="{ui["ekmek"]}"><a href="{sayfa_yolu(kod, "index.html")}">{metin["nav_anasayfa"]}</a>'
             f' <span aria-hidden="true">›</span> <span aria-current="page">{m["ad"]}</span></nav>',
             f'<span class="eyebrow">{e(im["eyebrow"])}</span>', f'<h1>{e(im["h1"])}</h1>', f'<p class="section-lead">{e(im["lead"])}</p>',
             "</div></section>", '<section class="section section-2 rehber-govde"><div class="wrap"><div class="rehber-kolon">']
    for bolge, h2a, pa in (("abd", "abd_h2", "abd_p"), ("alp", "alp_h2", "alp_p")):
        if bolge not in GECIT_KAPSAM[kod]:
            continue
        hublar = sorted((h for h in v["hub"].values() if h["id"].startswith(bolge + "-")), key=lambda h: (-len(h["gecitler"]), h["ad"]))
        sayfali = [h for h in hublar if h["sayfa"]]
        n = sum(1 for g in v["gecitler"] if g["bolge"] == bolge)
        ogeler = "".join(
            f'<li><a href="{gecit_hub_yol(kod, h)}">{e(h["ad"])}</a> <span class="gecit-yakin-bilgi">'
            f'{e(im["hub_satir"].format(n=len(h["gecitler"]), ad=h["gecitler"][0]["gad"], rakim=gecit_rakim(h["gecitler"][0], kod, m)))}</span></li>'
            for h in sayfali)
        parca.append(f'<section class="rehber-bolum"><h2>{im[h2a]}</h2><p>{e(im[pa].format(n=n, s=len(hublar)))}</p><ul class="gecit-yakin">{ogeler}</ul>')
        tek = [h for h in hublar if not h["sayfa"]]
        if tek:
            parca.append(f'<h3>{im["diger"]}</h3><ul class="gecit-yakin">' + "".join(
                f'<li>{e(h["ad"])}: ' + ", ".join(f'<a href="{gecit_yol(kod, g)}">{e(g["gad"])}</a>' for g in h["gecitler"]) + "</li>" for h in tek) + "</ul>")
        en_yuksek = [g for g in v["gecitler"] if g["bolge"] == bolge][:10]
        parca.append(f'<h3>{im["en_yuksek_h2"]}</h3>' + gecit_tablo(kod, en_yuksek, m, ui) + "</section>")
    parca.append(f'<section class="rehber-urun" aria-labelledby="urun-h2"><div><h2 id="urun-h2">Motoseyir</h2>'
                 f'<p>{e(m["gecit"]["uyg_p2"])}</p><p><a class="btn btn-primary" href="{gecit_magaza(kod)}">{metin["btn_store"]}</a></p></div></section>')
    parca.append(f'<p class="kucuk">{m["gecit"]["veri_not"]}</p>')
    parca.append("</div></div></section>")
    baslik = im["baslik"]
    return "\n".join(parca), baslik, im["aciklama"].format(**p), im["h1"]


def gecit_json_ld(kod: str, tur: str, url: str, baslik: str, aciklama: str, ekmek: list, g: dict = None, liste: list = None) -> str:
    """Organization + WebSite + WebPage/CollectionPage + BreadcrumbList; geçitte TouristAttraction (GeoCoordinates), listede ItemList."""
    lang = dil_bilgisi(kod)["lang"]
    ana = f"{ALAN}/"
    org = {"@type": "Organization", "@id": f"{ALAN}/#organization", "name": "Motoseyir", "url": ana,
           "logo": {"@type": "ImageObject", "url": LOGO, "width": 512, "height": 512}, "sameAs": SAMEAS}
    site = {"@type": "WebSite", "@id": f"{ALAN}/#website", "url": ana, "name": "Motoseyir", "inLanguage": lang,
            "publisher": {"@id": f"{ALAN}/#organization"}}
    sayfa = {"@type": "WebPage" if tur == "gecit" else "CollectionPage", "@id": f"{url}#sayfa", "url": url, "name": baslik,
             "description": aciklama, "inLanguage": lang, "isPartOf": {"@id": f"{ALAN}/#website"},
             "dateModified": GECIT_GUNCELLEME, "breadcrumb": {"@id": f"{url}#ekmek"}}
    graf = [org, site, sayfa, {"@type": "BreadcrumbList", "@id": f"{url}#ekmek", "itemListElement": [
        {"@type": "ListItem", "position": i + 1, "name": ad, "item": f"{ALAN}{yol}"} for i, (ad, yol) in enumerate(ekmek)]}]
    if g:
        yer = {"@type": "TouristAttraction", "@id": f"{url}#yer", "name": g["gad"], "url": url,
               "geo": {"@type": "GeoCoordinates", "latitude": round(g["lat"], 6), "longitude": round(g["lon"], 6), "elevation": g["rakimM"]},
               "sameAs": [g["kaynak"], f'https://www.openstreetmap.org/node/{g["osm"]}'] if "openstreetmap.org" not in g["kaynak"] else [g["kaynak"]],
               "containedInPlace": {"@type": "Country", "name": g["ulkeler"][0]}}
        if g["gad"] != g["ad"]:
            yer["alternateName"] = g["ad"]
        if (KOK / "m" / "gecit" / f'{g["id"]}.webp').exists():
            yer["image"] = f'{ALAN}/m/gecit/{g["id"]}.webp'
            sayfa["primaryImageOfPage"] = {"@type": "ImageObject", "url": yer["image"]}
        sayfa["about"] = {"@id": f"{url}#yer"}
        graf.append(yer)
    if liste:
        graf.append({"@type": "ItemList", "@id": f"{url}#liste", "numberOfItems": len(liste), "itemListElement": [
            {"@type": "ListItem", "position": i + 1, "url": f"{ALAN}{gecit_yol(kod, x)}", "name": x["gad"]} for i, x in enumerate(liste)]})
        sayfa["mainEntity"] = {"@id": f"{url}#liste"}
    govde = json.dumps({"@context": "https://schema.org", "@graph": graf}, ensure_ascii=False, indent=1)
    return '<script type="application/ld+json">\n' + govde.replace("</", "<\\/") + "\n</script>"


def gecit_sayfalari() -> list:
    """[(kod, yol, tur, nesne)] — üretim ve sitemap aynı listeden."""
    cikti = []
    for kod in GECIT_KAPSAM:
        v = gecit_veri()[kod]
        if kod != "tr":
            cikti.append((kod, gecit_kok(kod), "index", None))
        for h in v["hub"].values():
            if h["sayfa"]:
                cikti.append((kod, gecit_hub_yol(kod, h), "hub", h))
        for g in v["gecitler"]:
            cikti.append((kod, gecit_yol(kod, g), "gecit", g))
    return cikti


def gecit_alternatifler(kod: str, tur: str, nesne) -> list:
    """[(hreflang, yol)] — alp geçidi ve alp ülke listesi EN↔DE; geri kalan tek dilli."""
    if tur == "gecit" and nesne["bolge"] == "alp":
        es = gecit_esi(kod, nesne)
        if es:
            yollar = {kod: gecit_yol(kod, nesne), es[0]: gecit_yol(es[0], es[1])}
            return [(k, yollar[k]) for k in ("en", "de")]
    if tur == "hub" and nesne["id"].startswith("alp-"):
        yollar = {}
        for k in ("en", "de"):
            h = gecit_veri()[k]["hub"].get(nesne["id"])
            if h:
                yollar[k] = gecit_hub_yol(k, h)
        if len(yollar) == 2:
            return [(k, yollar[k]) for k in ("en", "de")]
    return []


def gecit_sitemap() -> list:
    parca = []
    for kod, yol, tur, nesne in gecit_sayfalari():
        alt = gecit_alternatifler(kod, tur, nesne)
        satir = ["  <url>", f"    <loc>{ALAN}{yol}</loc>", f"    <lastmod>{GECIT_GUNCELLEME}</lastmod>",
                 "    <changefreq>monthly</changefreq>", f'    <priority>{"0.6" if tur != "gecit" else "0.5"}</priority>']
        if alt:
            satir += [f'    <xhtml:link rel="alternate" hreflang="{k}" href="{ALAN}{y}"/>' for k, y in alt]
            satir.append(f'    <xhtml:link rel="alternate" hreflang="x-default" href="{ALAN}{dict(alt)["en"]}"/>')
        parca += satir + ["  </url>"]
    return parca


def gecit_yaz() -> int:
    hub_r, _ = rehber_veri()
    sablon = (SABLON / "rehber.html").read_text(encoding="utf-8")
    yazilan = 0
    for kod, yol, tur, nesne in gecit_sayfalari():
        v = gecit_veri()[kod]
        m = v["metin"]
        d = dil_bilgisi(kod)
        metin = json.loads((DIL / f"{kod}.json").read_text(encoding="utf-8"))
        ui = hub_r[kod]["ui"]
        url = f"{ALAN}{yol}"
        ekmek = [(duz(metin["nav_anasayfa"]), sayfa_yolu(kod, "index.html"))]
        if tur == "gecit":
            govde, baslik, aciklama, h1, p = gecit_govde(kod, nesne, m, ui, metin)
            if kod != "tr":
                ekmek.append((m["ad"], gecit_kok(kod)))
            h0 = v["hub"][nesne["hublar"][0][0]]
            if h0["sayfa"] and h0["slug"]:
                ekmek.append((p["bolge"], gecit_hub_yol(kod, h0)))
            elif kod == "tr":
                ekmek.append((m["ad"], gecit_kok(kod)))
            ekmek.append((nesne["gad"], yol))
            ld = gecit_json_ld(kod, tur, url, baslik, aciklama, ekmek, g=nesne)
        elif tur == "hub":
            govde, baslik, aciklama, h1 = gecit_hub_govde(kod, nesne, m, ui, metin)
            if nesne["slug"]:
                ekmek.append((m["ad"], gecit_kok(kod)))
                ekmek.append((gecit_bolge_adi(kod, nesne, m)[0], yol))
            else:
                ekmek.append((m["ad"], yol))
            ld = gecit_json_ld(kod, tur, url, baslik, aciklama, ekmek, liste=nesne["gecitler"])
        else:
            govde, baslik, aciklama, h1 = gecit_index_govde(kod, m, ui, metin)
            ekmek.append((m["ad"], yol))
            ld = gecit_json_ld(kod, tur, url, baslik, aciklama, ekmek)
        tam = f"{baslik} — Motoseyir"
        baslik_tam = tam if len(tam) <= 60 else baslik
        alt = gecit_alternatifler(kod, tur, nesne)
        alternatif = ""
        if alt:
            alternatif = "\n".join([f'<link rel="alternate" hreflang="{k}" href="{ALAN}{y}">' for k, y in alt]
                                   + [f'<link rel="alternate" hreflang="x-default" href="{ALAN}{dict(alt)["en"]}">'])
        es = dict(alt)

        def dil_yolu(k, es=es):
            if k in es:
                return es[k]
            if k in GECIT_KAPSAM:
                return gecit_kok(k)
            return sayfa_yolu(k, "index.html")
        seo = rehber_seo_head({}, baslik_tam, aciklama, url, d["og"], False)
        foto = KOK / "m" / "gecit" / f'{nesne["id"]}.webp' if tur == "gecit" else None
        if foto and foto.exists():  # paylaşım görseli geçidin fotoğrafı (boyutuyla)
            w, h = webp_boyut(foto)
            seo = (seo.replace(SOSYAL_GORSEL, f'{ALAN}/m/gecit/{nesne["id"]}.webp')
                   .replace('content="image/jpeg"', 'content="image/webp"')
                   .replace('og:image:width" content="1200"', f'og:image:width" content="{w}"')
                   .replace('og:image:height" content="630"', f'og:image:height" content="{h}"'))
        degerler = {
            **metin,
            "lang": d["lang"], "baslik_tam": _html.escape(baslik_tam, quote=False),
            "aciklama_nitelik": _html.escape(aciklama, quote=True), "kanonik": url,
            "alternatifler": alternatif, "seo_head": seo, "json_ld": ld,
            "dil_secici": dil_secici(kod, "", metin, dil_yolu), "dil_altbilgi": dil_altbilgi(kod, "", dil_yolu),
            "store": gecit_magaza(kod), "gizlilik_url": gizlilik_url(kod),
            "impressum_url": impressum_url(kod), "anasayfa_url": sayfa_yolu(kod, "index.html"),
            "corider_url": sayfa_yolu(kod, "corider.html"), "ozellikler_url": sayfa_yolu(kod, "ozellikler.html"),
            "nasil_url": sayfa_yolu(kod, "nasil-yapilir.html"), "hub_url": rehber_hub_yolu(kod),
            "ui_rehber": ui["rehber"], "uygulama_id": UYGULAMA_ID, "yil": YIL, "rehber_icerik": govde,
            "arac_footer": arac_footer(kod),
        }
        html = varliklari_surumle(doldur(sablon, degerler, f"{kod}{yol}"))
        hedef = KOK / yol.strip("/") / "index.html"
        hedef.parent.mkdir(parents=True, exist_ok=True)
        hedef.write_text(html, encoding="utf-8")
        yazilan += 1
    for eski, yeni in GECIT_YONLENDIRME.items():
        if any(y == eski for _, y, _, _ in gecit_sayfalari()):
            raise SystemExit(f"HATA: yönlendirilen adreste yine sayfa var: {eski}")
        hedef = KOK / eski.strip("/") / "index.html"
        hedef.parent.mkdir(parents=True, exist_ok=True)
        u = f"{ALAN}{yeni}"
        hedef.write_text(f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Moved</title>
<meta name="robots" content="noindex"><link rel="canonical" href="{u}">
<meta http-equiv="refresh" content="0; url={yeni}"></head>
<body><p><a href="{yeni}">{u}</a></p></body></html>
''', encoding="utf-8")
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
                "arac_baglanti": arac_baglanti(kod),
                "arac_menu": arac_menu(kod), "arac_hero": arac_hero(kod), "arac_bant": arac_bant(kod),
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
    arac_yazilan = arac_yaz() + tanitim_yaz()
    yazilan += arac_yazilan
    yazilan += izle_yaz()
    gecit_yazilan = gecit_yaz()
    yazilan += gecit_yazilan

    (KOK / "sitemap.xml").write_text(sitemap(), encoding="utf-8")
    (KOK / "robots.txt").write_text(ROBOTS, encoding="utf-8")

    diller = ", ".join(d["kod"] for d in DILLER)
    print(f"{yazilan} sayfa yazıldı — {len(DILLER)} dil ({diller}); bunların {rehber_yazilan}'i rehber, {arac_yazilan}'i araç sayfası, {gecit_yazilan}'i geçit sayfası")
    print("sitemap.xml ve robots.txt yenilendi")


if __name__ == "__main__":
    main()
