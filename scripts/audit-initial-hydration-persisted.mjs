import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';
import { normalizeCanonicalMovementArtSubject as subject } from '../lib/canonical-movement-art-subject.ts';
import { resolveCanonicalMovementArtwork as artwork } from '../lib/canonical-movement-artwork.ts';
import { resolveLoggerMovementIdentity as logger } from '../lib/logger-movement-identity.ts';

const [input, output] = process.argv.slice(2);
if (!input || !output) throw new Error('Usage: node --import tsx scripts/audit-initial-hydration-persisted.mjs <audit.json[.gz]> <results.json>');
const bytes = fs.readFileSync(input);
const audit = JSON.parse(input.endsWith('.gz') ? zlib.gunzipSync(bytes) : bytes.toString());
const counts = {}, errors = [];
for (const row of audit.rows) {
  const s = subject(row.initial), art = artwork(row.initial);
  const key = `${row.classification}:${art.kind}`;
  counts[key] = (counts[key] || 0) + 1;
  if (row.classification !== 'governed') continue;
  try {
    assert.notEqual(art.kind, 'neutral');
    assert.equal(s.canonicalIdentityId, row.initial.effective_movement_definition_id);
    assert.equal(logger(row.initial).effective?.id, s.canonicalIdentityId);
    assert.deepEqual(art, artwork({ ...row.initial, ...row.materialized }));
  } catch (error) { errors.push({ itemId: row.initial.id, reason: error.message, subject: s, art }); }
}
fs.writeFileSync(output, JSON.stringify({ counts, errors }, null, 2) + '\n');
console.log(JSON.stringify({ counts, errors: errors.length }, null, 2));
assert.equal(errors.length, 0);
