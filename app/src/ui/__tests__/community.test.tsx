import '../testSetup';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { Avatar, CommentItem, HelpfulBadge, HelpfulButton, KindChip, ThreadCard } from '..';
import { HIDDEN, heightOf } from '../testHelpers';

describe('HelpfulButton', () => {
  it('is a 44px toggle labelled with its count and fires onPress', async () => {
    const onPress = jest.fn();
    await render(<HelpfulButton count={12} selected={false} onPress={onPress} />);
    const b = screen.getByRole('button', { name: 'Útil, 12' });
    expect(heightOf(b)).toBeGreaterThanOrEqual(44);
    await fireEvent.press(b);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('exposes selected state', async () => {
    await render(<HelpfulButton count={13} selected onPress={jest.fn()} />);
    expect(screen.getByRole('button', { name: 'Útil, 13' })).toBeSelected();
  });
});

describe('HelpfulBadge', () => {
  it('pluralises the voter count', async () => {
    await render(<HelpfulBadge votes={18} />);
    expect(screen.getByLabelText('Mais útil · 18 pessoas')).toBeTruthy();
  });

  it('uses the singular for one voter and the bare label with no count', async () => {
    const { rerender } = await render(<HelpfulBadge votes={1} />);
    expect(screen.getByLabelText('Mais útil · 1 pessoa')).toBeTruthy();
    await rerender(<HelpfulBadge />);
    expect(screen.getByLabelText('Mais útil')).toBeTruthy();
  });
});

describe('KindChip', () => {
  it('renders the kind label as text', async () => {
    await render(<KindChip kind="agora" />);
    expect(screen.getByText('AGORA')).toBeTruthy();
  });
});

describe('Avatar', () => {
  it('shows the uppercase initial for a named author', async () => {
    await render(<Avatar handle="marina_vix" hue={200} />);
    expect(screen.getByText('M', HIDDEN)).toBeTruthy();
  });

  it('shows a glyph, never the handle initial, when anonymous', async () => {
    await render(<Avatar handle="marina_vix" anonymous />);
    expect(screen.queryByText('M', HIDDEN)).toBeNull();
    expect(screen.getByTestId('icon-user', HIDDEN)).toBeTruthy();
  });
});

describe('ThreadCard', () => {
  const base = { eventName: 'Noite do Pagodão', kind: 'vale_a_pena' as const, title: 'Vale o camarote?', replies: 24, ago: 'há 1 h' };

  it('is one labelled button that fires onPress', async () => {
    const onPress = jest.fn();
    await render(<ThreadCard {...base} onPress={onPress} />);
    const b = screen.getByRole('button', { name: 'Vale o camarote?. Noite do Pagodão. 24 respostas' });
    expect(heightOf(b)).toBeGreaterThanOrEqual(44);
    await fireEvent.press(b);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('shows the Mais útil preview only when a top comment exists', async () => {
    const { rerender } = await render(<ThreadCard {...base} onPress={jest.fn()} />);
    expect(screen.queryByLabelText(/Mais útil/)).toBeNull();
    await rerender(<ThreadCard {...base} topComment={{ body: 'A pista resolve.', votes: 18 }} onPress={jest.fn()} />);
    expect(screen.getByLabelText('Mais útil · 18 pessoas')).toBeTruthy();
    expect(screen.getByText('A pista resolve.')).toBeTruthy();
  });

  it('uses the singular reply label', async () => {
    await render(<ThreadCard {...base} replies={1} onPress={jest.fn()} />);
    expect(screen.getByText('1 resposta')).toBeTruthy();
  });
});

describe('CommentItem', () => {
  const props = { ago: 'há 3 h', body: 'A pista resolve.', helpfulCount: 6, helpful: false, onToggleHelpful: jest.fn() };

  it('names the author with @ and toggles helpful', async () => {
    const onToggleHelpful = jest.fn();
    await render(<CommentItem {...props} handle="rafa.praia" onToggleHelpful={onToggleHelpful} />);
    expect(screen.getByText('@rafa.praia')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Útil, 6' }));
    expect(onToggleHelpful).toHaveBeenCalledTimes(1);
  });

  it('hides the handle when anonymous', async () => {
    await render(<CommentItem {...props} handle="rafa.praia" anonymous />);
    expect(screen.getByText('Anônimo')).toBeTruthy();
    expect(screen.queryByText('@rafa.praia')).toBeNull();
  });

  it('marks the top comment and offers Responder only at depth 0', async () => {
    const onReply = jest.fn();
    const { rerender } = await render(<CommentItem {...props} handle="a" top onReply={onReply} />);
    expect(screen.getByLabelText('Mais útil')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Responder' }));
    expect(onReply).toHaveBeenCalledTimes(1);
    await rerender(<CommentItem {...props} handle="a" depth={1} onReply={onReply} />);
    expect(screen.queryByRole('button', { name: 'Responder' })).toBeNull();
  });
});
