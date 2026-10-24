import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { useReviews, REVIEW_TEXT_MAX, validateReviewText } from '@/state/reviews';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts, hit, radius, space, type } from '@/theme/tokens';
import { Button, Icon, Switch, Text } from '@/ui';
import { useDraft } from './draft';
import { Shell } from './Shell';

const LABEL_ID = 'avaliar-texto-label';

export function TextoScreen({ id }: { id?: string }) {
  const { colors } = useTheme();
  const router = useRouter();
  const draft = useDraft();
  const submitReview = useReviews((s) => s.submitReview);
  const [focused, setFocused] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const back = () => (router.canGoBack() ? router.back() : router.replace(`/avaliar/${id}` as Href));

  // Deep-linked here without a rating (or from another event): send the person to step 1.
  if (!id || draft.eventId !== id || !draft.rating) {
    return (
      <Shell step={2} onBack={back} footer={<Button label="Voltar para a nota" fullWidth onPress={() => router.replace(`/avaliar/${id}` as Href)} />}>
        <Text variant="headline" accessibilityRole="header">
          Falta a sua nota
        </Text>
        <Text variant="body" tone="textMuted">
          Dê de 1 a 5 estrelas na primeira etapa antes de escrever o relato.
        </Text>
      </Shell>
    );
  }

  const send = (withText: boolean) => {
    const text = withText ? draft.text : '';
    const problem = validateReviewText(text);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    submitReview({
      eventId: id,
      rating: draft.rating as 1 | 2 | 3 | 4 | 5,
      topics: draft.topics,
      tags: draft.tags,
      text,
      anonymous: draft.anonymous,
    });
    draft.clear();
    router.replace(`/avaliacoes/${id}?enviada=1` as Href);
  };

  const count = draft.text.length;

  return (
    <Shell
      step={2}
      onBack={back}
      footer={
        <>
          <Button label="Pular" variant="secondary" onPress={() => send(false)} accessibilityHint="Envia só a nota, sem texto" />
          <Button label="Enviar avaliação" onPress={() => send(true)} style={styles.flex} testID="avaliar-enviar" />
        </>
      }>
      <View style={styles.block}>
        <Text variant="display" accessibilityRole="header">
          Conte mais
        </Text>
        <Text variant="body" tone="textMuted">
          Opcional. Seu relato ajuda quem vai decidir onde sair.
        </Text>
      </View>

      <View style={styles.field}>
        <Text nativeID={LABEL_ID} variant="bodySm" tone="textMuted" style={styles.bold}>
          Sua avaliação
        </Text>
        <TextInput
          testID="avaliar-texto"
          multiline
          value={draft.text}
          onChangeText={(t) => {
            draft.setText(t.slice(0, REVIEW_TEXT_MAX));
            if (error) setError(null);
          }}
          maxLength={REVIEW_TEXT_MAX}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          accessibilityLabel="Sua avaliação"
          accessibilityLabelledBy={LABEL_ID}
          accessibilityHint="Opcional. Até 800 caracteres."
          placeholder="Como foi o som, a fila, o ambiente?"
          placeholderTextColor={colors.textMuted}
          textAlignVertical="top"
          style={[
            styles.input,
            {
              backgroundColor: colors.surfaceAlt,
              color: colors.text,
              borderColor: error ? colors.danger : focused ? colors.accent : 'transparent',
            },
          ]}
        />
        <View style={styles.meta}>
          <Text variant="bodySm" tone="textMuted" style={styles.flex}>
            Evite dados pessoais de terceiros.
          </Text>
          <Text variant="mono" tone={count >= REVIEW_TEXT_MAX ? 'dangerText' : 'textMuted'} accessibilityLabel={`${count} de ${REVIEW_TEXT_MAX} caracteres`}>
            {count}/{REVIEW_TEXT_MAX}
          </Text>
        </View>
        {error ? (
          <Text variant="bodySm" tone="dangerText" accessibilityRole="alert" accessibilityLiveRegion="assertive" testID="avaliar-erro">
            {error}
          </Text>
        ) : null}
      </View>

      <View style={styles.block}>
        {/* expo-image-picker is not installed yet: the control is visible but disabled. */}
        <View
          accessible
          accessibilityRole="button"
          accessibilityLabel="Adicionar foto, em breve"
          accessibilityState={{ disabled: true }}
          style={[styles.photo, { borderColor: colors.border }]}>
          <Icon name="plus" size={20} color={colors.textMuted} />
          <Text variant="body" tone="textMuted" style={styles.bold}>
            Adicionar foto · em breve
          </Text>
        </View>
        <Text variant="bodySm" tone="textMuted">
          Só fotos tiradas por você. Sem rostos de outras pessoas.
        </Text>
      </View>

      <View style={[styles.anon, { borderTopColor: colors.border }]}>
        <Switch label="Publicar sem meu nome" value={draft.anonymous} onValueChange={draft.setAnonymous} />
        <Text variant="bodySm" tone="textMuted">
          Aparece como &quot;Frequentador&quot;.
        </Text>
      </View>
      <Text variant="bodySm" tone="textMuted">
        Avaliações passam por revisão antes de aparecer. O selo &quot;Foi ao evento&quot; só aparece para quem fez check-in.
      </Text>
    </Shell>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  block: { gap: space.sm },
  bold: { fontWeight: '600' },
  field: { gap: space.xs },
  input: {
    minHeight: 150,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderRadius: radius.md,
    borderWidth: 2,
    fontFamily: fonts.body,
    fontSize: type.body.fontSize,
    lineHeight: type.body.lineHeight,
  },
  meta: { flexDirection: 'row', justifyContent: 'space-between', gap: space.md },
  photo: {
    minHeight: hit.button,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    opacity: 0.7,
  },
  anon: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: space.sm, gap: space.xs },
});
