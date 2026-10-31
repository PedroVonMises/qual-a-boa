import '../testSetup';
import { render, screen } from '@testing-library/react-native';
import { StyleSheet, Text } from 'react-native';

import { motion } from '@/theme/tokens';
import { Reveal, REVEAL_MAX_STAGGER, revealDelay, Swap, useRevealScope } from '..';
import { useReduceMotion } from '../useReduceMotion';

jest.mock('../useReduceMotion', () => ({ useReduceMotion: jest.fn(() => false) }));

const style = (id: string) => StyleSheet.flatten(screen.getByTestId(id).props.style) as { opacity?: number; transform?: unknown[] };

beforeEach(() => (useReduceMotion as jest.Mock).mockReturnValue(false));

describe('revealDelay', () => {
  it('steps by the design stagger and stops growing after the 8th item', () => {
    expect(revealDelay(0)).toBe(0);
    expect(revealDelay(1)).toBe(motion.stagger);
    expect(revealDelay(REVEAL_MAX_STAGGER)).toBe(REVEAL_MAX_STAGGER * motion.stagger);
    expect(revealDelay(8)).toBe(revealDelay(REVEAL_MAX_STAGGER));
    expect(revealDelay(500)).toBe(revealDelay(REVEAL_MAX_STAGGER));
  });

  it('is safe for odd input', () => {
    expect(revealDelay()).toBe(0);
    expect(revealDelay(-3)).toBe(0);
    expect(revealDelay(2.9)).toBe(2 * motion.stagger);
  });
});

describe('Reveal', () => {
  it('renders its children and ends fully visible', async () => {
    await render(
      <Reveal testID="r" index={3}>
        <Text>conteúdo</Text>
      </Reveal>,
    );
    expect(screen.getByText('conteúdo')).toBeTruthy();
    expect(style('r').opacity).toBe(1);
  });

  it('moves only along translateY (never layout), and not at all under Reduce Motion', async () => {
    const { rerender } = await render(
      <Reveal testID="r">
        <Text>x</Text>
      </Reveal>,
    );
    expect(style('r').transform).toEqual([{ translateY: 0 }]);
    (useReduceMotion as jest.Mock).mockReturnValue(true);
    await rerender(
      <Reveal testID="r">
        <Text>x</Text>
      </Reveal>,
    );
    expect(style('r').transform).toEqual([]);
  });

  it('can be disabled', async () => {
    await render(
      <Reveal testID="r" disabled>
        <Text>x</Text>
      </Reveal>,
    );
    expect(style('r').opacity).toBe(1);
  });
});

describe('useRevealScope', () => {
  it('lets an id play once per scope: a second mount of the same id is skipped', async () => {
    let scope!: ReturnType<typeof useRevealScope>;
    function Host({ show }: { show: boolean }) {
      scope = useRevealScope();
      return show ? (
        <Reveal scope={scope} id="a">
          <Text>a</Text>
        </Reveal>
      ) : null;
    }
    const { rerender } = await render(<Host show />);
    expect(scope.has('a')).toBe(true);
    expect(scope.has('b')).toBe(false);
    await rerender(<Host show={false} />);
    await rerender(<Host show />);
    expect(scope.has('a')).toBe(true);
  });

  it('keeps one scope across renders', async () => {
    const seen: unknown[] = [];
    function Host() {
      seen.push(useRevealScope());
      return null;
    }
    const { rerender } = await render(<Host />);
    await rerender(<Host />);
    expect(seen[0]).toBe(seen[1]);
  });
});

describe('Swap', () => {
  it('shows new content when the key changes, and ends fully visible', async () => {
    const { rerender } = await render(
      <Swap swapKey="hoje" testID="s">
        <Text>hoje</Text>
      </Swap>,
    );
    expect(screen.getByText('hoje')).toBeTruthy();
    await rerender(
      <Swap swapKey="amanhã" testID="s">
        <Text>amanhã</Text>
      </Swap>,
    );
    expect(screen.getByText('amanhã')).toBeTruthy();
    expect(screen.queryByText('hoje')).toBeNull();
    expect(style('s').opacity).toBeCloseTo(1);
  });

  it('does not move under Reduce Motion', async () => {
    (useReduceMotion as jest.Mock).mockReturnValue(true);
    await render(
      <Swap swapKey="a" testID="s">
        <Text>a</Text>
      </Swap>,
    );
    expect(style('s').transform).toEqual([]);
  });
});
