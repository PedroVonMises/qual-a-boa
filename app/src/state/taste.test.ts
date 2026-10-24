import { addGenre, addView, decayed, HALF_LIFE_MS, MAX_VIEWS, useTaste } from './taste';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

describe('taste store', () => {
  beforeEach(() => useTaste.getState().reset());

  it('records genre filters and views, then resets', () => {
    useTaste.getState().recordGenreFilter('funk', 1000);
    useTaste.getState().recordView('venue', 'bolt', 1000);
    expect(useTaste.getState().genres.funk.w).toBe(1);
    expect(useTaste.getState().views).toHaveLength(1);
    useTaste.getState().reset();
    expect(useTaste.getState().genres).toEqual({});
    expect(useTaste.getState().views).toEqual([]);
  });

  it('decays by half-life and caps weight and views', () => {
    expect(decayed(2, 0, HALF_LIFE_MS)).toBeCloseTo(1);
    let g: Record<string, { w: number; at: number }> = {};
    for (let i = 0; i < 20; i++) g = addGenre(g, 'funk', 0);
    expect(g.funk.w).toBe(5);
    let v = addView([], 'event', 'e0', 0);
    for (let i = 0; i < 50; i++) v = addView(v, 'event', 'e' + i, i);
    expect(v).toHaveLength(MAX_VIEWS);
    expect(v[0].id).toBe('e49');
    expect(addView(v, 'event', 'e49', 99)).toHaveLength(MAX_VIEWS);
  });
});
