#!/usr/bin/env node
/*
 * Web tur üreticisinin motorunu moto-rota kaynağından tek dosyaya paketler → ../m/tur/motor.js
 *
 * TEK KAYNAK: tur üretimi (services/turUret, utils/turUretici, gecitliTur, turKacin, virajliSecim, valhallaApi isteği/ayrıştırması,
 * data/gecitler …) uygulamanın kendi dosyalarından okunur, KOPYALANMAZ. Burada yalnız ağ/depolama/çeviri katmanı webe özgü
 * küçük karşılıklarla (stubs/) değiştirilir.
 *
 * Kullanım:  node derle.mjs                      (kaynak: ~/Claude/moto-rota/src)
 *            MOTO_ROTA_SRC=/yol/src node derle.mjs
 *            VEKIL=https://… DIS_ROTA=https://… node derle.mjs   (ağ adreslerini değiştirmek için)
 * Çıktının başındaki satır hangi kaynak sürümünden derlendiğini yazar.
 */
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';

const BURASI = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(process.env.MOTO_ROTA_SRC || join(homedir(), 'Claude/moto-rota/src'));
const VEKIL = process.env.VEKIL || 'https://motorota-rota.erengn.workers.dev';
const DIS_ROTA = process.env.DIS_ROTA || 'https://valhalla1.openstreetmap.de/route';
const CIKTI = resolve(BURASI, '../m/tur/motor.js');
if (!existsSync(join(SRC, 'services/turUret.ts'))) throw new Error(`moto-rota kaynağı bulunamadı: ${SRC}`);

/* Motorun kullandığı dosyaların git sürümü (kaynak depo kirliyse de yazılır: yalnız bilgi). */
let surum = 'bilinmiyor';
try {
  const depo = resolve(SRC, '..');
  const kisa = execFileSync('git', ['-C', depo, 'rev-parse', '--short', 'HEAD']).toString().trim();
  const kirli = execFileSync('git', ['-C', depo, 'status', '--porcelain', '--', 'src/services/turUret.ts', 'src/services/valhallaApi.ts',
    'src/utils/turUretici.ts', 'src/utils/gecitliTur.ts', 'src/utils/turKacin.ts', 'src/utils/virajliSecim.ts']).toString().trim();
  surum = kisa + (kirli ? '+yerel' : '');
} catch { /* git yok */ }

const stub = (ad) => join(BURASI, 'stubs', ad);
/* Uygulamadaki modül yolu (sonu uzantısız, göreli içe aktarma metni) → web karşılığı. */
const DEGISTIR = [
  [/^react-native$/, stub('react-native.ts')],
  [/^expo-location$/, stub('expo-location.ts')],
  [/(^|\/)i18n$/, stub('i18n.ts')],
  [/(^|\/)format$/, stub('format.ts')],
  [/^\.\/preferences$/, stub('preferences.ts')],
  [/^\.\/uzakAyar$/, stub('uzakAyar.ts')],
  [/^\.\/routesApi$/, stub('routesApi.ts')],
  [/(^|\/)surusKaydi$/, stub('surusKaydi.ts')],
];

/*
 * WEBE ÖZEL YAMALAR (28 Eki 2026; kullanıcı: "1000 km olsun, webde aç, uygulamada 300 bırakalım"). Uygulamanın kaynağı
 * değişmiyor; paketlenirken metin olarak değiştiriliyor. Desen tutmazsa derleme DURUR (uygulamada kod kayınca sessizce
 * 300'e dönmesin).
 *   - En uzun tur 1000 km.
 *   - Durak sayısı uzunlukla artıyor: 300 km'ye kadar uygulamadaki gibi (3/4), üstünde ~80 km'de bir, en çok 12. Dört
 *     durakla 1000 km'de duraklar arası ~150 km olur, aradaki yol ana yollara kayar, tur virajını kaybeder.
 */
const WEB_YAMA = [
  [/components\/turUretici\/geometri\.ts$/, 'export const KM_EN_COK = 300;', 'export const KM_EN_COK = 1000;'],
  [/utils\/turUretici\.ts$/, 'return hedefKm <= 120 ? 3 : 4;', 'return hedefKm <= 120 ? 3 : hedefKm <= 300 ? 4 : Math.min(12, Math.round(hedefKm / 80));'],
];

const eklenti = {
  name: 'moto-rota',
  setup(b) {
    b.onLoad({ filter: /\.ts$/ }, (a) => {
      const yamalar = WEB_YAMA.filter(([d]) => d.test(a.path));
      if (!yamalar.length) return null;
      let kod = readFileSync(a.path, 'utf8');
      for (const [, eski, yeni] of yamalar) {
        if (!kod.includes(eski)) return { errors: [{ text: `web yaması tutmadı (${a.path}): ${eski}` }] };
        kod = kod.replace(eski, yeni);
      }
      return { contents: kod, loader: 'ts' };
    });
    b.onResolve({ filter: /^moto-rota\// }, (a) => {
      const yol = join(SRC, a.path.slice('moto-rota/'.length));
      for (const uz of ['.ts', '.tsx', '/index.ts', '']) if (existsSync(yol + uz) && !yol.endsWith('/') ) { if (uz === '' && !/\.\w+$/.test(yol)) continue; return { path: yol + uz }; }
      return { errors: [{ text: `çözülemedi: ${a.path}` }] };
    });
    b.onResolve({ filter: /.*/ }, (a) => {
      if (!a.importer || !a.importer.startsWith(SRC + '/')) return null; // yalnız uygulama kaynağındaki içe aktarmalar
      for (const [desen, hedef] of DEGISTIR) if (desen.test(a.path)) return { path: hedef };
      return null;
    });
  },
};

/* Kadran geometrisi: ayrı küçük paket (m/tur/geometri.js). `node derle.mjs --geometri` yalnız bunu yeniler (motor.js'e dokunmaz). */
const GEO = resolve(BURASI, '../m/tur/geometri.js');
await build({
  entryPoints: [join(BURASI, 'web/kadran-geometri.ts')], bundle: true, minify: true, format: 'iife', globalName: 'TurGeometri', target: ['es2020'],
  platform: 'browser', outfile: GEO, plugins: [eklenti], legalComments: 'none', logLevel: 'error',
  define: { 'process.env.NODE_ENV': '"production"' },
});
writeFileSync(GEO, `/* Tur üret kadranı geometrisi — moto-rota ${surum} kaynağından derlendi (tur-araci/derle.mjs). Elle düzenleme. */\n${readFileSync(GEO, 'utf8')}`);
console.log(`→ ${GEO} (${Math.round(readFileSync(GEO).length / 1024)} KB)`);
if (process.argv.includes('--geometri')) process.exit(0);

mkdirSync(dirname(CIKTI), { recursive: true });
const sonuc = await build({
  entryPoints: [join(BURASI, 'web/giris.ts')],
  bundle: true,
  minify: true,
  format: 'iife',
  globalName: 'MotoTur',
  target: ['es2020'],
  platform: 'browser',
  outfile: CIKTI,
  plugins: [eklenti],
  legalComments: 'none',
  logLevel: 'info',
  metafile: true,
  define: {
    __VEKIL__: JSON.stringify(VEKIL),
    __DIS_ROTA__: JSON.stringify(DIS_ROTA),
    __KAYNAK_SURUM__: JSON.stringify(surum),
    'process.env.EXPO_PUBLIC_VALHALLA_URL': JSON.stringify(VEKIL),
    'process.env.EXPO_PUBLIC_VALHALLA_KEY': '""',
    'process.env.EXPO_PUBLIC_STADIA_KEY': '"web"',
    'process.env.NODE_ENV': '"production"',
  },
});
const eski = readFileSync(CIKTI, 'utf8');
writeFileSync(CIKTI, `/* Motoseyir web tur üreticisi motoru — moto-rota ${surum} kaynağından derlendi (tur-araci/derle.mjs). Elle düzenleme. */\n${eski}`);
const boyut = Math.round(readFileSync(CIKTI).length / 1024);
console.log(`→ ${CIKTI} (${boyut} KB, kaynak ${surum})`);

/* Harita: uygulamanın çevrimdışı haritasının stili, yazı tipleri ve simgeleri (Protomaps v4 şeması) siteye kopyalanır.
   Stil kaynağı gezegen yapısı (vekilin kenar önbellekli /web/k/{z}/{x}/{y}.mvt ucu); yazı tipi/simge adresleri sitenin kendi yolu — üçüncü tarafa istek yok. */
const VARLIK = resolve(SRC, '../assets/harita');
const HARITA = resolve(BURASI, '../m/tur/harita');
mkdirSync(HARITA, { recursive: true });
const stil = JSON.parse(readFileSync(join(VARLIK, 'protomaps-acik.json'), 'utf8'));
delete stil.sources.protomaps.url;
stil.sources.protomaps = { ...stil.sources.protomaps, tiles: [`${VEKIL}/web/k/{z}/{x}/{y}.mvt?v=2`], minzoom: 0, maxzoom: 15, attribution: '© OpenStreetMap · Protomaps' };
stil.glyphs = '/m/tur/harita/fonts/{fontstack}/{range}.pbf';
stil.sprite = '/m/tur/harita/sprites/light'; /* sayfa açılışta başına kökeni ekliyor: MapLibre göreli adres kabul etmiyor */
writeFileSync(join(HARITA, 'stil.json'), JSON.stringify(stil));
cpSync(join(VARLIK, 'harita-varliklari/fonts'), join(HARITA, 'fonts'), { recursive: true });
/* Eksik glif aralıkları BOŞ dosya (28 Eki 2026): varlıkta yalnız Latin/Yunan/Kiril aralıkları var. Karoda başka yazı (Çeroki, Arap,
   Gürcü, CJK…) geçince MapLibre 4.7 o aralığı istiyor, 404 alınca KAROYU verisiz bırakıyordu — Asheville batısı (Qualla Boundary)
   gri kalıyordu. Boş 200 yanıtında karo çizilir, yalnız o harfler görünmez. */
for (const yigin of readdirSync(join(HARITA, 'fonts'), { withFileTypes: true }).filter((d) => d.isDirectory())) {
  const kl = join(HARITA, 'fonts', yigin.name);
  for (let a = 0; a < 65536; a += 256) {
    const dosya = join(kl, `${a}-${a + 255}.pbf`);
    if (!existsSync(dosya)) writeFileSync(dosya, '');
  }
}
cpSync(join(VARLIK, 'harita-varliklari/sprites'), join(HARITA, 'sprites'), { recursive: true });
console.log(`→ ${HARITA} (stil, ${stil.layers.length} katman; yazı tipleri, simgeler)`);

/* Keşfet verisi (efsane rotalar): dil başına m/tur/kesfet.<dil>.json. Düğümde çalışan küçük bir paket olarak derlenip çağrılıyor. */
const veriDosya = resolve(BURASI, '.kesfet-veri.cjs');
await build({
  entryPoints: [join(BURASI, 'web/kesfet-veri.ts')], bundle: true, format: 'cjs', platform: 'node', outfile: veriDosya, logLevel: 'error', plugins: [eklenti],
});
const { createRequire } = await import('node:module');
const kesfet = createRequire(import.meta.url)(veriDosya);
const veri = kesfet.uret();
for (const dil of ['tr', 'en', 'de']) {
  const yol = resolve(BURASI, `../m/tur/kesfet.${dil}.json`);
  writeFileSync(yol, JSON.stringify(veri[dil]));
  console.log(`→ ${yol} (${veri[dil].length} rota, ${Math.round(readFileSync(yol).length / 1024)} KB)`);
}
const eksikOzet = [...new Set(veri.eksikler)];
if (eksikOzet.length) console.log(`UYARI: ${eksikOzet.length} metnin çevirisi uygulama sözlüğünde yok (boş bırakıldı):\n  ` + eksikOzet.slice(0, 12).join('\n  '));
