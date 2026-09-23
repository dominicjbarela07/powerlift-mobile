import { activePrescriptionPatch, canEditActivePrescription } from './active-session-prescription';
import { movementDraftFromItem, type CoachMovementDraft } from './coach-session-editor';
import { validateSessionLoggerPayload } from './session-logger-resume';

export const canEditActiveComposition = canEditActivePrescription;
export type CompositionItem = { id: number; movement: string; movement_definition_id: number | null;
  variant: string; parent_item_id: number | null; superset_group: string | null; set_log_count: number; can_remove: boolean };
export type SessionComposition = { item_ids: number[]; items: CompositionItem[] };
export type AdditionSelection = { id: number; display_name: string; kind: 'core' | 'accessory'; lift?: string };

export function additionDraft(selection: AdditionSelection, unit: 'kg' | 'lb') {
  return movementDraftFromItem({ movement: selection.display_name, lift: selection.lift || 'AX',
    variant: selection.kind === 'accessory' ? 'ACC' : 'STRAIGHT', designation: 'SECONDARY',
    sets: 3, reps: 5, reps_text: '10-12', rir_target: 2, mode: 'RPE', rpe_target: 7 }, unit);
}

export function additionRequest(selection: AdditionSelection, draft: CoachMovementDraft, unit: 'kg' | 'lb',
  composition: SessionComposition, beforeItemId: number | null) {
  const prescription = activePrescriptionPatch(draft, selection.kind, unit);
  if (selection.kind === 'core' && draft.scheme === 'TOP_BACKDOWN') {
    prescription.backdown = activePrescriptionPatch({ ...draft, scheme: 'STRAIGHT', sourceVariant: 'BK',
      sets: draft.backdownSets, reps: draft.backdownReps, rpe: draft.backdownRpe, pct: draft.backdownPct,
      targetLowLb: draft.backdownTargetLowLb, targetHighLb: draft.backdownTargetHighLb }, 'core', unit);
  }
  return { expected_item_ids: composition.item_ids, before_item_id: beforeItemId,
    movement_definition_id: selection.id, kind: selection.kind, scheme: draft.scheme,
    designation: selection.kind === 'core' ? draft.designation : null, prescription };
}

export function orderSessionMovementRows<T extends { id: number }>(rows: T[], itemOrder?: number[]) {
  if (!itemOrder) return rows;
  const positions = new Map(itemOrder.map((id, index) => [id, index]));
  return [...rows].sort((a, b) => (positions.get(a.id) ?? Infinity) - (positions.get(b.id) ?? Infinity));
}

export function focusAfterCompositionChange<T extends { key: string }>(previous: T[], next: T[], focused: string | null) {
  if (next.some(row => row.key === focused)) return focused;
  const index = Math.max(0, previous.findIndex(row => row.key === focused));
  return next[Math.min(index, next.length - 1)]?.key ?? null;
}

/** Allow an intentional last-item removal, while retaining the ordinary hydration guard. */
export function validateCompositionResponse(candidate: any, current: any, sessionId: string) {
  const all = (payload: any): any[] => [...(payload?.workout?.core_items || []),
    ...(payload?.workout?.accessory_groups || []).flatMap((group: any) => group.items || [])];
  const previous = all(current), next = all(candidate), removed = candidate?.composition_mutation?.removed_item_id;
  const removedItem = previous.find(item => item.id === removed);
  if (String(candidate?.workout?.id) !== sessionId || String(current?.workout?.id) !== sessionId) return false;
  if (removed != null && (!removedItem || (removedItem.set_logs || []).length || next.some(item => item.id === removed))) return false;
  // Unaffected evidence and identities must still be represented in the response.
  if (previous.some(item => item.id !== removed && !next.some(row => row.id === item.id
    && row.movement_definition_id === item.movement_definition_id
    && (item.set_logs || []).every((log: any) => (row.set_logs || []).some((value: any) => value.id === log.id))))) return false;
  return validateSessionLoggerPayload({ candidate, current: removed != null ? null : current,
    requestedWorkoutId: sessionId }).ok;
}
