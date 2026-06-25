// app/lib/api.ts

import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const MANUAL_TIMEZONE_KEY = 'athlete_manual_timezone';
const FALLBACK_TIMEZONE = 'America/Los_Angeles';
const FETCH_TIMEOUT_MS = 15000;

export function getDeviceTimezone(): string | null {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return tz && String(tz).trim() ? String(tz).trim() : null;
  } catch {
    return null;
  }
}

export async function getManualTimezonePreference(): Promise<string | null> {
  const tz = await SecureStore.getItemAsync(MANUAL_TIMEZONE_KEY);
  return tz && String(tz).trim() ? String(tz).trim() : null;
}

export async function setManualTimezonePreference(timezone: string | null) {
  const tz = timezone && String(timezone).trim();
  if (tz) {
    await SecureStore.setItemAsync(MANUAL_TIMEZONE_KEY, tz);
  } else {
    await SecureStore.deleteItemAsync(MANUAL_TIMEZONE_KEY);
  }
}

export async function getResolvedTimezone(): Promise<string> {
  return (await getManualTimezonePreference()) || getDeviceTimezone() || FALLBACK_TIMEZONE;
}

// API base URL
// - Dev default: local Flask backend for simulator/device development.
// - Android emulator reaches the host machine at 10.0.2.2, not 127.0.0.1.
// - Production/App Store builds must never resolve to localhost.
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

type FetchJsonResult<T> = {
  ok: boolean;
  status: number;
  json: T | null;
  raw: string;
};

type ApiFetchInit = RequestInit & {
  auth?: boolean;
  timeoutMs?: number;
};

function createTimeoutError(timeoutMs: number) {
  return new Error(`Request timed out after ${Math.round(timeoutMs / 1000)} seconds. Please try again.`);
}

export async function fetchJson<T = any>(
  path: string,
  init: ApiFetchInit = {}
): Promise<FetchJsonResult<T>> {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`;
  const { auth: authMode, timeoutMs = FETCH_TIMEOUT_MS, ...fetchInit } = init;

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

  if (hasBody && !hasContentType && !isFormData) {
    // If we normalized to JSON, or caller provided a string body but didn't set CT,
    // default to JSON because all our endpoints are JSON.
    defaultHeaders['Content-Type'] = 'application/json';
  }

  const mergedHeaders: Record<string, string> = {
    ...defaultHeaders,
    ...callerHeaders,
  };

  const hasTimezoneHeader = Object.keys(mergedHeaders).some(
    (k) => k.toLowerCase() === 'x-timezone' || k.toLowerCase() === 'x-time-zone'
  );
  if (!hasTimezoneHeader) {
    mergedHeaders['X-Timezone'] = await getResolvedTimezone();
  }

  // Only set Authorization if caller didn't explicitly set it (any case)
  const wantsAuth = authMode !== false;
  const hasAuth = Object.keys(mergedHeaders).some((k) => k.toLowerCase() === 'authorization');
  if (wantsAuth && token && !hasAuth) {
    mergedHeaders.Authorization = `Bearer ${token}`;
  }

  if (__DEV__) {
    const authPresent = Object.keys(mergedHeaders).some((k) => k.toLowerCase() === 'authorization');
    console.log(
      'fetchJson',
      method,
      url,
      'auth?',
      authPresent,
      'authMode?',
      wantsAuth ? 'auto' : 'off',
      'hasBody?',
      hasBody,
      'tz?',
      mergedHeaders['X-Timezone'] || mergedHeaders['X-Time-Zone'] || 'none'
    );
  }

  const controller = new AbortController();
  const callerSignal = fetchInit.signal;
  let didTimeout = false;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let removeCallerAbortListener: (() => void) | null = null;

  if (callerSignal) {
    if (callerSignal.aborted) {
      controller.abort();
    } else {
      const abortFromCaller = () => controller.abort();
      callerSignal.addEventListener('abort', abortFromCaller);
      removeCallerAbortListener = () => callerSignal.removeEventListener('abort', abortFromCaller);
    }
  }

  if (timeoutMs > 0) {
    timeoutId = setTimeout(() => {
      didTimeout = true;
      controller.abort();
    }, timeoutMs);
  }

  let res: Response;
  try {
    res = await fetch(url, {
      ...fetchInit,
      method,
      headers: mergedHeaders,
      body: normalizedBody as any,
      credentials: (init.credentials as any) ?? 'include',
      signal: controller.signal,
    });
  } catch (err: any) {
    if (didTimeout || err?.name === 'AbortError') {
      throw createTimeoutError(timeoutMs);
    }
    throw err;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
    if (removeCallerAbortListener) removeCallerAbortListener();
  }

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
    } catch {
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

export async function removeVideoAttachment(attachmentId: number): Promise<FetchJsonResult<any>> {
  return fetchJson(`/video-review/mobile/attachments/${attachmentId}`, {
    method: 'DELETE',
    auth: true,
  });
}

export async function getCoachVideoReviewInbox(): Promise<FetchJsonResult<any>> {
  return fetchJson('/video-review/mobile/coach/inbox', {
    method: 'GET',
    auth: true,
  });
}

export async function getCoachVideoReviewAttachment(attachmentId: number): Promise<FetchJsonResult<any>> {
  return fetchJson(`/video-review/mobile/coach/attachments/${attachmentId}`, {
    method: 'GET',
    auth: true,
  });
}

export async function getCoachVideoArchive(params?: {
  athlete_id?: string | number;
  q?: string;
  movement?: string;
  lift?: string;
  review_status?: string;
  video_angle?: string;
  set_type?: string;
  needs_followup?: string;
  has_feedback?: string;
  date_from?: string;
  date_to?: string;
  page?: string | number;
  per_page?: string | number;
}): Promise<FetchJsonResult<any>> {
  const query = new URLSearchParams();
  Object.entries(params || {}).forEach(([key, value]) => {
    const trimmed = String(value || '').trim();
    if (trimmed) query.set(key, trimmed);
  });
  const suffix = query.toString() ? `?${query.toString()}` : '';
  return fetchJson(`/video-review/mobile/coach/archive${suffix}`, {
    method: 'GET',
    auth: true,
  });
}

export async function getAthleteCoachReviews(): Promise<FetchJsonResult<any>> {
  return fetchJson('/video-review/mobile/athlete/reviews', {
    method: 'GET',
    auth: true,
  });
}

export async function getAthleteVideoArchive(params?: {
  movement?: string;
  lift?: string;
  review_status?: string;
  video_angle?: string;
  set_type?: string;
  needs_followup?: string;
  date_from?: string;
  date_to?: string;
}): Promise<FetchJsonResult<any>> {
  const query = new URLSearchParams();
  Object.entries(params || {}).forEach(([key, value]) => {
    const trimmed = String(value || '').trim();
    if (trimmed) query.set(key, trimmed);
  });
  const suffix = query.toString() ? `?${query.toString()}` : '';
  return fetchJson(`/video-review/mobile/athlete/archive${suffix}`, {
    method: 'GET',
    auth: true,
  });
}

export type SetVideoExportOptions = {
  show_date?: boolean;
  show_movement?: boolean;
  show_logged_set?: boolean;
  show_logged_weight?: boolean;
  show_logged_reps?: boolean;
  show_logged_rpe?: boolean;
  weight_unit?: 'kg' | 'lbs';
  show_bodyweight?: boolean;
  show_coach_feedback?: boolean;
  show_planned_prescription?: boolean;
  show_review_tags?: boolean;
  show_video_angle?: boolean;
  show_review_status?: boolean;
};

export async function prepareSetVideoExport(
  attachmentId: number,
  options?: SetVideoExportOptions,
  clip?: { start_seconds: number; end_seconds?: number; duration_seconds?: number }
): Promise<FetchJsonResult<any>> {
  return fetchJson(`/video-review/mobile/athlete/attachments/${attachmentId}/export`, {
    method: 'POST',
    auth: true,
    body: {
      options: options || {},
      start_seconds: clip?.start_seconds,
      end_seconds: clip?.end_seconds,
      duration_seconds: clip?.duration_seconds,
    } as any,
  });
}

export async function getSetVideoDownloadExportsStatus(
  attachmentId: number
): Promise<FetchJsonResult<any>> {
  return fetchJson(`/video-review/mobile/athlete/attachments/${attachmentId}/exports/status`, {
    method: 'GET',
    auth: true,
  });
}

export async function getSetVideoExportStatus(
  exportId: number
): Promise<FetchJsonResult<any>> {
  return fetchJson(`/video-review/mobile/athlete/exports/${exportId}`, {
    method: 'GET',
    auth: true,
  });
}

export type PendingCoachInvite = {
  id: number;
  coach_id: number;
  coach_name?: string | null;
  coach_email?: string | null;
  athlete_first?: string | null;
  athlete_last?: string | null;
  athlete_email?: string | null;
  status?: string | null;
};

export async function getPendingCoachInvites(): Promise<FetchJsonResult<{
  ok: boolean;
  already_linked: boolean;
  coach?: { id: number; name?: string | null; email?: string | null } | null;
  athlete?: { id: number; name?: string | null; coach_id?: number | null } | null;
  pending_invites: PendingCoachInvite[];
  error?: string;
}>> {
  return fetchJson('/auth/link-coach/mobile', {
    method: 'GET',
    auth: true,
  });
}

export async function acceptPendingCoachInvite(inviteId: number): Promise<FetchJsonResult<any>> {
  return fetchJson(`/auth/link-coach/mobile/accept/${inviteId}`, {
    method: 'POST',
    auth: true,
    body: {} as any,
  });
}

export async function declinePendingCoachInvite(inviteId: number): Promise<FetchJsonResult<{
  ok: boolean;
  declined?: boolean;
  invite_id?: number;
  error?: string;
}>> {
  return fetchJson(`/auth/link-coach/mobile/deny/${inviteId}`, {
    method: 'POST',
    auth: true,
    body: {} as any,
  });
}

export type ApiLoginResponse = {
  ok: boolean;
  error?: string;
  needs_account_setup?: boolean;

  email?: string;
  email_verified?: boolean;
  verification_required?: boolean;
  verification_url?: string | null;
  provider?: 'google' | 'apple' | string;
  user_name?: string;
  role?: string;
  is_coach?: boolean;
  workspace_mode?: 'team' | 'individual';
  is_individual_workspace?: boolean;
  is_self_coached?: boolean;
  self_athlete_id?: number | null;
  has_linked_athlete?: boolean;
  athlete_id?: number | null;
  token?: string;
  billing_required?: boolean;
  billing_url?: string;
};

// ------- LOGIN --------------------------------------------------------------
export async function loginRequest(email: string, password: string): Promise<ApiLoginResponse> {
  try {
    const r = await fetchJson<any>(`/auth/login-mobile`, {
      method: 'POST',
      auth: false,
      body: JSON.stringify({ email, password }),
      credentials: 'include',
    });

    const json = r.json || ({} as any);
    console.log('Login OK raw:', json);

    if (!r.ok || !json.ok) {
      console.warn('Login response not ok:', r.status, json || r.raw?.slice(0, 300));
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
    return { ok: false, error: (err as any)?.message || 'Network error' };
  }
}

export async function registerMobileRequest(options: {
  first_name: string;
  last_name: string;
  email: string;
  password: string;
  confirm_password: string;
  role: 'coach' | 'athlete' | 'self_coach';
  access_code?: string;
}): Promise<ApiLoginResponse> {
  try {
    const r = await fetchJson<any>(`/auth/register-mobile`, {
      method: 'POST',
      auth: false,
      body: options as any,
      credentials: 'include',
    });

    const json = r.json || ({} as any);
    if (!r.ok || !json.ok) {
      return {
        ok: false,
        ...json,
        error: json.error || `HTTP ${r.status}`,
      };
    }

    return {
      ok: true,
      ...json,
    };
  } catch (err) {
    console.error('Mobile register error', err);
    return { ok: false, error: (err as any)?.message || 'Network error' };
  }
}

export async function mobileOAuthRequest(
  provider: 'google' | 'apple',
  idToken: string,
  options: {
    role?: 'coach' | 'athlete' | 'self_coach';
    access_code?: string;
    first_name?: string;
    last_name?: string;
    nonce?: string;
  } = {}
): Promise<ApiLoginResponse> {
  try {
    const r = await fetchJson<any>(`/auth/mobile/oauth/${provider}`, {
      method: 'POST',
      auth: false,
      body: {
        id_token: idToken,
        identity_token: idToken,
        ...options,
      } as any,
      credentials: 'include',
    });

    const json = r.json || ({} as any);
    if (!r.ok || !json.ok) {
      return {
        ok: false,
        ...json,
        error: json.error || `HTTP ${r.status}`,
      };
    }

    return {
      ok: true,
      ...json,
    };
  } catch (err) {
    console.error('Mobile OAuth error', err);
    return { ok: false, error: (err as any)?.message || 'Network error' };
  }
}

export async function logoutRequest() {
  try {
    const r = await fetchJson<any>(`/auth/logout-mobile`, {
      method: 'POST',
      auth: false,
      credentials: 'include',
    });

    return { ok: r.ok };
  } catch {
    return { ok: false };
  }
}

export async function deleteAccountRequest(confirmEmail: string): Promise<{
  ok: boolean;
  error?: string;
}> {
  try {
    const r = await fetchJson<any>(`/auth/account/delete-mobile`, {
      method: 'POST',
      auth: true,
      body: { confirm: confirmEmail } as any,
      credentials: 'include',
    });

    const json = r.json || ({} as any);
    if (!r.ok || !json.ok) {
      return {
        ok: false,
        error: json.error || `HTTP ${r.status}`,
      };
    }

    return { ok: true };
  } catch (err) {
    console.error('Delete account error', err);
    return { ok: false, error: 'Network error' };
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

export type CreateIndividualProgramBlock = {
  id?: number | null;
  name: string;
  weeks: number;
  focus?: string;
};

export type CreateIndividualProgramPayload = {
  name: string;
  program_type: string;
  start_date: string;
  end_date: string;
  meet_date?: string | null;
  blocks: CreateIndividualProgramBlock[];
};

export async function createIndividualProgram(payload: CreateIndividualProgramPayload): Promise<{
  ok: boolean;
  error?: string;
  program?: any;
  blocks?: any[];
}> {
  try {
    const r = await fetchJson<any>('/mobile/individual/programs', {
      method: 'POST',
      body: payload as any,
    });

    const json = r.json || ({} as any);
    if (!r.ok || !json.ok) {
      return {
        ok: false,
        error: json.error || `HTTP ${r.status}`,
      };
    }

    return {
      ok: true,
      program: json.program,
      blocks: json.blocks || [],
    };
  } catch (err) {
    console.error('Create individual program error', err);
    return { ok: false, error: 'Network error' };
  }
}

export async function getIndividualProgram(programId: number | string): Promise<{
  ok: boolean;
  error?: string;
  program?: any;
  blocks?: any[];
}> {
  try {
    const r = await fetchJson<any>(`/mobile/individual/programs/${programId}`, {
      method: 'GET',
    });

    const json = r.json || ({} as any);
    if (!r.ok || !json.ok) {
      return {
        ok: false,
        error: json.error || `HTTP ${r.status}`,
      };
    }

    return {
      ok: true,
      program: json.program,
      blocks: json.blocks || [],
    };
  } catch (err) {
    console.error('Get individual program error', err);
    return { ok: false, error: 'Network error' };
  }
}

export async function updateIndividualProgram(
  programId: number | string,
  payload: CreateIndividualProgramPayload
): Promise<{
  ok: boolean;
  error?: string;
  program?: any;
  blocks?: any[];
}> {
  try {
    const r = await fetchJson<any>(`/mobile/individual/programs/${programId}`, {
      method: 'PATCH',
      body: payload as any,
    });

    const json = r.json || ({} as any);
    if (!r.ok || !json.ok) {
      return {
        ok: false,
        error: json.error || `HTTP ${r.status}`,
      };
    }

    return {
      ok: true,
      program: json.program,
      blocks: json.blocks || [],
    };
  } catch (err) {
    console.error('Update individual program error', err);
    return { ok: false, error: 'Network error' };
  }
}

// ------- CHECK-INS ----------------------------------------------------------
export type MobileCheckInQuestion = {
  id: number;
  prompt: string;
  question_type:
    | 'short_text'
    | 'long_text'
    | 'number'
    | 'scale'
    | 'single_choice'
    | 'multi_choice'
    | 'yes_no'
    | 'date'
    | string;
  required: boolean;
  position: number;
  options: string[];
  config: Record<string, any>;
};

export type MobileCheckInSummary = {
  id: number;
  assignment_id: number;
  form_id: number;
  title: string;
  description?: string | null;
  due_at?: string | null;
  submitted_at?: string | null;
  status: 'due' | 'late' | 'submitted' | string;
  is_late?: boolean;
  reviewed_at?: string | null;
};

export type MobileCheckInDetail = MobileCheckInSummary & {
  form?: {
    id: number;
    title: string;
    description?: string | null;
    active: boolean;
    questions: MobileCheckInQuestion[];
  } | null;
  answers?: { question_id: number; value: any; display_value?: string | null }[];
};

export async function getDueCheckIns(): Promise<FetchJsonResult<{
  ok: boolean;
  error?: string;
  athlete?: { id: number; name: string };
  due_check_ins?: MobileCheckInSummary[];
  recent_submissions?: MobileCheckInSummary[];
}>> {
  return fetchJson('/check-ins/mobile/due', {
    method: 'GET',
    auth: true,
  });
}

export async function getCheckInDetail(submissionId: number): Promise<FetchJsonResult<{
  ok: boolean;
  error?: string;
  submission?: MobileCheckInDetail;
}>> {
  return fetchJson(`/check-ins/mobile/submissions/${submissionId}`, {
    method: 'GET',
    auth: true,
  });
}

export async function submitCheckInAnswers(
  submissionId: number,
  answers: Record<string | number, any>
): Promise<FetchJsonResult<{
  ok: boolean;
  error?: string;
  missing?: { question_id: number; prompt: string }[];
  submission?: MobileCheckInDetail;
}>> {
  return fetchJson(`/check-ins/mobile/submissions/${submissionId}/submit`, {
    method: 'POST',
    auth: true,
    body: { answers } as any,
  });
}
// ------- MESSAGING ----------------------------------------------------------
export type MessengerAttachment = {
  id?: number;
  filename?: string | null;
  mime_type?: string | null;
  size_bytes?: number | null;
};

export type MessengerMessage = {
  id: number | string;
  temp_id?: string;
  thread_id: number;
  sender_id?: number | null;
  sender_name?: string | null;
  sender_role?: string | null;
  body?: string | null;
  message_type?: string | null;
  video_review_id?: number | null;
  video_id?: number | null;
  session_review_id?: number | null;
  athlete_id?: number | null;
  workout_id?: number | null;
  set_log_id?: number | null;
  session_date?: string | null;
  session_title?: string | null;
  metadata?: {
    video_review_id?: number | null;
    video_id?: number | null;
    session_review_id?: number | null;
    athlete_id?: number | null;
    workout_id?: number | null;
    set_log_id?: number | null;
    session_date?: string | null;
    session_title?: string | null;
  } | null;
  attachment?: MessengerAttachment | null;
  attachments?: MessengerAttachment[];
  created_at?: string | null;
  edited_at?: string | null;
  deleted_at?: string | null;
  is_mine?: boolean;
  pending?: boolean;
  failed?: boolean;
};

export type MessengerThread = {
  id: number;
  coach_id?: number | null;
  coach_name?: string | null;
  coach_avatar_url?: string | null;
  athlete_id?: number | null;
  athlete_name?: string | null;
  athlete_avatar_url?: string | null;
  other_user_name?: string | null;
  other_user_avatar_url?: string | null;
  avatar_url?: string | null;
  status?: string | null;
  last_message_at?: string | null;
  unread_count?: number;
  last_message?: MessengerMessage | null;
};

export type CoachAnnouncement = {
  id: number;
  coach_id?: number | null;
  source?: string | null;
  source_label?: string | null;
  source_type?: string | null;
  source_badge?: string | null;
  message_type?: string | null;
  target_audience?: string | null;
  title: string;
  body: string;
  category?: string | null;
  priority?: string | null;
  link_label?: string | null;
  link_url?: string | null;
  pinned?: boolean;
  expires_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  read_at?: string | null;
  read_count?: number | null;
  audience_count?: number | null;
};

export type CoachRosterAthlete = {
  id: number;
  name: string;
  avatar_url?: string | null;
  is_self?: boolean;
  last_session_primary?: string | null;
  programmed_primary?: string | null;
  status_label?: string | null;
};

export type MessengerUnreadSummary = {
  unread_messages: number;
  unread_announcements: number;
  has_unread: boolean;
};

export type AttachmentUploadUrl = {
  attachment_id: number;
  attachment?: MessengerAttachment;
  provider: string;
  upload_url: string;
  headers: Record<string, string>;
};

export async function getCoachRoster(): Promise<{
  ok: boolean;
  error?: string;
  athletes?: CoachRosterAthlete[];
}> {
  try {
    const r = await fetchJson<any>(`/coach/mobile/roster`, {
      method: 'GET',
      credentials: 'include',
    });

    const json = r.json || ({} as any);

    if (!r.ok || !json.ok) {
      console.log('Coach roster API not ok:', r.status, json || r.raw?.slice(0, 200));
      return { ok: false, error: json.error || `HTTP ${r.status}` };
    }

    return { ok: true, athletes: json.athletes || [] };
  } catch (err) {
    console.error('Coach roster fetch error', err);
    return { ok: false, error: 'Network error' };
  }
}

export async function getUnreadSummary(activeThreadId?: number | string | null): Promise<{
  ok: boolean;
  error?: string;
  summary?: MessengerUnreadSummary;
}> {
  try {
    const params = new URLSearchParams();
    if (activeThreadId) params.set('active_thread_id', String(activeThreadId));

    const qs = params.toString();
    const r = await fetchJson<any>(`/messenger/mobile/unread-summary${qs ? `?${qs}` : ''}`, {
      method: 'GET',
      credentials: 'include',
    });

    const json = r.json || ({} as any);

    if (!r.ok || !json.ok) {
      console.log('Unread summary API not ok:', r.status, json || r.raw?.slice(0, 200));
      return { ok: false, error: json.error || `HTTP ${r.status}` };
    }

    return {
      ok: true,
      summary: {
        unread_messages: Number(json.unread_messages || 0),
        unread_announcements: Number(json.unread_announcements || 0),
        has_unread: !!json.has_unread,
      },
    };
  } catch (err) {
    console.error('Unread summary fetch error', err);
    return { ok: false, error: 'Network error' };
  }
}

export async function registerPushToken(
  expoPushToken: string,
  platform: string
): Promise<{
  ok: boolean;
  error?: string;
}> {
  try {
    const r = await fetchJson<any>(`/messenger/mobile/push-token`, {
      method: 'POST',
      credentials: 'include',
      body: JSON.stringify({
        expo_push_token: expoPushToken,
        platform,
      }),
    });

    const json = r.json || ({} as any);

    if (!r.ok || !json.ok) {
      const detail = json?.error || json?.message || r.raw?.slice(0, 200) || `HTTP ${r.status}`;
      console.warn('Push token registration API not ok:', r.status, detail);
      return { ok: false, error: detail };
    }

    return { ok: true };
  } catch (err) {
    console.warn('Push token registration network error', err);
    return { ok: false, error: 'Network error' };
  }
}

export async function getMessengerThreads(): Promise<{
  ok: boolean;
  error?: string;
  threads?: MessengerThread[];
}> {
  try {
    const r = await fetchJson<any>(`/messenger/mobile/threads`, {
      method: 'GET',
      credentials: 'include',
    });

    const json = r.json || ({} as any);

    if (!r.ok || !json.ok) {
      console.log('Messenger threads API not ok:', r.status, json || r.raw?.slice(0, 200));
      return { ok: false, error: json.error || `HTTP ${r.status}` };
    }

    return { ok: true, threads: json.threads || [] };
  } catch (err) {
    console.error('Messenger threads fetch error', err);
    return { ok: false, error: 'Network error' };
  }
}

export async function getThreadMessages(
  threadId: number,
  opts: { limit?: number; beforeId?: number } = {}
): Promise<{
  ok: boolean;
  error?: string;
  thread?: MessengerThread | null;
  messages?: MessengerMessage[];
}> {
  try {
    const params = new URLSearchParams();
    if (opts.limit) params.set('limit', String(opts.limit));
    if (opts.beforeId) params.set('before_id', String(opts.beforeId));

    const qs = params.toString();
    const r = await fetchJson<any>(`/messenger/mobile/threads/${threadId}/messages${qs ? `?${qs}` : ''}`, {
      method: 'GET',
      credentials: 'include',
    });

    const json = r.json || ({} as any);

    if (!r.ok || !json.ok) {
      console.log('Thread messages API not ok:', r.status, json || r.raw?.slice(0, 200));
      return { ok: false, error: json.error || `HTTP ${r.status}` };
    }

    return {
      ok: true,
      thread: json.thread || null,
      messages: json.messages || [],
    };
  } catch (err) {
    console.error('Thread messages fetch error', err);
    return { ok: false, error: 'Network error' };
  }
}

export async function sendThreadMessage(
  threadId: number,
  body: string,
  opts: { attachmentIds?: number[] } = {}
): Promise<{
  ok: boolean;
  error?: string;
  thread?: MessengerThread | null;
  message?: MessengerMessage | null;
}> {
  try {
    const r = await fetchJson<any>(`/messenger/mobile/threads/${threadId}/messages`, {
      method: 'POST',
      credentials: 'include',
      body: JSON.stringify({
        body,
        ...(opts.attachmentIds?.length ? { attachment_ids: opts.attachmentIds } : {}),
      }),
    });

    const json = r.json || ({} as any);

    if (!r.ok || !json.ok) {
      console.log('Send message API not ok:', r.status, json || r.raw?.slice(0, 200));
      return { ok: false, error: json.error || `HTTP ${r.status}` };
    }

    return {
      ok: true,
      thread: json.thread || null,
      message: json.message || null,
    };
  } catch (err) {
    console.error('Send message error', err);
    return { ok: false, error: 'Network error' };
  }
}

export async function requestAttachmentUploadUrl(input: {
  threadId: number;
  filename: string;
  mimeType: string;
  sizeBytes: number;
}): Promise<{
  ok: boolean;
  error?: string;
  upload?: AttachmentUploadUrl;
}> {
  try {
    const r = await fetchJson<any>(`/messenger/mobile/attachments/upload-url`, {
      method: 'POST',
      credentials: 'include',
      body: JSON.stringify({
        thread_id: input.threadId,
        filename: input.filename,
        mime_type: input.mimeType,
        size_bytes: input.sizeBytes,
      }),
    });

    const json = r.json || ({} as any);

    if (!r.ok || !json.ok) {
      console.log('Attachment upload URL API not ok:', r.status, json || r.raw?.slice(0, 200));
      return { ok: false, error: json.error || `HTTP ${r.status}` };
    }

    return {
      ok: true,
      upload: {
        attachment_id: Number(json.attachment_id),
        attachment: json.attachment || undefined,
        provider: json.provider,
        upload_url: json.upload_url,
        headers: json.headers || {},
      },
    };
  } catch (err) {
    console.error('Attachment upload URL error', err);
    return { ok: false, error: 'Network error' };
  }
}

export async function completeAttachmentUpload(
  attachmentId: number,
  messageId: number | string
): Promise<{
  ok: boolean;
  error?: string;
  attachment?: MessengerAttachment;
  message?: MessengerMessage | null;
}> {
  try {
    const r = await fetchJson<any>(`/messenger/mobile/attachments/${attachmentId}/complete`, {
      method: 'POST',
      credentials: 'include',
      body: JSON.stringify({ message_id: messageId }),
    });

    const json = r.json || ({} as any);

    if (!r.ok || !json.ok) {
      console.log('Complete attachment API not ok:', r.status, json || r.raw?.slice(0, 200));
      return { ok: false, error: json.error || `HTTP ${r.status}` };
    }

    return {
      ok: true,
      attachment: json.attachment || undefined,
      message: json.message || null,
    };
  } catch (err) {
    console.error('Complete attachment error', err);
    return { ok: false, error: 'Network error' };
  }
}

export async function getAttachmentDownloadUrl(attachmentId: number): Promise<{
  ok: boolean;
  error?: string;
  download_url?: string;
  filename?: string | null;
  mime_type?: string | null;
  size_bytes?: number | null;
}> {
  try {
    const r = await fetchJson<any>(`/messenger/mobile/attachments/${attachmentId}/download-url`, {
      method: 'GET',
      credentials: 'include',
    });

    const json = r.json || ({} as any);

    if (!r.ok || !json.ok) {
      console.log('Attachment download URL API not ok:', r.status, json || r.raw?.slice(0, 200));
      return { ok: false, error: json.error || `HTTP ${r.status}` };
    }

    return {
      ok: true,
      download_url: json.download_url || '',
      filename: json.filename || null,
      mime_type: json.mime_type || null,
      size_bytes: json.size_bytes ?? null,
    };
  } catch (err) {
    console.error('Attachment download URL error', err);
    return { ok: false, error: 'Network error' };
  }
}

export async function markThreadRead(threadId: number): Promise<{
  ok: boolean;
  error?: string;
  marked_read?: number;
  thread?: MessengerThread | null;
}> {
  try {
    const r = await fetchJson<any>(`/messenger/mobile/threads/${threadId}/read`, {
      method: 'POST',
      credentials: 'include',
    });

    const json = r.json || ({} as any);

    if (!r.ok || !json.ok) {
      console.log('Mark thread read API not ok:', r.status, json || r.raw?.slice(0, 200));
      return { ok: false, error: json.error || `HTTP ${r.status}` };
    }

    return {
      ok: true,
      marked_read: json.marked_read || 0,
      thread: json.thread || null,
    };
  } catch (err) {
    console.error('Mark thread read error', err);
    return { ok: false, error: 'Network error' };
  }
}

export async function getAnnouncements(): Promise<{
  ok: boolean;
  error?: string;
  announcements?: CoachAnnouncement[];
}> {
  try {
    const r = await fetchJson<any>(`/messenger/mobile/announcements`, {
      method: 'GET',
      credentials: 'include',
    });

    const json = r.json || ({} as any);

    if (!r.ok || !json.ok) {
      console.log('Announcements API not ok:', r.status, json || r.raw?.slice(0, 200));
      return { ok: false, error: json.error || `HTTP ${r.status}` };
    }

    return { ok: true, announcements: json.announcements || [] };
  } catch (err) {
    console.error('Announcements fetch error', err);
    return { ok: false, error: 'Network error' };
  }
}

export async function createAnnouncement(input: {
  title: string;
  body: string;
  pinned?: boolean;
}): Promise<{
  ok: boolean;
  error?: string;
  announcement?: CoachAnnouncement | null;
}> {
  try {
    const r = await fetchJson<any>(`/messenger/mobile/announcements`, {
      method: 'POST',
      credentials: 'include',
      body: JSON.stringify(input),
    });

    const json = r.json || ({} as any);

    if (!r.ok || !json.ok) {
      console.log('Create announcement API not ok:', r.status, json || r.raw?.slice(0, 200));
      return { ok: false, error: json.error || `HTTP ${r.status}` };
    }

    return { ok: true, announcement: json.announcement || null };
  } catch (err) {
    console.error('Create announcement error', err);
    return { ok: false, error: 'Network error' };
  }
}

export async function updateAnnouncement(
  announcementId: number,
  input: { title: string; body: string; pinned?: boolean }
): Promise<{
  ok: boolean;
  error?: string;
  announcement?: CoachAnnouncement | null;
}> {
  try {
    const r = await fetchJson<any>(`/messenger/mobile/announcements/${announcementId}/edit`, {
      method: 'POST',
      credentials: 'include',
      body: JSON.stringify(input),
    });

    const json = r.json || ({} as any);

    if (!r.ok || !json.ok) {
      console.log('Update announcement API not ok:', r.status, json || r.raw?.slice(0, 200));
      return { ok: false, error: json.error || `HTTP ${r.status}` };
    }

    return { ok: true, announcement: json.announcement || null };
  } catch (err) {
    console.error('Update announcement error', err);
    return { ok: false, error: 'Network error' };
  }
}

export async function setAnnouncementPinned(
  announcementId: number,
  pinned: boolean
): Promise<{
  ok: boolean;
  error?: string;
  announcement?: CoachAnnouncement | null;
}> {
  try {
    const r = await fetchJson<any>(`/messenger/mobile/announcements/${announcementId}/pin`, {
      method: 'POST',
      credentials: 'include',
      body: JSON.stringify({ pinned }),
    });

    const json = r.json || ({} as any);

    if (!r.ok || !json.ok) {
      console.log('Pin announcement API not ok:', r.status, json || r.raw?.slice(0, 200));
      return { ok: false, error: json.error || `HTTP ${r.status}` };
    }

    return { ok: true, announcement: json.announcement || null };
  } catch (err) {
    console.error('Pin announcement error', err);
    return { ok: false, error: 'Network error' };
  }
}

export async function deleteAnnouncement(announcementId: number): Promise<{
  ok: boolean;
  error?: string;
}> {
  try {
    const r = await fetchJson<any>(`/messenger/mobile/announcements/${announcementId}/delete`, {
      method: 'POST',
      credentials: 'include',
    });

    const json = r.json || ({} as any);

    if (!r.ok || !json.ok) {
      console.log('Delete announcement API not ok:', r.status, json || r.raw?.slice(0, 200));
      return { ok: false, error: json.error || `HTTP ${r.status}` };
    }

    return { ok: true };
  } catch (err) {
    console.error('Delete announcement error', err);
    return { ok: false, error: 'Network error' };
  }
}

export async function markAnnouncementRead(announcementId: number): Promise<{
  ok: boolean;
  error?: string;
  announcement?: CoachAnnouncement | null;
}> {
  try {
    const r = await fetchJson<any>(`/messenger/mobile/announcements/${announcementId}/read`, {
      method: 'POST',
      credentials: 'include',
    });

    const json = r.json || ({} as any);

    if (!r.ok || !json.ok) {
      console.log('Mark announcement read API not ok:', r.status, json || r.raw?.slice(0, 200));
      return { ok: false, error: json.error || `HTTP ${r.status}` };
    }

    return { ok: true, announcement: json.announcement || null };
  } catch (err) {
    console.error('Mark announcement read error', err);
    return { ok: false, error: 'Network error' };
  }
}
