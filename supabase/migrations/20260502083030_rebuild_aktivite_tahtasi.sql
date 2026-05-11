/*
  # Rebuild aktivite_tahtasi table

  Purpose: Each advisor tracks their hot customers (those likely to take action soon).

  1. Drop existing table and create new one
    - id (uuid, primary key)
    - danisman_username (text) - advisor's username
    - musteri_id (uuid, optional) - link to existing customer
    - musteri_ad (text) - customer name (if not linked)
    - not_metni (text) - advisor's note
    - oncelik (text) - sicak/yakin/takip
    - sira (integer) - display order within column
    - son_aksiyon_tarihi (date) - last action date
    - created_at (timestamptz)

  2. Insert İlyas Kaykal user if not exists

  3. RLS disabled for team transparency
*/

DROP TABLE IF EXISTS aktivite_tahtasi;

CREATE TABLE aktivite_tahtasi (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  danisman_username text NOT NULL,
  musteri_id uuid,
  musteri_ad text,
  not_metni text,
  oncelik text DEFAULT 'sicak',
  sira integer DEFAULT 0,
  son_aksiyon_tarihi date,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE aktivite_tahtasi DISABLE ROW LEVEL SECURITY;

INSERT INTO kullanicilar (username, sifre, ad, soyad, rol, ilk_giris)
VALUES ('i.kaykal', '428691', 'İlyas', 'Kaykal', 'danisan', false)
ON CONFLICT (username) DO NOTHING;
