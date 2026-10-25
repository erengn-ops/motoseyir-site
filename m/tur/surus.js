/*
 * Web tur üreticisi — motor seçimi ve tur önizleme sürüşü (26 Eki 2026).
 *
 * 1) Motor seçimi: dört motor (uygulamadaki işaretler). Dönen motor kare geçişli canvas'ı m/a.js'in (anasayfadaki aynı kod, MH.motor.tip)
 *    çiziyor; burada yalnız seçim, saklama ve boşta ısıtma var.
 * 2) Sürüş önizlemesi: tur üretilince seçilen motor işareti turu baştan sona "sürer". Motor, yolun yönüne bakar (uygulamanın 72 karelik
 *    harita işareti, 5°'lik adım); kamera yumuşakça arkasından gelir; altın iz çizgi ilerlemesiyle (line-progress) birlikte uzar;
 *    km sayacı akar; dağ geçidine gelince rozet çıkar. "Önizlemeyi atla", haritaya dokunmak ya da kart değiştirmek sürüşü bitirir.
 *    prefers-reduced-motion: sürüş hiç başlamaz (içerik aynı: çizgi ve duraklar zaten haritada).
 * Hareket kuralı: power3 / expo çıkışı, elastik ve sıçrama yok; yalnız transform/opacity + MapLibre kamerası.
 * Hesap ve harita tur.js'te kalır; buraya window.TurKancasi ve tur:* olaylarıyla bağlanır.
 */
(function () {
  'use strict';
  var W = window, D = document;
  var K = W.TurKancasi;
  if (!K) return;
  var reduce = K.reduce;
  var TIPLER = ['supersport', 'chopper', 'scooter', 'touring'];
  var ANAHTAR = 'motoseyir.web.arac';
  var arac = 'touring';
  try { var kayit = localStorage.getItem(ANAHTAR); if (TIPLER.indexOf(kayit) >= 0) arac = kayit; } catch (e) { /* depolama kapalı */ }
  var $ = function (s) { return D.querySelector(s); };

  function baslat() {
    var MH = W.MH || {};
    var kareler = {}, temas = {};
    function yukleKareler(tip) {
      if (reduce) return [];                       // sürüş yok: kare indirmeye gerek yok
      if (kareler[tip]) return kareler[tip];
      var liste = [];
      for (var a = 0; a < 360; a += 5) { var im = new Image(); im.decoding = 'async'; im.src = '/m/tur/arac/' + tip + '-' + ('00' + a).slice(-3) + '.webp'; liste.push(im); }
      kareler[tip] = liste;
      fetch('/m/tur/arac/temas-' + tip + '.json').then(function (r) { return r.json(); }).then(function (j) { temas[tip] = j; }).catch(function () { /* ortalanmış kalır */ });
      return liste;
    }
    /* ---------------------------------------------------------------- motor seçimi */
    var grup = $('#tur-tipler');
    if (grup) {
      var radyolar = Array.prototype.slice.call(grup.querySelectorAll('input[name=arac]'));
      radyolar.forEach(function (r) {
        r.checked = r.value === arac;
        var ac = function () { if (MH.motor) MH.motor.yukle(r.value); yukleKareler(r.value); };
        var et = r.closest('label');
        if (et) { et.addEventListener('pointerenter', ac); et.addEventListener('focusin', ac); et.addEventListener('touchstart', ac, { passive: true }); }
      });
      grup.addEventListener('change', function (e) {
        if (e.target.name !== 'arac') return;
        arac = e.target.value;
        try { localStorage.setItem(ANAHTAR, arac); } catch (x) { /* sorun değil */ }
        if (MH.motor) MH.motor.tip(arac);
        yukleKareler(arac);
      });
      if (arac !== 'touring' && MH.motor) MH.motor.tip(arac, true);
    }

    /* ---------------------------------------------------------------- sürüş önizlemesi */
    var kat = $('#tur-surus'), kmEl = $('#tur-surus-km'), cubuk = $('#tur-surus-cubuk'), gecitEl = $('#tur-surus-gecit');
    var atla = $('#tur-surus-atla'), tekrar = $('#tur-surus-tekrar');
    if (!kat || reduce) { if (tekrar) tekrar.hidden = true; return; }

    function kareHazir(im) { return im && im.complete && im.naturalWidth > 0; }

    var st = { calisiyor: false, iptal: null, bekle: 0, gorunur: true };
    var harita = null, isaret = null, tuval = null, tg = null, simge = null;

    function gradyan(p) {
      var altin = '#F4B63F';
      return p >= 1 ? ['interpolate', ['linear'], ['line-progress'], 0, altin, 1, altin] : ['step', ['line-progress'], altin, Math.max(p, 0.00005), 'rgba(0,0,0,0)'];
    }
    function aci(a, b) { // en kısa yoldan fark (derece)
      return ((b - a) % 360 + 540) % 360 - 180;
    }
    function yon(c0, c1) {
      var kx = Math.cos(((c0.latitude + c1.latitude) / 2) * Math.PI / 180);
      var dx = (c1.longitude - c0.longitude) * kx, dy = c1.latitude - c0.latitude;
      return ((Math.atan2(dx, dy) * 180 / Math.PI) + 360) % 360;
    }

    function iptal(temiz) {
      clearTimeout(st.bekle);
      if (st.iptal) { var f = st.iptal; st.iptal = null; f(!!temiz); }
    }

    function sur() {
      iptal(true);
      var tur = K.tur(), h = K.harita();
      if (!tur || !h || K.evre() !== 'sonuc' || (K.kip() !== 'uret' && K.kip() !== 'duzen') || tur.coordinates.length < 2) return;
      harita = h;
      var ham = tur.coordinates, cum = K.kumulatif(ham), top = cum[cum.length - 1] || 1;
      var tip = arac, kare = yukleKareler(tip);
      var sure = Math.max(12, Math.min(24, 8 + top * 0.055));
      var z0 = top < 80 ? 11.6 : top < 160 ? 11 : 10.4;
      var pencere = Math.max(0.3, Math.min(1.4, top * 0.006));

      function nokta(d) { // d (km) → { c, i }
        d = Math.max(0, Math.min(top, d));
        var lo = 0, hi = cum.length - 1;
        while (hi - lo > 1) { var m = (lo + hi) >> 1; if (cum[m] <= d) lo = m; else hi = m; }
        var f = (cum[hi] - cum[lo]) > 0 ? (d - cum[lo]) / (cum[hi] - cum[lo]) : 0;
        return { latitude: ham[lo].latitude + (ham[hi].latitude - ham[lo].latitude) * f, longitude: ham[lo].longitude + (ham[hi].longitude - ham[lo].longitude) * f };
      }
      // geçitler: rota üstündeki konumlarıyla
      var gecitler = (tur.gecitler || []).map(function (g) { return { g: g, d: cum[K.enYakinIndeks(ham, g.lat, g.lon)], goster: false }; }).sort(function (a, b) { return a.d - b.d; });

      // motor işareti (tuval: yüz ölçüsünde kare geçişi, titreme/yanıp sönme yok)
      var boy = W.innerWidth <= 520 ? 64 : 76;
      var el = D.createElement('div'); el.className = 'tur-surus-isaret';
      tuval = D.createElement('canvas'); tuval.width = tuval.height = 144; tuval.style.width = tuval.style.height = boy + 'px';
      el.appendChild(tuval); tg = tuval.getContext('2d');
      isaret = new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat([ham[0].longitude, ham[0].latitude]).addTo(harita);
      var son = -1;
      function ciz(h) {
        var i = Math.round(h / 5) % 72; if (i < 0) i += 72;
        var im = kare[i];
        if (!kareHazir(im)) { for (var k = 1; k < 36 && !kareHazir(im); k++) im = kare[(i + (k % 2 ? k : -k) + 72) % 72]; }
        if (!kareHazir(im)) return;
        if (i !== son || !son) { tg.clearRect(0, 0, 144, 144); tg.drawImage(im, 0, 0); son = i; }
        var t = temas[tip] && temas[tip][i];
        if (t) tuval.style.transform = 'translate(' + ((0.5 - t[0]) * boy).toFixed(1) + 'px,' + ((0.5 - t[1]) * boy).toFixed(1) + 'px)';
      }

      // altın iz (line-progress)
      var iz = 'surus-iz';
      if (!harita.getLayer(iz)) harita.addLayer({ id: iz, type: 'line', source: 'secili', layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-gradient': gradyan(0), 'line-width': 5.5 } }, 'bas-halka');

      kat.hidden = false; kmEl.textContent = K.mesafe(0); cubuk.style.transform = 'scaleX(0)'; gecitEl.innerHTML = ''; gecitEl.classList.remove('goster');
      requestAnimationFrame(function () { kat.classList.add('on'); });
      if (tekrar) tekrar.hidden = true;
      st.calisiyor = true; var aracKok = $('#arac'); if (aracKok) aracKok.classList.add('surus-acik');

      var yerGoster = {}, raf = 0, zaman = 0, ilkMs = 0, bitti = false, h0 = yon(ham[0], nokta(pencere)), kamC = { lng: ham[0].longitude, lat: ham[0].latitude }, gizle = 0, sonYazi = '';
      var yakalaDuzenle = function (e) { if (e.originalEvent) iptal(false); };
      harita.on('movestart', yakalaDuzenle);

      function temizle(sigdir) {
        if (bitti) return; bitti = true;
        cancelAnimationFrame(raf); clearTimeout(gizle);
        harita.off('movestart', yakalaDuzenle);
        st.calisiyor = false; var aracKok2 = $('#arac'); if (aracKok2) aracKok2.classList.remove('surus-acik');
        var m = isaret; isaret = null;
        if (m) { m.getElement().classList.add('git'); setTimeout(function () { m.remove(); }, 450); }
        try { if (harita.getLayer(iz)) harita.removeLayer(iz); } catch (e) { /* harita kaldırıldı */ }
        kat.classList.remove('on');
        setTimeout(function () { if (!st.calisiyor) kat.hidden = true; }, 700);
        gecitEl.classList.remove('goster');
        if (tekrar && K.evre() === 'sonuc') tekrar.hidden = false;
        if (sigdir) {
          var b = new maplibregl.LngLatBounds();
          K.tur() && K.tur().coordinates.forEach(function (c) { b.extend([c.longitude, c.latitude]); });
          if (!b.isEmpty()) harita.fitBounds(b, K.kamera({ padding: 40, maxZoom: 13, duration: 1100 }));
        }
      }
      // iptal(false): kullanıcı haritaya dokundu / sonuç değişti → kamera olduğu yerde kalsın; iptal(true): atla ya da bitiş → tura sığdır
      st.iptal = function (sigdir) { temizle(sigdir); };

      function gecitRozeti(g) {
        gecitEl.innerHTML = '<span class="ik">' + K.gecitIkon(g.ad, 30) + '</span><span><b>' + esc(g.ad) + '</b> <span class="m">' + K.yukseklik(g.rakimM) + '</span></span>';
        gecitEl.classList.add('goster');
        clearTimeout(gizle); gizle = setTimeout(function () { gecitEl.classList.remove('goster'); }, 2800);
      }
      function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

      var A = 0.09, V = 1 / (1 - A); // hızlanma/yavaşlama payı; arada sabit hız
      function ilerleme(u) {
        if (u <= 0) return 0; if (u >= 1) return 1;
        if (u < A) return V * u * u / (2 * A);
        if (u > 1 - A) return 1 - V * (1 - u) * (1 - u) / (2 * A);
        return V * (u - A / 2);
      }
      function adim(ts) {
        if (bitti) return;
        raf = requestAnimationFrame(adim);
        if (!ilkMs) { ilkMs = ts; return; }
        var dt = Math.min(0.05, (ts - ilkMs) / 1000); ilkMs = ts;
        if (!st.gorunur) return;
        zaman += dt;
        var u = Math.min(1, zaman / sure), p = ilerleme(u), d = p * top;
        var c = nokta(d), ileri = nokta(d + pencere), geri = nokta(d - pencere * 0.4);
        // yön: yolun gideceği yön, yumuşatılmış
        var hedef = yon(geri, ileri);
        h0 = (h0 + aci(h0, hedef) * Math.min(1, dt * 7) + 360) % 360;
        ciz(h0);
        isaret.setLngLat([c.longitude, c.latitude]);
        // kamera: işaretin biraz arkasından, üstel yumuşatma (power3'e yakın, hız değişimini emer)
        var k = 1 - Math.exp(-dt * 3.4);
        kamC.lng += (c.longitude - kamC.lng) * k; kamC.lat += (c.latitude - kamC.lat) * k;
        harita.jumpTo({ center: [kamC.lng, kamC.lat], zoom: z0 });
        harita.setPaintProperty(iz, 'line-gradient', gradyan(p));
        cubuk.style.transform = 'scaleX(' + p.toFixed(4) + ')';
        var yazi = K.mesafe(top * p);
        if (yazi !== sonYazi) { kmEl.textContent = yazi; sonYazi = yazi; }
        var yl = K.yerler ? K.yerler() : [];
        for (var yi = 0; yi < yl.length; yi++) if (!yerGoster[yl[yi].i + ':' + yl[yi].ad] && yl[yi].m != null && d * 1000 >= yl[yi].m - 120) {
          yerGoster[yl[yi].i + ':' + yl[yi].ad] = 1; K.yerVurgu(yl[yi].i);
          if (!gecitEl.classList.contains('goster')) {
            gecitEl.innerHTML = '<span class="ik yerik">' + K.yerIkon(yl[yi].kat || 'manzara') + '</span><span><b>' + esc(yl[yi].ad) + '</b></span>';
            gecitEl.classList.add('goster'); clearTimeout(gizle); gizle = setTimeout(function () { gecitEl.classList.remove('goster'); }, 2200);
          }
        }
        for (var i = 0; i < gecitler.length; i++) if (!gecitler[i].goster && d >= gecitler[i].d - 0.2) { gecitler[i].goster = true; gecitRozeti(gecitler[i].g); }
        if (u >= 1) { cancelAnimationFrame(raf); raf = 0; kmEl.textContent = K.mesafe(top); setTimeout(function () { temizle(true); }, 500); }
      }
      // başlangıca uçuş (1,1 sn), ardından sürüş
      isaret.getElement().classList.add('goster');
      ciz(h0);
      var basladi = false;
      var git = function () { if (basladi || bitti) return; basladi = true; raf = requestAnimationFrame(adim); };
      harita.once('moveend', git);
      setTimeout(git, 1500);
      harita.easeTo(K.kamera({ center: [ham[0].longitude, ham[0].latitude], zoom: z0, duration: 1100 }));
    }

    if (atla) atla.addEventListener('click', function () { iptal(true); });
    if (tekrar) tekrar.addEventListener('click', function () { clearTimeout(st.bekle); sur(); });

    var gozlem = 'IntersectionObserver' in W && new IntersectionObserver(function (es) { st.gorunur = es[0].isIntersecting; }, { threshold: .15 });
    var sar = $('#tur-harita'); if (gozlem && sar) gozlem.observe(sar);

    W.addEventListener('tur:iptal', function () { iptal(false); if (tekrar) tekrar.hidden = true; });
    W.addEventListener('tur:sonuc', function (e) {
      if (tekrar) tekrar.hidden = false;
      if (e.detail && e.detail.yeni && K.kip() === 'uret') {
        yukleKareler(arac);
        clearTimeout(st.bekle);
        st.bekle = setTimeout(sur, 2100);   // yol çizilip kamera oturduktan sonra
      }
    });
    W.TurSurus = { sur: sur, iptal: iptal };
  }
  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', baslat); else baslat();
})();
