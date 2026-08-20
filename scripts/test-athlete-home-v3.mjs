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

const deployedRecovery = mergeAthleteHomeV3(baseToday, {
  today_readiness: { readiness_score: 4.2, bodyweight_kg: 89.5 },
});
assert.equal(deployedRecovery.home_v3.state.kind, 'recovery', 'the deployed top-level readiness contract hydrates Recovery Day');
assert.equal(deployedRecovery.daily_check_in.bodyweight_kg, 89.5);
assert.equal(deployedRecovery.capabilities.has_daily_check_in, true);
assert.equal(deployedRecovery.daily_check_in_action.route, 'daily_readiness');

const rest = mergeAthleteHomeV3(baseToday, {});
assert.equal(rest.home_v3.state.kind, 'rest', 'an empty day is not mislabeled Recovery Day');
assert.equal(rest.home_v3.week.performed.sessions, 2);
assert.equal(rest.home_v3.week.performed.sets, null, 'legacy planned sets are never presented as performed sets');
assert.equal(rest.home_v3.week.performed.total_volume_kg, null, 'legacy unknown volume is not fabricated');
assert.equal(rest.home_v3.data_status.state, 'unavailable', 'missing canonical projection is not presented as legitimate empty evidence');

const canonicalProjection = {
  projection_version: 'athlete-home-v3',
  data_status: { state: 'ready', source: 'canonical_performed_evidence', scope: 'self_coached' },
  state: { kind: 'rest' },
  week: { performed: { sessions: 5, sets: 19, total_volume_kg: 8391.46, pr_count: 1 } },
  last_session: { id: 44, title: 'W3 SARMS', performed_set_count: 19, performed_volume_kg: 8391.46, session_rpe: 7, pr_count: 1 },
  trends: {
    readiness: { delta_vs_prior_7d: 0.4, window_days: 7, points: Array.from({ length: 7 }, (_, index) => ({ date: `2026-08-${index + 9}`, value: 3.5 + index / 10 })) },
    bodyweight: { latest_kg: 84, delta_kg: -1, comparison_span_days: 14, points: [{ date: '2026-08-01', value_kg: 85 }, { date: '2026-08-08', value_kg: 84.5 }, { date: '2026-08-15', value_kg: 84 }] },
    volume: { this_week_kg: 8391.46, prior_week_kg: 8100, delta_kg: 291.46, window_weeks: 5, points: [{ date: '2026-07-20', value_kg: 7000 }, { date: '2026-07-27', value_kg: 7600 }, { date: '2026-08-03', value_kg: 8100 }, { date: '2026-08-10', value_kg: 8391.46 }] },
  },
  strength: { family: 'bench', metric: 'bench_e1rm', current_e1rm_kg: 159.66, points: [{ date: '2026-07-20', value_kg: 150 }, { date: '2026-08-10', value_kg: 159.66 }] },
};
const canonical = mergeAthleteHomeV3(baseToday, { home_v3: canonicalProjection });
assert.equal(canonical.home_v3, canonicalProjection, 'canonical performed evidence passes through without lossy remapping');
assert.equal(canonical.home_v3.week.performed.sets, 19);
assert.equal(canonical.home_v3.last_session.session_rpe, 7);

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
assert.doesNotMatch(screen, /Performed evidence recorded/, 'athlete Home does not expose developer filler copy');
assert.match(screen, /No reports yet[\s\S]*No completed volume/, 'true empty trend states are intentional');
assert.match(screen, /OPTIONAL CHECK-IN/, 'Recovery renders the optional pre-check-in state');
assert.match(screen, /Check-in recorded/, 'Recovery renders the recorded post-check-in state');
assert.match(screen, /Resume Session[\s\S]*View Session Recap/, 'Training CTA follows the canonical lifecycle');
assert.match(screen, /isIndividual \? <SelfCoachedActions/, 'management actions are gated to the authenticated self-coached mode');
assert.doesNotMatch(screen, />[^<{]*\bworkout\b[^<{]*</i, 'user-facing Home copy does not say workout');
assert.match(route, /mergeAthleteHomeV3[\s\S]*AthleteHomeV3/, 'route merges the projection and renders the canonical V3 architecture');
assert.match(route, /preferredUnits=\{user\?\.preferred_units\}/, 'Home uses the authenticated preference even on a legacy dashboard response');
assert.match(route, /ledger_strength[\s\S]*ledger\/strength/, 'strength card has a canonical Ledger destination');
assert.match(route, /ledger_achievement[\s\S]*ledger\/achievements/, 'achievement card has a canonical Ledger destination');
assert.match(route, /AsyncStorage\.getItem\(todayCacheKey\)[\s\S]*setToday\(normalizeTodayPayload\(cached\)\)/, 'cached Home evidence is restored before a background refresh');
assert.match(route, /result\.kind === 'error'[\s\S]*setError\('Network error while loading Today\.'\)[\s\S]*return/, 'refresh failure becomes an explicit error state');
assert.doesNotMatch(
  route.match(/if \(result\.kind === 'error'\)[\s\S]*?\n\s*}\n\n\s*const res/)?.[0] || '',
  /setToday\(null\)/,
  'refresh failure preserves the last rendered/cached Home payload',
);

console.log('Athlete Home V3 state, evidence, unit, and navigation contracts passed.');
