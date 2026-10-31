import '@/ui/testSetup';
import { act, screen } from '@testing-library/react-native';

import type { FilterState } from '@/domain/filters';
import { useFilters } from '@/state/filters';
import { setupFeatureTest } from '../testUtils';
import { Headline } from '../Header';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

let renderWithData: ReturnType<typeof setupFeatureTest>; // clock frozen at Friday 2026-10-23 12:00 SP

const header = () => screen.getByRole('header');
const set = (patch: Partial<FilterState>) => useFilters.getState().set(patch);
const oneDay = (d: string) => ({ dateRange: 'datas' as const, days: { from: d, to: d } });

beforeEach(() => {
  renderWithData = setupFeatureTest();
});

describe('Explorar headline', () => {
  it('starts as "Qual a boa hoje?"', async () => {
    await renderWithData(<Headline />);
    expect(header()).toHaveTextContent('Qual a boa hoje?');
  });

  it.each<[string, Partial<FilterState>, string]>([
    ['hoje', { dateRange: 'hoje' }, 'Qual a boa hoje?'],
    ['amanhã', { dateRange: 'amanha' }, 'Qual a boa amanhã?'],
    ['fim de semana', { dateRange: 'fim-de-semana' }, 'Qual a boa no fim de semana?'],
    ['próxima semana', { dateRange: 'proxima-semana' }, 'Qual a boa na semana que vem?'],
    ['qualquer dia', { dateRange: 'qualquer' }, 'Qual a boa hoje?'],
    ['dia de depois de amanhã', oneDay('2026-10-25'), 'Qual a boa depois de amanhã?'],
    ['uma terça', oneDay('2026-10-27'), 'Qual a boa na terça?'],
    ['um dia distante', oneDay('2026-11-14'), 'Qual a boa dia 14 de novembro?'],
    ['de sexta a domingo', { dateRange: 'datas', days: { from: '2026-10-23', to: '2026-10-25' } }, 'Qual a boa de sexta a domingo?'],
  ])('reads naturally for %s', async (_name, patch, text) => {
    set(patch);
    await renderWithData(<Headline />);
    expect(header()).toHaveTextContent(text);
  });

  it('changes while mounted when the date changes, and goes back on reset', async () => {
    await renderWithData(<Headline />);
    expect(header()).toHaveTextContent('Qual a boa hoje?');
    await act(async () => set({ dateRange: 'amanha' }));
    expect(header()).toHaveTextContent('Qual a boa amanhã?');
    await act(async () => set(oneDay('2026-10-30')));
    expect(header()).toHaveTextContent('Qual a boa dia 30 de outubro?');
    await act(async () => useFilters.getState().reset());
    expect(header()).toHaveTextContent('Qual a boa hoje?');
  });

  it('is one header and not a live region (the result count already announces a date change)', async () => {
    await renderWithData(<Headline />);
    expect(screen.getAllByRole('header')).toHaveLength(1);
    expect(header().props.accessibilityLiveRegion).toBeUndefined();
  });
});
