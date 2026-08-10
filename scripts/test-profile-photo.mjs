import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  normalizeProfilePhotoPayload,
  profilePhotoCacheKey,
  profilePhotoNeedsAuth,
  resolveProfilePhotoUrl,
  versionProfilePhotoUrl,
} from '../lib/profile-photo.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const apiBase = 'https://api.strengthledger.test';

const snakeCase = normalizeProfilePhotoPayload({
  avatar_url: '/static/uploads/athlete photo.jpg',
  avatar_uploaded_at: '2026-07-22T12:00:00',
});
assert.equal(snakeCase.profilePhotoUrl, '/static/uploads/athlete photo.jpg');
assert.equal(snakeCase.profilePhotoVersion, '2026-07-22T12:00:00');
assert.equal(snakeCase.hasProfilePhotoValue, true);

const camelCase = normalizeProfilePhotoPayload({
  profilePhotoUrl: 'https://cdn.example.test/a.jpg',
  profilePhotoVersion: 'v2',
});
assert.equal(camelCase.profilePhotoUrl, 'https://cdn.example.test/a.jpg');
assert.equal(camelCase.profilePhotoVersion, 'v2');

const absent = normalizeProfilePhotoPayload({ name: 'No Photo' });
assert.equal(absent.hasProfilePhotoValue, false);
assert.equal(absent.profilePhotoUrl, null);

const deleted = normalizeProfilePhotoPayload({ avatar_url: null, avatar_uploaded_at: null });
assert.equal(deleted.hasProfilePhotoValue, true);
assert.equal(deleted.profilePhotoUrl, null);
assert.equal(deleted.profilePhotoVersion, null);

const mixedAliases = normalizeProfilePhotoPayload({
  profilePhotoUrl: null,
  profilePhotoVersion: '',
  avatar_url: '/static/uploads/canonical-athlete.jpg',
  avatar_uploaded_at: '2026-08-09T16:00:00',
});
assert.equal(mixedAliases.hasProfilePhotoValue, true);
assert.equal(mixedAliases.profilePhotoUrl, '/static/uploads/canonical-athlete.jpg');
assert.equal(mixedAliases.profilePhotoVersion, '2026-08-09T16:00:00');

assert.equal(
  resolveProfilePhotoUrl('/static/uploads/athlete photo.jpg', apiBase),
  'https://api.strengthledger.test/static/uploads/athlete%20photo.jpg'
);
assert.equal(
  resolveProfilePhotoUrl('https://cdn.example.test/athlete photo.jpg', apiBase),
  'https://cdn.example.test/athlete%20photo.jpg'
);
assert.equal(
  resolveProfilePhotoUrl('//cdn.example.test/athlete.jpg', apiBase),
  'https://cdn.example.test/athlete.jpg'
);
assert.equal(resolveProfilePhotoUrl('file:///private/avatar.jpg', apiBase), null);

assert.equal(
  versionProfilePhotoUrl('/avatar.jpg?size=large', 'replacement-2', apiBase),
  'https://api.strengthledger.test/avatar.jpg?size=large&sl_avatar_v=replacement-2'
);

const signedAvatar =
  'https://r2.example.test/avatars/users/7/avatar.webp?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=credential%2Fscope&X-Amz-Date=20260809T230000Z&X-Amz-Expires=3600&X-Amz-Signature=signature';
assert.equal(resolveProfilePhotoUrl(signedAvatar, apiBase), signedAvatar);
assert.equal(versionProfilePhotoUrl(signedAvatar, 'replacement-3', apiBase), signedAvatar);
assert.equal(
  profilePhotoCacheKey(signedAvatar, 'replacement-3', apiBase),
  'https://r2.example.test/avatars/users/7/avatar.webp#sl_avatar_v=replacement-3'
);
assert.equal(
  profilePhotoCacheKey('/avatar.jpg', 'replacement-2', apiBase),
  'https://api.strengthledger.test/avatar.jpg#sl_avatar_v=replacement-2'
);
assert.equal(profilePhotoNeedsAuth('/avatar.jpg', apiBase), true);
assert.equal(profilePhotoNeedsAuth('https://cdn.example.test/avatar.jpg', apiBase), false);

const sharedAvatarSource = fs.readFileSync(
  path.join(root, 'components/ui/sl-profile-avatar.tsx'),
  'utf8'
);
assert.match(sharedAvatarSource, /cachePolicy="memory-disk"/);
assert.match(sharedAvatarSource, /Authorization: `Bearer \$\{token\}`/);
assert.match(sharedAvatarSource, /onError=\{\(\) =>/);
assert.match(sharedAvatarSource, /profilePhotoVersion/);
assert.match(sharedAvatarSource, /cacheKey: cacheKey \|\| undefined/);

for (const source of [
  'app/(tabs)/settings.tsx',
  'components/home/TodayHomeExperience.tsx',
  'components/training-hub/AthleteTrainingHubExperience.tsx',
  'app/(tabs)/messages/index.tsx',
  'app/(tabs)/messages/[threadId].tsx',
  'app/(tabs)/coach-roster.tsx',
  'app/(tabs)/coach-athlete/[athleteId].tsx',
  'app/(tabs)/create-workout.tsx',
  'app/(tabs)/workout/index.tsx',
  'app/(tabs)/workout/[workoutId].tsx',
  'components/coach-mobile/SessionEditingWorkspace.tsx',
  'components/workout-logger/core-loggers.tsx',
  'components/workout-logger/post-session-surfaces.tsx',
]) {
  const contents = fs.readFileSync(path.join(root, source), 'utf8');
  assert.match(
    contents,
    /SLProfileAvatar|SLAthleteAvatar/,
    `${source} must use the shared avatar implementation`
  );
}

const settingsSource = fs.readFileSync(path.join(root, 'app/(tabs)/settings.tsx'), 'utf8');
assert.match(settingsSource, /updateProfilePhoto\(payload\)/);
assert.match(settingsSource, /method: 'DELETE'/);
assert.match(settingsSource, /useFocusEffect\(/);
assert.match(settingsSource, /void refreshAccountState\?\.\(\)/);

const rosterSource = fs.readFileSync(path.join(root, 'app/(tabs)/coach-roster.tsx'), 'utf8');
assert.match(rosterSource, /const \{ refreshAccountState, user \} = useAuth\(\)/);
assert.match(rosterSource, /\.\.\.normalizeProfilePhotoPayload\(athlete\)/);
assert.match(rosterSource, /void refreshAccountState\(\)/);

const authSource = fs.readFileSync(path.join(root, 'context/AuthContext.tsx'), 'utf8');
assert.match(authSource, /normalizeProfilePhotoPayload\(profileUser\)/);
assert.match(authSource, /SecureStore\.setItemAsync\(USER_KEY, JSON\.stringify\(nextUser\)\)/);
assert.match(authSource, /profilePhotoUrl: profilePhoto\.hasProfilePhotoValue/);
assert.match(authSource, /profilePhotoVersion: profilePhoto\.hasProfilePhotoValue/);

const homeSource = fs.readFileSync(path.join(root, 'app/(tabs)/athlete-dashboard.tsx'), 'utf8');
assert.match(homeSource, /useFocusEffect\(/);
assert.match(
  homeSource,
  /const normalized = normalizeTodayPayload\(classified\.today\);\s*setToday\(normalized\);/
);

const apiSource = fs.readFileSync(path.join(root, 'lib/api.ts'), 'utf8');
assert.match(apiSource, /normalizeMessengerThread/);
assert.match(apiSource, /normalizeCoachRosterAthlete/);

const registryPath = path.join(root, 'dev-mocks/live-screen-registry.ts');
if (fs.existsSync(registryPath)) {
  const registrySource = fs.readFileSync(registryPath, 'utf8');
  for (const id of [
    'avatar-with-photo-preview',
    'avatar-initials-preview',
    'avatar-loading-preview',
    'avatar-failure-preview',
    'settings-profile-photo-preview',
  ]) {
    assert.match(registrySource, new RegExp(`id: '${id}'`));
  }
}

console.log('Canonical mobile profile-photo contract passed.');
