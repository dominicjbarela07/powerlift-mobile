import assert from 'node:assert/strict';
import {
  completeEducationIntroduction,
  dismissEducationHint,
  educationRoleForMode,
  freshMobileEducationState,
  hasMultipleEducationModes,
  markEducationLearned,
  mobileEducationStorageKey,
  resetEducationGuidance,
  restoreMobileEducationState,
  shouldOfferEducationHint,
  shouldPresentMobileIntroduction,
  shouldShowEducationMarker,
  visitEducationDestination,
} from '../lib/mobile-education.ts';

const user = (id, role, mode, modes, state) => ({
  id, user_id: id, email: `${id}@dev.invalid`, user_name: `Review ${id}`,
  role, is_coach: role === 'coach', workspace_mode: mode === 'individual' ? 'individual' : 'team',
  available_mobile_modes: modes, mobile_mode: mode, account_state: state,
  can_access_product: true, has_linked_athlete: true, athlete_id: id + 100,
});
const self = user(32, 'coach', 'individual', ['individual'], 'READY_INDIVIDUAL');
const coach = user(3, 'coach', 'coach', ['athlete', 'coach'], 'READY_TEAM_COACH');
const athlete = user(4, 'athlete', 'athlete', ['athlete'], 'READY_ATHLETE');
assert.equal(educationRoleForMode(self, 'individual'), 'individual');
assert.equal(educationRoleForMode(coach, 'coach'), 'coach');
assert.equal(educationRoleForMode(athlete, 'athlete'), 'athlete');
assert.equal(educationRoleForMode({ ...coach, account_state: 'ACTIVATION_REQUIRED' }, 'coach'), null);
assert.equal(educationRoleForMode(coach, 'individual'), null);
assert.equal(educationRoleForMode(athlete, 'coach'), null);
assert.equal(hasMultipleEducationModes(coach), false);
assert.equal(hasMultipleEducationModes({ ...coach, available_mobile_modes: ['athlete', 'coach', 'individual'] }), true);
assert.notEqual(mobileEducationStorageKey(self), mobileEducationStorageKey(coach));
assert.equal(mobileEducationStorageKey({ ...self, id: null, user_id: null }), null);

const fresh = freshMobileEducationState();
const firstLaunch = { authReady: true, role: 'individual', storageKey: mobileEducationStorageKey(self), loadedKey: mobileEducationStorageKey(self), onReadyHome: true, state: fresh };
assert.equal(shouldPresentMobileIntroduction(firstLaunch), true);
assert.equal(shouldPresentMobileIntroduction({ ...firstLaunch, storageKey: null, loadedKey: null }), false);
assert.equal(shouldPresentMobileIntroduction({ ...firstLaunch, onReadyHome: false }), false);
assert.equal(shouldPresentMobileIntroduction({ ...firstLaunch, loadedKey: 'another-user' }), false);
assert.equal(fresh.introductionComplete, false);
assert.equal(shouldOfferEducationHint(fresh, 'individual', 'active-session-edit'), false);
const finished = completeEducationIntroduction(fresh);
assert.equal(completeEducationIntroduction(finished), finished);
assert.equal(shouldPresentMobileIntroduction({ ...firstLaunch, state: finished }), false);
assert.equal(shouldOfferEducationHint(finished, 'individual', 'active-session-edit'), true);
assert.equal(shouldOfferEducationHint(finished, 'coach', 'active-session-edit'), false);
assert.equal(shouldOfferEducationHint(finished, 'coach', 'athlete-workspace'), true);
assert.equal(shouldOfferEducationHint(finished, 'athlete', 'movement-history'), true);
assert.equal(shouldOfferEducationHint(finished, 'coach', 'movement-history'), false);
assert.equal(shouldShowEducationMarker(finished, 'individual', 'ledger'), true);
assert.equal(shouldShowEducationMarker(finished, 'coach', 'review-hub'), true);
assert.equal(shouldShowEducationMarker(finished, 'athlete', 'review-hub'), false);
assert.equal(shouldShowEducationMarker(visitEducationDestination(finished, 'ledger'), 'individual', 'ledger'), false);

const discoveredBeforeHint = markEducationLearned(finished, 'active-session-edit');
assert.equal(shouldOfferEducationHint(discoveredBeforeHint, 'individual', 'active-session-edit'), false);
const dismissed = dismissEducationHint(finished, 'athlete-workspace');
assert.equal(shouldOfferEducationHint(dismissed, 'coach', 'athlete-workspace'), false);
const off = { ...finished, guidanceEnabled: false };
assert.equal(shouldOfferEducationHint(off, 'athlete', 'movement-history'), false);
assert.equal(shouldOfferEducationHint({ ...off, guidanceEnabled: true }, 'athlete', 'movement-history'), true);
assert.equal(shouldOfferEducationHint(resetEducationGuidance(dismissed), 'coach', 'athlete-workspace'), true);
assert.equal(resetEducationGuidance(discoveredBeforeHint).introductionComplete, true);
assert.deepEqual(restoreMobileEducationState(JSON.stringify(discoveredBeforeHint)), discoveredBeforeHint);
assert.deepEqual(restoreMobileEducationState('{bad'), fresh);
assert.deepEqual(restoreMobileEducationState(JSON.stringify({ ...finished, campaign: 'mobile-4.0' })), fresh);

console.log('Mobile 3.0 education state, roles, discovery, and persistence: PASS');
