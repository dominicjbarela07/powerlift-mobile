import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  isAthleteHomePayloadCurrent,
  isQualifyingSameDayPrHero,
  resolveHomeState,
} from '../lib/athlete-home-v3.ts';
import { resolveCalendarToday } from '../lib/calendar-today.ts';

const today = '2026-09-03';
const validAchievement = { id: 501, workout_id: 33, workout_date: today };
const validProjection = {
  projection_version: 'athlete-home-v3',
  state: {
    kind: 'achievement',
    evidence: {
      qualifying_same_day_pr: true,
      same_day_pr_count: 1,
      same_day_pr_id: 501,
      same_day_pr_workout_id: 33,
      performed_date: today,
    },
  },
  hero: { achievement: validAchievement },
  week: { days: [{ date: today, is_today: true, kind: 'completed' }] },
};

assert.equal(isQualifyingSameDayPrHero(validProjection, today), true);
assert.equal(resolveHomeState(validProjection, today), 'achievement', 'valid same-day Session PR celebrates');

const invalidCases = [
  ['yesterday had qualifying PR, today is rest', { performed_date: '2026-09-02' }, null, 'rest'],
  ['yesterday PR, today scheduled Session', { performed_date: '2026-09-02' }, { id: 44, date: today, status: 'assigned' }, 'training'],
  ['lifetime PR is not today evidence', { qualifying_same_day_pr: false }, null, 'rest'],
  ['completed today with zero PRs', { qualifying_same_day_pr: false, same_day_pr_count: 0 }, { id: 33, date: today, status: 'completed' }, 'training'],
  ['latest historical Session PR is not today', { performed_date: '2026-09-02' }, null, 'rest'],
  ['incomplete Session cannot manufacture a PR', { qualifying_same_day_pr: false }, { id: 33, date: today, status: 'in_progress' }, 'training'],
  ['PR count must be positive', { same_day_pr_count: 0 }, { id: 33, date: today, status: 'completed' }, 'training'],
  ['PR id must match rendered evidence', { same_day_pr_id: 999 }, { id: 33, date: today, status: 'completed' }, 'training'],
  ['PR Session must match rendered evidence', { same_day_pr_workout_id: 999 }, { id: 33, date: today, status: 'completed' }, 'training'],
  ['missing PR identity fails closed', { same_day_pr_id: null, same_day_pr_workout_id: null }, null, 'rest'],
];

for (const [label, evidenceChanges, session, expected] of invalidCases) {
  const projection = {
    ...validProjection,
    state: { kind: 'achievement', evidence: { ...validProjection.state.evidence, ...evidenceChanges } },
    hero: { achievement: validAchievement, session },
    week: { days: [{ date: today, is_today: true, kind: session ? session.status : 'empty' }] },
  };
  assert.equal(isQualifyingSameDayPrHero(projection, today), false, label);
  assert.equal(resolveHomeState(projection, today), expected, label);
}

const twoSessionProjection = {
  ...validProjection,
  state: { kind: 'achievement', evidence: { ...validProjection.state.evidence, same_day_pr_count: 2 } },
};
assert.equal(resolveHomeState(twoSessionProjection, today), 'achievement', 'two completed Sessions with linked PR evidence remain eligible');

const recoveryProjection = {
  state: { kind: 'achievement', evidence: { recovery_event: true } },
  hero: { achievement: null },
  week: { days: [{ date: today, is_today: true, kind: 'recovery' }] },
};
assert.equal(resolveHomeState(recoveryProjection, today), 'recovery', 'optional readiness/recovery semantics survive invalid history');

const screenshotFixture = {
  state: { kind: 'achievement', evidence: { fresh_achievement_id: 777 } },
  hero: {
    achievement: {
      id: 777,
      event_type: 'CORE_MOVEMENT_SESSION_COMPLETED',
      movement_label: 'Competition Squat',
      current_value: 3,
      unit: 'sets',
      workout_id: 22,
      workout_date: '2026-09-02',
    },
  },
  week: { days: [
    { date: '2026-08-31', kind: 'completed' },
    { date: '2026-09-01', kind: 'completed' },
    { date: '2026-09-02', kind: 'completed' },
    { date: today, kind: 'empty', is_today: true },
    { date: '2026-09-04', kind: 'session' },
  ] },
  next_up: { id: 23, title: 'W6 Back', date: '2026-09-04', status: 'assigned' },
  last_session: { id: 22, title: 'W6 Legs', date: '2026-09-02', status: 'completed' },
};
assert.equal(resolveHomeState(screenshotFixture, today), 'rest');
assert.equal(screenshotFixture.week.days.find((day) => day.date === today).kind, 'empty');
assert.equal(screenshotFixture.next_up.title, 'W6 Back');
assert.equal(screenshotFixture.last_session.title, 'W6 Legs');

const rolloverInstant = new Date('2026-09-04T04:30:00.000Z');
assert.equal(resolveCalendarToday(rolloverInstant, 'America/New_York', 'UTC').date, '2026-09-04');
assert.equal(isAthleteHomePayloadCurrent({ date: today, timezone: 'America/New_York' }, rolloverInstant, 'UTC'), false, 'prior-day cached hero expires at athlete midnight');
assert.equal(isAthleteHomePayloadCurrent({ date: '2026-09-04', timezone: 'America/New_York' }, rolloverInstant, 'UTC'), true);

const boundaryInstant = new Date('2026-09-03T06:30:00.000Z');
assert.equal(resolveCalendarToday(boundaryInstant, 'America/Los_Angeles', 'America/New_York').date, '2026-09-02', 'athlete timezone wins when UTC/device dates differ');

const [screen, route] = await Promise.all([
  readFile(new URL('../components/home/AthleteHomeV3.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../app/(tabs)/athlete-dashboard.tsx', import.meta.url), 'utf8'),
]);
assert.match(screen, /resolveHomeState\(home, today\.date\)/, 'render selection is scoped to the payload day');
assert.match(screen, /PR Day! 🎉/, 'legitimate same-day PR visual language is preserved');
assert.doesNotMatch(screen, />[^<{]*\bworkout\b[^<{]*</i, 'new Training Hub copy preserves Session language');
assert.match(route, /isAthleteHomePayloadCurrent\(cached\)/, 'rehydration rejects a prior-day payload');
assert.match(route, /setInterval\(invalidateAtDateRollover, 30_000\)/, 'foreground date rollover invalidates stale Today state');
assert.match(route, /cache: 'no-store'/, 'network refresh remains uncached');

console.log('Training Hub same-day PR hero, screenshot fixture, timezone, and rollover contracts passed.');
