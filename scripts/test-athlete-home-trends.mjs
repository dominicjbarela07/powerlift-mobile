import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  buildHomeBarPlot,
  buildHomeLinePlot,
  chronologicalHomePoints,
  homeHistoryState,
} from '../lib/home-trend-plot.ts';

const unordered = [
  { date: '2026-08-15', value: 8.4 },
  { date: '2026-08-01', value: 7.2 },
  { date: '2026-08-08', value: 7.8 },
];
assert.deepEqual(
  chronologicalHomePoints(unordered).map((point) => point.date),
  ['2026-08-01', '2026-08-08', '2026-08-15'],
  'real observations are ordered chronologically',
);
assert.deepEqual(
  chronologicalHomePoints([
    { date: '2026-08-01', value: null },
    { date: '2026-08-08', value: 0 },
  ]).map((point) => point.value),
  [0],
  'missing observations are excluded while a real zero remains plotted',
);

const spaced = buildHomeLinePlot([
  { date: '2026-08-01', value: 7 },
  { date: '2026-08-02', value: 8 },
  { date: '2026-08-11', value: 9 },
], 100, 52);
assert.equal(spaced.state, 'trend');
assert.ok(spaced.points[1].x < 30, 'x coordinates preserve real date spacing instead of evenly spacing observations');
assert.ok(spaced.points.every((point) => Number.isFinite(point.x) && Number.isFinite(point.y)));

assert.equal(homeHistoryState(0), 'empty');
assert.equal(homeHistoryState(1), 'first_observation');
assert.equal(homeHistoryState(2), 'comparison');
assert.equal(homeHistoryState(3), 'trend');

const bars = buildHomeBarPlot([
  { date: '2026-07-20', value: 1000 },
  { date: '2026-07-27', value: 1400 },
  { date: '2026-08-03', value: 1300 },
  { date: '2026-08-10', value: 1800 },
], 100, 52);
assert.equal(bars.bars.length, 4);
assert.ok(bars.bars[3].height > bars.bars[0].height, 'weekly volume uses quantitative bar heights');

const [screen, plot] = await Promise.all([
  readFile(new URL('../components/home/AthleteHomeV3.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../components/home/HomeTrendPlot.tsx', import.meta.url), 'utf8'),
]);
assert.doesNotMatch(screen, /react-native-svg|Polyline|function Sparkline/, 'manual SVG sparklines are removed from Athlete Home');
assert.match(screen, /Weekly Total Volume/);
assert.match(screen, /Reported Bodyweight/);
assert.match(screen, /e1RM/);
assert.match(screen, /vs prior 7d/);
assert.match(screen, /vs prior week/);
assert.doesNotMatch(screen, /name="barbell-outline"/, 'session cards do not fall back to a generic barbell icon');
assert.match(screen, /SESSION_RECAP_ARCHIVE_ART[\s\S]*SESSION_FOCUS_ART/, 'session cards use semantic completed/planned artwork when governed anatomy is absent');
assert.match(plot, /@shopify\/react-native-skia/);
assert.match(plot, /Line[\s\S]*Circle[\s\S]*Rect|Circle[\s\S]*Rect/, 'real line and bar plot primitives are present');

console.log('Athlete Home real trend geometry and chart contract passed.');
