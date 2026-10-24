import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import type { CoverKey } from '@/domain/types';
import { useTheme } from '@/theme/ThemeProvider';
import { palette, radius, space } from '@/theme/tokens';
import { Badge } from './Badge';
import { Cover } from './Cover';
import { IconButton } from './IconButton';
import { PressableScale } from './PressableScale';
import { Scrim } from './Scrim';
import { Tag } from './Tag';
import { Text } from './Text';

export interface EventCardProps {
  title: string;
  venueName: string;
  area?: string;
  distanceKm?: number;
  priceLabel?: string;
  dateLabel?: string;
  coverKey: CoverKey;
  saved?: boolean;
  onPress?: () => void;
  onToggleSave?: () => void;
  /** Venue content is an illustrative example (not verified with the venue): shows a visible label and "preço ilustrativo". */
  illustrative?: boolean;
  variant?: 'poster' | 'row';
  /** Row variant: draw a hairline divider underneath. */
  divider?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export const ILLUSTRATIVE_LABEL = 'Exemplo ilustrativo';
export const ILLUSTRATIVE_PRICE = 'preço ilustrativo';

export function formatDistance(km?: number): string | undefined {
  if (km === undefined) return undefined;
  const v = km < 10 ? km.toFixed(1) : String(Math.round(km));
  return `${v.replace('.', ',')} km`;
}

function a11yLabel(p: EventCardProps) {
  const parts = [p.title, p.venueName + (p.area ? `, ${p.area}` : ''), p.dateLabel, p.priceLabel, p.illustrative ? ILLUSTRATIVE_PRICE : undefined, formatDistance(p.distanceKm), p.illustrative ? ILLUSTRATIVE_LABEL : undefined];
  return parts.filter(Boolean).join('. ');
}

export function EventCard(props: EventCardProps) {
  const { colors } = useTheme();
  const { title, venueName, area, distanceKm, priceLabel, dateLabel, coverKey, illustrative, saved, onPress, onToggleSave, variant = 'poster', style, testID } = props;
  const venueLine = area ? `${venueName} · ${area}` : venueName;
  const priceText = priceLabel ? (illustrative ? `${priceLabel} (${ILLUSTRATIVE_PRICE})` : priceLabel) : undefined;
  const metaLine = [priceText, formatDistance(distanceKm)].filter(Boolean).join(' · ');
  const save = onToggleSave ? (
    <IconButton
      icon={saved ? 'heartFilled' : 'heart'}
      label={saved ? 'Remover dos salvos' : 'Salvar evento'}
      selected={saved}
      color={saved ? colors.accent : variant === 'poster' ? palette.bone : colors.text}
      onPress={onToggleSave}
      testID={testID ? `${testID}-save` : undefined}
      style={variant === 'poster' ? styles.saveAbs : undefined}
    />
  ) : null;

  if (variant === 'row') {
    return (
      <View
        testID={testID}
        style={[styles.row, props.divider && { borderBottomWidth: 1, borderBottomColor: colors.border }, style]}>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={a11yLabel(props)}
          onPress={onPress}
          scaleTo={0.99}
          style={styles.rowMain}>
          <Cover coverKey={coverKey} style={styles.rowCover} />
          <View style={styles.rowText}>
            <Text variant="title" numberOfLines={1} style={styles.rowTitle}>
              {title}
            </Text>
            <Text variant="bodySm" tone="textMuted" numberOfLines={1}>
              {venueLine}
            </Text>
            {dateLabel ? (
              <Text variant="mono" numberOfLines={2}>
                {dateLabel}
              </Text>
            ) : null}
            {metaLine ? (
              <Text variant="mono" numberOfLines={2}>
                {metaLine}
              </Text>
            ) : null}
            {illustrative ? <Tag label={ILLUSTRATIVE_LABEL} style={styles.illustrative} /> : null}
          </View>
        </PressableScale>
        {save}
      </View>
    );
  }

  return (
    <View testID={testID} style={[styles.poster, { backgroundColor: colors.surface }, style]}>
      <Pressable accessibilityRole="button" accessibilityLabel={a11yLabel(props)} onPress={onPress} style={StyleSheet.absoluteFill}>
        <Cover coverKey={coverKey} style={StyleSheet.absoluteFill} />
        <Scrim />
        {dateLabel ? <Badge label={dateLabel} tone="accent" style={styles.dateBadge} /> : null}
        {illustrative ? <Tag label={ILLUSTRATIVE_LABEL} style={[styles.illustrative, styles.illustrativeAbs, { top: dateLabel ? 56 : 14 }]} /> : null}
        <View style={styles.posterText}>
          <Text variant="title" tone={palette.bone} numberOfLines={2} style={styles.posterTitle}>
            {title}
          </Text>
          <Text variant="bodySm" tone="#E4DFD8" numberOfLines={1}>
            {venueLine}
          </Text>
          {metaLine ? (
            <Text variant="mono" tone={palette.bone}>
              {metaLine}
            </Text>
          ) : null}
        </View>
      </Pressable>
      {save}
    </View>
  );
}

const styles = StyleSheet.create({
  poster: { width: 264, height: 240, borderRadius: radius.lg, overflow: 'hidden' },
  illustrative: { marginTop: 2 },
  illustrativeAbs: { position: 'absolute', left: 14 },
  dateBadge: { position: 'absolute', left: 14, top: 14 },
  saveAbs: { position: 'absolute', right: 6, top: 6 },
  posterText: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: space.lg, gap: space.xs },
  posterTitle: { fontWeight: '700' },
  row: { minHeight: 88, flexDirection: 'row', alignItems: 'center', paddingVertical: space.sm },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 72 },
  rowCover: { width: 72, height: 72, borderRadius: 14 },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 17, lineHeight: 22 },
});
