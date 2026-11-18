// Back-office /admin (item 5.6 of docs/MVP-PLANO.md, migration 0024): types, row mapping and pt-BR copy for the
// team's queues. Pure; the data layer is data/admin.ts.

export type AdminSection = 'festas' | 'casas' | 'selos' | 'moderacao' | 'relatos' | 'log';

export interface AdminOverview {
  pendingEvents: number;
  pendingAccounts: number;
  safetySeals: number;
  hiddenPosts: number;
  openSafetyReports: number;
  oldestSafetyReportAt: string | null;
}

export interface PendingEvent {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string | null;
  venueName: string;
  venueSlug: string;
  accountName: string | null;
  isFree: boolean;
  priceMin: number | null;
  priceMax: number | null;
  ticketUrl: string | null;
  ageMin: number;
  dressCode: string | null;
  posterPath: string | null;
  genreSlugs: string[];
  submittedAt: string;
}

export interface ProposedVenue {
  name?: string;
  address?: string;
  cep?: string;
  city?: string;
  lat?: number;
  lng?: number;
}

export interface PendingAccount {
  id: string;
  venueId: string | null;
  venueName: string | null;
  proposedVenue: ProposedVenue | null;
  cnpj: string;
  legalName: string;
  contactName: string;
  whatsapp: string;
  createdAt: string;
}

export type SealState = 'declared' | 'contested';

export interface SafetyQueueItem {
  venueId: string;
  venueName: string;
  venueSlug: string;
  state: SealState;
  stateAt: string | null;
  responsibleName: string | null;
  evidencePath: string | null;
  declaredAt: string | null;
  reports90d: number;
}

export interface HiddenPost {
  kind: 'thread' | 'comment';
  id: string;
  threadId: string;
  title: string | null;
  body: string | null;
  anonymous: boolean;
  createdAt: string;
  reportCount: number;
  reasons: string[];
}

export type IncidentKind = 'assedio' | 'importunacao' | 'violencia' | 'discriminacao' | 'outro';
export type TicketStatus = 'open' | 'answered' | 'closed';

export interface TicketMessage {
  sender: 'user' | 'support';
  text: string;
  at: string;
}

export interface SafetyReportItem {
  ticketId: string;
  venueId: string;
  venueName: string;
  eventTitle: string | null;
  kind: IncidentKind;
  checkedIn: boolean;
  description: string;
  status: TicketStatus;
  createdAt: string;
  messages: TicketMessage[];
}

export interface AdminAction {
  id: string;
  actorName: string | null;
  action: string;
  targetType: string;
  targetId: string;
  note: string | null;
  details: Record<string, unknown>;
  createdAt: string;
}

// --- Errors ---------------------------------------------------------------------------------------------------------

export const ADMIN_ERROR_MESSAGES = {
  not_authenticated: 'Entre com a conta da equipe para continuar.',
  not_staff: 'Esta área é só da equipe do Qual a boa?.',
  note_required: 'Escreva o motivo. A casa ou a pessoa vai ler.',
  not_pending: 'Alguém da equipe já decidiu sobre isso. Atualize a lista.',
  event_not_found: 'Não achamos esta festa.',
  account_not_found: 'Não achamos esta casa.',
  venue_not_found: 'Não achamos a casa no catálogo.',
  venue_taken: 'Outra conta já está ligada a esta casa.',
  venue_location_missing: 'A proposta não tem localização no mapa. Cadastre a casa no catálogo e ligue a conta a ela.',
  protocol_not_declared: 'A casa ainda não declarou o protocolo.',
  post_not_hidden: 'Este post não está mais oculto. Atualize a lista.',
  ticket_not_found: 'Não achamos este relato.',
  invalid_payload: 'Confira os dados e tente de novo.',
  no_backend: 'O painel da equipe só funciona com o Supabase configurado.',
  network: 'Não deu para falar com o servidor. Tente de novo.',
} as const;

export type AdminErrorCode = keyof typeof ADMIN_ERROR_MESSAGES;

const CODES = new Set(Object.keys(ADMIN_ERROR_MESSAGES));
export const isAdminErrorCode = (v: unknown): v is AdminErrorCode => typeof v === 'string' && CODES.has(v);
export const adminErrorMessage = (code: unknown): string =>
  isAdminErrorCode(code) ? ADMIN_ERROR_MESSAGES[code] : ADMIN_ERROR_MESSAGES.network;

/** Refusals, rejections and contests need a reason of at least 3 characters (the server checks it too). */
export const NOTE_MIN = 3;
export const NOTE_MAX = 500;
export function noteError(note: string): string | null {
  const n = note.trim().length;
  if (n < NOTE_MIN) return ADMIN_ERROR_MESSAGES.note_required;
  if (n > NOTE_MAX) return `Use até ${NOTE_MAX} caracteres.`;
  return null;
}

// --- Labels ---------------------------------------------------------------------------------------------------------

export const INCIDENT_LABEL: Record<IncidentKind, string> = {
  assedio: 'Assédio',
  importunacao: 'Importunação',
  violencia: 'Violência',
  discriminacao: 'Discriminação',
  outro: 'Outro',
};

export const TICKET_LABEL: Record<TicketStatus, string> = { open: 'Aberto', answered: 'Respondido', closed: 'Encerrado' };

export const SEAL_LABEL: Record<SealState, string> = { declared: 'Declarado', contested: 'Contestado' };

const ACTION_LABEL: Record<string, string> = {
  event_approve: 'aprovou a festa',
  event_reject: 'recusou a festa',
  event_verify: 'conferiu a festa',
  account_verify: 'verificou a casa',
  account_reject: 'recusou a casa',
  safety_verify: 'verificou o selo',
  safety_reject: 'recusou o selo',
  safety_contest: 'contestou o selo',
  post_restore: 'republicou o post',
  post_keep_hidden: 'manteve o post oculto',
  ticket_reply: 'respondeu o relato',
  ticket_close: 'encerrou o relato',
};
export const actionLabel = (action: string): string => ACTION_LABEL[action] ?? action.replace(/_/g, ' ');

/** "12.345.678/0001-90" */
export function formatCnpj(raw: string): string {
  const d = raw.replace(/\D/g, '');
  if (d.length !== 14) return raw;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

/** Where the casa is: the catalog venue, or the proposal (name and address) with "sem mapa" when it has no coordinates. */
export function accountPlace(a: PendingAccount): { title: string; detail: string | null; needsLocation: boolean } {
  if (a.venueId) return { title: a.venueName ?? 'Casa do catálogo', detail: 'Já está no catálogo', needsLocation: false };
  const p = a.proposedVenue ?? {};
  const hasLocation = typeof p.lat === 'number' && typeof p.lng === 'number';
  const detail = [p.address, p.city].filter(Boolean).join(', ') || null;
  return { title: p.name ?? 'Casa nova', detail: hasLocation ? detail : `${detail ? `${detail} · ` : ''}sem localização no mapa`, needsLocation: !hasLocation };
}

// --- Time and SLA ---------------------------------------------------------------------------------------------------

/** S9: harassment reports get an answer within 12 hours. */
export const SAFETY_SLA_HOURS = 12;

export function hoursSince(iso: string, now: Date = new Date()): number {
  return Math.max(0, (now.getTime() - Date.parse(iso)) / 3_600_000);
}

/** "há 5 min", "há 3 h", "há 2 dias". */
export function ageLabel(iso: string, now: Date = new Date()): string {
  const h = hoursSince(iso, now);
  if (h < 1) return `há ${Math.max(1, Math.round(h * 60))} min`;
  if (h < 48) return `há ${Math.floor(h)} h`;
  return `há ${Math.floor(h / 24)} dias`;
}

/** Open report: time left on the 12 h SLA, or late. */
export function slaState(iso: string, now: Date = new Date()): { late: boolean; label: string } {
  const left = SAFETY_SLA_HOURS - hoursSince(iso, now);
  if (left <= 0) return { late: true, label: 'Prazo de 12 h vencido' };
  return { late: false, label: left < 1 ? 'Menos de 1 h para responder' : `${Math.ceil(left)} h para responder` };
}

// --- Row mapping ----------------------------------------------------------------------------------------------------

const num = (v: unknown): number | null => (v === null || v === undefined || v === '' ? null : Number(v));
const str = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null);

export function mapOverview(r: Record<string, unknown> | null | undefined): AdminOverview {
  return {
    pendingEvents: Number(r?.pending_events ?? 0),
    pendingAccounts: Number(r?.pending_accounts ?? 0),
    safetySeals: Number(r?.safety_seals ?? 0),
    hiddenPosts: Number(r?.hidden_posts ?? 0),
    openSafetyReports: Number(r?.open_safety_reports ?? 0),
    oldestSafetyReportAt: str(r?.oldest_safety_report_at),
  };
}

export function mapPendingEvent(r: Record<string, unknown>): PendingEvent {
  return {
    id: String(r.id),
    title: String(r.title),
    startsAt: String(r.starts_at),
    endsAt: str(r.ends_at),
    venueName: String(r.venue_name),
    venueSlug: String(r.venue_slug),
    accountName: str(r.account_name),
    isFree: r.is_free === true,
    priceMin: num(r.price_min),
    priceMax: num(r.price_max),
    ticketUrl: str(r.ticket_url),
    ageMin: Number(r.age_min ?? 18),
    dressCode: str(r.dress_code),
    posterPath: str(r.poster_path),
    genreSlugs: Array.isArray(r.genre_slugs) ? r.genre_slugs.map(String) : [],
    submittedAt: String(r.submitted_at),
  };
}

export function mapPendingAccount(r: Record<string, unknown>): PendingAccount {
  const p = r.proposed_venue;
  return {
    id: String(r.id),
    venueId: str(r.venue_id),
    venueName: str(r.venue_name),
    proposedVenue: p && typeof p === 'object' && !Array.isArray(p) ? (p as ProposedVenue) : null,
    cnpj: String(r.cnpj),
    legalName: String(r.legal_name),
    contactName: String(r.contact_name),
    whatsapp: String(r.whatsapp),
    createdAt: String(r.created_at),
  };
}

export function mapSafetyItem(r: Record<string, unknown>): SafetyQueueItem {
  return {
    venueId: String(r.venue_id),
    venueName: String(r.venue_name),
    venueSlug: String(r.venue_slug),
    state: r.state === 'contested' ? 'contested' : 'declared',
    stateAt: str(r.state_at),
    responsibleName: str(r.responsible_name),
    evidencePath: str(r.evidence_path),
    declaredAt: str(r.declared_at),
    reports90d: Number(r.reports_90d ?? 0),
  };
}

export function mapHiddenPost(r: Record<string, unknown>): HiddenPost {
  return {
    kind: r.kind === 'comment' ? 'comment' : 'thread',
    id: String(r.id),
    threadId: String(r.thread_id),
    title: str(r.title),
    body: str(r.body),
    anonymous: r.anonymous === true,
    createdAt: String(r.created_at),
    reportCount: Number(r.report_count ?? 0),
    reasons: Array.isArray(r.reasons) ? r.reasons.map(String) : [],
  };
}

const KINDS = new Set<IncidentKind>(['assedio', 'importunacao', 'violencia', 'discriminacao', 'outro']);
const STATUSES = new Set<TicketStatus>(['open', 'answered', 'closed']);

export function mapSafetyReport(r: Record<string, unknown>): SafetyReportItem {
  const kind = KINDS.has(r.kind as IncidentKind) ? (r.kind as IncidentKind) : 'outro';
  const status = STATUSES.has(r.ticket_status as TicketStatus) ? (r.ticket_status as TicketStatus) : 'open';
  const messages = Array.isArray(r.messages)
    ? (r.messages as Record<string, unknown>[]).map((m) => ({
        sender: m.sender === 'user' ? ('user' as const) : ('support' as const),
        text: String(m.text ?? ''),
        at: String(m.at ?? ''),
      }))
    : [];
  return {
    ticketId: String(r.ticket_id),
    venueId: String(r.venue_id),
    venueName: String(r.venue_name),
    eventTitle: str(r.event_title),
    kind,
    checkedIn: r.checked_in === true,
    description: String(r.description ?? ''),
    status,
    createdAt: String(r.created_at),
    messages,
  };
}

export function mapAction(r: Record<string, unknown>): AdminAction {
  const d = r.details;
  return {
    id: String(r.id),
    actorName: str(r.actor_name),
    action: String(r.action),
    targetType: String(r.target_type),
    targetId: String(r.target_id),
    note: str(r.note),
    details: d && typeof d === 'object' && !Array.isArray(d) ? (d as Record<string, unknown>) : {},
    createdAt: String(r.created_at),
  };
}
