/*
  # EIDS Yetki Takip + Orhan Sinan Derli Kullanıcısı

  1. portfoyler tablosuna EIDS alanları eklendi
     - eids_status: yetki durumu (yok/beklemede/aktif/suresi_doldu/iptal_edildi/yabanci_malik/tapusuz)
     - eids_tasinmaz_no: tapu sicil taşınmaz numarası
     - eids_yetki_baslangic: yetki başlangıç tarihi
     - eids_yetki_bitis: yetki bitiş tarihi
     - eids_yetki_belge_no: e-devlet yetki belge numarası
     - eids_notlar: serbest notlar
     - eids_son_hatirlatma: son hatırlatma gönderim zamanı
     - eids_yetkili_kisi: yetkili kişi (malik/eş/akraba)

  2. eids_audit_log tablosu oluşturuldu
     - EİDS durum değişikliklerini izler
     - RLS devre dışı (admin tarafından yazılır)

  3. app_config tablosuna derli_yetki_belge_no eklendi
     - WhatsApp şablonunda kullanılacak

  4. Orhan Sinan Derli kullanıcısı eklendi (yoksa)
*/

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='portfoyler' AND column_name='eids_status') THEN
    ALTER TABLE portfoyler ADD COLUMN eids_status text DEFAULT 'yok';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='portfoyler' AND column_name='eids_tasinmaz_no') THEN
    ALTER TABLE portfoyler ADD COLUMN eids_tasinmaz_no text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='portfoyler' AND column_name='eids_yetki_baslangic') THEN
    ALTER TABLE portfoyler ADD COLUMN eids_yetki_baslangic date;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='portfoyler' AND column_name='eids_yetki_bitis') THEN
    ALTER TABLE portfoyler ADD COLUMN eids_yetki_bitis date;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='portfoyler' AND column_name='eids_yetki_belge_no') THEN
    ALTER TABLE portfoyler ADD COLUMN eids_yetki_belge_no text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='portfoyler' AND column_name='eids_notlar') THEN
    ALTER TABLE portfoyler ADD COLUMN eids_notlar text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='portfoyler' AND column_name='eids_son_hatirlatma') THEN
    ALTER TABLE portfoyler ADD COLUMN eids_son_hatirlatma timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='portfoyler' AND column_name='eids_yetkili_kisi') THEN
    ALTER TABLE portfoyler ADD COLUMN eids_yetkili_kisi text;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS eids_audit_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id uuid,
  old_status text,
  new_status text,
  changed_by text,
  changed_at timestamptz DEFAULT now(),
  notes text
);

ALTER TABLE eids_audit_log DISABLE ROW LEVEL SECURITY;

INSERT INTO app_config (key, value) VALUES ('derli_yetki_belge_no', '') ON CONFLICT (key) DO NOTHING;

INSERT INTO kullanicilar (username, sifre, sifre_hashed, ad, soyad, rol, ilk_giris)
VALUES ('orhan.derli', crypt('Derli2026', gen_salt('bf')), true, 'Orhan Sinan', 'Derli', 'admin', false)
ON CONFLICT (username) DO NOTHING;
