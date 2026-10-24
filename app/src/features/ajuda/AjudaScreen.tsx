import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { useSupport } from '@/state/support';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';
import { Button, EmptyState, Icon, PressableScale, Screen, ScreenHeader, SearchBar, Text } from '@/ui';
import { commonFaq, searchFaq, type FaqItem } from './faq';
import { ResponseTime } from './parts';

function FaqRow({ item, open, onToggle }: { item: FaqItem; open: boolean; onToggle: () => void }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.faq, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={item.question}
        accessibilityState={{ expanded: open }}
        onPress={onToggle}
        scaleTo={0.99}
        style={styles.faqHead}>
        <Text variant="body" style={styles.flex}>
          {item.question}
        </Text>
        <Icon name={open ? 'chevronDown' : 'chevronRight'} size={20} color="textMuted" />
      </PressableScale>
      {open ? (
        <Text variant="bodySm" tone="textMuted" style={styles.answer}>
          {item.answer}
        </Text>
      ) : null}
    </View>
  );
}

/** Ajuda: search the static FAQ, common topics, open-ticket CTA. */
export function AjudaScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const openCount = useSupport((s) => s.tickets.filter((t) => t.status !== 'closed').length);
  const searching = query.trim().length > 0;
  const items = searching ? searchFaq(query) : commonFaq();

  return (
    <Screen testID="ajuda-screen">
      <ScreenHeader title="Ajuda" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.column} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <SearchBar value={query} onChangeText={setQuery} placeholder="Buscar na ajuda" label="Buscar na ajuda" />

        {openCount > 0 ? (
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={`${openCount} ${openCount === 1 ? 'chamado em andamento' : 'chamados em andamento'}. Ver mensagens`}
            onPress={() => router.push('/ajuda/mensagens')}
            style={[styles.banner, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Icon name="headset" size={22} color="accent" />
            <Text variant="body" style={styles.flex}>
              {openCount} {openCount === 1 ? 'chamado em andamento' : 'chamados em andamento'}
            </Text>
            <Icon name="chevronRight" size={20} color="textMuted" />
          </PressableScale>
        ) : null}

        <Text variant="title" accessibilityRole="header">
          {searching ? 'Resultados' : 'Assuntos comuns'}
        </Text>

        {items.length === 0 ? (
          <EmptyState
            title="Nada encontrado"
            message="Tente outras palavras ou fale com a gente."
            actionLabel="Abrir chamado"
            onAction={() => router.push('/ajuda/novo')}
          />
        ) : (
          <View style={styles.list}>
            {items.map((it) => (
              <FaqRow key={it.id} item={it} open={openId === it.id} onToggle={() => setOpenId(openId === it.id ? null : it.id)} />
            ))}
          </View>
        )}

        <View style={styles.cta}>
          <Button label="Falar com o suporte" icon="headset" fullWidth onPress={() => router.push('/ajuda/novo')} />
          <ResponseTime />
          {openCount > 0 ? null : (
            <Button label="Minhas mensagens" variant="ghost" onPress={() => router.push('/ajuda/mensagens')} />
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  column: { gap: space.lg, paddingBottom: space.xxxl },
  flex: { flex: 1 },
  list: { gap: space.sm },
  faq: { borderRadius: radius.md, borderWidth: 1, overflow: 'hidden' },
  faqHead: { minHeight: 56, paddingHorizontal: space.lg, flexDirection: 'row', alignItems: 'center', gap: space.md },
  answer: { paddingHorizontal: space.lg, paddingBottom: space.lg },
  banner: {
    minHeight: 56,
    paddingHorizontal: space.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  cta: { gap: space.md, marginTop: space.sm },
});
