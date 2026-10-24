import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { Map as GlMap, Marker as GlMarker } from 'maplibre-gl';

import { Icon, Text } from '@/ui';
import { hit, palette, radius, space } from '@/theme/tokens';
import { ATTRIBUTION, DEFAULT_ZOOM, MAX_ZOOM, MIN_ZOOM, PILOT_BOUNDS } from './mapConfig';
import { MAP_STYLE } from './mapStyle';
import type { VenueMapProps } from './mapTypes';
import { pinLabel, type VenuePin } from './pins';
import { VenueMapSchematic } from './VenueMapSchematic';

const FALLBACK_NOTE = 'Mapa simplificado (sem conexão com os mapas)';
const STYLE_TIMEOUT_MS = 15000;
const FIT_PADDING = { top: 96, right: 48, bottom: 200, left: 48 };

const CHECK_SVG =
  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
const STAR_SVG =
  '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 3.8l2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 17.1l-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z"/></svg>';

/**
 * DOM marker: a focusable pill. Selected = larger, heavier label and a check icon, so selection never relies on
 * color alone. Enter or Space selects.
 */
export function createPinElement(pin: VenuePin, selected: boolean, onSelect: (id: string) => void): HTMLElement {
  const el = document.createElement('div');
  el.setAttribute('role', 'button');
  el.setAttribute('tabindex', '0');
  el.setAttribute('aria-label', pinLabel(pin));
  el.setAttribute('aria-pressed', selected ? 'true' : 'false');
  el.dataset.venueId = pin.venue.id;
  el.style.cssText = [
    `min-height:${hit.min}px`,
    `min-width:${hit.min}px`,
    'display:flex',
    'align-items:center',
    'justify-content:center',
    'cursor:pointer',
    'outline-offset:2px',
  ].join(';');

  const pill = document.createElement('div');
  pill.style.cssText = [
    'display:flex',
    'align-items:center',
    `gap:${space.xs}px`,
    'max-width:180px',
    `border-radius:${radius.full}px`,
    `padding:0 ${selected ? space.lg : space.md}px`,
    `min-height:${selected ? hit.min : 32}px`,
    `background:${selected ? palette.riotPink : palette.bone}`,
    `color:${selected ? palette.riotInk : palette.night}`,
    selected ? `border:2px solid ${palette.bone}` : 'border:0',
    `font-size:${selected ? 16 : 14}px`,
    `font-weight:${selected ? 800 : 600}`,
    'font-family:system-ui,sans-serif',
    'white-space:nowrap',
  ].join(';');
  if (selected) {
    const check = document.createElement('span');
    check.dataset.testid = 'pin-check';
    check.style.display = 'inline-flex';
    check.innerHTML = CHECK_SVG;
    pill.appendChild(check);
  }
  const name = document.createElement('span');
  name.textContent = pin.venue.name;
  name.style.cssText = 'overflow:hidden;text-overflow:ellipsis';
  pill.appendChild(name);
  if (pin.rank != null || pin.recommended) {
    const badge = document.createElement('span');
    badge.dataset.testid = 'pin-badge';
    badge.style.cssText = `display:inline-flex;align-items:center;justify-content:center;min-width:18px;height:18px;border-radius:${radius.full}px;background:${palette.amber};color:${palette.night};font-size:12px;font-weight:700`;
    if (pin.rank != null) badge.textContent = String(pin.rank);
    else badge.innerHTML = STAR_SVG;
    pill.appendChild(badge);
  }
  el.appendChild(pill);

  const choose = () => onSelect(pin.venue.id);
  el.addEventListener('click', choose);
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      choose();
    }
  });
  el.addEventListener('focus', () => {
    el.style.outline = `2px solid ${palette.bone}`;
  });
  el.addEventListener('blur', () => {
    el.style.outline = 'none';
  });
  return el;
}

function createUserElement(): HTMLElement {
  const el = document.createElement('div');
  el.setAttribute('role', 'img');
  el.setAttribute('aria-label', 'Você está aqui');
  el.style.cssText = `width:18px;height:18px;border-radius:${radius.full}px;background:${palette.riotPink};border:3px solid ${palette.bone};box-sizing:border-box`;
  return el;
}

/** The schematic map with a small note, shown whenever the real map is unavailable. */
function SimplifiedMap(props: VenueMapProps) {
  return (
    <View style={styles.fill}>
      <VenueMapSchematic {...props} />
      <View pointerEvents="none" style={styles.note}>
        <Text variant="caption" tone={palette.dusk}>
          {FALLBACK_NOTE}
        </Text>
      </View>
    </View>
  );
}

const isOffline = () => typeof navigator !== 'undefined' && navigator.onLine === false;

export function VenueMap(props: VenueMapProps) {
  const [failed, setFailed] = useState(isOffline);
  const onFail = useCallback(() => setFailed(true), []);

  useEffect(() => {
    // Offline: show the schematic map. Back online: try the real map again.
    if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return;
    const off = () => setFailed(true);
    const on = () => setFailed(false);
    window.addEventListener('offline', off);
    window.addEventListener('online', on);
    return () => {
      window.removeEventListener('offline', off);
      window.removeEventListener('online', on);
    };
  }, []);

  if (failed) return <SimplifiedMap {...props} />;
  return <WebGlVenueMap {...props} onFail={onFail} />;
}

function WebGlVenueMap({
  onFail,
  pins,
  selectedId,
  onSelect,
  center,
  userLocation,
  onLocate,
  fitKey,
}: VenueMapProps & { onFail: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<GlMap | null>(null);
  const libRef = useRef<typeof import('maplibre-gl') | null>(null);
  const markersRef = useRef<GlMarker[]>([]);
  const userMarkerRef = useRef<GlMarker | null>(null);
  const firstCenter = useRef(true);
  const onSelectRef = useRef(onSelect);
  const centerRef = useRef(center);
  const pinsRef = useRef(pins);
  // Keep the latest props readable from async/imperative code. Declared first so they are current for every effect below.
  useEffect(() => {
    onSelectRef.current = onSelect;
    centerRef.current = center;
    pinsRef.current = pins;
  });

  // Load maplibre-gl (separate chunk) and create the map.
  useEffect(() => {
    let cancelled = false;
    let created: GlMap | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    // No real DOM node (test renderer, or the container failed to mount): do not leave a blank view.
    if (typeof document === 'undefined' || !containerRef.current) {
      onFail();
      return;
    }
    (async () => {
      try {
        const css = import('maplibre-gl/dist/maplibre-gl.css');
        const [mod] = await Promise.all([import('maplibre-gl'), css]);
        if (cancelled || !containerRef.current) return;
        const lib = ((mod as { default?: typeof import('maplibre-gl') }).default ?? mod) as typeof import('maplibre-gl');
        // maplibre-gl v6 needs its worker script served as a file (Metro does not bundle it): app/public/maplibre-gl-worker.mjs.
        lib.setWorkerUrl('/maplibre-gl-worker.mjs');
        libRef.current = lib;
        let loaded = false;
        created = new lib.Map({
          container: containerRef.current,
          style: MAP_STYLE as unknown as import('maplibre-gl').StyleSpecification,
          center: [centerRef.current.lng, centerRef.current.lat],
          zoom: DEFAULT_ZOOM,
          minZoom: MIN_ZOOM,
          maxZoom: MAX_ZOOM,
          maxBounds: PILOT_BOUNDS,
          attributionControl: false,
          dragRotate: false,
          pitchWithRotate: false,
        });
        created.touchZoomRotate?.disableRotation?.();
        created.on('load', () => {
          loaded = true;
          if (timer) clearTimeout(timer);
        });
        // Only a failure before the first load is fatal; later tile hiccups keep the map we already have.
        created.on('error', () => {
          if (!loaded && !cancelled) onFail();
        });
        timer = setTimeout(() => {
          if (!loaded && !cancelled) onFail();
        }, STYLE_TIMEOUT_MS);
        setMap(created);
      } catch {
        if (!cancelled) onFail();
      }
    })();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      userMarkerRef.current?.remove();
      userMarkerRef.current = null;
      created?.remove();
    };
  }, [onFail]);

  // Pin markers.
  useEffect(() => {
    const lib = libRef.current;
    if (!map || !lib) return;
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = pins.map((pin) =>
      new lib.Marker({
        element: createPinElement(pin, pin.venue.id === selectedId, (id) => onSelectRef.current(id)),
        anchor: 'bottom',
      })
        .setLngLat([pin.venue.lng, pin.venue.lat])
        .addTo(map),
    );
  }, [map, pins, selectedId]);

  // User location dot.
  useEffect(() => {
    const lib = libRef.current;
    if (!map || !lib) return;
    userMarkerRef.current?.remove();
    userMarkerRef.current = userLocation
      ? new lib.Marker({ element: createUserElement() }).setLngLat([userLocation.lng, userLocation.lat]).addTo(map)
      : null;
  }, [map, userLocation]);

  // Animate to `center` when it changes (the initial view already starts there).
  useEffect(() => {
    if (!map) return;
    if (firstCenter.current) {
      firstCenter.current = false;
      return;
    }
    map.easeTo({ center: [center.lng, center.lat], duration: 500 });
  }, [map, center.lat, center.lng]);

  // Fit all pins when the set changes in a way that should refit. Declared after the center effect so it wins.
  useEffect(() => {
    const lib = libRef.current;
    const list = pinsRef.current;
    if (!map || !lib || list.length === 0) return;
    if (list.length === 1) {
      map.easeTo({ center: [list[0].venue.lng, list[0].venue.lat], zoom: 15, duration: 500 });
      return;
    }
    const bounds = new lib.LngLatBounds();
    list.forEach((p) => bounds.extend([p.venue.lng, p.venue.lat]));
    map.fitBounds(bounds, { padding: FIT_PADDING, maxZoom: 15, duration: 500 });
  }, [map, fitKey]);

  return (
    <View style={styles.fill}>
      <div ref={containerRef} aria-label="Mapa de casas abertas" role="region" style={{ position: 'absolute', inset: 0 }} />
      <View pointerEvents="none" style={styles.attribution}>
        <Text variant="caption" tone={palette.dusk}>
          {ATTRIBUTION}
        </Text>
      </View>
      {onLocate ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Minha localização" onPress={onLocate} style={styles.locate}>
          <Icon name="compass" size={24} color={palette.bone} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, minHeight: 240, backgroundColor: palette.night },
  attribution: {
    position: 'absolute',
    left: space.sm,
    bottom: space.sm,
    paddingHorizontal: space.sm,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(18,17,16,0.7)',
  },
  note: {
    position: 'absolute',
    left: space.sm,
    top: space.sm,
    paddingHorizontal: space.sm,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(18,17,16,0.7)',
  },
  locate: {
    position: 'absolute',
    right: space.md,
    top: space.md,
    width: hit.min,
    height: hit.min,
    borderRadius: radius.full,
    backgroundColor: palette.soot,
    borderWidth: 1,
    borderColor: palette.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
