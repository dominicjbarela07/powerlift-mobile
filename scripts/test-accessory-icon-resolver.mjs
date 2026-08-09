import assert from 'node:assert/strict';

import { resolveAccessoryIconName } from '../lib/accessory-icon-resolver.ts';

const cases = [
  ['Dumbbell Incline Bench', 'dumbbell-press'],
  ['Dumbbell Row', 'dumbbell-row'],
  ['Barbell Row', 'barbell-row'],
  ['EZ Bar Curl', 'ez-curl'],
  ['Machine Chest Press', 'machine-chest-press'],
  ['Cable Row', 'cable-row'],
  ['Lat Pulldown', 'pulldown'],
  ['Leg Extension', 'leg-extension'],
  ['Leg Curl', 'leg-curl'],
  ['Pec Deck', 'pec-deck'],
  ['Lateral Raise', 'lateral-raise'],
];

for (const [movement, expected] of cases) {
  assert.equal(resolveAccessoryIconName(movement), expected, movement);
}

console.log(`Accessory icon resolver passed: ${cases.length} movement families.`);
