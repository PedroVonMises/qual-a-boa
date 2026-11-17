// "Cheguei em casa" (S5 in docs/MVP-PLANO.md). Everything stays on the device: the trusted contacts, the trip and the
// reminder. The app only opens WhatsApp or SMS with a ready message; it never sends anything itself.

export const TRUSTED_CONTACTS_MAX = 3;
export const NAME_MAX = 40;
export const REMINDER_MINUTES = [30, 45, 60, 90] as const;
export type ReminderMinutes = (typeof REMINDER_MINUTES)[number];
export const DEFAULT_REMINDER: ReminderMinutes = 45;

export interface TrustedContact {
  id: string;
  name: string;
  /** Digits only, with country code (55 for Brazil). */
  phone: string;
}

/**
 * Phone typed by the person -> digits with country code, or null if it does not look like a phone. Brazilian numbers
 * (DDD + 8 or 9 digits) get 55 in front; a number typed with + keeps its own country code.
 */
export function normalizePhone(input: string): string | null {
  const raw = input.trim();
  const digits = raw.replace(/\D/g, '');
  if (raw.startsWith('+')) return digits.length >= 10 && digits.length <= 15 ? digits : null;
  const local = digits.replace(/^0+/, '');
  if (local.length === 10 || local.length === 11) return `55${local}`;
  if ((local.length === 12 || local.length === 13) && local.startsWith('55')) return local;
  return null;
}

/** "+55 27 99999-0000" for display. */
export function formatPhone(phone: string): string {
  const m = /^55(\d{2})(\d{4,5})(\d{4})$/.exec(phone);
  return m ? `+55 ${m[1]} ${m[2]}-${m[3]}` : `+${phone}`;
}

export type ContactCheck = { ok: true; contact: Omit<TrustedContact, 'id'> } | { ok: false; error: string };

export function validateContact(name: string, phone: string, existing: readonly TrustedContact[]): ContactCheck {
  const n = name.trim().replace(/\s+/g, ' ');
  if (!n) return { ok: false, error: 'Diga o nome da pessoa.' };
  if (n.length > NAME_MAX) return { ok: false, error: `Use até ${NAME_MAX} letras no nome.` };
  const p = normalizePhone(phone);
  if (!p) return { ok: false, error: 'Confira o número, com DDD.' };
  if (existing.some((c) => c.phone === p)) return { ok: false, error: 'Esse número já está na lista.' };
  if (existing.length >= TRUSTED_CONTACTS_MAX) return { ok: false, error: `Você pode ter até ${TRUSTED_CONTACTS_MAX} contatos.` };
  return { ok: true, contact: { name: n, phone: p } };
}

export interface TripPlace {
  venueName: string;
  eventTitle?: string;
}

export function leavingMessage(place: TripPlace | null): string {
  if (!place) return 'Tô voltando pra casa. Te aviso quando chegar.';
  const where = place.eventTitle ? `do ${place.eventTitle}, na ${place.venueName}` : `da ${place.venueName}`;
  return `Tô saindo ${where}. Te aviso quando chegar em casa.`;
}

export const ARRIVED_MESSAGE = 'Cheguei em casa, tudo certo!';

export const whatsappTo = (phone: string, text: string) => `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;

/** iOS separates the body with "&", Android with "?". */
export const smsTo = (phone: string, text: string, os: 'ios' | 'android' | 'web' | string) =>
  `sms:+${phone}${os === 'ios' ? '&' : '?'}body=${encodeURIComponent(text)}`;

export const REMINDER_TITLE = 'Já chegou?';
export const REMINDER_BODY = 'Avise quem está esperando notícia sua.';
