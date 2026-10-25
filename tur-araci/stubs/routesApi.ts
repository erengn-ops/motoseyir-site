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
  _araBacak?: LatLng[][],
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
  let sonHata: unknown;
  for (const uc of uclar) {
    try {
      const sure = uc === 'kendi' ? 14000 : 30000;
      let rota: Awaited<ReturnType<typeof fetchTourRouteValhalla>>;
      if (uc === 'stadia' && stops.length > DIS_EN_COK) {
        const parcalar = [];
        for (let a = 0; a < stops.length - 1; a += DIS_EN_COK - 1) {
          const b = Math.min(stops.length, a + DIS_EN_COK);
          parcalar.push(await fetchTourRouteValhalla(stops.slice(a, b), [], kip, a === 0 ? yon : null, uc, bolge, 'through', yolaOturt?.slice(a, b), sure, kacin));
        }
        rota = birlestir(parcalar);
      } else {
        rota = await fetchTourRouteValhalla(stops, [], kip, yon, uc, bolge, 'through', yolaOturt, sure, kacin);
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
