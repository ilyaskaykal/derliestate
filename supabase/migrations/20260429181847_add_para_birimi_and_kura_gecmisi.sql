/*
  # Add currency fields and lottery draw history table

  1. Modified Tables
    - `portfoyler`
      - `para_birimi` (text, default 'TL') — currency for price field
    - `musteriler`
      - `para_birimi` (text, default 'TL') — currency for budget fields

  2. New Tables
    - `kura_gecmisi`
      - `id` (uuid, primary key)
      - `aciklama` (text) — description of the draw
      - `portfoy_id` (uuid, nullable) — associated portfolio
      - `kazanan_username` (text) — winner username
      - `kazanan_ad` (text) — winner full name
      - `katilanlar` (jsonb) — array of participants
      - `cekilis_tarihi` (timestamptz) — draw timestamp

  3. Security
    - RLS disabled on kura_gecmisi (per project convention)
*/

ALTER TABLE portfoyler ADD COLUMN IF NOT EXISTS para_birimi text DEFAULT 'TL';
ALTER TABLE musteriler ADD COLUMN IF NOT EXISTS para_birimi text DEFAULT 'TL';

CREATE TABLE IF NOT EXISTS kura_gecmisi (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  aciklama text,
  portfoy_id uuid,
  kazanan_username text,
  kazanan_ad text,
  katilanlar jsonb,
  cekilis_tarihi timestamptz DEFAULT now()
);

ALTER TABLE kura_gecmisi DISABLE ROW LEVEL SECURITY;
