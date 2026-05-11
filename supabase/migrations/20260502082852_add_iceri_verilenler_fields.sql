/*
  # Add new fields to tapu_sorgulama table

  1. Changes
    - Add il (text) - province
    - Add ilce (text) - district
    - Add mahalle (text) - neighborhood
    - Add tapu_alani (text) - land area in m²
    - Add sahibinden_url (text) - listing URL
*/

ALTER TABLE tapu_sorgulama ADD COLUMN IF NOT EXISTS il text;
ALTER TABLE tapu_sorgulama ADD COLUMN IF NOT EXISTS ilce text;
ALTER TABLE tapu_sorgulama ADD COLUMN IF NOT EXISTS mahalle text;
ALTER TABLE tapu_sorgulama ADD COLUMN IF NOT EXISTS tapu_alani text;
ALTER TABLE tapu_sorgulama ADD COLUMN IF NOT EXISTS sahibinden_url text;
