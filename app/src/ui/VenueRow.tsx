import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import type { CoverKey } from '@/domain/types';
import { useTheme } from '@/theme/ThemeProvider';
import { space } from '@/theme/tokens';
import { Badge } from './Badge';
import { Cover } from './Cover';
import { formatDistance } from './EventCard';
import { Icon } from './Icon';
import { PressableScale } from './PressableScale';
import { Tag } from './Tag';
import { Text } from './Text';

export interface VenueRowProps {
  name: string;
  area?: string;
  distanceKm?: number;
  genres?: string[];
  /** Spelled-out status, e.g. "Aberto agora". */
  statusLabel?: string;
  coverKey: CoverKey;
  onPress?: () => void;
  divider?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function VenueRow({ name, area, distanceKm, genres, statusLabel, coverKey, onPress, divider, style, testID }: VenueRowProps) {
  const { colors } = useTheme();
  const dist = formatDistance(distanceKm);
  const sub = [area, dist].filter(Boolean).join(' · ');
  return (
    <PressableScale
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={[name, sub, statusLabel].filter(Boolean).join('. ')}
      onPress={onPress}
      scaleTo={0.99}
      style={[styles.row, divider && { borderBottomWidth: 1, borderBottomColor: colors.border }, style]}>
      <Cover coverKey={coverKey} style={styles.cover} />
      <View style={styles.text}>
        <Text variant="title" numberOfLines={1} style={styles.name}>
          {name}
        </Text>
        {sub ? (
          <Text variant="bodySm" tone="textMuted" numberOfLines={1}>
            {sub}
          </Text>
        ) : null}
        <View style={styles.tags}>
          {statusLabel ? <Badge label={statusLabel} tone="success" icon="check" /> : null}
          {genres?.slice(0, 2).map((g) => <Tag key={g} label={g} />)}
        </View>
      </View>
      <Icon name="chevronRight" size={20} color="textMuted" />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: 88, flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm },
  cover: { width: 72, height: 72, borderRadius: 14 },
  text: { flex: 1, gap: 2 },
  name: { fontSize: 17, lineHeight: 22 },
  tags: { flexDirection: 'row', gap: space.sm, flexWrap: 'wrap', marginTop: space.xs },
});
