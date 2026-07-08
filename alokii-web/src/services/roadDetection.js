// src/services/roadDetection.js

/**
 * Automatically detects the road type from latitude and longitude
 * using the OpenStreetMap Nominatim Reverse Geocoding API.
 * 
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @returns {Promise<string>} - 'Main Road', 'Medium Road', 'Local Road', or 'Unknown'
 */
export async function detectRoadType(lat, lon) {
  try {
    // zoom=16 forces the API to return the nearest street/major road instead of a building or POI
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=16`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'TidyCity/1.0 (Contact: admin@tidycity.local)'
      }
    });

    if (!response.ok) {
      console.warn('OpenStreetMap API returned an error status:', response.status);
      return 'Unknown';
    }

    const data = await response.json();

    // Check if it's a highway/road classification
    const type = data.type || '';

    if (['primary', 'trunk', 'motorway', 'primary_link', 'trunk_link', 'motorway_link'].includes(type)) {
      return 'Main Road';
    }
    
    if (['secondary', 'tertiary', 'secondary_link', 'tertiary_link'].includes(type)) {
      return 'Medium Road';
    }
    
    if (['residential', 'living_street', 'unclassified', 'service', 'pedestrian'].includes(type)) {
      return 'Local Road';
    }

    // Default fallback if type is unrecognized or not a road
    return 'Unknown';
    
  } catch (error) {
    console.error('Failed to detect road type:', error);
    // Do not stop report submission on error, default to Unknown
    return 'Unknown';
  }
}
