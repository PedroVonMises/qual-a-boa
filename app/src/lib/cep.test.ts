import { CEP_LOOKUP_TIMEOUT_MS, formatCep, isCepError, isValidCep, lookupCep, normalizeCep } from './cep';

const res = (status: number, body: unknown) =>
  ({ status, ok: status >= 200 && status < 300, json: async () => body }) as unknown as Response;

describe('cep helpers', () => {
  it('normalizes, validates and formats', () => {
    expect(normalizeCep('29.060-000')).toBe('29060000');
    expect(normalizeCep('290600001234')).toBe('29060000');
    expect(isValidCep('29060-000')).toBe(true);
    expect(isValidCep('2906000')).toBe(false);
    expect(isValidCep('00000000')).toBe(false);
    expect(formatCep('29060000')).toBe('29060-000');
    expect(formatCep('2906')).toBe('2906');
  });
});

describe('lookupCep', () => {
  it('maps a ViaCEP hit', async () => {
    const f = jest.fn().mockResolvedValue(res(200, { logradouro: 'Rua da Lama', bairro: 'Jardim da Penha', localidade: 'Vitória', uf: 'es' }));
    expect(await lookupCep('29060-000', f)).toEqual({ street: 'Rua da Lama', district: 'Jardim da Penha', city: 'Vitória', uf: 'ES' });
    expect(f).toHaveBeenCalledWith('https://viacep.com.br/ws/29060000/json/', expect.anything());
  });

  it('returns not_found for {erro:true}, 400 and invalid input (no request)', async () => {
    const f = jest.fn().mockResolvedValue(res(200, { erro: true }));
    const r = await lookupCep('99999999', f);
    expect(r).toEqual({ error: 'not_found', message: 'CEP não encontrado. Confira os números.' });
    expect(isCepError(r)).toBe(true);
    expect(await lookupCep('99999999', jest.fn().mockResolvedValue(res(400, null)))).toMatchObject({ error: 'not_found' });
    const g = jest.fn();
    expect(await lookupCep('123', g)).toMatchObject({ error: 'not_found' });
    expect(g).not.toHaveBeenCalled();
  });

  it('returns network on fetch failure or 5xx', async () => {
    expect(await lookupCep('29060000', jest.fn().mockRejectedValue(new TypeError('offline')))).toEqual({
      error: 'network', message: 'Sem conexão para buscar o CEP.',
    });
    expect(await lookupCep('29060000', jest.fn().mockResolvedValue(res(503, null)))).toMatchObject({ error: 'network' });
  });

  it('times out after 5s', async () => {
    jest.useFakeTimers();
    try {
      const p = lookupCep('29060000', jest.fn().mockReturnValue(new Promise(() => {})));
      await jest.advanceTimersByTimeAsync(CEP_LOOKUP_TIMEOUT_MS + 10);
      expect(await p).toMatchObject({ error: 'network' });
    } finally {
      jest.useRealTimers();
    }
  });
});
