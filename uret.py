#!/usr/bin/env python3
"""Motoseyir tanıtım sitesi — çok dilli sayfa üreticisi.

Çalıştırma (depo kökünden):

    python3 uret.py

Ne yapar: `sablon/` altındaki HTML şablonlarını `dil/<kod>.json` metinleriyle
doldurup 14 dilde sayfa yazar. Türkçe KÖKE (index.html, ozellikler.html,
nasil-yapilir.html) — eski adresler bozulmasın diye. Diğer diller
`/<kod>/index.html` gibi alt yollara. Ayrıca sitemap.xml ve robots.txt
yeniden yazılır.

Yalnız Python 3 standart kütüphanesi kullanılıyor; kurulum gerektirmez.

ELLE DÜZENLENMEZ: kökteki ve dil klasörlerindeki sayfalar bu betiğin
çıktısıdır. Metin değişikliği `dil/<kod>.json`, yapı değişikliği `sablon/`
içine yazılır, sonra betik yeniden koşturulur.

ELLE TUTULANLAR (betik dokunmaz): gizlilik/index.html (TR tam politika),
gizlilik/en/index.html (İngilizce özet), indir/index.html, style.css, img/,
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


def magaza_baglantisi(kod: str) -> str:
    """App Store kampanya bağlantısı.

    `pt` (sağlayıcı) olmadan `ct` App Store Connect'te hiç görünmüyor — ikisi
    birlikte yazılıyor. `ct` dil başına ayrı, indirmenin hangi dildeki
    sayfadan geldiği ayrışsın diye.
    """
    vitrin = dil_bilgisi(kod)["vitrin"]
    yol = f"/{vitrin}/app/id{UYGULAMA_ID}" if vitrin else f"/app/id{UYGULAMA_ID}"
    return f"https://apps.apple.com{yol}?pt={SAGLAYICI}&amp;ct=site-{kod}&amp;mt=8"


def gizlilik_url(kod: str) -> str:
    """Gizlilik politikası TR; İngilizce özeti ayrı sayfada."""
    return "/gizlilik/en/" if kod == "en" else "/gizlilik/"


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


def dil_secici(kod: str, dosya: str, metin: dict) -> str:
    """Başlıktaki dil listesi.

    <details> ile: bayrak yok (bayrak dili değil ülkeyi anlatır), JavaScript
    yok, dil adları kendi dilinde. Kapalıyken tek satır yer tutuyor.
    """
    bu = dil_bilgisi(kod)
    ogeler = []
    for d in DILLER:
        if d["kod"] == kod:
            ogeler.append(f'<li><span aria-current="true">{d["ad"]}</span></li>')
        else:
            ogeler.append(
                f'<li><a href="{sayfa_yolu(d["kod"], dosya)}" lang="{d["lang"]}" '
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


def dil_altbilgi(kod: str, dosya: str) -> str:
    """Altbilgideki düz dil listesi — arama motorları ve JS'siz gezinme için."""
    ogeler = []
    for d in DILLER:
        if d["kod"] == kod:
            ogeler.append(f'<li><strong lang="{d["lang"]}">{d["ad"]}</strong></li>')
        else:
            ogeler.append(
                f'<li><a href="{sayfa_yolu(d["kod"], dosya)}" lang="{d["lang"]}" '
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

    # Elle tutulan gizlilik sayfaları: TR tam metin + İngilizce özet.
    for yol, esler in (
        ("/gizlilik/", [("tr", "/gizlilik/"), ("en", "/gizlilik/en/")]),
        ("/gizlilik/en/", [("tr", "/gizlilik/"), ("en", "/gizlilik/en/")]),
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
            f'    <xhtml:link rel="alternate" hreflang="x-default" href="{ALAN}/gizlilik/en/"/>'
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
                "anasayfa_url": sayfa_yolu(kod, "index.html"),
                "corider_url": sayfa_yolu(kod, "corider.html"),
                "ozellikler_url": sayfa_yolu(kod, "ozellikler.html"),
                "nasil_url": sayfa_yolu(kod, "nasil-yapilir.html"),
                "uygulama_id": UYGULAMA_ID,
                "yil": YIL,
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

    (KOK / "sitemap.xml").write_text(sitemap(), encoding="utf-8")
    (KOK / "robots.txt").write_text(ROBOTS, encoding="utf-8")

    diller = ", ".join(d["kod"] for d in DILLER)
    print(f"{yazilan} sayfa yazıldı — {len(DILLER)} dil ({diller})")
    print("sitemap.xml ve robots.txt yenilendi")


if __name__ == "__main__":
    main()
