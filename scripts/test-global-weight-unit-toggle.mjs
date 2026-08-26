import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const journey = read('components/ledger/experiences.tsx');
const archive = read('components/ledger/archive-foundation.tsx');
const archiveDetail = read('components/ledger/archive-detail.tsx');

assert.match(journey, /journeyPerformanceDetail\(entry\.event_type, performance, unit, entry\.detail\)/);
assert.match(journey, /journeyEntries\.map\(\(entry\) => journeyMomentFromEntry\(entry, unit\)\)[\s\S]*\[journeyEntries, unit\]/);
assert.match(archive, /itemEvidence\(item, unit\)/);
assert.doesNotMatch(archive, /cleanNumber\(weight\).* kg|compactNumber\(Math\.round\(volume\)\).* kg/);
assert.match(archiveDetail, /formatWeightFromKg\(value, unit/);

console.log('Global weight unit release invariants passed.');
