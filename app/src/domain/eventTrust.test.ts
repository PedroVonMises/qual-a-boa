import { cleanEventTrust, dressCodeError, provenanceLabel, sourceHost } from './eventTrust';

describe('event trust (item 14)', () => {
  it('keeps only well-formed values', () => {
    expect(cleanEventTrust({ sourceUrl: 'https://www.sympla.com.br/evento/x/1', verifiedAt: '2026-11-09T15:00:00Z', dressCode: '  Esporte   fino ' })).toEqual({
      sourceUrl: 'https://www.sympla.com.br/evento/x/1',
      verifiedAt: '2026-11-09T15:00:00.000Z',
      dressCode: 'Esporte fino',
    });
    expect(cleanEventTrust({ sourceUrl: 'http://x.com', verifiedAt: 'ontem', dressCode: 'x' })).toEqual({});
    expect(cleanEventTrust({})).toEqual({});
  });

  it('names the source host and when it was checked (São Paulo date)', () => {
    expect(sourceHost('https://www.sympla.com.br/evento/x/1')).toBe('sympla.com.br');
    expect(provenanceLabel({ sourceUrl: 'https://www.sympla.com.br/e/1', verifiedAt: '2026-11-10T01:00:00Z' })).toBe(
      'Informações de sympla.com.br, conferidas em 09/11',
    );
    expect(provenanceLabel({ sourceUrl: 'https://x.com/e' })).toBe('Informações de x.com');
    expect(provenanceLabel({ verifiedAt: '2026-11-12T15:00:00Z' })).toBe('Conferido pela equipe em 12/11');
    expect(provenanceLabel({})).toBeNull();
  });

  it('validates the dress code field', () => {
    expect(dressCodeError('')).toBeNull();
    expect(dressCodeError('x')).toBe('Escreva um pouco mais.');
    expect(dressCodeError('x'.repeat(81))).toBe('Use até 80 caracteres.');
  });
});
