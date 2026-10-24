import { fireEvent, render, screen } from '@testing-library/react-native';

import '@/ui/testSetup';
import { eventPhase } from '@/features/acompanhar/logic';
import { EndedPanel } from '../EndedPanel';

describe('Ao vivo ended state', () => {
  it('phase is after once the event is over', () => {
    expect(eventPhase({ startsAt: '2026-01-01T20:00:00Z', endsAt: '2026-01-02T02:00:00Z' }, Date.parse('2026-01-02T03:00:00Z'))).toBe('after');
  });
  it('shows Encerrado and a link to Avaliar', async () => {
    const onRate = jest.fn();
    await render(<EndedPanel onRate={onRate} />);
    expect(screen.getByText('Encerrado')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Avaliar este evento' }));
    expect(onRate).toHaveBeenCalled();
  });
});
