/* Motoseyir anasayfa. Hareket sistemi: m/h.js (ortak) + bu dosya (kahraman, sticky anlatı, dönen motor, videolar).
   `html.hm` yoksa (hareketi azalt / JS yok) her şey durağan; içerik her zaman görünür. Bağımlılık yok. */
(function () {
  "use strict";
  var D = document, W = window, R = D.documentElement;
  var azalt = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var MH = W.MH || { hm: false, $$: function () { return []; }, kanca: function () {}, basliklar: function () {}, sayaclar: function () {}, egim: function () {}, miknatis: function () {}, paralaks: function () {} };
  var HM = !!MH.hm, SD = !!MH.sd;
  var dil = R.lang === "en" ? "en" : "tr";
  var $ = function (s, k) { return (k || D).querySelector(s); };
  var $$ = function (s, k) { return Array.prototype.slice.call((k || D).querySelectorAll(s)); };
  var IO = "IntersectionObserver" in W;
  var klamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };

  /* ---------- üst çubuk: video bandının üstünde saydam + beyaz yazı, bant çıkınca beyaz çubuk ---------- */
  var ust = $("#ustbar"), kahraman = $(".kahraman");
  function cubuk() {
    if (!ust || !kahraman) return;
    ust.classList.toggle("acik", kahraman.getBoundingClientRect().bottom <= ust.offsetHeight);
  }
  MH.kanca(cubuk);
  if (!HM) { W.addEventListener("scroll", function () { requestAnimationFrame(cubuk); }, { passive: true }); W.addEventListener("resize", cubuk); }

  /* ---------- kahraman: kaydırınca derinlik (sd yoksa --hp), görünmeyince yüzme durur ---------- */
  if (HM && kahraman) {
    var hGor = true;
    if (IO) new IntersectionObserver(function (e) { hGor = e[0].isIntersecting; kahraman.classList.toggle("pas", !hGor); }).observe(kahraman);
    if (!SD) MH.kanca(function () {
      if (!hGor) return;
      kahraman.style.setProperty("--hp", klamp((W.pageYOffset || R.scrollTop) / (W.innerHeight * .85), 0, 1).toFixed(3));
    });
    MH.egim([$(".k-tel")], 7);
  }

  /* ---------- açılış: yazı tipi hazır olunca (en geç 0,9 sn) ---------- */
  var acildi = false;
  function ac() {
    if (acildi) return; acildi = true;
    if (HM) {
      MH.basliklar($$(".kahraman h1"), false);                                  /* kahraman başlığı yüklemede açılır */
      MH.basliklar($$("h2, .cr-h, .hk-adim h3").filter(function (e) { return !e.closest(".kahraman"); }));
    }
    R.classList.add("hazir"); videoBaslat();
    if (HM) {
      /* sayılar, telefonlar, düğmeler: ilk boyamadan sonra */
      MH.sayaclar($$(".sayi b, .veri-say dt, .pinler .m, .bolgeler .n"));
      MH.paralaks($$(".bolum .tel-alan, .cr-tel"), "");
      MH.paralaks($$(".bolum .arac"), "d2");
      MH.egim($$(".bolum .tel, .bolum .arac"), 9);
      MH.miknatis($$(".cta-satir .btn, .ust .btn-kucuk, .varis .btn"));
    }
  }
  if (D.fonts && D.fonts.ready) { D.fonts.ready.then(ac); setTimeout(ac, 900); } else ac();

  /* ---------- kahraman videosu: yükleme bittikten sonra ----------
     Çözünürlük HER cihazda ve bağlantıda tam: geniş ekran sahne-hd (1920×1080), dar ekran sahne-dikey-hd (608×1080 = kaynağın
     kendi pikselleri, büyütme yok). 720p yedekler kaldırıldı. HEVC (hvc1) çözebilen cihaz (Safari/iPhone, donanım desteği olan
     Chrome/Edge) aynı kaliteyi ~%60 boyutla alıyor; yoksa H.264. Yalnız veri tasarrufu ya da 2G'de video hiç yüklenmez
     (durağan poster kalır): oraya 30 MB'lık bir dosya göndermek çözünürlük değil, kullanıcıyı kaybettirir. */
  function hevcVar() {
    try { var t = D.createElement("video"); return !!(t.canPlayType && t.canPlayType('video/mp4; codecs="hvc1.1.6.L120.B0"') === "probably"); } catch (e) { return false; }
  }
  var hv = $("#hv");
  function videoBaslat() {
    if (azalt || !hv) return;
    var c = navigator.connection || {};
    if (c.saveData || /(^|-)2g$/.test(c.effectiveType || "")) return;
    var basla = function () {
      var dikey = matchMedia("(max-width:700px)").matches;
      hv.src = "/m/sahne-" + (dikey ? "dikey-hd" : "hd") + (hevcVar() ? "-hevc" : "") + ".mp4";
      hv.addEventListener("playing", function () { hv.classList.add("oynuyor"); }, { once: true });
      var p = hv.play(); if (p && p.catch) p.catch(function () {});
      new IntersectionObserver(function (e) { if (e[0].isIntersecting) { hv.play().catch(function () {}); } else hv.pause(); }).observe(hv);
    };
    if (D.readyState === "complete") idle(basla);
    else W.addEventListener("load", function () { idle(basla); });
  }
  function idle(f) { if (W.requestIdleCallback) W.requestIdleCallback(f, { timeout: 400 }); else setTimeout(f, 200); }

  /* klipler: görününce yüklenir ve oynar, çıkınca durur */
  var klipler = $$("video[data-src]");
  /* Tek sürüm: tam çözünürlük (küçük/düşük çözünürlüklü yedekler kaldırıldı). */
  function kaynak(v) { return v.getAttribute("data-src"); }
  if (azalt) klipler.forEach(function (v) { var dp = v.getAttribute("data-poster"); if (dp) v.poster = dp; });  /* hareket azaltmada video yüklenmez; durağan kapak görünür */
  if (IO && !azalt) {
    var kio = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        var v = e.target;
        if (e.isIntersecting) { if (!v.poster && v.getAttribute("data-poster")) v.poster = v.getAttribute("data-poster"); if (!v.getAttribute("src")) v.src = kaynak(v); v.play().catch(function () {}); } else v.pause();
      });
    }, { threshold: .25, rootMargin: "200px 0px" });
    klipler.forEach(function (v) { kio.observe(v); });
  }

  /* AI CoRider kaydı: sessiz döner; düğmeyle ses açılır, bölümden çıkınca ses kendiliğinden kapanır.
     Hareket azaltmada video hiç kendi başına oynamaz; düğme oynatıp sesi de açar. */
  var cv = $("#cr-video"), cb = $("#cr-ses");
  if (cv && cb) {
    var cy = $("span", cb);
    var etiket = function () { var a = !cv.muted && !cv.paused; cb.setAttribute("aria-pressed", a ? "true" : "false"); cy.textContent = cb.getAttribute(a ? "data-kapat" : "data-ac"); };
    cb.addEventListener("click", function () {
      if (!cv.getAttribute("src")) cv.src = kaynak(cv);
      if (!cv.muted && !cv.paused) { cv.muted = true; } else { cv.muted = false; cv.play().catch(function () {}); }
      etiket();
    });
    cv.addEventListener("play", etiket); cv.addEventListener("pause", etiket);
    if (IO) new IntersectionObserver(function (e) { if (!e[0].isIntersecting && !cv.muted) { cv.muted = true; etiket(); } }, { threshold: .1 }).observe(cv);
  }

  /* "Motoseyir'i tanı": tıklayınca yüklenir */
  var tb = $("#tani-btn");
  if (tb) tb.addEventListener("click", function () {
    var v = D.createElement("video"); v.controls = true; v.autoplay = true; v.playsInline = true;
    v.src = "https://motorota-rota.erengn.workers.dev/pro-video/motoseyir-whats-inside-" + dil + ".mp4";
    v.setAttribute("aria-label", tb.getAttribute("aria-label"));
    $("#tani-kutu").replaceChildren(v); v.play().catch(function () {});
  });

  /* ---------- menü: görünen bölümün bağlantısı işaretlenir ---------- */
  if (HM && IO) {
    var baglar = {};
    $$('.menu a[href^="#"]').forEach(function (a) { baglar[a.getAttribute("href")] = a; });
    var mio = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        var a = baglar["#" + e.target.id];
        if (a) a.classList.toggle("ak", e.isIntersecting);
      });
    }, { rootMargin: "-42% 0px -52% 0px" });
    Object.keys(baglar).forEach(function (h) { var s = $(h); if (s) mio.observe(s); });
  }

  /* ---------- sticky anlatı: adım adım ekran değişimi + sayfayla çizilen rota çizgisi ---------- */
  var sahne = $("#hk-sahne");
  if (sahne) (function () {
    var ol = $(".hk-adimlar", sahne), adimlar = $$(".hk-adim", sahne), NS = "http://www.w3.org/2000/svg";
    var svg, iz, kenar, yol, bas, dugumler = [], tablo = [], uzun = 0, ust0 = [], alt0 = [], dy = [], etkin = -1, gorunur = true, kurulu = false, gec = -1, kurK = 0;
    function el(ad, sinif, ust) { var e = D.createElementNS(NS, ad); if (sinif) e.setAttribute("class", sinif); if (ust) ust.appendChild(e); return e; }
    function sec(i) {
      if (i === etkin) return; etkin = i;
      sahne.setAttribute("data-a", i);
      adimlar.forEach(function (a, k) { a.classList.toggle("on", k === i); });
    }
    function kur() {
      /* rota çizgisi: her adımın "km" satırına bir düğüm; düğümler arası yılan gibi iki kıvrım */
      var H = ol.offsetHeight, gw = (svg && svg.getBoundingClientRect().width) || 40, cx = gw / 2, a = gw * .34;
      ust0 = adimlar.map(function (s) { return s.offsetTop; });
      alt0 = adimlar.map(function (s) { return s.offsetTop + s.offsetHeight; });
      if (!HM) return;
      if (!svg) {
        svg = el("svg", "hk-rota"); svg.setAttribute("aria-hidden", "true"); ol.insertBefore(svg, ol.firstChild);
        iz = el("path", "hk-iz", svg); kenar = el("path", "hk-kenar", svg); yol = el("path", "hk-yol", svg);
        adimlar.forEach(function () { dugumler.push(el("circle", "hk-dugum", svg)); });
        bas = el("g", "hk-bas-g", svg); el("circle", "hk-hale", bas); el("circle", "hk-bas", bas);
        dugumler.forEach(function (d) { d.setAttribute("r", 7); });
        bas.lastChild.setAttribute("r", 7); bas.firstChild.setAttribute("r", 7);
        gw = svg.getBoundingClientRect().width || 40; cx = gw / 2; a = gw * .34;
      }
      svg.setAttribute("viewBox", "0 0 " + gw + " " + H);
      dy = adimlar.map(function (s) { var k = $(".km", s); return s.offsetTop + (k ? k.offsetTop + k.offsetHeight / 2 : 40); });
      var p = [0].concat(dy), d = "M" + cx + " 0";
      for (var k = 0; k < p.length - 1; k++) {
        var y0 = p[k], y1 = p[k + 1], m = y1 - y0, ym = y0 + m / 2, s = k % 2 ? -1 : 1;
        d += " C" + (cx + a * s) + " " + (y0 + m * .12) + " " + (cx + a * s) + " " + (ym - m * .1) + " " + cx + " " + ym +
             " C" + (cx - a * s) + " " + (ym + m * .1) + " " + (cx - a * s) + " " + (y1 - m * .12) + " " + cx + " " + y1;
      }
      [iz, kenar, yol].forEach(function (e) { e.setAttribute("d", d); });
      dugumler.forEach(function (c, i) { c.setAttribute("cx", cx); c.setAttribute("cy", dy[i]); c.setAttribute("class", "hk-dugum"); });
      uzun = yol.getTotalLength();
      /* uzunluk -> y tablosu (y tekdüze artıyor): kaydırma konumundan uzunluğu bulmak için */
      tablo = []; for (var i = 0; i <= 240; i++) { var pt = yol.getPointAtLength(uzun * i / 240); tablo.push(pt.y); }
      [kenar, yol].forEach(function (e) { e.style.strokeDasharray = uzun + " " + uzun; });
      gec = -1; kurulu = true; cizim(true);
    }
    function uzunluk(y) {
      var a = 0, b = tablo.length - 1;
      if (y <= tablo[0]) return 0; if (y >= tablo[b]) return uzun;
      while (b - a > 1) { var m = (a + b) >> 1; if (tablo[m] < y) a = m; else b = m; }
      var f = (y - tablo[a]) / ((tablo[b] - tablo[a]) || 1);
      return uzun * (a + f) / 240;
    }
    function cizim(zorla) {
      var r = ol.getBoundingClientRect(), vh = W.innerHeight, yt = vh * (W.innerWidth < 900 ? .62 : .5) - r.top, n = adimlar.length, i, en = 0;
      /* etkin adım: ekranın ortası hangi adımın bandında */
      for (i = 0; i < n; i++) if (yt >= ust0[i] - (i ? (ust0[i] - alt0[i - 1]) / 2 : 1e5)) en = i;
      sec(en);
      if (!HM || !kurulu) return;
      var yb = klamp(yt, 0, dy[n - 1]), len = uzunluk(yb);
      kenar.style.strokeDashoffset = yol.style.strokeDashoffset = (uzun - len).toFixed(1);
      var pt = yol.getPointAtLength(len);
      bas.setAttribute("transform", "translate(" + pt.x.toFixed(1) + " " + pt.y.toFixed(1) + ")");
      for (i = 0; i < n; i++) { var g = yt >= dy[i] - 4; if (zorla || g !== dugumler[i].__g) { dugumler[i].__g = g; dugumler[i].setAttribute("class", "hk-dugum" + (g ? " gecti" : "")); } }
    }
    if (IO) new IntersectionObserver(function (e) { gorunur = e[0].isIntersecting; if (gorunur) cizim(); }, { rootMargin: "100px 0px" }).observe(sahne);
    MH.kanca(function () { if (gorunur) cizim(); });
    var yeniden = function () { clearTimeout(kurK); kurK = setTimeout(kur, 80); };
    if (W.ResizeObserver) new ResizeObserver(yeniden).observe(ol); else W.addEventListener("resize", yeniden);
    if (D.fonts && D.fonts.ready) D.fonts.ready.then(kur);
    kur();
  })();

  /* ---------- dönen motosiklet: kendi kendine yavaşça döner, sürükleyince bırakır (kare geçişli canvas) ---------- */
  var motorImg = $("#motorimg"), motorKap = $("#motor");
  var kare = [], resim = [], mevcut = -1, ters = false, surukle = false, x0 = 0, a0 = 90, derece = 90, oto = HM, hiz = 0, motorYuk = false, mvis = false, cvs = null, cg = null, raf = 0, tZ = 0, sonX = 0, sonT = 0;
  for (var a = 0; a <= 180; a += 15) kare.push("/m/bike/" + ("00" + a).slice(-3) + ".webp");
  function resimDerece(n) { var d = ((n % 24) + 24) % 24 * 15; return d > 180 ? { i: (360 - d) / 15, t: true } : { i: d / 15, t: false }; }
  function ciz() {
    if (!cg || resim.length < kare.length) return;
    var S = cvs.width, w = S * .88, h = w * 699 / 760, x = (S - w) / 2, y = (S - h) / 2;
    var f = (((derece % 360) + 360) % 360) / 15, n0 = Math.floor(f), t = f - n0;
    cg.clearRect(0, 0, S, S);
    /* 15°'lik karelerin hayalet gibi üst üste binmemesi için geçiş adımın ortasında hızlı: smoothstep(.3–.7) */
    var u = klamp((t - .3) / .4, 0, 1); u = u * u * (3 - 2 * u);
    [[n0, 1], [n0 + 1, u]].forEach(function (p) {
      if (p[1] <= .003) return;
      var r = resimDerece(p[0]); cg.globalAlpha = p[1];
      if (r.t) { cg.save(); cg.translate(S, 0); cg.scale(-1, 1); cg.drawImage(resim[r.i], x, y, w, h); cg.restore(); } else cg.drawImage(resim[r.i], x, y, w, h);
    });
    cg.globalAlpha = 1;
  }
  function tekKare() {
    /* canvas yokken (JS ilk yükleme / hareketsiz kip): eski yöntem, en yakın kare */
    var der = ((derece % 360) + 360) % 360, tr = der > 180, f = Math.round((tr ? 360 - der : der) / 15);
    if (f === mevcut && tr === ters) return;
    mevcut = f; ters = tr; motorImg.src = kare[f]; motorImg.classList.toggle("ters", tr);
  }
  function motorDongu(t) {
    raf = 0;
    var dt = tZ ? Math.min(.05, (t - tZ) / 1000) : .016; tZ = t;
    if (!surukle) {
      if (Math.abs(hiz) > 1) { derece += hiz * dt; hiz *= Math.pow(.04, dt); }      /* bırakınca süzülür */
      else if (oto) derece += 20 * dt;                                                 /* yavaş otomatik dönüş: saniyede 20° */
    }
    cvs ? ciz() : tekKare();
    if (mvis && (surukle || oto || Math.abs(hiz) > 1)) raf = requestAnimationFrame(motorDongu); else tZ = 0;
  }
  function motorIste() { if (!raf) raf = requestAnimationFrame(motorDongu); }
  function motorYukle() {
    if (motorYuk) return; motorYuk = true;
    var n = 0;
    kare.forEach(function (s, i) {
      var im = new Image();
      im.onload = function () {
        if (++n < kare.length || !HM) return;
        /* hepsi geldi: canvas'a geç */
        var S = Math.round(motorKap.clientWidth * Math.min(W.devicePixelRatio || 1, 2));
        cvs = D.createElement("canvas"); cvs.width = cvs.height = S; cg = cvs.getContext("2d");
        motorKap.insertBefore(cvs, motorImg.nextSibling); motorKap.classList.add("cv");
        ciz(); motorIste();
      };
      im.src = s; resim[i] = im;
    });
  }
  if (motorKap && motorImg) {
    if (!IO) motorYukle();
    else {
      new IntersectionObserver(function (e) { if (e[0].isIntersecting) motorYukle(); }, { rootMargin: "900px" }).observe(motorKap);
      new IntersectionObserver(function (e) { mvis = e[0].isIntersecting; if (mvis) motorIste(); }).observe(motorKap);
    }
    motorKap.addEventListener("pointerdown", function (e) {
      surukle = true; oto = false; hiz = 0; x0 = e.clientX; a0 = derece; sonX = e.clientX; sonT = performance.now();
      motorKap.classList.add("tut"); motorKap.setPointerCapture(e.pointerId); motorYukle(); motorIste();
    });
    motorKap.addEventListener("pointermove", function (e) {
      if (!surukle) return;
      derece = a0 - (e.clientX - x0) * .7;
      var t = performance.now(), dt = (t - sonT) / 1000;
      if (dt > 0.008) { hiz = hiz * .6 + (-(e.clientX - sonX) * .7 / dt) * .4; sonX = e.clientX; sonT = t; }
      motorIste();
    });
    var birak = function () { if (!surukle) return; surukle = false; motorKap.classList.remove("tut"); if (performance.now() - sonT > 90) hiz = 0; hiz = klamp(hiz, -420, 420); motorIste(); };
    motorKap.addEventListener("pointerup", birak); motorKap.addEventListener("pointercancel", birak);
    tekKare();
  }
})();
