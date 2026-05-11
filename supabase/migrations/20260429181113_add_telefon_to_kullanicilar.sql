/*
  # Add phone number field to kullanicilar

  1. Modified Tables
    - `kullanicilar`
      - `telefon` (text, nullable) — international format, e.g. +905321234567
*/

ALTER TABLE kullanicilar ADD COLUMN IF NOT EXISTS telefon text;
