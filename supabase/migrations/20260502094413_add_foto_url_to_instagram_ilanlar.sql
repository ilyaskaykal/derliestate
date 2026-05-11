/*
  # Add foto_url to instagram_ilanlar and create storage bucket

  1. Changes
    - Add foto_url (text) column to instagram_ilanlar
  2. Storage
    - Create instagram-fotograflar public bucket
    - Add permissive policy for public access
*/

ALTER TABLE instagram_ilanlar ADD COLUMN IF NOT EXISTS foto_url text;

INSERT INTO storage.buckets (id, name, public)
VALUES ('instagram-fotograflar', 'instagram-fotograflar', true)
ON CONFLICT DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Public instagram photo access'
  ) THEN
    CREATE POLICY "Public instagram photo access"
      ON storage.objects
      FOR ALL
      USING (bucket_id = 'instagram-fotograflar');
  END IF;
END $$;
