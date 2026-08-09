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
assert.match(route, /normalizeProfilePhotoPayload\(hub\?\.connected_coach\)/, 'Coach identity must resolve from the live Training Hub payload.');
assert.match(route, /connectedCoachPhotoUrl: coachPhoto\.profilePhotoUrl/, 'Coach photo must flow into the shared Training Hub component.');

assert.match(component, /data\.coachUpdates\?\.length \? \(/, 'Coach Updates must hide when empty.');
assert.match(component, /data\.coachUpdates\.slice\(0, 2\)/, 'Visible Coach Updates must remain bounded.');
assert.match(component, /week\.objective \? \(/, 'Week Objective must hide when absent.');
assert.match(component, /previousWeekNarrative\(data\.previousWeekRecap\)/, 'Previous Week Recap must derive a compact evidence-backed story.');
assert.match(component, /if \(!recap \|\| recap\.sessionsAssigned <= 0\) return \[\];/, 'Previous Week Recap must hide when absent or empty.');
assert.match(component, /Every planned session finished\./, 'A fully completed prior week must lead with the accomplishment.');
assert.match(component, /COACH'S FOCUS/, 'Week Objective must read as the coach’s current focus.');
assert.match(component, /profilePhotoUrl=\{coachPhotoUrl\}/, 'Coach Focus must render the coach profile avatar.');
assert.doesNotMatch(component, /weekObjective[^\\n]*borderLeft/, 'Coach Focus must not use a colored rail.');
assert.match(component, /COACH UPDATES/, 'Coach Updates must use its canonical athlete-facing label.');
assert.doesNotMatch(component, /WHAT'S NEW/, 'The retired What’s New label must not remain.');
assert.match(component, /const programAccent = SLColors\.accentViolet;/, 'The Current Program hero must use the canonical purple accent.');
assert.match(component, /<TrainingHubMaterialSurface accentColor=\{programAccent\} state="in_progress"/, 'The Current Program material must be purple without changing its semantic state.');
assert.match(component, /programKicker: \{ color: SLColors\.accentViolet \}/, 'The Current Program label must match the purple hero treatment.');
assert.ok(
  component.indexOf('COACH UPDATES') > component.indexOf('styles.programCard'),
  'Coach Updates must follow the program hero.',
);
assert.ok(
  component.indexOf('COACH UPDATES') < component.indexOf('LAST WEEK'),
  'Coach Updates must appear directly before the remaining Training Hub context.',
);
assert.ok(
  component.indexOf('COACH UPDATES') < component.indexOf('blockSelector'),
  'Coach Updates must precede the block and week workspace.',
);
assert.ok(
  component.indexOf("COACH'S FOCUS") < component.indexOf('dayRail'),
  'The coach objective must be the first content shown in an expanded week.',
);
assert.doesNotMatch(route, /fixtures\/.*training.*hub/i, 'The live route must not import Training Hub fixtures.');
assert.doesNotMatch(component, /No objective|No coach updates|No previous week recap/i, 'Optional sections must not add empty placeholders.');

console.log('training hub coach context contract: ok');
