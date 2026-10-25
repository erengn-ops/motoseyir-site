/*
 * Web tur üreticisi — TUR DÜZENLEYİCİ (27 Eki 2026). Uygulamadaki Turlarım → bir tur açık ekranının (TourScreen "Duraklar" sekmesi) webdeki karşılığı;
 * kadranla üretilen (ya da boş başlatılan, ya da tur koduyla açılan) tur burada uygulamadaki gibi DÜZENLENİR:
 *   • Başlangıç + numaralı duraklar, aralarında bacak hapları (km · süre), yukarı/aşağı + sürükle-bırak sıralama, silme, durak ekleme
 *     (haritaya dokun / yer ara / rotanın üstünden tutup çek / Yol üstünde kartından). Haritadaki numaralı işaretler sürüklenebilir.
 *   • Her değişiklikte rota yeniden hesaplanır (kısa bekleme + iptal edilebilir; en son istek kazanır). Dönüş turunda bitiş = başlangıç.
 *   • Rota kipi (Standart / Köy yolları / Sahil): uygulamadaki modlar; değişince yeniden rotalanır.
 *   • Her durakta VARIŞ SAATİNE göre hava çipi (MET Norway; tarayıcı doğrudan çağıramadığı için vekil: /web/hava). Hava ikincil: gelmezse çip yok.
 * Çizim, durum ve ağ tur.js'te; buraya window.TurDuzenKancasi ve tur:* olaylarıyla bağlanır. GPX içe/dışa aktarma YOK.
 * Hareket: power3/expo; yay yok; prefers-reduced-motion: geçişsiz.
 */
(function () {
  'use strict';
  var K = window.TurDuzenKancasi;
  if (!K) return;
  var st = K.st, M = K.M, T = K.T, A = K.A, $ = K.$, $$ = K.$$, esc = K.esc, doldur = K.doldur, reduce = K.reduce;
  var D = document, W = window;
  var MAX_DURAK = 26;                 // uygulamadaki MAX_DURAK (TourScreen)
  var ROTA_BEKLEME = 650;
  var HAVA_TTL = 30 * 60 * 1000;

  function tur() { return st.sonuc[st.secili] || null; }
  function donus(t) { return K.turDonus(t); }
  function kimlik() { return Math.random().toString(36).slice(2, 9); }
  function nokta(c) { return { latitude: c.latitude, longitude: c.longitude, _id: c._id || kimlik() }; }
  /* Düzenlenen liste: dönüş turunda sondaki "başlangıca dön" noktası listede yok. */
  function liste(t) { return donus(t) ? t.duraklar.slice(0, -1) : t.duraklar.slice(); }
  function adlar(t) { var a = st.adlar.get(t); if (!a) { a = []; st.adlar.set(t, a); } return a; }
  function yaz(t, noktalar, adlarListe) {
    noktalar = noktalar.map(nokta);
    t.duraklar = donus(t) && noktalar.length ? noktalar.concat([{ latitude: noktalar[0].latitude, longitude: noktalar[0].longitude, _id: noktalar[0]._id + 'b' }]) : noktalar;
    var a = adlarListe.slice();
    if (donus(t) && a.length) a.push(a[0]);
    st.adlar.set(t, a);
  }
  function ad(t, i) {
    var a = adlar(t)[i];
    return a || (i === 0 ? T.dz_baslangic : doldur(T.dz_durak_n, { n: i }));
  }
  function modu(t) { return t.mod || (t.efsane ? t.efsane.mod : null) || M.turKipi(st.seviye); }
  function modAdi(m) { return m === 'sahil' ? T.rk_sahil : m === 'koy' || m === 'enduro' ? T.rk_koy : T.rk_standart; }

  /* ---------------------------------------------------------------- biçim */
  function kmYazi(m) { var mi = st.birim === 'mi'; return K.f1(mi ? m / 1609.344 : m / 1000) + (mi ? ' mi' : ' km'); }
  function derece(c) { return st.birim === 'mi' ? Math.round(c * 9 / 5 + 32) + '°' : Math.round(c) + '°'; }

  /* ---------------------------------------------------------------- hava (MET Norway, vekil /web/hava) */
  var havaOnbellek = {}, havaDusuk = {}, havaKuyruk = 0;
  function havaTaban() {
    var d = A.vekil || '';
    try { if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname) && localStorage.getItem('motoseyir.hava.taban')) d = localStorage.getItem('motoseyir.hava.taban'); } catch (e) { /* yerel sınama anahtarı yok */ }
    return d;
  }
  function havaHucre(c) { return c.latitude.toFixed(2) + ',' + c.longitude.toFixed(2); }
  function havaAl(c) {
    var h = havaHucre(c), o = havaOnbellek[h];
    if (o && Date.now() - o.at < HAVA_TTL) return Promise.resolve(o.saat);
    if (o && o.bekle) return o.bekle;
    if ((havaDusuk[h] || 0) > Date.now() - 60000) return Promise.resolve(null);
    var p = fetch(havaTaban() + '/web/hava?lat=' + c.latitude.toFixed(2) + '&lon=' + c.longitude.toFixed(2))
      .then(function (r) { if (!r.ok) throw new Error('hava'); return r.json(); })
      .then(function (j) { havaOnbellek[h] = { at: Date.now(), saat: j.saat || [] }; return havaOnbellek[h].saat; })
      .catch(function () { havaDusuk[h] = Date.now(); delete havaOnbellek[h]; return null; });
    havaOnbellek[h] = { at: 0, bekle: p, saat: null };
    return p;
  }
  function enYakinSaat(saat, an) {
    var en = null, fark = Infinity;
    saat.forEach(function (x) { var d = Math.abs(Date.parse(x.time) - an); if (d < fark) { fark = d; en = x; } });
    return fark <= 3 * 3600 * 1000 ? en : null;
  }
  function simge(sembol) {
    var b = String(sembol || '').replace(/_(day|night|polartwilight)$/, '');
    var g = function (p, c) { return '<svg viewBox="0 0 20 20" width="15" height="15" aria-hidden="true" class="hv-ik ' + c + '">' + p + '</svg>'; };
    if (/thunder/.test(b)) return [g('<path d="M5 12a4 4 0 0 1 .8-7.9A5 5 0 0 1 15.4 5 3.5 3.5 0 0 1 15 12zM9.5 11 7.5 15h2.5l-1 3.5 3.5-5H10l1-2.5z" fill="currentColor"/>', 'bulut'), T.hava_firtina];
    if (/snow|sleet/.test(b)) return [g('<path d="M5 10a4 4 0 0 1 .8-7.9A5 5 0 0 1 15.4 3 3.5 3.5 0 0 1 15 10z" fill="currentColor"/><path d="M6 13.5v3M10 13.5v4M14 13.5v3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>', 'yagis'), T.hava_kar];
    if (/rain/.test(b)) return [g('<path d="M5 10a4 4 0 0 1 .8-7.9A5 5 0 0 1 15.4 3 3.5 3.5 0 0 1 15 10z" fill="currentColor"/><path d="M6.5 13l-1 3M10.5 13l-1 3.5M14.5 13l-1 3" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>', 'yagis'), T.hava_yagmur];
    if (/fog/.test(b)) return [g('<path d="M3 7h14M5 11h12M3 15h13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>', 'bulut'), T.hava_sis];
    if (/^cloudy/.test(b)) return [g('<path d="M5 15a4 4 0 0 1 .8-7.9A5 5 0 0 1 15.4 8 3.5 3.5 0 0 1 15 15z" fill="currentColor"/>', 'bulut'), T.hava_bulutlu];
    if (/partlycloudy|fair/.test(b)) return [g('<circle cx="7" cy="7" r="3.2" fill="currentColor" class="gunes"/><path d="M7 16a3.6 3.6 0 0 1 .6-7.1A4.6 4.6 0 0 1 16 10a3 3 0 0 1-.5 6z" fill="#9fb0ad"/>', 'kismi'), T.hava_bulutlu];
    return [g('<circle cx="10" cy="10" r="3.6" fill="currentColor"/><path d="M10 2v2.5M10 15.5V18M2 10h2.5M15.5 10H18M4.3 4.3l1.8 1.8M13.9 13.9l1.8 1.8M15.7 4.3l-1.8 1.8M6.1 13.9l-1.8 1.8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>', 'gunes'), T.hava_acik];
  }
  function havaChip(x) {
    if (!x || x.temperatureC == null) return '';
    var s = simge(x.symbol);
    var yag = x.precipitationMm != null && x.precipitationMm > 0 ? ' · ' + K.f1(x.precipitationMm) + ' mm' : '';
    return '<span class="hv" title="' + esc(T.hava_etiket + ': ' + s[1] + ', ' + derece(x.temperatureC) + yag) + '">' + s[0] + '<b>' + derece(x.temperatureC) + '</b></span>';
  }
  var havaNo = 0;
  function havaYukle() {
    var t = tur(), no = ++havaNo;
    if (!t || !t.coordinates.length || !(t.rota.bacaklar || []).length) { havaYaz({}); return; }
    var l = liste(t), eta = [], gec = 0, bas = Date.now();
    l.forEach(function (_, i) { if (i > 0) gec += (t.rota.bacaklar[i - 1] || {}).sn || 0; eta.push(bas + gec * 1000); });
    var sonuc = {};
    var isler = l.map(function (c, i) { return function () { return havaAl(c).then(function (saat) { if (no === havaNo && saat) sonuc[i] = enYakinSaat(saat, eta[i]); }); }; });
    var calis = function () {
      var kuyruk = isler.slice(), calisan = 0, bitti = 0;
      return new Promise(function (ok) {
        (function sonraki() {
          while (calisan < 3 && kuyruk.length) { calisan++; kuyruk.shift()().then(function () { calisan--; bitti++; havaYaz(sonuc); if (bitti === isler.length) ok(); else sonraki(); }); }
          if (!isler.length) ok();
        })();
      });
    };
    calis();
  }
  var sonHava = {};
  function havaYaz(sonuc) {
    sonHava = sonuc;
    $$('#tur-duraklar .dz-hava').forEach(function (e) { e.innerHTML = havaChip(sonuc[+e.dataset.k]); });
    $$('.tur-nokta.durak').forEach(function (e) {
      var eski = e.querySelector('.hv'); if (eski) eski.remove();
      var k = +e.dataset.k, c = sonuc[k];
      if (c && st.kip === 'duzen') e.querySelector('.ic').insertAdjacentHTML('beforeend', havaChip(c));
    });
  }

  /* ---------------------------------------------------------------- görünüm */
  var liEl = $('#tur-duraklar'), notEl = $('#tur-duzen-not');
  function not(metin, tur_) { notEl.textContent = metin || ''; notEl.hidden = !metin; notEl.className = 'tur-duzen-not' + (tur_ ? ' ' + tur_ : ''); }
  var UST = '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="m3.5 10 4.5-4.5L12.5 10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var ALT = '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="m3.5 6 4.5 4.5L12.5 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var SIL = '<svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true"><path d="m4 4 8 8M12 4l-8 8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  var TUT = '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><circle cx="5.5" cy="4" r="1.3" fill="currentColor"/><circle cx="10.5" cy="4" r="1.3" fill="currentColor"/><circle cx="5.5" cy="8" r="1.3" fill="currentColor"/><circle cx="10.5" cy="8" r="1.3" fill="currentColor"/><circle cx="5.5" cy="12" r="1.3" fill="currentColor"/><circle cx="10.5" cy="12" r="1.3" fill="currentColor"/></svg>';
  function ciz() {
    var t = tur();
    var bos = !t;
    $('#tur-duzen-bos').hidden = !bos;
    $('#tur-duzen-ic').hidden = bos;
    $('#tur-donus').checked = t ? donus(t) : true;
    if (!t) { liEl.innerHTML = ''; toplamYaz(); return; }
    var l = liste(t), bac = t.rota.bacaklar || [], don = donus(t), h = '';
    l.forEach(function (c, i) {
      var son = i === l.length - 1, rol = i === 0 ? T.dz_baslangic : son && !don ? T.dz_bitis : '';
      h += '<li class="dz-durak' + (i === 0 ? ' ilk' : '') + '" data-i="' + i + '">' +
        (i > 0 ? '<button type="button" class="dz-tut" aria-label="' + esc(T.dz_surukle) + '" title="' + esc(T.dz_surukle) + '">' + TUT + '</button>' : '<span class="dz-tut yok"></span>') +
        '<span class="dz-no">' + (i + 1) + '</span>' +
        '<span class="dz-metin"><b>' + esc(ad(t, i)) + '</b>' + (rol ? '<small>' + esc(rol) + '</small>' : '') + '</span>' +
        '<span class="dz-hava" data-k="' + i + '">' + havaChip(sonHava[i]) + '</span>' +
        '<span class="dz-islem">' + (i > 0 ? '<button type="button" data-ac="yukari" aria-label="' + esc(T.dz_yukari) + '"' + (i < 2 ? ' disabled' : '') + '>' + UST + '</button>' +
          '<button type="button" data-ac="asagi" aria-label="' + esc(T.dz_asagi) + '"' + (son ? ' disabled' : '') + '>' + ALT + '</button>' +
          '<button type="button" data-ac="sil" class="sil" aria-label="' + esc(T.dz_sil) + '">' + SIL + '</button>' : '') + '</span></li>';
      var b = bac[i];
      if (b && (i < l.length - 1 || don)) h += '<li class="dz-bacak" aria-hidden="true"><span>' + esc(kmYazi(b.m) + ' · ' + K.sureYazi(b.sn)) + '</span></li>';
    });
    if (don && l.length) h += '<li class="dz-durak dz-bitis"><span class="dz-tut yok"></span><span class="dz-no bayrak">&#9873;</span><span class="dz-metin"><b>' + esc(T.dz_bitis_donus) + '</b></span></li>';
    liEl.innerHTML = h;
    toplamYaz();
    if (t.hesapla) not(T.dz_hesap);
    else if (l.length < (don ? 2 : 2)) not(T.dz_en_az);
    else if (t.rota.koyBulunamadi) not(T.dz_koy_yok, 'bilgi');
    else if (t.rota.erisilemezDurak != null) not(doldur(T.dz_erisilemez, { n: t.rota.erisilemezDurak + 1 }), 'uyari');
    else not('');
    $('#tur-durak-ekle').disabled = l.length >= MAX_DURAK;
  }
  function toplamYaz() {
    var t = tur(), e = $('#tur-toplam');
    var goster = !!t && t.coordinates.length > 1 && (st.kip === 'duzen' || st.kip === 'uret') && st.evre === 'sonuc';
    e.hidden = !goster;
    if (!goster) return;
    $('#tur-toplam-km').textContent = kmYazi(t.rota.totalDistanceMeters);
    $('#tur-toplam-sure').textContent = K.sureYazi(t.rota.totalDurationSeconds);
    e.classList.toggle('hesap', !!t.hesapla);
  }
  function kipSeciciYaz() {
    var t = tur(), e = $('#tur-kip-secici');
    e.hidden = !(t && st.kip === 'duzen');
    if (!t) return;
    var m = modu(t) === 'enduro' ? 'koy' : modu(t);
    $('#tur-kip-secici-ad').textContent = modAdi(m);
    e.dataset.m = m;
    $$('#tur-kip-liste li').forEach(function (li) { li.setAttribute('aria-selected', li.dataset.kip === m); });
  }

  /* ---------------------------------------------------------------- işlemler (hepsi aynı yoldan: değişir → liste/işaretler → rota) */
  var rotaZ = 0, rotaNo = 0, yeniSira = null;
  function degisti(yeniIdx) {
    var t = tur(); if (!t) return;
    st.paylasim.delete(t); K.paylasKapat();
    if (yeniIdx != null) yeniSira = yeniIdx;
    ciz();
    K.haritaSonuc('ayni');                                  // işaretler anında (numaralar, sıra); çizgi rota gelince
    clearTimeout(rotaZ);
    rotaZ = setTimeout(hesapla, ROTA_BEKLEME);
  }
  function bosalt(t) {
    t.coordinates = []; t.rota = { totalDistanceMeters: 0, totalDurationSeconds: 0, icerik: {}, bacaklar: [] }; t.olcu = { sertKm: 0, ortusme: 0 }; t.gecitler = []; t.hesapla = false;
    K.turuYenidenCiz(); ciz(); havaYaz({});
  }
  function hesapla() {
    var t = tur(); if (!t) return;
    var l = liste(t);
    if (l.length < 2) { rotaNo++; bosalt(t); return; }
    var no = ++rotaNo, idx = yeniSira; yeniSira = null;
    t.hesapla = true; ciz();
    M.sayaciSifirla();
    var pts = t.duraklar.map(function (c) { return { latitude: c.latitude, longitude: c.longitude }; });
    M.rotaKur(pts, st.seviye, t.kacin, modu(t), idx != null ? idx : undefined).then(function (r) {
      if (no !== rotaNo || tur() !== t) return;
      t.coordinates = r.coordinates; t.rota = r.rota; t.olcu = r.olcu; t.gecitler = r.gecitler; t.hesapla = false;
      K.turuYenidenCiz(); ciz(); havaYukle(); sigdirGerekirse(t);
    }).catch(function () {
      if (no !== rotaNo || tur() !== t) return;
      t.hesapla = false; ciz(); not(T.dz_hata, 'hata');
    });
  }
  /* Düzenleme turu panelin/çubuğun örttüğü yere ya da ekran dışına itmişse kamera yumuşakça sığdırır (görünüyorsa dokunmaz). */
  function sigdirGerekirse(t) {
    var h = K.harita(); if (!h || st.kip !== 'duzen' || !t.coordinates.length) return;
    var q = h.getPadding(), c = h.getContainer(), dis = false, b = new maplibregl.LngLatBounds();
    t.coordinates.forEach(function (x) { b.extend([x.longitude, x.latitude]); });
    liste(t).forEach(function (x) {
      var p = h.project([x.longitude, x.latitude]);
      if (p.x < q.left + 30 || p.x > c.clientWidth - q.right - 30 || p.y < q.top + 30 || p.y > c.clientHeight - q.bottom - 30) dis = true;
    });
    if (dis) h.fitBounds(b, K.kamera({ padding: 60, maxZoom: 13, duration: 800 }));
  }
  function adiYukle(t, c) {
    K.tersAdAl(c.latitude, c.longitude).then(function (a) {
      var i = t.duraklar.findIndex(function (x) { return x._id === c._id; });
      if (i < 0 || !a) return;
      adlar(t)[i] = a;
      if (donus(t) && i === 0) adlar(t)[t.duraklar.length - 1] = a;
      if (tur() === t) ciz();
    });
  }
  function sil(i) {
    var t = tur(), l = liste(t), a = adlar(t).slice(0, l.length);
    if (i < 1 || i >= l.length) return;
    l.splice(i, 1); a.splice(i, 1);
    yaz(t, l, a); degisti();
  }
  function tasiSira(i, j) {
    var t = tur(), l = liste(t), a = adlar(t).slice(0, l.length);
    if (i < 1 || j < 1 || j >= l.length || i === j) return;
    var x = l.splice(i, 1)[0], n = a.splice(i, 1)[0];
    l.splice(j, 0, x); a.splice(j, 0, n);
    yaz(t, l, a); degisti();
  }
  function ekle(lat, lng, ad_, idx) {
    var t = tur(); if (!t) return;
    var l = liste(t), a = adlar(t).slice(0, l.length);
    if (l.length >= MAX_DURAK) { not(doldur(T.dz_sinir, { n: MAX_DURAK }), 'uyari'); return; }
    var c = { latitude: Math.round(lat * 1e5) / 1e5, longitude: Math.round(lng * 1e5) / 1e5, _id: kimlik() };
    var i = idx != null ? idx : l.length;      // varsayılan: sona (dönüş turunda bitişten önce)
    l.splice(i, 0, c); a.splice(i, 0, ad_ || '');
    yaz(t, l, a);
    var ekli = t.duraklar.filter(function (x) { return x._id === c._id; })[0] || t.duraklar[i];
    if (!ad_) adiYukle(t, ekli);
    degisti(i);
  }
  function tasi(k, lat, lng) {
    var t = tur(); if (!t || !t.duraklar[k]) return;
    var l = liste(t), a = adlar(t).slice(0, l.length);
    if (k >= l.length) return;
    l[k] = { latitude: Math.round(lat * 1e5) / 1e5, longitude: Math.round(lng * 1e5) / 1e5, _id: l[k]._id };
    a[k] = '';
    yaz(t, l, a);
    if (k === 0) { st.S = { latitude: l[0].latitude, longitude: l[0].longitude }; }
    adiYukle(t, t.duraklar[k]);
    degisti(k);
  }
  function donusDegis(v) {
    var t = tur(); if (!t) return;
    var l = liste(t), a = adlar(t).slice(0, l.length);
    t.donus = !!v;
    yaz(t, l, a); degisti();
  }

  /* ---------------------------------------------------------------- olaylar: liste düğmeleri ve sürükle-bırak */
  liEl.addEventListener('click', function (e) {
    var b = e.target.closest('button[data-ac]'); if (!b || b.disabled) return;
    var i = +b.closest('.dz-durak').dataset.i, ac = b.dataset.ac;
    if (ac === 'sil') sil(i); else if (ac === 'yukari') tasiSira(i, i - 1); else if (ac === 'asagi') tasiSira(i, i + 1);
  });
  var surukle = null;
  liEl.addEventListener('pointerdown', function (e) {
    var g = e.target.closest('.dz-tut:not(.yok)'); if (!g) return;
    var li = g.closest('.dz-durak'), satirlar = $$('.dz-durak:not(.dz-bitis)', liEl);
    surukle = { li: li, i: +li.dataset.i, y0: e.clientY, hedef: +li.dataset.i, satirlar: satirlar, id: e.pointerId };
    try { g.setPointerCapture(e.pointerId); } catch (x) { /* eski */ }
    li.classList.add('suruklenen');
    e.preventDefault();
  });
  liEl.addEventListener('pointermove', function (e) {
    if (!surukle || e.pointerId !== surukle.id) return;
    var dy = e.clientY - surukle.y0;
    surukle.li.style.transform = 'translate3d(0,' + dy + 'px,0)';
    var r = surukle.li.getBoundingClientRect(), mid = r.top + r.height / 2, hedef = surukle.i;
    surukle.satirlar.forEach(function (s, k) {
      if (k === 0 || s === surukle.li) return;
      var q = s.getBoundingClientRect(), m = q.top + q.height / 2;
      if (k < surukle.i && mid < m) hedef = Math.min(hedef, k);
      if (k > surukle.i && mid > m) hedef = Math.max(hedef, k);
    });
    surukle.hedef = hedef;
    surukle.satirlar.forEach(function (s, k) { s.classList.toggle('hedef', k === hedef && k !== surukle.i); });
  });
  function surukleBitir(e, iptal) {
    if (!surukle || (e && e.pointerId !== surukle.id)) return;
    var s = surukle; surukle = null;
    s.li.classList.remove('suruklenen'); s.li.style.transform = '';
    s.satirlar.forEach(function (x) { x.classList.remove('hedef'); });
    if (!iptal && s.hedef !== s.i) tasiSira(s.i, s.hedef);
  }
  liEl.addEventListener('pointerup', function (e) { surukleBitir(e, false); });
  liEl.addEventListener('pointercancel', function (e) { surukleBitir(e, true); });

  $('#tur-donus').addEventListener('change', function () { donusDegis(this.checked); });
  $('#tur-duzen-surus').addEventListener('click', function () { if (W.TurSurus) W.TurSurus.sur(); });
  $('#tur-duzen-sil').addEventListener('click', function () { K.ayaraDon(false); K.kipSec('uret'); });
  $('#tur-duzenle').addEventListener('click', function () { K.kipSec('duzen'); });
  $('#tur-rotalar-git').addEventListener('click', function () { K.kipSec('rotalar'); });
  $('#tur-duzen-bos-tur').addEventListener('click', function () { bosTur(); });
  $('#tur-duzen-kod').addEventListener('click', function () { K.kipSec('uret'); kodAc(true); });

  /* ---------------------------------------------------------------- durak ekleme: haritaya dokun / yer ara */
  var ekleKipi = false;
  function ekleKipiAc(a) {
    ekleKipi = !!a;
    var b = $('#tur-durak-ekle'); b.setAttribute('aria-pressed', ekleKipi); b.classList.toggle('acik', ekleKipi);
    var h = K.harita(); if (h) h.getCanvas().style.cursor = ekleKipi ? 'crosshair' : '';
    var ip = $('#tur-ipucu'); ip.textContent = ekleKipi ? T.dz_ekle_ipucu : T.harita_ipucu; ip.hidden = !ekleKipi;
  }
  $('#tur-durak-ekle').addEventListener('click', function () { ekleKipiAc(!ekleKipi); });
  W.addEventListener('tur:harita-tik', function (e) {
    if (!ekleKipi) return;
    ekleKipiAc(false);
    ekle(e.detail.lat, e.detail.lng);
  });
  var araListe = $('#tur-durak-ara-sonuc'), araGirdi = $('#tur-durak-ara-girdi');
  $('#tur-durak-ara').addEventListener('submit', function (e) {
    e.preventDefault();
    var q = araGirdi.value.trim(); if (q.length < 2) return;
    var h = K.harita(), c = h ? h.getCenter() : { lat: 40, lng: 30 }, d = A.dil === 'tr' ? 'default' : A.dil;
    araListe.hidden = false; araListe.innerHTML = '<li class="not">' + esc(T.araniyor) + '</li>';
    fetch('https://photon.komoot.io/api/?q=' + encodeURIComponent(q) + '&limit=5&lang=' + d + '&lat=' + c.lat.toFixed(3) + '&lon=' + c.lng.toFixed(3))
      .then(function (r) { if (!r.ok) throw new Error('ara'); return r.json(); })
      .then(function (j) {
        var f = (j.features || []).filter(function (x) { return x.geometry && x.geometry.coordinates; });
        if (!f.length) { araListe.innerHTML = '<li class="not">' + esc(T.ara_yok) + '</li>'; return; }
        araListe.innerHTML = f.map(function (x, i) {
          var o = x.properties, a = o.name || o.street || '', alt = [o.city || o.town || o.village, o.state, o.country].filter(Boolean).join(', ');
          return '<li><button type="button" data-i="' + i + '"><strong>' + esc(a) + '</strong><span>' + esc(alt) + '</span></button></li>';
        }).join('');
        $$('button', araListe).forEach(function (b) {
          b.addEventListener('click', function () {
            var x = f[+b.dataset.i], o = x.properties;
            araListe.hidden = true; araGirdi.value = '';
            ekle(x.geometry.coordinates[1], x.geometry.coordinates[0], [o.name || o.street, o.city && o.city !== o.name ? o.city : ''].filter(Boolean).join(', '));
            var hh = K.harita(); if (hh) hh.easeTo(K.kamera({ center: [x.geometry.coordinates[0], x.geometry.coordinates[1]], duration: 700 }));
          });
        });
      }).catch(function () { araListe.innerHTML = '<li class="not">' + esc(T.ara_hata) + '</li>'; });
  });
  D.addEventListener('click', function (e) { if (!e.target.closest('.tur-durak-ekle-kutu')) araListe.hidden = true; });

  /* ---------------------------------------------------------------- haritada: işaret sürükleme, rotadan tutup araya durak */
  W.addEventListener('tur:durak-tasindi', function (e) { if (st.kip === 'duzen') tasi(e.detail.k, e.detail.lat, e.detail.lng); });
  var rotaDinleniyor = false;
  function rotaDinle() {
    var h = K.harita(); if (!h || rotaDinleniyor || !h.getLayer('rota-secili')) return;
    rotaDinleniyor = true;
    var tutBasla = function (e) {
      if (st.kip !== 'duzen' || st.evre !== 'sonuc' || ekleKipi) return;
      var t = tur(); if (!t || t.coordinates.length < 2 || t.hesapla) return;
      if (e.originalEvent && e.originalEvent.touches && e.originalEvent.touches.length > 1) return;
      e.preventDefault();
      h.dragPan.disable();
      var bas = e.lngLat, son = e.lngLat, p0 = e.point, oynadi = false;
      var el = D.createElement('div'); el.className = 'tur-nokta durak ekleniyor goster'; el.innerHTML = '<span class="ic"><b>+</b></span>';
      var gm = null;
      var hareket = function (ev) {
        son = ev.lngLat;
        if (!oynadi && Math.hypot(ev.point.x - p0.x, ev.point.y - p0.y) > 8) { oynadi = true; gm = new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat(son).addTo(h); }
        if (gm) gm.setLngLat(son);
      };
      var birak = function () {
        h.off('mousemove', hareket); h.off('touchmove', hareket); h.off('mouseup', birak); h.off('touchend', birak); h.off('touchcancel', birak);
        h.dragPan.enable();
        if (gm) gm.remove();
        if (oynadi) {
          var ham = t.coordinates, cum = K.kumulatif(ham), konum = cum[K.enYakinIndeks(ham, bas.lat, bas.lng)], l = liste(t), idx = l.length;
          for (var k = 1; k < l.length; k++) { if (cum[K.enYakinIndeks(ham, l[k].latitude, l[k].longitude)] >= konum) { idx = k; break; } }
          ekle(son.lat, son.lng, '', idx);
        }
      };
      h.on('mousemove', hareket); h.on('touchmove', hareket); h.on('mouseup', birak); h.on('touchend', birak); h.on('touchcancel', birak);
    };
    h.on('mousedown', 'rota-secili', tutBasla);
    h.on('touchstart', 'rota-secili', tutBasla);
    h.on('mouseenter', 'rota-secili', function () { if (st.kip === 'duzen' && !ekleKipi) h.getCanvas().style.cursor = 'grab'; });
    h.on('mouseleave', 'rota-secili', function () { if (!ekleKipi) h.getCanvas().style.cursor = ''; });
  }

  /* ---------------------------------------------------------------- rota kipi seçici (haritanın sol üstü) */
  var kipDugme = $('#tur-kip-secici-dugme'), kipListe = $('#tur-kip-liste');
  kipDugme.addEventListener('click', function () { var ac = kipListe.hidden; kipListe.hidden = !ac; kipDugme.setAttribute('aria-expanded', ac); });
  D.addEventListener('click', function (e) { if (!e.target.closest('#tur-kip-secici')) { kipListe.hidden = true; kipDugme.setAttribute('aria-expanded', 'false'); } });
  kipListe.addEventListener('click', function (e) {
    var li = e.target.closest('li[data-kip]'); if (!li) return;
    var t = tur(); kipListe.hidden = true; kipDugme.setAttribute('aria-expanded', 'false');
    if (!t || (t.mod || (t.efsane && t.efsane.mod) || M.turKipi(st.seviye)) === li.dataset.kip) { if (t) { t.mod = li.dataset.kip; kipSeciciYaz(); } return; }
    t.mod = li.dataset.kip;
    st.paylasim.delete(t); K.paylasKapat();
    kipSeciciYaz();
    clearTimeout(rotaZ); hesapla();
  });

  /* ---------------------------------------------------------------- boş tur ve tur koduyla açma */
  function bosTur() {
    if (!st.S) { K.durum(T.baslangic_sec, 'hata'); return; }
    var t = { duraklar: [{ latitude: st.S.latitude, longitude: st.S.longitude, _id: kimlik() }], coordinates: [], rota: { totalDistanceMeters: 0, totalDurationSeconds: 0, icerik: {}, bacaklar: [] },
      olcu: { sertKm: 0, ortusme: 0 }, yon: 0, gecitler: [], donus: true, bos: true };
    t.duraklar.push({ latitude: st.S.latitude, longitude: st.S.longitude, _id: t.duraklar[0]._id + 'b' });
    K.turuYerlestir(t, [st.baslangicAdi || '', st.baslangicAdi || ''], false);
    if (!st.baslangicAdi) adiYukle(t, t.duraklar[0]);
    K.kipSec('duzen');
    ekleKipiAc(true);
  }
  $('#tur-bos-tur').addEventListener('click', bosTur);
  function kodAc(ac) {
    var f = $('#tur-kod-form'), b = $('#tur-kod-ac');
    var yeni = ac == null ? f.hidden : ac;
    f.hidden = !yeni; b.setAttribute('aria-expanded', yeni);
    if (yeni) $('#tur-kod-girdi').focus();
  }
  $('#tur-kod-ac').addEventListener('click', function () { kodAc(); });
  /* Kod: 8 harf/rakam (A–Z, 2–9); bağlantı (…/k/ABCD2345, motoseyir://tur/ABCD2345) ya da boşluklu yazım kabul */
  function koddan(m) {
    var bag = /(?:\/k\/|\/tur\/)([A-Za-z0-9 \-]{8,12})/.exec(m);
    var s = (bag ? bag[1] : m).toUpperCase().replace(/[^A-Z2-9]/g, '');
    return s.length === 8 ? s : '';
  }
  function kodTur() {
    var girdi = $('#tur-kod-girdi'), kod = koddan(girdi.value), b = $('#tur-kod-dugme');
    if (!kod) { K.durum(T.kod_hata, 'hata'); return; }
    b.disabled = true; K.durum(T.kod_aciliyor, 'bilgi');
    M.turAl(kod).then(function (r) {
      b.disabled = false;
      if (!r || !r.tur || !r.tur.stops || r.tur.stops.length < 2) { K.durum(T.kod_hata, 'hata'); return; }
      K.durum('');
      var t0 = r.tur, pts = t0.stops.map(function (s) { return { latitude: s.coords.latitude, longitude: s.coords.longitude, _id: kimlik() }; });
      var d0 = pts[0], dn = pts[pts.length - 1];
      var don = pts.length > 2 && Math.hypot((d0.latitude - dn.latitude) * 111, (d0.longitude - dn.longitude) * 111 * Math.cos(d0.latitude * Math.PI / 180)) < 0.3;
      if (don) pts[pts.length - 1] = { latitude: d0.latitude, longitude: d0.longitude, _id: d0._id + 'b' };
      var mod = t0.mode === 'enduro' ? 'koy' : t0.mode || 'standart';
      M.sayaciSifirla();
      return M.rotaKur(pts.map(function (c) { return { latitude: c.latitude, longitude: c.longitude }; }), st.seviye, t0.kacin, mod).then(function (rr) {
        var t = { duraklar: pts, coordinates: rr.coordinates, rota: rr.rota, olcu: rr.olcu, yon: 0, gecitler: rr.gecitler, donus: don, mod: mod, ad: t0.name || '', kacin: t0.kacin };
        var a = t0.stops.map(function (s) { return s.name || ''; });
        girdi.value = ''; kodAc(false);
        K.baslangicKoy({ latitude: d0.latitude, longitude: d0.longitude }, false, true, a[0]);
        K.turuYerlestir(t, a, true);
        K.kipSec('duzen');
      });
    }).catch(function () { b.disabled = false; K.durum(T.kod_hata, 'hata'); });
  }
  $('#tur-kod-dugme').addEventListener('click', kodTur);
  $('#tur-kod-girdi').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); kodTur(); } });

  /* ---------------------------------------------------------------- tur.js olayları */
  function yenile() { ciz(); kipSeciciYaz(); telefonBlok(); }
  function telefonBlok() {
    var t = tur();
    $('#tur-telefon-blok').hidden = !(t && st.kip !== 'rotalar' && st.evre === 'sonuc' && t.coordinates.length > 1);
  }
  W.addEventListener('tur:sonuc', function () { ciz(); kipSeciciYaz(); telefonBlok(); havaYukle(); });
  W.addEventListener('tur:degisti', function () { ciz(); havaYukle(); });
  W.addEventListener('tur:adlar', function () { if (st.kip === 'duzen') ciz(); });
  W.addEventListener('tur:cizildi', function () { havaYaz(sonHava); toplamYaz(); });
  W.addEventListener('tur:iptal', function () { ekleKipiAc(false); });
  W.addEventListener('tur:kip', function (e) {
    yenile(); ekleKipiAc(false);
    if (e.detail.kip === 'duzen') rotaDinle();
    var h = K.harita(); if (h && e.detail.kip !== 'duzen') h.getCanvas().style.cursor = '';
  });
  // sonuç temizlenince (ayara dön / yeni üretim) panel boşalır
  var gozle = new MutationObserver(function () { telefonBlok(); toplamYaz(); });
  gozle.observe($('#arac'), { attributes: true, attributeFilter: ['data-evre', 'data-kip'] });
  yenile();
  W.TurDuzen = { ekle: ekle, sil: sil, tasi: tasi, sirala: tasiSira, hesapla: hesapla, bosTur: bosTur, kodTur: kodTur, havaYukle: havaYukle, ciz: ciz };
})();
