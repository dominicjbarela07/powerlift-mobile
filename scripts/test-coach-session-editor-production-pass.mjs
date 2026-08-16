import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  mapCoachSessionEditorPayload,
  movementDraftFromItem,
  movementDraftIsDirty,
  movementProgrammingPatch,
  optionalDisplayNumber,
} from '../lib/coach-session-editor.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const route = fs.readFileSync(path.join(root, 'app/(tabs)/workout/session-workspace/[workoutId].tsx'), 'utf8');
const workspace = fs.readFileSync(path.join(root, 'components/coach-mobile/SessionEditingWorkspace.tsx'), 'utf8');
const logger = fs.readFileSync(path.join(root, 'app/(tabs)/workout/[workoutId].tsx'), 'utf8');
const loggerPrimitives = fs.readFileSync(path.join(root, 'components/workout-logger/logger-primitives.tsx'), 'utf8');
const tabLayout = fs.readFileSync(path.join(root, 'app/(tabs)/_layout.tsx'), 'utf8');
const overlayState = fs.readFileSync(path.join(root, 'lib/session-editor-overlay-state.ts'), 'utf8');
const bootstrap = fs.readFileSync(path.join(root, 'app/(tabs)/create-workout.tsx'), 'utf8');
const coachCalendar = fs.readFileSync(path.join(root, 'app/(tabs)/coach-calendar.tsx'), 'utf8');

const mapped = mapCoachSessionEditorPayload({
  workout: {
    core_items: [
      {
        id: 1,
        movement: 'Competition Bench',
        designation: 'PRIMARY',
        target_low_kg: 100,
        target_high_kg: 110,
        baseline_low_kg: null,
        baseline_high_kg: null,
        coach_prescribed_low_kg: null,
        coach_prescribed_high_kg: null,
        calculated_load_low_kg: 102.5,
        calculated_load_high_kg: 112.5,
        planned_sets: [{ suggested_low_kg: 120, suggested_high_kg: 130 }],
      },
      {
        id: 2,
        movement: 'Tempo Bench',
        target_low_kg: 200,
        target_high_kg: 210,
        baseline_low_kg: 90,
        baseline_high_kg: 95,
        coach_prescribed_low_kg: 90,
        coach_prescribed_high_kg: 95,
        planned_sets: [{ manual_target_kg: 0, manual_pm_kg: 0, suggested_low_kg: 140 }],
      },
    ],
    accessory_groups: [],
  },
});

assert.equal(mapped.workout.core_items[0].target_low_kg, null, 'calculated and historical load must not populate coach prescription');
assert.equal(mapped.workout.core_items[0].target_high_kg, null, 'missing explicit load stays missing');
assert.equal(mapped.workout.core_items[1].target_low_kg, 90, 'explicit low load survives');
assert.equal(mapped.workout.core_items[1].target_high_kg, 95, 'explicit high load survives');
assert.ok(!('calculated_load_low_kg' in mapped.workout.core_items[0]), 'calculated load is removed at the editable boundary');
assert.ok(!('baseline_low_kg' in mapped.workout.core_items[1]), 'baseline load is removed at the editable boundary');
assert.ok(!('suggested_low_kg' in mapped.workout.core_items[1].planned_sets[0]), 'per-set suggestions are removed');
assert.equal(mapped.workout.core_items[1].planned_sets[0].manual_target_kg, 0, 'explicit zero remains explicit');
assert.equal(optionalDisplayNumber(''), null);
assert.equal(optionalDisplayNumber('0'), 0);

const persisted = movementDraftFromItem(mapped.workout.core_items[1]);
const persistedKg = movementDraftFromItem(mapped.workout.core_items[1], 'kg');
assert.equal(persistedKg.targetLowLb, '90', 'kg preference keeps canonical kg values in the editor');
assert.ok(Number(movementProgrammingPatch({ ...persistedKg, targetLowLb: '90' }, 'core', 'kg').target_low_lb) > 198, 'kg editor values convert through the existing authoritative lb mutation contract');
assert.equal(movementDraftIsDirty(persisted, persisted), false, 'untouched movement is clean');
assert.equal(movementDraftIsDirty({ ...persisted, movement: ` ${persisted.movement} ` }, persisted), false, 'focus/whitespace does not create dirtiness');
assert.equal(movementDraftIsDirty({ ...persisted, reps: '6' }, persisted), true, 'semantic prescription edits create dirtiness');
assert.equal(movementDraftIsDirty({ ...persisted, notes: 'new cue' }, persisted), true, 'movement notes create dirtiness');
for (const [field, value] of Object.entries({
  movement: 'Different movement', designation: 'SECONDARY', scheme: 'FULL_CUSTOM', mode: 'PCT',
  sets: '7', reps: '6', repsText: '8-10', rpe: '8', pct: '77.5', rir: '3',
  targetLowLb: '205', targetHighLb: '215', notes: 'new cue', supersetGroup: 'B', supersetPosition: '2', approvedSubsText: 'Cable Row',
})) {
  assert.equal(movementDraftIsDirty({ ...persisted, [field]: value }, persisted), true, `${field} must participate in semantic dirtiness`);
}
assert.equal(movementProgrammingPatch({ ...persisted, targetLowLb: '', targetHighLb: '' }, 'core').target_low_lb, '', 'clearing explicit load is serialized as blank');
const fullCustomPatch = movementProgrammingPatch({
  ...persisted,
  scheme: 'FULL_CUSTOM',
  plannedSets: [{ reps: '5', rpe: '7', pct: '', targetLb: '225', rangeLb: '10' }],
}, 'core');
assert.equal(fullCustomPatch.planned_sets[0].set_index, 1, 'Full Custom set order is serialized canonically');
assert.equal(fullCustomPatch.planned_sets[0].reps, '5', 'Full Custom reps survive serialization');
assert.ok(Number(fullCustomPatch.planned_sets[0].manual_target_kg) > 100, 'Full Custom explicit load converts to canonical kg storage');
const fullCustomKgPatch = movementProgrammingPatch({ ...persistedKg, scheme: 'FULL_CUSTOM', plannedSets: [{ reps: '5', rpe: '7', pct: '', targetLb: '100', rangeLb: '5' }] }, 'core', 'kg');
assert.equal(fullCustomKgPatch.planned_sets[0].manual_target_kg, 100, 'Full Custom kg input remains canonical kg storage');

assert.match(route, /<SessionEditingWorkspace/, 'live route uses the Adaptive Session Workspace architecture');
assert.match(route, /normalizeDisplayWeightUnit\(user\?\.preferred_units\)[\s\S]*displayUnit=/, 'the authenticated viewer unit reaches the workspace editor');
assert.doesNotMatch(route, /payload\?\.athlete\?\.preferred_units/, 'the viewed athlete cannot override the coach viewer unit');
assert.match(route, /onSaveSession=\{saveSessionDraft\}/, 'the authoritative Session draft saves through one route orchestrator');
assert.match(route, /const saveSessionDraft = async[\s\S]*movementUpdates[\s\S]*movementCreates[\s\S]*deletedMovementIds[\s\S]*items\/reorder/, 'the save orchestrator persists granular movement and ordering mutations');
assert.match(route, /method: 'PATCH'/, 'edits remain wired to production mutations');
assert.match(route, /method: 'DELETE'/, 'movement deletion remains wired');
assert.doesNotMatch(route, /duplicateMovement/, 'movement duplication must not retain an immediate movement-local mutation path');
assert.match(route, /onAssign=\{\(\) => guard\(assignSession\)\}/, 'lifecycle actions are dirty-guarded');
assert.match(route, /isDraft && capabilities\.can_assign/, 'Assign renders only for valid draft lifecycle state');
assert.match(route, /!isDraft && capabilities\.can_revert_to_draft/, 'Revert to Draft follows lifecycle state, not dirtiness');
assert.match(route, /loadRequestRevisionRef/, 'stale Session responses cannot replace newer workspace data');
assert.match(route, /athleteView: 'coach-preview'/, 'Athlete View requests read-only preview mode');

assert.doesNotMatch(workspace, /MovementSheetSnap|applySnap|GestureDetector|styles\.backdrop|styles\.sheet(?:[,\]])/, 'the approved inline editor must not retain bottom-sheet architecture');
assert.match(workspace, /const openMovement = useCallback[\s\S]*selectedId === item\.id \? null : item\.id[\s\S]*setSelectedId\(nextId\)/, 'opening a movement changes presentation without replacing the canonical Session draft');
assert.match(workspace, /function MovementQuickPrescriptionEditor/, 'primary prescription fields use the direct quick editor');
assert.doesNotMatch(workspace, /activeOffsetX|horizontalGesture|switchMovement|nextMovementIndex/, 'in-sheet movement switching is removed');
assert.doesNotMatch(workspace, /MovementPeekSummary|function Disclosure|setExpanded/, 'passive peek and disclosure state are removed');
assert.match(workspace, /Unsaved Session changes/, 'dirty close protection is implemented');
assert.match(workspace, /Save Changes/, 'dirty state exposes Save Changes');
assert.match(workspace, /Discard Changes/, 'dirty state exposes Discard Changes');
assert.match(workspace, /\{dirty \? <View style=\{styles\.dirtyActions\}/, 'clean state reserves no dirty-action placeholders');
assert.match(workspace, /if \(!success\) \{[\s\S]*acceptIncomingSessionRef\.current = false[\s\S]*return false[\s\S]*setPersistedSession/, 'failed saves retain the authoritative Session draft and dirty state');
assert.match(workspace, /function InlineMovementWorkspace[\s\S]*styles\.expandedMovementHeader[\s\S]*<MovementQuickPrescriptionEditor/, 'inline editor keeps movement identity physically attached above direct prescription controls');
assert.match(workspace, /function InlineMovementWorkspace[\s\S]*<MovementQuickPrescriptionEditor[\s\S]*<RecentHistorySection[\s\S]*<CoachNotesSection[\s\S]*<MovementDeleteAction/, 'secondary movement content remains inside the expanded card');
assert.doesNotMatch(workspace, /supportingMovementTools|MovementQuickActions|Quick Actions/, 'no movement-specific content or Quick Actions group remains outside the expanded card');
assert.match(workspace, /function SessionFloatingToolkit[\s\S]*label="Edit Session"[\s\S]*label="Rename Session"[\s\S]*label="Change Date"[\s\S]*label="Add Movement"[\s\S]*Units:[\s\S]*label="Workspace"[\s\S]*label="Athlete View"[\s\S]*label="Reorder Movements"[\s\S]*lifecycleActions/, 'the floating action panel groups and visibly labels every actual Session tool');
assert.match(workspace, /label="Edit Session" color=\{SLColors\.info\}[\s\S]*label="Workspace" color=\{SLColors\.accentViolet\}/, 'the primary toolkit sections have colored headers and matching action icons');
assert.match(route, /label: 'Lifecycle'[\s\S]*color: SLColors\.success[\s\S]*label: 'Reuse & Organize'[\s\S]*color: SLColors\.warning[\s\S]*label: 'Danger Zone'[\s\S]*color: SLColors\.danger/, 'lifecycle, reuse, and danger actions have semantic colored headers and icons');
assert.doesNotMatch(workspace, />Tools<|>Close Tools<|>Manage Session<|>Preferences</, 'the action panel does not render a redundant toolkit title or close label');
assert.doesNotMatch(workspace, /styles\.lifecycleArea|styles\.lifecycleLabel|>Session actions</, 'the inline Session Actions block is removed');
assert.doesNotMatch(workspace, /function EquipmentPanel|title="Equipment"|title="Tags"|title="Rest"/, 'Equipment, Tags, and Rest controls are absent');
assert.match(workspace, /dirty \? <View style=\{styles\.dirtyActions\}[\s\S]*'Save Changes'/, 'dirty controls expose the dominant Save Changes action');
assert.match(workspace, /!dirty \? <SLButton[^>]*label="Done"/, 'clean controls expose only Done');
assert.match(workspace, /function SessionCompactIdentity/, 'collapsed hub uses the approved compact Session identity block');
assert.doesNotMatch(workspace, /<SLStatusPill/, 'Session status is plain colored lettering rather than a pill');
assert.match(workspace, /function trainingHubSessionStatusColor[\s\S]*SLColors\.success[\s\S]*SLColors\.accentViolet[\s\S]*SLColors\.railDanger[\s\S]*SLColors\.warning/, 'Session status reuses the canonical Training Hub color mapping');
assert.match(workspace, /status === 'draft'\) return SLColors\.review/, 'Draft status uses lavender lettering instead of the amber not-started color');
assert.doesNotMatch(workspace, /accessibilityLabel="Return to Training Hub"|>Training Hub<\//, 'the approved compact identity does not insert a Training Hub control into the reference composition');
assert.doesNotMatch(workspace, /accessibilityLabel="Close Session Workspace"/, 'Session identity does not use an ambiguous close control');
assert.doesNotMatch(workspace, /label="Coach Editor"/, 'Session identity does not repeat the active coach mode');
assert.match(workspace, /<Text style=\{styles\.identityTitle\}>\{title\}<\/Text>/, 'Session title wraps without a hard line limit');
assert.doesNotMatch(workspace, /<Text numberOfLines=\{2\} style=\{styles\.identityTitle\}>/, 'Session title is never truncated by a fixed line count');
assert.doesNotMatch(workspace, /styles\.identityEditVisual|onPress=\{onBeginDateEdit\}/, 'Rename Session and Change Date do not retain duplicate hero affordances');
assert.match(workspace, /function SessionRenameModal[\s\S]*visible=\{visible\}[\s\S]*accessibilityLabel="Session title"[\s\S]*label="Cancel"[\s\S]*label="Rename"/, 'Rename Session uses the compact modal workflow');
assert.doesNotMatch(workspace, /renameWrap|renameInput|Finish editing Session title/, 'the Session hero never becomes an inline title editor');
assert.doesNotMatch(workspace, /function SessionEditorModeSelector|function HeaderControl|workspaceToolbar/, 'Athlete View and Reorder no longer occupy a permanent utility row');
assert.doesNotMatch(workspace, /label="Editor"/, 'the empty Editor mode control is removed');
assert.match(workspace, /label="Athlete View" color=\{SLColors\.accentViolet\} onPress=\{onAthleteView\}[\s\S]*label="Reorder Movements" color=\{SLColors\.accentViolet\} onPress=\{onReorder\}/, 'Athlete View and Reorder are explicit grouped toolkit actions');
assert.match(workspace, /status=\{status\}[\s\S]*duration=\{durationLabel\}/, 'authoritative Session status and duration reach the identity card');
assert.match(workspace, /styles\.identitySessionStatus[\s\S]*styles\.identityDuration/, 'the identity card renders status and duration in the approved context column');
assert.match(loggerPrimitives, /export function SessionUnitFloatingControl/, 'the canonical floating Logger unit control is a shared primitive');
assert.match(logger, /<SessionUnitFloatingControl[\s\S]*onChange=\{switchDisplayUnit\}/, 'the Session Logger uses the shared floating unit control');
assert.doesNotMatch(workspace, /SessionUnitFloatingControl|function UnitToggle|styles\.unitToggle/, 'the Adaptive Session Workspace has no separate unit control outside the toolkit');
assert.match(workspace, /\{duration \? <View style=\{\[styles\.identityDuration, accessibilityReflow && styles\.identityDurationReflow\]\}/, 'missing estimated duration does not fabricate an overview value');
assert.doesNotMatch(workspace, />Session Overview</, 'overview card does not render a redundant heading');
assert.match(workspace, /<Text style=\{styles\.identitySessionStatusLabel\}>Status<\/Text>[\s\S]*color: trainingHubSessionStatusColor\(status\)[\s\S]*\{humanize\(status\)\}/, 'Session context renders authoritative status as Training Hub-colored text');
assert.doesNotMatch(workspace, /focus=\{focusLabel\}|styles\.identityFocus|function sessionFocus/, 'the Session hero no longer renders or derives a Focus field');
assert.match(workspace, /function SessionNotesPreview/, 'collapsed hub keeps the Session notes preview in context');
assert.match(workspace, /accessibilityLabel="Edit Session notes"[\s\S]*<Text style=\{\[styles\.sessionNotesText/, 'Session Notes preview renders as unrestricted wrapping text');
assert.doesNotMatch(workspace, /<Text numberOfLines=\{\d+\} style=\{\[styles\.sessionNotesText/, 'Session Notes preview must never truncate at a fixed line count');
assert.match(workspace, /onChange=\{\(nextNotes\) => setSessionDraft[\s\S]*notes: nextNotes[\s\S]*onSave=\{\(\) => setEditingNotes\(false\)\}/, 'Session Notes edits remain in the authoritative Session draft until the whole Session is saved');
assert.match(workspace, /function SessionWorkloadMetric[\s\S]*Total Sets/, 'collapsed hub exposes the single authoritative Total Sets metric');
assert.match(workspace, /\(\['core', 'accessory'\] as const\)\.map[\s\S]*kind === 'core' \? 'Core' : 'Accessories'/, 'movement classifications remain explicit in the grouped movement overview');
assert.doesNotMatch(workspace, /SessionCategoryNavigation|coreCount|accessoryCount|tabCount/, 'permanent category counters are removed from the toolbar');
assert.match(workspace, /movementGroupHeader: \{[^}]*justifyContent: 'space-between'/, 'the first movement section header owns the Total Sets summary placement');
assert.match(workspace, /workloadMetric: \{[^}]*flexDirection: 'row'/, 'Total Sets renders as a compact inline summary rather than a standalone toolbar');
assert.match(workspace, /items\.map\(\(item\)[\s\S]*<VisualMovementRow/, 'collapsed hub uses the approved visual movement rows');
assert.match(workspace, /function VisualMovementRow/, 'each movement row remains a focused, directly interactive component');
assert.doesNotMatch(workspace, /styles\.orderBadge|styles\.orderText/, 'collapsed movement cards must not display movement indices');
assert.match(workspace, /movementRow: \{[^}]*minHeight: 124/, 'movement rows make room for prescription-first hierarchy');
assert.match(workspace, /<MovementArtwork item=\{item\} kind=\{kind\} size=\{72\}/, 'movement artwork is the collapsed-card visual anchor');
assert.match(workspace, /function movementName\(item: SessionMovementItem\)[\s\S]*return name;/, 'movement titles do not repeat their designation');
assert.match(workspace, /parts\.filter\(Boolean\)\.join\(' - '\)/, 'movement designation and scheme remain below the title');
assert.match(workspace, /sessionNotes: \{[^}]*paddingTop: 0/, 'Session Notes card removes redundant top padding');
assert.match(workspace, /function FullCustomSetEditor/, 'Full Custom planned-set editing remains inside the movement workspace');
assert.match(workspace, /onPress=\{\(\) => onOpen\(item\)\}/, 'each visual movement row expands its own attached workspace');
assert.match(workspace, /function MovementArtwork/, 'movement rows reuse canonical lift and accessory artwork');
assert.match(workspace, /estimatedDurationLowMinutes/, 'estimated duration is sourced from the authoritative Session payload');
assert.match(workspace, /function collapsedLoadPresentation[\s\S]*kind === 'accessory'[\s\S]*validManualLow[\s\S]*label: 'Manual'[\s\S]*label: 'Calculated'/, 'collapsed Core rows show only real manual loads or calculated targets, while Accessories omit load suggestions');
assert.doesNotMatch(workspace, /No load prescribed/, 'unset loads do not render a fake load state');
assert.doesNotMatch(workspace, /suggested_low_kg|calculated_load/, 'coach editor presentation never consumes suggestions or calculated loads');
assert.doesNotMatch(workspace, /MovementEditorModal|MovementSheetModal/, 'movement editor is not implemented as a generic modal');
assert.doesNotMatch(workspace, /accessibilityLabel="Expand Prescription"|accessibilityLabel="Collapse Prescription"/, 'the quick editor has no accordion semantics');
assert.match(workspace, /minHeight: 44/, 'touch targets retain the mobile minimum');
assert.match(workspace, /SLControlSize\.minimumTouchTarget/, 'compact controls use the canonical minimum touch target');
assert.match(workspace, /paddingHorizontal: GUTTER/, 'workspace owns one canonical horizontal gutter');
assert.match(workspace, /KeyboardAvoidingView/, 'the workspace retains a keyboard-safe persistent action region');
assert.match(workspace, /automaticallyAdjustKeyboardInsets/, 'the route scroll region follows native keyboard insets');
assert.match(workspace, /inlineActionBarLayer:[\s\S]*justifyContent: 'flex-end'/, 'persistent movement actions stay anchored to the workspace bottom');
assert.match(workspace, /MovementCardMaterial/, 'inline and collapsed movement cards reuse the canonical Session Logger surface treatment');
assert.doesNotMatch(workspace, /PlateVisualizationSection|Plate Visualization|LoggerPlateStackVisual|resolveLoggerPlateStackForDisplayWeight/, 'the rejected Plate Visualization section is removed completely');
assert.match(workspace, /SLButton/, 'primary and dirty actions reuse the canonical Session Logger button primitive');
assert.match(route, /function CompactSessionActions/, 'Session lifecycle actions use the toolkit action renderer');
assert.doesNotMatch(route, /function SessionSetupModal|Session Setup/, 'the removed Session Setup surface cannot be opened');
assert.match(route, /\/workouts\/mobile\/\$\{workout\.id\}\/setup/, 'compact Session setup mutations remain inside the workspace');
assert.doesNotMatch(route, /function SessionTemplateModal|apply-template/, 'the removed setup-only template loader cannot be opened');
assert.doesNotMatch(workspace, /onOpenFullEditor/, 'the active Editor segment has no Session Setup entry point');
assert.match(route, /isDraft && capabilities\.can_assign/, 'compact actions retain assign capability filtering');
assert.match(route, /capabilities\.can_copy[\s\S]*capabilities\.can_move[\s\S]*capabilities\.can_save_template[\s\S]*capabilities\.can_delete/, 'the labeled toolkit retains capability filtering for every management action');
assert.match(route, /icon: 'arrow-undo-outline'/, 'Revert to Draft remains a direct lifecycle action');
assert.match(route, /icon: 'copy-outline'/, 'Copy Session To remains directly reachable');
assert.match(route, /icon: 'move-outline'/, 'Move Session remains directly reachable');
assert.match(route, /icon: 'document-text-outline'/, 'Save as Template remains directly reachable');
assert.match(route, /icon: 'trash-outline'/, 'Delete remains directly reachable and destructive');
assert.doesNotMatch(route, /label: 'Actions\.\.\.'/i, 'the collapsed hub does not replace Session management with a generic Actions button');
assert.match(route, /sessionActions: \{[\s\S]*?width: '100%'[\s\S]*?flexDirection: 'column'[\s\S]*?gap: 2[\s\S]*?\},/, 'Session management actions stack inside their labeled toolkit group');
assert.match(route, /sessionActionButton: \{[\s\S]*?width: '100%'[\s\S]*?minHeight: SLControlSize\.minimumTouchTarget[\s\S]*?justifyContent: 'flex-start'[\s\S]*?\},/, 'toolkit management actions use readable full-width labeled rows');
assert.match(route, /styles\.sessionActionText[\s\S]*\{action\.label\}/, 'toolkit management actions visibly spell out their labels');
assert.match(tabLayout, /useSessionEditorOverlayOpen\(\)/, 'the floating control observes movement editor visibility');
assert.match(tabLayout, /startsWith\('\/workout\/session-workspace\/'\)[\s\S]*&& sessionEditorOverlayOpen/, 'the floating control observes the workspace-owned editing overlay state');
assert.match(tabLayout, /if \(hidesNavigationForSessionEditor\) return null/, 'the floating control cannot overlap open movement editor actions');
assert.match(workspace, /setSessionEditorOverlayOpen\(sessionDirty\)/, 'only Session-boundary dirty protection may hide shell navigation');
assert.doesNotMatch(workspace, /setSessionEditorOverlayOpen\(Boolean\(selectedItem\)/, 'expanding a workout item must not hide the tab row');
assert.match(workspace, /const currentCoreItems = useMemo\([\s\S]*\[sessionDraft\.coreOrder, sessionDraft\.items\]/, 'calculated-load inputs must retain stable identity between unrelated workspace renders');
assert.match(workspace, /const currentAccessoryItems = useMemo\([\s\S]*\[sessionDraft\.accessoryOrder, sessionDraft\.items\]/, 'accessory item collections must retain stable identity between unrelated workspace renders');
assert.doesNotMatch(workspace, /const currentCoreItems = sessionDraft\.coreOrder\.map/, 'the calculated-load effect must not depend on a freshly allocated array that creates a request/render loop');
assert.match(workspace, /bottom=\{insets\.bottom \+ SLSpacing\.xs \+ SL_TAB_ROW_CONTROL\.shellHeight \+ SLSpacing\.md\}[\s\S]*sessionToolkit: \{ position: 'absolute', right: SLLayout\.screenGutter/, 'the Session toolkit sits above the bottom tab row with a canonical gap');
assert.match(workspace, /sessionToolkitShell: \{[^}]*alignItems: 'flex-end'[\s\S]*sessionToolkitPanel: \{ width: 264[^}]*borderRadius: SLRadius\.lg[\s\S]*sessionToolkitMaterial: \{[^}]*SL_TAB_ROW_CONTROL\.translucentFallback[\s\S]*sessionToolkitTrigger: \{[^}]*width: SL_TAB_ROW_CONTROL\.shellHeight/, 'the Session tools use canonical material in a compact rectangular panel with a separate trigger');
assert.match(overlayState, /useSyncExternalStore/, 'overlay visibility is subscribed without coupling it to route navigation state');
assert.match(workspace, /content: \{ paddingHorizontal: GUTTER/, 'the collapsed hub owns one canonical horizontal gutter');
assert.match(workspace, /sessionToolkitAction: \{ width: '100%', minHeight: SLControlSize\.minimumTouchTarget/, 'floating toolkit controls retain full width and minimum touch targets');
assert.match(workspace, /const \{ expansion, expandedItemsOpacity, collapsedAnchorOpacity \} = useFloatingNavigationMotion\(\{[\s\S]*reduceMotion[\s\S]*panelMotionStyle[\s\S]*translateY:[\s\S]*scale:/, 'floating toolkit opening and closing uses the canonical tab-row motion curve');
assert.match(workspace, /accessibilityLabel="Close Session tools"[\s\S]*onPress=\{\(\) => onExpandedChange\(false\)\}[\s\S]*style=\{styles\.sessionToolkitDismissLayer\}/, 'the expanded toolkit closes when the user taps outside it');
assert.doesNotMatch(workspace, /toolbarUtilityRow|toolbarUtilityScroll|toolbarUtilityContent/, 'the retired permanent utility row and horizontal rail are removed');
assert.match(workspace, /identityTitle: \{[^\n]*fontSize: 22[^\n]*lineHeight: 28/, 'Session title uses the larger approved hero scale');
assert.match(workspace, /identityMetaText: \{[^\n]*fontSize: 16[^\n]*lineHeight: 22/, 'hero athlete and date metadata use the larger readable scale');
assert.match(workspace, /identitySessionStatusLabel: \{[^\n]*fontSize: 14[^\n]*lineHeight: 18[\s\S]*identitySessionStatusValue: \{[^\n]*fontSize: 18[^\n]*lineHeight: 24/, 'hero status label and value use the larger readable scale');
assert.match(workspace, /identityDurationLabel: \{[^\n]*fontSize: 14[^\n]*lineHeight: 18[\s\S]*identityDurationValue: \{[^\n]*fontSize: 18[^\n]*lineHeight: 24/, 'hero estimated-time label and value use the larger readable scale');
assert.match(workspace, /<Text style=\{styles\.identityTitle\}>\{title\}<\/Text>[\s\S]*styles\.identityAthleteRow[\s\S]*styles\.identityAvatarButton/, 'Session title owns the upper-left hero width while athlete identity sits below it');
assert.match(workspace, /useCompactAthleteName \|\| shouldDefaultToAbbreviatedAthleteName\(athleteName\)[\s\S]*onTextLayout[\s\S]*function abbreviatedAthleteName[\s\S]*parts\[0\][\s\S]*charAt\(0\)[\s\S]*function shouldDefaultToAbbreviatedAthleteName[\s\S]*parts\.length > 2 \|\| normalized\.length > 20/, 'long or clipped athlete names fall back immediately to first name and last initial');
assert.match(workspace, /function SessionCompactIdentity[\s\S]*profilePhotoVersion=\{athleteAvatarVersion\}[\s\S]*size=\{64\}/, 'Session hero uses the approved large athlete avatar');
assert.match(workspace, /identityAvatarButton: \{[^}]*width: 72[^}]*minHeight: 72/, 'large avatar owns a matching touch and layout footprint');
assert.match(workspace, /identityContext: \{[^}]*justifyContent: 'flex-start'/, 'status and estimated time are top-aligned in the hero');
assert.doesNotMatch(workspace, /<Text typographyRole="numeric" numberOfLines=\{1\} style=\{styles\.workloadMetricValue\}/, 'Total Sets must not inherit the oversized responsive numeric role');
assert.match(workspace, /workloadMetricValue: \{[^\n]*fontSize: 18[^\n]*lineHeight: 22/, 'Total Sets uses a compact explicit numeral size');
assert.match(workspace, /sessionNotesText: \{[^\n]*fontSize: 16[^\n]*lineHeight: 22/, 'Session notes use the larger readable preview size');
assert.match(workspace, /sessionNotesText: \{[^\n]*width: '100%'[^\n]*flexShrink: 1/, 'Session notes reserve full card width and wrap as the card grows');
assert.match(workspace, /expandedMovementName: \{[^\n]*fontSize: 20[^\n]*lineHeight: 25/, 'movement names retain the approved 18–22 pt hierarchy');

assert.match(logger, /\?view=coach-preview/, 'logger requests the authorized preview payload');
assert.match(logger, /const canLogFromServer = !isCoachAthletePreview/, 'Athlete View disables logging');
assert.match(logger, /const canEdit =\s*!isCoachAthletePreview/, 'Athlete View disables editing');
assert.match(logger, /const handleReturnToCoachEditor = \(\) => \{\s*router\.replace\(\{\s*pathname: '\/workout\/session-workspace\/\[workoutId\]'/, 'Coach Editor return targets the exact Session workspace');
assert.match(logger, /section: returnSection === 'accessories' \? 'accessories' : 'core'/, 'Coach Editor return restores the active Session section');
assert.match(logger, /onPress=\{handleReturnToCoachEditor\}/, 'Athlete View return control uses deterministic Session workspace navigation');
assert.doesNotMatch(logger, /if \(router\.canGoBack\(\)\) \{\s*router\.back\(\)/, 'Coach Editor return never falls through the ambient tab history');

assert.match(bootstrap, /status: 'draft'[\s\S]*core_items: \[\][\s\S]*acc_items: \[\]/, 'mobile creation establishes a server-backed draft before programming');
assert.match(bootstrap, /editSessionId[\s\S]*router\.replace\([\s\S]*session-workspace/, 'legacy edit links safely redirect to the Adaptive Session Workspace');
assert.doesNotMatch(bootstrap, /@\/components\/creator/, 'legacy mobile creator components are retired');
assert.doesNotMatch(bootstrap, /suggest_load|suggested_low_kg|calculated_load/, 'bootstrap never fabricates prescription data');
assert.match(coachCalendar, /pathname: '\/workout\/session-workspace\/\[workoutId\]'[\s\S]*workoutId: String\(session\.workout_id\)/, 'calendar editing enters the canonical workspace directly');

console.log('coach Session editor inline-workspace production checks passed');
