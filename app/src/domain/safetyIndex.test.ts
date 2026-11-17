import type { Review } from './engage';
import { cleanSafetyAnswers, computeSafetyStats, feltSafeLabel, safetyAverageLabel, safetyIndexCaption, safetyToRow } from './safetyIndex';

const NOW = Date.parse('2026-11-17T12:00:00Z');
const base: Review = {
  id: 'r', eventId: 'e1', rating: 4, topics: {}, tags: [], anonymous: true, attended: true, status: 'published',
  createdAt: '2026-11-10T00:00:00Z', helpfulCount: 0, mine: false,
};
const rv = (i: number, seguranca: 1 | 2 | 3 | 4 | 5 | null, feltSafe?: 'sim' | 'nao', extra: Partial<Review> = {}) => ({
  ...base, id: `r${i}`, ...(seguranca ? { topics: { seguranca } } : {}), ...(feltSafe ? { safety: { feltSafe } } : {}), ...extra,
});
const starts: Record<string, string> = { e1: '2026-11-07T23:00:00Z', old: '2026-04-01T23:00:00Z', future: '2026-12-01T23:00:00Z' };

describe('safety index (mirror of venue_safety_stats)', () => {
  it('needs 5 published attended reviews of recent past events', () => {
    const four = [1, 2, 3, 4].map((i) => rv(i, 5, 'sim'));
    const noise = [
      rv(10, 1, 'nao', { status: 'pending' }),
      rv(11, 1, 'nao', { attended: false }),
      rv(12, 1, 'nao', { eventId: 'old' }),
      rv(13, 1, 'nao', { eventId: 'future' }),
      rv(14, 1, 'nao', { eventId: 'other-venue' }),
    ];
    const s = computeSafetyStats([...four, ...noise], (id) => starts[id], NOW);
    expect(s).toEqual({ sampleSize: 4, average: null, feltSafeN: 4, feltSafeShare: null });
    expect(safetyAverageLabel(s)).toBeNull();
    expect(safetyIndexCaption(s)).toMatch(/a partir de 5 avaliações com check-in nos últimos 6 meses/);

    const five = computeSafetyStats([...four, rv(5, 1, 'nao'), rv(6, null)], (id) => starts[id], NOW);
    expect(five).toEqual({ sampleSize: 5, average: 4.2, feltSafeN: 5, feltSafeShare: 0.8 });
    expect(safetyAverageLabel(five)).toBe('4,2 de 5');
    expect(feltSafeLabel(five)).toBe('80% se sentiram seguras');
    expect(safetyIndexCaption(five)).toBe('Segundo 5 pessoas que fizeram check-in nos últimos 6 meses.');
  });

  it('cleans answers and writes the snake_case row', () => {
    expect(cleanSafetyAnswers({ feltSafe: 'sim', harassment: 'talvez', staffHelped: 'nao_precisei', x: 1 })).toEqual({ feltSafe: 'sim', staffHelped: 'nao_precisei' });
    expect(cleanSafetyAnswers(null)).toEqual({});
    expect(safetyToRow({ feltSafe: 'em_parte', harassment: 'sim' })).toEqual({ felt_safe: 'em_parte', harassment: 'sim' });
  });
});
