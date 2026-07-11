// src/services/nearbyInsights.js
// Fetches nearby places using Geoapify Places API and analyses
// them to produce a Nearby Risk Score used in Priority Scoring.
//
// FIX: Geoapify only returns results reliably when one category
// GROUP is queried at a time. We make 3 separate requests and
// merge results. We also use BROAD parent categories so that
// clinics, nursing homes, dental, pharmacy etc. are all counted
// under "healthcare" — not just OSM-tagged hospitals.

const GEOAPIFY_API_KEYS = [
  'b955afbe33674cbabe625e26105fd268', // Primary Key
  '70e5add365234079abd4dfa705dfae78'  // Fallback Key
];
const RADIUS_METERS    = 2000; // 2 km radius (wider net for rural areas)
const PLACE_LIMIT      = 50;

/**
 * Fetches nearby places for a SINGLE category string from Geoapify.
 * Fallbacks to secondary API key if primary key hits limits (402, 403, 429).
 * Returns [] on any error — never throws.
 * @param {number} lat
 * @param {number} lng
 * @param {string} category  e.g. 'healthcare' or 'service.police'
 * @returns {Promise<Array>} GeoJSON feature array
 */
async function fetchCategory(lat, lng, category) {
  for (let i = 0; i < GEOAPIFY_API_KEYS.length; i++) {
    const apiKey = GEOAPIFY_API_KEYS[i];
    try {
      const url =
        `https://api.geoapify.com/v2/places` +
        `?categories=${encodeURIComponent(category)}` +
        `&filter=circle:${lng},${lat},${RADIUS_METERS}` +
        `&limit=${PLACE_LIMIT}` +
        `&apiKey=${apiKey}`;

      const controller = new AbortController();
      const timeout    = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);

      // Quota exceeded / Limit reached status codes: 402 (Payment Required), 403 (Forbidden), 429 (Too Many Requests)
      if (response.status === 402 || response.status === 403 || response.status === 429) {
        console.warn(`[NearbyInsights] API key index ${i} limit reached (${response.status}). Trying next key...`);
        continue;
      }

      if (!response.ok) {
        console.warn(`[NearbyInsights] Geoapify ${category} returned HTTP ${response.status}`);
        return [];
      }

      const data = await response.json();
      return Array.isArray(data.features) ? data.features : [];
    } catch (err) {
      if (err.name === 'AbortError') {
        console.warn(`[NearbyInsights] Geoapify ${category} request timed out.`);
      } else {
        console.warn(`[NearbyInsights] Fetch failed for ${category} with key index ${i}:`, err.message);
      }
      if (i < GEOAPIFY_API_KEYS.length - 1) {
        continue; // Fallback to next key on network error
      }
      return [];
    }
  }
  return [];
}

/**
 * Fetches all three category groups in parallel and returns the
 * combined flat array of GeoJSON features.
 * Non-fatal — each failed sub-request is silently skipped.
 *
 * Category strategy (proven via API testing):
 *   healthcare   → hospitals, clinics, nursing homes, pharmacies,
 *                  dentists, labs, any OSM amenity=* under healthcare
 *   service.police → police stations
 *   catering     → restaurants, cafes, food shops
 *
 * @param {number} lat
 * @param {number} lng
 * @returns {Promise<Array>} merged GeoJSON feature array
 */
export async function fetchNearbyPlaces(lat, lng) {
  const [healthcareFeatures, policeFeatures, cateringFeatures] = await Promise.all([
    fetchCategory(lat, lng, 'healthcare'),
    fetchCategory(lat, lng, 'service.police'),
    fetchCategory(lat, lng, 'catering'),
  ]);

  return [...healthcareFeatures, ...policeFeatures, ...cateringFeatures];
}

/**
 * Analyses a merged feature array and returns counts + a Nearby
 * Risk Score (0-60).
 *
 * Risk Score Logic:
 *   +30 if NO medical facility found within radius
 *   +20 if NO police station found
 *   +10 if NO shop/food outlet found
 *
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
    // No data at all (API failure) → conservatively apply moderate risk
    result.riskScore = 30;
    return result;
  }

  features.forEach(place => {
    const categories = place?.properties?.categories || [];

    // Healthcare: catches hospital, clinic, clinic_or_praxis, nursing_home,
    // pharmacy, dentist, physiotherapist, doctor, etc.
    if (categories.some(c => c === 'healthcare' || c.startsWith('healthcare.'))) {
      result.hospitalCount++;
    }

    // Police
    if (categories.some(c => c === 'service.police' || c.startsWith('service.police.'))) {
      result.policeCount++;
    }

    // Shops / catering outlets (restaurants, cafes, bakeries, etc.)
    if (categories.some(c => c === 'catering' || c.startsWith('catering.'))) {
      result.shopCount++;
    }
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


