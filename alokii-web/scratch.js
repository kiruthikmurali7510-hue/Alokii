const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://ygngrswqcldyypqttjho.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlnbmdyc3dxY2xkeXlwcXR0amhvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjQ1MjQzMywiZXhwIjoyMDk4MDI4NDMzfQ.ERQy3bcGSETzeLJr7OlWsTPn1Ujc-F32g-IwuhT9-h0';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function test() {
  const { data, error } = await supabase.from('reports').select('id, reporter_name, latitude, longitude, road_type, created_at').order('created_at', { ascending: false }).limit(5);
  
  if (error) {
    console.error("Error:", error.message);
  } else {
    console.log(data);
  }
}

test();
