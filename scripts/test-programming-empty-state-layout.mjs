#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manager = fs.readFileSync(path.join(root, 'app/(tabs)/workout/index.tsx'), 'utf8');

function styleBody(styleName) {
  const match = manager.match(new RegExp(`\\n\\s{2}${styleName}: \\{([\\s\\S]*?)\\n\\s{2}\\},`));
  assert.ok(match, `Expected ${styleName} style`);
  return match[1];
}

assert.match(
  manager,
  /function ProgrammingEmptyState[\s\S]*TrainingHubMaterialSurface[\s\S]*No active Training Program[\s\S]*Create a program to get started\.[\s\S]*<SLButton[\s\S]*label="Program"[\s\S]*All Training Programs[\s\S]*Getting Started[\s\S]*Follow these steps to build your first program\./,
  'approved empty-state hierarchy is incomplete',
);
assert.match(
  manager,
  /const GETTING_STARTED_STEPS = \[[\s\S]*Create a training program[\s\S]*Add your first block[\s\S]*Build your first session[\s\S]*Schedule training[\s\S]*\] as const/,
  'approved onboarding order changed',
);
assert.match(manager, /variant="primary"/, 'the CTA must use the shared primary action');
assert.match(manager, /accentColor=\{tone\}[\s\S]*styles\.gettingStartedCard/, 'step cards must use the shared Logger material');
assert.match(styleBody('emptyProgramHeroTop'), /flexDirection: 'row'/, 'hero composition must remain icon-copy-CTA');
assert.match(styleBody('gettingStartedList'), /gap: 7/, 'step-card rhythm changed');
assert.match(styleBody('gettingStartedRow'), /minHeight: 72/, 'step-card proportion changed');
assert.doesNotMatch(manager, /programmingEmptyRow|programmingAddButton|gettingStartedText/, 'retired empty-state layout returned');

console.log('[programming-empty-state-layout] ok');
