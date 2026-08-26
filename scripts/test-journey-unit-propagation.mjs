import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { journeyPerformanceDetail } from '../lib/journey-weight-presentation.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const experience = read('components/ledger/experiences.tsx');
const archive = read('components/ledger/archive-foundation.tsx');
const archiveDetail = read('components/ledger/archive-detail.tsx');

const bench = { weight_kg: 142.8816, reps: 3, rpe: 8 };
const squat = { weight_kg: 181.4368, reps: 2, rir: 1 };
assert.equal(journeyPerformanceDetail('PERFORMANCE', bench, 'lb', '142.8816 kg'), '315 lb × 3 @ RPE 8');
assert.equal(journeyPerformanceDetail('PERFORMANCE', squat, 'lb', '181.4368 kg'), '400 lb × 2 · 1 RIR');
assert.equal(journeyPerformanceDetail('PERFORMANCE', bench, 'kg', '315 lb'), '142.9 kg × 3 @ RPE 8');
assert.equal(journeyPerformanceDetail('PERFORMANCE', squat, 'kg', '400 lb'), '181.4 kg × 2 · 1 RIR');
assert.equal(journeyPerformanceDetail('E1RM_PR', { e1rm_kg: 136.0777 }, 'lb', '136.0777 kg'), '300 lb estimated 1RM');

assert.match(experience, /useSurfaceWeightUnit\(overview\?\.athlete\.preferred_units\)/);
assert.match(experience, /journeyEntries\.map\(\(entry\) => journeyMomentFromEntry\(entry, unit\)\)[\s\S]*\[journeyEntries, unit\]/);
assert.match(experience, /JourneyOverviewView overview=\{overview\} unit=\{unit\}/);
assert.match(experience, /JourneyBlocksView blocks=\{blocks\} unit=\{unit\}/);
assert.match(experience, /journeyPerformanceDetail\(entry\.event_type, performance, unit, entry\.detail\)/);
assert.match(experience, /params: \{ displayUnit: unit \}/);
assert.match(archive, /useSurfaceWeightUnit\(preferredDisplayUnit, first\(params\.displayUnit\)\)/);
assert.match(archive, /ledger-archive-unit-toggle/);
assert.match(archiveDetail, /useSurfaceWeightUnit\(preferredDisplayUnit, first\(params\.displayUnit\)\)/);
assert.match(archiveDetail, /ledger-archive-detail-unit-toggle/);

console.log('Journey and inherited Ledger unit propagation contracts passed.');
