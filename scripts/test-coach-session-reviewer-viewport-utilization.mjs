#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const adapter = read('components/coach-mobile/CoachSessionReviewerV3.tsx');
const recap = read('components/coach-mobile/CompletedSessionRecap.tsx');
const calendar = read('app/(tabs)/coach-calendar.tsx');
const teamBrief = read('app/coach-team-brief.tsx');
const analyticalChart = read('components/charts/AnalyticalTimeSeriesChart.tsx');

function styleBody(source, name) {
  const match = source.match(new RegExp(`${name}: \\{([^}]*)\\}`));
  assert.ok(match, `${name} style must exist`);
  return match[1];
}

function assertNoPageInset(source, name) {
  const body = styleBody(source, name);
  assert.doesNotMatch(body, /(?:margin|padding)(?:Horizontal|Left|Right|Start|End)?\s*:/, `${name} must not add a page-level horizontal gutter`);
}

assertNoPageInset(recap, 'canonicalContent');
assert.doesNotMatch(styleBody(recap, 'tabs'), /margin(?:Horizontal|Left|Right|Start|End)?\s*:/, 'Reviewer tab rail must span the viewport');
assert.match(styleBody(recap, 'tabs'), /padding:\s*3/, 'Reviewer tab rail keeps its component-owned inset');
assert.match(recap, /<PlanCompareExperience edgeToEdge\b/, 'Reviewer Plan / Compare uses the edge-to-edge contract');
assert.match(recap, /<CoachTools review=\{coachReview\}/, 'Reviewer renders the canonical coach tools inside the edge-to-edge section contract');
assert.match(adapter, /<CompletedSessionRecap/, 'coach and athlete roles must share one post-Session runtime');

for (const name of ['sectionShell', 'compareFilters', 'compareMovementStack', 'comparisonLegend']) assertNoPageInset(recap, name);
assert.match(styleBody(recap, 'sessionReadCard'), /padding:\s*9/, 'Reviewer cards keep internal readable padding');
assert.match(styleBody(recap, 'executionCard'), /padding:\s*12/, 'Session Execution keeps internal readable padding');
assert.match(styleBody(recap, 'compareMovementHeader'), /padding:\s*10/, 'Movement cards keep internal readable padding');

assert.match(recap, /AnalyticalTimeSeriesChart/, 'Reviewer evidence uses the shared analytical chart');
assert.match(analyticalChart, /buildYAxisGutter\(yLabels, readableText \? 11 : 9\)/, 'Evidence charts allocate their Y-axis gutter from the rendered labels');
assert.match(analyticalChart, /onLayout=\{\(event\) => setWidth\(Math\.max\(280, Math\.round\(event\.nativeEvent\.layout\.width\)\)\)\}/, 'Evidence charts expand from actual available width');
assert.match(analyticalChart, /Math\.min\(Math\.max\(4, selectedDate\.x - tooltipWidth \/ 2\), Math\.max\(4, width - tooltipWidth - 4\)\)/, 'Evidence chart tooltips remain clamped to the available width');

assertNoPageInset(calendar, 'monthContent');
assertNoPageInset(calendar, 'agendaContent');
assertNoPageInset(teamBrief, 'content');

for (const viewport of [375, 390, 430]) {
  const reviewerSurfaceWidth = viewport;
  const nestedPlanSurfaceWidth = reviewerSurfaceWidth;
  assert.equal(reviewerSurfaceWidth, viewport, `${viewport}px Reviewer cards must use the full viewport width`);
  assert.equal(nestedPlanSurfaceWidth, viewport, `${viewport}px Plan / Compare cards must not add a second gutter`);
}

console.log('Coach Session Reviewer viewport-utilization contract passed');
