import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = fs.readFileSync(
  path.join(root, 'components/movement/GovernedAccessoryPickerModal.tsx'),
  'utf8',
);

assert.match(
  source,
  /SWAPPING[\s\S]*SIMILAR MOVEMENTS[\s\S]*Browse by Muscle Group[\s\S]*QUICK ACCESS/,
  'the replacement workspace must preserve a compact, deliberate discovery hierarchy',
);
assert.match(
  source,
  /shell:\s*\{[^}]*flex: 1[^}]*backgroundColor: '#000000'[^}]*\}/,
  'the page-level canvas stays full-width OLED black',
);
assert.match(
  source,
  /scroll:\s*\{[^}]*flex: 1[^}]*minHeight: 0/,
  'movement results must begin below the controls and own the remaining height',
);
assert.match(source, /keyboardShouldPersistTaps="handled"/);
assert.match(source, /Create Governed Movement/);
assert.doesNotMatch(source, /FULL LIBRARY|modeRail/, 'the giant default library rail is removed');

console.log('[governed-accessory-picker-layout] contextual full-width discovery layout passed');
