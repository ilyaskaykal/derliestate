/*
  # Add EİDS date and taşınmaz no columns to portfoyler

  Ensures the three columns used by the new EİDS quick-edit section exist.

  1. Columns added (if not already present)
     - eids_tasinmaz_no (text) – property number received from the owner
     - eids_yetki_baslangic (date) – authorization start date
     - eids_yetki_bitis (date) – authorization end date
*/

ALTER TABLE portfoyler ADD COLUMN IF NOT EXISTS eids_tasinmaz_no text;
ALTER TABLE portfoyler ADD COLUMN IF NOT EXISTS eids_yetki_baslangic date;
ALTER TABLE portfoyler ADD COLUMN IF NOT EXISTS eids_yetki_bitis date;
