/*
 * Web tur üreticisi — yerleşim (26 Eki 2026): mobilde alttan açılan sayfa (kapalı / yarım / açık) ve haritanın "boş alanı".
 * Masaüstünde panel haritanın sağında yüzer; mobilde haritanın altını örter. Kamera ve kadran, panelin örtmediği alanı kullansın diye
 * haritaya padding yazılır (tur.js: tur:yerlesim olayı → harita.setPadding). Burada yalnız sayfa: sürükleme, durumlar, CSS değişkenleri.
 * Hareket: expo çıkışı; yay yok. prefers-reduced-motion: geçiş yok.
 */
(function () {
  'use strict';
  var W = window, D = document;
  var kok = D.getElementById('arac'), panel = D.getElementById('tur-panel'), tutamac = D.getElementById('tur-tutamac');
  if (!kok || !panel) return;
  var reduce = W.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var mobil = function () { return W.innerWidth < 900; };
  var durum = 'yarim', surukle = null, gorunen = 0;

  function boyutlar() {
    var H = kok.clientHeight, ph = panel.offsetHeight || H * .92;
    return { kapali: 136, yarim: Math.round(H * .46), acik: Math.round(ph), ph: ph };
  }
  function yaz(px, hemen) {
    var b = boyutlar();
    gorunen = Math.max(0, Math.min(b.ph, px));
    kok.style.setProperty('--gizli', (b.ph - gorunen).toFixed(1) + 'px');
    kok.style.setProperty('--sheet-gor', gorunen.toFixed(1) + 'px');
    kok.style.setProperty('--alt-pay', mobil() ? gorunen.toFixed(1) + 'px' : '0px');
    panel.classList.toggle('surukle', !!hemen);
  }
  function ayarla(d, sessiz) {
    if (!mobil()) { durum = d; panel.dataset.sheet = d; kok.style.setProperty('--gizli', '0px'); kok.style.setProperty('--alt-pay', '0px'); bildir(); return; }
    durum = d; panel.dataset.sheet = d;
    var b = boyutlar();
    yaz(b[d], false);
    if (tutamac) tutamac.setAttribute('aria-expanded', d !== 'kapali' ? 'true' : 'false');
    if (!sessiz) bildir();
    else setTimeout(bildir, reduce ? 0 : 560);
  }
  var bekle = 0;
  function bildir() {
    clearTimeout(bekle);
    bekle = setTimeout(function () { W.dispatchEvent(new CustomEvent('tur:yerlesim')); }, 30);
  }

  /* alta kaydırılmış sayfadaki bir öğeye odak verilince tarayıcı kabı kaydırır; harita yukarı kaçmasın */
  kok.addEventListener('scroll', function () { if (kok.scrollTop) kok.scrollTop = 0; });
  var sonSurukle = 0;
  if (tutamac) {
    tutamac.addEventListener('click', function () { if (performance.now() - sonSurukle < 350) return; ayarla(durum === 'kapali' ? 'yarim' : durum === 'yarim' ? 'acik' : 'kapali'); });
    tutamac.addEventListener('pointerdown', function (e) {
      if (!mobil()) return;
      surukle = { y0: e.clientY, g0: gorunen, t0: performance.now(), y: e.clientY, t: performance.now(), hareket: false };
      try { tutamac.setPointerCapture(e.pointerId); } catch (x) { /* eski */ }
    });
    tutamac.addEventListener('pointermove', function (e) {
      if (!surukle) return;
      var dy = e.clientY - surukle.y0;
      if (Math.abs(dy) > 4) surukle.hareket = true;
      if (!surukle.hareket) return;
      surukle.y = e.clientY; surukle.t = performance.now();
      yaz(surukle.g0 - dy, true);
    });
    var birak = function () {
      if (!surukle) return;
      var s = surukle; surukle = null;
      panel.classList.remove('surukle');
      if (!s.hareket) return;
      sonSurukle = performance.now();
      var b = boyutlar(), az = (s.y - s.y0) / Math.max(1, s.t - s.t0);   // px/ms, aşağı +
      var hedefPx = gorunen - az * 120;                                  // savurma: hızlı hareket bir sonraki duruma geçirir
      var en = ['kapali', 'yarim', 'acik'].map(function (k) { return [k, Math.abs(b[k] - hedefPx)]; }).sort(function (a, c) { return a[1] - c[1]; });
      ayarla(en[0][0]);
    };
    tutamac.addEventListener('pointerup', birak);
    tutamac.addEventListener('pointercancel', birak);
  }
  /* Haritaya dokunulunca açık sayfa yarıma iner: harita işe yarasın */
  W.addEventListener('resize', function () { ayarla(mobil() ? (durum === 'acik' ? 'acik' : durum) : 'yarim', true); });
  W.TurPanel = { ayarla: ayarla, durum: function () { return durum; }, gorunen: function () { return mobil() ? gorunen : 0; } };
  ayarla('yarim', true);
  /* yerleşim ilk yazıldığında yazı tipi/ızgara oturmamış olabilir */
  if (D.fonts && D.fonts.ready) D.fonts.ready.then(function () { ayarla(durum, true); });
})();
