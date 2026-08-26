import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) => readFileSync(path.join(root, relativePath), 'utf8');
const experience = read('components/ledger/experiences.tsx');
const client = read('lib/ledger-journey.ts');
const legacyAdapter = read('components/ledger/journey-live-events.ts');

assert.match(client, /\/mobile\/ledger\/journey\?/);
assert.match(client, /\/mobile\/ledger\/journey\/timeline\?/);
assert.match(client, /cursor\?: string/);
assert.match(client, /include_sessions/);
assert.match(client, /JourneyBootstrap/);

assert.match(experience, /fetchJourneyBootstrap\(\{ limit: 24, includeSessions \}\)/);
assert.match(experience, /\['Overview', 'Blocks', 'Timeline'\]/);
assert.match(experience, /ledger-journey-overview/);
assert.match(experience, /ledger-journey-blocks/);
assert.match(experience, /Load earlier history/);
assert.match(experience, /entry\.source\.href/);
assert.match(experience, /entry\.source_kind === 'persisted'/);
assert.match(experience, /formatJourneyDate\(overview\.earliest_record\.date\)/);
assert.match(experience, /journeyPerformanceDetail\(entry\.event_type, performance, unit, entry\.detail\)/);
assert.doesNotMatch(experience.slice(experience.indexOf('function journeyMomentFromEntry')), /displayWeight\(performance\./, 'Journey PR evidence must not round exact historical values to plate increments');

// The legacy collector can still support the isolated old Index study, but the
// shipping Journey experience must use the bounded server projection.
assert.match(legacyAdapter, /fetchAllArchive/);
const journeyStart = experience.indexOf('export function JourneyExperience()');
const journeyEnd = experience.indexOf('function StrengthTrendPlot', journeyStart);
const shippingJourney = experience.slice(journeyStart, journeyEnd);
assert.doesNotMatch(shippingJourney, /fetchJourneyArchiveEvents|fetchAllArchive|fetchAllAccomplishments/);

console.log('[journey historical] server bootstrap, tabs, pagination, source links, and persisted/reconstructed presentation passed');
