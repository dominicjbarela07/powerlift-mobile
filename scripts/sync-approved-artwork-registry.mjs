import assert from 'node:assert/strict';
import fs from 'node:fs';
import { approvedExactArtworkPolicy } from './canonical-art-review-gate.mjs';

// Historical mappings remain auditable in DEV. Only positive, exact human
// receipts may contribute requires to a TestFlight bundle.
const file = 'lib/canonical-movement-artwork-assets.ts';
const original = fs.readFileSync(file, 'utf8');
const state = JSON.parse(fs.readFileSync('artwork-review/review-state.json', 'utf8'));
const approved = new Set(approvedExactArtworkPolicy(state).map(row => row.key));
const entries = new Map([...original.matchAll(/^  (\w+): \{\n[\s\S]*?^  \},/gm)].map(match => [match[1], match[0]]));
assert.equal(entries.size, state.canonical_assets.length);
const visible = [], archived = [];
for (const active of state.canonical_assets) {
  assert.ok(entries.has(active.key), `Missing governed asset: ${active.key}`);
  (approved.has(active.key) ? visible : archived).push(entries.get(active.key));
}
const start = original.indexOf('export const CANONICAL_ACCESSORY_MOVEMENT_ARTWORK:');
const end = original.indexOf('\nexport function canonicalMovementArtworkSource', start);
assert.ok(start > 0 && end > start);
const generated = original.slice(0, start) + `export const CANONICAL_ACCESSORY_MOVEMENT_ARTWORK: Readonly<Partial<Record<
  CanonicalMovementArtworkKey,
  Readonly<{ source: ImageSourcePropType; label: string }>
>>> = (__DEV__ || process.env.EXPO_PUBLIC_APPROVED_ART_CHANNEL === 'testflight') ? {
${visible.join('\n')}
  // Archive bytes remain reviewable locally and are removed from release exports.
  ...(__DEV__ ? {
${archived.join('\n')}
  } : {}),
} : {};
` + original.slice(end);
if (process.argv.includes('--write')) fs.writeFileSync(file, generated);
else assert.equal(original, generated, 'Run sync-approved-artwork-registry.mjs --write after governed promotion.');
console.log(`Approved artwork registry: ${visible.length} shipping; ${archived.length} DEV archive mappings`);
