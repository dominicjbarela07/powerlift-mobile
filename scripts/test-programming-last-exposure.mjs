import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as cacheModule from '../lib/session-exposure-cache.ts';
import * as snapshots from '../lib/session-exposure-snapshot.ts';
import * as launch from '../lib/movement-history-launch.ts';
import * as loadSemantics from '../lib/performed-load-semantics.ts';
import * as contract from '../lib/canonical-movement-history-contract.ts';
import * as metric from '../lib/movement-strength-metric.ts';

const fixture = id => JSON.parse(fs.readFileSync(`docs/validation/authoring-last-exposure-2026-09-13/athlete-${id}-before.json`, 'utf8'));
const real12 = fixture(12), real4 = fixture(4);
assert.equal(real12.summary_item.movement_history, null);
assert.equal(real12.full_item.movement_history, null);
assert.equal(real12.independent_evidence_count, 87);
assert.equal(real12.sample_legacy_evidence.resolution_source, 'constrained_legacy_lift_code');
const cache = cacheModule.sessionExposureCache;
const effects = [], calls = [];
let response = real12.canonical_history, failure = false;
const react = { useEffect: effect => effects.push(effect), useSyncExternalStore: (_subscribe, snapshot) => snapshot(),
  createElement: (type, props, ...children) => typeof type === 'function' ? type({ ...props, children }) : ({ type, props: props || {}, children }), Fragment: 'Fragment' };
function load(file, dependencies) {
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true } }).outputText,
    { URLSearchParams, module, exports: module.exports, require: key => { assert.ok(key in dependencies, `mock missing ${key}`); return dependencies[key]; } }, { filename: file });
  return module.exports;
}
// Exercise the actual network boundary, including its athlete / Core namespace checks.
const api = load('lib/canonical-movement-history.ts', {
  '@/lib/api': { fetchJson: async path => { calls.push(path); if (failure) throw Error('offline'); return { ok: true, json: { ok: true, movement_history: response } }; } },
  '@/lib/movement-strength-metric': metric, '@/lib/performed-load-semantics': loadSemantics, '@/lib/canonical-movement-history-contract': contract,
});
const hook = load('lib/use-session-exposure.ts', { react, './canonical-movement-history': api,
  './session-exposure-cache': cacheModule, './session-exposure-snapshot': snapshots });
const theme = new Proxy({}, { get: () => new Proxy({}, { get: () => 12 }) });
const component = load('components/coach-mobile/ProgrammingLastExposure.tsx', { react,
  'react-native': { View: 'View', Pressable: 'Pressable', StyleSheet: { create: x => x, hairlineWidth: 1 } },
  '@/components/ui/sl-text': { Text: 'Text' }, '@/constants/theme': theme,
  '@/lib/movement-history-launch': launch, '@/lib/session-exposure-snapshot': snapshots, '@/lib/use-session-exposure': hook });
const context = f => ({ ownerId: String(f.user_id), athleteId: f.athlete_id, workoutId: f.workout_id, sessionDate: f.session_date });
const props12 = { context: context(real12), item: real12.summary_item, displayUnit: 'lb', onOpenHistory: () => {} };
const text = node => node == null || node === false ? '' : typeof node === 'object' ? (node.children || []).map(text).join(' ').replace(/\s+/g, ' ').trim() : String(node);
const render = props => component.ProgrammingLastExposure(props);
const settle = async () => { effects.splice(0).forEach(effect => effect()); for (let i = 0; i < 5; i++) await new Promise(resolve => setImmediate(resolve)); };
const expectFound = async (props, value) => { render(props); await settle(); const tree = render(props); assert.ok(text(tree).includes(value), text(tree)); return tree; };
const reset = () => { cache.clear(); effects.length = 0; calls.length = 0; failure = false; response = real12.canonical_history; };
reset();
assert.match(text(render(props12)), /Loading previous exposure/);
await settle();
assert.match(text(render(props12)), /125 lb × 7 @8.5 RPE.*Sep 9.*4 recorded sets/);
assert.equal(calls.length, 1);
assert.match(calls[0], /^\/workouts\/mobile\/athletes\/12\/movement-history\?/);
for (const parameter of ['core_movement_id=1', 'range=all', 'limit=6']) assert.ok(calls[0].includes(parameter));
assert.ok(!calls[0].includes('movement_definition_id='));
for (let i = 0; i < 120; i++) {
  render({ ...props12, context: { ...props12.context }, item: { ...props12.item, reps: i % 9 + 1, sets: i % 5 + 1,
    rpe: 7.5, performance_role: 'SUPPLEMENTAL', variant: 'TOP_BACKOFF' }, displayUnit: i % 2 ? 'lb' : 'kg' });
  await settle();
}
assert.equal(calls.length, 1, 'draft, designation, set type, units, render/remount and focus do not refetch');
cache.invalidate({ path: `/workouts/mobile/${real12.workout_id}/items/18021` });
await expectFound(props12, '125 lb × 7'); assert.equal(calls.length, 1);
// Real self and selected athlete contexts share code but cannot share evidence.
response = real4.canonical_history;
const props4 = { ...props12, context: context(real4), item: real4.summary_item };
assert.match(text(render(props4)), /Loading/);
await expectFound(props4, '315 lb × 3 @8 RPE');
assert.equal(calls.length, 2);
response = real12.canonical_history;
await expectFound({ ...props12, context: { ...context(real12) } }, '125 lb × 7');
assert.equal(calls.length, 2, 'locked workspace and Team athlete A converge on authorized Session subject');
// Prior exact history beyond six cards and beyond three months still resolves.
const oldProps = { ...props12, context: { ...context(real12), sessionDate: '2026-08-06' } };
await expectFound(oldProps, 'Aug 5');
const oldest = real12.canonical_history.performance_trend[0];
const oldRead = snapshots.exposureFromCoreHistory(real12.canonical_history, { ...context(real12), coreMovementId: 1, sessionDate: '2026-04-16' });
assert.equal(oldRead.set.id, oldest.set_log_id);
assert.equal(oldRead.workoutId, oldest.workout_id);
const currentExcluded = snapshots.exposureFromCoreHistory(real12.canonical_history, { ...context(real12), coreMovementId: 1, workoutId: 1726 });
assert.notEqual(currentExcluded.workoutId, 1726);
assert.ok(currentExcluded.date < '2026-09-09');
assert.ok(!real12.canonical_history.exposures.some(row => row.workout_id === oldest.workout_id));
// A Core variant changes identity immediately; Competition evidence is never reused.
const variant = { ...props12, item: { ...props12.item, core_movement: { ...props12.item.core_movement, id: 999, key: 'pause_squat', display_name: 'Pause Squat' }, performed_core_movement: null } };
const resolvedVariant = launch.resolveMovementHistoryLaunchForItem({ athleteId: 12, item: variant.item });
assert.equal(resolvedVariant.target.coreMovementId, 999);
assert.match(text(render(variant)), /Loading/); await settle();
assert.match(text(render(variant)), /History unavailable right now/);
assert.ok(!text(render(variant)).includes('No previous exact exposure'));
// Valid empty requires an exhaustive, authorized, exact-identity response.
reset(); response = { ...real12.canonical_history, summary: { ...real12.canonical_history.summary, set_count: 0, first_performed_on: null }, exposures: [], performance_trend: [], load_rep_profile: [] };
render(props12); await settle(); assert.match(text(render(props12)), /No previous exact exposure/);
// Failed initial read is unavailable; explicit retry can populate it.
reset(); failure = true; render(props12); await settle();
assert.match(text(render(props12)), /History unavailable right now/);
assert.ok(!text(render(props12)).includes('No previous exact exposure'));
const id12 = hook.sessionExposureIdentity(props12.context, launch.resolveMovementHistoryLaunchForItem({ athleteId: 12, item: props12.item }).target);
failure = false; cache.retry(id12); await expectFound(props12, '125 lb × 7');
failure = true; cache.invalidate(); await expectFound(props12, '125 lb × 7');
cache.deny(); assert.ok(!text(render(props12)).includes('125 lb'));
cache.authorize(); failure = false;
// Wrong athlete, ambiguous/unresolved identity and truncated response fail closed.
for (const bad of [real4.canonical_history,
  { ...real12.canonical_history, identity_resolution: { ...real12.canonical_history.identity_resolution, status: 'unresolved' } },
  { ...real12.canonical_history, filters: { ...real12.canonical_history.filters, date_range: '3m' } },
  { ...real12.canonical_history, exposures: [], performance_trend: [] }]) {
  reset(); response = bad; render(props12); await settle(); assert.match(text(render(props12)), /History unavailable right now/);
}
assert.equal(hook.sessionExposureIdentity({ ...context(real12), athleteId: 4 }, { athleteId: 12, coreMovementId: 1 }), null);
assert.equal(hook.sessionExposureIdentity(context(real12), { athleteId: 12, coreMovementId: 1, movementDefinitionId: 1 }), null);
assert.match(text(render({ ...props12, item: { movement: 'Competition Squat' } })), /Exact movement history is unavailable/);
// Accessories retain hydration/equipment rules and perform zero fallback queries.
reset();
const accessoryId = { ...context(real12), movementDefinitionId: 314, equipmentId: 17 };
const hydrated = { identity_scope: 'exact_identity', movement_definition_id: 314, comparison_allowed: true, comparison_identity_key: 'movement:314:equipment:17', comparison_scope: 'exact_implementation', equipment_configuration_identity_id: 17, previous_exposure: { workout_id: 10, date: '2026-09-01', comparison_identity_key: 'movement:314:equipment:17', representative_set: { id: 77, workout_id: 10, weight_kg: 20, reps: 12, rir: 2 } } };
assert.equal(hook.hydratedSessionExposureRead(hydrated, accessoryId).status, 'found');
assert.equal(hook.hydratedSessionExposureRead(hydrated, { ...accessoryId, equipmentId: 18 }).status, 'unavailable');
assert.equal(hook.hydratedSessionExposureRead(null, accessoryId).status, 'unresolved');
assert.equal(hook.hydratedSessionExposureRead({ ...hydrated, previous_exposure: null }, accessoryId).status, 'empty');
assert.equal(calls.length, 0);
const route = fs.readFileSync('app/(tabs)/workout/session-workspace/[workoutId].tsx', 'utf8');
assert.match(route, /assertProgrammingResponseSubject/);
assert.match(route, /athleteId: payload\?\.athlete\?\.id/);
assert.match(route, /history=summary/);
assert.match(fs.readFileSync('components/workout-logger/session-history-peek.tsx', 'utf8'), /useSessionExposure/);
console.log('PASS — real DEV modern/legacy Squat, exact Core namespace, variants, self/Team/workspace isolation, draft stability, date cutoff, current Session exclusion, exhaustive empty, failure/retry, denial, hydration equipment policy and shared Logger reader');
