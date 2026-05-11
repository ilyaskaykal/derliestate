/*
  # EstateIQ Pro - Initial Schema

  ## New Tables

  1. `kullanicilar` - Users table
     - id, username (unique), sifre (password hash), ad (first name), soyad (last name)
     - rol: admin or user
     - ilk_giris: boolean, true means must change password on first login
     - created_at

  2. `musteriler` - Customers table
     - id, ad, soyad, telefon, email, muhit (neighborhood), butce (budget)
     - portfoy_tercihi (portfolio preference), durum (status), kaynak (source), notlar (notes)
     - created_at

  3. `portfoyler` - Portfolios table
     - id, isim (title), sahip_ad/soyad/tc/tel (owner info)
     - il/ilce/mahalle/ada/parsel (land registry)
     - fiyat (price), tip (type), oda (rooms), metrekare (sqm), durum_bina (building age)
     - kat (floor), isitma (heating), portfoy_durum (portfolio status)
     - baska_emlakci (listed elsewhere), ilan_no/portal, aciklama (notes)
     - created_at

  4. `randevular` - Appointments table
     - id, musteri_id (FK to musteriler), tarih (date), saat (time), konu (subject), durum (status)
     - created_at

  ## Security
  - RLS disabled on all tables per project requirements
*/

CREATE TABLE IF NOT EXISTS kullanicilar (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text UNIQUE NOT NULL,
  sifre text NOT NULL,
  ad text NOT NULL DEFAULT '',
  soyad text NOT NULL DEFAULT '',
  rol text NOT NULL DEFAULT 'user',
  ilk_giris boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS musteriler (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ad text NOT NULL DEFAULT '',
  soyad text NOT NULL DEFAULT '',
  telefon text NOT NULL DEFAULT '',
  email text DEFAULT '',
  muhit text DEFAULT '',
  butce text DEFAULT '',
  portfoy_tercihi text DEFAULT '',
  durum text NOT NULL DEFAULT 'kararsiz',
  kaynak text DEFAULT '',
  notlar text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS portfoyler (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  isim text NOT NULL DEFAULT '',
  sahip_ad text NOT NULL DEFAULT '',
  sahip_soyad text NOT NULL DEFAULT '',
  tc text DEFAULT '',
  sahip_tel text DEFAULT '',
  il text DEFAULT '',
  ilce text DEFAULT '',
  mahalle text DEFAULT '',
  ada text DEFAULT '',
  parsel text DEFAULT '',
  fiyat text DEFAULT '',
  tip text NOT NULL DEFAULT 'daire',
  oda text DEFAULT '',
  metrekare text DEFAULT '',
  durum_bina text DEFAULT '',
  kat text DEFAULT '',
  isitma text DEFAULT '',
  portfoy_durum text NOT NULL DEFAULT 'kararsiz',
  baska_emlakci boolean NOT NULL DEFAULT false,
  ilan_no text DEFAULT '',
  ilan_portal text DEFAULT '',
  aciklama text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS randevular (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  musteri_id uuid REFERENCES musteriler(id) ON DELETE SET NULL,
  tarih text NOT NULL DEFAULT '',
  saat text NOT NULL DEFAULT '',
  konu text NOT NULL DEFAULT '',
  durum text NOT NULL DEFAULT 'bekliyor',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE kullanicilar DISABLE ROW LEVEL SECURITY;
ALTER TABLE musteriler DISABLE ROW LEVEL SECURITY;
ALTER TABLE portfoyler DISABLE ROW LEVEL SECURITY;
ALTER TABLE randevular DISABLE ROW LEVEL SECURITY;

INSERT INTO kullanicilar (username, sifre, ad, soyad, rol, ilk_giris)
VALUES ('admin', 'admin123', 'Admin', 'User', 'admin', false)
ON CONFLICT (username) DO NOTHING;
