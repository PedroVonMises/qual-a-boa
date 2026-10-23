import { useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';

import { urlParamsToFilters, type RawUrlParams } from '@/domain/filters';
import { useFilters } from '@/state/filters';

/** Deep link support: when /filtros opens with params (?genres=funk&priceMax=40), they replace the store. */
export function useUrlSync() {
  const params = useLocalSearchParams() as RawUrlParams;
  const replace = useFilters((s) => s.replace);
  const key = JSON.stringify(params);
  useEffect(() => {
    const parsed = JSON.parse(key) as RawUrlParams;
    if (Object.keys(parsed).length > 0) replace(urlParamsToFilters(parsed));
  }, [key, replace]);
}
