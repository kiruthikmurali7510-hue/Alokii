// src/services/api.js
// Calls the Flask AI pipeline at /analyze-image
// Sends the image as a multipart FormData upload (what the backend expects).
// Errors here are NON-FATAL — the report is still saved even if AI analysis fails.

export async function runAIPipeline(imageFile) {
  const backendUrl = import.meta.env.VITE_BACKEND_URL;

  if (!backendUrl) {
    console.warn('VITE_BACKEND_URL is not set — skipping AI analysis');
    return null;
  }

  if (!imageFile) {
    console.warn('No image file provided to AI pipeline — skipping');
    return null;
  }

  const formData = new FormData();
  formData.append('image', imageFile);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000); // 20s timeout

  try {
    const response = await fetch(`${backendUrl}/analyze-image`, {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errText = await response.text();
      console.warn(`AI pipeline returned ${response.status}: ${errText}`);
      return null; // non-fatal
    }

    return await response.json();
  } catch (err) {
    clearTimeout(timeout);
    if (err.name === 'AbortError') {
      console.warn('AI pipeline timed out — continuing without AI result');
    } else {
      console.warn('AI pipeline unreachable — continuing without AI result:', err.message);
    }
    return null; // non-fatal — backend may not be running
  }
}
