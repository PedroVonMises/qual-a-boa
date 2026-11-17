import { formatPhone, leavingMessage, normalizePhone, smsTo, validateContact, whatsappTo } from './volta';

describe('Cheguei em casa helpers (S5)', () => {
  it('normalizes Brazilian phones and keeps +country codes', () => {
    expect(normalizePhone('(27) 99999-0000')).toBe('5527999990000');
    expect(normalizePhone('027 3333-0000')).toBe('552733330000');
    expect(normalizePhone('55 27 99999 0000')).toBe('5527999990000');
    expect(normalizePhone('+351 912 345 678')).toBe('351912345678');
    expect(normalizePhone('99999')).toBeNull();
    expect(normalizePhone('')).toBeNull();
  });

  it('formats for display', () => {
    expect(formatPhone('5527999990000')).toBe('+55 27 99999-0000');
    expect(formatPhone('351912345678')).toBe('+351912345678');
  });

  it('validates name, phone, duplicates and the limit of 3', () => {
    const c = (phone: string) => ({ id: phone, name: 'X', phone });
    expect(validateContact('  Ana  Paula ', '27 99999-0000', [])).toEqual({ ok: true, contact: { name: 'Ana Paula', phone: '5527999990000' } });
    expect(validateContact('', '27 99999-0000', [])).toMatchObject({ ok: false });
    expect(validateContact('Ana', '123', [])).toMatchObject({ ok: false, error: 'Confira o número, com DDD.' });
    expect(validateContact('Ana', '27 99999-0000', [c('5527999990000')])).toMatchObject({ ok: false, error: 'Esse número já está na lista.' });
    expect(validateContact('Ana', '27 99999-0004', [c('1'), c('2'), c('3')])).toMatchObject({ ok: false });
  });

  it('builds the leaving message', () => {
    expect(leavingMessage({ venueName: 'Casa Maré', eventTitle: 'Noite do Funk' })).toBe('Tô saindo do Noite do Funk, na Casa Maré. Te aviso quando chegar em casa.');
    expect(leavingMessage({ venueName: 'Casa Maré' })).toBe('Tô saindo da Casa Maré. Te aviso quando chegar em casa.');
    expect(leavingMessage(null)).toBe('Tô voltando pra casa. Te aviso quando chegar.');
  });

  it('builds WhatsApp and SMS links per platform', () => {
    expect(whatsappTo('5527999990000', 'Oi, tudo?')).toBe('https://wa.me/5527999990000?text=Oi%2C%20tudo%3F');
    expect(smsTo('5527999990000', 'Oi', 'ios')).toBe('sms:+5527999990000&body=Oi');
    expect(smsTo('5527999990000', 'Oi', 'android')).toBe('sms:+5527999990000?body=Oi');
  });
});
