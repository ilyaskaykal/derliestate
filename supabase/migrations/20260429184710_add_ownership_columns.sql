/*
  # Add Ownership Columns to portfoyler and musteriler

  ## Summary
  Adds `eklendi_user_id` and `eklendi_user_ad` columns to both `portfoyler` and `musteriler`
  tables to track which user created each record.

  ## New Columns
  - `eklendi_user_id` (text): The username of the user who created the record
  - `eklendi_user_ad` (text): The full name (ad soyad) of the user who created the record

  ## Purpose
  - Enables per-user portfolio/customer filtering on the Portföyler page (users see only their own)
  - Enables Veri Havuzu to show "owner" and restrict edit/delete to record owner
  - Admin data hidden from non-admins in Veri Havuzu
*/

ALTER TABLE portfoyler
  ADD COLUMN IF NOT EXISTS eklendi_user_id text DEFAULT '',
  ADD COLUMN IF NOT EXISTS eklendi_user_ad text DEFAULT '';

ALTER TABLE musteriler
  ADD COLUMN IF NOT EXISTS eklendi_user_id text DEFAULT '',
  ADD COLUMN IF NOT EXISTS eklendi_user_ad text DEFAULT '';
