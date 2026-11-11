import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { shippingTabRouteNames, SHIPPING_ATHLETE_TAB_ROUTES, SHIPPING_COACH_TAB_ROUTES } from '../lib/shipping-navigation.ts';
import { coreRepeatDraft, accessoryRepeatDraft } from '../lib/repeat-last-set.ts';
import { strengthMetricForMovementClass } from '../lib/movement-strength-metric.ts';
import { trainingSessionTitle } from '../lib/training-session-title.ts';

function handlers(path, names, context) {
  const source = fs.readFileSync(path, 'utf8');
  const ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const declarations = [];
  function visit(node) {
    if (ts.isVariableDeclaration(node) && names.includes(node.name.getText(ast))) declarations.push(`const ${node.getText(ast)};`);
    if (ts.isFunctionDeclaration(node) && names.includes(node.name?.text)) declarations.push(node.getText(ast).replace(/^export /, ''));
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.equal(declarations.length, names.length);
  const code = ts.transpileModule(`${declarations.join('\n')}\n({${names.join(',')}});`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  return vm.runInNewContext(code, context);
}

const navigation = { isCoach: true, isIndividual: true, isUnlinkedAthlete: false, viewMode: 'athlete', hasMeetPlan: true };
assert.deepEqual(shippingTabRouteNames(navigation), ['athlete-dashboard', 'workout/index', 'ledger']);
assert.deepEqual(shippingTabRouteNames({ ...navigation, isIndividual: false, isCoach: false, hasMeetPlan: false }), [...SHIPPING_ATHLETE_TAB_ROUTES]);
assert.deepEqual(shippingTabRouteNames({ ...navigation, isIndividual: false, viewMode: 'coach' }), [...SHIPPING_COACH_TAB_ROUTES]);

const route = 'app/(tabs)/workout/[workoutId].tsx';
const routeSource = fs.readFileSync(route, 'utf8');
function assertSessionCopy(file, source) {
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  function visit(node) {
    if (ts.isJsxText(node) || ts.isStringLiteralLike(node) || ts.isTemplateLiteralToken(node)) {
      const copy = node.text.trim();
      const parent = node.parent;
      const internalKey = copy === 'workout' && (
        ts.isLiteralTypeNode(parent) || ts.isBinaryExpression(parent)
        || (ts.isPropertyAssignment(parent) && parent.name.getText(tree) === 'route')
        || (ts.isCallExpression(parent) && parent.expression.getText(tree) === 'setUpdateBlocker')
      );
      assert.ok(internalKey || !/(?:^|\s)workouts?(?=\s|[.!?,:]|$)/i.test(copy), `${file} contains retired Session wording: ${copy}`);
    }
    ts.forEachChild(node, visit);
  }
  visit(tree);
}
for (const file of [route, 'app/(tabs)/athlete-dashboard.tsx', 'components/home/SelfCoachTrain.tsx',
  'components/home/SelfCoachPlanEntry.tsx',
  'components/workout-logger/SelfCoachWorkoutSaved.tsx', 'components/movement/SelfCoachExercisePicker.tsx',
  'components/education/SelfCoachEducationOpening.tsx', 'lib/self-coach-workouts.ts']) {
  assertSessionCopy(file, fs.readFileSync(file, 'utf8'));
}
assert.throws(() => assertSessionCopy('Regression.tsx', '<Text>Workout saved</Text>'), /retired Session wording/);
assert.throws(() => assertSessionCopy('Regression.tsx', '<Pressable accessibilityLabel="Resume workout" />'), /retired Session wording/);
assert.equal(trainingSessionTitle('Workout'), 'Training Session');
assert.equal(trainingSessionTitle('Upper body · Tuesday'), 'Upper body · Tuesday');
function assertEmptyWorkoutRecovery(source) {
  assert.match(source, /artwork=\{firstArtworkItem \? canonicalArtworkInputForLoggerItem\(firstArtworkItem\) : null\}/);
  const failure = source.slice(source.indexOf('  if (!data) {', source.indexOf('const loggerShellMode')), source.indexOf('  const { workout, athlete } = data;'));
  assert.match(failure, /Retry session/);
  assert.match(failure, /void fetchWorkout\(\{ reason: 'manual' \}\)/);
  assert.match(failure, /Back to training/);
}
assertEmptyWorkoutRecovery(routeSource);
assert.throws(() => assertEmptyWorkoutRecovery(routeSource.replace('firstArtworkItem ? canonicalArtworkInputForLoggerItem(firstArtworkItem) : null', 'canonicalArtworkInputForLoggerItem(firstArtworkItem)')));
assert.throws(() => assertEmptyWorkoutRecovery(routeSource.replace('Retry session', 'Removed recovery')));
assert.match(routeSource, /<SessionV3Header/);
assert.match(routeSource, /<SessionV3Footer/);
assert.match(routeSource, /visible=\{!!coreWheel\?\.visible\}/);
assert.match(routeSource, /visible=\{!!accessoryWheel\?\.visible\}/);
assert.match(routeSource, /visible=\{editSetVisible\}/);
assert.doesNotMatch(routeSource, /SelfCoachActiveWorkout|isSelfCoachActive/);
assert.match(routeSource, /onFinish=\{requestCompleteWorkout\}/);

const disk = new Map(), writes = [];
let fail = true;
const reuseContext = {
  AsyncStorage: { getItem: async key => disk.get(key) || null, setItem: async (key, value) => disk.set(key, value), removeItem: async key => disk.delete(key) },
  fetchJson: async (_, options) => {
    writes.push(options.body);
    if (fail) throw new Error('Disconnected after dispatch');
    return { ok: true, json: { ok: true, workout_id: 90 } };
  },
};
const reuse = handlers('lib/self-coach-workouts.ts', ['pendingWorkoutReuse', 'performWorkoutReuse', 'reuseSelfCoachWorkout'], reuseContext);
const input = { owner: '111', workoutId: 8, action: 'repeat' };
await assert.rejects(reuse.reuseSelfCoachWorkout(input), /Disconnected/);
assert.equal(disk.size, 1, 'an ambiguous write keeps its durable request identity');
fail = false;
await Promise.all([reuse.reuseSelfCoachWorkout(input), reuse.reuseSelfCoachWorkout(input)]);
assert.equal(writes.length, 2, 'concurrent retries share one dispatched operation');
assert.equal(writes[0].command_key, writes[1].command_key);
assert.equal(disk.size, 0, 'only an acknowledged result retires the pending request');
const repeated = [];
const repeatContext = {
  isIndividualUser: true, coreRepeatDraft, accessoryRepeatDraft,
  coreWheel: { itemId: 12, weight: '50', reps: '5', rpe: '' },
  accessoryWheel: { itemId: 13, weight: '0', reps: '8', rir: '' },
  coreWheelLastLog: { actual_reps: 5, actual_rpe: null },
  accessoryWheelLastLog: { actual_reps: 8, actual_rir: null }, coreRepeatBusy: false, accessoryRepeatBusy: false,
  canonicalSetSubmissionControllerRef: { current: { isInFlight: () => false } }, unit: 'kg',
  toWheelWeight: log => log.actual_reps === 5 ? '50' : '0',
  setCoreWheel() {}, setAccessoryWheel() {}, queueCoreWheelLog: value => repeated.push(value), queueAccessoryWheelLog: value => repeated.push(value),
  nearestWheelValue: () => { throw new Error('Missing effort must never acquire a wheel fallback.'); },
};
const repeatHandlers = handlers(route, ['repeatLastIntoCoreWheel', 'repeatLastIntoAccessoryWheel'], repeatContext);
repeatHandlers.repeatLastIntoCoreWheel(); repeatHandlers.repeatLastIntoAccessoryWheel();
assert.equal(repeated[0].rpe, ''); assert.equal(repeated[1].rir, ''); assert.equal(repeated[1].weight, '0');

const slots = [];
const slotContext = {
  workoutId: '8', unit: 'kg', KG_PER_LB: 0.45359237, isIdealWorkoutDetailPreview: false,
  data: { workout: { core_items: [{ id: 12, reps: 5 }], accessory_groups: [{ items: [{ id: 13, set_logs: [{ set_index: 1 }] }] }] } },
  straightInputs: { 12: { weight: '50', reps: '5', rpe: '' } },
  topInputs: { 12: { weight: '50', reps: '5', rpe: '8' } },
  bkInputs: { 12: { weight: '50', reps: '5', rpe: '' } },
  accInputs: { 13: { weight: '0', reps: '8', rir: '' } },
  intendedSetIndex: () => 2, acceptedLoadByItemIdRef: { current: {} }, setError: value => { throw new Error(value); },
  submissionForAttempt: async (_, payload) => { slots.push(payload.intended_set_index); return 'durable-set-id'; },
  createPerformedSetTiming: () => ({}), prescribedRestSecondsForItem: () => 0,
  submitCanonicalSet: async () => null, console: { log() {} },
};
const slotHandlers = handlers(route, ['logStraightSet', 'logTopSet', 'logBackdownSet', 'handleAccessorySave'], slotContext);
for (const name of ['logStraightSet', 'logTopSet', 'logBackdownSet']) await slotHandlers[name](12, null, 1);
await slotHandlers.handleAccessorySave(13, null, 1);
assert.deepEqual(slots, [1, 1, 1, 1], 'a refreshed timeline cannot silently move the typed set into a different slot');

// Run the actual compatibility adapter: summary estimates and chart estimates
// must use the same metric, including legacy responses without a metric key.
const loadSemantics = handlers('lib/performed-load-semantics.ts', ['normalized', 'isAssistanceLoad'], {});
const historyAdapter = handlers('lib/canonical-movement-history.ts', [
  'normalizeStrengthValue', 'normalizeStrengthRow', 'normalizeHistoryStrengthMetric', 'finiteHistoryNumber',
], { strengthMetricForMovementClass, isAssistanceLoad: loadSemantics.isAssistanceLoad });
for (const kind of ['core', 'core_variant', 'accessory']) {
  for (const reportedKey of [null, 'e1rm', 'e10rm']) {
    const fixture = {
      movement: {}, identity_resolution: { subject_type: kind },
      strength_metric: reportedKey ? { key: reportedKey } : null,
      performance_trend: [{ e10rm_kg: 120 }], load_progression: [], load_rep_profile: [], equipment_breakdown: [], exposures: [],
      statistics: { estimated_strength_pr: { value_kg: 120, delta_kg: 12, exposure_id: 'source' } },
    };
    const result = historyAdapter.normalizeHistoryStrengthMetric(fixture);
    const expected = kind === 'accessory' ? (reportedKey === 'e10rm' ? 120 : 90)
      : reportedKey === 'e10rm' ? 160 : 120;
    assert.equal(result.performance_trend[0].strength_metric_kg, expected);
    assert.equal(result.statistics.estimated_strength_pr.value_kg, expected, `${kind}/${reportedKey}: summary agrees with chart`);
    assert.equal(result.statistics.estimated_strength_pr.delta_kg, expected / 10);
    assert.equal(historyAdapter.normalizeHistoryStrengthMetric(result).statistics.estimated_strength_pr.value_kg, expected, 're-reading does not apply conversion twice');
    assert.equal(fixture.statistics.estimated_strength_pr.value_kg, 120, 'source evidence is preserved');
  }
}
const exerciseRows = [
  { key: 'core:1', total: 2, logged: 1, complete: false },
  { key: 'acc:2', total: 1, logged: 1, complete: true },
  { key: 'acc:3', total: 3, logged: 0, complete: false },
];
for (const [selectedIndex, rows, expected] of [
  [0, exerciseRows, undefined],
  [1, exerciseRows, 'acc:3'],
  [1, exerciseRows.slice(0, 2), 'core:1'],
  [1, exerciseRows.map(row => ({ ...row, complete: true })), undefined],
  [-1, [], undefined],
  [0, [{ key: 'acc:1', total: 0, complete: false }], undefined],
]) {
  const actual = handlers(route, ['nextUnfinishedMovement'], {
    orderedSessionMovements: rows, focusedSessionIndex: selectedIndex,
  });
  assert.equal(actual.nextUnfinishedMovement?.key, expected, 'completed movements continue to real unfinished work in order, with wraparound');
}
for (const busy of [false, true]) {
  const actions = [];
  const navigationHandler = handlers(route, ['selectSessionMovement'], {
    sessionControlsBusy: busy, manualMovementSelectionRef: { current: false },
    openMovementCard: key => actions.push(key), setNavigatorVisible: value => actions.push(value),
    scrollRef: { current: { scrollTo: () => actions.push('scroll') } },
  });
  navigationHandler.selectSessionMovement('core:1');
  assert.deepEqual(actions, busy ? [] : ['core:1', false, 'scroll'], 'exercise selection preserves pending-save protection');
}
console.log('PASS Self-Coach actual handlers. Canonical logger, role navigation, immutable set slots, durable retries, and direct unfinished-exercise continuation.');
