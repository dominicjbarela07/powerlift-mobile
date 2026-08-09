import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const route = fs.readFileSync(
  path.join(root, 'app/(tabs)/workout/[workoutId].tsx'),
  'utf8',
);

assert.match(route, /const \[endSessionPromptVisible, setEndSessionPromptVisible\] = useState\(false\)/);
assert.match(route, /completionPromptRef = useRef/);
assert.match(
  route,
  /programmedSetCountForSession\(current\) > 0[\s\S]*missingSetLabelsForWorkout\(current\)\.length === 0[\s\S]*setEndSessionPromptVisible\(true\)/,
  'completion transition must offer, not force, session completion',
);
assert.match(route, /visible=\{endSessionPromptVisible\}/);
assert.match(route, />End Session\?</);
assert.match(route, />Continue Logging</);
assert.match(route, />Finish Session</);
assert.match(
  route,
  /setEndSessionPromptVisible\(false\);[\s\S]*requestAnimationFrame\(openPostSessionSurvey\)/,
);

console.log('session-completion-prompt tests passed');
