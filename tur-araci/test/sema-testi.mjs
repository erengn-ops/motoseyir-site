#!/usr/bin/env node
/*
 * ŞEMA SINAMASI: web turu uygulamanın paylaşım biçimiyle aynı mı?
 *   1. Gerçek bir tur üretilir (motor.js, vekil üzerinden) ve `turKaydi` ile Tour'a çevrilir.
 *   2. Aynı tur uygulamanın KENDİ `paylasilacakTur`undan (turKoduApi.ts, paketlenerek) geçirilir; ikisi alan alan karşılaştırılır.
 *   3. Web turu sunucuya `turPaylas` ile yazılır, `/tur/al` ile geri okunur (uygulamanın turAl'ı aynı uç), gönderilenle birebir eşit olmalı.
 * Kullanım: node test/sema-testi.mjs [enlem boylam km seviye]   (varsayılan: Garmisch, 100 km, seviye 2)
 */
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const BURASI = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(process.env.MOTO_ROTA_SRC || join(homedir(), 'Claude/moto-rota/src'));
const stub = (a) => join(BURASI, '../stubs', a);
const gecici = mkdtempSync(join(tmpdir(), 'moto-sema-'));
const bos = join(gecici, 'bos-stub.ts');
writeFileSync(bos, 'export const izUclariniKirp = (x: any) => x; export const izdenSekil = () => []; export const toplamMesafe = () => 0; export const cihazKimligi = async () => "x"; export const takipAcik = () => true;\n');
const cikti = join(gecici, 'uyg.cjs');
await build({
  entryPoints: [join(BURASI, 'uygulama-paylas.ts')], bundle: true, format: 'cjs', platform: 'node', outfile: cikti, logLevel: 'error',
  plugins: [{
    name: 'x', setup(b) {
      b.onResolve({ filter: /^moto-rota\// }, (a) => ({ path: join(SRC, a.path.slice(10)) + '.ts' }));
      b.onResolve({ filter: /.*/ }, (a) => {
        if (!a.importer.startsWith(SRC + '/')) return null;
        if (/(^|\/)i18n$/.test(a.path)) return { path: stub('i18n.ts') };
        if (/(izGizlilik|surusKaydi|sayacApi|takipApi)$/.test(a.path)) return { path: bos };
        return null;
      });
    },
  }],
});
const uyg = (await import(cikti)).default ?? (await import(cikti));

globalThis.window = globalThis;
vm.runInThisContext(readFileSync(join(BURASI, '../../m/tur/motor.js'), 'utf8'));
const M = globalThis.MotoTur;
const [lat, lon, km, seviye] = (process.argv.slice(2).length ? process.argv.slice(2) : [47.49, 11.1, 100, 2]).map(Number);
const turlar = await M.turUret({ baslangic: { latitude: lat, longitude: lon }, yon: null, hedefKm: km, seviye });
assert.ok(turlar.length > 0, 'tur üretilemedi');
const u = turlar[0];
const adlar = ['Start', 'A', 'B', 'C', 'D', 'Start'].slice(0, u.duraklar.length);
adlar[adlar.length - 1] = adlar[0];
const web = M.turKaydi(u, adlar, seviye, 'Sınama turu');

// 2) uygulamanın temizleyicisi
const uygTur = uyg.paylasilacakTur(JSON.parse(JSON.stringify(web)));
const norm = (o) => JSON.parse(JSON.stringify(o));
const a = norm(uygTur), b = norm(web);
const farkAnahtar = [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k]));
console.log('uygulama temizleyicisinden geçen ile web turu arasındaki alan farkları:', farkAnahtar.length ? farkAnahtar : 'YOK');
const izinli = new Set([]);
const beklenmeyen = farkAnahtar.filter((k) => !izinli.has(k));
assert.deepEqual(beklenmeyen, [], `beklenmeyen fark: ${beklenmeyen}`);

// 3) sunucuya yaz, geri oku
const s = await M.turPaylas(web);
assert.ok(s.ok, `paylaşım başarısız: ${JSON.stringify(s)}`);
const geri = await M.turAl(s.kod);
assert.deepEqual(norm(geri.tur), b, 'geri okunan tur gönderilenden farklı');
const t = geri.tur;
// uygulamanın kodOnayla'sının dokunduğu alanlar
assert.ok(typeof t.name === 'string' && Array.isArray(t.stops) && t.stops.length >= 2);
for (const d of t.stops) { assert.equal(typeof d.id, 'string'); assert.equal(typeof d.name, 'string'); assert.ok(Number.isFinite(d.coords.latitude) && Number.isFinite(d.coords.longitude)); assert.equal(d.visited, false); }
assert.ok(['standart', 'koy'].includes(t.mode));
assert.ok(t.routeDistanceMeters > 0 && t.routeDurationSeconds > 0 && Array.isArray(t.shape) && t.shape.every((p) => p.length === 2));
console.log(`kod ${s.kod}: geri okunan tur gönderilenle birebir aynı (${t.stops.length} durak, ${t.shape.length} şekil noktası, mod ${t.mode}); sunucu ${s.gun} gün saklıyor`);
console.log('anahtarlar:', Object.keys(t).join(', '));

// 4) derin bağlantı: uygulamanın kendi ayrıştırıcısı bu bağlantıdan aynı kodu çıkarıyor mu (1.1.x uygulama, yeni sürüm gerekmez)
assert.equal(uyg.baglantidanKod(`motoseyir://tur/${s.kod}`), s.kod);
// 5) /k/<KOD> sayfası (sunucu): iPhone'da motoseyir:// + App Store, Android'de intent:// ; indirme ya da başka uygulamaya aktarma YOK
for (const [ad, ua] of [['iPhone', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)'], ['Android', 'Mozilla/5.0 (Linux; Android 14)'], ['masaüstü', 'Mozilla/5.0 (Macintosh)']]) {
  const html = await (await fetch(`https://rota.motoseyir-app.com/k/${s.kod}`, { headers: { 'User-Agent': ua } })).text();
  assert.ok(html.includes(s.kod) && html.includes(`motoseyir://tur/${s.kod}`) || html.includes(`intent://tur/${s.kod}`), `${ad}: /k/ sayfası kodu açmıyor`);
  assert.ok(!/\.gpx|\.kml|geojson|download|maps\.google|maps\.apple|waze|komoot/i.test(html), `${ad}: /k/ sayfasında dışa aktarma bağlantısı var`);
  console.log(`/k/${s.kod} (${ad}): derin bağlantı var, dışa aktarma yok`);
}

// 6) DÜZENLENMİŞ TUR (27 Eki 2026, web düzenleyici): bir durak silinip rota yeniden hesaplanır, kip değişir; aynı şema ve aynı geri okuma.
{
  assert.ok(u.duraklar.length >= 4, 'düzenleme sınaması için en az 4 nokta gerek');
  const duzenli = u.duraklar.filter((_, i) => i !== 1);                       // 2. nokta (1. durak) silindi
  const r = await M.rotaKur(duzenli.map((c) => ({ latitude: c.latitude, longitude: c.longitude })), seviye, undefined, 'koy');
  assert.ok(r.coordinates.length > 10 && Array.isArray(r.rota.bacaklar) && r.rota.bacaklar.length === duzenli.length - 1, 'yeniden rotada bacaklar yok');
  const editli = { ...u, duraklar: duzenli, coordinates: r.coordinates, rota: r.rota, olcu: r.olcu, gecitler: r.gecitler };
  const adlar2 = ['Start', 'B', 'C', 'D', 'Start'].slice(0, duzenli.length); adlar2[adlar2.length - 1] = adlar2[0];
  const web2 = M.turKaydi(editli, adlar2, seviye, 'Düzenlenmiş sınama turu', { mod: 'koy' });
  assert.equal(web2.stops.length, duzenli.length);
  assert.equal(web2.mode, 'koy');
  const uyg2 = norm(uyg.paylasilacakTur(JSON.parse(JSON.stringify(web2))));
  const fark2 = [...new Set([...Object.keys(uyg2), ...Object.keys(norm(web2))])].filter((k) => JSON.stringify(uyg2[k]) !== JSON.stringify(norm(web2)[k]));
  assert.deepEqual(fark2, [], `düzenlenmiş turda beklenmeyen fark: ${fark2}`);
  const s2 = await M.turPaylas(web2);
  assert.ok(s2.ok, `düzenlenmiş tur paylaşılamadı: ${JSON.stringify(s2)}`);
  const geri2 = await M.turAl(s2.kod);
  assert.deepEqual(norm(geri2.tur), norm(web2), 'düzenlenmiş tur geri okununca farklı');
  assert.equal(geri2.tur.stops.length, duzenli.length);
  assert.equal(geri2.tur.mode, 'koy');
  assert.ok(geri2.tur.routeDistanceMeters > 0 && geri2.tur.shape.length > 5);
  console.log(`düzenlenmiş tur: kod ${s2.kod}, ${geri2.tur.stops.length} durak (biri silindi), mod koy, ${Math.round(geri2.tur.routeDistanceMeters / 1000)} km — uygulama şemasıyla aynı, sunucudan birebir geri okundu`);
}

// 7) YOL TARİFİ PANELİNİN DÖNÜŞSÜZ TURU (A → duraklar → B, başlangıca dönüş yok): aynı şema, sunucudan birebir geri okunur.
{
  const n = u.duraklar.length;
  const donussuz = [u.duraklar[0], u.duraklar[Math.floor(n / 2)], u.duraklar[n - 2]];          // A, 1 durak, B (bitiş ≠ başlangıç)
  const r = await M.rotaKur(donussuz.map((c) => ({ latitude: c.latitude, longitude: c.longitude })), seviye, undefined, 'standart');
  assert.ok(r.coordinates.length > 10 && r.rota.bacaklar.length === donussuz.length - 1, 'dönüşsüz rotada bacaklar yok');
  const tek = { ...u, duraklar: donussuz, coordinates: r.coordinates, rota: r.rota, olcu: r.olcu, gecitler: r.gecitler, donus: false };
  const web3 = M.turKaydi(tek, ['A', 'Durak', 'B'], seviye, 'Dönüşsüz sınama turu', { mod: 'standart' });
  assert.equal(web3.stops.length, 3);
  assert.notDeepEqual(web3.stops[0].coords, web3.stops[2].coords, 'dönüşsüz turda bitiş başlangıca eşit olmamalı');
  const uyg3 = norm(uyg.paylasilacakTur(JSON.parse(JSON.stringify(web3))));
  const fark3 = [...new Set([...Object.keys(uyg3), ...Object.keys(norm(web3))])].filter((k) => JSON.stringify(uyg3[k]) !== JSON.stringify(norm(web3)[k]));
  assert.deepEqual(fark3, [], `dönüşsüz turda beklenmeyen fark: ${fark3}`);
  const s3 = await M.turPaylas(web3);
  assert.ok(s3.ok, `dönüşsüz tur paylaşılamadı: ${JSON.stringify(s3)}`);
  const geri3 = await M.turAl(s3.kod);
  assert.deepEqual(norm(geri3.tur), norm(web3), 'dönüşsüz tur geri okununca farklı');
  console.log(`dönüşsüz tur: kod ${s3.kod}, A → 1 durak → B, ${Math.round(geri3.tur.routeDistanceMeters / 1000)} km — uygulama şemasıyla aynı, sunucudan birebir geri okundu`);
}
