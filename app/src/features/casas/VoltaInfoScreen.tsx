import { useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { View } from 'react-native';

import { useReturnInfo, useSaveReturnInfo } from '@/data/casas';
import { casasErrorMessage } from '@/domain/casas';
import {
  LIT_STREET_OPTIONS,
  PARKING_OPTIONS,
  RETURN_TEXT_MAX,
  returnTextError,
  type LitStreet,
  type Parking,
  type ReturnInfo,
} from '@/domain/returnInfo';
import { Button, Chip, EmptyState, ErrorState, Skeleton, Text, TextField } from '@/ui';
import { accountVenueName } from './format';
import { Caption, CasasShell, Note, casasStyles } from './parts';
import { useCurrentAccount } from './store';

const TITLE = 'Informações de volta';

/** /casas/volta: the casa tells how people get home safely (S8). Free, any plan; shown on the venue page. */
export function VoltaInfoScreen() {
  const router = useRouter();
  const { loading, failed, query, account } = useCurrentAccount();
  const saved = useReturnInfo(account?.venue ?? null);
  const save = useSaveReturnInfo();
  // null until edited: the saved value shows without copying it into state from an effect.
  const [draft, setDraft] = useState<ReturnInfo | null>(null);
  const [tried, setTried] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const back = () => router.back();
  const shell = (body: ReactNode) => (
    <CasasShell title={TITLE} onBack={back} testID="casas-volta">
      {body}
    </CasasShell>
  );
  if (loading || (account?.venue && saved.isPending)) {
    return shell(
      <View style={casasStyles.gap} testID="casas-volta-loading">
        <Skeleton height={28} width={220} radius={14} />
        <Skeleton height={160} radius={16} />
      </View>,
    );
  }
  if (failed || saved.isError) {
    return shell(<ErrorState inline message="Não foi possível carregar as informações." onRetry={() => void (failed ? query.refetch() : saved.refetch())} />);
  }
  if (!account) {
    return shell(
      <EmptyState title="Você ainda não tem uma casa" message="Cadastre sua casa para preencher as informações de volta." actionLabel="Cadastrar casa" onAction={() => router.replace('/casas')} />,
    );
  }

  const blocked =
    account.status !== 'verified' ? casasErrorMessage('account_not_verified') : !account.venue ? casasErrorMessage('venue_missing') : null;
  const info: ReturnInfo = draft ?? saved.data ?? {};
  const edit = (patch: Partial<ReturnInfo>) => {
    setDone(false);
    setDraft({ ...info, ...patch });
  };
  const rideErr = tried ? returnTextError(info.ridesharePoint ?? '') : null;
  const busErr = tried ? returnTextError(info.busStop ?? '') : null;

  const submit = async () => {
    setTried(true);
    setError(null);
    setDone(false);
    if (returnTextError(info.ridesharePoint ?? '') || returnTextError(info.busStop ?? '')) return;
    const res = await save.mutateAsync({ accountId: account.id, info });
    if (!res.ok) return setError(res.error);
    setDraft(null);
    setDone(true);
  };

  return (
    <CasasShell
      title={TITLE}
      onBack={back}
      testID="casas-volta"
      footer={
        <>
          <Note tone="error" text={error ?? blocked} testID="casas-volta-erro" />
          <Note text={done ? 'Salvo. Já aparece na página da casa.' : null} testID="casas-volta-salvo" />
          <Button label="Salvar" icon="check" fullWidth disabled={!!blocked || save.isPending} loading={save.isPending} onPress={() => void submit()} testID="casas-volta-salvar" />
        </>
      }>
      <Text variant="headline" accessibilityRole="header">
        {accountVenueName(account)}
      </Text>
      <Text variant="bodySm" tone="textMuted">
        Ajude quem sai da sua casa a voltar com segurança. Tudo aparece na página da casa em “Na volta”. É gratuito e vale
        para qualquer plano. Deixe em branco o que não souber.
      </Text>

      <Caption style={casasStyles.section}>EMBARQUE DE APP</Caption>
      <TextField
        label="Onde esperar o carro de aplicativo"
        value={info.ridesharePoint ?? ''}
        onChangeText={(t) => edit({ ridesharePoint: t })}
        maxLength={RETURN_TEXT_MAX + 20}
        placeholder="Ex.: na esquina, em frente à farmácia"
        error={rideErr ?? undefined}
        testID="casas-volta-embarque"
      />

      <Caption style={casasStyles.section}>ILUMINAÇÃO DA RUA</Caption>
      <View style={casasStyles.row} accessibilityRole="radiogroup" accessibilityLabel="Iluminação da rua">
        {LIT_STREET_OPTIONS.map((o) => (
          <Chip
            key={o.value}
            label={o.label}
            selected={info.litStreet === o.value}
            onPress={() => edit({ litStreet: info.litStreet === o.value ? undefined : (o.value as LitStreet) })}
            testID={`casas-volta-rua-${o.value}`}
          />
        ))}
      </View>

      <Caption style={casasStyles.section}>ÔNIBUS</Caption>
      <TextField
        label="Ponto de ônibus mais perto"
        value={info.busStop ?? ''}
        onChangeText={(t) => edit({ busStop: t })}
        maxLength={RETURN_TEXT_MAX + 20}
        placeholder="Ex.: Av. Rio Branco, a 2 quadras"
        error={busErr ?? undefined}
        testID="casas-volta-onibus"
      />

      <Caption style={casasStyles.section}>ESTACIONAMENTO</Caption>
      <View style={casasStyles.row} accessibilityRole="radiogroup" accessibilityLabel="Estacionamento">
        {PARKING_OPTIONS.map((o) => (
          <Chip
            key={o.value}
            label={o.label}
            selected={info.parking === o.value}
            onPress={() => edit({ parking: info.parking === o.value ? undefined : (o.value as Parking) })}
            testID={`casas-volta-estacionamento-${o.value}`}
          />
        ))}
      </View>
    </CasasShell>
  );
}
