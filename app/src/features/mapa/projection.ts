/** Schematic Grande Vitória viewport; lat/lng are projected linearly into 0..1. */
export const BOUNDS = { minLat: -20.36, maxLat: -20.25, minLng: -40.36, maxLng: -40.25 } as const;

export function project(lat: number, lng: number) {
  const clamp = (n: number) => Math.min(0.96, Math.max(0.04, n));
  return {
    x: clamp((lng - BOUNDS.minLng) / (BOUNDS.maxLng - BOUNDS.minLng)),
    y: clamp((BOUNDS.maxLat - lat) / (BOUNDS.maxLat - BOUNDS.minLat)),
  };
}

export const NEIGHBORHOODS = [
  { name: 'Praia do Canto', lat: -20.2976, lng: -40.2958 },
  { name: 'Centro', lat: -20.319, lng: -40.338 },
  { name: 'Jardim da Penha', lat: -20.279, lng: -40.288 },
  { name: 'Camburi', lat: -20.267, lng: -40.275 },
  { name: 'Vila Velha', lat: -20.34, lng: -40.29 },
] as const;
