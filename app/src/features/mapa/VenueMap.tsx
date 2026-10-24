import { Platform, StyleSheet, View } from 'react-native';
import type MapViewType from 'react-native-maps';

import { Text } from '@/ui';
import { useTheme } from '@/theme/ThemeProvider';
import { hit, radius, space } from '@/theme/tokens';
import type { VenueMapProps } from './mapTypes';
import { pinLabel } from './pins';
import { VenueMapSchematic } from './VenueMapSchematic';

const DELTA = 0.06;

/**
 * Android's react-native-maps uses Google Maps and crashes the whole app when no API key is in the manifest, so
 * without EXPO_PUBLIC_GOOGLE_MAPS_API_KEY (see app.config) we draw the schematic map instead. iOS uses Apple Maps.
 */
const canUseNativeMap = Platform.OS !== 'android' || !!process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

export function VenueMap(props: VenueMapProps) {
  return canUseNativeMap ? <NativeVenueMap {...props} /> : <VenueMapSchematic {...props} />;
}

/** Native map: pill markers with the venue name; selected pin is pink. */
function NativeVenueMap({ pins, selectedId, onSelect, center, userLocation }: VenueMapProps) {
  const { colors } = useTheme();
  // Required lazily so the native module is only touched when the native map is really used.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { default: MapView, Marker } = require('react-native-maps') as { default: typeof MapViewType; Marker: typeof import('react-native-maps').Marker };
  return (
    <MapView
      style={styles.map}
      initialRegion={{ latitude: center.lat, longitude: center.lng, latitudeDelta: DELTA, longitudeDelta: DELTA }}
      showsUserLocation={!!userLocation}
      accessibilityLabel="Mapa de casas abertas">
      {pins.map((pin) => {
        const selected = pin.venue.id === selectedId;
        return (
          <Marker
            key={`${pin.venue.id}-${selected}`}
            coordinate={{ latitude: pin.venue.lat, longitude: pin.venue.lng }}
            accessibilityLabel={pinLabel(pin)}
            onPress={() => onSelect(pin.venue.id)}
            tracksViewChanges={false}>
            <View style={[styles.pill, { backgroundColor: selected ? colors.accent : colors.text }]}>
              <Text variant="bodySm" tone={selected ? colors.onAccent : colors.background} style={styles.name}>
                {pin.venue.name}
              </Text>
            </View>
          </Marker>
        );
      })}
    </MapView>
  );
}

const styles = StyleSheet.create({
  map: { flex: 1 },
  pill: { minHeight: hit.min - 12, paddingHorizontal: space.md, borderRadius: radius.full, justifyContent: 'center' },
  name: { fontWeight: '600' },
});
