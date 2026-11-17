// Selo "Protocolo Não é Não" (S1 in docs/MVP-PLANO.md, Lei 14.786/2023). The state lives on venues.safety_protocol
// (migration 0019): the casa declares, staff verifies or marks it contested. The seal is never sold.

export const SAFETY_PROTOCOL_STATES = ['declared', 'verified', 'contested'] as const;
export type SafetyProtocol = (typeof SAFETY_PROTOCOL_STATES)[number];

export const isSafetyProtocol = (v: unknown): v is SafetyProtocol =>
  typeof v === 'string' && (SAFETY_PROTOCOL_STATES as readonly string[]).includes(v);

/** Anything unknown (old feeds, typos) becomes undefined, so no seal is ever shown by accident. */
export const cleanSafetyProtocol = (v: unknown): SafetyProtocol | undefined => (isSafetyProtocol(v) ? v : undefined);

export const SAFETY_PROTOCOL_NAME = 'Protocolo Não é Não';

export const SAFETY_PROTOCOL_COPY: Record<SafetyProtocol, { label: string; detail: string; tone: 'success' | 'neutral' | 'danger' }> = {
  verified: {
    label: 'Protocolo Não é Não',
    detail: 'A equipe do Qual a Boa conferiu que a casa segue o protocolo e tem quem responda por ele.',
    tone: 'success',
  },
  declared: {
    label: 'Declara o Protocolo Não é Não',
    detail: 'A casa diz que segue o protocolo. A equipe do Qual a Boa ainda não conferiu.',
    tone: 'neutral',
  },
  contested: {
    label: 'Protocolo Não é Não contestado',
    detail: 'Recebemos relatos que contradizem o protocolo desta casa. Estamos apurando.',
    tone: 'danger',
  },
};

/** What the protocol means for whoever is at the party (shown under the seal and to the casa). */
export const SAFETY_PROTOCOL_ABOUT =
  'Pela Lei 14.786/2023, a casa precisa ter equipe preparada para acolher a mulher que sofre constrangimento ou ' +
  'violência, afastá-la de quem agrediu, preservar as provas e chamar a polícia se ela quiser.';

/** Shown to the casa in the panel. */
export function safetyProtocolPanelLabel(status: SafetyProtocol | null, reviewNote: string | null): string {
  if (status === 'verified') return 'Verificado';
  if (status === 'declared') return 'Declarado, em análise';
  if (status === 'contested') return 'Contestado';
  return reviewNote ? 'Não aprovado' : 'Não declarado';
}

export const RESPONSIBLE_MIN = 2;
export const RESPONSIBLE_MAX = 120;
export const isValidResponsible = (name: string) => {
  const n = name.trim().length;
  return n >= RESPONSIBLE_MIN && n <= RESPONSIBLE_MAX;
};
