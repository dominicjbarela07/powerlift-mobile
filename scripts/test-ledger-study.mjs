import assert from 'node:assert/strict';
import fs from 'node:fs';
import { STUDY_MOVEMENTS, STUDY_SESSION_DETAILS, STUDY_HISTORY, STUDY_CORE_DETAILS, STUDY_TOUR, studyImprovement, studyWeight } from '../dev-mocks/fixtures/ledger-study.ts';
import { resolvePlateClubState } from '../lib/ledger-rewards.ts';
import { estimateMovementStrengthKg, strengthMetricForMovementClass } from '../lib/movement-strength-metric.ts';
let cases = 0;
for (const h of STUDY_HISTORY) { assert.equal(STUDY_SESSION_DETAILS[h.id].reduce((n, m) => n + m.sets.length, 0), h.sets, 'Session count must equal its own performed sets'); cases++; }
for (const m of STUDY_MOVEMENTS.filter(m => m.family === 'core')) {
  const detail = STUDY_CORE_DETAILS[m.id];
  assert.equal(detail.repBests[0].kg, m.kg); assert.equal(detail.top.length, detail.dates.length);
  assert.equal(detail.top[detail.dates.indexOf(detail.repBests[0].date)], m.kg, 'The record must occur on its labelled date'); cases++;
}
assert.equal(studyImprovement(STUDY_MOVEMENTS.find(m => m.id === 'example-assisted-pullup')), 2.5); cases++;
assert.equal(studyImprovement(STUDY_MOVEMENTS.find(m => m.id === 'example-assisted-lifefitness')), null); cases++;
assert.equal(resolvePlateClubState(195,'squat','kg').earned.value,150); assert.equal(resolvePlateClubState(195,'squat','lb').earned.value,405); cases++;
assert.equal(studyWeight(170,'lb'),'374.8'); cases++;
assert.equal(STUDY_CORE_DETAILS['example-squat'].five.at(-2),165); assert.equal(STUDY_CORE_DETAILS['example-squat'].five.at(-1),170); cases++;
assert.ok(Math.abs(estimateMovementStrengthKg(strengthMetricForMovementClass('core'),170,5,8) - 209.6666666667) < .0001); cases++;
for(const m of STUDY_MOVEMENTS.filter(m => m.family === 'variants')) assert.ok(['squat','bench','deadlift'].includes(m.parent)); cases++;
assert.equal(new Set(STUDY_TOUR.map(t=>t.key)).size,9); cases++;
const source = fs.readFileSync('components/ledger-study/LedgerDesignStudy.tsx','utf8');
assert.doesNotMatch(source,/from ['"]@\/lib\/(api|ledger-archive)['"]|\bfetch\s*\(|AsyncStorage|SecureStore/, 'Storyboard must not read or mutate actual athlete data'); cases++;
assert.match(fs.readFileSync('app/(tabs)/dev-mocks/ledger-study.tsx','utf8'),/if \(!__DEV__\) return null/); cases++;
console.log(JSON.stringify({pass:true,cases,scope:'DEV storyboard fixture consistency, canonical unit/award/estimate reuse, exact contexts and no product data boundary'}));
