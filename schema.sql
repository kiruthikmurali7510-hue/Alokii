-- Create the reports table
CREATE TABLE IF NOT EXISTS public.reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    reporter_name TEXT NOT NULL,
    reporter_phone TEXT NOT NULL,
    image_url TEXT NOT NULL,
    description TEXT,
    latitude NUMERIC NOT NULL,
    longitude NUMERIC NOT NULL,
    location_name TEXT,
    issue_type TEXT NOT NULL, -- 'Pothole', 'Garbage Overflow', 'Streetlight Issue'
    status TEXT NOT NULL DEFAULT 'Pending', -- 'Pending', 'Resolved', 'Requires Review'
    ai_label TEXT,
    ai_confidence NUMERIC,
    priority_level TEXT NOT NULL DEFAULT 'Medium', -- 'Low', 'Medium', 'High'
    priority_score NUMERIC NOT NULL DEFAULT 0,
    repeated_count INTEGER NOT NULL DEFAULT 1,
    unresolved_days INTEGER NOT NULL DEFAULT 0,
    is_neglected BOOLEAN NOT NULL DEFAULT false,
    admin_notes TEXT,
    resolved_at TIMESTAMPTZ
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Allow anonymous insert" ON public.reports;
DROP POLICY IF EXISTS "Allow anonymous select" ON public.reports;
DROP POLICY IF EXISTS "Allow anonymous update" ON public.reports;

-- Create policies for public access (Phased growth ready)
CREATE POLICY "Allow anonymous insert" ON public.reports 
    FOR INSERT 
    WITH CHECK (true);

CREATE POLICY "Allow anonymous select" ON public.reports 
    FOR SELECT 
    USING (true);

CREATE POLICY "Allow anonymous update" ON public.reports 
    FOR UPDATE 
    USING (true);

-- Indexing for search, filtering, and geolocation sorting performance
CREATE INDEX IF NOT EXISTS idx_reports_status ON public.reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_issue_type ON public.reports(issue_type);
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON public.reports(created_at);
CREATE INDEX IF NOT EXISTS idx_reports_latitude_longitude ON public.reports(latitude, longitude);

-- Trigger to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE OR REPLACE TRIGGER update_reports_modtime
    BEFORE UPDATE ON public.reports
    FOR EACH ROW
    EXECUTE FUNCTION update_modified_column();


-- =========================================================================
-- STORAGE BUCKET POLICIES (Required for image uploads)
-- =========================================================================

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
