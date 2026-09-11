export type LoggerDraft = {
  itemId: number; identity: string; revision: number; setIndex: number;
  kind: 'core' | 'accessory'; weightKg: number; reps: string; effort: string;
};
export type LoggerJournalState = {
  version: 1; owner: string; workoutId: number; focusedKey: string | null;
  drafts: Record<string, LoggerDraft>;
  attempts: Record<string, { id: string; signature: string }>;
};
const validDraft = (value: unknown): value is LoggerDraft => {
  const draft = value as LoggerDraft | null;
  return Boolean(draft && Number.isInteger(draft.itemId) && draft.itemId > 0 && typeof draft.identity === 'string' && draft.identity.length
    && Number.isInteger(draft.revision) && draft.revision > 0 && Number.isInteger(draft.setIndex) && draft.setIndex > 0
    && ['core', 'accessory'].includes(draft.kind) && Number.isFinite(draft.weightKg) && draft.weightKg >= 0
    && typeof draft.reps === 'string' && typeof draft.effort === 'string');
};
type Store = { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<void> };
export function createLoggerJournal(store: Store, owner: string, workoutId: number) {
  const key = `strength-ledger:logger-journal:v1:${owner}:${workoutId}`;
  let state: LoggerJournalState = { version: 1, owner, workoutId, focusedKey: null, drafts: {}, attempts: {} };
  let pending = Promise.resolve();
  const ready = store.getItem(key).then(raw => {
    if (!raw) return;
    try {
      const saved = JSON.parse(raw);
      if (saved.version === 1 && saved.owner === owner && saved.workoutId === workoutId && saved.drafts && saved.attempts) {
        state = { ...state, focusedKey: typeof saved.focusedKey === 'string' ? saved.focusedKey : null,
          drafts: Object.fromEntries(Object.entries(saved.drafts).filter(([key, draft]) => validDraft(draft) && key === String(draft.itemId))) as Record<string, LoggerDraft>,
          attempts: Object.fromEntries(Object.entries(saved.attempts).filter(([, value]) => {
            const attempt = value as { id?: unknown; signature?: unknown } | null;
            return attempt && typeof attempt.id === 'string' && attempt.id.length > 0 && typeof attempt.signature === 'string';
          })) as LoggerJournalState['attempts'],
        };
      }
    } catch { /* A corrupt local draft is never performed evidence. */ }
  });
  const update = async (change: (value: LoggerJournalState) => LoggerJournalState) => {
    await ready;
    state = change(state);
    const serialized = JSON.stringify(state);
    const write = pending.catch(() => undefined).then(() => store.setItem(key, serialized));
    pending = write;
    await write;
  };
  return {
    ready,
    snapshot: () => state,
    focus: (focusedKey: string | null) => update(value => ({ ...value, focusedKey })),
    saveDraft: (draft: LoggerDraft) => {
      if (!validDraft(draft)) return Promise.reject(new Error('Invalid local Session draft.'));
      return update(value => ({ ...value, drafts: { ...value.drafts, [draft.itemId]: draft } }));
    },
    draft: (itemId: number, identity: string, revision: number, setIndex: number) => {
      const saved = state.drafts[itemId];
      return saved && saved.identity === identity && saved.revision === revision && saved.setIndex === setIndex ? saved : null;
    },
    attempt: async (attemptKey: string, signature: string, createId: () => string) => {
      await ready;
      const previous = state.attempts[attemptKey];
      if (previous?.signature === signature) return previous.id;
      const id = createId();
      await update(value => ({ ...value, attempts: { ...value.attempts, [attemptKey]: { id, signature } } }));
      return id;
    },
    accepted: (attemptKey: string, itemId: number) => update(value => {
      const attempts = { ...value.attempts }, drafts = { ...value.drafts };
      delete attempts[attemptKey]; delete drafts[itemId];
      return { ...value, attempts, drafts };
    }),
    flush: () => pending,
  };
}
