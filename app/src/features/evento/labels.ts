import { spParts } from '@/domain/format';
import type { Genre } from '@/domain/types';

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const MONTHS_LONG = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

export function genreLabels(slugs: string[], genres: Genre[] | undefined): string[] {
  return slugs.map((s) => genres?.find((g) => g.slug === s)?.label).filter((l): l is string => !!l);
}

/** "set/2026" */
export function monthYear(iso: string): string {
  const p = spParts(Date.parse(iso));
  return `${MONTHS[p.month]}/${p.year}`;
}

/** "2 de outubro de 2026" */
export function longDate(iso: string): string {
  const p = spParts(Date.parse(iso));
  return `${p.day} de ${MONTHS_LONG[p.month]} de ${p.year}`;
}
