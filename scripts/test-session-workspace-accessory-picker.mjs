#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');
const route = read('app', '(tabs)', 'workout', 'session-workspace', '[workoutId].tsx');
const workspace = read('components', 'coach-mobile', 'SessionEditingWorkspace.tsx');
const substitutionPicker = read('components', 'movement', 'GovernedAccessoryPickerModal.tsx');

assert.match(
  workspace,
  /<SessionWorkspacePromptSheet[\s\S]*onAddAccessory=\{\(\) => \{[\s\S]*props\.onAddAccessory\(\(item\) => addSessionDraftMovement\(item, 'accessory'/,
  'the Session Workspace must wire the canonical prompt to the accessory draft flow',
);
assert.match(
  workspace,
  /function SessionWorkspacePromptSheet[\s\S]*label="Accessory" onPress=\{onAddAccessory\}/,
  'the canonical Add Movement prompt must expose a reachable Accessory action',
);
assert.doesNotMatch(workspace, /Alert\.alert\('Add Movement'/, 'Add Movement must not regress to a native Alert menu');
assert.match(
  route,
  /const openAddAccessoryEditor[\s\S]*setAccessoryEditor\(\{[\s\S]*mode: 'add'/,
  'the live route must open the add-accessory editor mode',
);
assert.match(
  route,
  /function AccessoryEditorModal[\s\S]*useState<AccessoryPickerStep>\('discovery'\)[\s\S]*testID="accessory-picker-body"/,
  'the add-accessory modal must mount the staged canonical picker',
);
assert.match(
  route,
  /<AccessoryEditorModal[\s\S]*state=\{accessoryEditor\}[\s\S]*onApply=\{applyAccessorySetup\}[\s\S]*onDone=\{closeAccessoryEditorAfterSuccess\}/,
  'the live Session Workspace must actually render the canonical staged accessory drilldown',
);
assert.doesNotMatch(
  route,
  /GovernedAccessoryPickerModal|GovernedAccessorySubstitutionPickerModal/,
  'the Session Workspace must never mount the compact substitution/library index as Add Accessory',
);
assert.match(
  substitutionPicker,
  /context: 'in-session-substitution'[\s\S]*export function GovernedAccessorySubstitutionPickerModal/,
  'the former flat picker must be explicitly constrained to the in-Session substitution workflow',
);
assert.match(
  route,
  /import \{ SLMotionPressable as Pressable \} from '@\/components\/ui\/sl-motion'/,
  'every drilldown control must inherit canonical tactile press feedback',
);
assert.match(
  route,
  /accessoryEditorCard:\s*\{[\s\S]*height: '100%'[\s\S]*accessoryEditorContent:\s*\{[\s\S]*paddingHorizontal: 0/,
  'the mobile picker must own an edge-to-edge canvas without page-level horizontal padding',
);
assert.match(
  route,
  /new URLSearchParams\([\s\S]*limit: '24'[\s\S]*movement-definitions\/search\?\$\{params\.toString\(\)\}/,
  'picker results must come from bounded canonical backend search',
);
assert.match(route, /movement_presets\?include_accessories=0/, 'workspace bootstrap must not download the complete accessory catalog');
assert.match(route, /primaryMuscleFilter/, 'the canonical picker must support primary-muscle browsing');
assert.match(route, /primary_muscle_group'[\s\S]*include_secondary'[\s\S]*MovementSearchResultGroups/, 'exact muscle browse must request and retain canonical primary and secondary result groups');
assert.match(route, /Primary target ·[\s\S]*secondary\.total_count > 0[\s\S]*Also trains/, 'muscle-scoped results must keep primary targets first and omit an empty secondary section');
assert.match(route, /resultGroup\?: 'primary' \| 'secondary'[\s\S]*params\.set\(`\$\{resultGroup\}_cursor`/, 'primary and secondary result groups must paginate independently');
assert.match(route, /accessoryPickerMovementSecondaryMeta[\s\S]*\+ \{selectedMuscleLabel\}/, 'secondary matches must label the selected muscle without replacing primary-muscle artwork');
assert.match(route, /execution_family[\s\S]*favorites_only[\s\S]*recent_only[\s\S]*custom_only/, 'picker filters must use the shared backend contract');
assert.match(route, /next_cursor[\s\S]*Load More/, 'bounded search must expose backend pagination when more canonical movements are available');
assert.match(route, /movementQuery\.trim\(\) \? 220 : 0/, 'typed searches must be debounced');
assert.match(route, /requestId !== searchRequestRef\.current/, 'stale search responses must be ignored');
assert.match(route, /Loading relevant movements/, 'loading state must be explicit');
assert.match(route, /No matching accessory movements/, 'no-results state must be explicit');
assert.match(route, />Retry</, 'search failure must be recoverable');
assert.match(
  route,
  /movementResultContext\(movement\)[\s\S]*primary_muscle_group[\s\S]*secondary_muscle_groups[\s\S]*execution_family/,
  'result rows must expose governed muscle and execution context',
);
assert.match(route, /What are you trying to train\?[\s\S]*By Muscle[\s\S]*By Movement/, 'discovery must start with muscle-first and direct-search modes');
assert.match(route, /useState<'muscle' \| 'movement'>\('muscle'\)/, 'muscle-guided discovery must be the default instead of a flat All index');
assert.match(route, /selectLibraryMode\('favorites'\)[\s\S]*selectLibraryMode\('recent'\)[\s\S]*selectLibraryMode\('custom'\)/, 'Favorites, Recent, and My Movements must remain deliberate shortcuts');
assert.match(route, /ACCESSORY_PICKER_REGIONS[\s\S]*selectedRegion\.muscles/, 'regional navigation must drill into governed primary-muscle targets');
assert.match(route, /function AnatomyTargetArt[\s\S]*<GovernedMuscleThumbnail[\s\S]*primary=\{primary\}[\s\S]*secondary=\{_secondary\}/, 'muscle discovery must use the shared governed Dynamic Anatomy thumbnail');
assert.doesNotMatch(route, /<MuscleMap/, 'individual movement picker surfaces must never render full-figure anatomy');
assert.match(route, /<CanonicalMovementArtwork[\s\S]*kind: 'accessory'/, 'individual picker results must use the canonical identity artwork component');
assert.match(route, /const confirmMovement[\s\S]*setPickerStep\('review'\)[\s\S]*const confirmAndApplyMovement[\s\S]*await onApply\(selectedSetup\)[\s\S]*setPickerStep\('success'\)/, 'exact movement selection must pass through review, apply, and success states');
assert.match(route, /Confirm & Add to Session[\s\S]*Continue Editing Session/, 'the live picker must provide deliberate confirmation and return-to-Session actions');
assert.match(route, /addAccessoryCompletionRef\.current\([\s\S]*movement_identity:[\s\S]*id: movementDefinitionId/, 'selection must return to the same dirty Session draft with stable governed identity');
assert.match(route, /Can(?:'|&apos;)t find it\? Create custom movement/, 'the coach-owned custom movement entrypoint must be visible');
assert.match(route, /movement-definitions\/similarity/, 'custom creation must use advisory similarity review');
assert.match(route, /movement-definitions'[,\s\S]*confirm_similar/, 'custom creation must use the shared backend identity endpoint');
assert.match(route, /custom-name[\s\S]*custom-primary[\s\S]*custom-secondary[\s\S]*custom-execution[\s\S]*custom-review[\s\S]*custom-created/, 'custom creation must use the locked five-step state machine plus success');
assert.match(route, /What are you creating\?[\s\S]*Possible Matches[\s\S]*No, mine is different\./, 'name-first similarity review must happen before movement classification');
assert.match(route, /Review your movement[\s\S]*Create Movement[\s\S]*Use This Movement/, 'custom movement persistence and Session selection must be separate deliberate actions');
assert.match(route, /authoring-options\?athlete_id=[\s\S]*options\.muscle_groups[\s\S]*options\.execution_families/, 'custom taxonomy inputs must come from governed backend authoring options');
assert.doesNotMatch(route, /pickerStep === 'configure'/, 'Session-item configuration must not be a picker step');
assert.match(route, /movement-definitions\/\$\{movement\.id\}\/favorite[\s\S]*method: nextFavorite \? 'PUT' : 'DELETE'/, 'favorites must persist through the server-owned preference endpoint');
assert.match(
  workspace,
  /kind === 'accessory' && item\.movement_identity\?\.id[\s\S]*patch\.movement_definition_id = item\.movement_identity\.id/,
  'the Session draft save plan must serialize stable accessory identity',
);
assert.match(
  workspace,
  /movementCreates[\s\S]*deletedMovementIds[\s\S]*orderChanged/,
  'adding an accessory must stay inside the canonical dirty Session save plan',
);
assert.match(route, /ownership_scope: setup\.ownershipScope[\s\S]*library_scope: setup\.libraryScope/, 'draft items must retain canonical/custom origin context');

const modal = route.slice(route.indexOf('function AccessoryEditorModal'), route.indexOf('function TrainingLiftSection'));
assert.match(modal, /onCancel/, 'the staged picker must preserve one explicit cancel path');
assert.doesNotMatch(modal, /TrainingLiftSection title="Grouped Set"|TrainingLiftSection title="Movement Notes"/, 'grouping and notes must not render inside movement discovery');
assert.match(workspace, /AccessorySessionProgrammingContext[\s\S]*GROUPED SET[\s\S]*APPROVED SUBSTITUTIONS/, 'Session-specific grouping and substitutions must render only in the Session editor');
assert.match(workspace, /onChangeAccessory[\s\S]*Change \/ Swap/, 'add, change, and swap must reuse the canonical picker stack');
assert.doesNotMatch(
  modal,
  /AccessoryConfigChoices label="(?:Equipment|Loading|Load convention|Measurement|Sidedness)"/,
  'programming-time identity authoring must remain separate from exact machine/cable equipment',
);

console.log('[session-workspace-accessory-picker] live add-accessory integration checks passed');
