/*
  # Create tapu_sorgulama table

  ## Purpose
  Track property owners found via ada/parsel lookup sent to Orhan Bey.

  ## New Tables
  - `tapu_sorgulama`
    - `id` (uuid, PK)
    - `ada` (text) - land parcel number
    - `parsel` (text) - parcel sub-number
    - `isim1..4` (text) - up to 4 owner names
    - `telefon1..4` (text) - matching phone numbers
    - `istenen_tarih` (date) - when info was requested from Orhan Bey
    - `bilgi_geldi` (boolean) - did Orhan Bey send the info
    - `arandi` (boolean) - was owner called
    - `aranma_tarihi` (date) - date called
    - `durum` (text) - Olumlu/Olumsuz/Düşünüyor/Aranmadı
    - `notlar` (text)
    - `danisman` (text)
    - `eklendi_user_id` (text)
    - `created_at` (timestamptz)

  ## Security
  - RLS disabled per user request (internal team tool)
*/

CREATE TABLE IF NOT EXISTS tapu_sorgulama (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  ada text,
  parsel text,
  isim1 text,
  isim2 text,
  isim3 text,
  isim4 text,
  telefon1 text,
  telefon2 text,
  telefon3 text,
  telefon4 text,
  istenen_tarih date,
  bilgi_geldi boolean DEFAULT false,
  arandi boolean DEFAULT false,
  aranma_tarihi date,
  durum text DEFAULT 'Aranmadı',
  notlar text,
  danisman text,
  eklendi_user_id text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE tapu_sorgulama DISABLE ROW LEVEL SECURITY;
