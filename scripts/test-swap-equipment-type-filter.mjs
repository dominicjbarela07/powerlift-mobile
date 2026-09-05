#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  ACCESSORY_EXECUTION_FAMILIES,
  SWAP_EQUIPMENT_TYPE_FILTERS,
  availableSwapEquipmentTypeFilters,
  governedAccessoryExecutionFamilyKey,
} from '../lib/canonical-accessory-discovery.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const picker = fs.readFileSync(
  path.join(root, 'components', 'movement', 'GovernedAccessoryPickerModal.tsx'),
  'utf8',
);

assert.deepEqual(
  SWAP_EQUIPMENT_TYPE_FILTERS.map(({ key, label }) => [key, label]),
  [
    ['FREE_WEIGHT', 'Free Weight'],
    ['MACHINE', 'Machine'],
    ['CABLE', 'Cable'],
    ['BAND', 'Band'],
    ['BODYWEIGHT', 'Bodyweight'],
    ['OTHER_PORTABLE', 'Other'],
  ],
  'Swap must expose the compact governed equipment-type order and filter copy',
);
assert.ok(
  SWAP_EQUIPMENT_TYPE_FILTERS.every(({ key }) => ACCESSORY_EXECUTION_FAMILIES.some(([governed]) => governed === key)),
  'every Swap filter key must come from the Session Workspace execution-family taxonomy',
);

const biceps = [
  { id: 1, display_name: 'Dumbbell Curl', execution_family: 'FREE_WEIGHT' },
  { id: 2, display_name: 'EZ-Bar Curl', execution_family: 'FREE_WEIGHT' },
  { id: 3, display_name: 'Single-Arm Cable Curl', execution_family: 'CABLE' },
  { id: 4, display_name: 'Machine Preacher Curl', execution_family: 'MACHINE' },
  { id: 5, display_name: 'Band Curl', execution_family: 'BAND' },
];
assert.deepEqual(
  availableSwapEquipmentTypeFilters(null, biceps).map(({ label }) => label),
  ['Free Weight', 'Machine', 'Cable', 'Band'],
  'fallback availability must hide empty Bodyweight and Other buckets without inspecting names',
);
assert.deepEqual(
  availableSwapEquipmentTypeFilters([
    { key: 'FREE_WEIGHT', count: 12 },
    { key: 'MACHINE', count: 3 },
    { key: 'CABLE', count: 8 },
    { key: 'BAND', count: 2 },
    { key: 'BODYWEIGHT', count: 0 },
    { key: 'UNKNOWN_FUTURE_FAMILY', count: 99 },
  ]).map(({ label }) => label),
  ['Free Weight', 'Machine', 'Cable', 'Band'],
  'server facets must fail closed to positive governed categories only',
);
assert.equal(governedAccessoryExecutionFamilyKey('machine'), 'MACHINE');
assert.equal(governedAccessoryExecutionFamilyKey('unknown'), null);
assert.deepEqual(
  availableSwapEquipmentTypeFilters(null, [
    { id: 20, display_name: 'Machine-Named Dumbbell Curl', execution_family: 'FREE_WEIGHT' },
  ]).map(({ key }) => key),
  ['FREE_WEIGHT'],
  'movement display text must never classify the equipment filter',
);

assert.match(
  picker,
  /<Text style=\{styles\.pageTitle\}>\{resultTitle\}<\/Text>[\s\S]*Primary matches first[\s\S]*testID="swap-equipment-type-filters"/,
  'the horizontal filter rail must sit directly under the muscle heading and explanatory copy',
);
assert.match(
  picker,
  /horizontal showsHorizontalScrollIndicator=\{false\}[\s\S]*>All<[\s\S]*equipmentTypeFilters\.map/,
  'the result screen must expose All plus only available governed categories',
);
assert.match(
  picker,
  /params\.set\('q', query\.trim\(\)\)[\s\S]*primary_muscle_group[\s\S]*include_secondary[\s\S]*params\.set\('execution_family', selectedExecutionFamily\)/,
  'search, exact muscle, primary/secondary grouping, and equipment category must compose in one governed request',
);
assert.match(
  picker,
  /if \(step === 'results' && mode === 'muscle'\) return;[\s\S]*setMode\('search'\)/,
  'typing from a muscle result must preserve the muscle/category scope instead of switching to global search',
);
assert.match(
  picker,
  /grouped \? \[\.\.\.\(grouped\.primary\?\.items \|\| \[\]\), \.\.\.\(grouped\.secondary\?\.items \|\| \[\]\)\]/,
  'primary matches must remain before secondary matches within every filter',
);
assert.match(
  picker,
  /exclude_movement_definition_id[\s\S]*currentIdentity\.id/,
  'the current exact movement must be excluded from both results and category availability',
);
assert.doesNotMatch(
  picker,
  /selectedExecutionFamily[\s\S]{0,180}manufacturer/i,
  'the quick filter must remain movement-category scoped, never manufacturer scoped',
);
assert.match(
  picker,
  /equipmentTypeFilters\.map[\s\S]*setSelectedExecutionFamily\(filter\.key\)[\s\S]*renderIdentity/,
  'a filter tap must narrow the existing inline result list without another sheet or drill-down',
);

console.log('[swap-equipment-type-filter] PASS — governed facets, composed search, ordering, and inline filter behavior');
