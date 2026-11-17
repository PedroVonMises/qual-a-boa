import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { POSTER_MAX_BYTES, useDeclareSafetyProtocol, useSafetyProtocol, useUploadPoster } from '@/data/casas';
import { casasErrorMessage } from '@/domain/casas';
import {
  isValidResponsible,
  RESPONSIBLE_MAX,
  SAFETY_PROTOCOL_ABOUT,
  SAFETY_PROTOCOL_COPY,
  SAFETY_PROTOCOL_NAME,
  safetyProtocolPanelLabel,
} from '@/domain/safetyProtocol';
import { Badge, Button, EmptyState, ErrorState, Skeleton, Text, TextField } from '@/ui';
import { accountVenueName, type PosterPick } from './format';
import { Caption, CasasShell, Note, casasStyles } from './parts';
import { useCurrentAccount } from './store';

const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/** /casas/protocolo: the casa declares the "Protocolo Não é Não" and sends a photo of the poster (S1). Free, any plan. */
export function ProtocoloScreen() {
  const router = useRouter();
  const { loading, failed, query, account } = useCurrentAccount();
  const decl = useSafetyProtocol(account?.id);
  const declare = useDeclareSafetyProtocol();
  const upload = useUploadPoster();
  // null until edited: then the saved name shows without copying it into state from an effect.
  const [nameDraft, setName] = useState<string | null>(null);
  const [photo, setPhoto] = useState<PosterPick | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | undefined>();
  const [sent, setSent] = useState(false);

  const current = decl.data;
  const name = nameDraft ?? current?.responsibleName ?? '';

  const back = () => router.back();
  if (loading || (account && decl.isPending)) {
    return (
      <CasasShell title={SAFETY_PROTOCOL_NAME} onBack={back} testID="casas-protocolo">
        <View style={casasStyles.gap} testID="casas-protocolo-loading">
          <Skeleton height={28} width={220} radius={14} />
          <Skeleton height={120} radius={16} />
        </View>
      </CasasShell>
    );
  }
  if (failed || decl.isError) {
    return (
      <CasasShell title={SAFETY_PROTOCOL_NAME} onBack={back} testID="casas-protocolo">
        <ErrorState inline message="Não foi possível carregar o protocolo." onRetry={() => void (failed ? query.refetch() : decl.refetch())} />
      </CasasShell>
    );
  }
  if (!account) {
    return (
      <CasasShell title={SAFETY_PROTOCOL_NAME} onBack={back} testID="casas-protocolo">
        <EmptyState title="Você ainda não tem uma casa" message="Cadastre sua casa para declarar o protocolo." actionLabel="Cadastrar casa" onAction={() => router.replace('/casas')} />
      </CasasShell>
    );
  }

  const blocked =
    account.status !== 'verified' ? casasErrorMessage('account_not_verified') : !account.venue ? casasErrorMessage('venue_missing') : null;
  const status = current?.status ?? null;
  const busy = declare.isPending || upload.isPending;

  const pick = async () => {
    setError(null);
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85 });
    if (res.canceled || !res.assets?.length) return;
    const a = res.assets[0];
    const p: PosterPick = { uri: a.uri, mimeType: a.mimeType ?? null, size: a.fileSize ?? null };
    if (!PHOTO_TYPES.includes((p.mimeType ?? '').toLowerCase())) return setError(casasErrorMessage('poster_type'));
    if (p.size != null && p.size > POSTER_MAX_BYTES) return setError(casasErrorMessage('poster_too_large'));
    setPhoto(p);
  };

  const submit = async () => {
    setError(null);
    setSent(false);
    if (!isValidResponsible(name)) {
      setNameError(casasErrorMessage('invalid_responsible'));
      return;
    }
    setNameError(undefined);
    let evidencePath: string | null = null;
    if (photo) {
      const up = await upload.mutateAsync({ accountId: account.id, file: photo });
      if (!up.ok) return setError(up.error);
      evidencePath = up.path;
    }
    const res = await declare.mutateAsync({ accountId: account.id, input: { responsibleName: name, evidencePath } });
    if (!res.ok) return setError(res.error);
    setPhoto(null);
    setSent(true);
  };

  const hasEvidence = !!photo || !!current?.evidencePath;

  return (
    <CasasShell
      title={SAFETY_PROTOCOL_NAME}
      onBack={back}
      testID="casas-protocolo"
      footer={
        <>
          <Note tone="error" text={error ?? blocked} testID="casas-protocolo-erro" />
          <Note text={sent ? 'Recebemos sua declaração. A equipe confere e avisa por aqui.' : null} testID="casas-protocolo-enviado" />
          <Button
            label={status || current?.declaredAt ? 'Atualizar declaração' : 'Declarar o protocolo'}
            icon="shield"
            fullWidth
            disabled={!!blocked || busy}
            loading={busy}
            onPress={() => void submit()}
            testID="casas-protocolo-enviar"
          />
        </>
      }>
      <Text variant="headline" accessibilityRole="header">
        {accountVenueName(account)}
      </Text>
      <View style={casasStyles.row}>
        <Badge
          label={safetyProtocolPanelLabel(status, current?.reviewNote ?? null)}
          tone={status ? SAFETY_PROTOCOL_COPY[status].tone : 'neutral'}
          icon="shield"
        />
      </View>
      <Text variant="bodySm" tone="textMuted" testID="casas-protocolo-estado">
        {status
          ? SAFETY_PROTOCOL_COPY[status].detail
          : current?.reviewNote
            ? `Não aprovamos a declaração: ${current.reviewNote}. Corrija e envie de novo.`
            : 'Sua casa ainda não declarou o protocolo.'}
      </Text>

      <Caption style={casasStyles.section}>O QUE É</Caption>
      <Text variant="body">{SAFETY_PROTOCOL_ABOUT}</Text>
      <Text variant="bodySm" tone="textMuted">
        O selo é gratuito, vale para qualquer casa e nunca é vendido. Ele aparece como “declarado” assim que você envia e
        como “verificado” depois que a equipe confere. Relatos que contradizem o protocolo podem deixar o selo como
        “contestado”.
      </Text>

      <Caption style={casasStyles.section}>SUA DECLARAÇÃO</Caption>
      <TextField
        label="Quem responde pelo protocolo na casa"
        value={name}
        onChangeText={setName}
        maxLength={RESPONSIBLE_MAX}
        autoCapitalize="words"
        placeholder="Nome e função, ex.: Ana Souza, gerente"
        hint="Esse nome não aparece no app. Só a equipe do Qual a Boa vê."
        error={nameError}
        testID="casas-protocolo-responsavel"
      />
      <Text variant="bodySm" tone="textMuted">
        {photo
          ? 'Foto escolhida. Ela vai junto com a declaração.'
          : current?.evidencePath
            ? 'A foto que você enviou continua valendo. Envie outra se o cartaz mudou.'
            : 'Envie uma foto do cartaz do protocolo no banheiro ou na entrada. Ajuda a gente a verificar mais rápido.'}
      </Text>
      <Button
        label={hasEvidence ? 'Trocar foto do cartaz' : 'Enviar foto do cartaz'}
        variant="secondary"
        onPress={() => void pick()}
        disabled={!!blocked || busy}
        testID="casas-protocolo-foto"
      />
      <Text variant="caption" tone="textMuted">
        JPG, PNG ou WebP, até 5 MB. A foto é privada.
      </Text>
    </CasasShell>
  );
}
