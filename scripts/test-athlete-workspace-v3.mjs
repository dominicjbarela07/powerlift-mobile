import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const workspace = read('components/coach-mobile/CoachAthleteHubV2.tsx');
const contract = read('lib/coach-mobile.ts');

assert.match(workspace, /summary\?view=v3&period=\$\{period\}/);
assert.doesNotMatch(workspace, /Promise\.all|team-relative-analytics/, 'The first useful render must use one bounded projection.');
for (const section of ['Athlete Read', 'Progress', 'MOVEMENT SIGNALS', 'Programming & Exposure', 'Recent Wins', 'Athlete Signals']) {
  assert.match(workspace, new RegExp(section));
}
for (const read of ['Progress', 'Readiness', 'Execution', 'Attention']) assert.match(workspace, new RegExp(`label="${read}"`));
for (const route of ['ledger/strength', 'ledger/muscle-groups', 'coach-session-review', 'session-workspace', 'coach-calendar', 'check-ins', 'messages']) assert.match(workspace, new RegExp(route));
assert.match(workspace, /ProgrammingMuscleRegionArt/);
assert.match(workspace, /AnalyticalTimeSeriesChart/);
assert.match(workspace, /athlete-workspace-readiness-chart/);
assert.match(contract, /prior_only_baseline/);
assert.match(workspace, /primary=.*secondary=/s);
assert.match(workspace, /StrengthLedgerBottomSheet/);
assert.match(workspace, /SLMotionPressable as Pressable/);
assert.match(workspace, /AthleteCoachingScratchpadTrigger/);
assert.match(workspace, /current_performance/);
assert.match(workspace, /prior_performance/);
assert.doesNotMatch(workspace, /recorded a PR|Completed Workout|Recent Activity/);

assert.match(contract, /workspace_v3\?: CoachAthleteWorkspaceV3/);
assert.match(contract, /comparison_policy: 'latest_vs_prior_only_baseline'/);
assert.match(contract, /causality_claimed: false/);

console.log('[athlete-workspace-v3] PASS — bounded projection, canonical analytics, evidence search, actionable reads, anatomy exposure, Session routes, and floating toolkit');
