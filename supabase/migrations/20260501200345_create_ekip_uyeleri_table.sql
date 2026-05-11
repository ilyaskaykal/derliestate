/*
  # Create ekip_uyeleri table

  ## Purpose
  Allows admins to manage custom team member entries directly from the home page,
  separate from the kullanicilar (system users) table.

  ## New Tables
  - `ekip_uyeleri`
    - `id` (uuid, primary key)
    - `ad_soyad` (text, required) - Full name
    - `unvan` (text) - Title/position e.g. "Danışman", "Ön Büro Sorumlusu"
    - `foto_url` (text) - Public URL of uploaded photo
    - `aciklama` (text) - Optional short bio
    - `sira` (integer, default 0) - Sort order for display
    - `created_at` (timestamptz)

  ## Security
  - RLS is disabled (internal admin-managed table, no user-specific data)
*/

CREATE TABLE IF NOT EXISTS ekip_uyeleri (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  ad_soyad text NOT NULL,
  unvan text,
  foto_url text,
  aciklama text,
  sira integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE ekip_uyeleri DISABLE ROW LEVEL SECURITY;
