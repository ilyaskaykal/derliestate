/*
  # Add takas_acik column to musteriler and portfoyler

  Adds a boolean "open to swap/exchange" flag on both tables.
  Default false — no data is changed.
*/

ALTER TABLE musteriler ADD COLUMN IF NOT EXISTS takas_acik boolean DEFAULT false;
ALTER TABLE portfoyler  ADD COLUMN IF NOT EXISTS takas_acik boolean DEFAULT false;
