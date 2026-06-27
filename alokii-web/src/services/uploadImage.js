// src/services/uploadImage.js
// Upload an image file to Supabase storage and return a public URL.
import { supabase } from './supabaseClient';

const BUCKET = 'report-images';

export async function uploadImage(file) {
  if (!file) {
    throw new Error('No file provided for upload');
  }

  // Generate a unique filename using timestamp + random suffix
  const ext = file.name.split('.').pop().toLowerCase();
  const fileName = `uploads/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const { error } = await supabase.storage.from(BUCKET).upload(fileName, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type,
  });

  if (error) {
    console.error('Supabase upload error:', error);
    if (error.message?.toLowerCase().includes('bucket')) {
      throw new Error(
        'Storage bucket "reports" does not exist. Please create it in your Supabase dashboard:\n' +
        'Storage → New bucket → Name: "reports" → Enable "Public bucket" → Save'
      );
    }
    throw new Error(`Image upload failed: ${error.message}`);
  }

  // supabase-js v2: getPublicUrl returns { data: { publicUrl } }
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(fileName);
  return data.publicUrl;
}
