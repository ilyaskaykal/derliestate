/*
  # Add new features: ilan_url, denize_yakin, deniz_manzarasi, instagram_ilanlar

  1. Modified Tables
    - `portfoyler`: add ilan_url (text), denize_yakin (boolean), deniz_manzarasi (boolean)
    - `musteriler`: add denize_yakin (boolean), deniz_manzarasi (boolean)

  2. New Tables
    - `instagram_ilanlar`: stores Instagram listing posts with url, title, price, region, description, added_by

  3. Security
    - instagram_ilanlar: RLS disabled (all users can read/write; admin deletes handled in app logic)
*/

-- portfoyler new columns
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'portfoyler' AND column_name = 'ilan_url') THEN
    ALTER TABLE portfoyler ADD COLUMN ilan_url text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'portfoyler' AND column_name = 'denize_yakin') THEN
    ALTER TABLE portfoyler ADD COLUMN denize_yakin boolean DEFAULT false;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'portfoyler' AND column_name = 'deniz_manzarasi') THEN
    ALTER TABLE portfoyler ADD COLUMN deniz_manzarasi boolean DEFAULT false;
  END IF;
END $$;

-- musteriler new columns
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'musteriler' AND column_name = 'denize_yakin') THEN
    ALTER TABLE musteriler ADD COLUMN denize_yakin boolean DEFAULT false;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'musteriler' AND column_name = 'deniz_manzarasi') THEN
    ALTER TABLE musteriler ADD COLUMN deniz_manzarasi boolean DEFAULT false;
  END IF;
END $$;

-- instagram_ilanlar table
CREATE TABLE IF NOT EXISTS instagram_ilanlar (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  url text NOT NULL,
  baslik text,
  fiyat text,
  bolge text,
  aciklama text,
  eklendi_user_id text,
  eklendi_user_ad text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE instagram_ilanlar DISABLE ROW LEVEL SECURITY;
