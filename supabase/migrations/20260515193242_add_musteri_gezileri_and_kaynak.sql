/*
  # Add musteri_gezileri table and kaynak columns

  1. New Tables
    - `musteri_gezileri` — tracks which portfolios were shown to each customer
      - `id` (uuid, pk)
      - `musteri_id` (uuid, fk → musteriler)
      - `portfoy_id` (uuid, fk → portfoyler)
      - `musteri_ad` (text)
      - `portfoy_ad` (text)
      - `gezi_tarihi` (timestamptz)
      - `musteri_dusuncesi` (text)
      - `sonuc` (text, default 'bekliyor')
      - `danisman` (text)
      - `created_at` (timestamptz)

  2. Modified Tables
    - `musteriler` — add `kaynak` column (text, default 'manuel')
    - `musteriler` — add `takas_acik` column (boolean, default false) if not exists
    - `portfoyler` — add `takas_acik` column (boolean, default false) if not exists

  3. Security
    - RLS disabled on musteri_gezileri per spec
*/

CREATE TABLE IF NOT EXISTS musteri_gezileri (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  musteri_id uuid REFERENCES musteriler(id) ON DELETE CASCADE,
  portfoy_id uuid REFERENCES portfoyler(id) ON DELETE SET NULL,
  musteri_ad text,
  portfoy_ad text,
  gezi_tarihi timestamptz DEFAULT now(),
  musteri_dusuncesi text,
  sonuc text DEFAULT 'bekliyor',
  danisman text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE musteri_gezileri DISABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'musteriler' AND column_name = 'kaynak'
  ) THEN
    ALTER TABLE musteriler ADD COLUMN kaynak text DEFAULT 'manuel';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'musteriler' AND column_name = 'takas_acik'
  ) THEN
    ALTER TABLE musteriler ADD COLUMN takas_acik boolean DEFAULT false;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'portfoyler' AND column_name = 'takas_acik'
  ) THEN
    ALTER TABLE portfoyler ADD COLUMN takas_acik boolean DEFAULT false;
  END IF;
END $$;
