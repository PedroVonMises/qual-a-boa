import { StyleSheet, View } from 'react-native';

import { tagLabel, type AccessTag } from '@/domain/accessTags';
import { space } from '@/theme/tokens';
import { Tag } from '@/ui';

/** Text-only badges for vibe & access tags. Renders nothing when there are none. */
export function AccessBadges({ tags }: { tags: AccessTag[] }) {
  if (!tags.length) return null;
  return (
    <View style={styles.row} accessibilityLabel="Vibe e acesso">
      {tags.map((t) => (
        <Tag key={t} label={tagLabel(t)} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
