#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  canonicalMeetDate,
  coachMeetTimingLabel,
  coachScheduleItems,
  formatCoachMeetDate,
  normalizeCoachMeetContext,
} from '../lib/coach-meet-day.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');
const activityHome = read('components', 'coach-mobile', 'CoachActivityHome.tsx');
const hubSheet = read('components', 'coach-mobile', 'CoachAthleteHubSheet.tsx');
const fullHub = read('components', 'coach-mobile', 'CoachAthleteHubV2.tsx');
const coachCalendar = read('app', '(tabs)', 'coach-calendar.tsx');
const athleteCalendar = read('app', '(tabs)', 'athlete-calendar.tsx');
const athleteMeetPlan = read('app', '(tabs)', 'athlete-meet-plan.tsx');
const contract = read('lib', 'coach-mobile.ts');

const athlete = (id, meetContext = null) => ({
  id,
  name: `Athlete ${id}`,
  stable_sort_key: `athlete-${id}`,
  status: { classification: 'on_track', label: 'On Track', tone: 'success' },
  attention_reasons: [],
  queue_membership: ['all'],
  current_training: { status: 'active', label: 'Current Training' },
  unread_messages: { count: 0 },
  pending_video_reviews: { count: 0 },
  pending_session_reviews: { count: 0 },
  readiness: { label: 'Ready' },
  meet_context: meetContext,
});

const todayMeet = { meet_plan_id: 501, meet_name: 'State Championships', meet_date: '2026-09-03', days_until_meet: 0 };
const tomorrowMeet = { meet_plan_id: 502, meet_name: 'Autumn Open', meet_date: '2026-09-04', days_until_meet: 1 };
const boundaryMeet = { meet_plan_id: 503, meet_name: 'Boundary Invitational', meet_date: '2026-09-30', days_until_meet: 27 };
const session = {
  key: 'upcoming:91',
  date: '2026-09-03',
  athlete: { id: 1, name: 'Athlete 1' },
  title: 'Heavy Squat',
  destination: { route: '/(tabs)/workout', params: { workoutId: 91, athleteId: 1 } },
};

const oneMeet = coachScheduleItems([], [athlete(1, todayMeet)]);
assert.deepEqual(oneMeet.map((item) => item.key), ['meet:501'], 'an assigned athlete Meet Day must survive without an adjacent Session');
assert.equal(oneMeet[0].kind, 'meet');
assert.equal(oneMeet[0].athlete.id, 1);

const multiple = coachScheduleItems([], [athlete(1, todayMeet), athlete(2, tomorrowMeet), athlete(3, null)]);
assert.deepEqual(multiple.map((item) => [item.key, item.kind === 'meet' ? item.athlete.id : null]), [
  ['meet:501', 1],
  ['meet:502', 2],
], 'multiple authorized athletes must retain the correct MeetPlan association');

const unauthorizedAbsent = coachScheduleItems([], [athlete(1, todayMeet)]);
assert.equal(unauthorizedAbsent.some((item) => item.kind === 'meet' && item.athlete.id === 999), false, 'the client must not fabricate an athlete absent from the authorized roster payload');
assert.equal(coachScheduleItems([], [athlete(3, null)]).length, 0, 'an athlete without MeetPlan context must not gain a fabricated Meet Day');

const adjacent = coachScheduleItems([session], [athlete(1, todayMeet)]);
assert.deepEqual(adjacent.map((item) => item.kind), ['meet', 'session'], 'Meet Day and an adjacent Session must both be represented');
assert.equal(coachMeetTimingLabel(todayMeet), 'Today');
assert.equal(coachMeetTimingLabel(tomorrowMeet), 'Tomorrow');
assert.equal(normalizeCoachMeetContext(boundaryMeet)?.meet_date, '2026-09-30', 'an inclusive calendar-boundary date must survive normalization');

for (const timezone of ['UTC', 'Pacific/Kiritimati', 'America/Adak']) {
  process.env.TZ = timezone;
  assert.equal(canonicalMeetDate('2026-09-03'), '2026-09-03');
  assert.match(formatCoachMeetDate('2026-09-03'), /Sep 3, 2026/);
}
assert.equal(canonicalMeetDate('2026-02-30'), null, 'invalid dates must fail closed');
assert.equal(normalizeCoachMeetContext({ ...todayMeet, meet_plan_id: 0 }), null, 'missing stable MeetPlan identity must fail closed');

assert.match(contract, /meet_context\?: CoachMeetContext \| null/);
assert.match(contract, /export type CoachAthleteSummaryResponse[\s\S]*meet_context\?: CoachMeetContext \| null/);
assert.match(activityHome, /coachScheduleItems\(data\?\.coming_up \|\| \[\], athletes\)/);
assert.match(activityHome, /<MeetDayCard/);
assert.match(activityHome, /openAthlete\(item\.athlete\.id\)/);
assert.match(hubSheet, /details\?\.meet_context \|\| athlete\.meet_context/);
assert.match(hubSheet, /Open \$\{athlete\.name\} Meet Day in Calendar/);
assert.match(fullHub, /normalizeCoachMeetContext\(summary\?\.meet_context\)/);
assert.match(coachCalendar, /meets: \(day\.meets \|\| \[\]\)\.filter\(\(meet\) => athleteVisible\(meet\.athlete_id\)\)/);
assert.match(coachCalendar, /onMeet=\{openMeetDay\}/);
assert.doesNotMatch(coachCalendar, /group\.meets\.map\(\(meet\)[\s\S]{0,240}onPress=\{\(\) => \{\}\}/);
assert.match(coachCalendar, /router\.setParams\(\{ athleteId: undefined \}\)/, 'a Meet Day deep-open must select its authorized athlete without becoming sticky');

// The established athlete path remains the semantic authority and must not be
// replaced by the coach projection.
assert.match(athleteCalendar, /day\.meets \|\| \[\]/);
assert.match(athleteCalendar, /kind === 'meet'/);
assert.match(athleteMeetPlan, /hasMeetPlan = !!payload\?\.has_meet_plan && !!meet/);
assert.doesNotMatch(activityHome, /\/meet-planner\/mobile\/athlete\/current/, 'coach visibility must not impersonate the athlete-only Meet Packet endpoint');

console.log('Mobile coach Meet Day visibility, date integrity, navigation, and athlete parity: PASS');
