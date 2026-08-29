import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { accessorySwapActionForItem } from '../lib/accessory-swap-eligibility.ts';
import { buildSupersetRoundModel } from '../lib/superset-rounds.ts';

const swapAction = (overrides = {}) => accessorySwapActionForItem({
  substitutionAuthority: 'self_governed',
  hasApprovedSubstitutions: false,
  isCoachPreview: false,
  sessionLifecycle: 'active_session',
  targetItemHasSetLogs: true,
  targetItemHasRemainingSets: true,
  acceptedPersistedSetLogForItem: true,
  ...overrides,
});

assert.equal(swapAction(), 'Swap', 'self-coach retains Swap while future sets remain');
assert.equal(
  swapAction({ substitutionAuthority: 'coach_restricted', hasApprovedSubstitutions: true }),
  null,
  'externally coached evidence remains substitution-locked',
);
assert.equal(
  swapAction({ targetItemHasRemainingSets: false }),
  null,
  'a fully completed movement has no future identity slot to swap',
);
assert.equal(
  swapAction({ sessionLifecycle: 'finished_session' }),
  null,
  'finished Sessions remain immutable',
);

const beforeSwap = [
  {
    id: 101,
    title: 'Dumbbell Curl',
    sets: 3,
    superset_pos: 1,
    set_logs: [{ id: 1, set_index: 1 }],
  },
  {
    id: 102,
    title: 'Cable Overhead Triceps Extension',
    sets: 3,
    superset_pos: 2,
    set_logs: [{ id: 2, set_index: 1 }],
  },
];
const afterSwap = [
  { ...beforeSwap[0], title: 'Hammer Curl' },
  beforeSwap[1],
];
const beforeModel = buildSupersetRoundModel(beforeSwap);
const afterModel = buildSupersetRoundModel(afterSwap);

assert.deepEqual(
  afterModel.movements.map(({ itemId, position, loggedSetIndexes, nextSetIndex }) => ({
    itemId,
    position,
    loggedSetIndexes,
    nextSetIndex,
  })),
  beforeModel.movements.map(({ itemId, position, loggedSetIndexes, nextSetIndex }) => ({
    itemId,
    position,
    loggedSetIndexes,
    nextSetIndex,
  })),
  'identity replacement must not change A/B ordering, evidence, or next-set progression',
);
assert.equal(afterModel.completedRounds, 1);
assert.equal(afterModel.currentRoundIndex, 2);
assert.equal(afterModel.totalRequiredSets, 6);
assert.equal(afterModel.loggedRequiredSets, 2);

const workspace = readFileSync(
  new URL('../components/workout-logger/superset-round-workspace.tsx', import.meta.url),
  'utf8',
);
const logger = readFileSync(
  new URL('../app/(tabs)/workout/[workoutId].tsx', import.meta.url),
  'utf8',
);

assert.match(workspace, /swapActionForItem:\s*\(itemId: number\)/, 'superset workspace receives canonical per-item swap eligibility');
assert.match(workspace, /onSwapMovement\(movement\.itemId\)/, 'superset movement Swap uses the parent canonical action');
assert.match(workspace, /accessibilityLabel=\{`\$\{swapAction\} \$\{movement\.item\.title\}`\}/, 'Swap remains a named, reachable movement action');
assert.match(workspace, /pressed && styles\.controlPressed/, 'Swap and History expose immediate pressed feedback');
assert.match(workspace, /onPress=\{\(\) => onOpenHistory\(item\.id\)\}/, 'every visible History row is interactive even without prior performance');
assert.match(logger, /const executionItem = accessoryExecutionItem\(item\)[\s\S]*title: simplifyMobileMovementName\(executionName\)/, 'superset cards render the current performed identity and prescription');
assert.match(logger, /onSwapMovement=\{\(itemId\) => \{[\s\S]*openSwapAcc\(item\)/, 'superset Swap reuses the canonical governed picker path');
assert.match(logger, /onOpenHistory=\{\(itemId\) => \{[\s\S]*openCanonicalMovementHistory\(item\)/, 'superset History routes through exact canonical identity');
assert.doesNotMatch(
  logger,
  /onOpenHistory=\{\(itemId\) => \{[\s\S]{0,240}setMovementHistoryItem\(item\)/,
  'superset History must not target the permanently disabled legacy modal',
);

console.log('[superset-self-coach-swap-history] future-set identity, immutable progress, exact History routing, and tactile reachability passed');
