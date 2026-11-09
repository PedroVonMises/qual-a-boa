import '../testSetup';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { createRef, useState } from 'react';
import { Text } from 'react-native';

import { MapSheet, snapHeights, type MapSheetIndex, type MapSheetRef } from '..';
import { clampIndex, tapTarget } from '../mapSheetShared';
import { MapSheet as WebMapSheet, settleIndex } from '../MapSheet.web';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const GorhomSheet = require('@gorhom/bottom-sheet').default as { prototype: { snapToIndex: (i: number) => void } };

function Harness({ initial = 1 as MapSheetIndex, web = false, onChange = jest.fn() }) {
  const [i, setI] = useState<MapSheetIndex>(initial);
  const Sheet = web ? WebMapSheet : MapSheet;
  return (
    <Sheet
      index={i}
      onIndexChange={(n) => {
        setI(n);
        onChange(n);
      }}
      testID="sheet">
      <Text>conteúdo</Text>
    </Sheet>
  );
}

const handle = () => screen.getByRole('adjustable', { name: 'Tamanho da lista' });

describe('MapSheet helpers', () => {
  it('clamps, toggles and computes snap heights', () => {
    expect(clampIndex(-1)).toBe(0);
    expect(clampIndex(5)).toBe(2);
    expect([0, 1, 2].map((i) => tapTarget(i as MapSheetIndex))).toEqual([1, 2, 1]);
    expect(snapHeights(800, 0.5, 40)).toEqual([88, 400, 760]);
    expect(snapHeights(400, 0.6, 20)).toEqual([88, 240, 380]);
    expect(snapHeights(50, 0.5, 0)).toEqual([88, 88, 88]);
  });

  it('settles a drag on the nearest snap, or one step in the flick direction', () => {
    const hs = [88, 400, 760];
    expect(settleIndex(hs, 300, 0)).toBe(1);
    expect(settleIndex(hs, 700, 0)).toBe(2);
    expect(settleIndex(hs, 420, -900)).toBe(2);
    expect(settleIndex(hs, 380, 900)).toBe(0);
  });
});

describe('MapSheet (native)', () => {
  it('renders an adjustable handle with the state as its value', async () => {
    await render(<Harness />);
    expect(screen.getByTestId('sheet')).toBeTruthy();
    expect(screen.getByText('conteúdo')).toBeTruthy();
    expect(handle().props.accessibilityValue).toEqual({ text: 'Dividido' });
  });

  it('increment/decrement and tap change the state; the sheet snaps to it', async () => {
    const snap = jest.spyOn(GorhomSheet.prototype, 'snapToIndex');
    const onChange = jest.fn();
    await render(<Harness onChange={onChange} />);
    await fireEvent(handle(), 'accessibilityAction', { nativeEvent: { actionName: 'increment' } });
    expect(handle().props.accessibilityValue).toEqual({ text: 'Lista cheia' });
    expect(snap).toHaveBeenLastCalledWith(2);
    await fireEvent(handle(), 'accessibilityAction', { nativeEvent: { actionName: 'decrement' } });
    await fireEvent(handle(), 'accessibilityAction', { nativeEvent: { actionName: 'decrement' } });
    expect(handle().props.accessibilityValue).toEqual({ text: 'Mapa cheio' });
    await fireEvent.press(handle());
    expect(onChange).toHaveBeenLastCalledWith(1);
    snap.mockRestore();
  });

  it('exposes snapToIndex through its ref', async () => {
    const snap = jest.spyOn(GorhomSheet.prototype, 'snapToIndex');
    const ref = createRef<MapSheetRef>();
    await render(
      <MapSheet ref={ref} index={1} onIndexChange={() => {}}>
        <Text>x</Text>
      </MapSheet>,
    );
    await act(async () => ref.current?.snapToIndex(0));
    expect(snap).toHaveBeenCalledWith(0);
    snap.mockRestore();
  });
});

describe('MapSheet (web)', () => {
  it('drags between snaps with the pan gesture on the handle', async () => {
    const onChange = jest.fn();
    await render(<Harness web onChange={onChange} />);
    expect(handle().props.accessibilityValue).toEqual({ text: 'Dividido' });
    const pan = screen.getByTestId('gesture-detector').props.gesture as {
      onActivate: () => void;
      onUpdate: (e: { translationY: number }) => void;
      onDeactivate: (e: { velocityY: number }) => void;
    };
    await act(async () => {
      pan.onActivate();
      pan.onUpdate({ translationY: -2000 });
      pan.onDeactivate({ velocityY: 0 });
    });
    expect(onChange).toHaveBeenLastCalledWith(2);
    expect(handle().props.accessibilityValue).toEqual({ text: 'Lista cheia' });
  });
});
