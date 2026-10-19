/* Motoseyir hareket kütüphanesi (19 Eki 2026) — anasayfa (a.js) ve AI CoRider sayfası (corider.js) paylaşır. Bağımlılık yok.
   Kural: yalnız transform/translate/scale/opacity yazılır; okumayı bloklayan bir şey yok; her şey görününce kurulur.
   `html.hm` = JS var ve "hareketi azalt" kapalı. Yoksa bu dosya yalnız içeriği görünür bırakır (reveal sınıfını hemen verir).
   `html.sd` = tarayıcı `animation-timeline` biliyor → kaydırma efektleri CSS'te, buradan yalnız eksikler (sayaç, kelime bölme, eğim...) çalışır.
   sd yoksa buradaki yedek: görünen öğelere `--p` (paralaks) / `--hp` (kahraman) yazar, ilerleme çizgisini ölçekler. */
(function () {
  "use strict";
  var W = window, D = document, R = D.documentElement;
  var HM = R.classList.contains("hm"), SD = R.classList.contains("sd");
  var $ = function (s, k) { return (k || D).querySelector(s); };
  var $$ = function (s, k) { return Array.prototype.slice.call((k || D).querySelectorAll(s)); };
  var MH = W.MH = { hm: HM, sd: SD, $: $, $$: $$ };
  var ince = !!(W.matchMedia && matchMedia("(hover:hover) and (pointer:fine)").matches);
  var c = navigator.connection || {};
  /* düşük donanım / veri tasarrufu: paralaks, kayan şerit, yüzme kalkar (içerik aynı) */
  var hafif = !!(c.saveData || (navigator.deviceMemory && navigator.deviceMemory <= 2) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2));
  if (hafif) R.classList.add("lite");
  MH.hafif = hafif; MH.ince = ince;
  var IO = "IntersectionObserver" in W;

  /* ---------- tek kaydırma/yeniden boyutlandırma döngüsü ---------- */
  var kancalar = [], bek = false;
  function dongu() { bek = false; for (var i = 0; i < kancalar.length; i++) kancalar[i](); }
  function iste() { if (!bek) { bek = true; requestAnimationFrame(dongu); } }
  MH.kanca = function (f) { kancalar.push(f); f(); };
  W.addEventListener("scroll", iste, { passive: true });
  W.addEventListener("resize", iste);
  MH.iste = iste;

  /* ---------- beliriş: [data-r] bloklar, [data-g] öğeler ---------- */
  var gozle = IO && new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("gor"); gozle.unobserve(e.target); } });
  }, { rootMargin: "0px 0px -8% 0px", threshold: .06 });
  $$("[data-r],[data-g]").forEach(function (e) { if (gozle && HM) gozle.observe(e); else e.classList.add("gor"); });
  if (!HM) {
    /* hareketsiz kip: sayfa kodu aynı çağrıları yapabilsin diye boş işlevler */
    MH.basliklar = MH.sayaclar = MH.egim = MH.miknatis = MH.paralaks = function () {};
    MH.bol = function () { return false; };
    return;
  }

  /* ---------- görünürken aç/kapa: kayan şerit, oynat halkası ([data-ak]) ---------- */
  if (IO) {
    var ak = new IntersectionObserver(function (es) {
      es.forEach(function (e) { e.target.classList.toggle("ak", e.isIntersecting); });
    }, { rootMargin: "120px 0px" });
    $$("[data-ak]").forEach(function (e) { ak.observe(e); });
  }

  /* ---------- bölüm renk geçişi: bölüm ekranın ortasından geçerken .ton ([data-ton]) ---------- */
  if (IO) {
    var ton = new IntersectionObserver(function (es) {
      es.forEach(function (e) { e.target.classList.toggle("ton", e.isIntersecting); });
    }, { rootMargin: "-46% 0px -46% 0px" });
    $$("[data-ton]").forEach(function (e) { ton.observe(e); });
  }

  /* ---------- kaydırma çizgisi (yalnız sd yoksa; sd'de CSS scroll(root)) ---------- */
  var cizgi = $(".ilerle");
  if (cizgi && !SD) {
    MH.kanca(function () {
      var h = R.scrollHeight - W.innerHeight;
      cizgi.style.transform = "scaleX(" + (h > 0 ? Math.min(1, Math.max(0, (W.pageYOffset || R.scrollTop) / h)) : 0).toFixed(4) + ")";
    });
  }

  /* ---------- başlıklar: kelime kelime maske ile açılır ---------- */
  /* yalnız sıradan boşluklarda bölünür: NBSP / dar NBSP sözcüğü bir arada tutar ("O dinlesin.", "10 dk") */
  var RE_BOSLUK = /([ \t\n\r\f]+)/;
  function parcala(kok) {
    var n = 0;
    (function yuru(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (ch) {
        if (ch.nodeType === 3) {
          var parca = ch.nodeValue.split(RE_BOSLUK), kap = D.createDocumentFragment();
          parca.forEach(function (p) {
            if (!p) return;
            if (/^[ \t\n\r\f]+$/.test(p)) { kap.appendChild(D.createTextNode(p)); return; }
            var w = D.createElement("span"), i = D.createElement("span");
            w.className = "w"; i.className = "wi"; i.style.setProperty("--i", n++); i.textContent = p;
            w.appendChild(i); kap.appendChild(w);
          });
          node.replaceChild(kap, ch);
        } else if (ch.nodeType === 1 && ch.nodeName !== "BR" && ch.nodeName !== "SVG") yuru(ch);
      });
    })(kok);
  }
  /* Uzun bir sözcük dar ekranda taşırsa (de, hu, el...) o başlık bölünmeden kalır. */
  function bol(el) {
    if (el.__bolundu) return;
    el.__bolundu = 1;
    var yedek = el.innerHTML;
    parcala(el);
    if (el.scrollWidth > el.clientWidth + 1) { el.innerHTML = yedek; el.__bolundu = 0; el.classList.add("bolme"); return false; }
    return true;
  }
  MH.bol = bol;
  MH.basliklar = function (liste, gozlem) {
    liste.forEach(function (el) {
      if (!bol(el)) { el.classList.add("gor"); return; }
      if (gozlem !== false) { el.setAttribute("data-b", ""); if (gozle) gozle.observe(el); else el.classList.add("gor"); }
    });
    /* yeniden boyutta taşma kontrolü: sığmayan başlık sade metne döner */
    var son = W.innerWidth, t = 0;
    W.addEventListener("resize", function () {
      clearTimeout(t);
      t = setTimeout(function () {
        if (W.innerWidth >= son) { son = W.innerWidth; return; }
        son = W.innerWidth;
        liste.forEach(function (el) {
          if (el.__bolundu && el.scrollWidth > el.clientWidth + 1) {
            el.querySelectorAll(".w").forEach(function (w) { w.replaceWith(D.createTextNode(w.textContent)); });
            el.normalize(); el.__bolundu = 0; el.classList.add("bolme", "gor");
          }
        });
      }, 160);
    });
  };

  /* ---------- sayaçlar: görününce 0'dan çıkar; biçim metindeki ayraçla aynı (yerel) ---------- */
  var SAY = /^(~?)(\d{1,3}(?:([.,  ' ])\d{3})+|\d+)(\D*)$/;
  function sayac(el) {
    var t = el.textContent.trim(), m = SAY.exec(t);
    if (!m) return null;
    var ayrac = m[3] || "", hedef = parseInt(m[2].replace(/[.,  ' ]/g, ""), 10);
    if (!(hedef >= 10)) return null;
    var onek = m[1], sonek = m[4];
    var bicim = function (n) {
      var s = String(Math.round(n));
      if (ayrac) s = s.replace(/\B(?=(\d{3})+(?!\d))/g, ayrac);
      return onek + s + sonek;
    };
    return { el: el, son: el.textContent, hedef: hedef, bicim: bicim };
  }
  function saydir(s) {
    var t0 = 0, sure = Math.min(1900, 900 + Math.log10(s.hedef + 1) * 260);
    function adim(t) {
      if (!t0) t0 = t;
      var k = Math.min(1, (t - t0) / sure), e = k === 1 ? 1 : 1 - Math.pow(2, -10 * k);
      if (k < 1) { s.el.textContent = s.bicim(s.hedef * e); requestAnimationFrame(adim); } else s.el.textContent = s.son;
    }
    requestAnimationFrame(adim);
  }
  MH.sayaclar = function (liste) {
    var kayit = [];
    liste.forEach(function (el) { var s = sayac(el); if (s) { s.el.__s = s; s.el.textContent = s.bicim(0); kayit.push(s); } });
    if (!IO) { kayit.forEach(function (s) { s.el.textContent = s.son; }); return; }
    var g = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { g.unobserve(e.target); saydir(e.target.__s); } });
    }, { threshold: .2, rootMargin: "0px 0px -4% 0px" });
    kayit.forEach(function (s) { g.observe(s.el); });
  };

  /* ---------- işaretçi eğimi (yalnız ince işaretçi: fare/kalem) ---------- */
  MH.egim = function (liste, azami) {
    if (!ince || hafif) return;
    azami = azami || 9;
    liste.forEach(function (el) {
      var raf = 0, ex, ey;
      function yaz() {
        raf = 0;
        var r = el.getBoundingClientRect(), px = (ex - r.left) / r.width, py = (ey - r.top) / r.height;
        px = Math.min(1, Math.max(0, px)); py = Math.min(1, Math.max(0, py));
        el.style.setProperty("--ry", ((px - .5) * 2 * azami).toFixed(2) + "deg");
        el.style.setProperty("--rx", ((.5 - py) * 2 * azami * .8).toFixed(2) + "deg");
        el.style.setProperty("--gx", (px * 100).toFixed(1) + "%");
        el.style.setProperty("--gy", (py * 100).toFixed(1) + "%");
      }
      el.addEventListener("pointerenter", function (e) { if (e.pointerType === "touch") return; el.classList.add("tilt"); });
      el.addEventListener("pointermove", function (e) { if (e.pointerType === "touch") return; ex = e.clientX; ey = e.clientY; if (!raf) raf = requestAnimationFrame(yaz); });
      el.addEventListener("pointerleave", function () {
        el.classList.remove("tilt"); el.style.removeProperty("--rx"); el.style.removeProperty("--ry");
      });
    });
  };

  /* ---------- mıknatıs düğmeler: yakına gelen işaretçiye doğru en çok 9 px kayar ---------- */
  MH.miknatis = function (liste) {
    if (!ince || hafif || !liste.length) return;
    var px = -999, py = -999, raf = 0, gorunen = new Set();
    var o = IO && new IntersectionObserver(function (es) { es.forEach(function (e) { e.isIntersecting ? gorunen.add(e.target) : gorunen.delete(e.target); }); });
    liste.forEach(function (b) { if (o) o.observe(b); else gorunen.add(b); });
    function yaz() {
      raf = 0;
      gorunen.forEach(function (b) {
        var r = b.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        var dx = px - cx, dy = py - cy, yakin = Math.abs(dx) < r.width / 2 + 46 && Math.abs(dy) < r.height / 2 + 46;
        if (yakin) { b.classList.add("mkn"); b.style.setProperty("--mx", Math.max(-9, Math.min(9, dx * .22)).toFixed(1) + "px"); b.style.setProperty("--my", Math.max(-7, Math.min(7, dy * .28)).toFixed(1) + "px"); }
        else if (b.classList.contains("mkn")) { b.classList.remove("mkn"); b.style.removeProperty("--mx"); b.style.removeProperty("--my"); }
      });
    }
    D.addEventListener("pointermove", function (e) { if (e.pointerType === "touch") return; px = e.clientX; py = e.clientY; if (!raf) raf = requestAnimationFrame(yaz); }, { passive: true });
  };

  /* ---------- hafif paralaks: sd'de CSS view(); yoksa yalnız görünen öğelere --p yazılır ---------- */
  MH.paralaks = function (liste, ek) {
    if (hafif) return;
    liste.forEach(function (e) { e.classList.add("par"); if (ek) e.classList.add(ek); });
    if (SD || !IO) return;
    var gorunen = new Set(), o = new IntersectionObserver(function (es) {
      es.forEach(function (e) { e.isIntersecting ? gorunen.add(e.target) : gorunen.delete(e.target); });
      iste();
    }, { rootMargin: "80px 0px" });
    liste.forEach(function (e) { o.observe(e); });
    MH.kanca(function () {
      var vh = W.innerHeight;
      gorunen.forEach(function (e) {
        var r = e.getBoundingClientRect();
        e.style.setProperty("--p", Math.min(1, Math.max(0, (vh - r.top) / (vh + r.height))).toFixed(3));
      });
    });
  };
})();
