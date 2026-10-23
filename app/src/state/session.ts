import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';

export type SessionState = {
  /** User confirmed they are 18+. */
  ageConfirmed: boolean;
  /** User finished the location/styles onboarding step. */
  onboardingDone: boolean;
  /** True once persisted state has been read. Guards must wait for it. */
  hydrated: boolean;
  confirmAge: () => void;
  finishOnboarding: () => void;
  reset: () => void;
};

/** No-op storage for static web rendering (Node has no window, AsyncStorage would throw). */
const ssrStorage: StateStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

const defaultStorage: StateStorage = typeof window === 'undefined' ? ssrStorage : AsyncStorage;

/** Factory so tests can inject an in-memory storage. */
export function createSessionStore(storage: StateStorage = defaultStorage) {
  const store = create<SessionState>()(
    persist(
      (set) => ({
        ageConfirmed: false,
        onboardingDone: false,
        hydrated: false,
        confirmAge: () => set({ ageConfirmed: true }),
        finishOnboarding: () => set({ ageConfirmed: true, onboardingDone: true }),
        reset: () => set({ ageConfirmed: false, onboardingDone: false }),
      }),
      {
        name: 'qab.session.v1',
        storage: createJSONStorage(() => storage),
        partialize: (s) => ({ ageConfirmed: s.ageConfirmed, onboardingDone: s.onboardingDone }),
        // merge flags hydrated on success; on a read error flag it too so the app never hangs.
        onRehydrateStorage: () => (_state, error) => {
          if (error) store.setState({ hydrated: true });
        },
        merge: (persisted, current) => ({ ...current, ...(persisted as Partial<SessionState>), hydrated: true }),
      },
    ),
  );
  return store;
}

export const useSession = createSessionStore();
