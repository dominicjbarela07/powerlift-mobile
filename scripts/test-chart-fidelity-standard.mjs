import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  analyticalMetricDefinition,
  buildAnalyticalXLayout,
  buildNumericScale,
  buildTimeTicks,
  buildYAxisGutter,
  formatAnalyticalValue,
  nearestTimeIndex,
} from '../lib/chart-fidelity.ts';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const mixed = buildNumericScale([-9.2, -1.4, 4.5, 18.3], analyticalMetricDefinition('max_progression'));
assert.ok(mixed.minimum < 0 && mixed.maximum > 0, 'mixed-sign progress must show an honest zero-crossing scale');
assert.ok(mixed.ticks.length >= 4 && mixed.ticks.length <= 7, 'analytical axes use a legible human tick count');
assert.deepEqual(buildNumericScale([72, 86, 92], analyticalMetricDefinition('adherence')).ticks, [0, 25, 50, 75, 100]);
assert.ok(buildNumericScale([425, 425, 425], analyticalMetricDefinition('e1rm', { kind: 'weight', unit: 'lb' })).maximum > 425, 'flat series retain visible scale context');
assert.equal(formatAnalyticalValue(12.7, analyticalMetricDefinition('dots_progression')), '+12.7%');
assert.equal(formatAnalyticalValue(86, analyticalMetricDefinition('adherence')), '86%');
assert.equal(formatAnalyticalValue(6.3, analyticalMetricDefinition('pr_rate')), '6.3 per 100 planned sets');
assert.equal(formatAnalyticalValue(405, analyticalMetricDefinition('e1rm', { kind: 'weight', unit: 'lb' })), '405 lb');
assert.equal(formatAnalyticalValue(28450, analyticalMetricDefinition('volume', { kind: 'volume', unit: 'lb' })), '28K lb');

const dates = ['2026-06-01', '2026-06-08', '2026-06-15', '2026-06-22', '2026-06-29', '2026-07-06', '2026-07-13'];
const timeTicks = buildTimeTicks(dates, 390);
assert.ok(timeTicks.length >= 3 && timeTicks.length <= 5, 'time axes expose 3–5 readable anchors');
assert.equal(new Set(timeTicks.map((row) => row.label)).size, timeTicks.length, 'time ticks must not duplicate labels');
assert.equal(nearestTimeIndex([10, 20, 30], 24), 1, 'scrubbing selects the nearest dated observation');

const observations = dates.map((date, index) => ({ key: `exposure-${index + 1}`, date }));
const timeLayout = buildAnalyticalXLayout({ observations, mode: 'chronological', plotLeft: 52, plotRight: 12, width: 390 });
const instanceLayout = buildAnalyticalXLayout({ observations, mode: 'observationIndex', plotLeft: 52, plotRight: 12, width: 390 });
assert.deepEqual(timeLayout.observations.map((row) => row.key), instanceLayout.observations.map((row) => row.key), 'axis mode must not change the evidence series');
assert.ok(instanceLayout.ticks.every((tick) => tick.label.startsWith('#')), 'instance mode labels comparable observations by ordinal');
assert.ok(buildYAxisGutter(['5 lb', '1,250 lb']) > buildYAxisGutter(['5 lb', '50 lb']), 'Y-axis gutter expands for formatted values instead of colliding with the plot');

const shared = read('components/charts/AnalyticalTimeSeriesChart.tsx');
for (const contract of ['buildNumericScale', 'buildAnalyticalXLayout', 'buildYAxisGutter', 'xDomainMode', 'onResponderMove', 'tooltip', 'selectedDate', 'accessibilityLabel']) assert.match(shared, new RegExp(contract));

const consumers = {
  'Team Brief': read('app/coach-team-brief.tsx'),
  'Team outlier/deep dive': read('components/coach-mobile/CoachAnalyticsTrend.tsx'),
  'Coach Session Reviewer': read('components/coach-mobile/CoachSessionReviewerV3.tsx'),
  'Athlete Progression': read('app/(tabs)/athlete-progression.tsx'),
  'Ledger strength': read('components/ledger/experiences.tsx'),
  'Ledger movement detail': read('components/ledger/exploration-experiences.tsx'),
  'Session recap expanded trend': read('components/coach-mobile/CompletedSessionRecap.tsx'),
};
for (const [name, source] of Object.entries(consumers)) assert.match(source, /AnalyticalTimeSeriesChart/, `${name} must use the canonical analytical chart primitive`);

const teamBrief = consumers['Team Brief'];
assert.match(teamBrief, /Estimated DOTS Progression/);
assert.match(teamBrief, /analyticalMetricDefinition\(metric\)/);
assert.doesNotMatch(read('app/coach-team-outliers.tsx'), /row\.value\.toFixed\(1\).*%/s, 'PR rate must never masquerade as a percentage');

const movementHistory = read('components/movement-history/AnalyticalHistoryChart.tsx');
assert.match(movementHistory, /onResponderMove|PanResponder/);
assert.match(movementHistory, /selected|tooltip/i);
assert.match(movementHistory, /buildAnalyticalXLayout/);
assert.match(read('components/charts/ChartAxisModeToggle.tsx'), /TIME[\s\S]*INSTANCES/);

console.log('[chart-fidelity-standard] PASS — metric-aware axes, meaningful time ticks, touch/scrub inspection, and primary analytical consumers are protected');
