/* Tur üret kadranının geometrisi (uygulamadaki tek kaynak): m/tur/geometri.js → window.TurGeometri.
   Yalnız saf işlevler; 'worklet' yönergeleri düz dizge olarak kalır. Kullanan: m/tur/kadran.js */
export {
  KIVRIM, ORTALAMA_KMSA, KM_EN_AZ, KM_EN_COK, cetvelAdimi, adimSiniri, adimaOturt, uretimKm, uretimSureSn, seviyeDegisinceKm,
  sureSaniye, capKm, capKmW, halkaNoktasi, dondur, enYakinYon, halkaYolu, YON_ADLARI,
} from 'moto-rota/components/turUretici/geometri';
export { durakSayisi } from 'moto-rota/utils/turUretici';
