/*
  # VeriHavuzu, Chat, and Extended Customer/Portfolio Features

  ## Summary
  This migration adds all the new tables and columns required for:
  1. Extended customer profile fields (budget range, flexible region, requirements, description, advisor)
  2. Extended portfolio fields (cover photo, region/bolge)
  3. Price & description change history tracking
  4. Office chat messages with mention support

  ## New Tables
  - `mesajlar` - Office-wide chat messages with mention metadata
  - `degisiklik_gecmisi` - Audit log of price and description changes for portfolios

  ## Modified Tables
  - `musteriler` - Added: butce_min, butce_max, bolge_esnek, olmaz_olmaz, kesin_istekler, aciklama, danisman
  - `portfoyler` - Added: kapak_foto, bolge, danisman

  ## Security
  - mesajlar: RLS disabled (office internal, all users can read/write)
  - degisiklik_gecmisi: RLS disabled (audit log, all users can read/write)
  - New columns on existing tables inherit their table's existing RLS policies
*/

-- Chat messages table
CREATE TABLE IF NOT EXISTS mesajlar (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  kullanici_id text,
  kullanici_adi text,
  mesaj text,
  mentionler jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE mesajlar DISABLE ROW LEVEL SECURITY;

-- Change history table for price/description tracking
CREATE TABLE IF NOT EXISTS degisiklik_gecmisi (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  kayit_id uuid,
  kayit_turu text,
  alan text,
  eski_deger text,
  yeni_deger text,
  degistiren text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE degisiklik_gecmisi DISABLE ROW LEVEL SECURITY;

-- Extended customer fields
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'musteriler' AND column_name = 'butce_min') THEN
    ALTER TABLE musteriler ADD COLUMN butce_min text DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'musteriler' AND column_name = 'butce_max') THEN
    ALTER TABLE musteriler ADD COLUMN butce_max text DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'musteriler' AND column_name = 'bolge_esnek') THEN
    ALTER TABLE musteriler ADD COLUMN bolge_esnek boolean DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'musteriler' AND column_name = 'olmaz_olmaz') THEN
    ALTER TABLE musteriler ADD COLUMN olmaz_olmaz text DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'musteriler' AND column_name = 'kesin_istekler') THEN
    ALTER TABLE musteriler ADD COLUMN kesin_istekler text DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'musteriler' AND column_name = 'aciklama') THEN
    ALTER TABLE musteriler ADD COLUMN aciklama text DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'musteriler' AND column_name = 'danisman') THEN
    ALTER TABLE musteriler ADD COLUMN danisman text DEFAULT '';
  END IF;
END $$;

-- Extended portfolio fields
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'portfoyler' AND column_name = 'kapak_foto') THEN
    ALTER TABLE portfoyler ADD COLUMN kapak_foto text DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'portfoyler' AND column_name = 'bolge') THEN
    ALTER TABLE portfoyler ADD COLUMN bolge text DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'portfoyler' AND column_name = 'danisman') THEN
    ALTER TABLE portfoyler ADD COLUMN danisman text DEFAULT '';
  END IF;
END $$;

-- Index for chat ordering
CREATE INDEX IF NOT EXISTS mesajlar_created_at_idx ON mesajlar (created_at ASC);

-- Index for change history lookup
CREATE INDEX IF NOT EXISTS degisiklik_kayit_id_idx ON degisiklik_gecmisi (kayit_id, alan);
