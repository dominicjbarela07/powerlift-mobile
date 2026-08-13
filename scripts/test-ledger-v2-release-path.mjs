import assert from 'node:assert/strict';

import { assembleLedgerV2Snapshot } from '../components/ledger/v2/assemble.ts';

const legacyProgression = {
  athlete: { id: 1, name: 'Release Athlete', preferred_units: 'lb' },
  consistency: { sessions_completed: 184, training_age_years: null },
  bodyweight: null,
  big_three_arc: { lifts: [] },
};
const unknownOptionalAccomplishment = {
  id: 1,
  event_type: 'FUTURE_OPTIONAL_EVENT',
  movement_label: null,
  current_value: null,
  prior_value: null,
  unit: null,
  evidence: null,
};
const requestError = (message, status) => Object.assign(new Error(message), { status });
const archive500 = () => Promise.reject(requestError('server error', 500));

const partial = await assembleLedgerV2Snapshot('all', {
  progression: async () => legacyProgression,
  currentBests: async () => [],
  accomplishments: async () => ({ items: [unknownOptionalAccomplishment], nextCursor: null, hasMore: false }),
  landing: archive500,
  training: archive500,
  search: archive500,
});

assert.equal(partial.progression.athlete?.id, 1);
assert.equal(partial.landing.collection_summaries.training, 184);
assert.equal(partial.accomplishments.length, 1);
assert.deepEqual(partial.sessions, []);
assert.deepEqual(partial.evidence, []);
assert.deepEqual(partial.issues?.map((issue) => [issue.source, issue.status]), [
  ['archive_landing', 500],
  ['archive_training', 500],
  ['archive_search', 500],
]);

const sparseLegacy = await assembleLedgerV2Snapshot('all', {
  progression: async () => ({ athlete: { id: 2, name: 'Sparse Athlete', preferred_units: 'kg' } }),
  currentBests: async () => [],
  accomplishments: async () => ({ items: [], nextCursor: null, hasMore: false }),
  landing: async () => ({ ok: true, athlete: { id: 2, name: 'Sparse Athlete' } }),
  training: async () => ({ ok: true, items: [] }),
  search: async () => ({ ok: true, items: [] }),
});
assert.deepEqual(sparseLegacy.landing.collection_summaries, { training: 0, media: 0, competition: 0 });
assert.deepEqual(sparseLegacy.landing.supported_filters, { training: [], media: [], competition: [] });

await assert.rejects(
  assembleLedgerV2Snapshot('all', {
    progression: async () => { throw requestError('auth required', 401); },
    currentBests: archive500,
    accomplishments: archive500,
    landing: archive500,
    training: archive500,
    search: archive500,
  }),
  (error) => error instanceof Error && error.status === 401,
);

console.log('[ledger-v2] release payload resilience and partial-evidence recovery passed');
