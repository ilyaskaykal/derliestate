/*
  # Add AI Customer Columns

  1. New Columns on musteriler
    - `lead_skoru` (integer) — AI-calculated lead score 0-100
    - `musteri_ozeti` (text) — AI-generated customer summary
    - `takip_zamanlamasi` (jsonb) — AI call time recommendation object

  2. Notes
    - All columns are optional with safe defaults
    - No data migration needed
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'musteriler' AND column_name = 'lead_skoru'
  ) THEN
    ALTER TABLE musteriler ADD COLUMN lead_skoru integer DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'musteriler' AND column_name = 'musteri_ozeti'
  ) THEN
    ALTER TABLE musteriler ADD COLUMN musteri_ozeti text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'musteriler' AND column_name = 'takip_zamanlamasi'
  ) THEN
    ALTER TABLE musteriler ADD COLUMN takip_zamanlamasi jsonb;
  END IF;
END $$;
