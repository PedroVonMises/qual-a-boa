import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type * as MapLibre from '@maplibre/maplibre-react-native';

import { Icon, Text } from '@/ui';
import { hit, palette, radius, space } from '@/theme/tokens';
import { ATTRIBUTION, DEFAULT_ZOOM, MAX_ZOOM, MIN_ZOOM, PILOT_BOUNDS } from './mapConfig';
import { MAP_STYLE } from './mapStyle';
import type { VenueMapProps } from './mapTypes';
import { pinLabel, type VenuePin } from './pins';
import { VenueMapSchematic } from './VenueMapSchematic';

type MapLibreModule = typeof MapLibre;

const FALLBACK_NOTE = 'Mapa simplificado (sem conexão com os mapas)';
/** If the style has not reported loaded by then, show the schematic map instead of a blank view. */
const STYLE_TIMEOUT_MS = 15000;
const FIT_PADDING = { top: 96, right: 48, bottom: 200, left: 48 };

/** The native module is missing in jest, Expo Go and web: resolve it lazily and never throw. */
function loadMapLibre(): MapLibreModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('@maplibre/maplibre-react-native') as Partial<MapLibreModule>;
    return mod?.Map && mod?.Camera && mod?.Marker ? (mod as MapLibreModule) : null;
  } catch {
    return null;
  }
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

export function VenueMap(props: VenueMapProps) {
  const [lib] = useState(loadMapLibre);
  const [failed, setFailed] = useState(false);
  const onFail = useCallback(() => setFailed(true), []);
  if (!lib || failed) return <SimplifiedMap {...props} />;
  return <NativeVenueMap {...props} lib={lib} onFail={onFail} />;
}

function NativeVenueMap({
  lib,
  onFail,
  pins,
  selectedId,
  onSelect,
  center,
  userLocation,
  onLocate,
  fitKey,
}: VenueMapProps & { lib: MapLibreModule; onFail: () => void }) {
  const { Map, Camera, Marker } = lib;
  const cameraRef = useRef<MapLibre.CameraRef>(null);
  const pinsRef = useRef(pins);
  useEffect(() => {
    pinsRef.current = pins;
  });
  const styleLoaded = useRef(false);
  const firstCenter = useRef(true);

  useEffect(() => {
    const t = setTimeout(() => {
      if (!styleLoaded.current) onFail();
    }, STYLE_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [onFail]);

  // Animate to `center` when it changes (the initial view already starts there).
  useEffect(() => {
    if (firstCenter.current) {
      firstCenter.current = false;
      return;
    }
    cameraRef.current?.easeTo({ center: [center.lng, center.lat], duration: 500 });
  }, [center.lat, center.lng]);

  // Fit all pins when the set changes in a way that should refit. Declared after the center effect so it wins.
  useEffect(() => {
    const list = pinsRef.current;
    if (list.length === 0) return;
    if (list.length === 1) {
      cameraRef.current?.easeTo({ center: [list[0].venue.lng, list[0].venue.lat], zoom: 15, duration: 500 });
      return;
    }
    const lngs = list.map((p) => p.venue.lng);
    const lats = list.map((p) => p.venue.lat);
    cameraRef.current?.fitBounds([Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)], {
      padding: FIT_PADDING,
      duration: 500,
    });
  }, [fitKey]);

  return (
    <View style={styles.fill}>
      <Map
        style={styles.fill}
        mapStyle={MAP_STYLE as unknown as MapLibre.MapProps['mapStyle']}
        logo={false}
        attribution={false}
        compass={false}
        touchRotate={false}
        touchPitch={false}
        accessibilityLabel="Mapa de casas abertas"
        onDidFinishLoadingStyle={() => {
          styleLoaded.current = true;
        }}
        onDidFailLoadingMap={onFail}>
        <Camera
          ref={cameraRef}
          initialViewState={{ center: [center.lng, center.lat], zoom: DEFAULT_ZOOM }}
          minZoom={MIN_ZOOM}
          maxZoom={MAX_ZOOM}
          maxBounds={PILOT_BOUNDS}
        />
        {userLocation ? (
          <Marker id="user-location" lngLat={[userLocation.lng, userLocation.lat]}>
            <View accessibilityLabel="Você está aqui" style={styles.user} />
          </Marker>
        ) : null}
        {pins.map((pin) => {
          const selected = pin.venue.id === selectedId;
          return (
            <Marker
              key={pin.venue.id}
              id={pin.venue.id}
              lngLat={[pin.venue.lng, pin.venue.lat]}
              anchor="bottom"
              onPress={() => onSelect(pin.venue.id)}>
              <PinPill pin={pin} selected={selected} />
            </Marker>
          );
        })}
      </Map>
      <View pointerEvents="none" style={styles.attribution}>
        <Text variant="caption" tone={palette.dusk}>
          {ATTRIBUTION}
        </Text>
      </View>
      {onLocate ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Minha localização"
          onPress={onLocate}
          style={styles.locate}>
          <Icon name="compass" size={24} color={palette.bone} />
        </Pressable>
      ) : null}
    </View>
  );
}

/** Pill marker. Selected = larger, heavier label and a check icon, so selection never relies on color alone. */
function PinPill({ pin, selected }: { pin: VenuePin; selected: boolean }) {
  const badge = pin.rank != null ? `${pin.rank}` : pin.recommended ? null : undefined;
  return (
    <View accessible accessibilityRole="button" accessibilityLabel={pinLabel(pin)} accessibilityState={{ selected }} style={styles.pinHit}>
      <View style={[styles.pill, selected ? styles.pillSelected : styles.pillIdle]}>
        {selected ? <Icon name="check" size={18} color={palette.riotInk} strokeWidth={2.5} /> : null}
        <Text
          variant={selected ? 'body' : 'bodySm'}
          tone={selected ? palette.riotInk : palette.night}
          style={selected ? styles.nameSelected : styles.name}
          numberOfLines={1}>
          {pin.venue.name}
        </Text>
        {badge !== undefined ? (
          <View style={styles.badge} testID="pin-badge">
            {badge === null ? <Icon name="starFilled" size={12} color={palette.night} /> : <Text variant="caption" tone={palette.night} style={styles.badgeText}>{badge}</Text>}
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  pinHit: { minHeight: hit.min, minWidth: hit.min, justifyContent: 'center', alignItems: 'center' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    maxWidth: 180,
    paddingHorizontal: space.md,
    borderRadius: radius.full,
  },
  pillIdle: { minHeight: 32, backgroundColor: palette.bone },
  pillSelected: { minHeight: hit.min, backgroundColor: palette.riotPink, borderWidth: 2, borderColor: palette.bone, paddingHorizontal: space.lg },
  name: { fontWeight: '600', flexShrink: 1 },
  nameSelected: { fontWeight: '800', flexShrink: 1 },
  badge: {
    minWidth: 18,
    height: 18,
    borderRadius: radius.full,
    backgroundColor: palette.amber,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontWeight: '700', lineHeight: 16 },
  user: { width: 18, height: 18, borderRadius: radius.full, backgroundColor: palette.riotPink, borderWidth: 3, borderColor: palette.bone },
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
