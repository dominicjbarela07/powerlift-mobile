#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(root, '..');
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
const backendRoot = [repoRoot, path.join(repoRoot, 'preferred-units-backend')]
  .find((candidate) => fs.existsSync(path.join(candidate, 'app', 'blueprints', 'workouts.py')));
if (!backendRoot) throw new Error('backend worktree not found');
const backend = fs.readFileSync(path.join(backendRoot, 'app', 'blueprints', 'workouts.py'), 'utf8');

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
requireMatch(workspace, /<SessionCompactIdentity[\s\S]*status=\{status\}[\s\S]*duration=\{durationLabel\}[\s\S]*<SessionNotesPreview[\s\S]*<SessionWorkloadMetric/, 'the approved hierarchy must keep Session status and duration in the identity card before notes and programming.');
requireMatch(workspace, /styles\.identitySessionStatus[\s\S]*styles\.identityDuration/, 'Session identity must render status and duration in the context column.');
requireNoMatch(workspace, /<SLStatusPill/, 'Session status must render as plain colored text rather than a pill.');
requireMatch(workspace, /function trainingHubSessionStatusColor[\s\S]*SLColors\.success[\s\S]*SLColors\.accentViolet[\s\S]*SLColors\.railDanger[\s\S]*SLColors\.warning/, 'Session status must reuse the canonical Training Hub status color mapping.');
requireMatch(workspace, /status === 'draft'\) return SLColors\.review/, 'Draft status must use the approved lavender review color instead of amber.');
requireNoMatch(workspace, /focus=\{focusLabel\}|styles\.identityFocus|function sessionFocus/, 'the Session hero must not render or derive a Focus field.');
requireNoMatch(workspace, /SessionCategoryNavigation|coreCount|accessoryCount|tabCount/, 'permanent Core and Accessories counts must not remain in the toolbar.');
requireMatch(workspace, /styles\.movementGroupHeader[\s\S]*<SessionWorkloadMetric totalSets=\{totalProgrammedSets\}/, 'Total Sets must live as a compact summary in the first populated movement section.');
requireNoMatch(workspace, /workspaceToolbar|SessionEditorModeSelector|function HeaderControl|toolbarUtilityRow/, 'the retired standalone utility row must not remain above programming.');
requireMatch(workspace, /onRenameSession=\{\(\) => \{[\s\S]*setRenameDraft\(sessionDraft\.title\)[\s\S]*setRenaming\(true\)/, 'Rename Session in the toolkit must open the dedicated rename modal with the current title.');
requireMatch(workspace, /function SessionRenameModal[\s\S]*<Modal[\s\S]*transparent[\s\S]*accessibilityLabel="Close Rename Session"[\s\S]*accessibilityLabel="Session title"[\s\S]*label="Rename"/, 'Session renaming must use a compact, dismissible modal.');
requireNoMatch(workspace, /renameWrap|renameInput|Finish editing Session title|scrollTo\(\{ y: 0, animated: true \}\)/, 'Session renaming must not mutate the hero into an inline editor.');
requireMatch(workspace, /onBeginAthleteEdit[\s\S]*onChangeDate=\{\(\) => \{[\s\S]*setEditingDate\(true\)[\s\S]*DateTimePicker/, 'athlete selection remains contextual while Change Date moves to the toolkit.');
requireMatch(workspace, /onChangeDate=\{\(\) => \{[\s\S]*setToolkitExpanded\(false\)[\s\S]*setEditingDate\(true\)/, 'Change Date in the toolkit must open the dedicated date picker modal.');
requireNoMatch(workspace, /onPress=\{onBeginDateEdit\}|styles\.identityEditVisual/, 'the hero must not retain duplicate Rename Session or Change Date affordances.');
requireMatch(workspace, /function SessionDatePickerModal[\s\S]*<Modal[\s\S]*transparent[\s\S]*accessibilityLabel="Close date picker"[\s\S]*<DateTimePicker/, 'the date picker must live in a clean dismissible modal instead of expanding the Session hero.');
requireMatch(workspace, /<DateTimePicker[\s\S]*accentColor=\{SLColors\.accentViolet\}[\s\S]*themeVariant="dark"/, 'the modal calendar must use the readable native dark theme and approved interaction accent.');
requireMatch(workspace, /datePickerModalCard: \{[^}]*backgroundColor: SLColors\.surfaceMedia/, 'the date modal must use the neutral workspace surface instead of a purple card face.');
requireNoMatch(workspace, /inlineDatePicker|inlineDatePickerControl/, 'the Session hero must not contain or reserve space for an inline date picker.');
requireNoMatch(workspace, /display=\{Platform\.OS === 'ios' \? 'compact' : 'default'\}/, 'the two-touch compact date trigger must not return.');
requireMatch(workspace, /identityBody: \{[^\n]*flexDirection: 'row'[\s\S]*identityPrimary: \{ flex: 1, minWidth: 0[\s\S]*identityContext: \{ width: 108/, 'the compact identity composition must reserve stable columns for athlete, title metadata, and Session context.');
requireMatch(workspace, /<Text style=\{styles\.identityTitle\}>\{title\}<\/Text>[\s\S]*styles\.identityAthleteRow[\s\S]*styles\.identityAvatarButton/, 'the title must span the hero primary column above the lowered athlete avatar.');
requireMatch(workspace, /useCompactAthleteName \|\| shouldDefaultToAbbreviatedAthleteName\(athleteName\)[\s\S]*onTextLayout[\s\S]*function abbreviatedAthleteName[\s\S]*parts\[0\][\s\S]*charAt\(0\)[\s\S]*function shouldDefaultToAbbreviatedAthleteName[\s\S]*parts\.length > 2 \|\| normalized\.length > 20/, 'long or overflowing athlete names must shorten immediately to first name and last initial.');
requireMatch(workspace, /function SessionCompactIdentity[\s\S]*profilePhotoVersion=\{athleteAvatarVersion\}[\s\S]*size=\{64\}/, 'the Session hero must use the approved large athlete avatar.');
requireMatch(workspace, /identityAvatarButton: \{[^}]*width: 72[^}]*minHeight: 72/, 'the large athlete avatar must retain its full touch and layout footprint.');
requireMatch(workspace, /identityContext: \{[^}]*justifyContent: 'flex-start'/, 'the Session status and duration column must align to the top of the hero.');
requireMatch(workspace, /identityTitle: \{[^\n]*fontSize: 22[^\n]*lineHeight: 28[\s\S]*identityMetaText: \{[^\n]*fontSize: 16[^\n]*lineHeight: 22/, 'the Session title and metadata must use the enlarged hero typography hierarchy.');
requireMatch(workspace, /identitySessionStatusLabel: \{[^\n]*fontSize: 14[\s\S]*identitySessionStatusValue: \{[^\n]*fontSize: 18[\s\S]*identityDurationLabel: \{[^\n]*fontSize: 14[\s\S]*identityDurationValue: \{[^\n]*fontSize: 18/, 'the Session context column must use enlarged labels and values.');
requireNoMatch(workspace, /<Text typographyRole="numeric" numberOfLines=\{1\} style=\{styles\.workloadMetricValue\}/, 'the compact Total Sets metric must not use the oversized numeric role.');
requireNoMatch(workspace, /<Text numberOfLines=\{\d+\} style=\{\[styles\.sessionNotesText/, 'Session Notes must wrap without a fixed line limit.');
requireMatch(workspace, /sessionNotesText: \{[^\n]*width: '100%'[^\n]*flexShrink: 1/, 'the Session Notes preview must use the full card width while wrapping.');
requireMatch(workspace, /useWindowDimensions\(\)[\s\S]*viewportWidth < 360 \|\| fontScale >= 1\.3/, 'the identity and toolbar must reflow for narrow phones and larger Dynamic Type.');
requireMatch(workspace, /function SessionFloatingToolkit[\s\S]*label="Edit Session"[\s\S]*label="Rename Session"[\s\S]*label="Change Date"[\s\S]*label="Add Movement"[\s\S]*label=\{`Units: \$\{unit\.toUpperCase\(\)\}`\}[\s\S]*label="Workspace"[\s\S]*label="Athlete View"[\s\S]*label="Reorder Movements"[\s\S]*lifecycleActions/, 'the floating action panel must group, head, and spell out every actual Session tool.');
requireMatch(workspace, /label="Edit Session" color=\{SLColors\.info\}[\s\S]*label="Workspace" color=\{SLColors\.accentViolet\}/, 'the workspace-owned toolkit groups must use the specified colored headers.');
requireMatch(workspaceRoute, /label: 'Lifecycle'[\s\S]*color: SLColors\.success[\s\S]*label: 'Reuse & Organize'[\s\S]*color: SLColors\.warning[\s\S]*label: 'Danger Zone'[\s\S]*color: SLColors\.danger/, 'lifecycle, reuse, and danger toolkit groups must use canonical semantic colors.');
requireNoMatch(workspace, />Tools<|>Close Tools<|>Manage Session<|>Preferences</, 'the action panel must not add a redundant toolkit title or close label.');
requireMatch(workspace, /bottom=\{props\.sheetPresentation[\s\S]*?SLSpacing\.md[\s\S]*?: insets\.bottom \+ SLSpacing\.xs \+ SL_TAB_ROW_CONTROL\.shellHeight \+ SLSpacing\.md[\s\S]*sessionToolkit: \{ position: 'absolute', right: SLLayout\.screenGutter/, 'the floating toolkit must avoid tab-bar spacing inside a sheet while preserving it on the standalone route.');
requireMatch(workspace, /sessionToolkitShell: \{[^}]*alignItems: 'flex-end'[\s\S]*sessionToolkitPanel: \{ width: 264[^}]*borderRadius: SLRadius\.lg[\s\S]*sessionToolkitTrigger: \{[^}]*width: SL_TAB_ROW_CONTROL\.shellHeight[^}]*height: SL_TAB_ROW_CONTROL\.shellHeight/, 'the floating tools must use a separate rectangular action panel and icon-only trigger.');
requireMatch(workspace, /const \{ expansion, expandedItemsOpacity, collapsedAnchorOpacity \} = useFloatingNavigationMotion\(\{[\s\S]*reduceMotion[\s\S]*panelMotionStyle[\s\S]*translateY:[\s\S]*scale:[\s\S]*<Animated\.View/, 'the floating toolkit must share the tab-row motion choreography and respect reduced motion.');
requireMatch(workspace, /accessibilityLabel="Close Session tools"[\s\S]*onPress=\{\(\) => onExpandedChange\(false\)\}[\s\S]*sessionToolkitDismissLayer/, 'tapping outside the expanded toolkit must close it.');
requireNoMatch(workspace, /SessionUnitFloatingControl|function UnitToggle|styles\.unitToggle/, 'the standalone and inline unit toggles must not remain in the workspace.');
requireMatch(workspaceRoute, /preferred_units: plan\.metadataPatch\.displayUnit === 'lb' \? 'lbs' : 'kg'/, 'unit changes must persist through canonical Session setup.');
requireMatch(workspace, /function collapsedLoadPresentation[\s\S]*kind === 'accessory'[\s\S]*validManualLow[\s\S]*label: 'Manual'[\s\S]*label: 'Calculated'/, 'Core rows show manual only for a positive explicit load and otherwise use calculated targets; Accessories show neither.');
requireMatch(workspace, /<MovementArtwork item=\{item\} kind=\{kind\} size=\{72\}/, 'collapsed movement artwork must be the visual anchor.');
requireMatch(workspace, /import \{ accessoryMuscleRegionAsset \} from '@\/lib\/accessory-muscle-region-assets';[\s\S]*import \{ accessoryMuscleRegion \} from '@\/lib\/accessory-muscle-group';/, 'the workspace must reuse the governed Accessory Picker muscle artwork resolver.');
requireMatch(workspace, /if \(kind === 'accessory'\) \{[\s\S]*accessoryMuscleRegion\(item\)[\s\S]*accessoryMuscleRegionAsset\(muscle\.key\)[\s\S]*primary muscle artwork[\s\S]*const identity = resolveLoggerLiftIdentity\(item\)/, 'accessories must resolve primary-muscle artwork before preserving canonical core lift identity.');
requireNoMatch(workspace, /ACCESSORY_CATEGORY_ARTWORK|accessory-wordmark-coin-seal/, 'the legacy generic accessory medallion must not remain in the Session Workspace.');
requireNoMatch(workspace, /SLAccessoryIcon|resolveAccessoryIconName/, 'the workspace must not substitute its own accessory icon system for canonical Logger artwork.');
requireMatch(backend, /if "preferred_units" in data:[\s\S]*next_athlete\.preferred_units/, 'the setup mutation must persist the athlete unit preference.');
requireMatch(workspaceRoute, /movement_definition_id: movementDefinitionId/, 'accessory equipment identity must persist through the canonical identity contract.');
requireMatch(workspaceRoute, /isCoreVariantSelection = setup\.lift === 'VR'[\s\S]*target_low_lb[\s\S]*target_high_lb/, 'every Core variant must persist an explicit coach-authored load range.');
requireMatch(workspace, /function createSessionWorkspaceDraft[\s\S]*linkedBackdown[\s\S]*movementDraftFromItem\(item, displayUnit, linkedBackdown\)/, 'existing movements must enter the canonical Session draft with linked backdown data.');
requireMatch(tabLayout, /sceneStyle: styles\.tabScene[\s\S]*tabScene: \{[^}]*paddingTop: 0[^}]*\}/, 'the tab shell must provide the Session Workspace with a route-owned full-width canvas.');
requireNoMatch(tabLayout, /tabScene: \{[^}]*paddingHorizontal/, 'the Session Workspace must not inherit an additional shell gutter around its route-owned layout.');
requireMatch(workspace, /function FullCustomSetEditor/, 'Full Custom per-set prescriptions must remain editable in the inline movement workspace.');
requireMatch(workspace, /function InlineMovementWorkspace[\s\S]*styles\.expandedMovementHeader[\s\S]*<MovementQuickPrescriptionEditor/, 'the expanded prescription editor must remain physically attached to its movement card.');
requireMatch(workspace, /function InlineMovementWorkspace[\s\S]*<MovementQuickPrescriptionEditor[\s\S]*<RecentHistorySection[\s\S]*<CoachNotesSection[\s\S]*<MovementDeleteAction/, 'all movement-specific content must remain contained by the expanded movement card.');
requireNoMatch(workspace, /supportingMovementTools|MovementQuickActions|Quick Actions/, 'movement-specific content and obsolete Quick Actions must not render outside the expanded card.');
requireNoMatch(workspace, /styles\.lifecycleArea|styles\.lifecycleLabel|>Session actions</, 'the inline Session Actions block must not render outside the floating toolkit.');
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
