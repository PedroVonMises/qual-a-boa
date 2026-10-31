import { MINI_NOW } from '@/data/__fixtures__/mini';
import { dateHeadline } from './calendar';

const NOW = Date.parse(MINI_NOW); // Friday 2026-10-23 12:00 São Paulo
const day = (d: string) => ({ from: d, to: d });
const span = (from: string, to: string) => ({ from, to });

describe('dateHeadline (the word after "Qual a boa")', () => {
  it('presets', () => {
    expect(dateHeadline('qualquer', null, NOW)).toBe('hoje');
    expect(dateHeadline('hoje', null, NOW)).toBe('hoje');
    expect(dateHeadline('amanha', null, NOW)).toBe('amanhã');
    expect(dateHeadline('fim-de-semana', null, NOW)).toBe('no fim de semana');
    expect(dateHeadline('proxima-semana', null, NOW)).toBe('na semana que vem');
  });

  it('a single day: hoje, amanhã, depois de amanhã', () => {
    expect(dateHeadline('datas', day('2026-10-23'), NOW)).toBe('hoje');
    expect(dateHeadline('datas', day('2026-10-24'), NOW)).toBe('amanhã');
    expect(dateHeadline('datas', day('2026-10-25'), NOW)).toBe('depois de amanhã');
  });

  it('3 to 6 days ahead: the weekday, with na/no', () => {
    expect(dateHeadline('datas', day('2026-10-26'), NOW)).toBe('na segunda');
    expect(dateHeadline('datas', day('2026-10-27'), NOW)).toBe('na terça');
    expect(dateHeadline('datas', day('2026-10-28'), NOW)).toBe('na quarta');
    expect(dateHeadline('datas', day('2026-10-29'), NOW)).toBe('na quinta');
  });

  it('uses "no" for sábado and domingo when they are 3+ days away', () => {
    // From a Monday (2026-10-26 12:00 SP): Saturday is +5, Sunday is +6, Friday is +4.
    const monday = Date.parse('2026-10-26T15:00:00Z');
    expect(dateHeadline('datas', day('2026-10-30'), monday)).toBe('na sexta');
    expect(dateHeadline('datas', day('2026-10-31'), monday)).toBe('no sábado');
    expect(dateHeadline('datas', day('2026-11-01'), monday)).toBe('no domingo');
  });

  it('a week or more away spells out the date (a bare weekday would be ambiguous)', () => {
    expect(dateHeadline('datas', day('2026-10-30'), NOW)).toBe('dia 30 de outubro'); // +7: "sexta" would mean today
    expect(dateHeadline('datas', day('2026-11-14'), NOW)).toBe('dia 14 de novembro');
  });

  it('a past day never reads as a weekday', () => {
    expect(dateHeadline('datas', day('2026-10-20'), NOW)).toBe('dia 20 de outubro');
  });

  it('follows the night, not the calendar: at 01:00 on Saturday it is still Friday night', () => {
    const satOneAm = Date.parse('2026-10-24T04:00:00Z'); // 01:00 SP on Saturday the 24th
    expect(dateHeadline('datas', day('2026-10-23'), satOneAm)).toBe('hoje');
    expect(dateHeadline('datas', day('2026-10-24'), satOneAm)).toBe('amanhã');
    expect(dateHeadline('datas', day('2026-10-25'), satOneAm)).toBe('depois de amanhã');
    const satNoon = Date.parse('2026-10-24T15:00:00Z');
    expect(dateHeadline('datas', day('2026-10-24'), satNoon)).toBe('hoje');
  });

  it('ranges within a week name both weekdays', () => {
    expect(dateHeadline('datas', span('2026-10-23', '2026-10-25'), NOW)).toBe('de sexta a domingo');
    expect(dateHeadline('datas', span('2026-10-26', '2026-10-29'), NOW)).toBe('de segunda a quinta');
  });

  it('longer or later ranges give the dates, with the month on both ends only when they differ', () => {
    expect(dateHeadline('datas', span('2026-11-10', '2026-11-14'), NOW)).toBe('de 10 a 14 de novembro');
    expect(dateHeadline('datas', span('2026-10-30', '2026-11-05'), NOW)).toBe('de 30 de outubro a 5 de novembro');
    expect(dateHeadline('datas', span('2026-10-23', '2026-11-05'), NOW)).toBe('de 23 de outubro a 5 de novembro');
  });

  it('falls back to "hoje" when the dates are missing or invalid', () => {
    expect(dateHeadline('datas', null, NOW)).toBe('hoje');
    expect(dateHeadline('datas', { from: 'x', to: 'y' }, NOW)).toBe('hoje');
  });

  it('ignores the stored days unless the range is "datas"', () => {
    expect(dateHeadline('amanha', day('2026-10-27'), NOW)).toBe('amanhã');
  });
});
