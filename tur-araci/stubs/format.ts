/* utils/format yerine (web): rota profili yalnız ölçüm istiyor; metin biçimi sayfada. */
export function formatDistance(m: number): string {
  return `${(m / 1000).toFixed(1)} km`;
}
export function formatMeters(m: number): string {
  return `${Math.round(m)} m`;
}
