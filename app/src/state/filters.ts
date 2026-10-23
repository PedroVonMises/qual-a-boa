import { create } from 'zustand';
import { defaultFilters, type FilterState } from '@/domain/filters';

interface FiltersStore {
  filters: FilterState;
  set: (patch: Partial<FilterState>) => void;
  toggleGenre: (slug: string) => void;
  replace: (f: FilterState) => void;
  reset: () => void;
}

export const useFilters = create<FiltersStore>((set) => ({
  filters: { ...defaultFilters, genreSlugs: [] },
  set: (patch) => set((s) => ({ filters: { ...s.filters, ...patch } })),
  toggleGenre: (slug) =>
    set((s) => {
      const has = s.filters.genreSlugs.includes(slug);
      const genreSlugs = has ? s.filters.genreSlugs.filter((g) => g !== slug) : [...s.filters.genreSlugs, slug];
      return { filters: { ...s.filters, genreSlugs } };
    }),
  replace: (f) => set({ filters: { ...f, genreSlugs: [...f.genreSlugs] } }),
  reset: () => set({ filters: { ...defaultFilters, genreSlugs: [] } }),
}));
