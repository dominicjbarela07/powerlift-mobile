import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const layout = fs.readFileSync(path.join(root, 'app/(tabs)/_layout.tsx'), 'utf8');
const navigation = fs.readFileSync(path.join(root, 'lib/shipping-navigation.ts'), 'utf8');
const meetScreen = fs.readFileSync(path.join(root, 'app/(tabs)/athlete-meet-plan.tsx'), 'utf8');

assert.match(
  layout,
  /fetchJson<\{ has_meet_plan\?: boolean \}>\(\s*['"]\/meet-planner\/mobile\/athlete\/current['"]/,
  'Meet tab availability must come from the authoritative athlete Meet Plan endpoint.',
);
assert.match(layout, /setHasMeetPlan\(response\.json\.has_meet_plan === true\)/);
assert.match(layout, /href: hasMeetPlan \? ['"]\/\(tabs\)\/athlete-meet-plan['"] : null/);
assert.doesNotMatch(
  layout,
  /user as any\)\?\.meet_date/,
  'The Meet tab must not depend on the stale athlete-profile meet_date field.',
);
assert.match(navigation, /if \(hasMeetPlan\) athleteRoutes\.splice\(3, 0, ['"]athlete-meet-plan['"]\)/);
assert.match(meetScreen, /const hasMeetPlan = !!payload\?\.has_meet_plan && !!meet/);

console.log('DEV Meet Plan visibility contract verified.');
