import type { TicketStatus, TicketTopic } from '@/domain/engage';
import type { IconName } from '@/ui';

export const DESCRIPTION_MIN = 10;
export const DESCRIPTION_MAX = 1000;

export interface DescriptionCheck {
  ok: boolean;
  length: number;
  /** pt-BR message when not ok. */
  error?: string;
}

/** Length is counted on the trimmed text. */
export function validateDescription(text: string): DescriptionCheck {
  const length = text.trim().length;
  if (length < DESCRIPTION_MIN) {
    return { ok: false, length, error: `Conte um pouco mais: use pelo menos ${DESCRIPTION_MIN} caracteres.` };
  }
  if (length > DESCRIPTION_MAX) {
    return { ok: false, length, error: `Texto longo demais: use no máximo ${DESCRIPTION_MAX} caracteres.` };
  }
  return { ok: true, length };
}

export const TOPIC_OPTIONS: { value: TicketTopic; label: string }[] = [
  { value: 'ingresso', label: 'Problema com ingresso' },
  { value: 'evento', label: 'Evento mudou ou foi cancelado' },
  { value: 'casa', label: 'Informação errada sobre uma casa' },
  { value: 'conta', label: 'Conta ou dados (LGPD)' },
  { value: 'seguranca', label: 'Segurança ou denúncia' },
  { value: 'outro', label: 'Outro assunto' },
];

export const topicLabel = (t: TicketTopic) => TOPIC_OPTIONS.find((o) => o.value === t)?.label ?? 'Outro assunto';

export const STATUS_LABEL: Record<TicketStatus, string> = { open: 'Aberto', answered: 'Respondido', closed: 'Encerrado' };
export const STATUS_ICON: Record<TicketStatus, IconName> = { open: 'clock', answered: 'check', closed: 'close' };

/** Short human-friendly number derived from the id. */
export const ticketNumber = (id: string) => id.slice(-4).toUpperCase();

export const QUICK_REPLIES = ['Obrigado', 'Ainda preciso de ajuda', 'Pode encerrar o chamado'];

export const SECURITY_NOTE = 'Nunca pedimos sua senha ou dados do cartão.';
