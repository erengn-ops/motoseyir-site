/*
 * Web tur üreticisi — KADRAN (26 Eki 2026). Uygulamadaki "Tur üret" kadranının (moto-rota/src/components/turUretici/TurKadrani.tsx) webdeki karşılığı.
 * Geometri tek kaynak: m/tur/geometri.js (window.TurGeometri, uygulamanın geometri.ts dosyasından paketlenir: tur-araci/derle.mjs --geometri).
 *
 * Haritanın üstünde, başlangıç noktası merkezli: pusula halkası (K, KD, D…, 15°'de bir çentik), tur halkası (seçilen yönde dönen turun şekli ve
 * çapı — haritanın GERÇEK ölçeğinde: halka her an coğrafya), tutamak, duraklar, kuyruklu yıldız, "her yön" taç yaprakları, arama radarı.
 *
 * Jestler: TUTAMAĞI tutup sürüklemek yön + uzunluk (halkanın uzak ucu imlecin altında, km coğrafyadan); kadranın başka yerinden sürüklemek ya da
 * dokunmak yalnız yön; başlangıç noktasını sürüklemek başlangıcı taşır; kadranın dışına tıklamak başlangıcı oraya alır (harita tıklaması).
 * Sekiz ana/ara yöne ±7° mıknatıs, 10 km'de bir tık (görsel). Bırakınca kamera halkayı kadrana oturtur (halka kadrana döner, dünya ölçeklenir).
 * İki yönlü eşleme: panelde yön ızgarası + kaydırgaç (klavye ve ekran okuyucu için) aynı durumu okur/yazar (m/tur/tur.js).
 * Hareket: power3 / expo çıkışı; yay ve sıçrama yok; prefers-reduced-motion: animasyonsuz (jestler çalışır).
 */
(function () {
  'use strict';
  var G = window.TurGeometri;
  if (!G) return;
  var NS = 'http://www.w3.org/2000/svg';
  var PUSULA = ['K', 'KD', 'D', 'GD', 'G', 'GB', 'B', 'KB'];
  var TUTMA = 30;      // tutamak yarıçapı (px) — dokunmatikte rahat yakalansın diye geniş vuruş alanı
  var BASLANGIC_TUTMA = 20;
  var KUYRUK = 4;

  function el(ad, sinif, ust, nitelik) {
    var e = document.createElementNS(NS, ad);
    if (sinif) e.setAttribute('class', sinif);
    if (nitelik) for (var k in nitelik) e.setAttribute(k, nitelik[k]);
    if (ust) ust.appendChild(e);
    return e;
  }
  function div(sinif, ust, html) {
    var e = document.createElement('div');
    e.className = sinif;
    if (html) e.innerHTML = html;
    if (ust) ust.appendChild(e);
    return e;
  }
  function klamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function ease3(t) { return 1 - Math.pow(1 - t, 3); }

  function kur(o) {
    var kok = o.kok, reduce = !!o.reduce;
    var harita = null;
    var s = { cx: 0, cy: 0, pxKm: 1, R: 140, W: 0, H: 0, mod: 'gizli', goster: false, tutuldu: false, hizliYon: -1, faz: 0, ipucu: true, giris: 0, etkin: false };
    var raf = 0, sonKmTik = -1, ciziliyor = false;

    /* ------------------------------------------------------------ DOM */
    kok.innerHTML = '';
    var svg = el('svg', 'kd-svg', kok, { 'aria-hidden': 'true' });
    var gMerkez = el('g', 'kd-merkez', svg);                          // translate(cx cy)
    var gKadran = el('g', 'kd-kadran', gMerkez);
    var gTac = el('g', 'kd-tac', gMerkez);
    var gRadar = el('g', 'kd-radar', gMerkez);
    var gHalka = el('g', 'kd-halka', gMerkez);
    var halkaDolgu = el('path', 'kd-halka-dolgu', gHalka);
    var halkaKenar = el('path', 'kd-halka-kenar', gHalka);
    var halkaBeyaz = el('path', 'kd-halka-beyaz', gHalka);
    var halkaCizgi = el('path', 'kd-halka-cizgi', gHalka);
    var tacYollari = [];
    for (var a = 0; a < 6; a++) {
      var g = el('g', 'kd-tac-yaprak', gTac, { transform: 'rotate(' + a * 60 + ')' });
      el('path', 'kd-halka-beyaz', g); el('path', 'kd-halka-cizgi', g);
      tacYollari.push(g);
    }
    var durakEl = [], kuyrukEl = [];
    for (var i = 0; i < 12; i++) durakEl.push(el('circle', 'kd-durak', gHalka, { r: 6 }));
    for (var k = 0; k < KUYRUK; k++) kuyrukEl.push(el('circle', 'kd-yildiz', gHalka, { r: 4.5 - k * 0.8 }));
    var harfler = PUSULA.map(function (h) { return div('kd-harf', kok, h); });
    var disk = div('kd-disk', kok);                                    // etkileşim alanı (kadranın diski)
    var baslangic = div('kd-baslangic', kok, '<i class="nabiz"></i><i class="dis"><i class="ic"></i></i>');
    var etiket = div('kd-etiket', kok, '<b class="km"></b><span class="sure"></span><em class="yon"></em>');
    var tutamak = div('kd-tutamak', kok, '<i class="hale"></i><i class="gov"><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M12 19V6M6 11.5 12 5.5l6 6" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg></i>');
    var tutamakOk = tutamak.querySelector('.gov svg');
    var ipucu = div('kd-ipucu', kok, '<span></span>');
    ipucu.firstChild.textContent = o.ipucuYazi || '';
    var kmEl = etiket.querySelector('.km'), sureEl = etiket.querySelector('.sure'), yonEl = etiket.querySelector('em');

    /* ------------------------------------------------------------ kadran (statik çizim; R değişince yeniden) */
    var kadranR = -1;
    function kadranCiz() {
      if (kadranR === s.R) return;
      kadranR = s.R;
      gKadran.innerHTML = '';
      var r = s.R;
      el('circle', 'kd-kadran-golge', gKadran, { r: r });
      el('circle', 'kd-kadran-halka', gKadran, { r: r });
      for (var i = 0; i < 24; i++) {
        var ana = i % 3 === 0, aci = i * 15 * Math.PI / 180, r1 = r - (ana ? 9 : 5);
        el('line', 'kd-centik' + (ana ? ' ana' : ''), gKadran, { x1: Math.sin(aci) * r1, y1: -Math.cos(aci) * r1, x2: Math.sin(aci) * r, y2: -Math.cos(aci) * r });
      }
      var w = r * 1.15;
      gRadar.innerHTML = '';
      var ac = 50 * Math.PI / 180;
      var yol = el('path', 'kd-radar-dilim', gRadar, { d: 'M0 0 L0 ' + (-w) + ' A' + w + ' ' + w + ' 0 0 1 ' + (Math.sin(ac) * w) + ' ' + (-Math.cos(ac) * w) + ' Z' });
      void yol;
      el('line', 'kd-radar-cizgi', gRadar, { x1: 0, y1: 0, x2: Math.sin(ac) * w, y2: -Math.cos(ac) * w });
      harfler.forEach(function (h, n) {
        var p = G.dondur(0, -(r + 17), n * 45);
        h._x = p[0]; h._y = p[1];
      });
    }

    /* ------------------------------------------------------------ geometri */
    function olc() {
      harita = o.harita();
      var d = o.durum();
      if (!harita || !d.S) return null;
      var c = harita.getContainer();
      s.W = c.clientWidth; s.H = c.clientHeight;
      var p = harita.project([d.S.longitude, d.S.latitude]);
      var kx = 111.32 * Math.cos(d.S.latitude * Math.PI / 180);
      var q = harita.project([d.S.longitude + 10 / kx, d.S.latitude]);
      s.cx = p.x; s.cy = p.y;
      s.pxKm = Math.max(1e-4, Math.hypot(q.x - p.x, q.y - p.y) / 10);
      return d;
    }
    /* Kadran yarıçapı: haritanın panelin/sayfanın örtmediği alanına sığan */
    function yaricap() {
      var pay = o.pay ? o.pay() : { sag: 0, alt: 0, ust: 0, sol: 0 };
      var cw = (s.W - pay.sag - pay.sol), ch = (s.H - pay.alt - pay.ust);
      s.R = klamp(Math.min(cw, ch) / 2 - 56, 78, 300);
    }
    function halkaUzunlugu(d) { return G.capKmW(d.km, d.seviye) * s.pxKm; }

    function halkaYolu(D, yon, n) {
      var kv = G.KIVRIM[o.durum().seviye], r = D / 2, dg = '';
      for (var i = 0; i <= n; i++) {
        var p = G.halkaNoktasi(i / n, r, kv.genlik, kv.frekans);
        if (yon != null) p = G.dondur(p[0], p[1], yon);
        dg += (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1);
      }
      return dg + 'Z';
    }
    function halkaNok(u, D, yon) {
      var kv = G.KIVRIM[o.durum().seviye], p = G.halkaNoktasi(u, D / 2, kv.genlik, kv.frekans);
      return G.dondur(p[0], p[1], yon);
    }

    /* ------------------------------------------------------------ çizim */
    function ciz() {
      var d = olc();
      if (!d) { kok.classList.remove('gor'); return; }
      yaricap(); kadranCiz();
      var D = halkaUzunlugu(d), yon = d.yon, her = d.herYon;
      gMerkez.setAttribute('transform', 'translate(' + s.cx.toFixed(1) + ' ' + s.cy.toFixed(1) + ')');
      kok.style.setProperty('--r', s.R + 'px');
      // halka
      var yol = halkaYolu(D, her ? null : yon, 96);
      if (!her) { [halkaDolgu, halkaKenar, halkaBeyaz, halkaCizgi].forEach(function (p) { p.setAttribute('d', yol); }); }
      else {
        var tacD = halkaYolu(D, null, 72);
        tacYollari.forEach(function (g) { g.firstChild.setAttribute('d', tacD); g.lastChild.setAttribute('d', tacD); });
      }
      // duraklar
      var dn = G.durakSayisi(d.km);                                   // motorla aynı (webde 300 km üstü artıyor)
      durakEl.forEach(function (c, i) {
        if (i >= dn) { c.style.display = 'none'; return; }
        c.style.display = '';
        var p = halkaNok((i + 1) / (dn + 1), D, yon);
        c.setAttribute('cx', p[0].toFixed(1)); c.setAttribute('cy', p[1].toFixed(1));
      });
      // tutamak ve etiket
      var th = G.dondur(0, -D, yon), em = G.dondur(0, -D / 2, yon);
      tutamak.style.transform = 'translate3d(' + (s.cx + th[0]).toFixed(1) + 'px,' + (s.cy + th[1]).toFixed(1) + 'px,0)';
      tutamakOk.style.transform = 'rotate(' + yon.toFixed(1) + 'deg)';
      etiket.style.transform = 'translate3d(' + (s.cx + em[0]).toFixed(1) + 'px,' + (s.cy + em[1]).toFixed(1) + 'px,0)';
      baslangic.style.transform = 'translate3d(' + s.cx.toFixed(1) + 'px,' + s.cy.toFixed(1) + 'px,0)';
      var y = o.yazilar();
      if (kmEl.textContent !== y.buyuk) kmEl.textContent = y.buyuk;
      if (sureEl.textContent !== y.kucuk) sureEl.textContent = y.kucuk;
      var ya = her ? y.herYon : y.yon;
      if (yonEl.textContent !== ya) yonEl.textContent = ya;
      // etkileşim diski
      var dr = s.R + 40;
      disk.style.width = disk.style.height = (2 * dr) + 'px';
      disk.style.transform = 'translate3d(' + (s.cx - dr).toFixed(1) + 'px,' + (s.cy - dr).toFixed(1) + 'px,0)';
      tutamak.style.setProperty('--tut', TUTMA * 2 + 'px');
      // pusula harflerini başlangıca taşı
      harfler.forEach(function (h, n) {
        h.style.transform = 'translate3d(' + (s.cx + h._x).toFixed(1) + 'px,' + (s.cy + h._y).toFixed(1) + 'px,0)';
        var fark = Math.abs((((yon - n * 45) % 360) + 540) % 360 - 180);
        h.classList.toggle('ortulu', !her && fark < 24 && s.mod === 'ayar');
      });
      ipucu.style.transform = 'translate3d(' + s.cx.toFixed(1) + 'px,' + (s.cy + s.R * 0.5).toFixed(1) + 'px,0)';
      kok.classList.toggle('her', !!her);
      kuyrukCiz(d, D, yon);
    }
    function kuyrukCiz(d, D, yon) {
      if (!s.goster || d.herYon) return;
      kuyrukEl.forEach(function (c, i) {
        var u = s.faz - i * 0.011; u -= Math.floor(u);
        var p = halkaNok(u, D, yon);
        c.setAttribute('cx', p[0].toFixed(1)); c.setAttribute('cy', p[1].toFixed(1));
        c.style.opacity = (1 - i * 0.22).toFixed(2);
      });
    }
    function istek() { if (!ciziliyor) { ciziliyor = true; requestAnimationFrame(function () { ciziliyor = false; if (s.goster) ciz(); }); } }

    /* kuyruklu yıldız döngüsü (yalnız kadran görünürken) */
    var t0 = 0;
    function dongu(t) {
      raf = 0;
      if (!s.goster || reduce) return;
      var d = o.durum();
      var sure = d.seviye === 1 ? 5200 : d.seviye === 2 ? 6800 : 8400;
      if (!t0) t0 = t;
      s.faz = ((t - t0) / sure) % 1;
      if (d.S && !d.herYon) { var D = halkaUzunlugu(d); kuyrukCiz(d, D, d.yon); }
      raf = requestAnimationFrame(dongu);
    }
    function dongubaslat() { if (!raf && !reduce && s.goster) raf = requestAnimationFrame(dongu); }

    /* ------------------------------------------------------------ mod / görünürlük */
    function mod(m) {
      s.mod = m;
      var gor = (m === 'ayar' || m === 'ara') && !!o.durum().S;
      s.goster = gor;
      s.etkin = m === 'ayar' && gor;
      kok.classList.toggle('ayar', m === 'ayar');
      if (m !== 'ayar') kok.classList.remove('ipucu');
      kok.classList.toggle('ara', m === 'ara');
      kok.classList.toggle('gor', gor);
      disk.style.pointerEvents = s.etkin ? 'auto' : 'none';
      tutamak.style.pointerEvents = s.etkin && !o.durum().herYon ? 'auto' : 'none';
      if (o.etkinDegisti) o.etkinDegisti(s.etkin, gor);
      if (gor) { ciz(); dongubaslat(); }
    }

    /* ------------------------------------------------------------ jestler */
    var jest = null, uzun = 0;
    function yonuYaz(x, y, dokunus) {
      var dx = x - s.cx, dy = y - s.cy;
      if (Math.hypot(dx, dy) < 14) return;
      var der = Math.atan2(dx, -dy) * 180 / Math.PI; if (der < 0) der += 360;
      var yk = G.enYakinYon(der);
      if (yk.fark < 7) { der = yk.i * 45; if (s.hizliYon !== yk.i) { s.hizliYon = yk.i; tik('yon', yk.i); } } else s.hizliYon = -1;
      var d = o.durum();
      if (dokunus && !reduce) animYon(d.yon, der); else o.yaz({ yon: der, herYon: false });
      if (dokunus && reduce) o.yaz({ yon: der, herYon: false });
      istek();
    }
    var yonAnim = 0;
    function animYon(bas, hedef) {
      cancelAnimationFrame(yonAnim);
      var fark = ((hedef - bas + 540) % 360) - 180, t0 = 0;
      function adim(t) {
        if (!t0) t0 = t;
        var k = Math.min(1, (t - t0) / 320);
        o.yaz({ yon: (bas + fark * ease3(k) + 360) % 360, herYon: false }); ciz();
        if (k < 1) yonAnim = requestAnimationFrame(adim);
      }
      yonAnim = requestAnimationFrame(adim);
    }
    function kmYaz(x, y) {
      var d = o.durum();
      var dist = Math.hypot(x - s.cx, y - s.cy);
      var k = d.seviye === 1 ? 1.3 : d.seviye === 2 ? 1.45 : 1.55;
      var yeni = klamp((dist / s.pxKm) * k * Math.PI, G.KM_EN_AZ, G.KM_EN_COK);
      o.yaz({ km: yeni });
      var adim = G.cetvelAdimi(d.sure, d.seviye), oturtulmus = Math.round(G.adimaOturt(yeni, adim));
      if (oturtulmus !== sonKmTik) { if (sonKmTik !== -1) tik('km'); sonKmTik = oturtulmus; }
    }
    function tik(tur) {
      if (reduce) return;
      var hedef = tur === 'km' ? etiket : harfler[arguments[1]];
      if (!hedef) return;
      hedef.classList.remove('tik'); void hedef.offsetWidth; hedef.classList.add('tik');
    }
    function konum(e) {
      var r = kok.getBoundingClientRect();
      return [e.clientX - r.left, e.clientY - r.top];
    }
    function ipucuKapat() { if (s.ipucu) { s.ipucu = false; kok.classList.remove('ipucu'); if (o.dokunuldu) o.dokunuldu(); } }

    function basla(e, tur) {
      if (!s.etkin || (e.pointerType === 'mouse' && e.button !== 0)) return;
      var p = konum(e);
      // ikinci parmak: tutma kalkar, kıstırarak yakınlaştırma
      if (jest && jest.tur !== 'kistir' && e.pointerType === 'touch') { jest.ikinci = { id: e.pointerId, x: p[0], y: p[1] }; jest.tur = 'kistir'; jest.z0 = harita.getZoom(); jest.d0 = Math.hypot(p[0] - jest.x, p[1] - jest.y); try { e.target.setPointerCapture(e.pointerId); } catch (x) { /* eski */ } e.preventDefault(); return; }
      if (jest) return;
      ipucuKapat();
      var d = o.durum();
      var tur2 = tur;
      if (!tur2) {
        var dBas = Math.hypot(p[0] - s.cx, p[1] - s.cy);
        tur2 = dBas < BASLANGIC_TUTMA ? 'baslangic' : 'yon';
      }
      jest = { id: e.pointerId, tur: tur2, x: p[0], y: p[1], x0: p[0], y0: p[1], hareket: false, d: d };
      try { e.target.setPointerCapture(e.pointerId); } catch (x) { /* eski */ }
      e.preventDefault(); e.stopPropagation();
      kok.classList.add('tut');
      if (tur2 === 'tutamak') { s.tutuldu = true; tutamak.classList.add('tutuldu'); sonKmTik = -1; }
      if (o.jestBasladi) o.jestBasladi(tur2);
      if (tur2 === 'yon' && !d.herYon) { /* dokunuş yönü: bırakınca (hareket yoksa) */ }
    }
    function tasi(e) {
      if (!jest) return;
      var p = konum(e);
      if (jest.tur === 'kistir') {
        if (e.pointerId === jest.id) { jest.x = p[0]; jest.y = p[1]; } else if (jest.ikinci && e.pointerId === jest.ikinci.id) { jest.ikinci.x = p[0]; jest.ikinci.y = p[1]; } else return;
        var dd = Math.hypot(jest.ikinci.x - jest.x, jest.ikinci.y - jest.y);
        if (jest.d0 > 10) harita.setZoom(klamp(jest.z0 + Math.log2(dd / jest.d0), harita.getMinZoom(), 16.5));
        return;
      }
      if (e.pointerId !== jest.id) return;
      var dx = p[0] - jest.x0, dy = p[1] - jest.y0;
      if (!jest.hareket && Math.hypot(dx, dy) > 3) jest.hareket = true;
      if (!jest.hareket) return;
      if (jest.tur === 'baslangic') {
        // başlangıç noktasını taşırken kadran onunla gelir: sanal olarak yalnız noktayı göster
        var ll = harita.unproject([p[0], p[1]]);
        jest.yeni = { latitude: ll.lat, longitude: ll.lng };
        baslangic.style.transform = 'translate3d(' + p[0].toFixed(1) + 'px,' + p[1].toFixed(1) + 'px,0)';
        return;
      }
      if (jest.tur === 'tutamak') { kmYaz(p[0], p[1]); yonuYaz(p[0], p[1], false); }
      else yonuYaz(p[0], p[1], false);
      istek();
    }
    function bitir(e, iptal) {
      if (!jest) return;
      if (jest.tur === 'kistir') {
        if (e && e.pointerId === (jest.ikinci || {}).id) { jest.tur = 'yon'; jest.hareket = true; jest.ikinci = null; return; }
        jest = null; kok.classList.remove('tut'); return;
      }
      if (e && e.pointerId !== jest.id) return;
      var j = jest; jest = null;
      kok.classList.remove('tut'); tutamak.classList.remove('tutuldu'); s.tutuldu = false;
      if (iptal) { istek(); return; }
      if (j.tur === 'baslangic') {
        if (j.yeni) o.baslangicTasi(j.yeni); else istek();
        return;
      }
      if (j.tur === 'yon' && !j.hareket) { var p = konum(e); yonuYaz(p[0], p[1], true); }
      o.bitti();
    }

    disk.addEventListener('pointerdown', function (e) { basla(e, null); });
    tutamak.addEventListener('pointerdown', function (e) { basla(e, 'tutamak'); });
    [disk, tutamak].forEach(function (n) {
      n.addEventListener('pointermove', tasi);
      n.addEventListener('pointerup', function (e) { bitir(e, false); });
      n.addEventListener('pointercancel', function (e) { bitir(e, true); });
    });
    // fare tekerleği: harita yakınlaştırsın (disk olayı yutuyor)
    [disk, tutamak].forEach(function (n) {
      n.addEventListener('wheel', function (e) {
        e.preventDefault();
        var h = o.harita(); if (!h) return;
        h.getCanvasContainer().dispatchEvent(new WheelEvent('wheel', { deltaX: e.deltaX, deltaY: e.deltaY, deltaMode: e.deltaMode, clientX: e.clientX, clientY: e.clientY, ctrlKey: e.ctrlKey, bubbles: true, cancelable: true }));
      }, { passive: false });
    });
    // imleç: tutamağın üstünde grab
    disk.addEventListener('pointermove', function (e) { if (!jest) { var p = konum(e); disk.style.cursor = Math.hypot(p[0] - s.cx, p[1] - s.cy) < BASLANGIC_TUTMA ? 'move' : 'crosshair'; } });

    var h0 = o.harita();
    if (h0) { h0.on('move', istek); h0.on('resize', istek); h0.on('zoom', istek); }

    /* ------------------------------------------------------------ dış arayüz */
    var api = {
      guncelle: istek,
      ciz: function () { if (s.goster) ciz(); },
      mod: mod,
      etkin: function () { return s.etkin; },
      yaricap: function () { yaricap(); return s.R; },
      pxKm: function () { return s.pxKm; },
      ipucu: function (var_) { s.ipucu = !!var_; kok.classList.toggle('ipucu', !!var_ && s.etkin); },
      /* Halka kadrana otursun: harita ölçeği = kadran yarıçapı / turun kuş uçuşu çapı; başlangıç boş alanın ortasında. */
      cerceve: function (sure) {
        var d = o.durum(), h = o.harita();
        if (!d.S || !h) return;
        olc(); yaricap();
        var pxKm = s.R / G.capKm(d.km, d.seviye);
        var z = Math.log2(pxKm * 40075.016 * Math.cos(d.S.latitude * Math.PI / 180) / 512);
        z = klamp(z, h.getMinZoom(), 14.5);
        var hedef = { center: [d.S.longitude, d.S.latitude], zoom: z, bearing: 0, duration: reduce ? 0 : (sure == null ? 600 : sure), easing: ease3 };
        if (o.kamera) o.kamera('easeTo', hedef); else h.easeTo(hedef);   // tur.js kameraGit: önce hedefin karoları (28 Eki)
      },
      yok: function () { cancelAnimationFrame(raf); kok.innerHTML = ''; }
    };
    return api;
  }
  window.TurKadran = { kur: kur };
})();
