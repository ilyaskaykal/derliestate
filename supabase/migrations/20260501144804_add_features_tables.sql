/*
  # Add 9 feature tables and columns

  1. New Tables
    - `gorevler` — task/reminder system
    - `eslestirme_gecmisi` — customer-portfolio match history
    - `belgeler` — document management

  2. Modified Tables
    - `musteriler` — add tags jsonb column
    - `portfoyler` — ensure ilan_url, denize_yakin, deniz_manzarasi columns exist

  3. Storage
    - `belgeler` storage bucket for file uploads

  4. Security
    - RLS disabled on all new tables (as requested)
*/

-- ─── gorevler ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS gorevler (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  baslik text NOT NULL,
  aciklama text,
  son_tarih timestamptz,
  saat text,
  oncelik text DEFAULT 'orta',
  durum text DEFAULT 'bekliyor',
  musteri_id uuid,
  portfoy_id uuid,
  atanan_user text,
  olusturan_user text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE gorevler DISABLE ROW LEVEL SECURITY;

-- ─── eslestirme_gecmisi ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS eslestirme_gecmisi (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  musteri_id uuid,
  portfoy_id uuid,
  musteri_ad text,
  portfoy_baslik text,
  gosterildi_tarihi timestamptz DEFAULT now(),
  sonuc text DEFAULT 'bekliyor',
  notlar text,
  takip_tarihi date,
  danisman text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE eslestirme_gecmisi DISABLE ROW LEVEL SECURITY;

-- ─── belgeler ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS belgeler (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  baslik text,
  tur text,
  musteri_id uuid,
  portfoy_id uuid,
  dosya_url text,
  imza_tarihi date,
  gecerlilik_tarihi date,
  notlar text,
  yuklendi_user text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE belgeler DISABLE ROW LEVEL SECURITY;

-- ─── musteriler: add tags column ───────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'musteriler' AND column_name = 'tags'
  ) THEN
    ALTER TABLE musteriler ADD COLUMN tags jsonb DEFAULT '[]';
  END IF;
END $$;

-- ─── musteriler: add last_contact column for segmentation ─────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'musteriler' AND column_name = 'last_contact'
  ) THEN
    ALTER TABLE musteriler ADD COLUMN last_contact date;
  END IF;
END $$;

-- ─── portfoyler: ensure optional columns exist ────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'portfoyler' AND column_name = 'ilan_url'
  ) THEN
    ALTER TABLE portfoyler ADD COLUMN ilan_url text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'portfoyler' AND column_name = 'denize_yakin'
  ) THEN
    ALTER TABLE portfoyler ADD COLUMN denize_yakin boolean DEFAULT false;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'portfoyler' AND column_name = 'deniz_manzarasi'
  ) THEN
    ALTER TABLE portfoyler ADD COLUMN deniz_manzarasi boolean DEFAULT false;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'musteriler' AND column_name = 'denize_yakin'
  ) THEN
    ALTER TABLE musteriler ADD COLUMN denize_yakin boolean DEFAULT false;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'musteriler' AND column_name = 'deniz_manzarasi'
  ) THEN
    ALTER TABLE musteriler ADD COLUMN deniz_manzarasi boolean DEFAULT false;
  END IF;
END $$;

-- ─── Storage bucket for belgeler ──────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('belgeler', 'belgeler', false)
ON CONFLICT (id) DO NOTHING;
