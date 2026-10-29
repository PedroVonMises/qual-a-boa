import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

/** Only plain https URLs with a host are allowed to leave the app through the browser. */
export function isHttpsUrl(url: string | undefined | null): url is string {
  return typeof url === 'string' && /^https:\/\/[^\s/?#@.]+\.[^\s/?#@]+(?:[/?#]\S*)?$/i.test(url.trim());
}

export type MapsOs = 'ios' | 'android' | 'web' | string;

export function googleMapsUrl(name: string, lat: number, lng: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${name} ${lat},${lng}`)}`;
}

/** Platform maps URL: Apple Maps on iOS, `geo:` on Android, Google Maps elsewhere. */
export function mapsUrl(name: string, lat: number, lng: number, os: MapsOs = Platform.OS): string {
  const q = encodeURIComponent(name);
  const ll = `${lat},${lng}`;
  if (os === 'ios') return `https://maps.apple.com/?ll=${encodeURIComponent(ll)}&q=${q}`;
  if (os === 'android') return `geo:${ll}?q=${encodeURIComponent(`${ll}(${name})`)}`;
  return googleMapsUrl(name, lat, lng);
}

/** Opens the maps app; falls back to Google Maps in the browser when the platform URL fails. */
export async function openMaps(name: string, lat: number, lng: number): Promise<void> {
  try {
    await Linking.openURL(mapsUrl(name, lat, lng));
  } catch {
    try {
      await Linking.openURL(googleMapsUrl(name, lat, lng));
    } catch {
      /* nothing else to try */
    }
  }
}

export function deepLink(path: string): string {
  return Linking.createURL(path);
}

/** Host shown before handing the user to an external ticket site ("www." dropped), or null for unsafe URLs. */
export function ticketHost(url: string | undefined | null): string | null {
  if (!isHttpsUrl(url)) return null;
  const m = /^https:\/\/([^/?#:]+)/i.exec(url.trim());
  return m ? m[1].toLowerCase().replace(/^www\./, '') : null;
}

/** wa.me share link (opens WhatsApp on phones, WhatsApp Web on desktop). */
export function whatsappUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
