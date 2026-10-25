/*
 * WEB TUR ÜRETİCİ — motor girişi. Uygulamadaki tur üretimi (services/turUret, utils/turUretici, gecitliTur, turKacin, virajliSecim)
 * moto-rota kaynağından OLDUĞU GİBİ paketleniyor (derle.mjs); bu dosya yalnız tarayıcıya özgü yapıştırıcı:
 *   • ağ: Motoseyir vekili (TR + GR rotası, tur kodu) ve dış motor (OpenStreetMap/FOSSGIS Valhalla, dışarısı),
 *   • turu uygulamanın Tour biçiminde kurmak (TourScreen.uretilenTuruKur'un web karşılığı) ve tur koduyla paylaşmak.
 */
import { turUret, turDurakAdlari, turKipi, type UretilenTur } from 'moto-rota/services/turUret';
import { dilAyarla } from '../stubs/expo-location';
import { simplifyForPreview } from 'moto-rota/utils/geo';
import { KACIN_YOK, kacinVarMi, OTOYOL_ESIK_M } from 'moto-rota/utils/turKacin';
import { ORTUSME_UYARI, noktaYonde, yaricapKm, turOlc, type VirajSeviyesi } from 'moto-rota/utils/turUretici';
import { GECITLER } from 'moto-rota/data/gecitler';
import { kapaliOlabilirMi } from 'moto-rota/utils/kisGecitUyarisi';
import { rotadakiGecitler } from 'moto-rota/utils/gecitliTur';
import { maliyetKacini } from 'moto-rota/utils/turKacin';
import { fetchTourRoute } from '../stubs/routesApi';
import {
  adimaOturt, cetvelAdimi, uretimKm, uretimSureSn, seviyeDegisinceKm, sureSaniye, enYakinYon, capKm,
  ORTALAMA_KMSA, KM_EN_AZ, KM_EN_COK, YON_ADLARI, adimSiniri,
} from 'moto-rota/components/turUretici/geometri';
import type { LatLng, Tour, TourMode, TurKacin } from 'moto-rota/types';

declare const __VEKIL__: string;
declare const __DIS_ROTA__: string;
declare const __KAYNAK_SURUM__: string;

/* ------------------------------------------------------------------ ağ yapıştırıcısı */

interface Sayac {
  son429: 'gunluk-tavan' | 'cok-istek' | null;
  disIstek: number;
  vekilIstek: number;
  /** Son BAŞARISIZ rota/vekil cevabının durumu (0 = yok); ağ kopması için `ag`. Sayfa, boş sonucun sebebini buradan söylüyor. */
  sonHataDurum: number;
  ag: boolean;
}
export const sayac: Sayac = { son429: null, disIstek: 0, vekilIstek: 0, sonHataDurum: 0, ag: false };
export function sayaciSifirla(): void {
  sayac.son429 = null;
  sayac.sonHataDurum = 0;
  sayac.ag = false;
}

const yerelFetch = globalThis.fetch.bind(globalThis);
const BEKLE = (ms: number) => new Promise((r) => setTimeout(r, ms));

/* Dış motora (kamuya açık demo sunucu) nazik davran: aynı anda 2, istekler arasında en az 450 ms, 429/5xx'te geri çekilip tekrar. */
let disSira: Promise<unknown> = Promise.resolve();
let sonDisIstek = 0;
let disAktif = 0;
async function disFetch(init: RequestInit | undefined): Promise<Response> {
  while (disAktif >= 2) await BEKLE(120);
  disAktif++;
  try {
    const onceki = disSira;
    let birak!: () => void;
    disSira = new Promise<void>((r) => (birak = r));
    await onceki;
    const bekleme = Math.max(0, sonDisIstek + 450 - Date.now());
    if (bekleme) await BEKLE(bekleme);
    sonDisIstek = Date.now();
    birak();
    let son: Response | null = null;
    for (let deneme = 0; deneme < 3; deneme++) {
      sayac.disIstek++;
      try {
        son = await yerelFetch(__DIS_ROTA__, { ...init, headers: { 'Content-Type': 'application/json' } });
      } catch (h) {
        sayac.ag = true;
        throw h;
      }
      /* 400 = bu noktalar arasında yol yok (istek sorunu değil); öteki hatalar sayfaya "meşgul" diye bildiriliyor. */
      if (!son.ok && son.status !== 400) sayac.sonHataDurum = son.status;
      if (son.status !== 429 && son.status < 500) return son;
      await BEKLE(1200 * (deneme + 1));
    }
    return son as Response;
  } finally {
    disAktif--;
  }
}

globalThis.fetch = (async (girdi: RequestInfo | URL, init?: RequestInit) => {
  const adres = typeof girdi === 'string' ? girdi : girdi instanceof URL ? girdi.href : girdi.url;
  if (/^https:\/\/api(-eu)?\.stadiamaps\.com\/route\/v1/.test(adres)) return disFetch(init);
  let cevap: Response;
  try {
    cevap = await yerelFetch(girdi, init);
  } catch (h) {
    if (adres.startsWith(__VEKIL__) && !adres.includes('/web/harita')) sayac.ag = true;
    throw h;
  }
  if (adres.startsWith(__VEKIL__) && !adres.includes('/web/harita')) {
    sayac.vekilIstek++;
    if (!cevap.ok && cevap.status !== 400) sayac.sonHataDurum = cevap.status;
    if (cevap.status === 429) {
      try {
        const g = (await cevap.clone().json()) as { error?: string };
        sayac.son429 = g.error === 'gunluk-tavan' ? 'gunluk-tavan' : 'cok-istek';
      } catch {
        sayac.son429 = 'cok-istek';
      }
    }
  }
  return cevap;
}) as typeof fetch;

/* ------------------------------------------------------------------ cihaz kimliği (web) */

export function webCihaz(): string {
  const anahtar = 'motoseyir.web.cihaz';
  try {
    const var_ = localStorage.getItem(anahtar);
    if (var_ && /^web-[a-z0-9]{16,40}$/.test(var_)) return var_;
  } catch {
    /* depolama kapalı */
  }
  const b = new Uint8Array(12);
  crypto.getRandomValues(b);
  const yeni = `web-${[...b].map((x) => x.toString(16).padStart(2, '0')).join('')}`;
  try {
    localStorage.setItem(anahtar, yeni);
  } catch {
    /* sorun değil: bu oturum için geçerli */
  }
  return yeni;
}

/* ------------------------------------------------------------------ tur kaydı + paylaşım */

const yuvarla = (n: number) => Math.round(n * 1e6) / 1e6;
const rastgele = () => Math.random().toString(36).slice(2, 8);

/**
 * Üretilen turu uygulamanın `Tour` biçiminde kurar (TourScreen.uretilenTuruKur ile aynı alanlar) ve paylaşıma hazırlar
 * (turKoduApi.paylasilacakTur'un temizlediği alanlar baştan boş: ziyaret, not, fotoğraf, grup, ilerleme).
 */
export function turKaydi(
  uretilen: UretilenTur,
  adlar: string[],
  seviye: VirajSeviyesi,
  ad: string,
  /** Efsane rotadan açılan tur: kendi modu ve `presetId` (uygulamadaki presetToTour ile aynı alanlar). */
  ek?: { mod?: TourMode; presetId?: string }
): Tour {
  const son = uretilen.duraklar.length - 1;
  const stops = uretilen.duraklar.map((c, i) => ({
    id: `stop-${Date.now()}-${rastgele()}`,
    name: adlar[i] || (i === 0 ? 'Start' : i === son ? 'Finish' : `Stop ${i}`),
    coords: { latitude: yuvarla(c.latitude), longitude: yuvarla(c.longitude) },
    visited: false,
  }));
  const shape = simplifyForPreview(uretilen.coordinates).map(([a, b]) => [yuvarla(a), yuvarla(b)] as [number, number]);
  return {
    id: `tour-${Date.now()}-${rastgele()}`,
    name: ad,
    createdAt: Date.now(),
    stops,
    mode: ek?.mod ?? turKipi(seviye),
    ...(ek?.presetId ? { presetId: ek.presetId } : {}),
    ...(kacinVarMi(uretilen.kacin) ? { kacin: uretilen.kacin } : {}),
    kaydedildi: false,
    progressMeters: 0,
    routeDistanceMeters: uretilen.rota.totalDistanceMeters,
    routeDurationSeconds: uretilen.rota.totalDurationSeconds,
    shape,
  } as Tour;
}

export type PaylasSonuc = { ok: true; kod: string; gun: number } | { ok: false; hata: 'gunluk' | 'ag' | 'buyuk' | 'sunucu' };

export async function turPaylas(tur: Tour): Promise<PaylasSonuc> {
  try {
    const r = await yerelFetch(`${__VEKIL__}/tur/paylas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tur, cihaz: webCihaz() }),
    });
    if (r.status === 429) return { ok: false, hata: 'gunluk' };
    if (!r.ok) return { ok: false, hata: 'sunucu' };
    const g = (await r.json()) as { kod?: string; gun?: number; hata?: string };
    if (g.hata === 'tur cok buyuk') return { ok: false, hata: 'buyuk' };
    if (g.hata === 'gunluk sinir') return { ok: false, hata: 'gunluk' };
    if (!g.kod) return { ok: false, hata: 'sunucu' };
    return { ok: true, kod: g.kod, gun: g.gun ?? 30 };
  } catch {
    return { ok: false, hata: 'ag' };
  }
}

/** Geri okuma (uygulamanın turAl'ının aynı isteği): doğrulama ve test için. */
export async function turAl(kod: string): Promise<{ tur?: Tour; grupKod?: string; hata?: string }> {
  const r = await yerelFetch(`${__VEKIL__}/tur/al`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ kod, cihaz: webCihaz() }),
  });
  return r.json();
}

/* ------------------------------------------------------------------ yeniden rotalama + yerler */

export interface YenidenRota {
  coordinates: LatLng[];
  /** `bacaklar`: durak çiftleri arası mesafe (m) ve süre (sn); düzenleyicideki bacak hapları ve hava varış saatleri bunlardan. */
  rota: { totalDistanceMeters: number; totalDurationSeconds: number; icerik: unknown; bacaklar: { m: number; sn: number }[]; koyBulunamadi?: boolean; erisilemezDurak?: number };
  olcu: ReturnType<typeof turOlc>;
  gecitler: ReturnType<typeof rotadakiGecitler>;
}

/**
 * Verilen duraklardan gerçek rotayı yeniden hesaplar (efsane rotayı açarken, bir yeri durak olarak eklerken). Aynı motor ve
 * aynı ölçü (turOlc: viraj, örtüşme) — kartlar üretilen turlarla aynı alanları okuyor. Yalnız gösterim için gereken alanlar döner.
 */
export async function rotaKur(duraklar: LatLng[], seviye: VirajSeviyesi, kacin?: TurKacin, mod?: TourMode, yeniSira?: number): Promise<YenidenRota> {
  /* Eklenen durak (bir yer) yola uzak olabilir: o durakta yol sınıfı süzgeci, uç denetimi yok (valhallaApi YOLA_OTURTMA) — motor onu en yakın uygun yola oturtuyor. */
  const yolaOturt = yeniSira != null ? duraklar.map((_, i) => i === yeniSira) : undefined;
  const rota = await fetchTourRoute(duraklar, mod ?? turKipi(seviye), undefined, undefined, undefined, yolaOturt, undefined, maliyetKacini(kacin));
  const km = rota.totalDistanceMeters / 1000;
  return {
    coordinates: rota.coordinates,
    rota: {
      totalDistanceMeters: rota.totalDistanceMeters, totalDurationSeconds: rota.totalDurationSeconds, icerik: rota.icerik,
      bacaklar: (rota.legs ?? []).map((l) => ({ m: l.distanceMeters, sn: l.durationSeconds })),
      ...(rota.koyBulunamadi ? { koyBulunamadi: true } : {}), ...(rota.unreachableStopIndex != null ? { erisilemezDurak: rota.unreachableStopIndex } : {}),
    },
    olcu: turOlc(rota.coordinates, rota.totalDistanceMeters, km, seviye),
    gecitler: rotadakiGecitler(rota.coordinates),
  };
}

export interface YerSonuc {
  id: number; ad: string; kat: string; lat: number; lon: number; ulke?: string; adres?: string; yerlesim?: string; sapmaM: number; rotaM: number; puan: number;
}

/**
 * Rota üstündeki yerler: kendi yer veritabanımız (OSM + Foursquare Open Source Places + Overture), vekil üzerinden. `puan` yerin
 * sunucudaki sıralama skoru — yıldız/oy DEĞİL, sayfada gösterilmiyor; yalnız en iyileri seçmek için.
 */
export async function yerlerKoridor(coords: LatLng[], sekme: string, genislikM = 2500): Promise<{ yerler: YerSonuc[]; atif: Record<string, string> } | null> {
  const adim = Math.max(1, Math.ceil(coords.length / 450));
  const hat: [number, number][] = [];
  for (let i = 0; i < coords.length; i += adim) hat.push([Math.round(coords[i].latitude * 1e5) / 1e5, Math.round(coords[i].longitude * 1e5) / 1e5]);
  const son = coords[coords.length - 1];
  if (son) hat.push([Math.round(son.latitude * 1e5) / 1e5, Math.round(son.longitude * 1e5) / 1e5]);
  try {
    const r = await yerelFetch(`${__VEKIL__}/takip/yerler/koridor`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cihaz: webCihaz(), hat, genislikM, sekme, limit: 40, pencereKm: 10, pencereK: 2, sira: 'puan' }),
    });
    if (r.status === 429) sayac.son429 = (await r.clone().json().catch(() => ({})) as { error?: string }).error === 'gunluk-tavan' ? 'gunluk-tavan' : 'cok-istek';
    if (!r.ok) return null;
    const j = (await r.json()) as { yerler?: YerSonuc[]; atif?: Record<string, string> };
    return { yerler: j.yerler ?? [], atif: j.atif ?? {} };
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ dışa açılan yüzey */

export {
  turUret, turDurakAdlari, turKipi, dilAyarla, simplifyForPreview,
  KACIN_YOK, kacinVarMi, OTOYOL_ESIK_M, ORTUSME_UYARI, noktaYonde, yaricapKm,
  adimaOturt, cetvelAdimi, uretimKm, uretimSureSn, seviyeDegisinceKm, sureSaniye, enYakinYon, capKm,
  ORTALAMA_KMSA, KM_EN_AZ, KM_EN_COK, YON_ADLARI, adimSiniri,
};
export { GECITLER, kapaliOlabilirMi };
export const surum = __KAYNAK_SURUM__;
export const vekil = __VEKIL__;
export type { UretilenTur, VirajSeviyesi, LatLng, Tour, TurKacin };
