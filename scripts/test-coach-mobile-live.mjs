import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  coachKpiAthletes,
  coachTodaySessions,
  deriveCoachHomeFromRoster,
  filterCoachRosterV2,
} from '../lib/coach-mobile-v2.ts';

const paths = {
  homeRoute: 'app/(tabs)/coach-dashboard.tsx',
  home: 'components/coach-mobile/CoachHomeV2.tsx',
  hubSheet: 'components/coach-mobile/CoachAthleteHubSheet.tsx',
  rosterRoute: 'app/(tabs)/coach-roster.tsx',
  roster: 'components/coach-mobile/CoachRosterV2.tsx',
  hubRoute: 'app/(tabs)/coach-athlete/[athleteId].tsx',
  hub: 'components/coach-mobile/CoachAthleteHubV2.tsx',
  detailRoute: 'app/(tabs)/coach-attention/[athleteId].tsx',
  detail: 'components/coach-mobile/CoachAttentionDetailV2.tsx',
  more: 'app/(tabs)/coach-more.tsx',
  tabs: 'app/(tabs)/_layout.tsx',
  shipping: 'lib/shipping-navigation.ts',
  contract: 'lib/coach-mobile.ts',
};
const source = Object.fromEntries(await Promise.all(Object.entries(paths).map(async ([key, path]) => [
  key,
  await readFile(new URL(`../${path}`, import.meta.url), 'utf8'),
])));
const backend = await readFile(new URL('../../app/blueprints/main.py', import.meta.url), 'utf8');
const operatingModel = await readFile(new URL('../../app/services/coach_mobile_operating_model.py', import.meta.url), 'utf8');

for (const name of ['homeRoute', 'home', 'hubSheet', 'rosterRoute', 'roster', 'hubRoute', 'hub', 'detailRoute', 'detail', 'more']) {
  const value = source[name];
  assert.doesNotMatch(value, /@\/dev-mocks\//, `${name} must not import DEV fixtures.`);
}

assert.match(source.homeRoute, /<CoachHomeV2/);
assert.match(source.home, /fetchJson\('\/coach\/mobile\/home'/);
assert.match(source.home, /fetchJson\('\/coach\/mobile\/roster'/);
assert.match(source.home, /deriveCoachHomeFromRoster/);
for (const section of ['Your Athletes at a Glance', 'Today’s Sessions', 'Recent Activity Feed']) assert.match(source.home, new RegExp(section));
for (const label of ['Sessions', 'Reviews', 'Programming', 'Check-Ins']) assert.match(source.home, new RegExp(`label="${label}"`));
assert.doesNotMatch(source.home, /title="Needs Your Attention"/);
assert.match(source.home, /horizontal showsHorizontalScrollIndicator=\{false\}/);
assert.match(source.home, /<CoachAthleteHubSheet[\s\S]*?athlete=\{selectedAthlete\}/);
assert.match(source.home, /<CoachKpiSheet/);
assert.match(source.home, /accountKeyRef\.current === requestAccount/);

assert.match(source.hubSheet, /presentationStyle="overFullScreen"/);
assert.match(source.hubSheet, /\/coach\/mobile\/athletes\/\$\{athlete\.id\}\/summary/);
assert.match(source.hubSheet, /\/workouts\/mobile\/\$\{completedId\}\?view=coach-preview/);
for (const action of ['Message', 'Program', 'Schedule', 'Notes', 'More']) assert.match(source.hubSheet, new RegExp(`label="${action}"|label: '${action}'`));
for (const section of ['Current Status', 'Last Session', 'Recent Highlights', 'Notes & Next Steps']) assert.match(source.hubSheet, new RegExp(section));
assert.match(source.hubSheet, /performed_movements\.slice\(0, 4\)/);
assert.match(source.hubSheet, /openCoachDestination\(router, primaryReason\.destination\)/);
assert.match(source.hubSheet, /onClose\(\);[\s\S]*router\.push/);

assert.match(source.rosterRoute, /<CoachRosterV2/);
assert.match(source.roster, /fetchJson\('\/coach\/mobile\/roster'/);
assert.match(source.roster, /<FlatList/);
assert.match(source.roster, /initialNumToRender=\{12\}/);
assert.match(source.roster, /windowSize=\{9\}/);
assert.match(source.roster, /Alphabetical athlete navigation/);
assert.doesNotMatch(source.roster, /Swipeable|onLongPress/, 'Primary roster navigation must be tap-first.');
for (const filter of ["'all'", "'needs_attention'", "'programming'", "'active'"]) assert.match(source.roster, new RegExp(filter));

assert.match(source.hubRoute, /<CoachAthleteHubV2/);
assert.match(source.hub, /\/coach\/mobile\/athletes\/\$\{athleteId\}\/summary/);
for (const section of ['What Needs You', 'Current Training', 'Recent Signals', 'Recent Training']) assert.match(source.hub, new RegExp(section));
for (const action of ['Message', 'Program', 'Review', 'More']) assert.match(source.hub, new RegExp(`label: '${action}'`));
assert.ok(source.hub.indexOf('What Needs You') < source.hub.indexOf('Current Training'));
assert.ok(source.hub.indexOf('Current Training') < source.hub.indexOf('Recent Signals'));
assert.ok(source.hub.indexOf('Recent Signals') < source.hub.indexOf('Recent Training'));
assert.match(source.hub, /reported_bodyweight/);
assert.match(source.hub, /week_summary/);

assert.match(source.detailRoute, /<CoachAttentionDetailV2/);
assert.match(source.detail, /Recommended Action/);
assert.match(source.detail, /Recent Readiness Trend/);
assert.match(source.detail, /Last Session/);
assert.match(source.detail, /openCoachDestination\(router, reason\.destination\)/);

assert.match(source.shipping, /'coach-dashboard',[\s\S]*'coach-calendar',[\s\S]*'messages\/index',[\s\S]*'coach-more'/);
assert.doesNotMatch(source.shipping, /SHIPPING_COACH_TAB_ROUTES\s*=\s*\[[\s\S]*?'coach-roster'/);
assert.match(source.home, /onAction=\{\(\) => router\.push\('\/\(tabs\)\/coach-roster'\)\} title="Your Athletes at a Glance"/);
assert.match(source.roster, /router\.canGoBack\(\)[\s\S]*?router\.back\(\)[\s\S]*?coach-dashboard/);
assert.match(source.tabs, /name="coach-roster"[\s\S]*?href: null/);
assert.match(source.tabs, /name="coach-calendar"[\s\S]*?\/\(tabs\)\/coach-calendar/);
assert.match(source.tabs, /forceExpandedCoachNavigation/);
assert.match(source.tabs, /name="coach-attention\/\[athleteId\]"/);
assert.match(source.tabs, /name="coach-more"/);

assert.match(backend, /@main_bp\.route\("\/coach\/mobile\/home"/);
assert.match(backend, /if user\.role != "coach"/);
assert.match(backend, /_filtered_coach_athlete_query\(user\.id, coach_preferences\)/);
assert.match(backend, /build_coach_mobile_home\(model\)/);
assert.match(operatingModel, /HOME_ATTENTION_LIMIT = 3/);
assert.match(operatingModel, /HOME_ACTIVITY_LIMIT = 4/);
assert.match(operatingModel, /PRE_SESSION_READINESS/);
assert.match(operatingModel, /evidence_mode/);

const sampleAthletes = [
  {
    id: 1,
    name: 'Amanda Athlete',
    status: { classification: 'needs_attention' },
    queue_membership: ['all', 'needs_attention', 'programming'],
    current_training: { status: 'active' },
    recent_training: [{ workout_id: 9, date: '2026-08-14', evidence_mode: 'performed' }],
  },
  {
    id: 2,
    name: 'Blake Athlete',
    status: { classification: 'on_track' },
    queue_membership: ['all'],
    current_training: { status: 'no_active_program' },
    recent_training: [],
  },
];
assert.deepEqual(filterCoachRosterV2(sampleAthletes, 'programming').map((row) => row.id), [1]);
assert.deepEqual(filterCoachRosterV2(sampleAthletes, 'active').map((row) => row.id), [1]);
assert.deepEqual(filterCoachRosterV2(sampleAthletes, 'all', 'blake').map((row) => row.id), [2]);

const home = deriveCoachHomeFromRoster({
  ok: true,
  athletes: sampleAthletes,
  counts: { all: 2, needs_attention: 1, programming: 1, reviews: 0, messages: 0, check_ins: 0 },
  needs_attention: [{ athlete_id: 1, reason: {} }],
  needs_attention_total: 1,
  attention_cap: 6,
  generated_at: '2026-08-14T00:00:00',
});
assert.equal(home.attention_athletes.length, 1);
assert.equal(home.recent_activity.length, 1);
assert.equal(home.summary.needs_you, 1);
assert.equal(home.athletes.length, 2);
assert.equal(coachTodaySessions(sampleAthletes, new Date(2026, 7, 14)).length, 1);
assert.deepEqual(coachKpiAthletes(sampleAthletes, 'programming').map((row) => row.id), [1]);
assert.deepEqual(coachKpiAthletes(sampleAthletes, 'sessions', new Date(2026, 7, 14)).map((row) => row.id), [1]);

console.log('coach mobile athlete-first V2 live contract: PASS');
