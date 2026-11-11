#!/usr/bin/env node
/*
 * GEÇİŞ NOKTASI SINAMASI (11 Kas 2026) — ağsız.
 *   1. m/tur/gecis.js saf mantığı: bacak bağlama, sürekli en yakın bacak, rota isteği biçimi, paylaşılan turdan ayırma.
 *   2. motor.js `rotaKur`: geçiş noktaları Valhalla'ya `through` (bacak açmaz), sıralı gidiyor; çıkmaz yolda `via` yedeği;
 *      dış motorun 10 konum sınırında parçalama (hiçbir nokta kaybolmuyor, sırası bozulmuyor); bacak sayısı değişmiyor.
 *   3. `turKaydi`: durak dizisinde geçileceği yerde { gecis: true, araNokta: true }; uygulamanın paylasilacakTur'undan geçince korunuyor.
 */
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const BURASI = dirname(fileURLToPath(import.meta.url));
const G = createRequire(import.meta.url)(join(BURASI, '../../m/tur/gecis.js'));
let n = 0;
const ok = (ad) => console.log(`  ✓ ${ad}`) || n++;

/* ---------------------------------------------------------------- 1) saf mantık */
const d = (id, lat, lng) => ({ latitude: lat, longitude: lng, _id: id });
const A = d('a', 40, 30), B = d('b', 40, 31), C = d('c', 40.5, 31), A2 = d('ab', 40, 30);
const dur = [A, B, C, A2];                                     // dönüş turu: son = başlangıç kopyası
const g1 = { latitude: 40.02, longitude: 30.5, _id: 'g1', once: 'a', sonra: 'b' };
const g2 = { latitude: 40.3, longitude: 31.1, _id: 'g2', once: 'b', sonra: 'c' };
assert.deepEqual(G.bacakli(dur, [g1, g2]).map((x) => x.bacak), [0, 1]); ok('bacakli: nokta kendi bacağına gidiyor');
assert.deepEqual(G.bagla(dur, [g1, g2]).map((x) => x._id + x.once + x.sonra), ['g1ab', 'g2bc']); ok('bagla: bacağı değişmeyene dokunmuyor');
// araya durak: a→b bacağı a→x→b olur; g1 (x'e yakın) en yakın bacağa gider
const X = d('x', 40.03, 30.4);
const dur2 = [A, X, B, C, A2];
const b2 = G.bagla(dur2, [g1, g2]);
assert.equal(b2.find((x) => x._id === 'g1').once, 'x'); assert.equal(b2.find((x) => x._id === 'g2').once, 'b'); ok('durak araya girince nokta en yakın bacakta kalıyor');
// durak silinince (b gitti): a→c; iki nokta da tek bacakta, sıra bacak boyunca
const dur3 = [A, C, A2];
const b3 = G.bagla(dur3, [g2, g1]);
assert.equal(b3.length, 2); assert.ok(b3.every((x) => x.once && x.sonra)); ok('durak silinince noktalar birleşen bacağa taşınıyor');
// sıra değişimi (b ↔ c) ve ters çevirme: nokta yok olmuyor, her biri geçerli bir bacakta
const dur4 = [A, C, B, A2];
assert.equal(G.bagla(dur4, [g1, g2]).length, 2); ok('sıra değişince noktalar kaybolmuyor');
assert.deepEqual(G.bagla([A], [g1]), []); ok('tek nokta kalan turda geçiş noktası kalmıyor');
// bir bacakta iki nokta: bacaktaki sıra segment boyunca
const g3 = { latitude: 40.0, longitude: 30.8, _id: 'g3', once: 'zz', sonra: 'yy' }, g4 = { latitude: 40.0, longitude: 30.2, _id: 'g4', once: 'zz', sonra: 'yy' };
assert.deepEqual(G.bagla(dur, [g3, g4]).map((x) => x._id), ['g4', 'g3']); ok('aynı bacaktaki noktalar yol boyunca sıralanıyor');
// paylaşılan turdan ayırma: ilk/son durak, bayrak olsa da durak sayılır
const st = [{ n: 'A' }, { n: 'v1', gecis: true }, { n: 'B' }, { n: 'v2', araNokta: true }, { n: 'v3', gecis: true }, { n: 'C', gecis: true }];
const ay = G.ayir(st);
assert.deepEqual(ay.gercek.map((s) => s.n), ['A', 'B', 'C']); assert.deepEqual(ay.gecis.map((x) => [x.s.n, x.onceki]), [['v1', 0], ['v2', 1], ['v3', 1]]); ok('ayir: gecis ve araNokta (telefon) birlikte okunuyor');

/* ---------------------------------------------------------------- 2) motor.js rotaKur, sahte rota motoru */
function kodla(noktalar) {      // polyline, 6 hane
  let o = '', pl = 0, pg = 0;
  for (const [la, lo] of noktalar) {
    for (const v of [Math.round(la * 1e6) - pl, Math.round(lo * 1e6) - pg]) {
      let x = v < 0 ? ~(v << 1) : v << 1;
      while (x >= 0x20) { o += String.fromCharCode((0x20 | (x & 0x1f)) + 63); x >>= 5; }
      o += String.fromCharCode(x + 63);
    }
    pl = Math.round(la * 1e6); pg = Math.round(lo * 1e6);
  }
  return o;
}
const istekler = [];
let cikmaz = false;
globalThis.window = globalThis;
globalThis.fetch = async (adres, init) => {
  const gövde = init?.body ? JSON.parse(init.body) : {};
  if (!String(adres).includes('/route')) return new Response('{}', { status: 404 });
  istekler.push({ adres: String(adres), loc: gövde.locations });
  const loc = gövde.locations;
  if (cikmaz && loc.some((l) => l.type === 'through')) return new Response(JSON.stringify({ error_code: 442 }), { status: 400 });
  const legs = []; let ilk = 0;
  for (let i = 1; i < loc.length; i++) {
    if (loc[i].type !== 'break') continue;
    const pts = loc.slice(ilk, i + 1).map((l) => [l.lat, l.lon]);
    legs.push({ summary: { length: 10, time: 600 }, shape: kodla(pts), maneuvers: [] });
    ilk = i;
  }
  return new Response(JSON.stringify({ trip: { legs, summary: { length: legs.length * 10, time: legs.length * 600 } } }), { status: 200 });
};
vm.runInThisContext(readFileSync(join(BURASI, '../../m/tur/motor.js'), 'utf8'));
const M = globalThis.MotoTur;
const ll = (la, lo) => ({ latitude: la, longitude: lo });
const tipler = (i) => i.loc.map((l) => l.type[0]).join('');

// Türkiye (kendi sunucu): 3 durak + 2 nokta, ikisi ilk bacakta
istekler.length = 0;
let r = await M.rotaKur([ll(39.9, 32.8), ll(40.1, 33.2), ll(40.4, 33.6)], 2, undefined, 'koy', undefined, [
  { latitude: 39.95, longitude: 32.9, bacak: 0 }, { latitude: 40.0, longitude: 33.0, bacak: 0 }]);
assert.equal(istekler.length, 1);
assert.equal(tipler(istekler[0]), 'btttbb'.replace('tttb', 'ttb'), 'sıra: durak, nokta, nokta, durak, durak') ;
assert.deepEqual(istekler[0].loc.map((l) => [l.lat, l.lon]), [[39.9, 32.8], [39.95, 32.9], [40, 33], [40.1, 33.2], [40.4, 33.6]]);
assert.equal(r.rota.bacaklar.length, 2); ok('rotaKur: noktalar through, sırayla, bacak sayısı durak sayısı − 1');
assert.ok(r.coordinates.some((c) => Math.abs(c.latitude - 39.95) < 1e-6 && Math.abs(c.longitude - 32.9) < 1e-6)); ok('çizilen rota geçiş noktasından geçiyor');

// noktasız çağrı eskisi gibi
istekler.length = 0;
await M.rotaKur([ll(39.9, 32.8), ll(40.1, 33.2)], 2, undefined, 'koy');
assert.equal(tipler(istekler[0]), 'bb'); ok('geçiş noktası yoksa istek eskisiyle aynı');

// çıkmaz yol: through reddedilir (400/442), via ile yeniden
cikmaz = true; istekler.length = 0;
r = await M.rotaKur([ll(39.9, 32.8), ll(40.1, 33.2)], 2, undefined, 'koy', undefined, [{ latitude: 40.0, longitude: 33.0, bacak: 0 }]);
assert.deepEqual(istekler.map(tipler), ['btb', 'bvb']); ok('through reddedilince via ile bir kez daha deneniyor'); cikmaz = false;

// dış motor (Almanya): 10 konum sınırı; 4 durak + 9 nokta = 13 konum → parçalı, noktaların hepsi sırayla gidiyor
istekler.length = 0;
const nokta = (i) => ({ latitude: 47.5 + i * 0.01, longitude: 11.1 + i * 0.02, bacak: i < 5 ? 0 : i < 8 ? 1 : 2 });
const gec = Array.from({ length: 9 }, (_, i) => nokta(i));
r = await M.rotaKur([ll(47.49, 11.1), ll(47.6, 11.3), ll(47.7, 11.5), ll(47.8, 11.7)], 2, undefined, 'koy', undefined, gec);
assert.ok(istekler.length >= 2 && istekler.every((i) => i.loc.length <= 10), `her istek ≤ 10 konum (${istekler.map((i) => i.loc.length)})`);
const gidenNoktalar = istekler.flatMap((i) => i.loc.filter((l) => l.type === 'through').map((l) => l.lat));
assert.deepEqual(gidenNoktalar, gec.map((g) => g.latitude)); ok('dış motorda parçalama: noktaların hepsi, sırasıyla');
assert.equal(r.rota.bacaklar.length, 3); ok('parçalanınca da bacak sayısı durak sayısı − 1');

/* ---------------------------------------------------------------- 3) turKaydi + uygulamanın paylaşım temizleyicisi */
const SRC = resolve(process.env.MOTO_ROTA_SRC || join(homedir(), 'Claude/moto-rota/src'));
const stub = (a) => join(BURASI, '../stubs', a);
const gecici = mkdtempSync(join(tmpdir(), 'moto-gecis-'));
const bos = join(gecici, 'bos-stub.ts');
writeFileSync(bos, readFileSync(join(BURASI, 'bos-stub.ts'), 'utf8'));
const cikti = join(gecici, 'uyg.cjs');
await build({
  entryPoints: [join(BURASI, 'uygulama-paylas.ts')], bundle: true, format: 'cjs', platform: 'node', outfile: cikti, logLevel: 'error',
  plugins: [{ name: 'x', setup(b) {
    b.onResolve({ filter: /^moto-rota\// }, (a) => ({ path: join(SRC, a.path.slice(10)) + '.ts' }));
    b.onResolve({ filter: /.*/ }, (a) => {
      if (!a.importer.startsWith(SRC + '/')) return null;
      if (/(^|\/)i18n$/.test(a.path)) return { path: stub('i18n.ts') };
      if (/(izGizlilik|surusKaydi|sayacApi|takipApi)$/.test(a.path)) return { path: bos };
      return null;
    });
  } }],
});
const uyg = (await import(cikti)).default ?? (await import(cikti));
const duraklar = [ll(39.9, 32.8), ll(40.1, 33.2), ll(40.4, 33.6), ll(39.9, 32.8)];
const kayit = M.turKaydi({ duraklar, coordinates: duraklar, rota: { totalDistanceMeters: 1, totalDurationSeconds: 1 }, kacin: undefined }, ['A', 'B', 'C', 'A'], 2, 'Sınama', {
  gecisler: [{ latitude: 39.95, longitude: 32.9, bacak: 0 }, { latitude: 40.2, longitude: 33.4, bacak: 1 }, { latitude: 40.1, longitude: 33.0, bacak: 2 }] });
assert.equal(kayit.stops.length, 7);
assert.deepEqual(kayit.stops.map((s) => !!s.gecis), [false, true, false, true, false, true, false]);
assert.ok(kayit.stops.filter((s) => s.gecis).every((s) => s.araNokta === true)); ok('turKaydi: durak dizisinde geçileceği yerde gecis:true (+ araNokta:true)');
const temiz = JSON.parse(JSON.stringify(uyg.paylasilacakTur(JSON.parse(JSON.stringify(kayit)))));
assert.deepEqual(temiz.stops.map((s) => [!!s.gecis, !!s.araNokta]), kayit.stops.map((s) => [!!s.gecis, !!s.araNokta])); ok('uygulamanın paylasilacakTur\'undan geçince bayraklar korunuyor');
assert.equal(M.turKaydi({ duraklar, coordinates: duraklar, rota: { totalDistanceMeters: 1, totalDurationSeconds: 1 } }, ['A', 'B', 'C', 'A'], 2, 'x').stops.length, 4); ok('noktasız turun kaydı değişmedi');

console.log(`\n${n} denetim geçti.`);
