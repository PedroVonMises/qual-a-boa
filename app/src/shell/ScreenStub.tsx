import { Link, type Href } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fonts, hit, palette, radius, space, type } from '@/theme/tokens';

export type StubLink = { label: string; href: Href };

type Props = {
  title: string;
  routeName: string;
  params?: Record<string, string | string[] | undefined>;
  links?: StubLink[];
};

/** Placeholder body for every route. Later waves replace the screen bodies, not the route files' names. */
export function ScreenStub({ title, routeName, params = {}, links = [] }: Props) {
  const insets = useSafeAreaInsets();
  const entries = Object.entries(params);
  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={{ padding: space.xxl, paddingTop: insets.top + space.xxl, paddingBottom: insets.bottom + space.xxl, gap: space.md }}>
      <Text style={styles.route}>{routeName}</Text>
      <Text accessibilityRole="header" style={styles.title}>
        {title}
      </Text>
      <Text style={styles.muted}>Tela em construção.</Text>
      <View style={styles.card}>
        <Text style={styles.muted}>Parâmetros</Text>
        <Text style={styles.mono}>{entries.length ? JSON.stringify(params) : '(nenhum)'}</Text>
      </View>
      {links.map((l) => (
        <Link key={l.label} href={l.href} style={styles.link} accessibilityRole="link">
          {l.label}
        </Link>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.night },
  route: { color: palette.dusk, fontFamily: fonts.mono, ...type.bodySm },
  title: { color: palette.bone, fontFamily: fonts.display, ...type.display },
  muted: { color: palette.dusk, fontFamily: fonts.body, ...type.bodySm },
  mono: { color: palette.bone, fontFamily: fonts.mono, ...type.bodySm },
  card: { backgroundColor: palette.soot, borderRadius: radius.lg, padding: space.lg, gap: space.xs },
  link: {
    color: palette.riotPink,
    fontFamily: fonts.bodySemi,
    ...type.body,
    minHeight: hit.min,
    paddingVertical: space.md,
  },
});
