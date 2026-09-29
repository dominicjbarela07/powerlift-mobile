import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const route = fs.readFileSync(path.join(root, 'app/(tabs)/workout/index.tsx'), 'utf8');
const component = fs.readFileSync(path.join(root, 'components/training-hub/AthleteTrainingHubExperience.tsx'), 'utf8');

for (const asset of ['ledger-hero-plate-v1.png', 'gym_vibe.jpg']) {
  assert.ok(component.includes(asset), `Training Hub retains governed atmospheric asset: ${asset}`);
}
assert.match(component, /<TrainingPosition/, 'Block position is visible after Program identity.');
assert.match(component, /<TrainingWeekNavigation/, 'selected Week navigation is visible.');
assert.match(component, /<TrainingSessionSequence/, 'current Week Sessions are visible before secondary context.');
assert.ok(component.indexOf('<TrainingSessionSequence') < component.indexOf('data.previousWeekRecap ? <LastWeekEvidence'), 'Sessions precede prior-week evidence.');
assert.match(component, /setSelectedWeekKey\(week\.key\)/, 'Week arrows select the adjacent Week without changing Program data.');
assert.match(component, /week\.days\.flatMap\(\(day\) => day\.sessions/, 'the sequence preserves canonical day and Session order.');
assert.match(component, /session\.movements \|\| \[\]/, 'Session summary uses the existing movement preview.');
assert.match(component, /session\.recap\?\.prCount/, 'PR accent requires saved recap evidence.');
assert.match(component, /No Session planned for/, 'selected rest days remain explicit and quiet.');
assert.match(component, /onOpenMap=\{\(\) => onAction\(\{ type: 'program-timeline'/, 'Program map retains the established destination.');
assert.doesNotMatch(component, /<ProgramTimeline blocks=/, 'duplicate inline Block timeline is removed from the primary Hub.');
assert.doesNotMatch(component, /glass|backdropFilter|blurRadius/i, 'Training Hub must not use glassmorphism.');

assert.match(route, /['"]\/workouts\/my_list\/mobile['"]/, 'Live Training Hub must use the production-backed canonical payload.');
assert.match(route, /session\.preview\?\.movements/, 'Movement plans must flow from the backend projection.');
assert.match(route, /focusMuscles: session\.preview\?\.focus_muscles/, 'Muscle focus must come from structured movement data.');
assert.match(route, /totalVolumeKg: session\.recap\.total_volume_kg/, 'Completed volume must come from canonical SetLogs.');
assert.match(route, /prCount: session\.recap\.pr_count/, 'Completed PR count must come from canonical accomplishments.');
assert.match(route, /pathname: '\/workout\/\[workoutId\]'/, 'Preview CTA must preserve the established athlete Session route.');
assert.doesNotMatch(route, /dev-mocks|fixtures\/.*training/i, 'No visual fixture may enter the live route.');

console.log('athlete training hub storyboard v2 contract: ok');
