import { Image } from 'expo-image';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { space } from '@/theme/tokens';
import { Icon } from './Icon';
import { PressableScale } from './PressableScale';
import { Text } from './Text';

export interface ArtistRowProps {
  name: string;
  /** e.g. genre line. */
  subtitle?: string;
  /** "Já tocou aqui" variant: date in mono, e.g. "12 set 2026". */
  playedLabel?: string;
  imageUri?: string;
  onPress?: () => void;
  divider?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');
}

export function ArtistRow({ name, subtitle, playedLabel, imageUri, onPress, divider, style, testID }: ArtistRowProps) {
  const { colors } = useTheme();
  const content = (
    <>
      <View style={[styles.avatar, { backgroundColor: colors.surfaceAlt }]}>
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={styles.avatar} contentFit="cover" accessibilityLabel={`Foto de ${name}`} />
        ) : (
          <Text variant="bodySm" tone="textMuted">
            {initials(name)}
          </Text>
        )}
      </View>
      <View style={styles.text}>
        <Text variant="body" numberOfLines={1} style={styles.name}>
          {name}
        </Text>
        {subtitle ? (
          <Text variant="bodySm" tone="textMuted" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {playedLabel ? (
        <Text variant="mono" tone="textMuted">
          {playedLabel}
        </Text>
      ) : null}
      {onPress ? <Icon name="chevronRight" size={20} color="textMuted" /> : null}
    </>
  );
  const rowStyle = [styles.row, divider && { borderBottomWidth: 1, borderBottomColor: colors.border }, style];
  if (!onPress) {
    return (
      <View testID={testID} style={rowStyle}>
        {content}
      </View>
    );
  }
  return (
    <PressableScale
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={[name, subtitle, playedLabel ? `já tocou aqui em ${playedLabel}` : undefined].filter(Boolean).join('. ')}
      onPress={onPress}
      scaleTo={0.99}
      style={rowStyle}>
      {content}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  text: { flex: 1 },
  name: { fontWeight: '600' },
});
