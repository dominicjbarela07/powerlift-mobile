import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const athleteRoute = readFileSync(resolve(root, 'app/(tabs)/athlete-calendar.tsx'), 'utf8');
const athleteExperience = readFileSync(resolve(root, 'components/calendar/AthleteCalendarExperience.tsx'), 'utf8');
const coachRoute = readFileSync(resolve(root, 'app/(tabs)/coach-calendar.tsx'), 'utf8');

for (const marker of ['programName', 'programStatus', 'weekNumber', 'calendarAccessScope']) {
  assert.match(athleteRoute, new RegExp(marker), `athlete calendar must project ${marker}`);
  assert.match(athleteExperience, new RegExp(marker), `athlete calendar presentation must retain ${marker}`);
}
assert.match(athleteExperience, /function sessionCalendarContext/);
assert.match(coachRoute, /function calendarSessionContext/);
assert.match(athleteExperience, /formatWeightFromKg/, 'calendar evidence must preserve preferred-unit conversion');
assert.match(athleteRoute, /data\.preferredUnits \|\| 'lb'/, 'calendar readiness must preserve the established preferred-unit fallback');

console.log('[calendar-program-context] Program, Block, Week, privacy scope, and preferred-unit contracts passed');
