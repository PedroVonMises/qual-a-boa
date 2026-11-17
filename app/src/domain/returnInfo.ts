// Informações de volta da casa (S8 in docs/MVP-PLANO.md). Server: venues.return_info + set_return_info (migration
// 0022). The casa fills it; the venue page shows it under "Na volta".

export type LitStreet = 'sim' | 'em_parte' | 'nao';
export type Parking = 'proprio' | 'conveniado' | 'rua' | 'nao';

export interface ReturnInfo {
  /** Where to wait for a ride-hailing car, e.g. "Em frente à farmácia, do outro lado da rua". */
  ridesharePoint?: string;
  /** Nearest bus stop. */
  busStop?: string;
  litStreet?: LitStreet;
  parking?: Parking;
}

export const RETURN_TEXT_MIN = 2;
export const RETURN_TEXT_MAX = 140;

export const LIT_STREET_OPTIONS: readonly { value: LitStreet; label: string }[] = [
  { value: 'sim', label: 'Bem iluminada' },
  { value: 'em_parte', label: 'Em parte' },
  { value: 'nao', label: 'Pouco iluminada' },
];

export const PARKING_OPTIONS: readonly { value: Parking; label: string }[] = [
  { value: 'proprio', label: 'Estacionamento próprio' },
  { value: 'conveniado', label: 'Estacionamento conveniado' },
  { value: 'rua', label: 'Só na rua' },
  { value: 'nao', label: 'Sem estacionamento' },
];

const LIT: readonly string[] = LIT_STREET_OPTIONS.map((o) => o.value);
const PARK: readonly string[] = PARKING_OPTIONS.map((o) => o.value);

const text = (v: unknown) => {
  if (typeof v !== 'string') return undefined;
  const t = v.trim().replace(/\s+/g, ' ');
  return t.length >= RETURN_TEXT_MIN && t.length <= RETURN_TEXT_MAX ? t : undefined;
};

/** Wire (snake_case jsonb) or app (camelCase) object -> known answers only. */
export function cleanReturnInfo(v: unknown): ReturnInfo {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return {};
  const o = v as Record<string, unknown>;
  const out: ReturnInfo = {};
  const ride = text(o.rideshare_point ?? o.ridesharePoint);
  const bus = text(o.bus_stop ?? o.busStop);
  const lit = o.lit_street ?? o.litStreet;
  const park = o.parking;
  if (ride) out.ridesharePoint = ride;
  if (bus) out.busStop = bus;
  if (typeof lit === 'string' && LIT.includes(lit)) out.litStreet = lit as LitStreet;
  if (typeof park === 'string' && PARK.includes(park)) out.parking = park as Parking;
  return out;
}

export const hasReturnInfo = (r: ReturnInfo | undefined): r is ReturnInfo => !!r && Object.keys(r).length > 0;

/** Payload for set_return_info. */
export function returnInfoToRow(r: ReturnInfo): Record<string, string> {
  const c = cleanReturnInfo(r);
  const row: Record<string, string> = {};
  if (c.ridesharePoint) row.rideshare_point = c.ridesharePoint;
  if (c.busStop) row.bus_stop = c.busStop;
  if (c.litStreet) row.lit_street = c.litStreet;
  if (c.parking) row.parking = c.parking;
  return row;
}

/** Form check for a free-text field: empty is fine (not informed). */
export function returnTextError(v: string): string | null {
  const t = v.trim();
  if (!t) return null;
  if (t.length < RETURN_TEXT_MIN) return 'Escreva um pouco mais.';
  if (t.length > RETURN_TEXT_MAX) return `Use até ${RETURN_TEXT_MAX} caracteres.`;
  return null;
}

/** Rows for the venue page, in reading order. */
export function returnInfoRows(r: ReturnInfo): { key: keyof ReturnInfo; label: string; value: string }[] {
  const rows: { key: keyof ReturnInfo; label: string; value: string }[] = [];
  if (r.ridesharePoint) rows.push({ key: 'ridesharePoint', label: 'Embarque de app', value: r.ridesharePoint });
  if (r.litStreet) rows.push({ key: 'litStreet', label: 'Rua', value: LIT_STREET_OPTIONS.find((o) => o.value === r.litStreet)!.label });
  if (r.busStop) rows.push({ key: 'busStop', label: 'Ponto de ônibus', value: r.busStop });
  if (r.parking) rows.push({ key: 'parking', label: 'Estacionamento', value: PARKING_OPTIONS.find((o) => o.value === r.parking)!.label });
  return rows;
}

export const RETURN_INFO_SOURCE = 'Informado pela casa.';
