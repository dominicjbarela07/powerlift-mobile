#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';

const route = fs.readFileSync('app/(tabs)/workout/session-workspace/[workoutId].tsx', 'utf8');
const workspace = fs.readFileSync('components/coach-mobile/SessionEditingWorkspace.tsx', 'utf8');

assert.match(
  route,
  /const identityChanged = priorIdentityId > 0 && priorIdentityId !== movementDefinitionId;[\s\S]*movement_identity: replacementIdentity[\s\S]*selected_sub_movement: null[\s\S]*performed_movement_identity: null[\s\S]*performed_canonical_movement_identity: null[\s\S]*approved_sub_identities: \[\][\s\S]*legacy: null/,
  'a changed governed identity must replace every identity-owned field atomically',
);
assert.match(
  workspace,
  /const identityChanged = \([\s\S]*previousIdentityId !== replacementIdentityId[\s\S]*approvedSubsText: ''[\s\S]*approvedSubstitutions: \[\]/,
  'identity-specific approved substitutions must clear from the dirty Session draft',
);
assert.match(
  route,
  /identityChanged \? \{[\s\S]*\} : \{[\s\S]*movement_identity: replacementIdentity/,
  'reselecting the same stable identity must not perform a destructive replacement',
);

console.log('[accessory-setup-replacement] canonical replacement contracts passed');
