import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { useLocation } from './location';
import { safeMerge } from './safeMerge';

/** Registered address ("Dados cadastrais"). `cep` is 8 digits; lat/lng come from on-device geocoding. */
export interface ProfileAddress {
  cep: string;
  street: string;
  number: string;
  complement?: string;
  district: string;
  city: string;
  uf: string;
  lat: number;
  lng: number;
}

interface ProfileStore {
  phone?: string;
  address?: ProfileAddress;
  setPhone: (phone: string | undefined) => void;
  /** Saves the address and makes it the registered location (the preferred origin is not changed). */
  setAddress: (address: ProfileAddress) => void;
  clearAddress: () => void;
  /** Clears phone + address and the registered location. */
  clear: () => void;
}

export const addressLabel = (a: Pick<ProfileAddress, 'street' | 'number'>) => `${a.street}, ${a.number}`;

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

function asAddress(v: unknown): ProfileAddress | undefined {
  if (!v || typeof v !== 'object') return undefined;
  const a = v as Record<string, unknown>;
  const s = (k: string) => (typeof a[k] === 'string' ? (a[k] as string) : null);
  const [cep, street, number, district, city, uf] = ['cep', 'street', 'number', 'district', 'city', 'uf'].map(s);
  if (!cep || !street || !number || !district || !city || !uf || !isNum(a.lat) || !isNum(a.lng)) return undefined;
  const complement = s('complement') || undefined;
  return { cep, street, number, district, city, uf, lat: a.lat, lng: a.lng, ...(complement ? { complement } : {}) };
}

export const useProfile = create<ProfileStore>()(
  persist(
    (set) => ({
      phone: undefined,
      address: undefined,
      setPhone: (phone) => set({ phone: phone?.trim() || undefined }),
      setAddress: (address) => {
        set({ address });
        if (isNum(address.lat) && isNum(address.lng)) {
          useLocation.getState().setRegistered({ lat: address.lat, lng: address.lng, label: addressLabel(address) });
        }
      },
      clearAddress: () => {
        set({ address: undefined });
        useLocation.getState().setRegistered(null);
      },
      clear: () => {
        set({ phone: undefined, address: undefined });
        useLocation.getState().setRegistered(null);
      },
    }),
    {
      name: 'qab.profile.v1',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ phone: s.phone, address: s.address }),
      merge: (persisted, current) => {
        const p = (persisted && typeof persisted === 'object' ? persisted : {}) as Record<string, unknown>;
        const merged = safeMerge(persisted, current);
        return { ...merged, phone: typeof p.phone === 'string' ? p.phone : undefined, address: asAddress(p.address) };
      },
    },
  ),
);
