import { supabase } from '../supabase';

/**
 * Check if a near-duplicate report exists within:
 * - 5 meters geographically (approx 0.000045 degrees)
 * - 5 minutes time window
 * - Same issue type
 *
 * Uses a simple bounding box approach on lat/lng for Supabase compatibility
 * (PostGIS not required).
 */
export const checkDuplicateReport = async ({ latitude, longitude, issueType }) => {
  try {
    // Approx 5 meters in degrees (1 degree ≈ 111,000m)
    const DELTA = 0.000045;

    // 5-minute window
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from('reports')
      .select('id, created_at, latitude, longitude, issue_type')
      .eq('issue_type', issueType)
      .gte('created_at', fiveMinutesAgo)
      .gte('latitude', latitude - DELTA)
      .lte('latitude', latitude + DELTA)
      .gte('longitude', longitude - DELTA)
      .lte('longitude', longitude + DELTA)
      .limit(1);

    if (error) {
      console.warn('Duplicate check query error:', error.message);
      return false; // If query fails, allow the submission
    }

    if (data && data.length > 0) {
      console.log('Duplicate report detected:', data[0].id);
      return true; // Duplicate found
    }

    return false; // No duplicate
  } catch (err) {
    console.warn('Duplicate check failed silently:', err.message);
    return false; // Allow submission on error
  }
};

/**
 * Calculate the haversine distance in meters between two lat/lng points.
 * Used optionally for precise verification in future phases.
 */
export const haversineDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371000; // Earth radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};
