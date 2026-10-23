import { createSessionStore } from './session';

jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

function memoryStorage(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return {
    data,
    getItem: async (k: string) => data[k] ?? null,
    setItem: async (k: string, v: string) => {
      data[k] = v;
    },
    removeItem: async (k: string) => {
      delete data[k];
    },
  };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('session store', () => {
  it('starts unhydrated and unconfirmed, then hydrates', async () => {
    const store = createSessionStore(memoryStorage());
    await flush();
    const s = store.getState();
    expect(s.hydrated).toBe(true);
    expect(s.ageConfirmed).toBe(false);
    expect(s.onboardingDone).toBe(false);
  });

  it('persists flags and restores them', async () => {
    const storage = memoryStorage();
    const a = createSessionStore(storage);
    await flush();
    a.getState().confirmAge();
    a.getState().finishOnboarding();
    await flush();
    expect(storage.data['qab.session.v1']).toContain('"onboardingDone":true');
    expect(storage.data['qab.session.v1']).not.toContain('hydrated');

    const b = createSessionStore(storage);
    await flush();
    expect(b.getState().ageConfirmed).toBe(true);
    expect(b.getState().onboardingDone).toBe(true);
  });

  it('hydrates even when storage fails', async () => {
    const storage = { ...memoryStorage(), getItem: async () => Promise.reject(new Error('boom')) };
    const store = createSessionStore(storage);
    await flush();
    expect(store.getState().hydrated).toBe(true);
  });
});
