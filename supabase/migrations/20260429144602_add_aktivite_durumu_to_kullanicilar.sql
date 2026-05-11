/*
  # Add activity status columns to kullanicilar

  1. Modified Tables
    - `kullanicilar`
      - `aktivite_durumu` (text, default 'aktif') — 'aktif' or 'surec'
      - `durum_zamani` (timestamptz, default now()) — when status last changed
*/

ALTER TABLE kullanicilar ADD COLUMN IF NOT EXISTS aktivite_durumu text DEFAULT 'aktif';
ALTER TABLE kullanicilar ADD COLUMN IF NOT EXISTS durum_zamani timestamptz DEFAULT now();
