import assert from 'node:assert/strict';
import fs from 'node:fs';
import { normalizeAnimationFavoriteIds, toggleAnimationFavorite } from '../dev-mocks/animation-library/favorites-core.ts';
import { ANIMATION_LIBRARY } from '../dev-mocks/animation-library/registry.ts';
import {
  DESIGNER_CONTROLS,
  LOCKED_ANIMATION_LIBRARY_MOTION,
  MOTION_PRESETS,
  applyDesignerChoice,
  applyMotionPreset,
  inferDesignerChoices,
  normalizeAnimationTuningEntries,
  phaseTimeline,
  resetMotionSection,
  scaleMotionTiming,
} from '../dev-mocks/animation-library/tuning-model.ts';

const registry = fs.readFileSync(new URL('../dev-mocks/animation-library/registry.ts', import.meta.url), 'utf8');
const screen = fs.readFileSync(new URL('../app/(tabs)/dev-mocks/animations.tsx', import.meta.url), 'utf8');
const layout = fs.readFileSync(new URL('../app/(tabs)/_layout.tsx', import.meta.url), 'utf8');
const devMocksLayout = fs.readFileSync(new URL('../app/(tabs)/dev-mocks/_layout.tsx', import.meta.url), 'utf8');
const preview = fs.readFileSync(new URL('../dev-mocks/animation-library/preview-card.tsx', import.meta.url), 'utf8');
const canonicalRecordRecognition = fs.readFileSync(new URL('../components/workout-logger/canonical-record-recognition.tsx', import.meta.url), 'utf8');
const mockData = fs.readFileSync(new URL('../dev-mocks/animation-library/mock-data.ts', import.meta.url), 'utf8');
const majorMilestone = fs.readFileSync(new URL('../components/workout-logger/major-volume-milestone-recognition.tsx', import.meta.url), 'utf8');
const majorMilestoneAssets = fs.readFileSync(new URL('../lib/major-volume-medallion-assets.ts', import.meta.url), 'utf8');
const favoritesStorage = fs.readFileSync(new URL('../dev-mocks/animation-library/favorites-storage.ts', import.meta.url), 'utf8');
const motionPreview = fs.readFileSync(new URL('../lib/motion-preview.tsx', import.meta.url), 'utf8');
const tuningModel = fs.readFileSync(new URL('../dev-mocks/animation-library/tuning-model.ts', import.meta.url), 'utf8');

for (const category of [
  'Logging', 'Recognition', 'Movement and session completion',
  'Readiness and reflection', 'Navigation and shell', 'Controls and microinteractions',
]) assert.match(registry, new RegExp(`'${category.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'`));

const ids = [
  ...[...registry.matchAll(/state\('([^']+)'/g)].map((match) => match[1]),
  ...[...registry.matchAll(/\{ id: '([^']+)'/g)].map((match) => match[1]),
];
assert.ok(ids.length >= 30, 'the permanent workshop should cover the meaningful production motion families');
assert.equal(new Set(ids).size, ids.length, 'animation preview ids must be unique');
const recognitionCategoryEntries = ANIMATION_LIBRARY.filter((entry) => entry.category === 'Recognition');
const recognitionEntries = recognitionCategoryEntries.filter((entry) => entry.kind === 'recognition');
const majorMilestoneEntries = recognitionCategoryEntries.filter((entry) => entry.kind === 'major-milestone');
const dedicatedE1rmEntries = recognitionCategoryEntries.filter((entry) =>
  /e1rm|estimated[\s-]*1rm/i.test([entry.id, entry.title, entry.description, entry.variant].join(' ')),
);
const removedRecognitionPermutationIds = [
  'combined-recognition',
  'rep-max-established',
  'rep-max-equal',
  'rep-max-seven',
  'rep-max-with-weight',
  'rep-max-reduced',
  'rpe-pr-small-change',
  'rpe-pr-weight-mismatch',
  'rpe-pr-reps-mismatch',
  'rpe-pr-correction',
  'rpe-pr-with-rep-max',
  'rpe-pr-reduced',
  'block-best',
  'weight-pr-secondary',
];
const removedMovementTransitionPreviewIds = [
  'movement-complete-banner',
  'movement-countdown',
  'completed-movement-settle',
  'next-movement-focus',
];
const removedCompletionPermutationIds = [
  'workout-completion-opening',
  'workout-recap-reveal',
  'session-highlights-arrival',
];
assert.deepEqual(dedicatedE1rmEntries, [], 'Recognition must not expose a dedicated e1RM celebration under any name');
assert.deepEqual(
  recognitionEntries.map((entry) => entry.id),
  ['weight-pr', 'rep-max-pr', 'rpe-pr', 'recognition-reduced'],
  'Recognition must contain motion families rather than business-logic permutations',
);
assert.equal(recognitionEntries.length, 4, 'Recognition must expose exactly four athlete-facing motion families');
assert.deepEqual(
  majorMilestoneEntries.map((entry) => entry.id),
  ['major-volume-total', 'major-volume-lift'],
  'major lifetime volume must expose exactly the Total and Per-Lift parameterized previews',
);
assert.doesNotMatch(registry, /combined-recognition|weight-rep-max/, 'Combined Recognition must not remain in the registry or inspector metadata');
assert.doesNotMatch(preview, /isCombined|weight-rep-max/, 'Combined Recognition must not retain a preview or playback branch');
assert.doesNotMatch(mockData, /weight-rep-max|rpe-rep-collision/, 'routing collisions must remain test fixtures rather than Animation Library scenarios');
for (const id of removedMovementTransitionPreviewIds) {
  assert.equal(ANIMATION_LIBRARY.some((entry) => entry.id === id), false, `${id} belongs to the logger workflow rather than the Animation Library`);
}
assert.deepEqual(
  ANIMATION_LIBRARY.filter((entry) => entry.kind === 'session-completion').map((entry) => entry.id),
  ['post-session-ledger-ceremony'],
  'post-session completion must be one athlete-facing ledger ceremony rather than phase permutations',
);
assert.doesNotMatch(registry + preview + mockData, /MovementCompletionSurface|movementCompletionSummary|movement-completion/, 'the standalone Movement Complete family must have no registry, preview, or mock path');
assert.match(screen, /if \(!__DEV__\) return null/, 'animation library must retain the DEV-only runtime boundary');
assert.match(screen, /DEFAULT_MOTION[\s\S]*LOCKED_ANIMATION_LIBRARY_MOTION[\s\S]*spring: \{ \.\.\.LOCKED_ANIMATION_LIBRARY_MOTION\.spring \}/, 'every Animation Library preview must share the locked tuned baseline');
assert.match(screen, /productionMotion = DEFAULT_MOTION/, 'the production comparison must use the locked shared baseline for every selected animation');
assert.match(screen, /motionByEntry\[selectedEntry\.id\] \?\? productionMotion/, 'editable deviations must remain isolated by animation after the shared baseline is locked');
assert.match(screen, /dev-animation-tuning\/v2[\s\S]*saved\?\.entries/, 'saved workshop deviations must use the per-animation tuning format');
assert.match(layout, /name="dev-mocks"[\s\S]*?href: null/, 'the DEV mock workspace must remain hidden from normal tab destinations');
assert.match(devMocksLayout, /<Stack[\s\S]*?headerShown: false/, 'animation previews must remain children of the isolated DEV mock stack');
assert.match(preview, /LoggerFeedbackSurface/, 'recognition previews must use the production feedback presentation');
assert.match(preview, /entry\.id === 'weight-pr'[\s\S]*WeightPrRecognitionPreview/, 'Weight PR must retain its parameterized workshop wrapper');
assert.match(preview, /WeightPrRecognitionPreview[\s\S]*<CanonicalRecordRecognition/, 'the workshop wrapper must render the canonical production primitive');
assert.match(preview, />PREVIOUS<[\s\S]*>NEW<[\s\S]*>UNIT</, 'Weight PR must expose movement and load parameters');
assert.match(preview, />REPS</, 'Rep-Max must expose its rep-count parameter');
assert.match(preview, /accessibilityLabel="Movement Efficiency weight"[\s\S]*accessibilityLabel="Movement Efficiency reps"[\s\S]*accessibilityLabel="Previous RPE"[\s\S]*accessibilityLabel="New RPE"/, 'Movement Efficiency must expose workload and RPE parameters');
assert.match(preview, /RECOGNITION FAMILY[\s\S]*Weight PR[\s\S]*Rep-Max PR[\s\S]*Movement Efficiency/, 'Reduced Motion must parameterize the three recognition families from one entry');
assert.match(preview, /MajorVolumeMilestonePreview[\s\S]*PREVIOUS TOTAL[\s\S]*NEW TOTAL[\s\S]*THRESHOLD[\s\S]*ACCUMULATED REPS[\s\S]*NEXT MILESTONE/s, 'major milestone previews must expose factual accumulation parameters');
assert.match(preview, /\['squat', 'bench', 'deadlift'\][\s\S]*setLiftFamily/s, 'the Per-Lift preview must parameterize lift identity');
assert.match(mockData, /majorVolumeMilestoneEvent[\s\S]*CORE_LIFETIME_VOLUME_MILESTONE[\s\S]*TOTAL_LIFETIME_VOLUME_MILESTONE/s, 'both previews must use the same parameterized canonical event family');
assert.match(majorMilestone, /1 · Fade to focus[\s\S]*2 · Landmark system appears[\s\S]*3 · Accumulation rises[\s\S]*4 · Threshold crossed[\s\S]*5 · Landmark becomes hero[\s\S]*6 · Earned artifact resolves[\s\S]*7 · Evidence[\s\S]*8 · Resolve/s, 'major milestone production presentation must implement all eight phases');
assert.match(majorMilestone, /MajorVolumeMilestoneArtifact[\s\S]*<Image[\s\S]*majorVolumeMedallionAsset/s, 'the landmark must resolve through the canonical static medallion library');
assert.match(majorMilestone, /MAJOR_VOLUME_TIMING_SCALE = 2/, 'major-volume recognition must play every phase at half its former speed');
assert.match(majorMilestone, /MAJOR_VOLUME_SETTLED_HERO_HOLD_MS = 650/, 'major-volume recognition must hold the fully settled landmark for an additional 650 ms');
assert.match(majorMilestone, /EARNED_ARTIFACT_PHASE_INDEX[\s\S]*Animated\.delay\(settledHeroHoldMs\)/s, 'the additional hold must occur after the earned artifact settles and before evidence');
assert.doesNotMatch(majorMilestone, /<Svg|<Polygon|artifactThreshold/, 'the recognition surface must not rebuild canonical medallion artwork from SVG or text overlays');
assert.equal((majorMilestoneAssets.match(/require\('@\/assets\/images\/major-volume-medallions\//g) || []).length, 28, 'the canonical medallion registry must contain all 28 static assets');
assert.doesNotMatch(majorMilestone, /SLTrophy|emoji/i, 'major landmarks must not reuse a PR trophy or emoji');
assert.match(registry, /\['weight-pr', 'rep-max-pr'\]\.includes\(entry\.id\)[\s\S]*CanonicalRecordRecognition[\s\S]*SLTrophy[\s\S]*LinearGradient[\s\S]*Deterministic fragments/, 'Weight PR and Rep-Max inspector metadata must name their shared production primitive and atmosphere dependencies');
assert.match(registry, /\['weight-pr', 'rep-max-pr'\]\.includes\(entry\.id\)[\s\S]*Eight-phase takeover → atmosphere → evidence settle/, 'Weight PR and Rep-Max metadata must describe the shared storyboard choreography');
assert.match(canonicalRecordRecognition, /oldTranslateY[\s\S]*toValue: -displacementDistance[\s\S]*newTranslateY[\s\S]*toValue: 0/s, 'the new record must physically displace the former best');
assert.match(canonicalRecordRecognition, /1 · Former best established[\s\S]*2 · Challenger approaches[\s\S]*3 · Displacement impact[\s\S]*4 · Victory moment[\s\S]*5 · Settle and breathe[\s\S]*6 · Evidence reveal begins[\s\S]*7 · Complete comparison[\s\S]*8 · Final settled state/s, 'Weight PR must implement all eight storyboard phases in order');
assert.match(preview, /FORMER \$\{category\}[\s\S]*NEW \$\{category\}[\s\S]*evidenceLabel=\{category\}/s, 'Weight PR must parameterize the replacement story for the canonical primitive');
assert.match(canonicalRecordRecognition, /comparison[\s\S]*arrow-forward[\s\S]*delta/s, 'the settled comparison and improvement must render as one evidence unit');
assert.match(preview, /fireImpactHaptic[\s\S]*firePreviewHaptic\('medium'[\s\S]*firePeakHaptic[\s\S]*entry\.haptic/s, 'Weight PR must separate its impact and final success haptics');
assert.match(canonicalRecordRecognition, /if \(reduceMotion\)[\s\S]*fragmentOpacity\.setValue\(0\)[\s\S]*evidenceOpacity\.setValue\(1\)[\s\S]*8 · Final settled state/s, 'Reduced Motion must remove atmosphere and show the final factual comparison immediately');
assert.match(preview, /CompletedSetSwipeRow/, 'gesture previews must use the production completed-set swipe row');
assert.match(preview, /ReadinessScale/, 'readiness preview must use the production rail');
assert.match(preview, /SessionImpactPanel/, 'session completion must use the production ceremony and digest');
assert.match(registry, /PostSessionLedgerCeremony[\s\S]*Temporary ledger artwork/, 'completion inspector metadata must expose the replaceable ledger asset boundary');
assert.match(preview, /libraryResetKey/, 'global reset must deterministically reset every preview');
assert.match(preview, /playbackRate/, 'preview choreography must honor the global speed selection');
assert.match(preview, /settings\.reduceMotion/, 'previews must honor the local Reduced Motion override');
assert.match(screen, /NavigatorSection/, 'the catalog must use collapsible navigator sections instead of rendering every preview');
assert.match(screen, /selectedEntry/, 'only the selected animation should mount in the inspector workspace');
assert.match(screen, /Search animations/, 'the navigator must support search');
assert.match(screen, /Haptics.*Interaction.*Reduced Motion/s, 'the navigator must expose the requested filters');
assert.match(screen, /TuningPanel/, 'the selected preview must expose preview-only motion tuning');
assert.match(screen, /Start with a preset/, 'the tuning panel must lead with human-readable presets');
assert.match(tuningModel, /Overall feel[\s\S]*Speed[\s\S]*Bounce[\s\S]*Overshoot/s, 'human controls must expose meaningful motion language');
assert.match(screen, /Advanced[\s\S]*advancedOpen/s, 'raw timing and spring controls must be collapsed under Advanced by default');
assert.match(screen, /Production[\s\S]*Current edits/s, 'the workshop must offer live production-versus-edits comparison');
assert.match(screen + tuningModel, /Phase map[\s\S]*Entrance[\s\S]*Hold[\s\S]*Replacement[\s\S]*Evidence settles/s, 'the tuning panel must visualize the recognition phases');
assert.match(screen, /Reset character[\s\S]*Reset choreography[\s\S]*Reset this animation to production/s, 'reset actions must exist at useful scopes');
assert.match(motionPreview, /MotionPreviewContext/, 'motion overrides must be scoped through a preview provider');
assert.match(motionPreview, /DEV-workshop geometry/, 'preview-only geometry must remain explicitly isolated from production tokens');
assert.match(favoritesStorage, /AsyncStorage\.getItem/, 'favorites must load from DEV-local storage');
assert.match(favoritesStorage, /AsyncStorage\.setItem/, 'favorites must persist to DEV-local storage');
assert.match(favoritesStorage, /JSON\.stringify\(parsed\) !== JSON\.stringify\(normalized\)[\s\S]*AsyncStorage\.setItem/, 'removed favorite ids must be rewritten out of DEV-local storage');
assert.match(screen, /normalizeAnimationTuningEntries[\s\S]*Object\.keys\(entries\)\.length !== Object\.keys\(saved\.entries\)\.length[\s\S]*AsyncStorage\.setItem/, 'removed per-animation tuning must be rewritten out of DEV-local storage');
assert.doesNotMatch(screen, /SLMotion\.[A-Za-z]+\s*=/, 'the tuning sandbox must never mutate production motion tokens');

assert.deepEqual(normalizeAnimationFavoriteIds(['weight-pr', 'removed-animation', 'weight-pr'], ['weight-pr', 'rep-max-pr']), ['weight-pr']);
assert.deepEqual(normalizeAnimationFavoriteIds(['e1rm-pr'], ANIMATION_LIBRARY.map((entry) => entry.id)), [], 'saved e1RM favorites must be discarded');
assert.deepEqual(normalizeAnimationFavoriteIds(removedRecognitionPermutationIds, ANIMATION_LIBRARY.map((entry) => entry.id)), [], 'saved favorites for removed recognition permutations must be discarded');
assert.deepEqual(normalizeAnimationFavoriteIds(removedMovementTransitionPreviewIds, ANIMATION_LIBRARY.map((entry) => entry.id)), [], 'saved favorites for removed movement-transition previews must be discarded');
assert.deepEqual(normalizeAnimationFavoriteIds(removedCompletionPermutationIds, ANIMATION_LIBRARY.map((entry) => entry.id)), [], 'saved favorites for removed completion phase previews must be discarded');
assert.deepEqual(toggleAnimationFavorite([], 'weight-pr'), ['weight-pr']);
assert.deepEqual(toggleAnimationFavorite(['weight-pr', 'rep-max-pr'], 'weight-pr'), ['rep-max-pr']);

const productionMotion = {
  entranceMs: 240,
  stateMs: 190,
  spatialMs: 320,
  staggerMs: 42,
  phaseDelayMs: 440,
  spring: { stiffness: 250, damping: 22, mass: 0.72 },
  distancePx: 12,
  overshootPx: 0,
  emphasisScale: 1,
};
assert.deepEqual(
  Object.keys(normalizeAnimationTuningEntries({
    'weight-pr': { entranceMs: 999 },
    'e1rm-pr': { entranceMs: 999 },
    ...Object.fromEntries(removedRecognitionPermutationIds.map((id) => [id, { entranceMs: 999 }])),
    ...Object.fromEntries(removedMovementTransitionPreviewIds.map((id) => [id, { entranceMs: 999 }])),
    ...Object.fromEntries(removedCompletionPermutationIds.map((id) => [id, { entranceMs: 999 }])),
  }, ANIMATION_LIBRARY.map((entry) => entry.id), productionMotion)),
  ['weight-pr'],
  'saved tuning for a removed e1RM preview must be discarded',
);
assert.deepEqual(LOCKED_ANIMATION_LIBRARY_MOTION, {
  entranceMs: 307,
  stateMs: 244,
  spatialMs: 403,
  staggerMs: 28,
  phaseDelayMs: 543,
  spring: { stiffness: 260, damping: 14, mass: 0.68 },
  distancePx: 8,
  overshootPx: 12,
  emphasisScale: 1,
}, 'the user-approved workshop tuning must remain locked exactly');
assert.equal(Object.keys(DESIGNER_CONTROLS).length, 8, 'the human model must cover all requested design concepts');
assert.equal(MOTION_PRESETS.length, 10, 'the requested preset library must remain complete');
for (const preset of ['apple', 'material', 'gentle', 'crisp', 'playful', 'premium', 'athletic', 'celebration', 'minimal', 'instant']) {
  assert.ok(MOTION_PRESETS.some((candidate) => candidate.id === preset), `missing ${preset} motion preset`);
}
const playful = applyMotionPreset('playful', productionMotion);
assert.ok(playful.overshootPx > productionMotion.overshootPx, 'expressive presets must populate editable geometry values');
assert.ok(playful.spring.damping < productionMotion.spring.damping, 'playful tuning must produce more bounce');
const fast = applyDesignerChoice(productionMotion, 'speed', 'fast');
assert.ok(fast.entranceMs < productionMotion.entranceMs, 'human speed choices must update raw timing values');
assert.equal(inferDesignerChoices(fast).speed, 'fast', 'advanced raw values must synchronize back to the human speed label');
assert.equal(scaleMotionTiming(productionMotion, 0.9).entranceMs, 216, 'quick timing adjustments must scale all timings predictably');
assert.deepEqual(resetMotionSection(playful, productionMotion, 'feel').spring, productionMotion.spring, 'section reset must restore production spring values');
assert.deepEqual(phaseTimeline(productionMotion).map((phase) => phase.label), ['Entrance', 'Hold', 'Replacement', 'Evidence settles']);

for (const source of [screen, preview, mockData, favoritesStorage, tuningModel]) {
  assert.doesNotMatch(source, /fetchJson|\bfetch\s*\(|useAuth|createSetLog|accomplishment.*POST/i, 'animation library must not read or mutate backend/account state');
}

console.log(`[animation-library] ${ids.length} registry previews, DEV routing, shared primitives, and isolation checks passed`);
