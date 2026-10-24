import type { LiveReport } from '@/domain/engage';
import { buildTimeline, countdownFor, eventPhase } from '@/features/acompanhar/logic';
import { demoReports, sampleLine, STALE_MS, summarize } from '../logic';

const NOW = Date.parse('2026-10-23T22:00:00.000Z');
const at = (minAgo: number) => new Date(NOW - minAgo * 60_000).toISOString();
const rep = (id: string, minAgo: number, extra: Partial<LiveReport>): LiveReport => ({ id, eventId: 'e', at: at(minAgo), ...extra });
const rel = (iso: string) => `t:${Math.round((NOW - Date.parse(iso)) / 60_000)}`;

describe('summarize', () => {
  it('uses the mode of fresh reports, newest wins ties, reports sample size and age', () => {
    const s = summarize([rep('a', 5, { queue: 'long' }), rep('b', 10, { queue: 'short' }), rep('c', 20, { queue: 'short' })], NOW);
    expect(s.queue).toMatchObject({ value: 'short', n: 3, stale: false, at: at(5) });
    const tie = summarize([rep('a', 5, { crowd: 'full' }), rep('b', 10, { crowd: 'busy' })], NOW);
    expect(tie.crowd?.value).toBe('full');
  });
  it('marks reports older than 2h as stale and says so', () => {
    const s = summarize([rep('a', 130, { queue: 'none', priceAtDoor: 40 })], NOW);
    expect(STALE_MS).toBe(7_200_000);
    expect(s.queue).toMatchObject({ value: 'none', stale: true, n: 1 });
    expect(s.price).toMatchObject({ value: 40, stale: true });
    expect(s.allStale).toBe(true);
    expect(sampleLine(s, rel)).toMatch(/desatualizados/);
  });
  it('a report at exactly 2h is still fresh; fresh beats stale', () => {
    const s = summarize([rep('a', 120, { music: 'good' }), rep('b', 200, { music: 'peak' })], NOW);
    expect(s.music).toMatchObject({ value: 'good', stale: false, n: 1 });
  });
  it('medians the door price', () => {
    const s = summarize([rep('a', 5, { priceAtDoor: 30 }), rep('b', 6, { priceAtDoor: 50 }), rep('c', 7, { priceAtDoor: 40 })], NOW);
    expect(s.price?.value).toBe(40);
  });
  it('is honest when empty', () => {
    const s = summarize([], NOW);
    expect(s.queue).toBeUndefined();
    expect(s.freshCount).toBe(0);
    expect(sampleLine(s, rel)).toMatch(/Ainda sem relatos/);
  });
  it('sample line counts people', () => {
    expect(sampleLine(summarize(demoReports('x', NOW), NOW), rel)).toBe('Relatos de 14 pessoas, o último t:12. Pode estar desatualizado.');
    expect(sampleLine(summarize([rep('a', 3, { queue: 'none' })], NOW), rel)).toMatch(/^Relato de 1 pessoa/);
  });
});

describe('timeline and countdown', () => {
  const ev = { startsAt: at(-60), endsAt: undefined, priceMin: 30, priceMax: 50, isFree: false, status: 'published' as const };
  it('phases', () => {
    expect(eventPhase(ev, NOW)).toBe('before');
    expect(eventPhase(ev, NOW + 61 * 60_000)).toBe('live');
    expect(eventPhase(ev, NOW + 8 * 3600_000)).toBe('after');
  });
  it('first unfinished step is current', () => {
    let t = buildTimeline({ event: ev, follow: { hasTicket: false }, checkedIn: false, nowMs: NOW });
    expect(t.map((x) => x.status)).toEqual(['done', 'current', 'todo', 'todo']);
    t = buildTimeline({ event: ev, follow: { hasTicket: true }, checkedIn: false, nowMs: NOW });
    expect(t.map((x) => x.status)).toEqual(['done', 'done', 'current', 'todo']);
    t = buildTimeline({ event: ev, follow: { hasTicket: true }, checkedIn: false, nowMs: NOW + 8 * 3600_000 });
    expect(t.map((x) => x.status)).toEqual(['done', 'done', 'done', 'current']);
  });
  it('free events skip the ticket step and cancelled has no current step', () => {
    const free = buildTimeline({ event: { ...ev, isFree: true }, follow: { hasTicket: false }, checkedIn: false, nowMs: NOW });
    expect(free[1]).toMatchObject({ status: 'done', detail: 'Entrada gratuita' });
    const c = buildTimeline({ event: { ...ev, status: 'cancelled' }, follow: { hasTicket: true }, checkedIn: false, nowMs: NOW });
    expect(c.map((x) => x.status)).toEqual(['done', 'todo', 'todo', 'todo']);
  });
  it('countdown states', () => {
    const fmt = (iso: string, n: number) => `${Math.round((Date.parse(iso) - n) / 60_000)} min`;
    expect(countdownFor(ev, NOW, fmt)).toEqual({ kind: 'before', label: '60 min', caption: 'para começar' });
    expect(countdownFor(ev, NOW + 3600_000 * 2, fmt).kind).toBe('live');
    expect(countdownFor(ev, NOW + 3600_000 * 9, fmt).kind).toBe('after');
    expect(countdownFor({ ...ev, status: 'cancelled' }, NOW, fmt).kind).toBe('cancelled');
  });
});
