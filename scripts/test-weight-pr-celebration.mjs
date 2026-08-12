import assert from 'node:assert/strict';
import fs from 'node:fs';

const preview = fs.readFileSync(new URL('../dev-mocks/animation-library/preview-card.tsx', import.meta.url), 'utf8');
const canonical = fs.readFileSync(new URL('../components/workout-logger/canonical-record-recognition.tsx', import.meta.url), 'utf8');
const feedback = fs.readFileSync(new URL('../components/workout-logger/logger-feedback.tsx', import.meta.url), 'utf8');
const motionRegistry = fs.readFileSync(new URL('../lib/recognition-motion-registry.ts', import.meta.url), 'utf8');
const registry = fs.readFileSync(new URL('../dev-mocks/animation-library/registry.ts', import.meta.url), 'utf8');
const library = fs.readFileSync(new URL('../app/(tabs)/dev-mocks/animations.tsx', import.meta.url), 'utf8');

const phaseLabels = [
  '1 · Former best established',
  '2 · Challenger approaches',
  '3 · Displacement impact',
  '4 · Victory moment',
  '5 · Settle and breathe',
  '6 · Evidence reveal begins',
  '7 · Complete comparison',
  '8 · Final settled state',
];
let phaseCursor = -1;
for (const phase of phaseLabels) {
  const nextCursor = canonical.indexOf(phase, phaseCursor + 1);
  assert.ok(nextCursor > phaseCursor, `${phase} must be present after the preceding storyboard phase`);
  phaseCursor = nextCursor;
}

assert.match(canonical, /newTranslateY\.setValue\(approachDistance\)[\s\S]*toValue: 52[\s\S]*toValue: 0/s, 'the challenger must rise from below through approach and impact');
assert.match(canonical, /oldTranslateY[\s\S]*toValue: -displacementDistance[\s\S]*oldScale[\s\S]*toValue: 0\.7/s, 'impact must push the former best upward and backward');
assert.match(canonical, /winningValue[\s\S]*fontSize: 78[\s\S]*textShadowRadius: 14/s, 'the winning number must own the victory hierarchy');
assert.match(canonical, /RAYS[\s\S]*FRAGMENTS[\s\S]*bloom[\s\S]*groundLine/s, 'the bounded storyboard atmosphere must include rays, fragments, radial light, and a grounding line');
assert.match(canonical, /Animated\.timing\(fragmentOpacity, \{ toValue: 0,[\s\S]*Animated\.timing\(rayOpacity, \{ toValue: 0,[\s\S]*Animated\.timing\(bloomOpacity, \{ toValue: 0,/s, 'all celebration atmosphere must resolve before the settled evidence state');
assert.doesNotMatch(canonical, /Animated\.loop/, 'the Weight PR animation must not leave a continuous animation running after settle');
assert.match(canonical, /headerTrophyTranslateY[\s\S]*headerTrophyScale[\s\S]*<SLTrophy size=\{24\}/, 'the compact canonical trophy must remain mounted throughout every phase');
assert.match(canonical, /headerTrophy:\s*\{\s*width: 24, height: 24/, 'the animated compact trophy wrapper must retain explicit iOS layout dimensions');
assert.match(canonical, /headerTrophyTranslateY, \{ toValue: -3[\s\S]*headerTrophyScale, \{ toValue: 1\.11/s, 'the compact trophy must acknowledge displacement without bouncing');
assert.match(canonical, /trophyOpacity, \{ toValue: 0\.34[\s\S]*trophyOpacity, \{ toValue: 1[\s\S]*<SLTrophy size=\{54\}/s, 'the proud canonical trophy must emerge during impact and fully arrive for victory');
assert.match(canonical, /Animated\.delay\(victoryHoldMs\)[\s\S]*trophyOpacity, \{ toValue: 0\.16[\s\S]*trophyTranslateY, \{ toValue: -54[\s\S]*trophyScale, \{ toValue: 0\.52/s, 'the proud trophy must hold through victory and intentionally return toward the compact header during evidence');
assert.doesNotMatch(canonical, /trophyOpacity, \{ toValue: 0, duration: evidenceTransitionMs/, 'the evidence transition must not abruptly discard the proud trophy');
assert.match(canonical, /comparison[\s\S]*evidenceDetails[\s\S]*delta/s, 'the comparison and improvement must remain one centered evidence unit');
assert.match(canonical, /onImpact\?\.\(\)[\s\S]*onSettle\?\.\(\)/s, 'impact and settled-success haptics must fire at their respective phases');
assert.match(preview, /firePreviewHaptic\('medium', settings\.hapticsEnabled\)[\s\S]*firePreviewHaptic\(entry\.haptic, settings\.hapticsEnabled\)/s, 'both Weight PR haptics must respect the preview toggle');
assert.match(canonical, /if \(reduceMotion\)[\s\S]*headerTrophyScale\.setValue\(1\)[\s\S]*fragmentOpacity\.setValue\(0\)[\s\S]*groundLineOpacity\.setValue\(0\)[\s\S]*evidenceDetailsOpacity\.setValue\(1\)/s, 'Reduced Motion must retain the compact trophy, disable physical atmosphere, and retain complete static evidence');
assert.match(canonical, /values\.forEach\(\(value\) => value\.stopAnimation\(\)\)[\s\S]*animation\.stop\(\)[\s\S]*timers\.forEach\(clearTimeout\)/s, 'replay and unmount must stop every animated value and phase timer');
assert.match(canonical, /oldTranslateY\.setValue\(0\)[\s\S]*fragmentProgress\.setValue\(0\)[\s\S]*evidenceDetailsOpacity\.setValue\(0\)/s, 'each replay must restore the exact initial animated state');
assert.match(preview, /setPlayKey\(0\)[\s\S]*setStatus\('Ready'\)/s, 'Reset must unmount playback and restore the initial preview state');
assert.match(registry, /medium impact → success settle/, 'the registry must document the two intentional haptic moments');
assert.match(preview, /<CanonicalRecordRecognition/, 'the Motion Workshop must render the production primitive');
assert.match(feedback, /<CanonicalRecordRecognition/, 'the shipping Logger must render the same production primitive');
assert.match(motionRegistry, /CANONICAL_RECORD_RECOGNITION_MOTION/, 'approved timings must live in the shared production registry');
assert.match(library, /productionMotion = DEFAULT_MOTION[\s\S]*ComparisonLabel title="Production"[\s\S]*motion: productionMotion[\s\S]*ComparisonLabel title="Current edits"[\s\S]*settings=\{settings\}/s, 'locked production-baseline and current-edits previews must remain intact');
assert.doesNotMatch(preview, /fetchJson|\bfetch\s*\(|useAuth|createSetLog|accomplishment.*POST/i, 'the DEV celebration must remain isolated from production and account state');

console.log('[weight-pr-celebration] eight phases, atmosphere cleanup, dual haptics, replay/reset, Reduced Motion, and comparison isolation passed');
