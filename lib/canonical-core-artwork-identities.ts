/** Physical MovementDefinition IDs, separate from variant and Session IDs. */
export const CANONICAL_CORE_ARTWORK_IDENTITIES = {
  1: { key: 'competition_squat', family: 'squat' },
  2: { key: 'competition_bench', family: 'bench' },
  3: { key: 'competition_deadlift', family: 'deadlift' },
} as const;

export type CanonicalCoreArtworkKey =
  (typeof CANONICAL_CORE_ARTWORK_IDENTITIES)[keyof typeof CANONICAL_CORE_ARTWORK_IDENTITIES]['key'];
