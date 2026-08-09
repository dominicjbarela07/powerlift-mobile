import assert from 'node:assert/strict';
import fs from 'node:fs';

import { recognitionPresentation, selectCelebrationEvents, selectSessionHighlights } from '../lib/logger-feedback.ts';

const event = {
  id: 8101,
  event_type: 'CORE_E1RM_PR',
  priority: 30,
  core_movement_key: 'competition_squat',
  movement_label: 'Competition Squat',
  current_value: 208,
  prior_value: 204,
  delta: 4,
  unit: 'kg',
  scope: 'career',
  source_set_log_id: 901,
  trigger_set_log_id: 901,
  source_revision: 1,
  calculation_version: 'core-accomplishment-v1',
  newly_generated: true,
  replayed: false,
  consumed: false,
  evidence: { actual_weight_kg: 180, actual_reps: 5, actual_rpe: 8 },
};

assert.deepEqual(selectCelebrationEvents([event]).map((row) => row.id), [], 'e1RM must not enter the in-session celebration queue');
assert.deepEqual(selectSessionHighlights([event]).map((row) => row.id), [8101], 'e1RM must remain available to the durable session digest');
assert.equal(recognitionPresentation(event, 'kg'), null, 'even a direct transient presenter call must suppress e1RM');
assert.equal(recognitionPresentation(event, 'kg', 'historical')?.value, '208 kg', 'historical e1RM formatting must remain intact');

const feedback = fs.readFileSync(new URL('../lib/logger-feedback.ts', import.meta.url), 'utf8');
const recap = fs.readFileSync(new URL('../components/workout-logger/stage5-impact-summary.tsx', import.meta.url), 'utf8');
const registry = fs.readFileSync(new URL('../dev-mocks/animation-library/registry.ts', import.meta.url), 'utf8');
const preview = fs.readFileSync(new URL('../dev-mocks/animation-library/preview-card.tsx', import.meta.url), 'utf8');

const transientTypes = feedback.match(/const TRANSIENT_RECOGNITION_EVENT_TYPES = new Set\(\[([\s\S]*?)\]\);/)?.[1] || '';
assert.doesNotMatch(transientTypes, /CORE_E1RM_PR|CORE_BLOCK_E1RM_BEST/, 'career and block e1RM must stay out of transient recognition');
assert.match(feedback, /SESSION_HIGHLIGHT_EVENT_TYPES[\s\S]*CORE_E1RM_PR/, 'e1RM must remain a durable session highlight type');
assert.match(recap, /estimated_strength_insights/, 'the recap contract must consume explicit estimated-strength insights');
assert.match(recap, /Estimated 1RM increased/, 'the recap must use concise analytical language');
assert.match(recap, /↑ \+/, 'the recap must show a concise positive estimate delta');
const insightComponent = recap.match(/function EstimatedStrengthInsights[\s\S]*?function ProgressRow/)?.[0] || '';
assert.doesNotMatch(insightComponent, /SLTrophy|particle|fragment|celebration/i, 'estimated-strength insight must not use celebration choreography');
assert.doesNotMatch(registry, /e1rm|estimated[\s-]*1rm/i, 'the registry must not expose a dedicated e1RM recognition under any name');
assert.doesNotMatch(preview, /e1rm|estimated[\s-]*1rm/i, 'the preview router must not retain e1RM playback states or variants');

console.log('[e1rm-session-insight] transient suppression, durable recap insight, history preservation, and non-celebratory presentation passed');
