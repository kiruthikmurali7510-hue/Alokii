// src/components/LeafletMap.jsx
import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './LeafletMap.css';

export default function LeafletMap({ center = [11.2719, 77.4120], zoom = 15, markers = [] }) {
  const mapRef = useRef(null);

  useEffect(() => {
    if (mapRef.current && !mapRef.current._leaflet_map) {
      const map = L.map(mapRef.current).setView(center, zoom);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);
      mapRef.current._leaflet_map = map;
    }
    // Add markers if any
    if (mapRef.current && mapRef.current._leaflet_map && markers.length) {
      const map = mapRef.current._leaflet_map;
      // Remove existing markers layer group if present
      if (map._reportMarkers) {
        map.removeLayer(map._reportMarkers);
      }
      const markersGroup = L.layerGroup();
      markers.forEach((m) => {
        if (m.latitude && m.longitude) {
          L.marker([m.latitude, m.longitude])
            .addTo(markersGroup)
            .bindPopup(`${m.issue_type || m.issueType || 'Issue'}<br/>${m.name}`);
        }
      });
      markersGroup.addTo(map);
      map._reportMarkers = markersGroup;
    }
  }, [center, zoom, markers]);

  return <div className="leaflet-container" ref={mapRef} />;
}
