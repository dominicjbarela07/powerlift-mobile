/** Physical MovementDefinition IDs, separate from variant and Session IDs. */
export const CANONICAL_CORE_ARTWORK_IDENTITIES = {
  1: { key: 'competition_squat', family: 'squat' },
  2: { key: 'competition_bench', family: 'bench' },
  3: { key: 'competition_deadlift', family: 'deadlift' },
  607: { key: 'pin_squat', family: 'squat' },
  609: { key: 'safety_bar_squat', family: 'squat' },
  612: { key: 'hatfield_squat', family: 'squat' },
  618: { key: 'pin_press', family: 'bench' },
  620: { key: 'board_press_2_board', family: 'bench' },
  622: { key: 'deficit_deadlift', family: 'deadlift' },
  623: { key: 'block_pull', family: 'deadlift' },
  627: { key: 'snatch_grip_deadlift', family: 'deadlift' },
  628: { key: 'sumo_deadlift', family: 'deadlift' },
} as const;

export type CanonicalCoreArtworkKey =
  (typeof CANONICAL_CORE_ARTWORK_IDENTITIES)[keyof typeof CANONICAL_CORE_ARTWORK_IDENTITIES]['key'];
