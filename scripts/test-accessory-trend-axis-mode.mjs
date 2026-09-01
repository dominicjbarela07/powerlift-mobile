#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  buildAnalyticalXLayout,
  buildYAxisGutter,
  estimateAxisLabelWidth,
} from '../lib/chart-fidelity.ts';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const observations = [
  ['one', '2024-01-02T09:00:00Z'],
  ['two', '2024-01-09T09:00:00Z'],
  ['three', '2024-08-20T09:00:00Z'],
  ['four', '2026-08-28T09:00:00Z'],
].map(([key, date]) => ({ key, date }));
const args = { observations, plotLeft: 62, plotRight: 12, width: 390 };
const time = buildAnalyticalXLayout({ ...args, mode: 'chronological' });
const instances = buildAnalyticalXLayout({ ...args, mode: 'observationIndex' });

assert.deepEqual(time.observations.map(({ key, date }) => ({ key, date })), instances.observations.map(({ key, date }) => ({ key, date })), 'mode switching preserves every stable evidence identity and real date');
assert.ok(time.observations[2].x - time.observations[1].x > time.observations[1].x - time.observations[0].x, 'TIME preserves the larger real calendar gap');
const instanceDeltas = instances.observations.slice(1).map((row, index) => row.x - instances.observations[index].x);
assert.ok(instanceDeltas.every((delta) => Math.abs(delta - instanceDeltas[0]) < 0.001), 'INSTANCES gives equal space to each comparable observation');
assert.deepEqual(instances.ticks.map((tick) => tick.label), ['#1', '#2', '#3', '#4']);

for (const count of [1, 2, 3, 6, 15]) {
  const dense = buildAnalyticalXLayout({
    observations: Array.from({ length: count }, (_, index) => ({ key: `dense-${index}`, date: new Date(Date.UTC(2026, 0, index + 1)).toISOString() })),
    mode: count % 2 ? 'chronological' : 'observationIndex',
    plotLeft: 78,
    plotRight: 12,
    width: 320,
  });
  assert.equal(dense.observations.length, count, `${count}-observation series retains every point`);
  assert.ok(dense.ticks.length <= 5, `${count}-observation axis adapts its tick density`);
  assert.ok(dense.ticks.every((tick) => tick.x >= 78 && tick.x <= 308), 'ticks remain inside the plot');
  for (let index = 1; index < dense.ticks.length; index += 1) {
    const previous = dense.ticks[index - 1];
    const current = dense.ticks[index];
    const clearance = estimateAxisLabelWidth(previous.label, 9) / 2 + estimateAxisLabelWidth(current.label, 9) / 2;
    assert.ok(current.x - previous.x >= clearance, 'adaptive labels do not overlap');
  }
}

assert.ok(buildYAxisGutter(['-1,250 lb', '+12,500 lb'], 10) > buildYAxisGutter(['5 lb', '50 lb'], 10), 'signed and multi-digit axis values receive a larger measured gutter');

const toggle = read('components/charts/ChartAxisModeToggle.tsx');
const sharedChart = read('components/charts/AnalyticalTimeSeriesChart.tsx');
const reviewer = read('components/coach-mobile/CompletedSessionRecap.tsx');
const history = read('components/movement-history/CanonicalMovementHistoryScreen.tsx');
const historyChart = read('components/movement-history/AnalyticalHistoryChart.tsx');
assert.match(toggle, /TIME[\s\S]*INSTANCES/);
assert.match(sharedChart, /xDomainMode[\s\S]*buildAnalyticalXLayout/);
assert.match(reviewer, /historyAxisMode/);
assert.match(reviewer, /ChartAxisModeToggle/);
assert.match(reviewer, /xDomainMode=\{axisMode\}/);
assert.match(history, /historyAxisMode[\s\S]*movement-history-performance-axis-mode[\s\S]*movement-history-load-axis-mode/);
assert.match(historyChart, /buildYAxisGutter[\s\S]*buildAnalyticalXLayout[\s\S]*onOpenExposure/);
assert.doesNotMatch(history, /LOAD × REP PROFILE[\s\S]{0,500}ChartAxisModeToggle/, 'continuous load × rep profile does not receive the chronological/instance toggle');

console.log('[accessory-trend-axis-mode] PASS — chronological and instance domains preserve evidence while adaptive axes remain readable');
