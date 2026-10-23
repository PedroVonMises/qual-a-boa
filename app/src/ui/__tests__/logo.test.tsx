import '../testSetup';
import { act, render, screen } from '@testing-library/react-native';

import { motion } from '@/theme/tokens';
import { AnimatedLogo, Logo, Wordmark } from '..';
import { useReduceMotion } from '../useReduceMotion';

jest.mock('../useReduceMotion', () => ({ useReduceMotion: jest.fn() }));
const mockReduce = useReduceMotion as jest.Mock;

describe('Logo', () => {
  it.each(['color', 'mono', 'neon'] as const)('%s variant has the brand name', async (variant) => {
    await render(<Logo variant={variant} />);
    expect(screen.getByLabelText('Qual a boa?')).toBeTruthy();
  });

  it('off variant says it is unlit', async () => {
    await render(<Logo variant="off" />);
    expect(screen.getByLabelText('Qual a boa?, apagada')).toBeTruthy();
  });

  it('Wordmark renders the name', async () => {
    await render(<Wordmark />);
    expect(screen.getByText('Qual a boa?')).toBeTruthy();
  });
});

describe('AnimatedLogo', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('Reduce Motion: shows the final lit logo and calls onDone immediately', async () => {
    mockReduce.mockReturnValue(true);
    const onDone = jest.fn();
    await render(<AnimatedLogo onDone={onDone} />);
    expect(screen.getByLabelText('Qual a boa?')).toBeTruthy();
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('animated: calls onDone only after draw + flicker', async () => {
    mockReduce.mockReturnValue(false);
    const onDone = jest.fn();
    await render(<AnimatedLogo onDone={onDone} />);
    expect(screen.getByLabelText('Qual a boa?')).toBeTruthy();
    await act(async () => {
      jest.advanceTimersByTime(motion.splash.drawMs);
    });
    expect(onDone).not.toHaveBeenCalled();
    await act(async () => {
      jest.advanceTimersByTime(motion.splash.flickerMs + 10);
    });
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});
