import { FALLBACK_LABEL, refreshDeviceLocation } from '@/lib/location';

export type DeviceLocationResult = 'granted' | 'denied' | 'blocked' | 'unavailable';

export const DEVICE_LOCATION_LABEL = FALLBACK_LABEL;

/** Asks for foreground permission (when still askable) and stores the device fix. */
export async function requestDeviceLocation(): Promise<DeviceLocationResult> {
  try {
    const res = await refreshDeviceLocation(true);
    if (res.ok) return 'granted';
    if (res.reason === 'denied' || res.reason === 'blocked') return res.reason;
    return 'unavailable';
  } catch {
    return 'unavailable';
  }
}

export const LOCATION_RATIONALE =
  'Vamos pedir a permissão de localização do seu aparelho. Usamos só para ordenar as casas por distância. Ela fica no aparelho e não é enviada a nenhum servidor.';

export const LOCATION_MESSAGES: Record<Exclude<DeviceLocationResult, 'granted'>, string> = {
  denied: 'Sem permissão de localização. Tudo bem: escolha o seu bairro para continuar.',
  blocked:
    'A localização está bloqueada para o app. Abra as configurações para liberar, ou escolha o seu bairro para continuar.',
  unavailable: 'Não deu para pegar sua localização agora. Escolha o seu bairro para continuar.',
};
