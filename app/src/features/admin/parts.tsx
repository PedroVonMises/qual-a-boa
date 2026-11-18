import { useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { adminImageUrl, useAdminMutation, type AdminResult } from '@/data/admin';
import { noteError } from '@/domain/admin';
import { Card, Note, casasStyles } from '@/features/casas/parts';
import { space } from '@/theme/tokens';
import { Button, ErrorState, Skeleton, TextField, type ButtonVariant } from '@/ui';

export interface Decision {
  key: string;
  label: string;
  variant?: ButtonVariant;
  /** Needs a reason (refusals, contests); the server checks it too. */
  needsNote?: boolean;
  run: (note: string) => Promise<AdminResult<unknown>>;
}

/**
 * Card with the item's details, an optional reason field and the decision buttons. The result (or the server's
 * pt-BR error) shows under the buttons; a decision refreshes every queue.
 */
export function DecisionCard({
  children,
  decisions,
  noteLabel = 'Motivo (a casa ou a pessoa vai ler)',
  testID,
}: {
  children: React.ReactNode;
  decisions: Decision[];
  noteLabel?: string;
  testID: string;
}) {
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const m = useAdminMutation((d: Decision) => d.run(note));
  const anyNote = decisions.some((d) => d.needsNote);

  const press = async (d: Decision) => {
    if (d.needsNote) {
      const e = noteError(note);
      if (e) {
        setError(e);
        return;
      }
    }
    setError(null);
    setBusy(d.key);
    const res = await m.mutateAsync(d);
    setBusy(null);
    if (!res.ok) setError(res.error);
  };

  return (
    <Card testID={testID}>
      {children}
      {anyNote ? (
        <TextField
          label={noteLabel}
          value={note}
          onChangeText={setNote}
          maxLength={500}
          multiline
          testID={`${testID}-nota`}
        />
      ) : null}
      <View style={casasStyles.row}>
        {decisions.map((d) => (
          <Button
            key={d.key}
            label={d.label}
            variant={d.variant ?? 'secondary'}
            loading={busy === d.key}
            disabled={busy !== null && busy !== d.key}
            onPress={() => void press(d)}
            testID={`${testID}-${d.key}`}
          />
        ))}
      </View>
      <Note text={error} tone="error" testID={`${testID}-erro`} />
    </Card>
  );
}

/** Opens a private image (festa poster, seal photo) through a short-lived signed URL. */
export function ImageLink({ path, label, testID }: { path: string; label: string; testID: string }) {
  const [failed, setFailed] = useState(false);
  const open = async () => {
    const url = await adminImageUrl(path);
    if (!url) {
      setFailed(true);
      return;
    }
    setFailed(false);
    await Linking.openURL(url);
  };
  return (
    <View style={styles.gapXs}>
      <Button label={label} variant="ghost" onPress={() => void open()} testID={testID} />
      <Note text={failed ? 'Não deu para abrir a imagem. Tente de novo.' : null} tone="error" />
    </View>
  );
}

export function QueueState({
  loading,
  error,
  onRetry,
  testID,
}: {
  loading: boolean;
  error: Error | null;
  onRetry: () => void;
  testID: string;
}) {
  if (loading) {
    return (
      <View style={casasStyles.gap} testID={`${testID}-loading`}>
        <Skeleton height={120} radius={24} />
        <Skeleton height={120} radius={24} />
      </View>
    );
  }
  if (error) return <ErrorState inline message={error.message} onRetry={onRetry} />;
  return null;
}

const styles = StyleSheet.create({ gapXs: { gap: space.xs } });
