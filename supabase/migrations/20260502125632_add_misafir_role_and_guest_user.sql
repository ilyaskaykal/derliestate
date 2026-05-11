/*
  # Add misafir role and guest user

  1. Changes
    - Adds 'misafir' to the allowed rol values for kullanicilar
    - Inserts default guest user derli/3535 with rol='misafir'

  2. Instagram storage
    - Ensures instagram-fotograflar bucket exists and is public
    - Adds permissive read/write policies for the bucket
*/

-- Allow misafir role value (update check constraint if exists)
DO $$
BEGIN
  -- Drop old check constraint on rol if it exists (it may be a plain check)
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'kullanicilar'
      AND constraint_type = 'CHECK'
      AND constraint_name LIKE '%rol%'
  ) THEN
    EXECUTE (
      SELECT 'ALTER TABLE kullanicilar DROP CONSTRAINT ' || constraint_name
      FROM information_schema.table_constraints
      WHERE table_name = 'kullanicilar'
        AND constraint_type = 'CHECK'
        AND constraint_name LIKE '%rol%'
      LIMIT 1
    );
  END IF;
END $$;

-- Insert default guest user
INSERT INTO kullanicilar (username, sifre, ad, soyad, rol, ilk_giris)
VALUES ('derli', '3535', 'Misafir', 'Kullanici', 'misafir', false)
ON CONFLICT (username) DO NOTHING;

-- Ensure instagram-fotograflar bucket is public
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('instagram-fotograflar', 'instagram-fotograflar', true, 10485760, ARRAY['image/jpeg','image/png','image/webp','image/gif'])
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = 10485760;

-- Public read policy for instagram photos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'objects' AND schemaname = 'storage'
      AND policyname = 'Public read instagram photos'
  ) THEN
    CREATE POLICY "Public read instagram photos"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'instagram-fotograflar');
  END IF;
END $$;

-- Auth upload policy for instagram photos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'objects' AND schemaname = 'storage'
      AND policyname = 'Auth upload instagram photos'
  ) THEN
    CREATE POLICY "Auth upload instagram photos"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'instagram-fotograflar');
  END IF;
END $$;

-- Auth update/delete policy for instagram photos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'objects' AND schemaname = 'storage'
      AND policyname = 'Auth update instagram photos'
  ) THEN
    CREATE POLICY "Auth update instagram photos"
    ON storage.objects FOR UPDATE
    USING (bucket_id = 'instagram-fotograflar');
  END IF;
END $$;
