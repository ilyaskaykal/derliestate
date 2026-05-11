/*
  # Müşteri Linkleri ve Reaksiyonlar

  1. New Tables
    - `musteri_linkler`
      - `id` (uuid, primary key)
      - `token` (text, unique) - shareable link token
      - `musteri_id` (uuid) - customer reference
      - `musteri_ad` (text) - customer name for display
      - `portfoy_ids` (jsonb) - array of selected portfolio IDs
      - `danisman_username` (text)
      - `danisman_ad` (text)
      - `expires_at` (timestamptz) - 30-day expiry
      - `created_at` (timestamptz)

    - `musteri_reaksiyonlar`
      - `id` (uuid, primary key)
      - `link_id` (uuid) - references musteri_linkler
      - `portfoy_id` (uuid)
      - `reaksiyon` (text) - 'begendim' | 'ilgilenmiyorum'
      - `yorum` (text) - optional comment
      - `created_at` (timestamptz)

  2. Security
    - RLS disabled per spec (public access needed for customer-facing pages)
*/

CREATE TABLE IF NOT EXISTS musteri_linkler (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  token text UNIQUE NOT NULL,
  musteri_id uuid,
  musteri_ad text,
  portfoy_ids jsonb DEFAULT '[]',
  danisman_username text,
  danisman_ad text,
  expires_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE musteri_linkler DISABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS musteri_reaksiyonlar (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  link_id uuid REFERENCES musteri_linkler(id) ON DELETE CASCADE,
  portfoy_id uuid,
  reaksiyon text,
  yorum text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE musteri_reaksiyonlar DISABLE ROW LEVEL SECURITY;
