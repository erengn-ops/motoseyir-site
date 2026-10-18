/* Motoseyir anasayfa — kaydırma sahnesi. Bağımlılık yok; tek scroll dinleyicisi + rAF.
   Yalnız transform/opacity yazılır; ölçümler (getBoundingClientRect) kare başına bir kez okunur. */
(function () {
  "use strict";
  var D = document, W = window, R = D.documentElement;
  var azalt = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var dil = R.lang === "en" ? "en" : "tr";
  var fmt = new Intl.NumberFormat(dil === "en" ? "en-GB" : "tr-TR");
  var $ = function (s, k) { return (k || D).querySelector(s); };
  var $$ = function (s, k) { return Array.prototype.slice.call((k || D).querySelectorAll(s)); };
  var sinir = function (v) { return v < 0 ? 0 : v > 1 ? 1 : v; };
  var yumus = function (t) { return 1 - Math.pow(1 - t, 3); };
  var vh = W.innerHeight, vw = W.innerWidth;

  /* ---------- üst çubuk ---------- */
  var ust = $("#ustbar");

  /* ---------- başlıkları kelimelere böl (yalnız hareket açıkken) ---------- */
  function bol(el, taban) {
    var i = 0;
    (function yuru(n) {
      Array.prototype.slice.call(n.childNodes).forEach(function (c) {
        if (c.nodeType === 3) {
          var parcalar = c.nodeValue.split(/(\s+)/), f = D.createDocumentFragment();
          parcalar.forEach(function (p) {
            if (!p) return;
            if (/^\s+$/.test(p)) { f.appendChild(D.createTextNode(" ")); return; }
            var k = D.createElement("span"), w = D.createElement("span");
            k.className = "k"; w.className = "w"; w.textContent = p;
            w.style.setProperty("--i", i++); if (taban) w.style.setProperty("--b", taban + "ms");
            k.appendChild(w); f.appendChild(k);
          });
          c.parentNode.replaceChild(f, c);
        } else if (c.nodeType === 1 && c.tagName !== "SPAN") yuru(c);
      });
    })(el);
  }
  if (!azalt) {
    $$("h1").forEach(function (h) { h.setAttribute("aria-label", h.textContent.replace(/\s+/g, " ").trim()); bol(h, 40); $$(".k", h).forEach(function (k) { k.setAttribute("aria-hidden", "true"); }); });
    $$("[data-bol]").forEach(function (h) { h.setAttribute("aria-label", h.textContent.replace(/\s+/g, " ").trim()); bol(h, 0); $$(".k", h).forEach(function (k) { k.setAttribute("aria-hidden", "true"); }); });
  }

  /* ---------- açılış: yazı tipi hazır olunca (en geç 1,2 sn) ---------- */
  var acildi = false;
  function ac() { if (acildi) return; acildi = true; R.classList.add("hazir"); videoBaslat(); }
  if (D.fonts && D.fonts.ready) { D.fonts.ready.then(ac); setTimeout(ac, 900); } else ac();

  /* ---------- kahraman videosu: yükleme bittikten sonra, ağ elverirse ---------- */
  function idle(f) { if (W.requestIdleCallback) W.requestIdleCallback(f, { timeout: 400 }); else setTimeout(f, 200); }
  var hv = $("#hv"), kahraman = $(".kahraman");  /* bant normal kayar: eğik/yakınlaştırma yok */
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

  /* ---------- beliriş, sayaçlar, çubuklar, klipler (IntersectionObserver) ---------- */
  function say(el) {
    var hedef = +el.getAttribute("data-n"), t0 = null, ek = el.getAttribute("data-ek") || "";
    if (azalt) return;
    function adim(t) {
      if (t0 === null) t0 = t;
      var q = sinir((t - t0) / 1600);
      el.textContent = fmt.format(Math.round(hedef * yumus(q))) + ek;
      if (q < 1) requestAnimationFrame(adim);
    }
    el.textContent = "0" + ek; requestAnimationFrame(adim);
  }
  var io = "IntersectionObserver" in W && new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      if (!e.isIntersecting) return;
      var t = e.target; t.classList.add("gor"); io.unobserve(t);
      $$("[data-n]", t).forEach(say); if (t.hasAttribute("data-n")) say(t);
    });
  }, { rootMargin: "0px 0px -9% 0px", threshold: .06 });
  $$("[data-r],.pinler li,.sayi").forEach(function (e) { if (io && !azalt) io.observe(e); else e.classList.add("gor"); });

  /* klipler: görününce yüklenir ve oynar, çıkınca durur */
  var klipler = $$("video[data-src]");
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

  /* ---------- rota çizgisi: sayfa boyunca tek iplik ---------- */
  var ana = $(".ana"), rh = $(".rh"), NS = "http://www.w3.org/2000/svg";
  var klip = $(".rh-klip"), ic = $(".rh-klip svg"), pilot = $(".pilot");
  var yol = null, uzun = 0, ornek = [], dugumler = [], H = 0, anaTop = 0;
  var km = $$(".bolum[data-km]");

  function el(ad, o) { var n = D.createElementNS(NS, ad); for (var k in o) n.setAttribute(k, o[k]); return n; }
  function kur() {
    if (!ana || !rh) return;
    var ar = ana.getBoundingClientRect(); anaTop = ar.top + W.pageYOffset; H = ar.height;
    var W2 = ar.width, masaustu = vw >= 900, nok = [], cx;
    var sc = $(".bolum-ik", km[0] || ana);
    if (masaustu && sc) { var r0 = sc.getBoundingClientRect(); cx = r0.left + r0.width / 2; } else cx = 16;
    var amp = masaustu ? 26 : 3;
    nok.push([cx, 0]);
    dugumler = [];
    km.forEach(function (s, i) {
      var r = s.getBoundingClientRect(), y = r.top + W.pageYOffset - anaTop + Math.min(r.height * .42, 200);
      var x = cx + (i % 2 ? -amp : amp);
      nok.push([x, y]); dugumler.push({ x: x, y: y, el: $(".km b", s), var: false });
    });
    nok.push([cx, H]);
    var d = "M" + nok[0][0] + " " + nok[0][1];
    for (var i = 1; i < nok.length; i++) {
      var a = nok[i - 1], b = nok[i], m = (b[1] - a[1]) * .5;
      d += " C" + a[0] + " " + (a[1] + m) + " " + b[0] + " " + (b[1] - m) + " " + b[0] + " " + b[1];
    }
    [$(".rh-yol svg"), ic].forEach(function (s) { s.setAttribute("width", W2); s.setAttribute("height", H); s.setAttribute("viewBox", "0 0 " + W2 + " " + H); });
    [".rh-yol", ".rh-klip"].forEach(function (c) { $(c, rh).style.height = H + "px"; });
    var yolSvg = $(".rh-yol svg");
    [yolSvg, ic].forEach(function (s) { while (s.firstChild) s.removeChild(s.firstChild); });
    yolSvg.appendChild(el("path", { "class": "yol", d: d }));
    ic.appendChild(el("path", { "class": "parla", d: d }));
    yol = el("path", { "class": "cizgi", d: d }); ic.appendChild(yol);
    dugumler.forEach(function (n) { yolSvg.appendChild(el("circle", { "class": "dugum", cx: n.x, cy: n.y, r: 7 })); n.dolgu = el("circle", { "class": "dugum-ac", cx: n.x, cy: n.y, r: 5 }); n.dolgu.style.opacity = 0; ic.appendChild(n.dolgu); });
    uzun = yol.getTotalLength(); ornek = [];
    for (var j = 0; j <= 500; j++) { var p = yol.getPointAtLength(uzun * j / 500); ornek.push(p); }
  }
  function noktaY(y) { // verilen y'ye denk gelen yol noktası (y yolda tekdüze artıyor)
    var lo = 0, hi = ornek.length - 1;
    while (lo < hi) { var mid = (lo + hi) >> 1; if (ornek[mid].y < y) lo = mid + 1; else hi = mid; }
    return ornek[lo];
  }

  /* ---------- telefonlar: kaydıkça yana süzülüp yerine oturur ---------- */
  var teller = $$(".tel,.arac").map(function (t) {
    var egik = +(t.getAttribute("data-egik") || 0), yon = +(t.getAttribute("data-yon") || 1);
    return { t: t, kap: t.parentNode, egik: egik, yon: yon, ok: false };
  });

  /* ---------- dönen motor ---------- */
  var sahne = $("#sahne"), motorImg = $("#motorimg"), halka = $(".motor .halka"), motorKap = $("#motor");
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
    motorKap.addEventListener("pointermove", function (e) { if (surukle) { ofset = o0 - (e.clientX - x0) * .7; iste(); } });
    var birak = function () { surukle = false; };
    motorKap.addEventListener("pointerup", birak); motorKap.addEventListener("pointercancel", birak);
    if (azalt && sahne) sahne.classList.add("duz");
    aci(90);
  }

  /* ---------- tek kare döngüsü ---------- */
  var bek = false, hepsiAcik = false;
  function iste() { if (!bek) { bek = true; requestAnimationFrame(kare_); } }
  function kare_() {
    bek = false;
    var y = W.pageYOffset;
    ust.classList.toggle("dolu", y > 40);
    if (azalt) { if (motorKap) aci(90 + ofset); return; }

    /* rota çizgisi: ucu görünüm penceresinin %64'ünde */
    if (yol) {
      var hedef = y + vh * .64 - anaTop, uc = hedef < 0 ? 0 : hedef > H ? H : hedef;
      var n = noktaY(uc), n2 = noktaY(uc + 4);
      klip.style.transform = "translate3d(0," + (uc - H).toFixed(1) + "px,0)";
      ic.style.transform = "translate3d(0," + (H - uc).toFixed(1) + "px,0)";
      pilot.style.transform = "translate3d(" + n.x.toFixed(1) + "px," + uc.toFixed(1) + "px,0)";
      pilot.classList.toggle("ac", hedef > 0 && hedef < H + 40);
      dugumler.forEach(function (d) {
        var v = uc >= d.y;
        if (v !== d.var) { d.var = v; d.dolgu.style.opacity = v ? 1 : 0; if (v && d.el) { d.el.classList.remove("var"); void d.el.offsetWidth; d.el.classList.add("var"); } }
      });
    }

    /* telefonlar */
    teller.forEach(function (o) {
      var r = o.kap.getBoundingClientRect();
      if (r.bottom < -200 || r.top > vh + 200) return;
      if (!o.ok) { o.ok = true; o.t.classList.add("ok"); }
      var q = sinir((vh - r.top) / (vh * .85)), e = yumus(q);
      var orta = (r.top + r.height / 2 - vh / 2) / vh;          // -1..1 civarı
      var par = -orta * 48;                                        // hafif paralaks
      var x = (1 - e) * 70 * o.yon;
      o.t.style.opacity = (q * 2.4 > 1 ? 1 : q * 2.4).toFixed(3);
      o.t.style.transform = "translate3d(" + x.toFixed(1) + "px," + par.toFixed(1) + "px,0) rotate(" + (o.egik + (1 - e) * 4 * o.yon).toFixed(2) + "deg)";
    });

    /* motor: sahne boyunca bir tam tur */
    if (sahne && !sahne.classList.contains("duz")) {
      var sr = sahne.getBoundingClientRect(), toplam = sr.height - vh, ilerle = sinir(-sr.top / toplam);
      if (sr.top < vh && sr.bottom > 0) {
        var der = 90 + ilerle * 360 + ofset;
        aci(der); halka.style.transform = "rotate(" + (der * .5).toFixed(1) + "deg)";
        sahne.style.setProperty("--p", ilerle.toFixed(3));
      }
    } else if (motorKap) aci(90 + ofset);
  }

  W.addEventListener("scroll", iste, { passive: true });
  function olc() { vh = W.innerHeight; vw = W.innerWidth; kur(); iste(); }
  var tz; W.addEventListener("resize", function () { clearTimeout(tz); tz = setTimeout(olc, 150); });
  W.addEventListener("load", function () { setTimeout(olc, 50); });
  if (W.ResizeObserver && ana) { var son = 0; var ro = new ResizeObserver(function () { var r = ana.getBoundingClientRect(), h = r.height + r.top + W.pageYOffset; if (Math.abs(h - son) > 4) { son = h; clearTimeout(tz); tz = setTimeout(olc, 120); } }); ro.observe(ana); if (kahraman) ro.observe(kahraman); }
  if (azalt) { teller.forEach(function (o) { o.t.classList.add("ok"); o.t.style.transform = o.egik ? "rotate(" + o.egik + "deg)" : ""; }); }
  kur();
  if (azalt && yol) { klip.style.transform = "none"; ic.style.transform = "none"; dugumler.forEach(function (d) { d.dolgu.style.opacity = 1; }); }
  iste();
})();
