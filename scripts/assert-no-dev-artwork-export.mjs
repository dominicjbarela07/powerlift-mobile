import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

// Actual export bytes, not merely source conditionals, must exclude this DEV family.
const exported = process.argv[2];
assert.ok(exported && fs.existsSync(exported), 'pass the fresh Expo export directory');
const manifest = JSON.parse(fs.readFileSync('artwork-review/review-state.json', 'utf8'));
const deniedHashes = new Set(manifest.items.flatMap(row => Object.values(row.files).map(file => file.sha256)));
const walk = directory => fs.readdirSync(directory, {withFileTypes: true}).flatMap(entry => {
  const file = path.join(directory, entry.name);
  return entry.isDirectory() ? walk(file) : [file];
});
for (const file of walk(exported)) {
  const hash = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  assert.ok(!deniedHashes.has(hash), `DEV-only artwork leaked into the release export: ${file}`);
}
console.log('[dev-artwork-exclusion] fresh release export contains none of the DEV-only generated candidate bytes');
