import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const route = fs.readFileSync(path.join(root, 'app/(tabs)/workout/index.tsx'), 'utf8');
const component = fs.readFileSync(
  path.join(root, 'components/training-hub/AthleteTrainingHubExperience.tsx'),
  'utf8',
);

assert.match(route, /useFocusEffect\(/, 'Training Hub must revalidate through its production focus lifecycle.');
assert.match(route, /onRefresh=\{\(\) => loadTraining\(\{ silent: true \}\)\}/, 'Pull-to-refresh must use the canonical Training Hub query.');
assert.match(route, /block\.week_objectives\?\.find/, 'Week objectives must come from the live block payload.');
assert.match(route, /coachUpdates: \(hub\?\.coach_updates \|\| \[\]\)/, 'Coach Updates must come from the live API payload.');
assert.match(route, /previousWeekRecap: hub\?\.previous_week_recap\?\.sessions/, 'Previous Week Recap must come from the live API payload.');
assert.match(route, /setsCompleted: hub\.previous_week_recap\.sets\?\.completed \?\? null/, 'Unavailable recap set metrics must remain unavailable, not fabricated as zero.');
assert.match(route, /prCount: hub\.previous_week_recap\.pr_count \?\? null/, 'Previous-week PR evidence must remain canonical.');
assert.match(route, /totalVolumeKg: hub\.previous_week_recap\.total_volume_kg \?\? null/, 'Previous-week volume must come from the backend projection.');
assert.match(route, /normalizeProfilePhotoPayload\(hub\?\.connected_coach\)/, 'Coach identity must still resolve from the live Training Hub payload.');

assert.match(component, /data\.coachUpdates\?\.length \? \(/, 'Coach Updates must hide when empty.');
assert.match(component, /data\.coachUpdates\.slice\(0, 2\)/, 'Visible Coach Updates must remain bounded.');
assert.match(component, /week\.objective \? <View/, 'Week objective must hide when absent.');
assert.match(component, /data\.previousWeekRecap \? \(/, 'Previous-week evidence must hide when absent.');
assert.match(component, /recap\.sessionsCompleted >= recap\.sessionsAssigned/, 'Previous-week copy must be derived from the real completion counts.');
assert.match(component, /Every planned session finished\./, 'A fully completed prior week may state the deterministic outcome.');
assert.match(component, /COACH FOCUS/, 'Week Objective must retain the coach-focus label.');
assert.match(component, /COACH UPDATES/, 'Coach Updates must use its canonical athlete-facing label.');
assert.doesNotMatch(component, /WHAT'S NEW/, 'The retired What’s New label must not remain.');
assert.ok(
  component.indexOf('<LastWeekEvidence') < component.indexOf('data.coachUpdates?.length'),
  'The storyboard evidence strip must precede optional coach updates.',
);
assert.ok(
  component.indexOf('COACH FOCUS') < component.indexOf('dayStrip'),
  'The coach objective must be the first content shown in an expanded week.',
);
assert.doesNotMatch(route, /fixtures\/.*training.*hub/i, 'The live route must not import Training Hub fixtures.');
assert.doesNotMatch(component, /No objective|No coach updates|No previous week recap/i, 'Optional sections must not add empty placeholders.');

console.log('training hub coach context contract: ok');
