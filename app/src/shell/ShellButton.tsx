import { Pressable, StyleSheet, Text } from 'react-native';

import { fonts, hit, palette, radius, type } from '@/theme/tokens';

type Props = { label: string; onPress: () => void; variant?: 'primary' | 'secondary' };

/** Temporary shell button. TODO(orchestrator): replace with the ui Button. */
export function ShellButton({ label, onPress, variant = 'primary' }: Props) {
  const primary = variant === 'primary';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: primary ? palette.riotPink : palette.ash, opacity: pressed ? 0.85 : 1 },
      ]}>
      <Text style={[styles.text, { color: primary ? palette.riotInk : palette.bone }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { minHeight: hit.button, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  text: { fontFamily: fonts.bodySemi, ...type.body },
});
