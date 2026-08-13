import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const read = (path) => readFileSync(join(root, path), 'utf8');
const theme = read('constants/theme.ts');
const rolesSource = theme.slice(
  theme.indexOf('export const SLTypographyRoles'),
  theme.indexOf('export function getSLDeviceTypographySize'),
);

const rolePattern = /\n  ([A-Za-z0-9_]+): \{([\s\S]*?)\n  \},/g;
let roleCount = 0;
for (const match of rolesSource.matchAll(rolePattern)) {
  const role = match[1];
  const sizes = match[2].match(/fontSize: \{ compact: ([\d.]+), standard: ([\d.]+), large: ([\d.]+) \}/);
  if (!sizes) continue;
  roleCount += 1;
  for (const [device, value] of [['compact', sizes[1]], ['standard', sizes[2]], ['large', sizes[3]]]) {
    assert.ok(Number(value) >= 12, `${role}.${device} is below the 12 pt mobile minimum: ${value}`);
  }
}
assert.ok(roleCount >= 40, 'canonical typography roles were not fully audited');

const auditedFiles = [
  'components/coach-mobile/SessionEditingWorkspace.tsx',
  'app/(tabs)/workout/session-workspace/[workoutId].tsx',
  'components/ui/sl-button.tsx',
  'components/ui/sl-status-pill.tsx',
  'components/ui/coach-action-grid.tsx',
  'components/ui/coach-metric-strip.tsx',
];

for (const file of auditedFiles) {
  const source = read(file);
  for (const match of source.matchAll(/fontSize:\s*([\d.]+)/g)) {
    assert.ok(Number(match[1]) >= 12, `${file} contains meaningful text below 12 pt: ${match[1]}`);
  }
  assert.doesNotMatch(source, /allowFontScaling=\{false\}/, `${file} disables Dynamic Type`);
}

const workspace = read('components/coach-mobile/SessionEditingWorkspace.tsx');
const button = read('components/ui/sl-button.tsx');
for (const match of button.matchAll(/(?:sm|md|lg): \{ minHeight: (\d+)/g)) {
  assert.ok(Number(match[1]) >= 44, `shared button touch target is below 44 pt: ${match[1]}`);
}
assert.equal([...button.matchAll(/(?:sm|md|lg): \{ minHeight: (\d+)/g)].length, 3, 'all shared button sizes must define a minimum touch target');
assert.doesNotMatch(workspace, /adjustsFontSizeToFit|minimumFontScale/, 'workspace text must wrap instead of shrinking');
assert.doesNotMatch(button, /adjustsFontSizeToFit|minimumFontScale/, 'shared buttons must wrap instead of shrinking');
assert.doesNotMatch(button, /\bheight: sizing\./, 'shared buttons must grow vertically with Dynamic Type');
assert.match(workspace, /<Text style=\{styles\.identityTitle\}>\{title\}<\/Text>/, 'long Session titles must remain fully visible');
assert.doesNotMatch(workspace, /<Text numberOfLines=\{\d+\} style=\{styles\.identityTitle\}>/, 'Session titles must not have a fixed line limit');
assert.match(workspace, /typographyRole="movementTitle" numberOfLines=\{2\}/, 'long movement names must use the two-line movement role');
assert.match(workspace, /<Text numberOfLines=\{1\} style=\{\[styles\.sessionNotesText/, 'collapsed Session notes must use intentional low-priority truncation');
assert.match(workspace, /sessionToolkitActionText[\s\S]*\{label\}/, 'Session toolkit actions must render their visible labels');
assert.match(read('app/(tabs)/workout/session-workspace/[workoutId].tsx'), /styles\.sessionActionText[\s\S]*\{action\.label\}/, 'Session management actions must render their visible labels');

console.log(`[mobile-typography-minimum] ${roleCount} semantic roles and ${auditedFiles.length} mobile surfaces satisfy the 12 pt minimum`);
