import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildProgramTimelinePayload } from '../lib/program-timeline.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const raw = {
  ok: true,
  training_hub: {
    today: '2026-08-20',
    active_program: {
      id: 44,
      name: 'Bodybuilding Offseason',
      description: 'Build through the fall',
      start_date: '2026-07-06',
      end_date: '2026-09-27',
    },
    current_block: { id: 2, current_week: 2 },
  },
  blocks: [
    { id: 1, training_program_id: 44, order_idx: 1, name: 'Reverse Diet', start_date: '2026-07-06', end_date: '2026-07-19', total_weeks: 2 },
    { id: 2, training_program_id: 44, order_idx: 2, name: 'Offseason', start_date: '2026-08-10', end_date: '2026-08-23', total_weeks: 2, current_week: 2 },
    { id: 3, training_program_id: 44, order_idx: 3, name: 'Cruise', start_date: '2026-09-14', end_date: '2026-09-27', total_weeks: 2 },
    { id: 99, training_program_id: 999, order_idx: 1, name: 'Foreign Program', start_date: '2026-08-01', end_date: '2026-08-07', total_weeks: 1 },
  ],
  completed_map: {
    1: [
      { id: 10, date: '2026-07-06', label: 'W1 Pull', status: 'completed', preview: { movement_count: 6, muscle_focus: { primary: [{ muscle_id: 'lats' }] } }, recap: { logged_set_count: 18, session_rpe: 7 } },
    ],
    2: [
      { id: 20, date: '2026-08-17', label: 'W2 Pull', status: 'completed', preview: { movement_count: 7, muscle_focus: { primary: [{ muscle_id: 'lats' }] } }, recap: { logged_set_count: 21, session_rpe: 8 } },
    ],
  },
  pending_map: {
    2: [
      { id: 21, date: '2026-08-18', label: 'Missed Push', status: 'missed', preview: { movement_count: 5, muscle_focus: { primary: [{ muscle_id: 'chest' }] } } },
      { id: 22, date: '2026-08-20', label: 'Back Today', status: 'assigned', preview: { movement_count: 6, muscle_focus: { primary: [{ muscle_id: 'upper_back' }] } }, estimated_duration_minutes: 70 },
      { id: 23, date: '2026-08-22', label: 'Upcoming Arms', status: 'assigned', preview: { movement_count: 4, muscle_focus: { primary: [{ muscle_id: 'biceps' }] } } },
    ],
    3: [
      { id: 30, date: '2026-09-14', label: 'Future Legs', status: 'assigned', preview: { movement_count: 5, muscle_focus: { primary: [{ muscle_id: 'quads' }] } } },
    ],
  },
};

const payload = buildProgramTimelinePayload(raw);
assert.ok(payload, 'active program must map');
assert.equal(payload.program.id, 44);
assert.equal(payload.blocks.length, 3, 'another Program must never leak into this timeline');
assert.deepEqual(payload.blocks.map((block) => block.status), ['completed', 'current', 'upcoming']);
assert.equal(payload.program.totalWeeks, 6);
assert.equal(payload.program.totalSessions, 6);
assert.equal(payload.program.currentBlockId, 2);
assert.equal(payload.program.currentWeekKey, '2-2');
assert.ok(payload.program.positionPercent > 0.4 && payload.program.positionPercent < 0.8, 'YOU ARE HERE must be proportional to program weeks');

for (const block of payload.blocks) {
  for (const week of block.weeks) assert.equal(week.days.length, 7, 'every Week must expose seven chronological days');
}

const currentWeek = payload.blocks[1].weeks[1];
assert.equal(currentWeek.current, true);
assert.equal(currentWeek.sessionCount, 4);
assert.equal(currentWeek.completedCount, 1);
assert.equal(currentWeek.missedCount, 1);
assert.equal(currentWeek.days.find((day) => day.date === '2026-08-19')?.sessions.length, 0, 'an empty day stays neutral');
assert.equal(currentWeek.days.find((day) => day.date === '2026-08-18')?.sessions[0]?.lifecycle, 'missed');
assert.equal(currentWeek.days.find((day) => day.date === '2026-08-20')?.sessions[0]?.lifecycle, 'today');
assert.equal(currentWeek.days.find((day) => day.date === '2026-08-22')?.sessions[0]?.lifecycle, 'upcoming');
assert.deepEqual(currentWeek.days.find((day) => day.date === '2026-08-20')?.sessions[0]?.primaryMuscles, ['upper_back']);

const component = fs.readFileSync(path.join(root, 'components/training-hub/AthleteProgramTimeline.tsx'), 'utf8');
const route = fs.readFileSync(path.join(root, 'app/(tabs)/workout/program-timeline.tsx'), 'utf8');
const hub = fs.readFileSync(path.join(root, 'components/training-hub/AthleteTrainingHubExperience.tsx'), 'utf8');
const index = fs.readFileSync(path.join(root, 'app/(tabs)/workout/index.tsx'), 'utf8');
const detail = fs.readFileSync(path.join(root, 'app/(tabs)/workout/[workoutId].tsx'), 'utf8');

assert.match(component, /SectionList/, 'long Programs must use virtualized chronology');
assert.match(component, /ProgrammingMuscleRegionArt level="session"/, 'Sessions must use focused muscle-region assets');
assert.doesNotMatch(component, /MuscleMap|level="week"/, 'Program, Block, and Week headers must not render full anatomy');
assert.match(component, /scrollToLocation/, 'Block and current-Week navigation must jump directly');
assert.match(component, /setExpandedWeekKey\(\(current\) => current === week\.key \? null : week\.key\)/, 'only one Week may be expanded');
assert.doesNotMatch(component, /contentMaxWidth|alignSelf:\s*'center'/, 'standard iPhone layout must not be squeezed into a centered web column');
assert.match(route, /\/workouts\/my_list\/mobile/, 'timeline must reuse the authoritative active Program payload');
assert.match(route, /returnTo: 'program-timeline'/, 'Session drill-down must preserve timeline return context');
assert.match(detail, /returnTo === 'program-timeline'/, 'Session detail must return to Program Timeline');
assert.match(hub, /type: 'program-timeline'; id: number/, 'active Program must have a dedicated action');
assert.match(hub, />Program Timeline</, 'active Program CTA must be named truthfully');
assert.match(hub, /PROGRAM HISTORY/, 'completed-program history remains a separate destination');
assert.match(index, /openProgramTimeline\(action\.id\)/, 'Training Hub must route the active Program action');

console.log('Program Timeline V2 contracts passed.');
