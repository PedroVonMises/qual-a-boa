import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';

import {
  DISPLAY_NAME_MAX,
  deleteAccountRemote,
  displayNameKey,
  saveDisplayName,
  useDisplayName,
} from '@/data/account';
import { authAvailable, signOut, useAccountEmail } from '@/data/auth';
import { shareTextFile } from '@/lib/shareFile';
import { buildExport, exportFileName, wipeLocalData } from '@/state/accountData';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts, hit, radius, space, type } from '@/theme/tokens';
import { Button, EmptyState, ListRow, Screen, ScreenHeader, Sheet, Text } from '@/ui';

const ERASED = [
  'seu cadastro e o e-mail',
  'favoritos, eventos que você acompanha e check-ins',
  'avaliações e votos de útil',
  'chamados, mensagens e anexos',
  'fotos que você enviou',
];

/** Minha conta: name, export my data, sign out and erase everything (LGPD). */
export function ContaScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const client = useQueryClient();
  const email = useAccountEmail();
  const saved = useDisplayName();

  // null = the user has not typed yet, so the field shows the saved name as it loads.
  const [typed, setTyped] = useState<string | null>(null);
  const name = typed ?? saved.data ?? '';
  const [nameMsg, setNameMsg] = useState<{ text: string; ok: boolean } | undefined>();
  const [savingName, setSavingName] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportMsg, setExportMsg] = useState<string | undefined>();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | undefined>();

  if (!authAvailable()) {
    return (
      <Screen testID="conta-screen">
        <ScreenHeader title="Minha conta" onBack={() => router.back()} />
        <EmptyState title="Conta indisponível" message="Este app ainda não está conectado a uma conta. Seus dados ficam só neste aparelho." />
      </Screen>
    );
  }

  const onSaveName = async () => {
    setSavingName(true);
    setNameMsg(undefined);
    const res = await saveDisplayName(name);
    setSavingName(false);
    if (res.ok) {
      await client.invalidateQueries({ queryKey: displayNameKey });
      setNameMsg({ text: 'Nome salvo.', ok: true });
    } else setNameMsg({ text: res.error, ok: false });
  };

  const onExport = async () => {
    setExporting(true);
    setExportMsg(undefined);
    const now = new Date();
    const text = JSON.stringify(buildExport({ email, displayName: saved.data ?? null }, now), null, 2);
    const done = await shareTextFile(exportFileName(now), text);
    setExporting(false);
    setExportMsg(done ? 'Arquivo gerado.' : 'Não foi possível gerar o arquivo agora.');
  };

  const onDelete = async () => {
    setDeleting(true);
    setDeleteError(undefined);
    const res = await deleteAccountRemote();
    setDeleting(false);
    if (!res.ok) return setDeleteError(res.error);
    setConfirmOpen(false);
    client.clear();
    wipeLocalData();
    router.replace('/');
  };

  const nameError = nameMsg && !nameMsg.ok;
  return (
    <Screen testID="conta-screen">
      <ScreenHeader title="Minha conta" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.column} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.group}>
          <Text variant="title">{email ?? 'Visitante'}</Text>
          <Text variant="bodySm" tone="textMuted">
            {email ? 'Conta com e-mail confirmado.' : 'Você ainda não entrou com e-mail. Entre pelo Perfil para usar seus dados em outro aparelho.'}
          </Text>
        </View>

        <View style={styles.group}>
          <Text variant="title">Nome</Text>
          <TextInput
            testID="conta-nome"
            accessibilityLabel="Nome de exibição"
            accessibilityHint={`Até ${DISPLAY_NAME_MAX} caracteres`}
            maxLength={DISPLAY_NAME_MAX}
            value={name}
            onChangeText={(t) => {
              setTyped(t);
              setNameMsg(undefined);
            }}
            onSubmitEditing={onSaveName}
            placeholder="Como quer ser chamado"
            placeholderTextColor={colors.textMuted}
            style={[styles.input, { backgroundColor: colors.surfaceAlt, color: colors.text, borderColor: nameError ? colors.danger : 'transparent' }]}
          />
          {nameMsg ? (
            <Text variant="bodySm" tone={nameMsg.ok ? 'textMuted' : 'dangerText'} accessibilityLiveRegion="polite">
              {nameMsg.text}
            </Text>
          ) : null}
          <Button label="Salvar nome" variant="secondary" loading={savingName} onPress={onSaveName} testID="conta-salvar-nome" />
        </View>

        <View>
          <ListRow
            title="Exportar meus dados"
            subtitle={exportMsg ?? 'Baixe um arquivo com tudo que o app guarda sobre você'}
            chevron
            divider
            disabled={exporting}
            onPress={onExport}
            testID="conta-exportar"
          />
          {email ? <ListRow title="Sair" subtitle="Seus dados continuam na conta" chevron divider onPress={() => void signOut().then(() => router.back())} testID="conta-sair" /> : null}
        </View>

        <View style={styles.group}>
          <Text variant="title">Apagar minha conta</Text>
          <Text variant="bodySm" tone="textMuted">
            Remove definitivamente seus dados dos nossos servidores e deste aparelho. Não dá para desfazer.
          </Text>
          <Button label="Apagar minha conta" variant="secondary" onPress={() => setConfirmOpen(true)} testID="conta-apagar" />
        </View>
      </ScrollView>

      <Sheet visible={confirmOpen} onClose={() => !deleting && setConfirmOpen(false)} title="Apagar sua conta?" testID="conta-confirm">
        <View style={styles.group}>
          <Text variant="body">Vamos apagar para sempre:</Text>
          {ERASED.map((item) => (
            <Text key={item} variant="bodySm" tone="textMuted">
              {'•'} {item}
            </Text>
          ))}
          <Text variant="body">Você volta ao início do app como um visitante novo.</Text>
          {deleteError ? (
            <Text variant="bodySm" tone="dangerText" accessibilityRole="alert" accessibilityLiveRegion="polite">
              {deleteError}
            </Text>
          ) : null}
          <Button label="Apagar tudo" loading={deleting} onPress={onDelete} testID="conta-confirmar-apagar" />
          <Button label="Cancelar" variant="ghost" disabled={deleting} onPress={() => setConfirmOpen(false)} testID="conta-cancelar" />
        </View>
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  column: { gap: space.xl, paddingBottom: space.xxxl },
  group: { gap: space.sm },
  input: {
    minHeight: hit.min + 4,
    borderRadius: radius.md,
    borderWidth: 1.5,
    paddingHorizontal: space.lg,
    fontFamily: fonts.body,
    fontSize: type.body.fontSize,
  },
});
