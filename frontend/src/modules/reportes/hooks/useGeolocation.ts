import { useState } from "react";

interface GeoState {
  lat: number | null;
  lng: number | null;
  loading: boolean;
  error: string | null;
}

export function useGeolocation() {
  const [state, setState] = useState<GeoState>({ lat: null, lng: null, loading: false, error: null });

  function capture() {
    if (!navigator.geolocation) {
      setState(s => ({ ...s, error: "El navegador no soporta geolocalización." }));
      return;
    }
    setState(s => ({ ...s, loading: true, error: null }));
    navigator.geolocation.getCurrentPosition(
      pos => setState({ lat: pos.coords.latitude, lng: pos.coords.longitude, loading: false, error: null }),
      () => setState(s => ({ ...s, loading: false, error: "No se pudo obtener la ubicación. Verifica los permisos." })),
      { timeout: 10_000, enableHighAccuracy: true }
    );
  }

  function clear() {
    setState({ lat: null, lng: null, loading: false, error: null });
  }

  return { ...state, capture, clear };
}
