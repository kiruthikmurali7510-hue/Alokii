// src/services/supabaseClient.js
// Export a pre‑configured Supabase client for the web app.
import { createClient } from '@supabase/supabase-js';

// These values are the same as in the root supabase.js; they can be duplicated here for simplicity.
const SUPABASE_URL = 'https://ygngrswqcldyypqttjho.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlnbmdyc3dxY2xkeXlwcXR0amhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0NTI0MzMsImV4cCI6MjA5ODAyODQzM30.UgffuSqpoP2GozL2nKyMLanCYqF0bJ-NnlVDF0Q4cAc';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
