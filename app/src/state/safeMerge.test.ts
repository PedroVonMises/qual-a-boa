import { safeMerge } from './safeMerge';
import { isHttpsUrl } from '@/features/evento/linking';

describe('safeMerge', () => {
  const base = { list: [] as string[], map: {} as Record<string, number>, n: 1, fn: () => 1 };
  it('keeps well-shaped values', () => {
    expect(safeMerge({ list: ['a'], n: 2 }, base)).toMatchObject({ list: ['a'], n: 2 });
  });
  it('drops wrongly shaped or unknown values', () => {
    const out = safeMerge({ list: 'x', map: null, n: 'z', fn: 5, extra: 1 }, base);
    expect(out.list).toEqual([]);
    expect(out.map).toEqual({});
    expect(out.n).toBe(1);
    expect(typeof out.fn).toBe('function');
    expect('extra' in out).toBe(false);
  });
  it('ignores non-object payloads', () => {
    expect(safeMerge(null, base)).toBe(base);
    expect(safeMerge([1], base)).toBe(base);
  });
});

describe('isHttpsUrl', () => {
  it('rejects userinfo tricks and other schemes', () => {
    expect(isHttpsUrl('https://paypal.com@evil.com/')).toBe(false);
    expect(isHttpsUrl('javascript:alert(1)')).toBe(false);
    expect(isHttpsUrl('http://a.com')).toBe(false);
    expect(isHttpsUrl('https://sympla.com.br/evento?x=1')).toBe(true);
  });
});
