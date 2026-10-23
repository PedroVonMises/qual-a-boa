import '../testSetup';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { Badge, Button, Chip, IconButton, ListRow, Rating, SearchBar, SegmentedControl, Switch } from '..';
import { HIDDEN, heightOf, widthOf } from '../testHelpers';

describe('Button', () => {
  it('is a labelled 52px button and fires onPress', async () => {
    const onPress = jest.fn();
    await render(<Button label="Ver ingressos" onPress={onPress} />);
    const b = screen.getByRole('button', { name: 'Ver ingressos' });
    expect(heightOf(b)).toBeGreaterThanOrEqual(52);
    await fireEvent.press(b);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not fire when disabled, keeps the label, exposes disabled state', async () => {
    const onPress = jest.fn();
    await render(<Button label="Enviar" disabled onPress={onPress} />);
    const b = screen.getByRole('button', { name: 'Enviar' });
    await fireEvent.press(b);
    expect(onPress).not.toHaveBeenCalled();
    expect(b).toBeDisabled();
  });

  it('is busy and inert while loading', async () => {
    const onPress = jest.fn();
    await render(<Button label="Salvando" loading onPress={onPress} />);
    const b = screen.getByRole('button', { name: 'Salvando' });
    await fireEvent.press(b);
    expect(onPress).not.toHaveBeenCalled();
    expect(b).toBeBusy();
  });
});

describe('IconButton', () => {
  it('has an accessible name and a 44px target', async () => {
    const onPress = jest.fn();
    await render(<IconButton icon="filter" label="Filtros" onPress={onPress} />);
    const b = screen.getByRole('button', { name: 'Filtros' });
    expect(heightOf(b)).toBeGreaterThanOrEqual(44);
    expect(widthOf(b)).toBeGreaterThanOrEqual(44);
    await fireEvent.press(b);
    expect(onPress).toHaveBeenCalled();
  });
});

describe('Chip', () => {
  it('is 44px and shows a check only when selected', async () => {
    const { rerender } = await render(<Chip label="Funk" />);
    const idle = screen.getByRole('button', { name: 'Funk' });
    expect(heightOf(idle)).toBeGreaterThanOrEqual(44);
    expect(screen.queryByTestId('icon-check', HIDDEN)).toBeNull();
    expect(idle).not.toBeSelected();

    await rerender(<Chip label="Funk" selected />);
    expect(screen.getByRole('button', { name: 'Funk' })).toBeSelected();
    expect(screen.getByTestId('icon-check', HIDDEN)).toBeTruthy();
  });

  it('renders the count and ignores presses when disabled', async () => {
    const onPress = jest.fn();
    await render(<Chip label="Rock" count={7} disabled onPress={onPress} />);
    expect(screen.getByText('7')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Rock, 7' }));
    expect(onPress).not.toHaveBeenCalled();
  });
});

describe('Switch', () => {
  it('is a switch with checked state, 44px row, and toggles', async () => {
    const onValueChange = jest.fn();
    await render(<Switch label="Só grátis" value={false} onValueChange={onValueChange} />);
    const s = screen.getByRole('switch', { name: 'Só grátis' });
    expect(s).not.toBeChecked();
    expect(heightOf(s)).toBeGreaterThanOrEqual(44);
    await fireEvent.press(s);
    expect(onValueChange).toHaveBeenCalledWith(true);
  });

  it('reports checked and does nothing when disabled', async () => {
    const onValueChange = jest.fn();
    await render(<Switch label="Avisos" value disabled onValueChange={onValueChange} />);
    const s = screen.getByRole('switch', { name: 'Avisos' });
    expect(s).toBeChecked();
    await fireEvent.press(s);
    expect(onValueChange).not.toHaveBeenCalled();
  });
});

describe('Rating', () => {
  it('input mode: five 52px radios, current one checked, onChange fires', async () => {
    const onChange = jest.fn();
    await render(<Rating value={3} onChange={onChange} />);
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(5);
    radios.forEach((r) => {
      expect(heightOf(r)).toBeGreaterThanOrEqual(52);
      expect(widthOf(r)).toBeGreaterThanOrEqual(52);
    });
    expect(screen.getByRole('radio', { name: '3 estrelas' })).toBeChecked();
    await fireEvent.press(screen.getByRole('radio', { name: '5 estrelas' }));
    expect(onChange).toHaveBeenCalledWith(5);
  });

  it('display mode: one image with a spoken score', async () => {
    await render(<Rating value={4.6} count={128} />);
    expect(screen.getByLabelText('Nota 4,6 de 5, 128 avaliações')).toBeTruthy();
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
  });
});

describe('SegmentedControl', () => {
  it('marks the selected tab, 44px each, and changes value', async () => {
    const onChange = jest.fn();
    await render(
      <SegmentedControl
        label="Quando"
        value="hoje"
        onChange={onChange}
        options={[{ value: 'hoje', label: 'Hoje' }, { value: 'semana', label: 'Semana' }]}
      />,
    );
    expect(screen.getByRole('tab', { name: 'Hoje' })).toBeSelected();
    const other = screen.getByRole('tab', { name: 'Semana' });
    expect(other).not.toBeSelected();
    expect(heightOf(other)).toBeGreaterThanOrEqual(44);
    await fireEvent.press(other);
    expect(onChange).toHaveBeenCalledWith('semana');
  });
});

describe('SearchBar', () => {
  it('has label, placeholder, 48px height, and a 44px clear button', async () => {
    const onChangeText = jest.fn();
    await render(<SearchBar value="bolt" onChangeText={onChangeText} placeholder="Bolt, A Selva..." />);
    const input = screen.getByLabelText('Buscar');
    expect(input.props.placeholder).toBe('Bolt, A Selva...');
    const clear = screen.getByRole('button', { name: 'Limpar busca' });
    expect(heightOf(clear)).toBeGreaterThanOrEqual(44);
    await fireEvent.press(clear);
    expect(onChangeText).toHaveBeenCalledWith('');
  });

  it('hides the clear button when empty', async () => {
    await render(<SearchBar value="" onChangeText={() => {}} />);
    expect(screen.queryByRole('button', { name: 'Limpar busca' })).toBeNull();
  });
});

describe('ListRow', () => {
  it('is at least 56px, a button when pressable, shows chevron', async () => {
    const onPress = jest.fn();
    await render(<ListRow title="Ajuda" subtitle="Dúvidas" chevron onPress={onPress} />);
    const row = screen.getByRole('button', { name: 'Ajuda, Dúvidas' });
    expect(heightOf(row)).toBeGreaterThanOrEqual(56);
    expect(screen.getByTestId('icon-chevronRight', HIDDEN)).toBeTruthy();
    await fireEvent.press(row);
    expect(onPress).toHaveBeenCalled();
  });
});

describe('Badge', () => {
  it('always spells the status in text', async () => {
    await render(<Badge label="Esgotado" tone="danger" icon="close" />);
    expect(screen.getByText('Esgotado')).toBeTruthy();
  });
});
