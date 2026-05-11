/*
  # Add fotograflar column to portfoyler

  1. Changes
    - Add fotograflar (jsonb) column with default empty array
    - Stores array of { url: string, sira: number } objects
*/

ALTER TABLE portfoyler ADD COLUMN IF NOT EXISTS fotograflar jsonb DEFAULT '[]';
