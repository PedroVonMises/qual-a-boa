import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useAccountEmail } from '@/data/auth';
import { useAdminOverview, useIsStaff } from '@/data/admin';
import { isRemote } from '@/data/supabaseClient';
import { ADMIN_ERROR_MESSAGES, slaState, type AdminOverview, type AdminSection } from '@/domain/admin';
import { CasasShell, Note, casasStyles } from '@/features/casas/parts';
import { space } from '@/theme/tokens';
import { Chip, EmptyState, Skeleton } from '@/ui';
import { CasasQueue, FestasQueue, LogList, ModeracaoQueue, RelatosQueue, SelosQueue } from './queues';

const SECTIONS: { key: AdminSection; label: string; count?: (o: AdminOverview) => number }[] = [
  { key: 'relatos', label: 'Relatos', count: (o) => o.openSafetyReports },
  { key: 'festas', label: 'Festas', count: (o) => o.pendingEvents },
  { key: 'casas', label: 'Casas', count: (o) => o.pendingAccounts },
  { key: 'selos', label: 'Selos', count: (o) => o.safetySeals },
  { key: 'moderacao', label: 'Moderação', count: (o) => o.hiddenPosts },
  { key: 'log', label: 'Log' },
];

const QUEUES: Record<AdminSection, () => React.JSX.Element> = {
  festas: FestasQueue,
  casas: CasasQueue,
  selos: SelosQueue,
  moderacao: ModeracaoQueue,
  relatos: RelatosQueue,
  log: LogList,
};

function Panel() {
  const overview = useAdminOverview(true);
  const [section, setSection] = useState<AdminSection>('relatos');
  const Queue = QUEUES[section];
  const o = overview.data;
  const late = o?.oldestSafetyReportAt ? slaState(o.oldestSafetyReportAt).late : false;

  return (
    <View style={casasStyles.gap}>
      <View style={styles.chips} accessibilityRole="tablist" testID="admin-secoes">
        {SECTIONS.map((s) => (
          <Chip
            key={s.key}
            label={s.label}
            count={o && s.count ? s.count(o) : undefined}
            selected={section === s.key}
            onPress={() => setSection(s.key)}
            testID={`admin-secao-${s.key}`}
          />
        ))}
      </View>
      {late ? <Note text="Tem relato de segurança esperando há mais de 12 horas." tone="error" testID="admin-sla-alerta" /> : null}
      <Queue />
    </View>
  );
}

/**
 * /admin: the team's back-office (item 5.6). The guard is server-side (every admin_* RPC checks staff_members); this
 * screen only decides what to show: sign in, not on the team, or the queues.
 */
export function AdminScreen() {
  const router = useRouter();
  const email = useAccountEmail();
  const remote = isRemote();
  const staff = useIsStaff(remote ? email : null);
  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));

  let body: React.ReactNode;
  if (!remote) {
    body = <EmptyState title="Painel da equipe" message={ADMIN_ERROR_MESSAGES.no_backend} />;
  } else if (!email) {
    body = (
      <EmptyState
        title="Entre com a conta da equipe"
        message="O painel da equipe pede login com e-mail."
        actionLabel="Entrar"
        onAction={() => router.push('/entrar')}
      />
    );
  } else if (staff.isPending) {
    body = (
      <View style={casasStyles.gap} testID="admin-loading">
        <Skeleton height={40} radius={14} />
        <Skeleton height={160} radius={24} />
      </View>
    );
  } else if (!staff.data) {
    body = <EmptyState title="Área restrita" message={ADMIN_ERROR_MESSAGES.not_staff} />;
  } else {
    body = <Panel />;
  }

  return (
    <CasasShell title="Painel da equipe" onBack={back} testID="admin">
      {body}
    </CasasShell>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
