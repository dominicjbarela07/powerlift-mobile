/**
 * Canonical Strength Ledger anatomy visualization contract.
 *
 * Product surfaces provide governed muscle identities. This module owns
 * presentation, view selection, aggregation, deduplication, and cache keys.
 * Display copy, session titles, equipment, and manufacturer names are never
 * used as muscle evidence.
 */

export const GOVERNED_MUSCLE_IDS = [
  'chest',
  'front_delts',
  'side_delts',
  'rear_delts',
  'lats',
  'upper_back',
  'traps',
  'biceps',
  'triceps',
  'forearms',
  'quads',
  'hamstrings',
  'glutes',
  'adductors',
  'abductors',
  'calves',
  'abs',
  'obliques',
  'lower_back',
  'serratus',
  'hip_flexors',
  'neck',
] as const;

export type GovernedMuscleId = (typeof GOVERNED_MUSCLE_IDS)[number];
export type AnatomyPresentationPreference = 'automatic' | 'masculine' | 'feminine';
export type AnatomyPresentation = Exclude<AnatomyPresentationPreference, 'automatic'>;
export type AnatomyViewPreference = 'auto' | 'front' | 'rear' | 'dual';
export type AnatomyResolvedView = Exclude<AnatomyViewPreference, 'auto'>;
export type AnatomySize = 'thumbnail' | 'card' | 'hero';
export type AnatomyRegion = 'upper' | 'lower' | 'torso' | 'arms' | 'full';
export type AnatomyRegionPreference = AnatomyRegion | 'auto';
export type AnatomySemanticLevel = 'week' | 'session' | 'movement';

export const ANATOMY_COLORS = Object.freeze({
  primary: '#9C4DFF',
  primaryEdge: '#D7A8FF',
  secondary: '#E447B7',
  secondaryEdge: '#FF9BE2',
  inactive: '#31343A',
});

export type MuscleVisibility = Readonly<{
  front: boolean;
  rear: boolean;
  preferred: 'front' | 'rear' | 'dual';
}>;

export const MUSCLE_META: Readonly<Record<GovernedMuscleId, MuscleVisibility & { label: string }>> = {
  chest: { label: 'Chest', front: true, rear: false, preferred: 'front' },
  front_delts: { label: 'Front Delts', front: true, rear: false, preferred: 'front' },
  side_delts: { label: 'Side Delts', front: true, rear: true, preferred: 'front' },
  rear_delts: { label: 'Rear Delts', front: false, rear: true, preferred: 'rear' },
  lats: { label: 'Lats', front: false, rear: true, preferred: 'rear' },
  upper_back: { label: 'Upper Back', front: false, rear: true, preferred: 'rear' },
  traps: { label: 'Traps', front: true, rear: true, preferred: 'rear' },
  biceps: { label: 'Biceps', front: true, rear: false, preferred: 'front' },
  triceps: { label: 'Triceps', front: false, rear: true, preferred: 'rear' },
  forearms: { label: 'Forearms', front: true, rear: true, preferred: 'front' },
  quads: { label: 'Quads', front: true, rear: false, preferred: 'front' },
  hamstrings: { label: 'Hamstrings', front: false, rear: true, preferred: 'rear' },
  glutes: { label: 'Glutes', front: false, rear: true, preferred: 'rear' },
  adductors: { label: 'Adductors', front: true, rear: false, preferred: 'front' },
  abductors: { label: 'Abductors', front: true, rear: true, preferred: 'dual' },
  calves: { label: 'Calves', front: true, rear: true, preferred: 'rear' },
  abs: { label: 'Abs', front: true, rear: false, preferred: 'front' },
  obliques: { label: 'Obliques', front: true, rear: false, preferred: 'front' },
  lower_back: { label: 'Lower Back', front: false, rear: true, preferred: 'rear' },
  serratus: { label: 'Serratus', front: true, rear: false, preferred: 'front' },
  hip_flexors: { label: 'Hip Flexors', front: true, rear: false, preferred: 'front' },
  neck: { label: 'Neck', front: true, rear: true, preferred: 'rear' },
};

const GOVERNED_SET = new Set<string>(GOVERNED_MUSCLE_IDS);

export function isGovernedMuscleId(value: unknown): value is GovernedMuscleId {
  return typeof value === 'string' && GOVERNED_SET.has(value.trim().toLowerCase().replace(/[ -]+/g, '_'));
}

export function normalizeMuscleIds(values?: readonly unknown[] | null): GovernedMuscleId[] {
  const output: GovernedMuscleId[] = [];
  const seen = new Set<GovernedMuscleId>();
  for (const raw of values || []) {
    const normalized = typeof raw === 'string' ? raw.trim().toLowerCase().replace(/[ -]+/g, '_') : '';
    if (!isGovernedMuscleId(normalized) || seen.has(normalized)) continue;
    seen.add(normalized);
    output.push(normalized);
  }
  return output;
}

export function normalizeMuscleRoles(
  primary?: readonly unknown[] | null,
  secondary?: readonly unknown[] | null,
): { primary: GovernedMuscleId[]; secondary: GovernedMuscleId[] } {
  const resolvedPrimary = normalizeMuscleIds(primary).slice(0, 5);
  const primarySet = new Set(resolvedPrimary);
  return {
    primary: resolvedPrimary,
    secondary: normalizeMuscleIds(secondary).filter((muscle) => !primarySet.has(muscle)).slice(0, 4),
  };
}

/** Explicit preference wins. Automatic uses the existing M/F profile field and then masculine as the stable safe default. */
export function resolveAnatomyPresentation(input?: {
  preference?: AnatomyPresentationPreference | string | null;
  sex?: string | null;
} | null): AnatomyPresentation {
  const preference = String(input?.preference || '').trim().toLowerCase();
  if (preference === 'feminine' || preference === 'masculine') return preference;
  return String(input?.sex || '').trim().toUpperCase() === 'F' ? 'feminine' : 'masculine';
}

export function resolveAnatomyView(
  primary?: readonly unknown[] | null,
  secondary?: readonly unknown[] | null,
  requested: AnatomyViewPreference = 'auto',
  size: AnatomySize = 'card',
): AnatomyResolvedView {
  if (requested !== 'auto') return requested;
  const roles = normalizeMuscleRoles(primary, secondary);
  const weighted = [
    ...roles.primary.map((muscle) => ({ muscle, weight: 2 })),
    ...roles.secondary.map((muscle) => ({ muscle, weight: 1 })),
  ];
  if (!weighted.length) return 'front';

  let front = 0;
  let rear = 0;
  for (const { muscle, weight } of weighted) {
    const meta = MUSCLE_META[muscle];
    if (meta.front) front += weight * (meta.preferred === 'front' ? 1.25 : 1);
    if (meta.rear) rear += weight * (meta.preferred === 'rear' ? 1.25 : 1);
  }
  const frontOnly = weighted.some(({ muscle }) => MUSCLE_META[muscle].front && !MUSCLE_META[muscle].rear);
  const rearOnly = weighted.some(({ muscle }) => MUSCLE_META[muscle].rear && !MUSCLE_META[muscle].front);
  if (size !== 'thumbnail' && frontOnly && rearOnly && Math.min(front, rear) >= Math.max(front, rear) * 0.34) return 'dual';
  return rear > front ? 'rear' : 'front';
}

const LOWER_MUSCLES = new Set<GovernedMuscleId>([
  'quads', 'hamstrings', 'glutes', 'adductors', 'abductors', 'calves', 'hip_flexors',
]);
const ARM_MUSCLES = new Set<GovernedMuscleId>(['biceps', 'triceps', 'forearms']);
const TORSO_MUSCLES = new Set<GovernedMuscleId>([
  'chest', 'lats', 'upper_back', 'traps', 'abs', 'obliques', 'lower_back', 'serratus',
]);

/**
 * Chooses framing, not muscle evidence. Movement inspection preserves complete
 * anatomical relationships; Week and Session summaries frame dominant regions.
 */
export function resolveAnatomyRegion(
  primary?: readonly unknown[] | null,
  secondary?: readonly unknown[] | null,
  semanticLevel: AnatomySemanticLevel = 'movement',
  requested: AnatomyRegionPreference = 'auto',
): AnatomyRegion {
  if (requested !== 'auto') return requested;
  if (semanticLevel === 'movement') return 'full';
  const roles = normalizeMuscleRoles(primary, secondary);
  const weighted = [
    ...roles.primary.map((muscle) => ({ muscle, weight: 2 })),
    ...roles.secondary.map((muscle) => ({ muscle, weight: 1 })),
  ];
  if (!weighted.length) return 'full';
  const total = weighted.reduce((sum, row) => sum + row.weight, 0);
  const score = (members: ReadonlySet<GovernedMuscleId>) => weighted.reduce(
    (sum, row) => sum + (members.has(row.muscle) ? row.weight : 0),
    0,
  );
  const lower = score(LOWER_MUSCLES);
  const arms = score(ARM_MUSCLES);
  const torso = score(TORSO_MUSCLES);
  const upper = total - lower;
  const threshold = semanticLevel === 'session' ? 0.50 : 0.64;
  if (lower / total >= threshold) return 'lower';
  if (arms / total >= threshold) return 'arms';
  if (torso / total >= threshold) return 'torso';
  if (upper / total >= threshold) return 'upper';
  return 'full';
}

export type MovementMuscleEvidence = Readonly<{
  movementDefinitionId?: number | null;
  primaryMuscle?: string | null;
  secondaryMuscles?: readonly string[] | null;
  prescribedSets?: number | null;
  performedSets?: number | null;
}>;

export type SessionMuscleFocus = Readonly<{
  primary: readonly Readonly<{ muscle_id: GovernedMuscleId; score: number }>[];
  secondary: readonly Readonly<{ muscle_id: GovernedMuscleId; score: number }>[];
  source: 'planned' | 'performed';
  evidence_movement_count: number;
}>;

type ScoredMuscle = Readonly<{ muscle_id?: string | null; score?: number | null }>;
export type ProgrammingMuscleFocus = Readonly<{
  primary?: readonly ScoredMuscle[] | null;
  secondary?: readonly ScoredMuscle[] | null;
}>;

/** Aggregates canonical Session focus scores into a Week-level composition. */
export function aggregateProgrammingWeekFocus(focuses: readonly ProgrammingMuscleFocus[]): {
  primary: GovernedMuscleId[];
  secondary: GovernedMuscleId[];
} {
  const primaryScores = new Map<GovernedMuscleId, number>();
  const secondaryScores = new Map<GovernedMuscleId, number>();
  const add = (target: Map<GovernedMuscleId, number>, row: ScoredMuscle) => {
    const muscle = normalizeMuscleIds([row.muscle_id])[0];
    if (!muscle) return;
    const score = Number(row.score);
    target.set(muscle, (target.get(muscle) || 0) + (Number.isFinite(score) && score > 0 ? score : 1));
  };
  for (const focus of focuses) {
    for (const row of focus.primary || []) add(primaryScores, row);
    for (const row of focus.secondary || []) add(secondaryScores, row);
  }
  const rank = (scores: Map<GovernedMuscleId, number>) => [...scores.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([muscle]) => muscle);
  const primary = rank(primaryScores).slice(0, 5);
  const primarySet = new Set(primary);
  return {
    primary,
    secondary: rank(secondaryScores).filter((muscle) => !primarySet.has(muscle)).slice(0, 4),
  };
}

function boundedSetCount(value: number | null | undefined): number {
  const count = Number(value);
  return Number.isFinite(count) ? Math.min(20, Math.max(0, Math.floor(count))) : 0;
}

/**
 * One shared, lifecycle-aware projection for all UI consumers.
 * Primary targets contribute 1.0 per set; meaningful secondary targets 0.5.
 * Top targets are capped (5 + 4) and thresholded to suppress incidental work.
 */
export function aggregateSessionMuscleFocus(
  movements: readonly MovementMuscleEvidence[],
  source: 'planned' | 'performed',
): SessionMuscleFocus {
  const primaryScores = new Map<GovernedMuscleId, number>();
  const secondaryScores = new Map<GovernedMuscleId, number>();
  let evidenceMovementCount = 0;

  for (const movement of movements) {
    const setCount = boundedSetCount(source === 'performed' ? movement.performedSets : movement.prescribedSets);
    const primary = normalizeMuscleIds([movement.primaryMuscle])[0];
    if (!setCount || !primary) continue;
    evidenceMovementCount += 1;
    primaryScores.set(primary, (primaryScores.get(primary) || 0) + setCount);
    for (const secondary of normalizeMuscleIds(movement.secondaryMuscles)) {
      if (secondary === primary) continue;
      secondaryScores.set(secondary, (secondaryScores.get(secondary) || 0) + setCount * 0.5);
    }
  }

  const scoreSort = (left: readonly [GovernedMuscleId, number], right: readonly [GovernedMuscleId, number]) =>
    right[1] - left[1] || GOVERNED_MUSCLE_IDS.indexOf(left[0]) - GOVERNED_MUSCLE_IDS.indexOf(right[0]);
  const rankedPrimary = [...primaryScores.entries()].sort(scoreSort);
  const peak = rankedPrimary[0]?.[1] || 0;
  const dominant = rankedPrimary.filter(([, score]) => score >= Math.max(2, peak * 0.40)).slice(0, 5);
  const dominantIds = new Set(dominant.map(([muscle]) => muscle));
  const secondaryPeak = Math.max(peak, ...secondaryScores.values(), 0);
  const supporting = [...secondaryScores.entries()]
    .filter(([muscle, score]) => !dominantIds.has(muscle) && score >= Math.max(1, secondaryPeak * 0.25))
    .sort(scoreSort)
    .slice(0, 4);

  const scored = (rows: readonly (readonly [GovernedMuscleId, number])[]) => rows.map(([muscle_id, score]) => ({
    muscle_id,
    score: Math.round(score * 100) / 100,
  }));
  return {
    primary: scored(dominant),
    secondary: scored(supporting),
    source,
    evidence_movement_count: evidenceMovementCount,
  };
}

export function anatomyRenderKey(input: {
  presentation: AnatomyPresentation;
  view: AnatomyResolvedView;
  region?: AnatomyRegion;
  primary?: readonly unknown[] | null;
  secondary?: readonly unknown[] | null;
  size: AnatomySize;
}): string {
  const roles = normalizeMuscleRoles(input.primary, input.secondary);
  return [
    input.presentation,
    input.view,
    input.region || 'full',
    [...roles.primary].sort().join(','),
    [...roles.secondary].sort().join(','),
    input.size,
  ].join(':');
}

export const ANATOMY_QA_PRESETS: Readonly<Record<string, Readonly<{ primary: readonly GovernedMuscleId[]; secondary: readonly GovernedMuscleId[] }>>> = {
  Push: { primary: ['chest', 'front_delts'], secondary: ['triceps'] },
  Pull: { primary: ['lats', 'upper_back'], secondary: ['biceps', 'rear_delts'] },
  Legs: { primary: ['quads', 'glutes', 'hamstrings'], secondary: ['calves', 'adductors'] },
  Shoulders: { primary: ['front_delts', 'side_delts', 'rear_delts'], secondary: ['triceps'] },
  Back: { primary: ['lats', 'upper_back', 'traps'], secondary: ['rear_delts', 'biceps'] },
  Arms: { primary: ['biceps', 'triceps'], secondary: ['forearms'] },
  'Full Body': { primary: ['chest', 'lats', 'quads', 'glutes', 'abs'], secondary: ['triceps', 'biceps', 'hamstrings', 'calves'] },
};
