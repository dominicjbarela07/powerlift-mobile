import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { coreLoggerHeroLoadLayout } from '../lib/core-logger-hero.ts';
import {
  KG_PER_LB,
  formatLoggerWeightKg,
  formatLoggerWeightRangeKg,
  loggerWeightIncrement,
  roundLoggerDisplayWeight,
} from '../lib/logger-weight-format.js';
import { createWorkoutDetailFixture } from '../dev-mocks/fixtures/workout-detail.ts';

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const workoutRoute = read('app/(tabs)/workout/[workoutId].tsx');
const movementComponent = read('components/workout-logger/core-loggers.tsx');
const visualContext = read('lib/logger-visual-context.ts');

assert.equal(loggerWeightIncrement(149.9, 'lb'), 2.5);
assert.equal(loggerWeightIncrement(150, 'lb'), 5);
assert.equal(loggerWeightIncrement(69.9, 'kg'), 1.25);
assert.equal(loggerWeightIncrement(70, 'kg'), 2.5);

assert.equal(roundLoggerDisplayWeight(183.75, 'kg'), 185);
assert.equal(roundLoggerDisplayWeight(183.70487985, 'kg'), 182.5);
assert.equal(roundLoggerDisplayWeight(147.6, 'lb'), 147.5);
assert.equal(roundLoggerDisplayWeight(402.6, 'lb'), 405);

const fixture = createWorkoutDetailFixture('primary-squat');
const squat = fixture.workout.core_items[0];
const prescribedKg = squat.target_low_kg;
const previousKg = squat.progress_context.previousWeightKg;
const heroKg = formatLoggerWeightRangeKg(prescribedKg, prescribedKg, 'kg');
const heroLb = formatLoggerWeightRangeKg(prescribedKg, prescribedKg, 'lb');
const prKg = `${formatLoggerWeightKg(prescribedKg, 'kg')} kg`;
const prLb = `${formatLoggerWeightKg(prescribedKg, 'lb')} lb`;
const bestKg = `${formatLoggerWeightKg(previousKg, 'kg')} kg`;
const bestLb = `${formatLoggerWeightKg(previousKg, 'lb')} lb`;

assert.equal(heroKg, '182.5 kg');
assert.equal(prKg, heroKg, 'hero and PR target must use the same canonical kg display');
assert.equal(heroLb, '405 lb');
assert.equal(prLb, heroLb, 'hero and PR target must use the same canonical lb display');
assert.equal(bestKg, '180 kg');
assert.equal(bestLb, '395 lb');
assert.doesNotMatch(heroKg, /183\.75/);

const highKgSamples = [70, 102.05828325, 179.1680946, 183.70487985, 183.75, 224.52833925];
for (const rawKg of highKgSamples) {
  const displayed = Number(formatLoggerWeightKg(rawKg, 'kg'));
  assert.ok(
    Math.abs(displayed / 2.5 - Math.round(displayed / 2.5)) < 1e-9,
    `${rawKg} produced unsupported high-load kg display ${displayed}`,
  );
}

const lowKgSamples = [20, 45.359237, 68.2, 68.75, 69.4];
for (const rawKg of lowKgSamples) {
  const displayed = Number(formatLoggerWeightKg(rawKg, 'kg'));
  assert.ok(
    Math.abs(displayed / 1.25 - Math.round(displayed / 1.25)) < 1e-9,
    `${rawKg} violated the low-load 1.25 kg platform increment`,
  );
}

const canonical405Kg = 405 * KG_PER_LB;
for (let toggle = 0; toggle < 8; toggle += 1) {
  assert.equal(formatLoggerWeightKg(canonical405Kg, 'lb'), '405');
  assert.equal(formatLoggerWeightKg(canonical405Kg, 'kg'), '182.5');
}

const shortHero = coreLoggerHeroLoadLayout('405', 430, true);
const longHero = coreLoggerHeroLoadLayout('182.5', 430, true);
const narrowLongHero = coreLoggerHeroLoadLayout('182.5', 375, true);
const legacyQuarterHero = coreLoggerHeroLoadLayout('183.75', 375, true);
assert.equal(shortHero.fontScale, 1);
assert.equal(shortHero.topInset, 0, 'the approved short-value composition must remain unchanged');
assert.equal(longHero.effectiveCopyTop, 0, 'long values must not intrude into the set-label region');
assert.ok(longHero.fontScale < shortHero.fontScale);
assert.ok(narrowLongHero.fontScale <= longHero.fontScale);
assert.equal(legacyQuarterHero.effectiveCopyTop, 0);
assert.ok(legacyQuarterHero.fontScale <= narrowLongHero.fontScale);

assert.match(workoutRoute, /return formatLoggerWeightRangeKg\(lowKg, highKg, unit\)/);
assert.match(workoutRoute, /return formatLoggerWeightKg\(Number\(kg\), unit\)/);
assert.doesNotMatch(workoutRoute, /Math\.round\(Number\(v\) \* 4\) \/ 4/);
assert.match(visualContext, /formatLoggerWeightKg\(weightKg, unit\)/);
assert.match(movementComponent, /coreLoggerHeroLoadLayout\(/);
assert.match(movementComponent, /\{ marginTop: loadLayout\.topInset \}/);
assert.match(movementComponent, /responsiveLoadStyle/);
assert.match(movementComponent, /activeNextSetPlateStage/);

console.log('Canonical logger weight formatting, cross-surface agreement, toggle stability, and content-aware hero spacing passed.');
