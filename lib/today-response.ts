export type TodayResponseClassification<T> =
  | { kind: 'success'; today: T }
  | { kind: 'unauthorized'; message: string }
  | { kind: 'account-state-block'; payload: any }
  | { kind: 'api-error'; message: string; status: number }
  | { kind: 'invalid'; message: string };

export function classifyTodayResponse<T>(
  response: { ok?: boolean; status?: number; json?: any } | null | undefined,
  isAccountStateBlock: (payload: any) => boolean,
): TodayResponseClassification<T> {
  const status = Number(response?.status || 0);
  const payload = response?.json;
  if (response?.ok !== true || payload?.ok !== true) {
    if (isAccountStateBlock(payload)) return { kind: 'account-state-block', payload };
    if (status === 401) return { kind: 'unauthorized', message: 'Your session expired. Please sign in again.' };
    return {
      kind: 'api-error',
      message: String(payload?.error || payload?.message || `Today could not refresh (${status || 'unknown'}).`),
      status,
    };
  }
  if (!payload.today) return { kind: 'invalid', message: 'Today is not available yet.' };
  return { kind: 'success', today: payload.today as T };
}
