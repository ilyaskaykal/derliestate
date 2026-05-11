/*
  # Add foreign customer fields and feature columns

  1. Changes to musteriler table
    - `yabanci_musteri` (boolean) - whether customer is a foreign national
    - `uyruk` (text) - nationality/citizenship
    - `pasaport_no` (text) - passport number
    - `dil_tercihi` (text) - preferred communication language
    - `turkiye_kalis_suresi` (text) - duration of stay in Turkey
    - `vatandaslik_durumu` (text) - citizenship application status
    - `kisilik_analizi` (jsonb) - AI personality analysis results
    - `microsite_token` (text) - unique token for customer micro-site
    - `microsite_aktif` (boolean) - whether micro-site is active

  2. New table: gorusme_kayitlari
    - Stores call recording summaries and transcripts per customer

  3. New table: microsite_reactions
    - Stores reactions from visitors on customer micro-sites
*/

-- Foreign customer fields on musteriler
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='musteriler' AND column_name='yabanci_musteri') THEN
    ALTER TABLE musteriler ADD COLUMN yabanci_musteri boolean DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='musteriler' AND column_name='uyruk') THEN
    ALTER TABLE musteriler ADD COLUMN uyruk text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='musteriler' AND column_name='pasaport_no') THEN
    ALTER TABLE musteriler ADD COLUMN pasaport_no text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='musteriler' AND column_name='dil_tercihi') THEN
    ALTER TABLE musteriler ADD COLUMN dil_tercihi text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='musteriler' AND column_name='turkiye_kalis_suresi') THEN
    ALTER TABLE musteriler ADD COLUMN turkiye_kalis_suresi text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='musteriler' AND column_name='vatandaslik_durumu') THEN
    ALTER TABLE musteriler ADD COLUMN vatandaslik_durumu text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='musteriler' AND column_name='kisilik_analizi') THEN
    ALTER TABLE musteriler ADD COLUMN kisilik_analizi jsonb;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='musteriler' AND column_name='microsite_token') THEN
    ALTER TABLE musteriler ADD COLUMN microsite_token text UNIQUE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='musteriler' AND column_name='microsite_aktif') THEN
    ALTER TABLE musteriler ADD COLUMN microsite_aktif boolean DEFAULT false;
  END IF;
END $$;

-- Call records table
CREATE TABLE IF NOT EXISTS gorusme_kayitlari (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  musteri_id uuid REFERENCES musteriler(id) ON DELETE CASCADE,
  ses_url text,
  transkript text,
  ozet text,
  analiz jsonb,
  danisman text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE gorusme_kayitlari ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view call records"
  ON gorusme_kayitlari FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Staff can insert call records"
  ON gorusme_kayitlari FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Staff can update call records"
  ON gorusme_kayitlari FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Staff can delete call records"
  ON gorusme_kayitlari FOR DELETE
  TO authenticated
  USING (true);

-- Micro-site reactions table
CREATE TABLE IF NOT EXISTS microsite_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  musteri_id uuid REFERENCES musteriler(id) ON DELETE CASCADE,
  token text NOT NULL,
  reaction text NOT NULL,
  visitor_name text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE microsite_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can insert reactions"
  ON microsite_reactions FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Authenticated can view reactions"
  ON microsite_reactions FOR SELECT
  TO authenticated
  USING (true);
