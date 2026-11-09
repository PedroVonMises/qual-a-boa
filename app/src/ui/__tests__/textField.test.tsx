import '../testSetup';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { TextField } from '..';
import { darkColors, fonts } from '@/theme/tokens';
import { heightOf } from '../testHelpers';

const flat = (el: { props: { style?: unknown } }) => StyleSheet.flatten(el.props.style as never) as Record<string, unknown>;

describe('TextField', () => {
  it('has a visible label that names a 48px input and forwards typing', async () => {
    const onChangeText = jest.fn();
    await render(<TextField label="Número" value="" onChangeText={onChangeText} keyboardType="number-pad" maxLength={6} testID="tf" />);
    expect(screen.getByText('Número')).toBeTruthy();
    const input = screen.getByLabelText('Número');
    expect(heightOf(input)).toBeGreaterThanOrEqual(48);
    // minHeight, never a fixed height: large font scales grow the field instead of clipping.
    expect(flat(input).height).toBeUndefined();
    expect(input.props.keyboardType).toBe('number-pad');
    expect(input.props.maxLength).toBe(6);
    await fireEvent.changeText(input, '823');
    expect(onChangeText).toHaveBeenCalledWith('823');
  });

  it('error: danger border and a polite live message', async () => {
    await render(<TextField label="CEP" value="290" error="CEP não encontrado." testID="cep" />);
    expect(flat(screen.getByTestId('cep')).borderColor).toBe(darkColors.danger);
    const msg = screen.getByTestId('cep-error');
    expect(msg).toHaveTextContent('CEP não encontrado.');
    expect(msg.props.accessibilityLiveRegion).toBe('polite');
  });

  it('focus switches the border to accent; hint shows without error', async () => {
    await render(<TextField label="Celular" value="" hint="Opcional" testID="tel" />);
    expect(screen.getByText('Opcional')).toBeTruthy();
    const input = screen.getByTestId('tel');
    expect(flat(input).borderColor).toBe(darkColors.border);
    await fireEvent(input, 'focus');
    expect(flat(screen.getByTestId('tel')).borderColor).toBe(darkColors.accent);
    await fireEvent(screen.getByTestId('tel'), 'blur');
    expect(flat(screen.getByTestId('tel')).borderColor).toBe(darkColors.border);
  });

  it('mono variant uses the mono font; read-only exposes disabled', async () => {
    await render(<TextField label="E-mail" value="a@b.com" editable={false} mono testID="mail" />);
    const input = screen.getByTestId('mail');
    expect(flat(input).fontFamily).toBe(fonts.mono);
    expect(input.props.editable).toBe(false);
    expect(input.props.accessibilityState).toMatchObject({ disabled: true });
  });
});
