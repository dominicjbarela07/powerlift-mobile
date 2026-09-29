import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildProgramTimelinePayload } from '../lib/program-timeline.ts';
import { buildProgramTimelineRoute, PROGRAM_TIMELINE_PATHNAME } from '../lib/program-timeline-navigation.ts';

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
      { id: 20, date: '2026-08-17', label: 'W2 Pull', status: 'completed', preview: { movement_count: 7, set_count: 21, muscle_focus: { primary: [{ muscle_id: 'lats' }] } }, recap: { logged_set_count: 21, session_rpe: 8 } },
    ],
  },
  pending_map: {
    2: [
      { id: 21, date: '2026-08-18', label: 'Missed Push', status: 'missed', preview: { movement_count: 5, set_count: 15, muscle_focus: { primary: [{ muscle_id: 'chest' }] } } },
      { id: 22, date: '2026-08-20', label: 'Back Today', status: 'assigned', preview: { movement_count: 6, set_count: 18, movements: [{ movement: 'Competition Squat' }, { movement: 'Competition Bench' }], muscle_focus: { primary: [{ muscle_id: 'upper_back' }] } }, estimated_duration_minutes: 70 },
      { id: 23, date: '2026-08-22', label: 'Upcoming Arms', status: 'assigned', preview: { movement_count: 4, set_count: 12, muscle_focus: { primary: [{ muscle_id: 'biceps' }] } } },
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
assert.equal(currentWeek.plannedSetCount, 66, 'Week fingerprints must carry real planned-set density');
assert.equal(currentWeek.programmingState, 'programmed');
assert.equal(payload.blocks[2].weeks[1].programmingState, 'unbuilt', 'empty future Weeks must remain visibly unbuilt');
assert.equal(currentWeek.days.find((day) => day.date === '2026-08-19')?.sessions.length, 0, 'an empty day stays neutral');
assert.equal(currentWeek.days.find((day) => day.date === '2026-08-18')?.sessions[0]?.lifecycle, 'missed');
assert.equal(currentWeek.days.find((day) => day.date === '2026-08-20')?.sessions[0]?.lifecycle, 'today');
assert.equal(currentWeek.days.find((day) => day.date === '2026-08-22')?.sessions[0]?.lifecycle, 'upcoming');
assert.deepEqual(currentWeek.days.find((day) => day.date === '2026-08-20')?.sessions[0]?.primaryMuscles, ['upper_back']);
assert.deepEqual(currentWeek.days.find((day) => day.date === '2026-08-20')?.sessions[0]?.movementNames, ['Squat', 'Bench'], 'display names come from the saved preview without changing movement identity');

const component = fs.readFileSync(path.join(root, 'components/training-hub/AthleteProgramTimeline.tsx'), 'utf8');
const route = fs.readFileSync(path.join(root, 'app/(tabs)/workout/program-timeline.tsx'), 'utf8');
const hub = fs.readFileSync(path.join(root, 'components/training-hub/AthleteTrainingHubExperience.tsx'), 'utf8');
const index = fs.readFileSync(path.join(root, 'app/(tabs)/workout/index.tsx'), 'utf8');
const tabLayout = fs.readFileSync(path.join(root, 'app/(tabs)/_layout.tsx'), 'utf8');
const detail = fs.readFileSync(path.join(root, 'app/(tabs)/workout/[workoutId].tsx'), 'utf8');

assert.deepEqual(buildProgramTimelineRoute({ programId: 44 }), {
  pathname: PROGRAM_TIMELINE_PATHNAME,
  params: { programId: '44' },
}, 'an active Program must launch through the canonical Timeline route');
assert.deepEqual(buildProgramTimelineRoute({ programId: 44, athleteId: 3 }), {
  pathname: PROGRAM_TIMELINE_PATHNAME,
  params: { programId: '44', athleteId: '3' },
}, 'coach-preview launches must preserve the authoritative athlete context');
assert.equal(buildProgramTimelineRoute({ programId: null }), null, 'no active Program must fail closed');
assert.equal(buildProgramTimelineRoute({ programId: 0 }), null, 'an invalid Program identity must fail closed');

assert.match(component, /FlatList<ProgramTimelineBlock>/, 'long Programs keep Block virtualization');
assert.match(component, /block\.weeks\.map\(\(week\) =>/, 'Weeks render in canonical chronological order');
assert.doesNotMatch(component, /mapRowReverse|MAP_COLUMNS|scrubAtPoint/, 'the serpentine visual order and map scrub may not return');
assert.match(component, /BlockTerritory/, 'Blocks remain distinct in one Program map');
assert.match(component, /WeekNode/, 'every Week remains selectable');
assert.match(component, /WeekExpansion/, 'a selected Week reveals its Sessions in place');
assert.match(component, /programmingState === 'unbuilt'/, 'empty future Weeks stay distinct from planned Weeks');
assert.match(component, /session\.movementNames/, 'Session rows present canonical preview movement order');
assert.match(component, /Gesture\.Pan\(\)/, 'expanded Week retains horizontal traversal');
assert.match(component, /Haptics\.selectionAsync/, 'Week selection retains tactile feedback');
assert.match(component, /useSLReducedMotion/, 'Week transitions honor Reduced Motion');
assert.match(component, /useState<string \| null>\(startingWeekKey\)/, 'the current or returning Week is visible on arrival');
assert.match(component, /setExpandedWeekKey\(opening \? week\.key : null\)/, 'only one Week may be expanded');
assert.match(component, /Return to current Week/, 'browsing away exposes the current-Week return');
assert.doesNotMatch(component, /contentMaxWidth|alignSelf:\s*'center'/, 'iPhone content stays full width');
assert.match(route, /\/workouts\/my_list\/mobile/, 'timeline must reuse the authoritative active Program payload');
assert.match(route, /returnTo: 'program-timeline'/, 'Session drill-down must preserve timeline return context');
assert.match(route, /returnWeekKey/, 'Session drill-down must retain its Week context');
assert.match(detail, /returnTo === 'program-timeline'/, 'Session detail must return to Program Timeline');
assert.match(hub, /type: 'program-timeline'; id: number/, 'active Program must have a dedicated action');
assert.match(hub, />Program map</, 'active Program CTA names this destination consistently');
assert.match(hub, /testID="training-hub-program-timeline"/, 'the Program Timeline control must remain addressable by behavioral navigation tests');
assert.match(hub, /accessibilityLabel="Open Program map"[\s\S]*?onPress=\{onOpenMap\}/, 'the visible map control retains a usable Pressable target');
assert.match(hub, /PROGRAM HISTORY/, 'completed-program history remains a separate destination');
const noActiveProgramSource = hub.slice(hub.indexOf('function NoActiveProgram'), hub.indexOf('function clamp01'));
assert.doesNotMatch(noActiveProgramSource, /type: 'program-timeline'/, 'no-active-Program state must not expose a dead Timeline action');
assert.match(index, /buildProgramTimelineRoute\(\{ programId, athleteId: rosterAthleteId \}\)/, 'all Training Hub Timeline launches must use the canonical route contract');
assert.match(index, /if \(programTimelineOpeningRef\.current\) return;[\s\S]*?programTimelineOpeningRef\.current = true;[\s\S]*?router\.push\(route as any\)/, 'repeated taps must not stack duplicate Timeline routes');
assert.match(index, /useFocusEffect\([\s\S]*?programTimelineOpeningRef\.current = false;/, 'returning from Timeline must re-arm the Training Hub control');
assert.match(index, /openProgramTimeline\(action\.id\)/, 'Training Hub must route the active Program action');
assert.match(route, /router\.navigate\('\/\(tabs\)\/workout'/, 'Timeline back explicitly returns to Training Hub');
assert.match(tabLayout, /usesTrainingMapSelection[\s\S]*?\? trainingRoute/, 'the Program map keeps Training selected in the floating navigation');

console.log('Program Timeline V3 contracts passed.');
