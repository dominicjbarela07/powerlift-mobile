#!/usr/bin/env node
/* eslint-env node */
/* global __dirname */

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const sourcePath = path.join(root, 'app', '(tabs)', 'create-workout.tsx');
const source = fs.readFileSync(sourcePath, 'utf8');

function fail(message) {
  console.error(`[core-variant-creator-policy] ${message}`);
  process.exit(1);
}

function requireIncludes(snippet, message) {
  if (!source.includes(snippet)) fail(message);
}

const addMatch = source.match(/const addCoreVariant = \(\) => \{([\s\S]*?)\n  \};/);
if (!addMatch) fail('Could not locate addCoreVariant.');

const addBody = addMatch[1];
if (!addBody.includes("setPendingCoreVariant(createPendingCoreVariantDraft('STRAIGHT'))")) {
  fail('Core Variant selection must open pending setup state.');
}
if (/\bsetCore\s*\(/.test(addBody)) {
  fail('Core Variant selection must not insert a committed core row before confirmation.');
}
if (/\bsetCoreEditorOpen\s*\(/.test(addBody) || /\bopenMovementPicker\s*\(/.test(addBody)) {
  fail('Core Variant selection must not bypass setup by opening editor/picker on a placeholder row.');
}

requireIncludes('type PendingCoreVariantDraft', 'Pending Core Variant setup state is missing.');
requireIncludes('validateCoreVariantDraft', 'Pending Core Variant confirmation validator is missing.');
requireIncludes('validateCoreVariantCoreForSave', 'Save-time Core Variant validator is missing.');
requireIncludes('commitPendingCoreVariant', 'Pending Core Variant commit path is missing.');
requireIncludes("openMovementPicker('pendingVariant', -1)", 'Pending Core Variant movement picker path is missing.');
requireIncludes('manual target load is required', 'Core Variant manual target requirement is not locked down.');
requireIncludes('setCore((p) => [...p, ...rows])', 'Confirmed Core Variant rows must be appended only from commit path.');

console.log('[core-variant-creator-policy] ok');
