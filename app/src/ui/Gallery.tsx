import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import type { CoverKey } from '@/domain/types';
import { space } from '@/theme/tokens';
import {
  AnimatedLogo, ArtistRow, Badge, Button, Chip, Cover, EmptyState, ErrorState, EventCard, EventCardSkeleton, Icon,
  IconButton, ListRow, Logo, Rating, Screen, ScreenHeader, ScoreBar, SearchBar, SegmentedControl, Sheet, Shelf,
  Skeleton, Switch, Tag, Text, VenueRow, Wordmark, type IconName,
} from './index';

const COVERS: CoverKey[] = ['bolt', 'selva', 'gordinho', 'pub426', 'caipora', 'fluente', 'mare', 'generic'];
const ICONS: IconName[] = [
  'search', 'pin', 'heart', 'heartFilled', 'bookmark', 'compass', 'map', 'user', 'chevronLeft', 'chevronRight', 'chevronDown',
  'close', 'check', 'filter', 'share', 'send', 'paperclip', 'star', 'starFilled', 'headset', 'clock', 'plus',
];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text variant="headline" accessibilityRole="header">
        {title}
      </Text>
      {children}
    </View>
  );
}

const Row = ({ children }: { children: ReactNode }) => <View style={styles.row}>{children}</View>;

/** Dev-only gallery: every component in every state. Mount on a hidden route. */
export function Gallery() {
  const [chip, setChip] = useState(true);
  const [on, setOn] = useState(true);
  const [seg, setSeg] = useState('hoje');
  const [rate, setRate] = useState(4);
  const [q, setQ] = useState('');
  const [sheet, setSheet] = useState(false);
  const [saved, setSaved] = useState(false);
  const [logoKey, setLogoKey] = useState(0);

  return (
    <Screen scroll contentStyle={styles.page}>
      <ScreenHeader title="Galeria" onBack={() => {}} right={<IconButton icon="share" label="Compartilhar" />} />

      <Section title="Marca">
        <Row>
          <Logo size={64} variant="color" />
          <Logo size={64} variant="mono" />
          <Logo size={64} variant="neon" />
          <Logo size={64} variant="off" />
        </Row>
        <Wordmark />
        <AnimatedLogo key={logoKey} size={96} onDone={() => {}} />
        <Button label="Repetir animação" variant="ghost" onPress={() => setLogoKey((k) => k + 1)} />
      </Section>

      <Section title="Texto">
        {(['display', 'headline', 'title', 'body', 'bodySm', 'caption', 'mono'] as const).map((v) => (
          <Text key={v} variant={v}>
            {v}: Qual a boa hoje? R$ 40 · 1,2 km
          </Text>
        ))}
      </Section>

      <Section title="Ícones">
        <Row>
          {ICONS.map((n) => (
            <Icon key={n} name={n} size={24} />
          ))}
        </Row>
      </Section>

      <Section title="Botões">
        <Button label="Primário" />
        <Button label="Secundário" variant="secondary" />
        <Button label="Ghost" variant="ghost" />
        <Button label="Com ícone" icon="send" />
        <Button label="Carregando" loading />
        <Button label="Desativado" disabled />
        <Row>
          <IconButton icon="heart" label="Salvar" />
          <IconButton icon="filter" label="Filtros" variant="filled" />
          <IconButton icon="plus" label="Adicionar" variant="accent" />
          <IconButton icon="close" label="Fechar" disabled />
        </Row>
      </Section>

      <Section title="Chips, tags, badges">
        <Row>
          <Chip label="Tudo" selected={chip} onPress={() => setChip(!chip)} />
          <Chip label="Funk" count={12} />
          <Chip label="Desativado" disabled />
        </Row>
        <Row>
          <Tag label="Pagode" />
          <Tag label="Eletrônica" />
        </Row>
        <Row>
          <Badge label="Hoje · 21h" tone="accent" />
          <Badge label="Grátis" tone="success" icon="check" />
          <Badge label="Esgotado" tone="danger" icon="close" />
          <Badge label="Aberto agora" />
        </Row>
      </Section>

      <Section title="Campos">
        <SearchBar value={q} onChangeText={setQ} placeholder="Bolt, A Selva, Pub 426..." />
        <SegmentedControl
          label="Quando"
          value={seg}
          onChange={setSeg}
          options={[{ value: 'hoje', label: 'Hoje' }, { value: 'semana', label: 'Semana' }, { value: 'mes', label: 'Mês' }]}
        />
        <Switch label="Só eventos grátis" value={on} onValueChange={setOn} />
        <Switch label="Avisos" value={false} onValueChange={() => {}} />
        <Switch label="Desativado" value disabled onValueChange={() => {}} />
      </Section>

      <Section title="Avaliação">
        <Rating value={rate} onChange={setRate} />
        <Rating value={4.6} count={128} />
        <ScoreBar label="Som" value={4.6} />
        <ScoreBar label="Fila" value={2.8} />
      </Section>

      <Section title="Linhas">
        <ListRow title="Ajuda" subtitle="Dúvidas comuns" icon="headset" chevron onPress={() => {}} divider />
        <ListRow title="Notificações" value="Ligadas" onPress={() => {}} />
        <VenueRow name="Bolt" area="Praia do Canto" distanceKm={0.5} genres={['Pop', 'Funk']} statusLabel="Aberto agora" coverKey="bolt" onPress={() => {}} divider />
        <ArtistRow name="DJ Maré" subtitle="Eletrônica" playedLabel="12 set" onPress={() => {}} divider />
        <ArtistRow name="Lovy" subtitle="Pop" />
      </Section>

      <Section title="Capas">
        <Row>
          {COVERS.map((k) => (
            <Cover key={k} coverKey={k} style={styles.cover} />
          ))}
        </Row>
      </Section>

      <Section title="Cartões">
        <Shelf
          title="Hoje à noite"
          actionLabel="ver todos"
          onAction={() => {}}
          gutter={0}
          data={COVERS.slice(0, 4)}
          keyExtractor={(k) => k}
          renderItem={({ item }) => (
            <EventCard
              title="Noite 80s e 90s"
              venueName="Pub 426"
              area="Praia do Canto"
              distanceKm={0.5}
              priceLabel="R$ 20"
              dateLabel="Hoje · 21h"
              coverKey={item}
              saved={saved}
              onPress={() => {}}
              onToggleSave={() => setSaved(!saved)}
            />
          )}
        />
        <EventCard
          variant="row"
          title="Roda de Pagode"
          venueName="Gordinho"
          area="Centro"
          priceLabel="R$ 30"
          coverKey="gordinho"
          divider
          saved={saved}
          onPress={() => {}}
          onToggleSave={() => setSaved(!saved)}
        />
      </Section>

      <Section title="Carregando, vazio, erro">
        <EventCardSkeleton />
        <EventCardSkeleton variant="row" />
        <Skeleton height={20} width="60%" />
        <EmptyState title="Nada por aqui" message="Aumente o raio para 10 km" actionLabel="Aumentar raio" onAction={() => {}} />
        <ErrorState onRetry={() => {}} />
        <ErrorState inline title="Sem conexão" message="Mostrando resultados salvos." onRetry={() => {}} />
      </Section>

      <Section title="Sheet">
        <Button label="Abrir sheet" variant="secondary" onPress={() => setSheet(true)} />
        <Sheet
          visible={sheet}
          onClose={() => setSheet(false)}
          title="Filtros"
          footer={
            <>
              <Button label="Limpar" variant="secondary" onPress={() => setSheet(false)} style={styles.flex} />
              <Button label="Ver 12 eventos" onPress={() => setSheet(false)} style={styles.flex} />
            </>
          }>
          <Switch label="Só eventos grátis" value={on} onValueChange={setOn} />
        </Sheet>
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: { paddingBottom: 96, gap: space.xxxl },
  section: { gap: space.md },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.md },
  cover: { width: 80, height: 100, borderRadius: 12 },
  flex: { flex: 1 },
});
