// Tier 1: curated submissions from venues/producers. `data/curated/*.json` and `*.csv` (Google Form export).
// Schema and column mapping are documented in ingest/README.md and docs/INGESTION.md.
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { fold } from '../text.js';
import { looksFree, parseBRL, pricesInText, toOffsetISO } from '../parse.js';
import { shortHash } from '../ids.js';
import type { FetchContext, RawEvent, RawStatus, SourceAdapter } from '../types.js';
import { emptyReport, type AdapterReport } from './report.js';

export const MANUAL_SOURCE = 'manual';

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------
/** RFC 4180 parser; delimiter is auto-detected between `,` and `;` from the header line. */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, '');
  const firstLine = src.split(/\r?\n/, 1)[0] ?? '';
  const delim = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ';' : ',';
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let q = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i]!;
    if (q) {
      if (c === '"') {
        if (src[i + 1] === '"') { cell += '"'; i++; } else q = false;
      } else cell += c;
    } else if (c === '"') q = true;
    else if (c === delim) { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some((x) => x.trim() !== '')) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x.trim() !== '')) rows.push(row);
  return rows;
}

/** Folded header -> canonical field. First match wins. */
export const CSV_COLUMNS: Record<string, string[]> = {
  title: ['nome do evento', 'evento', 'titulo', 'nome'],
  venue: ['local', 'nome do local', 'casa', 'casa / local', 'venue'],
  address: ['endereco', 'endereco do local'],
  date: ['data', 'data do evento'],
  start: ['horario de inicio', 'hora de inicio', 'inicio', 'horario'],
  end: ['horario de termino', 'hora de termino', 'termino', 'fim'],
  priceMin: ['valor minimo', 'preco minimo', 'valor', 'preco', 'ingresso'],
  priceMax: ['valor maximo', 'preco maximo'],
  free: ['gratuito', 'entrada gratuita', 'evento gratuito'],
  age: ['idade minima', 'classificacao', 'idade'],
  lineup: ['atracoes', 'line-up', 'lineup', 'line up', 'artistas'],
  url: ['link dos ingressos', 'link de ingressos', 'link', 'site', 'ingressos'],
  description: ['descricao', 'sobre'],
  status: ['status', 'situacao'],
};

function buildHeaderMap(headers: string[]): Map<string, number> {
  const idx = new Map<string, number>();
  const folded = headers.map((h) => fold(h).replace(/[^a-z0-9/ -]+/g, '').replace(/\s+/g, ' ').trim());
  for (const [field, names] of Object.entries(CSV_COLUMNS)) {
    for (const n of names) {
      const i = folded.indexOf(n);
      if (i >= 0) { idx.set(field, i); break; }
    }
  }
  return idx;
}

const isYes = (s: string) => /^(sim|s|yes|y|true|1|x)$/i.test(fold(s).trim());

/** "07/11/2026", "7/11/26" or "2026-11-07" -> "2026-11-07". */
export function parseLocalDate(s: string): string | null {
  const t = s.trim();
  let m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4}|\d{2})(?!\d)/);
  if (!m) return null;
  const y = m[3]!.length === 2 ? `20${m[3]}` : m[3]!;
  return `${y}-${m[2]!.padStart(2, '0')}-${m[1]!.padStart(2, '0')}`;
}
/** "23:00", "23h", "23h30", "23" -> "23:00". */
export function parseLocalTime(s: string): string | null {
  const m = s.trim().match(/^(\d{1,2})(?:[:h](\d{2})?)?\s*(?:h|hs)?$/i);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2] ?? '0');
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

const splitList = (s: string) => s.split(/[;\n]|,(?![^(]*\))/).map((x) => x.trim()).filter(Boolean);

function parseStatus(s: string | undefined): RawStatus | undefined {
  if (!s) return undefined;
  const f = fold(s);
  if (/cancel/.test(f)) return 'cancelled';
  if (/esgot|sold/.test(f)) return 'soldout';
  return 'scheduled';
}

export interface ManualRecord {
  sourceId?: string;
  title?: string;
  venue?: string;
  venueName?: string;
  venueAddress?: string;
  address?: string;
  startsAt?: string;
  endsAt?: string;
  /** Alternative to startsAt: local date + time. */
  date?: string;
  start?: string;
  end?: string;
  priceMin?: number | string;
  priceMax?: number | string;
  /** Free text like "R$ 30 a R$ 50" or "gratuito". */
  price?: number | string;
  isFree?: boolean;
  ageMin?: number;
  lineup?: string[] | string;
  url?: string;
  description?: string;
  status?: string;
}

/** Converts one submission to a RawEvent, or a reason why not. */
export function recordToRaw(r: ManualRecord, fetchedAt: string): { event?: RawEvent; problem?: string } {
  const title = r.title?.trim();
  const venueName = (r.venueName ?? r.venue)?.trim();
  if (!title) return { problem: 'title missing' };
  if (!venueName) return { problem: 'venue missing' };

  let startsAt = r.startsAt ? toOffsetISO(r.startsAt) : null;
  let endsAt = r.endsAt ? toOffsetISO(r.endsAt) : null;
  if (!startsAt && r.date && r.start) {
    const d = parseLocalDate(r.date);
    const t = parseLocalTime(r.start);
    if (d && t) startsAt = toOffsetISO(`${d}T${t}`);
    if (d && t && r.end) {
      const e = parseLocalTime(r.end);
      if (e) {
        let endIso = toOffsetISO(`${d}T${e}`);
        if (endIso && Date.parse(endIso) <= Date.parse(startsAt!)) {
          const next = new Date(Date.parse(`${d}T12:00:00Z`) + 86400_000).toISOString().slice(0, 10);
          endIso = toOffsetISO(`${next}T${e}`);
        }
        endsAt = endIso;
      }
    }
  }
  if (!startsAt) return { problem: 'start date/time missing or invalid (need startsAt, or date + start)' };
  if (endsAt && Date.parse(endsAt) <= Date.parse(startsAt)) endsAt = null;

  let priceMin: number | undefined;
  let priceMax: number | undefined;
  let isFree = r.isFree;
  const num = (v: number | string | undefined) => (v === undefined || v === '' ? null : typeof v === 'number' ? parseBRL(v) : looksFree(v) ? 0 : parseBRL(v));
  const pMin = num(r.priceMin);
  const pMax = num(r.priceMax);
  if (pMin !== null) priceMin = pMin;
  if (pMax !== null) priceMax = pMax;
  if (r.price !== undefined && r.price !== '' && priceMin === undefined) {
    if (typeof r.price === 'number') priceMin = priceMax = r.price;
    else if (looksFree(r.price)) { priceMin = priceMax = 0; isFree = true; }
    else {
      const all = pricesInText(r.price);
      const single = all.length ? all : [parseBRL(r.price)].filter((x): x is number => x !== null);
      if (single.length) { priceMin = Math.min(...single); priceMax = Math.max(...single); }
    }
  }
  if (priceMin !== undefined && priceMax === undefined) priceMax = priceMin;
  if (priceMin === undefined && priceMax !== undefined) priceMin = priceMax;
  if (isFree === undefined && priceMax !== undefined) isFree = priceMax === 0;

  const url = r.url?.trim() ?? '';
  const lineup = typeof r.lineup === 'string' ? splitList(r.lineup) : r.lineup?.map((x) => x.trim()).filter(Boolean);
  const venueAddress = (r.venueAddress ?? r.address)?.trim();
  const status = parseStatus(r.status);
  const key = `${fold(title)}|${startsAt.slice(0, 16)}|${fold(venueName)}`;

  const event: RawEvent = {
    source: MANUAL_SOURCE,
    sourceId: r.sourceId?.trim() || shortHash(key),
    url,
    title,
    startsAt,
    venueName,
    fetchedAt,
  };
  if (endsAt) event.endsAt = endsAt;
  if (venueAddress) event.venueAddress = venueAddress;
  if (priceMin !== undefined) event.priceMin = priceMin;
  if (priceMax !== undefined) event.priceMax = priceMax;
  if (isFree !== undefined) event.isFree = isFree;
  if (r.ageMin !== undefined && Number.isFinite(r.ageMin)) event.ageMin = r.ageMin;
  if (r.description?.trim()) event.description = r.description.trim();
  if (lineup?.length) event.lineup = lineup;
  if (status) event.status = status;
  return { event };
}

export function csvToRecords(text: string): ManualRecord[] {
  const rows = parseCsv(text);
  const head = rows[0];
  if (!head) return [];
  const map = buildHeaderMap(head);
  const get = (row: string[], f: string) => {
    const i = map.get(f);
    const v = i === undefined ? undefined : row[i]?.trim();
    return v === '' ? undefined : v;
  };
  return rows.slice(1).map((row) => {
    const rec: ManualRecord = {};
    const set = <K extends keyof ManualRecord>(k: K, v: ManualRecord[K] | undefined) => { if (v !== undefined) rec[k] = v; };
    set('title', get(row, 'title'));
    set('venue', get(row, 'venue'));
    set('address', get(row, 'address'));
    set('date', get(row, 'date'));
    set('start', get(row, 'start'));
    set('end', get(row, 'end'));
    set('priceMin', get(row, 'priceMin'));
    set('priceMax', get(row, 'priceMax'));
    const free = get(row, 'free');
    if (free !== undefined) set('isFree', isYes(free));
    const age = get(row, 'age');
    if (age !== undefined) {
      const m = age.match(/\d+/);
      if (m) set('ageMin', Number(m[0]));
      else if (/livre/i.test(age)) set('ageMin', 0);
    }
    set('lineup', get(row, 'lineup'));
    set('url', get(row, 'url'));
    set('description', get(row, 'description'));
    set('status', get(row, 'status'));
    return rec;
  });
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------
export interface ManualAdapter extends SourceAdapter {
  report: AdapterReport;
}

export function createManualAdapter(dataDir: string): ManualAdapter {
  const report = emptyReport();
  return {
    id: MANUAL_SOURCE,
    tier: 1,
    report,
    enabled: () => true,
    async fetch(ctx: FetchContext): Promise<RawEvent[]> {
      const dir = join(dataDir, 'curated');
      let files: string[] = [];
      try {
        files = (await readdir(dir)).filter((f) => /\.(json|csv)$/i.test(f)).sort();
      } catch {
        return [];
      }
      const out: RawEvent[] = [];
      const fetchedAt = ctx.now.toISOString();
      for (const f of files) {
        let records: ManualRecord[] = [];
        try {
          const text = await readFile(join(dir, f), 'utf8');
          if (/\.csv$/i.test(f)) records = csvToRecords(text);
          else {
            const j = JSON.parse(text) as unknown;
            const list = Array.isArray(j) ? j : (j as { events?: unknown }).events;
            if (!Array.isArray(list)) throw new Error('expected an array or { "events": [...] }');
            records = list as ManualRecord[];
          }
        } catch (e) {
          report.needsReview.push({ source: MANUAL_SOURCE, ref: f, reason: `unreadable file: ${e instanceof Error ? e.message : String(e)}` });
          continue;
        }
        records.forEach((rec, i) => {
          const { event, problem } = recordToRaw(rec, fetchedAt);
          if (event) out.push(event);
          else report.needsReview.push({ source: MANUAL_SOURCE, ref: `${f}#${i + 1}`, reason: problem ?? 'invalid', partial: { ...rec } });
        });
      }
      report.stats.files = files.length;
      return out;
    },
  };
}
