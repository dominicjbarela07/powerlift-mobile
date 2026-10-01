/** Confirm an active Session substitution against the current server item. */
export type HotSwapItem = {
  id: number;
  movement_definition_id?: number | null;
  performed_sets?: number | null;
  performed_reps_text?: string | null;
  performed_rir_target?: number | null;
  sets?: number | null;
  reps_text?: string | null;
  rir_target?: number | null;
  set_logs?: unknown[];
};

export type HotSwapPayload = {
  ok?: boolean;
  authoring_version?: string | null;
  evidence_revision?: number | null;
  workout?: { id?: number; accessory_groups?: { items?: HotSwapItem[] }[] };
  item?: HotSwapItem;
  error?: string;
  code?: string;
};

export type HotSwapResponse = { ok: boolean; status: number; json?: HotSwapPayload | null };
export type HotSwapRequest = (
  path: string,
  options: { method: 'GET' | 'POST'; body?: Record<string, unknown> },
) => Promise<HotSwapResponse>;

export class HotSwapError extends Error {
  constructor(message: string, public readonly code: string) { super(message); }
}

/** Synchronous guard: a second press cannot start before React renders saving. */
export function createHotSwapSubmissionGate() {
  let working = false;
  return {
    begin() { if (working) return false; working = true; return true; },
    end() { working = false; },
    isWorking() { return working; },
  };
}

function currentItem(payload: HotSwapPayload | null | undefined, itemId: number): HotSwapItem | null {
  return payload?.workout?.accessory_groups?.flatMap(group => group.items || [])
    .find(item => Number(item.id) === itemId) || null;
}

function matchesPrescription(item: HotSwapItem, prescription: { sets: number | null; repsText: string; rir: number | null } | null) {
  if (!prescription) return true;
  return Number(item.performed_sets ?? item.sets) === Number(prescription.sets)
    && String(item.performed_reps_text ?? item.reps_text ?? '') === prescription.repsText
    && Number(item.performed_rir_target ?? item.rir_target) === Number(prescription.rir);
}

/** The GET is a precondition read, not a license to overwrite an independent change. */
export async function executeActiveSessionHotSwap(input: {
  sessionId: number;
  itemId: number;
  openedMovementId: number;
  replacementId: number;
  replacementName: string;
  prescription: { sets: number | null; repsText: string; rir: number | null } | null;
  request: HotSwapRequest;
  trace?: (event: { phase: string; sessionId: number; itemId: number; openedId: number;
    currentId: number | null; replacementId: number; sessionVersion?: string | null;
    itemRevision?: number | null; status?: number }) => void;
}): Promise<{ item: HotSwapItem; session: HotSwapPayload; alreadyApplied: boolean }> {
  const { sessionId, itemId, openedMovementId, replacementId, replacementName, prescription, request, trace } = input;
  const sessionPath = `/workouts/mobile/${sessionId}`;
  const read = async () => {
    const result = await request(`${sessionPath}?history=summary`, { method: 'GET' });
    const session = result.json;
    if (!result.ok || !session?.ok || Number(session.workout?.id) !== sessionId) {
      throw new HotSwapError('Could not verify this Session. Try again.', 'read_failed');
    }
    const item = currentItem(session, itemId);
    if (!item || !Number.isInteger(Number(item.movement_definition_id))) {
      throw new HotSwapError('Could not verify this movement. Try again.', 'item_missing');
    }
    if (item.set_logs?.length) {
      throw new HotSwapError('This movement has saved Sets and can no longer be swapped.', 'performed_evidence');
    }
    return { session, item };
  };

  const before = await read();
  const currentId = Number(before.item.movement_definition_id);
  trace?.({ phase: 'precondition', sessionId, itemId, openedId: openedMovementId,
    currentId, replacementId, sessionVersion: before.session.authoring_version,
    itemRevision: (before.item as HotSwapItem & { evidence_revision?: number }).evidence_revision });
  if (currentId === replacementId && matchesPrescription(before.item, prescription)) {
    return { ...before, alreadyApplied: true };
  }
  if (currentId !== openedMovementId) {
    throw new HotSwapError('This movement changed in another view. Reopen Swap to review it.', 'independent_change');
  }

  let response: HotSwapResponse;
  try {
    response = await request(`${sessionPath}/items/${itemId}/swap_acc`, {
      method: 'POST',
      body: {
        movement: replacementName,
        movement_definition_id: replacementId,
        expected_movement_definition_id: currentId,
        ...(prescription ? {
          sets: prescription.sets ?? undefined,
          reps_text: prescription.repsText,
          rir: prescription.rir ?? undefined,
        } : {}),
      },
    });
  } catch {
    // The response may have been lost after commit. Re-read before offering a retry.
    const after = await read();
    if (Number(after.item.movement_definition_id) === replacementId
      && matchesPrescription(after.item, prescription)) return { ...after, alreadyApplied: true };
    throw new HotSwapError('Could not confirm the change. Try Confirm Swap again.', 'network_retry');
  }
  if (!response.ok || !response.json?.ok) {
    trace?.({ phase: 'rejected', sessionId, itemId, openedId: openedMovementId,
      currentId, replacementId, status: response.status });
    if (response.json?.code === 'stale_movement_identity') {
      const after = await read();
      if (Number(after.item.movement_definition_id) === replacementId
        && matchesPrescription(after.item, prescription)) return { ...after, alreadyApplied: true };
      throw new HotSwapError('This movement changed in another view. Reopen Swap to review it.', 'independent_change');
    }
    throw new HotSwapError(response.json?.error || 'Could not swap this movement. Try again.', response.json?.code || 'mutation_failed');
  }
  const item = response.json.item;
  if (!item || Number(item.id) !== itemId || Number(item.movement_definition_id) !== replacementId) {
    throw new HotSwapError('The saved movement could not be verified. Try again.', 'invalid_response');
  }
  trace?.({ phase: 'accepted', sessionId, itemId, openedId: openedMovementId,
    currentId: Number(item.movement_definition_id), replacementId, status: response.status });
  return { item, session: before.session, alreadyApplied: false };
}
