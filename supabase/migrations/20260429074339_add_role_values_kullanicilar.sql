/*
  # Expand user roles in kullanicilar table

  ## Changes
  - Sets a DEFAULT of 'danisман' for the rol column so new inserts without a rol value still work
  - Updates the existing 'user' role value to 'danisan' so old rows map to the new system
  - No data is lost; existing 'admin' rows are unchanged

  ## New role values
  - admin        : full system access (original)
  - yonetici     : manager — full admin powers, can add/delete users, view all screens
  - kıdemli_danisan : senior advisor — own customers/portfolios only
  - danisan      : advisor — own customers/portfolios only
*/

-- Migrate existing 'user' rows to 'danisan'
UPDATE kullanicilar SET rol = 'danisan' WHERE rol = 'user';

-- Set a sensible default for future inserts
ALTER TABLE kullanicilar ALTER COLUMN rol SET DEFAULT 'danisan';
