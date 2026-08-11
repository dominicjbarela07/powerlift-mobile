import catalogJson from '@/assets/catalog/accessory-catalog-review.json';

export const ACCESSORY_CATALOG_REVIEW_USER_ID = 1;
export const ACCESSORY_REVIEW_SCHEMA_VERSION = 1;

export type ReviewState = 'UNREVIEWED' | 'CORRECT' | 'CORRECTED';

export type MuscleGroup = { key: string; label: string; body_region: string };
export type ExecutionFamily = { key: string; label: string; requires_equipment_configuration: boolean };
export type AccessoryMovement = {
  id: string;
  canonical_name: string;
  primary_muscle_group: string;
  secondary_muscle_groups: string[];
  execution_family: string;
  requires_equipment_configuration: boolean;
};
export type MovementSnapshot = {
  canonical_name: string;
  primary_muscle_group: string;
  secondary_muscle_groups: string[];
  execution_family: string;
};
export type ProposedCorrection = MovementSnapshot;
export type ReviewRecord = {
  movement_id: string;
  original: MovementSnapshot;
  review_state: 'CORRECT' | 'CORRECTED';
  proposed: ProposedCorrection | null;
  note: string;
  reviewed_at: string;
};
export type AccessoryReviewStore = {
  schema_version: number;
  catalog_version: string;
  user_id: number;
  last_movement_id: string | null;
  reviews: Record<string, ReviewRecord>;
};
export type ReviewFilters = {
  state: 'ALL' | ReviewState;
  primaryMuscle: string | null;
  executionFamily: string | null;
  search: string;
};
type CatalogProjection = {
  schema_version: number;
  catalog_version: string;
  source: string;
  total_movements: number;
  muscle_groups: MuscleGroup[];
  execution_families: ExecutionFamily[];
  movements: AccessoryMovement[];
};

export const ACCESSORY_REVIEW_CATALOG = catalogJson as CatalogProjection;

export function authenticatedUserId(user: unknown): number | null {
  if (!user || typeof user !== 'object') return null;
  const value = (user as { id?: unknown; user_id?: unknown }).id ?? (user as { user_id?: unknown }).user_id;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}
export function canAccessAccessoryCatalogReview(user: unknown): boolean {
  return authenticatedUserId(user) === ACCESSORY_CATALOG_REVIEW_USER_ID;
}
export function movementSnapshot(movement: AccessoryMovement): MovementSnapshot {
  return {
    canonical_name: movement.canonical_name,
    primary_muscle_group: movement.primary_muscle_group,
    secondary_muscle_groups: [...movement.secondary_muscle_groups],
    execution_family: movement.execution_family,
  };
}
export function createAccessoryReviewStore(userId = ACCESSORY_CATALOG_REVIEW_USER_ID): AccessoryReviewStore {
  return {
    schema_version: ACCESSORY_REVIEW_SCHEMA_VERSION,
    catalog_version: ACCESSORY_REVIEW_CATALOG.catalog_version,
    user_id: userId,
    last_movement_id: null,
    reviews: {},
  };
}
export function reconcileAccessoryReviewStore(candidate: unknown, userId = ACCESSORY_CATALOG_REVIEW_USER_ID): AccessoryReviewStore {
  const empty = createAccessoryReviewStore(userId);
  if (!candidate || typeof candidate !== 'object') return empty;
  const raw = candidate as Partial<AccessoryReviewStore>;
  if (raw.user_id !== userId || !raw.reviews || typeof raw.reviews !== 'object') return empty;
  const knownIds = new Set(ACCESSORY_REVIEW_CATALOG.movements.map((movement) => movement.id));
  const reviews: Record<string, ReviewRecord> = {};
  Object.entries(raw.reviews).forEach(([movementId, record]) => {
    if (!knownIds.has(movementId) || !record || typeof record !== 'object') return;
    if (record.review_state !== 'CORRECT' && record.review_state !== 'CORRECTED') return;
    reviews[movementId] = record;
  });
  return {
    ...empty,
    last_movement_id: raw.last_movement_id && knownIds.has(raw.last_movement_id) ? raw.last_movement_id : null,
    reviews,
  };
}
function nextRecord(
  movement: AccessoryMovement,
  reviewState: 'CORRECT' | 'CORRECTED',
  proposed: ProposedCorrection | null,
  note = '',
  reviewedAt = new Date().toISOString(),
): ReviewRecord {
  return {
    movement_id: movement.id,
    original: movementSnapshot(movement),
    review_state: reviewState,
    proposed,
    note: note.trim(),
    reviewed_at: reviewedAt,
  };
}
export function setMovementCorrect(store: AccessoryReviewStore, movement: AccessoryMovement, reviewedAt?: string): AccessoryReviewStore {
  return {
    ...store,
    last_movement_id: movement.id,
    reviews: { ...store.reviews, [movement.id]: nextRecord(movement, 'CORRECT', null, '', reviewedAt) },
  };
}
export function setMovementCorrected(
  store: AccessoryReviewStore,
  movement: AccessoryMovement,
  proposed: ProposedCorrection,
  note = '',
  reviewedAt?: string,
): AccessoryReviewStore {
  return {
    ...store,
    last_movement_id: movement.id,
    reviews: {
      ...store.reviews,
      [movement.id]: nextRecord(movement, 'CORRECTED', {
        ...proposed,
        canonical_name: proposed.canonical_name.trim(),
        secondary_muscle_groups: [...new Set(proposed.secondary_muscle_groups)]
          .filter((key) => key !== proposed.primary_muscle_group),
      }, note, reviewedAt),
    },
  };
}
export function reviewStateFor(store: AccessoryReviewStore, movementId: string): ReviewState {
  return store.reviews[movementId]?.review_state ?? 'UNREVIEWED';
}
export function deriveReviewCounts(store: AccessoryReviewStore) {
  let correct = 0;
  let corrected = 0;
  ACCESSORY_REVIEW_CATALOG.movements.forEach((movement) => {
    const state = reviewStateFor(store, movement.id);
    if (state === 'CORRECT') correct += 1;
    if (state === 'CORRECTED') corrected += 1;
  });
  const reviewed = correct + corrected;
  const total = ACCESSORY_REVIEW_CATALOG.total_movements;
  return { total, reviewed, correct, corrected, remaining: total - reviewed };
}
export function filterAccessoryMovements(store: AccessoryReviewStore, filters: ReviewFilters): AccessoryMovement[] {
  const query = filters.search.trim().toLocaleLowerCase();
  return ACCESSORY_REVIEW_CATALOG.movements.filter((movement) => {
    if (filters.state !== 'ALL' && reviewStateFor(store, movement.id) !== filters.state) return false;
    if (filters.primaryMuscle && movement.primary_muscle_group !== filters.primaryMuscle) return false;
    if (filters.executionFamily && movement.execution_family !== filters.executionFamily) return false;
    return !query || movement.canonical_name.toLocaleLowerCase().includes(query) || movement.id.includes(query);
  });
}
export function firstUnreviewedMovement(store: AccessoryReviewStore): AccessoryMovement | null {
  return ACCESSORY_REVIEW_CATALOG.movements.find((movement) => reviewStateFor(store, movement.id) === 'UNREVIEWED') ?? null;
}
export function muscleLabel(key: string): string {
  return ACCESSORY_REVIEW_CATALOG.muscle_groups.find((group) => group.key === key)?.label ?? key;
}
export function executionLabel(key: string): string {
  return ACCESSORY_REVIEW_CATALOG.execution_families.find((family) => family.key === key)?.label ?? key;
}
export function equipmentConfigurationLabel(movement: AccessoryMovement): string {
  return movement.requires_equipment_configuration ? 'Equipment Configuration Required' : 'No Machine Configuration';
}
function effectiveSnapshot(movement: AccessoryMovement, record?: ReviewRecord): MovementSnapshot {
  return record?.review_state === 'CORRECTED' && record.proposed ? record.proposed : movementSnapshot(movement);
}
export function buildAccessoryReviewExport(store: AccessoryReviewStore, exportedAt = new Date().toISOString()) {
  const counts = deriveReviewCounts(store);
  const reviews = ACCESSORY_REVIEW_CATALOG.movements
    .map((movement) => store.reviews[movement.id])
    .filter((record): record is ReviewRecord => Boolean(record));
  return {
    review_metadata: {
      schema_version: ACCESSORY_REVIEW_SCHEMA_VERSION,
      catalog_version: ACCESSORY_REVIEW_CATALOG.catalog_version,
      total_movements: counts.total,
      reviewed: counts.reviewed,
      correct: counts.correct,
      corrected: counts.corrected,
      remaining: counts.remaining,
      exported_at: exportedAt,
    },
    reviews,
    effective_catalog: ACCESSORY_REVIEW_CATALOG.movements.map((movement) => {
      const record = store.reviews[movement.id];
      return {
        movement_id: movement.id,
        review_state: record?.review_state ?? 'UNREVIEWED',
        ...effectiveSnapshot(movement, record),
      };
    }),
  };
}
export function buildAccessoryReviewJson(store: AccessoryReviewStore, exportedAt?: string): string {
  return `${JSON.stringify(buildAccessoryReviewExport(store, exportedAt), null, 2)}\n`;
}
export function buildAccessoryReviewMarkdown(store: AccessoryReviewStore, exportedAt = new Date().toISOString()): string {
  const counts = deriveReviewCounts(store);
  const lines = [
    '# Accessory Catalog Review', '',
    `Catalog: ${ACCESSORY_REVIEW_CATALOG.catalog_version}`,
    `Exported: ${exportedAt}`,
    `Reviewed: ${counts.reviewed} / ${counts.total}`,
    `Correct: ${counts.correct}`,
    `Corrected: ${counts.corrected}`,
    `Remaining: ${counts.remaining}`,
    '', '## Corrections', '',
  ];
  ACCESSORY_REVIEW_CATALOG.movements.forEach((movement) => {
    const record = store.reviews[movement.id];
    if (record?.review_state !== 'CORRECTED' || !record.proposed) return;
    lines.push(
      `### ${movement.canonical_name}`, '', `Stable ID: \`${movement.id}\``, '',
      `- Original primary: ${muscleLabel(record.original.primary_muscle_group)}`,
      `- Original secondary: ${record.original.secondary_muscle_groups.map(muscleLabel).join(', ') || 'None'}`,
      `- Original execution: ${executionLabel(record.original.execution_family)}`,
      `- Proposed name: ${record.proposed.canonical_name}`,
      `- Proposed primary: ${muscleLabel(record.proposed.primary_muscle_group)}`,
      `- Proposed secondary: ${record.proposed.secondary_muscle_groups.map(muscleLabel).join(', ') || 'None'}`,
      `- Proposed execution: ${executionLabel(record.proposed.execution_family)}`,
      ...(record.note ? [`- Note: ${record.note}`] : []), '',
    );
  });
  return `${lines.join('\n')}\n`;
}
