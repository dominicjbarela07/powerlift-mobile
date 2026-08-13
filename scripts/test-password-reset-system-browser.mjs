import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const login = readFileSync(resolve(here, '../app/login.tsx'), 'utf8');

assert.match(
  login,
  /const PASSWORD_RESET_URL = 'https:\/\/app\.strengthledger\.fit\/auth\/reset_request';/,
  'Forgot Password must target the canonical production reset-request route.',
);
assert.match(
  login,
  /const openPasswordReset = async \(\) => \{[\s\S]*?Linking\.openURL\(PASSWORD_RESET_URL\);[\s\S]*?\};/,
  'Forgot Password must use the system browser through Linking.openURL.',
);
assert.match(
  login,
  /onPress=\{openPasswordReset\}[\s\S]*?>Forgot password\?<\/Text>/,
  'The Forgot Password control must invoke the system-browser launcher.',
);

const resetLauncher = login.match(
  /const openPasswordReset = async \(\) => \{([\s\S]*?)\n  \};/,
)?.[1] || '';
assert.doesNotMatch(
  resetLauncher,
  /expo-web-browser|openBrowserAsync/,
  'Forgot Password must not use expo-web-browser.',
);

console.log('Password reset system-browser policy passed.');
