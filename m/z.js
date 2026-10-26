/*
 * Site ziyaret sayacı (26 Eki 2026, kullanıcı: "evet motoseyir'e de sayaç kur"). Site GitHub Pages'te, sunucu günlüğü yok;
 * Search Console yalnız Google tıklamasını gösteriyor. Sayfa 1 sn görünür kalınca "acildi", App Store / Play düğmesine
 * basılınca "magaza", web tur aracında tur çıkınca "tur", tur telefona gönderilince "gonder" işareti
 * rota.motoseyir-app.com/olcum/z'ye gider (sunucu: moto-rota server/olcum.py, site_kaydet).
 * Çerez yok, kimlik yok: oturum sayfa açılışı başına rastgele (sekme kapanınca kaybolur). Giden: yol, dil, reklam etiketi
 * (?ct=), geldiği sitenin alan adı (yalnız alan adı, tam adres değil). Sunucu IP'yi yazmaz; ülke kodu ve o güne özel
 * geri çevrilemez bir iz tutar, 30 günde siler. Gizlilik metni: gizlilik/ ("Site ziyaret sayacı").
 */
(function () {
  var U = 'https://rota.motoseyir-app.com/olcum/z';
  if (!navigator.sendBeacon || navigator.webdriver || !/motoseyir-app\.com$/.test(location.hostname)) return;
  var o = Math.random().toString(36).slice(2, 12);
  while (o.length < 8) o += '0';
  var ct = '';
  try { ct = (new URLSearchParams(location.search).get('ct') || '').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 40); } catch (e) { /* eski */ }
  var k = '';
  try { if (document.referrer) { var h = new URL(document.referrer).hostname.toLowerCase(); if (h !== location.hostname) k = h.replace(/^www\./, '').slice(0, 60); } } catch (e) { /* eski */ }
  var dil = (document.documentElement.lang || '').slice(0, 8);
  var yol = location.pathname.replace(/[^A-Za-z0-9/._-]/g, '').slice(0, 120) || '/';
  var gitti = {};
  function at(a) {
    if (gitti[a]) return;
    gitti[a] = 1;
    try { navigator.sendBeacon(U, JSON.stringify({ o: o, a: a, y: yol, d: dil, ct: ct, k: k })); } catch (e) { /* ölçüm sayfayı bozmasın */ }
  }
  var t;
  function bak() { clearTimeout(t); if (document.visibilityState === 'visible') t = setTimeout(function () { at('acildi'); }, 1000); }
  document.addEventListener('visibilitychange', bak);
  bak();
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest && e.target.closest('a[href]');
    if (a && /apps\.apple\.com|play\.google\.com|\/get\/|\/indir\//.test(a.href)) at('magaza');
  }, true);
  window.addEventListener('tur:sonuc', function (e) { if (e.detail && e.detail.yeni) at('tur'); });
  window.addEventListener('tur:gonderildi', function () { at('gonder'); });
})();
