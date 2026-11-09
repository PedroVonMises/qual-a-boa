import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { safeMerge } from './safeMerge';
import { DEFAULT_LOCATION, type GeoPoint } from '@/domain/types';
import { isInPilotArea } from '@/lib/location/pilot';
import type { DeviceFix, LocationPermission, LocationSource } from '@/lib/location/types';

/**
 * Two locations (R3):
 *  - `live`: the latest device fix (always refreshed when a fix arrives, whatever the preference);
 *  - `registered`: the user's address, or a neighbourhood picked by hand (a "light" address).
 * `preferred` says which one the user wants; the active point is resolved by `resolveLocation`.
 */
export type Origin = 'live' | 'registered';
export type ActiveOrigin = Origin | 'default';

interface CoreState {
  live: DeviceFix | null;
  registered: GeoPoint | null;
  preferred: Origin;
  permission: LocationPermission;
}

interface DerivedState {
  /** Active point used for search (DEFAULT_LOCATION when nothing usable). */
  location: GeoPoint;
  activeOrigin: ActiveOrigin;
  /** 'device' when the live fix is active (or wanted but outside the pilot), 'area' when the registered point is active. */
  source: LocationSource;
  /** True when a live or registered point is active (not the default). */
  isCustom: boolean;
  /** Epoch ms of the last device fix; 0 = never. */
  updatedAt: number;
  /** Accuracy in meters of the active device fix; 0 = unknown / not the device. */
  accuracyM: number;
  /** The live fix is wanted but outside the pilot area and nothing else is usable: UI says "Fora da área piloto". */
  outsidePilot: boolean;
  /** Raw fact: the last device fix is outside the pilot area (independent of the preference). */
  liveOutsidePilot: boolean;
}

interface LocationStore extends CoreState, DerivedState {
  setDeviceFix: (fix: DeviceFix) => void;
  setRegistered: (point: GeoPoint | null) => void;
  setPreferred: (o: Origin) => void;
  /** Neighbourhood chosen by hand: becomes the registered point and the preference. */
  setArea: (loc: GeoPoint) => void;
  setLocation: (loc: GeoPoint) => void;
  setPermission: (p: LocationPermission) => void;
  resetLocation: () => void;
}

const fixTime = (fix: DeviceFix | null) => {
  if (!fix) return 0;
  const at = Date.parse(fix.at);
  return Number.isFinite(at) ? at : 0;
};

/** Pure resolution of the active point (exported for tests and for UI previews). */
export function resolveLocation(core: CoreState): DerivedState {
  const { live, registered, preferred, permission } = core;
  const liveOk = !!live && permission === 'granted' && isInPilotArea(live.point);
  const regOk = !!registered && isInPilotArea(registered);
  const liveOutsidePilot = !!live && !isInPilotArea(live.point);

  let activeOrigin: ActiveOrigin;
  if (preferred === 'live') activeOrigin = liveOk ? 'live' : regOk ? 'registered' : 'default';
  else activeOrigin = regOk ? 'registered' : liveOk ? 'live' : 'default';

  // Wanted the device, got a fix, but it is outside the pilot and nothing else is usable (Wave 6 semantics).
  const outsidePilot = activeOrigin === 'default' && preferred === 'live' && permission === 'granted' && liveOutsidePilot;
  const source: LocationSource =
    activeOrigin === 'live' || outsidePilot ? 'device' : activeOrigin === 'registered' ? 'area' : 'default';
  const location =
    activeOrigin === 'live' ? live!.point : activeOrigin === 'registered' ? registered! : DEFAULT_LOCATION;

  return {
    location,
    activeOrigin,
    source,
    isCustom: activeOrigin !== 'default',
    updatedAt: fixTime(live),
    accuracyM: source === 'device' ? (live?.accuracyM ?? 0) : 0,
    outsidePilot,
    liveOutsidePilot,
  };
}

const INITIAL_CORE: CoreState = { live: null, registered: null, preferred: 'live', permission: 'undetermined' };

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
function asPoint(v: unknown): GeoPoint | null {
  if (!v || typeof v !== 'object') return null;
  const p = v as Record<string, unknown>;
  if (!isNum(p.lat) || !isNum(p.lng)) return null;
  return { lat: p.lat, lng: p.lng, label: typeof p.label === 'string' ? p.label : '' };
}
function asFix(v: unknown): DeviceFix | null {
  if (!v || typeof v !== 'object') return null;
  const f = v as Record<string, unknown>;
  const point = asPoint(f.point);
  if (!point || typeof f.at !== 'string') return null;
  return { point, accuracyM: isNum(f.accuracyM) ? f.accuracyM : null, at: f.at };
}
const PERMISSIONS: LocationPermission[] = ['undetermined', 'granted', 'denied', 'blocked'];

/** v1 (single point + source) → v2 (live / registered / preferred). */
export function migrateLocationV1(persisted: unknown): Partial<CoreState> {
  if (!persisted || typeof persisted !== 'object') return {};
  const p = persisted as Record<string, unknown>;
  const out: Partial<CoreState> = {};
  if (typeof p.permission === 'string' && PERMISSIONS.includes(p.permission as LocationPermission)) {
    out.permission = p.permission as LocationPermission;
  }
  const point = asPoint(p.location);
  if (p.source === 'area' && point) {
    out.registered = point;
    out.preferred = 'registered';
  } else if (p.source === 'device') {
    out.preferred = 'live';
    // v1 stored DEFAULT_LOCATION when the fix was outside the pilot: that is not a real fix.
    if (point && p.outsidePilot !== true) {
      const at = isNum(p.updatedAt) && p.updatedAt > 0 ? p.updatedAt : Date.now();
      out.live = { point, accuracyM: isNum(p.accuracyM) && p.accuracyM > 0 ? p.accuracyM : null, at: new Date(at).toISOString() };
    }
  }
  return out;
}

/** Validates persisted v2 fields and recomputes the derived ones. */
function hydrate(persisted: unknown, current: LocationStore): LocationStore {
  const merged = safeMerge(persisted, current);
  const p = (persisted && typeof persisted === 'object' ? persisted : {}) as Record<string, unknown>;
  const core: CoreState = {
    live: 'live' in p ? asFix(p.live) : current.live,
    registered: 'registered' in p ? asPoint(p.registered) : current.registered,
    preferred: p.preferred === 'registered' || p.preferred === 'live' ? p.preferred : current.preferred,
    permission: PERMISSIONS.includes(merged.permission) ? merged.permission : current.permission,
  };
  return { ...merged, ...core, ...resolveLocation(core) };
}

export const useLocation = create<LocationStore>()(
  persist(
    (set, get) => {
      const update = (patch: Partial<CoreState>) => {
        const s = get();
        const core: CoreState = {
          live: s.live,
          registered: s.registered,
          preferred: s.preferred,
          permission: s.permission,
          ...patch,
        };
        set({ ...core, ...resolveLocation(core) });
      };
      const chooseArea = (registered: GeoPoint) => update({ registered, preferred: 'registered' });
      return {
        ...INITIAL_CORE,
        ...resolveLocation(INITIAL_CORE),
        // A fix implies a grant; it never changes the preferred origin.
        setDeviceFix: (live) => update({ live, permission: 'granted' }),
        setRegistered: (registered) => update({ registered }),
        setPreferred: (preferred) => update({ preferred }),
        setArea: chooseArea,
        setLocation: chooseArea,
        setPermission: (permission) => update({ permission }),
        resetLocation: () => update({ live: null, registered: null, preferred: 'live' }),
      };
    },
    {
      name: 'qab.location',
      version: 2,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ live: s.live, registered: s.registered, preferred: s.preferred, permission: s.permission }),
      migrate: (persisted, version) => (version < 2 ? migrateLocationV1(persisted) : persisted) as LocationStore,
      merge: (persisted, current) => hydrate(persisted, current),
    },
  ),
);
