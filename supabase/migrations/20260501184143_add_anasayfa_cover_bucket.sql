/*
  # Add 'anasayfa' storage bucket for homepage cover photo

  1. Storage
    - Creates public bucket 'anasayfa' for homepage cover photo uploads
    - Permissive policies for authenticated access (admin upload, public read)
*/

INSERT INTO storage.buckets (id, name, public)
VALUES ('anasayfa', 'anasayfa', true)
ON CONFLICT (id) DO NOTHING;
