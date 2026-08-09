import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { createWorkoutDetailFixture } from '../dev-mocks/fixtures/workout-detail.ts';
import { coreSetTimelineLabel } from '../lib/core-logger-timeline.ts';

const fixture = createWorkoutDetailFixture();
const coreItems = fixture.workout.core_items;
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

assert.match(
  componentSource,
  /<View style=\{styles\.activeNextSetCopy\}>[\s\S]*?style=\{styles\.activeNextSetKicker\}[\s\S]*?\{loggerFocus\.currentSetPositionLabel\}[\s\S]*?currentSetLoadLabel/,
  'The set-position label and hero load must share one intrinsic copy stack.',
);
assert.match(
  componentSource,
  /activeNextSetCopy:\s*\{[\s\S]*?top:\s*0[\s\S]*?gap:\s*6/,
  'The hero copy must not use the former negative offset that caused label/load overlap.',
);
assert.match(
  componentSource,
  /const semanticNodeLabel = String\(row\.timelineLabel \|\| ''\)\.trim\(\)[\s\S]*?hasSemanticNodeLabel/,
  'The shared timeline must preserve explicit set identity.',
);
assert.match(
  componentSource,
  /setTimelineNodeSemantic:\s*\{[\s\S]*?width:\s*58[\s\S]*?height:\s*34[\s\S]*?setTimelineNodeTextSemantic/,
  'Semantic TOP/BD nodes must receive a readable pill treatment without changing straight-set nodes.',
);
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
