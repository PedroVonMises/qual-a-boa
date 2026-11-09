import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useSearchEvents } from '@/data/queries';
import type { Venue } from '@/domain/types';
import { AddressForm, addressFieldErrors, EMPTY_DRAFT, type AddressDraft, type AddressErrors } from '@/features/dadosCadastrais';
import { useLocation } from '@/state/location';
import { space } from '@/theme/tokens';
import { Button, ErrorState, SearchBar, Skeleton, Text, TextField, VenueRow } from '@/ui';
import { matchVenues, proposedAddress } from './format';
import { Caption, CasasShell, Note, StepBar } from './parts';
import { useCasasFlow } from './store';

const SEARCH_RADIUS_KM = 25;
const DEBOUNCE_MS = 250;

function useDebounced(value: string) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [value]);
  return v;
}

/** /casas/vincular (1/3): find the casa in the catalog, or describe a new one. */
export function VincularScreen() {
  const router = useRouter();
  const setVenue = useCasasFlow((s) => s.setVenue);
  const location = useLocation((s) => s.location);
  const [text, setText] = useState('');
  const query = useDebounced(text.trim());
  const [now] = useState(() => new Date().toISOString());
  const [mode, setMode] = useState<'search' | 'new'>('search');

  const params = useMemo(
    () => ({ lat: location.lat, lng: location.lng, radiusKm: SEARCH_RADIUS_KM, sort: 'date' as const, query, limit: 50, now }),
    [location.lat, location.lng, query, now],
  );
  const search = useSearchEvents(params);
  const venues = useMemo(
    () => (query ? matchVenues(search.data?.pages.flatMap((p) => p.items) ?? [], query) : []),
    [search.data, query],
  );

  // New casa form.
  const [name, setName] = useState('');
  const [addr, setAddr] = useState<AddressDraft>(EMPTY_DRAFT);
  const [errors, setErrors] = useState<{ name?: string; address: AddressErrors }>({ address: {} });

  const pick = (v: Venue) => {
    setVenue({ kind: 'catalog', id: v.id, name: v.name, area: v.area });
    router.push('/casas/vincular/empresa');
  };

  const onContinueNew = () => {
    const next: typeof errors = { address: addressFieldErrors(addr) };
    const n = name.trim().length;
    if (n < 2 || n > 120) next.name = 'Digite o nome da casa (de 2 a 120 letras).';
    setErrors(next);
    if (next.name || Object.keys(next.address).length) return;
    setVenue({
      kind: 'new',
      proposed: { name: name.trim(), address: proposedAddress(addr), bairro: addr.district.trim(), cep: addr.cep.trim() },
    });
    router.push('/casas/vincular/empresa');
  };

  const hasErrors = !!errors.name || Object.keys(errors.address).length > 0;

  return (
    <CasasShell
      title="Vincular casa"
      onBack={() => (mode === 'new' ? setMode('search') : router.back())}
      testID="casas-vincular"
      footer={
        mode === 'new' ? (
          <>
            <Note tone="error" text={hasErrors ? 'Confira os campos marcados.' : null} testID="casas-nova-note" />
            <Button label="Continuar" fullWidth onPress={onContinueNew} testID="casas-nova-continuar" />
          </>
        ) : undefined
      }>
      <StepBar step={1} total={3} label="Sua casa" />
      {mode === 'search' ? (
        <>
          <Text variant="headline" accessibilityRole="header">
            Qual é a sua casa?
          </Text>
          <SearchBar
            value={text}
            onChangeText={setText}
            onClear={() => setText('')}
            placeholder="Buscar sua casa"
            label="Buscar sua casa"
            testID="casas-busca"
          />
          {query && search.isPending ? (
            <View style={styles.list} testID="casas-busca-loading">
              <Skeleton height={72} radius={14} />
              <Skeleton height={72} radius={14} />
            </View>
          ) : query && search.isError ? (
            <ErrorState inline message="Não foi possível buscar agora." onRetry={() => void search.refetch()} />
          ) : (
            <View style={styles.list}>
              {venues.map((v, i) => (
                <VenueRow
                  key={v.id}
                  name={v.name}
                  area={v.area}
                  coverKey={v.coverKey}
                  onPress={() => pick(v)}
                  divider={i < venues.length - 1}
                  testID={`casas-venue-${v.slug}`}
                />
              ))}
              {query && !venues.length ? (
                <Text variant="bodySm" tone="textMuted" testID="casas-busca-vazio">
                  {`Nenhuma casa com “${query}”. Confira o nome ou cadastre a sua abaixo.`}
                </Text>
              ) : null}
            </View>
          )}
          <Button label="Minha casa não está aqui" variant="secondary" icon="plus" onPress={() => setMode('new')} testID="casas-nao-esta" />
        </>
      ) : (
        <>
          <Text variant="headline" accessibilityRole="header">
            Casa nova
          </Text>
          <Text variant="bodySm" tone="textMuted">
            A gente confere os dados e coloca sua casa no mapa antes da primeira festa.
          </Text>
          <TextField
            label="Nome da casa"
            value={name}
            onChangeText={setName}
            maxLength={120}
            placeholder="Como aparece na fachada"
            error={errors.name}
            testID="casas-nova-nome"
          />
          <Caption style={styles.section}>ENDEREÇO</Caption>
          <AddressForm value={addr} onChange={setAddr} errors={errors.address} testID="casas-endereco" />
        </>
      )}
    </CasasShell>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.sm },
  section: { marginTop: space.md },
});
