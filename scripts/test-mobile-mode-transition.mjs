import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { resolveActiveMobileMode } from '../lib/mobileViewMode.ts';
import { coachHomeContextKey } from '../lib/coach-mobile-v2.ts';

const root = resolve(import.meta.dirname, '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const auth = read('context/AuthContext.tsx');
const settings = read('app/(tabs)/settings.tsx');
const tabs = read('app/(tabs)/_layout.tsx');
const athleteHome = read('app/(tabs)/athlete-dashboard.tsx');
const messages = read('app/(tabs)/messages/index.tsx');
const trainingHub = read('app/(tabs)/workout/index.tsx');

const selfCoach = {
  id: 1,
  role: 'coach',
  is_coach: true,
  workspace_mode: 'individual',
  is_individual_workspace: true,
  is_self_coached: true,
  can_access_internal_self_coach_mobile_mode: true,
  available_mobile_modes: ['athlete', 'coach', 'individual'],
};

assert.equal(resolveActiveMobileMode({ ...selfCoach, mobile_mode: 'coach' }), 'coach');
assert.equal(resolveActiveMobileMode({ ...selfCoach, mobile_mode: 'athlete' }), 'athlete');
assert.equal(resolveActiveMobileMode({ ...selfCoach, mobile_mode: 'individual' }), 'individual');
assert.equal(
  resolveActiveMobileMode({
    ...selfCoach,
    can_access_internal_self_coach_mobile_mode: false,
    available_mobile_modes: ['individual'],
    mobile_mode: null,
  }),
  'individual',
  'dedicated individual accounts must still restore their only legal workspace',
);
assert.equal(
  resolveActiveMobileMode({ role: 'athlete', is_coach: false, is_self_coached: false, mobile_mode: 'coach', available_mobile_modes: ['athlete'] }),
  'athlete',
  'an unavailable cached mode must fail closed to the backend-authorized mode',
);

assert.notEqual(
  coachHomeContextKey({ ...selfCoach, email: 'owner@example.com', mobile_mode: 'coach' }),
  coachHomeContextKey({ ...selfCoach, email: 'owner@example.com', mobile_mode: 'individual' }),
  'Coach Home hydration context must change with presentation mode even when relationship identity is stable',
);

assert.match(auth, /activeMobileMode: MobileViewMode/);
assert.match(auth, /switchMobileMode: \(mode: MobileViewMode\)/);
assert.match(auth, /const optimisticUser: AuthUser = \{ \.\.\.current, mobile_mode: nextMode \}/);
assert.match(auth, /workspaceAuthorityGenerationRef\.current \+= 1/);
assert.match(auth, /sequence !== mobileModeSequenceRef\.current/);
assert.match(auth, /server result is useful rollback truth, but it cannot rehydrate UI/);
assert.match(auth, /const rollbackUser = confirmedMobileUserRef\.current \|\| current/);
assert.match(auth, /nextUser\.mobile_mode = current\.mobile_mode/);
assert.match(auth, /requestWorkspaceGeneration !== workspaceAuthorityGenerationRef\.current/);
assert.match(auth, /const workspaceKey = `\$\{accountIdentity\}:\$\{activeMobileMode\}:/);

assert.match(settings, /const activeMobileMode = auth\.activeMobileMode/);
assert.match(settings, /setModeModalOpen\(false\);[\s\S]*?router\.replace\(nextMode === 'coach'/);
assert.match(settings, /const transition = auth\?\.switchMobileMode\?\.\(nextMode\)/);
assert.doesNotMatch(settings, /getMobileViewMode|setMobileViewMode|saveMobileViewMode/);

assert.match(tabs, /const \{ user, activeMobileMode, workspaceKey \} = useAuth\(\)/);
assert.match(tabs, /const isIndividual = activeMobileMode === 'individual'/);
assert.match(tabs, /<Tabs\s+key=\{workspaceKey\}/);
assert.doesNotMatch(tabs, /getMobileViewMode|subscribeMobileViewModeChanged|mobileViewModeLoaded/);
assert.match(athleteHome, /TODAY_CACHE_VERSION}:\$\{workspaceKey\}/);
assert.match(messages, /activeMobileMode === 'coach' && user\?\.is_coach/);
assert.match(trainingHub, /const isIndividual = activeMobileMode === 'individual'/);

console.log('[mobile-mode-transition] one authority, optimistic routing, coherent rollback, stale-response guards, relationship separation, and workspace cache invalidation passed');
