/*
  # Add AI Features Columns and Tables

  1. New Columns on musteriler
    - `kaynak` (text): Lead source (manuel, facebook_lead, instagram_lead)
    - `son_iletisim` (timestamptz): Last contact timestamp
    - `takip_zamanlamasi` (jsonb): AI-suggested best call times
    - `musteri_ozeti` (text): AI-generated customer summary

  2. New Tables
    - `haftalik_brifing`: Stores weekly AI briefing content per user

  3. Security
    - haftalik_brifing has RLS disabled (internal use)
*/

ALTER TABLE musteriler ADD COLUMN IF NOT EXISTS kaynak text DEFAULT 'manuel';
ALTER TABLE musteriler ADD COLUMN IF NOT EXISTS son_iletisim timestamptz;
ALTER TABLE musteriler ADD COLUMN IF NOT EXISTS takip_zamanlamasi jsonb;
ALTER TABLE musteriler ADD COLUMN IF NOT EXISTS musteri_ozeti text;

CREATE TABLE IF NOT EXISTS haftalik_brifing (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  hafta_baslangic date,
  icerik text,
  kullanici text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE haftalik_brifing DISABLE ROW LEVEL SECURITY;
