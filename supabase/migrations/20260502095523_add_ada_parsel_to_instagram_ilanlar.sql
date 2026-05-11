/*
  # Add ada/parsel fields to instagram_ilanlar

  These fields allow Instagram listings to be referenced via @ mentions in chat,
  using the same ada/parsel system as portfolios.

  1. Changes
    - Add ada (text) column
    - Add parsel (text) column
*/

ALTER TABLE instagram_ilanlar ADD COLUMN IF NOT EXISTS ada text;
ALTER TABLE instagram_ilanlar ADD COLUMN IF NOT EXISTS parsel text;
