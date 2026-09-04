import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  exactPriorExposureCount,
  relatedEquipmentIdentityLabel,
  resolveSessionRecapRelatedHistory,
} from '../lib/session-recap-related-history.ts';

const reference = (overrides = {}) => ({
  movement_definition_id: 902,
  movement_family_id: 40,
  display_name: 'Cybex Leg Press',
  manufacturer: 'Cybex',
  equipment_model: 'VR3 Leg Press',
  equipment_type: 'machine',
  loading_implementation: 'selectorized_machine',
  load_convention: 'machine_stack_display',
  measurement_type: 'load_reps',
  implementation_key: 'cybex:leg_press',
  identity_status: 'canonical',
  last_performed_on: '2026-08-04',
  last_set: { set_log_id: 802, weight_kg: 204.116, reps: 12, rir: 1, date: '2026-08-04' },
  reference_only: true,
  loads_comparable: false,
  ...overrides,
});

const context = (references = [reference()], overrides = {}) => ({
  state: 'context_available',
  relationship: 'same_governed_movement_family',
  movement_family_id: 40,
  comparison_confidence: 'context_only',
  ranking_policy: 'canonical_related_history_order_v1',
  reference_only: true,
  loads_comparable: false,
  references,
  ...overrides,
});

const movement = (overrides = {}) => ({
  kind: 'accessory',
  measurement: { canonical_identity_id: 501, comparison_eligible: true },
  trend: { points: [{ current: true }] },
  related_history: context(),
  ...overrides,
});

// Exact history remains authoritative, including the Assisted Nordic-style path.
const exact = movement({ trend: { points: [{ current: false }, { current: true }] } });
assert.equal(exactPriorExposureCount(exact), 1);
assert.equal(resolveSessionRecapRelatedHistory(exact), null, 'exact history must win over related context');

// First exact exposure accepts the explicit, context-only same-family contract.
const firstExact = resolveSessionRecapRelatedHistory(movement());
assert.ok(firstExact);
assert.equal(firstExact.references.length, 1);
assert.equal(firstExact.references[0].movement_definition_id, 902);

// Canonical backend ranking is consumed as-is; the UI does not re-rank by name or load.
const ranked = resolveSessionRecapRelatedHistory(movement({
  related_history: context([
    reference({ movement_definition_id: 903, last_performed_on: '2026-08-10', last_set: { set_log_id: 803, weight_kg: 180, reps: 15 } }),
    reference({ movement_definition_id: 902, last_performed_on: '2026-08-04' }),
    reference({ movement_definition_id: 901, last_performed_on: '2026-07-01', last_set: { set_log_id: 801, weight_kg: 230, reps: 8 } }),
  ]),
}));
assert.deepEqual(ranked.references.map((row) => row.movement_definition_id), [903, 902, 901]);

// Manufacturer, model, and loading mode visibly explain the identity difference.
assert.equal(relatedEquipmentIdentityLabel(reference()), 'Cybex · VR3 Leg Press · Selectorized');
assert.equal(
  relatedEquipmentIdentityLabel(reference({ manufacturer: 'Hammer Strength', equipment_model: null, loading_implementation: 'plate_loaded_machine' })),
  'Hammer Strength · Plate Loaded',
);

// No confidence, relationship, family, or comparability inference is made client-side.
assert.equal(resolveSessionRecapRelatedHistory(movement({ related_history: context([reference()], { comparison_confidence: 'low' }) })), null);
assert.equal(resolveSessionRecapRelatedHistory(movement({ related_history: context([reference()], { relationship: 'name_similarity' }) })), null);
assert.equal(resolveSessionRecapRelatedHistory(movement({ related_history: context([reference({ movement_family_id: 41 })]) })), null);
assert.equal(resolveSessionRecapRelatedHistory(movement({ related_history: context([reference({ loads_comparable: true })]) })), null);

// Ineligible/custom identities retain their governed fail-closed policy.
assert.equal(resolveSessionRecapRelatedHistory(movement({ measurement: { canonical_identity_id: 601, comparison_eligible: false } })), null);

// Retired historical identity is preserved rather than rewritten to its replacement.
const retired = resolveSessionRecapRelatedHistory(movement({
  related_history: context([reference({
    movement_definition_id: 901,
    identity_status: 'retired',
    replacement_movement_definition_id: 903,
    display_name: 'Hammer Strength Leg Press (Legacy)',
    last_set: { set_log_id: 801, weight_kg: 199.581, reps: 10 },
  })]),
}));
assert.equal(retired.references[0].movement_definition_id, 901);
assert.equal(retired.references[0].identity_status, 'retired');
assert.equal(retired.references[0].replacement_movement_definition_id, 903);

// A true first performance remains intentional only when no qualifying evidence exists.
assert.equal(resolveSessionRecapRelatedHistory(movement({ related_history: null })), null);
assert.equal(resolveSessionRecapRelatedHistory(movement({ related_history: context([]) })), null);

const source = fs.readFileSync(new URL('../components/coach-mobile/CompletedSessionRecap.tsx', import.meta.url), 'utf8');
const certificationSource = fs.readFileSync(new URL('../app/dev-session-recap-certification.tsx', import.meta.url), 'utf8');
assert.match(source, /EXACT HISTORY/);
assert.match(source, /FIRST EXACT EXPOSURE/);
assert.match(source, /EXACT POINT \+ RELATED CONTEXT/);
assert.match(source, /RELATED HISTORY · DIFFERENT EQUIPMENT/);
assert.match(source, /Separate equipment identities · no load delta/);
assert.match(source, /Different equipment loads are not treated as equivalent/);
assert.match(source, /FIRST PERFORMANCE/);
assert.match(source, /Baseline established\. Future performances on this exact equipment will build progression history\./);
assert.match(source, /movement\.trend\?\.state === 'first_comparable_performance' \? <ExactFirstPerformancePanel/);
assert.match(source, /\(movement\.trend\?\.points\?\.length \|\| 0\) >= 2/);
const relatedFormatter = source.match(/function relatedReferenceResult\([\s\S]*?\n}\n/);
assert.ok(relatedFormatter, 'related result formatter must remain explicit');
assert.doesNotMatch(relatedFormatter[0], /movementRawChange|formatSessionRecapTrendDelta|delta_value|percent/i, 'related results must not calculate a delta');
assert.match(certificationSource, /scenario === 'related'/, 'DEV certification must preserve a visual related-history story');
assert.match(certificationSource, /Rogers Athletic · Plate Loaded/);
assert.match(certificationSource, /Cybex Leg Press/);

console.log('post-session related-history fallback tests passed');
