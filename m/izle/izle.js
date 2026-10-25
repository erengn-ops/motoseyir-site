/*
 * Motoseyir canlı sürüş sayfası (/izle/).
 * Belirteç adreste PARÇA olarak (#/izle/<belirteç>; ?t=<belirteç> de olur): parça sunucuya ve günlüklere gitmez.
 * Veri: rota.motoseyir-app.com/izle/<belirteç>/durum (anahtarsız, CORS yalnız bu site), 5 sn'de bir; ?s=<izS> ile artımlı iz.
 * Harita: MapLibre + Protomaps (tur üreticisiyle aynı stil/parçalar, /m/tur/harita/stil.json).
 * Hareket: power3 / expo çıkışı; konum değişimi yumuşak kayma, iz çizgisi uzayarak; prefers-reduced-motion'da tek adım.
 */
(function () {
  'use strict';
  var kok = document.getElementById('izle');
  var ayarEl = document.getElementById('izle-ayar');
  if (!kok || !ayarEl) return;
  var A = JSON.parse(ayarEl.textContent); // { metin: {tr,en,...}, chrome: {...}, magaza: {ios, play}, api, dilSirasi }
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var ua = navigator.userAgent || '';
  var android = /Android/.test(ua);
  var yerelHost = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  function $(id) { return document.getElementById(id); }

  /* ---------------------------------------------------------------- dil */
  var dil = 'en', T = A.metin.en, C = A.chrome.en, yerel = 'en', imperyal = false;
  function dilBul() {
    var k = null;
    try { k = localStorage.getItem('motoseyir.izle.dil'); } catch (e) { /* depolama kapalı */ }
    if (k && A.metin[k]) return k;
    var adaylar = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || 'en'];
    for (var i = 0; i < adaylar.length; i++) {
      var a = String(adaylar[i] || '').slice(0, 2).toLowerCase();
      if (A.metin[a]) return a;
    }
    return 'en';
  }
  function yol(o, p) {
    var d = p.split('.');
    for (var i = 0; i < d.length && o != null; i++) o = o[d[i]];
    return o == null ? '' : o;
  }
  function dilKur(k, kaydet) {
    dil = k; T = A.metin[k]; C = A.chrome[k];
    var tam = (navigator.languages && navigator.languages[0]) || navigator.language || k;
    yerel = String(tam).slice(0, 2).toLowerCase() === k ? tam : T.yerel;
    imperyal = /^en-(US|GB|LR|MM)$/i.test(yerel);
    if (kaydet) { try { localStorage.setItem('motoseyir.izle.dil', k); } catch (e) { /* sorun değil */ } }
    document.documentElement.lang = k;
    document.title = 'Motoseyir · ' + T.baslik;
    var m = document.querySelector('meta[name="description"]'); if (m) m.setAttribute('content', T.aciklama);
    Array.prototype.forEach.call(document.querySelectorAll('[data-i]'), function (e) { e.textContent = yol(T, e.getAttribute('data-i')); });
    Array.prototype.forEach.call(document.querySelectorAll('[data-ai]'), function (e) { e.setAttribute('aria-label', yol(T, e.getAttribute('data-ai'))); });
    Array.prototype.forEach.call(document.querySelectorAll('[data-c]'), function (e) {
      var c = C[e.getAttribute('data-c')];
      if (!c) return;
      if (typeof c === 'string') { e.textContent = c; return; }
      if (e.tagName === 'A' && c.h && !e.hasAttribute('data-magaza')) e.setAttribute('href', c.h);
      if (!e.hasAttribute('data-keep')) e.textContent = c.t;
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-ca]'), function (e) { e.setAttribute('aria-label', C[e.getAttribute('data-ca')] || ''); });
    var kod = document.querySelector('.dil-sec .dil-kod'), ad = document.querySelector('.dil-sec .dil-ad'), ozet = document.querySelector('.dil-sec summary');
    if (kod) kod.textContent = k.toUpperCase();
    if (ad) ad.textContent = T.ad;
    if (ozet) ozet.setAttribute('aria-label', C.dil_sec_etiket);
    Array.prototype.forEach.call(document.querySelectorAll('[data-dil]'), function (e) {
      if (e.getAttribute('data-dil') === k) e.setAttribute('aria-current', 'true'); else e.removeAttribute('aria-current');
    });
    if (haritaEl) haritaEl.setAttribute('aria-label', T.harita_etiket);
    goster();
  }

  /* ---------------------------------------------------------------- biçim */
  function sayi(x, hane) {
    try { return new Intl.NumberFormat(yerel, { maximumFractionDigits: hane }).format(x); } catch (e) { return String(Math.round(x)); }
  }
  function mesafe(m) {
    if (imperyal) {
      var mil = m / 1609.344;
      return mil < 0.2 ? sayi(m * 1.09361, 0) + ' yd' : sayi(mil, mil < 10 ? 1 : 0) + ' mi';
    }
    return m < 1000 ? sayi(Math.round(m / 10) * 10, 0) + ' m' : sayi(m / 1000, m < 10000 ? 1 : 0) + ' km';
  }
  function saat(sn) {
    var d = new Date(sn * 1000);
    try { return new Intl.DateTimeFormat(yerel, { hour: 'numeric', minute: '2-digit' }).format(d); } catch (e) { return d.getHours() + ':' + ('0' + d.getMinutes()).slice(-2); }
  }
  function once(sn) {
    sn = Math.max(0, sn);
    try {
      var r = new Intl.RelativeTimeFormat(yerel, { numeric: 'auto' });
      if (sn < 60) return r.format(-Math.floor(sn / 5) * 5, 'second');
      if (sn < 3600) return r.format(-Math.round(sn / 60), 'minute');
      return r.format(-Math.round(sn / 3600), 'hour');
    } catch (e) { return saat(Date.now() / 1000 - sn); }
  }

  /* ---------------------------------------------------------------- hareket */
  var EASE3 = function (t) { return 1 - Math.pow(1 - t, 3); };
  var EXPO = function (t) { return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t); };
  function anim(sure, kare, bitti, ease) {
    var iptal = false, t0 = null;
    if (reduce || !(sure > 0)) { kare(1); if (bitti) bitti(); return function () {}; }
    function adim(ts) {
      if (iptal) return;
      if (t0 === null) t0 = ts;
      var t = Math.min(1, (ts - t0) / sure);
      kare((ease || EASE3)(t));
      if (t < 1) requestAnimationFrame(adim); else if (bitti) bitti();
    }
    requestAnimationFrame(adim);
    return function () { iptal = true; };
  }

  /* ---------------------------------------------------------------- belirteç ve adresler */
  function belirtecBul() {
    var m = /([A-Za-z0-9_-]{16,64})\/?$/.exec(location.hash || '');
    if (m) return m[1];
    var q = /[?&]t=([A-Za-z0-9_-]{16,64})(?:&|$)/.exec(location.search || '');
    return q ? q[1] : null;
  }
  var belirtec = belirtecBul();
  var api = A.api;
  if (yerelHost) { var qa = /[?&]api=([^&]+)/.exec(location.search || ''); if (qa) api = decodeURIComponent(qa[1]); } // yalnız yerel sınama
  window.addEventListener('hashchange', function () { location.reload(); });

  /* ---------------------------------------------------------------- harita */
  var haritaEl = $('izle-harita'), haritaSar = $('izle-harita-sar'), ortalaDugme = $('izle-ortala');
  var harita = null, hazir = false, haritaKuruluyor = false, takip = true, isaret = null, isaretEl = null;
  var cur = null, curYon = null, tweenIptal = null;
  var iz = [];           // [[lng, lat], ...] sunucunun verdiği + biriken
  var izS = null;        // son alınan iz sırası
  var girisYapildi = false, girisIptal = null;
  var bos = { type: 'FeatureCollection', features: [] };
  var MERKEZ = { tr: { c: [35.5, 39.2], z: 5 }, de: { c: [11.0, 47.9], z: 6 }, fr: { c: [2.5, 46.6], z: 5 }, it: { c: [12.5, 42.0], z: 5 } };

  function gradyan(p, renk) {
    if (p >= 1) return ['interpolate', ['linear'], ['line-progress'], 0, renk, 1, renk];
    return ['step', ['line-progress'], renk, Math.max(p, 0.00005), 'rgba(0,0,0,0)'];
  }
  function haritaHata() { var e = $('izle-harita-hata'); if (e) e.hidden = false; }

  var konumluKuruldu = false;
  function haritaKur(c, z, konumlu) {
    if (harita || haritaKuruluyor) return;
    konumluKuruldu = !!konumlu;
    if (!window.maplibregl) { haritaHata(); return; }
    haritaKuruluyor = true;
    fetch('/m/tur/harita/stil.json?v=k1').then(function (r) { return r.json(); }).then(function (stil) {
      stil.glyphs = location.origin + stil.glyphs;
      stil.sprite = location.origin + stil.sprite;
      var m = MERKEZ[dil] || { c: [8.5, 46.7], z: 5 };
      var secenek = {
        container: 'izle-harita', style: stil, center: c || m.c, zoom: Math.max(6, z || m.z), minZoom: 6, maxZoom: 16.5,
        attributionControl: false, dragRotate: false, pitchWithRotate: false, cooperativeGestures: false
      };
      harita = new maplibregl.Map(secenek);
      harita.touchZoomRotate.disableRotation();
      harita.addControl(new maplibregl.AttributionControl({ compact: true, customAttribution: '© OpenStreetMap · Protomaps' }), 'bottom-right');
      harita.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
      if (yerelHost) window.IzleHarita = harita; // yalnız yerel sınama
      harita.on('error', function (e) {
        if (window.console) console.warn('harita:', e && e.error ? e.error.message || e.error : e);
        if (e && e.error && /Failed to fetch|AJAXError/i.test(String(e.error.message || e.error))) haritaHata();
      });
      harita.on('dragstart', function () {
        takip = false;
        if (isaret) ortalaDugme.hidden = false;
      });
      /* Kap boyutu sonradan değişirse (yazı tipi yüklenmesi, durum kartının uzaması, ekran dönmesi) tuval kapla birlikte büyüsün. */
      if (window.ResizeObserver) new ResizeObserver(function () { if (harita) harita.resize(); }).observe(haritaEl);
      harita.on('load', function () {
        hazir = true;
        harita.resize();
        var ilkSembol = null;
        harita.getStyle().layers.some(function (l) { if (l.type === 'symbol') { ilkSembol = l.id; return true; } return false; });
        harita.addSource('iz', { type: 'geojson', data: bos, lineMetrics: true });
        var cizgi = { 'line-cap': 'round', 'line-join': 'round' };
        harita.addLayer({ id: 'iz-kenar', type: 'line', source: 'iz', layout: cizgi, paint: { 'line-gradient': gradyan(1, '#FFFFFF'), 'line-width': 9, 'line-opacity': 1 } }, ilkSembol);
        harita.addLayer({ id: 'iz-cizgi', type: 'line', source: 'iz', layout: cizgi, paint: { 'line-gradient': gradyan(1, '#0E6E73'), 'line-width': 5.5, 'line-opacity': 1 } }, ilkSembol);
        izCiz(cur);
        izGiris();
        if (isaretEl === null && cur) isaretKoy(cur, curYon);
        /* Harita konum gelmeden kurulduysa (ilk yanıt "bekliyor" ya da konum harita yüklenirken geldi) sürücüye uçar. */
        if (cur && !konumluKuruldu) harita.flyTo({ center: cur, zoom: 13.5, duration: reduce ? 0 : 1800, easing: EXPO });
      });
    }).catch(haritaHata);
  }

  function izCiz(bas) {
    if (!hazir) return;
    var k = iz.slice();
    if (bas) k.push(bas);
    harita.getSource('iz').setData(k.length < 2 ? bos : { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: k } });
  }
  /* Sayfa açılınca mevcut iz başından sonuna çizilir (çizgi uzayarak); sonrası canlı güncelleme. */
  function izGiris() {
    if (girisYapildi || !hazir || iz.length < 2) return;
    girisYapildi = true;
    if (reduce) return;
    girisIptal = anim(1600, function (p) {
      harita.setPaintProperty('iz-kenar', 'line-gradient', gradyan(p, '#FFFFFF'));
      harita.setPaintProperty('iz-cizgi', 'line-gradient', gradyan(p, '#0E6E73'));
    }, null, EXPO);
  }

  function isaretKoy(p, yon) {
    if (!harita || isaret || !hazir) return;
    var el = document.createElement('div');
    el.className = 'izle-surucu';
    el.innerHTML = '<span class="halo"></span><svg viewBox="0 0 46 46" aria-hidden="true"><circle class="disk" cx="23" cy="23" r="15"/>' +
      '<path class="yon" d="M23 11 L31.5 32 L23 27 L14.5 32 Z"/><circle class="tek" cx="23" cy="23" r="4.5" style="display:none"/></svg>';
    isaretEl = el;
    isaret = new maplibregl.Marker({ element: el, anchor: 'center', pitchAlignment: 'map', rotationAlignment: 'map' }).setLngLat(p).addTo(harita);
    yonKoy(yon);
  }
  function yonKoy(yon) {
    if (!isaretEl) return;
    var ok = isaretEl.querySelector('.yon'), tek = isaretEl.querySelector('.tek');
    if (typeof yon === 'number') { ok.style.display = ''; tek.style.display = 'none'; ok.style.transform = 'rotate(' + yon + 'deg)'; }
    else { ok.style.display = 'none'; tek.style.display = ''; }
  }
  function isaretKaldir() {
    /* Sürüş bitince son nokta (çoğu zaman evin kapısı) işaretli kalmıyor, iz de siliniyor, harita sokak ölçeğinden çıkıyor. */
    if (tweenIptal) { tweenIptal(); tweenIptal = null; }
    if (girisIptal) { girisIptal(); girisIptal = null; }
    if (isaret) { isaret.remove(); isaret = null; isaretEl = null; }
    cur = null; iz = []; izS = null;
    ortalaDugme.hidden = true;
    if (harita && hazir) {
      izCiz(null);
      harita.easeTo({ zoom: Math.min(harita.getZoom(), 9), duration: reduce ? 0 : 1400, easing: EXPO });
    }
    haritaSar.classList.add('bitti');
  }

  /* Konum: işaret eski yerinden yeni yerine kayar, iz çizgisi onunla birlikte uzar, kamera (takipteyse) birlikte gider. */
  function konumGit(k) {
    var hedef = [k.lon, k.lat];
    var yon = typeof k.yon === 'number' ? k.yon : null;
    if (isaretEl) isaretEl.classList.toggle('eski', k.yas > 60);
    if (!cur) { // ilk konum
      cur = hedef; curYon = yon;
      if (harita && hazir) {
        isaretKoy(cur, yon);
        izCiz(cur);
        if (!girisYapildi) izGiris();
        if (Math.abs(harita.getZoom() - 13.5) > 3 || !harita.getBounds().contains(cur)) harita.flyTo({ center: cur, zoom: Math.max(harita.getZoom(), 13.5), duration: reduce ? 0 : 1800, easing: EXPO });
      } else if (!harita) {
        haritaKur(hedef, 13.5, true);
      }
      return;
    }
    if (!harita || !hazir) { cur = hedef; curYon = yon; return; }
    if (!isaret) isaretKoy(cur, curYon);
    var b = cur.slice(), by = curYon, aci = 0;
    if (yon !== null && by !== null) { aci = ((yon - by + 540) % 360) - 180; }
    var ayni = Math.abs(b[0] - hedef[0]) < 1e-7 && Math.abs(b[1] - hedef[1]) < 1e-7;
    if (tweenIptal) tweenIptal();
    var kareNo = 0;
    tweenIptal = anim(ayni ? 0 : 1100, function (e) {
      cur = [b[0] + (hedef[0] - b[0]) * e, b[1] + (hedef[1] - b[1]) * e];
      if (isaret) isaret.setLngLat(cur);
      if (yon !== null) { curYon = by === null ? yon : by + aci * e; yonKoy(curYon); }
      if (e >= 1 || (kareNo++ & 1) === 0) izCiz(cur); // çizgi veri güncellemesi her ikinci karede (uzun izde işçiyi yormasın)
      if (takip) harita.setCenter(cur);
    });
    if (yon === null) { curYon = null; yonKoy(null); }
  }
  ortalaDugme.addEventListener('click', function () {
    takip = true; ortalaDugme.hidden = true;
    if (isaret && harita) harita.easeTo({ center: cur, zoom: Math.max(harita.getZoom(), 14), duration: reduce ? 0 : 900, easing: EASE3 });
  });

  /* ---------------------------------------------------------------- durum ekranı */
  var son = null, alinma = 0, bitti = false, agHatasi = false, zamanlayici = null, hata = 0, sonHedef = null;
  var gosterilenKalan = null, kalanIptal = null;
  function yaz(id, metin) {
    var e = $(id);
    if (!e) return;
    var yeniMetin = metin || '';
    if (e.textContent !== yeniMetin) e.textContent = yeniMetin;
  }
  /* Satırlar yalnız DEĞİŞİNCE yazılıyor: her saniyeki yenileme gizleyip göstermiyor (giriş animasyonu yeniden başlamasın). */
  function satir(ad, deger) {
    var s = $('satir-' + ad), v = deger !== null && deger !== undefined && deger !== '';
    if (v && deger !== true) yaz('deger-' + ad, deger);
    if (s.hidden === v) s.hidden = !v;
  }
  function not(metin) { var e = $('izle-not'); if (e.textContent !== (metin || '')) e.textContent = metin || ''; e.hidden = !metin; }
  function durumKur(ad) { if (kok.getAttribute('data-durum') !== ad) kok.setAttribute('data-durum', ad); }
  function kalanTween(m) {
    if (gosterilenKalan === m) return;
    if (gosterilenKalan === null) { gosterilenKalan = m; yaz('deger-kalan', mesafe(m)); return; }
    var b = gosterilenKalan; gosterilenKalan = m;
    if (kalanIptal) kalanIptal();
    kalanIptal = anim(900, function (e) { yaz('deger-kalan', mesafe(b + (m - b) * e)); }, function () { yaz('deger-kalan', mesafe(m)); }, EASE3);
  }
  function goster() {
    if (!son) return;
    var d = son, gecen = (Date.now() - alinma) / 1000;
    $('izle-ag-hata').hidden = !agHatasi;
    var yazi, ad, alt = '', hedef = null, kalan = null, varisSaati = null, sonYazi = null;
    if (d.durum === 'yok') { ad = 'yok'; yazi = T.durum.yok; alt = T.durum.yok_alt; }
    else if (d.durum === 'bitti') {
      var varis = d.neden === 'varis';
      ad = varis ? 'varis' : 'bitti';
      yazi = varis ? T.durum.varis : d.neden === 'kapatildi' ? T.durum.kapatildi : d.neden === 'sessiz' ? T.durum.sessiz : T.durum.bitti;
      alt = T.durum.bitti_alt;
    } else if (d.durum === 'bekliyor') { ad = 'bekliyor'; yazi = T.durum.bekliyor; alt = T.durum.bekliyor_alt; }
    else {
      var yas = null;
      if (d.durum === 'canli' && d.konum) { ad = 'canli'; yazi = T.durum.canli; yas = d.konum.yas + gecen; }
      else { ad = 'kopuk'; yazi = T.durum.kopuk; alt = T.durum.kopuk_alt; if (d.sonKonumAn) yas = d.simdi - d.sonKonumAn + gecen; }
      hedef = d.hedef || (d.durum === 'kopuk' ? sonHedef : null);
      if (d.durum === 'canli' && typeof d.kalanM === 'number') kalan = d.kalanM;
      if (d.durum === 'canli' && typeof d.kalanSn === 'number' && d.sonKonumAn) varisSaati = saat(d.sonKonumAn + d.kalanSn);
      if (yas !== null) sonYazi = once(yas);
      if (isaretEl) isaretEl.classList.toggle('eski', d.durum !== 'canli' || yas > 60);
    }
    durumKur(ad); yaz('izle-durum-yazi', yazi); not(alt);
    satir('hedef', hedef);
    satir('kalan', kalan !== null ? true : null);
    if (kalan !== null) kalanTween(kalan); else gosterilenKalan = null;
    satir('varis', varisSaati);
    satir('son', sonYazi);
  }

  /* ---------------------------------------------------------------- yoklama */
  var ilkYanit = true;
  function izEkle(d) {
    if (!d.iz) return;
    var yeni = d.iz.map(function (p) { return [p[1], p[0]]; });
    if (typeof d.izS === 'number' && izS !== null && d.izS < izS) { // sunucu yeniden başladı: sıra geriye gitti, baştan al
      iz = []; izS = null; zamanlayici = setTimeout(sor, 300); return;
    }
    iz = d.izTam ? yeni : iz.concat(yeni);
    if (iz.length > 3000) { var k = iz.filter(function (_, i) { return i % 2 === 0; }); if (k[k.length - 1] !== iz[iz.length - 1]) k.push(iz[iz.length - 1]); iz = k; }
    if (typeof d.izS === 'number') izS = d.izS;
  }
  function sor() {
    zamanlayici = null;
    /* Arka plandaki sekme sormuyor (pil, veri); ilk soru yine de gidiyor ki sekme öne gelince ekran boş durmasın. */
    if (bitti || (document.hidden && son)) return;
    var adres = api + '/izle/' + belirtec + '/durum' + (izS !== null ? '?s=' + izS : '');
    fetch(adres, { cache: 'no-store', credentials: 'omit', mode: 'cors' }).then(function (r) {
      if (r.status === 404) return { durum: 'yok' };
      if (!r.ok) throw new Error(String(r.status));
      return r.json();
    }).then(function (d) {
      son = d; alinma = Date.now(); agHatasi = false; hata = 0;
      var yenidenAl = false;
      if (d.durum === 'canli' || d.durum === 'kopuk' || d.durum === 'bekliyor') {
        var oncekiS = izS;
        izEkle(d);
        if (izS === null && oncekiS !== null) yenidenAl = true;
      }
      if (ilkYanit) {
        ilkYanit = false;
        if (d.durum === 'yok' || d.durum === 'bitti') kok.setAttribute('data-harita', 'yok');
        else if (!harita && !(d.durum === 'canli' && d.konum)) { var m = MERKEZ[dil]; haritaKur(m ? m.c : null, m ? m.z : null, false); }
      }
      if (d.durum === 'canli' && d.konum) { sonHedef = d.hedef || null; konumGit(d.konum); }
      else if (d.durum === 'kopuk' && isaretEl) isaretEl.classList.add('eski');
      else if (d.durum === 'bitti' || d.durum === 'yok') {
        bitti = true;
        if (harita || isaret) isaretKaldir();
        durumKur(d.durum === 'yok' ? 'yok' : 'bitti');
      }
      goster();
      if (!bitti && !yenidenAl) zamanlayici = setTimeout(sor, 5000);
    }).catch(function () {
      hata++; agHatasi = true;
      if (ilkYanit && !son) { son = { durum: 'bekliyor' }; alinma = Date.now(); if (!harita) { var m = MERKEZ[dil]; haritaKur(m ? m.c : null, m ? m.z : null, false); } ilkYanit = false; }
      goster();
      zamanlayici = setTimeout(sor, Math.min(30000, 5000 * (hata + 1)));
    });
  }
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden && !zamanlayici && !bitti && belirtec) sor();
  });

  /* ---------------------------------------------------------------- dil seçici ve mağaza */
  Array.prototype.forEach.call(document.querySelectorAll('[data-dil]'), function (e) {
    e.addEventListener('click', function (ev) {
      ev.preventDefault();
      dilKur(e.getAttribute('data-dil'), true);
      var d = document.querySelector('.dil-sec[open]'); if (d) d.removeAttribute('open');
    });
  });
  Array.prototype.forEach.call(document.querySelectorAll('[data-magaza]'), function (e) { e.setAttribute('href', A.magaza.ios); });
  if (A.magaza.play) { /* Android sürümü Google Play'de yayına girince uret.py PLAY_BAGLANTISI'nı doldurur. */ }
  if (android && !A.magaza.play) {
    $('izle-magaza').hidden = true; $('izle-magaza').parentNode.hidden = true; $('izle-cta-android').hidden = false;
  }

  /* ---------------------------------------------------------------- başlangıç */
  dilKur(dilBul(), false);
  if (!belirtec) {
    son = { durum: 'yok' }; alinma = Date.now(); bitti = true; ilkYanit = false;
    kok.setAttribute('data-harita', 'yok');
    goster();
  } else {
    sor();
  }
  setInterval(goster, 1000);
})();
