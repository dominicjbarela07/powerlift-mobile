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

assert.match(sheet, /<StrengthLedgerBottomSheet\b/, 'the preview uses the governed bottom sheet and dismissal behavior');
assert.match(sheet, /<StrengthLedgerBottomSheetScrollView\b/, 'long preview content scrolls independently');
assert.doesNotMatch(sheet, /PanResponder\.create|presentationStyle="fullScreen"/, 'the preview has no custom drag gesture or full-screen page');
assert.match(sheet, /movements\.map\(\(movement, index\)/, 'the full ordered movement list is available');
assert.match(sheet, /movement\.kind === 'accessory' \? 'ACCESSORY' : 'CORE'/, 'Core and Accessory identity is visible');
assert.match(sheet, /trainingHubMovementPrescription\(movement\)/, 'prescriptions come from the existing canonical preview formatter');
assert.match(sheet, /movement\.equipmentType/, 'available equipment context is retained');
assert.match(sheet, /movementCount > movements\.length/, 'incomplete preview payloads disclose the remaining count');
assert.match(sheet, /accessibilityState=\{\{ busy: opening, disabled: opening \}\}/, 'repeated CTA taps are gated');

assert.match(route, /returnTo: 'training-hub'/, 'Training Hub marks the canonical Session destination with its return context');
assert.match(route, /lifecycleStatus: session\.status \|\| session\.kind \|\| null/, 'the preview consumes authoritative Session lifecycle state');
assert.match(
  logger,
  /returnTo === 'program-timeline' && programId[\s\S]*router\.navigate\(\{ pathname: '\/\(tabs\)\/workout\/program-timeline'/,
  'Logger returns explicitly to the Program map',
);
assert.match(logger, /router\.navigate\('\/\(tabs\)\/workout'/, 'Logger returns explicitly to Training Hub');

console.log('training hub Session preview bottom sheet contract: ok');
