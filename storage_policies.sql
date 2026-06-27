-- Drop existing storage policies for report-images to avoid duplicates
DROP POLICY IF EXISTS "Allow public upload to report-images" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read from report-images" ON storage.objects;
DROP POLICY IF EXISTS "Allow public update of report-images" ON storage.objects;

-- Policy 1: Allow public uploads (INSERT) to the 'report-images' bucket
CREATE POLICY "Allow public upload to report-images" 
ON storage.objects FOR INSERT 
TO public 
WITH CHECK (bucket_id = 'report-images');

-- Policy 2: Allow public viewing (SELECT) of images in the 'report-images' bucket
CREATE POLICY "Allow public read from report-images" 
ON storage.objects FOR SELECT 
TO public 
USING (bucket_id = 'report-images');

-- Policy 3: Allow updates/overrides (UPDATE) for public uploads if needed
CREATE POLICY "Allow public update of report-images" 
ON storage.objects FOR UPDATE 
TO public 
USING (bucket_id = 'report-images')
WITH CHECK (bucket_id = 'report-images');
