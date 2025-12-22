// app/lib/api.ts
import { Platform } from 'react-native';

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

  const res = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
    // Mobile is using Flask session cookies in prod
    credentials: init.credentials ?? 'include',
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