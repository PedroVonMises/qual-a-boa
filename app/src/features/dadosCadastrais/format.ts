import { formatCep, isValidCep, normalizeCep } from '@/lib/cep';
import type { ProfileAddress } from '@/state/profile';

/** Digits only, at most 11 (DDD + 9 digits). */
export const normalizePhone = (raw: string) => raw.replace(/\D/g, '').slice(0, 11);

/** Progressive mask (8-digit layout until the 11th digit): "27" → "(27", "2799999" → "(27) 9999-9", "27999990000" → "(27) 99999-0000", 10 digits → "(27) 9999-0000". */
export function formatPhone(raw: string): string {
  const d = normalizePhone(raw);
  if (!d) return '';
  if (d.length <= 2) return `(${d}`;
  const ddd = d.slice(0, 2);
  const rest = d.slice(2);
  const split = d.length === 11 ? 5 : 4;
  if (rest.length <= split) return `(${ddd}) ${rest}`;
  return `(${ddd}) ${rest.slice(0, split)}-${rest.slice(split)}`;
}

/** Empty is fine (the phone is optional); otherwise DDD + 8 or 9 digits. */
export function isValidPhone(raw: string): boolean {
  const d = normalizePhone(raw);
  return d.length === 0 || d.length === 10 || d.length === 11;
}

/** What the form edits: plain strings, no coordinates. */
export interface AddressDraft {
  cep: string;
  street: string;
  number: string;
  complement: string;
  district: string;
  city: string;
  uf: string;
}

export type AddressField = keyof AddressDraft;
export type AddressErrors = Partial<Record<AddressField, string>>;

export const EMPTY_DRAFT: AddressDraft = { cep: '', street: '', number: '', complement: '', district: '', city: '', uf: '' };

export function draftFromAddress(a: ProfileAddress | null | undefined): AddressDraft {
  if (!a) return EMPTY_DRAFT;
  return {
    cep: formatCep(a.cep),
    street: a.street,
    number: a.number,
    complement: a.complement ?? '',
    district: a.district,
    city: a.city,
    uf: a.uf,
  };
}

export const isDraftEmpty = (d: AddressDraft) => Object.values(d).every((v) => !v.trim());

/** Per-field errors, same rules (and copy) as `validateAddress` in data/address.ts. */
export function addressFieldErrors(d: AddressDraft): AddressErrors {
  const e: AddressErrors = {};
  if (!isValidCep(d.cep)) e.cep = 'Digite um CEP com 8 números.';
  if (!d.street.trim()) e.street = 'Digite a rua.';
  if (!d.number.trim()) e.number = 'Digite o número (ou "s/n").';
  if (!d.district.trim()) e.district = 'Digite o bairro.';
  if (!d.city.trim()) e.city = 'Digite a cidade.';
  if (!/^[A-Za-z]{2}$/.test(d.uf.trim())) e.uf = 'Use a sigla do estado, como ES.';
  return e;
}

/** Text for on-device geocoding: "Rua X, 823, Bairro, Cidade - UF, Brasil". */
export function geocodeQuery(d: AddressDraft): string {
  return `${d.street.trim()}, ${d.number.trim()}, ${d.district.trim()}, ${d.city.trim()} - ${d.uf.trim().toUpperCase()}, Brasil`;
}

export function draftToAddress(d: AddressDraft, point: { lat: number; lng: number }): ProfileAddress {
  return {
    cep: normalizeCep(d.cep),
    street: d.street,
    number: d.number,
    district: d.district,
    city: d.city,
    uf: d.uf,
    lat: point.lat,
    lng: point.lng,
    ...(d.complement.trim() ? { complement: d.complement } : {}),
  };
}

/** "R. X · Bairro · Cidade, UF" for the CEP confirmation line. */
export function confirmLine(d: Pick<AddressDraft, 'street' | 'district' | 'city' | 'uf'>): string {
  return [d.street.trim(), d.district.trim(), `${d.city.trim()}, ${d.uf.trim().toUpperCase()}`].filter(Boolean).join(' · ');
}
