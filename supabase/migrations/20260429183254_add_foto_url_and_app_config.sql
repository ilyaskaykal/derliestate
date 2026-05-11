/*
  # Add user profile photo URL, app_config table, and storage policy

  1. Modified Tables
    - `kullanicilar`
      - `foto_url` (text, nullable) — URL to profile photo in Supabase Storage

  2. New Tables
    - `app_config`
      - `key` (text, primary key)
      - `value` (text)
      - `updated_at` (timestamptz)
      Used to share configuration (e.g. Claude API key) across all users.

  3. Storage
    - Creates bucket `kullanici-fotograflar` (public)
    - Adds permissive policy for all operations

  4. Security
    - RLS disabled on app_config
*/

ALTER TABLE kullanicilar ADD COLUMN IF NOT EXISTS foto_url text;

CREATE TABLE IF NOT EXISTS app_config (
  key text PRIMARY KEY,
  value text,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE app_config DISABLE ROW LEVEL SECURITY;

-- Storage bucket for user photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('kullanici-fotograflar', 'kullanici-fotograflar', true)
ON CONFLICT DO NOTHING;

-- Permissive policy for user photos bucket
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Public user photo access'
  ) THEN
    CREATE POLICY "Public user photo access"
      ON storage.objects
      FOR ALL
      USING (bucket_id = 'kullanici-fotograflar');
  END IF;
END $$;
