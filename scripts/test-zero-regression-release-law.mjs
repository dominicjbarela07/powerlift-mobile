#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';

const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const publisher = fs.readFileSync('scripts/publish-validated-ios-ota.mjs', 'utf8');
const acceptedRunner = fs.readFileSync('scripts/test-accepted-behavior-contracts.mjs', 'utf8');
const sourceGuard = fs.readFileSync('scripts/test-release-source-lineage.mjs', 'utf8');

assert.equal(
  packageJson.scripts['test:accepted-behavior-contracts'],
  'node scripts/test-accepted-behavior-contracts.mjs',
  'the automatic accepted-behavior suite must remain a first-class package gate',
);
assert.match(publisher, /test:accepted-behavior-contracts/, 'the exact OTA publisher must run the automatic accepted-behavior gate');
assert.match(acceptedRunner, /\^test-\.\*\\\.\(\?:mjs\|js\)\$/, 'new behavior contracts must be discovered automatically');
assert.match(acceptedRunner, /accepted behavior contract\(s\) failed/, 'an accepted behavior failure must block release');
assert.match(sourceGuard, /candidate-only product changes are forbidden/, 'candidate-only unexplained product files must block release');

console.log('[zero-regression-release-law] automatic accretion, release blocking, and canonical source convergence are enforced');
