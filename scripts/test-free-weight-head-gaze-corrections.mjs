#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { artworkCorrections, correctionDocument, reviewedFreeWeightFiles } from './reviewed-free-weight-corrections.mjs';

const root = new URL('../', import.meta.url);
const read = path => fs.readFileSync(new URL(path, root));
const json = path => JSON.parse(read(path));
const before = json(correctionDocument + 'inventory-before.json');
const audit = json(correctionDocument + 'audit-decisions.json');
const current = json('docs/validation/free-weight-completion-2026-09-11/asset-manifest.json');
const humanState = json('artwork-review/review-state.json');
const expected = [90,103,104,106,107,109,110,111,112,131,150,205,237,241,259,297,327,337,349,360,526,527];
const sortedIds = rows => rows.map(row => row.id).sort((a,b) => a-b);
assert.deepEqual(sortedIds(artworkCorrections), expected, 'only explicitly reviewed heads may change');
assert.equal(audit.reviewed_count, 198);
assert.equal(audit.corrected_count, 22);
assert.equal(audit.kept_count, 176);
assert.equal(new Set(audit.movements.map(row => row.id)).size, 198);
assert.deepEqual(sortedIds(audit.movements), sortedIds(before.movements));
assert.deepEqual(sortedIds(current.movements), sortedIds(before.movements));
assert.deepEqual(sortedIds(audit.movements.filter(row => row.decision === 'CORRECT')), expected);
const currentById = new Map(current.movements.map(row => [row.id, row]));
const artworkOnly = new Set(['files', 'attempt', 'validation_note', 'gaze_correction_receipt']);
for (const previous of before.movements) {
  const asset = currentById.get(previous.id);
  for (const [key, value] of Object.entries(previous)) {
    if (!artworkOnly.has(key)) assert.deepEqual(asset[key], value, `preserve ${previous.id} ${key}`);
  }
  assert.deepEqual(asset.files, reviewedFreeWeightFiles(previous));
  const decision = audit.movements.find(row => row.id === previous.id);
  assert.equal(decision.key, previous.key);
  assert.ok(decision.reason && read(correctionDocument + decision.evidence).length);
  if (!expected.includes(previous.id)) {
    assert.equal(decision.decision, 'KEEP');
    const humanRevision = humanState.canonical_assets.find(row => row.movement_definition_id === previous.id && row.approval_source === 'human_review_ui');
    if (!humanRevision) assert.deepEqual(asset.files, previous.files, 'unaffected images stay byte-for-byte identical unless explicitly human-approved later');
  }
  for (const role of ['master', 'app', 'thumbnail']) {
    const file = asset.files[role];
    assert.equal(crypto.createHash('sha256').update(read(file.path)).digest('hex'), file.sha256);
  }
}
for (const correction of artworkCorrections) {
  const previous = before.movements.find(row => row.id === correction.id);
  const attempt = json(correction.receipt);
  assert.ok(attempt.prompt.includes('HEAD') || attempt.prompt.includes('head'));
  assert.equal(attempt.reference_paths.length, 2);
  assert.throws(() => reviewedFreeWeightFiles({...previous,key:'wrong_identity'}), /identity/);
  const tampered = structuredClone(previous);
  tampered.files.master.sha256 = 'not-the-approved-source';
  assert.throws(() => reviewedFreeWeightFiles(tampered), /historical files/);
}
assert.equal(currentById.get(33).files.master.sha256, 'e05a3bf38fa70279a8f369df65498bb952231b3aff1575b41edc15a3da80a9fe');
console.log('[head-gaze] 198 audited, 22 exact reviewed replacements, 176 unchanged triples; original master, identity metadata, consumer paths and historical hash guards preserved');
