import {
  addressFieldErrors,
  confirmLine,
  draftFromAddress,
  draftToAddress,
  EMPTY_DRAFT,
  formatPhone,
  geocodeQuery,
  isDraftEmpty,
  isValidPhone,
  normalizePhone,
} from '../format';

describe('phone mask', () => {
  it.each([
    ['', ''],
    ['2', '(2'],
    ['27', '(27'],
    ['279', '(27) 9'],
    ['2799999', '(27) 9999-9'],
    ['279999900', '(27) 9999-900'],
    ['2733334444', '(27) 3333-4444'],
    ['27999990000', '(27) 99999-0000'],
    ['(27) 99999-00001234', '(27) 99999-0000'],
    ['abc27x9', '(27) 9'],
  ])('formatPhone(%p) = %p', (raw, out) => {
    expect(formatPhone(raw)).toBe(out);
  });

  it('normalizes and validates (empty is ok, 10 or 11 digits)', () => {
    expect(normalizePhone('(27) 99999-0000')).toBe('27999990000');
    expect(isValidPhone('')).toBe(true);
    expect(isValidPhone('(27) 3333-4444')).toBe(true);
    expect(isValidPhone('(27) 99999-0000')).toBe(true);
    expect(isValidPhone('(27) 9999')).toBe(false);
  });
});

describe('address draft', () => {
  const draft = { cep: '29060-000', street: 'R. Joaquim Lírio', number: '823', complement: '', district: 'Praia do Canto', city: 'Vitória', uf: 'es' };

  it('per-field errors match validateAddress rules', () => {
    expect(addressFieldErrors(draft)).toEqual({});
    expect(addressFieldErrors(EMPTY_DRAFT)).toEqual({
      cep: 'Digite um CEP com 8 números.',
      street: 'Digite a rua.',
      number: 'Digite o número (ou "s/n").',
      district: 'Digite o bairro.',
      city: 'Digite a cidade.',
      uf: 'Use a sigla do estado, como ES.',
    });
    expect(isDraftEmpty(EMPTY_DRAFT)).toBe(true);
    expect(isDraftEmpty(draft)).toBe(false);
  });

  it('builds the geocode query, the confirmation line and the stored address', () => {
    expect(geocodeQuery(draft)).toBe('R. Joaquim Lírio, 823, Praia do Canto, Vitória - ES, Brasil');
    expect(confirmLine(draft)).toBe('R. Joaquim Lírio · Praia do Canto · Vitória, ES');
    const a = draftToAddress(draft, { lat: -20.3, lng: -40.29 });
    expect(a).toMatchObject({ cep: '29060000', lat: -20.3, lng: -40.29 });
    expect(a).not.toHaveProperty('complement');
    expect(draftFromAddress({ ...a, uf: 'ES', complement: 'ap 1' })).toMatchObject({ cep: '29060-000', complement: 'ap 1' });
    expect(draftFromAddress(null)).toBe(EMPTY_DRAFT);
  });
});
