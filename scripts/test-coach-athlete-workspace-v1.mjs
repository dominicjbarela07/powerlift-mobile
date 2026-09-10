import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const paths = {
  provider: 'components/coach-mobile/athlete-workspace/CoachAthleteWorkspaceContext.tsx',
  shell: 'components/coach-mobile/athlete-workspace/CoachAthleteWorkspaceShell.tsx',
  brief: 'components/coach-mobile/athlete-workspace/CoachAthleteBrief.tsx',
  trainingRoute: 'app/(tabs)/coach-athlete/[athleteId]/training/index.tsx',
  reviews: 'components/coach-mobile/athlete-workspace/CoachAthleteReviews.tsx',
  messages: 'components/coach-mobile/athlete-workspace/CoachAthleteMessages.tsx',
  evidence: 'components/coach-mobile/athlete-workspace/CoachAthleteEvidence.tsx',
  ledgerSubject: 'components/ledger/athlete-ledger-subject.tsx',
  ledgerLayout: 'app/(tabs)/ledger/_layout.tsx',
  archive: 'components/ledger/archive-foundation.tsx',
  archiveDetail: 'components/ledger/archive-detail.tsx',
  archiveClient: 'lib/ledger-archive.ts',
  thread: 'app/(tabs)/messages/[threadId].tsx',
  calendar: 'app/(tabs)/coach-calendar.tsx',
  programming: 'app/(tabs)/workout/index.tsx',
  checkIns: 'components/coach-mobile/CoachCheckInsV2.tsx',
  sessionReview: 'app/(tabs)/coach-session-review.tsx',
  videoReview: 'app/(tabs)/coach-video-review.tsx',
  tabs: 'app/(tabs)/_layout.tsx',
  tabControl: 'components/navigation/sl-tab-row-control.tsx',
};
const source = Object.fromEntries(await Promise.all(Object.entries(paths).map(async ([key, path]) => [key, await read(path)])));

for (const route of [
  'app/(tabs)/coach-athlete/[athleteId]/_layout.tsx',
  'app/(tabs)/coach-athlete/[athleteId]/brief.tsx',
  'app/(tabs)/coach-athlete/[athleteId]/training/index.tsx',
  'app/(tabs)/coach-athlete/[athleteId]/reviews/index.tsx',
  'app/(tabs)/coach-athlete/[athleteId]/messages/index.tsx',
  'app/(tabs)/coach-athlete/[athleteId]/evidence/index.tsx',
  'app/(tabs)/coach-athlete/[athleteId]/context.tsx',
  'app/(tabs)/coach-athlete/[athleteId]/notes.tsx',
]) await read(route);

assert.match(source.provider, /workspace\/bootstrap/);
assert.ok(source.provider.indexOf('workspace/bootstrap') < source.provider.indexOf('summary?view=v3'));
assert.match(source.provider, /new AbortController\(\)/);
assert.match(source.provider, /controllerRef\.current\?\.abort\(\)/);
assert.match(source.provider, /sequenceRef/);
assert.match(source.provider, /subject\.coach_user_id/);
assert.match(source.provider, /subject\.athlete_id/);
assert.match(source.provider, /relationship_generation/);
assert.match(source.provider, /workspace_generation/);
assert.match(source.provider, /!nextBootstrap\.subject\.relationship_generation/);
assert.match(source.provider, /!nextBootstrap\.subject\.workspace_generation/);
assert.match(source.provider, /identityMatches/);
assert.match(source.provider, /subjectKeyRef/);
assert.match(source.provider, /setTrainingState\(EMPTY_TRAINING_STATE\)/);
assert.match(source.provider, /setReviewState\(EMPTY_REVIEW_STATE\)/);
assert.match(source.provider, /setMessageDraft\(''\)/);
assert.match(source.provider, /bootstrapResponse\.status === 403 \|\| bootstrapResponse\.status === 404/);
assert.match(source.provider, /ensureCoachAthleteThread/);
assert.match(source.provider, /AppState\.addEventListener\('change'/);

for (const tab of ["key: 'brief'", "key: 'training'", "key: 'performance'", "key: 'reviews'", "key: 'messages'"]) {
  assert.match(source.shell, new RegExp(tab));
}
assert.match(source.shell, /Back to previous Coach context/);
assert.match(source.shell, /router\.navigate\('\/(?:\(tabs\)\/)?coach-dashboard'/);
assert.match(source.shell, /<SLFloatingNavigationDock/);
assert.match(source.tabs, /<SLFloatingNavigationDock/);
assert.doesNotMatch(
  source.shell,
  /<SLFloatingNavigationDock[\s\S]{0,160}\bflow\b/,
  'Athlete Workspace must use the canonical absolute floating wrapper, never the in-flow DEV showcase variant',
);
assert.match(source.shell, /SL_TAB_ROW_CONTROL/);
assert.match(source.shell, /pulse-outline/);
assert.match(source.shell, /barbell-outline/);
assert.match(source.shell, /checkmark-done-outline/);
assert.match(source.shell, /chatbubbles-outline/);
assert.doesNotMatch(source.shell, /workspaceDock|navItemActive|activeIndicator|navIcon|navLabel/);
assert.match(source.tabControl, /export function SLFloatingNavigationDock/);
assert.match(
  source.tabControl,
  /navigationDock:\s*\{[\s\S]*?bottom:\s*0[\s\S]*?paddingHorizontal:\s*SLLayout\.screenGutter[\s\S]*?position:\s*'absolute'/,
  'the canonical dock must own absolute positioning, exterior gutter, and bottom anchoring',
);
assert.match(source.tabControl, /SL_TAB_ROW_SELECTED_LENS/);
assert.match(source.tabControl, /styles\.navigationSelectedLens/);
assert.match(source.shell, /router\.navigate\([\s\S]*workspaceSubjectKey: workspace\.subjectKey/);
assert.match(source.shell, /\$\{basePath\}\/evidence/);
assert.match(source.shell, /\$\{basePath\}\/notes/);
assert.match(source.shell, /\$\{basePath\}\/context/);
assert.match(source.tabs, /normalizedPathname\.startsWith\('\/coach-athlete\/'\)[\s\S]*return null/);

for (const section of [
  'Needs Your Action',
  'On the program',
  'StrengthHero',
  'Between you two',
  'Upcoming Decisions',
]) assert.match(source.brief, new RegExp(section.replace(/[&/]/g, '\\$&')));
assert.doesNotMatch(source.brief, /Since Last Visit/);
assert.doesNotMatch(source.brief, /COACH BRIEF|Decision-ready evidence/);
assert.match(
  source.reviews,
  /const nextScrollY = event\.nativeEvent\.contentOffset\.y;[\s\S]*setReviewState\(\(current\) => \(\{ \.\.\.current, scrollY: nextScrollY \}\)\)/,
  'Reviews must snapshot scroll position before the pooled native event is released',
);
assert.doesNotMatch(
  source.reviews,
  /setReviewState\([\s\S]{0,120}event\.nativeEvent/,
  'pooled native events must never be captured inside deferred workspace state updaters',
);

assert.match(source.trainingRoute, /import TrainingIndexScreen from '@\/app\/\(tabs\)\/workout'/);
assert.match(source.trainingRoute, /return <TrainingIndexScreen \/>/);
assert.doesNotMatch(source.trainingRoute, /athlete-workspace\/CoachAthleteTraining/);
assert.match(source.programming, /const rosterAthleteId = params\.athleteId/);
assert.match(source.programming, /`\/workouts\/my_list\/mobile\/\$\{rosterAthleteId\}`/);
assert.match(source.programming, /isProgrammingManager = isIndividual \|\| !!rosterAthleteId/);
assert.match(source.programming, /<IndividualProgrammingHome/);
assert.match(source.programming, /managedAthleteId=\{rosterAthleteId \? Number\(rosterAthleteId\)/);
assert.match(source.programming, /scopeProgrammingPayload/);
assert.match(source.programming, /workspaceReturn === 'training'/);

assert.match(source.reviews, /getCoachReviewQueue/);
assert.match(source.reviews, /athlete_id: bootstrap\.athlete\.id/);
assert.match(source.reviews, /buildCoachVideoReviewReturnParams/);
assert.match(source.reviews, /kind: 'workspace'/);
assert.match(source.reviews, /destination: 'reviews'/);
assert.match(source.reviews, /itemKeys: rows\.map/);
assert.match(source.reviews, /queuePosition: index/);
assert.match(source.reviews, /return \(\) => controller\.abort\(\)/);
assert.match(source.checkIns, /onWorkspaceReturn/);
assert.match(source.sessionReview, /returnToWorkspace/);
assert.match(source.videoReview, /returnToWorkspace/);

assert.match(source.messages, /<ThreadScreen/);
assert.match(source.messages, /forcedThreadId=\{workspace\.messageThreadId\}/);
assert.match(source.messages, /initialDraft=\{workspace\.messageDraft\}/);
assert.match(source.messages, /onDraftChange=\{workspace\.setMessageDraft\}/);
assert.match(source.thread, /workspaceAthleteId/);
assert.match(source.thread, /buildCoachVideoReviewReturnParams/);
assert.match(source.thread, /destination: 'messages'/);
assert.match(source.thread, /Start the conversation with \$\{title\}/);

for (const room of ['Journey', 'Strength', 'Achievements', 'Accessories', 'Variants', 'Archive']) {
  assert.match(source.evidence, new RegExp(`label: '${room}'`));
}
assert.match(source.evidence, /athleteId: String\(athlete\.id\)/);
assert.match(source.evidence, /athlete_id: String\(athlete\.id\)/);
assert.match(source.ledgerSubject, /ids\.length === 1/);
assert.match(source.ledgerSubject, /returnToWorkspace/);
assert.match(source.ledgerSubject, /workspaceReturn/);
assert.match(source.ledgerLayout, /subject\.isWorkspaceScoped && !subject\.valid/);
assert.match(source.archive, /ledgerSubject\.athleteId/);
assert.match(source.archive, /workspaceAthleteId: ledgerSubject\.routeParams\.workspaceAthleteId/);
assert.match(source.archiveDetail, /\.\.\.ledgerSubject\.routeParams/);
assert.match(source.archiveClient, /returnToWorkspace: returnState\.returnToWorkspace/);

assert.match(source.calendar, /lockedAthleteId/);
assert.match(source.calendar, /athlete_id: lockedAthleteId \? String\(lockedAthleteId\) : 'ALL'/);
assert.doesNotMatch(source.calendar, /setParams\(\{\s*athleteId:\s*undefined/);

console.log('coach athlete workspace V1 relationship, navigation, and isolation contract: PASS');
