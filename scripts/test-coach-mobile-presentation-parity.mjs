import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repositoryRoot = path.resolve(root, '..');

async function source(relativePath, base = root) {
  return readFile(path.join(base, relativePath), 'utf8');
}

const [
  shell,
  roster,
  workspace,
  brief,
  sharedMaterial,
  mockMaterial,
  coachLaw,
  athleteLaw,
] = await Promise.all([
  source('app/(tabs)/_layout.tsx'),
  source('app/(tabs)/coach-roster.tsx'),
  source('app/(tabs)/coach-athlete/[athleteId].tsx'),
  source('app/coach-team-brief.tsx'),
  source('components/coach-mobile/coach-material-layer.tsx'),
  source('dev-mocks/coach-roster-first/material.tsx'),
  source('docs/coach-mobile-refresh.md', repositoryRoot),
  source('docs/athlete-mobile-design-law.md', repositoryRoot),
]);

assert.match(shell, /tabScene:[\s\S]*paddingHorizontal: SLLayout\.screenGutter/);
assert.doesNotMatch(roster, /content:\s*\{[^}]*paddingHorizontal/s);
assert.doesNotMatch(brief, /content:\s*\{[^}]*paddingHorizontal/s);
assert.doesNotMatch(workspace, /scrollContent:\s*\{[^}]*paddingHorizontal/s);
assert.doesNotMatch(workspace, /header:\s*\{[^}]*paddingLeft/s);

for (const liveScreen of [roster, workspace, brief]) {
  assert.match(liveScreen, /@\/components\/coach-mobile\/coach-material-layer/);
  assert.doesNotMatch(liveScreen, /dev-mocks|fixture|scenario reducer/i);
}

assert.match(sharedMaterial, /export function CoachMaterialLayer/);
assert.match(mockMaterial, /from '@\/components\/coach-mobile\/coach-material-layer'/);

assert.match(roster, /attention_cap/);
assert.match(roster, /matchingAttentionAthletes\.slice\(/);
assert.match(roster, /: attentionCap/);
assert.match(roster, /Needs Attention/);
assert.match(roster, /Remaining Athletes/);
assert.match(roster, /filtered\.filter\(\(athlete\) => !workingSetIds\.has\(athlete\.id\)\)/);
assert.match(roster, /greetingForTimezone/);
assert.match(roster, /getResolvedTimezone/);
assert.match(roster, /user\?\.profilePhotoUrl/);
assert.match(roster, /\{coachGreeting\}, \{coachFirstName\}/);
assert.match(roster, /accessibilityLabel="Add athlete"/);
assert.match(roster, />Add Athlete<\/Text>/);
assert.doesNotMatch(roster, />Team Brief<\/Text>/);
assert.match(roster, /pending_video_reviews/);
assert.match(roster, /unread_messages/);
assert.match(roster, /athleteRow:[\s\S]*paddingHorizontal:/);
assert.match(roster, /anchorY/);
assert.doesNotMatch(roster, /modalBackdrop:[^\n]*justifyContent: 'center'/);
assert.match(roster, /Open athlete workspace/);
assert.match(roster, /Open programming/);
assert.match(roster, /Open next Session/);
assert.match(roster, /label="Add note"/);
assert.match(roster, /fetchJson\('\/coach-utility-dock\/notes'/);
assert.match(roster, /Send check-in/);
assert.match(roster, /useSLReducedMotion/);
assert.match(roster, /animationType=\{reduceMotion \? 'none' : 'fade'\}/);
assert.match(roster, /accessibilityViewIsModal/);
assert.match(roster, /accessibilityActions=/);

assert.match(workspace, /CurrentTrainingContext/);
assert.match(workspace, /Current Training/);
assert.match(workspace, /Week \$\{training\.week_position\} of \$\{training\.week_total\}/);
assert.match(workspace, /Day \$\{training\.session_position\} of \$\{training\.session_total\}/);
assert.match(workspace, /style=\{styles\.commandHero\}/);
assert.match(workspace, /size=\{72\}/);
assert.match(workspace, /Coaching Workspace/);
assert.doesNotMatch(workspace, /<SLStatusPill/);
assert.doesNotMatch(workspace, /style=\{styles\.heroSurface\}/);
assert.match(workspace, /Coaching Tools/);
assert.match(workspace, /Return to Roster/);
for (const label of [
  'Message',
  'Reviews',
  'Program',
  'Notes',
  'Calendar',
  'History',
  'Check-in',
  'More',
]) {
  assert.match(workspace, new RegExp(`label: '${label}'`));
}
assert.match(workspace, /commandHero:[\s\S]*minHeight: 112/);
assert.match(workspace, /commandTool:[\s\S]*minHeight: 58/);

const contextStart = workspace.indexOf('<CurrentTrainingContext');
const readiness = workspace.indexOf('icon="pulse-outline"', contextStart);
const lastSession = workspace.indexOf('Last Training Session', contextStart);
const nextSession = workspace.indexOf('Upcoming Training Session', contextStart);
const coachContext = workspace.indexOf('Coach Context', contextStart);
assert.ok(
  contextStart >= 0
    && readiness > contextStart
    && lastSession > readiness
    && nextSession > lastSession
    && coachContext > nextSession,
  'Athlete Context hierarchy must remain Current Training → Readiness → Last Session → Upcoming Session → Coach Context.',
);

assert.match(brief, /Needs Attention/);
assert.match(brief, /Coming Up/);
assert.match(brief, /Team Health/);
assert.match(brief, /Blind Spots/);
assert.match(brief, /updatedLabel/);
assert.match(brief, /item\.headline/);
assert.match(brief, /item\.supporting_line/);
assert.match(brief, /item\.action_label/);
assert.match(brief, /item:[\s\S]*padding:/);

const briefNeeds = brief.indexOf("title=\"Needs Attention\"");
const briefComingUp = brief.indexOf("title=\"Coming Up\"");
const briefHealth = brief.indexOf('Team Health');
const briefBlindSpots = brief.indexOf("title=\"Blind Spots\"");
assert.ok(
  briefNeeds >= 0
    && briefComingUp > briefNeeds
    && briefHealth > briefComingUp
    && briefBlindSpots > briefHealth,
  'Team Brief hierarchy must remain Needs Attention → Coming Up → Team Health → Blind Spots.',
);

assert.match(coachLaw, /exactly one horizontal gutter owner/i);
assert.match(coachLaw, /must never be active at the same time/i);
assert.match(athleteLaw, /horizontal page gutter from the[\s\S]*shared shell exactly once/i);

console.log('Coach mobile presentation parity checks passed.');
