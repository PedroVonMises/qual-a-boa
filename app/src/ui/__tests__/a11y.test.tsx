import '../testSetup';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Platform } from 'react-native';

import { EventCard, Rating } from '..';
import { nextRadioIndex, radioGroup } from '../radioGroup';

describe('nextRadioIndex', () => {
  it('moves, wraps and jumps', () => {
    expect(nextRadioIndex('ArrowRight', 4, 5)).toBe(0);
    expect(nextRadioIndex('ArrowDown', 1, 5)).toBe(2);
    expect(nextRadioIndex('ArrowLeft', 0, 5)).toBe(4);
    expect(nextRadioIndex('ArrowUp', 3, 5)).toBe(2);
    expect(nextRadioIndex('Home', 3, 5)).toBe(0);
    expect(nextRadioIndex('End', 1, 5)).toBe(4);
    expect(nextRadioIndex('a', 1, 5)).toBeNull();
  });
});

describe('radioGroup binding', () => {
  it('web: roving tabIndex, aria-checked and arrow key handler', () => {
    const spy = jest.replaceProperty(Platform, 'OS', 'web');
    const onSelect = jest.fn();
    const rg = radioGroup(2, 5, onSelect);
    const items = [0, 1, 2, 3, 4].map((i) => rg.item(i) as { tabIndex: number; 'aria-checked': boolean });
    expect(items.map((i) => i['aria-checked'])).toEqual([false, false, true, false, false]);
    expect(items.map((i) => i.tabIndex)).toEqual([-1, -1, 0, -1, -1]);
    const focus = jest.fn();
    const els = [0, 1, 2, 3, 4].map(() => ({ focus }));
    (rg.group as { onKeyDown: (e: unknown) => void }).onKeyDown({ key: 'ArrowRight', preventDefault: jest.fn(), currentTarget: { querySelectorAll: () => els } });
    expect(onSelect).toHaveBeenCalledWith(3);
    expect(focus).toHaveBeenCalled();
    spy.restore();
  });

  it('web: first radio is the tab stop when nothing is checked', () => {
    const spy = jest.replaceProperty(Platform, 'OS', 'web');
    const rg = radioGroup(-1, 3, jest.fn());
    expect((rg.item(0) as { tabIndex: number }).tabIndex).toBe(0);
    expect((rg.item(1) as { tabIndex: number }).tabIndex).toBe(-1);
    spy.restore();
  });

  it('native: no group handlers or tabIndex, only aria-checked', () => {
    const rg = radioGroup(1, 3, jest.fn());
    expect(rg.group).toEqual({});
    expect(rg.item(1)).toEqual({ 'aria-checked': true });
  });
});

describe('Rating radios', () => {
  it('reports checked state and selects on press', async () => {
    const onChange = jest.fn();
    await render(<Rating value={3} onChange={onChange} />);
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(5);
    expect(radios[2]).toBeChecked();
    expect(radios[0]).not.toBeChecked();
    await fireEvent.press(radios[3]);
    expect(onChange).toHaveBeenCalledWith(4);
  });
});

describe('EventCard', () => {
  it('shows the plain price with no mock tag', async () => {
    await render(<EventCard variant="row" title="Noite" venueName="Bolt" priceLabel="R$ 40" coverKey="bolt" />);
    expect(screen.getByText('R$ 40')).toBeTruthy();
    expect(screen.queryByText(/ilustrativ/i)).toBeNull();
  });
});
