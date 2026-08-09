export type SequentialGroupDraftEntry = Readonly<{
  itemId: number;
  title: string;
  weight: string;
  reps: string;
  rir: string;
  requiresRir: boolean;
  alreadyLogged: boolean;
  skipped?: boolean;
  validationError?: string | null;
}>;

export type SequentialGroupDraftState<T extends SequentialGroupDraftEntry> = Readonly<{
  entries: readonly T[];
  activeIndex: number;
}>;

export type SequentialGroupValidation = Readonly<{
  valid: boolean;
  invalidIndex: number | null;
  message: string | null;
}>;

export function createSequentialGroupDraft<T extends SequentialGroupDraftEntry>(
  entries: readonly T[],
): SequentialGroupDraftState<T> {
  const firstMissingIndex = entries.findIndex((entry) => !entry.alreadyLogged);
  return Object.freeze({
    entries: Object.freeze([...entries]),
    activeIndex: firstMissingIndex >= 0 ? firstMissingIndex : Math.max(entries.length - 1, 0),
  });
}

export function updateSequentialGroupDraft<T extends SequentialGroupDraftEntry>(
  state: SequentialGroupDraftState<T>,
  itemId: number,
  field: 'weight' | 'reps' | 'rir',
  value: string,
): SequentialGroupDraftState<T> {
  return Object.freeze({
    ...state,
    entries: Object.freeze(state.entries.map((entry) => (
      entry.itemId === itemId && !entry.alreadyLogged
        ? Object.freeze({
            ...entry,
            [field]: value,
            skipped: false,
            validationError: null,
          }) as T
        : entry
    ))),
  });
}

export function previousSequentialGroupStep<T extends SequentialGroupDraftEntry>(
  state: SequentialGroupDraftState<T>,
): SequentialGroupDraftState<T> {
  return Object.freeze({
    ...state,
    activeIndex: Math.max(0, state.activeIndex - 1),
  });
}

export function skipSequentialGroupStep<T extends SequentialGroupDraftEntry>(
  state: SequentialGroupDraftState<T>,
): SequentialGroupDraftState<T> {
  const current = state.entries[state.activeIndex];
  if (!current || current.alreadyLogged) return state;

  const entries = Object.freeze(state.entries.map((entry, index) => (
    index === state.activeIndex
      ? Object.freeze({ ...entry, skipped: true, validationError: null }) as T
      : entry
  )));
  const nextPendingIndex = entries.findIndex(
    (entry, index) => index > state.activeIndex && !entry.alreadyLogged && !entry.skipped,
  );

  return Object.freeze({
    entries,
    activeIndex: nextPendingIndex >= 0 ? nextPendingIndex : state.activeIndex,
  });
}

function validationMessage(entry: SequentialGroupDraftEntry): string | null {
  const weight = Number(String(entry.weight).trim());
  if (!String(entry.weight).trim() || !Number.isFinite(weight) || weight < 0) {
    return `Enter a valid weight for ${entry.title}.`;
  }

  const repsText = String(entry.reps).trim();
  const reps = Number(repsText);
  if (!repsText || !/^\d+$/.test(repsText) || !Number.isFinite(reps) || reps < 0) {
    return `Enter reps for ${entry.title}.`;
  }

  const rirText = String(entry.rir).trim();
  const rir = Number(rirText);
  if (
    entry.requiresRir
    && (!rirText || !Number.isFinite(rir))
  ) {
    return `Enter a valid RIR for ${entry.title}.`;
  }
  if (rirText && !Number.isFinite(rir)) {
    return `Enter a valid RIR for ${entry.title}.`;
  }
  return null;
}

function withEntryError<T extends SequentialGroupDraftEntry>(
  state: SequentialGroupDraftState<T>,
  index: number,
  message: string | null,
): SequentialGroupDraftState<T> {
  return Object.freeze({
    ...state,
    activeIndex: index,
    entries: Object.freeze(state.entries.map((entry, entryIndex) => (
      entryIndex === index
        ? Object.freeze({ ...entry, validationError: message }) as T
        : entry
    ))),
  });
}

export function advanceSequentialGroupStep<T extends SequentialGroupDraftEntry>(
  state: SequentialGroupDraftState<T>,
): {
  state: SequentialGroupDraftState<T>;
  validation: SequentialGroupValidation;
} {
  const current = state.entries[state.activeIndex];
  if (!current) {
    return {
      state,
      validation: Object.freeze({
        valid: false,
        invalidIndex: null,
        message: 'No movement is available to log.',
      }),
    };
  }
  const message = current.alreadyLogged || current.skipped ? null : validationMessage(current);
  if (message) {
    return {
      state: withEntryError(state, state.activeIndex, message),
      validation: Object.freeze({
        valid: false,
        invalidIndex: state.activeIndex,
        message,
      }),
    };
  }
  return {
    state: Object.freeze({
      ...withEntryError(state, state.activeIndex, null),
      activeIndex: Math.min(state.entries.length - 1, state.activeIndex + 1),
    }),
    validation: Object.freeze({
      valid: true,
      invalidIndex: null,
      message: null,
    }),
  };
}

export function validateSequentialGroupForSave<T extends SequentialGroupDraftEntry>(
  state: SequentialGroupDraftState<T>,
): {
  state: SequentialGroupDraftState<T>;
  validation: SequentialGroupValidation;
} {
  for (let index = 0; index < state.entries.length; index += 1) {
    const entry = state.entries[index];
    if (entry.alreadyLogged || entry.skipped) continue;
    const message = validationMessage(entry);
    if (message) {
      return {
        state: withEntryError(state, index, message),
        validation: Object.freeze({
          valid: false,
          invalidIndex: index,
          message,
        }),
      };
    }
  }
  return {
    state,
    validation: Object.freeze({
      valid: true,
      invalidIndex: null,
      message: null,
    }),
  };
}
