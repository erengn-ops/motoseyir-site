/*
 * KEŞFET VERİSİ (node'da çalışır; derle.mjs çağırıyor): uygulamadaki "Rota keşfet"in Efsane kolu — Türkiye klasikleri
 * (data/presetTours), Avrupa ve ABD efsane yolları (data/avrupaEfsaneYollari, data/abdEfsaneYollari) — dil başına tek JSON'a
 * dökülür: m/tur/kesfet.<dil>.json. Metinler uygulamanın kendi çeviri sözlüğünden (i18n/en.ts, de.ts; anahtar = Türkçe cümle).
 * Dağ geçitleri ayrı dosya DEĞİL: data/gecitler motor.js içinde (Tur üret'in geçitli şekilleri zaten kullanıyor).
 * Topluluk rotaları BİLEREK yok: uç anahtarlı ve içerik kullanıcıya ait (ad, rozet) — gizlilik ve moderasyon sorunu.
 */
import { PRESET_TOURS } from 'moto-rota/data/presetTours';
import { ABD_EFSANE_TURLARI } from 'moto-rota/data/abdEfsaneYollari';
import { AVRUPA_EFSANE_TURLARI } from 'moto-rota/data/avrupaEfsaneYollari';
import { en } from 'moto-rota/i18n/en';
import { de } from 'moto-rota/i18n/de';
import type { PresetTour } from 'moto-rota/data/presetTours';

const SOZLUK: Record<string, Record<string, string> | null> = { tr: null, en, de };
const eksikler: string[] = [];

function cevir(dil: string, anahtar: string): string {
  const s = SOZLUK[dil];
  if (!s) return anahtar;
  const k = s[anahtar];
  if (k == null) {
    eksikler.push(`${dil}: ${anahtar.slice(0, 70)}`);
    return '';
  }
  return k;
}

const ULKE_ANAHTARI: Record<string, string> = { AT: 'Avusturya', CH: 'İsviçre', IT: 'İtalya', FR: 'Fransa', ES: 'İspanya', NO: 'Norveç', RO: 'Romanya' };
const MIL_M = 1609.344;

function uzunlukM(p: PresetTour): number {
  if (p.abd?.uzunlukMil != null) return p.abd.uzunlukMil * MIL_M;
  if (p.avrupa?.uzunlukKm != null) return p.avrupa.uzunlukKm * 1000;
  return p.distanceMeters;
}

/** Çizgiyi seyreltir (en çok `n` nokta), 4 ondalık (~11 m): önizleme ve harita tıklaması için yeter, gerçek rota tura açılırken hesaplanıyor. */
function seyrelt(sekil: [number, number][], n: number): [number, number][] {
  const adim = Math.max(1, Math.ceil(sekil.length / n));
  const out = sekil.filter((_, i) => i % adim === 0);
  const son = sekil[sekil.length - 1];
  if (out[out.length - 1] !== son) out.push(son);
  return out.map(([a, b]) => [Math.round(a * 1e4) / 1e4, Math.round(b * 1e4) / 1e4]);
}

const olcuSayi = (o: Record<string, number>) => ('mil' in o ? o.mil * MIL_M : 'ft' in o ? o.ft * 0.3048 : 'km' in o ? o.km * 1000 : 'm' in o ? o.m : o.mph != null ? o.mph * 1.609344 : o.kmsa);
void olcuSayi;

export function uret(): { tr: unknown[]; en: unknown[]; de: unknown[]; eksikler: string[] } {
  const tumu = [...PRESET_TOURS, ...AVRUPA_EFSANE_TURLARI, ...ABD_EFSANE_TURLARI];
  const sonuc: Record<string, unknown[]> = { tr: [], en: [], de: [] };
  for (const dil of ['tr', 'en', 'de']) {
    for (const p of tumu) {
      const yol = p.abd ?? p.avrupa;
      const cog = p.cografya ?? 'tr';
      const bolge = p.avrupa
        ? p.avrupa.ulkeler.map((u) => (ULKE_ANAHTARI[u] ? cevir(dil, ULKE_ANAHTARI[u]) : u)).join(' / ')
        : p.region;
      const oge: Record<string, unknown> = {
        id: p.id,
        ad: p.name,
        bolge,
        cog,
        km: Math.round(uzunlukM(p) / 100) / 10,
        mod: p.mode ?? 'koy',
        duraklar: p.stops.map((s) => ({ ad: s.name, lat: s.latitude, lon: s.longitude })),
        sekil: seyrelt(p.shape, 140),
        neden: dil === 'tr' || !yol ? (dil === 'tr' ? p.description : cevir(dil, p.description)) : cevir(dil, yol.neden),
      };
      if (!yol) oge.neden = dil === 'tr' ? p.description : cevir(dil, p.description);
      if (yol) {
        oge.not = { m: cevir(dil, yol.not.metin), o: yol.not.olcu ?? [] };
        if (dil === 'tr') oge.not = { m: yol.not.metin, o: yol.not.olcu ?? [] };
        oge.kis = yol.kisinKapanir;
        if (yol.zirve) oge.zirve = { ...('m' in yol.zirve ? { m: yol.zirve.m } : { ft: (yol.zirve as { ft: number }).ft }), ...(yol.zirve.ad ? { ad: yol.zirve.ad } : {}) };
        if (yol.viraj != null) oge.viraj = yol.viraj;
        if (yol.firkete != null) oge.firkete = yol.firkete;
        if (yol.kaynaklar[0]) oge.kaynak = { site: yol.kaynaklar[0].site, url: yol.kaynaklar[0].url };
      }
      sonuc[dil].push(oge);
    }
  }
  return { tr: sonuc.tr, en: sonuc.en, de: sonuc.de, eksikler };
}
