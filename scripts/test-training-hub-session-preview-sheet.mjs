import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  resolveTrainingHubSessionPreviewAction,
  trainingHubMovementPrescription,
} from '../lib/training-hub-session-preview.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const component = fs.readFileSync(path.join(root, 'components/training-hub/AthleteTrainingHubExperience.tsx'), 'utf8');
const sheet = fs.readFileSync(path.join(root, 'components/training-hub/TrainingHubSessionPreviewSheet.tsx'), 'utf8');
const route = fs.readFileSync(path.join(root, 'app/(tabs)/workout/index.tsx'), 'utf8');
const logger = fs.readFileSync(path.join(root, 'app/(tabs)/workout/[workoutId].tsx'), 'utf8');

assert.deepEqual(
  resolveTrainingHubSessionPreviewAction({ status: 'assigned' }),
  { ctaLabel: 'Open Session', lifecycle: 'not_started', openable: true, statusLabel: 'Not Started' },
  'assigned Sessions open the canonical pre-Session logger',
);
assert.equal(
  resolveTrainingHubSessionPreviewAction({ status: 'in_progress' }).ctaLabel,
  'Continue Session',
  'active Sessions continue instead of restarting',
);
assert.equal(
  resolveTrainingHubSessionPreviewAction({ status: 'completed' }).ctaLabel,
  'View Session Recap',
  'completed Sessions open performed evidence',
);
assert.equal(resolveTrainingHubSessionPreviewAction({ status: 'draft' }).openable, false, 'draft Sessions are not athlete-openable');
assert.equal(resolveTrainingHubSessionPreviewAction({ status: 'cancelled' }).openable, false, 'cancelled Sessions are not athlete-openable');
assert.equal(resolveTrainingHubSessionPreviewAction({ fallbackStatus: 'upcoming' }).ctaLabel, 'Open Session', 'Hub upcoming alias remains openable');

assert.equal(trainingHubMovementPrescription({ prescription: '3 × 8–10' }), '3 × 8–10');
assert.equal(trainingHubMovementPrescription({ sets: 4, repsText: '6–8' }), '4 × 6–8');
assert.equal(trainingHubMovementPrescription({}), 'Prescription not available');

assert.match(component, /<TrainingHubSessionPreviewBottomSheet/, 'Training Hub Session taps render the in-place bottom sheet');
assert.doesNotMatch(component, /<SessionPreviewSheet\s/, 'the normal Hub flow no longer mounts the legacy full-screen preview');
assert.match(component, /setSelectedSessionId\(null\)[\s\S]*requestAnimationFrame\(\(\) => onAction/, 'the sheet resolves before canonical navigation');
assert.match(component, /selectedSessionContext[\s\S]*blockName: block\.name[\s\S]*weekNumber: week\.number/, 'the sheet preserves Program → Block → Week context');

assert.match(sheet, /presentationStyle="overFullScreen"[\s\S]*transparent/, 'the preview uses an in-place transparent overlay');
assert.doesNotMatch(sheet, /presentationStyle="fullScreen"/, 'the new preview is not a full-screen page');
assert.match(sheet, /PanResponder\.create/, 'the drag affordance supports swipe-down dismissal');
assert.match(sheet, /Pressable[\s\S]*Dismiss Session preview[\s\S]*StyleSheet\.absoluteFillObject/, 'the canonical backdrop dismisses the sheet');
assert.match(sheet, /<ScrollView/, 'long preview content scrolls independently');
assert.match(sheet, /MOVEMENT_PREVIEW_LIMIT = 5/, 'the preview uses the governed compact row limit');
assert.match(sheet, /slice\(0, MOVEMENT_PREVIEW_LIMIT\)/, 'movement preview remains compact and bounded');
assert.match(sheet, /remainingMovements[\s\S]*more movement/, 'the sheet reports the canonical remaining movement count');
assert.match(sheet, /paddingBottom: Math\.max\(insets\.bottom, SLSpacing\.md\)/, 'the sticky CTA footer respects the physical safe area');
assert.match(sheet, /accessibilityState=\{\{ busy: opening, disabled: opening \}\}/, 'repeated CTA taps are gated');
assert.match(sheet, /useSLReducedMotion/, 'sheet motion obeys the app accessibility preference');

assert.match(route, /returnTo: 'training-hub'/, 'Training Hub marks the canonical Session destination with its return context');
assert.match(route, /lifecycleStatus: session\.status \|\| session\.kind \|\| null/, 'the preview consumes authoritative Session lifecycle state');
assert.match(logger, /returnTo === 'training-hub' && router\.canGoBack\(\)[\s\S]*router\.back\(\)/, 'Logger returns to the mounted Hub instead of pushing a duplicate');
assert.match(logger, /router\.replace\('\/\(tabs\)\/workout'/, 'Logger has a safe Hub fallback when no back stack exists');

console.log('training hub Session preview bottom sheet contract: ok');
