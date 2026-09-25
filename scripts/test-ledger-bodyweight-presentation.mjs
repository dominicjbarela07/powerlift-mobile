import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { reportedBodyweightDate, reportedBodyweightNumber } from '../lib/ledger-bodyweight-presentation.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => readFileSync(path.join(root, file), 'utf8');
const index = read('components/ledger/index-experience.tsx');
const exploration = read('components/ledger/exploration-experiences.tsx');

assert.equal(reportedBodyweightNumber(92, 'lb'), '202.8');
assert.equal(reportedBodyweightNumber(91.263, 'lb'), '201.2');
assert.equal(reportedBodyweightNumber(92, 'kg'), '92');
assert.equal(reportedBodyweightNumber(null, 'lb'), null);
assert.equal(reportedBodyweightDate('2026-09-20'), 'Sep 20, 2026');
assert.equal(reportedBodyweightDate(null), null);
assert.match(index, /const bodyweightValue = reportedBodyweightNumber\(bodyweight, model\.unit\)/);
assert.match(index, /reportedBodyweightDate\(latestReportedBodyweight\.training_date\)/);
assert.match(index, /reportedBodyweightNumber\(reportedBodyweightComparison\.start\.reported_bodyweight_kg, model\.unit\)/);
assert.match(index, /reportedBodyweightNumber\(reportedBodyweightComparison\.end\.reported_bodyweight_kg, model\.unit\)/);
assert.doesNotMatch(index, /displayWeight\((?:bodyweight|reportedBodyweightComparison\.)/);
assert.match(exploration, /reportedBodyweightNumber\(context\.bodyweight_kg, unit\)/);

console.log('PASS: Ledger bodyweight retains reported precision and training date across overview and context');
