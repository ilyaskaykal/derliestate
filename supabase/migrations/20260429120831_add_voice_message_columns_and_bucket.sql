/*
  # Add voice message support

  1. Modified Tables
    - `mesajlar`
      - `tip` (text, default 'text') — message type: 'text' or 'voice'
      - `ses_url` (text, nullable) — public URL to audio file in storage
      - `sure` (integer, nullable) — audio duration in seconds

  2. Storage
    - Create bucket `ses-mesajlari` (public)
    - Add permissive policy for all operations on that bucket
*/

ALTER TABLE mesajlar ADD COLUMN IF NOT EXISTS tip text DEFAULT 'text';
ALTER TABLE mesajlar ADD COLUMN IF NOT EXISTS ses_url text;
ALTER TABLE mesajlar ADD COLUMN IF NOT EXISTS sure integer;

INSERT INTO storage.buckets (id, name, public)
VALUES ('ses-mesajlari', 'ses-mesajlari', true)
ON CONFLICT DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'objects' AND policyname = 'Public ses access'
  ) THEN
    CREATE POLICY "Public ses access"
      ON storage.objects
      FOR ALL
      USING (bucket_id = 'ses-mesajlari');
  END IF;
END $$;
