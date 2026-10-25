/*
 * expo-location yerine (web): turDurakAdlari'nın ters kodlaması. Motor `Location.reverseGeocodeAsync` çağırıyor; burada Photon
 * (OpenStreetMap, photon.komoot.io) ile karşılanıyor ve expo'nun LocationGeocodedAddress alanlarına çevriliyor.
 * Sıralı çağrılıyor (motor zaten sırayla), hata verirse boş: çağıran "Durak N" yazıyor.
 */
export interface LocationGeocodedAddress {
  city?: string | null;
  subregion?: string | null;
  district?: string | null;
  name?: string | null;
}
let dil = 'en';
export function dilAyarla(d: string): void {
  dil = d;
}
export async function reverseGeocodeAsync(p: { latitude: number; longitude: number }): Promise<LocationGeocodedAddress[]> {
  const r = await fetch(`https://photon.komoot.io/reverse?lat=${p.latitude}&lon=${p.longitude}&limit=1&lang=${dil}`);
  if (!r.ok) return [];
  const j = (await r.json()) as { features?: { properties?: Record<string, string> }[] };
  const o = j.features?.[0]?.properties;
  if (!o) return [];
  /* Köy / mahalle öncelikli: uygulamadaki Apple adlandırıcısı da başlangıç için ilçe/kasaba, ara duraklar için köy veriyor. */
  const kendi = o.osm_key === 'place' ? o.name : undefined; // en yakın nesne yerleşimin kendisiyse (kasaba, köy) adı budur
  const yer = o.city ?? o.town ?? o.village ?? kendi ?? o.locality ?? o.district ?? null;
  return [{ city: yer, subregion: o.county ?? null, district: o.village ?? kendi ?? o.locality ?? o.district ?? o.suburb ?? o.town ?? o.city ?? null, name: o.name ?? null }];
}
