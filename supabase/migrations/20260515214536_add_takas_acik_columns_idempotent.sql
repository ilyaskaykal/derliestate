/*
  # Ensure takas_acik columns exist on musteriler and portfoyler

  Idempotent migration — adds columns only if they don't already exist.

  1. Changes
    - musteriler: ADD COLUMN IF NOT EXISTS takas_acik boolean DEFAULT false
    - portfoyler:  ADD COLUMN IF NOT EXISTS takas_acik boolean DEFAULT false
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'musteriler' AND column_name = 'takas_acik'
  ) THEN
    ALTER TABLE musteriler ADD COLUMN takas_acik boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'portfoyler' AND column_name = 'takas_acik'
  ) THEN
    ALTER TABLE portfoyler ADD COLUMN takas_acik boolean DEFAULT false;
  END IF;
END $$;
