import assert from 'node:assert/strict';
import fs from 'node:fs';

import { ANIMATION_LIBRARY } from '../dev-mocks/animation-library/registry.ts';
import {
  CANONICAL_RECOGNITION_MOTION_REGISTRY,
  LOGGER_RECOGNITION_EVENT_TYPES,
  recognitionMotionConfig,
} from '../lib/recognition-motion-registry.ts';

const feedback = fs.readFileSync(new URL('../components/workout-logger/logger-feedback.tsx', import.meta.url), 'utf8');
const canonical = fs.readFileSync(new URL('../components/workout-logger/canonical-record-recognition.tsx', import.meta.url), 'utf8');
const workshop = fs.readFileSync(new URL('../dev-mocks/animation-library/preview-card.tsx', import.meta.url), 'utf8');
const feedbackDomain = fs.readFileSync(new URL('../lib/logger-feedback.ts', import.meta.url), 'utf8');

assert.equal(Object.keys(CANONICAL_RECOGNITION_MOTION_REGISTRY).length, LOGGER_RECOGNITION_EVENT_TYPES.length);
assert.deepEqual(Object.keys(CANONICAL_RECOGNITION_MOTION_REGISTRY), [...LOGGER_RECOGNITION_EVENT_TYPES]);
assert.equal(ANIMATION_LIBRARY.length, 36, 'the approved Motion Workshop must retain all 36 entries');

const workshopIds = new Set(ANIMATION_LIBRARY.map((entry) => entry.id));
for (const eventType of LOGGER_RECOGNITION_EVENT_TYPES) {
  const config = recognitionMotionConfig(eventType);
  assert.ok(config, `${eventType} must resolve through the canonical recognition registry`);
  assert.ok(workshopIds.has(config.workshopEntryId), `${eventType} must resolve to an approved workshop entry`);
}

assert.match(workshop, /WeightPrRecognitionPreview[\s\S]*<CanonicalRecordRecognition/, 'workshop record previews must use the shipping primitive');
assert.match(feedback, /RecordReplacementHero[\s\S]*<CanonicalRecordRecognition/, 'Logger record events must use the same shipping primitive');
assert.equal((workshop.match(/function WeightPrRecognitionPreview/g) || []).length, 1, 'workshop may retain one parameter wrapper only');
assert.doesNotMatch(workshop, /oldTranslateY|fragmentProgress|groundLineScale/, 'workshop must not duplicate the production choreography');
assert.match(canonical, /CANONICAL_RECORD_RECOGNITION_MOTION/, 'production choreography must consume the canonical locked motion tokens');

assert.match(feedback, /!motionConfig \? <Animated\.View/, 'generic intro is available only for unknown future recognition events');
assert.match(feedback, /isKnownCompletion \|\| motionConfig \? \([\s\S]*CompletionEvidenceRecognition[\s\S]*\) : <Animated\.View/s, 'known events must never fall through to the generic recognition body');
assert.match(feedback, /previousValue=\{presentation\.detail\?\.replace\([^)]*\) \?\? null\}/, 'first-established records must use the canonical record primitive without fabricated history');

assert.match(feedbackDomain, /mode === 'transient' && \['CORE_E1RM_PR', 'CORE_BLOCK_E1RM_BEST'\]\.includes\(event\.event_type\)\) return null/, 'e1RM remains post-session evidence rather than a transient Logger interruption');

console.log('[recognition-motion-canonicalization] complete registry, shared primitive, no known generic fallback, and 36-entry workshop passed');
