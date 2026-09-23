import { movementProgrammingPatch, type CoachMovementDraft, type CoachDisplayUnit, type CoachEditorItem } from './coach-session-editor';

/** Reuse Programming units/semantics while excluding all identity and structure writes. */
export function activePrescriptionPatch(draft: CoachMovementDraft, kind: 'core' | 'accessory', unit: CoachDisplayUnit,
  original?: CoachMovementDraft, originalItem?: CoachEditorItem) {
  const programming = movementProgrammingPatch(draft, kind, unit);
  const fields = new Set(['sets', 'reps', 'reps_text', 'rir_target', 'mode', 'rpe_target', 'pct',
    'target_low_lb', 'target_high_lb', 'notes', 'planned_sets']);
  if (draft.scheme === 'FULL_CUSTOM') { fields.delete('sets'); fields.delete('reps'); }
  const previous = original ? movementProgrammingPatch(original, kind, unit) : null;
  const patch = Object.fromEntries(Object.entries(programming).filter(([key, value]) => fields.has(key)
    && (!previous || JSON.stringify(value) !== JSON.stringify(previous[key]))));
  if ('target_low_lb' in patch || 'target_high_lb' in patch) {
    patch.target_low_lb = programming.target_low_lb;
    patch.target_high_lb = programming.target_high_lb;
  }
  if (Array.isArray(patch.planned_sets) && original && originalItem) {
    patch.planned_sets = patch.planned_sets.map((row, index) => ({ ...row,
      ...(draft.plannedSets[index]?.targetLb === original.plannedSets[index]?.targetLb
        ? { manual_target_kg: originalItem.planned_sets?.[index]?.manual_target_kg ?? null } : {}),
      ...(draft.plannedSets[index]?.rangeLb === original.plannedSets[index]?.rangeLb
        ? { manual_pm_kg: originalItem.planned_sets?.[index]?.manual_pm_kg ?? null } : {}),
    }));
  }
  return patch;
}

export function canEditActivePrescription(permission: boolean | undefined, selfCoached: boolean | undefined, status: string | null | undefined, preview: boolean) {
  return permission === true && selfCoached === true && status === 'in_progress' && !preview;
}
