import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { mergeAthleteHomeV3, resolveHomeState } from '../lib/athlete-home-v3.ts';
import {
  convertDisplayWeightValue,
  formatCompactVolumeValueFromKg,
  formatWeightFromKg,
} from '../lib/display-units.ts';

const baseToday = {
  date: '2026-08-15',
  phase: { meet: null },
  mission: { session: null },
  next_glance: { week: { logged: 2 } },
};

assert.equal(resolveHomeState({ state: { kind: 'meet' } }), 'meet');
assert.equal(resolveHomeState({ state: { kind: 'training' } }), 'training');
assert.equal(resolveHomeState({ state: { kind: 'achievement' } }), 'achievement');
assert.equal(resolveHomeState({ state: { kind: 'recovery' } }), 'recovery');
assert.equal(resolveHomeState({ state: { kind: 'rest' } }), 'rest');

const meet = mergeAthleteHomeV3({
  ...baseToday,
  phase: { meet: { id: 7, date: '2026-08-15', status: 'today' } },
  mission: { session: { id: 9, status: 'assigned', date: '2026-08-15' } },
}, {});
assert.equal(meet.home_v3.state.kind, 'meet', 'real meet-day context dominates the legacy fallback');

const training = mergeAthleteHomeV3({
  ...baseToday,
  mission: { session: { id: 9, status: 'in_progress', date: '2026-08-15', preview: { core_count: 2, accessory_count: 4 } } },
}, {});
assert.equal(training.home_v3.state.kind, 'training');
assert.equal(training.home_v3.hero.session.movement_count, 6);

const recovery = mergeAthleteHomeV3({
  ...baseToday,
  daily_check_in: { readiness_score: 4, bodyweight_kg: 90 },
}, {});
assert.equal(recovery.home_v3.state.kind, 'recovery', 'a legacy empty day only promotes when real recovery evidence exists');

const rest = mergeAthleteHomeV3(baseToday, {});
assert.equal(rest.home_v3.state.kind, 'rest', 'an empty day is not mislabeled Recovery Day');
assert.equal(rest.home_v3.week.performed.sessions, 2);
assert.equal(rest.home_v3.week.performed.sets, null, 'legacy planned sets are never presented as performed sets');
assert.equal(rest.home_v3.week.performed.total_volume_kg, null, 'legacy unknown volume is not fabricated');

assert.equal(formatWeightFromKg(100, 'lb', 0), '220 lb');
assert.equal(formatCompactVolumeValueFromKg(1000, 'lb'), '2.2K lb');
assert.equal(Math.round(convertDisplayWeightValue(315, 'lb', 'kg')), 143, 'achievement load converts into the preferred unit');

const [screen, route] = await Promise.all([
  readFile(new URL('../components/home/AthleteHomeV3.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../app/(tabs)/athlete-dashboard.tsx', import.meta.url), 'utf8'),
]);
assert.match(screen, /Array\.from\(\{ length: 7 \}/, 'Week always renders exactly seven days');
assert.match(screen, /MuscleMap[\s\S]*muscle_focus/, 'Home consumes governed muscle-focus evidence');
assert.match(screen, /Total Volume/, 'performed volume is explicitly labeled');
assert.match(screen, /OPTIONAL CHECK-IN/, 'Recovery renders the optional pre-check-in state');
assert.match(screen, /Check-in recorded/, 'Recovery renders the recorded post-check-in state');
assert.match(screen, /Resume Session[\s\S]*View Session Recap/, 'Training CTA follows the canonical lifecycle');
assert.match(screen, /isIndividual \? <SelfCoachedActions/, 'management actions are gated to the authenticated self-coached mode');
assert.doesNotMatch(screen, />[^<{]*\bworkout\b[^<{]*</i, 'user-facing Home copy does not say workout');
assert.match(route, /mergeAthleteHomeV3[\s\S]*AthleteHomeV3/, 'route merges the projection and renders the canonical V3 architecture');
assert.match(route, /preferredUnits=\{user\?\.preferred_units\}/, 'Home uses the authenticated preference even on a legacy dashboard response');
assert.match(route, /ledger_strength[\s\S]*ledger\/strength/, 'strength card has a canonical Ledger destination');
assert.match(route, /ledger_achievement[\s\S]*ledger\/achievements/, 'achievement card has a canonical Ledger destination');

console.log('Athlete Home V3 state, evidence, unit, and navigation contracts passed.');
