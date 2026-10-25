/*
 * expo-location yerine (web): turDurakAdlari'nın ters kodlaması. Motor `Location.reverseGeocodeAsync` çağırıyor; burada Motoseyir vekilinin
 * /web/ters ucuyla (vekil komoot Photon'u sorar, önbellekler; tarayıcı komoot'a gitmez) karşılanıyor ve expo'nun LocationGeocodedAddress alanlarına çevriliyor.
 * Sıralı çağrılıyor (motor zaten sırayla), hata verirse boş: çağıran "Durak N" yazıyor.
 */
export interface LocationGeocodedAddress {
  city?: string | null;
  subregion?: string | null;
  district?: string | null;
  name?: string | null;
}
declare const __VEKIL__: string;
let dil = 'en';
function taban(): string {
  try {
    if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) {
      const t = localStorage.getItem('motoseyir.vekil.taban') || localStorage.getItem('motoseyir.hava.taban'); /* yerel sınama */
      if (t) return t;
    }
  } catch { /* depolama kapalı */ }
  return __VEKIL__;
}
export function dilAyarla(d: string): void {
  dil = d;
}
export async function reverseGeocodeAsync(p: { latitude: number; longitude: number }): Promise<LocationGeocodedAddress[]> {
  const r = await fetch(`${taban()}/web/ters?lat=${p.latitude.toFixed(5)}&lon=${p.longitude.toFixed(5)}&dil=${dil}`);
  if (!r.ok) return [];
  const j = (await r.json()) as { ham?: Record<string, string> };
  const o = j.ham;
  if (!o) return [];
  /* Köy / mahalle öncelikli: uygulamadaki Apple adlandırıcısı da başlangıç için ilçe/kasaba, ara duraklar için köy veriyor. */
  const kendi = o.osm_key === 'place' ? o.name : undefined; // en yakın nesne yerleşimin kendisiyse (kasaba, köy) adı budur
  const yer = o.city ?? o.town ?? o.village ?? kendi ?? o.locality ?? o.district ?? null;
  return [{ city: yer, subregion: o.county ?? null, district: o.village ?? kendi ?? o.locality ?? o.district ?? o.suburb ?? o.town ?? o.city ?? null, name: o.name ?? null }];
}
