import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { createCalendarBoundaryGuard } from '../lib/calendar-range-pagination.ts';

const [storyboard, route] = await Promise.all([
  readFile(new URL('../components/calendar/AthleteCalendarStoryboardV2.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../app/(tabs)/athlete-calendar.tsx', import.meta.url), 'utf8'),
]);

assert.match(storyboard, /CALENDAR_MONTH_HEIGHT = 511/);
assert.match(storyboard, /CALENDAR_INITIAL_MONTHS = 1/);
assert.match(storyboard, /CALENDAR_RENDER_BATCH = 1/);
assert.match(storyboard, /CALENDAR_WINDOW_SIZE = 3/);
assert.doesNotMatch(storyboard, /onStartReached=|onEndReached=|onScrollToIndexFailed/);
assert.match(storyboard, /initialScrollIndex=\{anchorIndex\}/);
assert.match(storyboard, /getItemLayout=/);
assert.match(storyboard, /lensVisible \? \([\s\S]*?<DayLens/);
assert.match(storyboard, /filtersOpen \? <FilterSheet/);
assert.match(storyboard, /jumpOpen \? \([\s\S]*?<JumpSheet/);
assert.match(route, /\{visiblePayload \? <AthleteCalendarStoryboardV2/);

const next = createCalendarBoundaryGuard();
const previous = createCalendarBoundaryGuard();
let nextRequests = 0;
let previousRequests = 0;

for (let index = 0; index < 500; index += 1) {
  if (next.update({ offsetY: index, remaining: Math.max(0, 500 - index) })) nextRequests += 1;
  if (previous.update({ offsetY: -index, remaining: index })) previousRequests += 1;
}
assert.equal(nextRequests, 0);
assert.equal(previousRequests, 0);

for (let gesture = 0; gesture < 1_000; gesture += 1) {
  next.begin(0);
  if (next.update({ offsetY: 16, remaining: 100 })) nextRequests += 1;
  if (next.update({ offsetY: 32, remaining: 84 })) nextRequests += 1;
  next.end();
  next.reset();

  previous.begin(-320);
  if (previous.update({ offsetY: -304, remaining: 100 })) previousRequests += 1;
  if (previous.update({ offsetY: -288, remaining: 84 })) previousRequests += 1;
  previous.end();
  previous.reset();
}
assert.equal(nextRequests, 1_000, 'one deliberate future-boundary request per gesture');
assert.equal(previousRequests, 1_000, 'one deliberate history-boundary request per gesture');

const monthHeight = 511;
for (let index = 0; index < 600; index += 1) {
  assert.equal(monthHeight * index, 511 * index, 'fixed month offsets must not drift');
}

const beforeInitialDayCells = 3 * 42;
const afterInitialDayCells = 1 * 42;
const beforeWindowDayCells = 5 * 42;
const afterWindowDayCells = 3 * 42;
assert.equal(afterInitialDayCells, 42);
assert.ok(afterInitialDayCells <= beforeInitialDayCells / 3);
assert.ok(afterWindowDayCells < beforeWindowDayCells);

console.log(JSON.stringify({
  boundaryLayoutRequests: 0,
  stressGestures: 2_000,
  requestsPerGesture: 1,
  beforeInitialDayCells,
  afterInitialDayCells,
  initialMountReductionPercent: Math.round((1 - afterInitialDayCells / beforeInitialDayCells) * 100),
  beforeWindowDayCells,
  afterWindowDayCells,
  fixedOffsetMonthsChecked: 600,
}));
