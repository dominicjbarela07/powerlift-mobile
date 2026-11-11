export type OnboardingDraft = {
  email: string; firstName: string; lastName: string;
  role: 'athlete' | 'coach' | 'self_coach'; mode: 'login' | 'signup'; step: 'choose' | 'details';
};
type Store = { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<void>; removeItem(key: string): Promise<void> };
const KEY = 'strength-ledger:onboarding-draft:v1';
let writes = Promise.resolve();

/** Persist an explicit allowlist. Passwords, codes and tokens never enter this draft. */
export function normalizeOnboardingDraft(value: Partial<OnboardingDraft>): OnboardingDraft {
  return { email: String(value.email ?? '').slice(0, 120), firstName: String(value.firstName ?? '').slice(0, 100),
    lastName: String(value.lastName ?? '').slice(0, 100), role: value.role === 'athlete' || value.role === 'coach' ? value.role : 'self_coach',
    mode: value.mode === 'login' ? 'login' : 'signup', step: value.step === 'details' ? 'details' : 'choose' };
}
export async function readOnboardingDraft(store: Store): Promise<OnboardingDraft | null> {
  try { const raw = await store.getItem(KEY); return raw ? normalizeOnboardingDraft(JSON.parse(raw)) : null; }
  catch { return null; }
}
export function writeOnboardingDraft(store: Store, draft: OnboardingDraft | null) {
  const value = draft && JSON.stringify(normalizeOnboardingDraft(draft));
  writes = writes.catch(() => undefined).then(() => value ? store.setItem(KEY, value) : store.removeItem(KEY));
  return writes;
}
