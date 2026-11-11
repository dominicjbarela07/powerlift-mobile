export type RecoveryStep = 'signup' | 'verify' | 'checkout' | 'confirm' | 'invite' | 'login' | 'session' | 'plan' | 'media' | 'history' | 'account';
export type SupportReceipt = { reference: string; request_id: string; saved: true; notification_status: string };
export type SupportPayload = { request_id: string; step: RecoveryStep; email: string; details: string; error_code: string; app_version: string };
type Draft = { version: 1; owner: string; step: RecoveryStep; email: string; details: string; pending?: SupportPayload; receipt?: SupportReceipt };
type Store = { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<void> };

/** Redact credential, payment and code patterns before persisting or sending. */
export function safeSupportDetails(value: string): string {
  return value.slice(0, 1500).replace(/\0/g, '')
    .replace(/bearer\s+\S+|(?:sk|rk)_(?:live|test)_\S+|whsec_\S+|eyJ[\w.-]{20,}/gi, '[redacted]')
    .replace(/\b(password|token|secret|authorization)\s*[:=]\s*\S+/gi, '$1 [redacted]')
    .replace(/\b(password|secret|token)\s+(?:is\s+)?\S+/gi, '$1 [redacted]')
    .replace(/(?<!\d)(?:\d[ -]?){13,19}(?!\d)/g, '[payment number removed]')
    .replace(/(?<!\d)\d{6}(?!\d)/g, '[code removed]')
    .replace(/https?:\/\/\S+/gi, '[link omitted]').trim();
}

export const validSupportEmail = (value: string) => value.length <= 120 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
export function supportReceipt(value: unknown): SupportReceipt | null {
  const receipt = value as Partial<SupportReceipt> | null;
  return receipt?.saved === true && typeof receipt.reference === 'string' && /^SL-[A-F0-9]{8}$/.test(receipt.reference)
    && typeof receipt.request_id === 'string' && typeof receipt.notification_status === 'string' ? receipt as SupportReceipt : null;
}

/** One immutable pending request survives uncertain responses and process restart. */
export function createSupportJournal(store: Store, owner: string, step: RecoveryStep) {
  const key = `strength-ledger:support:v2:${owner}:${step}`;
  let state: Draft = { version: 1, owner, step, email: '', details: '' };
  let writes = Promise.resolve();
  let durable = true;
  const ready = store.getItem(key).then(raw => {
    if (!raw) return;
    try {
      const saved = JSON.parse(raw);
      if (saved.version !== 1 || saved.owner !== owner || saved.step !== step) return;
      state.email = typeof saved.email === 'string' ? saved.email.slice(0, 120) : '';
      state.details = safeSupportDetails(String(saved.details ?? ''));
      const pending = saved.pending;
      if (pending?.step === step && typeof pending.request_id === 'string' && /^[a-f0-9-]{36}$/i.test(pending.request_id)
        && validSupportEmail(String(pending.email ?? ''))) {
        state.pending = { request_id: pending.request_id, step, email: pending.email,
          details: safeSupportDetails(String(pending.details ?? '')), error_code: String(pending.error_code ?? 'unknown').slice(0, 40),
          app_version: String(pending.app_version ?? '').replace(/[^A-Za-z0-9 ._-]/g, '').slice(0, 40) };
      }
      state.receipt = supportReceipt(saved.receipt) ?? undefined;
    } catch { /* Corrupt drafts cannot impersonate a request. */ }
  }).catch(() => { durable = false; });
  const update = async (change: (previous: Draft) => Draft) => {
    await ready;
    state = change(state);
    const snapshot = JSON.stringify(state);
    const next = writes.then(() => store.setItem(key, snapshot)).then(() => { durable = true; }).catch(() => { durable = false; });
    writes = next;
    await next;
    return state;
  };
  return {
    ready, snapshot: () => state, isDurable: () => durable,
    input: (email: string, details: string) => update(previous => previous.pending || previous.receipt ? previous :
      { ...previous, email: email.slice(0, 120), details: safeSupportDetails(details) }),
    prepare: async (payload: Omit<SupportPayload, 'request_id' | 'step'>, createId: () => string) => {
      await update(previous => {
        if (previous.pending || previous.receipt) return previous;
        const pending = { email: payload.email.trim().toLowerCase(), details: safeSupportDetails(payload.details),
          error_code: payload.error_code, app_version: payload.app_version, request_id: createId(), step };
        return { ...previous, email: pending.email, details: pending.details, pending };
      });
      if (!state.pending) throw new Error('This request is already saved. Start another report.');
      return state.pending;
    },
    accepted: (receipt: SupportReceipt) => update(previous => {
      if ((previous.pending?.request_id ?? previous.receipt?.request_id) !== receipt.request_id) throw new Error('Support receipt does not match this request.');
      return { ...previous, receipt, pending: undefined };
    }),
    revise: () => update(previous => ({ version: 1, owner, step, email: previous.email, details: previous.details })),
    another: () => update(previous => ({ version: 1, owner, step, email: previous.email, details: '' })),
  };
}
