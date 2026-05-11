/*
  # Storage policies for portfoy-fotograflar bucket

  1. Allow authenticated users to upload images
  2. Allow public read access to images
*/

CREATE POLICY "Allow authenticated uploads"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'portfoy-fotograflar');

CREATE POLICY "Allow public reads"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'portfoy-fotograflar');

CREATE POLICY "Allow authenticated updates"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'portfoy-fotograflar');
