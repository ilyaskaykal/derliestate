/*
  # DerliEstate Pro — Core Tables Migration

  1. New Tables
    - `kullanicilar` — CRM users with roles, bcrypt password hash, first-login flag
    - `musteriler` — customers with budget, status, tier, EİDS link
    - `portfoyler` — property portfolios with full details, EIDS, owner info
    - `randevular` — appointments
    - `gorevler` — tasks with priority and status
    - `mesajlar` — team messaging channels
    - `belgeler` — file/document storage metadata
    - `eslestirme_gecmisi` — customer-portfolio match history
    - `instagram_ilanlar` — AI-generated Instagram listings
    - `tapu_sorgulama` — land registry query log
    - `app_config` — key-value config store (e.g., Claude API key)
    - `audit_log` — security audit trail

  2. Security
    - RLS enabled on all tables
    - Staff can read/write their own data; admins have wider access
    - kullanicilar: read access for authenticated users, update own row only
*/

-- ── kullanicilar ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS kullanicilar (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text UNIQUE NOT NULL,
  sifre text NOT NULL DEFAULT '',
  ad text NOT NULL DEFAULT '',
  soyad text NOT NULL DEFAULT '',
  rol text NOT NULL DEFAULT 'danisan',
  telefon text DEFAULT '',
  foto_url text DEFAULT '',
  ilk_giris boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE kullanicilar ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read staff"
  ON kullanicilar FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update own profile"
  ON kullanicilar FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can insert users"
  ON kullanicilar FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM kullanicilar k WHERE k.id = auth.uid() AND k.rol IN ('superadmin','admin','yonetici')
    )
  );

CREATE POLICY "Admins can delete users"
  ON kullanicilar FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM kullanicilar k WHERE k.id = auth.uid() AND k.rol IN ('superadmin','admin')
    )
  );

-- Allow anon to read kullanicilar for login (username/password auth)
CREATE POLICY "Anon can read for login"
  ON kullanicilar FOR SELECT
  TO anon
  USING (true);

-- ── musteriler ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS musteriler (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ad text NOT NULL DEFAULT '',
  soyad text NOT NULL DEFAULT '',
  telefon text DEFAULT '',
  email text DEFAULT '',
  durum text NOT NULL DEFAULT 'yeni',
  butce_min text DEFAULT '',
  butce_max text DEFAULT '',
  para_birimi text DEFAULT 'TL',
  muhit text DEFAULT '',
  portfoy_tercihi text[] DEFAULT '{}',
  notlar text DEFAULT '',
  danismanid uuid REFERENCES kullanicilar(id) ON DELETE SET NULL,
  foto_url text DEFAULT '',
  eids_status text DEFAULT 'yok',
  kaynak text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE musteriler ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view all customers"
  ON musteriler FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Staff can insert customers"
  ON musteriler FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Staff can update customers"
  ON musteriler FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can delete customers"
  ON musteriler FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM kullanicilar k WHERE k.id = auth.uid() AND k.rol IN ('superadmin','admin','yonetici')
    )
  );

-- ── portfoyler ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS portfoyler (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  isim text NOT NULL DEFAULT '',
  portfoy_kodu text DEFAULT '',
  bolge text DEFAULT '',
  mahalle text DEFAULT '',
  ilce text DEFAULT '',
  il text DEFAULT 'İzmir',
  tip text DEFAULT 'daire',
  fiyat text DEFAULT '',
  para_birimi text DEFAULT 'TL',
  oda text DEFAULT '',
  metrekare text DEFAULT '',
  kat text DEFAULT '',
  toplam_kat text DEFAULT '',
  bina_yasi text DEFAULT '',
  isitma text DEFAULT '',
  banyo text DEFAULT '',
  portfoy_durum text DEFAULT 'aktif',
  aciklama text DEFAULT '',
  ozellikler text[] DEFAULT '{}',
  denize_yakin boolean DEFAULT false,
  deniz_manzarasi boolean DEFAULT false,
  havuz boolean DEFAULT false,
  bahce boolean DEFAULT false,
  garaj boolean DEFAULT false,
  asansor boolean DEFAULT false,
  guvenlik boolean DEFAULT false,
  ebeveyn_banyosu boolean DEFAULT false,
  foto_url text[] DEFAULT '{}',
  tapu_durumu text DEFAULT '',
  ada text DEFAULT '',
  parsel text DEFAULT '',
  pafta text DEFAULT '',
  eids_status text DEFAULT 'yok',
  eids_son_tarih text DEFAULT '',
  sahibi_ad text DEFAULT '',
  sahibi_telefon text DEFAULT '',
  sahibi_tc text DEFAULT '',
  komisyon_orani text DEFAULT '',
  danismanid uuid REFERENCES kullanicilar(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE portfoyler ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view all portfolios"
  ON portfoyler FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Staff can insert portfolios"
  ON portfoyler FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Staff can update portfolios"
  ON portfoyler FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can delete portfolios"
  ON portfoyler FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM kullanicilar k WHERE k.id = auth.uid() AND k.rol IN ('superadmin','admin','yonetici')
    )
  );

-- ── randevular ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS randevular (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  konu text NOT NULL DEFAULT '',
  tarih text NOT NULL DEFAULT '',
  saat text NOT NULL DEFAULT '',
  musteri_adi text DEFAULT '',
  musteri_telefon text DEFAULT '',
  konum text DEFAULT '',
  notlar text DEFAULT '',
  durum text DEFAULT 'bekliyor',
  tur text DEFAULT 'portfoy_gosterimi',
  portfoy_id uuid REFERENCES portfoyler(id) ON DELETE SET NULL,
  musteri_id uuid REFERENCES musteriler(id) ON DELETE SET NULL,
  danismanid uuid REFERENCES kullanicilar(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE randevular ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view appointments"
  ON randevular FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Staff can insert appointments"
  ON randevular FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Staff can update appointments"
  ON randevular FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can delete appointments"
  ON randevular FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM kullanicilar k WHERE k.id = auth.uid() AND k.rol IN ('superadmin','admin','yonetici')
    )
  );

-- ── gorevler ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS gorevler (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  baslik text NOT NULL DEFAULT '',
  aciklama text DEFAULT '',
  oncelik text DEFAULT 'orta',
  durum text DEFAULT 'bekliyor',
  son_tarih text DEFAULT '',
  atanan_id uuid REFERENCES kullanicilar(id) ON DELETE SET NULL,
  olusturan_id uuid REFERENCES kullanicilar(id) ON DELETE SET NULL,
  musteri_id uuid REFERENCES musteriler(id) ON DELETE SET NULL,
  portfoy_id uuid REFERENCES portfoyler(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE gorevler ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view tasks"
  ON gorevler FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Staff can insert tasks"
  ON gorevler FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Staff can update tasks"
  ON gorevler FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can delete tasks"
  ON gorevler FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM kullanicilar k WHERE k.id = auth.uid() AND k.rol IN ('superadmin','admin','yonetici')
    )
  );

-- ── mesajlar ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS mesajlar (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kanal text NOT NULL DEFAULT 'genel',
  icerik text NOT NULL DEFAULT '',
  gonderen_id uuid REFERENCES kullanicilar(id) ON DELETE SET NULL,
  gonderen_ad text DEFAULT '',
  gonderen_foto text DEFAULT '',
  mentionlar uuid[] DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE mesajlar ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view messages"
  ON mesajlar FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Staff can insert messages"
  ON mesajlar FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- ── belgeler ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS belgeler (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  isim text NOT NULL DEFAULT '',
  dosya_url text DEFAULT '',
  dosya_tipi text DEFAULT '',
  boyut bigint DEFAULT 0,
  kategori text DEFAULT 'diger',
  aciklama text DEFAULT '',
  musteri_id uuid REFERENCES musteriler(id) ON DELETE SET NULL,
  portfoy_id uuid REFERENCES portfoyler(id) ON DELETE SET NULL,
  yukleyen_id uuid REFERENCES kullanicilar(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE belgeler ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view documents"
  ON belgeler FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Staff can insert documents"
  ON belgeler FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can delete own documents"
  ON belgeler FOR DELETE
  TO authenticated
  USING (yukleyen_id = auth.uid() OR EXISTS (
    SELECT 1 FROM kullanicilar k WHERE k.id = auth.uid() AND k.rol IN ('superadmin','admin','yonetici')
  ));

-- ── eslestirme_gecmisi ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS eslestirme_gecmisi (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  musteri_id uuid REFERENCES musteriler(id) ON DELETE CASCADE,
  portfoy_id uuid REFERENCES portfoyler(id) ON DELETE CASCADE,
  sonuc text DEFAULT 'bekliyor',
  notlar text DEFAULT '',
  gosterim_tarihi text DEFAULT '',
  danismanid uuid REFERENCES kullanicilar(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE eslestirme_gecmisi ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view match history"
  ON eslestirme_gecmisi FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Staff can insert match history"
  ON eslestirme_gecmisi FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Staff can update match history"
  ON eslestirme_gecmisi FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Staff can delete match history"
  ON eslestirme_gecmisi FOR DELETE
  TO authenticated
  USING (true);

-- ── instagram_ilanlar ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS instagram_ilanlar (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portfoy_id uuid REFERENCES portfoyler(id) ON DELETE SET NULL,
  baslik text DEFAULT '',
  aciklama text DEFAULT '',
  hashtagler text DEFAULT '',
  foto_url text DEFAULT '',
  olusturan_id uuid REFERENCES kullanicilar(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE instagram_ilanlar ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view instagram posts"
  ON instagram_ilanlar FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Staff can insert instagram posts"
  ON instagram_ilanlar FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can delete own instagram posts"
  ON instagram_ilanlar FOR DELETE
  TO authenticated
  USING (olusturan_id = auth.uid() OR EXISTS (
    SELECT 1 FROM kullanicilar k WHERE k.id = auth.uid() AND k.rol IN ('superadmin','admin','yonetici')
  ));

-- ── tapu_sorgulama ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tapu_sorgulama (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ada text DEFAULT '',
  parsel text DEFAULT '',
  pafta text DEFAULT '',
  il text DEFAULT '',
  ilce text DEFAULT '',
  mahalle text DEFAULT '',
  nitelik text DEFAULT '',
  yuzolcumu text DEFAULT '',
  malik text DEFAULT '',
  hisse text DEFAULT '',
  tapu_tarihi text DEFAULT '',
  tapu_no text DEFAULT '',
  durum text DEFAULT 'sorgulandı',
  notlar text DEFAULT '',
  sorgulayanid uuid REFERENCES kullanicilar(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE tapu_sorgulama ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own queries"
  ON tapu_sorgulama FOR SELECT
  TO authenticated
  USING (sorgulayanid = auth.uid() OR EXISTS (
    SELECT 1 FROM kullanicilar k WHERE k.id = auth.uid() AND k.rol IN ('superadmin','admin','yonetici')
  ));

CREATE POLICY "Users can insert queries"
  ON tapu_sorgulama FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- ── app_config ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS app_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage config"
  ON app_config FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM kullanicilar k WHERE k.id = auth.uid() AND k.rol IN ('superadmin','admin')
    )
  );

CREATE POLICY "Admins can insert config"
  ON app_config FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM kullanicilar k WHERE k.id = auth.uid() AND k.rol IN ('superadmin','admin')
    )
  );

CREATE POLICY "Admins can update config"
  ON app_config FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM kullanicilar k WHERE k.id = auth.uid() AND k.rol IN ('superadmin','admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM kullanicilar k WHERE k.id = auth.uid() AND k.rol IN ('superadmin','admin')
    )
  );

-- ── audit_log ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kullanici_id uuid REFERENCES kullanicilar(id) ON DELETE SET NULL,
  aksiyon text NOT NULL DEFAULT '',
  detay jsonb DEFAULT '{}',
  ip_adresi text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view audit log"
  ON audit_log FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM kullanicilar k WHERE k.id = auth.uid() AND k.rol IN ('superadmin','admin')
    )
  );

CREATE POLICY "Authenticated can insert audit log"
  ON audit_log FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Anon can insert audit log"
  ON audit_log FOR INSERT
  TO anon
  WITH CHECK (true);

-- ── Indexes for performance ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_musteriler_danismanid ON musteriler(danismanid);
CREATE INDEX IF NOT EXISTS idx_musteriler_durum ON musteriler(durum);
CREATE INDEX IF NOT EXISTS idx_musteriler_created_at ON musteriler(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_portfoyler_danismanid ON portfoyler(danismanid);
CREATE INDEX IF NOT EXISTS idx_portfoyler_portfoy_durum ON portfoyler(portfoy_durum);
CREATE INDEX IF NOT EXISTS idx_portfoyler_bolge ON portfoyler(bolge);
CREATE INDEX IF NOT EXISTS idx_randevular_tarih ON randevular(tarih);
CREATE INDEX IF NOT EXISTS idx_randevular_danismanid ON randevular(danismanid);
CREATE INDEX IF NOT EXISTS idx_gorevler_durum ON gorevler(durum);
CREATE INDEX IF NOT EXISTS idx_gorevler_atanan_id ON gorevler(atanan_id);
CREATE INDEX IF NOT EXISTS idx_mesajlar_kanal ON mesajlar(kanal);
CREATE INDEX IF NOT EXISTS idx_mesajlar_created_at ON mesajlar(created_at DESC);
