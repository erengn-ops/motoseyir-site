/*
 * Web tur üreticisi — TUR DÜZENLEYİCİ (27 Eki 2026). Uygulamadaki Turlarım → bir tur açık ekranının (TourScreen "Duraklar" sekmesi) webdeki karşılığı;
 * kadranla üretilen (ya da boş başlatılan, ya da tur koduyla açılan) tur burada uygulamadaki gibi DÜZENLENİR:
 *   • YOL TARİFİ PANELİ: A Başlangıç · 1…n Durak · B Bitiş satırları her zaman görünen, yazdıkça öneri veren girdiler (haritadaki işaretle aynı harf/numara);
 *     aralarında bacak bilgisi (km · süre) ve "+" ile araya ekleme; tutamaçla sürükle ya da ↑↓ ile sıralama; durak ekleme (+ Durak ekle / haritaya dokun /
 *     rotanın üstünden tutup çek / Yol üstünde kartından), kısa "Geri al"; "Başlangıca dön" Bitiş satırının tıklanmasıyla kendiliğinden kalkar.
 *     Haritadaki harfli/numaralı işaretler sürüklenebilir.
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

  /* ---------------------------------------------------------------- görünüm: yol tarifi paneli
     Satırlar her zaman görünen, düzenlenebilir GİRDİLER: A Başlangıç · 1…n Durak · B Bitiş. Satırın kendisi düzenleyici: yazdıkça öneri gelir (280 ms),
     Enter ilk öneriyi seçer, ok tuşları gezer. Sağda: konumum (başlangıç / boş satır), haritada seç (iğne), sil (durak). Bacak bilgisi satırlar arasında. */
  var liEl = $('#tur-duraklar'), notEl = $('#tur-duzen-not');
  function not(metin, tur_, eylem) {
    notEl.innerHTML = metin ? '<span>' + esc(metin) + '</span>' + (eylem ? ' <button type="button" class="dz-not-dugme" data-ac="' + eylem[0] + '">' + esc(eylem[1]) + '</button>' : '') : '';
    notEl.hidden = !metin; notEl.className = 'tur-duzen-not' + (tur_ ? ' ' + tur_ : '');
  }
  var TUT = '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><circle cx="5.5" cy="4" r="1.3" fill="currentColor"/><circle cx="10.5" cy="4" r="1.3" fill="currentColor"/><circle cx="5.5" cy="8" r="1.3" fill="currentColor"/><circle cx="10.5" cy="8" r="1.3" fill="currentColor"/><circle cx="5.5" cy="12" r="1.3" fill="currentColor"/><circle cx="10.5" cy="12" r="1.3" fill="currentColor"/></svg>';
  var SIL = '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="m4 4 8 8M12 4l-8 8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  var IGNE = '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M8 14.6s4.6-4.1 4.6-7.8a4.6 4.6 0 0 0-9.2 0C3.4 10.500 8 14.600 8 14.600z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><circle cx="8" cy="6.8" r="1.7" fill="currentColor"/></svg>';
  var KONUM = '<svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><circle cx="10" cy="10" r="3" fill="currentColor"/><circle cx="10" cy="10" r="6.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M10 1v3M10 16v3M1 10h3M16 10h3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
  var DON = '<svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true"><path d="M3.2 8.2a4.8 4.8 0 1 1 1.5 3.5M3 12.6V9h3.6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  /* Satırların arayüz durumu (veri değil): bekleyen boş durak satırı, yazılan metin, öneriler, hata, "haritada seç" hedefi. Her satırın anahtarı:
     A, B, P (bekleyen yeni durak), D<kimlik> (durak). */
  var ui = { tur: null, bos: -1, yaz: null, oneri: null, hata: null, sonOdak: '', haritada: null, bitisAcik: false, odakIste: '', sec: false, tutIste: '', konumBekle: '', beklePick: '', kuruyor: false, sheetEski: '' };
  function uiSifirla() { ui.bos = -1; ui.yaz = null; ui.oneri = null; ui.hata = null; ui.sonOdak = ''; ui.haritada = null; ui.bitisAcik = false; ui.odakIste = ''; ui.tutIste = ''; ui.konumBekle = ''; ui.beklePick = ''; ui.sheetEski = ''; }
  /* B: dönüş turunda bitiş yok (başlangıca dönülür); dönüşsüz turda son nokta bitiştir. */
  function bitisIdx(t) { var n = liste(t).length; return !donus(t) && n >= 2 ? n - 1 : -1; }
  function normalle(t) { if (!donus(t) && liste(t).length < 2) { var l = liste(t), a = adlar(t).slice(0, l.length); t.donus = true; yaz(t, l, a); } }
  function satirlar(t) {
    var l = liste(t), n = l.length, bi = bitisIdx(t), son = bi >= 0 ? bi - 1 : n - 1;
    if (!n || ui.bos < 1) ui.bos = -1; else if (ui.bos > son + 1) ui.bos = son + 1;
    var r = [{ rol: 'A', anah: 'A', idx: n ? 0 : -1 }];
    for (var i = 1; i <= son + 1; i++) {
      if (ui.bos === i) r.push({ rol: 'P', anah: 'P', idx: -1, pos: i });
      if (i <= son) r.push({ rol: 'D', anah: 'D' + l[i]._id, idx: i });
    }
    r.push({ rol: 'B', anah: 'B', idx: bi });
    return r;
  }
  function satirBul(t, anah) { return satirlar(t).filter(function (r) { return r.anah === anah; })[0] || null; }
  function etiketOf(t, idx) { return idx === 0 ? T.dz_baslangic : idx === bitisIdx(t) ? T.dz_bitis : doldur(T.dz_durak_n, { n: idx }); }
  /* Satırın değeri: yer adı; ters kodlama gelene dek rolün adı (Başlangıç / Durak n / Bitiş) */
  function noktaAdi(t, idx) { return adlar(t)[idx] || (idx === 0 ? st.baslangicAdi : '') || (idx === 0 ? T.dz_baslangic : idx === bitisIdx(t) ? T.dz_bitis : doldur(T.dz_durak_n, { n: idx })); }

  function satirHtml(t, r, l, don) {
    var a = r.anah, c = r.idx >= 0 ? l[r.idx] : null, y = ui.yaz && ui.yaz.anah === a;
    var donusSatir = r.rol === 'B' && r.idx < 0 && !ui.bitisAcik;                 // "Başlangıç noktasına dön" yer tutucusu
    var etiket = r.rol === 'A' ? T.dz_baslangic : r.rol === 'B' ? T.dz_bitis : r.rol === 'P' ? T.dz_yeni_durak : doldur(T.dz_durak_n, { n: r.idx });
    var ph = r.rol === 'A' ? T.dz_a_yer : r.rol === 'B' ? (donusSatir ? T.dz_bitis_donus : T.dz_b_yer) : T.dz_durak_yer;
    var harf = r.rol === 'A' ? 'A' : r.rol === 'B' ? 'B' : r.rol === 'P' ? '+' : String(r.idx);
    var o = ui.oneri && ui.oneri.anah === a ? ui.oneri : null, acik = !!(o && (o.liste != null || o.mesaj));
    var deger = y ? ui.yaz.q : c ? noktaAdi(t, r.idx) : '';
    var haritada = ui.haritada && ui.haritada.anah === a;
    var bekle = ui.konumBekle === a;
    var yer = r.rol === 'A' || (!c && r.rol !== 'B') || (r.rol === 'B' && !c && !donusSatir);
    var dugmeler = '';
    if (yer) dugmeler += '<button type="button" class="dz-ik' + (bekle ? ' bekle' : '') + '" data-ac="konum"' + (bekle ? ' disabled aria-busy="true"' : '') + ' aria-label="' + esc(T.konum_dugme + ': ' + etiket) + '" title="' + esc(T.konum_dugme) + '">' + KONUM + '</button>';
    dugmeler += '<button type="button" class="dz-ik' + (haritada ? ' acik' : '') + '" data-ac="igne" aria-pressed="' + !!haritada + '" aria-label="' + esc(T.dz_haritada_sec + ': ' + etiket) + '" title="' + esc(T.dz_haritada_sec) + '">' + IGNE + '</button>';
    if (r.rol === 'D' || r.rol === 'P') dugmeler += '<button type="button" class="dz-ik sil" data-ac="sil" aria-label="' + esc(T.dz_sil + ': ' + etiket) + '" title="' + esc(T.dz_sil) + '">' + SIL + '</button>';
    var tut = c && l.length > 1 && !(r.rol === 'B' && r.idx < 0)
      ? '<button type="button" class="dz-tut" aria-label="' + esc(T.dz_surukle + ': ' + etiket) + '" title="' + esc(T.dz_surukle) + '">' + TUT + '</button>' : '<span class="dz-tut yok"></span>';
    var hata = ui.hata && ui.hata.anah === a ? '<p class="dz-hata" role="alert">' + esc(ui.hata.m) + '</p>' : '';
    var hava = c && !(r.rol === 'B' && r.idx < 0) ? '<span class="dz-hava" data-k="' + r.idx + '">' + havaChip(sonHava[r.idx]) + '</span>' : '';
    var alt = (r.rol === 'B' && r.idx >= 0 ? '<button type="button" class="dz-don" data-ac="don">' + DON + '<span>' + esc(T.dz_don_dugme) + '</span></button>' : '') + hata;
    return '<li class="dz-satir rol-' + r.rol + (c ? ' dolu' : ' bos') + (donusSatir ? ' donus' : '') + (haritada ? ' haritada' : '') + '" data-anah="' + a + '" data-i="' + r.idx + '">' +
      '<div class="dz-ust">' + tut + '<span class="dz-rozet" aria-hidden="true">' + harf + '</span>' +
      '<div class="dz-alan"><input type="text" class="dz-girdi" role="combobox" aria-autocomplete="list" aria-expanded="' + acik + '"' + (acik && o.k >= 0 ? ' aria-activedescendant="dz-op-' + o.k + '"' : '') + ' aria-controls="dz-oneri-' + a + '" aria-label="' + esc(etiket) + '" value="' + esc(deger) + '" placeholder="' + esc(ph) + '" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="search">' + hava + '</div>' +
      '<span class="dz-islem">' + dugmeler + '</span></div>' +
      '<div class="dz-alt">' + alt + '</div>' +
      '<ul class="dz-oneri" id="dz-oneri-' + a + '" role="listbox" aria-label="' + esc(etiket) + '"' + (acik ? '' : ' hidden') + '>' + (acik ? oneriHtml(o) : '') + '</ul></li>';
  }
  function oneriHtml(o) {
    if (o.liste == null) return o.mesaj ? '<li class="not">' + esc(o.mesaj) + '</li>' : '';
    if (!o.liste.length) return '<li class="not">' + esc(T.ara_yok) + '</li>';
    return o.liste.map(function (x, k) {
      var alt = [x.sehir, x.il, x.ulke].filter(Boolean).join(', ');
      return '<li role="option" id="dz-op-' + k + '" aria-selected="' + (k === o.k) + '"' + (k === o.k ? ' class="etkin"' : '') + '><button type="button" tabindex="-1" data-sonuc="' + k + '"><strong>' + esc(x.ad) + '</strong><span>' + esc(alt) + '</span></button></li>';
    }).join('');
  }
  function baglantiHtml(r, s, l, bac, don) {
    var b = r.idx >= 0 && (s.idx === r.idx + 1 || (s.rol === 'B' && s.idx < 0 && don && r.idx === l.length - 1)) ? bac[r.idx] : null;
    var ekle_ = r.idx >= 0 && s.rol !== 'P';
    if (!b && !ekle_) return '<li class="dz-bacak bos" aria-hidden="true"></li>';
    return '<li class="dz-bacak">' + (b ? '<span class="dz-bacak-bilgi">' + esc(kmYazi(b.m) + ' · ' + K.sureYazi(b.sn)) + '</span>' : '') +
      (ekle_ ? '<button type="button" class="dz-arada" data-ac="arada" data-pos="' + (r.idx + 1) + '" aria-label="' + esc(T.dz_araya_ekle) + '" title="' + esc(T.dz_araya_ekle) + '"><span aria-hidden="true">+</span></button>' : '') + '</li>';
  }
  function odakKaydet() {
    var a = D.activeElement;
    if (!a || !a.classList || !liEl.contains(a)) return null;
    if (a.classList.contains('dz-girdi')) return { anah: a.closest('.dz-satir').dataset.anah, bas: a.selectionStart, son: a.selectionEnd };
    if (a.classList.contains('dz-tut')) return { anah: a.closest('.dz-satir').dataset.anah, tut: true };
    return null;
  }
  function odakYukle(o) {
    var iste = ui.odakIste, sec = ui.sec, tutte = ui.tutIste;
    ui.odakIste = ''; ui.sec = false; ui.tutIste = '';
    var hedef = tutte ? { anah: tutte, tut: true } : iste ? { anah: iste, yeni: true } : o;
    if (!hedef) return;
    var li = liEl.querySelector('[data-anah="' + hedef.anah + '"]'); if (!li) return;
    if (hedef.tut) { var tb = $('.dz-tut', li); if (tb) try { tb.focus({ preventScroll: true }); } catch (e) { tb.focus(); } return; }
    var g = $('.dz-girdi', li); if (!g) return;
    try { g.focus({ preventScroll: true }); } catch (e) { g.focus(); }
    try { if (hedef.yeni) { if (sec && g.value) g.select(); else g.setSelectionRange(g.value.length, g.value.length); } else g.setSelectionRange(hedef.bas, hedef.son); } catch (e) { /* tür desteklemiyor */ }
    gorunur(li);
  }
  /* Panelin kendi kaydırıcısında satırı (öneri listesiyle) görünür tut; mobilde klavye payı düşülür. Kapları kaydırmamak için scrollIntoView yerine elle. */
  function gorunur(el) {
    var sc = el.closest('.tur-panel-ic'); if (!sc) return;
    var r = el.getBoundingClientRect(), s = sc.getBoundingClientRect(), alt = s.bottom, ust = s.top, vv = W.visualViewport;
    if (vv && W.innerWidth < 900) alt = Math.min(alt, vv.offsetTop + vv.height);
    if (r.bottom > alt - 8) sc.scrollTop += r.bottom - alt + 8; else if (r.top < ust + 4) sc.scrollTop -= ust - r.top + 4;
  }

  function ciz() {
    var t = tur();
    if (t !== ui.tur) { uiSifirla(); ui.tur = t; }
    if (!t) { liEl.innerHTML = ''; toplamYaz(); ustYaz(null); haritaIpucu(); return; }
    normalle(t);
    var o = odakKaydet(), rows = satirlar(t), l = liste(t), bac = t.rota.bacaklar || [], don = donus(t), h = '';
    rows.forEach(function (r, k) {
      h += satirHtml(t, r, l, don);
      var s = rows[k + 1]; if (s) h += baglantiHtml(r, s, l, bac, don);
    });
    ui.kuruyor = true;
    liEl.innerHTML = h;
    odakYukle(o);
    ui.kuruyor = false;
    toplamYaz();
    ustYaz(t);
    if (t.hesapla) not('');
    else if (t.rota.koyBulunamadi) not(T.dz_koy_yok, 'bilgi');
    else if (t.rota.erisilemezDurak != null) not(doldur(T.dz_erisilemez, { n: etiketOf(t, t.rota.erisilemezDurak) }), 'uyari');
    else if (t.hesapHata) not(T.dz_hata, 'hata', ['tekrar', T.dz_tekrar]);
    else not('');
    haritaIpucu();
  }
  /* başlık düğmeleri, ilerleme çizgisi, yönerge metni, alt düğmeler */
  function ustYaz(t) {
    var l = t ? liste(t) : [], n = l.length, don = t ? donus(t) : true, yol = !!t && t.coordinates.length > 1;
    $('#tur-dz-takas').hidden = !(t && !don && n >= 2);
    $('#tur-dz-ilerleme').hidden = !(t && t.hesapla);
    liEl.setAttribute('aria-busy', t && t.hesapla ? 'true' : 'false');
    $('#tur-duzen-surus').hidden = !(yol && !t.hesapla);
    $('#tur-duzen-sil').hidden = !(n || ui.bos >= 0);
    $('#tur-duzen-kod').hidden = n > 0;
    var y = $('#tur-dz-yonerge'), m = !t ? '' : !n ? T.dz_bos_yazi : n < 2 ? T.dz_en_az : '';
    y.textContent = m; y.hidden = !m;
    $('#tur-durak-ekle').disabled = !t || n >= MAX_DURAK;
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
  var rotaZ = 0, rotaNo = 0, yeniSira = null, rotaBekliyor = false;
  function degisti(yeniIdx) {
    var t = tur(); if (!t) return;
    st.paylasim.delete(t); K.paylasKapat();
    if (yeniIdx != null) yeniSira = yeniIdx;
    t.hesapHata = false;
    ciz();
    K.haritaSonuc('ayni');                                  // işaretler anında (harfler, numaralar, sıra); çizgi rota gelince
    clearTimeout(rotaZ); rotaBekliyor = true;
    rotaZ = setTimeout(hesapla, ROTA_BEKLEME);
    if (liste(t).length > 1) sigdirNoktalar(t);
  }
  function bosalt(t) {
    t.coordinates = []; t.rota = { totalDistanceMeters: 0, totalDurationSeconds: 0, icerik: {}, bacaklar: [] }; t.olcu = { sertKm: 0, ortusme: 0 }; t.gecitler = []; t.hesapla = false;
    K.turuYenidenCiz(); ciz(); havaYaz({});
  }
  function hesapla() {
    var t = tur(); if (!t) return;
    var l = liste(t);
    if (l.length < 2) { rotaNo++; bosalt(t); return; }
    var no = ++rotaNo, idx = yeniSira; yeniSira = null; rotaBekliyor = false;
    t.hesapla = true; t.hesapHata = false; ciz();
    M.sayaciSifirla();
    var pts = t.duraklar.map(function (c) { return { latitude: c.latitude, longitude: c.longitude }; });
    M.rotaKur(pts, st.seviye, t.kacin, modu(t), idx != null ? idx : undefined).then(function (r) {
      if (no !== rotaNo || tur() !== t) return;
      t.coordinates = r.coordinates; t.rota = r.rota; t.olcu = r.olcu; t.gecitler = r.gecitler; t.hesapla = false;
      K.turuYenidenCiz(); ciz(); havaYukle(); sigdirGerekirse(t);
    }).catch(function () {
      if (no !== rotaNo || tur() !== t) return;
      t.hesapla = false; t.hesapHata = true; ciz();
    });
  }
  /* Düzenleme turu panelin/çubuğun örttüğü yere ya da ekran dışına itmişse kamera yumuşakça sığdırır (görünüyorsa dokunmaz). */
  function disardaMi(h, noktalar) {
    var q = h.getPadding(), c = h.getContainer(), dis = false;
    noktalar.forEach(function (x) {
      var p = h.project([x.longitude, x.latitude]);
      if (p.x < q.left + 30 || p.x > c.clientWidth - q.right - 30 || p.y < q.top + 30 || p.y > c.clientHeight - q.bottom - 30) dis = true;
    });
    return dis;
  }
  function sigdirGerekirse(t) {
    var h = K.harita(); if (!h || st.kip !== 'duzen' || !t.coordinates.length) return;
    var b = new maplibregl.LngLatBounds();
    t.coordinates.forEach(function (x) { b.extend([x.longitude, x.latitude]); });
    if (disardaMi(h, liste(t))) h.fitBounds(b, K.kamera({ padding: 60, maxZoom: 13, duration: 800 }));
  }
  /* Rota gelmeden: yeni nokta görünür alanın dışına düştüyse noktaların hepsi sığsın. */
  function sigdirNoktalar(t) {
    var h = K.harita(); if (!h || st.kip !== 'duzen') return;
    var l = liste(t); if (l.length < 2 || !disardaMi(h, l)) return;
    var b = new maplibregl.LngLatBounds();
    l.forEach(function (x) { b.extend([x.longitude, x.latitude]); });
    h.fitBounds(b, K.kamera({ padding: 80, maxZoom: 13, duration: 700 }));
  }
  function kameraGit(lat, lng, enAz) {
    var h = K.harita(); if (!h) return;
    var o = { center: [lng, lat], duration: 700 };
    if (enAz && h.getZoom() < enAz) o.zoom = enAz;
    h.easeTo(K.kamera(o));
  }
  function adiYukle(t, c) {
    K.tersAdAl(c.latitude, c.longitude).then(function (a) {
      var i = t.duraklar.findIndex(function (x) { return x._id === c._id; });
      if (i < 0 || !a) return;
      adlar(t)[i] = a;
      if (donus(t) && i === 0) { adlar(t)[t.duraklar.length - 1] = a; baslangicEsitle(t); }
      if (tur() === t) ciz();
    });
  }
  /* Adı henüz gelmemiş noktalar için ters kodlama (kuyruklu, önbellekli): satırlarda "Seçilen konum" yerine yer adı görünsün. */
  function adlariTamamla(t) {
    if (!t) return;
    liste(t).forEach(function (c, i) { if (!adlar(t)[i]) adiYukle(t, c); });
  }
  function sil(i) {
    var t = tur(), l = liste(t), a = adlar(t).slice(0, l.length);
    if (i < 1 || i >= l.length) return;
    if (i === bitisIdx(t)) return;
    l.splice(i, 1); a.splice(i, 1);
    yaz(t, l, a); degisti();
  }
  function tasiSira(i, j) {
    var t = tur(), l = liste(t), a = adlar(t).slice(0, l.length);
    if (i < 0 || j < 0 || i >= l.length || j >= l.length || i === j) return;      // A ve B de sıralamaya dahil: en üste taşınan nokta yeni başlangıç olur
    var x = l.splice(i, 1)[0], n = a.splice(i, 1)[0];
    l.splice(j, 0, x); a.splice(j, 0, n);
    yaz(t, l, a);
    if (i === 0 || j === 0) baslangicEsitle(t);
    degisti();
  }
  /* st.S (kadran ve sarı iğne için başlangıç) turun başlangıcıyla aynı kalsın */
  function baslangicEsitle(t) {
    var c = t.duraklar[0]; if (!c) return;
    st.S = { latitude: c.latitude, longitude: c.longitude };
    var a0 = adlar(t)[0] || '';
    st.baslangicAdi = a0;
    var y = $('#tur-baslangic-yazi'); if (y) { y.textContent = a0 || (K.f1(c.latitude) + ', ' + K.f1(c.longitude)); y.classList.add('dolu'); }
  }
  function yuvarla(v) { return Math.round(v * 1e5) / 1e5; }
  function ekle(lat, lng, ad_, idx) {
    var t = tur(); if (!t) return;
    var l = liste(t), a = adlar(t).slice(0, l.length);
    if (!l.length) { tasi(0, lat, lng, ad_); return; }                   // henüz başlangıç yok: ilk nokta başlangıç olur
    if (l.length >= MAX_DURAK) { not(doldur(T.dz_sinir, { n: MAX_DURAK }), 'uyari'); return; }
    var c = { latitude: yuvarla(lat), longitude: yuvarla(lng), _id: kimlik() };
    var i = idx != null ? idx : l.length;      // varsayılan: sona (dönüş turunda bitişten önce)
    l.splice(i, 0, c); a.splice(i, 0, ad_ || '');
    yaz(t, l, a);
    var ekli = t.duraklar.filter(function (x) { return x._id === c._id; })[0] || t.duraklar[i];
    if (!ad_) adiYukle(t, ekli);
    degisti(i);
  }
  function tasi(k, lat, lng, ad_) {
    var t = tur(); if (!t) return;
    var l = liste(t), a = adlar(t).slice(0, l.length);
    if (k > l.length || (k === l.length && k !== 0)) return;
    var c = { latitude: yuvarla(lat), longitude: yuvarla(lng), _id: (l[k] && l[k]._id) || kimlik() };
    l[k] = c; a[k] = ad_ || '';                                       // başlangıçsız boş turda k === 0: ilk nokta başlangıç olur
    yaz(t, l, a);
    if (k === 0) baslangicEsitle(t);
    if (!ad_) adiYukle(t, t.duraklar[k]);
    degisti(k);
  }
  /* Bitiş seçildi: tur dönüşsüz olur, yeni nokta en sona konur (aradaki duraklar yerinde kalır). */
  function bitisEkle(lat, lng, ad_) {
    var t = tur(); if (!t) return;
    var l = liste(t), a = adlar(t).slice(0, l.length);
    if (!l.length) { tasi(0, lat, lng, ad_); return; }
    if (l.length >= MAX_DURAK) { not(doldur(T.dz_sinir, { n: MAX_DURAK }), 'uyari'); return; }
    l.push({ latitude: yuvarla(lat), longitude: yuvarla(lng), _id: kimlik() }); a.push(ad_ || '');
    t.donus = false;
    yaz(t, l, a);
    if (!ad_) adiYukle(t, t.duraklar[l.length - 1]);
    degisti(l.length - 1);
  }
  /* "↺ Başlangıca dön": bitiş noktası kalkar, tur dönüş turuna geçer. */
  function donuseCevir() {
    var t = tur(); if (!t) return;
    var l = liste(t), a = adlar(t).slice(0, l.length);
    if (!donus(t) && l.length >= 2) { l.pop(); a.pop(); }
    t.donus = true; ui.bitisAcik = false; ui.yaz = null; ui.oneri = null;
    yaz(t, l, a); degisti();
  }
  function takas() {
    var t = tur(); if (!t || donus(t)) return;
    var l = liste(t), a = adlar(t).slice(0, l.length); if (l.length < 2) return;
    var n = l.length - 1, x = l[0]; l[0] = l[n]; l[n] = x;
    var y = a[0]; a[0] = a[n]; a[n] = y;
    yaz(t, l, a); baslangicEsitle(t); degisti();
  }
  /* Geri alınabilir değişiklikler için anlık görüntü (nokta listesi + adlar + dönüş) */
  function anlik(t) { var l = liste(t); return { l: l.map(function (c) { return { latitude: c.latitude, longitude: c.longitude, _id: c._id }; }), a: adlar(t).slice(0, l.length), donus: donus(t) }; }
  function anlikGeri(t, s) {
    if (tur() !== t) return;
    t.donus = s.donus; yaz(t, s.l, s.a);
    if (s.l.length) baslangicEsitle(t);
    degisti();
  }

  /* ---------------------------------------------------------------- kısa onay balonu (harita üstü): "Durak eklendi · Geri al" */
  var toastEl = $('#tur-dz-toast'), toastZ = 0, toastGeri = null;
  function toastBaslat() { clearTimeout(toastZ); toastZ = setTimeout(toastKapat, 5000); }
  function toast(metin, geri) {
    toastGeri = geri;
    $('#tur-dz-toast-yazi').textContent = metin; toastEl.hidden = false;
    toastBaslat();
  }
  function toastKapat() { clearTimeout(toastZ); toastEl.hidden = true; toastGeri = null; }
  $('#tur-dz-geri').addEventListener('click', function () { var g = toastGeri; toastKapat(); if (g) g(); });
  toastEl.addEventListener('mouseenter', function () { clearTimeout(toastZ); });
  toastEl.addEventListener('mouseleave', function () { if (!toastEl.hidden) toastBaslat(); });
  toastEl.addEventListener('focusin', function () { clearTimeout(toastZ); });
  toastEl.addEventListener('focusout', function () { if (!toastEl.hidden) toastBaslat(); });

  /* ---------------------------------------------------------------- bir satırı doldurma (arama sonucu, konum ya da haritadan seçim — hepsi buradan) */
  function satirKoy(r, lat, lng, ad_) {
    var t = tur(); if (!t) return;
    ui.yaz = null; ui.oneri = null; ui.hata = null; ui.bitisAcik = false; ui.haritada = null; ui.odakIste = ''; ui.beklePick = '';
    if (r.rol === 'A') tasi(0, lat, lng, ad_);
    else if (r.rol === 'P') { ui.bos = -1; ekle(lat, lng, ad_, r.pos); }
    else if (r.rol === 'D') tasi(r.idx, lat, lng, ad_);
    else if (r.idx >= 0) tasi(r.idx, lat, lng, ad_);
    else bitisEkle(lat, lng, ad_);
  }
  function yereTasi(anah, lat, lng, ad_) {
    var t = tur(), r = t && satirBul(t, anah); if (!r) return;
    var bas = r.rol === 'A';
    satirKoy(r, lat, lng, ad_);
    haritaBirak();
    if (bas) kameraGit(lat, lng, 8);
    var h = document.activeElement; if (h && h.blur && liEl.contains(h)) h.blur();
  }
  function ilkOnce(t) {      // A boşken öteki satırlar çalışmaz: başlangıca yönlendir
    if (liste(t).length) return false;
    ui.hata = { anah: 'A', m: T.dz_once_baslangic }; ui.odakIste = 'A'; ui.bitisAcik = false; ui.bos = -1; ui.yaz = null; ui.oneri = null; ciz();
    return true;
  }

  /* ---------------------------------------------------------------- yer arama (satırın girdisi): vekil, 280 ms durunca */
  var araNo = 0, araZ = 0;
  function ara(anah) {
    var q = (ui.yaz && ui.yaz.anah === anah ? ui.yaz.q : '').trim();
    if (q.length < 2) { ui.oneri = null; oneriYaz(); return; }
    var h = K.harita(), c = h ? h.getCenter() : { lat: 40, lng: 30 }, no = ++araNo;
    ui.oneri = { anah: anah, liste: null, mesaj: T.yer_araniyor, k: -1 }; oneriYaz();
    K.yerAra(q, c, 5).then(function (j) {
      if (no !== araNo) return;
      var liste_ = (j.features || []).filter(function (x) { return x.geometry && x.geometry.coordinates; }).map(function (x) {
        var o = x.properties || {}; return { ad: o.name || o.street || '', sehir: o.city || o.town || o.village, il: o.state, ulke: o.country, lat: x.geometry.coordinates[1], lon: x.geometry.coordinates[0] };
      });
      ui.oneri = { anah: anah, liste: liste_, mesaj: '', k: liste_.length ? 0 : -1 };
      if (ui.beklePick === anah) { ui.beklePick = ''; if (liste_.length) { sec(anah, 0); return; } }
      oneriYaz();
    }).catch(function () {
      if (no !== araNo) return;
      ui.beklePick = '';
      ui.oneri = { anah: anah, liste: null, mesaj: T.ara_hata, k: -1 }; oneriYaz();
    });
  }
  function oneriYaz() {
    $$('.dz-satir', liEl).forEach(function (li) {
      var a = li.dataset.anah, ul = $('.dz-oneri', li), g = $('.dz-girdi', li), o = ui.oneri && ui.oneri.anah === a ? ui.oneri : null;
      var ac = !!(o && (o.liste != null || o.mesaj));
      ul.hidden = !ac; ul.innerHTML = ac ? oneriHtml(o) : '';
      g.setAttribute('aria-expanded', ac ? 'true' : 'false');
      if (ac && o.k >= 0) g.setAttribute('aria-activedescendant', 'dz-op-' + o.k); else g.removeAttribute('aria-activedescendant');
      if (ac) gorunur(li);
    });
  }
  function sec(anah, k) {
    var o = ui.oneri; if (!o || o.anah !== anah || !o.liste || !o.liste[k]) return;
    var x = o.liste[k];
    yereTasi(anah, x.lat, x.lon, [x.ad, x.sehir && x.sehir !== x.ad ? x.sehir : ''].filter(Boolean).join(', '));
  }

  /* ---------------------------------------------------------------- haritada seç + harita ipucu + imleç */
  function mobil() { return W.innerWidth < 900; }
  function panelAc() { if (W.TurPanel && mobil() && W.TurPanel.durum() !== 'acik') W.TurPanel.ayarla('acik'); }
  function sayfayiIndir() { if (W.TurPanel && mobil() && W.TurPanel.durum() !== 'kapali') { if (!ui.sheetEski) ui.sheetEski = W.TurPanel.durum(); W.TurPanel.ayarla('kapali'); } }
  function sayfayiGeriAc() { if (ui.sheetEski && W.TurPanel && mobil()) W.TurPanel.ayarla(ui.sheetEski === 'acik' ? 'acik' : 'yarim'); ui.sheetEski = ''; }
  function haritaBirak() { var var_ = !!ui.haritada; ui.haritada = null; if (var_ || ui.sheetEski) sayfayiGeriAc(); haritaIpucu(); }
  function haritaIpucu() {
    if (st.kip !== 'duzen') return;
    var ip = $('#tur-ipucu'), h = K.harita(), t = tur(), m = '';
    if (t) {
      var r = ui.haritada ? satirBul(t, ui.haritada.anah) : null;
      if (r) m = r.rol === 'A' ? T.dz_baslangic_ipucu : r.rol === 'B' ? T.dz_b_ipucu : r.rol === 'P' ? T.dz_ekle_ipucu : doldur(T.dz_haritada_ipucu, { n: r.idx });
      else if (ui.bos >= 0) m = T.dz_ekle_ipucu;
      else if (!liste(t).length) m = T.harita_ipucu;
    }
    ip.textContent = m || T.harita_ipucu; ip.hidden = !m;
    if (h) h.getCanvas().style.cursor = m ? 'crosshair' : '';
  }
  function haritadaSec(r) {
    var t = tur(); if (!t) return;
    if (r.rol !== 'A' && ilkOnce(t)) return;
    if (ui.haritada && ui.haritada.anah === r.anah) { haritaBirak(); ciz(); return; }
    ui.haritada = { anah: r.anah }; ui.yaz = null; ui.oneri = null; ui.hata = null;
    if (r.rol === 'B' && r.idx < 0) ui.bitisAcik = true;
    sayfayiIndir();
    ciz();
  }
  function hedefSatir(t) {
    var rows = satirlar(t);
    if (ui.haritada) return rows.filter(function (r) { return r.anah === ui.haritada.anah; })[0] || null;
    var p = rows.filter(function (r) { return r.rol === 'P'; })[0]; if (p) return p;      // bekleyen boş satır varsa onu doldurur
    if (!liste(t).length) return rows[0];                                               // başlangıç boşsa harita dokunuşu başlangıcı koyar
    if (ui.bitisAcik) return rows.filter(function (r) { return r.rol === 'B'; })[0];
    return null;
  }
  W.addEventListener('tur:harita-tik', function (e) {
    var t = tur(); if (!t || st.kip !== 'duzen') return;
    var lat = e.detail.lat, lng = e.detail.lng, r = hedefSatir(t);
    if (r) { var ana = r.anah; haritaBirak(); satirKoy(r, lat, lng, ''); if (ana === 'A') kameraGit(lat, lng, 8); return; }
    // hedef yok: Bitiş'ten önce yeni durak (kısa onay + geri al)
    haritaBirak();
    var l = liste(t); if (l.length >= MAX_DURAK) { not(doldur(T.dz_sinir, { n: MAX_DURAK }), 'uyari'); return; }
    var s = anlik(t), bi = bitisIdx(t);
    ekle(lat, lng, '', bi >= 0 ? bi : l.length);
    toast(T.dz_durak_eklendi, function () { anlikGeri(t, s); });
  });
  function konumKullan(r) {
    var t = tur(); if (!t) return;
    if (r.rol !== 'A' && ilkOnce(t)) return;
    var anah = r.anah;
    ui.hata = null; ui.yaz = null; ui.oneri = null;
    if (!navigator.geolocation) { ui.hata = { anah: anah, m: T.konum_yok }; ciz(); return; }
    if (r.rol === 'B' && r.idx < 0) ui.bitisAcik = true;
    ui.konumBekle = anah; ciz();
    navigator.geolocation.getCurrentPosition(function (k) { ui.konumBekle = ''; yereTasi(anah, k.coords.latitude, k.coords.longitude, T.konumum); },
      function () { ui.konumBekle = ''; ui.hata = { anah: anah, m: T.konum_yok }; ciz(); }, { enableHighAccuracy: false, timeout: 12000, maximumAge: 300000 });
  }
  function yeniDurakSatiri(pos) {
    var t = tur(); if (!t) return;
    if (ilkOnce(t)) return;
    if (liste(t).length >= MAX_DURAK) { not(doldur(T.dz_sinir, { n: MAX_DURAK }), 'uyari'); return; }
    ui.bos = pos; ui.haritada = null; ui.yaz = null; ui.oneri = null; ui.hata = null; ui.bitisAcik = false;
    ui.odakIste = 'P'; ui.sec = false;
    ciz();
  }

  /* ---------------------------------------------------------------- olaylar: satırlar */
  liEl.addEventListener('mousedown', function (e) { if (e.target.closest('.dz-oneri')) e.preventDefault(); });   // öneriye dokunmak girdinin odağını bozmasın
  liEl.addEventListener('click', function (e) {
    var s = e.target.closest('[data-sonuc]');
    if (s) { sec(s.closest('.dz-satir').dataset.anah, +s.dataset.sonuc); return; }
    var b = e.target.closest('button[data-ac]'); if (!b || b.disabled) return;
    var t = tur(); if (!t) return;
    var ac = b.dataset.ac;
    if (ac === 'arada') { yeniDurakSatiri(+b.dataset.pos); return; }
    if (ac === 'don') { donuseCevir(); return; }
    var li = b.closest('.dz-satir'), r = li && satirBul(t, li.dataset.anah); if (!r) return;
    if (ac === 'igne') haritadaSec(r);
    else if (ac === 'konum') konumKullan(r);
    else if (ac === 'sil') {
      if (r.rol === 'P') { ui.bos = -1; ciz(); return; }
      var an = anlik(t); sil(r.idx);
      toast(T.dz_durak_silindi, function () { anlikGeri(t, an); });
      $('#tur-durak-ekle').focus({ preventScroll: true });          // silinen düğmenin odağı kaybolmasın
    }
  });
  notEl.addEventListener('click', function (e) { if (e.target.closest('[data-ac=tekrar]')) { clearTimeout(rotaZ); hesapla(); } });
  liEl.addEventListener('input', function (e) {
    var g = e.target.closest('.dz-girdi'); if (!g) return;
    var li = g.closest('.dz-satir'), a = li.dataset.anah;
    ui.yaz = { anah: a, q: g.value }; ui.hata = null;
    var hp = $('.dz-hata', li); if (hp) hp.remove();
    clearTimeout(araZ);
    if (g.value.trim().length < 2) { ui.oneri = null; ui.beklePick = ''; oneriYaz(); return; }
    araZ = setTimeout(function () { ara(a); }, 280);
  });
  function girdidenCik(a, li, g) {      // Esc (öneri yokken): bekleyen satır kalkar, yazılan metin geri alınır
    if (a === 'P') { ui.bos = -1; }
    ui.yaz = null; ui.oneri = null; ui.hata = null; ui.bitisAcik = false; ui.beklePick = '';
    g.blur(); ciz();
  }
  liEl.addEventListener('keydown', function (e) {
    var g = e.target.closest('.dz-girdi');
    if (g) {
      var li = g.closest('.dz-satir'), a = li.dataset.anah, o = ui.oneri && ui.oneri.anah === a ? ui.oneri : null;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        if (o && o.liste && o.liste.length) { e.preventDefault(); o.k = (o.k + (e.key === 'ArrowDown' ? 1 : -1) + o.liste.length) % o.liste.length; oneriYaz(); }
      } else if (e.key === 'Enter') {
        e.preventDefault();
        var q = (ui.yaz && ui.yaz.anah === a ? ui.yaz.q : '').trim();
        if (o && o.liste && o.liste.length) sec(a, o.k >= 0 ? o.k : 0);
        else if (q.length >= 2) { ui.beklePick = a; clearTimeout(araZ); if (!(o && o.mesaj === T.yer_araniyor)) ara(a); }
      } else if (e.key === 'Escape') {
        e.preventDefault(); e.stopPropagation();
        if (o) { ui.oneri = null; oneriYaz(); } else girdidenCik(a, li, g);
      }
      return;
    }
    var tb = e.target.closest('.dz-tut:not(.yok)');
    if (tb && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {          // sürüklemenin klavye karşılığı
      e.preventDefault();
      var li2 = tb.closest('.dz-satir'), i = +li2.dataset.i, j = i + (e.key === 'ArrowUp' ? -1 : 1);
      ui.tutIste = li2.dataset.anah; tasiSira(i, j);
    }
  });
  liEl.addEventListener('focusin', function (e) {
    if (ui.kuruyor) return;
    var g = e.target.closest('.dz-girdi'); if (!g) return;
    var li = g.closest('.dz-satir'), a = li.dataset.anah, t = tur(); if (!t) return;
    ui.sonOdak = a;
    if (a !== 'A' && ilkOnce(t)) return;
    if (li.classList.contains('donus')) { ui.bitisAcik = true; ui.odakIste = 'B'; ciz(); panelAc(); return; }      // Bitiş'e dokunmak: "başlangıca dön" kendiliğinden kalkar, arama açılır
    panelAc();
    setTimeout(function () { if (D.activeElement === g) { if (g.value && !(ui.yaz && ui.yaz.anah === a)) g.select(); gorunur(li); } }, 0);
  });
  liEl.addEventListener('focusout', function (e) {
    if (ui.kuruyor) return;
    var g = e.target.closest('.dz-girdi'); if (!g) return;
    var li = g.closest('.dz-satir');
    if (e.relatedTarget && li.contains(e.relatedTarget)) return;
    setTimeout(function () {
      if (ui.kuruyor || !li.isConnected) return;
      var ac = D.activeElement;
      if (ac && ac.classList && ac.classList.contains('dz-girdi') && ac.closest('.dz-satir') === li) return;
      var ah = li.dataset.anah;
      if (ui.konumBekle === ah || (ui.haritada && ui.haritada.anah === ah)) return;
      var d = (ui.yaz && ui.yaz.anah === ah) || (ui.oneri && ui.oneri.anah === ah) || (ui.bitisAcik && ah === 'B');
      if (!d) return;
      if (ui.yaz && ui.yaz.anah === ah) ui.yaz = null;
      if (ui.oneri && ui.oneri.anah === ah) ui.oneri = null;
      if (ah === 'B') ui.bitisAcik = false;
      ciz();
    }, 160);
  });
  D.addEventListener('keydown', function (e) {
    if (st.kip !== 'duzen') return;
    if (e.key === 'Escape' && ui.haritada) { haritaBirak(); ciz(); return; }
    var ya = D.activeElement && /^(INPUT|TEXTAREA|SELECT)$/.test(D.activeElement.tagName);
    if ((e.key === 'z' || e.key === 'Z') && (e.ctrlKey || e.metaKey) && !e.shiftKey && !ya && toastGeri) { e.preventDefault(); var g = toastGeri; toastKapat(); g(); }      // Ctrl/Cmd+Z: son "Geri al"
  });

  /* mobil: klavye açılınca görünür alan küçülür; odaklı satır görünür kalsın (panelin alt boşluğu klavye kadar) */
  var vv = W.visualViewport;
  function klavye() {
    var k = vv && mobil() ? Math.max(0, Math.round(W.innerHeight - vv.height - vv.offsetTop)) : 0;
    K.kok.style.setProperty('--klavye', k + 'px');
    var a = D.activeElement;
    if (k > 80 && a && a.classList && a.classList.contains('dz-girdi') && liEl.contains(a)) gorunur(a.closest('.dz-satir'));
  }
  if (vv) { vv.addEventListener('resize', klavye); vv.addEventListener('scroll', klavye); }

  /* ---------------------------------------------------------------- sürükle-bırak (sıralama): tutamaç satırları dikey sürükler; A ve B de dahil */
  var surukle = null;
  liEl.addEventListener('pointerdown', function (e) {
    var g = e.target.closest('.dz-tut:not(.yok)'); if (!g) return;
    var li = g.closest('.dz-satir'), satirlar_ = $$('.dz-satir', liEl).filter(function (x) { return +x.dataset.i >= 0; });
    surukle = { li: li, i: +li.dataset.i, y0: e.clientY, hedef: +li.dataset.i, satirlar: satirlar_, id: e.pointerId };
    ui.oneri = null; oneriYaz();
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
      if (s === surukle.li) return;
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

  /* ---------------------------------------------------------------- üst düğmeler */
  $('#tur-dz-takas').addEventListener('click', takas);
  $('#tur-duzen-surus').addEventListener('click', function () { if (W.TurSurus) W.TurSurus.sur(); });
  $('#tur-duzen-sil').addEventListener('click', function () { temizle(); });
  $('#tur-duzenle').addEventListener('click', function () { K.kipSec('duzen'); });
  $('#tur-duzen-kod').addEventListener('click', function () { K.kipSec('uret'); kodAc(true); });
  $('#tur-durak-ekle').addEventListener('click', function () {
    var t = tur(); if (!t) return;
    var bi = bitisIdx(t), n = liste(t).length;
    yeniDurakSatiri(bi >= 0 ? bi : n);            // Bitiş'in hemen üstüne boş, odaklı yeni satır
  });
  /* Temizle: boş turla değiştirir; 5 sn içinde Geri al eskisini aynen geri koyar */
  function temizle() {
    var t = tur(); if (!t) return;
    var eskiAdlar = adlar(t).slice(), eski = t, eskiHesap = !!t.hesapla || rotaBekliyor;
    clearTimeout(rotaZ); rotaNo++; rotaBekliyor = false;
    bosTur(false);
    toast(T.dz_temizlendi, function () {
      eski.hesapla = false;
      K.turuYerlestir(eski, eskiAdlar, false);
      if (eski.duraklar.length) baslangicEsitle(eski);
      if (eskiHesap) { rotaBekliyor = true; hesapla(); }          // temizlerken rota hesabı yarıda kaldıysa yeniden hesaplanır
      else { havaYukle(); if (eski.coordinates.length > 1) sigdirGerekirse(eski); }
    });
  }

  /* ---------------------------------------------------------------- rotadan tutup araya durak ekleme + haritadaki işaret sürükleme */
  W.addEventListener('tur:durak-tasindi', function (e) { if (st.kip === 'duzen') tasi(e.detail.k, e.detail.lat, e.detail.lng); });

  /* ---------------------------------------------------------------- haritada: rotadan tutup araya durak */
  function haritaModu() { return !!ui.haritada || ui.bos >= 0; }
  var rotaDinleniyor = false;
  function rotaDinle() {
    var h = K.harita(); if (!h || rotaDinleniyor || !h.getLayer('rota-secili')) return;
    rotaDinleniyor = true;
    var tutBasla = function (e) {
      if (st.kip !== 'duzen' || st.evre !== 'sonuc' || haritaModu()) return;
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
          var an = anlik(t);
          ekle(son.lat, son.lng, '', idx);
          toast(T.dz_durak_eklendi, function () { anlikGeri(t, an); });
        }
      };
      h.on('mousemove', hareket); h.on('touchmove', hareket); h.on('mouseup', birak); h.on('touchend', birak); h.on('touchcancel', birak);
    };
    h.on('mousedown', 'rota-secili', tutBasla);
    h.on('touchstart', 'rota-secili', tutBasla);
    h.on('mouseenter', 'rota-secili', function () { if (st.kip === 'duzen' && !haritaModu()) h.getCanvas().style.cursor = 'grab'; });
    h.on('mouseleave', 'rota-secili', function () { if (!haritaModu()) h.getCanvas().style.cursor = ''; });
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
  function bosTur(odak) {
    /* Boş tur BAŞLANGIÇSIZ açılır: varsayılan şehir yalnız haritanın kamerası içindi; başlangıcı kullanıcı seçer (girdi açık, odaklı). */
    var t = { duraklar: [], coordinates: [], rota: { totalDistanceMeters: 0, totalDurationSeconds: 0, icerik: {}, bacaklar: [] },
      olcu: { sertKm: 0, ortusme: 0 }, yon: 0, gecitler: [], donus: true, bos: true };
    K.turuYerlestir(t, [], false);
    K.kipSec('duzen');
    ui.odakIste = odak === false ? '' : 'A'; ui.sec = false;
    ciz();
  }
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
  function yenile() {
    var t = tur();
    if (st.kip === 'duzen' && !t) { bosTur(W.innerWidth >= 900); return; }       // Duraklar'a boş girilirse hazır bir tur satırları açık bekler
    if (t && st.kip === 'duzen' && !liste(t).length && W.innerWidth >= 900) ui.odakIste = 'A';
    ciz(); kipSeciciYaz(); telefonBlok();
    if (st.kip === 'duzen') adlariTamamla(t);
  }
  function telefonBlok() {
    var t = tur();
    $('#tur-telefon-blok').hidden = !(t && st.kip !== 'rotalar' && st.evre === 'sonuc' && t.coordinates.length > 1);
  }
  W.addEventListener('tur:sonuc', function () { ciz(); kipSeciciYaz(); telefonBlok(); havaYukle(); if (st.kip === 'duzen') adlariTamamla(tur()); });
  W.addEventListener('tur:degisti', function () { ciz(); havaYukle(); });
  W.addEventListener('tur:adlar', function () { if (st.kip === 'duzen') ciz(); });
  var ipucuGoruldu = false, ipucuZ = 0;
  try { ipucuGoruldu = !!localStorage.getItem('motoseyir.web.surukle-ipucu'); } catch (e) { /* depolama kapalı */ }
  function surukleIpucu() {                       // işaretlerin sürüklenebildiğini ilk seferde bir kez söyle
    if (ipucuGoruldu || st.kip !== 'duzen') return;
    var e = $('.tur-nokta.durak.baslangic') || $('.tur-nokta.durak.surukle');
    if (!e) return;
    e.dataset.ipucu = T.dz_surukle_ipucu; e.classList.add('ipucu');
    if (!ipucuZ) ipucuZ = setTimeout(function () {
      ipucuGoruldu = true; try { localStorage.setItem('motoseyir.web.surukle-ipucu', '1'); } catch (x) { /* sorun değil */ }
      $$('.tur-nokta.ipucu').forEach(function (n) { n.classList.remove('ipucu'); });
    }, 6500);
  }
  W.addEventListener('tur:cizildi', function () { havaYaz(sonHava); toplamYaz(); surukleIpucu(); });
  W.addEventListener('tur:iptal', function () { ui.haritada = null; ui.sheetEski = ''; toastKapat(); });
  W.addEventListener('tur:kip', function (e) {
    var h = K.harita();
    if (e.detail.kip === 'duzen') {
      yenile(); rotaDinle();
      var tt = tur(); if (tt && tt.coordinates.length < 2) panelAc();         // mobilde boş tur: satırlar görünsün diye sayfa açılır (klavye açılmaz)
      return;
    }
    // başka sekmeye geçildi: boş taslak satırlar atılır, harita imleci/ipucu eski haline döner
    ui.haritada = null; ui.sheetEski = ''; toastKapat();
    var ip = $('#tur-ipucu'); ip.textContent = T.harita_ipucu;
    if (h) h.getCanvas().style.cursor = '';
    var t = tur();
    if (t && !liste(t).length) K.ayaraDon(true);
    yenile();
  });
  // sonuç temizlenince (ayara dön / yeni üretim) panel boşalır
  var gozle = new MutationObserver(function () { telefonBlok(); toplamYaz(); });
  gozle.observe(K.kok, { attributes: true, attributeFilter: ['data-evre', 'data-kip'] });
  yenile();
  W.TurDuzen = { ekle: ekle, sil: sil, tasi: tasi, sirala: tasiSira, hesapla: hesapla, bosTur: bosTur, kodTur: kodTur, havaYukle: havaYukle, ciz: ciz };
})();
