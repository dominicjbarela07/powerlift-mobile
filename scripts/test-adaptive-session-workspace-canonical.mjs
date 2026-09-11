#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = [path.resolve(root, '..'), path.resolve(root, '..', '..')]
  .find((candidate) => fs.existsSync(path.join(candidate, 'app', 'blueprints', 'workouts.py')));
if (!repoRoot) throw new Error('Could not locate the Strength Ledger backend root.');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');
const requireMatch = (source, pattern, message) => {
  if (!pattern.test(source)) throw new Error(message);
};
const requireNoMatch = (source, pattern, message) => {
  if (pattern.test(source)) throw new Error(message);
};

const bootstrap = read('app', '(tabs)', 'create-workout.tsx');
const workspaceRoute = read('app', '(tabs)', 'workout', 'session-workspace', '[workoutId].tsx');
const workspace = read('components', 'coach-mobile', 'SessionEditingWorkspace.tsx');
const tabLayout = read('app', '(tabs)', '_layout.tsx');
const calendar = read('app', '(tabs)', 'coach-calendar.tsx');
const detail = read('app', '(tabs)', 'workout', '[workoutId].tsx');
const backend = fs.readFileSync(path.join(repoRoot, 'app', 'blueprints', 'workouts.py'), 'utf8');

for (const retired of [
  ['components', 'creator', 'core-movement-card.tsx'],
  ['components', 'creator', 'accessory-movement-card.tsx'],
  ['components', 'creator', 'creator-controls.tsx'],
  ['components', 'creator', 'index.ts'],
]) {
  if (fs.existsSync(path.join(root, ...retired))) throw new Error(`retired creator surface still exists: ${retired.join('/')}`);
}

requireMatch(bootstrap, /status: 'draft'[\s\S]*core_items: \[\][\s\S]*acc_items: \[\]/, 'Session creation must begin as a minimal server-backed draft.');
requireMatch(bootstrap, /apply-template[\s\S]*session-workspace/, 'template creation must finish inside the Adaptive Session Workspace.');
requireNoMatch(workspaceRoute, /SessionSetupModal|SessionTemplateModal|Session Setup/, 'the retired Session Setup surface must not remain in the Adaptive Session Workspace.');
requireNoMatch(workspace, /onOpenFullEditor/, 'the active Editor segment must not reopen the retired Session Setup surface.');
requireMatch(workspaceRoute, /athleteAvatarUrl=\{payload\?\.athlete\?\.avatar_url \|\| null\}/, 'the Session header must receive the assigned athlete avatar.');
requireMatch(workspace, /authorStyles.identity[\s\S]*authorStyles.note[\s\S]*InlineSessionReorder[\s\S]*InlineMovementWorkspace/, 'focused metadata leads directly to the editable movement composition');
requireMatch(workspace, /entryMode !== 'self'/, 'self authoring omits duplicate athlete identity');
requireMatch(workspace, /authorStyles.toolbar[\s\S]*Preview saved Session[\s\S]*sessionDirty \? saveLabel/, 'Add, saved preview and explicit draft save stay available');
requireMatch(workspace, /viewportWidth < 360 \|\| fontScale >= 1\.3/, 'narrow phones and Dynamic Type retain reflow');
requireMatch(workspace, /setSessionEditorOverlayOpen\(true\)[\s\S]*setSessionEditorOverlayOpen\(false\)/, 'focus suspends competing navigation for its mounted lifetime');
requireMatch(workspace, /function MovementArtwork[\s\S]*core_movement: item.core_movement[\s\S]*<CanonicalMovementArtwork/, 'every movement uses its governed identity for shared artwork');
requireNoMatch(workspace, /<MuscleMap/, 'an individual movement never becomes aggregate anatomy');
requireNoMatch(workspaceRoute, /preferred_units: plan\.metadataPatch\.displayUnit/, 'presentation-only units never persist through Session setup');
requireMatch(backend, /if "preferred_units" in data:[\s\S]*next_athlete\.preferred_units/, 'the setup mutation must persist the athlete unit preference.');
requireMatch(workspaceRoute, /movement_definition_id: movementDefinitionId/, 'accessory equipment identity must persist through the canonical identity contract.');
requireMatch(workspaceRoute, /isCoreVariantSelection = setup\.lift === 'VR'[\s\S]*target_low_lb[\s\S]*target_high_lb/, 'every Core variant must persist an explicit coach-authored load range.');
requireMatch(workspace, /function createSessionWorkspaceDraft[\s\S]*linkedBackdown[\s\S]*movementDraftFromItem\(item, storageUnit, linkedBackdown\)/, 'existing movements must enter the canonical Session draft with linked backdown data in a fixed internal storage unit.');
requireMatch(tabLayout, /sceneStyle: styles\.tabScene[\s\S]*tabScene: \{[^}]*paddingTop: 0[^}]*\}/, 'the tab shell must provide the Session Workspace with a route-owned full-width canvas.');
requireNoMatch(tabLayout, /tabScene: \{[^}]*paddingHorizontal/, 'the Session Workspace must not inherit an additional shell gutter around its route-owned layout.');
requireMatch(workspace, /function FullCustomSetEditor/, 'Full Custom per-set prescriptions must remain editable in the inline movement workspace.');
requireMatch(workspace, /function InlineMovementWorkspace[\s\S]*styles\.expandedMovementHeader[\s\S]*<MovementQuickPrescriptionEditor/, 'the expanded prescription editor must remain physically attached to its movement card.');
requireMatch(workspace, /function InlineMovementWorkspace[\s\S]*<MovementQuickPrescriptionEditor[\s\S]*<RecentHistorySection[\s\S]*<CoachNotesSection[\s\S]*<MovementDeleteAction/, 'all movement-specific content must remain contained by the expanded movement card.');
requireNoMatch(workspace, /supportingMovementTools|MovementQuickActions|Quick Actions/, 'movement-specific content and obsolete Quick Actions must not render outside the expanded card.');
requireNoMatch(workspace, /styles\.lifecycleArea|styles\.lifecycleLabel/, 'the inline Session Actions block must not render outside the floating toolkit.');
requireNoMatch(workspace, /PlateVisualizationSection|Plate Visualization|LoggerPlateStackVisual|resolveLoggerPlateStackForDisplayWeight/, 'the rejected Plate Visualization section must not exist in the Session Workspace.');
requireNoMatch(workspace, /MovementSheetSnap|styles\.backdrop|styles\.sheet(?:[,\]])/, 'the movement editor must not return to a sheet or detached route surface.');
requireMatch(workspace, /function SessionCompactIdentity[\s\S]*<SLProfileAvatar[\s\S]*profilePhotoUrl=\{athleteAvatarUrl\}/, 'the Session header must render the assigned athlete avatar instead of movement artwork.');
requireMatch(workspace, /Unsaved Session changes/, 'navigation must use the unified semantic dirty-state guard.');
requireMatch(calendar, /pathname: '\/workout\/session-workspace\/\[workoutId\]'/, 'calendar edits must route directly to the canonical workspace.');
requireMatch(detail, /pathname: '\/workout\/session-workspace\/\[workoutId\]'/, 'Session detail edits must route directly to the canonical workspace.');
requireMatch(backend, /def mobile_update_session_workspace_setup/, 'the canonical setup mutation endpoint is missing.');
requireMatch(backend, /def mobile_apply_template_to_session_workspace/, 'the canonical template replacement endpoint is missing.');
requireMatch(backend, /scheme == "TOP_BACKDOWN"[\s\S]*parent_item_id=item\.id/, 'Top + backdown creation must produce a linked canonical pair.');

console.log('[adaptive-session-workspace-canonical] ok');
