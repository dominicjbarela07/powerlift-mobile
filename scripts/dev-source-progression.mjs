import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { applySharedReleaseFix } from './release-holdback-policy.mjs';
import { artBundlePolicyFiles, assertArtBundlePolicyProgression } from './approved-art-bundle-policy.mjs';

const hash = source => crypto.createHash('sha256').update(source).digest('hex');

/** DEV may contain explicitly requested improvements beyond shipped source.
 * Prove the entire exact patch, rather than exempting filenames or accepting a
 * new hash alone. Artwork/catalog/removal rules remain independent and strict. */
export function validateDevSourceProgressions(rows, candidateFiles, devFiles, candidateRoot, devRoot) {
  const proven = new Set();
  for (const row of rows || []) {
    assert.ok(/^(app|components|lib|context|hooks|constants)\/.*\.(ts|tsx)$/.test(row.path)
      || ['config/bottom-sheet-consumer-inventory.json', 'config/protected-fix-manifest.json'].includes(row.path), 'DEV progressions may cover source or exact release/consumer metadata, never assets or catalog');
    assert.ok(!row.path.includes('artwork') || artBundlePolicyFiles.includes(row.path), 'artwork changes require the human-art gate');
    assert.match(row.before, /^[a-f0-9]{64}$/); assert.match(row.after, /^[a-f0-9]{64}$/);
    assert.ok(row.ownerInstruction && row.ownerEvidencePath && row.ownerEvidenceSha256);
    assert.ok(row.reason?.length > 30 && row.changes?.length, 'DEV progression requires a concrete reviewed delta');
    if (candidateFiles[row.path] === devFiles[row.path]) continue;
    assert.equal(candidateFiles[row.path], row.before, `${row.path}: DEV progression baseline changed`);
    assert.equal(devFiles[row.path], row.after, `${row.path}: unregistered DEV changes`);
    const original = fs.readFileSync(path.join(candidateRoot, row.path), 'utf8');
    const expected = row.changes.reduce((source, change) => applySharedReleaseFix(source, change), original);
    if (artBundlePolicyFiles.includes(row.path)) assertArtBundlePolicyProgression(row.path, original, expected);
    assert.equal(hash(expected), row.after, 'DEV progression endpoint must match its exact patch');
    assert.equal(expected, fs.readFileSync(path.join(devRoot, row.path), 'utf8'), 'DEV must retain the complete reviewed delta');
    assert.ok(!proven.has(row.path), 'duplicate DEV progressions are forbidden');
    proven.add(row.path);
  }
  return proven;
}
