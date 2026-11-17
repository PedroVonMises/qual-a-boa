import { cleanReturnInfo, hasReturnInfo, returnInfoRows, returnInfoToRow, returnTextError } from './returnInfo';

describe('return info (S8)', () => {
  it('keeps known answers from the wire or the app shape', () => {
    expect(cleanReturnInfo({ rideshare_point: '  Na   esquina ', lit_street: 'em_parte', parking: 'valet', bus_stop: 'x', outra: 1 })).toEqual({
      ridesharePoint: 'Na esquina',
      litStreet: 'em_parte',
    });
    expect(cleanReturnInfo({ busStop: 'Av. Rio Branco', parking: 'rua' })).toEqual({ busStop: 'Av. Rio Branco', parking: 'rua' });
    expect(cleanReturnInfo(null)).toEqual({});
    expect(cleanReturnInfo(['x'])).toEqual({});
    expect(hasReturnInfo({})).toBe(false);
  });

  it('writes the set_return_info payload', () => {
    expect(returnInfoToRow({ ridesharePoint: ' Em frente ', busStop: '', litStreet: 'nao', parking: 'proprio' })).toEqual({
      rideshare_point: 'Em frente',
      lit_street: 'nao',
      parking: 'proprio',
    });
  });

  it('validates the texts (empty is fine)', () => {
    expect(returnTextError('')).toBeNull();
    expect(returnTextError('a')).toBe('Escreva um pouco mais.');
    expect(returnTextError('a'.repeat(141))).toBe('Use até 140 caracteres.');
  });

  it('lists rows in reading order with labels', () => {
    expect(returnInfoRows({ parking: 'conveniado', ridesharePoint: 'Na esquina', litStreet: 'sim', busStop: 'Av. X' }).map((r) => `${r.label}: ${r.value}`)).toEqual([
      'Embarque de app: Na esquina',
      'Rua: Bem iluminada',
      'Ponto de ônibus: Av. X',
      'Estacionamento: Estacionamento conveniado',
    ]);
  });
});
