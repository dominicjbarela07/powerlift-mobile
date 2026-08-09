import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  EXPLICIT_ROUTE_EXCLUSIONS,
  LIVE_SCREEN_REGISTRY,
  liveScreensForMode,
} from '../dev-mocks/live-screen-registry.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const appRoot = path.join(root, 'app');

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(absolute) : [absolute];
  });
}

const routeFiles = walk(appRoot)
  .filter((file) => /\.(tsx|ts)$/.test(file))
  .map((file) => path.relative(root, file).split(path.sep).join('/'))
  .sort();
const registeredSources = new Set(LIVE_SCREEN_REGISTRY.map((entry) => entry.sourceFile));
const exclusions = new Map(EXPLICIT_ROUTE_EXCLUSIONS.map((entry) => [entry.sourceFile, entry]));
const unclassified = routeFiles.filter((file) => !registeredSources.has(file) && !exclusions.has(file));

assert.deepEqual(unclassified, [], `Unclassified user-facing route files:\n${unclassified.join('\n')}`);

for (const entry of LIVE_SCREEN_REGISTRY) {
  assert.ok(entry.id && entry.title && entry.route && entry.sourceFile, `Incomplete registry entry: ${entry.id || '<missing id>'}`);
  assert.deepEqual(entry.dataModes, ['live', 'ideal'], `${entry.id} must expose Live and Ideal State data modes`);
  assert.deepEqual(entry.previewModes, ['live', 'ideal'], `${entry.id} must expose both preview actions`);
  assert.ok(entry.idealRoute, `${entry.id} has no deterministic Ideal State route`);
  assert.ok(
    [
      'production-screen',
      'production-component-adapter',
      'representative-no-production-ui',
      'canonical-design-sandbox',
    ].includes(entry.idealStateStrategy),
    `${entry.id} has no Ideal State ownership strategy`,
  );
  assert.ok(entry.userModes.length > 0, `${entry.id} has no user-mode placement`);
  assert.ok(entry.category && entry.subcategory, `${entry.id} is missing category metadata`);
  assert.ok(entry.searchKeywords.length > 0 && entry.tags.length > 0, `${entry.id} is not searchable by tags/keywords`);
  if (entry.route.includes('[') && !entry.parameterResolver && !entry.routeParams) {
    assert.fail(`${entry.id} is dynamic but has no parameter resolver or fixed safe params`);
  }
  const sourcePath = path.join(root, entry.sourceFile);
  assert.ok(fs.existsSync(sourcePath), `${entry.id} points to missing source ${entry.sourceFile}`);
  if (entry.status === 'Legacy compatibility') {
    assert.ok(entry.category === 'Legacy', `${entry.id} is deprecated but not isolated under Legacy`);
  }
}

const ids = LIVE_SCREEN_REGISTRY.map((entry) => entry.id);
assert.equal(new Set(ids).size, ids.length, 'Live screen IDs must be unique');

for (const mode of ['athlete', 'coach', 'self-coach', 'utility']) {
  assert.ok(liveScreensForMode(mode).length > 0, `${mode} registry is empty`);
}

for (const required of ['settings', 'login', 'verify-email', 'readiness-modal']) {
  const entry = LIVE_SCREEN_REGISTRY.find((candidate) => candidate.id === required);
  assert.ok(entry?.userModes.includes('utility'), `${required} must be categorized under Utility`);
}

const resolverSource = fs.readFileSync(path.join(root, 'dev-mocks/live-screen-resolvers.ts'), 'utf8');
const launcherSource = fs.readFileSync(path.join(root, 'dev-mocks/live-screen-launch.ts'), 'utf8');
assert.doesNotMatch(resolverSource, /workoutId\s*:\s*['"]?\d+|athleteId\s*:\s*['"]?\d+|threadId\s*:\s*['"]?\d+|submissionId\s*:\s*['"]?\d+/, 'Resolvers may not hardcode database IDs');
assert.match(launcherSource, /getAthleteWorkouts/, 'Workout resolver must use canonical API data');
assert.match(launcherSource, /getCoachRoster/, 'Coach athlete resolver must use canonical API data');
assert.match(launcherSource, /getDueCheckIns/, 'Check-in resolver must use canonical API data');
assert.match(launcherSource, /getMessengerThreads/, 'Thread resolver must use canonical API data');

const librarySource = fs.readFileSync(path.join(root, 'app/(tabs)/dev-mocks/index.tsx'), 'utf8');
assert.match(librarySource, /Live Screens/, 'Library must distinguish live screens');
assert.match(librarySource, /label="Live"/, 'Every library row must expose a Live action');
assert.match(librarySource, /label="Ideal State"/, 'Every library row must expose an Ideal State action');
assert.match(librarySource, /Visual Explorations/, 'Library must distinguish explorations');
assert.match(librarySource, /saveLiveScreenFavorites/, 'Favorites persistence is missing');
assert.match(librarySource, /recordLiveScreenRecent/, 'Recent screen tracking is missing');
assert.match(librarySource, /liveScreenAvailability/, 'Role/account availability checks are missing');
assert.match(librarySource, /FolderSection/, 'Category-first collapsible browsing is missing');
assert.match(librarySource, /Recently Opened/, 'Recently opened section is missing');
assert.match(librarySource, /Current context/, 'Compact authenticated context is missing');
assert.match(librarySource, /explorationStorageId/, 'Visual explorations do not share favorites and recents behavior');
assert.doesNotMatch(librarySource, /setStatus|statuses\.map/, 'Status must remain metadata rather than a dedicated filter');
assert.doesNotMatch(librarySource, /explorationCategories\.map/, 'Visual explorations must browse by category folders rather than another filter row');

console.log(`UI Mock Library registry audit passed: ${LIVE_SCREEN_REGISTRY.length} entries, ${routeFiles.length} routes, ${EXPLICIT_ROUTE_EXCLUSIONS.length} explicit exclusions.`);
