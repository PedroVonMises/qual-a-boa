import '../testSetup';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { useState } from 'react';

import { snapIndex, StepSlider } from '..';
import { lightHaptic } from '../haptics';

jest.mock('../haptics', () => ({ lightHaptic: jest.fn() }));

const STEPS = [1, 3, 5, 10, 25] as const;
type Km = (typeof STEPS)[number];

function Harness({ initial = 10 as Km, onChange = jest.fn(), draggable }: { initial?: Km; onChange?: (v: Km) => void; draggable?: boolean }) {
  const [v, setV] = useState<Km>(initial);
  return (
    <StepSlider
      steps={STEPS}
      value={v}
      onChange={(n) => {
        setV(n);
        onChange(n);
      }}
      label="Raio"
      formatValue={(n) => `Até ${n} km`}
      formatShort={(n) => `${n} km`}
      draggable={draggable}
      testID="s"
      valueTestID="s-value"
    />
  );
}

beforeEach(() => jest.clearAllMocks());

describe('snapIndex', () => {
  // 5 stops 44px wide on a 344px track: centres at 22, 22+75, ..., 322.
  it('maps a track position to the nearest stop, clamped to the ends', () => {
    expect(snapIndex(22, 344, 5)).toBe(0);
    expect(snapIndex(97, 344, 5)).toBe(1);
    expect(snapIndex(130, 344, 5)).toBe(1);
    expect(snapIndex(140, 344, 5)).toBe(2);
    expect(snapIndex(322, 344, 5)).toBe(4);
    expect(snapIndex(-50, 344, 5)).toBe(0);
    expect(snapIndex(9999, 344, 5)).toBe(4);
  });

  it('is safe before layout and with a single stop', () => {
    expect(snapIndex(100, 0, 5)).toBe(0);
    expect(snapIndex(100, 344, 1)).toBe(0);
  });
});

describe('StepSlider', () => {
  it('shows the long value, short captions and a check on the selected dot', async () => {
    await render(<Harness />);
    expect(screen.getByTestId('s-value')).toHaveTextContent('Até 10 km');
    for (const s of STEPS) expect(screen.getByText(`${s} km`)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Até 10 km' })).toBeSelected();
    expect(screen.getByRole('button', { name: 'Até 3 km' })).not.toBeSelected();
  });

  it('tapping a dot selects it', async () => {
    const onChange = jest.fn();
    await render(<Harness onChange={onChange} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Até 3 km' }));
    expect(onChange).toHaveBeenCalledWith(3);
    expect(screen.getByTestId('s-value')).toHaveTextContent('Até 3 km');
  });

  it('is adjustable: increment/decrement move one stop and clamp at the ends', async () => {
    const onChange = jest.fn();
    await render(<Harness initial={10} onChange={onChange} />);
    const slider = screen.getByTestId('s');
    expect(slider.props.accessibilityRole).toBe('adjustable');
    expect(slider.props.accessibilityValue).toEqual({ text: 'Até 10 km' });
    await fireEvent(slider, 'accessibilityAction', { nativeEvent: { actionName: 'increment' } });
    expect(onChange).toHaveBeenLastCalledWith(25);
    await fireEvent(slider, 'accessibilityAction', { nativeEvent: { actionName: 'increment' } });
    expect(onChange).toHaveBeenLastCalledWith(25);
    await fireEvent(slider, 'accessibilityAction', { nativeEvent: { actionName: 'decrement' } });
    expect(onChange).toHaveBeenLastCalledWith(10);
  });

  it('dragging snaps to the nearest stop, firing onChange and a haptic only when a stop is crossed', async () => {
    const onChange = jest.fn();
    await render(<Harness initial={1} onChange={onChange} />);
    await fireEvent(screen.getByTestId('s-track'), 'layout', { nativeEvent: { layout: { width: 344, height: 44, x: 0, y: 0 } } });
    const gesture = screen.getByTestId('gesture-detector').props.gesture;
    expect(gesture.runOnJS).toBe(true);
    await act(() => gesture.onActivate({ x: 30 }));
    expect(onChange).not.toHaveBeenCalled();
    await act(() => gesture.onUpdate({ x: 100 }));
    await act(() => gesture.onUpdate({ x: 110 }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenLastCalledWith(3);
    await act(() => gesture.onUpdate({ x: 330 }));
    expect(onChange).toHaveBeenLastCalledWith(25);
    expect(lightHaptic).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('s-value')).toHaveTextContent('Até 25 km');
  });

  it('draggable={false} renders no gesture detector but still taps', async () => {
    const onChange = jest.fn();
    await render(<Harness draggable={false} onChange={onChange} />);
    expect(screen.queryByTestId('gesture-detector')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Até 5 km' }));
    expect(onChange).toHaveBeenCalledWith(5);
  });
});
