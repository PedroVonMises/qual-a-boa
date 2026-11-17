// Denúncia de assédio, "Aconteceu algo comigo" (S3 in docs/MVP-PLANO.md). Server: report_safety_incident (0021).
// The report becomes a private support ticket (topic 'seguranca'); the casa never sees it, only its effect on the seal.

export const SAFETY_INCIDENT_KINDS = [
  { value: 'assedio', label: 'Assédio' },
  { value: 'importunacao', label: 'Importunação ou toque sem consentimento' },
  { value: 'violencia', label: 'Violência ou ameaça' },
  { value: 'discriminacao', label: 'Discriminação' },
  { value: 'outro', label: 'Outra situação' },
] as const;

export type SafetyIncidentKind = (typeof SAFETY_INCIDENT_KINDS)[number]['value'];

export const isSafetyIncidentKind = (v: unknown): v is SafetyIncidentKind =>
  typeof v === 'string' && SAFETY_INCIDENT_KINDS.some((k) => k.value === v);

export const incidentKindLabel = (k: SafetyIncidentKind) => SAFETY_INCIDENT_KINDS.find((x) => x.value === k)!.label;

/** Emergency lines shown with one tap (S3/S4). Calls go through the phone app; nothing is recorded. */
export const EMERGENCY_LINES = [
  { number: '190', label: 'Ligar 190', detail: 'Polícia Militar, para perigo agora' },
  { number: '180', label: 'Ligar 180', detail: 'Central de Atendimento à Mulher, 24 h e gratuita' },
] as const;

export const telUrl = (number: string) => `tel:${number.replace(/[^0-9+]/g, '')}`;

export const SAFETY_REPORT_PRIVACY =
  'Seu relato nunca é publicado e a casa não fica sabendo quem relatou. Só a equipe do Qual a Boa lê e responde por aqui.';

/** Map link that opens in any phone (Google Maps universal URL). */
export const mapsLink = (lat: number, lng: number) =>
  `https://www.google.com/maps/search/?api=1&query=${lat.toFixed(6)},${lng.toFixed(6)}`;

export interface SharePlace {
  name: string;
  address?: string;
  lat: number;
  lng: number;
  /** Event title, when sharing from an event page. */
  eventTitle?: string;
}

/**
 * "Compartilhar minha localização" (S4): the text handed to the system share sheet. With a fresh fix it carries the
 * person's own position; without one (no permission, no signal) it falls back to the venue's. The app keeps nothing.
 */
export function locationShareMessage(place: SharePlace, me?: { lat: number; lng: number } | null): string {
  const where = place.eventTitle ? `em ${place.eventTitle}, na ${place.name}` : `na ${place.name}`;
  const addr = place.address ? ` (${place.address})` : '';
  if (me) return `Estou ${where}${addr}. Minha localização agora: ${mapsLink(me.lat, me.lng)}`;
  return `Estou ${where}${addr}. Endereço no mapa: ${mapsLink(place.lat, place.lng)}`;
}
