import { create } from 'zustand';
import type { AccessTag } from '@/domain/accessTags';
import { defaultFilters, type FilterState } from '@/domain/filters';

interface FiltersStore {
  filters: FilterState;
  set: (patch: Partial<FilterState>) => void;
  toggleGenre: (slug: string) => void;
  toggleTag: (slug: AccessTag) => void;
  replace: (f: FilterState) => void;
  reset: () => void;
}

export const useFilters = create<FiltersStore>((set) => ({
  filters: { ...defaultFilters, genreSlugs: [], tags: [] },
  set: (patch) => set((s) => ({ filters: { ...s.filters, ...patch } })),
  toggleGenre: (slug) =>
    set((s) => {
      const has = s.filters.genreSlugs.includes(slug);
      const genreSlugs = has ? s.filters.genreSlugs.filter((g) => g !== slug) : [...s.filters.genreSlugs, slug];
      return { filters: { ...s.filters, genreSlugs } };
    }),
  toggleTag: (slug) =>
    set((s) => {
      const has = s.filters.tags.includes(slug);
      const tags = has ? s.filters.tags.filter((t) => t !== slug) : [...s.filters.tags, slug];
      return { filters: { ...s.filters, tags } };
    }),
  replace: (f) => set({ filters: { ...f, genreSlugs: [...f.genreSlugs], tags: [...f.tags] } }),
  reset: () => set({ filters: { ...defaultFilters, genreSlugs: [], tags: [] } }),
}));
