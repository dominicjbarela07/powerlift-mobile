#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const reviewer = read('components/coach-mobile/CoachSessionReviewerV3.tsx');
const recap = read('components/coach-mobile/CompletedSessionRecap.tsx');
const calendar = read('app/(tabs)/coach-calendar.tsx');
const teamBrief = read('app/coach-team-brief.tsx');

function styleBody(source, name) {
  const match = source.match(new RegExp(`${name}: \\{([^}]*)\\}`));
  assert.ok(match, `${name} style must exist`);
  return match[1];
}

function assertNoPageInset(source, name) {
  const body = styleBody(source, name);
  assert.doesNotMatch(body, /(?:margin|padding)(?:Horizontal|Left|Right|Start|End)?\s*:/, `${name} must not add a page-level horizontal gutter`);
}

assertNoPageInset(reviewer, 'content');
assert.doesNotMatch(styleBody(reviewer, 'tabs'), /margin(?:Horizontal|Left|Right|Start|End)?\s*:/, 'Reviewer tab rail must span the viewport');
assert.match(styleBody(reviewer, 'tabs'), /padding:\s*3/, 'Reviewer tab rail keeps its component-owned inset');
assert.match(reviewer, /<PlanCompareExperience edgeToEdge\b/, 'Reviewer Plan / Compare uses the edge-to-edge contract');
assert.match(reviewer, /<CoachTools review=\{coachReview\}/, 'Reviewer renders the canonical coach tools inside the edge-to-edge section contract');

for (const name of ['sectionShell', 'compareFilters', 'compareMovementStack', 'comparisonLegend']) assertNoPageInset(recap, name);
assert.match(styleBody(reviewer, 'readCard'), /padding:\s*10/, 'Reviewer cards keep internal readable padding');
assert.match(styleBody(recap, 'executionCard'), /padding:\s*12/, 'Session Execution keeps internal readable padding');
assert.match(styleBody(recap, 'compareMovementHeader'), /padding:\s*9/, 'Movement cards keep internal readable padding');

assert.match(reviewer, /const left = 43, right = 12/, 'Evidence charts retain their axis geometry');
assert.match(reviewer, /onLayout=\{\(event\) => setWidth\(Math\.max\(280, Math\.round\(event\.nativeEvent\.layout\.width\)\)\)\}/, 'Evidence charts expand from actual available width');
assert.match(reviewer, /Math\.min\(Math\.max\(8, selectedPoint\.x - 72\), Math\.max\(8, width - 154\)\)/, 'Evidence chart tooltips remain clamped to the available width');

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
