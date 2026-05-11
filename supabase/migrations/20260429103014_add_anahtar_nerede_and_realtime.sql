/*
  # Add anahtar_nerede column and enable Realtime on mesajlar

  1. Modified Tables
    - `portfoyler`: add `anahtar_nerede` text column (default empty string)
  2. Realtime
    - Enable REPLICA IDENTITY FULL on mesajlar for realtime change tracking
    - Add mesajlar to supabase_realtime publication
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'portfoyler' AND column_name = 'anahtar_nerede'
  ) THEN
    ALTER TABLE portfoyler ADD COLUMN anahtar_nerede text DEFAULT '';
  END IF;
END $$;

ALTER TABLE mesajlar REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE mesajlar;
