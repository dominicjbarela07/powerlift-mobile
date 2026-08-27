#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  IDLE_SESSION_WORKSPACE_PREVIEW_HANDOFF,
  beginSessionWorkspacePreview,
  beginSessionWorkspaceRestoration,
  completeSessionWorkspaceDismissal,
  completeSessionWorkspaceRestoration,
  sessionWorkspacePreviewFallbackParams,
  sessionWorkspacePreviewRouteParams,
} from '../lib/session-workspace-preview-handoff.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const programming = fs.readFileSync(path.join(root, 'app/(tabs)/workout/index.tsx'), 'utf8');
const workspaceRoute = fs.readFileSync(path.join(root, 'app/(tabs)/workout/session-workspace/[workoutId].tsx'), 'utf8');
const workspace = fs.readFileSync(path.join(root, 'components/coach-mobile/SessionEditingWorkspace.tsx'), 'utf8');
const logger = fs.readFileSync(path.join(root, 'app/(tabs)/workout/[workoutId].tsx'), 'utf8');
const sheet = fs.readFileSync(path.join(root, 'components/sheets/StrengthLedgerBottomSheet.tsx'), 'utf8');

const teamContext = {
  workoutId: 321,
  athleteId: 45,
  programId: 67,
  blockId: 89,
  week: 5,
  day: '2026-08-25',
  section: 'accessories',
  workspaceMode: 'team',
};

let handoff = beginSessionWorkspacePreview(teamContext);
assert.equal(handoff.phase, 'dismissing');
assert.deepEqual(handoff.context, teamContext, 'stable return context is captured before sheet dismissal');
handoff = completeSessionWorkspaceDismissal(handoff);
assert.equal(handoff.phase, 'previewing', 'preview does not launch before dismissal completion');
assert.deepEqual(sessionWorkspacePreviewRouteParams(teamContext), {
  workoutId: '321',
  athleteView: 'coach-preview',
  returnTo: 'programming-workspace-preview',
  returnSection: 'accessories',
  coachWorkspaceMode: 'team',
  coachAthleteId: '45',
  coachProgramId: '67',
  coachProgrammingBlockId: '89',
  coachProgrammingWeek: '5',
  coachProgrammingDay: '2026-08-25',
});
handoff = beginSessionWorkspaceRestoration(handoff);
assert.equal(handoff.phase, 'restoring');
assert.deepEqual(handoff.context, teamContext, 'return restores the exact original Session context');
handoff = completeSessionWorkspaceRestoration(handoff);
assert.deepEqual(handoff, IDLE_SESSION_WORKSPACE_PREVIEW_HANDOFF);

for (let cycle = 0; cycle < 3; cycle += 1) {
  handoff = completeSessionWorkspaceRestoration(
    beginSessionWorkspaceRestoration(
      completeSessionWorkspaceDismissal(beginSessionWorkspacePreview(teamContext)),
    ),
  );
  assert.equal(handoff.phase, 'idle', `preview cycle ${cycle + 1} ends with one reusable Workspace`);
}

const selfContext = { ...teamContext, athleteId: 9, workspaceMode: 'self' };
assert.equal(sessionWorkspacePreviewRouteParams(selfContext).coachWorkspaceMode, 'self');
assert.ok(!('athleteId' in sessionWorkspacePreviewFallbackParams(selfContext)), 'self-coach fallback does not become a team-coach route');
assert.equal(sessionWorkspacePreviewFallbackParams(teamContext).athleteId, '45', 'team-coach fallback retains the governed athlete identity');

assert.match(programming, /requestWorkspaceAthletePreview[\s\S]*beginSessionWorkspacePreview[\s\S]*workspaceSheetRef\.current\?\.dismiss\(\)/, 'Programming Manager owns the dismiss-first preview request');
assert.match(programming, /finishWorkspaceDismiss[\s\S]*completeSessionWorkspaceDismissal[\s\S]*router\.push/, 'Athlete View launches only from the sheet dismissal completion');
assert.match(programming, /previewRouteHasBlurredRef[\s\S]*programmingFocused[\s\S]*beginSessionWorkspaceRestoration[\s\S]*setWorkspaceSheetVisible\(true\)/, 'return waits for a real route blur/focus cycle before restoring the sheet');
assert.match(programming, /onPresent=\{finishWorkspacePresent\}/, 'sheet restoration completes from the canonical presentation callback');
assert.match(programming, /visible=\{workspaceSheetVisible\}/, 'the retained Workspace is not visible beneath Athlete View');
assert.match(programming, /onOpenAthleteView=\{requestWorkspaceAthletePreview\}/, 'embedded Workspace delegates the handoff to its sheet owner');
assert.match(workspaceRoute, /if \(props\.onOpenAthleteView\)[\s\S]*props\.onOpenAthleteView\(\{ section: activeSection \}\)[\s\S]*return;/, 'embedded Workspace delegates its exact section and cannot imperatively route underneath its modal owner');
assert.match(workspace, /const resolveDirty[\s\S]*Save or discard the current Session changes before continuing/, 'dirty state is explicitly resolved before persisted-state preview');
assert.match(workspace, /canAthleteView \? <ToolkitAction[\s\S]*label="Athlete View"/, 'dirty Workspace still exposes Athlete View through the existing save/discard guard');
assert.match(logger, /returnTo === 'programming-workspace-preview'[\s\S]*router\.canGoBack\(\)[\s\S]*router\.back\(\)/, 'preview close and back return to the retained Programming Manager route');
assert.match(logger, /sessionWorkspacePreviewFallbackParams/, 'a stable-ID fallback reconstructs the exact Workspace if the retained route is unavailable');
assert.match(sheet, /onPresent\?: \(\) => void/, 'the sheet exposes deterministic presentation completion without a timeout');
assert.doesNotMatch(programming, /setTimeout\([^)]*Athlete|setTimeout\([^)]*Preview/i, 'handoff never relies on an arbitrary timer');

console.log('[session-workspace-athlete-preview-handoff] dismiss-preview-restore choreography verified');
