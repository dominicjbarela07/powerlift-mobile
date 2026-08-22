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
  /<ScrollView[\s\S]*horizontal[\s\S]*style=\{styles\.modeRail\}[\s\S]*contentContainerStyle=\{styles\.modes\}/,
  'the horizontal mode selector must have an explicit bounded viewport',
);
assert.match(
  source,
  /modeRail:\s*\{[^}]*flexGrow: 0[^}]*flexShrink: 0[^}]*height: 62/,
  'the horizontal mode selector must not consume the results area',
);
assert.match(
  source,
  /scroll:\s*\{[^}]*flex: 1[^}]*minHeight: 0/,
  'movement results must begin below the controls and own the remaining height',
);
assert.match(source, /keyboardShouldPersistTaps="handled"/);
assert.match(source, /Create Governed Movement/);

console.log('[governed-accessory-picker-layout] bounded mode rail and contiguous results layout passed');
