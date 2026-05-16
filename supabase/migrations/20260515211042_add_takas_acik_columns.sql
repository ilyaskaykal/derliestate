/*
  # Ensure takas_acik columns exist

  Adds takas_acik boolean column to musteriler and portfoyler tables
  if they don't already exist. Both default to false.
*/

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
