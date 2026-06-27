import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
// WebView will be required dynamically for native platforms

export default function LeafletMap() {
  const mapRef = useRef(null);

  // Dynamically load WebView for native platforms
  let WebViewComponent = null;
  if (Platform.OS !== 'web') {
    WebViewComponent = require('react-native-webview').WebView;
  }

  useEffect(() => {
    if (Platform.OS === 'web' && mapRef.current) {
      // Ensure Leaflet CSS is loaded
      const existingLink = document.getElementById('leaflet-css');
      if (!existingLink) {
        const link = document.createElement('link');
        link.id = 'leaflet-css';
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet/dist/leaflet.css';
        document.head.appendChild(link);
      }
      // Import leaflet lazily to avoid bundling overhead
      import('leaflet').then(L => {
        const map = L.map(mapRef.current).setView([11.271905934351967, 77.41203883069109], 15);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors',
          maxZoom: 19,
        }).addTo(map);
      });
    }
  }, []);

  return (
    <View style={styles.container}>
      {Platform.OS === 'web' ? (
        <View ref={mapRef} style={styles.map} />
      ) : (
        WebViewComponent && (
          <WebViewComponent
            originWhitelist={['*']}
            source={{ html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet/dist/leaflet.css" />
  <style>#map{height:100%;width:100%;margin:0;padding:0;}</style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet/dist/leaflet.js"></script>
  <script>
    const map = L.map('map').setView([11.271905934351967, 77.41203883069109], 15);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);
  </script>
</body>
</html>`
            }}
            style={styles.webview}
            javaScriptEnabled
            domStorageEnabled
          />
        )
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { height: 400, width: '100%', marginTop: 20 },
  map: { flex: 1 }, // fills the container on web
  webview: { flex: 1 },
});
