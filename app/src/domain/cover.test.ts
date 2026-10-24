import { ART_PALETTES } from '@/ui/art/palettes';
import { TEMPLATES } from '@/ui/art/templates';
import { COVER_PALETTE_IDS, COVER_TEMPLATE_IDS, GENRE_TEMPLATES, coverFor, parseCoverKey } from './cover';

const KEY_RE = /^art:[a-z0-9-]+:[a-z0-9-]+:[a-z0-9-]+$/;
const GENRES = Object.keys(GENRE_TEMPLATES);

describe('coverFor', () => {
  it('is deterministic', () => {
    const a = coverFor({ genreSlugs: ['funk'], venueSlug: 'bolt', eventId: 'evt-1' });
    const b = coverFor({ genreSlugs: ['funk'], venueSlug: 'bolt', eventId: 'evt-1' });
    expect(a).toBe(b);
  });

  it('returns well-formed keys that the UI can resolve', () => {
    for (let i = 0; i < 200; i++) {
      const key = coverFor({ genreSlugs: [GENRES[i % GENRES.length]], eventId: `e-${i}` });
      expect(key).toMatch(KEY_RE);
      const parsed = parseCoverKey(key);
      expect(parsed).not.toBeNull();
      expect(TEMPLATES[parsed!.template as keyof typeof TEMPLATES]).toBeDefined();
      expect(COVER_PALETTE_IDS).toContain(parsed!.palette);
    }
  });

  it('maps every genre to templates of its family', () => {
    for (const g of GENRES) {
      for (let i = 0; i < 40; i++) {
        const parsed = parseCoverKey(coverFor({ genreSlugs: [g], eventId: `${g}-${i}` }))!;
        expect(GENRE_TEMPLATES[g]).toContain(parsed.template);
      }
    }
  });

  it('only references templates and palettes that exist', () => {
    expect([...COVER_TEMPLATE_IDS].sort()).toEqual(Object.keys(TEMPLATES).sort());
    expect([...COVER_PALETTE_IDS]).toEqual(ART_PALETTES.map((p) => p.id));
    for (const fam of Object.values(GENRE_TEMPLATES)) for (const t of fam) expect(COVER_TEMPLATE_IDS).toContain(t);
  });

  it('falls back to any template for unknown or missing genres', () => {
    expect(coverFor({ genreSlugs: [], eventId: 'x' })).toMatch(KEY_RE);
    expect(coverFor({ genreSlugs: ['nada'], eventId: 'x' })).toMatch(KEY_RE);
  });

  it('spreads 70 events: no template+palette pair above 8%', () => {
    const counts = new Map<string, number>();
    for (let i = 0; i < 70; i++) {
      const key = coverFor({ genreSlugs: [GENRES[i % GENRES.length]], venueSlug: 'bolt', eventId: `00000000-0000-3000-8000-${String(i * 7919).padStart(12, '0')}` });
      const p = parseCoverKey(key)!;
      const pair = `${p.template}:${p.palette}`;
      counts.set(pair, (counts.get(pair) ?? 0) + 1);
    }
    expect(Math.max(...counts.values())).toBeLessThanOrEqual(Math.floor(70 * 0.08));
    expect(new Set([...counts.keys()].map((k) => k.split(':')[0])).size).toBeGreaterThanOrEqual(10);
  });
});

describe('parseCoverKey', () => {
  it('parses art keys and rejects legacy or malformed ones', () => {
    expect(parseCoverKey('art:disco:rosa-ambar:b')).toEqual({ template: 'disco', palette: 'rosa-ambar', variant: 'b' });
    expect(parseCoverKey('bolt')).toBeNull();
    expect(parseCoverKey('art:disco:rosa-ambar')).toBeNull();
  });
});
