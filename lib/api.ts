// app/lib/api.ts
import { Platform } from 'react-native';

// API base URL
// - Prod default: Render
// - Optional override for dev via Expo env: EXPO_PUBLIC_API_BASE
export const API_BASE = (
  (process.env.EXPO_PUBLIC_API_BASE as string | undefined) ||
  'https://strength-coach-ui.onrender.com'
).replace(/\/$/, '');

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
    const res = await fetch(`${API_BASE}/auth/login-mobile`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include', // so Flask session cookie is stored
      body: JSON.stringify({ email, password }),
    });

    const json = await res.json().catch(() => ({} as any));
    console.log('Login OK raw:', json);

    if (!res.ok || !json.ok) {
      return {
        ok: false,
        error: json.error || `HTTP ${res.status}`,
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
    const res = await fetch(`${API_BASE}/auth/logout-mobile`, {
      method: 'POST',
      credentials: 'include',   // clears session cookie
    });

    return { ok: res.ok };
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
    const res = await fetch(`${API_BASE}/athletes/mobile/dashboard`, {
      method: 'GET',
      credentials: 'include', // send session cookie
    });

    const json = await res.json().catch(() => ({} as any));

    if (!res.ok || !json.ok) {
      console.log('Dashboard API not ok:', res.status, json);
      return {
        ok: false,
        error: json.error || `HTTP ${res.status}`,
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
    // Must match: @workouts_bp.get("/my_list/mobile")
    const res = await fetch(`${API_BASE}/workouts/my_list/mobile`, {
      method: 'GET',
      credentials: 'include',
    });

    const json = await res.json().catch(() => ({} as any));

    if (!res.ok || !json.ok) {
      console.log('Workouts API not ok:', res.status, json);
      return {
        ok: false,
        error: json.error || `HTTP ${res.status}`,
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