import { ACCESS_TAGS, cleanTags, effectiveTags, isAccessTag, matchesTags, tagLabel } from './accessTags';

describe('accessTags', () => {
  it('has the four tags with pt-BR labels', () => {
    expect(ACCESS_TAGS.map((t) => t.slug)).toEqual(['acessivel', 'lgbtqia', 'pet-friendly', 'vegano']);
    expect(tagLabel('acessivel')).toBe('Acessível');
    expect(tagLabel('lgbtqia')).toBe('LGBTQIA+ friendly');
    expect(tagLabel('pet-friendly')).toBe('Pet friendly');
    expect(tagLabel('vegano')).toBe('Opção vegana');
  });

  it('isAccessTag and cleanTags drop unknown or duplicate values', () => {
    expect(isAccessTag('vegano')).toBe(true);
    expect(isAccessTag('nope')).toBe(false);
    expect(cleanTags(['vegano', 'nope', 'vegano', 'acessivel'])).toEqual(['acessivel', 'vegano']);
    expect(cleanTags(undefined)).toEqual([]);
    expect(cleanTags('vegano')).toEqual([]);
  });

  it('effectiveTags is the ordered union of venue and event tags', () => {
    expect(effectiveTags({ accessTags: ['pet-friendly'] }, { accessTags: ['acessivel'] })).toEqual(['acessivel', 'pet-friendly']);
    expect(effectiveTags({}, {})).toEqual([]);
    expect(effectiveTags({ accessTags: ['vegano'] }, { accessTags: ['vegano'] })).toEqual(['vegano']);
  });

  it('matchesTags requires every wanted tag (AND)', () => {
    expect(matchesTags(['acessivel', 'vegano'], ['acessivel'])).toBe(true);
    expect(matchesTags(['acessivel', 'vegano'], ['acessivel', 'vegano'])).toBe(true);
    expect(matchesTags(['acessivel'], ['acessivel', 'vegano'])).toBe(false);
    expect(matchesTags([], [])).toBe(true);
    expect(matchesTags([], undefined)).toBe(true);
  });
});
