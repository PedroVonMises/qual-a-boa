import { useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';

import { urlParamsToFilters, type RawUrlParams } from '@/domain/filters';
import { useFilters } from '@/state/filters';

const KNOWN_FILTER_KEYS = new Set([
  'genres',
  'tags',
  'priceMax',
  'radius',
  'date',
  'de',
  'ate',
  'artist',
  'area',
  'q',
  'sort',
]);

/**
 * Deep link support: when `/` or `/filtros` opens with filter params (?genres=funk&priceMax=40),
 * they hydrate the filter store. Unrelated route params never overwrite active filter state.
 */
export function useUrlSync() {
  const params = useLocalSearchParams() as RawUrlParams;
  const replace = useFilters((s) => s.replace);
  const filterEntries = Object.entries(params ?? {}).filter(([k, v]) => KNOWN_FILTER_KEYS.has(k) && v !== undefined && v !== '');
  const key = JSON.stringify(Object.fromEntries(filterEntries));
  useEffect(() => {
    const parsed = JSON.parse(key) as RawUrlParams;
    if (Object.keys(parsed).length > 0) replace(urlParamsToFilters(parsed));
  }, [key, replace]);
}
