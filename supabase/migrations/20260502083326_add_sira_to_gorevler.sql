/*
  # Add sira column to gorevler for drag-and-drop ordering

  1. Changes
    - Add sira (integer) column with default 0
*/

ALTER TABLE gorevler ADD COLUMN IF NOT EXISTS sira integer DEFAULT 0;
