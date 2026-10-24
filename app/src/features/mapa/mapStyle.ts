import { palette } from '@/theme/tokens';
import { FONT_BOLD, FONT_REGULAR, GLYPHS_URL, TILE_SOURCE_URL } from './mapConfig';

// Minimal dark "nightlife" style on the OpenFreeMap (OpenMapTiles) vector source: only what helps someone choose a
// place (water, parks, roads, bairro and street names). Fewer layers than the stock styles means less to decode.
// Typed loosely (plain JSON) so it feeds both maplibre-gl (web) and MapLibre RN (native) without adapter types.

const nameExpr = ['coalesce', ['get', 'name:pt'], ['get', 'name']];

export const MAP_STYLE = {
  version: 8,
  name: 'qual-a-boa-dark',
  glyphs: GLYPHS_URL,
  sources: { openmaptiles: { type: 'vector', url: TILE_SOURCE_URL } },
  layers: [
    { id: 'background', type: 'background', paint: { 'background-color': palette.night } },
    {
      id: 'landcover',
      type: 'fill',
      source: 'openmaptiles',
      'source-layer': 'landcover',
      filter: ['in', 'class', 'grass', 'wood'],
      paint: { 'fill-color': '#171917', 'fill-opacity': 0.9 },
    },
    {
      id: 'park',
      type: 'fill',
      source: 'openmaptiles',
      'source-layer': 'park',
      paint: { 'fill-color': '#181B18' },
    },
    {
      id: 'water',
      type: 'fill',
      source: 'openmaptiles',
      'source-layer': 'water',
      paint: { 'fill-color': '#1A1F2B' },
    },
    {
      id: 'roads-minor',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'transportation',
      minzoom: 13,
      filter: ['in', 'class', 'minor', 'service', 'tertiary'],
      paint: { 'line-color': palette.ash, 'line-width': ['interpolate', ['linear'], ['zoom'], 13, 0.4, 17, 3] },
      layout: { 'line-cap': 'round', 'line-join': 'round' },
    },
    {
      id: 'roads-major',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'transportation',
      filter: ['in', 'class', 'motorway', 'trunk', 'primary', 'secondary'],
      paint: { 'line-color': '#3A3631', 'line-width': ['interpolate', ['linear'], ['zoom'], 10, 0.6, 17, 6] },
      layout: { 'line-cap': 'round', 'line-join': 'round' },
    },
    {
      id: 'water-name',
      type: 'symbol',
      source: 'openmaptiles',
      'source-layer': 'water_name',
      layout: { 'text-field': nameExpr, 'text-font': FONT_REGULAR, 'text-size': 11, 'text-letter-spacing': 0.1 },
      paint: { 'text-color': '#5B6579' },
    },
    {
      id: 'road-name',
      type: 'symbol',
      source: 'openmaptiles',
      'source-layer': 'transportation_name',
      minzoom: 14,
      layout: { 'text-field': nameExpr, 'text-font': FONT_REGULAR, 'text-size': 11, 'symbol-placement': 'line' },
      paint: { 'text-color': palette.dusk, 'text-halo-color': palette.night, 'text-halo-width': 1.2 },
    },
    {
      id: 'place-bairro',
      type: 'symbol',
      source: 'openmaptiles',
      'source-layer': 'place',
      filter: ['in', 'class', 'suburb', 'neighbourhood', 'quarter', 'city', 'town', 'village'],
      layout: {
        'text-field': nameExpr,
        'text-font': FONT_BOLD,
        'text-size': ['interpolate', ['linear'], ['zoom'], 10, 11, 15, 14],
        'text-transform': 'uppercase',
        'text-letter-spacing': 0.08,
        'text-max-width': 8,
      },
      paint: { 'text-color': '#8D857B', 'text-halo-color': palette.night, 'text-halo-width': 1.5 },
    },
  ],
};
