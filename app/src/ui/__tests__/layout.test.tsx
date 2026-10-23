import '../testSetup';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { ScreenHeader, Sheet, TabBar, Button, ThemeProvider, Text, useTheme } from '..';
import { lightColors, darkColors } from '@/theme/tokens';
import { HIDDEN, heightOf } from '../testHelpers';

const routes = [
  { key: 'a', name: 'index' },
  { key: 'b', name: 'mapa' },
  { key: 'c', name: 'salvos' },
];
const descriptors = {
  a: { options: { title: 'Explorar' } },
  b: { options: { title: 'Mapa' } },
  c: { options: { title: 'Salvos' } },
};

describe('TabBar', () => {
  it('marks the active tab selected with a top indicator, and navigates', async () => {
    const navigate = jest.fn();
    const emit = jest.fn(() => ({ defaultPrevented: false }));
    await render(<TabBar state={{ index: 0, routes }} descriptors={descriptors} navigation={{ emit, navigate }} />);
    expect(screen.getByRole('tab', { name: 'Explorar' })).toBeSelected();
    expect(screen.getByRole('tab', { name: 'Mapa' })).not.toBeSelected();
    expect(screen.getAllByTestId('tab-indicator', HIDDEN)).toHaveLength(1);
    expect(heightOf(screen.getByRole('tab', { name: 'Mapa' }))).toBeGreaterThanOrEqual(44);
    await fireEvent.press(screen.getByRole('tab', { name: 'Mapa' }));
    expect(navigate).toHaveBeenCalledWith('mapa');
  });

  it('does not navigate when the event is prevented or the tab is focused', async () => {
    const navigate = jest.fn();
    const emit = jest.fn(() => ({ defaultPrevented: true }));
    await render(<TabBar state={{ index: 0, routes }} descriptors={descriptors} navigation={{ emit, navigate }} />);
    await fireEvent.press(screen.getByRole('tab', { name: 'Mapa' }));
    await fireEvent.press(screen.getByRole('tab', { name: 'Explorar' }));
    expect(navigate).not.toHaveBeenCalled();
  });
});

describe('ScreenHeader', () => {
  it('back button is labelled and 44px', async () => {
    const onBack = jest.fn();
    await render(<ScreenHeader title="Evento" onBack={onBack} />);
    const back = screen.getByRole('button', { name: 'Voltar' });
    expect(heightOf(back)).toBeGreaterThanOrEqual(44);
    await fireEvent.press(back);
    expect(onBack).toHaveBeenCalled();
    expect(screen.getByRole('header', { name: 'Evento' })).toBeTruthy();
  });
});

describe('Sheet', () => {
  it('renders nothing when hidden', async () => {
    await render(
      <Sheet visible={false} onClose={() => {}} title="Filtros">
        <Text>conteudo</Text>
      </Sheet>,
    );
    expect(screen.queryByText('conteudo')).toBeNull();
  });

  it('shows title, content, footer and closes via the 44px close button', async () => {
    const onClose = jest.fn();
    await render(
      <Sheet visible onClose={onClose} title="Filtros" footer={<Button label="Ver 12 eventos" />}>
        <Text>conteudo</Text>
      </Sheet>,
    );
    expect(screen.getByText('Filtros')).toBeTruthy();
    expect(screen.getByText('conteudo')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Ver 12 eventos' })).toBeTruthy();
    const close = screen.getByRole('button', { name: 'Fechar' });
    expect(heightOf(close)).toBeGreaterThanOrEqual(44);
    await fireEvent.press(close);
    expect(onClose).toHaveBeenCalled();
  });
});

describe('ThemeProvider', () => {
  function Probe() {
    const { colors, scheme } = useTheme();
    return <Text testID="probe">{`${scheme}:${colors.background}`}</Text>;
  }

  it('defaults to dark without a provider', async () => {
    await render(<Probe />);
    expect(screen.getByTestId('probe').props.children).toBe(`dark:${darkColors.background}`);
  });

  it('supports light', async () => {
    await render(
      <ThemeProvider mode="light">
        <Probe />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('probe').props.children).toBe(`light:${lightColors.background}`);
  });

  it('system resolves to a concrete scheme', async () => {
    await render(
      <ThemeProvider mode="system">
        <Probe />
      </ThemeProvider>,
    );
    expect(String(screen.getByTestId('probe').props.children)).toMatch(/^(dark|light):/);
  });
});
