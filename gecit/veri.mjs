/*
 * Geçit sayfalarının verisi (27 Eki 2026, SEO). Uygulamanın geçit listesini (moto-rota src/data/gecitler.ts: elle liste +
 * Avrupa/Asya/ABD derlemeleri, GECIT_EK birleşmiş hâli) ve Commons fotoğraf listesini (gecitFotolari.ts) olduğu gibi
 * okur, `gecit/gecitler.json`a yazar. Elle düzenlenmez; uygulamanın verisi değişince yeniden çalıştırılır:
 *   cd tur-araci && npm install && cd .. && node gecit/veri.mjs        (kaynak: ~/Claude/moto-rota/src; MOTO_ROTA_SRC ile değişir)
 * Sayfaları uret.py yazar (bkz. uret.py "GEÇİT SAYFALARI").
 */
import { build } from '../tur-araci/node_modules/esbuild/lib/main.js';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { tmpdir, homedir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

const KOK = dirname(fileURLToPath(import.meta.url));
const SRC = process.env.MOTO_ROTA_SRC || join(homedir(), 'Claude/moto-rota/src');
const gecici = mkdtempSync(join(tmpdir(), 'gecit-'));
const giris = join(gecici, 'giris.ts');
writeFileSync(giris, `export { GECITLER } from ${JSON.stringify(join(SRC, 'data/gecitler'))};\n` +
  `export { GECIT_FOTOLARI } from ${JSON.stringify(join(SRC, 'data/gecitFotolari'))};\n`);
const cikti = join(gecici, 'veri.mjs');
await build({ entryPoints: [giris], bundle: true, format: 'esm', platform: 'node', outfile: cikti, logLevel: 'error' });
const { GECITLER, GECIT_FOTOLARI } = await import(pathToFileURL(cikti).href);

let surum = '';
try { surum = execSync('git rev-parse --short HEAD', { cwd: SRC }).toString().trim(); } catch { /* depo değil */ }
const liste = GECITLER.map((g) => {
  const f = (GECIT_FOTOLARI[g.id] || []).filter((x) => !x.ad.startsWith('yerel:'));
  return { ...g, foto: f.length ? f : undefined };
});
writeFileSync(join(KOK, 'gecitler.json'), JSON.stringify({ kaynak: `moto-rota@${surum}`, sayi: liste.length, gecitler: liste }, null, 0) + '\n');
console.log(`${liste.length} geçit yazıldı (moto-rota@${surum}); fotoğraflı: ${liste.filter((g) => g.foto).length}`);
