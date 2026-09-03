import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { rankSimilarAccessoryMovements } from '../lib/canonical-accessory-discovery.ts';
import { accessorySwapActionForItem } from '../lib/accessory-swap-eligibility.ts';

const current = {
  id: 10,
  display_name: '45-Degree Back Extension (Hamstring Bias)',
  primary_muscle_group: 'hamstrings',
  secondary_muscle_groups: ['glutes', 'lower_back'],
  execution_family: 'BODYWEIGHT',
  family: 'hamstring_accessories',
  requires_equipment_configuration: false,
};
const candidates = [
  { id: 10, display_name: current.display_name, primary_muscle_group: 'hamstrings', execution_family: 'BODYWEIGHT' },
  { id: 12, display_name: 'Assisted Nordic Curl', primary_muscle_group: 'hamstrings', secondary_muscle_groups: ['glutes'], execution_family: 'BODYWEIGHT', family: 'hamstring_accessories', requires_equipment_configuration: false },
  { id: 11, display_name: 'Seated Leg Curl', primary_muscle_group: 'hamstrings', secondary_muscle_groups: [], execution_family: 'MACHINE', family: 'hamstring_accessories', requires_equipment_configuration: true },
  { id: 13, display_name: 'Cable Curl', primary_muscle_group: 'biceps', secondary_muscle_groups: [], execution_family: 'CABLE', family: 'arm_accessories' },
];
const ranked = rankSimilarAccessoryMovements(current, candidates);
assert.deepEqual(ranked.map((row) => row.identity.id), [12, 11], 'governed taxonomy produces relevant ordered candidates and excludes unrelated rows');
assert.ok(ranked.every((row) => row.identity.id !== current.id), 'current exact canonical identity is never recommended');
assert.match(ranked[0].reason, /Same primary emphasis/, 'recommendation reason is supported by the shared primary muscle');

const eligible = (overrides = {}) => accessorySwapActionForItem({
  substitutionAuthority: 'self_governed',
  hasApprovedSubstitutions: false,
  isCoachPreview: false,
  sessionLifecycle: 'pre_session',
  targetItemHasSetLogs: false,
  targetItemHasRemainingSets: true,
  acceptedPersistedSetLogForItem: false,
  ...overrides,
});
assert.equal(eligible(), 'Swap', 'self-coached + not started is eligible');
assert.equal(eligible({ targetItemHasSetLogs: true }), null, 'in-progress accessory is locked');
assert.equal(eligible({ sessionLifecycle: 'completed' }), null, 'completed Session is locked');
assert.equal(eligible({ substitutionAuthority: 'coach_restricted', hasApprovedSubstitutions: true }), null, 'coached athlete is ineligible');
assert.equal(eligible({ substitutionAuthority: 'none', isCoachPreview: true }), null, 'coach managing another athlete is ineligible');

const picker = readFileSync(new URL('../components/movement/GovernedAccessoryPickerModal.tsx', import.meta.url), 'utf8');
const logger = readFileSync(new URL('../app/(tabs)/workout/[workoutId].tsx', import.meta.url), 'utf8');
const sheet = readFileSync(new URL('../components/workout-logger/substitution-confirmation-sheet.tsx', import.meta.url), 'utf8');
const workspace = readFileSync(new URL('../app/(tabs)/workout/session-workspace/[workoutId].tsx', import.meta.url), 'utf8');
const shared = readFileSync(new URL('../lib/canonical-accessory-discovery.ts', import.meta.url), 'utf8');

assert.match(picker, /SWAPPING[\s\S]*Current prescription[\s\S]*SIMILAR MOVEMENTS/, 'entry establishes current movement context before recommendations');
assert.match(picker, /rankSimilarAccessoryMovements[\s\S]*primary_muscle_group[\s\S]*include_secondary/, 'similarity uses governed taxonomy search and ranking');
assert.doesNotMatch(picker, /FULL LIBRARY|mode.*'all'/, 'primary experience does not dump the full library');
assert.match(picker, /Browse by Muscle Group[\s\S]*ACCESSORY_PICKER_REGIONS[\s\S]*selectedRegion\.muscles/, 'muscle-group drill-down uses canonical shared regions');
assert.match(workspace, /from '@\/lib\/canonical-accessory-discovery'/, 'Session Workspace consumes the same extracted taxonomy module');
assert.match(shared, /ACCESSORY_MUSCLE_GROUPS[\s\S]*ACCESSORY_PICKER_REGIONS/, 'shared module owns canonical muscle taxonomy and region grouping');
assert.match(picker, /favorites_only[\s\S]*recent_only[\s\S]*custom_only/, 'Favorites, Recent, and My Movements use governed backend filters');
assert.match(picker, /placeholder="Search names, aliases, or taxonomy"/, 'direct lookup clearly exposes governed search');
assert.match(picker, /params\.set\('q', query\.trim\(\)\)/, 'direct lookup sends the query to canonical server search');
assert.match(picker, /uniqueIdentities\(items, currentIdentity\?\.id\)/, 'all result paths exclude the current exact identity');
assert.match(logger, /onSelect=\{\(identity\) => \{[\s\S]*setSwapAccVisible\(true\)/, 'selection opens configuration without invoking the mutation');
assert.match(logger, /setSwapAccForm\([\s\S]*performed_sets \?\? it\.sets[\s\S]*accessoryRepTargetFromText/, 'existing prescription initializes configuration');
assert.match(sheet, /label: 'SETS'[\s\S]*label: 'RIR'/, 'canonical wheels retain editable sets and effort');
assert.match(sheet, /Single[\s\S]*Range[\s\S]*AMRAP/, 'canonical prescription controls retain fixed, range, and AMRAP targets');
assert.match(sheet, /onPress=\{onResetPrescription\}[\s\S]*Reset to Previous Prescription/, 'reset-to-previous is reachable');
assert.match(logger, /performed_canonical_movement_definition_id: swapAccIdentity\.id[\s\S]*sets: sets[\s\S]*reps_text: repsText[\s\S]*rir: rir/, 'confirmation persists stable movement identity and modified prescription');
assert.doesNotMatch(logger, /savedItem\?\.performed_canonical_movement_identity[\s\S]*openIdentityPicker\(savedItem\)/, 'confirming Swap cannot auto-open equipment');
assert.doesNotMatch(picker, /openIdentityPicker|equipment.*onPress/, 'movement selection cannot auto-open equipment');
assert.match(sheet, /equipmentUnresolved[\s\S]*Choose when ready/, 'equipment may remain unresolved during planning');
assert.match(logger, /openAccessoryWheel[\s\S]*needsEquipmentSelection\(item\)[\s\S]*openIdentityPicker/, 'single accessory logging enforces equipment before first evidence');
assert.match(logger, /openSupersetRoundLogger[\s\S]*needsEquipmentSelection\(item\)[\s\S]*openIdentityPicker/, 'superset logging enforces the same first-evidence equipment boundary');
assert.match(logger, /dataRef\.current = projectSavedItem[\s\S]*setData\(\(current\) => projectSavedItem\(current\)\)[\s\S]*fetchWorkout\(\{ silent: true/, 'accepted swap projects immediately before silent reconciliation');
assert.match(sheet, /FROM[\s\S]*previousPrescription[\s\S]*TO[\s\S]*replacementPrescription[\s\S]*Confirm Swap/, 'final review shows both movements and prescriptions before mutation');
assert.match(logger, /resolveLoggerMovementIdentity\(swapAccItem\)\.effective/, 'history/artwork/logger rendering stays on canonical effective identity');

console.log('self-coached accessory Swap V2 contracts: PASS');
