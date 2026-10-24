import type { AlertKind, EventChange, EventFollow } from '@/domain/engage';
import { formatBRL } from '@/domain/format';
import type { EventItem } from '@/domain/types';

/** The only venue with pilot demonstration content. Real venues never get invented updates or live status. */
export const DEMO_VENUE_SLUG = 'casa-mare';
export const DEFAULT_DURATION_MS = 6 * 3600_000;

export type EventPhase = 'before' | 'live' | 'after';
export type StepStatus = 'done' | 'current' | 'todo';
export type StepKey = 'saved' | 'ticket' | 'day' | 'review';

export interface TimelineStep {
  key: StepKey;
  title: string;
  detail: string;
  status: StepStatus;
}

export const STATUS_LABEL: Record<StepStatus, string> = { done: 'feito', current: 'agora', todo: 'a seguir' };

export const isDemoVenue = (slug: string | undefined) => slug === DEMO_VENUE_SLUG;
export const isDemoChange = (c: EventChange) => c.id.startsWith('demo-');

export function eventEndMs(e: Pick<EventItem, 'startsAt' | 'endsAt'>): number {
  const end = e.endsAt ? Date.parse(e.endsAt) : NaN;
  return Number.isFinite(end) ? end : Date.parse(e.startsAt) + DEFAULT_DURATION_MS;
}

export function eventPhase(e: Pick<EventItem, 'startsAt' | 'endsAt'>, nowMs: number): EventPhase {
  if (nowMs < Date.parse(e.startsAt)) return 'before';
  return nowMs < eventEndMs(e) ? 'live' : 'after';
}

export interface TimelineInput {
  event: Pick<EventItem, 'startsAt' | 'endsAt' | 'priceMin' | 'priceMax' | 'isFree' | 'status'>;
  follow: Pick<EventFollow, 'hasTicket'>;
  checkedIn: boolean;
  nowMs: number;
}

function ticketDetail(e: TimelineInput['event']): string {
  if (e.isFree) return 'Entrada gratuita';
  if (e.priceMin == null) return 'Preço ainda não informado';
  return e.priceMax != null && e.priceMax !== e.priceMin ? `A partir de ${formatBRL(e.priceMin)}` : formatBRL(e.priceMin);
}

/** Salvo, Ingresso, Dia do evento, Avaliar. The first unfinished step is "current". */
export function buildTimeline({ event, follow, checkedIn, nowMs }: TimelineInput): TimelineStep[] {
  const phase = eventPhase(event, nowMs);
  const cancelled = event.status === 'cancelled';
  const ticketDone = follow.hasTicket || event.isFree || phase !== 'before';
  const dayDone = phase === 'after' || checkedIn;
  const reviewDone = false; // reviews live in the Avaliar feature; this timeline only points to it
  const done: Record<StepKey, boolean> = { saved: true, ticket: !cancelled && ticketDone, day: !cancelled && dayDone, review: reviewDone };

  const details: Record<StepKey, string> = {
    saved: 'Você acompanha este evento',
    ticket: cancelled
      ? 'Evento cancelado'
      : follow.hasTicket
        ? 'Ingresso garantido'
        : phase !== 'before'
          ? 'O evento já começou'
          : ticketDetail(event),
    day: cancelled ? 'Evento cancelado' : checkedIn ? 'Você fez check-in' : phase === 'before' ? 'Status ao vivo no dia do evento' : phase === 'live' ? 'Rolando agora: veja fila e lotação' : 'Evento encerrado',
    review: phase === 'after' ? 'Conte como foi a noite' : 'Depois: avalie a noite',
  };
  const titles: Record<StepKey, string> = { saved: 'Salvo', ticket: 'Ingresso', day: 'Dia do evento', review: 'Avaliar' };

  const keys: StepKey[] = ['saved', 'ticket', 'day', 'review'];
  let currentAssigned = cancelled;
  return keys.map((key) => {
    let status: StepStatus = 'todo';
    if (done[key]) status = 'done';
    else if (!currentAssigned) {
      status = 'current';
      currentAssigned = true;
    }
    return { key, title: titles[key], detail: details[key], status };
  });
}

export type CountdownState = { kind: 'before' | 'live' | 'after' | 'cancelled'; label: string; caption: string };

export function countdownFor(e: Pick<EventItem, 'startsAt' | 'endsAt' | 'status'>, nowMs: number, fmt: (iso: string, now: number) => string): CountdownState {
  if (e.status === 'cancelled') return { kind: 'cancelled', label: 'Cancelado', caption: 'este evento não vai acontecer' };
  const phase = eventPhase(e, nowMs);
  if (phase === 'before') return { kind: 'before', label: fmt(e.startsAt, nowMs), caption: 'para começar' };
  if (phase === 'live') return { kind: 'live', label: 'Rolando', caption: 'o evento já começou' };
  return { kind: 'after', label: 'Encerrado', caption: 'que tal avaliar?' };
}

export const CHANGE_KIND_LABEL: Record<AlertKind, string> = {
  lineup: 'Line-up ou horário',
  price: 'Preço',
  lastTickets: 'Últimos ingressos',
  dayBefore: 'Lembrete',
  cancelled: 'Cancelamento',
};

/** Demonstration updates, only ever created for Casa Maré. Ids start with "demo-". */
export function demoChanges(eventId: string, nowMs: number): EventChange[] {
  const mk = (n: number, kind: AlertKind, text: string, agoMin: number): EventChange => ({
    id: `demo-${eventId}-${n}`,
    eventId,
    kind,
    text,
    at: new Date(nowMs - agoMin * 60_000).toISOString(),
    read: false,
  });
  return [
    mk(1, 'lineup', 'Abertura adiantada em 30 minutos', 120),
    mk(2, 'lineup', 'Atração nova: Taís Mar', 300),
    mk(3, 'price', '2º lote até sexta, depois o preço sobe', 1500),
  ];
}

export const ALERT_COPY: Record<AlertKind, { title: string; subtitle: string }> = {
  lineup: { title: 'Mudar horário ou atração', subtitle: 'Mudanças importantes' },
  price: { title: 'Mudar o preço ou virar o lote', subtitle: 'Antes do preço subir' },
  lastTickets: { title: 'Ingressos acabando', subtitle: 'Quando restarem poucos' },
  dayBefore: { title: 'Lembrete antes de começar', subtitle: 'Para você não esquecer de sair' },
  cancelled: { title: 'Evento cancelado', subtitle: 'Se não for mais acontecer' },
};
