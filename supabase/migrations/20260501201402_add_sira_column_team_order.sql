/*
  # Add sira (order) column for team display ordering

  ## Changes
  - `kullanicilar`: add `sira integer DEFAULT 99` for custom team display order
  - `ekip_uyeleri`: ensure `sira` column exists (was already added, this is safe)
  - Set default sira values based on known team members

  ## Notes
  - sira=1 is displayed first (Orhan Sinan DERLİ)
  - Unknown users default to 99 and appear last
*/

ALTER TABLE kullanicilar ADD COLUMN IF NOT EXISTS sira integer DEFAULT 99;

-- Set default order for known team members
UPDATE kullanicilar SET sira = 1 WHERE username = 'orhan' OR (ad = 'Orhan' AND soyad ILIKE '%derli%');
UPDATE kullanicilar SET sira = 2 WHERE username = 'i.kaykal' OR (ad = 'İlyas' AND soyad ILIKE '%kaykal%') OR ad = 'İlyas';
UPDATE kullanicilar SET sira = 3 WHERE username ILIKE '%mustafa%' OR (ad = 'Mustafa' AND username NOT ILIKE '%admin%');
UPDATE kullanicilar SET sira = 4 WHERE username ILIKE '%kaan%' OR ad = 'Kaan';
UPDATE kullanicilar SET sira = 5 WHERE username ILIKE '%bartu%' OR ad = 'Bartu';
UPDATE kullanicilar SET sira = 6 WHERE username ILIKE '%damla%' OR ad = 'Damla';
UPDATE kullanicilar SET sira = 7 WHERE username ILIKE '%nusret%' OR ad = 'Nusret';
