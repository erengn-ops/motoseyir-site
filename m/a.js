/* Motoseyir anasayfa. Bağımlılık yok. Sakin hareket: yalnız sade solma, üst çubuk rengi, video bandı,
   sürüklenen motosiklet. Sayaç, paralaks, kelime kelime beliriş ve kaydırmaya bağlı sahne YOK. */
(function () {
  "use strict";
  var D = document, W = window, R = D.documentElement;
  var azalt = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var dil = R.lang === "en" ? "en" : "tr";
  var $ = function (s, k) { return (k || D).querySelector(s); };
  var $$ = function (s, k) { return Array.prototype.slice.call((k || D).querySelectorAll(s)); };

  /* ---------- üst çubuk: video bandının üstünde saydam + beyaz yazı, bant çıkınca beyaz çubuk ---------- */
  var ust = $("#ustbar"), kahraman = $(".kahraman"), bek = false;
  function cubuk() {
    bek = false;
    if (!ust || !kahraman) return;
    ust.classList.toggle("acik", kahraman.getBoundingClientRect().bottom <= ust.offsetHeight);
  }
  function iste() { if (!bek) { bek = true; requestAnimationFrame(cubuk); } }
  W.addEventListener("scroll", iste, { passive: true });
  W.addEventListener("resize", iste);
  cubuk();

  /* ---------- açılış: yazı tipi hazır olunca (en geç 0,9 sn) ---------- */
  var acildi = false;
  function ac() { if (acildi) return; acildi = true; R.classList.add("hazir"); videoBaslat(); }
  if (D.fonts && D.fonts.ready) { D.fonts.ready.then(ac); setTimeout(ac, 900); } else ac();

  /* ---------- kahraman videosu: yükleme bittikten sonra, ağ elverirse ---------- */
  function idle(f) { if (W.requestIdleCallback) W.requestIdleCallback(f, { timeout: 400 }); else setTimeout(f, 200); }
  var hv = $("#hv");
  function videoBaslat() {
    if (azalt || !hv) return;
    var c = navigator.connection || {};
    if (c.saveData || /(^|-)2g$/.test(c.effectiveType || "")) return;
    var basla = function () {
      var dikey = matchMedia("(max-width:700px)").matches;
      /* HD (18 Eki): kaynağın kendi çözünürlüğü, 1664×936 / dikey 700×1244. Geniş ve keskin ekranda HD; 3g'de hafif sürüm. */
      var yavas = /3g$/.test(c.effectiveType || "");
      var genis = (screen.width || 0) * (W.devicePixelRatio || 1) >= 1700;
      hv.src = dikey ? (yavas ? "/m/sahne-dikey.mp4" : "/m/sahne-dikey-hd.mp4") : (genis && !yavas ? "/m/sahne-hd.mp4" : "/m/sahne.mp4");
      hv.addEventListener("playing", function () { hv.classList.add("oynuyor"); }, { once: true });
      var p = hv.play(); if (p && p.catch) p.catch(function () {});
      new IntersectionObserver(function (e) { if (e[0].isIntersecting) { hv.play().catch(function () {}); } else hv.pause(); }).observe(hv);
    };
    if (D.readyState === "complete") idle(basla);
    else W.addEventListener("load", function () { idle(basla); });
  }

  /* ---------- sade solma: görününce bir kez ---------- */
  var io = "IntersectionObserver" in W && new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      if (!e.isIntersecting) return;
      e.target.classList.add("gor"); io.unobserve(e.target);
    });
  }, { rootMargin: "0px 0px -8% 0px", threshold: .06 });
  $$("[data-r]").forEach(function (e) { if (io && !azalt) io.observe(e); else e.classList.add("gor"); });

  /* klipler: görününce yüklenir ve oynar, çıkınca durur */
  var klipler = $$("video[data-src]");
  if (azalt) klipler.forEach(function (v) { v.poster = v.getAttribute("data-poster"); });  /* hareket azaltmada video yüklenmez; durağan kapak görünür */
  if ("IntersectionObserver" in W && !azalt) {
    var kio = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        var v = e.target;
        if (e.isIntersecting) { if (!v.poster) v.poster = v.getAttribute("data-poster"); if (!v.getAttribute("src")) v.src = v.getAttribute("data-src"); v.play().catch(function () {}); } else v.pause();
      });
    }, { threshold: .25, rootMargin: "200px 0px" });
    klipler.forEach(function (v) { kio.observe(v); });
  }

  /* "Motoseyir'i tanı": tıklayınca yüklenir */
  var tb = $("#tani-btn");
  if (tb) tb.addEventListener("click", function () {
    var v = D.createElement("video"); v.controls = true; v.autoplay = true; v.playsInline = true;
    v.src = "https://motorota-rota.erengn.workers.dev/pro-video/motoseyir-whats-inside-" + dil + ".mp4";
    v.setAttribute("aria-label", tb.getAttribute("aria-label"));
    $("#tani-kutu").replaceChildren(v); v.play().catch(function () {});
  });

  /* ---------- dönen motosiklet: yalnız sürükleyince döner (kaydırmaya bağlı değil) ---------- */
  var motorImg = $("#motorimg"), motorKap = $("#motor");
  var kare = [], mevcut = -1, ters = false, surukle = false, x0 = 0, ofset = 0, o0 = 0, motorYuk = false;
  for (var a = 0; a <= 180; a += 15) kare.push("/m/bike/" + ("00" + a).slice(-3) + ".webp");
  function motorYukle() { if (motorYuk) return; motorYuk = true; kare.forEach(function (s) { var i = new Image(); i.src = s; }); }
  function aci(der) {
    der = ((der % 360) + 360) % 360;
    var tr = der > 180, f = Math.round((tr ? 360 - der : der) / 15);
    if (f === mevcut && tr === ters) return;
    mevcut = f; ters = tr; motorImg.src = kare[f]; motorImg.classList.toggle("ters", tr);
  }
  if (motorKap) {
    if (!("IntersectionObserver" in W)) motorYukle(); else new IntersectionObserver(function (e) { if (e[0].isIntersecting) motorYukle(); }, { rootMargin: "900px" }).observe(motorKap);
    motorKap.addEventListener("pointerdown", function (e) { surukle = true; x0 = e.clientX; o0 = ofset; motorKap.setPointerCapture(e.pointerId); motorYukle(); });
    motorKap.addEventListener("pointermove", function (e) { if (surukle) { ofset = o0 - (e.clientX - x0) * .7; aci(90 + ofset); } });
    var birak = function () { surukle = false; };
    motorKap.addEventListener("pointerup", birak); motorKap.addEventListener("pointercancel", birak);
    aci(90);
  }
})();
