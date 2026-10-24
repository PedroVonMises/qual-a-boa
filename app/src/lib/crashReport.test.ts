import AsyncStorage from '@react-native-async-storage/async-storage';

import { clearCrash, installCrashReporter, readCrash, toCrashRecord } from './crashReport';

jest.mock('@react-native-async-storage/async-storage', () => {
  const m = new Map<string, string>();
  return {
    __esModule: true,
    default: {
      setItem: async (k: string, v: string) => void m.set(k, v),
      getItem: async (k: string) => m.get(k) ?? null,
      removeItem: async (k: string) => void m.delete(k),
    },
  };
});

describe('crash reporter', () => {
  it('records message and stack, truncated', () => {
    const r = toCrashRecord(Object.assign(new Error('x'.repeat(900)), { stack: 's'.repeat(5000) }), true, new Date(0));
    expect(r.message).toHaveLength(600);
    expect(r.stack).toHaveLength(2500);
    expect(r.at).toBe('1970-01-01T00:00:00.000Z');
  });

  it('saves a fatal error, then calls the previous handler', async () => {
    const previous = jest.fn();
    let handler: (e: unknown, f?: boolean) => void = () => {};
    installCrashReporter({ getGlobalHandler: () => previous, setGlobalHandler: (h) => (handler = h) });
    handler(new Error('boom'), true);
    await new Promise((r) => setTimeout(r, 20));
    expect(previous).toHaveBeenCalledTimes(1);
    expect((await readCrash())?.message).toBe('boom');
    await clearCrash();
    expect(await readCrash()).toBeNull();
    expect(AsyncStorage).toBeDefined();
  });
});
