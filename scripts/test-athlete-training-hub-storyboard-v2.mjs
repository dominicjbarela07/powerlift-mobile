import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const route = fs.readFileSync(path.join(root, 'app/(tabs)/workout/index.tsx'), 'utf8');
const component = fs.readFileSync(path.join(root, 'components/training-hub/AthleteTrainingHubExperience.tsx'), 'utf8');

for (const asset of [
  'ledger-hero-plate-v1.png',
  'gym_vibe.jpg',
  'ledger-chapter-variants-v1.png',
  'ledger-chapter-accessories-v1.png',
  'ledger-chapter-journey-v1.png',
  'muscle-regions/lats.png',
  'muscle-regions/quads.png',
  'muscle-regions/chest.png',
]) {
  assert.ok(component.includes(asset), `Training Hub must use governed non-human visual asset: ${asset}`);
}

assert.match(component, /function blockArtwork\(/, 'Blocks must resolve a deterministic visual identity.');
assert.match(component, /<ProgramTimeline/, 'Program phases must render as a real timeline.');
assert.match(component, /COMPLETED.*YOU ARE HERE.*UPCOMING/s, 'Timeline must communicate past, present, and future states.');
assert.match(component, /LAST WEEK SUMMARY/, 'Prior-week evidence strip must be present.');
assert.match(component, /SETS LOGGED/, 'Prior-week performed-set evidence must be visible.');
assert.match(component, /PRs/, 'Canonical PR evidence must be visible.');
assert.match(component, /dayStrip/, 'Expanded current week must include the compact day strip.');
assert.match(component, /completed \? 'View' : active \? 'Resume' : 'Open'/, 'Session cards must be lifecycle-aware.');
assert.match(component, /<Modal[\s\S]*?completed \? <CompletedEvidence[\s\S]*?: <PlannedPreview/, 'Session taps must open plan- or evidence-aware previews.');
assert.match(component, /SESSION PREVIEW/, 'Upcoming Session preview must expose prescribed movements.');
assert.match(component, /FOCUS MUSCLES/, 'Upcoming Session preview must expose canonical target artwork.');
assert.match(component, /SESSION HIGHLIGHTS/, 'Completed Session preview must expose results.');
assert.match(component, /TOP LIFTS/, 'Completed Session preview must expose top performed work.');
assert.match(component, /View Session Recap/, 'Completed preview must lead to the canonical recap route.');
assert.match(component, /No Sessions planned/, 'Future empty weeks must remain explicit and quiet.');
assert.match(component, /initialExpandedWeekKey === undefined/, 'The render harness must support a truly collapsed overview state.');
assert.doesNotMatch(component, /glass|backdropFilter|blurRadius/i, 'Training Hub must not use glassmorphism.');

assert.match(route, /['"]\/workouts\/my_list\/mobile['"]/, 'Live Training Hub must use the production-backed canonical payload.');
assert.match(route, /session\.preview\?\.movements/, 'Movement plans must flow from the backend projection.');
assert.match(route, /focusMuscles: session\.preview\?\.focus_muscles/, 'Muscle focus must come from structured movement data.');
assert.match(route, /totalVolumeKg: session\.recap\.total_volume_kg/, 'Completed volume must come from canonical SetLogs.');
assert.match(route, /prCount: session\.recap\.pr_count/, 'Completed PR count must come from canonical accomplishments.');
assert.match(route, /pathname: '\/workout\/\[workoutId\]'/, 'Preview CTA must preserve the established athlete Session route.');
assert.doesNotMatch(route, /dev-mocks|fixtures\/.*training/i, 'No visual fixture may enter the live route.');

console.log('athlete training hub storyboard v2 contract: ok');
