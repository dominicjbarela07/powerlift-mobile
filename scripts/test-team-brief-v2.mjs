import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { presentTeamBriefHighlight } from '../lib/team-brief-highlights.ts';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const brief = read('app/coach-team-brief.tsx');
const outliers = read('app/coach-team-outliers.tsx');
const deepDive = read('app/coach-athlete-analytics/[athleteId].tsx');
const methodology = read('app/coach-team-methodology.tsx');
const athleteWorkspace = read('components/coach-mobile/CoachAthleteHubV2.tsx');
const tabs = read('app/(tabs)/_layout.tsx');
const root = read('app/_layout.tsx');
const api = read('lib/coach-mobile.ts');

assert.match(tabs, /rightAction=\{viewMode === 'coach' \? \{[\s\S]*accessibilityLabel: 'Open Team Brief'[\s\S]*icon: 'reader-outline'[\s\S]*router\.push\('\/coach-team-brief'/);
assert.doesNotMatch(tabs, /isCoachHomePath|accessibilityLabel: 'Open Coach Calendar'/);
assert.match(brief, /router\.canGoBack\(\) \? router\.back\(\) : router\.replace\('\/\(tabs\)\/coach-dashboard'\)/);
assert.match(brief, /<SLContextualHeader[\s\S]*backAccessibilityLabel="Close Team Brief"[\s\S]*onBack=\{close\}[\s\S]*title="Team Brief"/);
assert.match(brief, /action=\{\{ accessibilityLabel: 'Open Team Brief methodology', icon: 'reader-outline'/);
assert.match(brief, /<SLCompactTabRail[\s\S]*items=\{PERIODS\.map/);
assert.doesNotMatch(brief, /headerSpacer|styles\.periodRail/, 'Team Brief must not restore the retired centered shell or undersized custom period rail.');

assert.match(brief, /\['7D', '4W', '12W', '6M', 'YTD', 'ALL'\]/);
assert.match(brief, /\/coach\/mobile\/team-brief\?period=/);
for (const section of [
  'TEAM SNAPSHOT',
  'PROGRESS OVER TIME',
  'TEAM LIFTS & PERFORMANCE',
  'OUTLIERS',
  'ATHLETE MATRIX',
  'COACHING IMPACT',
  'RECENT HIGHLIGHTS',
  'CONTEXT',
]) {
  assert.match(brief, new RegExp(section.replace(/[&]/g, '\\&')));
}
assert.match(brief, /TeamTrendChart/);
assert.match(deepDive, /CoachAnalyticsTrend/);
assert.match(brief, /coach-team-outliers/);
assert.match(brief, /coach-athlete-analytics\/\[athleteId\]/);
assert.match(brief, /coach-team-methodology/);

assert.match(outliers, /All.*Below.*Above/s);
assert.match(outliers, /Cohort too small for outlier claims/);
assert.match(deepDive, /Progress vs Team/);
assert.match(deepDive, /team-relative-analytics\?period=/);
assert.match(deepDive, /Potential factors/);
assert.match(deepDive, /Open Athlete Workspace/);
assert.match(deepDive, /\/\(tabs\)\/coach-athlete\/\[athleteId\]/);
assert.match(brief, /action="View all" index="4"/);
assert.match(methodology, /Object\.entries\(brief\.methodology\)/);
assert.match(methodology, /does not attribute athlete outcomes causally/);

assert.match(athleteWorkspace, /summary\?view=v3&period=\$\{period\}/);
assert.match(athleteWorkspace, /CoachAnalyticsTrend/);
assert.match(athleteWorkspace, /workspace_v3/);
assert.doesNotMatch(athleteWorkspace, /team-relative-analytics/, 'Athlete Workspace must use the bounded additive summary projection.');

for (const route of ['coach-team-brief', 'coach-team-outliers', 'coach-team-methodology']) {
  assert.match(root, new RegExp(`name="${route}"`));
}
assert.match(root, /name="coach-athlete-analytics\/\[athleteId\]"/);

assert.match(api, /CoachAnalyticsMetricKey/);
assert.match(api, /series_by_metric/);
assert.match(api, /cohort_band_supported/);
assert.doesNotMatch(brief, /\+12\.7|28,450|94%|412\s+SETS/);
assert.match(brief, /presentTeamBriefHighlight/);
assert.match(brief, /row\.destination && router\.push/);
assert.doesNotMatch(brief, /recorded a PR/);

const evidenceRow = {
  key: 'core-pr:1', type: 'pr', title: 'Dominic Barela · Competition Squat',
  pr_type: 'LOAD PR', preferred_units: 'lbs', occurred_at: '2026-08-26',
  current_performance: { weight_kg: 183.7049, reps: 3, rpe: 7 },
  prior_performance: { weight_kg: 174.633, reps: 3, rpe: 7 },
  delta: 9.0719, unit: 'kg', record_count: 2,
};
const evidenceCopy = presentTeamBriefHighlight(evidenceRow);
assert.equal(evidenceCopy.title, 'Dominic Barela · Competition Squat');
assert.equal(evidenceCopy.primary, '405 lb × 3 reps @7 RPE');
assert.equal(evidenceCopy.comparison, 'Previous: 385 lb × 3 reps @7 RPE · +20 lb');
assert.equal(evidenceCopy.date, 'Aug 26');

const kgCopy = presentTeamBriefHighlight({
  ...evidenceRow, preferred_units: 'kg', pr_type: 'e1RM PR',
  current_value: 148.3, prior_value: 143.3, delta: 5,
});
assert.match(kgCopy.primary, /183\.7 kg × 3 reps @7 RPE/);
assert.equal(kgCopy.comparison, 'Previous: 174.6 kg × 3 reps @7 RPE · e1RM 148.3 kg · Previous 143.3 kg · +5 kg');

const rirCopy = presentTeamBriefHighlight({
  ...evidenceRow, title: 'Amanda LeFore · Pull-Up', pr_type: '10-REP PR', first_record: true,
  current_performance: { weight_kg: 11.3398, reps: 10, rir: 1 }, prior_performance: null,
});
assert.equal(rirCopy.primary, '25 lb × 10 reps @1 RIR');
assert.equal(rirCopy.comparison, 'First recorded best');

console.log('[team-brief-v2] PASS — global entry, evidence-rich grouped PR highlights, route action, eight sections, outliers, deep dive, and Athlete Workspace team context');
