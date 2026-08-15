import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { coachHomeContextKey, mergeCoachHomeWithRoster } from '../lib/coach-mobile-v2.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = fs.readFileSync(path.join(root, 'components/coach-mobile/CoachHomeV2.tsx'), 'utf8');

const performed = {
  workout_id: 91,
  label: 'W3 Back',
  date: '2026-08-14',
  set_count: 15,
  movement_count: 5,
  pr_count: 1,
  evidence_mode: 'performed',
};
const athlete = {
  id: 7,
  name: 'Athlete Seven',
  is_self: false,
  relationship_state: 'active',
  stable_sort_key: 'athlete seven',
  status: { classification: 'on_track', label: 'On track', tone: 'success' },
  attention_reasons: [],
  queue_membership: [],
  current_training: { status: 'active', label: 'Offseason', week_position: 3, week_total: 8 },
  unread_messages: { count: 0 },
  pending_video_reviews: { count: 0 },
  pending_session_reviews: { count: 0 },
  readiness: { score: 7.2, label: 'Ready' },
  recent_training: [performed],
  last_completed_session: performed,
};
const home = {
  ok: true,
  generated_at: '2026-08-15T09:00:00-07:00',
  summary: { needs_you: 0, reviews: 0, programming: 0, check_ins: 0 },
  attention_athletes: [],
  attention_total: 0,
  recent_activity: [],
  roster_total: 1,
  athletes: [athlete],
};
const baseRoster = {
  ok: true,
  athletes: [],
  counts: { all: 1, needs_attention: 0, programming: 0, reviews: 0, messages: 0, check_ins: 0 },
  needs_attention: [],
  needs_attention_total: 0,
  attention_cap: 3,
  generated_at: '2026-08-15T09:01:00-07:00',
};

assert.equal(
  coachHomeContextKey({ email: 'Coach@Example.com', role: 'coach', is_coach: true }),
  coachHomeContextKey({ id: 44, email: 'coach@example.com', role: 'coach', is_coach: true, workspace_mode: 'team' }),
  'ordinary auth hydration must not look like an account change',
);
assert.notEqual(
  coachHomeContextKey({ email: 'coach@example.com', role: 'coach', is_coach: true, workspace_mode: 'team' }),
  coachHomeContextKey({ email: 'coach@example.com', role: 'coach', is_coach: true, workspace_mode: 'individual' }),
  'an actual workspace switch must invalidate Coach Home data',
);
assert.notEqual(
  coachHomeContextKey({ email: 'coach@example.com', role: 'coach', is_coach: true }),
  coachHomeContextKey({ email: 'other@example.com', role: 'coach', is_coach: true }),
  'an actual account switch must invalidate Coach Home data',
);

const partialAthlete = { ...athlete };
delete partialAthlete.recent_training;
delete partialAthlete.last_completed_session;
const mergedPartial = mergeCoachHomeWithRoster(home, { ...baseRoster, athletes: [partialAthlete] }, home);
assert.deepEqual(mergedPartial.athletes[0].recent_training, [performed]);
assert.deepEqual(mergedPartial.athletes[0].last_completed_session, performed);

const explicitEmpty = { ...athlete, recent_training: [], last_completed_session: null };
const mergedEmpty = mergeCoachHomeWithRoster(home, { ...baseRoster, athletes: [explicitEmpty] }, home);
assert.deepEqual(mergedEmpty.athletes[0].recent_training, []);
assert.equal(mergedEmpty.athletes[0].last_completed_session, null);

assert.match(source, /useFocusEffect[\s\S]*load\(dataRef\.current \? 'background' : 'initial'\)/);
assert.match(source, /previous !== 'active'/);
assert.match(source, /active\?\.contextKey === contextKey/);
assert.match(source, /active\.controller\.abort\(\)/);
assert.match(source, /signal: controller\.signal/);
assert.match(source, /loadError\?\.name === 'AbortError'/);
assert.match(source, /Could not refresh the athlete rail/);
assert.match(source, /if \(!rosterResponse\.ok \|\| !roster\?\.ok\)[\s\S]*?return;[\s\S]*?mergeCoachHomeWithRoster/);
assert.match(source, /refreshing=\{refreshing\}[\s\S]*onRefresh=\{\(\) => load\('manual'\)\}/);
assert.doesNotMatch(source, /setRefreshing\(true\)[\s\S]{0,80}mode === 'background'/);
assert.doesNotMatch(source, /\[load, selectedAthlete, selectedKpi\]/);

console.log('Coach Home return-state lifecycle checks passed.');
