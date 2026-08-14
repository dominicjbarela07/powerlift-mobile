import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  bodyweightDisplayToKg,
  bodyweightKgToDisplay,
  buildReadinessPayload,
  clampReadinessPosition,
  continuousReadinessFromPosition,
  crossedReadinessBoundary,
  createReadinessSubmissionGate,
  normalizeReadinessUnit,
  persistReadinessThenBegin,
  readinessBoundary,
  readinessPositionFromRailX,
  readinessPositionFromCanonical,
  normalizedReadinessToCanonical,
  shouldAnimateReadinessThumb,
  sleepHoursFromPosition,
  sleepPositionFromHours,
} from '../lib/readiness.ts';

const base = {
  bodyweight: '90.25',
  bodyweightSkipped: false,
  sleepPosition: 0.5,
  energyPosition: 0.5,
  sorenessPosition: 0.5,
  stressPosition: 0.5,
};

assert.equal(normalizeReadinessUnit('lbs'), 'lb');
assert.equal(normalizeReadinessUnit('kg'), 'kg');
assert.deepEqual(bodyweightDisplayToKg('90.25', 'kg'), { value: 90.25, error: null });
assert.equal(bodyweightDisplayToKg('198.4', 'lb').value, 89.993);
assert.equal(bodyweightKgToDisplay(90, 'lb'), '198.4');
assert.equal(bodyweightKgToDisplay(null, 'kg'), null);
assert.match(bodyweightDisplayToKg('nope', 'kg').error, /valid body weight/i);
assert.match(bodyweightDisplayToKg('10', 'kg').error, /25–350 kg/);

const kg = buildReadinessPayload(base, 'kg');
assert.equal(kg.error, null);
assert.equal(kg.payload.bodyweight_kg, 90.25);
assert.equal(kg.payload.sleep_hours, 7.5);
assert.deepEqual(
  { energy: kg.payload.energy, soreness: kg.payload.soreness, stress: kg.payload.stress },
  { energy: 3, soreness: 3, stress: 3 },
);
assert.equal('sleep_quality' in kg.payload, false, 'sleep duration must not fabricate legacy sleep quality');
assert.equal(sleepHoursFromPosition(0), 3);
assert.equal(sleepHoursFromPosition(1), 12);
assert.equal(sleepHoursFromPosition(0.5), 7.5);
assert.equal(sleepHoursFromPosition(0.37), 6.5, 'duration persists in half-hour increments');
assert.equal(sleepPositionFromHours(7.5), 0.5);
assert.equal(clampReadinessPosition(0.37), 0.37, 'the visual position must remain continuous');
assert.equal(readinessPositionFromRailX(0, 320), 0, 'touching the rail start selects its minimum');
assert.equal(readinessPositionFromRailX(160, 320), 0.5, 'touching anywhere on the rail maps immediately');
assert.equal(readinessPositionFromRailX(400, 320), 1, 'dragging past the rail clamps to its maximum');
assert.equal(readinessPositionFromRailX(-20, 320), 0, 'dragging before the rail clamps to its minimum');
assert.equal(normalizedReadinessToCanonical(0), 1);
assert.equal(normalizedReadinessToCanonical(0.5), 3);
assert.equal(normalizedReadinessToCanonical(1), 5);
assert.equal(normalizedReadinessToCanonical(0.37), 2, 'arbitrary positions map only on submission');
assert.equal(readinessPositionFromCanonical(1), 0);
assert.equal(readinessPositionFromCanonical(3), 0.5);
assert.equal(readinessPositionFromCanonical(5), 1);
assert.equal(readinessPositionFromCanonical(null), 0.5);
assert.equal(continuousReadinessFromPosition(0.37), 2.5, 'submission keeps analog readiness at 0.1 precision');
assert.equal(continuousReadinessFromPosition(0.675), 3.7);

// Crossing a boundary signals exactly once; moving within its range stays silent.
const hapticTransitions = [0.11, 0.19, 0.21, 0.39, 0.41].reduce((count, next, index, values) => (
  count + Number(crossedReadinessBoundary(index ? values[index - 1] : 0.1, next))
), 0);
assert.equal(hapticTransitions, 2);
assert.equal(readinessBoundary(0.19), readinessBoundary(0.36));
assert.equal(crossedReadinessBoundary(0.19, 0.36), false, 'no haptic within one canonical value');
assert.equal(crossedReadinessBoundary(0.36, 0.38), true, 'haptics follow the displayed value boundary');
assert.equal(shouldAnimateReadinessThumb(false), true);
assert.equal(shouldAnimateReadinessThumb(true), false, 'Reduce Motion disables thumb scaling and release settling');
const skipped = buildReadinessPayload({ ...base, bodyweight: '', bodyweightSkipped: true }, 'lb');
assert.equal(skipped.payload.bodyweight_kg, null);
const invalidScale = buildReadinessPayload({ ...base, energyPosition: 9 }, 'kg');
assert.match(invalidScale.error, /each readiness check/i);

let release;
let beginCount = 0;
const gate = createReadinessSubmissionGate();
const first = gate.run(async () => {
  await new Promise((resolve) => { release = resolve; });
  beginCount += 1;
});
assert.equal(gate.isInFlight(), true);
assert.equal(await gate.run(async () => { beginCount += 1; }), false);
release();
assert.equal(await first, true);
assert.equal(beginCount, 1);

let failedBeginCount = 0;
await assert.rejects(gate.run(async () => { throw new Error('network'); }));
assert.equal(failedBeginCount, 0);
assert.equal(gate.isInFlight(), false);
await gate.run(async () => { failedBeginCount += 1; });
assert.equal(failedBeginCount, 1);

let persisted = 0;
let started = 0;
await persistReadinessThenBegin(async () => { persisted += 1; }, () => { started += 1; });
assert.deepEqual({ persisted, started }, { persisted: 1, started: 1 });
await assert.rejects(persistReadinessThenBegin(async () => { throw new Error('save failed'); }, () => { started += 1; }));
assert.equal(started, 1, 'a failed readiness save must not start the workout');

const component = fs.readFileSync(new URL('../components/workout-logger/readiness-modal.tsx', import.meta.url), 'utf8');
for (const copy of [
  'How are we feeling?',
  'Take a quick moment to check in before we begin.',
  'BODY WEIGHT',
  'Begin Session',
  'Skip for today',
  'Drained',
  'Fired up',
  'Fresh',
  'Very sore',
  'Relaxed',
  'High stress',
]) assert.ok(component.includes(copy), `missing modal copy: ${copy}`);
for (const copy of [
  'How are you feeling today?',
  'Record readiness, recovery, and optional body weight.',
  'Save Check-In',
]) assert.ok(component.includes(copy), `missing daily check-in copy: ${copy}`);
assert.ok(component.includes("context?: 'session' | 'daily'"));
assert.ok(component.includes('accessibilityRole="adjustable"'));
assert.ok(component.includes('valueText={`${sleepHoursFromPosition(values.sleepPosition).toFixed(1)} hr`}'));
assert.ok(component.includes('hapticBoundaries && crossedReadinessBoundary'));
assert.ok(component.includes('Gesture.Pan()'));
assert.ok(component.includes('.minDistance(0)'));
assert.ok(component.includes('.shouldCancelWhenOutside(false)'));
assert.ok(component.includes('.onBegin(({ x })'));
assert.ok(component.includes('.onUpdate(({ x })'));
assert.ok(component.includes('<GestureDetector gesture={railGesture}>'));
assert.ok(!component.includes('onStartShouldSetResponder'), 'the rail must not compete with its ScrollView through the legacy responder API');
assert.ok(component.includes('accessibilityState={{ busy: submitting, disabled: submitting }}'));
assert.ok(component.includes('animationType={reduceMotion'));

console.log('[readiness-modal] unit, validation, retry, copy, and accessibility tests passed');
