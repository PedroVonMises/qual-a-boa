import MapView, { Marker } from 'react-native-maps';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/ui';
import { useTheme } from '@/theme/ThemeProvider';
import { hit, radius, space } from '@/theme/tokens';
import type { VenueMapProps } from './mapTypes';
import { pinLabel } from './pins';

const DELTA = 0.06;

/** Native map: pill markers with the venue name; selected pin is pink. */
export function VenueMap({ pins, selectedId, onSelect, center, userLocation }: VenueMapProps) {
  const { colors } = useTheme();
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
