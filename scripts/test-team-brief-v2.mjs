import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

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
assert.match(brief, /accessibilityLabel="Close Team Brief"[\s\S]*onPress=\{close\}/);

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

assert.match(athleteWorkspace, /team-relative-analytics\?period=4W/);
assert.match(athleteWorkspace, /title="Progress vs Team"/);
assert.match(athleteWorkspace, /coach-athlete-analytics\/\[athleteId\]/);

for (const route of ['coach-team-brief', 'coach-team-outliers', 'coach-team-methodology']) {
  assert.match(root, new RegExp(`name="${route}"`));
}
assert.match(root, /name="coach-athlete-analytics\/\[athleteId\]"/);

assert.match(api, /CoachAnalyticsMetricKey/);
assert.match(api, /series_by_metric/);
assert.match(api, /cohort_band_supported/);
assert.doesNotMatch(brief, /\+12\.7|28,450|94%|412\s+SETS/);

console.log('[team-brief-v2] PASS — global entry, real period projection, eight sections, outliers, deep dive, and Athlete Workspace team context');
