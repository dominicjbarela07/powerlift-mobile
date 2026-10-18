import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';

import { distinctNextUpSession, mergeAthleteHomeV3, resolveHomeState } from '../lib/athlete-home-v3.ts';
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
assert.equal(resolveHomeState({ state: { kind: 'achievement' } }, baseToday.date), 'rest', 'unqualified achievement fails closed');
assert.equal(resolveHomeState({
  state: { kind: 'achievement', evidence: {
    qualifying_same_day_pr: true,
    same_day_pr_count: 1,
    same_day_pr_id: 88,
    same_day_pr_workout_id: 9,
    performed_date: baseToday.date,
  } },
  hero: { achievement: { id: 88, workout_id: 9 } },
}, baseToday.date), 'achievement');
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
assert.equal(distinctNextUpSession({
  hero: { session: { id: 9, title: 'Strength Day' } },
  next_up: { id: 9, title: 'Strength Day' },
}), null, 'the active hero Session must not reappear as Next Up');
assert.equal(distinctNextUpSession({
  hero: { session: { action: { workout_id: 9 } } },
  next_up: { action: { workout_id: 9 } },
}), null, 'fallback canonical action IDs also identify the same Session');
assert.equal(distinctNextUpSession({
  hero: { session: { id: 9, title: 'Strength Day' } },
  next_up: { id: 10, title: 'Strength Day' },
})?.id, 10, 'separate Sessions remain visible even when their labels match');

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
assert.match(screen, /ProgrammingMuscleRegionArt[\s\S]*muscleIds/, 'Home consumes governed muscle-focus evidence through regional assets');
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
assert.match(route, /AsyncStorage\.getItem\(todayCacheKey\)[\s\S]*isAthleteHomePayloadCurrent\(cached\)[\s\S]*setToday\(normalizeTodayPayload\(cached\)\)/, 'only current-day cached Home evidence is restored before a background refresh');

// Exercise the real rest-state renderer and its action, rather than only
// asserting that check-in copy happens to occur elsewhere in Home.
const ast = ts.createSourceFile('AthleteHomeV3.tsx', screen, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const restFunctions = ['StateHero', 'RestHero', 'RestDayReadinessNudge'];
const declarations = restFunctions.map(name => {
  const declaration = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === name);
  assert.ok(declaration, name);
  return declaration.getText(ast);
}).join('\n');
const rendererModule = { exports: {} };
vm.runInNewContext(ts.transpileModule(`${declarations}\nmodule.exports = { StateHero };`, {
  compilerOptions: { jsx: ts.JsxEmit.React, module: ts.ModuleKind.CommonJS },
}).outputText, {
  module: rendererModule,
  React: { createElement: (type, props, ...children) => ({ type, props: props || {}, children }) },
  View: 'View', Text: 'Text', Pressable: 'Pressable', Ionicons: 'Ionicons',
  HeroFrame: 'HeroFrame', HeroButton: 'HeroButton', MiniLink: 'MiniLink',
  MeetHero: 'MeetHero', AchievementHero: 'AchievementHero', RecoveryHero: 'RecoveryHero', TrainingHero: 'TrainingHero',
  REST_ART: 'rest-art', SLColors: {}, styles: {},
});
const renderNodes = node => {
  if (!node || typeof node !== 'object') return [];
  if (typeof node.type === 'function') return renderNodes(node.type(node.props));
  return [node, ...(node.children || []).flat(Infinity).flatMap(renderNodes)];
};
const actions = [];
const heroProps = { creatingTodaySession: false, home: {}, state: 'rest', unit: 'lb', onAction: action => actions.push(action) };
const renderHero = overrides => renderNodes(rendererModule.exports.StateHero({ ...heroProps, ...overrides }));
const entry = nodes => nodes.find(node => node.props.accessibilityLabel === 'Log readiness and body weight');
for (const selfCoached of [false, true]) {
  const action = { route: 'daily_readiness', kind: 'submit_daily_check_in' };
  const today = { date: baseToday.date, capabilities: { can_daily_check_in: true }, daily_check_in_action: action };
  const nodes = renderHero({ home: { can_create_today_session: selfCoached }, today });
  assert.ok(entry(nodes), `rest-day check-in is visible for ${selfCoached ? 'self-coaches' : 'athletes'}`);
  entry(nodes).props.onPress();
  assert.equal(actions.at(-1), action, 'entry dispatches the existing server-provided daily action');
  assert.equal(nodes.some(node => node.type === 'HeroButton' && node.props.label === 'Create Session'), selfCoached);
  assert.deepEqual(nodes.filter(node => node.type === 'MiniLink').map(node => node.props.label), ['Open Calendar', 'View The Ledger']);
}
for (const capabilities of [undefined, {}, { can_daily_check_in: false }]) {
  assert.equal(entry(renderHero({ today: { capabilities } })), undefined, 'no client-created check-in permission');
}
const eligibleToday = { date: baseToday.date, capabilities: { can_daily_check_in: true } };
entry(renderHero({ today: eligibleToday })).props.onPress();
assert.equal(actions.at(-1).route, 'daily_readiness', 'fallback action opens the same survey, never creates a Session');
const recorded = renderHero({ today: { ...eligibleToday, daily_check_in: { id: 12, bodyweight_kg: 90 } } });
const viewEntry = recorded.find(node => node.props.accessibilityLabel === "View today's readiness check-in");
assert.ok(viewEntry, 'persisted daily check-in remains directly reviewable');
assert.ok(recorded.some(node => node.children.includes('Recorded · View check-in')));
viewEntry.props.onPress();
assert.equal(actions.at(-1).route, 'daily_readiness');
for (const state of ['training', 'meet', 'achievement', 'recovery']) {
  const nodes = renderHero({ state, today: eligibleToday });
  assert.equal(entry(nodes), undefined, `${state} keeps its existing hero flow`);
  assert.equal(nodes[0].type, `${state[0].toUpperCase()}${state.slice(1)}Hero`);
}
assert.match(route, /result\.kind === 'error'[\s\S]*setError\('Network error while loading Today\.'\)[\s\S]*return/, 'refresh failure becomes an explicit error state');
assert.doesNotMatch(
  route.match(/if \(result\.kind === 'error'\)[\s\S]*?\n\s*}\n\n\s*const res/)?.[0] || '',
  /setToday\(null\)/,
  'refresh failure preserves the last rendered/cached Home payload',
);

console.log('Athlete Home V3 state, evidence, unit, and navigation contracts passed.');
