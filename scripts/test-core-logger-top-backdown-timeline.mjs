import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';


import { coreSetTimelineLabel } from '../lib/core-logger-timeline.ts';

// Domain fixtures deliberately avoid runtime laboratory assets.
const logs = count => Array.from({length:count}, (_, i) => ({id:i+1,set_index:i+1}));
const coreItems = [
  {id:1,variant:'TOP',sets:1,set_logs:logs(1)}, {id:2,variant:'BK',parent_item_id:1,sets:2,set_logs:[]},
  {id:3,variant:'TOP',sets:2,set_logs:[]}, {id:4,variant:'BK',parent_item_id:3,sets:3,set_logs:[]},
  {id:5,variant:'TOP',sets:3,set_logs:logs(3)}, {id:6,variant:'BK',parent_item_id:5,sets:1,set_logs:logs(1)},
];
const topItems = coreItems.filter((item) => item.variant === 'TOP');
const backdownFor = (topItem) => coreItems.find(
  (item) => item.variant === 'BK' && Number(item.parent_item_id) === Number(topItem.id),
);
const loggedCount = (item) => new Set(
  (item?.set_logs || []).map((setLog) => Number(setLog.set_index)).filter(Boolean),
).size;

assert.equal(coreSetTimelineLabel('top', 1, 1), 'TOP');
assert.equal(coreSetTimelineLabel('top', 1, 2), 'TOP 1');
assert.equal(coreSetTimelineLabel('top', 2, 2), 'TOP 2');
assert.equal(coreSetTimelineLabel('top', 3, 3), 'TOP 3');
assert.equal(coreSetTimelineLabel('backdown', 1, 1), 'BD 1');
assert.equal(coreSetTimelineLabel('backdown', 1, 3), 'BD 1');
assert.equal(coreSetTimelineLabel('backdown', 3, 3), 'BD 3');

assert.equal(topItems.length, 3, 'The canonical mock must include three Top/Backdown configurations.');

const configurations = topItems.map((topItem) => {
  const backdown = backdownFor(topItem);
  assert.ok(backdown, `Top item ${topItem.id} must retain its Backdown child.`);
  const total = Number(topItem.sets) + Number(backdown.sets);
  const completed = loggedCount(topItem) + loggedCount(backdown);
  const state = completed === 0 ? 'not-started' : completed >= total ? 'completed' : 'in-progress';
  return {
    topSets: Number(topItem.sets),
    backdownSets: Number(backdown.sets),
    state,
  };
});

assert.deepEqual(configurations, [
  { topSets: 1, backdownSets: 2, state: 'in-progress' },
  { topSets: 2, backdownSets: 3, state: 'not-started' },
  { topSets: 3, backdownSets: 1, state: 'completed' },
]);

const componentSource = fs.readFileSync(
  path.join(process.cwd(), 'components/workout-logger/core-loggers.tsx'),
  'utf8',
);
const routeSource = fs.readFileSync(
  path.join(process.cwd(), 'app/(tabs)/workout/[workoutId].tsx'),
  'utf8',
);

const instrument = fs.readFileSync(path.join(process.cwd(),'components/workout-logger/session-v3-movement.tsx'),'utf8');
assert.match(instrument, /focus\?\.currentSetPositionLabel/);
assert.match(instrument, /focus\?\.currentSetLoadLabel/);
assert.match(instrument, /LoggerPlateStackVisual/);
assert.match(componentSource, /row\.timelineLabel \|\| row\.label/,'TOP and each globally numbered backdown retain separate row identity');
assert.match(
  routeSource,
  /timelineLabel:\s*coreSetTimelineLabel\('top',\s*setIdx,\s*totalSets\)/,
  'Top-set rows must derive their semantic labels from the prescription.',
);
assert.match(
  routeSource,
  /timelineLabel:\s*coreSetTimelineLabel\(\s*'backdown',\s*timelineSetIndex,\s*topBackdownTotal/,
  'Backdown rows must derive globally ordered semantic labels from the combined prescription.',
);

console.log('Core logger Top/Backdown layout and timeline guards passed.');
