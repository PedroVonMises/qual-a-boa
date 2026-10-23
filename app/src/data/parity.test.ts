import type { SearchParams, SeedDataset } from '@/domain/types';
import { SeedRepo } from './seedRepo';

// Shared fixtures produced by the SQL oracle (supabase/tests/fixtures).
 
const dataset = require('../../../supabase/tests/fixtures/seed-fixed.json') as SeedDataset;
const cases = require('../../../supabase/tests/fixtures/search-cases.json') as {
  name: string;
  params: SearchParams;
  expectedEventIds: string[];
  expectedTotal: number;
}[];
 

const repo = new SeedRepo(dataset, () => Date.parse(dataset.generatedAt));

describe('SeedRepo parity with search_events fixtures', () => {
  it('has cases', () => expect(cases.length).toBeGreaterThan(0));
  for (const c of cases) {
    it(c.name, async () => {
      const page = await repo.searchEvents(c.params);
      expect(page.items.map((i) => i.event.id)).toEqual(c.expectedEventIds);
      if (c.expectedEventIds.length) expect(page.total).toBe(c.expectedTotal);
    });
  }
});
