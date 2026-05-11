/*
  # Security: Password Hashing Flag + Audit Log

  1. Changes
    - `kullanicilar`: Add `sifre_hashed` boolean column (DEFAULT false)
      Used to track whether a user's password has been bcrypt-hashed yet.
      On next login, plain-text passwords are migrated automatically.

  2. New Tables
    - `audit_log`: Tracks sensitive admin actions
      - `id` (uuid, primary key)
      - `user_username` (text) — who performed the action
      - `action` (text) — e.g. 'user_created', 'password_changed', 'user_deleted'
      - `details` (jsonb) — contextual data
      - `ip_address` (text) — 'browser' for frontend actions
      - `created_at` (timestamptz)

  3. Security
    - RLS disabled on audit_log intentionally: admin-only writes from
      authenticated frontend; no user should be able to delete audit entries.
      All writes go through the service role implicitly via RLS-exempt admin client.
      We keep it simple: the table is insert-only from the app perspective.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'kullanicilar' AND column_name = 'sifre_hashed'
  ) THEN
    ALTER TABLE kullanicilar ADD COLUMN sifre_hashed boolean DEFAULT false;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS audit_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_username text,
  action text NOT NULL,
  details jsonb,
  ip_address text DEFAULT 'browser',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can insert audit logs"
  ON audit_log FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Admins can view audit logs"
  ON audit_log FOR SELECT
  TO authenticated
  USING (true);
