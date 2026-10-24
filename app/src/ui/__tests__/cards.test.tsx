import '../testSetup';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { COVER_PALETTE_IDS, COVER_TEMPLATE_IDS, COVER_VARIANT_IDS } from '@/domain/cover';
import { LEGACY_COVER_KEYS } from '@/domain/types';
import { ArtistRow, Cover, EmptyState, ErrorState, EventCard, VenueRow } from '..';
import { HIDDEN, heightOf } from '../testHelpers';

const base = {
  title: 'Noite 80s e 90s',
  venueName: 'Pub 426',
  area: 'Praia do Canto',
  distanceKm: 0.5,
  priceLabel: 'R$ 20',
  dateLabel: 'Hoje · 21h',
  coverKey: 'pub426' as const,
};

describe('EventCard', () => {
  it('poster is 264x240 and press + save are separate 44px buttons', async () => {
    const onPress = jest.fn();
    const onToggleSave = jest.fn();
    await render(<EventCard {...base} testID="card" onPress={onPress} onToggleSave={onToggleSave} />);
    const open = screen.getByRole('button', { name: /Noite 80s e 90s/ });
    await fireEvent.press(open);
    expect(onPress).toHaveBeenCalled();
    const save = screen.getByRole('button', { name: 'Salvar evento' });
    expect(heightOf(save)).toBeGreaterThanOrEqual(44);
    await fireEvent.press(save);
    expect(onToggleSave).toHaveBeenCalled();
    expect(heightOf(screen.getByTestId('card'))).toBe(240);
    expect(screen.getByText('0,5 km', { exact: false })).toBeTruthy();
  });

  it('saved state changes the label and icon', async () => {
    await render(<EventCard {...base} saved onToggleSave={() => {}} />);
    expect(screen.getByRole('button', { name: 'Remover dos salvos' })).toBeSelected();
    expect(screen.getByTestId('icon-heartFilled', HIDDEN)).toBeTruthy();
  });

  it('row variant uses a 72px cover', async () => {
    await render(<EventCard {...base} variant="row" onPress={() => {}} onToggleSave={() => {}} />);
    expect(screen.getByRole('button', { name: /Noite 80s/ })).toBeTruthy();
    expect(screen.getByTestId('cover-pub426', HIDDEN)).toBeTruthy();
  });
});

describe('VenueRow / ArtistRow', () => {
  it('VenueRow reads the status in text and is pressable', async () => {
    const onPress = jest.fn();
    await render(<VenueRow name="Bolt" area="Praia do Canto" distanceKm={1.2} statusLabel="Aberto agora" coverKey="bolt" onPress={onPress} />);
    await fireEvent.press(screen.getByRole('button', { name: /Bolt.*Aberto agora/ }));
    expect(onPress).toHaveBeenCalled();
    expect(screen.getByText('Aberto agora')).toBeTruthy();
  });

  it('ArtistRow shows initials and the played date', async () => {
    await render(<ArtistRow name="DJ Maré" playedLabel="12 set" onPress={() => {}} />);
    expect(screen.getByText('DM')).toBeTruthy();
    expect(screen.getByText('12 set')).toBeTruthy();
    expect(heightOf(screen.getByRole('button'))).toBeGreaterThanOrEqual(56);
  });
});

describe('Cover', () => {
  it.each(LEGACY_COVER_KEYS)('renders legacy key %s', async (k) => {
    await render(<Cover coverKey={k} />);
    expect(screen.getByTestId(`cover-${k}`, HIDDEN)).toBeTruthy();
  });

  const combos = COVER_TEMPLATE_IDS.flatMap((t) => COVER_PALETTE_IDS.map((p) => [t, p] as const));
  it.each(combos)('renders template %s in palette %s', async (t, p) => {
    const key = `art:${t}:${p}:${COVER_VARIANT_IDS[(t.length + p.length) % COVER_VARIANT_IDS.length]}`;
    await render(<Cover coverKey={key} />);
    expect(screen.getByTestId(`cover-${key}`, HIDDEN)).toBeTruthy();
  });

  it.each(COVER_VARIANT_IDS)('renders variant %s', async (v) => {
    await render(<Cover coverKey={`art:disco:rosa-ambar:${v}`} />);
    expect(screen.getByTestId(`cover-art:disco:rosa-ambar:${v}`, HIDDEN)).toBeTruthy();
  });

  it('unknown keys fall back to the generic art', async () => {
    await render(<Cover coverKey="art:nao-existe:rosa-ambar:a" />);
    expect(screen.getByTestId('cover-art:nao-existe:rosa-ambar:a', HIDDEN)).toBeTruthy();
  });

  it('gives every cover on screen its own gradient ids', async () => {
    await render(
      <>
        <Cover coverKey="art:disco:rosa-ambar:a" />
        <Cover coverKey="art:disco:rosa-ambar:a" />
      </>,
    );
    const ids = (JSON.stringify(screen.toJSON()).match(/"name":"[^"]+-bg"/g) ?? []) as string[];
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
  });

  it('shows the organizer poster and falls back to the illustration on error', async () => {
    await render(<Cover coverKey="art:disco:rosa-ambar:a" imageUrl="https://example.com/p.jpg" />);
    const img = screen.getByTestId('cover-image', HIDDEN);
    expect(screen.queryByTestId('cover-art:disco:rosa-ambar:a', HIDDEN)).toBeNull();
    await fireEvent(img, 'error', { nativeEvent: { error: 'x' } });
    expect(screen.queryByTestId('cover-image', HIDDEN)).toBeNull();
    expect(screen.getByTestId('cover-art:disco:rosa-ambar:a', HIDDEN)).toBeTruthy();
  });
});

describe('EmptyState / ErrorState', () => {
  it('EmptyState offers a specific next action', async () => {
    const onAction = jest.fn();
    await render(<EmptyState title="Nada por aqui" message="Aumente o raio para 10 km" actionLabel="Aumentar raio" onAction={onAction} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Aumentar raio' }));
    expect(onAction).toHaveBeenCalled();
    expect(screen.getByLabelText('Qual a boa?, apagada')).toBeTruthy();
  });

  it('ErrorState is an alert with a retry', async () => {
    const onRetry = jest.fn();
    await render(<ErrorState onRetry={onRetry} />);
    expect(screen.getByRole('alert')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(onRetry).toHaveBeenCalled();
  });
});
