// supabase.js – Web‑only Supabase client
// The original file imported AsyncStorage (React Native) which is unavailable in browsers.
// For a web app we can create the client without special auth storage; the default
// localStorage based persistence works fine.
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ygngrswqcldyypqttjho.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlnbmdyc3dxY2xkeXlwcXR0amhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0NTI0MzMsImV4cCI6MjA5ODAyODQzM30.UgffuSqpoP2GozL2nKyMLanCYqF0bJ-NnlVDF0Q4cAc';

// No custom auth storage needed for a pure web environment.
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
