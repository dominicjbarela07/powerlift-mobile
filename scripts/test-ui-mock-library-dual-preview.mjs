import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { DEV_MOCK_LIBRARY } from '../dev-mocks/library.ts';
import {
  CANONICAL_LOGGER_IDEAL_ENTRY_IDS,
  LIVE_SCREEN_REGISTRY,
} from '../dev-mocks/live-screen-registry.ts';
import { MODAL_PREVIEW_REGISTRY } from '../dev-mocks/modal-preview-registry.ts';
import {
  isScreenMockReviewable,
  isTransientMockReviewable,
} from '../dev-mocks/parity-inventory.ts';
import { UI_MOCK_PARITY_INVENTORY } from '../dev-mocks/parity-inventory-report.ts';
import {
  beginDevLiveScreenSession,
  endDevLiveScreenSession,
} from '../dev-mocks/live-screen-session.ts';
import {
  productionIdealAuthUser,
  resolveProductionIdealRequest,
} from '../dev-mocks/production-ideal-state.ts';

globalThis.__DEV__ = true;

const root = process.cwd();
const source = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const librarySource = source('app/(tabs)/dev-mocks/index.tsx');
const transientHost = source('app/(tabs)/dev-mocks/live-state/[stateId].tsx');
const fixtureAdapter = source('dev-mocks/production-ideal-state.ts');
const apiSource = source('lib/api.ts');
const authSource = source('context/AuthContext.tsx');
const workoutRoute = source('app/(tabs)/workout/[workoutId].tsx');
const workoutFixture = source('dev-mocks/fixtures/workout-detail.ts');

const strategies = new Set([
  'production-screen',
  'production-component-adapter',
  'representative-no-production-ui',
  'canonical-design-sandbox',
]);
const canonicalLoggerIds = new Set(CANONICAL_LOGGER_IDEAL_ENTRY_IDS);

assert.equal(
  UI_MOCK_PARITY_INVENTORY.length,
  LIVE_SCREEN_REGISTRY.length + MODAL_PREVIEW_REGISTRY.length + DEV_MOCK_LIBRARY.length,
  'Parity inventory must include every registered screen, transient, and exploration.',
);
assert.ok(LIVE_SCREEN_REGISTRY.every(isScreenMockReviewable), 'Every screen needs an Ideal State owner.');
assert.ok(MODAL_PREVIEW_REGISTRY.every(isTransientMockReviewable), 'Every transient needs an Ideal State owner.');

for (const entry of LIVE_SCREEN_REGISTRY) {
  assert.ok(strategies.has(entry.idealStateStrategy), `${entry.id} has an invalid ownership strategy.`);
  assert.doesNotMatch(
    entry.idealRoute,
    /\/dev-mocks\/ideal-state\//,
    `${entry.id} still points at the deleted generic representative screen host.`,
  );
  if (entry.idealStateStrategy === 'representative-no-production-ui') {
    assert.ok(
      entry.sourceFile.includes('/dev-mocks/') || entry.sourceFile.startsWith('dev-mocks/'),
      `${entry.id} claims no production UI even though ${entry.sourceFile} is a production owner.`,
    );
  }
}

const loggerSandboxes = LIVE_SCREEN_REGISTRY.filter(
  (entry) => entry.idealStateStrategy === 'canonical-design-sandbox',
);
assert.deepEqual(
  loggerSandboxes.map((entry) => entry.id).sort(),
  [...canonicalLoggerIds].sort(),
  'Only the three canonical logger lifecycle entries may own a design sandbox.',
);

const expectedLoggerRoutes = {
  'canonical-logger-pre-session': '/(tabs)/workout/990001?loggerLifecycle=pre_session',
  'canonical-logger-active-session': '/(tabs)/workout/990001?loggerLifecycle=active_session',
  'canonical-logger-post-session': '/(tabs)/workout/990001?loggerLifecycle=post_session',
};
for (const entry of loggerSandboxes) {
  assert.equal(entry.sourceFile, 'app/(tabs)/workout/[workoutId].tsx');
  assert.equal(entry.idealRoute, expectedLoggerRoutes[entry.id]);
}

for (const entry of MODAL_PREVIEW_REGISTRY) {
  assert.ok(strategies.has(entry.idealStateStrategy), `${entry.id} has an invalid transient strategy.`);
  assert.notEqual(entry.idealStateStrategy, 'canonical-design-sandbox');
  if (entry.idealStateStrategy === 'representative-no-production-ui') {
    assert.ok(
      entry.sourceFile.includes('/dev-mocks/') || entry.sourceFile.startsWith('dev-mocks/'),
      `${entry.id} retains representative ownership despite an existing production transient.`,
    );
  }
}

assert.doesNotMatch(librarySource, /dev-mocks\/ideal-state/);
assert.match(librarySource, /productionOwner\?\.idealRoute/);
assert.match(transientHost, /entry\.idealStateStrategy === 'representative-no-production-ui'/);
assert.match(transientHost, /router\.replace\(productionOwner\.idealRoute/);
assert.doesNotMatch(
  transientHost,
  /entry\.implementation !== 'reused-component'\)\s*\{\s*return <RepresentativeIdealTransient/,
  'Production route-owned transients must not fall back to the generic representative sheet.',
);
assert.equal(fs.existsSync(path.join(root, 'dev-mocks/RepresentativeIdealScreen.tsx')), false);
assert.equal(fs.existsSync(path.join(root, 'app/(tabs)/dev-mocks/ideal-state/[screenId].tsx')), false);

assert.match(apiSource, /resolveProductionIdealRequest<T>\(path, init\)/);
assert.match(authSource, /productionIdealAuthUser/);
assert.match(fixtureAdapter, /method !== 'GET' && method !== 'HEAD'/);
assert.match(fixtureAdapter, /persisted: false/);
assert.match(fixtureAdapter, /\/athletes\/mobile\/dashboard/);
assert.match(fixtureAdapter, /\/athletes\/mobile\/calendar/);
assert.match(fixtureAdapter, /\/messenger\/mobile\/threads/);
assert.match(fixtureAdapter, /\/coach\/mobile\/roster/);

beginDevLiveScreenSession({
  entryId: 'athlete-home',
  title: 'Athlete Home',
  mode: 'ideal',
  returnHref: '/(tabs)/dev-mocks',
});
const dashboard = resolveProductionIdealRequest('/athletes/mobile/dashboard', { method: 'GET' });
assert.equal(dashboard?.ok, true);
assert.equal(dashboard?.json?.ok, true);
assert.ok(dashboard?.json?.today?.mission?.session?.id);
assert.equal(productionIdealAuthUser()?.account_state, 'READY');
const sandboxedWrite = resolveProductionIdealRequest('/messenger/mobile/threads/990701/messages', {
  method: 'POST',
  body: JSON.stringify({ body: 'This must never leave the device.' }),
});
assert.equal(sandboxedWrite?.json?.persisted, false);
assert.deepEqual(
  resolveProductionIdealRequest('/athletes/mobile/dashboard', { method: 'GET' }),
  dashboard,
  'Fabricated production-screen data must be deterministic.',
);
const populatedContracts = [
  ['/athletes/mobile/calendar', (json) => json?.athlete_calendar?.days?.length],
  ['/workouts/my_list/mobile', (json) => json?.training_hub?.next_session?.id],
  ['/workouts/mobile/training-hub/session-history', (json) => json?.session_history?.sessions?.length],
  ['/meet-planner/mobile/athlete/current', (json) => json?.has_meet_plan && json?.meet?.id && json?.attempts?.SQ?.length],
  ['/check-ins/mobile/due', (json) => json?.due_check_ins?.length],
  ['/check-ins/mobile/submissions/990601', (json) => json?.submission?.form?.questions?.length],
  ['/athletes/mobile/reflection', (json) => json?.reflection?.current_coaching_focus?.lifts?.length],
  ['/athletes/mobile/progression', (json) => json?.progression?.big_three_arc?.lifts?.length],
  ['/messenger/mobile/threads', (json) => json?.threads?.length],
  ['/coach/mobile/roster', (json) => json?.athletes?.length],
  ['/video-review/mobile/athlete/archive', (json) => json?.archive?.length],
  ['/mobile/settings', (json) => json?.training_profile?.name],
];
for (const [endpoint, populated] of populatedContracts) {
  const result = resolveProductionIdealRequest(endpoint, { method: 'GET' });
  assert.equal(result?.ok, true, `${endpoint} did not resolve through the Ideal State adapter.`);
  assert.ok(populated(result?.json), `${endpoint} did not provide a populated deterministic contract.`);
}

const meetPlan = resolveProductionIdealRequest('/meet-planner/mobile/athlete/current', { method: 'GET' });
assert.equal(meetPlan?.json?.has_meet_plan, true);
assert.ok(meetPlan?.json?.meet?.id);
assert.ok(meetPlan?.json?.attempts?.SQ?.length);
assert.equal(
  Object.hasOwn(meetPlan?.json || {}, 'meet_plan'),
  false,
  'Meet Plan fixture must use the production screen’s top-level MeetPayload contract.',
);

const missingFixture = resolveProductionIdealRequest('/dev-only/unregistered-contract', { method: 'GET' });
assert.equal(missingFixture?.status, 501);
assert.equal(missingFixture?.json?.dev_mock_missing_fixture, true);
assert.equal(
  missingFixture?.json?.ok,
  false,
  'An unregistered Ideal State contract must fail loudly instead of masquerading as a valid empty payload.',
);
endDevLiveScreenSession();

function idealUserFor(entryId) {
  beginDevLiveScreenSession({
    entryId,
    title: entryId,
    mode: 'ideal',
    returnHref: '/(tabs)/dev-mocks',
  });
  const user = productionIdealAuthUser();
  endDevLiveScreenSession();
  return user;
}

assert.equal(idealUserFor('login'), null);
assert.equal(idealUserFor('verify-email')?.account_state, 'EMAIL_VERIFICATION_REQUIRED');
assert.equal(idealUserFor('verify-email')?.can_access_product, false);
assert.equal(idealUserFor('link-coach')?.account_state, 'LINK_COACH_REQUIRED');
assert.equal(idealUserFor('link-coach')?.has_linked_athlete, false);
assert.equal(idealUserFor('coach-roster')?.mobile_mode, 'coach');
assert.equal(idealUserFor('self-coach-home')?.workspace_mode, 'individual');

beginDevLiveScreenSession({
  entryId: 'account-access-gate',
  title: 'Account Access Gate',
  mode: 'ideal',
  returnHref: '/(tabs)/dev-mocks',
});
assert.equal(productionIdealAuthUser()?.account_state, 'ACTIVATION_REQUIRED');
assert.equal(productionIdealAuthUser()?.can_access_product, false);
endDevLiveScreenSession();

beginDevLiveScreenSession({
  entryId: 'athlete-home',
  title: 'Athlete Home',
  mode: 'live',
  returnHref: '/(tabs)/dev-mocks',
});
assert.equal(
  resolveProductionIdealRequest('/athletes/mobile/dashboard', { method: 'GET' }),
  null,
  'Live preview mode must continue using authenticated production dependencies.',
);
assert.equal(
  productionIdealAuthUser(),
  undefined,
  'Live preview mode must never replace the authenticated user.',
);
endDevLiveScreenSession();

beginDevLiveScreenSession({
  entryId: 'canonical-logger-active-session',
  title: 'Canonical Logger — Active Session',
  mode: 'ideal',
  returnHref: '/(tabs)/dev-mocks',
});
assert.equal(
  resolveProductionIdealRequest('/athletes/mobile/dashboard', { method: 'GET' }),
  null,
  'The global Ideal State adapter must never activate inside a canonical logger sandbox.',
);
assert.equal(
  productionIdealAuthUser(),
  undefined,
  'The global mock auth adapter must never replace canonical logger auth state.',
);
endDevLiveScreenSession();

for (const field of ['permissions', 'athlete', 'readiness_survey', 'core_items', 'accessory_groups']) {
  assert.match(workoutFixture, new RegExp(`${field}:`), `Canonical logger fixture is missing ${field}.`);
}
assert.match(workoutRoute, /createWorkoutDetailFixture/);
assert.doesNotMatch(
  workoutRoute,
  /productionIdealAuthUser|resolveProductionIdealRequest/,
  'The canonical logger route must not be coupled to the global production-screen fixture adapter.',
);

const strategyCounts = [...LIVE_SCREEN_REGISTRY, ...MODAL_PREVIEW_REGISTRY].reduce(
  (counts, entry) => {
    counts[entry.idealStateStrategy] = (counts[entry.idealStateStrategy] || 0) + 1;
    return counts;
  },
  {},
);
assert.equal(strategyCounts['canonical-design-sandbox'], 3);
assert.equal(UI_MOCK_PARITY_INVENTORY.filter((item) => item.status === 'blocked').length, 0);

console.log(
  `Ideal State parity OK: ${LIVE_SCREEN_REGISTRY.length} screens and `
  + `${MODAL_PREVIEW_REGISTRY.length} transients audited. Strategy counts: `
  + JSON.stringify(strategyCounts),
);
