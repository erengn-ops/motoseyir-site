/* i18n yerine (web): motor yalnız Türkçe kaynak metni görüyor; arayüz metinleri sayfanın kendisinde. */
export function t(metin: string, degerler?: Record<string, string | number>): string {
  let s = metin;
  if (degerler) for (const [k, v] of Object.entries(degerler)) s = s.split(`{${k}}`).join(String(v));
  return s;
}
export const tc = t;
export function dilli<T extends object>(kur: () => T): T {
  return kur();
}
export function etkinDil(): string {
  return 'en';
}
export function konusmaEtiketi(): string {
  return 'en-US';
}
export function yerelEtiket(): string {
  return 'en-US';
}
export function ondalik(n: number): string {
  return String(n);
}
