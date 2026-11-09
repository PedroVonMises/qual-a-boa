/** Brazilian postal code (CEP) helpers and ViaCEP lookup. */

export const CEP_LOOKUP_TIMEOUT_MS = 5000;

export const CEP_MESSAGES = {
  not_found: 'CEP não encontrado. Confira os números.',
  network: 'Sem conexão para buscar o CEP.',
} as const;

export type CepError = keyof typeof CEP_MESSAGES;

export interface CepAddress {
  street: string;
  district: string;
  city: string;
  uf: string;
}

export type CepLookupResult = CepAddress | { error: CepError; message: string };

/** Digits only, at most 8 ("29.060-000" → "29060000"). */
export const normalizeCep = (raw: string) => raw.replace(/\D/g, '').slice(0, 8);

export const isValidCep = (raw: string) => /^\d{8}$/.test(raw.replace(/\D/g, '')) && !/^0{8}$/.test(raw.replace(/\D/g, ''));

/** "29060000" → "29060-000" (partial input is returned as typed digits). */
export function formatCep(raw: string): string {
  const d = normalizeCep(raw);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

const fail = (error: CepError) => ({ error, message: CEP_MESSAGES[error] });

/** ViaCEP lookup (5s timeout). Never throws: errors come back as `{ error, message }` with pt-BR copy for the UI. */
export async function lookupCep(raw: string, fetchImpl: typeof fetch = fetch): Promise<CepLookupResult> {
  if (!isValidCep(raw)) return fail('not_found');
  const cep = normalizeCep(raw);
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        ctrl?.abort();
        reject(new Error('timeout'));
      }, CEP_LOOKUP_TIMEOUT_MS);
    });
    const res = await Promise.race([fetchImpl(`https://viacep.com.br/ws/${cep}/json/`, { signal: ctrl?.signal }), timeout]);
    if (res.status === 400 || res.status === 404) return fail('not_found');
    if (!res.ok) return fail('network');
    const body = (await Promise.race([res.json(), timeout])) as Record<string, unknown> | null;
    if (!body || typeof body !== 'object' || body.erro) return fail('not_found');
    const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
    const out = { street: str(body.logradouro), district: str(body.bairro), city: str(body.localidade), uf: str(body.uf).toUpperCase() };
    if (!out.city || !/^[A-Z]{2}$/.test(out.uf)) return fail('not_found');
    return out;
  } catch {
    return fail('network');
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export const isCepError = (r: CepLookupResult): r is { error: CepError; message: string } => 'error' in r;
