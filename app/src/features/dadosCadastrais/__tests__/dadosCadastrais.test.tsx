import '@/ui/testSetup';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { useState } from 'react';

import { useAccountEmail } from '@/data/auth';
import { lookupCep } from '@/lib/cep';
import { geocodeAddress } from '@/lib/location/geocode';
import { useLocation } from '@/state/location';
import { useProfile } from '@/state/profile';
import { AddressForm } from '../AddressForm';
import { DadosCadastraisScreen } from '../DadosCadastraisScreen';
import { EMPTY_DRAFT, type AddressDraft } from '../format';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
const mockBack = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ back: mockBack, push: jest.fn() }) }));
jest.mock('@/lib/cep', () => ({ ...jest.requireActual('@/lib/cep'), lookupCep: jest.fn() }));
jest.mock('@/lib/location/geocode', () => ({ geocodeAddress: jest.fn() }));
jest.mock('@/data/auth', () => ({ ...jest.requireActual('@/data/auth'), useAccountEmail: jest.fn(() => null) }));
jest.mock('@/data/account', () => ({
  ...jest.requireActual('@/data/account'),
  useDisplayName: () => ({ data: 'Ana' }),
  saveDisplayName: jest.fn(async () => ({ ok: true })),
}));

const mockLookup = lookupCep as jest.Mock;
const mockGeocode = geocodeAddress as jest.Mock;
const mockEmail = useAccountEmail as jest.Mock;

const FOUND = { street: 'Rua Joaquim Lírio', district: 'Praia do Canto', city: 'Vitória', uf: 'ES' };
const NOT_FOUND = { error: 'not_found', message: 'CEP não encontrado. Confira os números.' };

const renderScreen = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <DadosCadastraisScreen />
    </QueryClientProvider>,
  );

beforeEach(() => {
  jest.clearAllMocks();
  mockEmail.mockReturnValue(null);
  useProfile.getState().clear();
  useLocation.getState().resetLocation();
});

function Controlled({ lookup }: { lookup: jest.Mock }) {
  const [v, setV] = useState<AddressDraft>(EMPTY_DRAFT);
  return <AddressForm value={v} onChange={setV} lookup={lookup} />;
}

describe('AddressForm', () => {
  it('masks the CEP and fills street / district / city / UF at 8 digits, with a confirmation line', async () => {
    const lookup = jest.fn().mockResolvedValue(FOUND);
    await render(<Controlled lookup={lookup} />);
    await fireEvent.changeText(screen.getByTestId('address-cep'), '2906');
    expect(lookup).not.toHaveBeenCalled();
    await fireEvent.changeText(screen.getByTestId('address-cep'), '29060000');
    expect(lookup).toHaveBeenCalledWith('29060000');
    expect(screen.getByTestId('address-cep').props.value).toBe('29060-000');
    expect(await screen.findByTestId('address-confirm')).toHaveTextContent('Rua Joaquim Lírio · Praia do Canto · Vitória, ES');
    expect(screen.getByTestId('address-street').props.value).toBe('Rua Joaquim Lírio');
    expect(screen.getByTestId('address-district').props.value).toBe('Praia do Canto');
    expect(screen.getByTestId('address-uf').props.value).toBe('ES');
    // Still editable.
    await fireEvent.changeText(screen.getByTestId('address-street'), 'Rua Outra');
    expect(screen.getByTestId('address-street').props.value).toBe('Rua Outra');
  });

  it('shows the CEP error inline', async () => {
    const lookup = jest.fn().mockResolvedValue(NOT_FOUND);
    await render(<Controlled lookup={lookup} />);
    await fireEvent.changeText(screen.getByTestId('address-cep'), '99999999');
    expect(await screen.findByTestId('address-cep-error')).toHaveTextContent('CEP não encontrado. Confira os números.');
    expect(screen.queryByTestId('address-confirm')).toBeNull();
  });
});

describe('DadosCadastraisScreen', () => {
  const fillAddress = async () => {
    mockLookup.mockResolvedValue(FOUND);
    await fireEvent.changeText(screen.getByTestId('address-cep'), '29060000');
    await screen.findByTestId('address-confirm');
  };

  it('visitor: no name/e-mail; saving geocodes and stores the address with coords as the registered point', async () => {
    mockGeocode.mockResolvedValue({ point: { lat: -20.3, lng: -40.29, label: 'Rua Joaquim Lírio, 823' }, precise: true });
    await renderScreen();
    expect(screen.queryByTestId('dados-nome')).toBeNull();
    expect(screen.queryByTestId('dados-email')).toBeNull();
    await fillAddress();
    await fireEvent.changeText(screen.getByTestId('address-number'), '823');
    await fireEvent.changeText(screen.getByTestId('dados-celular'), '27999990000');
    expect(screen.getByTestId('dados-celular').props.value).toBe('(27) 99999-0000');
    await fireEvent.press(screen.getByRole('button', { name: 'Salvar dados' }));
    await waitFor(() => expect(screen.getByTestId('dados-note')).toHaveTextContent('Dados salvos.'));
    expect(mockGeocode).toHaveBeenCalledWith('Rua Joaquim Lírio, 823, Praia do Canto, Vitória - ES, Brasil', {
      district: 'Praia do Canto',
      label: 'Rua Joaquim Lírio, 823',
    });
    expect(useProfile.getState().address).toMatchObject({ cep: '29060000', number: '823', lat: -20.3, lng: -40.29 });
    expect(useProfile.getState().phone).toBe('27999990000');
    expect(useLocation.getState().registered).toMatchObject({ lat: -20.3, lng: -40.29, label: 'Rua Joaquim Lírio, 823' });
    expect(screen.getByTestId('dados-preview')).toHaveTextContent(/Rua Joaquim Lírio, 823/);
  });

  it('imprecise geocode says it uses the neighbourhood center', async () => {
    mockGeocode.mockResolvedValue({ point: { lat: -20.29, lng: -40.29, label: 'x' }, precise: false });
    await renderScreen();
    await fillAddress();
    await fireEvent.changeText(screen.getByTestId('address-number'), 's/n');
    await fireEvent.press(screen.getByRole('button', { name: 'Salvar dados' }));
    expect(await screen.findByText(/Vamos usar o centro do bairro/)).toBeTruthy();
  });

  it('marks missing number and a bad phone, and saves nothing', async () => {
    await renderScreen();
    await fillAddress();
    await fireEvent.changeText(screen.getByTestId('dados-celular'), '2799');
    await fireEvent.press(screen.getByRole('button', { name: 'Salvar dados' }));
    expect(screen.getByTestId('address-number-error')).toHaveTextContent(/Digite o número/);
    expect(screen.getByTestId('dados-celular-error')).toBeTruthy();
    expect(mockGeocode).not.toHaveBeenCalled();
    expect(useProfile.getState().address).toBeUndefined();
  });

  it('"Apagar endereço" clears the address and the registered point', async () => {
    useProfile.getState().setAddress({ cep: '29060000', street: 'R. A', number: '1', district: 'Praia do Canto', city: 'Vitória', uf: 'ES', lat: -20.3, lng: -40.29 });
    await renderScreen();
    expect(screen.getByTestId('address-street').props.value).toBe('R. A');
    await fireEvent.press(screen.getByRole('button', { name: 'Apagar endereço' }));
    await waitFor(() => expect(screen.getByTestId('dados-note')).toHaveTextContent('Endereço apagado.'));
    expect(useProfile.getState().address).toBeUndefined();
    expect(useLocation.getState().registered).toBeNull();
    expect(screen.getByTestId('address-street').props.value).toBe('');
  });

  it('signed in: shows the name and a read-only e-mail', async () => {
    mockEmail.mockReturnValue('ana@exemplo.com');
    await renderScreen();
    expect(screen.getByTestId('dados-nome').props.value).toBe('Ana');
    expect(screen.getByTestId('dados-email').props.value).toBe('ana@exemplo.com');
    expect(screen.getByTestId('dados-email').props.editable).toBe(false);
  });
});
