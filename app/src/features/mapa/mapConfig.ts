// Map constants shared by the native (MapLibre RN) and web (maplibre-gl) maps.
// Tiles: OpenFreeMap public instance (free, no API key, commercial use allowed). To self-host or switch provider,
// change TILE_SOURCE_URL / GLYPHS_URL only.

export const TILE_SOURCE_URL = 'https://tiles.openfreemap.org/planet';
export const GLYPHS_URL = 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf';
export const FONT_REGULAR = ['Noto Sans Regular'];
export const FONT_BOLD = ['Noto Sans Bold'];

/** Attribution required by OpenFreeMap / OpenMapTiles / OpenStreetMap. Shown on every map. */
export const ATTRIBUTION = 'OpenFreeMap © OpenMapTiles Data from OpenStreetMap';

/** Grande Vitória (pilot): camera never leaves this box, which keeps the tile working set small. [west, south, east, north] */
export const PILOT_BOUNDS: [number, number, number, number] = [-40.45, -20.45, -40.15, -20.15];
export const MIN_ZOOM = 10.5;
export const MAX_ZOOM = 17;
export const DEFAULT_ZOOM = 13;
