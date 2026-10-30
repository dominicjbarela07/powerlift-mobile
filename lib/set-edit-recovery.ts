import { recoverCanonicalSetSave } from './canonical-set-save-recovery';

type EditValues = { actual_weight_kg: number; actual_reps: number; actual_rpe: number | null; actual_rir: number | null };
type EditResponse = { ok: boolean; status?: number; json?: any };

function matchesEdit(row: any, setLogId: number, desired: EditValues) {
  if (Number(row?.id) !== setLogId) return false;
  return Object.entries(desired).every(([key, value]) => value === null
    ? row[key] == null
    : row[key] != null && Number.isFinite(Number(row[key])) && Math.abs(Number(row[key]) - value) < 0.000001);
}

/** In-place replay requires both immutable Set identity and a server CAS revision. */
export async function recoverSetEdit({ request, assertOwner, workoutId, itemId, setLogId, desired, expectedRevision, wait }: {
  request: () => Promise<EditResponse>; assertOwner: () => void;
  workoutId: string; itemId: number; setLogId: number; desired: EditValues; expectedRevision: number | null;
  wait?: (milliseconds: number) => Promise<void>;
}) {
  const attempt = async () => {
    assertOwner();
    const response = await request();
    assertOwner();
    if (!response.ok || !response.json?.ok) throw new Error(response.json?.error || `Unable to update this set (${response.status}).`);
    if (!matchesEdit(response.json.set, setLogId, desired)) throw new Error('The saved set could not be verified. Refresh before editing again.');
    return response.json;
  };
  if (!Number.isInteger(expectedRevision) || Number(expectedRevision) <= 0) return attempt();
  return recoverCanonicalSetSave({
    clientSubmissionId: `edit:${workoutId}:${itemId}:${setLogId}:${expectedRevision}`,
    request: attempt, assertOwner, wait,
  });
}

export function applyConfirmedSetEdit<T extends { workout: any }>(current: T | null, itemId: number, setLogId: number, saved: any, itemRevision?: number): T | null {
  if (!current) return current;
  const update = (item: any) => item.id !== itemId ? item : {
    ...item,
    evidence_revision: Number.isInteger(itemRevision) && Number(itemRevision) > 0 ? itemRevision : undefined,
    ...(item.variant === 'TOP' && saved.set_index === 1 ? { actual_weight_kg: saved.actual_weight_kg, actual_rpe: saved.actual_rpe } : {}),
    set_logs: (item.set_logs || []).map((row: any) => row.id !== setLogId ? row : { ...row, ...saved }),
  };
  return { ...current, workout: { ...current.workout,
    core_items: (current.workout.core_items || []).map(update),
    accessory_groups: (current.workout.accessory_groups || []).map((group: any) => ({ ...group, items: group.items.map(update) })),
  } };
}
