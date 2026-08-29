import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  SETTINGS_CAPABILITY_CLASSIFICATION,
  personalTrainingProfileHeaders,
  resolvePersonalTrainingProfileMode,
  resolveSettingsIdentityName,
} from '../lib/settings-account-parity.ts';

const root = resolve(import.meta.dirname, '..');
const settings = readFileSync(resolve(root, 'app/(tabs)/settings.tsx'), 'utf8');

assert.equal(
  resolveSettingsIdentityName({
    personalProfileName: 'Dominic Barela',
    accountName: 'Account Name',
    email: 'dominic@example.com',
  }),
  'Dominic Barela',
  'the signed-in human must keep the canonical personal profile name across product lenses',
);
assert.equal(
  resolveSettingsIdentityName({ accountName: 'Coach Only', email: 'coach@example.com' }),
  'Coach Only',
  'a coach-only account must use user_name before email',
);
assert.equal(
  resolveSettingsIdentityName({ email: 'fallback@example.com' }),
  'fallback@example.com',
  'email is only a last-resort identity fallback',
);

assert.equal(
  resolvePersonalTrainingProfileMode({ activeMode: 'coach', availableModes: ['athlete', 'coach'] }),
  'athlete',
  'a dual-role coach must retain access to their own athlete profile',
);
assert.equal(
  resolvePersonalTrainingProfileMode({ activeMode: 'coach', availableModes: ['coach'] }),
  null,
  'a coach-only account must not receive fabricated personal-athlete settings',
);
assert.equal(
  resolvePersonalTrainingProfileMode({ activeMode: 'athlete', availableModes: ['athlete'] }),
  'athlete',
  'athlete-only Settings behavior must remain athlete-scoped',
);
assert.equal(
  resolvePersonalTrainingProfileMode({ activeMode: 'individual', availableModes: ['individual'] }),
  'individual',
  'self-coached Settings behavior must remain individual-scoped',
);
assert.deepEqual(
  personalTrainingProfileHeaders('athlete'),
  { 'X-Strength-Ledger-Mobile-Mode': 'athlete' },
  'the personal-profile request must use the authoritative mobile-mode header',
);
assert.equal(personalTrainingProfileHeaders(null), undefined);

assert.ok(SETTINGS_CAPABILITY_CLASSIFICATION.sharedAccount.includes('identity'));
assert.ok(SETTINGS_CAPABILITY_CLASSIFICATION.personalAthlete.includes('training_maxes'));
assert.ok(SETTINGS_CAPABILITY_CLASSIFICATION.coachOperational.includes('video_submission_notifications'));
assert.ok(SETTINGS_CAPABILITY_CLASSIFICATION.modeNavigation.includes('mobile_mode'));

assert.match(settings, /accountName: auth\?\.user\?\.user_name/, 'Settings must consume the canonical account name field');
assert.match(
  settings,
  /if \(!json\.training_profile && personalTrainingProfileMode && personalTrainingProfileMode !== activeMobileMode\)[\s\S]*?headers: personalProfileHeaders/,
  'Coach mode must fetch only the signed-in user personal athlete profile when that capability exists',
);
assert.match(settings, /settingsLoadGenerationRef\.current !== generation/, 'stale mode-scoped Settings responses must be discarded');
assert.match(settings, /trainingProfile \? settingsGroup\([\s\S]*?activeMobileMode === 'coach' \? 'Personal Training' : 'Training'/, 'dual-role personal athlete settings must be clearly scoped in Coach mode');
assert.match(settings, /const showLinkCoachEntry = !isIndividual && !!linkCoachStatus\?\.athlete/, 'Connected Coach must require the signed-in user personal athlete relationship');
assert.match(settings, /setLinkCoachStatus\(personalProfilePayload\.link_coach \|\| null\)/, 'Coach mode must use the signed-in user personal athlete relationship rather than the coach workspace roster');
assert.match(settings, /onPress=\{hasTrainingProfile \? \(\) => openProfileEditor\('details'\) : handleUpdateAvatar\}/, 'account profile/photo management must remain reachable in every mode');

for (const mutation of ['saveProfileDetails', 'savePreferredUnits', 'saveTrainingMaxes', 'saveTrainingContext', 'saveTimezone']) {
  const start = settings.indexOf(`const ${mutation}`);
  assert.ok(start >= 0, `${mutation} must exist`);
  const next = settings.indexOf('\n  const ', start + 1);
  const source = settings.slice(start, next >= 0 ? next : undefined);
  assert.match(source, /headers: personalProfileHeaders/, `${mutation} must target the signed-in user's personal athlete scope`);
}

const notificationsStart = settings.indexOf('const saveNotificationPreference');
const notificationsEnd = settings.indexOf('const saveVideoMlTrainingConsent', notificationsStart);
assert.doesNotMatch(
  settings.slice(notificationsStart, notificationsEnd),
  /personalProfileHeaders/,
  'coach-operational notification settings must remain in the active Coach lens',
);

console.log('[settings-account-parity] PASS — identity and account controls remain stable while personal-athlete and coach-operational settings stay correctly scoped');
