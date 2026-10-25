/*
 * Motoseyir web tur üreticisi — arayüz.
 * Hesap uygulamayla AYNI kod: m/tur/motor.js (tur-araci/derle.mjs moto-rota kaynağından paketliyor).
 * Burada yalnız ekran: harita (MapLibre + Protomaps), girdiler, sonuç kartları ve telefona aktarma (tur kodu + QR).
 * Bağımlılık: maplibre-gl, pmtiles, qrcode-generator (hepsi /m/tur/lib/ altında, sabit sürüm), motor.js (MotoTur).
 */
(function () {
  'use strict';
  var kok = document.getElementById('arac');
  var ayarEl = document.getElementById('arac-ayar');
  if (!kok || !ayarEl || !window.MotoTur) return;
  var A = JSON.parse(ayarEl.textContent); // { dil, ui, kok (kampanya/kod adresi), magaza: {ios, play} }
  var T = A.ui;
  var M = window.MotoTur;
  var $ = function (s, k) { return (k || kok).querySelector(s); };
  var $$ = function (s, k) { return Array.prototype.slice.call((k || kok).querySelectorAll(s)); };
  var SONUC_TAVANI = 9; // uygulamadaki SONUC_TAVANI
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var dokunmatik = window.matchMedia && matchMedia('(pointer: coarse)').matches;
  var ua = navigator.userAgent || '';
  var ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  var android = /Android/.test(ua);
  var mobil = ios || android;
  var tz = '';
  try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) { /* yok */ }

  /* ---------------------------------------------------------------- durum */
  var st = {
    S: null, yon: 0, herYon: false, km: 100, sure: false, seviye: 2,
    kacin: { otoyol: false, gise: false, toprak: false }, gecit: false,
    birim: 'km', sonuc: [], secili: 0, adlar: new Map(), varyasyon: 0, evre: 'ayar', calisma: 0,
    paylasim: new Map(), baslangicAdi: ''
  };
  try {
    var kayit = JSON.parse(localStorage.getItem('motoseyir.web.tur') || 'null');
    if (kayit && typeof kayit === 'object') {
      if ([1, 2, 3].indexOf(kayit.seviye) >= 0) st.seviye = kayit.seviye;
      if (kayit.kacin) st.kacin = { otoyol: !!kayit.kacin.otoyol, gise: !!kayit.kacin.gise, toprak: !!kayit.kacin.toprak };
      if (typeof kayit.km === 'number' && kayit.km >= 30 && kayit.km <= 300) st.km = Math.round(kayit.km / 10) * 10;
      if (kayit.birim === 'mi') st.birim = 'mi';
    } else if (A.dil === 'en' && /^en-(US|GB)$/i.test(navigator.language || '')) {
      st.birim = 'mi';
    }
  } catch (e) { /* depolama kapalı */ }
  function kaydet() {
    try { localStorage.setItem('motoseyir.web.tur', JSON.stringify({ seviye: st.seviye, kacin: st.kacin, km: st.km, birim: st.birim })); } catch (e) { /* sorun değil */ }
  }

  /* ---------------------------------------------------------------- biçim */
  function f1(n) { return (Math.round(n * 10) / 10).toString().replace('.', A.ondalik || '.'); }
  function mesafe(km) { return st.birim === 'mi' ? Math.round(km * 0.621371) + ' mi' : Math.round(km) + ' km'; }
  function sureYazi(sn) {
    var dk = Math.round(sn / 60);
    if (dk < 60) return dk + ' ' + T.dk;
    var s = Math.floor(dk / 60), d = dk % 60;
    return s + ' ' + T.sa + (d ? ' ' + d + ' ' + T.dk : '');
  }
  // Yol parçası uzunluğu (asfaltsız vb.): 13692 m değil "13,7 km" / "8.5 mi".
  function kisaMesafe(m) {
    var v = st.birim === 'mi' ? m / 1609.344 : m / 1000, b = st.birim === 'mi' ? ' mi' : ' km';
    return (v < 10 ? v.toLocaleString(document.documentElement.lang || 'tr', { maximumFractionDigits: 1 }) : Math.round(v)) + b;
  }
  function metreYazi(m) { return st.birim === 'mi' ? Math.round(m * 3.28084) + ' ft' : Math.round(m) + ' m'; }
  function doldur(s, d) { return s.replace(/\{(\w+)\}/g, function (_, k) { return d[k] != null ? d[k] : ''; }); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function durum(metin, tur) {
    var el = $('#tur-durum');
    el.textContent = metin || '';
    el.className = 'tur-durum' + (tur ? ' ' + tur : '');
    el.hidden = !metin;
  }
  M.dilAyarla(A.dil === 'tr' ? 'default' : A.dil);
  function olay(ad, d) { try { window.dispatchEvent(new CustomEvent(ad, { detail: d || {} })); } catch (e) { /* eski tarayıcı */ } }
  function yukseklik(m) { // 2.764 m / 2,764 m / 9,068 ft (sayfanın dilinde binlik ayracı)
    var v = st.birim === 'mi' ? Math.round(m * 3.28084) : Math.round(m);
    return v.toLocaleString(document.documentElement.lang || 'tr') + (st.birim === 'mi' ? ' ft' : ' m');
  }

  /* ---------------------------------------------------------------- geçit simgesi
     Tepe silüeti + üstünden kıvrılan yol + zirvede altın bayrak (petrol zemin, krem çizgi, altın vurgu). Uygulamanın kendi illüstrasyonu olan
     yerlerde (Stelvio, Großglockner, Transfăgărășan, Kapadokya, Nemrut, Sumela, Uludağ) o çizim krem rozete konur: m/tur/yer/<ad>.webp. */
  var RESIMLI = [[/stelvio/i, 'stelvio'], [/gro(ss|ß)glockner|hochtor/i, 'grossglockner'], [/transf[aă]g[aă]r/i, 'transfagarasan'], [/uluda[gğ]/i, 'uludag'],
    [/kapadok/i, 'kapadokya'], [/nemrut/i, 'nemrut'], [/zigana|sumela/i, 'sumela']];
  function resimAdi(ad) { for (var i = 0; i < RESIMLI.length; i++) if (RESIMLI[i][0].test(ad || '')) return RESIMLI[i][1]; return ''; }
  function gecitSvg(px, gri) {
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="' + px + '" height="' + px + '" aria-hidden="true">' +
      '<circle cx="24" cy="24" r="22" fill="' + (gri ? '#7B8A8D' : '#0E6E73') + '" stroke="#FCF7EA" stroke-width="2.4"/>' +
      '<path d="M8 36 L21 13 L27 23 L31 17.5 L40 36 Z" fill="#FCF7EA"/>' +
      '<path d="M22.5 36 C13 33 28 30.5 20 27 C13.5 24 22.5 21 21 15.8" fill="none" stroke="#F4B63F" stroke-width="2.4" stroke-linecap="round"/>' +
      '<path d="M21 13 V6" stroke="#FCF7EA" stroke-width="1.8" stroke-linecap="round"/><path d="M21 6 L27.6 8.2 L21 10.4 Z" fill="#F4B63F"/></svg>';
  }
  function resimliImg(ad, px) { return '<img src="/m/tur/yer/' + ad + '.webp" alt="" width="' + px + '" height="' + px + '" loading="lazy" decoding="async">'; }
  function gecitIkonHtml(ad, px, gri) { var r = resimAdi(ad); return r ? resimliImg(r, px) : gecitSvg(px, gri); }

  /* ---------------------------------------------------------------- hareket dili
     Sakin yumuşatmalar (power3 / expo çıkışı); elastik, sıçrama yok. Yalnız transform/opacity ve MapLibre'nin kendi animasyonları
     (kamera, boya geçişleri); çizgi çizimi tek karede iki boya özelliği. prefers-reduced-motion: her şey tek adımda biter, içerik aynı. */
  var EASE3 = function (t) { return 1 - Math.pow(1 - t, 3); };
  function anim(sure, kare, bitti) {
    var iptal = false, t0 = null;
    if (reduce || !(sure > 0)) { kare(1); if (bitti) bitti(); return function () {}; }
    function adim(ts) {
      if (iptal) return;
      if (t0 === null) t0 = ts;
      var t = Math.min(1, (ts - t0) / sure);
      kare(t);
      if (t < 1) requestAnimationFrame(adim); else if (bitti) bitti();
    }
    requestAnimationFrame(adim);
    return function () { iptal = true; };
  }
  function kamera(secenek) { secenek.easing = EASE3; secenek.duration = reduce ? 0 : (secenek.duration == null ? 900 : secenek.duration); return secenek; }
  function sayBicim(tur, v) {
    return tur === 'km' ? mesafe(v) : tur === 'sure' ? sureYazi(v) : f1(v);
  }
  /* Sonuç kartındaki sayılar 0'dan gelir (ekran okuyucu için son değer ayrı, gizli yazıda). */
  function sayiAnim(el, gecikme) {
    var to = parseFloat(el.dataset.to), tur = el.dataset.say;
    if (reduce) { el.textContent = sayBicim(tur, to); return; }
    el.textContent = sayBicim(tur, 0);
    setTimeout(function () { anim(1000, function (t) { el.textContent = sayBicim(tur, to * EASE3(t)); }); }, gecikme || 0);
  }

  /* ---------------------------------------------------------------- harita */
  var harita = null, hazir = false, baslangicIsareti = null, ilkSembolKimligi = null;
  var bos = { type: 'FeatureCollection', features: [] };
  // En az 6. düzey (25 Eki): harita dosyasında 4–5. düzeydeki bazı parçalar boş çiziliyor (veri sağlam, MapLibre'de bucket 0);
  // Türkiye'yi 5'te açınca yalnız bir kare dolu kalıyordu. Sebep bulunana kadar daha uzağa izin yok.
  var EN_AZ_YAKINLIK = 6;
  var MERKEZ = A.dil === 'tr' ? { c: [32.9, 39.9], z: 6 } : A.dil === 'de' ? { c: [11.0, 47.9], z: 6 }
    : /^America\//.test(tz) ? { c: [-105.5, 39.5], z: 6 } : { c: [8.5, 46.7], z: 6 };

  function daire(c, rKm, n) {
    var kx = 111.32 * Math.cos(c.latitude * Math.PI / 180), ky = 110.574, hal = [];
    for (var i = 0; i <= n; i++) {
      var a = (i / n) * 2 * Math.PI;
      hal.push([c.longitude + (rKm * Math.sin(a)) / kx, c.latitude + (rKm * Math.cos(a)) / ky]);
    }
    return hal;
  }
  /* ---------------------------------------------------------------- kadran (m/tur/kadran.js)
     Uygulamadaki Tur üret kadranı: haritanın üstünde pusula + tur halkası + tutamak. Durum st'de tek yerde; panelin yön ızgarası ve
     kaydırgacı ile İKİ YÖNLÜ: kadranda sürükleyince panel güncellenir, panelde değişince kadran çizilir (klavye ve ekran okuyucu paneli kullanır). */
  var kadran = null, kadranDokunuldu = false;
  function pay() { // haritanın panel/sayfa/çubuk tarafından örtülen kenarları (px)
    var kap = $('#tur-harita'); if (!kap) return { sag: 0, alt: 0, ust: 0, sol: 0 };
    var r = kap.getBoundingClientRect(), p = $('#tur-panel').getBoundingClientRect(), y = $('#tur-yolustu');
    var mobilEkran = window.innerWidth < 900, sag = 0, alt = 0;
    if (mobilEkran) alt = Math.max(0, r.bottom - p.top);
    else sag = Math.max(0, r.right - p.left + 6);
    if (y && st.kip === 'uret' && st.evre === 'sonuc') { // çubuk henüz çizilmediyse tahmini boy (kamera çubuğun altında kalmasın)
      var yh = (y.hidden ? 0 : y.offsetHeight) || (mobilEkran ? 124 : 150);
      alt = Math.max(alt, (mobilEkran ? alt : 0) + yh + (mobilEkran ? 14 : 36));
    }
    return { sag: Math.round(sag), alt: Math.round(Math.min(alt, r.height * 0.62)), ust: 0, sol: 0 };
  }
  function padYaz() {
    if (!hazir) return;
    var q = pay();
    try { harita.setPadding({ top: q.ust, bottom: q.alt, left: q.sol, right: q.sag }); } catch (e) { /* eski */ }
  }
  function kadranKur() {
    if (kadran || !window.TurKadran || !window.TurGeometri) return;
    kadran = TurKadran.kur({
      kok: $('#tur-kadran'), reduce: reduce, pay: pay, ipucuYazi: T.kadran_ipucu,
      harita: function () { return hazir ? harita : null; },
      durum: function () { return { S: st.S, yon: st.yon, herYon: st.herYon, km: st.kmCanli != null ? st.kmCanli : st.km, seviye: st.seviye, sure: st.sure }; },
      yazilar: function () {
        var buyuk, kucuk, adim = M.cetvelAdimi(st.sure, st.seviye), km = M.adimaOturt(st.km, adim);
        if (st.sure) { buyuk = sureYazi(M.sureSaniye(km, st.seviye)); kucuk = '≈ ' + mesafe(km); }
        else { buyuk = mesafe(km); kucuk = '≈ ' + sureYazi((km / M.ORTALAMA_KMSA[st.seviye]) * 3600); }
        return { buyuk: buyuk, kucuk: kucuk, yon: yonAdlari[M.enYakinYon(st.yon).i], herYon: T.her_yon };
      },
      yaz: function (d) {
        if (d.yon != null) {
          st.herYon = false; st.yon = ((d.yon % 360) + 360) % 360;
          $$('input[name=yon]').forEach(function (r) { r.checked = r.value !== 'hepsi' && Math.abs(+r.value - st.yon) < 0.5; });
          yonOk();
        }
        if (d.km != null) {
          var adim = M.cetvelAdimi(st.sure, st.seviye), oturt = M.adimaOturt(d.km, adim);
          st.kmCanli = d.km; st.km = oturt;
          kaydirgac.value = st.sure ? Math.round(oturt / adim) : oturt;
          cetvelYazi();
        }
      },
      bitti: function () {
        var adim = M.cetvelAdimi(st.sure, st.seviye);
        st.kmCanli = null; st.km = M.adimaOturt(st.km, adim);
        cetvelKur(); kaydet(); kadran.guncelle(); kadran.cerceve(560);
      },
      baslangicTasi: function (p) { baslangicKoy(p, false, true); kadran.cerceve(560); },
      jestBasladi: function () { if (window.TurPanel && window.innerWidth < 900 && window.TurPanel.durum() === 'acik') window.TurPanel.ayarla('yarim'); },
      dokunuldu: function () { kadranDokunuldu = true; var ip = $('#tur-ipucu'); if (ip && st.S) ip.hidden = true; }
    });
    kadran.mod(st.evre === 'araniyor' ? 'ara' : st.evre === 'sonuc' || st.kip === 'rotalar' ? 'gizli' : 'ayar');
  }
  function kadranMod() {
    if (!kadran) return;
    var m = st.kip === 'rotalar' ? 'gizli' : st.evre === 'araniyor' ? 'ara' : st.evre === 'sonuc' ? 'gizli' : 'ayar';
    kadran.mod(m);
    pinGuncelle();
  }
  function pinGuncelle() { // sarı iğne yalnız sonuç evresinde (kadranda başlangıç noktası zaten görünüyor)
    if (!baslangicIsareti) return;
    var goster = st.kip === 'uret' && (st.evre === 'sonuc' || !kadran);
    baslangicIsareti.getElement().style.display = goster ? '' : 'none';
  }
  var padZ = 0;
  function padGuncelleGec() { clearTimeout(padZ); padZ = setTimeout(function () { padYaz(); if (kadran) { kadran.guncelle(); if (st.evre === 'ayar' && st.S && st.kip === 'uret') kadran.cerceve(420); } }, 60); }
  /* Yol üstünde çubuğu: tur sonuçları görünürken haritanın altında */
  function yolustuGoster() {
    var y = $('#tur-yolustu'); if (!y) return;
    var ac = st.kip === 'uret' && st.evre === 'sonuc' && st.sonuc.length > 0;
    if (ac && y.hidden) { y.hidden = false; requestAnimationFrame(function () { requestAnimationFrame(function () { y.classList.add('on'); padYaz(); }); }); }
    else if (!ac && !y.hidden) { y.classList.remove('on'); y.hidden = true; yerIsaretleriTemizle(); yer.liste = []; padYaz(); }
  }
  function arayuzGuncelle() {
    kadranMod(); yolustuGoster(); padYaz();
    if (window.TurPanel && st.evre === 'sonuc' && window.innerWidth < 900 && window.TurPanel.durum() === 'kapali') window.TurPanel.ayarla('yarim');
  }
  window.addEventListener('tur:yerlesim', function () { padYaz(); if (kadran) { kadran.guncelle(); if (st.evre === 'ayar' && st.S && st.kip === 'uret') kadran.cerceve(420); } });
  function halkaGuncelle() { if (kadran) kadran.guncelle(); }
  function halkaSigdir() { if (kadran && st.evre === 'ayar' && st.kip === 'uret') kadran.cerceve(640); }

  function haritaKur() {
    if (!window.maplibregl || !window.pmtiles) { durum(T.hata_harita, 'hata'); return; }
    maplibregl.addProtocol('pmtiles', new pmtiles.Protocol().tile);
    fetch('/m/tur/harita/stil.json').then(function (r) { return r.json(); }).then(function (stil) {
      stil.glyphs = location.origin + stil.glyphs;
      stil.sprite = location.origin + stil.sprite;
      harita = new maplibregl.Map({
        container: 'tur-harita', style: stil, center: st.S ? [st.S.longitude, st.S.latitude] : MERKEZ.c, zoom: st.S ? 9.5 : MERKEZ.z, minZoom: EN_AZ_YAKINLIK, maxZoom: 16.5,
        attributionControl: false, dragRotate: false, pitchWithRotate: false, cooperativeGestures: false, fadeDuration: reduce ? 0 : 260
      });
      harita.touchZoomRotate.disableRotation();
      harita.addControl(new maplibregl.AttributionControl({ compact: true, customAttribution: '© OpenStreetMap · Protomaps' }), 'bottom-left');
      harita.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-left');
      if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) window.MotoTurHarita = harita; // yalnız yerel sınama
      harita.on('error', function (e) {
        if (window.console) console.warn('harita:', e && e.error ? e.error.message || e.error : e);
        if (e && e.error && /pmtiles|Failed to fetch|AJAXError/i.test(String(e.error.message || e.error))) haritaHata();
      });
      // Harita, kapsayıcısı yerleşim bitmeden (yazı tipi/ızgara oturmadan) kurulunca kendini küçük pencere sanıp yalnız bir
      // parça yüklüyordu (25 Eki, kullanıcı ekranı: sol üstte tek kare, gerisi gri). Kapsayıcı boyutu değiştikçe yeniden ölç.
      if (window.ResizeObserver) new ResizeObserver(function () { harita.resize(); }).observe(document.getElementById('tur-harita'));
      window.addEventListener('load', function () { harita.resize(); });
      harita.on('load', haritaYuklendi);
      harita.on('click', function (e) {
        if (st.kip === 'rotalar') { kesTikla(e); return; }
        baslangicKoy({ latitude: e.lngLat.lat, longitude: e.lngLat.lng }, false);
      });
    }).catch(haritaHata);
  }
  var haritaHataVerildi = false;
  function haritaHata() {
    if (haritaHataVerildi) return;
    haritaHataVerildi = true;
    var el = $('#tur-harita-hata'); if (el) el.hidden = false;
  }

  /* line-gradient + line-progress: çizgi başından p oranına kadar boyalı, ötesi saydam (çizim animasyonu). */
  function gradyan(p, renk) {
    if (p >= 1) return ['interpolate', ['linear'], ['line-progress'], 0, renk, 1, renk];
    return ['step', ['line-progress'], renk, Math.max(p, 0.00005), 'rgba(0,0,0,0)'];
  }
  var GEC = { duration: 450, delay: 0 };
  function haritaYuklendi() {
    // Harita stili uygulamadan geldiği için etiketler name:tr; EN/DE sayfada sayfanın dilini kullan (25 Eki: "İSVİÇRE").
    if (A.dil !== 'tr') harita.getStyle().layers.forEach(function (l) {
      var tf = l.layout && l.layout['text-field'];
      if (!tf) return;
      var j = JSON.stringify(tf);
      if (j.indexOf('name:tr') < 0) return;
      try { harita.setLayoutProperty(l.id, 'text-field', JSON.parse(j.split('name:tr').join('name:' + A.dil))); } catch (e) { /* etiket Türkçe kalır */ }
    });
    hazir = true;
    padYaz();
    kadranKur();
    var ilkSembol = null;
    harita.getStyle().layers.some(function (l) { if (l.type === 'symbol') { ilkSembol = l.id; return true; } return false; });
    ilkSembolKimligi = ilkSembol;
    ['halka', 'rotalar', 'bas'].forEach(function (k) { harita.addSource(k, { type: 'geojson', data: bos }); });
    harita.addSource('secili', { type: 'geojson', data: bos, lineMetrics: true });
    var ekle = function (l) { harita.addLayer(l, ilkSembol); };
    var cizgi = { 'line-cap': 'round', 'line-join': 'round' };
    ekle({ id: 'rota-soluk', type: 'line', source: 'rotalar', layout: cizgi, paint: { 'line-color': '#5d6e6b', 'line-width': 3.2, 'line-opacity': 0, 'line-opacity-transition': GEC } });
    ekle({ id: 'rota-kenar', type: 'line', source: 'secili', layout: cizgi, paint: { 'line-gradient': gradyan(0, '#FFFFFF'), 'line-width': 9, 'line-opacity': 1, 'line-opacity-transition': GEC } });
    ekle({ id: 'rota-secili', type: 'line', source: 'secili', layout: cizgi, paint: { 'line-gradient': gradyan(0, '#0E6E73'), 'line-width': 5.5, 'line-opacity': 1, 'line-opacity-transition': GEC } });
    ekle({ id: 'bas-halka', type: 'circle', source: 'bas', paint: { 'circle-radius': 11, 'circle-color': '#F4B63F', 'circle-opacity': 0.35, 'circle-blur': 0.6 } });
    ekle({ id: 'bas-nokta', type: 'circle', source: 'bas', paint: { 'circle-radius': 5.5, 'circle-color': '#ffffff', 'circle-stroke-color': '#0E6E73', 'circle-stroke-width': 3 } });
    if (st.S) { isaretKur(); halkaGuncelle(); kadranMod(); if (kadran) { kadran.ipucu(!kadranDokunuldu); kadran.cerceve(0); } }
    if (st.kip === 'rotalar' && kes.veri) kesKatmanGoster(true);
    $('#tur-harita').classList.add('hazir');
  }

  function isaretKur() {
    if (!hazir || !st.S) return;
    if (!baslangicIsareti) {
      var el = document.createElement('div');
      el.className = 'tur-isaret';
      el.setAttribute('role', 'img');
      el.setAttribute('aria-label', T.baslangic_isaret);
      el.innerHTML = '<svg viewBox="0 0 28 38" width="28" height="38" aria-hidden="true"><path d="M14 1C7 1 1.5 6.4 1.5 13.2 1.5 22.6 14 37 14 37S26.5 22.6 26.5 13.2C26.5 6.4 21 1 14 1z" fill="#F4B63F" stroke="#3a2a00" stroke-width="2"/><circle cx="14" cy="13.5" r="4.6" fill="#3a2a00"/></svg>';
      baslangicIsareti = new maplibregl.Marker({ element: el, draggable: true, anchor: 'bottom' }).setLngLat([st.S.longitude, st.S.latitude]).addTo(harita);
      baslangicIsareti.on('dragend', function () {
        var p = baslangicIsareti.getLngLat();
        baslangicKoy({ latitude: p.lat, longitude: p.lng }, false, true);
      });
    } else {
      baslangicIsareti.setLngLat([st.S.longitude, st.S.latitude]);
    }
  }

  /* ---------------------------------------------------------------- başlangıç */
  function baslangicKoy(p, uc, yerinde, ad) {
    if (st.evre === 'araniyor') return;
    st.S = { latitude: Math.round(p.latitude * 1e5) / 1e5, longitude: Math.round(p.longitude * 1e5) / 1e5 };
    st.baslangicAdi = ad || '';
    if (st.evre === 'sonuc') ayaraDon(true);
    isaretKur();
    $('#tur-baslangic-yazi').textContent = ad || (f1(st.S.latitude) + ', ' + f1(st.S.longitude));
    $('#tur-baslangic-yazi').classList.add('dolu');
    $('#tur-ipucu').hidden = true;
    kok.classList.add('baslangic-var');
    if (hazir) {
      kadranMod();
      if (kadran) { kadran.ipucu(!kadranDokunuldu); if (!yerinde) kadran.cerceve(850); else kadran.guncelle(); }
    }
    if (!ad) tersAd(st.S);
    durum('');
  }
  var tersNo = 0;
  function tersAd(s) {
    var no = ++tersNo;
    var d = A.dil === 'tr' ? 'default' : A.dil;
    fetch('https://photon.komoot.io/reverse?lat=' + s.latitude + '&lon=' + s.longitude + '&limit=1&lang=' + d)
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        if (no !== tersNo || !j || !j.features || !j.features[0]) return;
        var o = j.features[0].properties;
        var ad = o.name || o.city || o.town || o.village || o.county;
        if (ad && o.city && ad !== o.city) ad += ', ' + o.city;
        if (ad && st.S === s) { st.baslangicAdi = ad; $('#tur-baslangic-yazi').textContent = ad; }
      }).catch(function () { /* ad yok: koordinat kalıyor */ });
  }

  /* arama (Photon / OpenStreetMap) — yalnız Enter ya da düğme ile; yazarken sorgu atılmıyor */
  var araGirdi = $('#tur-ara-girdi'), araListe = $('#tur-ara-sonuc');
  function ara(q) {
    q = q.trim();
    if (q.length < 2) return;
    var c = harita ? harita.getCenter() : { lat: MERKEZ.c[1], lng: MERKEZ.c[0] };
    var d = A.dil === 'tr' ? 'default' : A.dil;
    araListe.hidden = false;
    araListe.innerHTML = '<li class="not">' + esc(T.araniyor) + '</li>';
    fetch('https://photon.komoot.io/api/?q=' + encodeURIComponent(q) + '&limit=6&lang=' + d + '&lat=' + c.lat.toFixed(3) + '&lon=' + c.lng.toFixed(3))
      .then(function (r) { if (!r.ok) throw new Error('ara'); return r.json(); })
      .then(function (j) {
        var f = (j.features || []).filter(function (x) { return x.geometry && x.geometry.coordinates; });
        if (!f.length) { araListe.innerHTML = '<li class="not">' + esc(T.ara_yok) + '</li>'; return; }
        araListe.innerHTML = f.map(function (x, i) {
          var o = x.properties, ad = o.name || o.street || '', alt = [o.city || o.town || o.village, o.state, o.country].filter(Boolean).join(', ');
          return '<li><button type="button" data-i="' + i + '"><strong>' + esc(ad) + '</strong><span>' + esc(alt) + '</span></button></li>';
        }).join('');
        $$('button', araListe).forEach(function (b) {
          b.addEventListener('click', function () {
            var x = f[+b.dataset.i], o = x.properties;
            araListe.hidden = true;
            araGirdi.value = '';
            baslangicKoy({ latitude: x.geometry.coordinates[1], longitude: x.geometry.coordinates[0] }, false, false, [o.name || o.street, o.city && o.city !== o.name ? o.city : ''].filter(Boolean).join(', '));
          });
        });
      }).catch(function () { araListe.innerHTML = '<li class="not">' + esc(T.ara_hata) + '</li>'; });
  }
  $('#tur-ara-dugme').addEventListener('click', function () { ara(araGirdi.value); });
  araGirdi.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); ara(araGirdi.value); }
    if (e.key === 'Escape') araListe.hidden = true;
    if (e.key === 'ArrowDown') { var b = $('button', araListe); if (b) { e.preventDefault(); b.focus(); } }
  });
  araListe.addEventListener('keydown', function (e) {
    var bs = $$('button', araListe), i = bs.indexOf(document.activeElement);
    if (e.key === 'ArrowDown' && i < bs.length - 1) { e.preventDefault(); bs[i + 1].focus(); }
    if (e.key === 'ArrowUp') { e.preventDefault(); (i > 0 ? bs[i - 1] : araGirdi).focus(); }
    if (e.key === 'Escape') { araListe.hidden = true; araGirdi.focus(); }
  });
  document.addEventListener('click', function (e) { if (!e.target.closest('#tur-ara-form')) araListe.hidden = true; });

  $('#tur-konum').addEventListener('click', function () {
    if (!navigator.geolocation) { durum(T.konum_yok, 'hata'); return; }
    var d = $('#tur-konum'); d.disabled = true; d.classList.add('bekle');
    navigator.geolocation.getCurrentPosition(function (k) {
      d.disabled = false; d.classList.remove('bekle');
      baslangicKoy({ latitude: k.coords.latitude, longitude: k.coords.longitude }, true, false, T.konumum);
    }, function () {
      d.disabled = false; d.classList.remove('bekle');
      durum(T.konum_yok, 'hata');
    }, { enableHighAccuracy: false, timeout: 12000, maximumAge: 300000 });
  });

  /* ---------------------------------------------------------------- girdiler */
  var yonler = [ // pusula: ızgara satırları (üst→alt), merkez = her yön
    [315, 0, 45], [270, null, 90], [225, 180, 135]
  ];
  var yonAdlari = T.yonlar; // 8 ad, kuzeyden saat yönünde
  var ok = ['↖', '↑', '↗', '←', '', '→', '↙', '↓', '↘'];
  (function yonKur() {
    var g = $('#tur-yonler'), html = '', i = 0;
    yonler.forEach(function (satir) {
      satir.forEach(function (d) {
        var merkez = d === null;
        var ad = merkez ? T.her_yon : yonAdlari[Math.round(d / 45) % 8];
        html += '<label class="yon-hucre' + (merkez ? ' merkez' : '') + '"><input type="radio" name="yon" value="' + (merkez ? 'hepsi' : d) + '"' + (!merkez && d === 0 ? ' checked' : '') + '>' +
          '<span aria-hidden="true">' + (merkez ? '✦' : ok[i]) + '</span><b>' + esc(merkez ? T.her_yon_kisa : T.yon_kisa[Math.round(d / 45) % 8]) + '</b><i class="gizli">' + esc(ad) + '</i></label>';
        i++;
      });
    });
    g.innerHTML = html;
    g.addEventListener('change', function (e) {
      if (e.target.name !== 'yon') return;
      if (e.target.value === 'hepsi') st.herYon = true; else { st.herYon = false; st.yon = +e.target.value; }
      yonOk();
      kadranMod();
      halkaGuncelle();
      if (st.S) halkaSigdir();
    });
  })();

  /* Pusula: seçili yönü gösteren ok en kısa yoldan döner (CSS geçişi, power3); "her yön"de yavaşça dönen noktalar. */
  var okAci = 0;
  function yonOk() {
    $('#tur-pusula').classList.toggle('her', st.herYon);
    if (st.herYon) return;
    var fark = ((st.yon - okAci) % 360 + 540) % 360 - 180;
    okAci += fark;
    $('#tur-ok').style.transform = 'rotate(' + okAci + 'deg)';
  }
  yonOk();

  var kaydirgac = $('#tur-km');
  function cetvelKur() {
    var adim = M.cetvelAdimi(st.sure, st.seviye);
    var sinir = M.adimSiniri(adim);
    var km = M.adimaOturt(st.km, adim);
    st.km = km;
    if (st.sure) {
      kaydirgac.min = Math.round(sinir.enAz / adim); kaydirgac.max = Math.round(sinir.enCok / adim); kaydirgac.step = 1;
      kaydirgac.value = Math.round(km / adim);
    } else {
      kaydirgac.min = sinir.enAz; kaydirgac.max = sinir.enCok; kaydirgac.step = 10; kaydirgac.value = km;
    }
    cetvelYazi();
  }
  function cetvelYazi() {
    var buyuk, kucuk;
    if (st.sure) { buyuk = sureYazi(M.sureSaniye(st.km, st.seviye)); kucuk = '≈ ' + mesafe(st.km); }
    else { buyuk = mesafe(st.km); kucuk = '≈ ' + sureYazi((st.km / M.ORTALAMA_KMSA[st.seviye]) * 3600); }
    $('#tur-km-buyuk').textContent = buyuk;
    $('#tur-km-kucuk').textContent = kucuk;
    kaydirgac.setAttribute('aria-valuetext', buyuk + ', ' + kucuk);
    var yuzde = ((kaydirgac.value - kaydirgac.min) / (kaydirgac.max - kaydirgac.min)) * 100;
    kaydirgac.style.setProperty('--dolu', yuzde + '%');
  }
  function kaydirgacDegeri() {
    var adim = M.cetvelAdimi(st.sure, st.seviye);
    st.km = st.sure ? M.adimaOturt(+kaydirgac.value * adim, adim) : +kaydirgac.value;
  }
  kaydirgac.addEventListener('input', function () { st.kmCanli = null; kaydirgacDegeri(); cetvelYazi(); halkaGuncelle(); });
  kaydirgac.addEventListener('change', function () { kaydirgacDegeri(); kaydet(); halkaSigdir(); });
  $$('input[name=birim]').forEach(function (r) {
    r.addEventListener('change', function () {
      var sure = r.value === 'sure';
      if (sure === st.sure) return;
      st.sure = sure;
      cetvelKur();
      halkaGuncelle();
    });
  });
  $$('input[name=olcu]').forEach(function (r) {
    r.checked = r.value === st.birim;
    r.addEventListener('change', function () { st.birim = r.value; kaydet(); cetvelYazi(); if (st.evre === 'sonuc') sonucCiz(false); if (yer.liste && yer.tur) yerCiz(yer.tur, yer.liste); gecitGuncelle(); if (st.kip === 'rotalar') { kesVurgula(); kesListele(true); } });
  });

  $$('input[name=seviye]').forEach(function (r) {
    r.checked = +r.value === st.seviye;
    r.addEventListener('change', function () {
      var yeni = +r.value;
      st.km = M.seviyeDegisinceKm(st.km, st.seviye, yeni, st.sure);
      st.seviye = yeni;
      cetvelKur(); halkaGuncelle(); kaydet();
    });
  });
  $$('input[name=kacin]').forEach(function (c) {
    c.checked = !!st.kacin[c.value];
    c.addEventListener('change', function () { st.kacin[c.value] = c.checked; kaydet(); });
  });
  $('#tur-gecit').addEventListener('change', function (e) { st.gecit = e.target.checked; });
  cetvelKur();

  /* ---------------------------------------------------------------- üret */
  /* Bekleme: başlangıçtan yayılan halkalar + seçilen yöne bakan (ya da her yönde dönen) pusula yayı, panelde üç gerçek aşama.
     Aşamalar adayların ilerleyişine bağlı (her aday: durakları çembere koy → gerçek yollarda rotala/yola oturt → viraj ve tekrarı ölç);
     tüm adaylar gelince "en iyi üç seçiliyor". */
  var bekleme = null;
  function beklemeBaslat() {
    beklemeBitir(true);
    if (kadran) return;                       // arama radarı kadranın içinde (m/tur/kadran.js)
    if (!hazir || !st.S) return;
    var el = document.createElement('div');
    el.className = 'tur-bekleme ' + (st.herYon ? 'her' : 'yonlu');
    el.style.setProperty('--a', st.yon + 'deg');
    el.innerHTML = '<span class="hl h1"></span><span class="hl h2"></span><span class="hl h3"></span>' +
      '<svg class="pusula" viewBox="-50 -50 100 100" aria-hidden="true"><circle class="iz" r="30"/>' +
      '<g class="don"><path class="yay" d="M0 -30 A30 30 0 0 1 26 -15"/></g>' +
      '<g class="ibre"><g class="sal"><path d="M0 -44 L6 -31 L0 -35 L-6 -31 Z"/></g></g></svg>';
    bekleme = new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat([st.S.longitude, st.S.latitude]).addTo(harita);
    if (!reduce) requestAnimationFrame(function () { el.classList.add('goster'); }); else el.classList.add('goster');
  }
  function beklemeBitir(hemen) {
    if (!bekleme) return;
    var m = bekleme; bekleme = null;
    if (hemen || reduce) { m.remove(); return; }
    m.getElement().classList.add('git');
    setTimeout(function () { m.remove(); }, 380);
  }
  var asamaNo = -1;
  function asamaYaz(i) {
    if (i === asamaNo) return;
    asamaNo = i;
    $$('#tur-asamalar li').forEach(function (li, k) {
      li.classList.toggle('bitti', k < i);
      li.classList.toggle('aktif', k === i);
    });
    $('#tur-asama-yazi').textContent = T['asama_' + (i + 1)];
  }
  function ilerlemeCiz(b, t) {
    var p = $('#tur-ilerleme');
    var oran = t ? b / t : 0;
    p.setAttribute('aria-valuenow', Math.round(oran * 100));
    p.firstElementChild.style.transform = 'scaleX(' + Math.max(0.06, oran) + ')';
    asamaYaz(oran >= 1 ? 3 : oran >= 0.55 ? 2 : oran >= 0.2 ? 1 : 0);
    $('#tur-ilerleme-yazi').textContent = doldur(T.araniyor_adim, { b: b, t: t });
  }
  function evre(e) {
    st.evre = e;
    kok.dataset.evre = e;
    var sonucVar = st.sonuc.length > 0;
    $('#tur-form').hidden = e === 'sonuc' || (e === 'araniyor' && sonucVar);
    $('#tur-sonuc-kutu').hidden = !(e === 'sonuc' || (e === 'araniyor' && sonucVar));
    $('#tur-ilerleme-kutu').hidden = e !== 'araniyor';
    if (e !== 'araniyor') beklemeBitir(false);
    $('#tur-uret').disabled = e === 'araniyor';
    $('#tur-baska').disabled = e === 'araniyor' || st.sonuc.length >= SONUC_TAVANI;
    $('#tur-baska').hidden = st.sonuc.some(function (x) { return x.efsane; }); // efsane rotanın "başka bir tane"si yok
    $('#tur-kip-rotalar').disabled = e === 'araniyor';
    $('#tur-ipucu').hidden = !!st.S || e === 'sonuc' || st.kip === 'rotalar';
    arayuzGuncelle();
  }
  function vazgec() {
    st.calisma++;
    durum('');
    aday.temizle(true);
    if (st.sonuc.length) sonucCiz(false); else evre('ayar');
  }
  $('#tur-vazgec').addEventListener('click', vazgec);

  $('#tur-form').addEventListener('submit', function (e) {
    e.preventDefault();
    if (st.evre === 'araniyor') return;
    if (!st.S) { durum(T.baslangic_sec, 'hata'); $('#tur-ara-girdi').focus(); return; }
    uret(false);
  });

  /* Adaylar haritaya geldikçe başlangıçtan dönüşe doğru ÇİZİLİR (line-gradient + line-progress, 1,1 sn); seçim bitince sönerler. */
  var aday = {
    kimlikler: [], iptaller: [], sayi: 0,
    ekle: function (tur) {
      if (!hazir) return;
      var id = 'aday' + (this.sayi++), self = this;
      var renk = '#C0522D';
      harita.addSource(id, { type: 'geojson', lineMetrics: true, data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: tur.coordinates.map(function (c) { return [c.longitude, c.latitude]; }) } } });
      harita.addLayer({ id: id, type: 'line', source: id, layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-gradient': gradyan(0, renk), 'line-width': 3.2, 'line-opacity': 0.75, 'line-opacity-transition': GEC } }, 'rota-kenar');
      this.kimlikler.push(id);
      this.iptaller.push(anim(1100, function (t) { if (harita.getLayer(id)) harita.setPaintProperty(id, 'line-gradient', gradyan(EASE3(t), renk)); }));
      if (this.kimlikler.length === 1 && st.S && !reduce) { // ilk aday gelince kamera turun sınırlarına yumuşakça oturur
        var b = new maplibregl.LngLatBounds();
        tur.coordinates.forEach(function (c) { b.extend([c.longitude, c.latitude]); });
        harita.fitBounds(b, kamera({ padding: 40, maxZoom: 12, duration: 1000 }));
      }
    },
    /* hizli: hemen sil; değilse 450 ms sönüp silinir */
    temizle: function (hizli) {
      var ids = this.kimlikler; this.kimlikler = [];
      this.iptaller.forEach(function (i) { i(); }); this.iptaller = [];
      if (!hazir) return;
      var sil = function () { ids.forEach(function (id) { if (harita.getLayer(id)) harita.removeLayer(id); if (harita.getSource(id)) harita.removeSource(id); }); };
      if (hizli || reduce) { sil(); halkaGuncelle(); return; }
      ids.forEach(function (id) { if (harita.getLayer(id)) harita.setPaintProperty(id, 'line-opacity', 0); });
      setTimeout(sil, 520);
    }
  };

  function hataSebebi(h) {
    var sy = M.sayac;
    if (sy.son429 === 'gunluk-tavan') return T.hata_tavan;
    if (sy.sonHataDurum === 429 || sy.sonHataDurum >= 500 || sy.son429) return T.hata_mesgul;
    if (sy.ag || (h && /Failed to fetch|NetworkError|Load failed|aborted/i.test(String(h && h.message || h)))) return T.hata_ag;
    return null;
  }

  function uret(devam) {
    olay('tur:iptal');
    var no = ++st.calisma;
    var gecerli = function () { return no === st.calisma; };
    var onceki = devam ? st.sonuc.map(function (x) { return x.coordinates; }) : [];
    st.varyasyon = devam ? st.varyasyon + 1 : 0;
    if (!devam) { st.sonuc = []; st.adlar = new Map(); st.secili = 0; }
    M.sayaciSifirla();
    aday.temizle(true);
    soldur(devam ? 0.2 : 0);
    st.eskiSayi = st.sonuc.length;
    evre('araniyor');
    durum('');
    asamaNo = -1;
    ilerlemeCiz(0, 6);
    halkaGuncelle();
    beklemeBaslat();
    var kacin = st.kacin;
    var girdi = {
      baslangic: st.S, yon: st.herYon ? null : st.yon, hedefKm: M.uretimKm(st.km, st.sure, st.seviye), seviye: st.seviye,
      varyasyon: st.varyasyon, onceki: onceki, ay: new Date().getMonth() + 1
    };
    if (st.sure) girdi.hedefSureSn = M.uretimSureSn(st.km, true, st.seviye);
    if (M.kacinVarMi(kacin)) girdi.kacin = { otoyol: kacin.otoyol, gise: kacin.gise, toprak: kacin.toprak };
    M.turUret(girdi, {
      ilerleme: function (b, t) { if (gecerli()) ilerlemeCiz(b, t); },
      iptal: function () { return !gecerli(); },
      aday: function (tur) { if (gecerli()) aday.ekle(tur); }
    }).then(function (turlar) {
      if (!gecerli()) return;
      /* Sayfada yalnız gösterim için gereken kalsın: manevra adımları ve bacaklar atılıyor (ham rota cevabı hiçbir yerde tutulmuyor). */
      turlar.forEach(function (x) { x.rota = { totalDistanceMeters: x.rota.totalDistanceMeters, totalDurationSeconds: x.rota.totalDurationSeconds, icerik: x.rota.icerik }; });
      if (st.gecit) { // "Dağ geçidinden geçsin": yalnız geçitten geçenler
        var g = turlar.filter(function (x) { return x.gecitler.length > 0; });
        if (!g.length && turlar.length) { turlar = []; st.gecitYok = true; }
        else { turlar = g; st.gecitYok = false; }
      }
      if (!turlar.length) {
        var sebep = hataSebebi(null);
        if (st.sonuc.length) { sonucCiz(true); durum(sebep || T.baska_yok, 'bilgi'); return; }
        evre('ayar');
        aday.temizle(true);
        durum(sebep || (st.gecit && st.gecitYok ? T.gecit_yok : T.bos), 'hata');
        return;
      }
      st.sonuc = st.sonuc.concat(turlar).slice(0, SONUC_TAVANI);
      st.secili = Math.min(st.sonuc.length - 1, st.sonuc.length - turlar.length);
      sonucCiz(true);
    }).catch(function (h) {
      if (window.console) console.warn('tur:', h && h.stack ? h.stack : h);
      if (!gecerli()) return;
      aday.temizle(true);
      if (st.sonuc.length) { sonucCiz(true); durum(hataSebebi(h) || T.hata_genel, 'hata'); return; }
      evre('ayar');
      durum(hataSebebi(h) || T.hata_genel, 'hata');
    });
  }

  function ayaraDon(sessiz) {
    olay('tur:iptal');
    st.calisma++;
    st.sonuc = []; st.adlar = new Map(); st.secili = 0; st.varyasyon = 0; st.eskiSayi = 0;
    aday.temizle(false);
    soldur(0);
    setTimeout(function () { if (hazir && !st.sonuc.length) { harita.getSource('rotalar').setData(bos); harita.getSource('secili').setData(bos); harita.getSource('bas').setData(bos); } isaretleriTemizle(false); }, reduce ? 0 : 480);
    if (secilCiz) { secilCiz(); secilCiz = null; }
    evre('ayar');
    paylasKapat();
    halkaGuncelle();
    if (!sessiz) { halkaSigdir(); $('#tur-form').scrollIntoView({ block: 'nearest' }); }
  }
  $('#tur-ayara-don').addEventListener('click', function () { ayaraDon(false); });
  $('#tur-baska').addEventListener('click', function () { if (st.sonuc.length < SONUC_TAVANI) uret(true); });

  /* ---------------------------------------------------------------- sonuç */
  function virajCubuk(sert) { return sert >= 2.8 ? 5 : sert >= 2.2 ? 4 : sert >= 1.6 ? 3 : sert >= 1.0 ? 2 : 1; }
  function yonAdiOf(d) { return yonAdlari[M.enYakinYon(d).i]; }
  function baslikOf(i) {
    var a = st.adlar.get(st.sonuc[i]);
    if (!a) return T.adlar_yukleniyor;
    return a.map(function (x, k) { return x || (k === 0 || k === a.length - 1 ? T.baslangic : doldur(T.durak, { n: k })); }).join(' → ');
  }
  function notlarOf(tur) {
    var n = [], ic = tur.rota.icerik || {};
    if (ic.feribotSayisi) n.push(T.not_feribot);
    if (ic.asfaltsizM >= 500) n.push(doldur(T.not_toprak, { v: kisaMesafe(ic.asfaltsizM) }));
    if (ic.parali) n.push(T.not_gise);
    if (tur.kacin && tur.kacin.otoyol && (tur.otoyolM || 0) >= M.OTOYOL_ESIK_M) n.push(doldur(T.not_otoyol, { v: mesafe(tur.otoyolM / 1000) }));
    return n;
  }
  function sonucCiz(yeni) {
    evre('sonuc');
    var liste = $('#tur-kartlar');
    liste.innerHTML = st.sonuc.map(function (tur, i) {
      var sert = tur.olcu.sertKm, cubuk = virajCubuk(sert);
      var g0 = tur.hedefGecit || tur.gecitler[0];
      var gecit = g0 ? g0.ad + ' · ' + yukseklik(g0.rakimM) + (tur.gecitler.length > 1 ? ' +' + (tur.gecitler.length - 1) : '') : '';
      var notlar = notlarOf(tur);
      if (tur.olcu.ortusme > M.ORTUSME_UYARI) notlar.push(T.not_ortusme);
      if (tur.kacinIhlali) notlar.push(T.not_kacin);
      var bars = [1, 2, 3, 4, 5].map(function (n) { return '<i class="' + (n <= cubuk ? 'dolu' : '') + '" style="height:' + (6 + n * 2.6) + 'px;--k:' + n + '"></i>'; }).join('');
      var km = tur.rota.totalDistanceMeters / 1000, sn = tur.rota.totalDurationSeconds;
      var yeniKart = yeni && i >= (st.eskiSayi || 0);
      var efsaneChip = tur.efsane ? '<span class="chip efsane"><svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true"><path d="M8 1l2.1 4.6 5 .5-3.8 3.4 1.1 4.9L8 11.9 3.6 14.4l1.1-4.9L.9 6.1l5-.5z" fill="currentColor"/></svg>' + esc(T.rot_efsane) + '</span>' : '';
      var say = function (tur_, v, son) { return yeniKart ? '<span class="say" data-say="' + tur_ + '" data-to="' + v + '" aria-hidden="true">' + esc(son) + '</span><span class="gizli">' + esc(son) + '</span>' : esc(son); };
      return '<li class="' + (yeniKart ? 'yeni' : '') + '" style="--i:' + Math.max(0, i - (st.eskiSayi || 0)) + '"><button type="button" class="tur-kart" role="radio" data-i="' + i + '" aria-checked="' + (i === st.secili) + '">' +
        '<span class="no">' + (i + 1) + '</span>' +
        '<span class="baslik" id="tur-baslik-' + i + '">' + esc(tur.efsane ? tur.efsane.ad : baslikOf(i)) + '</span>' +
        '<span class="olcu"><b>' + say('km', km, mesafe(km)) + '</b><span>' + say('sure', sn, sureYazi(sn)) + '</span>' +
        '<span class="viraj"><span class="cubuklar" aria-hidden="true">' + bars + '</span><span>' + esc(T.sert_viraj_on) + ' ' + say('sert', sert, f1(sert)) + ' ' + esc(T.sert_viraj_son) + '</span></span></span>' +
        efsaneChip +
        (gecit ? '<span class="chip gecit">' + gecitSvg(15) + esc(gecit) + '</span>' : '') +
        notlar.map(function (x) { return '<span class="chip">' + esc(x) + '</span>'; }).join('') +
        '</button></li>';
    }).join('');
    $$('.tur-kart', liste).forEach(function (b) {
      b.addEventListener('click', function () { sec(+b.dataset.i, true); });
      b.addEventListener('keydown', function (e) {
        var ks = $$('.tur-kart', liste), i = ks.indexOf(b), h = null;
        if (e.key === 'ArrowDown' || e.key === 'ArrowRight') h = ks[Math.min(ks.length - 1, i + 1)];
        if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') h = ks[Math.max(0, i - 1)];
        if (h) { e.preventDefault(); h.focus(); sec(+h.dataset.i, true); }
      });
    });
    sec(st.secili, false, true);
    adlariSirayla();
    haritaSonuc(yeni ? 'yeni' : 'ayni');
    if (yeni) $$('.tur-kart .say', liste).forEach(function (el, k) { sayiAnim(el, 250 + Math.floor(k / 3) * 140 + (k % 3) * 60); });
    var d = st.sonuc[0] && st.sonuc[0].efsane ? T.rot_efsane : doldur(st.sonuc.length > 1 ? T.sonuc_n : T.sonuc_1, { n: st.sonuc.length });
    $('#tur-sonuc-baslik').textContent = d;
    if (yeni && !reduce) { try { $('#tur-sonuc-kutu').scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (e) { /* eski tarayıcı */ } }
    olay('tur:sonuc', { yeni: !!yeni });
  }
  /* Eski çizgiler solar (başka tur denince, ayarlara dönünce); MapLibre'nin boya geçişi (450 ms). */
  function soldur(oran) {
    if (!hazir) return;
    ['rota-soluk', 'rota-kenar', 'rota-secili'].forEach(function (k) { harita.setPaintProperty(k, 'line-opacity', k === 'rota-soluk' ? Math.min(oran, 0.62) : oran); });
  }
  function kumulatif(coords) {
    var cum = [0], kx = 111.32 * Math.cos(coords[0].latitude * Math.PI / 180);
    for (var i = 1; i < coords.length; i++) {
      var dx = (coords[i].longitude - coords[i - 1].longitude) * kx, dy = (coords[i].latitude - coords[i - 1].latitude) * 110.574;
      cum.push(cum[i - 1] + Math.sqrt(dx * dx + dy * dy));
    }
    return cum;
  }
  function enYakinIndeks(coords, lat, lon) {
    var en = 0, ed = Infinity;
    for (var i = 0; i < coords.length; i++) {
      var dx = coords[i].longitude - lon, dy = coords[i].latitude - lat, d = dx * dx + dy * dy;
      if (d < ed) { ed = d; en = i; }
    }
    return en;
  }
  var secilCiz = null, isaretler = [], isaretZamanlari = [];
  function isaretleriTemizle(hemen) {
    isaretZamanlari.forEach(clearTimeout); isaretZamanlari = [];
    var eski = isaretler; isaretler = [];
    eski.forEach(function (m) {
      if (hemen || reduce) { m.remove(); return; }
      m.getElement().classList.add('git');
      setTimeout(function () { m.remove(); }, 260);
    });
  }
  function isaretYap(sinif, html, c, anchor, gecikme, kutu) {
    kutu = kutu || { liste: isaretler, zamanlar: isaretZamanlari };
    var el = document.createElement('div');
    el.className = 'tur-nokta ' + sinif;
    el.innerHTML = '<span class="ic">' + html + '</span>';
    kutu.liste.push(new maplibregl.Marker({ element: el, anchor: anchor }).setLngLat(c).addTo(harita));
    if (reduce || !(gecikme > 0)) el.classList.add('goster');
    else kutu.zamanlar.push(setTimeout(function () { el.classList.add('goster'); }, gecikme));
  }
  /* Seçili turun çizgisi başlangıçtan dönüşe doğru akar; duraklar ve geçitler çizgi oraya ulaşınca tek tek belirir. */
  function cizSecili(sure) {
    var tur = st.sonuc[st.secili];
    if (!hazir || !tur) return;
    if (secilCiz) secilCiz();
    isaretleriTemizle(false);
    var ham = tur.coordinates;
    harita.getSource('secili').setData({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: ham.map(function (c) { return [c.longitude, c.latitude]; }) } });
    soldurAc();
    var cum = kumulatif(ham), top = cum[cum.length - 1] || 1;
    var zaman = function (f) { return sure * (1 - Math.pow(1 - Math.min(1, f), 1 / 3)); }; // EASE3'ün tersi
    tur.duraklar.slice(0, tur.efsane ? undefined : -1).forEach(function (c, k) {
      if (k === 0 && !tur.efsane) return;
      var f = cum[enYakinIndeks(ham, c.latitude, c.longitude)] / top;
      isaretYap('durak', '<b>' + (tur.efsane ? k + 1 : k) + '</b>', [c.longitude, c.latitude], 'center', zaman(f));
    });
    tur.gecitler.forEach(function (g) {
      var f = cum[enYakinIndeks(ham, g.lat, g.lon)] / top;
      isaretYap('gecit', gecitIkonHtml(g.ad, 22) + '<b>' + esc(g.ad) + '</b>', [g.lon, g.lat], 'bottom', zaman(f) + 80);
    });
    var bas = function (p) {
      var hedef = p * top, lo = 0, hi = cum.length - 1;
      while (lo < hi) { var mid = (lo + hi) >> 1; if (cum[mid] < hedef) lo = mid + 1; else hi = mid; }
      var c = ham[lo];
      harita.getSource('bas').setData({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [c.longitude, c.latitude] } });
    };
    secilCiz = anim(sure, function (t) {
      var p = EASE3(t);
      harita.setPaintProperty('rota-secili', 'line-gradient', gradyan(p, '#0E6E73'));
      harita.setPaintProperty('rota-kenar', 'line-gradient', gradyan(p, '#FFFFFF'));
      if (!reduce && p < 1) bas(p); else harita.getSource('bas').setData(bos);
    }, function () { harita.getSource('bas').setData(bos); });
  }
  function soldurAc() {
    ['rota-kenar', 'rota-secili'].forEach(function (k) { harita.setPaintProperty(k, 'line-opacity', 1); });
    harita.setPaintProperty('rota-soluk', 'line-opacity', 0.62);
  }
  /* kip: 'yeni' = aday çizgileri söner, kamera tüm sonuçlara oturur, seçili tur çizilir; 'ayni' = yalnız yeniden çizim; 'sec' = kart değişti. */
  function haritaSonuc(kip) {
    if (!hazir) return;
    var sec_ = st.sonuc[st.secili];
    var f = st.sonuc.map(function (tur, i) {
      return i === st.secili ? null : { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: tur.coordinates.map(function (c) { return [c.longitude, c.latitude]; }) } };
    }).filter(Boolean);
    harita.getSource('rotalar').setData({ type: 'FeatureCollection', features: f });
    halkaGuncelle();
    if (kip === 'yeni') {
      aday.temizle(false);
      beklemeBitir(false);
      var b = new maplibregl.LngLatBounds();
      st.sonuc.forEach(function (t) { t.coordinates.forEach(function (c) { b.extend([c.longitude, c.latitude]); }); });
      harita.fitBounds(b, kamera({ padding: { top: 40, bottom: 40, left: 40, right: 40 }, maxZoom: 13, duration: 1100 }));
      cizSecili(1500);
    } else if (kip === 'sec') {
      cizSecili(800);
    } else {
      cizSecili(0);
    }
    void sec_;
  }
  function sec(i, odak, ilk) {
    var degisti = i !== st.secili;
    if (degisti) olay('tur:iptal');
    st.secili = i;
    $$('#tur-kartlar .tur-kart').forEach(function (b, k) { b.setAttribute('aria-checked', k === i); b.tabIndex = k === i ? 0 : -1; });
    if (!ilk && degisti) haritaSonuc('sec');
    if (odak && hazir) {
      var b = new maplibregl.LngLatBounds();
      st.sonuc[i].coordinates.forEach(function (c) { b.extend([c.longitude, c.latitude]); });
      harita.fitBounds(b, kamera({ padding: 50, maxZoom: 13, duration: 700 }));
    }
    paylasKapat();
    adlariYukle(i);
    yerSifirla();
  }
  /* Öteki turların yer adları da sırayla (seçili önce; Photon'a aynı anda tek istek) gelsin: kartta sonsuza dek "yükleniyor" yazmasın. */
  var adSirasi = Promise.resolve();
  function adlariSirayla() {
    var sira = st.sonuc.map(function (_, i) { return i; }).sort(function (a, b) { return (a === st.secili ? -1 : a) - (b === st.secili ? -1 : b); });
    var no = st.calisma;
    sira.forEach(function (i) {
      adSirasi = adSirasi.then(function () { return no === st.calisma ? adlariYukle(i) : null; }).catch(function () { return null; });
    });
  }
  function adlariYukle(i) {
    var tur = st.sonuc[i];
    if (!tur || st.adlar.has(tur) || st.adYukleniyor === tur) return Promise.resolve();
    st.adYukleniyor = tur;
    return M.turDurakAdlari(tur).catch(function () { return null; }).then(function (a) {
      if (st.adYukleniyor === tur) st.adYukleniyor = null;
      st.adlar.set(tur, a || []);
      var el = document.getElementById('tur-baslik-' + st.sonuc.indexOf(tur));
      if (el) el.textContent = baslikOf(st.sonuc.indexOf(tur));
    });
  }

  /* ---------------------------------------------------------------- telefona aktar */
  var paylasKutu = $('#tur-paylas');
  function paylasKapat() { paylasKutu.hidden = true; $('#tur-telefon').setAttribute('aria-expanded', 'false'); }
  function magazaLink() { return A.magaza.ios; }
  /* QR modülleri köşegen dalgayla (en çok ~0,5 sn) belirir; her modül ayrı <rect>, yalnız opacity animasyonu. */
  function qrSvg(url) {
    var q = qrcode(0, 'M'); q.addData(url); q.make();
    var n = q.getModuleCount(), r = '';
    for (var i = 0; i < n; i++) for (var j = 0; j < n; j++) if (q.isDark(i, j)) r += '<rect x="' + j + '" y="' + i + '" width="1.04" height="1.04" style="--d:' + (i + j) * 6 + '"/>';
    return '<svg viewBox="-1 -1 ' + (n + 2) + ' ' + (n + 2) + '" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges" aria-hidden="true">' + r + '</svg>';
  }
  function kopyala(metin) {
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(metin);
    return new Promise(function (ok, no) {
      var t = document.createElement('textarea'); t.value = metin; t.style.position = 'fixed'; t.style.opacity = '0';
      document.body.appendChild(t); t.select();
      try { document.execCommand('copy') ? ok() : no(); } catch (e) { no(e); } document.body.removeChild(t);
    });
  }
  $('#tur-telefon').addEventListener('click', function () {
    var tur = st.sonuc[st.secili];
    if (!tur) return;
    var btn = $('#tur-telefon');
    if (!paylasKutu.hidden) { paylasKapat(); return; }
    var onceki = st.paylasim.get(tur);
    if (onceki) { paylasCiz(onceki); return; }
    btn.disabled = true; btn.classList.add('bekle');
    var yazi = btn.querySelector('span'); var eskiYazi = yazi.textContent; yazi.textContent = T.hazirlaniyor;
    // yer adları gelsin (en çok 7 sn), sonra turu uygulamanın biçiminde kurup paylaş
    Promise.race([adlariYukle(st.sonuc.indexOf(tur)), new Promise(function (r) { setTimeout(r, 7000); })]).then(function () {
      var a = (st.adlar.get(tur) || []).slice();
      var son = tur.duraklar.length - 1;
      var adlar = tur.duraklar.map(function (_, k) { return a[k] || (k === 0 ? T.baslangic : k === son ? T.bitis : doldur(T.durak, { n: k })); });
      var yon = yonAdiOf(tur.yon);
      var ad = tur.efsane ? tur.efsane.ad : a[0] ? doldur(T.tur_ad, { v0: a[0], v1: yon }) : doldur(T.tur_ad_yedek, { n: 1 });
      return M.turPaylas(M.turKaydi(tur, adlar, st.seviye, ad, tur.efsane ? { mod: tur.efsane.mod, presetId: tur.efsane.id } : undefined));
    }).then(function (s) {
      btn.disabled = false; btn.classList.remove('bekle'); yazi.textContent = eskiYazi;
      if (!s.ok) { durum(s.hata === 'gunluk' ? T.paylas_tavan : s.hata === 'buyuk' ? T.paylas_buyuk : T.paylas_hata, 'hata'); return; }
      st.paylasim.set(tur, s); paylasCiz(s);
    });
  });
  function paylasCiz(s) {
    var kodMetin = s.kod.slice(0, 4) + ' ' + s.kod.slice(4);
    var link = A.kok + '/k/' + s.kod;
    var derin = 'motoseyir://tur/' + s.kod;
    var oynat = '';
    if (mobil) {
      var acik = android ? 'intent://tur/' + s.kod + '#Intent;scheme=motoseyir;package=com.batuhanengin.motorota;end' : derin;
      oynat = '<a class="btn btn-primary" id="tur-uygulamada" href="' + acik + '">' + esc(T.uygulamada_ac) + '</a>';
    }
    var magaza = '';
    if (ios || !mobil) magaza += '<a class="btn btn-ghost" href="' + A.magaza.ios + '" rel="noopener">' + esc(T.magaza_ios) + '</a>';
    if (A.magaza.play) magaza += '<a class="btn btn-ghost" href="' + A.magaza.play + '" rel="noopener">' + esc(T.magaza_play) + '</a>';
    paylasKutu.innerHTML =
      '<div class="tur-paylas-ic">' +
      (mobil ? '' : '<div class="qr" role="img" aria-label="' + esc(T.qr_etiket) + '">' + qrSvg(link) + '</div>') +
      '<div class="tur-paylas-metin"><h3>' + esc(mobil ? T.telefon_baslik_mobil : T.telefon_baslik) + '</h3>' +
      '<p>' + esc(mobil ? T.telefon_acikla_mobil : T.telefon_acikla) + '</p>' +
      '<p class="kod-satir"><span class="kod" aria-label="' + esc(T.kod_etiket) + ' ' + s.kod.split('').join(' ') + '">' + kodMetin + '</span></p>' +
      '<div class="tur-paylas-dugmeler">' + oynat +
      '<button type="button" class="btn btn-ghost" id="tur-kopyala">' + esc(T.baglanti_kopyala) + '</button>' + '</div>' +
      '<p class="kucuk" id="tur-uygulama-yok" ' + (mobil ? '' : 'hidden') + '>' + esc(android && !A.magaza.play ? T.android_not : T.uygulama_yok) + '</p>' +
      '<div class="tur-paylas-dugmeler">' + (android && !A.magaza.play ? '' : magaza) + '</div>' +
      '<p class="kucuk">' + esc(doldur(T.kod_gecerlilik, { gun: s.gun })) + '</p></div></div>';
    paylasKutu.hidden = false;
    $('#tur-telefon').setAttribute('aria-expanded', 'true');
    var kp = $('#tur-kopyala');
    kp.addEventListener('click', function () {
      kopyala(link).then(function () { kp.textContent = T.kopyalandi; }, function () { kp.textContent = link; });
      setTimeout(function () { kp.textContent = T.baglanti_kopyala; }, 2400);
    });
    var ac = $('#tur-uygulamada');
    if (ac) ac.addEventListener('click', function () {
      setTimeout(function () { if (document.visibilityState === 'visible') { var n = $('#tur-uygulama-yok'); n.hidden = false; n.classList.add('vurgu'); } }, 1700);
    });
    if (!reduce) paylasKutu.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }


  /* ================================================================ YOL ÜSTÜNDE (Keşfet 1)
     Haritanın üstünde, rota boyunca: kategori çipleri (Benzin, Kahve, Yemek, Manzara, Kamp, Koy/Plaj) + yol üstünde ara. Sonuçlar rota boyunca
     kategori simgeli harita işaretleri ve haritanın altında yatay kart şeridi (ad, rotada kaçıncı km, rotaya sapma). Kendi yer veritabanımız
     (OSM + Foursquare Open Source Places + Overture), vekilin yalnız koridor ucu. Kategori başına en çok beş yer (Pro'da tamamı); yıldız ve
     yorum YOK (kaynak vermiyor). Karta dokununca harita oraya uçar; "Durak olarak ekle" turu yeniden rotalar (mevcut davranış). */
  var SEKME = { benzin: 'benzin', kahve: 'kafe', yemek: 'restoran', manzara: 'manzara', kamp: 'kamp', koy: 'koy' };
  var KAT_SIRA = ['benzin', 'kahve', 'yemek', 'manzara', 'kamp', 'koy'];
  var yer = { no: 0, onbellek: new WeakMap(), isaretler: [], secili: null, kat: '', metin: '', liste: [], tur: null, vurguZaman: 0 };
  function yerIsaretleriTemizle() {
    yer.isaretler.forEach(function (m) { m.remove(); });
    yer.isaretler = [];
  }
  function chipIkon(kat) {
    var sv = $('#tur-yer-chipler input[value=' + kat + '] + span svg');
    return sv ? sv.outerHTML : '';
  }
  function yerSifirla() {
    yer.no++;
    yerIsaretleriTemizle();
    yer.liste = []; yer.secili = null;
    $('#tur-yer-liste').innerHTML = '';
    $('#tur-yer-durum').textContent = '';
    if (yer.kat || yer.metin) yerYukle();
  }
  function yerSec5(liste, tur) {
    var sirali = liste.slice().sort(function (a, b) { return b.puan - a.puan; });
    var secilen = [], adlar = {}, ham = tur.coordinates;
    var cum = kumulatif(ham);
    sirali.forEach(function (y) {
      if (secilen.length >= 5 || !y.ad || adlar[y.ad.toLowerCase()]) return;
      y._m = cum[enYakinIndeks(ham, y.lat, y.lon)] * 1000; // rota üstündeki konum (m)
      if (secilen.some(function (z) { return Math.abs(z._m - y._m) < 2500 && Math.hypot(z.lat - y.lat, z.lon - y.lon) < 0.03; })) return;
      adlar[y.ad.toLowerCase()] = 1;
      secilen.push(y);
    });
    return secilen.sort(function (a, b) { return a._m - b._m; });
  }
  function katAdi(kat) { return T['yer_' + kat] || ''; }
  function sade(x) { return String(x || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ı/g, 'i').replace(/ß/g, 'ss'); }
  /* Bir kategorinin ham listesi (turun koridoru): turun önbelleğinde tutulur */
  function yerHam(tur, kat) {
    var onb = yer.onbellek.get(tur) || {}; yer.onbellek.set(tur, onb);
    if (onb[kat]) return Promise.resolve(onb[kat]);
    return M.yerlerKoridor(tur.coordinates, SEKME[kat], 2500).then(function (r) {
      if (!r) return null;
      onb[kat] = r.yerler.map(function (y) { y._kat = kat; return y; });
      return onb[kat];
    });
  }
  function yerYukle() {
    var tur = st.sonuc[st.secili];
    if (!tur) return;
    var no = ++yer.no;
    yerIsaretleriTemizle(); yer.secili = null;
    $('#tur-yer-liste').innerHTML = '';
    var durumEl = $('#tur-yer-durum');
    if (!yer.kat && !yer.metin) { durumEl.textContent = ''; yerGorunum(); return; }
    var hata = function () { durumEl.textContent = M.sayac.son429 === 'gunluk-tavan' ? T.hata_tavan : T.yer_hata; };
    durumEl.textContent = T.yer_yukleniyor;
    if (yer.kat) {
      yerHam(tur, yer.kat).then(function (ham) {
        if (no !== yer.no) return;
        if (!ham) { hata(); return; }
        durumEl.textContent = '';
        yerCiz(tur, yerSec5(ham, tur));
      });
      return;
    }
    // serbest metin: altı kategorinin hamı sırayla (önbellekte olanlar tekrar istenmez), addan süzülür
    var q = sade(yer.metin), toplam = [], i = 0;
    (function sonraki() {
      if (no !== yer.no) return;
      if (i >= KAT_SIRA.length) {
        var bulunan = yerSec5(toplam.filter(function (y) { return sade(y.ad).indexOf(q) >= 0; }), tur);
        durumEl.textContent = bulunan.length ? doldur(T.yer_ara_sonuc, { n: bulunan.length, q: yer.metin }) : doldur(T.yer_ara_yok, { q: yer.metin });
        yerCiz(tur, bulunan);
        return;
      }
      yerHam(tur, KAT_SIRA[i++]).then(function (ham) { if (ham) toplam = toplam.concat(ham); sonraki(); });
    })();
  }
  function yerKm(m) { // rotada konum: "42. km" / "km 42" (birime göre mil)
    var v = st.birim === 'mi' ? Math.round(m / 1609.344) : Math.round(m / 1000);
    return doldur(st.birim === 'mi' ? T.yer_mil : T.yer_km, { v: v });
  }
  function yerCiz(tur, liste) {
    var ol = $('#tur-yer-liste'), ids = tur.eklenenYerler || {};
    yer.liste = liste; yer.tur = tur;
    if (!liste.length && !$('#tur-yer-durum').textContent) $('#tur-yer-durum').textContent = T.yer_yok;
    ol.innerHTML = liste.map(function (y, i) {
      var eklendi = !!ids[y.id], kat = y._kat || yer.kat || 'manzara';
      var uzak = y.sapmaM < 1000 ? (st.birim === 'mi' ? Math.round(y.sapmaM * 3.28084 / 10) * 10 + ' ft' : Math.round(y.sapmaM / 10) * 10 + ' m')
        : (st.birim === 'mi' ? (Math.round(y.sapmaM / 1609.344 * 10) / 10).toString().replace('.', A.ondalik || '.') + ' mi' : mesafe(y.sapmaM / 1000));
      return '<li style="--i:' + i + '"><div class="yer-kart2" role="button" tabindex="0" data-i="' + i + '" aria-label="' + esc(T.yer_haritada + ': ' + y.ad) + '">' +
        '<span class="ik" aria-hidden="true">' + chipIkon(kat) + '</span>' +
        '<span class="ad">' + esc(y.ad) + '</span>' +
        '<span class="alt"><b>' + esc(yerKm(y._m)) + '</b> · ' + esc(doldur(T.yer_uzak, { v: uzak })) + (y.yerlesim ? ' · ' + esc(y.yerlesim) : '') + '</span>' +
        '<button type="button" class="yer-kart2-ekle" data-i="' + i + '"' + (eklendi ? ' disabled' : '') + '>' + esc(eklendi ? T.yer_eklendi : T.yer_ekle) + '</button></div></li>';
    }).join('');
    yerIsaretleriTemizle();
    liste.forEach(function (y, i) {
      if (!hazir) return;
      var el = document.createElement('div');
      el.className = 'tur-yer-isaret';
      el.style.setProperty('--i', i);
      el.innerHTML = '<span class="ic">' + chipIkon(y._kat || yer.kat || 'manzara') + '</span>';
      el.addEventListener('click', function (e) { e.stopPropagation(); yerOdak(i, true); });
      yer.isaretler.push(new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat([y.lon, y.lat]).addTo(harita));
    });
    $$('.yer-kart2', ol).forEach(function (b) {
      b.addEventListener('click', function () { yerOdak(+b.dataset.i, false); });
      b.addEventListener('keydown', function (e) { if ((e.key === 'Enter' || e.key === ' ') && e.target === b) { e.preventDefault(); yerOdak(+b.dataset.i, false); } });
    });
    $$('.yer-kart2-ekle', ol).forEach(function (b) { b.addEventListener('click', function (e) { e.stopPropagation(); yerEkle(liste[+b.dataset.i], b, tur); }); });
    yerGorunum();
  }
  function yerGorunum() { padGuncelleGec(); }
  function yerOdak(i, kartiKaydir) {
    yer.secili = i;
    yer.isaretler.forEach(function (m, k) { m.getElement().classList.toggle('secili', k === i); });
    $$('.yer-kart2', $('#tur-yer-liste')).forEach(function (b, k) { b.classList.toggle('secili', k === i); });
    var y = yer.liste[i];
    if (kartiKaydir) { var kart = $('.yer-kart2[data-i="' + i + '"]'); if (kart && kart.scrollIntoView) { try { kart.scrollIntoView({ block: 'nearest', inline: 'center', behavior: reduce ? 'auto' : 'smooth' }); } catch (e) { /* eski */ } } }
    if (hazir && y) harita.easeTo(kamera({ center: [y.lon, y.lat], zoom: Math.max(harita.getZoom(), 12), duration: 800 }));
  }
  /* Önizleme sürüşü bir yerin yanından geçerken o yer kısa bir an vurgulanır (m/tur/surus.js) */
  function yerVurgu(i) {
    var m = yer.isaretler[i], kart = $('.yer-kart2[data-i="' + i + '"]');
    clearTimeout(yer.vurguZaman);
    yer.isaretler.forEach(function (x) { x.getElement().classList.remove('vurgu'); });
    $$('.yer-kart2', $('#tur-yer-liste')).forEach(function (b) { b.classList.remove('secili'); });
    if (m) m.getElement().classList.add('vurgu');
    if (kart) { kart.classList.add('secili'); try { kart.scrollIntoView({ block: 'nearest', inline: 'center', behavior: reduce ? 'auto' : 'smooth' }); } catch (e) { /* eski */ } }
    yer.vurguZaman = setTimeout(function () { if (m) m.getElement().classList.remove('vurgu'); if (kart) kart.classList.remove('secili'); }, 2400);
  }
  /* çipler: yeniden dokununca kapanır */
  (function () {
    var grup = $('#tur-yer-chipler'), onceki = '';
    $$('input[name=yer]').forEach(function (r) { r.checked = false; });
    grup.addEventListener('pointerdown', function (e) { var r = e.target.closest('label'); onceki = r && r.querySelector('input').checked ? r.querySelector('input').value : ''; });
    grup.addEventListener('click', function (e) {
      var r = e.target.closest('label'); if (!r) return;
      var inp = r.querySelector('input');
      if (e.detail === 0) { return; } // klavye: change olayı yeterli
      if (onceki && onceki === inp.value) { setTimeout(function () { inp.checked = false; yer.kat = ''; $('#tur-yer-ara-girdi').value = ''; yer.metin = ''; yerYukle(); }, 0); }
    });
    grup.addEventListener('change', function (e) {
      if (e.target.name !== 'yer') return;
      yer.kat = e.target.value; yer.metin = ''; $('#tur-yer-ara-girdi').value = '';
      yerYukle();
    });
    $('#tur-yer-ara').addEventListener('submit', function (e) {
      e.preventDefault();
      var q = $('#tur-yer-ara-girdi').value.trim();
      if (q.length < 2) { return; }
      $$('input[name=yer]').forEach(function (r) { r.checked = false; });
      yer.kat = ''; yer.metin = q; yerYukle();
    });
  })();
  var yerEkleniyor = false;
  function yerEkle(y, btn, tur) {
    if (yerEkleniyor || !y) return;
    yerEkleniyor = true;
    btn.disabled = true; btn.textContent = T.yer_ekleniyor;
    var ham = tur.coordinates, cum = kumulatif(ham);
    var konum = cum[enYakinIndeks(ham, y.lat, y.lon)];
    var idx = tur.duraklar.length - 1; // varsayılan: sondan önce (halkada son nokta = başlangıç)
    for (var k = 1; k < tur.duraklar.length; k++) {
      var p = cum[enYakinIndeks(ham, tur.duraklar[k].latitude, tur.duraklar[k].longitude)];
      if (p >= konum) { idx = k; break; }
    }
    var yeni = tur.duraklar.slice();
    yeni.splice(idx, 0, { latitude: y.lat, longitude: y.lon });
    M.rotaKur(yeni, st.seviye, tur.kacin, tur.efsane ? tur.efsane.mod : undefined, idx).then(function (r) {
      tur.duraklar = yeni; tur.coordinates = r.coordinates; tur.rota = r.rota; tur.olcu = r.olcu; tur.gecitler = r.gecitler;
      var a = st.adlar.get(tur); if (a) a.splice(idx, 0, y.ad);
      tur.eklenenYerler = tur.eklenenYerler || {}; tur.eklenenYerler[y.id] = 1;
      st.paylasim.delete(tur);
      yerEkleniyor = false;
      var sira = st.sonuc.indexOf(tur);
      st.eskiSayi = st.sonuc.length; // kartlar yeniden sayılmasın
      sonucCiz(false);
      if (sira === st.secili) haritaSonuc('sec');
      yerYukle();
      durum('');
    }).catch(function () {
      yerEkleniyor = false;
      btn.disabled = false; btn.textContent = T.yer_ekle;
      durum(T.yer_ekle_hata, 'hata');
    });
  }

  /* ================================================================ KEŞFET 2: bölgendeki rotalar
     Haritada efsane rotalar (Türkiye klasikleri, Avrupa ve ABD yolları: m/tur/kesfet.<dil>.json, uygulamanın kendi verisi)
     ve dağ geçitleri (motor.js içindeki data/gecitler). Topluluk rotaları yok. "Bu turu aç" gerçek rotayı hesaplar ve aynı
     telefona aktarma akışına bağlar. */
  st.kip = 'uret';
  var kesKutu = { liste: [], zamanlar: [] };
  var kes = { veri: null, yukleniyor: false, katman: false, kuruluyor: false, hov: '', secili: null, filtre: { r: true, g: true }, aktifSira: [], gecitHam: null, iptal: null, isaret: null };
  var KES_KATMANLAR = ['kes-rota-kenar0', 'kes-rota-cizgi', 'kes-rota-vur', 'kes-rota-ikon', 'kes-rota-hov-kenar', 'kes-rota-hov', 'kes-sec-kenar', 'kes-sec',
    'kes-gecit-ikon', 'kes-vurgu-halka', 'kes-vurgu-ikon'];
  var KES_ROTA_KAT = ['kes-rota-kenar0', 'kes-rota-cizgi', 'kes-rota-vur', 'kes-rota-ikon', 'kes-rota-hov-kenar', 'kes-rota-hov'];
  var KES_GECIT_KAT = ['kes-gecit-ikon', 'kes-vurgu-halka', 'kes-vurgu-ikon'];
  var ULKE_ISARETLER = ['rota-soluk', 'rota-kenar', 'rota-secili', 'bas-halka', 'bas-nokta'];

  function katmanGorunum(kimlikler, goster) {
    if (!hazir) return;
    kimlikler.forEach(function (k) { if (harita.getLayer(k)) harita.setLayoutProperty(k, 'visibility', goster ? 'visible' : 'none'); });
  }
  function turGorunum(goster) {
    katmanGorunum(ULKE_ISARETLER, goster);
    var d = goster ? '' : 'none';
    isaretler.forEach(function (m) { m.getElement().style.display = d; });
    yer.isaretler.forEach(function (m) { m.getElement().style.display = d; });
    pinGuncelle();
    if (goster) halkaGuncelle();
  }
  function kipSec(k, odak) {
    if (k === st.kip) return;
    olay('tur:iptal');
    st.kip = k;
    $$('.tur-kip-dugme').forEach(function (b) { var on = (b.id === 'tur-kip-' + k); b.setAttribute('aria-selected', on); b.tabIndex = on ? 0 : -1; });
    $('#tur-panel-uret').hidden = k !== 'uret';
    $('#tur-panel-rotalar').hidden = k !== 'rotalar';
    kok.dataset.kip = k;
    $('#tur-ipucu').hidden = k === 'rotalar' || !!st.S;
    durum('');
    if (k === 'rotalar') {
      turGorunum(false);
      if (!kes.veri) kesVeriYukle(); else { kesKatmanGoster(true); kesListele(); }
      if (hazir && !st.S && harita.getZoom() < 4.5) harita.easeTo(kamera({ zoom: 5, duration: 700 }));
      try { history.replaceState(null, '', '#kesfet'); } catch (e) { /* önemsiz */ }
    } else {
      kesKatmanGoster(false);
      kesIsaretiTemizle();
      turGorunum(true);
      try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* önemsiz */ }
    }
    arayuzGuncelle();
    if (odak) $('#tur-kip-' + k).focus();
  }
  $$('.tur-kip-dugme').forEach(function (b) {
    b.addEventListener('click', function () { kipSec(b.id === 'tur-kip-rotalar' ? 'rotalar' : 'uret'); });
    b.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); kipSec(st.kip === 'uret' ? 'rotalar' : 'uret', true); }
    });
  });

  function kesVeriYukle() {
    if (kes.yukleniyor) return;
    kes.yukleniyor = true;
    $('#tur-rot-sayi').textContent = T.rot_yukleniyor;
    fetch('/m/tur/kesfet.' + A.dil + '.json').then(function (r) { if (!r.ok) throw new Error('kesfet'); return r.json(); }).then(function (v) {
      kes.veri = v; kes.yukleniyor = false;
      if (st.kip === 'rotalar') { kesKatmanGoster(true); kesListele(); }
    }).catch(function () { kes.yukleniyor = false; $('#tur-rot-sayi').textContent = T.rot_hata; });
  }
  function kesKatmanGoster(goster) {
    if (!hazir || !kes.veri) return;
    if (!kes.katman) { kesKatmanKur(); return; }              // kurulum bitince kendisi gösterir
    katmanGorunum(KES_KATMANLAR, goster);
    if (goster) kesFiltreUygula();
  }
  /* Harita simgeleri tuvalde çizilir ve haritaya eklenir: genel geçit (açık/gri) + resimli yerler (krem rozet). 2x yoğunluk. */
  var ikon = { basladi: false, hazir: false, bekle: [] };
  function resimYukle(src) { return new Promise(function (ok) { var im = new Image(); im.onload = function () { ok(im); }; im.onerror = function () { ok(null); }; im.src = src; }); }
  function ikonVeri(boyut, f) {
    var c = document.createElement('canvas'); c.width = c.height = boyut; var g = c.getContext('2d');
    g.shadowColor = 'rgba(14,21,20,.35)'; g.shadowBlur = boyut * .06; g.shadowOffsetY = boyut * .025;
    f(g, boyut); return g.getImageData(0, 0, boyut, boyut);
  }
  function ikonlariHazirla(cb) {
    if (ikon.hazir) { cb(); return; }
    ikon.bekle.push(cb);
    if (ikon.basladi) return;
    ikon.basladi = true;
    var S = 112, ic = 14, is = [];
    ['genel', 'kapali'].forEach(function (ad) {
      is.push(resimYukle('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(gecitSvg(96, ad === 'kapali'))).then(function (im) {
        if (im) harita.addImage('gk-' + ad, ikonVeri(S, function (g) { g.drawImage(im, ic / 2 + 1, ic / 2 + 1, S - ic - 2, S - ic - 2); }), { pixelRatio: 2 });
      }));
    });
    RESIMLI.forEach(function (r) {
      is.push(resimYukle('/m/tur/yer/' + r[1] + '.webp').then(function (im) {
        if (!im) return;
        harita.addImage('gk-' + r[1], ikonVeri(S, function (g) {
          g.beginPath(); g.arc(S / 2, S / 2, S / 2 - ic / 2 - 1, 0, 2 * Math.PI); g.fillStyle = '#FCF7EA'; g.fill();
          g.shadowColor = 'transparent'; g.lineWidth = 5; g.strokeStyle = '#0E6E73'; g.stroke();
          var w = S * .66; g.drawImage(im, (S - w) / 2, (S - w) / 2 - 1, w, w);
        }), { pixelRatio: 2 });
      }));
    });
    Promise.all(is).then(function () { ikon.hazir = true; ikon.bekle.forEach(function (f) { f(); }); ikon.bekle = []; });
  }
  function gecitOzellikleri() {
    var ay = new Date().getMonth() + 1;
    return M.GECITLER.map(function (g, i) {
      var r = resimAdi(g.ad), kapali = M.kapaliOlabilirMi(g, ay), y = yukseklik(g.rakimM);
      return { type: 'Feature', properties: { i: i, ad: g.ad, ml: y, ml2: g.ad + '\n' + y, ik: r ? 'gk-' + r : (kapali ? 'gk-kapali' : 'gk-genel'), sk: r ? -30000 : -g.rakimM },
        geometry: { type: 'Point', coordinates: [g.lon, g.lat] } };
    });
  }
  function gecitGuncelle() { // ölçü birimi değişince yükseklik etiketleri
    if (hazir && kes.katman) harita.getSource('kes-gecit').setData({ type: 'FeatureCollection', features: gecitOzellikleri() });
  }
  function rotaOzellikleri() { // resimli efsane rotalara rota ortasında rozet
    var f = [];
    kes.veri.forEach(function (l, i) {
      var r = resimAdi(l.ad); if (!r) return;
      var p = l.sekil[Math.floor(l.sekil.length / 2)];
      f.push({ type: 'Feature', properties: { i: i, ik: 'gk-' + r }, geometry: { type: 'Point', coordinates: [p[1], p[0]] } });
    });
    return { type: 'FeatureCollection', features: f };
  }
  function kesKatmanKur() {
    if (kes.katman || kes.kuruluyor) return;
    kes.kuruluyor = true;
    ikonlariHazirla(function () {
      kes.kuruluyor = false;
      if (kes.katman) return;
      kes.katman = true;
      var cizgiler = kes.veri.map(function (l, i) { return { type: 'Feature', properties: { i: i }, geometry: { type: 'LineString', coordinates: l.sekil.map(function (p) { return [p[1], p[0]]; }) } }; });
      kes.gecitHam = M.GECITLER;
      harita.addSource('kes-rota', { type: 'geojson', data: { type: 'FeatureCollection', features: cizgiler } });
      harita.addSource('kes-rota-hov', { type: 'geojson', data: bos });
      harita.addSource('kes-rota-nokta', { type: 'geojson', data: rotaOzellikleri() });
      harita.addSource('kes-sec', { type: 'geojson', data: bos, lineMetrics: true });
      harita.addSource('kes-gecit', { type: 'geojson', data: { type: 'FeatureCollection', features: gecitOzellikleri() } });
      harita.addSource('kes-vurgu', { type: 'geojson', data: bos });
      var cz = { 'line-cap': 'round', 'line-join': 'round' }, b = ilkSembolKimligi, yaz = ['Noto Sans Medium'];
      var gorun = st.kip === 'rotalar' ? 'visible' : 'none';
      var L = function (l, once) { l.layout = l.layout || {}; l.layout.visibility = gorun; harita.addLayer(l, once); };
      // rotalar: beyaz kenarlı petrol çizgi; üstüne gelince altın, seçilince altın çizgi akarak çizilir
      L({ id: 'kes-rota-kenar0', type: 'line', source: 'kes-rota', layout: cz, paint: { 'line-color': '#FFFFFF', 'line-width': ['interpolate', ['linear'], ['zoom'], 3, 4.6, 9, 8], 'line-opacity': 0.9 } }, b);
      L({ id: 'kes-rota-cizgi', type: 'line', source: 'kes-rota', layout: cz, paint: { 'line-color': '#0E6E73', 'line-width': ['interpolate', ['linear'], ['zoom'], 3, 2.6, 9, 4.8], 'line-opacity': 0.96, 'line-opacity-transition': GEC } }, b);
      L({ id: 'kes-rota-vur', type: 'line', source: 'kes-rota', layout: cz, paint: { 'line-color': '#C0522D', 'line-width': 18, 'line-opacity': 0 } }, b);
      L({ id: 'kes-rota-hov-kenar', type: 'line', source: 'kes-rota-hov', layout: cz, paint: { 'line-color': '#0A4F53', 'line-width': ['interpolate', ['linear'], ['zoom'], 3, 7, 9, 11], 'line-opacity': 0.95 } }, b);
      L({ id: 'kes-rota-hov', type: 'line', source: 'kes-rota-hov', layout: cz, paint: { 'line-color': '#F4B63F', 'line-width': ['interpolate', ['linear'], ['zoom'], 3, 4, 9, 7] } }, b);
      L({ id: 'kes-sec-kenar', type: 'line', source: 'kes-sec', layout: cz, paint: { 'line-gradient': gradyan(0, '#0A3F42'), 'line-width': ['interpolate', ['linear'], ['zoom'], 3, 8, 9, 12] } }, b);
      L({ id: 'kes-sec', type: 'line', source: 'kes-sec', layout: cz, paint: { 'line-gradient': gradyan(0, '#F4B63F'), 'line-width': ['interpolate', ['linear'], ['zoom'], 3, 4.6, 9, 7.4] } }, b);
      // geçit simgeleri: çarpışma açık (yakın olanlardan yükseği kalır, yakınlaştırınca ötekiler belirir)
      var boy = ['interpolate', ['linear'], ['zoom'], 4.2, .5, 7, .72, 10, .92, 13, 1];
      L({ id: 'kes-gecit-ikon', type: 'symbol', source: 'kes-gecit', minzoom: 4.2,
        layout: { 'icon-image': ['get', 'ik'], 'icon-size': boy, 'icon-padding': 3, 'symbol-sort-key': ['get', 'sk'],
          'text-field': ['step', ['zoom'], '', 7.2, ['get', 'ml'], 10.4, ['get', 'ml2']], 'text-font': yaz, 'text-size': 11.5,
          'text-offset': ['interpolate', ['linear'], ['zoom'], 4.2, ['literal', [0, 1]], 7, ['literal', [0, 1.35]], 10, ['literal', [0, 1.75]], 13, ['literal', [0, 2.1]]],
          'text-anchor': 'top', 'text-optional': true, 'text-padding': 2 },
        paint: { 'text-color': '#0A4F53', 'text-halo-color': 'rgba(255,255,255,.95)', 'text-halo-width': 1.7 } });
      L({ id: 'kes-rota-ikon', type: 'symbol', source: 'kes-rota-nokta', minzoom: 3,
        layout: { 'icon-image': ['get', 'ik'], 'icon-size': ['interpolate', ['linear'], ['zoom'], 3, .55, 7, .8, 10, 1], 'icon-padding': 3 } });
      // üstüne gelinen / seçilen geçit: altın halka + büyük simge, her zaman çizilir
      L({ id: 'kes-vurgu-halka', type: 'circle', source: 'kes-vurgu',
        paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 4, 29, 10, 38], 'circle-color': 'rgba(244,182,63,.30)', 'circle-stroke-color': '#F4B63F', 'circle-stroke-width': 2.4, 'circle-blur': .1 } });
      L({ id: 'kes-vurgu-ikon', type: 'symbol', source: 'kes-vurgu',
        layout: { 'icon-image': ['get', 'ik'], 'icon-size': ['case', ['==', ['get', 's'], 1], 1.3, 1.16], 'icon-allow-overlap': true, 'icon-ignore-placement': true,
          'text-field': ['get', 'ml2'], 'text-font': yaz, 'text-size': 12.5, 'text-offset': [0, 2.1], 'text-anchor': 'top', 'text-allow-overlap': true, 'text-ignore-placement': true },
        paint: { 'text-color': '#0A4F53', 'text-halo-color': 'rgba(255,255,255,.96)', 'text-halo-width': 1.9 } });
      harita.on('moveend', function () { if (st.kip === 'rotalar') kesListele(true); });
      harita.on('mousemove', function (e) {
        if (st.kip !== 'rotalar') return;
        var f = kesIsabet(e.point);
        harita.getCanvas().style.cursor = f ? 'pointer' : '';
        kesHover(f);
      });
      harita.on('mouseout', function () { kesHover(null); });
      if (kes.secili) kesVurgula();
      if (st.kip === 'rotalar') { katmanGorunum(KES_KATMANLAR, true); kesFiltreUygula(); }
    });
  }
  /* üstüne gelinen öğe: rota altın çizgiyle, geçit büyüyüp altın halkayla */
  function kesHover(f) {
    var anahtar = f ? f.t + f.i : '';
    if (anahtar === kes.hov) return;
    kes.hov = anahtar;
    var rota = bos;
    if (f && f.t === 'r') {
      var l = kes.veri[f.i];
      rota = { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: l.sekil.map(function (p) { return [p[1], p[0]]; }) } };
    }
    harita.getSource('kes-rota-hov').setData(rota);
    kesVurgula();
  }
  function kesVurgula() {
    if (!hazir || !kes.katman) return;
    var f = [], tum = gecitOzellikleri;
    var ekle = function (i, sec) {
      var g = M.GECITLER[i], y = yukseklik(g.rakimM), r = resimAdi(g.ad);
      f.push({ type: 'Feature', properties: { ad: g.ad, ml2: g.ad + '\n' + y, ik: r ? 'gk-' + r : 'gk-genel', s: sec ? 1 : 0 }, geometry: { type: 'Point', coordinates: [g.lon, g.lat] } });
    };
    void tum;
    var hovG = kes.hov && kes.hov.charAt(0) === 'g' ? +kes.hov.slice(1) : -1;
    if (hovG >= 0 && !(kes.secili && kes.secili.t === 'g' && kes.secili.i === hovG)) ekle(hovG, false);
    if (kes.secili && kes.secili.t === 'g') ekle(kes.secili.i, true);
    harita.getSource('kes-vurgu').setData({ type: 'FeatureCollection', features: f });
  }
  function kesIsabet(nokta) {
    var kutu = [[nokta.x - 9, nokta.y - 9], [nokta.x + 9, nokta.y + 9]], kat = [];
    if (kes.filtre.g) kat.push('kes-gecit-ikon');
    if (kes.filtre.r) kat.push('kes-rota-ikon', 'kes-rota-vur');
    kat = kat.filter(function (k) { return harita.getLayer(k); });
    if (!kat.length) return null;
    var f = harita.queryRenderedFeatures(kutu, { layers: kat });
    if (!f.length) return null;
    var g = f.filter(function (x) { return /^kes-gecit/.test(x.layer.id); })[0];
    if (g) return { t: 'g', i: g.properties.i };
    return { t: 'r', i: f[0].properties.i };
  }
  function kesTikla(e) {
    var f = kesIsabet(e.point);
    if (f) kesSec(f.t, f.i, true);
  }
  function kesFiltreUygula() {
    if (!hazir || !kes.katman) return;
    katmanGorunum(KES_ROTA_KAT, kes.filtre.r);
    katmanGorunum(KES_GECIT_KAT, kes.filtre.g);
  }
  $('#tur-rot-rotalar').addEventListener('change', function () { kes.filtre.r = this.checked; kesFiltreUygula(); kesListele(); });
  $('#tur-rot-gecitler').addEventListener('change', function () { kes.filtre.g = this.checked; kesFiltreUygula(); kesListele(); });

  /* görünümdeki öğeler: merkeze yakın sırayla, en çok 8 rota + 8 geçit */
  function kesListele(sessiz) {
    if (!hazir || !kes.veri) return;
    var b = harita.getBounds(), c = harita.getCenter();
    var icinde = function (lat, lon) { return lat >= b.getSouth() && lat <= b.getNorth() && lon >= b.getWest() && lon <= b.getEast(); };
    var uz = function (lat, lon) { var dx = (lon - c.lng) * Math.cos(c.lat * Math.PI / 180), dy = lat - c.lat; return dx * dx + dy * dy; };
    var rotalar = [], gecitler = [], rSay = 0, gSay = 0;
    if (kes.filtre.r) kes.veri.forEach(function (l, i) {
      var en = Infinity, var_ = false;
      l.sekil.forEach(function (p) { if (icinde(p[0], p[1])) { var_ = true; en = Math.min(en, uz(p[0], p[1])); } });
      if (var_) { rSay++; rotalar.push({ t: 'r', i: i, d: en }); }
    });
    if (kes.filtre.g && harita.getZoom() >= 4.2) M.GECITLER.forEach(function (g, i) {
      if (icinde(g.lat, g.lon)) { gSay++; gecitler.push({ t: 'g', i: i, d: uz(g.lat, g.lon) }); }
    });
    rotalar.sort(function (a, b) { return a.d - b.d; });
    gecitler.sort(function (a, b) { return a.d - b.d; });
    var liste = rotalar.slice(0, 8).concat(gecitler.slice(0, 8));
    if (kes.secili && !liste.some(function (x) { return x.t === kes.secili.t && x.i === kes.secili.i; })) liste.unshift({ t: kes.secili.t, i: kes.secili.i });
    $('#tur-rot-sayi').textContent = (rSay || gSay) ? doldur(T.rot_sayi, { r: rSay, g: gSay }) : T.rot_yok;
    kesKartlar(liste, sessiz);
  }
  function olcuYaz(o) {
    var m = 'mil' in o ? o.mil * 1609.344 : 'ft' in o ? o.ft * 0.3048 : 'km' in o ? o.km * 1000 : 'm' in o ? o.m : null;
    if (m != null) return st.birim === 'mi' ? (m >= 1609 ? Math.round(m / 1609.344) + ' mi' : Math.round(m * 3.28084) + ' ft') : (m >= 1000 ? f1(m / 1000) + ' km' : Math.round(m) + ' m');
    var v = 'mph' in o ? o.mph * 1.609344 : o.kmsa;
    return st.birim === 'mi' ? Math.round(v / 1.609344) + ' mph' : Math.round(v) + ' km/h';
  }
  function notYaz(n) { return n.m.replace(/\{v(\d+)\}/g, function (_, k) { return n.o[+k] ? olcuYaz(n.o[+k]) : ''; }); }
  function zirveYaz(z) { var v = 'ft' in z ? (st.birim === 'mi' ? Math.round(z.ft) + ' ft' : Math.round(z.ft * 0.3048) + ' m') : metreYazi(z.m); return z.ad ? doldur(T.rot_zirve_ad, { ad: z.ad, v: v }) : doldur(T.rot_zirve, { v: v }); }
  var AY = (function () { var a = [], f; try { f = new Intl.DateTimeFormat(A.dil, { month: 'short' }); for (var i = 0; i < 12; i++) a.push(f.format(new Date(2026, i, 1))); } catch (e) { for (var j = 1; j <= 12; j++) a.push(String(j)); } return a; })();
  function gecitKapanis(g) {
    var ay = new Date().getMonth() + 1;
    if (g.kapaliAylar) { var t = doldur(M.kapaliOlabilirMi(g, ay) ? T.rot_simdi : T.rot_kapali, { a: AY[g.kapaliAylar[0] - 1], b: AY[g.kapaliAylar[1] - 1] }); return { yazi: t, simdi: M.kapaliOlabilirMi(g, ay) }; }
    return M.kapaliOlabilirMi(g, ay) ? { yazi: T.rot_yuksek_kis, simdi: true } : null;
  }
  function kesKartlar(liste, sessiz) {
    var ol = $('#tur-rot-liste');
    ol.innerHTML = liste.map(function (x, k) {
      var sec = kes.secili && kes.secili.t === x.t && kes.secili.i === x.i, h;
      if (x.t === 'r') {
        var l = kes.veri[x.i];
        var rs = resimAdi(l.ad);
        h = (rs ? '<span class="no ikon" aria-hidden="true">' + resimliImg(rs, 40) + '</span>'
          : '<span class="no yildiz" aria-hidden="true"><svg viewBox="0 0 16 16" width="15" height="15"><path d="M8 1l2.1 4.6 5 .5-3.8 3.4 1.1 4.9L8 11.9 3.6 14.4l1.1-4.9L.9 6.1l5-.5z" fill="currentColor"/></svg></span>') +
          '<span class="baslik">' + esc(l.ad) + '</span>' +
          '<span class="olcu"><b>' + mesafe(l.km) + '</b><span>' + esc(l.bolge) + '</span></span>' +
          (l.zirve ? '<span class="chip gecit">' + esc(zirveYaz(l.zirve)) + '</span>' : '') + (l.kis ? '<span class="chip">' + esc(T.rot_kis) + '</span>' : '') +
          '<span class="not' + (sec ? ' acik' : '') + '">' + esc(l.neden) + '</span>' +
          (sec && l.not ? '<span class="not acik">' + esc(notYaz(l.not)) + '</span>' : '') +
          (sec && l.kaynak ? '<span class="kaynak">' + esc(doldur(T.rot_kaynak, { site: l.kaynak.site })) + '</span>' : '');
      } else {
        var g = M.GECITLER[x.i], kp = gecitKapanis(g);
        h = '<span class="no ikon" aria-hidden="true">' + gecitIkonHtml(g.ad, 40, kp && kp.simdi) + '</span>' +
          '<span class="baslik">' + esc(g.ad) + '</span>' +
          '<span class="olcu"><b>' + yukseklik(g.rakimM) + '</b><span>' + esc(T.rot_gecit + ' · ' + g.ulkeler.join(' / ')) + '</span></span>' +
          (kp ? '<span class="chip' + (kp.simdi ? ' uyari' : '') + '">' + esc(kp.yazi) + '</span>' : '') + (g.toprak ? '<span class="chip">' + esc(T.rot_toprak) + '</span>' : '');
      }
      var islem = sec ? '<div class="tur-rot-islem">' + (x.t === 'r'
        ? '<button type="button" class="btn btn-primary btn-sm" data-ac="' + x.i + '">' + esc(T.rot_ac) + '</button>'
        : '<button type="button" class="btn btn-primary btn-sm" data-buradan="' + x.i + '">' + esc(T.rot_gecit_buradan) + '</button>') + '</div>' : '';
      return '<li' + (sessiz ? '' : ' class="yeni" style="--i:' + k + '"') + '><button type="button" class="tur-kart rot" role="radio" aria-checked="' + !!sec + '" data-t="' + x.t + '" data-i="' + x.i + '">' + h + '</button>' + islem + '</li>';
    }).join('');
    $$('.tur-kart.rot', ol).forEach(function (b) { b.addEventListener('click', function () { kesSec(b.dataset.t, +b.dataset.i, false); }); });
    $$('[data-ac]', ol).forEach(function (b) { b.addEventListener('click', function () { kesAc(kes.veri[+b.dataset.ac], b); }); });
    $$('[data-buradan]', ol).forEach(function (b) {
      b.addEventListener('click', function () { var g = M.GECITLER[+b.dataset.buradan]; kipSec('uret', true); baslangicKoy({ latitude: g.lat, longitude: g.lon }, false, false, g.ad); });
    });
  }
  function kesIsaretiTemizle() {
    if (kes.iptal) { kes.iptal(); kes.iptal = null; }
    kesKutu.zamanlar.forEach(clearTimeout); kesKutu.zamanlar = [];
    kesKutu.liste.forEach(function (m) { m.remove(); }); kesKutu.liste = [];
    if (hazir && kes.katman) harita.getSource('kes-sec').setData(bos);
  }
  /* seçili rota başlangıçtan sona akarak çizilir; geçit seçilince işareti belirip kamera ona uçar */
  function kesSec(t, i, haritadan) {
    kes.secili = { t: t, i: i };
    kesIsaretiTemizle();
    if (!kes.katman) return;
    kesVurgula();
    if (t === 'r') {
      var l = kes.veri[i], ham = l.sekil.map(function (p) { return { latitude: p[0], longitude: p[1] }; });
      harita.getSource('kes-sec').setData({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: l.sekil.map(function (p) { return [p[1], p[0]]; }) } });
      harita.setPaintProperty('kes-sec', 'line-gradient', gradyan(0, '#F4B63F'));
      harita.setPaintProperty('kes-sec-kenar', 'line-gradient', gradyan(0, '#0A3F42'));
      var b = new maplibregl.LngLatBounds();
      l.sekil.forEach(function (p) { b.extend([p[1], p[0]]); });
      harita.fitBounds(b, kamera({ padding: { top: 50, bottom: 50, left: 50, right: 50 }, maxZoom: 12, duration: 1000 }));
      var cum = kumulatif(ham), top = cum[cum.length - 1] || 1;
      l.duraklar.forEach(function (d, k) {
        var f = cum[enYakinIndeks(ham, d.lat, d.lon)] / top;
        isaretYap('durak', '<b>' + (k + 1) + '</b>', [d.lon, d.lat], 'center', reduce ? 0 : 1300 * (1 - Math.pow(1 - Math.min(1, f), 1 / 3)) + 200, kesKutu);
      });
      kes.iptal = anim(1500, function (p) {
        var q = EASE3(p);
        harita.setPaintProperty('kes-sec', 'line-gradient', gradyan(q, '#F4B63F'));
        harita.setPaintProperty('kes-sec-kenar', 'line-gradient', gradyan(q, '#0A3F42'));
      });
    } else {
      var g = M.GECITLER[i];
      harita.flyTo(kamera({ center: [g.lon, g.lat], zoom: Math.max(harita.getZoom(), 9.5), duration: 1100 }));
    }
    kesListele(true);
    if (haritadan) {
      var el = $('.tur-kart.rot[aria-checked=true]'); if (el && el.scrollIntoView) { try { el.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' }); } catch (e) { /* eski tarayıcı */ } }
    }
  }
  /* "Bu turu aç": efsane rotanın duraklarından gerçek rota hesaplanır, tur üret ekranının sonuç akışına (yerler, QR, telefon) girer. */
  function kesAc(l, btn) {
    if (!l || btn.disabled) return;
    var eski = btn.textContent; btn.disabled = true; btn.textContent = T.rot_aciliyor;
    var duraklar = l.duraklar.map(function (d) { return { latitude: d.lat, longitude: d.lon }; });
    M.sayaciSifirla();
    M.rotaKur(duraklar, l.mod === 'koy' ? 2 : 1, undefined, l.mod).then(function (r) {
      var tur = { duraklar: duraklar, coordinates: r.coordinates, rota: r.rota, olcu: r.olcu, yon: 0, gecitler: r.gecitler, efsane: l };
      st.calisma++;
      st.sonuc = [tur]; st.adlar = new Map(); st.adlar.set(tur, l.duraklar.map(function (d) { return d.ad; }));
      st.secili = 0; st.varyasyon = 0; st.eskiSayi = 0;
      kesIsaretiTemizle();
      kipSec('uret');
      sonucCiz(true);
      try { $('#tur-sonuc-kutu').scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' }); } catch (e) { /* eski tarayıcı */ }
    }).catch(function () {
      btn.disabled = false; btn.textContent = eski;
      durum(M.sayac.son429 === 'gunluk-tavan' ? T.hata_tavan : (M.sayac.sonHataDurum === 429 || M.sayac.sonHataDurum >= 500) ? T.hata_mesgul : M.sayac.ag ? T.hata_ag : T.rot_ac_hata, 'hata');
    });
  }
  if (location.hash === '#kesfet') { var kipBekle = setInterval(function () { if (hazir) { clearInterval(kipBekle); kipSec('rotalar'); } }, 200); setTimeout(function () { clearInterval(kipBekle); }, 15000); }

  /* ---------------------------------------------------------------- sürüş önizlemesi için küçük arayüz (m/tur/surus.js)
     Olaylar: tur:sonuc (yeni sonuç çizildi), tur:iptal (sonuç değişiyor / yeni arama). Hesap ve harita burada kalır. */
  window.TurKancasi = {
    harita: function () { return hazir ? harita : null; },
    tur: function () { return st.sonuc[st.secili] || null; },
    evre: function () { return st.evre; }, kip: function () { return st.kip; },
    reduce: reduce, kamera: kamera, EASE3: EASE3, kumulatif: kumulatif, enYakinIndeks: enYakinIndeks,
    mesafe: mesafe, yukseklik: yukseklik, yerler: function () { return yer.liste.map(function (y, i) { return { i: i, ad: y.ad, m: y._m, kat: y._kat || yer.kat }; }); }, yerVurgu: yerVurgu, yerIkon: chipIkon, gecitIkon: gecitIkonHtml, sonucKutu: function () { return $('#tur-sonuc-kutu'); }
  };

  /* ---------------------------------------------------------------- başlat */
  /* Varsayılan başlangıç (konum izni İSTENMEZ): sayfa diline/saat dilimine göre makul bir şehir; kadran sayfa açılınca hazır. Ara ya da "Konumumu
     kullan" dersen başlangıç taşınır. Ad yazılı: açılışta ters kodlama isteği (üçüncü taraf) atılmaz. */
  var VARSAYILAN_BASLANGIC = A.dil === 'tr' ? { p: { latitude: 39.9334, longitude: 32.8597 }, ad: 'Ankara' }
    : A.dil === 'de' ? { p: { latitude: 48.1351, longitude: 11.582 }, ad: 'München' }
    : /^America\//.test(tz) ? { p: { latitude: 39.7392, longitude: -104.9903 }, ad: 'Denver' } : { p: { latitude: 47.2692, longitude: 11.4041 }, ad: 'Innsbruck' };
  evre('ayar');
  baslangicKoy(VARSAYILAN_BASLANGIC.p, false, true, VARSAYILAN_BASLANGIC.ad);
  haritaKur();
  kok.classList.add('js');
})();
