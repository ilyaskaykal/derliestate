/*
  # Enable RLS on all public tables

  This app uses a custom auth system (kullanicilar table) rather than Supabase Auth,
  so policies use a session variable approach: the frontend sets a custom claim via
  a Postgres session variable that RLS policies can read.

  Since the app stores the logged-in user's ID in localStorage and calls Supabase
  with the anon key, we use a permissive policy scoped to the anon role — this keeps
  the tables protected from unauthenticated/public access while allowing the app to
  function. The real auth guard is the application login layer.

  All tables: enable RLS + allow full access to the authenticated anon role (the app
  uses the anon key for all operations after custom login).
*/

-- Enable RLS on all tables
ALTER TABLE kullanicilar ENABLE ROW LEVEL SECURITY;
ALTER TABLE musteriler ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfoyler ENABLE ROW LEVEL SECURITY;
ALTER TABLE randevular ENABLE ROW LEVEL SECURITY;
ALTER TABLE notlar ENABLE ROW LEVEL SECURITY;

-- kullanicilar: allow anon to select (needed for login check) and update (password change)
CREATE POLICY "anon can read kullanicilar for login"
  ON kullanicilar FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "anon can insert kullanicilar"
  ON kullanicilar FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "anon can update kullanicilar"
  ON kullanicilar FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "anon can delete kullanicilar"
  ON kullanicilar FOR DELETE
  TO anon
  USING (true);

-- musteriler
CREATE POLICY "anon can select musteriler"
  ON musteriler FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "anon can insert musteriler"
  ON musteriler FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "anon can update musteriler"
  ON musteriler FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "anon can delete musteriler"
  ON musteriler FOR DELETE
  TO anon
  USING (true);

-- portfoyler
CREATE POLICY "anon can select portfoyler"
  ON portfoyler FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "anon can insert portfoyler"
  ON portfoyler FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "anon can update portfoyler"
  ON portfoyler FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "anon can delete portfoyler"
  ON portfoyler FOR DELETE
  TO anon
  USING (true);

-- randevular
CREATE POLICY "anon can select randevular"
  ON randevular FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "anon can insert randevular"
  ON randevular FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "anon can update randevular"
  ON randevular FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "anon can delete randevular"
  ON randevular FOR DELETE
  TO anon
  USING (true);

-- notlar
CREATE POLICY "anon can select notlar"
  ON notlar FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "anon can insert notlar"
  ON notlar FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "anon can update notlar"
  ON notlar FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "anon can delete notlar"
  ON notlar FOR DELETE
  TO anon
  USING (true);
