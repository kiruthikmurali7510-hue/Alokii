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
          
          // Create a custom, highly visible marker icon
          const isPothole = (m.issue_type || m.issueType)?.toLowerCase().includes('pothole');
          const markerColor = isPothole ? '#ef4444' : '#f59e0b'; // Red for potholes, Orange for garbage
          const emoji = isPothole ? '🕳️' : '🗑️';

          const customIcon = L.divIcon({
            className: 'custom-map-marker',
            html: `
              <div style="
                background: ${markerColor};
                width: 36px;
                height: 36px;
                border-radius: 50%;
                border: 3px solid white;
                box-shadow: 0 4px 8px rgba(0,0,0,0.4);
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 18px;
                transform: translate(-50%, -100%);
                position: relative;
              ">
                ${emoji}
                <div style="
                  position: absolute;
                  bottom: -8px;
                  left: 50%;
                  transform: translateX(-50%);
                  width: 0;
                  height: 0;
                  border-left: 6px solid transparent;
                  border-right: 6px solid transparent;
                  border-top: 8px solid ${markerColor};
                "></div>
              </div>
            `,
            iconSize: [0, 0] // Centered via CSS transform
          });

          L.marker([m.latitude, m.longitude], { icon: customIcon })
            .addTo(markersGroup)
            .bindPopup(`<strong>${m.issue_type || m.issueType || 'Issue'}</strong><br/>Reported by: ${m.reporter_name || m.name || 'Anonymous'}`);
        }
      });
      markersGroup.addTo(map);
      map._reportMarkers = markersGroup;
    }
  }, [center, zoom, markers]);

  return <div className="leaflet-container" ref={mapRef} />;
}
