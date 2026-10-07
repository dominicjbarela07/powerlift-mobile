import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { validateDevSourceProgressions } from './dev-source-progression.mjs';

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'sl-dev-progression-'));
const candidate = path.join(temp, 'candidate'), dev = path.join(temp, 'dev');
const file = 'lib/retained-feature.ts';
const before = 'export const retainedShippedHandler = () => "valid shipped behavior";\n';
const after = before + 'export const ownerRequestedHint = "new DEV guidance";\n';
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const receipt = { path: file, before: hash(before), after: hash(after), changes: [{ before, after }], ownerInstruction: 'Fix them all, please.', ownerEvidencePath: 'owner.txt', ownerEvidenceSha256: 'a'.repeat(64), reason: 'Exact additive owner-requested DEV change, retaining the shipped handler.' };
try {
  for (const root of [candidate, dev]) fs.mkdirSync(path.join(root, 'lib'), { recursive: true });
  fs.writeFileSync(path.join(candidate, file), before); fs.writeFileSync(path.join(dev, file), after);
  const check = (rows = [receipt], c = { [file]: hash(before) }, d = { [file]: hash(after) }) => validateDevSourceProgressions(rows, c, d, candidate, dev);
  assert.ok(check().has(file));
  assert.throws(() => check([receipt], {}, { [file]: hash(after) }), /baseline changed/, 'missing shipped feature cannot become a DEV addition');
  fs.writeFileSync(path.join(dev, file), after + 'UNREVIEWED');
  assert.throws(() => check(), /complete reviewed delta/);
  fs.writeFileSync(path.join(dev, file), after);
  assert.throws(() => check([{ ...receipt, changes: [{ before, after: 'unrelated arbitrary replacement bytes' }] }]), /endpoint/);
  assert.throws(() => check([{ ...receipt, path: 'assets/approved.png' }]), /never assets/);
  assert.throws(() => check([{ ...receipt, ownerInstruction: '' }]));
  assert.throws(() => check([receipt, receipt]), /duplicate/);
} finally { fs.rmSync(temp, { recursive: true, force: true }); }
console.log('DEV source progression PASS; exact additions accepted; missing feature, hidden byte change, arbitrary endpoint, asset exemption and missing owner evidence rejected.');
