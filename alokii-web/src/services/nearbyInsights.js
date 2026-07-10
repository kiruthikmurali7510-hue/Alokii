// src/services/nearbyInsights.js
// Fetches nearby places using Geoapify Places API and analyses
// them to produce a Nearby Risk Score used in Priority Scoring.

const GEOAPIFY_API_KEY = 'b955afbe33674cbabe625e26105fd268';
const RADIUS_METERS    = 1000; // 1 km radius
const PLACE_LIMIT      = 20;
const CATEGORIES       = 'healthcare.hospital,service.police,commercial.supermarket';

/**
 * Fetches nearby places from Geoapify for the given coordinates.
 * Non-fatal — returns [] on any error so report submission is never blocked.
 * @param {number} lat
 * @param {number} lng
 * @returns {Promise<Array>} GeoJSON feature array
 */
export async function fetchNearbyPlaces(lat, lng) {
  try {
    const url =
      `https://api.geoapify.com/v2/places` +
      `?categories=${CATEGORIES}` +
      `&filter=circle:${lng},${lat},${RADIUS_METERS}` +
      `&limit=${PLACE_LIMIT}` +
      `&apiKey=${GEOAPIFY_API_KEY}`;

    const controller = new AbortController();
    const timeout    = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!response.ok) {
      console.warn('[NearbyInsights] Geoapify returned', response.status);
      return [];
    }

    const data = await response.json();
    return Array.isArray(data.features) ? data.features : [];
  } catch (err) {
    if (err.name === 'AbortError') {
      console.warn('[NearbyInsights] Geoapify request timed out.');
    } else {
      console.warn('[NearbyInsights] Fetch failed:', err.message);
    }
    return [];
  }
}

/**
 * Analyses a feature array and returns counts + a Nearby Risk Score (0-60).
 * Risk Logic:
 *   +30 if NO hospital found within 1 km
 *   +20 if NO police station found
 *   +10 if NO supermarket found
 * @param {Array} features
 * @returns {{ hospitalCount: number, policeCount: number, shopCount: number, riskScore: number }}
 */
export function analyzeNearbyPlaces(features) {
  const result = {
    hospitalCount: 0,
    policeCount:   0,
    shopCount:     0,
    riskScore:     0,
  };

  if (!Array.isArray(features) || features.length === 0) {
    result.riskScore = 60;
    return result;
  }

  features.forEach(place => {
    const categories = place?.properties?.categories || [];
    if (categories.some(c => c.startsWith('healthcare.hospital'))) result.hospitalCount++;
    if (categories.some(c => c.startsWith('service.police')))      result.policeCount++;
    if (categories.some(c => c.startsWith('commercial.supermarket'))) result.shopCount++;
  });

  if (result.hospitalCount === 0) result.riskScore += 30;
  if (result.policeCount   === 0) result.riskScore += 20;
  if (result.shopCount     === 0) result.riskScore += 10;

  return result;
}

/**
 * Convenience wrapper: fetches AND analyses in one call.
 * @param {number} lat
 * @param {number} lng
 * @returns {Promise<{ hospitalCount, policeCount, shopCount, riskScore }>}
 */
export async function getNearbyInsights(lat, lng) {
  const features = await fetchNearbyPlaces(lat, lng);
  return analyzeNearbyPlaces(features);
}
