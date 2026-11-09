import { formatCnpj, isValidCnpj } from '@/domain/casas';
import {
  draftPriceLabel,
  EMPTY_FESTA,
  festaTimes,
  firstFridayOf,
  maskDate,
  maskTime,
  monthName,
  parseDate,
  parseMoney,
  validateFestaStep,
  whatsappE164,
  companyErrors,
  matchVenues,
  nextChargeDate,
  proposedAddress,
} from '../format';

const NOW = Date.parse('2026-11-09T15:00:00Z');

describe('CNPJ', () => {
  it('masks progressively and validates the check digits', () => {
    expect(formatCnpj('11')).toBe('11');
    expect(formatCnpj('11444')).toBe('11.444');
    expect(formatCnpj('11444777')).toBe('11.444.777');
    expect(formatCnpj('114447770001')).toBe('11.444.777/0001');
    expect(formatCnpj('11444777000161')).toBe('11.444.777/0001-61');
    expect(formatCnpj('11.444.777/0001-61999')).toBe('11.444.777/0001-61');
    expect(isValidCnpj('11.444.777/0001-61')).toBe(true);
    expect(isValidCnpj('11.444.777/0001-62')).toBe(false);
    expect(isValidCnpj('11.111.111/1111-11')).toBe(false);
  });

  it('company form errors name the fix', () => {
    const empty = companyErrors({ cnpj: '', legalName: '', contactName: '', whatsapp: '', responsible: false });
    expect(empty).toEqual({
      cnpj: 'Digite os 14 números do CNPJ.',
      legalName: 'Digite a razão social como está no CNPJ.',
      contactName: 'Digite o nome de quem responde pela casa.',
      whatsapp: 'Digite o DDD e o número, como (27) 99999-0000.',
      responsible: 'Confirme que você é responsável pela casa.',
    });
    expect(companyErrors({ cnpj: '11.444.777/0001-62', legalName: 'Bar Ltda', contactName: 'Ana', whatsapp: '(27) 99999-0000', responsible: true })).toEqual({
      cnpj: 'CNPJ inválido. Confira os números.',
    });
    expect(whatsappE164('(27) 99999-0000')).toBe('+5527999990000');
  });
});

describe('festa form helpers', () => {
  it('masks and parses date and time', () => {
    expect(maskDate('1411')).toBe('14/11');
    expect(maskDate('14112026')).toBe('14/11/2026');
    expect(maskTime('2330')).toBe('23:30');
    expect(parseDate('31/02/2026')).toBeNull();
    expect(parseDate('14/11/2026')).toEqual([2026, 10, 14]);
    expect(firstFridayOf('2026-12')).toBe('04/12/2026');
    expect(monthName('2026-12')).toBe('Dezembro');
  });

  it('converts São Paulo wall clock to UTC and rolls the end past midnight', () => {
    expect(festaTimes({ date: '14/11/2026', start: '23:00', end: '05:00' })).toEqual({
      startsAt: '2026-11-15T02:00:00.000Z',
      endsAt: '2026-11-15T08:00:00.000Z',
    });
    expect(festaTimes({ date: '14/11/2026', start: '23:00', end: '' })?.endsAt).toBeNull();
  });

  it('validates step 1 and step 2 with fixes', () => {
    const e1 = validateFestaStep(1, { ...EMPTY_FESTA, title: 'ab', date: '01/11/2026' }, NOW);
    expect(e1.title).toBe('Dê um nome de 3 a 120 letras.');
    expect(e1.date).toBe('Escolha uma data que ainda não passou.');
    expect(e1.genres).toBe('Escolha de 1 a 3 estilos.');
    const ok1 = validateFestaStep(1, { ...EMPTY_FESTA, title: 'Festa boa', date: '20/11/2026', genres: ['funk'] }, NOW);
    expect(ok1).toEqual({});

    const e2 = validateFestaStep(2, { ...EMPTY_FESTA, priceMin: '50', priceMax: '30', ticketUrl: 'http://x.com', ageMin: '16' });
    expect(e2).toEqual({
      priceMax: 'O máximo não pode ser menor que o mínimo.',
      ticketUrl: 'O link precisa começar com https://',
      ageMin: 'A idade mínima vai de 18 a 21 anos.',
    });
    expect(validateFestaStep(2, { ...EMPTY_FESTA, free: true })).toEqual({});
    expect(parseMoney('40,50')).toBe(40.5);
    expect(parseMoney('abc')).toBeNull();
    expect(draftPriceLabel({ ...EMPTY_FESTA, priceMin: '30', priceMax: '60' })).toBe('R$ 30 a R$ 60');
  });
});

describe('vincular helpers', () => {
  it('matches venues by name or bairro without accents', () => {
    const venue = (id: string, name: string, area: string) => ({ id, name, area }) as never;
    const items = [
      { venue: venue('1', 'Casa Maré', 'Praia do Canto'), event: {} as never, distanceKm: 1 },
      { venue: venue('1', 'Casa Maré', 'Praia do Canto'), event: {} as never, distanceKm: 1 },
      { venue: venue('2', 'Bolt', 'Centro'), event: {} as never, distanceKm: 2 },
    ];
    expect(matchVenues(items, 'mare').map((v) => v.id)).toEqual(['1']);
    expect(matchVenues(items, 'centro').map((v) => v.id)).toEqual(['2']);
    expect(matchVenues(items, '')).toEqual([]);
  });

  it('builds the proposed address and the next charge date', () => {
    expect(
      proposedAddress({ cep: '29060-000', street: 'Rua A', number: '10', complement: '', district: 'Centro', city: 'Vitória', uf: 'es' }),
    ).toBe('Rua A, 10 - Vitória/ES');
    expect(nextChargeDate(NOW)).toBe('2026-12-09T15:00:00.000Z');
  });
});
