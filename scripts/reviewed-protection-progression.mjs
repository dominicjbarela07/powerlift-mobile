import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { applySharedReleaseFix } from './release-holdback-policy.mjs';
import { assertProgressionEvidence } from './reviewed-release-progression.mjs';

const hash = value => createHash('sha256').update(value).digest('hex');

/** Original protection pins remain authoritative. A reviewed change proves
 * every byte from that original preimage and retains the owner's exact scope. */
export function assertProtectionFile(root, state, file, expected, sourceRoot = root, scope = 'mobile') {
  const current = fs.readFileSync(path.join(sourceRoot, file));
  if (hash(current) === expected) return;
  const rows = (state.reviewedProtectionProgressions || []).filter(row => row.scope === scope
    && row.path === file && row.before === expected && row.after === hash(current));
  assert.equal(rows.length, 1, `Protection changed without an exact reviewed progression: ${scope}/${file}`);
  const row = rows[0];
  assertProgressionEvidence(root, row);
  assert.ok(row.reason?.length > 30 && row.changes?.length, 'Protection review must describe its preserved checks');
  assert.ok(typeof row.beforePath === 'string' && row.beforePath.startsWith('config/testflight-release-')
    && !row.beforePath.split('/').includes('..'), 'Protection preimage must remain in retained release evidence');
  const before = fs.readFileSync(path.join(root, row.beforePath), 'utf8');
  assert.equal(hash(before), expected, 'Original protection pin/preimage changed');
  const after = row.changes.reduce((source, change) => applySharedReleaseFix(source, change), before);
  assert.equal(after, current.toString(), `Unreviewed protection bytes: ${file}`);
}
