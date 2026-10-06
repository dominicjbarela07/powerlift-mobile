import assert from 'node:assert/strict';
import fs from 'node:fs';
import { resolveCoachWorkspaceAthleteId as resolve } from '../lib/coach-workspace-route-identity.ts';
for (const path of ['/coach-athlete/68','/(tabs)/coach-athlete/68','/coach-athlete/68/training','/coach-athlete/68/reviews/1813']) {
 assert.equal(resolve(undefined,path),68,'nested layout with empty inherited params must retain actual route subject');
 assert.equal(resolve('68',path),68);assert.equal(resolve(['68'],path),68);
 assert.equal(resolve('67',path),0,'conflicting subject params fail closed');
}
for (const path of ['/coach-dashboard','/coach-athlete/0','/coach-athlete/-1','/coach-athlete/68x','/coach-athlete/9007199254740992'])assert.equal(resolve('68',path),0,'no foreign or malformed route may authorize a subject');
const source=fs.readFileSync('components/coach-mobile/athlete-workspace/CoachAthleteWorkspaceContext.tsx','utf8');
assert.match(source,/resolveCoachWorkspaceAthleteId\(params.athleteId, pathname\)/);
assert.match(source,/const requestNamespace = `\$\{workspaceKey\}:\$\{accountId\}:\$\{athleteId\}`/);
assert.match(source,/\/coach\/mobile\/athletes\/\$\{athleteId\}\/workspace\/bootstrap/);
assert.equal(Number(undefined || 0),0,'original inherited-local-only resolution deliberately reproduces missing subject');
assert.throws(()=>assert.equal(Number(undefined || 0),68),'original failure must not satisfy positive layout contract');
console.log('Nested canonical workspace path resolves empty layout params; conflicting/foreign subjects reject; account/relationship-scoped bootstrap retained.');
