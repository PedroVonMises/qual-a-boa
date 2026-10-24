import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'qab.lastCrash';

export interface CrashRecord {
  message: string;
  stack?: string;
  fatal: boolean;
  at: string;
}

export function toCrashRecord(error: unknown, fatal: boolean, now = new Date()): CrashRecord {
  const e = error as { message?: unknown; stack?: unknown } | null;
  return {
    message: String(e?.message ?? error ?? 'Erro desconhecido').slice(0, 600),
    stack: typeof e?.stack === 'string' ? e.stack.slice(0, 2500) : undefined,
    fatal,
    at: now.toISOString(),
  };
}

export async function saveCrash(record: CrashRecord): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(record));
  } catch {
    // nothing else to do
  }
}

/** Returns the crash saved by the previous session, if any. */
export async function readCrash(): Promise<CrashRecord | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    const r = JSON.parse(raw) as CrashRecord;
    return typeof r?.message === 'string' ? r : null;
  } catch {
    return null;
  }
}

export async function clearCrash(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

type GlobalHandler = (error: unknown, isFatal?: boolean) => void;
type ErrorUtilsLike = { getGlobalHandler: () => GlobalHandler; setGlobalHandler: (h: GlobalHandler) => void };

/**
 * Saves uncaught JS errors so the next launch can show them (release builds close silently otherwise).
 * The original handler runs after the write finishes (or 1.5 s), so the app still crashes as before.
 */
export function installCrashReporter(utils: ErrorUtilsLike | undefined = (globalThis as { ErrorUtils?: ErrorUtilsLike }).ErrorUtils): void {
  if (!utils) return;
  const previous = utils.getGlobalHandler();
  utils.setGlobalHandler((error, isFatal) => {
    const done = () => previous(error, isFatal);
    if (!isFatal) {
      void saveCrash(toCrashRecord(error, false));
      done();
      return;
    }
    const timer = setTimeout(done, 1500);
    void saveCrash(toCrashRecord(error, true)).finally(() => {
      clearTimeout(timer);
      done();
    });
  });
}
