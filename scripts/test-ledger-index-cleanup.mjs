import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = await readFile(path.join(root, 'components/ledger/index-experience.tsx'), 'utf8');

assert.match(source, /liftResult: \{ height: 80,/, 'Core Lift rows must remain compact at the approved 80-point logical height');
assert.match(source, /prCardWide/, 'a single recent PR must use the full-width evidence card');
assert.match(source, /latestJourneyEntry\?\.event_type === 'MOVEMENT_ADDED'[\s\S]*latestJourneyEntry\.detail/, 'movement introductions must show athlete-facing performance context');
assert.doesNotMatch(source, /stable movement identity|canonical identity created|movement identity reconciled/i, 'Ledger Index must not expose internal identity terminology');

const expected = [
  'Matrix · Selectorized',
  'Arsenal Strength · Selectorized',
  'Lats · Upper Back · Biceps',
  'Coach’s note',
  '45-Degree Back Extension',
];
assert.deepEqual(JSON.parse(JSON.stringify(expected)), expected, 'mobile JSON text must round-trip supported Unicode');

const sourceRoots = ['app', 'components', 'constants', 'context', 'dev-mocks', 'lib', 'scripts'];
const sourceExtensions = new Set(['.js', '.jsx', '.mjs', '.ts', '.tsx']);
const mojibake = /Â·|Ã|â€™|�/u;
const violations = [];

async function scan(directory) {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error?.code === 'ENOENT') return;
    throw error;
  }
  for (const entry of entries) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await scan(target);
    } else if (sourceExtensions.has(path.extname(entry.name))) {
      const contents = await readFile(target, 'utf8');
      if (mojibake.test(contents) && !target.endsWith('test-ledger-index-cleanup.mjs')) {
        violations.push(path.relative(root, target));
      }
    }
  }
}

for (const sourceRoot of sourceRoots) await scan(path.join(root, sourceRoot));
assert.deepEqual(violations, [], `mobile source contains mojibake: ${violations.join(', ')}`);

console.log('[ledger-index-cleanup] compact density, athlete-facing copy, and Unicode integrity passed');
