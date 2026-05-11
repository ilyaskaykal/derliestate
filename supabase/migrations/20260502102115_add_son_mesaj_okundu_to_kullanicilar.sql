/*
  # Add son_mesaj_okundu to kullanicilar

  Tracks when each user last read the group chat, so we can compute
  unread message counts across sessions and devices.

  1. Changes
    - `kullanicilar.son_mesaj_okundu` (timestamptz, default now()) — timestamp of the
      user's last chat read. Any message with created_at > this value counts as unread.

  2. Notes
    - Default is now() so existing users don't get a flood of "unread" on first load.
    - No RLS change needed; kullanicilar RLS already allows authenticated reads.
*/

ALTER TABLE kullanicilar
  ADD COLUMN IF NOT EXISTS son_mesaj_okundu timestamptz DEFAULT now();
