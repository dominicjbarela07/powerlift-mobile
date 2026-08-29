import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  compactCopiedSessionTitle,
  rankProgrammingWeekCopyCandidates,
} from '../lib/programming-week-copy.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = fs.readFileSync(path.join(root, 'app/(tabs)/workout/index.tsx'), 'utf8');

const anchor = {
  key: '20:2', blockId: 20, blockName: 'Surplus', blockOrder: 2,
  weekIndex: 2, startDate: '2026-08-31', sessionCount: 0,
};
const candidates = [
  { key: '20:1', blockId: 20, blockName: 'Surplus', blockOrder: 2, weekIndex: 1, startDate: '2026-08-24', sessionCount: 4 },
  { key: '20:3', blockId: 20, blockName: 'Surplus', blockOrder: 2, weekIndex: 3, startDate: '2026-09-07', sessionCount: 0 },
  { key: '20:4', blockId: 20, blockName: 'Surplus', blockOrder: 2, weekIndex: 4, startDate: '2026-09-14', sessionCount: 3 },
  { key: '10:4', blockId: 10, blockName: 'Maintenance', blockOrder: 1, weekIndex: 4, startDate: '2026-08-17', sessionCount: 4 },
  { key: '30:1', blockId: 30, blockName: 'Deficit', blockOrder: 3, weekIndex: 1, startDate: '2026-09-28', sessionCount: 0 },
];

const sources = rankProgrammingWeekCopyCandidates('copy-from', anchor, candidates);
assert.deepEqual(sources.map((candidate) => candidate.key), ['20:1', '20:4', '10:4']);
assert.ok(sources.every((candidate) => candidate.sessionCount > 0), 'Copy From must never offer empty source weeks');

const destinations = rankProgrammingWeekCopyCandidates('copy-to', { ...anchor, sessionCount: 4 }, candidates.filter((candidate) => candidate.key !== anchor.key));
assert.deepEqual(destinations.slice(0, 2).map((candidate) => candidate.key), ['20:3', '30:1']);
assert.ok(destinations.findIndex((candidate) => candidate.key === '20:4') > destinations.findIndex((candidate) => candidate.key === '30:1'), 'Populated destinations must remain below empty destinations');

assert.equal(compactCopiedSessionTitle('W1 Push'), 'Push');
assert.equal(compactCopiedSessionTitle('Week 12 - Lower'), 'Lower');
assert.equal(compactCopiedSessionTitle('WK_8: Pull'), 'Pull');
assert.equal(compactCopiedSessionTitle('Bench 5x5'), 'Bench 5x5');
assert.equal(compactCopiedSessionTitle('Squat W1'), 'Squat W1', 'Preview compaction must not rewrite arbitrary embedded numbers');

for (const contract of [
  'rankProgrammingWeekCopyCandidates',
  'Closest populated weeks first',
  'Empty destinations are prioritized',
  'New copies will be appended as drafts.',
  'Sessions will be created as drafts.',
  'Copying…',
  'weekActionSubmittingRef.current',
  'setQuickMoveFollowTarget',
  'await onRefresh()',
  'extra.confirm_conflicts = true',
]) {
  assert.ok(source.includes(contract), `Missing Copy Week behavior contract: ${contract}`);
}

assert.ok(source.includes('scroll={false}'), 'Copy Week must own its anchored context, scrollable picker, and sticky action summary');
assert.ok(source.includes('copyDestinationCount > 0'), 'Populated destinations must show the append path before submission');

console.log('Copy Week UX convergence contracts passed.');
