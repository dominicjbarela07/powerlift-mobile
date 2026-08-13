import { Platform } from 'react-native';

export const PRODUCTION_API_BASE = 'https://app.strengthledger.fit';

const DEV_API_BASE = Platform.OS === 'android'
  ? 'http://10.0.2.2:5000'
  : 'http://127.0.0.1:5000';

function normalizeBaseUrl(value: string | undefined | null): string | null {
  const trimmed = String(value || '').trim().replace(/\/$/, '');
  return trimmed || null;
}

function isBlockedProductionBaseUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    const host = parsed.hostname.toLowerCase();
    return (
      host === 'localhost' ||
      host === '0.0.0.0' ||
      host === '::1' ||
      host === '10.0.2.2' ||
      host.startsWith('127.')
    );
  } catch {
    return false;
  }
}

function resolveApiBase(): string {
  const configured = normalizeBaseUrl(process.env.EXPO_PUBLIC_API_BASE as string | undefined);
  const fallback = typeof __DEV__ !== 'undefined' && __DEV__ ? DEV_API_BASE : PRODUCTION_API_BASE;
  const candidate = configured || fallback;

  if (!(typeof __DEV__ !== 'undefined' && __DEV__) && isBlockedProductionBaseUrl(candidate)) {
    console.warn(
      `Ignoring unsafe production EXPO_PUBLIC_API_BASE "${candidate}". Falling back to ${PRODUCTION_API_BASE}.`
    );
    return PRODUCTION_API_BASE;
  }

  return candidate;
}

export const API_BASE = resolveApiBase();
export const WEB_BASE = API_BASE;
