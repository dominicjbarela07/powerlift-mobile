import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) => readFileSync(path.join(root, relativePath), 'utf8');
const experience = read('components/ledger/JourneyExperience.tsx');
const registry = read('components/ledger/experiences.tsx');
const client = read('lib/ledger-journey.ts');
const legacyAdapter = read('components/ledger/journey-live-events.ts');

assert.match(client, /\/mobile\/ledger\/journey\?/);
assert.match(client, /\/mobile\/ledger\/journey\/timeline\?/);
assert.match(client, /cursor\?: string/);
assert.match(client, /include_sessions/);
assert.match(client, /JourneyBootstrap/);

assert.match(registry, /case 'journey': return <JourneyStoryboardExperience/);
assert.match(experience, /fetchJourneyBootstrap\(\{ limit: 24, includeSessions: false \}\)/);
assert.doesNotMatch(experience, /\['Overview', 'Blocks', 'Timeline'\]/);
assert.match(experience, /journey-then-now/);
assert.match(experience, /journey-training-chapters/);
assert.match(experience, /Load Earlier History/);
assert.match(experience, /entry\.source\.href/);
assert.match(experience, /compactDate\(earliestDate\)/);
assert.match(experience, /journeyPerformanceDetail\(entry\.event_type, entry\.performance, unit, entry\.detail\)/);
assert.doesNotMatch(experience, /displayWeight\(performance\./, 'Journey PR evidence must not round exact historical values to plate increments');

// The legacy collector can still support the isolated old Index study, but the
// shipping Journey experience must use the bounded server projection.
assert.match(legacyAdapter, /fetchAllArchive/);
assert.doesNotMatch(experience, /fetchJourneyArchiveEvents|fetchAllArchive|fetchAllAccomplishments/);

console.log('[journey historical] bounded server bootstrap, continuous story, pagination, and source-link presentation passed');
