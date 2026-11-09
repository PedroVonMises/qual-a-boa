import '../testSetup';
import { render, screen } from '@testing-library/react-native';
import * as Reanimated from 'react-native-reanimated';

import { TabBar } from '..';
import { HIDDEN } from '../testHelpers';
import { useReduceMotion } from '../useReduceMotion';

jest.mock('../useReduceMotion', () => ({ useReduceMotion: jest.fn(() => false) }));

const routes = [
  { key: 'a', name: 'index' },
  { key: 'b', name: 'mapa' },
];
const descriptors = { a: { options: { title: 'Início' } }, b: { options: { title: 'Mapa' } } };
const navigation = { emit: () => ({ defaultPrevented: false }), navigate: jest.fn() };

let sequence: jest.SpyInstance;
beforeEach(() => {
  (useReduceMotion as jest.Mock).mockReturnValue(false);
  sequence = jest.spyOn(Reanimated, 'withSequence');
});
afterEach(() => sequence.mockRestore());

const bar = (index: number) => <TabBar state={{ index, routes }} descriptors={descriptors} navigation={navigation} />;

describe('Início tab disco ball swing', () => {
  it('does not swing on first mount, swings once when Início becomes focused, rests at 0deg', async () => {
    const view = await render(bar(0));
    expect(sequence).not.toHaveBeenCalled();
    await view.rerender(bar(1));
    expect(sequence).not.toHaveBeenCalled();
    await view.rerender(bar(0));
    expect(sequence).toHaveBeenCalledTimes(1);
    const rotate = screen.getByTestId('tab-sway', HIDDEN).props.style.transform.find(
      (t: Record<string, string>) => 'rotate' in t,
    );
    expect(rotate.rotate).toBe('0deg');
    expect(screen.getByTestId('icon-discoBall', HIDDEN)).toBeTruthy();
  });

  it('never swings under Reduce Motion and still renders the tab', async () => {
    (useReduceMotion as jest.Mock).mockReturnValue(true);
    const view = await render(bar(1));
    await view.rerender(bar(0));
    expect(sequence).not.toHaveBeenCalled();
    expect(screen.getByRole('tab', { name: 'Início' })).toBeSelected();
    expect(screen.getByTestId('icon-discoBall', HIDDEN)).toBeTruthy();
  });
});
