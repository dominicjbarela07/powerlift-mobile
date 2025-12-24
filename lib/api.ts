// app/lib/api.ts
import * as SecureStore from 'expo-secure-store';

// API base URL
// - Prod default: Render
// - Optional override for dev via Expo env: EXPO_PUBLIC_API_BASE
export const API_BASE = (
  (process.env.EXPO_PUBLIC_API_BASE as string | undefined) ||
  'https://strength-coach-ui.onrender.com'
).replace(/\/$/, '');

type FetchJsonResult<T> = {
  ok: boolean;
  status: number;
  json: T | null;
  raw: string;
};

export async function fetchJson<T = any>(
  path: string,
  init: RequestInit = {}
): Promise<FetchJsonResult<T>> {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`;

  // If callers pass a plain object as `body`, React Native fetch will NOT serialize it.
  // Normalize to a JSON string body when appropriate.
  const method = String(init.method || 'GET').toUpperCase();
  const rawBody: any = (init as any).body;
  const bodyIsPresent = rawBody !== undefined && rawBody !== null;

  const isFormData = typeof FormData !== 'undefined' && rawBody instanceof FormData;
  const isBlob = typeof Blob !== 'undefined' && rawBody instanceof Blob;
  const isArrayBuffer = typeof ArrayBuffer !== 'undefined' && rawBody instanceof ArrayBuffer;

  const shouldJsonEncodeBody =
    bodyIsPresent &&
    method !== 'GET' &&
    method !== 'HEAD' &&
    typeof rawBody !== 'string' &&
    !isFormData &&
    !isBlob &&
    !isArrayBuffer;

  const normalizedBody: any = shouldJsonEncodeBody ? JSON.stringify(rawBody) : rawBody;

  // ---- Mobile auth: attach Bearer token automatically (if present) ----
  // AuthContext stores the token in SecureStore; support a few key names for safety.
  const token =
    (await SecureStore.getItemAsync('auth_token')) ||
    (await SecureStore.getItemAsync('token')) ||
    (await SecureStore.getItemAsync('pl_token')) ||
    (await SecureStore.getItemAsync('powerlift_token'));

  const normalizeHeaders = (h: HeadersInit | undefined): Record<string, string> => {
    if (!h) return {};
    // Headers instance
    if (typeof (h as any).forEach === 'function') {
      const out: Record<string, string> = {};
      (h as any).forEach((value: string, key: string) => {
        out[key] = value;
      });
      return out;
    }
    // Array of tuples
    if (Array.isArray(h)) {
      const out: Record<string, string> = {};
      for (const [k, v] of h) out[String(k)] = String(v);
      return out;
    }
    // Plain object
    return h as Record<string, string>;
  };

  const callerHeaders = normalizeHeaders(init.headers as any);

  const defaultHeaders: Record<string, string> = {
    Accept: 'application/json',
  };

  // Only set Content-Type when sending a JSON body (and caller didn't set it)
  const hasBody = normalizedBody !== undefined && normalizedBody !== null;
  const hasContentType =
    Object.keys(callerHeaders).some((k) => k.toLowerCase() === 'content-type');

  if (hasBody && !hasContentType) {
    // If we normalized to JSON, or caller provided a string body but didn't set CT,
    // default to JSON because all our endpoints are JSON.
    defaultHeaders['Content-Type'] = 'application/json';
  }

  const mergedHeaders: Record<string, string> = {
    ...defaultHeaders,
    ...callerHeaders,
  };

  // Only set Authorization if caller didn't explicitly set it (any case)
  const hasAuth = Object.keys(mergedHeaders).some((k) => k.toLowerCase() === 'authorization');
  if (token && !hasAuth) {
    mergedHeaders.Authorization = `Bearer ${token}`;
  }

  if (__DEV__) {
    const authPresent = Object.keys(mergedHeaders).some((k) => k.toLowerCase() === 'authorization');
    console.log('fetchJson', method, url, 'auth?', authPresent, 'hasBody?', hasBody);
  }

  const res = await fetch(url, {
    ...init,
    method,
    headers: mergedHeaders,
    body: normalizedBody as any,
    credentials: (init.credentials as any) ?? 'include',
  });

  let raw = '';
  try {
    raw = await res.text();
  } catch {
    raw = '';
  }

  const trimmed = raw.trim();
  let json: T | null = null;
  if (trimmed.length > 0) {
    try {
      json = JSON.parse(trimmed) as T;
    } catch (e) {
      console.log('fetchJson parse failed:', res.status, url, trimmed.slice(0, 300));
      json = null;
    }
  }

  return {
    ok: res.ok,
    status: res.status,
    json,
    raw,
  };
}

export type ApiLoginResponse = {
  ok: boolean;
  error?: string;

  email?: string;
  user_name?: string;
  role?: string;
  is_coach?: boolean;
  has_linked_athlete?: boolean;
  athlete_id?: number | null;
  token?: string;
};

// ------- LOGIN --------------------------------------------------------------
export async function loginRequest(email: string, password: string): Promise<ApiLoginResponse> {
  try {
    const r = await fetchJson<any>(`/auth/login-mobile`, {
      method: 'POST',
      body: JSON.stringify({ email, password }),
      credentials: 'include',
    });

    const json = r.json || ({} as any);
    console.log('Login OK raw:', json);

    if (!r.ok || !json.ok) {
      return {
        ok: false,
        error: json.error || `HTTP ${r.status}`,
      };
    }

    return {
      ok: true,
      ...json,
    };
  } catch (err) {
    console.error('Login error', err);
    return { ok: false, error: 'Network error' };
  }
}

export async function logoutRequest() {
  try {
    const r = await fetchJson<any>(`/auth/logout-mobile`, {
      method: 'POST',
      credentials: 'include',
    });

    return { ok: r.ok };
  } catch (e) {
    return { ok: false };
  }
}

// ------- ATHLETE DASHBOARD --------------------------------------------------
export async function getAthleteDashboard(): Promise<{
  ok: boolean;
  error?: string;
  athlete?: any;
  coach?: any;
  next_workout?: any;
  recent_workouts?: any[];
}> {
  try {
    const r = await fetchJson<any>(`/athletes/mobile/dashboard`, {
      method: 'GET',
      credentials: 'include',
    });

    const json = r.json || ({} as any);

    if (!r.ok || !json.ok) {
      console.log('Dashboard API not ok:', r.status, json || r.raw?.slice(0, 200));
      return {
        ok: false,
        error: json.error || `HTTP ${r.status}`,
      };
    }

    return {
      ok: true,
      athlete: json.athlete,
      coach: json.coach,
      next_workout: json.next_workout,
      recent_workouts: json.recent_workouts || [],
    };
  } catch (err) {
    console.error('Dashboard fetch error', err);
    return { ok: false, error: 'Network error' };
  }
}

export async function getAthleteWorkouts(): Promise<{
  ok: boolean;
  error?: string;
  athlete?: {
    id: number;
    name: string;
    user_id: number;
    coach_id: number | null;
  } | null;
  blocks?: { id: number; name: string }[];
  pending_map?: Record<string, any[]>;
  completed_map?: Record<string, any[]>;
  unassigned_pending?: any[];
  unassigned_completed?: any[];
}> {
  try {
    const r = await fetchJson<any>(`/workouts/my_list/mobile`, {
      method: 'GET',
      credentials: 'include',
    });

    const json = r.json || ({} as any);

    if (!r.ok || !json.ok) {
      console.log('Workouts API not ok:', r.status, json || r.raw?.slice(0, 200));
      return {
        ok: false,
        error: json.error || `HTTP ${r.status}`,
      };
    }

    return {
      ok: true,
      athlete: json.athlete || null,
      blocks: json.blocks || [],
      pending_map: json.pending_map || {},
      completed_map: json.completed_map || {},
      unassigned_pending: json.unassigned_pending || [],
      unassigned_completed: json.unassigned_completed || [],
    };
  } catch (err) {
    console.error('Workouts fetch error', err);
    return { ok: false, error: 'Network error' };
  }
}