/*
 * services/routesApi yerine (web). Uygulamadaki fetchTourRoute Google yedeği, önbellek, sahil kipi ve çok şey taşıyor; tur
 * üreticisinin kullandığı DAR yol burada: aynı iki motor (valhallaApi'nin gerçek kodu — istek gövdesi, ayrıştırma, yola oturtma
 * hep o), aynı uç seçimi (kapsam kutusu → kendi sunucumuz; dışarısı → dış motor), aynı bacak kuralları.
 *   • 'kendi'  → Motoseyir Valhalla'sı (TR + GR), tarayıcıdan vekil (Cloudflare Worker) üzerinden.
 *   • 'stadia' → uygulamada Stadia; webde dış motor (giris.ts bu adresleri OpenStreetMap/FOSSGIS Valhalla'sına çeviriyor, aynı biçim).
 */
import type { LatLng, TourMode, TourRoute, TurKacin } from 'moto-rota/types';
import { amerikaMi, fetchTourRouteValhalla, valhallaEnabled, type DurakOturmasi, type RotaUcu } from 'moto-rota/services/valhallaApi';
import { haversineMeters } from 'moto-rota/utils/geo';
import { koyMotoruKapsarMi } from 'moto-rota/utils/virajliSecim';

/** routesApi.findUnreachableStop'un aynısı. */
function ulasilamayanDurak(stops: LatLng[], legs: { distanceMeters: number }[]): number | undefined {
  for (let i = 0; i < legs.length && i < stops.length - 1; i++) {
    const kus = haversineMeters(stops[i], stops[i + 1]);
    if (legs[i].distanceMeters > 250000 && legs[i].distanceMeters > kus * 6) return i + 1;
  }
  return undefined;
}

/* Dış motorun (herkese açık Valhalla) tek istekte en çok 10 konumu var (error_code 150): uzun durak listesi bacak gruplarına bölünüp
   sırayla istenir, çizgi ve toplamlar birleştirilir. Kendi sunucumuzda bu sınır yok. */
const DIS_EN_COK = 10;

function birlestir(parcalar: Awaited<ReturnType<typeof fetchTourRouteValhalla>>[]): Awaited<ReturnType<typeof fetchTourRouteValhalla>> {
  const ilk = parcalar[0];
  const toplam = (f: (p: (typeof parcalar)[number]) => number) => parcalar.reduce((t, p) => t + f(p), 0);
  return {
    ...ilk,
    coordinates: parcalar.flatMap((p, i) => (i === 0 ? p.coordinates : p.coordinates.slice(1))),
    legs: parcalar.flatMap((p) => p.legs),
    steps: parcalar.flatMap((p) => p.steps),
    totalDistanceMeters: toplam((p) => p.totalDistanceMeters),
    totalDurationSeconds: toplam((p) => p.totalDurationSeconds),
    icerik: {
      feribotSayisi: toplam((p) => p.icerik?.feribotSayisi ?? 0),
      feribotM: toplam((p) => p.icerik?.feribotM ?? 0),
      asfaltsizM: toplam((p) => p.icerik?.asfaltsizM ?? 0),
      parali: parcalar.some((p) => p.icerik?.parali),
      otoyolM: toplam((p) => p.icerik?.otoyolM ?? 0),
    },
  } as Awaited<ReturnType<typeof fetchTourRouteValhalla>>;
}

export async function fetchTourRoute(
  stops: LatLng[],
  mode: TourMode = 'standart',
  /** Bacak başına geçiş noktaları (viasByLeg): rotayı şekillendiriyor, bacak açmıyor (Valhalla `through`). `araBacak[i]` = i. ve i+1. durak arası, sırayla. */
  araBacak?: LatLng[][],
  yon?: number | null,
  _araNokta?: readonly boolean[],
  yolaOturt?: readonly boolean[],
  _sonEtiket?: string,
  kacin?: TurKacin
): Promise<TourRoute & DurakOturmasi> {
  if (stops.length < 2) throw new Error('Tur rotası için en az 2 durak gerekli.');
  const kapsar = stops.every((s, i) => i === 0 || koyMotoruKapsarMi(stops[i - 1], s));
  const uclar: RotaUcu[] = kapsar && valhallaEnabled() ? ['kendi', 'stadia'] : ['stadia'];
  const kip = mode === 'standart' ? 'kisa' : 'koy';
  const bolge = amerikaMi(stops[0]) ? 'amerika' : 'tr';
  const vias = stops.slice(1).map((_, i) => araBacak?.[i] ?? []);
  const viaVar = vias.some((v) => v.length > 0);
  let sonHata: unknown;
  for (const uc of uclar) {
    try {
      const sure = uc === 'kendi' ? 14000 : 30000;
      const iste = async (tip: 'through' | 'via') => {
        const toplamKonum = stops.length + vias.reduce((t, v) => t + v.length, 0);
        if (uc === 'stadia' && toplamKonum > DIS_EN_COK) return birlestir(await parcali(tip));
        return fetchTourRouteValhalla(stops, vias, kip, yon, uc, bolge, tip, yolaOturt, sure, kacin);
      };
      /* Dış motorun 10 konum sınırı geçiş noktalarını da sayıyor: bacaklar, konum sayısı sınıra gelene dek gruplanır (bir bacağın kendi
         geçişleri bölünmez; tek bacak bile sığmıyorsa fazlalık geçişler baştan atılıyor). */
      const parcali = async (tip: 'through' | 'via') => {
        const parcalar = [];
        let a = 0;
        while (a < stops.length - 1) {
          let b = a + 1;
          let konum = 2 + vias[a].length;
          while (b < stops.length - 1 && konum + 1 + vias[b].length <= DIS_EN_COK) {
            konum += 1 + vias[b].length;
            b++;
          }
          const bacakVias = vias.slice(a, b).map((v, i) => (i === 0 && konum > DIS_EN_COK ? v.slice(0, DIS_EN_COK - 2) : v));
          parcalar.push(await fetchTourRouteValhalla(stops.slice(a, b + 1), bacakVias, kip, a === 0 ? yon : null, uc, bolge, tip, yolaOturt?.slice(a, b + 1), sure, kacin));
          a = b;
        }
        return parcalar;
      };
      let rota: Awaited<ReturnType<typeof fetchTourRouteValhalla>>;
      try {
        rota = await iste('through');
      } catch (h) {
        /* Çıkmaz yola konmuş geçiş noktasından geçen rota yok (400): `via` aynı noktada dönmeye izin veriyor (uygulamadaki araTipi yedeği). */
        if (!viaVar || (h as { istegeOzgu?: boolean } | null)?.istegeOzgu !== true) throw h;
        rota = await iste('via');
      }
      return { ...rota, unreachableStopIndex: ulasilamayanDurak(stops, rota.legs), rotaKaynagi: uc } as TourRoute & DurakOturmasi;
    } catch (h) {
      sonHata = h;
      /* Bu noktalar arasında yol yok: öbür motora sormanın anlamı yok (routesApi.sonrakiUcDenenir ile aynı fikir). */
      if ((h as { istegeOzgu?: boolean } | null)?.istegeOzgu === true) break;
    }
  }
  throw sonHata ?? new Error('Tur rotası bulunamadı.');
}
