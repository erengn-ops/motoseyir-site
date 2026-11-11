/*
 * Web tur üreticisi — GEÇİŞ NOKTASI mantığı (11 Kas 2026). Saf işlevler (tarayıcı + node testi): duzen.js kullanıyor.
 *
 * Geçiş noktası = rotayı şekillendiren, DURAK OLMAYAN nokta (Valhalla `through`; uygulamadaki `araNokta` ile aynı anlam). Numarası yok,
 * bacak açmıyor, süre/durak sayısına girmiyor. Her nokta, bağlı olduğu bacağı iki durağın kimliğiyle taşır (`once` → `sonra`);
 * durak eklenir, silinir ya da sıra değişirse bacak değişir: o zaman nokta en yakın bacağa yeniden bağlanır ("en uygun sıra"
 * dahil — nokta, kendisine en yakın bacakta kalır). Bacak aynı kaldıysa noktaya dokunulmaz.
 */
(function (kok) {
  'use strict';
  var R = 6371000;
  function xy(p, lat0) { return { x: (p.longitude - 0) * Math.PI / 180 * R * Math.cos(lat0 * Math.PI / 180), y: p.latitude * Math.PI / 180 * R }; }
  /* Noktanın a→b doğru parçasına uzaklığı (m) ve parçadaki konumu (0..1) — kısa bacaklarda düzlemsel yaklaşım yeterli. */
  function parcayaUzaklik(p, a, b) {
    var lat0 = (a.latitude + b.latitude) / 2, P = xy(p, lat0), A = xy(a, lat0), B = xy(b, lat0);
    var dx = B.x - A.x, dy = B.y - A.y, u = dx * dx + dy * dy;
    var t = u > 0 ? Math.max(0, Math.min(1, ((P.x - A.x) * dx + (P.y - A.y) * dy) / u)) : 0;
    var qx = A.x + t * dx, qy = A.y + t * dy;
    return { m: Math.hypot(P.x - qx, P.y - qy), t: t };
  }
  /* Noktaya en yakın bacak: duraklar (kapanış kopyası dahil, `_id`li) arasındaki i → i+1. */
  function enYakinBacak(duraklar, p) {
    var en = -1, fark = Infinity, t = 0;
    for (var i = 0; i < duraklar.length - 1; i++) {
      var u = parcayaUzaklik(p, duraklar[i], duraklar[i + 1]);
      if (u.m < fark) { fark = u.m; en = i; t = u.t; }
    }
    return { bacak: en, t: t };
  }
  function bacakBul(duraklar, g) {
    for (var i = 0; i < duraklar.length - 1; i++) if (duraklar[i]._id === g.once && duraklar[i + 1]._id === g.sonra) return i;
    return -1;
  }
  /* Durak listesi değiştikten sonra noktaları yeniden bağla; bacağı değişen nokta en yakın bacağa gider, o bacaktaki sıra doğruluktan kurulur. */
  function bagla(duraklar, gecisler) {
    if (!gecisler || !gecisler.length || duraklar.length < 2) return [];
    var tut = [], bacakta = {};
    gecisler.forEach(function (g, k) {
      var i = bacakBul(duraklar, g), eski = i >= 0;
      if (!eski) { i = enYakinBacak(duraklar, g).bacak; bacakta[i] = true; }
      if (i < 0) return;
      tut.push({ g: g, i: i, k: k, t: parcayaUzaklik(g, duraklar[i], duraklar[i + 1]).t });
    });
    tut.sort(function (a, b) {
      if (a.i !== b.i) return a.i - b.i;
      return bacakta[a.i] ? a.t - b.t || a.k - b.k : a.k - b.k;
    });
    return tut.map(function (x) {
      return { latitude: x.g.latitude, longitude: x.g.longitude, _id: x.g._id, once: duraklar[x.i]._id, sonra: duraklar[x.i + 1]._id };
    });
  }
  /* Rota isteğinin biçimi: bacak başına sıralı noktalar (giris.ts rotaKur `gecisler`). */
  function bacakli(duraklar, gecisler) {
    var cikti = [];
    (gecisler || []).forEach(function (g) {
      var i = bacakBul(duraklar, g);
      if (i >= 0) cikti.push({ latitude: g.latitude, longitude: g.longitude, bacak: i });
    });
    return cikti;
  }
  /* Paylaşılan turdan (stops: gecis/araNokta bayraklı) gerçek duraklar + noktalar: ilk ve son nokta durak sayılır. */
  function ayir(stops) {
    var gercek = [], gecis = [];
    stops.forEach(function (s, i) {
      var ara = (s.gecis === true || s.araNokta === true) && i > 0 && i < stops.length - 1;
      if (ara) gecis.push({ s: s, onceki: gercek.length - 1 }); else gercek.push(s);
    });
    return { gercek: gercek, gecis: gecis };
  }
  var api = { enYakinBacak: enYakinBacak, bagla: bagla, bacakli: bacakli, ayir: ayir, parcayaUzaklik: parcayaUzaklik };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else kok.TurGecis = api;
})(typeof window !== 'undefined' ? window : this);
