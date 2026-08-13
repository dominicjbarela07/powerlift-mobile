export type CoachEditorPlannedSet = {
  manual_target_kg?: number | null;
  manual_pm_kg?: number | null;
  suggested_low_kg?: number | null;
  suggested_high_kg?: number | null;
  [key: string]: unknown;
};

export type CoachEditorItem = {
  target_low_kg?: number | null;
  target_high_kg?: number | null;
  baseline_low_kg?: number | null;
  baseline_high_kg?: number | null;
  coach_prescribed_low_kg?: number | null;
  coach_prescribed_high_kg?: number | null;
  calculated_load_low_kg?: number | null;
  calculated_load_high_kg?: number | null;
  suggested_low_kg?: number | null;
  suggested_high_kg?: number | null;
  planned_sets?: CoachEditorPlannedSet[];
  [key: string]: unknown;
};

type CoachEditorPayload = {
  workout?: {
    core_items?: CoachEditorItem[];
    accessory_groups?: {
      items?: CoachEditorItem[];
      [key: string]: unknown;
    }[];
    [key: string]: unknown;
  } | null;
  [key: string]: unknown;
};

function mapItem(item: CoachEditorItem): CoachEditorItem {
  const {
    baseline_low_kg: _baselineLow,
    baseline_high_kg: _baselineHigh,
    calculated_load_low_kg: _calculatedLow,
    calculated_load_high_kg: _calculatedHigh,
    suggested_low_kg: _suggestedLow,
    suggested_high_kg: _suggestedHigh,
    coach_prescribed_low_kg,
    coach_prescribed_high_kg,
    ...rest
  } = item;
  const hasExplicitPrescription = coach_prescribed_low_kg != null || coach_prescribed_high_kg != null;

  return {
    ...rest,
    coach_prescribed_low_kg: hasExplicitPrescription ? coach_prescribed_low_kg ?? null : null,
    coach_prescribed_high_kg: hasExplicitPrescription ? coach_prescribed_high_kg ?? null : null,
    target_low_kg: hasExplicitPrescription ? coach_prescribed_low_kg ?? null : null,
    target_high_kg: hasExplicitPrescription ? coach_prescribed_high_kg ?? null : null,
    planned_sets: (item.planned_sets || []).map((plannedSet) => {
      const {
        suggested_low_kg: _suggestedLow,
        suggested_high_kg: _suggestedHigh,
        ...explicitPlannedSet
      } = plannedSet;
      return explicitPlannedSet;
    }),
  };
}

/**
 * Owns the coach editor's API-to-draft boundary.
 *
 * The coach editor displays only explicit coach-authored prescription values.
 * Calculated, baseline, historical, and suggested loads are deliberately
 * removed before the payload enters editable UI state.
 */
export function mapCoachSessionEditorPayload<T extends CoachEditorPayload>(payload: T): T {
  if (!payload.workout) return payload;
  return {
    ...payload,
    workout: {
      ...payload.workout,
      core_items: (payload.workout.core_items || []).map(mapItem),
      accessory_groups: (payload.workout.accessory_groups || []).map((group) => ({
        ...group,
        items: (group.items || []).map(mapItem),
      })),
    },
  } as T;
}

export function optionalDisplayNumber(value: string): number | null {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed.replace(/[^\d.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

export type CoachMovementDraft = {
  sourceLift: string;
  sourceVariant: string;
  movement: string;
  designation: string;
  scheme: 'STRAIGHT' | 'TOP_BACKDOWN' | 'FULL_CUSTOM';
  mode: 'RPE' | 'PCT';
  sets: string;
  reps: string;
  repsText: string;
  rpe: string;
  pct: string;
  rir: string;
  targetLowLb: string;
  targetHighLb: string;
  backdownSets: string;
  backdownReps: string;
  backdownRpe: string;
  backdownPct: string;
  backdownTargetLowLb: string;
  backdownTargetHighLb: string;
  notes: string;
  supersetGroup: string;
  supersetPosition: string;
  approvedSubsText: string;
  plannedSets: CoachPlannedSetDraft[];
};

export type CoachPlannedSetDraft = {
  reps: string;
  rpe: string;
  pct: string;
  targetLb: string;
  rangeLb: string;
};

const KG_PER_LB = 0.45359237;
export type CoachDisplayUnit = 'lb' | 'kg';

function cleanNumeric(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(Number(value))) return '';
  return Number(value).toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
}

function kgToLbText(value: number | null | undefined): string {
  if (value == null) return '';
  return cleanNumeric(Math.round((Number(value) / KG_PER_LB) / 2.5) * 2.5);
}

function kgToDisplayText(value: number | null | undefined, displayUnit: CoachDisplayUnit): string {
  if (displayUnit === 'kg') return cleanNumeric(value);
  return kgToLbText(value);
}

function normalizedText(value: unknown): string {
  return String(value ?? '').trim();
}

export function movementDraftFromItem(item: CoachEditorItem, displayUnit: CoachDisplayUnit = 'lb', linkedBackdown?: CoachEditorItem | null): CoachMovementDraft {
  const variant = normalizedText(item.variant).toUpperCase();
  const mode = normalizedText(item.mode).toUpperCase() === 'PCT' ? 'PCT' : 'RPE';
  return {
    sourceLift: normalizedText(item.lift).toUpperCase(),
    sourceVariant: variant,
    movement: normalizedText(item.movement || item.original_movement),
    designation: normalizedText(item.designation).toUpperCase(),
    scheme: variant === 'TOP' || variant === 'BK'
      ? 'TOP_BACKDOWN'
      : variant === 'FULL_CUSTOM' ? 'FULL_CUSTOM' : 'STRAIGHT',
    mode,
    sets: cleanNumeric(item.sets as number | null | undefined),
    reps: cleanNumeric(item.reps as number | null | undefined),
    repsText: normalizedText(item.reps_text),
    rpe: cleanNumeric(item.rpe_target as number | null | undefined),
    pct: item.pct == null ? '' : cleanNumeric(Number(item.pct) <= 1 ? Number(item.pct) * 100 : Number(item.pct)),
    rir: cleanNumeric(item.rir_target as number | null | undefined),
    targetLowLb: kgToDisplayText(item.coach_prescribed_low_kg, displayUnit),
    targetHighLb: kgToDisplayText(item.coach_prescribed_high_kg, displayUnit),
    backdownSets: cleanNumeric(linkedBackdown?.sets as number | null | undefined) || '3',
    backdownReps: cleanNumeric(linkedBackdown?.reps as number | null | undefined) || cleanNumeric(item.reps as number | null | undefined) || '5',
    backdownRpe: cleanNumeric(linkedBackdown?.rpe_target as number | null | undefined) || (mode === 'RPE' ? cleanNumeric(Math.max(1, Number(item.rpe_target || 7) - 1)) : ''),
    backdownPct: linkedBackdown?.pct == null
      ? (mode === 'PCT' ? cleanNumeric(Math.max(0, (Number(item.pct || 0.7) <= 1 ? Number(item.pct || 0.7) * 100 : Number(item.pct || 70)) - 5)) : '')
      : cleanNumeric(Number(linkedBackdown.pct) <= 1 ? Number(linkedBackdown.pct) * 100 : Number(linkedBackdown.pct)),
    backdownTargetLowLb: kgToDisplayText(linkedBackdown?.coach_prescribed_low_kg, displayUnit),
    backdownTargetHighLb: kgToDisplayText(linkedBackdown?.coach_prescribed_high_kg, displayUnit),
    notes: normalizedText(item.notes),
    supersetGroup: normalizedText(item.superset_group).toUpperCase(),
    supersetPosition: cleanNumeric(item.superset_pos as number | null | undefined),
    approvedSubsText: (Array.isArray(item.approved_subs) ? item.approved_subs : []).map(normalizedText).filter(Boolean).join('\n'),
    plannedSets: (item.planned_sets || []).map((row) => ({
      reps: cleanNumeric(row.reps as number | null | undefined),
      rpe: cleanNumeric(row.rpe_target as number | null | undefined),
      pct: row.pct == null ? '' : cleanNumeric(Number(row.pct) <= 1 ? Number(row.pct) * 100 : Number(row.pct)),
      targetLb: kgToDisplayText(row.manual_target_kg as number | null | undefined, displayUnit),
      rangeLb: Number(row.manual_pm_kg) > 0 ? kgToDisplayText(row.manual_pm_kg as number, displayUnit) : '',
    })),
  };
}

function semanticDraft(draft: CoachMovementDraft) {
  return {
    ...draft,
    movement: normalizedText(draft.movement),
    designation: normalizedText(draft.designation).toUpperCase(),
    notes: normalizedText(draft.notes),
    supersetGroup: normalizedText(draft.supersetGroup).toUpperCase(),
    sets: cleanNumeric(optionalDisplayNumber(draft.sets)),
    reps: cleanNumeric(optionalDisplayNumber(draft.reps)),
    rpe: cleanNumeric(optionalDisplayNumber(draft.rpe)),
    pct: cleanNumeric(optionalDisplayNumber(draft.pct)),
    rir: cleanNumeric(optionalDisplayNumber(draft.rir)),
    targetLowLb: cleanNumeric(optionalDisplayNumber(draft.targetLowLb)),
    targetHighLb: cleanNumeric(optionalDisplayNumber(draft.targetHighLb)),
    backdownSets: cleanNumeric(optionalDisplayNumber(draft.backdownSets)),
    backdownReps: cleanNumeric(optionalDisplayNumber(draft.backdownReps)),
    backdownRpe: cleanNumeric(optionalDisplayNumber(draft.backdownRpe)),
    backdownPct: cleanNumeric(optionalDisplayNumber(draft.backdownPct)),
    backdownTargetLowLb: cleanNumeric(optionalDisplayNumber(draft.backdownTargetLowLb)),
    backdownTargetHighLb: cleanNumeric(optionalDisplayNumber(draft.backdownTargetHighLb)),
    supersetPosition: cleanNumeric(optionalDisplayNumber(draft.supersetPosition)),
    approvedSubsText: normalizedText(draft.approvedSubsText).split(/\r?\n/).map(normalizedText).filter(Boolean).join('\n'),
    plannedSets: draft.plannedSets.map((row) => ({
      reps: cleanNumeric(optionalDisplayNumber(row.reps)),
      rpe: cleanNumeric(optionalDisplayNumber(row.rpe)),
      pct: cleanNumeric(optionalDisplayNumber(row.pct)),
      targetLb: cleanNumeric(optionalDisplayNumber(row.targetLb)),
      rangeLb: cleanNumeric(optionalDisplayNumber(row.rangeLb)),
    })),
  };
}

export function movementDraftIsDirty(current: CoachMovementDraft, persisted: CoachMovementDraft): boolean {
  return JSON.stringify(semanticDraft(current)) !== JSON.stringify(semanticDraft(persisted));
}

export function isCoreVariantDraft(draft: CoachMovementDraft): boolean {
  return normalizedText(draft.sourceLift).toUpperCase() === 'VR'
    || normalizedText(draft.sourceVariant).toUpperCase() === 'VR';
}

export function movementProgrammingPatch(
  draft: CoachMovementDraft,
  kind: 'core' | 'accessory',
  displayUnit: CoachDisplayUnit = 'lb',
): Record<string, unknown> {
  if (kind === 'accessory') {
    return {
      movement: normalizedText(draft.movement),
      sets: normalizedText(draft.sets),
      reps_text: normalizedText(draft.repsText),
      rir_target: normalizedText(draft.rir),
      notes: normalizedText(draft.notes),
      superset_group: normalizedText(draft.supersetGroup) || null,
      superset_pos: normalizedText(draft.supersetGroup) ? normalizedText(draft.supersetPosition) : null,
      approved_subs: normalizedText(draft.approvedSubsText).split(/\r?\n/).map(normalizedText).filter(Boolean),
    };
  }
  if (isCoreVariantDraft(draft)) {
    return {
      movement: normalizedText(draft.movement),
      designation: normalizedText(draft.designation),
      sets: normalizedText(draft.sets),
      reps: normalizedText(draft.reps),
      target_low_lb: normalizedText(draft.targetLowLb)
        ? cleanNumeric(displayUnit === 'kg' ? Number(draft.targetLowLb) / KG_PER_LB : Number(draft.targetLowLb))
        : '',
      target_high_lb: normalizedText(draft.targetHighLb)
        ? cleanNumeric(displayUnit === 'kg' ? Number(draft.targetHighLb) / KG_PER_LB : Number(draft.targetHighLb))
        : '',
      notes: normalizedText(draft.notes),
    };
  }
  return {
    movement: normalizedText(draft.movement),
    designation: normalizedText(draft.designation),
    scheme: draft.sourceVariant === 'BK' ? 'BK' : draft.scheme,
    mode: draft.mode,
    sets: normalizedText(draft.sets),
    reps: normalizedText(draft.reps),
    ...(draft.mode === 'PCT'
      ? { pct: normalizedText(draft.pct), rpe_target: null }
      : { rpe_target: normalizedText(draft.rpe), pct: null }),
    target_low_lb: normalizedText(draft.targetLowLb)
      ? cleanNumeric(displayUnit === 'kg' ? Number(draft.targetLowLb) / KG_PER_LB : Number(draft.targetLowLb))
      : '',
    target_high_lb: normalizedText(draft.targetHighLb)
      ? cleanNumeric(displayUnit === 'kg' ? Number(draft.targetHighLb) / KG_PER_LB : Number(draft.targetHighLb))
      : '',
    notes: normalizedText(draft.notes),
    ...(draft.scheme === 'TOP_BACKDOWN' ? {
      backdown_sets: normalizedText(draft.backdownSets),
      backdown_reps: normalizedText(draft.backdownReps),
      ...(draft.mode === 'PCT'
        ? { backdown_pct: normalizedText(draft.backdownPct), backdown_rpe_target: null }
        : { backdown_rpe_target: normalizedText(draft.backdownRpe), backdown_pct: null }),
      backdown_target_low_lb: normalizedText(draft.backdownTargetLowLb)
        ? cleanNumeric(displayUnit === 'kg' ? Number(draft.backdownTargetLowLb) / KG_PER_LB : Number(draft.backdownTargetLowLb))
        : '',
      backdown_target_high_lb: normalizedText(draft.backdownTargetHighLb)
        ? cleanNumeric(displayUnit === 'kg' ? Number(draft.backdownTargetHighLb) / KG_PER_LB : Number(draft.backdownTargetHighLb))
        : '',
    } : {}),
    ...(draft.scheme === 'FULL_CUSTOM' ? {
      planned_sets: draft.plannedSets.map((row, index) => ({
        set_index: index + 1,
        reps: normalizedText(row.reps),
        rpe_target: draft.mode === 'RPE' ? normalizedText(row.rpe) : null,
        pct: draft.mode === 'PCT' ? normalizedText(row.pct) : null,
        manual_target_kg: row.targetLb.trim() ? Number(row.targetLb) * (displayUnit === 'lb' ? KG_PER_LB : 1) : null,
        manual_pm_kg: row.rangeLb.trim() ? Number(row.rangeLb) * (displayUnit === 'lb' ? KG_PER_LB : 1) : null,
      })),
    } : {}),
  };
}

export type ManualTargetMargin = Readonly<{
  target: string;
  margin: string;
}>;

function displayToKg(value: number, unit: CoachDisplayUnit) {
  return unit === 'kg' ? value : value * KG_PER_LB;
}

function kgToUnit(valueKg: number, unit: CoachDisplayUnit) {
  return unit === 'kg' ? valueKg : valueKg / KG_PER_LB;
}

export function convertLoadDisplayValue(
  value: string,
  sourceUnit: CoachDisplayUnit,
  targetUnit: CoachDisplayUnit,
): string {
  const parsed = optionalDisplayNumber(value);
  if (parsed == null) return '';
  return cleanNumeric(kgToUnit(displayToKg(parsed, sourceUnit), targetUnit));
}

export function manualTargetMarginFromStoredRange(
  low: string,
  high: string,
  storageUnit: CoachDisplayUnit,
  displayUnit: CoachDisplayUnit,
): ManualTargetMargin {
  const lowValue = optionalDisplayNumber(low);
  const highValue = optionalDisplayNumber(high);
  if (lowValue == null && highValue == null) return { target: '', margin: '' };
  const lowKg = displayToKg(lowValue ?? highValue ?? 0, storageUnit);
  const highKg = displayToKg(highValue ?? lowValue ?? 0, storageUnit);
  const targetKg = (lowKg + highKg) / 2;
  const marginKg = Math.abs(highKg - lowKg) / 2;
  return {
    target: cleanNumeric(kgToUnit(targetKg, displayUnit)),
    margin: marginKg > 0 ? cleanNumeric(kgToUnit(marginKg, displayUnit)) : '',
  };
}

export function storedRangeFromManualTarget(
  target: string,
  margin: string,
  inputUnit: CoachDisplayUnit,
  storageUnit: CoachDisplayUnit,
): Readonly<{ low: string; high: string }> {
  const targetValue = optionalDisplayNumber(target);
  if (targetValue == null) return { low: '', high: '' };
  const marginValue = Math.max(0, optionalDisplayNumber(margin) ?? 0);
  const targetKg = displayToKg(targetValue, inputUnit);
  const marginKg = displayToKg(marginValue, inputUnit);
  return {
    low: cleanNumeric(kgToUnit(targetKg - marginKg, storageUnit)),
    high: cleanNumeric(kgToUnit(targetKg + marginKg, storageUnit)),
  };
}
