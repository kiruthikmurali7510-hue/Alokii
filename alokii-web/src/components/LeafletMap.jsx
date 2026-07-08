// src/components/LeafletMap.jsx
import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './LeafletMap.css';
import potholeImg from '../assets/pothole.jpg';

export default function LeafletMap({ center = [11.2719, 77.4120], zoom = 15, markers = [], onMarkerClick }) {
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
          const emoji = isPothole 
            ? `<img src="${potholeImg}" style="width: 24px; height: 24px; border-radius: 50%; object-fit: cover; display: block;" />` 
            : '🗑️';

          // Status-based border color
          const status = (m.status || '').toLowerCase();
          let borderColor = '#eab308'; // Default Amber/Yellow for Pending

          if (status === 'resolved') {
            borderColor = '#10b981'; // Emerald Green
          } else if (status === 'in-progress' || status === 'in progress') {
            borderColor = '#3b82f6'; // Blue
          }

          const customIcon = L.divIcon({
            className: 'custom-map-marker',
            html: `
              <div style="
                background: ${markerColor};
                width: 36px;
                height: 36px;
                border-radius: 50%;
                border: 3px solid ${borderColor};
                box-shadow: 0 4px 8px rgba(0,0,0,0.4);
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 18px;
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
            iconSize: [36, 44],
            iconAnchor: [18, 44]
          });

          L.marker([m.latitude, m.longitude], { 
            icon: customIcon,
            title: `${m.issue_type || m.issueType || 'Issue'} (${m.status || 'Pending'})`
          })
            .addTo(markersGroup)
            .on('click', () => {
              if (onMarkerClick) {
                onMarkerClick(m);
              }
            });
        }
      });
      markersGroup.addTo(map);
      map._reportMarkers = markersGroup;
    }
  }, [center, zoom, markers, onMarkerClick]);

  return <div className="leaflet-container" ref={mapRef} />;
}
