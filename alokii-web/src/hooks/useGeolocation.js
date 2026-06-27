// src/hooks/useGeolocation.js
import { useState, useEffect } from 'react';

export default function useGeolocation() {
  const [position, setPosition] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by this browser.');
      setLoading(false);
      return;
    }
    const onSuccess = (pos) => {
      setPosition({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      });
      setLoading(false);
    };
    const onError = (err) => {
      setError(err.message);
      setLoading(false);
    };
    navigator.geolocation.getCurrentPosition(onSuccess, onError);
  }, []);

  return { position, error, loading };
}
