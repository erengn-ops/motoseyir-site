/* AI CoRider sayfası. Bağımlılık yok. Sakin hareket: yavaş nefes alan ses halkası (canvas), konuşmaların sade solması.
   Hareket azaltmada halka tek durağan kare; video kendi başına oynamaz, düğme oynatıp sesi açar. */
(function () {
  "use strict";
  var D = document, W = window;
  var azalt = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var $ = function (s, k) { return (k || D).querySelector(s); };
  var $$ = function (s, k) { return Array.prototype.slice.call((k || D).querySelectorAll(s)); };

  /* ---------- ses halkası: yüzün çevresinde, çok yavaş değişen çubuklar ---------- */
  var cv = $("#orb-c");
  if (cv && cv.getContext) {
    var g = cv.getContext("2d"), N = 96, S = 0, t0 = performance.now(), calis = false, goru = true;
    var boyut = function () {
      var dpr = Math.min(W.devicePixelRatio || 1, 2), w = cv.clientWidth || 330;
      S = Math.round(w * dpr); if (cv.width !== S) { cv.width = S; cv.height = S; }
    };
    var ciz = function (t) {
      var c = S / 2, r0 = S * 0.325, kal = Math.max(1.6, S / 260), i, a, v, b, env;
      g.clearRect(0, 0, S, S);
      /* konuşma zarfı: yavaş soluk alıp verir; çubuklar bu zarfın içinde ayrı ayrı oynar */
      env = 0.5 + 0.5 * Math.sin(t * 0.55) * Math.sin(t * 0.23 + 1);
      for (i = 0; i < N; i++) {
        a = (i / N) * Math.PI * 2;
        v = Math.sin(a * 3 + t * 0.7) * 0.5 + Math.sin(a * 7 - t * 0.45) * 0.3 + Math.sin(a * 13 + t * 0.9) * 0.2;
        b = S * (0.012 + 0.07 * (0.35 + 0.65 * env) * (0.5 + 0.5 * v) * (0.5 + 0.5 * Math.sin(a * 2 + t * 0.3)));
        g.strokeStyle = "rgba(62,201,255," + (0.35 + 0.55 * (b / (S * 0.082))).toFixed(3) + ")";
        g.lineWidth = kal; g.lineCap = "round";
        g.beginPath();
        g.moveTo(c + Math.cos(a) * r0, c + Math.sin(a) * r0);
        g.lineTo(c + Math.cos(a) * (r0 + b), c + Math.sin(a) * (r0 + b));
        g.stroke();
      }
      g.strokeStyle = "rgba(62,201,255,.28)"; g.lineWidth = kal * .75;
      g.beginPath(); g.arc(c, c, r0 - S * 0.018, 0, Math.PI * 2); g.stroke();
      g.strokeStyle = "rgba(27,106,214,.35)";
      g.beginPath(); g.arc(c, c, r0 + S * 0.115, 0, Math.PI * 2); g.stroke();
    };
    var dongu = function (now) {
      if (!calis) return;
      /* ~30 kare/sn yeter: hareket zaten yavaş */
      ciz((now - t0) / 1000);
      setTimeout(function () { if (calis) requestAnimationFrame(dongu); }, 33);
    };
    var baslat = function () { if (azalt || calis || !goru || D.hidden) return; calis = true; requestAnimationFrame(dongu); };
    boyut(); ciz(2.4);
    W.addEventListener("resize", function () { boyut(); if (!calis) ciz(2.4); });
    if (!azalt) {
      if ("IntersectionObserver" in W) new IntersectionObserver(function (e) { goru = e[0].isIntersecting; if (goru) baslat(); else calis = false; }).observe(cv);
      D.addEventListener("visibilitychange", function () { if (D.hidden) calis = false; else baslat(); });
      baslat();
    }
  }

  /* ---------- konuşmalar: görününce satır satır solar (yalnız opaklık) ---------- */
  var soh = $$(".soh");
  if ("IntersectionObserver" in W && !azalt) {
    var so = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("on"); so.unobserve(e.target); } });
    }, { threshold: .35, rootMargin: "0px 0px -6% 0px" });
    soh.forEach(function (e) { so.observe(e); });
  } else soh.forEach(function (e) { e.classList.add("on"); });

  /* ---------- gerçek kayıt: görününce yüklenir, sessiz oynar; "Sesi aç" ile ses (anasayfayla aynı mantık) ---------- */
  var v = $("#cr-video"), b = $("#cr-ses");
  function kaynak() {
    var c = navigator.connection || {}, k = v.getAttribute("data-kucuk");
    return k && (c.saveData || /(^|-)[23]g$/.test(c.effectiveType || "")) ? k : v.getAttribute("data-src");
  }
  if (v && b) {
    var y = $("span", b);
    var etiket = function () { var a = !v.muted && !v.paused; b.setAttribute("aria-pressed", a ? "true" : "false"); y.textContent = b.getAttribute(a ? "data-kapat" : "data-ac"); };
    b.addEventListener("click", function () {
      if (!v.getAttribute("src")) v.src = kaynak();
      if (!v.muted && !v.paused) { v.muted = true; } else { v.muted = false; v.play().catch(function () {}); }
      etiket();
    });
    v.addEventListener("play", etiket); v.addEventListener("pause", etiket);
    if ("IntersectionObserver" in W) {
      new IntersectionObserver(function (es) {
        var e = es[0];
        if (e.isIntersecting) {
          if (azalt) return;
          if (!v.getAttribute("src")) v.src = kaynak();
          v.play().catch(function () {});
        } else { v.pause(); if (!v.muted) { v.muted = true; etiket(); } }
      }, { threshold: .3, rootMargin: "200px 0px" }).observe(v);
    }
  }
})();
