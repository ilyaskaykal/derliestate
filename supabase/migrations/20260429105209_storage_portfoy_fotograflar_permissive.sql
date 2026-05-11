/*
  # Make portfoy-fotograflar storage fully public

  Drops the restrictive per-operation policies and replaces them with
  a single permissive ALL policy so any user (authenticated or anon)
  can upload and read photos. The bucket itself is also set to public.
*/

DROP POLICY IF EXISTS "Allow authenticated uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated updates" ON storage.objects;
DROP POLICY IF EXISTS "Allow public reads" ON storage.objects;

CREATE POLICY "portfoy-fotograflar public access"
  ON storage.objects
  FOR ALL
  TO public
  USING (bucket_id = 'portfoy-fotograflar')
  WITH CHECK (bucket_id = 'portfoy-fotograflar');
