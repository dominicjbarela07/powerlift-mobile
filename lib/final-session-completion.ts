export type FinalSessionCompletionPhase = 'idle' | 'pending' | 'visible' | 'ending';

export type FinalSessionCompletionState = {
  workoutId: number;
  eventId: string | null;
  phase: FinalSessionCompletionPhase;
  handledEventIds: readonly string[];
};

export type FinalSessionCompletionAction =
  | { type: 'RESET_WORKOUT'; workoutId: number }
  | { type: 'QUEUE_CANONICAL_FINAL_SET'; workoutId: number; eventId: string }
  | { type: 'PRESENT_PENDING' }
  | { type: 'NOT_YET' }
  | { type: 'BEGIN_END_SESSION' }
  | { type: 'END_SESSION_TRANSITION_SUCCEEDED' }
  | { type: 'END_SESSION_TRANSITION_FAILED' };

export const initialFinalSessionCompletionState: FinalSessionCompletionState = {
  workoutId: 0,
  eventId: null,
  phase: 'idle',
  handledEventIds: [],
};

function handled(state: FinalSessionCompletionState): FinalSessionCompletionState {
  const handledEventIds = state.eventId && !state.handledEventIds.includes(state.eventId)
    ? [...state.handledEventIds, state.eventId].slice(-8)
    : state.handledEventIds;
  return {
    ...state,
    eventId: null,
    phase: 'idle',
    handledEventIds,
  };
}

export function finalSessionCompletionReducer(
  state: FinalSessionCompletionState,
  action: FinalSessionCompletionAction,
): FinalSessionCompletionState {
  if (action.type === 'RESET_WORKOUT') {
    if (state.workoutId === action.workoutId) return state;
    return {
      ...initialFinalSessionCompletionState,
      workoutId: action.workoutId,
    };
  }

  if (action.type === 'QUEUE_CANONICAL_FINAL_SET') {
    if (!action.workoutId || !action.eventId) return state;
    const scopedState = state.workoutId === action.workoutId
      ? state
      : {
          ...initialFinalSessionCompletionState,
          workoutId: action.workoutId,
        };
    if (
      scopedState.eventId === action.eventId
      || scopedState.handledEventIds.includes(action.eventId)
    ) return scopedState;
    return {
      ...scopedState,
      eventId: action.eventId,
      phase: 'pending',
    };
  }

  if (action.type === 'PRESENT_PENDING') {
    return state.phase === 'pending'
      ? { ...state, phase: 'visible' }
      : state;
  }
  if (action.type === 'NOT_YET') {
    return state.phase === 'visible' ? handled(state) : state;
  }
  if (action.type === 'BEGIN_END_SESSION') {
    return state.phase === 'visible'
      ? { ...state, phase: 'ending' }
      : state;
  }
  if (action.type === 'END_SESSION_TRANSITION_SUCCEEDED') {
    return state.phase === 'ending' ? handled(state) : state;
  }
  if (action.type === 'END_SESSION_TRANSITION_FAILED') {
    return state.phase === 'ending'
      ? { ...state, phase: 'visible' }
      : state;
  }
  return state;
}

export function canPresentFinalSessionCompletion({
  state,
  saveConfirmationVisible,
  recognitionActive,
  recognitionQueueLength,
  appBackgrounded,
  timerPending,
  timerVisible,
}: {
  state: FinalSessionCompletionState;
  saveConfirmationVisible: boolean;
  recognitionActive: boolean;
  recognitionQueueLength: number;
  appBackgrounded: boolean;
  timerPending: boolean;
  timerVisible: boolean;
}): boolean {
  return state.phase === 'pending'
    && !saveConfirmationVisible
    && !recognitionActive
    && recognitionQueueLength === 0
    && !appBackgrounded
    && !timerPending
    && !timerVisible;
}
