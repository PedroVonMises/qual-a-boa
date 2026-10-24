// Wave 3 engagement types: tracking, live reports, reviews, support.
// Local-first: each feature keeps its data in a persisted zustand store (src/state/<feature>.ts)
// so the app works with EXPO_PUBLIC_DATA_SOURCE=seed. Supabase tables (migration 0005) mirror these shapes.
// Dates are ISO 8601 UTC. Event ids reference EventItem.id.

// --- Tracking (Acompanhar, Avisos) ---
export type AlertChannel = 'push' | 'email';
export type AlertKind = 'price' | 'lineup' | 'lastTickets' | 'dayBefore' | 'cancelled';

export interface EventFollow {
  eventId: string;
  followedAt: string;
  hasTicket: boolean;
  alerts: Record<AlertKind, boolean>;
  channels: Record<AlertChannel, boolean>;
}

export interface EventChange {
  id: string;
  eventId: string;
  kind: AlertKind;
  text: string; // pt-BR, e.g. 'Ingresso subiu de R$ 40 para R$ 50'
  at: string;
  read: boolean;
}

// --- Live (Ao vivo) ---
export type QueueLevel = 'none' | 'short' | 'long';
export type CrowdLevel = 'empty' | 'busy' | 'full';
export type MusicLevel = 'warmup' | 'good' | 'peak';

export interface LiveReport {
  id: string;
  eventId: string;
  at: string;
  queue?: QueueLevel;
  crowd?: CrowdLevel;
  music?: MusicLevel;
  priceAtDoor?: number; // BRL reais
}

// --- Reviews (Avaliar, Avaliações) ---
export type ReviewTopic = 'musica' | 'ambiente' | 'atendimento' | 'seguranca' | 'preco' | 'fila';
export type ReviewStatus = 'published' | 'pending' | 'hidden';

export interface Review {
  id: string;
  eventId: string;
  rating: 1 | 2 | 3 | 4 | 5;
  topics: Partial<Record<ReviewTopic, 1 | 2 | 3 | 4 | 5>>;
  tags: string[];
  text?: string;
  anonymous: boolean;
  attended: boolean; // 'Foi ao evento': requires a check-in
  status: ReviewStatus;
  createdAt: string;
  helpfulCount: number;
  mine: boolean;
}

// --- Support (Ajuda, Mensagens, Suporte, Novo chamado) ---
export type TicketTopic = 'ingresso' | 'conta' | 'evento' | 'casa' | 'seguranca' | 'outro';
export type TicketStatus = 'open' | 'answered' | 'closed';

export interface SupportMessage {
  id: string;
  ticketId: string;
  from: 'user' | 'support';
  text: string;
  at: string;
  readAt?: string;
}

export interface SupportTicket {
  id: string;
  topic: TicketTopic;
  eventId?: string;
  description: string;
  status: TicketStatus;
  createdAt: string;
  messages: SupportMessage[];
}

/** Check-in is the only way to unlock 'Foi ao evento' reviews and the live reporter. */
export interface Checkin {
  eventId: string;
  at: string;
}
