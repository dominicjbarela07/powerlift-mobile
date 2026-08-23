export type SessionRecapComparisonKind =
  | 'matched'
  | 'above_target'
  | 'below_target'
  | 'different_load'
  | 'not_logged';

export type SessionRecapPlanSet = {
  setIndex: number;
  repLow: number | null;
  repHigh: number | null;
  loadLowKg: number | null;
  loadHighKg: number | null;
  rirTarget: number | null;
  rpeTarget: number | null;
};

export type SessionRecapPerformedSet = {
  id?: number | null;
  set_index?: number | null;
  actual_weight_kg?: number | null;
  actual_reps?: number | null;
  actual_rir?: number | null;
  actual_rpe?: number | null;
};

export type SessionRecapSetComparison = {
  setIndex: number;
  plan: SessionRecapPlanSet;
  performed: SessionRecapPerformedSet | null;
  kind: SessionRecapComparisonKind;
};

export type SessionRecapComparisonMovement<TPlan = Record<string, unknown>, TPerformed = Record<string, unknown>> = {
  key: string;
  itemId: number | null;
  plan: TPlan | null;
  performed: TPerformed | null;
  comparisons: SessionRecapSetComparison[];
};

export type SessionRecapExecutionSummary = {
  plannedSetCount: number;
  loggedSetCount: number;
  loggedPlannedSetCount: number;
  matchedSetCount: number;
  differenceSetCount: number;
  notLoggedSetCount: number;
  completionPercent: number;
};

function finite(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function positiveInteger(value: unknown): number | null {
  const parsed = finite(value);
  return parsed != null && parsed > 0 ? Math.round(parsed) : null;
}

export function parseSessionRecapRepTarget(value: unknown): { low: number | null; high: number | null } {
  if (typeof value === 'number' && Number.isFinite(value)) return { low: value, high: value };
  const matches = String(value ?? '').match(/\d+(?:\.\d+)?/g)?.map(Number).filter(Number.isFinite) || [];
  if (!matches.length) return { low: null, high: null };
  const low = Math.min(matches[0], matches[1] ?? matches[0]);
  const high = Math.max(matches[0], matches[1] ?? matches[0]);
  return { low, high };
}

function planSet(plan: Record<string, any>, setIndex: number): SessionRecapPlanSet {
  const row = Array.isArray(plan.planned_sets) ? (plan.planned_sets[setIndex - 1] || {}) : {};
  const reps = parseSessionRecapRepTarget(
    row.reps_text ?? row.reps ?? row.rep_target ?? plan.reps_text ?? plan.reps,
  );
  const low = finite(
    row.coach_prescribed_low_kg ?? row.target_low_kg
      ?? plan.coach_prescribed_low_kg ?? plan.target_low_kg,
  );
  const high = finite(
    row.coach_prescribed_high_kg ?? row.target_high_kg
      ?? plan.coach_prescribed_high_kg ?? plan.target_high_kg,
  );
  return {
    setIndex,
    repLow: reps.low,
    repHigh: reps.high,
    loadLowKg: low,
    loadHighKg: high ?? low,
    rirTarget: finite(row.rir_target ?? plan.rir_target),
    rpeTarget: finite(row.rpe_target ?? plan.rpe_target),
  };
}

export function classifySessionRecapSet(
  plan: SessionRecapPlanSet,
  performed: SessionRecapPerformedSet | null,
): SessionRecapComparisonKind {
  if (!performed) return 'not_logged';
  const reps = finite(performed.actual_reps);
  if (reps != null && plan.repLow != null && reps < plan.repLow) return 'below_target';
  if (reps != null && plan.repHigh != null && reps > plan.repHigh) return 'above_target';
  const load = finite(performed.actual_weight_kg);
  if (load != null && plan.loadLowKg != null && load < plan.loadLowKg - 0.0005) return 'different_load';
  if (load != null && plan.loadHighKg != null && load > plan.loadHighKg + 0.0005) return 'different_load';
  return 'matched';
}

export function buildSessionRecapComparisons<TPlan extends Record<string, any>, TPerformed extends { item_id?: number | null; sets?: SessionRecapPerformedSet[] | null }>(
  plans: readonly TPlan[],
  performedMovements: readonly TPerformed[],
): SessionRecapComparisonMovement<TPlan, TPerformed>[] {
  const performedByItem = new Map<number, TPerformed[]>();
  performedMovements.forEach((movement) => {
    const itemId = positiveInteger(movement.item_id);
    if (itemId == null) return;
    const rows = performedByItem.get(itemId) || [];
    rows.push(movement);
    performedByItem.set(itemId, rows);
  });
  const consumed = new Set<TPerformed>();
  const rows: SessionRecapComparisonMovement<TPlan, TPerformed>[] = plans.map((plan, index) => {
    const itemId = positiveInteger(plan.item_id);
    const performedMatches = itemId == null ? [] : (performedByItem.get(itemId) || []);
    const performed = performedMatches[0] || null;
    performedMatches.forEach((row) => consumed.add(row));
    const evidence = performedMatches
      .flatMap((row) => Array.isArray(row.sets) ? row.sets : [])
      .sort((a, b) => Number(a.set_index || a.id || 0) - Number(b.set_index || b.id || 0));
    const plannedCount = Math.max(0, positiveInteger(plan.sets) || (Array.isArray(plan.planned_sets) ? plan.planned_sets.length : 0));
    const count = Math.max(plannedCount, evidence.length);
    const comparisons = Array.from({ length: count }, (_, setOffset) => {
      const target = planSet(plan, setOffset + 1);
      const performedSet = evidence[setOffset] || null;
      return {
        setIndex: setOffset + 1,
        plan: target,
        performed: performedSet,
        kind: setOffset >= plannedCount && performedSet ? 'different_load' as const : classifySessionRecapSet(target, performedSet),
      };
    });
    return { key: `plan-${itemId ?? index}`, itemId, plan, performed, comparisons };
  });
  performedMovements.forEach((performed, index) => {
    if (consumed.has(performed)) return;
    const evidence = [...(performed.sets || [])].sort((a, b) => Number(a.set_index || a.id || 0) - Number(b.set_index || b.id || 0));
    rows.push({
      key: `performed-${performed.item_id ?? index}`,
      itemId: positiveInteger(performed.item_id),
      plan: null,
      performed,
      comparisons: evidence.map((set, setIndex) => ({
        setIndex: setIndex + 1,
        plan: { setIndex: setIndex + 1, repLow: null, repHigh: null, loadLowKg: null, loadHighKg: null, rirTarget: null, rpeTarget: null },
        performed: set,
        kind: 'different_load',
      })),
    });
  });
  return rows;
}

export function summarizeSessionRecapExecution(
  rows: readonly SessionRecapComparisonMovement[],
): SessionRecapExecutionSummary {
  const comparisons = rows.flatMap((row) => row.comparisons);
  const plannedSetCount = rows.reduce((sum, row) => {
    const plan = row.plan as any;
    return sum + Math.max(0, positiveInteger(plan?.sets) || (Array.isArray(plan?.planned_sets) ? plan.planned_sets.length : 0));
  }, 0);
  const loggedSetCount = comparisons.filter((row) => row.performed).length;
  const notLoggedSetCount = comparisons.filter((row) => row.kind === 'not_logged').length;
  const matchedSetCount = comparisons.filter((row) => row.kind === 'matched').length;
  const differenceSetCount = comparisons.filter((row) => !['matched', 'not_logged'].includes(row.kind)).length;
  const loggedPlannedSetCount = Math.max(0, plannedSetCount - notLoggedSetCount);
  return {
    plannedSetCount,
    loggedSetCount,
    loggedPlannedSetCount,
    matchedSetCount,
    differenceSetCount,
    notLoggedSetCount,
    completionPercent: plannedSetCount ? Math.round((loggedPlannedSetCount / plannedSetCount) * 100) : 0,
  };
}

export function sessionRecapTargetGeometry(
  low: number | null,
  high: number | null,
  performed: number | null,
): { targetStart: number; targetWidth: number; marker: number } | null {
  if (low == null || high == null) return null;
  const value = performed ?? low;
  const domainLow = Math.min(low - 2, value - 1);
  const domainHigh = Math.max(high + 2, value + 1);
  const span = Math.max(1, domainHigh - domainLow);
  const percent = (number: number) => Math.max(0, Math.min(100, ((number - domainLow) / span) * 100));
  const start = percent(low);
  const end = percent(high);
  return { targetStart: start, targetWidth: Math.max(4, end - start), marker: percent(value) };
}

export function filterSessionRecapComparisons<TPlan, TPerformed>(
  rows: readonly SessionRecapComparisonMovement<TPlan, TPerformed>[],
  filter: 'all' | 'matched' | 'differences' | 'not_logged',
) {
  if (filter === 'all') return [...rows];
  return rows.filter((row) => row.comparisons.some((comparison) => (
    filter === 'matched' ? comparison.kind === 'matched'
      : filter === 'not_logged' ? comparison.kind === 'not_logged'
        : !['matched', 'not_logged'].includes(comparison.kind)
  )));
}

