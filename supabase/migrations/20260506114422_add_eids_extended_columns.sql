/*
  # Add extended EİDS columns to portfoyler

  Adds the following columns if they don't already exist:
  - eids_status: EİDS yetki durumu (yok/beklemede/aktif/suresi_doldu/iptal_edildi/yabanci_malik/tapusuz)
  - eids_tasinmaz_no: Mal sahibinden alınan taşınmaz numarası
  - eids_yetki_baslangic: Yetki başlangıç tarihi
  - eids_yetki_bitis: Yetki bitiş tarihi
  - eids_yetkili_kisi: Yetkili kişi türü (Malik/Eş/Akraba/Vekil)
  - eids_notlar: Serbest notlar alanı
*/

ALTER TABLE portfoyler ADD COLUMN IF NOT EXISTS eids_status text DEFAULT 'yok';
ALTER TABLE portfoyler ADD COLUMN IF NOT EXISTS eids_tasinmaz_no text;
ALTER TABLE portfoyler ADD COLUMN IF NOT EXISTS eids_yetki_baslangic date;
ALTER TABLE portfoyler ADD COLUMN IF NOT EXISTS eids_yetki_bitis date;
ALTER TABLE portfoyler ADD COLUMN IF NOT EXISTS eids_yetkili_kisi text;
ALTER TABLE portfoyler ADD COLUMN IF NOT EXISTS eids_notlar text;
