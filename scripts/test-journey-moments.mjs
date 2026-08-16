import assert from 'node:assert/strict';

import { buildJourneyMoments } from '../components/ledger/journey-moments.ts';

const session = (id, date, overrides = {}) => ({
  archive_item_type: 'session',
  source_id: id,
  athlete_id: 1,
  title: `Training Session ${id}`,
  occurred_on: date,
  status: 'completed',
  visibility: 'athlete_visible',
  correction_state: 'current_truth',
  invalidation_state: 'valid',
  ...overrides,
});

const video = (id, workoutId, date, overrides = {}) => ({
  archive_item_type: 'video',
  source_id: id,
  athlete_id: 1,
  title: 'Competition Squat',
  occurred_on: date,
  status: 'reviewed',
  visibility: 'athlete_visible',
  correction_state: 'current_truth',
  invalidation_state: 'valid',
  media: {
    workout_id: workoutId,
    review_status: 'reviewed',
    has_athlete_visible_feedback: true,
  },
  ...overrides,
});

const accomplishment = (id, workoutId, date, overrides = {}) => ({
  id,
  event_type: 'CORE_WEIGHT_PR',
  priority: 10,
  occurred_at: `${date}T18:00:00Z`,
  workout_date: date,
  workout_title: `Training Session ${workoutId}`,
  workout_id: workoutId,
  source_set_log_id: id + 100,
  core_movement_key: 'squat',
  movement_label: 'Competition Squat',
  current_value: 190,
  prior_value: 180,
  delta: 10,
  unit: 'kg',
  evidence: { actual_weight_kg: 190 },
  ...overrides,
});

const bundle = (overrides = {}) => ({
  archiveItems: [],
  accomplishments: [],
  archiveHistoryComplete: true,
  accomplishmentHistoryComplete: true,
  now: new Date('2026-07-21T12:00:00Z'),
  ...overrides,
});

// Routine sessions are not timeline material unless the complete history proves
// that the record is the athlete's first completed workout.
assert.deepEqual(buildJourneyMoments(bundle({
  archiveItems: [session(1, '2024-01-10')],
  archiveHistoryComplete: false,
})), []);

const firstWorkoutMoments = buildJourneyMoments(bundle({
  archiveItems: [session(2, '2024-02-10'), session(1, '2024-01-10')],
}));
assert.equal(firstWorkoutMoments.length, 1);
assert.equal(firstWorkoutMoments[0].type, 'first-workout');
assert.equal(firstWorkoutMoments[0].evidence[0].kind, 'workout');

// Completion evaluator rows never become Journey moments.
assert.deepEqual(buildJourneyMoments(bundle({
  accomplishments: [{
    ...accomplishment(4, 4, '2026-05-01'),
    event_type: 'CORE_PRESCRIPTION_COMPLETED',
  }],
  archiveHistoryComplete: false,
})), []);

// One real-world episode produces one moment. Set, video, athlete-visible coach
// review, Strength, and Achievements remain evidence links rather than cards.
const grouped = buildJourneyMoments(bundle({
  archiveItems: [
    session(1, '2024-01-10'),
    session(20, '2026-03-12'),
    video(7, 20, '2026-03-13'),
  ],
  accomplishments: [
    accomplishment(10, 20, '2026-03-12'),
    accomplishment(11, 20, '2026-03-12', {
      event_type: 'CORE_E1RM_PR',
      priority: 20,
      current_value: 215,
      prior_value: 195,
      delta: 20,
    }),
  ],
}));
const groupedEpisode = grouped.filter((moment) => moment.id === 'journey:workout:20');
assert.equal(groupedEpisode.length, 1);
assert.equal(groupedEpisode[0].occurredAt, '2026-03-12');
assert.match(groupedEpisode[0].title, /2 career bests/);
assert.deepEqual(
  new Set(groupedEpisode[0].evidence.map((item) => item.kind)),
  new Set(['workout', 'video', 'coach-feedback', 'set', 'strength', 'achievement']),
);
assert.equal(JSON.stringify(groupedEpisode[0]).includes('private'), false);

// Biggest PR is a truthful weight-PR superlative and is withheld when the
// accomplishment history scan is incomplete.
assert.equal(groupedEpisode[0].type, 'biggest-pr-jump');
const incompleteSuperlative = buildJourneyMoments(bundle({
  archiveItems: [session(20, '2026-03-12')],
  accomplishments: [accomplishment(10, 20, '2026-03-12')],
  archiveHistoryComplete: false,
  accomplishmentHistoryComplete: false,
}));
assert.equal(incompleteSuperlative[0].type, 'major-pr');

// Rep-Max PRs are weight-primary career evidence within an exact rep category.
const repOnly = buildJourneyMoments(bundle({
  unit: 'kg',
  archiveItems: [session(30, '2026-04-01')],
  archiveHistoryComplete: false,
  accomplishments: [accomplishment(30, 30, '2026-04-01', {
    event_type: 'CORE_REP_MAX_PR',
    current_value: 205,
    prior_value: 200,
    delta: 5,
    evidence: { actual_weight_kg: 205, actual_reps: 5, rep_count: 5 },
  })],
}));
assert.equal(repOnly[0].type, 'major-pr');
assert.match(repOnly[0].detail, /205 kg 5 REP MAX/);

const repOnlyLb = buildJourneyMoments(bundle({
  unit: 'lb',
  archiveItems: [session(31, '2026-04-02')],
  archiveHistoryComplete: false,
  accomplishments: [accomplishment(31, 31, '2026-04-02', {
    event_type: 'CORE_REP_MAX_PR',
    current_value: 205,
    prior_value: 200,
    delta: 5,
    evidence: { actual_weight_kg: 205, actual_reps: 5, rep_count: 5 },
  })],
}));
assert.match(repOnlyLb[0].detail, /451\.9 lb 5 REP MAX/);

// Major volume threshold crossings are their own canonical Journey moments.
// Their stored timestamp and source references are preserved; no chronology is
// derived from current accumulated volume.
const volumeMoment = buildJourneyMoments(bundle({
  archiveHistoryComplete: false,
  accomplishments: [accomplishment(41, 41, '2026-04-12', {
    event_type: 'CORE_LIFETIME_VOLUME_MILESTONE',
    current_value: 250000,
    prior_value: 249700,
    delta: 300,
    unit: 'lb',
    evidence: { threshold_lb: 250000, lift_family: 'squat', milestone_scope: 'lift' },
  })],
}))[0];
assert.equal(volumeMoment.type, 'volume-milestone');
assert.equal(volumeMoment.occurredAt, '2026-04-12T18:00:00Z');
assert.match(volumeMoment.title, /Squat lifetime volume medallion/);
assert.deepEqual(new Set(volumeMoment.evidence.map((item) => item.kind)), new Set(['workout', 'set', 'achievement']));

// Current totals or malformed/unknown thresholds cannot manufacture a dated
// Journey reward.
assert.deepEqual(buildJourneyMoments(bundle({
  archiveHistoryComplete: false,
  accomplishments: [accomplishment(42, 42, '2026-04-13', {
    event_type: 'TOTAL_LIFETIME_VOLUME_MILESTONE',
    evidence: { threshold_lb: 123456, milestone_scope: 'total' },
  })],
})), []);

// Completed meets are moments, with first-meet semantics and nested canonical
// result-summary totals.
const meets = buildJourneyMoments(bundle({
  unit: 'kg',
  archiveItems: [{
    archive_item_type: 'meet',
    source_id: 8,
    athlete_id: 1,
    title: 'State Championships',
    occurred_on: '2025-05-09',
    status: 'completed',
    visibility: 'athlete_visible',
    correction_state: 'current_truth',
    invalidation_state: 'valid',
    meet_context: { federation: 'USAPL', result_summary: { total_kg: 650 } },
  }],
}));
assert.equal(meets[0].type, 'first-meet');
assert.match(meets[0].detail, /650 kg total/);

// Imported pre-Ledger evidence is represented once, only when the bounded
// history scan proves which preserved record is earliest.
const historical = (id, date) => ({
  archive_item_type: 'historical_performance',
  source_id: id,
  athlete_id: 1,
  title: `Imported lift ${id}`,
  occurred_on: date,
  status: 'current',
  visibility: 'athlete_visible',
  correction_state: 'current_truth',
  invalidation_state: 'valid',
  provenance_label: 'Imported history',
});
const imported = buildJourneyMoments(bundle({
  archiveItems: [historical(2, '2020-05-01'), historical(1, '2019-05-01')],
}));
assert.equal(imported.filter((moment) => moment.type === 'imported-history').length, 1);
assert.match(imported.find((moment) => moment.type === 'imported-history').title, /Imported lift 1/);

// Anniversaries are derived only from the verified earliest completed workout,
// and "now" is injectable so the rule remains deterministic.
const anniversary = buildJourneyMoments(bundle({
  archiveItems: [session(1, '2021-07-21')],
}));
assert.equal(anniversary.find((moment) => moment.type === 'training-anniversary').title, '5 years in the Ledger');

// Invalidated, deleted, unavailable, and superseded evidence cannot produce a
// Journey moment.
for (const invalid of [
  { invalidation_state: 'invalid' },
  { correction_state: 'deleted' },
  { correction_state: 'superseded' },
  { unavailable: { state: 'unavailable', reason: 'removed' } },
]) {
  assert.deepEqual(buildJourneyMoments(bundle({
    archiveItems: [session(99, '2024-01-01', invalid)],
  })), []);
}

// Ordering and output are deterministic regardless of source order.
const deterministicInput = bundle({
  archiveItems: [session(1, '2024-01-10'), session(20, '2026-03-12'), video(7, 20, '2026-03-13')],
  accomplishments: [accomplishment(11, 20, '2026-03-12', { event_type: 'CORE_E1RM_PR' }), accomplishment(10, 20, '2026-03-12')],
});
const forward = buildJourneyMoments(deterministicInput);
const reversed = buildJourneyMoments({
  ...deterministicInput,
  archiveItems: [...deterministicInput.archiveItems].reverse(),
  accomplishments: [...deterministicInput.accomplishments].reverse(),
});
assert.deepEqual(reversed, forward);
assert.ok(forward.every((moment, index) => index === 0 || Date.parse(forward[index - 1].occurredAt) >= Date.parse(moment.occurredAt)));

console.log('[journey] deterministic episode grouping, curation, evidence links, and truthful superlatives passed');
