import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  coreLoggerHeaderMetadata,
  coreLoggerHeaderMetadataLines,
  coreLoggerMovementStateLabel,
  coreLoggerVisibleExpandedContent,
  coreLoggerVisibleMovementNote,
} from '../lib/core-logger-header.ts';
import {
  createWorkoutDetailFixture,
  WORKOUT_DETAIL_FIXTURE_SCENARIOS,
} from '../dev-mocks/fixtures/workout-detail.ts';

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const movementComponent = read('components/workout-logger/core-loggers.tsx');
const workoutRoute = read('app/(tabs)/workout/[workoutId].tsx');
const visualContext = read('lib/logger-visual-context.ts');
const timelineComponent = movementComponent.slice(
  movementComponent.indexOf('function SetTimeline('),
  movementComponent.indexOf('function SetRail('),
);

assert.equal(
  coreLoggerHeaderMetadata({
    title: 'Squat (Primary)',
    designation: 'Primary',
    schemeLabel: 'Straight Sets',
    prescription: '1×1 @8',
  }),
  'Straight Sets · 1×1 @8',
  'designation already carried by the title must not be duplicated',
);
assert.equal(
  coreLoggerHeaderMetadata({
    title: 'Tempo Squat',
    designation: 'Secondary',
    schemeLabel: 'Straight Sets',
    prescription: '3×5 @7',
  }),
  'Secondary · Straight Sets · 3×5 @7',
);
assert.equal(
  coreLoggerHeaderMetadata({
    title: 'Competition Bench Press with Two-Count Pause',
    designation: 'Primary',
    schemeLabel: 'Top + Backdown',
    prescription: '1×1 @8 → 3×3 @7',
  }),
  'Primary · Top + Backdown · 1×1 @8 → 3×3 @7',
);
assert.equal(
  coreLoggerHeaderMetadata({
    title: 'Chest-Supported Row',
    designation: 'Accessory',
    schemeLabel: 'Accessory',
    prescription: '3×10 · 3 RIR',
  }),
  'Accessory · 3×10 · 3 RIR',
);
assert.deepEqual(
  coreLoggerHeaderMetadataLines({
    title: 'Squat (Primary)',
    designation: 'Primary',
    schemeLabel: 'Top + Backdown',
    prescription: '1×1 @8 → 2×3 @7',
  }),
  {
    schemeLine: 'Top + Backdown',
    prescriptionLine: '1×1 @8 → 2×3 @7',
  },
);

assert.equal(coreLoggerMovementStateLabel('not_started'), 'Not started');
assert.equal(coreLoggerMovementStateLabel('logged'), 'In progress');
assert.equal(coreLoggerMovementStateLabel('complete'), 'Completed');

const programmedMovementNote = 'Stay patient out of the hole.';
assert.equal(coreLoggerVisibleMovementNote(true, programmedMovementNote), programmedMovementNote);
assert.equal(coreLoggerVisibleMovementNote(false, programmedMovementNote), '');
assert.equal(coreLoggerVisibleMovementNote(true, null), '');
assert.equal(coreLoggerVisibleMovementNote(false, null), '');
assert.equal(
  coreLoggerVisibleMovementNote(true, programmedMovementNote),
  programmedMovementNote,
  're-expanding must restore the unchanged programmed movement note',
);
const corePrInsight = { kind: 'weight_pr', primary: '405 lb is a PR today.' };
const accessoryHistory = { kind: 'prior_session', primary: '100 lb × 10 · 2 RIR' };
assert.equal(coreLoggerVisibleExpandedContent(false, corePrInsight), null);
assert.equal(coreLoggerVisibleExpandedContent(true, corePrInsight), corePrInsight);
assert.equal(coreLoggerVisibleExpandedContent(false, accessoryHistory), null);
assert.equal(coreLoggerVisibleExpandedContent(true, accessoryHistory), accessoryHistory);

const squat = createWorkoutDetailFixture('primary-squat');
const bench = createWorkoutDetailFixture('bench-rep-max');
const deadlift = createWorkoutDetailFixture('deadlift-prior-session');
const noProgress = createWorkoutDetailFixture('no-progress-context');
const accessory = createWorkoutDetailFixture('accessory-minimal');
const fallbackCoach = createWorkoutDetailFixture('coach-photo-fallback');

assert.equal(squat.workout.core_items[0].lift, 'SQ');
assert.equal(squat.workout.core_items[0].designation, 'Primary');
assert.equal(squat.workout.core_items[0].variant, 'TOP');
assert.equal(squat.workout.core_items[1].variant, 'BK');
assert.equal(
  squat.workout.core_items.filter((item) => item.variant === 'VR').length,
  3,
  'the canonical fixture must present several core-variant workspaces',
);
assert.equal(bench.workout.core_items[0].lift, 'BN');
assert.equal(deadlift.workout.core_items[0].lift, 'DL');
assert.equal(accessory.workout.accessory_groups[0].items[0].lift, 'ACC');
assert.ok(squat.workout.core_items[0].progress_context);
assert.equal(noProgress.workout.core_items[0].progress_context, null);
assert.ok(squat.workout.core_items[0].notes);
assert.equal(accessory.workout.accessory_groups[0].items[0].notes, null);
assert.equal(squat.coach.avatar_fixture, 'coach-adrien');
assert.equal(fallbackCoach.coach.avatar_fixture, null);
assert.deepEqual(WORKOUT_DETAIL_FIXTURE_SCENARIOS, [
  'primary-squat',
  'bench-rep-max',
  'deadlift-prior-session',
  'accessory-minimal',
  'coach-photo-fallback',
  'no-progress-context',
]);

assert.match(movementComponent, /Movement \{sessionIndex\}/);
assert.match(movementComponent, /activeMovementLiftIcon:[\s\S]*width: 104[\s\S]*height: 92/);
assert.match(visualContext, /squat\.png/);
assert.match(visualContext, /bench\.png/);
assert.match(visualContext, /deadlift\.png/);
assert.match(workoutRoute, /ACCESSORY_CATEGORY_ARTWORK/);
assert.match(workoutRoute, /accessory-wordmark-coin-seal\.png/);
assert.match(
  workoutRoute,
  /const isCoreVariant =[\s\S]*?resolvedIdentity\.key in CORE_FAMILY_LIFT_CODE[\s\S]*?coreVariantFamily: isCoreVariant[\s\S]*?resolvedIdentity\.key as keyof typeof CORE_FAMILY_LIFT_CODE/,
  'the shared logger must resolve integrated Core Variant badges from structured lift identity',
);
assert.match(
  movementComponent,
  /visualContext\?\.categoryArtworkSource[\s\S]*?source=\{visualContext\.categoryArtworkSource\}[\s\S]*?visualContext\?\.coreVariantFamily[\s\S]*?<CoreVariantBadge[\s\S]*?liftArtworkSource=\{visualContext\.liftIconSource\}/,
  'the shared movement header must render the Accessory medal and integrated parent-family Core Variant badge',
);
assert.match(
  movementComponent,
  /const visibleProgressContext = isPreSessionCard[\s\S]*?: coreLoggerVisibleExpandedContent\(expanded, visualContext\?\.progress\)/,
  'Performance context must remain expanded-only and must not appear during Pre Session',
);
assert.match(visualContext, /Current best \$\{formattedWeight\(evidence\.previousWeightKg, unit\)\}/);
assert.match(
  movementComponent,
  /typographyRole="movementName"\s*style=\{styles\.activeMovementTitle\}/,
  'movement names must remain uncapped so their full identity can wrap',
);
assert.match(
  movementComponent,
  /\{movementHeaderMetadata\.schemeLine \? \([\s\S]*?adjustsFontSizeToFit[\s\S]*?numberOfLines=\{1\}[\s\S]*?\{movementHeaderMetadata\.schemeLine\}[\s\S]*?\{movementHeaderMetadata\.prescriptionLine \? \([\s\S]*?adjustsFontSizeToFit[\s\S]*?numberOfLines=\{1\}[\s\S]*?\{movementHeaderMetadata\.prescriptionLine\}/,
  'scheme type and prescription must render as separate single lines that scale instead of clipping',
);
assert.match(movementComponent, /accessibilityLabel=\{`\$\{expanded \? 'Collapse' : 'Expand'\} \$\{title\}`\}/);
assert.match(movementComponent, /accessibilityState=\{\{ expanded: Boolean\(expanded\) \}\}/);
assert.doesNotMatch(movementComponent, /activeMovementDisclosureText/);
assert.match(
  movementComponent,
  /movementProgressPrimary[\s\S]*movementProgressSupporting/,
  'PR opportunity must precede its supporting context',
);
assert.match(
  movementComponent,
  /movementNoteText[\s\S]*movementNoteAttribution/,
  'coach instruction must precede attribution',
);
assert.equal(
  movementComponent.match(/<SetTimeline/g)?.length,
  2,
  'the canonical active and fallback movement paths must share one set timeline',
);
assert.match(
  movementComponent,
  /SET TIMELINE[\s\S]*\{completedCount\} \/ \{totalCount\} SETS COMPLETED/,
  'the shared timeline must expose movement-level completion progress',
);
assert.match(
  movementComponent,
  /setTimelineNode[\s\S]*setTimelineConnector[\s\S]*setTimelinePrescription/,
  'the timeline must retain numbered nodes, connectors, and prescription evidence',
);
assert.match(
  movementComponent,
  /setTimelineRowCompact:\s*\{[\s\S]*?minHeight: 64[\s\S]*?setTimelineNodeCompact:\s*\{[\s\S]*?width: 38[\s\S]*?height: 38/,
  'the set timeline must retain its compact row and node sizing',
);
assert.match(
  movementComponent,
  /completedSetSwipeContent:\s*\{[\s\S]*?backgroundColor: 'transparent'/,
  'completed set rows must inherit the movement card background without adding another surface',
);
assert.match(
  movementComponent,
  /deleteActionStyle = useAnimatedStyle[\s\S]*?width: Math\.max\(0, translateX\.value\)[\s\S]*?editActionStyle = useAnimatedStyle[\s\S]*?width: Math\.max\(0, -translateX\.value\)/,
  'swipe actions must occupy only the revealed area so they cannot bleed through transparent rows',
);
assert.match(timelineComponent, /Ready to log/);
assert.match(
  timelineComponent,
  /const supportingLabel = compact[\s\S]*?\? null[\s\S]*?: 'Upcoming'/,
  'the canonical compact timeline must suppress redundant future-set status text',
);
assert.match(
  timelineComponent,
  /\{!compact && !isCompleted \? \([\s\S]*?accessibilityLabel=\{`Log \$\{row\.label\}`\}[\s\S]*?onPress=\{row\.onLogSet\}/,
  'row-level Log entry points must remain excluded from the canonical compact timeline',
);
assert.match(
  movementComponent,
  /prominent && action\.tone !== 'accepted'[\s\S]*?<SLButton[\s\S]*?iconRight="chevron-forward"[\s\S]*?size="lg"[\s\S]*?variant="primary"/,
  'the Log Set treatment must reuse the canonical large gradient primary button',
);
assert.match(
  movementComponent,
  /const visibleMovementNote = coreLoggerVisibleMovementNote\(expanded, movementNote\)/,
  'movement-note visibility must derive from the existing expanded state',
);
assert.equal(
  movementComponent.match(/\{visibleMovementNote \? \(/g)?.length,
  2,
  'the shared lifecycle card and legacy fallback must use the expanded-state note gate',
);
assert.match(workoutRoute, /createWorkoutDetailFixture\(loggerScenario, idealWorkoutDetailLifecycle\)/);
assert.match(
  workoutRoute,
  /<CoreMovementLedgerRow[\s\S]*visualContext=\{movementVisualContextFor\(\s*core/,
);
assert.match(workoutRoute, /<CoreMovementLedgerRow[\s\S]*visualContext=\{movementVisualContextFor\(it\)\}/);
assert.match(
  workoutRoute,
  /detailRows=\{accessoryIsExpanded \? movementPresentation\.detailRows : undefined\}/,
  'accessories must feed their canonical detail rows to the shared timeline',
);
assert.match(
  workoutRoute,
  /detailRows=\{detailsExpanded \? movementPresentation\.detailRows : undefined\}/,
  'core movements must feed their canonical detail rows to the shared timeline',
);
assert.doesNotMatch(
  workoutRoute,
  /devProminentLogAction=\{isIdealWorkoutDetailPreview\}/,
  'the canonical movement presentation must not be gated to Ideal previews',
);
assert.match(
  movementComponent,
  /const canonicalMovementCard = sessionIndex != null[\s\S]*?canonicalMovementCard && styles\.activeMovementCardCanonical/,
  'core and accessory items must share the same canonical production movement shell',
);
assert.equal(
  workoutRoute.match(/styles\.canonicalMovementList/g)?.length,
  2,
  'both movement collections must reveal the global background throughout the lifecycle',
);
assert.match(
  workoutRoute,
  /\(isPreSession \|\| isActiveSession\) && detailsExpanded[\s\S]*?movementPresentation\.loggerFocus/,
  'expanded core movements must mount the canonical planned-work hero before and during a session',
);
assert.match(
  workoutRoute,
  /canonicalMovementList:\s*\{[\s\S]*?marginTop: 0[\s\S]*?marginBottom: 0[\s\S]*?backgroundColor: SLColors\.background/,
  'core and accessory collections must use the same card gutter without section-specific spacing',
);
assert.match(
  movementComponent,
  /const cardMaterialState = state === 'logged'[\s\S]*?<MovementCardMaterial[\s\S]*state=\{cardMaterialState\}/,
  'the shared canonical card must derive its material from lifecycle movement state',
);
assert.match(
  movementComponent,
  /activeMovementCardCanonical:\s*\{[\s\S]*?overflow: 'hidden'/,
  'the shared canonical card must prevent ambient lighting from entering the OLED gutter',
);
assert.doesNotMatch(
  movementComponent.match(/const devCardEdgeStyle = devCanonicalMovementCard[\s\S]*?: null;/)?.[0] || '',
  /shadowColor|shadowOpacity|shadowRadius|shadowOffset|elevation/,
  'the canonical card must not use an external shadow or elevation',
);

console.log('Core logger Option A identity rail, metadata, states, content variants, canonical lift identities, and Live/Mock parity guards passed.');
