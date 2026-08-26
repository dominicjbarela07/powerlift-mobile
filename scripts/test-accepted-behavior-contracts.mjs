#!/usr/bin/env node

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const scriptsDir = path.join(root, 'scripts');
const quarantinePath = path.join(root, 'config', 'accepted-behavior-contract-quarantine.json');
const quarantine = JSON.parse(fs.readFileSync(quarantinePath, 'utf8'));
const orchestrationScripts = new Set([
  'test-accepted-behavior-contracts.mjs',
  'test-release-critical-invariants.mjs',
  'test-release-source-lineage.mjs',
]);
const discovered = fs.readdirSync(scriptsDir)
  .filter((name) => /^test-.*\.(?:mjs|js)$/.test(name))
  .filter((name) => !orchestrationScripts.has(name))
  .sort();
const groups = quarantine.groups || [];
const quarantined = new Map();

for (const group of groups) {
  assert.ok(group.id && group.reason, 'every quarantine group requires an id and reason');
  for (const test of group.tests || []) {
    assert.ok(!quarantined.has(test), `${test} appears in more than one quarantine group`);
    assert.ok(discovered.includes(test), `${test} is quarantined but no longer exists`);
    quarantined.set(test, group.id);
  }
}

const accepted = discovered.filter((name) => !quarantined.has(name));
const failures = [];

for (const name of accepted) {
  const result = spawnSync(process.execPath, ['--import', 'tsx', path.join('scripts', name)], {
    cwd: root,
    env: { ...process.env, CI: '1' },
    encoding: 'utf8',
    stdio: 'pipe',
    timeout: 30_000,
  });
  if (result.status !== 0) {
    failures.push({ name, output: `${result.stdout || ''}${result.stderr || ''}`.trim() });
  }
  console.log(`[accepted-behavior] ${result.status === 0 ? 'PASS' : 'FAIL'} — ${name}`);
}

if (failures.length) {
  for (const failure of failures) {
    console.error(`\n${failure.name}\n${failure.output}`);
  }
  throw new Error(
    `${failures.length} accepted behavior contract(s) failed. ` +
    'New tests are protected automatically; quarantine requires an explicit reviewed config change.',
  );
}

console.log(`[accepted-behavior] PASS — ${accepted.length}/${accepted.length} automatically discovered accepted contracts`);
console.log(`[accepted-behavior] audited quarantine — ${quarantined.size} historical non-release harnesses across ${groups.length} explicit groups`);
