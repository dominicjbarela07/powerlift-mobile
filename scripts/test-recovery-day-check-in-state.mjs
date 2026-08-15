import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { mergeCanonicalDailyReadiness } from '../lib/daily-readiness-home.ts';

const canonicalObservation = {
  id: 41,
  athlete_id: 7,
  date: '2026-08-15',
  training_date: '2026-08-15',
  workout_id: null,
  context: 'daily_check_in',
  submitted_at: '2026-08-15T16:12:00',
  energy: 4,
  soreness: 2,
  stress: 2.5,
  sleep_hours: 8,
  bodyweight_kg: 84,
  readiness_score: 4.25,
};

const initial = {
  date: '2026-08-15',
  readiness: { score: null, latest: null, metrics: null, message: 'No check-in yet.' },
  daily_check_in: null,
  capabilities: { can_daily_check_in: true, has_daily_check_in: false },
  daily_check_in_action: { kind: 'daily_check_in', label: 'Check In', route: 'daily_readiness' },
};

const completed = mergeCanonicalDailyReadiness(initial, canonicalObservation);
assert.notStrictEqual(completed, initial, 'The persisted row must immediately refresh Home state.');
assert.equal(completed.daily_check_in?.id, canonicalObservation.id);
assert.equal(completed.daily_check_in?.bodyweight_kg, 84);
assert.equal(completed.capabilities?.has_daily_check_in, true);
assert.equal(completed.capabilities?.can_daily_check_in, true, 'A recorded Recovery Day check-in remains editable.');
assert.equal(completed.readiness?.latest?.id, canonicalObservation.id);
assert.equal(completed.daily_check_in_action?.kind, 'view_daily_check_in');
assert.equal(completed.daily_check_in_action?.route, 'daily_readiness');

const edited = mergeCanonicalDailyReadiness(completed, {
  ...canonicalObservation,
  energy: 3,
  bodyweight_kg: null,
});
assert.equal(edited.daily_check_in?.id, canonicalObservation.id, 'Same-day edits must update the canonical row.');
assert.equal(edited.daily_check_in?.energy, 3);
assert.equal(edited.daily_check_in?.bodyweight_kg, null, 'Skipped bodyweight must remain absent.');

assert.strictEqual(
  mergeCanonicalDailyReadiness(initial, { ...canonicalObservation, training_date: '2026-08-14', date: '2026-08-14' }),
  initial,
  'A different training-date observation must never mark today complete.',
);
assert.strictEqual(
  mergeCanonicalDailyReadiness(initial, { ...canonicalObservation, workout_id: 88, context: 'session_check_in' }),
  initial,
  'Session readiness must never become the Recovery Day completion state.',
);

const dashboardSource = await readFile(
  new URL('../app/(tabs)/athlete-dashboard.tsx', import.meta.url),
  'utf8',
);
const homeSource = await readFile(
  new URL('../components/home/TodayHomeExperience.tsx', import.meta.url),
  'utf8',
);

assert.match(
  dashboardSource,
  /response\.json\?\.readiness_survey[\s\S]*mergeCanonicalDailyReadiness\(currentToday, savedObservation\)[\s\S]*setToday\(refreshedToday\)[\s\S]*loadToday/,
  'Home must hydrate immediately from the persisted API row and then reconcile with the dashboard.',
);
assert.match(
  dashboardSource,
  /cache: 'no-store'[\s\S]*'Cache-Control': 'no-cache'/,
  'Dashboard reconciliation must not reuse a cached pre-save response.',
);
assert.match(
  homeSource,
  /CHECK-IN RECORDED[\s\S]*bodyweightKgToDisplay\(observation\.bodyweight_kg, unit\)[\s\S]*Saved today/,
  'Recorded-state presentation must use the observation bodyweight and show same-day confirmation.',
);
assert.doesNotMatch(
  homeSource,
  /bodyweightKgToDisplay\(today\.athlete\?\.bodyweight_kg,[\s\S]{0,120}Saved today/,
  'Recovery confirmation must not substitute profile bodyweight.',
);

console.log('Recovery Day canonical check-in completion contract passed.');
