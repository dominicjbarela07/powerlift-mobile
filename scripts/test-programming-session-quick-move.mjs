import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  isSameProgrammingDate,
  programmingMoveDestination,
} from '../lib/programming-session-move.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = fs.readFileSync(path.join(root, 'app/(tabs)/workout/index.tsx'), 'utf8');
const modalSource = fs.readFileSync(
  path.join(root, 'components/coach-mobile/ProgrammingSessionMoveModal.tsx'),
  'utf8'
);

const weeks = [
  {
    index: 1,
    days: [
      { date: '2026-08-03' },
      { date: '2026-08-04' },
      { date: '2026-08-05' },
      { date: '2026-08-06' },
      { date: '2026-08-07' },
      { date: '2026-08-08' },
      { date: '2026-08-09' },
    ],
  },
  {
    index: 2,
    days: [
      { date: '2026-08-10' },
      { date: '2026-08-11' },
      { date: '2026-08-12' },
      { date: '2026-08-13' },
      { date: '2026-08-14' },
      { date: '2026-08-15' },
      { date: '2026-08-16' },
    ],
  },
];

assert.deepEqual(programmingMoveDestination(weeks, '2026-08-07'), {
  week: 1,
  date: '2026-08-07',
});
assert.deepEqual(programmingMoveDestination(weeks, '2026-08-12'), {
  week: 2,
  date: '2026-08-12',
});
assert.equal(programmingMoveDestination(weeks, '2026-09-01'), null);
assert.equal(programmingMoveDestination(weeks, '2026-02-30'), null);
assert.equal(isSameProgrammingDate('2026-08-04', '2026-08-04'), true);
assert.equal(isSameProgrammingDate('2026-08-04', '2026-08-05'), false);

const swipeStart = source.indexOf('renderRightActions={(progress, dragX) =>');
const swipeEnd = source.indexOf('</Swipeable>', swipeStart);
assert.ok(swipeStart >= 0 && swipeEnd > swipeStart, 'Session swipe action must exist');
const swipeSource = source.slice(swipeStart, swipeEnd);
assert.match(swipeSource, /Move Session/);
assert.doesNotMatch(swipeSource, /Ath View|athlete view/i);
assert.doesNotMatch(swipeSource, />Edit</);

assert.match(source, /action:\s*'move'/);
assert.match(source, /target_date:\s*targetDate/);
assert.match(source, /quickMoveSubmittingRef\.current/);
assert.match(source, /isSameProgrammingDate\(move\.currentDate, targetDate\)/);
assert.match(source, /setExpandedWeek\(destination\.week\)/);
assert.match(source, /\[destinationKey\]: targetDate/);
assert.match(source, /await onRefresh\(\)/);
assert.match(source, /onFollowOffset\(offset\)/);

assert.match(modalSource, /Currently \{formatFullDate\(currentDate\)\}/);
assert.match(modalSource, /minimumDate/);
assert.match(modalSource, /maximumDate/);
assert.match(modalSource, /Moving\.\.\./);
assert.match(modalSource, /accessibilityRole="alert"/);

console.log('Programming Hub quick Move Session regression checks passed.');
