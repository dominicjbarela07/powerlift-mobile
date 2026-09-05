#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';

const surface = fs.readFileSync('components/coach-mobile/CompletedSessionRecap.tsx', 'utf8');
const chart = fs.readFileSync('components/charts/AnalyticalTimeSeriesChart.tsx', 'utf8');
const fixture = fs.readFileSync('app/dev-session-recap-certification.tsx', 'utf8');
const shell = fs.readFileSync('lib/post-session-shell.ts', 'utf8');
const activeSurface = surface.split('/* Retired athlete-recap renderer')[0];

function styleBody(source, name) {
  const match = source.match(new RegExp(`\\b${name}: \\{([^}]*)\\}`));
  assert.ok(match, `${name} style must exist`);
  return match[1];
}

function fontSize(source, name) {
  const size = styleBody(source, name).match(/fontSize: ([0-9.]+)/);
  assert.ok(size, `${name} must declare a font size`);
  return Number(size[1]);
}

const orderedMarkers = [
  'post-session-overview-result-hero',
  'post-session-overview-comparison-card',
  'post-session-overview-recovery-card',
  'post-session-overview-reflection-card',
  'overviewNextActions',
];
let priorIndex = -1;
for (const marker of orderedMarkers) {
  const index = activeSurface.indexOf(marker);
  assert.ok(index > priorIndex, `${marker} must preserve the conclusion-led Overview story order`);
  priorIndex = index;
}

assert.match(activeSurface, /styles\.canonicalHero[\s\S]*ref=\{tabsScrollRef\}[\s\S]*tab === 'overview' \? <><SessionReadOverview/, 'the redesigned Overview must render inside the stable canonical shell');
assert.match(activeSurface, /<Text style=\{styles\.topSubtitle\}>Post-Session Review<\/Text>/, 'the header must identify the canonical Post-Session surface');
assert.match(activeSurface, /EVIDENCE LENSES/, 'deeper evidence lenses must remain reachable from the header menu');
assert.match(shell, /viewerMode === 'coach' \? \[\{ key: 'coach'/, 'Coach tools must remain role-gated');

for (const marker of ['SESSION RESULT', 'Good Session', 'improved ·', 'stable ·', 'declined', 'Duration', 'Sets logged']) {
  assert.ok(activeSurface.includes(marker), `Session result hero is missing ${marker}`);
}
assert.doesNotMatch(activeSurface, /WHAT CHANGED SINCE LAST COMPARABLE SESSION/, 'the flat comparison matrix heading must remain retired');
for (const marker of ['SINCE ', "'More Work'", "'Similar Effort'", 'Total volume', 'Sets completed', 'Average effort', 'MOVEMENT OUTCOMES', 'Biggest progression']) {
  assert.ok(activeSurface.includes(marker), `comparison story is missing ${marker}`);
}
assert.match(activeSurface, /CanonicalMovementArtwork movement=\{strongestMovement\}/, 'biggest progression must use governed canonical movement artwork');
assert.match(activeSurface, /formatMovementPerformanceComparison\(compareMovementPerformance/, 'biggest progression must retain assisted-load comparison semantics');

for (const marker of ['RECOVERY CONTEXT', 'Near normal heading into this Session', 'Readiness', 'Sleep', 'Stress', 'Energy', 'Soreness', 'Last 30 days']) {
  assert.ok(activeSurface.includes(marker), `recovery story is missing ${marker}`);
}
assert.match(activeSurface, /largeReadableText/, 'the Overview chart must opt into large axis and tooltip text');
assert.match(activeSurface, /selectedInitially="latest"/, 'the latest recovery observation must be selected');
assert.match(activeSurface, /meta: \{ current: true \}/, 'the recovery plot must synthesize a current point when the backend trend omits it');

for (const marker of ['ATHLETE REFLECTION', 'Aligned with your recent Sessions.', 'View in Ledger', 'View on Calendar']) {
  assert.ok(activeSurface.includes(marker), `Overview ending is missing ${marker}`);
}

const overviewTextMinimums = {
  topSubtitle: 16,
  overviewKicker: 16,
  overviewOutcomeSummary: 17,
  overviewNarrative: 17,
  overviewHeroEvidenceLabel: 16,
  overviewSectionSupport: 17,
  overviewComparisonLabel: 18,
  overviewComparisonDetail: 16,
  overviewSubsectionKicker: 16,
  overviewComparableCount: 16,
  overviewOutcomeLabel: 18,
  overviewProgressionKicker: 16,
  overviewProgressionDetail: 17,
  overviewBaselineBody: 16,
  overviewRecoveryKicker: 16,
  overviewRecoveryPillText: 16,
  overviewRecoveryMetricLabel: 18,
  overviewRecoveryMetricDetail: 16,
  overviewRecoveryChartTitle: 18,
  overviewRecoveryChartRange: 16,
  overviewReflectionKicker: 16,
  overviewReflectionDetail: 16,
  actionButtonText: 16,
};
for (const [name, minimum] of Object.entries(overviewTextMinimums)) {
  assert.ok(fontSize(surface, name) >= minimum, `${name} must be at least ${minimum}pt`);
}
for (const [name, minimum] of Object.entries({
  overviewMajorConclusion: 30,
  overviewSectionConclusion: 22,
  overviewComparisonValue: 22,
  overviewProgressionMovement: 22,
  overviewReflectionValue: 22,
})) assert.ok(fontSize(surface, name) >= minimum, `${name} must preserve conclusion hierarchy`);

assert.match(chart, /largeReadableText \? 16 : readableText \? 11 : 9/, 'large chart axes must render at 16pt');
for (const name of ['emptyBodyLarge', 'tooltipDateLarge', 'tooltipLabelLarge', 'tooltipMetaLarge']) {
  assert.ok(fontSize(chart, name) >= 16, `${name} must be at least 16pt`);
}

assert.doesNotMatch(styleBody(surface, 'canonicalContent'), /(?:margin|padding)(?:Horizontal|Left|Right|Start|End)?\s*:/, 'Overview must not add a page-level horizontal gutter');
for (const name of ['overviewSessionHero', 'overviewComparisonCard', 'overviewRecoveryCard', 'overviewReflectionCard']) {
  assert.doesNotMatch(styleBody(surface, name), /marginHorizontal/, `${name} must span the viewport`);
}
assert.match(styleBody(surface, 'actionButton'), /minHeight: 62/, 'bottom actions must remain large tap targets');

for (const state of ['Baseline building', 'Duration baseline started']) assert.ok(activeSurface.includes(state), `${state} must be an intentional Overview null state`);
assert.doesNotMatch(activeSurface.slice(activeSurface.indexOf('function SessionReadOverview'), activeSurface.indexOf('function CoachReadOverview')), /No evidence|value=\"-\"|>−</, 'Overview null states must not expose broken placeholders');

for (const marker of [
  "params.scenario === 'visual'",
  "label: 'W6 Back'",
  "label: 'W5 Back'",
  "counts: { improved: 1, stable: 1, declined: 0 }",
  "load_convention: 'assistance_load'",
  "literal: '10 lb less assistance at matched reps & effort'",
  'duration_seconds: 4140',
  'set_count: 19',
]) assert.ok(fixture.includes(marker), `visual certification fixture is missing ${marker}`);

console.log('Post-Session Overview reference convergence, readable typography, semantic evidence, role gates, and null states: PASS');
