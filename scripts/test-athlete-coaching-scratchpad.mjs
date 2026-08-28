import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const component = read('components/coach-mobile/AthleteCoachingScratchpad.tsx');
const api = read('lib/athlete-coaching-scratchpad.ts');
const athleteHub = read('components/coach-mobile/CoachAthleteHubSheet.tsx');
const athleteHubV2 = read('components/coach-mobile/CoachAthleteHubV2.tsx');
const programming = read('app/(tabs)/workout/index.tsx');
const workspace = read('components/coach-mobile/SessionEditingWorkspace.tsx');
const reviewHub = read('app/(tabs)/coach-videos.tsx');

assert.match(api, /\/coach\/mobile\/athletes\/\$\{athleteId\}\/scratchpad/);
assert.match(api, /expected_version/);
assert.match(api, /const cache = new Map<string, AthleteScratchpad>/);
assert.match(api, /MAX_CACHE_ENTRIES = 24/);

assert.match(component, /StrengthLedgerBottomSheet/);
assert.match(component, /onRequestClose=\{requestClose\}/);
assert.match(component, /Discard coaching note changes\?/);
assert.match(component, /if \(saving\) return/);
assert.match(component, /loading=\{saving\}/);
assert.match(component, /if \(saving \|\| !dirty\) return/);
assert.match(component, /result\.status === 409/);
assert.match(component, /Your draft is still here/);
assert.match(component, /draftRevisionRef/);
assert.match(component, /COACH PRIVATE/);
assert.match(component, /Updated by/);

for (const [surface, source] of [
  ['Athlete Workspace sheet', athleteHub],
  ['Athlete Workspace route', athleteHubV2],
  ['Programming Manager', programming],
  ['Session Workspace', workspace],
  ['Review Hub', reviewHub],
]) {
  assert.match(source, /AthleteCoachingScratchpadTrigger/, `${surface} must launch the canonical scratchpad`);
}

console.log('[athlete-coaching-scratchpad] PASS — canonical sheet, dirty guard, cache, concurrency, and five coaching-surface launch contracts');
