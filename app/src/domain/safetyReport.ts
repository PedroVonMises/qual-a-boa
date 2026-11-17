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
