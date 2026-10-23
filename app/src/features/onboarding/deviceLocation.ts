import * as Location from 'expo-location';

import { useLocation } from '@/state/location';

export type DeviceLocationResult = 'granted' | 'denied' | 'unavailable';

export const DEVICE_LOCATION_LABEL = 'Perto de você';

/**
 * Asks for foreground permission and reads the current position into the location store.
 * 'denied' = the user refused; 'unavailable' = services off, timeout or any other failure.
 */
export async function requestDeviceLocation(): Promise<DeviceLocationResult> {
  try {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (!perm.granted) return 'denied';
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    useLocation.getState().setLocation({
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
      label: DEVICE_LOCATION_LABEL,
    });
    return 'granted';
  } catch {
    return 'unavailable';
  }
}

export const LOCATION_MESSAGES: Record<Exclude<DeviceLocationResult, 'granted'>, string> = {
  denied: 'Sem permissão de localização. Tudo bem: escolha o seu bairro para continuar.',
  unavailable: 'Não deu para pegar sua localização agora. Escolha o seu bairro para continuar.',
};