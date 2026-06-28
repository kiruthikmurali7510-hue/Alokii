// src/services/api.js
// Calls the Flask AI pipeline at /analyze-image
// Sends the image as a multipart FormData upload (what the backend expects).

export async function runAIPipeline(imageFile) {
  const backendUrl = import.meta.env.VITE_BACKEND_URL;

  if (!backendUrl) {
    console.error('[AI] VITE_BACKEND_URL is not set — AI analysis disabled.');
    return null;
  }

  if (!imageFile) {
    console.error('[AI] No image file provided — skipping AI analysis.');
    return null;
  }

  const formData = new FormData();
  formData.append('image', imageFile);

  // Render free-tier cold-start can take up to 60s — use 90s timeout
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90000); // 90s

  console.log(`[AI] Sending image to ${backendUrl}/analyze-image ...`);

  try {
    const response = await fetch(`${backendUrl}/analyze-image`, {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[AI] Backend returned ${response.status}: ${errText}`);
      return null;
    }

    const result = await response.json();
    console.log('[AI] Result received:', result);
    return result;

  } catch (err) {
    clearTimeout(timeout);
    if (err.name === 'AbortError') {
      console.error('[AI] Request timed out after 90 seconds — backend may be cold-starting. Try again in a moment.');
    } else {
      console.error('[AI] Backend unreachable:', err.message);
    }
    return null;
  }
}

// Utility: wake up the backend (call this when the app loads so it's warm by submit time)
export async function warmUpBackend() {
  const backendUrl = import.meta.env.VITE_BACKEND_URL;
  if (!backendUrl) return;
  try {
    await fetch(`${backendUrl}/health`, { method: 'GET' });
    console.log('[AI] Backend warmed up.');
  } catch {
    // Silently ignore — just a warm-up ping
  }
}
